import App from './app';
import Detect from './platform/detect';
import log from './platform/log';
import Types from '../shared/gametypes-browser';
import type { EntityKind } from '../shared/entity-kind-domain';
import type { AchievementId } from './achievement-domain';
import { TRANSITIONEND } from './platform/util';
import type Game from './game';

type TestEntity = {
    id: string | number;
    kind: EntityKind;
    gridX?: number;
    gridY?: number;
};

type ZoneTarget = { x: number; y: number; group: string };
type TestEntities = { mobs: TestEntity[]; items: TestEntity[] };
type TestApi = {
    isReady: () => boolean;
    moveToDifferentZone: () => { ok: boolean; reason?: string; from?: ZoneTarget; to?: ZoneTarget };
    getActionTargets: () => {
        ready: boolean;
        mobId: string | number | null;
        itemId: string | number | null;
        mobCount: number;
        itemCount: number;
    };
    sendCombatLootProbe: () => {
        ok: boolean;
        reason?: string;
        mobId?: string | number;
        itemId?: string | number;
        mobCount?: number;
        itemCount?: number;
        itemX?: number;
        itemY?: number;
    };
};

declare global {
    interface GlobalThis {
        __BQ_TEST_MODE__?: boolean;
        __BQ_TEST_API?: TestApi;
    }
}

let app: App | null = null,
    game: Game | null = null;
const TEST_ZONE_WIDTH = 28;
const TEST_ZONE_HEIGHT = 12;

const getZoneGroupId = function (x: number, y: number): string {
    const gx = Math.floor((x - 1) / TEST_ZONE_WIDTH),
        gy = Math.floor((y - 1) / TEST_ZONE_HEIGHT);

    return gx + '-' + gy;
};

const getTestEntities = function (): TestEntities {
    if (!game?.entities || !game.started) {
        return { mobs: [], items: [] };
    }

    const mobs: TestEntity[] = [],
        items: TestEntity[] = [];

    Object.values(game.entities).forEach(function (entity?: TestEntity) {
        if (!entity || !Number.isSafeInteger(entity.id) || !Number.isSafeInteger(entity.kind)) {
            return;
        }
        if (entity.id === game.player.id) {
            return;
        }

        if (Types.isMob(entity.kind)) {
            mobs.push(entity);
        }
        if (Types.isItem(entity.kind)) {
            items.push(entity);
        }
    });

    return { mobs: mobs, items: items };
};

const installTestApi = function (): void {
    if (!globalThis.__BQ_TEST_MODE__) {
        return;
    }

    globalThis.__BQ_TEST_API = {
        isReady: function () {
            return !!(game && game.started && game.client && game.map && game.map.isLoaded && game.player);
        },

        moveToDifferentZone: function () {
            if (!game?.client || !game.map?.isLoaded) {
                return { ok: false, reason: 'not_ready' };
            }

            const currentX = game.player.gridX,
                currentY = game.player.gridY,
                currentGroup = getZoneGroupId(currentX, currentY),
                width = game.map.width,
                height = game.map.height,
                offsets = [28, -28, 56, -56, 84, -84, 112, -112],
                yOffsets = [0, 12, -12, 24, -24, 36, -36];
            let target: ZoneTarget | null = null;
            for (const xOffset of offsets) {
                for (const yOffset of yOffsets) {
                    const x = currentX + xOffset;
                    const y = currentY + yOffset;

                    if (x <= 1 || y <= 1 || x >= width || y >= height) {
                        continue;
                    }
                    if (game.map.isColliding(x, y)) {
                        continue;
                    }

                    const group = getZoneGroupId(x, y);
                    if (group === currentGroup) {
                        continue;
                    }

                    target = { x, y, group };
                    break;
                }
                if (target) {
                    break;
                }
            }

            if (target === null) {
                return { ok: false, reason: 'no_target' };
            }

            game.kernel.enqueueClientCommand({ type: 'clientSendMove', x: target.x, y: target.y });
            game.kernel.enqueueClientCommand({ type: 'clientSendZone' });

            return {
                ok: true,
                from: { x: currentX, y: currentY, group: currentGroup },
                to: target,
            };
        },

        getActionTargets: function () {
            if (!game?.client || !game.map?.isLoaded) {
                return { ready: false, mobId: null, itemId: null, mobCount: 0, itemCount: 0 };
            }

            const entities = getTestEntities(),
                mob = entities.mobs[0],
                item = entities.items[0];

            return {
                ready: true,
                mobId: mob ? mob.id : null,
                itemId: item ? item.id : null,
                mobCount: entities.mobs.length,
                itemCount: entities.items.length,
            };
        },

        sendCombatLootProbe: function () {
            if (!game?.client || !game.map?.isLoaded) {
                return { ok: false, reason: 'not_ready' };
            }

            const entities = getTestEntities(),
                mob = entities.mobs[0],
                item = entities.items[0];

            if (!mob) {
                return {
                    ok: false,
                    reason: 'no_mob',
                    mobCount: entities.mobs.length,
                    itemCount: entities.items.length,
                };
            }
            if (!item) {
                return {
                    ok: false,
                    reason: 'no_item',
                    mobCount: entities.mobs.length,
                    itemCount: entities.items.length,
                };
            }
            if (!Number.isSafeInteger(item.gridX) || !Number.isSafeInteger(item.gridY)) {
                return { ok: false, reason: 'item_position_invalid', itemId: item.id };
            }

            game.kernel.enqueueClientCommand({ type: 'clientSendAttack', mobId: mob.id as never });
            game.kernel.enqueueClientCommand({ type: 'clientSendHit', targetId: mob.id as never });
            game.kernel.enqueueClientCommand({
                type: 'clientSendLootMove',
                itemId: item.id as never,
                x: item.gridX,
                y: item.gridY,
            });

            return {
                ok: true,
                mobId: mob.id,
                itemId: item.id,
                itemX: item.gridX,
                itemY: item.gridY,
            };
        },
    };
};

const initApp = function (): void {
    const onReady = function (): void {
        app = new App();
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
            playerImage = document.getElementById('playerimage'),
            resizeCheck = document.getElementById('resize-check');

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
            element.addEventListener('click', function (event: MouseEvent) {
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
                if (game?.renderer?.mobile) {
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
            nameInput.addEventListener('keyup', function () {
                app.toggleButton();
            });
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
            element.addEventListener('click', function (event: MouseEvent) {
                const url = element.getAttribute('href');

                app.openPopup('twitter', url);
                event.preventDefault();
                return false;
            });
        });

        document.querySelectorAll('.facebook').forEach(function (element: Element) {
            element.addEventListener('click', function (event: MouseEvent) {
                const url = element.getAttribute('href');

                app.openPopup('facebook', url);
                event.preventDefault();
                return false;
            });
        });

        const data = app.storage.data;
        if (data.hasAlreadyPlayed) {
            if (data.player.name && data.player.name !== '') {
                if (playerName) {
                    playerName.innerHTML = data.player.name;
                }
                if (playerImage) {
                    playerImage.setAttribute('src', data.player.image);
                }
            }
        }

        document.querySelectorAll('.play div').forEach(function (element: Element) {
            element.addEventListener('click', function () {
                const nameFromInput = nameInput?.getAttribute('value') ?? '';
                const nameFromStorage = playerName?.innerHTML ?? '';
                const name = nameFromInput !== '' ? nameFromInput : nameFromStorage;

                app.tryStartingGame(name, undefined);
            });
        });

        document.addEventListener('touchstart', function () {}, false);

        if (resizeCheck) {
            resizeCheck.addEventListener(TRANSITIONEND, () => app.resizeUi());
        }

        log.info('App initialized.');

        initGame();
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

            game = new Game(app, '#bubbles', canvas, background, foreground, input);
            game.setStorage(app.storage);
            app.setGame(game);
            installTestApi();

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
                    deathParagraph.innerHTML = message + '<em>Please reload the page.</em>';
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

            if (game.renderer.mobile || game.renderer.tablet) {
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
                        if (game) {
                            const pos = game.getMouseGridPosition();
                            game.kernel.setClientClickIntent({ x: pos.x, y: pos.y });
                        }
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

                if (game.started && !game.renderer.mobile && !hasClosedParchment) {
                    const pos = game.getMouseGridPosition();
                    game.kernel.setClientClickIntent({ x: pos.x, y: pos.y });
                }
            };

            if (respawnButton) {
                respawnButton.addEventListener('click', function () {
                    game.audioManager.playSound('revive');
                    game.restart();
                    document.body.classList.remove('death');
                });
            }

            document.addEventListener('mousemove', function (event: MouseEvent) {
                app.setMouseCoordinates(event);
            });

            document.addEventListener('keydown', function (e: KeyboardEvent) {
                const key = e.which;

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
                    game.audioManager.toggle();
                });
            }

            document.addEventListener('keydown', function (e: KeyboardEvent) {
                const key = e.which,
                    activeElement = document.activeElement,
                    chatFocused = chatInput && activeElement === chatInput,
                    nameFocused = nameInput && activeElement === nameInput;

                if (!chatFocused && !nameFocused) {
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
                            game.player.attackers[id].stop();
                        });
                        e.preventDefault();
                        return false;
                    }
                    if (key === 65) {
                        // a
                        // game.player.hit();
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

            if (game.renderer.tablet) {
                document.body.classList.add('tablet');
            }
        })
        .catch(function (err: unknown) {
            log.error(err, true);
        });
}

initApp();
