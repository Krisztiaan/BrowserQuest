import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../shared/cli-args';

type UnknownRecord = Record<string, unknown>;

type TilesetTarget = Readonly<{
    scope: string;
    tileset: UnknownRecord;
}>;

function fail(message: string): never {
    throw new Error(message);
}

function asRecord(value: unknown): UnknownRecord | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as UnknownRecord;
}

function asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

function asInteger(value: unknown): number | null {
    return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function parseCsv(value: string): string[] {
    return value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}

function parsePositiveIntegerLike(value: unknown, label: string): number {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
        return value;
    }
    if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
        const parsed = Number.parseInt(value.trim(), 10);
        if (parsed > 0) {
            return parsed;
        }
    }
    fail(`Expected positive integer for ${label}.`);
}

function collectTilesetTargets(root: UnknownRecord): TilesetTarget[] {
    const targets: TilesetTarget[] = [];
    const looksLikeTileset =
        asArray(root.tilesets).length === 0 && (asInteger(root.tilecount) !== null || asArray(root.tiles).length > 0);
    if (looksLikeTileset) {
        targets.push({ scope: 'tileset-root', tileset: root });
        return targets;
    }

    const tilesets = asArray(root.tilesets);
    for (let index = 0; index < tilesets.length; index += 1) {
        const tileset = asRecord(tilesets[index]);
        if (!tileset) {
            continue;
        }
        if (asArray(tileset.tiles).length === 0) {
            continue;
        }
        targets.push({ scope: `tilesets[${index}]`, tileset });
    }

    return targets;
}

function printUsage(): never {
    console.log(
        'Usage: bun tools/content/tileset-modernize-metadata.ts [--files <csv>] [--default-delay <ms>] [--write]'
    );
    process.exit(0);
}

async function main(): Promise<void> {
    const parsedArgs = parseCliArgs(
        process.argv.slice(2),
        [
            { key: 'files', kind: 'string', defaultValue: 'assets/maps/tiled/tilesheet.wang.tsj' },
            { key: 'default-delay', kind: 'number', defaultValue: 100 },
            { key: 'write', kind: 'boolean', defaultValue: false },
        ],
        { onHelp: printUsage }
    );

    const files = parseCsv(String(parsedArgs.files ?? ''));
    if (files.length === 0) {
        fail('No input files provided.');
    }
    const defaultDelay = Number(parsedArgs['default-delay'] ?? 100);
    if (!Number.isInteger(defaultDelay) || defaultDelay <= 0) {
        fail(`--default-delay must be a positive integer. Received: ${defaultDelay}`);
    }
    const write = Boolean(parsedArgs.write);

    let totalRemovedLengthProps = 0;
    let totalRemovedDelayProps = 0;
    let totalRemovedEmptyNameProps = 0;
    let totalCreatedAnimations = 0;
    let totalTouchedTiles = 0;

    const perFile: UnknownRecord[] = [];

    for (const fileInput of files) {
        const filePath = path.resolve(process.cwd(), fileInput);
        const payload = await fs.readFile(filePath, 'utf8');
        const root = asRecord(JSON.parse(payload));
        if (!root) {
            fail(`Invalid JSON object root in ${fileInput}`);
        }

        const targets = collectTilesetTargets(root);
        let removedLengthProps = 0;
        let removedDelayProps = 0;
        let removedEmptyNameProps = 0;
        let createdAnimations = 0;
        let touchedTiles = 0;

        for (const target of targets) {
            const tilecount = asInteger(target.tileset.tilecount);
            const tiles = asArray(target.tileset.tiles)
                .map((entry) => asRecord(entry))
                .filter((tile): tile is UnknownRecord => tile !== null);
            target.tileset.tiles = tiles;

            for (const tile of tiles) {
                const tileId = asInteger(tile.id);
                if (tileId === null || tileId < 0) {
                    continue;
                }
                const properties = asArray(tile.properties)
                    .map((entry) => asRecord(entry))
                    .filter((prop): prop is UnknownRecord => prop !== null);

                let length: number | null = null;
                let delay: number | null = null;
                const keptProperties: UnknownRecord[] = [];

                for (const prop of properties) {
                    const name = asString(prop.name) ?? '';
                    const normalizedName = name.trim();
                    if (normalizedName.length === 0) {
                        removedEmptyNameProps += 1;
                        continue;
                    }
                    if (normalizedName === 'length') {
                        length = parsePositiveIntegerLike(prop.value, `tile ${tileId} length`);
                        removedLengthProps += 1;
                        continue;
                    }
                    if (normalizedName === 'delay') {
                        delay = parsePositiveIntegerLike(prop.value, `tile ${tileId} delay`);
                        removedDelayProps += 1;
                        continue;
                    }
                    keptProperties.push(prop);
                }

                const shouldAnimate = length !== null;
                if (shouldAnimate) {
                    const frameCount = length ?? 0;
                    if (tilecount !== null && tileId + frameCount > tilecount) {
                        fail(`Animation for tile ${tileId} in ${fileInput} exceeds tilecount ${tilecount}.`);
                    }
                    if (asArray(tile.animation).length > 0) {
                        fail(`Tile ${tileId} in ${fileInput} already has animation; refusing mixed legacy metadata.`);
                    }
                    const duration = delay ?? defaultDelay;
                    tile.animation = Array.from({ length: frameCount }, (_, index) => ({
                        tileid: tileId + index,
                        duration,
                    }));
                    createdAnimations += 1;
                }

                if (keptProperties.length > 0) {
                    tile.properties = keptProperties;
                } else {
                    delete tile.properties;
                }

                if (shouldAnimate || keptProperties.length !== properties.length) {
                    touchedTiles += 1;
                }
            }
        }

        if (write) {
            await fs.writeFile(filePath, `${JSON.stringify(root, null, 2)}\n`, 'utf8');
        }

        totalRemovedLengthProps += removedLengthProps;
        totalRemovedDelayProps += removedDelayProps;
        totalRemovedEmptyNameProps += removedEmptyNameProps;
        totalCreatedAnimations += createdAnimations;
        totalTouchedTiles += touchedTiles;

        perFile.push({
            file: fileInput,
            tilesetTargets: targets.length,
            removedLengthProps,
            removedDelayProps,
            removedEmptyNameProps,
            createdAnimations,
            touchedTiles,
        });
    }

    console.log(
        JSON.stringify(
            {
                write,
                files,
                defaultDelay,
                totals: {
                    removedLengthProps: totalRemovedLengthProps,
                    removedDelayProps: totalRemovedDelayProps,
                    removedEmptyNameProps: totalRemovedEmptyNameProps,
                    createdAnimations: totalCreatedAnimations,
                    touchedTiles: totalTouchedTiles,
                },
                perFile,
            },
            null,
            2
        )
    );
}

void main();
