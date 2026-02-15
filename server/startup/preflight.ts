import fs from 'node:fs/promises';

type EmitErrorFn = (message: string) => void;
type FailFn = (code: number) => void;
type ValidateConfigFn = (config: object) => { isValid: boolean; errors: unknown[] };
type LimitUtf8BytesFn = (text: string, maxBytes: number) => string;
type ReadFileTextFn = (path: string) => Promise<string>;

const defaultReadFileText: ReadFileTextFn = async (path: string) => await fs.readFile(path, 'utf8');

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
    emitError(`Startup preflight: invalid server configuration: ${compactErrors}`);
    fail(1);
    return false;
}

export async function ensureMapPreflightValid({
    activeConfig,
    emitError,
    fail,
    readFileText = defaultReadFileText,
}: {
    activeConfig: object;
    emitError: EmitErrorFn;
    fail: FailFn;
    readFileText?: ReadFileTextFn;
}): Promise<boolean> {
    const mapFilePath = (() => {
        const candidate = (activeConfig as Record<string, unknown>)['map_filepath'];
        if (typeof candidate !== 'string') {
            return null;
        }
        const trimmed = candidate.trim();
        return trimmed.length > 0 ? trimmed : null;
    })();

    if (!mapFilePath) {
        return true;
    }

    let rawText = '';
    try {
        rawText = await readFileText(mapFilePath);
    } catch (_) {
        emitError(`Startup preflight: map file missing or unreadable: ${mapFilePath}`);
        fail(1);
        return false;
    }

    try {
        JSON.parse(rawText);
    } catch (_) {
        emitError(`Startup preflight: map file contains invalid JSON: ${mapFilePath}`);
        fail(1);
        return false;
    }

    return true;
}

export default {
    ensureConfigSourcePresent,
    ensureConfigPreflightValid,
    ensureMapPreflightValid,
};
