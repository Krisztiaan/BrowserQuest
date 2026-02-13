import Detect from './platform/detect';
import { supportsLocalStorage } from './platform/features';
import Storage from './storage';

const canvas = document.querySelector('canvas');
const parchment = document.getElementById('parchment');

if (!Detect.supportsWebSocket() && parchment) {
    parchment.className = 'error';
}

const ctx = canvas?.getContext('2d');
if (ctx) {
    const smoothingCtx = ctx as CanvasRenderingContext2D & { mozImageSmoothingEnabled?: boolean };
    if (smoothingCtx.mozImageSmoothingEnabled === undefined) {
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
} else {
    const storage = new Storage();
    if (storage.hasAlreadyPlayed()) {
        document.body.className += ' returning';
        if (parchment) {
            parchment.className = 'loadcharacter';
        }
    }
}
