import App from './app';
import Detect from './compat/detect';
import log from './compat/log';
import Types from './compat/gametypes';
import type { EntityKind } from './compat/gametypes';
import { TRANSITIONEND } from './compat/util';
import type Game from './game';

/**
 * @typedef {{
 *   setup: (...args: unknown[]) => void,
 *   setStorage: (storage: unknown) => void,
 *   loadMap: () => void,
 *   onGameStart: (callback: () => void) => void,
 *   onDisconnect: (callback: (message: string) => void) => void,
 *   onPlayerDeath: (callback: () => void) => void,
 *   onPlayerEquipmentChange: (callback: () => void) => void,
 *   onPlayerInvincible: (callback: (invincible: boolean) => void) => void,
 *   onNbPlayersChange: (callback: (worldPlayers: number, totalPlayers: number) => void) => void,
 *   onAchievementUnlock: (callback: (achievementId: number) => void) => void,
 *   onNotification: (callback: (message: string) => void) => void,
 *   renderer: { mobile: boolean, tablet: boolean },
 * }} GameRuntime
 */

type TestEntity = {
    id: string | number;
    kind: EntityKind;
    gridX?: number;
    gridY?: number;
};

var app: App | null = null, game: Game | null = null;
var TEST_ZONE_WIDTH = 28;
var TEST_ZONE_HEIGHT = 12;

var getZoneGroupId = function(x, y) {
    var gx = Math.floor((x - 1) / TEST_ZONE_WIDTH),
        gy = Math.floor((y - 1) / TEST_ZONE_HEIGHT);

    return gx + '-' + gy;
};

var getTestEntities = function() {
    if(!game || !game.entities || !game.player) {
        return { mobs: [], items: [] };
    }

    var mobs = [],
        items = [];

    Object.values(game.entities).forEach(function(entity: TestEntity) {
        if(!entity || !Number.isSafeInteger(entity.id) || !Number.isSafeInteger(entity.kind)) {
            return;
        }
        if(entity.id === game.player.id) {
            return;
        }

        if(Types.isMob(entity.kind)) {
            mobs.push(entity);
        }
        if(Types.isItem(entity.kind)) {
            items.push(entity);
        }
    });

    return { mobs: mobs, items: items };
};

var installTestApi = function() {
    if(!globalThis.__BQ_TEST_MODE__) {
        return;
    }

    globalThis.__BQ_TEST_API = {
        isReady: function() {
            return !!(game && game.started && game.client && game.map && game.map.isLoaded && game.player);
        },

        moveToDifferentZone: function() {
            if(!game || !game.client || !game.map || !game.map.isLoaded || !game.player) {
                return { ok: false, reason: 'not_ready' };
            }

            var currentX = game.player.gridX,
                currentY = game.player.gridY,
                currentGroup = getZoneGroupId(currentX, currentY),
                width = game.map.width,
                height = game.map.height,
                offsets = [28, -28, 56, -56, 84, -84, 112, -112],
                yOffsets = [0, 12, -12, 24, -24, 36, -36],
                /** @type {{ x: number, y: number, group: string } | null} */
                target = null;

            offsets.some(function(xOffset) {
                return yOffsets.some(function(yOffset) {
                    var x = currentX + xOffset,
                        y = currentY + yOffset;

                    if(x <= 1 || y <= 1 || x >= width || y >= height) {
                        return false;
                    }
                    if(game.map.isColliding(x, y)) {
                        return false;
                    }

                    var group = getZoneGroupId(x, y);
                    if(group === currentGroup) {
                        return false;
                    }

                    target = { x: x, y: y, group: group };
                    return true;
                });
            });

            if(!target) {
                return { ok: false, reason: 'no_target' };
            }

            game.client.sendMove(target.x, target.y);
            game.client.sendZone();

            return {
                ok: true,
                from: { x: currentX, y: currentY, group: currentGroup },
                to: target
            };
        },

        getActionTargets: function() {
            if(!game || !game.client || !game.map || !game.map.isLoaded || !game.player) {
                return { ready: false, mobId: null, itemId: null, mobCount: 0, itemCount: 0 };
            }

            var entities = getTestEntities(),
                mob = entities.mobs[0],
                item = entities.items[0];

            return {
                ready: true,
                mobId: mob ? mob.id : null,
                itemId: item ? item.id : null,
                mobCount: entities.mobs.length,
                itemCount: entities.items.length
            };
        },

        sendCombatLootProbe: function() {
            if(!game || !game.client || !game.map || !game.map.isLoaded || !game.player) {
                return { ok: false, reason: 'not_ready' };
            }

            var entities = getTestEntities(),
                mob = entities.mobs[0],
                item = entities.items[0];

            if(!mob) {
                return { ok: false, reason: 'no_mob', mobCount: entities.mobs.length, itemCount: entities.items.length };
            }
            if(!item) {
                return { ok: false, reason: 'no_item', mobCount: entities.mobs.length, itemCount: entities.items.length };
            }
            if(!Number.isSafeInteger(item.gridX) || !Number.isSafeInteger(item.gridY)) {
                return { ok: false, reason: 'item_position_invalid', itemId: item.id };
            }

            game.client.sendAttack(mob);
            game.client.sendHit(mob);
            game.client.sendLootMove(item, item.gridX, item.gridY);

            return {
                ok: true,
                mobId: mob.id,
                itemId: item.id,
                itemX: item.gridX,
                itemY: item.gridY
            };
        }
    };
};

var initApp = function() {
    var onReady = function() {
        app = new App();
        app.center();
    
        if(Detect.isWindows()) {
            // Workaround for graphical glitches on text
            document.body.classList.add('windows');
        }
        
        if(Detect.isOpera()) {
            // Fix for no pointer events
            document.body.classList.add('opera');
        }
        
        if(Detect.isFirefoxAndroid()) {
            // Remove chat placeholder
            var chatInput = document.getElementById('chatinput');
            if(chatInput) {
                chatInput.removeAttribute('placeholder');
            }
        }
        
        var body = document.body,
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

        if(body) {
            body.addEventListener('click', function(event) {
                if(parchment && parchment.classList.contains('credits')) {
                    app.toggleScrollContent('credits');
                }
                
                if(parchment && parchment.classList.contains('legal')) {
                    app.toggleScrollContent('legal');
                }
                
                if(parchment && parchment.classList.contains('about')) {
                    app.toggleScrollContent('about');
                }
            });
        }

        document.querySelectorAll('.barbutton').forEach(function(button) {
            button.addEventListener('click', function() {
                button.classList.toggle('active');
            });
        });

        if(chatButton) {
            chatButton.addEventListener('click', function() {
                if(chatButton.classList.contains('active')) {
                    app.showChat();
                } else {
                    app.hideChat();
                }
            });
        }

        if(helpButton) {
            helpButton.addEventListener('click', function() {
                if(body && body.classList.contains('about')) {
                    app.closeInGameScroll('about');
                    helpButton.classList.remove('active');
                } else {
                    app.toggleScrollContent('about');
                }
            });
        }

        if(achievementsButton) {
            achievementsButton.addEventListener('click', function() {
                app.toggleAchievements();
                if(app.blinkInterval) {
                    clearInterval(app.blinkInterval);
                }
                achievementsButton.classList.remove('blink');
            });
        }

        if(instructions) {
            instructions.addEventListener('click', function() {
                app.hideWindows();
            });
        }
        
        if(playercount) {
            playercount.addEventListener('click', function() {
                app.togglePopulationInfo();
            });
        }
        
        if(population) {
            population.addEventListener('click', function() {
                app.togglePopulationInfo();
            });
        }

        document.querySelectorAll('.clickable').forEach(function(element) {
            element.addEventListener('click', function(event) {
                event.stopPropagation();
            });
        });

        if(toggleCredits) {
            toggleCredits.addEventListener('click', function() {
                app.toggleScrollContent('credits');
            });
        }
        
        if(toggleLegal) {
            toggleLegal.addEventListener('click', function() {
                app.toggleScrollContent('legal');
                if(game && game.renderer && game.renderer.mobile) {
                    if(parchment && parchment.classList.contains('legal')) {
                        toggleLegal.textContent = 'close';
                    } else {
                        toggleLegal.textContent = 'Privacy';
                    }
                }
            });
        }

        if(createNew) {
            createNew.addEventListener('click', function() {
                app.animateParchment('loadcharacter', 'confirmation');
            });
        }

        document.querySelectorAll('.delete').forEach(function(element) {
            element.addEventListener('click', function() {
                app.storage.clear();
                app.animateParchment('confirmation', 'createcharacter');
                if(body) {
                    body.classList.remove('returning');
                }
            });
        });

        if(cancel) {
            cancel.addEventListener('click', function() {
                app.animateParchment('confirmation', 'loadcharacter');
            });
        }
        
        document.querySelectorAll('.ribbon').forEach(function(element) {
            element.addEventListener('click', function() {
                app.toggleScrollContent('about');
            });
        });

        if(nameInput) {
            nameInput.addEventListener("keyup", function() {
                app.toggleButton();
            });
        }

        if(previous) {
            previous.addEventListener('click', function(event) {
                if(app.currentPage === 1) {
                    event.preventDefault();
                    return false;
                } else {
                    app.currentPage -= 1;
                    if(achievements) {
                        achievements.className = 'active page' + app.currentPage;
                    }
                }
            });
        }

        if(next) {
            next.addEventListener('click', function(event) {
                var nbPages = lists ? lists.querySelectorAll('ul').length : 0;
    
                if(app.currentPage === nbPages) {
                    event.preventDefault();
                    return false;
                } else {
                    app.currentPage += 1;
                    if(achievements) {
                        achievements.className = 'active page' + app.currentPage;
                    }
                }
            });
        }

        if(notifications) {
            notifications.addEventListener(TRANSITIONEND, app.resetMessagesPosition.bind(app));
        }

        document.querySelectorAll('.close').forEach(function(element) {
            element.addEventListener('click', function() {
                app.hideWindows();
            });
        });
    
        document.querySelectorAll('.twitter').forEach(function(element) {
            element.addEventListener('click', function(event) {
                var url = element.getAttribute('href');

                app.openPopup('twitter', url);
                event.preventDefault();
                return false;
            });
        });

        document.querySelectorAll('.facebook').forEach(function(element) {
            element.addEventListener('click', function(event) {
                var url = element.getAttribute('href');

                app.openPopup('facebook', url);
                event.preventDefault();
                return false;
            });
        });

        var data = app.storage.data;
        if(data.hasAlreadyPlayed) {
            if(data.player.name && data.player.name !== "") {
                if(playerName) {
                    playerName.innerHTML = data.player.name;
                }
                if(playerImage) {
                    playerImage.setAttribute('src', data.player.image);
                }
            }
        }
        
        document.querySelectorAll('.play div').forEach(function(element) {
            element.addEventListener('click', function(event) {
                var nameFromInput = nameInput ? nameInput.getAttribute('value') : '',
                    nameFromStorage = playerName ? playerName.innerHTML : '',
                    name = nameFromInput || nameFromStorage;
                
                app.tryStartingGame(name, undefined);
            });
        });
    
        document.addEventListener("touchstart", function() {},false);
        
        if(resizeCheck) {
            resizeCheck.addEventListener(TRANSITIONEND, app.resizeUi.bind(app));
        }
    
        log.info("App initialized.");
    
        initGame();
    };

    if(document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady, { once: true });
    } else {
        onReady();
    }
};

var initGame = function() {
    import('./game').then(function(mod) {
        var Game = mod.default;
        
        var canvas = document.getElementById("entities") as HTMLCanvasElement | null,
            background = document.getElementById("background") as HTMLCanvasElement | null,
            foreground = document.getElementById("foreground") as HTMLCanvasElement | null,
            input = document.getElementById("chatinput") as HTMLInputElement | null;

        if(!app) {
            return;
        }

        game = new Game(app);
        game.setup('#bubbles', canvas, background, foreground, input);
        game.setStorage(app.storage);
        app.setGame(game);
        installTestApi();
        
        if(app.isDesktop && app.supportsWorkers) {
            game.loadMap();
        }

        game.onGameStart(function() {
            app.initEquipmentIcons();
        });
        
        game.onDisconnect(function(message) {
            var deathParagraph = document.querySelector('#death p'),
                respawn = document.getElementById('respawn');
            if(deathParagraph) {
                deathParagraph.innerHTML = message + "<em>Please reload the page.</em>";
            }
            if(respawn) {
                respawn.style.display = 'none';
            }
        });

        game.onPlayerDeath(function() {
            if(document.body.classList.contains('credits')) {
                document.body.classList.remove('credits');
            }
            document.body.classList.add('death');
        });

        game.onPlayerEquipmentChange(function() {
            app.initEquipmentIcons();
        });

        game.onPlayerInvincible(function() {
            var hitpoints = document.getElementById('hitpoints');
            if(hitpoints) {
                hitpoints.classList.toggle('invincible');
            }
        });

        var instancePopulation = document.getElementById('instance-population'),
            playerCount = document.getElementById('playercount'),
            worldPopulation = document.getElementById('world-population');

        var setPopulationText = function(root, selector, value) {
            if(!root) {
                return;
            }
            var node = root.querySelector(selector);
            if(node) {
                node.textContent = value;
            }
        };

        game.onNbPlayersChange(function(worldPlayers, totalPlayers) {
            var worldCount = String(worldPlayers),
                totalCount = String(totalPlayers),
                worldLabel = worldPlayers === 1 ? "player" : "players",
                totalLabel = totalPlayers === 1 ? "player" : "players";

            setPopulationText(playerCount, 'span.count', worldCount);
            setPopulationText(playerCount, 'span:nth-child(2)', worldLabel);
            setPopulationText(instancePopulation, 'span:nth-child(1)', worldCount);
            setPopulationText(instancePopulation, 'span:nth-child(2)', worldLabel);
            setPopulationText(worldPopulation, 'span:nth-child(1)', totalCount);
            setPopulationText(worldPopulation, 'span:nth-child(2)', totalLabel);
        });

        game.onAchievementUnlock(function(id, name, description) {
            app.unlockAchievement(id, name);
        });

        game.onNotification(function(message) {
            app.showMessage(message);
        });

        app.initHealthBar();

        var nameInput = document.getElementById('nameinput') as HTMLInputElement | null,
            chatBox = document.getElementById('chatbox'),
            chatInput = document.getElementById('chatinput') as HTMLInputElement | null,
            createCharacterForm = document.getElementById('createcharacter-form') as HTMLFormElement | null,
            chatForm = document.getElementById('chat-form') as HTMLFormElement | null,
            foregroundEl = document.getElementById('foreground') as HTMLElement | null,
            parchmentEl = document.getElementById('parchment'),
            nameTooltip = document.getElementById('name-tooltip'),
            respawnButton = document.getElementById('respawn'),
            muteButton = document.getElementById('mutebutton');
        if(nameInput) {
            nameInput.setAttribute('value', '');
        }
        if(chatBox) {
            chatBox.setAttribute('value', '');
        }
        
        if(game.renderer.mobile || game.renderer.tablet) {
            if(foregroundEl) {
                foregroundEl.addEventListener('touchstart', function(event) {
                    app.center();
                    if(event.touches && event.touches[0]) {
                        app.setMouseCoordinates(event.touches[0]);
                    }
                    game.click();
                    app.hideWindows();
                });
            }
        } else {
            if(foregroundEl) {
                foregroundEl.addEventListener('click', function(event) {
                    app.center();
                    app.setMouseCoordinates(event);
                    if(game) {
                        game.click();
                    }
                    app.hideWindows();
                });
            }
        }

        document.body.onclick = function(event) {
            var hasClosedParchment = false;
            
            if(parchmentEl && parchmentEl.classList.contains('credits')) {
                if(game.started) {
                    app.closeInGameScroll('credits');
                    hasClosedParchment = true;
                } else {
                    app.toggleScrollContent('credits');
                }
            }
            
            if(parchmentEl && parchmentEl.classList.contains('legal')) {
                if(game.started) {
                    app.closeInGameScroll('legal');
                    hasClosedParchment = true;
                } else {
                    app.toggleScrollContent('legal');
                }
            }
            
            if(parchmentEl && parchmentEl.classList.contains('about')) {
                if(game.started) {
                    app.closeInGameScroll('about');
                    hasClosedParchment = true;
                } else {
                    app.toggleScrollContent('about');
                }
            }
            
            if(game.started && !game.renderer.mobile && game.player && !hasClosedParchment) {
                game.click();
            }
        };
        
        if(respawnButton) {
            respawnButton.addEventListener('click', function(event) {
                game.audioManager.playSound("revive");
                game.restart();
                document.body.classList.remove('death');
            });
        }
        
        document.addEventListener('mousemove', function(event) {
            app.setMouseCoordinates(event);
            if(game.started) {
                game.movecursor();
            }
        });

        document.addEventListener('keydown', function(e) {
            var key = e.which,
                chat = chatInput;

            if(key === 13) {
                if(chatBox && chatBox.classList.contains('active')) {
                    app.hideChat();
                } else {
                    app.showChat();
                }
            }
        });
        
        if(chatInput) {
            if(chatForm) {
                chatForm.addEventListener('submit', function(event) {
                    event.preventDefault();
                    return false;
                });
            }

            chatInput.addEventListener('keydown', function(e) {
                var key = e.which,
                    placeholder = chatInput.getAttribute("placeholder");
                
                if (!(e.shiftKey && e.keyCode === 16) && e.keyCode !== 9) {
                    if (chatInput.value === placeholder) {
                        chatInput.value = '';
                        chatInput.removeAttribute('placeholder');
                        chatInput.classList.remove('placeholder');
                    }
                }
                
                if(key === 13) {
                    if(chatInput.value !== '') {
                        if(game.player) {
                            game.say(chatInput.value);
                        }
                        chatInput.value = '';
                        app.hideChat();
                        if(foregroundEl) {
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
                
                if(key === 27) {
                    app.hideChat();
                    e.preventDefault();
                    return false;
                }
            });

            chatInput.addEventListener('focus', function(e) {
                var placeholder = chatInput.getAttribute("placeholder");
                
                if(!Detect.isFirefoxAndroid()) {
                    chatInput.value = placeholder || '';
                }
                
                if (chatInput.value === placeholder) {
                    chatInput.setSelectionRange(0, 0);
                }
            });
        }
        
        if(nameInput) {
            if(createCharacterForm) {
                createCharacterForm.addEventListener('submit', function(event) {
                    var name = nameInput.value;
                    event.preventDefault();
                    if(name !== '') {
                        app.tryStartingGame(name, function() {
                            nameInput.blur(); // exit keyboard on mobile
                        });
                    }
                    return false;
                });
            }

            nameInput.addEventListener('focusin', function() {
                if(nameTooltip) {
                    nameTooltip.classList.add('visible');
                }
            });
            
            nameInput.addEventListener('focusout', function() {
                if(nameTooltip) {
                    nameTooltip.classList.remove('visible');
                }
            });

            nameInput.addEventListener('keypress', function(event) {
                var name = nameInput.value;

                if(nameTooltip) {
                    nameTooltip.classList.remove('visible');
                }

                if(event.keyCode === 13) {
                    if(name !== '') {
                        app.tryStartingGame(name, function() {
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
        
        if(muteButton) {
            muteButton.addEventListener('click', function() {
                game.audioManager.toggle();
            });
        }
        
        document.addEventListener("keydown", function(e) {
            var key = e.which,
                activeElement = document.activeElement,
                chatFocused = chatInput && activeElement === chatInput,
                nameFocused = nameInput && activeElement === nameInput;

            if(!chatFocused && !nameFocused) {
                if(key === 13) { // Enter
                    if(game.ready && chatInput) {
                        chatInput.focus();
                        e.preventDefault();
                        return false;
                    }
                }
                if(key === 32) { // Space
                    // game.togglePathingGrid();
                    e.preventDefault();
                    return false;
                }
                if(key === 70) { // F
                    // game.toggleDebugInfo();
                    e.preventDefault();
                    return false;
                }
                if(key === 27) { // ESC
                    app.hideWindows();
                    Object.keys(game.player.attackers).forEach(function(id) {
                        game.player.attackers[id].stop();
                    });
                    e.preventDefault();
                    return false;
                }
                if(key === 65) { // a
                    // game.player.hit();
                    e.preventDefault();
                    return false;
                }
            } else {
                if(key === 13 && game.ready && chatInput) {
                    chatInput.focus();
                    e.preventDefault();
                    return false;
                }
            }
        });
        
        if(game.renderer.tablet) {
            document.body.classList.add('tablet');
        }
    }).catch(function(err) {
        log.error(err, true);
    });
};

initApp();
