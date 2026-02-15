type ValidationErrorReason =
    | 'must_be_object'
    | 'must_be_positive_integer'
    | 'must_be_chunk_size'
    | 'must_be_error_info_or_debug'
    | 'must_be_non_empty_string'
    | 'must_be_boolean'
    | 'must_be_string_array';

interface ValidationError {
    field: string;
    reason: ValidationErrorReason;
}

interface CandidateConfig {
    port?: unknown;
    debug_level?: unknown;
    nb_players_per_world?: unknown;
    nb_worlds?: unknown;
    map_filepath?: unknown;
    metrics_enabled?: unknown;
    plugins?: unknown;
    chunk_size?: unknown;
    player_db_path?: unknown;
    chunk_overlay_db_path?: unknown;
    claims_db_path?: unknown;
    chunk_overlay_flush_interval_ms?: unknown;
    chunk_overlay_flush_max_chunks?: unknown;
    chunk_overlay_bootstrap_load_limit_chunks?: unknown;
    chunk_snapshot_payload_max_utf8_bytes?: unknown;
    chunk_snapshot_max_parts?: unknown;
    updates_per_second?: unknown;
}

interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isChunkSize(value: unknown): value is number {
    return isPositiveInteger(value) && value <= 256;
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.trim().length > 0);
}

function validateConfig(config: unknown): ValidationResult {
    const errors: ValidationError[] = [];

    if (!isPlainObject(config)) {
        return {
            isValid: false,
            errors: [{ field: 'config', reason: 'must_be_object' }],
        };
    }

    const candidate = config as CandidateConfig;

    if (!isPositiveInteger(candidate.port)) {
        errors.push({ field: 'port', reason: 'must_be_positive_integer' });
    }
    if (!['error', 'info', 'debug'].includes(String(candidate.debug_level))) {
        errors.push({
            field: 'debug_level',
            reason: 'must_be_error_info_or_debug',
        });
    }
    if (!isPositiveInteger(candidate.nb_players_per_world)) {
        errors.push({
            field: 'nb_players_per_world',
            reason: 'must_be_positive_integer',
        });
    }
    if (!isPositiveInteger(candidate.nb_worlds)) {
        errors.push({ field: 'nb_worlds', reason: 'must_be_positive_integer' });
    }
    if (!isNonEmptyString(candidate.map_filepath)) {
        errors.push({
            field: 'map_filepath',
            reason: 'must_be_non_empty_string',
        });
    }
    if (typeof candidate.metrics_enabled !== 'boolean') {
        errors.push({ field: 'metrics_enabled', reason: 'must_be_boolean' });
    }
    if (candidate.plugins !== undefined && !isStringArray(candidate.plugins)) {
        errors.push({ field: 'plugins', reason: 'must_be_string_array' });
    }
    if (candidate.chunk_size !== undefined && !isChunkSize(candidate.chunk_size)) {
        errors.push({ field: 'chunk_size', reason: 'must_be_chunk_size' });
    }
    if (candidate.player_db_path !== undefined && !isNonEmptyString(candidate.player_db_path)) {
        errors.push({
            field: 'player_db_path',
            reason: 'must_be_non_empty_string',
        });
    }
    if (candidate.chunk_overlay_db_path !== undefined && !isNonEmptyString(candidate.chunk_overlay_db_path)) {
        errors.push({
            field: 'chunk_overlay_db_path',
            reason: 'must_be_non_empty_string',
        });
    }
    if (candidate.claims_db_path !== undefined && !isNonEmptyString(candidate.claims_db_path)) {
        errors.push({
            field: 'claims_db_path',
            reason: 'must_be_non_empty_string',
        });
    }
    if (candidate.chunk_overlay_flush_interval_ms !== undefined && !isPositiveInteger(candidate.chunk_overlay_flush_interval_ms)) {
        errors.push({
            field: 'chunk_overlay_flush_interval_ms',
            reason: 'must_be_positive_integer',
        });
    }
    if (candidate.chunk_overlay_flush_max_chunks !== undefined && !isPositiveInteger(candidate.chunk_overlay_flush_max_chunks)) {
        errors.push({
            field: 'chunk_overlay_flush_max_chunks',
            reason: 'must_be_positive_integer',
        });
    }
    if (
        candidate.chunk_overlay_bootstrap_load_limit_chunks !== undefined &&
        !isPositiveInteger(candidate.chunk_overlay_bootstrap_load_limit_chunks)
    ) {
        errors.push({
            field: 'chunk_overlay_bootstrap_load_limit_chunks',
            reason: 'must_be_positive_integer',
        });
    }
    if (
        candidate.chunk_snapshot_payload_max_utf8_bytes !== undefined &&
        !isPositiveInteger(candidate.chunk_snapshot_payload_max_utf8_bytes)
    ) {
        errors.push({
            field: 'chunk_snapshot_payload_max_utf8_bytes',
            reason: 'must_be_positive_integer',
        });
    }
    if (candidate.chunk_snapshot_max_parts !== undefined && !isPositiveInteger(candidate.chunk_snapshot_max_parts)) {
        errors.push({
            field: 'chunk_snapshot_max_parts',
            reason: 'must_be_positive_integer',
        });
    }
    if (candidate.updates_per_second !== undefined && !isPositiveInteger(candidate.updates_per_second)) {
        errors.push({
            field: 'updates_per_second',
            reason: 'must_be_positive_integer',
        });
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}

export { validateConfig };

export default {
    validateConfig,
};
