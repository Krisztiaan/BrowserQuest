export function getRuntimeVersion(): string {
    const runtimeEnv = typeof process !== 'undefined' ? process.env : undefined;
    const envVersion = runtimeEnv?.BQ_VERSION || runtimeEnv?.npm_package_version;
    return typeof envVersion === 'string' && envVersion.length > 0 ? envVersion : 'dev';
}

export function getHealthzResponseBody(): string {
    return JSON.stringify({ status: 'ok' });
}

export function getVersionResponseBody(): string {
    return JSON.stringify({ version: getRuntimeVersion() });
}
