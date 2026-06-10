import { Database } from 'bun:sqlite';
import { openSqliteDatabase } from '../../sqlite-schema-meta';
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

function hasMapScopedResourceNodePrimaryKey(db: Database): boolean {
    const columns = db.query(`PRAGMA table_info(resource_nodes)`).all() as Array<{ name?: string; pk?: number }>;
    const idPk = columns.find((column) => column.name === 'id')?.pk ?? 0;
    const mapIdPk = columns.find((column) => column.name === 'map_id')?.pk ?? 0;
    return mapIdPk === 1 && idPk === 2;
}

function ensureResourceNodesSchema(db: Database): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS resource_nodes (
            id TEXT NOT NULL,
            map_id TEXT NOT NULL,
            x INTEGER NOT NULL,
            y INTEGER NOT NULL,
            kind TEXT NOT NULL,
            depleted INTEGER NOT NULL,
            respawn_day INTEGER,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY(map_id, id)
        );
    `);

    if (hasMapScopedResourceNodePrimaryKey(db)) {
        return;
    }

    db.exec(`
        ALTER TABLE resource_nodes RENAME TO resource_nodes_legacy;
        CREATE TABLE resource_nodes (
            id TEXT NOT NULL,
            map_id TEXT NOT NULL,
            x INTEGER NOT NULL,
            y INTEGER NOT NULL,
            kind TEXT NOT NULL,
            depleted INTEGER NOT NULL,
            respawn_day INTEGER,
            updated_at INTEGER NOT NULL,
            PRIMARY KEY(map_id, id)
        );
        INSERT OR REPLACE INTO resource_nodes (id, map_id, x, y, kind, depleted, respawn_day, updated_at)
            SELECT id, map_id, x, y, kind, depleted, respawn_day, updated_at FROM resource_nodes_legacy;
        DROP TABLE resource_nodes_legacy;
    `);
}

export class SqliteResourcePersistence {
    readonly databasePath: string;
    readonly #db: Database;
    readonly #definitions: ResourceDefinitions;

    constructor(configuredPath: string | null | undefined, definitions: ResourceDefinitions) {
        this.#definitions = definitions;
        const opened = openSqliteDatabase({
            configuredPath,
            defaultPath: DEFAULT_RESOURCE_DB_PATH,
            schemaVersion: 1,
            ddl: '',
        });
        this.databasePath = opened.databasePath;
        this.#db = opened.db;
        ensureResourceNodesSchema(this.#db);
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
                 ON CONFLICT(map_id, id) DO UPDATE SET
                    map_id = excluded.map_id,
                    x = excluded.x,
                    y = excluded.y,
                    kind = excluded.kind,
                    updated_at = excluded.updated_at`
            )
            .run(normalizedId, normalizedMapId, x, y, normalizedKind, Date.now());
        return { accepted: true };
    }

    getResourceNode(id: string, mapId?: string): ResourceNodeState | null {
        const normalizedId = normalizeId(id);
        if (!normalizedId) {
            return null;
        }
        const normalizedMapId = typeof mapId === 'string' ? normalizeId(mapId) : null;
        const row = normalizedMapId
            ? this.#db
                .query(`SELECT id, map_id, x, y, kind, depleted, respawn_day FROM resource_nodes WHERE map_id = ?1 AND id = ?2`)
                .get(normalizedMapId, normalizedId) as ResourceNodeRow | null
            : this.#db
                .query(`SELECT id, map_id, x, y, kind, depleted, respawn_day FROM resource_nodes WHERE id = ?1 ORDER BY map_id LIMIT 1`)
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
        let node = this.getResourceNode(normalizedNodeId, normalizedPlayerMapId);
        if (!node) {
            return { accepted: false, reason: 'unknown_node' };
        }
        if (node.depleted && node.respawnDay !== null && node.respawnDay <= currentDay) {
            this.restoreResourceNode(normalizedNodeId, normalizedPlayerMapId);
            node = this.getResourceNode(normalizedNodeId, normalizedPlayerMapId);
            if (!node) {
                return { accepted: false, reason: 'unknown_node' };
            }
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
                 WHERE id = ?1 AND map_id = ?4`
            )
            .run(normalizedNodeId, currentDay + definition.respawnDays, Date.now(), normalizedPlayerMapId);
        return { accepted: true, drops: cloneDrops(definition.drops) };
    }

    restoreResourceNode(nodeId: string, mapId?: string): ResourceMutationResult {
        const normalizedNodeId = normalizeId(nodeId);
        const normalizedMapId = typeof mapId === 'string' ? normalizeId(mapId) : null;
        if (!normalizedNodeId) {
            return { accepted: false, reason: 'invalid_node' };
        }
        const result = normalizedMapId
            ? this.#db
                .query(
                    `UPDATE resource_nodes
                     SET depleted = 0,
                         respawn_day = NULL,
                         updated_at = ?3
                     WHERE map_id = ?1 AND id = ?2`
                )
                .run(normalizedMapId, normalizedNodeId, Date.now())
            : this.#db
                .query(
                    `UPDATE resource_nodes
                     SET depleted = 0,
                         respawn_day = NULL,
                         updated_at = ?2
                     WHERE id = ?1`
                )
                .run(normalizedNodeId, Date.now());
        return result.changes > 0 ? { accepted: true } : { accepted: false, reason: 'unknown_node' };
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
