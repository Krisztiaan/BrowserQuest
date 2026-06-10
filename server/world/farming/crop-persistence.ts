import type { Database } from 'bun:sqlite';
import { openSqliteDatabase } from '../../sqlite-schema-meta';
import type { CropDefinitions, CropTileState } from './crop-state';

const DEFAULT_CROP_DB_PATH = './server/.data/crops.sqlite';

type CropTileRow = {
    map_id: string;
    x: number;
    y: number;
    crop_id: string | null;
    tilled: number;
    watered_today: number;
    growth: number;
};

type CropMutationResult =
    | Readonly<{ accepted: true }>
    | Readonly<{ accepted: false; reason: string }>;

export type CropHarvestResult =
    | Readonly<{ accepted: true; itemId: string; quantity: number }>
    | Readonly<{ accepted: false; reason: string }>;

function normalizeMapId(mapId: string): string | null {
    const trimmed = mapId.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizeCropId(cropId: string): string | null {
    const trimmed = cropId.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function isTileCoord(value: number): boolean {
    return Number.isSafeInteger(value);
}

function rowToCropTile(row: CropTileRow): CropTileState {
    return {
        mapId: row.map_id,
        x: row.x,
        y: row.y,
        cropId: row.crop_id,
        tilled: row.tilled !== 0,
        wateredToday: row.watered_today !== 0,
        growth: Math.max(0, Math.trunc(row.growth)),
    };
}

export class SqliteCropPersistence {
    readonly databasePath: string;
    readonly #db: Database;
    readonly #cropDefinitions: CropDefinitions;

    constructor(configuredPath: string | null | undefined, cropDefinitions: CropDefinitions) {
        this.#cropDefinitions = cropDefinitions;
        const opened = openSqliteDatabase({
            configuredPath,
            defaultPath: DEFAULT_CROP_DB_PATH,
            schemaVersion: 1,
            ddl: `
            CREATE TABLE IF NOT EXISTS crop_tiles (
                map_id TEXT NOT NULL,
                x INTEGER NOT NULL,
                y INTEGER NOT NULL,
                crop_id TEXT,
                tilled INTEGER NOT NULL,
                watered_today INTEGER NOT NULL,
                growth INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (map_id, x, y)
            );
        `,
        });
        this.databasePath = opened.databasePath;
        this.#db = opened.db;
    }

    close(): void {
        this.#db.close();
    }

    getCropTile(mapId: string, x: number, y: number): CropTileState | null {
        const normalizedMapId = normalizeMapId(mapId);
        if (!normalizedMapId || !isTileCoord(x) || !isTileCoord(y)) {
            return null;
        }
        const row = this.#db
            .query(`SELECT map_id, x, y, crop_id, tilled, watered_today, growth FROM crop_tiles WHERE map_id = ?1 AND x = ?2 AND y = ?3`)
            .get(normalizedMapId, x, y) as CropTileRow | null;
        return row ? rowToCropTile(row) : null;
    }

    tillTile({ mapId, x, y, farmable }: { mapId: string; x: number; y: number; farmable: boolean }): CropMutationResult {
        const normalizedMapId = normalizeMapId(mapId);
        if (!normalizedMapId || !isTileCoord(x) || !isTileCoord(y)) {
            return { accepted: false, reason: 'invalid_tile' };
        }
        if (!farmable) {
            return { accepted: false, reason: 'unfarmable_tile' };
        }
        this.#db
            .query(
                `INSERT INTO crop_tiles (map_id, x, y, crop_id, tilled, watered_today, growth, updated_at)
                 VALUES (?1, ?2, ?3, NULL, 1, 0, 0, ?4)
                 ON CONFLICT(map_id, x, y) DO UPDATE SET
                    tilled = 1,
                    updated_at = excluded.updated_at`
            )
            .run(normalizedMapId, x, y, Date.now());
        return { accepted: true };
    }

    plantCrop({
        mapId,
        x,
        y,
        cropId,
        seedItemId,
    }: {
        mapId: string;
        x: number;
        y: number;
        cropId: string;
        seedItemId: string | null;
    }): CropMutationResult {
        const normalizedMapId = normalizeMapId(mapId);
        const normalizedCropId = normalizeCropId(cropId);
        if (!normalizedMapId || !normalizedCropId || !isTileCoord(x) || !isTileCoord(y)) {
            return { accepted: false, reason: 'invalid_crop' };
        }
        const definition = this.#cropDefinitions[normalizedCropId];
        if (!definition) {
            return { accepted: false, reason: 'unknown_crop' };
        }
        if (seedItemId !== definition.seedItem) {
            return { accepted: false, reason: 'missing_seed' };
        }
        const existing = this.getCropTile(normalizedMapId, x, y);
        if (!existing?.tilled) {
            return { accepted: false, reason: 'untilled_tile' };
        }
        if (existing.cropId !== null) {
            return { accepted: false, reason: 'occupied_tile' };
        }
        this.#db
            .query(
                `UPDATE crop_tiles
                 SET crop_id = ?4,
                     watered_today = 0,
                     growth = 0,
                     updated_at = ?5
                 WHERE map_id = ?1 AND x = ?2 AND y = ?3`
            )
            .run(normalizedMapId, x, y, normalizedCropId, Date.now());
        return { accepted: true };
    }

    waterTile({ mapId, x, y }: { mapId: string; x: number; y: number }): CropMutationResult {
        const normalizedMapId = normalizeMapId(mapId);
        if (!normalizedMapId || !isTileCoord(x) || !isTileCoord(y)) {
            return { accepted: false, reason: 'invalid_tile' };
        }
        const existing = this.getCropTile(normalizedMapId, x, y);
        if (!existing?.tilled || existing.cropId === null) {
            return { accepted: false, reason: 'nothing_planted' };
        }
        this.#db
            .query(
                `UPDATE crop_tiles
                 SET watered_today = 1,
                     updated_at = ?4
                 WHERE map_id = ?1 AND x = ?2 AND y = ?3`
            )
            .run(normalizedMapId, x, y, Date.now());
        return { accepted: true };
    }

    advanceDay(): { advanced: number } {
        const rows = this.#db
            .query(`SELECT map_id, x, y, crop_id, tilled, watered_today, growth FROM crop_tiles WHERE crop_id IS NOT NULL AND watered_today = 1`)
            .all() as CropTileRow[];
        let advanced = 0;
        const update = this.#db.prepare(
            `UPDATE crop_tiles
             SET growth = ?4,
                 watered_today = 0,
                 updated_at = ?5
             WHERE map_id = ?1 AND x = ?2 AND y = ?3`
        );
        const resetDry = this.#db.prepare(
            `UPDATE crop_tiles
             SET watered_today = 0,
                 updated_at = ?1
             WHERE watered_today != 0`
        );
        const tx = this.#db.transaction(() => {
            const now = Date.now();
            for (const row of rows) {
                const cropId = row.crop_id;
                const definition = cropId ? this.#cropDefinitions[cropId] : undefined;
                if (!definition) {
                    continue;
                }
                const nextGrowth = Math.min(definition.growthDays, Math.max(0, Math.trunc(row.growth)) + 1);
                update.run(row.map_id, row.x, row.y, nextGrowth, now);
                advanced += 1;
            }
            resetDry.run(now);
        });
        tx();
        return { advanced };
    }

    harvest({ mapId, x, y }: { mapId: string; x: number; y: number }): CropHarvestResult {
        const normalizedMapId = normalizeMapId(mapId);
        if (!normalizedMapId || !isTileCoord(x) || !isTileCoord(y)) {
            return { accepted: false, reason: 'invalid_tile' };
        }
        const existing = this.getCropTile(normalizedMapId, x, y);
        if (!existing?.cropId) {
            return { accepted: false, reason: 'nothing_planted' };
        }
        const definition = this.#cropDefinitions[existing.cropId];
        if (!definition) {
            return { accepted: false, reason: 'unknown_crop' };
        }
        if (existing.growth < definition.growthDays) {
            return { accepted: false, reason: 'not_ready' };
        }
        this.#db
            .query(
                `UPDATE crop_tiles
                 SET crop_id = NULL,
                     watered_today = 0,
                     growth = 0,
                     updated_at = ?4
                 WHERE map_id = ?1 AND x = ?2 AND y = ?3`
            )
            .run(normalizedMapId, x, y, Date.now());
        return { accepted: true, itemId: definition.harvestItem, quantity: 1 };
    }
}
