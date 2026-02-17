import type App from '../app';
import log from '../platform/log';

let fullscreenToggleBound = false;

export function bindFullscreenToggle(app: App): void {
    if (fullscreenToggleBound) {
        return;
    }

    const button = document.getElementById('fullscreen-toggle') as HTMLButtonElement | null;
    const root = document.getElementById('container');

    if (!button || !root) {
        return;
    }

    const canFullscreen = Boolean(document.fullscreenEnabled) && typeof root.requestFullscreen === 'function';
    if (!canFullscreen) {
        button.style.display = 'none';
        fullscreenToggleBound = true;
        return;
    }

    const updateLabel = function (): void {
        button.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
    };

    updateLabel();

    button.addEventListener('click', function (event: MouseEvent) {
        event.stopPropagation();

        void (async () => {
            try {
                if (document.fullscreenElement) {
                    await document.exitFullscreen();
                } else {
                    await root.requestFullscreen();
                }
            } catch (error) {
                log.debug('Fullscreen toggle failed');
                log.debug(error instanceof Error ? error.message : String(error));
            }
        })();
    });

    document.addEventListener('fullscreenchange', function () {
        updateLabel();
        setTimeout(() => app.resizeUi(), 50);
    });

    fullscreenToggleBound = true;
}
