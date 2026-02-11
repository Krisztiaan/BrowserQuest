import Detect from './platform/detect';
import { supportsLocalStorage } from './platform/features';

const STORAGE_KEY = 'data';

const canvas = document.querySelector('canvas');
const parchment = document.getElementById('parchment');

if (!Detect.supportsWebSocket() && parchment) {
    parchment.className = 'error';
}

if (canvas && canvas.getContext) {
    const ctx = canvas.getContext('2d');
    const smoothingCtx = ctx as (CanvasRenderingContext2D & { mozImageSmoothingEnabled?: boolean }) | null;
    if (smoothingCtx && smoothingCtx.mozImageSmoothingEnabled === undefined) {
        document.body.className += ' upscaled';
    }
}

if (!supportsLocalStorage()) {
    const alert = document.createElement('div');
    alert.className = 'alert';
    const alertMsg = document.createTextNode('You need to enable cookies/localStorage to play BrowserQuest');
    alert.appendChild(alertMsg);

    const target = document.getElementById('intro');
    if (target) {
        document.body.insertBefore(alert, target);
    }
} else if (globalThis.localStorage && globalThis.localStorage.getItem(STORAGE_KEY)) {
    document.body.className += ' returning';
    if (parchment) {
        parchment.className = 'loadcharacter';
    }
}
