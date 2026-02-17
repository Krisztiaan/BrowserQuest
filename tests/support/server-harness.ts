import net from 'node:net';
import { toError } from './format';
import WebSocket from './ws-client';

export type SpawnProcess = ReturnType<typeof Bun.spawn>;
export type StreamSource = ReadableStream<Uint8Array> | number | null | undefined;

export type StructuredEventValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | StructuredEventValue[]
    | { [key: string]: StructuredEventValue };
export type StructuredEventRecord = Record<string, StructuredEventValue>;

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

function isStructuredEventRecord(value: JsonValue | null | undefined): value is StructuredEventRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function getFreePort(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                server.close(() => reject(new Error('Unable to allocate port')));
                return;
            }
            const port = address.port;
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(port);
            });
        });
    });
}

export async function waitForHttpOk(url: string, timeoutMs = 5000): Promise<void> {
    const startedAt = Date.now();
    let lastError: string | null = null;

    for (;;) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return;
            }
            lastError = `HTTP ${response.status}`;
        } catch (error) {
            lastError = toError(error).message;
        }

        if (Date.now() - startedAt > timeoutMs) {
            throw new Error(`Timed out waiting for ${url}${lastError ? ` (${lastError})` : ''}`);
        }
        await Bun.sleep(50);
    }
}

export async function waitForCondition(
    check: () => boolean,
    timeoutMs: number,
    label: string,
    pollIntervalMs = 25
): Promise<void> {
    const startedAt = Date.now();

    for (;;) {
        if (check()) {
            return;
        }
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error(`Timed out waiting for ${label}`);
        }
        await Bun.sleep(pollIntervalMs);
    }
}

export async function waitForProcessExit(proc: SpawnProcess, timeoutMs = 4000): Promise<number> {
    return new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for process exit')), timeoutMs);
        proc.exited
            .then((code) => {
                clearTimeout(timeout);
                resolve(code);
            })
            .catch((error) => {
                clearTimeout(timeout);
                reject(toError(error));
            });
    });
}

export async function readStreamText(stream: StreamSource): Promise<string> {
    if (!stream || typeof stream === 'number') {
        return '';
    }

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let output = '';

    for (;;) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        if (value instanceof Uint8Array) {
            output += decoder.decode(value);
        }
    }

    return output;
}

export function startStructuredLogCapture(
    stream: StreamSource,
    events: StructuredEventRecord[],
    rawLines?: string[]
): void {
    if (!stream || typeof stream === 'number') {
        return;
    }

    const reader = stream.getReader();

    void (async () => {
        let carry = '';

        for (;;) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            if (!(value instanceof Uint8Array)) {
                continue;
            }
            carry += new TextDecoder().decode(value);
            const lines = carry.split('\n');
            carry = lines.pop() ?? '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (rawLines && trimmed.length > 0) {
                    rawLines.push(trimmed);
                }
                if (!trimmed.startsWith('{')) {
                    continue;
                }
                try {
                    const parsed = JSON.parse(trimmed) as JsonValue;
                    if (isStructuredEventRecord(parsed)) {
                        events.push(parsed);
                    }
                } catch {
                    // Ignore non-JSON/partial lines from mixed logs.
                }
            }
        }
    })();
}

export async function waitForGoHandshake(ws: WebSocket, timeoutMs = 8000): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for go handshake')), timeoutMs);

        ws.on('message', (data) => {
            if (typeof data === 'string' && data === 'go') {
                clearTimeout(timeout);
                resolve();
            }
        });
        ws.once('error', (error) => {
            clearTimeout(timeout);
            reject(toError(error));
        });
    });
}

export async function waitForStringMessage(ws: WebSocket, timeoutMs = 4000): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for websocket message')), timeoutMs);

        ws.once('error', (error) => {
            clearTimeout(timeout);
            reject(toError(error));
        });
        ws.once('message', (data) => {
            clearTimeout(timeout);
            if (typeof data !== 'string') {
                reject(new Error(`Expected string websocket message, got ${typeof data}`));
                return;
            }
            resolve(data);
        });
    });
}

export type WebSocketCloseInfo = Readonly<{
    code: number;
    reason: string;
}>;

function parseCloseEvent(eventValue: unknown): WebSocketCloseInfo {
    if (typeof eventValue === 'object' && eventValue !== null) {
        const record = eventValue as { code?: unknown; reason?: unknown };
        const code = typeof record.code === 'number' ? record.code : WebSocket.CLOSED;
        const reason = typeof record.reason === 'string' ? record.reason : '';
        return { code, reason };
    }
    return { code: WebSocket.CLOSED, reason: '' };
}

export async function waitForWebSocketClose(ws: WebSocket, timeoutMs = 3000): Promise<WebSocketCloseInfo> {
    return new Promise<WebSocketCloseInfo>((resolve, reject) => {
        if (ws.readyState === WebSocket.CLOSED) {
            resolve({ code: WebSocket.CLOSED, reason: '' });
            return;
        }

        const timeout = setTimeout(() => reject(new Error('Timed out waiting for websocket close')), timeoutMs);
        ws.once('close', (eventValue) => {
            clearTimeout(timeout);
            resolve(parseCloseEvent(eventValue));
        });
        ws.once('error', () => {
            // close can follow error during protocol rejection.
        });
    });
}

export async function deleteFileIfExists(path: string | null | undefined): Promise<void> {
    if (!path) {
        return;
    }
    try {
        await Bun.file(path).delete();
    } catch {
        // ignore delete errors for temp artifacts
    }
}
