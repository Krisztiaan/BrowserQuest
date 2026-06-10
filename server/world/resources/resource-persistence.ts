import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { ensureSchemaVersion } from '../../sqlite-schema-meta';
import type { ResourceDefinitions, ResourceDrop, ResourceNodeState, ResourceTool } from './resource-state';

const DEFAULT_RESOURCE_DB_PATH = './server/.data/resources.sqlite';
const DEFAULT_INTERACTION_RANGE = 1;

type ResourceNodeRow = {
    id: string;
    map_id: string;
    x: number;
    y: number;
    kind: string;
    depleted: number;
    respawn_day: number | null;
};

type ResourceMutationResult = Readonly<{ accepted: true }> | Readonly<{ accepted: false; reason: string }>;

export type ResourceHarvestResult =
    | Readonly<{ accepted: true; drops: ReadonlyArray<ResourceDrop> }>
    | Readonly<{ accepted: false; reason: string }>;

function resolveDatabasePath(configuredPath: string | null | undefined): string {
    const trimmed = typeof configuredPath === 'string' ? configuredPath.trim() : '';
    if (!trimmed) {
        return path.resolve(DEFAULT_RESOURCE_DB_PATH);
    }
    if (trimmed === ':memory:') {
        return trimmed;
    }
    return path.resolve(trimmed);
}

function normalizeId(value: string): string | null {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function isTileCoord(value: number): boolean {
    return Number.isSafeInteger(value);
}

function isDay(value: number): boolean {
    return Number.isSafeInteger(value) && value >= 0;
}

function rowToResourceNode(row: ResourceNodeRow): ResourceNodeState {
    return {
        id: row.id,
        mapId: row.map_id,
        x: row.x,
        y: row.y,
        kind: row.kind,
        depleted: row.depleted !== 0,
        respawnDay: row.respawn_day,
    };
}

function cloneDrops(drops: ReadonlyArray<ResourceDrop>): ResourceDrop[] {
    return drops.map((drop) => ({ item: drop.item, quantity: drop.quantity }));
}

export class SqliteResourcePersistence {
    readonly databasePath: string;
    readonly #db: Database;
    readonly #definitions: ResourceDefinitions;

    constructor(configuredPath: string | null | undefined, definitions: ResourceDefinitions) {
        this.databasePath = resolveDatabasePath(configuredPath);
        this.#definitions = definitions;
        if (this.databasePath !== ':memory:') {
            mkdirSync(path.dirname(this.databasePath), { recursive: true });
        }

        this.#db = new Database(this.databasePath, { create: true });
        this.#db.exec(`
            PRAGMA journal_mode=WAL;
            PRAGMA synchronous=NORMAL;
            PRAGMA foreign_keys=ON;
        `);
        ensureSchemaVersion(this.#db, 1);
        this.#db.exec(`
            CREATE TABLE IF NOT EXISTS resource_nodes (
                id TEXT PRIMARY KEY,
                map_id TEXT NOT NULL,
                x INTEGER NOT NULL,
                y INTEGER NOT NULL,
                kind TEXT NOT NULL,
                depleted INTEGER NOT NULL,
                respawn_day INTEGER,
                updated_at INTEGER NOT NULL
            );
        `);
    }

    close(): void {
        this.#db.close();
    }

    upsertResourceNode({
        id,
        mapId,
        x,
        y,
        kind,
    }: {
        id: string;
        mapId: string;
        x: number;
        y: number;
        kind: string;
    }): ResourceMutationResult {
        const normalizedId = normalizeId(id);
        const normalizedMapId = normalizeId(mapId);
        const normalizedKind = normalizeId(kind);
        if (!normalizedId || !normalizedMapId || !normalizedKind || !isTileCoord(x) || !isTileCoord(y)) {
            return { accepted: false, reason: 'invalid_node' };
        }
        if (!this.#definitions[normalizedKind]) {
            return { accepted: false, reason: 'unknown_resource' };
        }
        this.#db
            .query(
                `INSERT INTO resource_nodes (id, map_id, x, y, kind, depleted, respawn_day, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, 0, NULL, ?6)
                 ON CONFLICT(id) DO UPDATE SET
                    map_id = excluded.map_id,
                    x = excluded.x,
                    y = excluded.y,
                    kind = excluded.kind,
                    updated_at = excluded.updated_at`
            )
            .run(normalizedId, normalizedMapId, x, y, normalizedKind, Date.now());
        return { accepted: true };
    }

    getResourceNode(id: string): ResourceNodeState | null {
        const normalizedId = normalizeId(id);
        if (!normalizedId) {
            return null;
        }
        const row = this.#db
            .query(`SELECT id, map_id, x, y, kind, depleted, respawn_day FROM resource_nodes WHERE id = ?1`)
            .get(normalizedId) as ResourceNodeRow | null;
        return row ? rowToResourceNode(row) : null;
    }

    harvestResourceNode({
        nodeId,
        tool,
        playerMapId,
        playerX,
        playerY,
        currentDay,
        maxAxisDistance = DEFAULT_INTERACTION_RANGE,
    }: {
        nodeId: string;
        tool: ResourceTool;
        playerMapId: string;
        playerX: number;
        playerY: number;
        currentDay: number;
        maxAxisDistance?: number;
    }): ResourceHarvestResult {
        const normalizedNodeId = normalizeId(nodeId);
        const normalizedPlayerMapId = normalizeId(playerMapId);
        if (
            !normalizedNodeId
            || !normalizedPlayerMapId
            || !isTileCoord(playerX)
            || !isTileCoord(playerY)
            || !isDay(currentDay)
            || !Number.isSafeInteger(maxAxisDistance)
            || maxAxisDistance < 0
        ) {
            return { accepted: false, reason: 'invalid_harvest' };
        }
        const node = this.getResourceNode(normalizedNodeId);
        if (!node) {
            return { accepted: false, reason: 'unknown_node' };
        }
        const definition = this.#definitions[node.kind];
        if (!definition) {
            return { accepted: false, reason: 'unknown_resource' };
        }
        if (tool !== definition.tool) {
            return { accepted: false, reason: 'wrong_tool' };
        }
        if (node.depleted) {
            return { accepted: false, reason: 'depleted' };
        }
        if (
            node.mapId !== normalizedPlayerMapId
            || Math.abs(node.x - playerX) > maxAxisDistance
            || Math.abs(node.y - playerY) > maxAxisDistance
        ) {
            return { accepted: false, reason: 'out_of_range' };
        }
        this.#db
            .query(
                `UPDATE resource_nodes
                 SET depleted = 1,
                     respawn_day = ?2,
                     updated_at = ?3
                 WHERE id = ?1`
            )
            .run(normalizedNodeId, currentDay + definition.respawnDays, Date.now());
        return { accepted: true, drops: cloneDrops(definition.drops) };
    }

    advanceDay(currentDay: number): { respawned: number } {
        if (!isDay(currentDay)) {
            return { respawned: 0 };
        }
        const result = this.#db
            .query(
                `UPDATE resource_nodes
                 SET depleted = 0,
                     respawn_day = NULL,
                     updated_at = ?2
                 WHERE depleted != 0 AND respawn_day IS NOT NULL AND respawn_day <= ?1`
            )
            .run(currentDay, Date.now());
        return { respawned: result.changes };
    }
}
