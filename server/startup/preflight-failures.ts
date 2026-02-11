type EmitErrorFn = (message: string) => void;
type FailFn = (code: number) => void;
type ValidateConfigFn = (config: object) => { isValid: boolean; errors: unknown[] };
type LimitUtf8BytesFn = (text: string, maxBytes: number) => string;

export function ensureConfigSourcePresent({
    activeConfig,
    emitError,
    fail,
}: {
    activeConfig: object | null;
    emitError: EmitErrorFn;
    fail: FailFn;
}): boolean {
    if (activeConfig) {
        return true;
    }

    emitError('Server cannot start without any configuration file.');
    fail(1);
    return false;
}

export function ensureConfigPreflightValid({
    activeConfig,
    validateConfig,
    limitUtf8Bytes,
    emitError,
    fail,
}: {
    activeConfig: object;
    validateConfig: ValidateConfigFn;
    limitUtf8Bytes: LimitUtf8BytesFn;
    emitError: EmitErrorFn;
    fail: FailFn;
}): boolean {
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
