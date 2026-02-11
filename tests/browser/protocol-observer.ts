import type { Page } from '@playwright/test';
import { MSG_CHAT, parseProtocolActionBatch } from '../support/protocol/contract';

type ProtocolObserverOptions = {
    wsUrlSubstring?: string;
    trackChats?: boolean;
};

export type ProtocolObserver = {
    sentTypes: number[];
    receivedTypes: number[];
    receivedChats: string[];
    getGoCount: () => number;
    getSocketCount: () => number;
};

export function attachProtocolObserver(page: Page, options?: ProtocolObserverOptions): ProtocolObserver {
    const wsUrlSubstring = options?.wsUrlSubstring ?? ':8000';
    const trackChats = options?.trackChats === true;
    const sentTypes: number[] = [];
    const receivedTypes: number[] = [];
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
            actions.forEach((action) => sentTypes.push(action[0]));
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
                if (trackChats && action[0] === MSG_CHAT && typeof action[2] === 'string') {
                    receivedChats.push(action[2]);
                }
            });
        });
    });

    return {
        sentTypes,
        receivedTypes,
        receivedChats,
        getGoCount: () => goCount,
        getSocketCount: () => socketCount,
    };
}
