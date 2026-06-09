import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCliArgs } from '../shared/cli-args';

/**
 * Validates TerrainOverlay wang sets in tilesheet.wang.tsj against pixel truth.
 *
 * Pixel truth lives in assets/maps/tiled/tilesheet.corners.json: per-tile corner
 * opacity patterns (TR,BR,BL,TL quadrants; bit=1 when the 8x8 quadrant is
 * majority-opaque) derived from client/public/img/1/tilesheet.webp. Regenerate
 * the sidecar with PIL after any tilesheet image change:
 *   for each 16px tile, for each 8x8 quadrant, bit = (#pixels with alpha>128) > 32.
 *
 * Checks per TerrainOverlay set:
 *  1. every wangtile's corner wangid (indices 1,3,5,7 = TR,BR,BL,TL) matches the
 *     sidecar pattern (color>0 <=> quadrant opaque),
 *  2. distinct corner patterns covered >= minPatterns (set property, default 13
 *     of the 15 non-empty patterns - the two diagonal checkers are optional).
 */

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

function rel(filePath: string): string {
    return path.relative(process.cwd(), filePath).split(path.sep).join('/');
}

const DEFAULT_MIN_PATTERNS = 13;

type OverlayFinding = Readonly<{
    set: string;
    tileid: number;
    declared: string;
    pixels: string;
}>;

type OverlayReport = Readonly<{
    set: string;
    tiles: number;
    patternsCovered: number;
    minPatterns: number;
    mismatches: ReadonlyArray<OverlayFinding>;
}>;

function wangCornerPattern(wangid: unknown): string | null {
    if (!Array.isArray(wangid) || wangid.length !== 8) {
        return null;
    }
    const corners = [wangid[1], wangid[3], wangid[5], wangid[7]];
    if (!corners.every((value) => typeof value === 'number' && Number.isInteger(value) && value >= 0)) {
        return null;
    }
    return corners.map((value) => ((value as number) > 0 ? '1' : '0')).join('');
}

function setMinPatterns(set: UnknownRecord): number {
    for (const propRaw of asArray(set.properties)) {
        const prop = asRecord(propRaw);
        if (prop?.name === 'min_patterns' && typeof prop.value === 'number') {
            return prop.value;
        }
    }
    return DEFAULT_MIN_PATTERNS;
}

async function main(): Promise<void> {
    const args = parseCliArgs(process.argv.slice(2), [{ key: 'json', kind: 'boolean', defaultValue: false }]);
    const root = process.cwd();
    const tsjPath = path.resolve(root, 'assets/maps/tiled/tilesheet.wang.tsj');
    const sidecarPath = path.resolve(root, 'assets/maps/tiled/tilesheet.corners.json');

    const tsj = asRecord(JSON.parse(await fs.readFile(tsjPath, 'utf8'))) ?? fail('Invalid tileset JSON.');
    const sidecar = asRecord(JSON.parse(await fs.readFile(sidecarPath, 'utf8'))) ?? fail('Invalid corners sidecar.');
    const corners = asRecord(sidecar.corners) ?? fail('Corners sidecar is missing the "corners" map.');
    if (sidecar.tileCount !== tsj.tilecount) {
        fail(
            `Corners sidecar is stale: sidecar tileCount=${String(sidecar.tileCount)} but tileset tilecount=${String(tsj.tilecount)}. Regenerate the sidecar (see tool header).`
        );
    }

    const reports: OverlayReport[] = [];
    for (const setRaw of asArray(tsj.wangsets)) {
        const set = asRecord(setRaw);
        if (set?.class !== 'TerrainOverlay') {
            continue;
        }
        const setName = typeof set.name === 'string' ? set.name : '?';
        const mismatches: OverlayFinding[] = [];
        const patterns = new Set<string>();
        let tiles = 0;
        for (const wangtileRaw of asArray(set.wangtiles)) {
            const wangtile = asRecord(wangtileRaw);
            if (!wangtile || typeof wangtile.tileid !== 'number') {
                continue;
            }
            const declared = wangCornerPattern(wangtile.wangid);
            if (declared === null) {
                mismatches.push({ set: setName, tileid: wangtile.tileid, declared: 'invalid wangid', pixels: '-' });
                continue;
            }
            tiles += 1;
            patterns.add(declared);
            const pixels = corners[String(wangtile.tileid)];
            if (typeof pixels !== 'string' || pixels !== declared) {
                mismatches.push({
                    set: setName,
                    tileid: wangtile.tileid,
                    declared,
                    pixels: typeof pixels === 'string' ? pixels : 'absent',
                });
            }
        }
        patterns.delete('0000');
        reports.push({
            set: setName,
            tiles,
            patternsCovered: patterns.size,
            minPatterns: setMinPatterns(set),
            mismatches,
        });
    }

    if (reports.length === 0) {
        fail('No TerrainOverlay wang sets found in the tileset.');
    }

    const problems: string[] = [];
    for (const report of reports) {
        for (const finding of report.mismatches) {
            problems.push(
                `${report.set}: tile ${finding.tileid} declares corners ${finding.declared} but pixels are ${finding.pixels}`
            );
        }
        if (report.patternsCovered < report.minPatterns) {
            problems.push(
                `${report.set}: covers ${report.patternsCovered} corner patterns, minimum is ${report.minPatterns}`
            );
        }
    }

    if (args.json === true) {
        console.log(JSON.stringify({ tileset: rel(tsjPath), reports, problems }, null, 2));
    } else {
        console.log(`Tileset: ${rel(tsjPath)}`);
        for (const report of reports) {
            console.log(
                `- ${report.set}: ${report.tiles} tiles, ${report.patternsCovered}/15 patterns (min ${report.minPatterns}), ${report.mismatches.length} pixel mismatches`
            );
        }
        for (const problem of problems) {
            console.log(`! ${problem}`);
        }
    }

    if (problems.length > 0) {
        process.exitCode = 1;
        return;
    }
    console.log('Overlay wang sets are consistent with pixel truth.');
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
