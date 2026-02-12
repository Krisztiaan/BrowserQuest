import { canPlayMP3 } from './features';

function supportsWebSocket(): boolean {
    return typeof globalThis.WebSocket === 'function';
}

function userAgentContains(value: string): boolean {
    return globalThis.navigator.userAgent.indexOf(value) !== -1;
}

function isTablet(screenWidth: number): boolean {
    if (screenWidth > 640) {
        if ((userAgentContains('Android') && userAgentContains('Firefox')) || userAgentContains('Mobile')) {
            return true;
        }
    }
    return false;
}

function isWindows(): boolean {
    return userAgentContains('Windows');
}

function isFirefoxAndroid(): boolean {
    return userAgentContains('Android') && userAgentContains('Firefox');
}

const Detect = {
    supportsWebSocket,
    userAgentContains,
    isTablet,
    isWindows,
    canPlayMP3,
    isFirefoxAndroid,
};

export default Detect;
