import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../shared/cli-args';

type UnknownRecord = Record<string, unknown>;

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

function printUsage(): never {
    console.log(
        'Usage: bun tools/content/tileset-migrate-c-to-objectgroup.ts [--files <csv>] [--write]'
    );
    process.exit(0);
}

function createFullTileCollisionObject(tileWidth: number, tileHeight: number): UnknownRecord {
    return {
        draworder: 'index',
        id: 1,
        name: '',
        opacity: 1,
        type: 'objectgroup',
        visible: true,
        x: 0,
        y: 0,
        objects: [
            {
                id: 1,
                name: '',
                type: '',
                x: 0,
                y: 0,
                width: tileWidth,
                height: tileHeight,
                rotation: 0,
                visible: true,
            },
        ],
    };
}

type TilesetTarget = {
    scopeLabel: string;
    tileWidth: number;
    tileHeight: number;
    tilesetRecord: UnknownRecord;
};

function collectTilesetTargets(root: UnknownRecord): TilesetTarget[] {
    const targets: TilesetTarget[] = [];
    const rootTileWidth = asInteger(root.tilewidth) ?? 16;
    const rootTileHeight = asInteger(root.tileheight) ?? 16;

    const looksLikeTileset =
        asArray(root.tilesets).length === 0
        && (asInteger(root.tilecount) !== null || asArray(root.tiles).length > 0);

    if (looksLikeTileset) {
        targets.push({
            scopeLabel: 'tileset-root',
            tileWidth: asInteger(root.tilewidth) ?? rootTileWidth,
            tileHeight: asInteger(root.tileheight) ?? rootTileHeight,
            tilesetRecord: root,
        });
        return targets;
    }

    const tilesets = asArray(root.tilesets);
    for (let index = 0; index < tilesets.length; index += 1) {
        const tilesetRecord = asRecord(tilesets[index]);
        if (!tilesetRecord) {
            continue;
        }
        if (asArray(tilesetRecord.tiles).length === 0) {
            continue;
        }
        targets.push({
            scopeLabel: `tilesets[${index}]`,
            tileWidth: asInteger(tilesetRecord.tilewidth) ?? rootTileWidth,
            tileHeight: asInteger(tilesetRecord.tileheight) ?? rootTileHeight,
            tilesetRecord,
        });
    }

    return targets;
}

async function main(): Promise<void> {
    const parsedArgs = parseCliArgs(
        process.argv.slice(2),
        [
            {
                key: 'files',
                kind: 'string',
                defaultValue: 'assets/maps/tiled/tilesheet.wang.tsj,assets/maps/tiled/world.json',
            },
            { key: 'write', kind: 'boolean', defaultValue: false },
        ],
        { onHelp: printUsage }
    );

    const files = parseCsv(String(parsedArgs.files ?? ''));
    if (files.length === 0) {
        fail('No files provided.');
    }
    const write = Boolean(parsedArgs.write);

    const summaries: Array<UnknownRecord> = [];
    let totalTilesWithLegacyC = 0;
    let totalConvertedObjectgroups = 0;
    let totalRemovedLegacyCProperties = 0;
    let totalAlreadyHadObjectgroup = 0;

    for (const fileInput of files) {
        const filePath = path.resolve(process.cwd(), fileInput);
        const payload = await fs.readFile(filePath, 'utf8');
        const root = asRecord(JSON.parse(payload));
        if (!root) {
            fail(`Invalid JSON root in ${fileInput}`);
        }

        const targets = collectTilesetTargets(root);
        if (targets.length === 0) {
            summaries.push({
                file: fileInput,
                tilesetsVisited: 0,
                tilesWithLegacyC: 0,
                convertedObjectgroups: 0,
                removedLegacyCProperties: 0,
                alreadyHadObjectgroup: 0,
            });
            continue;
        }

        let fileTilesWithLegacyC = 0;
        let fileConvertedObjectgroups = 0;
        let fileRemovedLegacyCProperties = 0;
        let fileAlreadyHadObjectgroup = 0;

        for (const target of targets) {
            const tiles = asArray(target.tilesetRecord.tiles);
            const normalizedTiles: UnknownRecord[] = [];
            for (const tileEntry of tiles) {
                const tileRecord = asRecord(tileEntry);
                if (!tileRecord) {
                    continue;
                }

                const properties = asArray(tileRecord.properties)
                    .map((entry) => asRecord(entry))
                    .filter((propertyRecord): propertyRecord is UnknownRecord => propertyRecord !== null);
                const hadLegacyC = properties.some((propertyRecord) => asString(propertyRecord.name) === 'c');

                if (hadLegacyC) {
                    fileTilesWithLegacyC += 1;
                    const filteredProperties = properties.filter((propertyRecord) => asString(propertyRecord.name) !== 'c');
                    fileRemovedLegacyCProperties += properties.length - filteredProperties.length;
                    if (filteredProperties.length > 0) {
                        tileRecord.properties = filteredProperties;
                    } else {
                        delete tileRecord.properties;
                    }

                    const objectgroupRecord = asRecord(tileRecord.objectgroup);
                    const objectgroupObjects = objectgroupRecord ? asArray(objectgroupRecord.objects) : [];
                    if (objectgroupObjects.length > 0) {
                        fileAlreadyHadObjectgroup += 1;
                    } else {
                        tileRecord.objectgroup = createFullTileCollisionObject(target.tileWidth, target.tileHeight);
                        fileConvertedObjectgroups += 1;
                    }
                }

                normalizedTiles.push(tileRecord);
            }
            target.tilesetRecord.tiles = normalizedTiles;
        }

        if (write) {
            await fs.writeFile(filePath, `${JSON.stringify(root, null, 2)}\n`, 'utf8');
        }

        totalTilesWithLegacyC += fileTilesWithLegacyC;
        totalConvertedObjectgroups += fileConvertedObjectgroups;
        totalRemovedLegacyCProperties += fileRemovedLegacyCProperties;
        totalAlreadyHadObjectgroup += fileAlreadyHadObjectgroup;

        summaries.push({
            file: fileInput,
            tilesetsVisited: targets.length,
            tilesWithLegacyC: fileTilesWithLegacyC,
            convertedObjectgroups: fileConvertedObjectgroups,
            removedLegacyCProperties: fileRemovedLegacyCProperties,
            alreadyHadObjectgroup: fileAlreadyHadObjectgroup,
        });
    }

    console.log(
        JSON.stringify(
            {
                write,
                files,
                totals: {
                    tilesWithLegacyC: totalTilesWithLegacyC,
                    convertedObjectgroups: totalConvertedObjectgroups,
                    removedLegacyCProperties: totalRemovedLegacyCProperties,
                    alreadyHadObjectgroup: totalAlreadyHadObjectgroup,
                },
                summaries,
            },
            null,
            2
        )
    );
}

void main();
