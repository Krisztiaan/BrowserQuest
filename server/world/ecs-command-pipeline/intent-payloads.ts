import { gridPos, type GridPos } from '../../../shared/domain/positions';

type JsonScalar = string | number | boolean | null;
type JsonLike = JsonScalar | JsonLike[] | { [key: string]: JsonLike };
type JsonRecord = { [key: string]: JsonLike };

function isRecord(value: JsonLike | object | null | undefined): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSafeInteger(value: JsonLike | undefined): number | null {
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
        return null;
    }
    return value;
}

export function safeParseJson(payload: string): JsonLike | null {
    try {
        return JSON.parse(payload) as JsonLike;
    } catch (_) {
        return null;
    }
}

export function decodeIntentGridPos(payloadJson: string): GridPos | null {
    const parsed = safeParseJson(payloadJson);
    if (!isRecord(parsed)) {
        return null;
    }
    const x = parseSafeInteger(parsed.x);
    const y = parseSafeInteger(parsed.y);
    if (x === null || y === null) {
        return null;
    }
    return gridPos(x, y);
}

export function decodeIntentTileEdit(payloadJson: string): { x: number; y: number; value: number | null } | null {
    const parsed = safeParseJson(payloadJson);
    if (!isRecord(parsed)) {
        return null;
    }

    const x = parseSafeInteger(parsed.x);
    const y = parseSafeInteger(parsed.y);
    const value = parsed.value;
    if (x === null || y === null) {
        return null;
    }
    if (value === null) {
        return { x, y, value: null };
    }
    const parsedValue = parseSafeInteger(value);
    if (parsedValue === null || parsedValue < 0) {
        return null;
    }
    return { x, y, value: parsedValue };
}

function parseEditorsPayload(record: JsonRecord): string[] | undefined | null {
    const rawEditors = record.editors;
    if (rawEditors === undefined) {
        return undefined;
    }
    if (!Array.isArray(rawEditors)) {
        return null;
    }
    const editors: string[] = [];
    for (let i = 0; i < rawEditors.length; i += 1) {
        const value = rawEditors[i];
        if (typeof value !== 'string') {
            return null;
        }
        editors.push(value);
    }
    return editors;
}

export function decodeIntentClaimCreate(payloadJson: string): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    editorNameKeys: string[];
} | null {
    const parsed = safeParseJson(payloadJson);
    if (!isRecord(parsed)) {
        return null;
    }
    const x1 = parseSafeInteger(parsed.x1);
    const y1 = parseSafeInteger(parsed.y1);
    const x2 = parseSafeInteger(parsed.x2);
    const y2 = parseSafeInteger(parsed.y2);
    if (x1 === null || y1 === null || x2 === null || y2 === null) {
        return null;
    }
    const editors = parseEditorsPayload(parsed);
    if (editors === null) {
        return null;
    }
    return { x1, y1, x2, y2, editorNameKeys: editors ?? [] };
}

export function decodeIntentClaimUpdate(payloadJson: string): {
    claimId: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    editorNameKeys?: string[];
} | null {
    const parsed = safeParseJson(payloadJson);
    if (!isRecord(parsed)) {
        return null;
    }
    const claimId = parseSafeInteger(parsed.id);
    const x1 = parseSafeInteger(parsed.x1);
    const y1 = parseSafeInteger(parsed.y1);
    const x2 = parseSafeInteger(parsed.x2);
    const y2 = parseSafeInteger(parsed.y2);
    if (
        claimId === null
        || claimId <= 0
        || x1 === null
        || y1 === null
        || x2 === null
        || y2 === null
    ) {
        return null;
    }
    const editors = parseEditorsPayload(parsed);
    if (editors === null) {
        return null;
    }
    return { claimId, x1, y1, x2, y2, ...(editors !== undefined ? { editorNameKeys: editors } : {}) };
}

export function decodeIntentClaimDelete(payloadJson: string): { claimId: number } | null {
    const parsed = safeParseJson(payloadJson);
    if (!isRecord(parsed)) {
        return null;
    }
    const claimId = parseSafeInteger(parsed.id);
    if (claimId === null || claimId <= 0) {
        return null;
    }
    return { claimId };
}
