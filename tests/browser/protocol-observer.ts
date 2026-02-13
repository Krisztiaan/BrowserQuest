import type { Page } from '@playwright/test';
import { MSG_CHAT, parseProtocolActionBatch, type ProtocolParsedAction } from '../support/protocol/contract';

type ProtocolObserverOptions = {
    wsUrlSubstring?: string;
    trackChats?: boolean;
};

export type ProtocolObserver = {
    sentTypes: number[];
    receivedTypes: number[];
    sentActions: ProtocolParsedAction[];
    receivedActions: ProtocolParsedAction[];
    receivedChats: string[];
    getGoCount: () => number;
    getSocketCount: () => number;
};

export function attachProtocolObserver(page: Page, options?: ProtocolObserverOptions): ProtocolObserver {
    // Default to matching the canonical `/ws` endpoint. In dev/Playwright, the browser connects to the Vite origin
    // (and Vite proxies `/ws`), while in some runtimes it may connect directly to the server port — both include `/ws`.
    const wsUrlSubstring = options?.wsUrlSubstring ?? '/ws';
    const trackChats = options?.trackChats === true;
    const sentTypes: number[] = [];
    const receivedTypes: number[] = [];
    const sentActions: ProtocolParsedAction[] = [];
    const receivedActions: ProtocolParsedAction[] = [];
    const receivedChats: string[] = [];
    let goCount = 0;
    let socketCount = 0;

    page.on('websocket', (ws) => {
        if (!ws.url().includes(wsUrlSubstring)) {
            return;
        }
        socketCount += 1;

        ws.on('framesent', ({ payload }) => {
            const text = typeof payload === 'string' ? payload : payload.toString();
            const actions = parseProtocolActionBatch(text);
            actions.forEach((action) => {
                sentTypes.push(action[0]);
                sentActions.push(action);
            });
        });

        ws.on('framereceived', ({ payload }) => {
            const text = typeof payload === 'string' ? payload : payload.toString();
            if (text === 'go') {
                goCount += 1;
                return;
            }

            const actions = parseProtocolActionBatch(text);
            actions.forEach((action) => {
                receivedTypes.push(action[0]);
                receivedActions.push(action);
                if (trackChats && action[0] === MSG_CHAT && typeof action[2] === 'string') {
                    receivedChats.push(action[2]);
                }
            });
        });
    });

    return {
        sentTypes,
        receivedTypes,
        sentActions,
        receivedActions,
        receivedChats,
        getGoCount: () => goCount,
        getSocketCount: () => socketCount,
    };
}
