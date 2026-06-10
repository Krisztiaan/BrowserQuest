import App from './app';
import Detect from './platform/detect';
import log from './platform/log';
import { toggleDebugOverlay } from './debug-overlay';
import type { AchievementId } from './achievement-domain';
import { TRANSITIONEND } from './platform/util';
import type Game from './game';
import { bindFullscreenToggle } from './main/fullscreen-toggle';
import { hydrateLoadCharacterPreview } from './main/character-preview';
import { installTestApi } from './main/test-api';
import { MOVE_INPUT_KEY_A, MOVE_INPUT_KEY_D, MOVE_INPUT_KEY_S, MOVE_INPUT_KEY_W } from '../shared/protocol/intents';

let app: App | null = null;
let game: Game | null = null;
let queuedResizeFrame: number | null = null;

const isInteractiveTextTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    return (
        target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target.isContentEditable
    );
};

const scheduleUiResize = function (): void {
    if (queuedResizeFrame !== null) {
        return;
    }

    queuedResizeFrame = window.requestAnimationFrame(() => {
        queuedResizeFrame = null;
        app?.resizeUi();
    });
};

const initApp = function (): void {
    const onReady = function (): void {
        const runtimeApp = new App();
        app = runtimeApp;

        (function (app: App): void {
            app.center();

            if (Detect.isWindows()) {
                // Workaround for graphical glitches on text
                document.body.classList.add('windows');
            }

        if (Detect.isFirefoxAndroid()) {
            // Remove chat placeholder
            const chatInput = document.getElementById('chatinput');
            if (chatInput) {
                chatInput.removeAttribute('placeholder');
            }
        }

        const body = document.body,
            parchment = document.getElementById('parchment'),
            chatButton = document.getElementById('chatbutton'),
            helpButton = document.getElementById('helpbutton'),
            achievementsButton = document.getElementById('achievementsbutton'),
            instructions = document.getElementById('instructions'),
            playercount = document.getElementById('playercount'),
            population = document.getElementById('population'),
            toggleCredits = document.getElementById('toggle-credits'),
            toggleLegal = document.getElementById('toggle-legal'),
            createNew = document.querySelector('#create-new span'),
            cancel = document.querySelector('#cancel span'),
            nameInput = document.getElementById('nameinput'),
            previous = document.getElementById('previous'),
            next = document.getElementById('next'),
            achievements = document.getElementById('achievements'),
            lists = document.getElementById('lists'),
            notifications = document.querySelector('#notifications div'),
            playerName = document.getElementById('playername'),
            playerImage = document.getElementById('playerimage') as HTMLCanvasElement | null,
            resizeCheck = document.getElementById('resize-check');

        if (playerImage) {
            hydrateLoadCharacterPreview(playerImage);
        }

        body.addEventListener('click', function () {
            if (parchment?.classList.contains('credits')) {
                app.toggleScrollContent('credits');
            }

            if (parchment?.classList.contains('legal')) {
                app.toggleScrollContent('legal');
            }

            if (parchment?.classList.contains('about')) {
                app.toggleScrollContent('about');
            }
        });

        document.querySelectorAll('.barbutton').forEach(function (button: Element) {
            button.addEventListener('click', function () {
                button.classList.toggle('active');
            });
        });

        if (chatButton) {
            chatButton.addEventListener('click', function () {
                if (chatButton.classList.contains('active')) {
                    app.showChat();
                } else {
                    app.hideChat();
                }
            });
        }

        if (helpButton) {
            helpButton.addEventListener('click', function () {
                if (body.classList.contains('about')) {
                    app.closeInGameScroll('about');
                    helpButton.classList.remove('active');
                } else {
                    app.toggleScrollContent('about');
                }
            });
        }

        if (achievementsButton) {
            achievementsButton.addEventListener('click', function () {
                app.toggleAchievements();
                if (app.blinkInterval) {
                    clearInterval(app.blinkInterval);
                }
                achievementsButton.classList.remove('blink');
            });
        }

        if (instructions) {
            instructions.addEventListener('click', function () {
                app.hideWindows();
            });
        }

        if (playercount) {
            playercount.addEventListener('click', function () {
                app.togglePopulationInfo();
            });
        }

        if (population) {
            population.addEventListener('click', function () {
                app.togglePopulationInfo();
            });
        }

        document.querySelectorAll('.clickable').forEach(function (element: Element) {
            element.addEventListener('click', function (event: Event) {
                event.stopPropagation();
            });
        });

        if (toggleCredits) {
            toggleCredits.addEventListener('click', function () {
                app.toggleScrollContent('credits');
            });
        }

        if (toggleLegal) {
            toggleLegal.addEventListener('click', function () {
                app.toggleScrollContent('legal');
                if (game?.renderer.mobile) {
                    if (parchment?.classList.contains('legal')) {
                        toggleLegal.textContent = 'close';
                    } else {
                        toggleLegal.textContent = 'Privacy';
                    }
                }
            });
        }

        if (createNew) {
            createNew.addEventListener('click', function () {
                app.animateParchment('loadcharacter', 'confirmation');
            });
        }

        document.querySelectorAll('.delete').forEach(function (element: Element) {
            element.addEventListener('click', function () {
                app.storage.clear();
                app.animateParchment('confirmation', 'createcharacter');
                body.classList.remove('returning');
            });
        });

        if (cancel) {
            cancel.addEventListener('click', function () {
                app.animateParchment('confirmation', 'loadcharacter');
            });
        }

        document.querySelectorAll('.ribbon').forEach(function (element: Element) {
            element.addEventListener('click', function () {
                app.toggleScrollContent('about');
            });
        });

        if (nameInput) {
            const syncPlayState = function () {
                app.toggleButton();
            };
            nameInput.addEventListener('keyup', syncPlayState);
            nameInput.addEventListener('input', syncPlayState);
            nameInput.addEventListener('change', syncPlayState);
            syncPlayState();
        }

        if (previous) {
            previous.addEventListener('click', function (event: MouseEvent) {
                if (app.currentPage === 1) {
                    event.preventDefault();
                    return false;
                } else {
                    app.currentPage -= 1;
                    if (achievements) {
                        achievements.className = 'active page' + app.currentPage;
                    }
                }
            });
        }

        if (next) {
            next.addEventListener('click', function (event: MouseEvent) {
                const nbPages = lists ? lists.querySelectorAll('ul').length : 0;

                if (app.currentPage === nbPages) {
                    event.preventDefault();
                    return false;
                } else {
                    app.currentPage += 1;
                    if (achievements) {
                        achievements.className = 'active page' + app.currentPage;
                    }
                }
            });
        }

        if (notifications) {
            notifications.addEventListener(TRANSITIONEND, () => app.resetMessagesPosition());
        }

        document.querySelectorAll('.close').forEach(function (element: Element) {
            element.addEventListener('click', function () {
                app.hideWindows();
            });
        });

        document.querySelectorAll('.twitter').forEach(function (element: Element) {
            element.addEventListener('click', function (event: Event) {
                const url = element.getAttribute('href');
                if (typeof url !== 'string') {
                    return;
                }

                app.openPopup(url);
                event.preventDefault();
                return false;
            });
        });

        const data = app.storage.data;
        if (data.hasAlreadyPlayed) {
            if (data.player.name && data.player.name !== '') {
                if (playerName) {
                    playerName.textContent = data.player.name;
                }
            }
        }

        document.querySelectorAll('.play div').forEach(function (element: Element) {
            element.addEventListener('click', function () {
                const nameFromInput = nameInput?.getAttribute('value') ?? '';
                const nameFromStorage = playerName?.textContent ?? '';
                const name = nameFromInput !== '' ? nameFromInput : nameFromStorage;

                app.tryStartingGame(name, undefined);
            });
        });

        document.addEventListener('touchstart', function () {}, false);

        if (resizeCheck) {
            resizeCheck.addEventListener(TRANSITIONEND, () => app.resizeUi());
        }

        window.addEventListener('resize', scheduleUiResize);
        window.addEventListener('orientationchange', scheduleUiResize);
        window.visualViewport?.addEventListener('resize', scheduleUiResize);

            log.info('App initialized.');

            initGame();
        })(runtimeApp);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady, { once: true });
    } else {
        onReady();
    }
};

function initGame(): void {
    import('./game')
        .then(function (mod) {
            const Game = mod.default;

            const canvas = document.getElementById('entities') as HTMLCanvasElement | null,
                background = document.getElementById('background') as HTMLCanvasElement | null,
                foreground = document.getElementById('foreground') as HTMLCanvasElement | null,
                input = document.getElementById('chatinput') as HTMLInputElement | null;

            if (!app || !canvas || !background || !foreground || !input) {
                return;
            }

            const runtimeApp = app;
            const runtimeGame = new Game(runtimeApp, '#bubbles', canvas, background, foreground, input);
            game = runtimeGame;

            (function (app: App, game: Game): void {
                const renderer = game.renderer;
                game.setStorage(app.storage);
                app.setGame(game);
                bindFullscreenToggle(app);
                installTestApi({ app, game });

                if (app.isDesktop && app.supportsWorkers) {
                    game.loadMap();
                }

                game.on('gameStart', function () {
                    app.initEquipmentIcons();
                });

                game.on('disconnect', function (message: string) {
                    const deathParagraph = document.querySelector('#death p'),
                        respawn = document.getElementById('respawn');
                    if (deathParagraph) {
                        deathParagraph.textContent = '';
                        deathParagraph.appendChild(document.createTextNode(message));
                        const em = document.createElement('em');
                        em.textContent = 'Please reload the page.';
                        deathParagraph.appendChild(em);
                    }
                    if (respawn) {
                        respawn.style.display = 'none';
                    }
                });

                game.on('playerDeath', function () {
                    if (document.body.classList.contains('credits')) {
                        document.body.classList.remove('credits');
                    }
                    document.body.classList.add('death');
                });

                game.on('playerEquipmentChange', function () {
                    app.initEquipmentIcons();
                });

                game.on('playerInvincible', function () {
                    const hitpoints = document.getElementById('hitpoints');
                    if (hitpoints) {
                        hitpoints.classList.toggle('invincible');
                    }
                });

                const instancePopulation = document.getElementById('instance-population'),
                    playerCount = document.getElementById('playercount'),
                    worldPopulation = document.getElementById('world-population');

                const setPopulationText = function (root: ParentNode | null, selector: string, value: string): void {
                    if (!root) {
                        return;
                    }
                    const node = root.querySelector(selector);
                    if (node) {
                        node.textContent = value;
                    }
                };

                game.on('nbPlayersChange', function (worldPlayers: number, totalPlayers: number) {
                    const worldCount = String(worldPlayers),
                        totalCount = String(totalPlayers),
                        worldLabel = worldPlayers === 1 ? 'player' : 'players',
                        totalLabel = totalPlayers === 1 ? 'player' : 'players';

                    setPopulationText(playerCount, 'span.count', worldCount);
                    setPopulationText(playerCount, 'span:nth-child(2)', worldLabel);
                    setPopulationText(instancePopulation, 'span:nth-child(1)', worldCount);
                    setPopulationText(instancePopulation, 'span:nth-child(2)', worldLabel);
                    setPopulationText(worldPopulation, 'span:nth-child(1)', totalCount);
                    setPopulationText(worldPopulation, 'span:nth-child(2)', totalLabel);
                });

                game.on('achievementUnlock', function (id: AchievementId, name: string, _description: string) {
                    app.unlockAchievement(id, name);
                });

                game.on('notification', function (message: string) {
                    app.showMessage(message);
                });

                app.initHealthBar();

                const nameInput = document.getElementById('nameinput') as HTMLInputElement | null,
                    chatBox = document.getElementById('chatbox'),
                    chatInput = document.getElementById('chatinput') as HTMLInputElement | null,
                createCharacterForm = document.getElementById('createcharacter-form') as HTMLFormElement | null,
                chatForm = document.getElementById('chat-form') as HTMLFormElement | null,
                foregroundEl = document.getElementById('foreground'),
                    parchmentEl = document.getElementById('parchment'),
                    nameTooltip = document.getElementById('name-tooltip'),
                    respawnButton = document.getElementById('respawn'),
                    muteButton = document.getElementById('mutebutton');
                if (nameInput) {
                    nameInput.setAttribute('value', '');
                }
            if (chatBox) {
                chatBox.setAttribute('value', '');
            }

            if (renderer.mobile || renderer.tablet) {
                if (foregroundEl) {
                    let touchStartX = 0;
                    let touchStartY = 0;
                    let touchHasMoved = false;
                    const tapMoveThresholdPx = 10;

                    foregroundEl.addEventListener(
                        'touchstart',
                        function (event: TouchEvent) {
                            app.center();
                            touchHasMoved = false;
                            const touch = event.touches.item(0);
                            if (touch) {
                                touchStartX = touch.pageX;
                                touchStartY = touch.pageY;
                                app.setMouseCoordinates(touch);
                            }
                            event.preventDefault();
                        },
                        { passive: false }
                    );

                    foregroundEl.addEventListener(
                        'touchmove',
                        function (event: TouchEvent) {
                            const touch = event.touches.item(0);
                            if (touch) {
                                const dx = Math.abs(touch.pageX - touchStartX);
                                const dy = Math.abs(touch.pageY - touchStartY);
                                if (dx > tapMoveThresholdPx || dy > tapMoveThresholdPx) {
                                    touchHasMoved = true;
                                }
                                app.setMouseCoordinates(touch);
                            }
                            event.preventDefault();
                        },
                        { passive: false }
                    );

                    foregroundEl.addEventListener(
                        'touchend',
                        function (event: TouchEvent) {
                            const touch = event.changedTouches.item(0);
                            if (touch) {
                                app.setMouseCoordinates(touch);
                            }
                            if (!touchHasMoved) {
                                const pos = game.getMouseGridPosition();
                                game.kernel.setClientClickIntent({ x: pos.x, y: pos.y });
                                app.hideWindows();
                            }
                            event.preventDefault();
                        },
                        { passive: false }
                    );

                    foregroundEl.addEventListener(
                        'touchcancel',
                        function (event: TouchEvent) {
                            touchHasMoved = true;
                            event.preventDefault();
                        },
                        { passive: false }
                    );
                }
            } else {
                if (foregroundEl) {
                    foregroundEl.addEventListener('click', function (event: MouseEvent) {
                        app.center();
                        app.setMouseCoordinates(event);
                        const pos = game.getMouseGridPosition();
                        game.kernel.setClientClickIntent({ x: pos.x, y: pos.y });
                        app.hideWindows();
                    });
                }
            }

            document.body.onclick = function () {
                let hasClosedParchment = false;

                if (parchmentEl?.classList.contains('credits')) {
                    if (game.started) {
                        app.closeInGameScroll('credits');
                        hasClosedParchment = true;
                    } else {
                        app.toggleScrollContent('credits');
                    }
                }

                if (parchmentEl?.classList.contains('legal')) {
                    if (game.started) {
                        app.closeInGameScroll('legal');
                        hasClosedParchment = true;
                    } else {
                        app.toggleScrollContent('legal');
                    }
                }

                if (parchmentEl?.classList.contains('about')) {
                    if (game.started) {
                        app.closeInGameScroll('about');
                        hasClosedParchment = true;
                    } else {
                        app.toggleScrollContent('about');
                    }
                }

                if (game.started && !renderer.mobile && !hasClosedParchment) {
                    const pos = game.getMouseGridPosition();
                    game.kernel.setClientClickIntent({ x: pos.x, y: pos.y });
                }
            };

            if (respawnButton) {
                respawnButton.addEventListener('click', function () {
                    game.audioManager?.playSound('revive');
                    game.restart();
                    document.body.classList.remove('death');
                });
            }

            document.addEventListener('mousemove', function (event: MouseEvent) {
                app.setMouseCoordinates(event);
            });

            document.addEventListener('keydown', function (e: KeyboardEvent) {
                const key = e.which;
                if (!game.started || e.defaultPrevented || isInteractiveTextTarget(e.target)) {
                    return;
                }

                if (key === 13) {
                    if (chatBox?.classList.contains('active')) {
                        app.hideChat();
                    } else {
                        app.showChat();
                    }
                }
            });

            if (chatInput) {
                if (chatForm) {
                    chatForm.addEventListener('submit', function (event: Event) {
                        event.preventDefault();
                        return false;
                    });
                }

                chatInput.addEventListener('keydown', function (e: KeyboardEvent) {
                    const key = e.which,
                        placeholder = chatInput.getAttribute('placeholder');

                    if (!(e.shiftKey && e.keyCode === 16) && e.keyCode !== 9) {
                        if (chatInput.value === placeholder) {
                            chatInput.value = '';
                            chatInput.removeAttribute('placeholder');
                            chatInput.classList.remove('placeholder');
                        }
                    }

                    if (key === 13) {
                        if (chatInput.value !== '') {
                            game.say(chatInput.value);
                            chatInput.value = '';
                            app.hideChat();
                            if (foregroundEl) {
                                foregroundEl.focus();
                            }
                            e.preventDefault();
                            return false;
                        } else {
                            app.hideChat();
                            e.preventDefault();
                            return false;
                        }
                    }

                    if (key === 27) {
                        app.hideChat();
                        e.preventDefault();
                        return false;
                    }
                });

                chatInput.addEventListener('focus', function (_e: FocusEvent) {
                    const placeholder = chatInput.getAttribute('placeholder');

                    if (!Detect.isFirefoxAndroid()) {
                        chatInput.value = placeholder ?? '';
                    }

                    if (chatInput.value === placeholder) {
                        chatInput.setSelectionRange(0, 0);
                    }
                });
            }

            if (nameInput) {
                if (createCharacterForm) {
                    createCharacterForm.addEventListener('submit', function (event: Event) {
                        const name = nameInput.value;
                        event.preventDefault();
                        if (name !== '') {
                            app.tryStartingGame(name, function () {
                                nameInput.blur(); // exit keyboard on mobile
                            });
                        }
                        return false;
                    });
                }

                nameInput.addEventListener('focusin', function () {
                    if (nameTooltip) {
                        nameTooltip.classList.add('visible');
                    }
                });

                nameInput.addEventListener('focusout', function () {
                    if (nameTooltip) {
                        nameTooltip.classList.remove('visible');
                    }
                });

                nameInput.addEventListener('keypress', function (event: KeyboardEvent) {
                    const name = nameInput.value;

                    if (nameTooltip) {
                        nameTooltip.classList.remove('visible');
                    }

                    if (event.keyCode === 13) {
                        if (name !== '') {
                            app.tryStartingGame(name, function () {
                                nameInput.blur(); // exit keyboard on mobile
                            });
                            event.preventDefault();
                            return false; // prevent form submit
                        } else {
                            event.preventDefault();
                            return false; // prevent form submit
                        }
                    }
                });
            }

            if (muteButton) {
                muteButton.addEventListener('click', function () {
                    game.audioManager?.toggle();
                });
            }

            document.addEventListener('keydown', function (e: KeyboardEvent) {
                const key = e.which,
                    activeElement = document.activeElement,
                    chatFocused = chatInput && activeElement === chatInput,
                    nameFocused = nameInput && activeElement === nameInput;

                if (!chatFocused && !nameFocused) {
                    const moveBit =
                        key === 87
                            ? MOVE_INPUT_KEY_W
                            : key === 65
                                ? MOVE_INPUT_KEY_A
                                : key === 83
                                    ? MOVE_INPUT_KEY_S
                                    : key === 68
                                        ? MOVE_INPUT_KEY_D
                                        : null;
                    if (moveBit !== null && game.started) {
                        // Ignore key repeat: send move.input only on transitions.
                        if (e.repeat) {
                            return false;
                        }
                        const prevMask = game.kernel.clientMoveInputKeysMask >>> 0;
                        game.kernel.pressClientMoveInputKey(moveBit);
                        const nextMask = game.kernel.clientMoveInputKeysMask >>> 0;
                        if (nextMask !== prevMask) {
                            // Held-key movement overrides click-to-move immediately.
                            game.kernel.clearClientMovePlan();
                            game.kernel.clearClientPendingMoveSeqAcks();
                            game.kernel.clientMovementSuppressed = false;
                            game.kernel.enqueueClientCommand({ type: 'playerStop' });
                            game.kernel.enqueueClientCommand({ type: 'stopPlayerCombat' });
                        }
                        e.preventDefault();
                        return false;
                    }

                    if (key === 114) {
                        // F3: toggle the passability debug overlay
                        toggleDebugOverlay();
                        e.preventDefault();
                        return false;
                    }
                    if (key === 13) {
                        // Enter
                        if (game.ready && chatInput) {
                            chatInput.focus();
                            e.preventDefault();
                            return false;
                        }
                    }
                    if (key === 32) {
                        // Space
                        // game.togglePathingGrid();
                        e.preventDefault();
                        return false;
                    }
                    if (key === 70) {
                        // F
                        // game.toggleDebugInfo();
                        e.preventDefault();
                        return false;
                    }
                    if (key === 27) {
                        // ESC
                        app.hideWindows();
                        Object.keys(game.player.attackers).forEach(function (id) {
                            game.player.attackers[id]?.stop();
                        });
                        e.preventDefault();
                        return false;
                    }
                } else {
                    if (key === 13 && game.ready && chatInput) {
                        chatInput.focus();
                        e.preventDefault();
                        return false;
                    }
                }
            });

            document.addEventListener('keyup', function (e: KeyboardEvent) {
                const key = e.which;
                const moveBit =
                    key === 87
                        ? MOVE_INPUT_KEY_W
                        : key === 65
                            ? MOVE_INPUT_KEY_A
                            : key === 83
                                ? MOVE_INPUT_KEY_S
                                : key === 68
                                    ? MOVE_INPUT_KEY_D
                                    : null;
                if (moveBit === null || !game.started) {
                    return;
                }

                const prevMask = game.kernel.clientMoveInputKeysMask >>> 0;
                game.kernel.releaseClientMoveInputKey(moveBit);
                const nextMask = game.kernel.clientMoveInputKeysMask >>> 0;
                if (prevMask !== 0 && nextMask === 0) {
                    game.kernel.clientMovementSuppressed = false;
                    game.kernel.enqueueClientCommand({ type: 'playerStop' });
                }
            });

            })(runtimeApp, runtimeGame);
        })
        .catch(function (err) {
            const message = err instanceof Error ? err.message : String(err);
            log.error(message, true);
        });
}

initApp();
