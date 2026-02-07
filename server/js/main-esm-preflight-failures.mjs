/**
 * @param {object} params
 * @param {object|null} params.activeConfig
 * @param {(message: string) => void} params.emitError
 * @param {(code: number) => void} params.fail
 * @returns {boolean}
 */
export function ensureConfigSourcePresent({ activeConfig, emitError, fail }) {
    if (activeConfig) {
        return true;
    }

    emitError('Server cannot start without any configuration file.');
    fail(1);
    return false;
}

/**
 * @param {object} params
 * @param {object} params.activeConfig
 * @param {(config: object) => { isValid: boolean, errors: unknown[] }} params.validateConfig
 * @param {(text: string, maxBytes: number) => string} params.limitUtf8Bytes
 * @param {(message: string) => void} params.emitError
 * @param {(code: number) => void} params.fail
 * @returns {boolean}
 */
export function ensureConfigPreflightValid({ activeConfig, validateConfig, limitUtf8Bytes, emitError, fail }) {
    const validationResult = validateConfig(activeConfig);
    if (validationResult.isValid) {
        return true;
    }

    const compactErrors = limitUtf8Bytes(JSON.stringify(validationResult.errors), 512);
    emitError(`ESM preflight: invalid server configuration: ${compactErrors}`);
    fail(1);
    return false;
}

export default {
    ensureConfigSourcePresent,
    ensureConfigPreflightValid,
};
