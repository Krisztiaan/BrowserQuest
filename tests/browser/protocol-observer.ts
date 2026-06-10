import type { Page } from '@playwright/test';
import { MSG_CHAT, parseProtocolActionBatch, type ProtocolParsedAction } from '../support/protocol/contract';
import {
    decodeClientToServerProtocolActionBatchBinary,
    decodeServerToClientProtocolActionBatchBinary,
} from '../../shared/protocol/registry';

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
    // Default to matching the canonical `/ws` endpoint. Playwright now runs against
    // the Bun single-service origin, but `/ws` remains the stable runtime boundary.
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

        // The live wire is the FixedBin binary protocol; legacy JSON text frames
        // are still parsed as a fallback so replay fixtures keep working.
        const parseFrame = (
            payload: string | Buffer,
            decodeBinary: (bytes: Uint8Array) => ReadonlyArray<unknown>
        ): ProtocolParsedAction[] => {
            if (typeof payload === 'string') {
                return parseProtocolActionBatch(payload);
            }
            try {
                return decodeBinary(new Uint8Array(payload)) as ProtocolParsedAction[];
            } catch (_) {
                return [];
            }
        };

        ws.on('framesent', ({ payload }) => {
            const actions = parseFrame(payload, decodeClientToServerProtocolActionBatchBinary);
            actions.forEach((action) => {
                sentTypes.push(action[0]);
                sentActions.push(action);
            });
        });

        ws.on('framereceived', ({ payload }) => {
            if (payload === 'go') {
                goCount += 1;
                return;
            }

            const actions = parseFrame(payload, decodeServerToClientProtocolActionBatchBinary);
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
