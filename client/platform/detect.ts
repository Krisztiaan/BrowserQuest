function supportsWebSocket(): boolean {
    return typeof globalThis.WebSocket === 'function';
}

function userAgentContains(value: string): boolean {
    return globalThis.navigator.userAgent.indexOf(value) !== -1;
}

function isPhone(): boolean {
    if (userAgentContains('iPad')) {
        return false;
    }
    if (userAgentContains('iPhone')) {
        return true;
    }
    if (userAgentContains('Android') && userAgentContains('Mobile')) {
        return true;
    }
    if (userAgentContains('Mobile')) {
        return true;
    }
    return false;
}

function isTablet(screenWidth: number): boolean {
    if (screenWidth > 640) {
        if (userAgentContains('iPad')) {
            return true;
        }
        if (userAgentContains('Android') && !userAgentContains('Mobile')) {
            return true;
        }
        if (userAgentContains('Android') && userAgentContains('Firefox') && !userAgentContains('Mobile')) {
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
    isPhone,
    isTablet,
    isWindows,
    isFirefoxAndroid,
};

export default Detect;
