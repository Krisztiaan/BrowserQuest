import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { tileIdToSourceRect, type TileSheetGeometry } from './terrain-visual-artifacts';

type UnknownRecord = Record<string, unknown>;

export type PrototypeSourceTile = Readonly<{
    family: string;
    gid: number;
    tileId: number;
}>;

export type PrototypeEntry = Readonly<{
    pair: string;
    shape: string;
    outputTileId: number;
    base: PrototypeSourceTile;
    overlay: PrototypeSourceTile;
    mask: string;
    maskDraw: string;
}>;

export type PrototypeManifest = Readonly<{
    generatedBy: string;
    pair: string;
    image: string;
    tileWidth: number;
    tileHeight: number;
    columns: number;
    entries: ReadonlyArray<PrototypeEntry>;
}>;

const defaultGrammar = 'assets/maps/tiled/terrain-authoring.json';
const defaultTileset = 'assets/maps/tiled/tilesheet.wang.tsj';
const defaultOutDir = 'assets/maps/tiled/prototypes';
const prototypeImageName = 'terrain-transitions.prototype.png';
const prototypeTilesetName = 'terrain-transitions.prototype.tsj';
const prototypeManifestName = 'terrain-transitions.prototype.manifest.json';
const prototypeColumns = 5;
const shorelineSource = {
    pair: 'shoreline',
    from: { family: 'water', gid: 405, tileId: 404 },
    to: { family: 'sand', gid: 140, tileId: 139 },
} as const;

function asRecord(value: unknown): UnknownRecord | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;
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

async function streamText(stream: ReadableStream<Uint8Array> | null): Promise<string> {
    if (!stream) {
        return '';
    }
    return new Response(stream).text();
}

async function runCommand(command: string, args: readonly string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const proc = Bun.spawn([command, ...args], { stdout: 'pipe', stderr: 'pipe' });
    const [stdout, stderr, exitCode] = await Promise.all([streamText(proc.stdout), streamText(proc.stderr), proc.exited]);
    return { exitCode, stdout, stderr };
}

async function resolveConvertCommand(): Promise<string> {
    const magick = await runCommand('magick', ['-version']).catch(() => null);
    if (magick?.exitCode === 0) {
        return 'magick';
    }
    const convert = await runCommand('convert', ['-version']).catch(() => null);
    if (convert?.exitCode === 0) {
        return 'convert';
    }
    throw new Error('ImageMagick is required. Install ImageMagick so either `magick` or `convert` is available.');
}

async function runConvert(args: readonly string[], command: string): Promise<void> {
    const result = await runCommand(command, args);
    if (result.exitCode !== 0) {
        throw new Error(`${command} ${args.join(' ')} failed with ${result.exitCode}\n${result.stdout}\n${result.stderr}`);
    }
}

export function maskDrawForShape(shape: string): string {
    switch (shape) {
        case 'edge_n':
            return 'rectangle 0,0 15,7';
        case 'edge_s':
            return 'rectangle 0,8 15,15';
        case 'edge_e':
            return 'rectangle 8,0 15,15';
        case 'edge_w':
            return 'rectangle 0,0 7,15';
        case 'outer_ne':
            return 'polygon 8,0 15,0 15,7';
        case 'outer_nw':
            return 'polygon 0,0 7,0 0,7';
        case 'outer_se':
            return 'polygon 15,8 15,15 8,15';
        case 'outer_sw':
            return 'polygon 0,8 7,15 0,15';
        case 'inner_ne':
            return 'rectangle 0,0 15,7 rectangle 8,0 15,15';
        case 'inner_nw':
            return 'rectangle 0,0 15,7 rectangle 0,0 7,15';
        case 'inner_se':
            return 'rectangle 0,8 15,15 rectangle 8,0 15,15';
        case 'inner_sw':
            return 'rectangle 0,8 15,15 rectangle 0,0 7,15';
        case 'island':
            return 'ellipse 7.5,7.5 4,4 0,360';
        case 'channel_h':
            return 'rectangle 0,6 15,9';
        case 'channel_v':
            return 'rectangle 6,0 9,15';
        default:
            throw new Error(`Unsupported prototype transition shape: ${shape}`);
    }
}

export function shorelinePrototypeEntries(grammar: UnknownRecord): PrototypeEntry[] {
    const pair = asArray(grammar.transitionPairs)
        .map((entry) => asRecord(entry))
        .find((entry) => asString(entry?.id) === shorelineSource.pair);
    if (!pair) {
        throw new Error(`Missing transition pair: ${shorelineSource.pair}`);
    }
    return asArray(pair.requiredShapes)
        .map((entry) => asString(entry))
        .filter((entry): entry is string => entry !== null)
        .map((shape, outputTileId) => ({
            pair: shorelineSource.pair,
            shape,
            outputTileId,
            base: shorelineSource.to,
            overlay: shorelineSource.from,
            mask: `${shape}.mask`,
            maskDraw: maskDrawForShape(shape),
        }));
}

export function buildPrototypeManifest(entries: readonly PrototypeEntry[]): PrototypeManifest {
    return {
        generatedBy: 'tools/content/terrain-transition-prototype.ts',
        pair: shorelineSource.pair,
        image: prototypeImageName,
        tileWidth: 16,
        tileHeight: 16,
        columns: prototypeColumns,
        entries,
    };
}

export function buildPrototypeTileset(manifest: PrototypeManifest): UnknownRecord {
    const rows = Math.ceil(manifest.entries.length / manifest.columns);
    return {
        columns: manifest.columns,
        image: manifest.image,
        imageheight: rows * manifest.tileHeight,
        imagewidth: manifest.columns * manifest.tileWidth,
        margin: 0,
        name: 'terrain-transitions-prototype',
        spacing: 0,
        tilecount: manifest.entries.length,
        tiledversion: '1.11.2',
        tileheight: manifest.tileHeight,
        tiles: manifest.entries.map((entry) => ({
            id: entry.outputTileId,
            properties: [
                { name: 'prototype', type: 'bool', value: true },
                { name: 'terrain_pair', type: 'string', value: entry.pair },
                { name: 'transition_shape', type: 'string', value: entry.shape },
                { name: 'source_base_family', type: 'string', value: entry.base.family },
                { name: 'source_base_gid', type: 'int', value: entry.base.gid },
                { name: 'source_base_tile_id', type: 'int', value: entry.base.tileId },
                { name: 'source_overlay_family', type: 'string', value: entry.overlay.family },
                { name: 'source_overlay_gid', type: 'int', value: entry.overlay.gid },
                { name: 'source_overlay_tile_id', type: 'int', value: entry.overlay.tileId },
                { name: 'mask', type: 'string', value: entry.mask },
            ],
        })),
        tilewidth: manifest.tileWidth,
        type: 'tileset',
        version: '1.10',
    };
}

function resolveTilesetImagePath(tilesetPath: string, tileset: UnknownRecord): string {
    const image = asString(tileset.image);
    if (!image) {
        throw new Error(`Tileset ${tilesetPath} is missing an image reference.`);
    }
    return path.resolve(path.dirname(tilesetPath), image);
}

async function cropSourceTile({
    command,
    sourceImage,
    outputPath,
    tileId,
    geometry,
}: {
    command: string;
    sourceImage: string;
    outputPath: string;
    tileId: number;
    geometry: TileSheetGeometry;
}): Promise<void> {
    const rect = tileIdToSourceRect(tileId, geometry);
    await runConvert([sourceImage, '-crop', `${rect.width}x${rect.height}+${rect.x}+${rect.y}`, '+repage', outputPath], command);
}

async function renderPrototypeTile({
    command,
    entry,
    baseTile,
    overlayTile,
    outPath,
    tempDir,
}: {
    command: string;
    entry: PrototypeEntry;
    baseTile: string;
    overlayTile: string;
    outPath: string;
    tempDir: string;
}): Promise<void> {
    const maskPath = path.join(tempDir, `${entry.shape}.mask.png`);
    const overlayAlphaPath = path.join(tempDir, `${entry.shape}.overlay.png`);
    await runConvert(['-size', '16x16', 'xc:black', '-fill', 'white', '-draw', entry.maskDraw, maskPath], command);
    await runConvert([overlayTile, maskPath, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', overlayAlphaPath], command);
    await runConvert([baseTile, overlayAlphaPath, '-compose', 'over', '-composite', outPath], command);
}

async function writePrototypeImage({
    command,
    entries,
    sourceImage,
    outPath,
    geometry,
}: {
    command: string;
    entries: readonly PrototypeEntry[];
    sourceImage: string;
    outPath: string;
    geometry: TileSheetGeometry;
}): Promise<void> {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'bq-terrain-prototype-'));
    try {
        const baseTile = path.join(tempDir, 'base.png');
        const overlayTile = path.join(tempDir, 'overlay.png');
        await cropSourceTile({ command, sourceImage, outputPath: baseTile, tileId: shorelineSource.to.tileId, geometry });
        await cropSourceTile({ command, sourceImage, outputPath: overlayTile, tileId: shorelineSource.from.tileId, geometry });

        const renderedTiles: string[] = [];
        for (const entry of entries) {
            const tilePath = path.join(tempDir, `${entry.outputTileId}-${entry.shape}.png`);
            await renderPrototypeTile({ command, entry, baseTile, overlayTile, outPath: tilePath, tempDir });
            renderedTiles.push(tilePath);
        }

        const rowPaths: string[] = [];
        for (let offset = 0; offset < renderedTiles.length; offset += prototypeColumns) {
            const row = renderedTiles.slice(offset, offset + prototypeColumns);
            while (row.length < prototypeColumns) {
                const blankPath = path.join(tempDir, `blank-${offset}-${row.length}.png`);
                await runConvert(['-size', '16x16', 'xc:none', blankPath], command);
                row.push(blankPath);
            }
            const rowPath = path.join(tempDir, `row-${rowPaths.length}.png`);
            await runConvert([...row, '+append', rowPath], command);
            rowPaths.push(rowPath);
        }
        await runConvert([...rowPaths, '-append', outPath], command);
    } finally {
        await rm(tempDir, { recursive: true, force: true });
    }
}

export async function generateTerrainTransitionPrototype({
    grammarPath = defaultGrammar,
    tilesetPath = defaultTileset,
    outDir = defaultOutDir,
}: {
    grammarPath?: string;
    tilesetPath?: string;
    outDir?: string;
} = {}): Promise<PrototypeManifest> {
    const command = await resolveConvertCommand();
    const grammar = asRecord(JSON.parse(await readFile(grammarPath, 'utf8')));
    const tileset = asRecord(JSON.parse(await readFile(tilesetPath, 'utf8')));
    if (!grammar || !tileset) {
        throw new Error('Expected grammar and tileset JSON objects.');
    }
    const geometry: TileSheetGeometry = {
        columns: asInteger(tileset.columns) ?? 1,
        tileWidth: asInteger(tileset.tilewidth) ?? 16,
        tileHeight: asInteger(tileset.tileheight) ?? 16,
        firstGid: 1,
    };
    const sourceImage = resolveTilesetImagePath(tilesetPath, tileset);
    const entries = shorelinePrototypeEntries(grammar);
    const manifest = buildPrototypeManifest(entries);

    await mkdir(outDir, { recursive: true });
    await writePrototypeImage({
        command,
        entries,
        sourceImage,
        outPath: path.join(outDir, prototypeImageName),
        geometry,
    });
    await writeFile(path.join(outDir, prototypeTilesetName), `${JSON.stringify(buildPrototypeTileset(manifest), null, 2)}\n`);
    await writeFile(path.join(outDir, prototypeManifestName), `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
}

if (import.meta.main) {
    generateTerrainTransitionPrototype()
        .then((manifest) => {
            console.log(`Wrote ${path.join(defaultOutDir, prototypeImageName)}`);
            console.log(`Generated ${manifest.entries.length} ${manifest.pair} prototype transitions`);
        })
        .catch((error: unknown) => {
            console.error(error instanceof Error ? error.message : String(error));
            process.exit(1);
        });
}
