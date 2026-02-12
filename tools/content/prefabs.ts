import fs from 'node:fs/promises';
import path from 'node:path';
import Types from '../../shared/gametypes-browser';
import type { EntityKind } from '../../shared/entity-kind-domain';

type MobPropertyEntry = {
    drops: Record<string, number>;
    hp: number;
    armor: number;
    weapon: number;
};

type MobPropertyMap = Record<string, MobPropertyEntry>;

type ItemLootMessageMap = Record<string, string>;

type PrefabDrop = {
    kind: EntityKind;
    chance: number;
};

type GeneratedMobPrefab = {
    readonly type: 'mob';
    readonly kind: EntityKind;
    readonly combat: {
        readonly maxHitPoints: number;
        readonly armorLevel: number;
        readonly weaponLevel: number;
    };
    readonly drops: readonly PrefabDrop[];
};

type GeneratedItemPrefab = {
    readonly type: 'item';
    readonly kind: EntityKind;
    readonly lootMessage: string;
};

type GeneratedPrefabModule = Readonly<{
    mobsByKind: Record<number, GeneratedMobPrefab>;
    itemsByKind: Record<number, GeneratedItemPrefab>;
}>;

const MOB_PROPERTIES_PATH = new URL('../../assets/content/mob-properties.json', import.meta.url);
const ITEM_LOOT_MESSAGES_PATH = new URL('../../assets/content/item-loot-messages.json', import.meta.url);
const GENERATED_PATH = new URL('../../shared/generated/prefabs.generated.ts', import.meta.url);

function fail(message: string): never {
    throw new Error(message);
}

function isInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateAndNormalizeMobPropertyMap(value: unknown): MobPropertyMap {
    if (!isRecord(value)) {
        fail('Canonical mob-properties content must be an object map.');
    }

    const normalized: MobPropertyMap = {};

    Object.keys(value)
        .sort()
        .forEach((mobName) => {
            const entry = value[mobName];
            if (!isRecord(entry)) {
                fail(`Mob entry "${mobName}" must be an object.`);
            }

            const mobKind = Types.getKindFromString(mobName);
            if (mobKind === undefined || !Types.isMob(mobKind)) {
                fail(`Mob entry "${mobName}" is not a known mob kind.`);
            }

            const hp = entry.hp;
            const armor = entry.armor;
            const weapon = entry.weapon;
            const drops = entry.drops;

            if (!isInteger(hp) || hp < 1) {
                fail(`Mob "${mobName}" has invalid "hp" value.`);
            }
            if (!isInteger(armor) || armor < 1) {
                fail(`Mob "${mobName}" has invalid "armor" value.`);
            }
            if (!isInteger(weapon) || weapon < 1) {
                fail(`Mob "${mobName}" has invalid "weapon" value.`);
            }
            if (!isRecord(drops)) {
                fail(`Mob "${mobName}" has invalid "drops" map.`);
            }

            const normalizedDrops: Record<string, number> = {};
            Object.keys(drops)
                .sort()
                .forEach((dropKindName) => {
                    const dropChance = drops[dropKindName];
                    if (!isInteger(dropChance) || dropChance < 0 || dropChance > 100) {
                        fail(`Mob "${mobName}" has invalid drop chance for "${dropKindName}".`);
                    }
                    const dropKind = Types.getKindFromString(dropKindName);
                    if (dropKind === undefined || !Types.isItem(dropKind)) {
                        fail(`Mob "${mobName}" references unknown/non-item drop "${dropKindName}".`);
                    }
                    normalizedDrops[dropKindName] = dropChance;
                });

            normalized[mobName] = {
                drops: normalizedDrops,
                hp,
                armor,
                weapon,
            };
        });

    const knownMobNames: string[] = [];
    Types.forEachKind((kind, kindName) => {
        if (Types.isMob(kind)) {
            knownMobNames.push(kindName);
        }
    });
    knownMobNames.sort();

    const missingMobKinds = knownMobNames.filter((mobName) => !(mobName in normalized));
    if (missingMobKinds.length > 0) {
        fail(`Canonical mob-properties content is missing mob kinds: ${missingMobKinds.join(', ')}`);
    }

    return normalized;
}

function validateAndNormalizeItemLootMessages(value: unknown): ItemLootMessageMap {
    if (!isRecord(value)) {
        fail('Canonical item-loot-messages content must be an object map.');
    }

    const normalized: ItemLootMessageMap = {};

    Object.keys(value)
        .sort()
        .forEach((itemKindName) => {
            const message = value[itemKindName];
            if (typeof message !== 'string' || message.trim().length === 0) {
                fail(`Item "${itemKindName}" must map to a non-empty loot message string.`);
            }

            const kind = Types.getKindFromString(itemKindName);
            if (kind === undefined || !Types.isItem(kind)) {
                fail(`Item "${itemKindName}" is not a known item kind.`);
            }

            normalized[itemKindName] = message;
        });

    if (Object.keys(normalized).length === 0) {
        fail('Canonical item-loot-messages content cannot be empty.');
    }

    return normalized;
}

async function readCanonical(): Promise<{ mobs: MobPropertyMap; items: ItemLootMessageMap }> {
    const mobPayload = await fs.readFile(MOB_PROPERTIES_PATH, 'utf8');
    const itemPayload = await fs.readFile(ITEM_LOOT_MESSAGES_PATH, 'utf8');
    return {
        mobs: validateAndNormalizeMobPropertyMap(JSON.parse(mobPayload)),
        items: validateAndNormalizeItemLootMessages(JSON.parse(itemPayload)),
    };
}

function buildGeneratedModule({ mobs, items }: { mobs: MobPropertyMap; items: ItemLootMessageMap }): GeneratedPrefabModule {
    const mobsByKind: Record<number, GeneratedMobPrefab> = {};
    for (const [mobName, entry] of Object.entries(mobs).sort(([a], [b]) => a.localeCompare(b))) {
        const kind = Types.getKindFromString(mobName);
        if (kind === undefined) {
            continue;
        }
        const drops: PrefabDrop[] = Object.keys(entry.drops)
            .sort()
            .map((dropKindName) => {
                const dropKind = Types.getKindFromString(dropKindName);
                if (dropKind === undefined) {
                    fail(`Mob "${mobName}" references unknown drop kind "${dropKindName}".`);
                }
                return { kind: dropKind, chance: entry.drops[dropKindName] ?? 0 };
            });

        mobsByKind[kind] = {
            type: 'mob',
            kind,
            combat: {
                maxHitPoints: entry.hp,
                armorLevel: entry.armor,
                weaponLevel: entry.weapon,
            },
            drops,
        };
    }

    const itemsByKind: Record<number, GeneratedItemPrefab> = {};
    for (const [itemName, lootMessage] of Object.entries(items).sort(([a], [b]) => a.localeCompare(b))) {
        const kind = Types.getKindFromString(itemName);
        if (kind === undefined) {
            continue;
        }
        itemsByKind[kind] = { type: 'item', kind, lootMessage };
    }

    return { mobsByKind, itemsByKind };
}

function renderGeneratedModule(data: GeneratedPrefabModule): string {
    const mobsSerialized = JSON.stringify(data.mobsByKind, null, 4);
    const itemsSerialized = JSON.stringify(data.itemsByKind, null, 4);

    return `/* eslint-disable */
// Auto-generated from assets/content/* by tools/content/prefabs.ts.
// Do not edit this file directly.

import type { EntityKind } from '../entity-kind-domain';

export const MOB_PREFABS = ${mobsSerialized} as const satisfies Record<number, {
    readonly type: 'mob';
    readonly kind: EntityKind;
    readonly combat: {
        readonly maxHitPoints: number;
        readonly armorLevel: number;
        readonly weaponLevel: number;
    };
    readonly drops: readonly Readonly<{ kind: EntityKind; chance: number }>[];
}>;

export const ITEM_PREFABS = ${itemsSerialized} as const satisfies Record<number, {
    readonly type: 'item';
    readonly kind: EntityKind;
    readonly lootMessage: string;
}>;
`;
}

async function generate(): Promise<void> {
    const canonical = await readCanonical();
    const moduleData = buildGeneratedModule(canonical);
    const output = renderGeneratedModule(moduleData);
    await fs.mkdir(path.dirname(GENERATED_PATH.pathname), { recursive: true });
    await fs.writeFile(GENERATED_PATH, output, 'utf8');
    console.log(`Generated ${GENERATED_PATH.pathname}`);
}

async function check(): Promise<void> {
    const canonical = await readCanonical();
    const moduleData = buildGeneratedModule(canonical);
    const expected = renderGeneratedModule(moduleData);
    const current = await fs.readFile(GENERATED_PATH, 'utf8').catch(() => '');
    if (current !== expected) {
        fail('Generated prefabs are out of date. Run `bun run content:prefabs:generate` to refresh shared/generated/prefabs.generated.ts.');
    }
    console.log('prefabs generated artifact is up to date.');
}

const mode = process.argv[2] ?? 'generate';
if (mode === 'generate') {
    await generate();
} else if (mode === 'check') {
    await check();
} else {
    fail(`Unknown mode "${mode}". Use "generate" or "check".`);
}
