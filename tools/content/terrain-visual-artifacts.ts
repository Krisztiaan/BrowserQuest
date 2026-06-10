import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export type TileSheetGeometry = Readonly<{
    columns: number;
    tileWidth: number;
    tileHeight: number;
    firstGid: number;
}>;

type UnknownRecord = Record<string, unknown>;
type AtlasLabel = Readonly<{
    tileId: number;
    gid: number;
    sourceX: number;
    sourceY: number;
    sourceWidth: number;
    sourceHeight: number;
}>;

type AuditFinding = Readonly<{
    id?: string;
    location?: Readonly<{
        layerPath?: string;
        x?: number;
        y?: number;
        tileId?: number;
        gid?: number;
    }>;
}>;

const defaultTileset = 'assets/maps/tiled/tilesheet.wang.tsj';
const defaultAudit = 'artifacts/map-authoring/terrain-authoring-audit.json';
const defaultOutDir = 'artifacts/map-authoring/visual';
const exactReferenceSources = [
    {
        source: '/Users/krisztiaan/dev/stardew-assets/Maps/spring_outdoorsTileSheet.png',
        alternate: '/root/dev/StardewXnbHack/Content (unpacked-ts)/Maps/spring_outdoorsTileSheet.png',
        output: 'stardew-spring-outdoors-contact.png',
    },
    {
        source: '/Users/krisztiaan/dev/stardew-assets/Maps/paths.png',
        alternate: '/root/dev/StardewXnbHack/Content (unpacked-ts)/Maps/paths.png',
        output: 'stardew-paths-contact.png',
    },
] as const;

export function tileIdToSourceRect(
    tileId: number,
    geometry: TileSheetGeometry
): { x: number; y: number; width: number; height: number } {
    const column = tileId % geometry.columns;
    const row = Math.floor(tileId / geometry.columns);
    return {
        x: column * geometry.tileWidth,
        y: row * geometry.tileHeight,
        width: geometry.tileWidth,
        height: geometry.tileHeight,
    };
}

export function gidToTileId(gid: number, firstGid: number): number {
    return gid - firstGid;
}

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

async function resolveImageMagickCommand(): Promise<string> {
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

async function runMagick(args: readonly string[], command: string): Promise<void> {
    const result = await runCommand(command, args);
    if (result.exitCode !== 0) {
        throw new Error(`${command} ${args.join(' ')} failed with ${result.exitCode}\n${result.stdout}\n${result.stderr}`);
    }
}

function slug(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'layer';
}

function resolveTilesetImagePath(tilesetPath: string, tileset: UnknownRecord): string {
    const image = asString(tileset.image);
    if (!image) {
        throw new Error(`Tileset ${tilesetPath} is missing an image reference.`);
    }
    return path.resolve(path.dirname(tilesetPath), image);
}

function buildAtlasLabels(tileCount: number, geometry: TileSheetGeometry): AtlasLabel[] {
    const labels: AtlasLabel[] = [];
    for (let tileId = 0; tileId < tileCount; tileId += 1) {
        const rect = tileIdToSourceRect(tileId, geometry);
        labels.push({
            tileId,
            gid: tileId + geometry.firstGid,
            sourceX: rect.x,
            sourceY: rect.y,
            sourceWidth: rect.width,
            sourceHeight: rect.height,
        });
    }
    return labels;
}

function parseAuditFindings(auditRoot: UnknownRecord | null): AuditFinding[] {
    return asArray(auditRoot?.findings)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is UnknownRecord => entry !== null)
        .map((entry) => ({ id: asString(entry.id) ?? undefined, location: asRecord(entry.location) ?? undefined }));
}

function uniqueSuspiciousTiles(findings: readonly AuditFinding[], firstGid: number): Array<{ gid: number; tileId: number }> {
    const seen = new Set<string>();
    const out: Array<{ gid: number; tileId: number }> = [];
    for (const finding of findings) {
        const rawGid = finding.location?.gid;
        const rawTileId = finding.location?.tileId;
        const tileId = typeof rawTileId === 'number' ? rawTileId : typeof rawGid === 'number' ? gidToTileId(rawGid, firstGid) : null;
        const gid = typeof rawGid === 'number' ? rawGid : typeof tileId === 'number' ? tileId + firstGid : null;
        if (tileId === null || gid === null || tileId < 0) {
            continue;
        }
        const key = `${gid}:${tileId}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        out.push({ gid, tileId });
    }
    return out;
}

function uniqueSuspiciousRegions(findings: readonly AuditFinding[], firstGid: number): Array<{
    layerPath: string;
    x: number;
    y: number;
    gid: number;
    tileId: number;
}> {
    const seen = new Set<string>();
    const out: Array<{ layerPath: string; x: number; y: number; gid: number; tileId: number }> = [];
    for (const finding of findings) {
        const layerPath = finding.location?.layerPath;
        const x = finding.location?.x;
        const y = finding.location?.y;
        const gid = finding.location?.gid;
        if (typeof layerPath !== 'string' || typeof x !== 'number' || typeof y !== 'number' || typeof gid !== 'number') {
            continue;
        }
        const tileId = gidToTileId(gid, firstGid);
        if (tileId < 0) {
            continue;
        }
        const key = `${layerPath}:${x}:${y}:${gid}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        out.push({ layerPath, x, y, gid, tileId });
    }
    return out;
}

async function cropTile({
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
    await runMagick(
        [
            sourceImage,
            '-crop',
            `${rect.width}x${rect.height}+${rect.x}+${rect.y}`,
            '+repage',
            '-filter',
            'point',
            '-resize',
            '128x128',
            outputPath,
        ],
        command
    );
}

async function appendReferenceNote(markdownPath: string, notes: readonly string[]): Promise<void> {
    if (notes.length === 0 || !existsSync(markdownPath)) {
        return;
    }
    const existing = await readFile(markdownPath, 'utf8');
    const withoutOldSection = existing.replace(/\n## Visual Reference Notes\n[\s\S]*$/u, '').trimEnd();
    await writeFile(markdownPath, `${withoutOldSection}\n\n## Visual Reference Notes\n\n${notes.map((note) => `- ${note}`).join('\n')}\n`);
}

async function main(): Promise<void> {
    const command = await resolveImageMagickCommand();
    await runMagick(['-version'], command);

    const tilesetPath = path.resolve(process.cwd(), defaultTileset);
    const outDir = path.resolve(process.cwd(), defaultOutDir);
    const tileset = asRecord(JSON.parse(await readFile(tilesetPath, 'utf8')));
    if (!tileset) {
        throw new Error(`Tileset ${defaultTileset} must be a JSON object.`);
    }
    const geometry: TileSheetGeometry = {
        columns: asInteger(tileset.columns) ?? 1,
        tileWidth: asInteger(tileset.tilewidth) ?? 16,
        tileHeight: asInteger(tileset.tileheight) ?? 16,
        firstGid: 1,
    };
    const tileCount = asInteger(tileset.tilecount) ?? 0;
    const sourceImage = resolveTilesetImagePath(tilesetPath, tileset);
    const auditPath = path.resolve(process.cwd(), defaultAudit);
    const auditRoot = existsSync(auditPath) ? asRecord(JSON.parse(await readFile(auditPath, 'utf8'))) : null;
    const findings = parseAuditFindings(auditRoot);

    await mkdir(outDir, { recursive: true });
    await runMagick([sourceImage, path.join(outDir, 'browserquest-tilesheet-atlas.png')], command);
    await writeFile(
        path.join(outDir, 'browserquest-tilesheet-atlas-labels.json'),
        `${JSON.stringify(buildAtlasLabels(tileCount, geometry), null, 2)}\n`
    );

    const suspiciousGidDir = path.join(outDir, 'suspicious-gids');
    await mkdir(suspiciousGidDir, { recursive: true });
    for (const tile of uniqueSuspiciousTiles(findings, geometry.firstGid)) {
        await cropTile({
            command,
            sourceImage,
            outputPath: path.join(suspiciousGidDir, `gid-${tile.gid}-tile-${tile.tileId}.png`),
            tileId: tile.tileId,
            geometry,
        });
    }

    const suspiciousRegionDir = path.join(outDir, 'suspicious-regions');
    await mkdir(suspiciousRegionDir, { recursive: true });
    for (const region of uniqueSuspiciousRegions(findings, geometry.firstGid)) {
        const base = `${slug(region.layerPath)}-x${region.x}-y${region.y}`;
        const outputPath = path.join(suspiciousRegionDir, `${base}.png`);
        await cropTile({ command, sourceImage, outputPath, tileId: region.tileId, geometry });
        await writeFile(
            path.join(suspiciousRegionDir, `${base}.json`),
            `${JSON.stringify({ ...region, note: 'Tile contact sheet crop; not a rendered map-region crop.' }, null, 2)}\n`
        );
    }

    const referenceDir = path.join(outDir, 'reference');
    await mkdir(referenceDir, { recursive: true });
    const referenceNotes: string[] = [];
    for (const reference of exactReferenceSources) {
        const source = existsSync(reference.source) ? reference.source : existsSync(reference.alternate) ? reference.alternate : null;
        if (!source) {
            referenceNotes.push(`Reference source missing: ${reference.source}`);
            continue;
        }
        await runMagick([source, '-filter', 'point', '-resize', '25%', path.join(referenceDir, reference.output)], command);
        referenceNotes.push(`Generated ${reference.output} from ${source}; visual organization reference only, not a source asset for copying.`);
    }
    await appendReferenceNote(path.resolve(process.cwd(), 'artifacts/map-authoring/terrain-authoring-audit.md'), referenceNotes);

    console.log(`Wrote ${path.relative(process.cwd(), outDir)}/browserquest-tilesheet-atlas.png`);
}

if (import.meta.main) {
    await main();
}
