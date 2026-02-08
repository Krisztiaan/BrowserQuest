// AUTO-GENERATED from server/js/config-preflight.cts via bun run build:config-preflight.
// Do not edit server/js/config-preflight.js directly.

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function isPositiveInteger(value) {
    return typeof value === "number" && Number.isInteger(value) && value > 0;
}
function validateConfig(config) {
    const errors = [];
    if (!isPlainObject(config)) {
        return {
            isValid: false,
            errors: [{ field: "config", reason: "must_be_object" }],
        };
    }
    const candidate = config;
    if (!isPositiveInteger(candidate.port)) {
        errors.push({ field: "port", reason: "must_be_positive_integer" });
    }
    if (!["error", "info", "debug"].includes(String(candidate.debug_level))) {
        errors.push({
            field: "debug_level",
            reason: "must_be_error_info_or_debug",
        });
    }
    if (!isPositiveInteger(candidate.nb_players_per_world)) {
        errors.push({
            field: "nb_players_per_world",
            reason: "must_be_positive_integer",
        });
    }
    if (!isPositiveInteger(candidate.nb_worlds)) {
        errors.push({ field: "nb_worlds", reason: "must_be_positive_integer" });
    }
    if (!isNonEmptyString(candidate.map_filepath)) {
        errors.push({
            field: "map_filepath",
            reason: "must_be_non_empty_string",
        });
    }
    if (typeof candidate.metrics_enabled !== "boolean") {
        errors.push({ field: "metrics_enabled", reason: "must_be_boolean" });
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
}
module.exports = {
    validateConfig,
};
