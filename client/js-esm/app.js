import Storage from 'storage';
import log from 'compat/log';
import { TRANSITIONEND } from 'compat/util';

/**
 * @typedef {{
 *   dev: { host: string, port: number, dispatcher: boolean },
 *   build: { host: string, port: number, dispatcher: boolean },
 *   local: { host: string, port: number, dispatcher: boolean } | null
 * }} RuntimeConfig
 */

class App {
    constructor() {
        this.currentPage = 1;
        this.blinkInterval = null;
        this.isParchmentReady = true;
        this.ready = false;
        /** @type {RuntimeConfig | null} */
        this.config = null;
        this.storage = new Storage();
        this.watchNameInputInterval = setInterval(this.toggleButton.bind(this), 100);
        this.isStarting = false;
        this.playButtonEl = document.querySelector('#createcharacter .play');
        this.containerEl = document.getElementById('container');
        this.characterEl = document.getElementById('character');
        this.chatboxEl = document.getElementById('chatbox');
        this.chatinputEl = document.getElementById('chatinput');
        this.chatbuttonEl = document.getElementById('chatbutton');
        this.healthbarEl = document.getElementById('healthbar');
        this.hitpointsEl = document.getElementById('hitpoints');
        this.parchmentNameInputEl = document.querySelector('#parchment input');
        this.populationEl = document.getElementById('population');
        this.bodyEl = document.body;
        this.achievementsEl = document.getElementById('achievements');
        this.achievementsButtonEl = document.getElementById('achievementsbutton');
        this.instructionsEl = document.getElementById('instructions');
        this.helpButtonEl = document.getElementById('helpbutton');
        this.parchmentEl = document.getElementById('parchment');
        this.weaponEl = document.getElementById('weapon');
        this.armorEl = document.getElementById('armor');
        this.notificationWrapperEl = document.querySelector('#notifications div');
        this.message1El = document.getElementById('message1');
        this.message2El = document.getElementById('message2');
        this.achievementNotificationEl = document.getElementById('achievement-notification');
        this.unlockedAchievementsEl = document.getElementById('unlocked-achievements');
        this.totalAchievementsEl = document.getElementById('total-achievements');
        this.frontPage = 'createcharacter';
        
        if(localStorage && localStorage.data) {
            this.frontPage = 'loadcharacter';
        }
    }
    
    setGame(game) {
        this.game = game;
        this.isMobile = this.game.renderer.mobile;
        this.isTablet = this.game.renderer.tablet;
        this.isDesktop = !(this.isMobile || this.isTablet);
        this.supportsWorkers = !!window.Worker;
        this.ready = true;
    }

    center() {
        window.scrollTo(0, 1);
    }
    
    canStartGame() {
        if(this.isDesktop) {
            return (this.game && this.game.map && this.game.map.isLoaded);
        } else {
            return this.game;
        }
    }
    
    tryStartingGame(username, starting_callback) {
        var self = this,
            playButton = this.playButtonEl || document.querySelector('#createcharacter .play');
        
        if(username === '' || this.isStarting) {
            return;
        }

        this.isStarting = true;

        if(!this.ready || !this.canStartGame()) {
            if(!this.isMobile && playButton) {
                // on desktop and tablets, add a spinner to the play button
                playButton.classList.add('loading');
            }
            var watchCanStart = setInterval(function() {
                log.debug("waiting...");
                if(self.canStartGame()) {
                    setTimeout(function() {
                        if(!self.isMobile && playButton) {
                            playButton.classList.remove('loading');
                        }
                    }, 1500);
                    clearInterval(watchCanStart);
                    self.startGame(username, starting_callback);
                }
            }, 100);
        } else {
            this.startGame(username, starting_callback);
        }
    }
    
    startGame(username, starting_callback) {
        var self = this;
        
        if(starting_callback) {
            starting_callback();
        }
        this.hideIntro(function() {
            if(!self.isDesktop) {
                // On mobile and tablet we load the map after the player has clicked
                // on the PLAY button instead of loading it in a web worker.
                self.game.loadMap();
            }
            self.start(username);
        });
    }

    start(username) {
        var self = this,
            firstTimePlaying = !self.storage.hasAlreadyPlayed();
        
        if(username && !this.game.started) {
            var optionsSet = false,
                config = this.config;

            //>>includeStart("devHost", pragmas.devHost);
            if(config.local) {
                log.debug("Starting game with local dev config.");
                this.game.setServerOptions(config.local.host, config.local.port, username);
            } else {
                log.debug("Starting game with default dev config.");
                this.game.setServerOptions(config.dev.host, config.dev.port, username);
            }
            optionsSet = true;
            //>>includeEnd("devHost");
            
            //>>includeStart("prodHost", pragmas.prodHost);
            if(!optionsSet) {
                log.debug("Starting game with build config.");
                this.game.setServerOptions(config.build.host, config.build.port, username);
            }
            //>>includeEnd("prodHost");

            this.center();
            this.game.run(function() {
                if(self.bodyEl) {
                    self.bodyEl.classList.add('started');
                }
                if(firstTimePlaying) {
                    self.toggleInstructions();
                }
            });
        }
    }

    setMouseCoordinates(event) {
        var container = this.containerEl || document.getElementById('container');
        if(!container) {
            return;
        }
        var gamePos = container.getBoundingClientRect(),
            scale = this.game.renderer.getScaleFactor(),
            width = this.game.renderer.getWidth(),
            height = this.game.renderer.getHeight(),
            mouse = this.game.mouse;

        mouse.x = event.pageX - (gamePos.left + window.scrollX) - (this.isMobile ? 0 : 5 * scale);
        mouse.y = event.pageY - (gamePos.top + window.scrollY) - (this.isMobile ? 0 : 7 * scale);

        if(mouse.x <= 0) {
            mouse.x = 0;
        } else if(mouse.x >= width) {
            mouse.x = width - 1;
        }

        if(mouse.y <= 0) {
            mouse.y = 0;
        } else if(mouse.y >= height) {
            mouse.y = height - 1;
        }
    }

    initHealthBar() {
        var scale = this.game.renderer.getScaleFactor(),
            healthbar = this.healthbarEl || document.getElementById('healthbar'),
            hitpoints = this.hitpointsEl || document.getElementById('hitpoints'),
            healthMaxWidth = (healthbar ? healthbar.offsetWidth : 0) - (12 * scale);

        this.game.onPlayerHealthChange(function(hp, maxHp) {
            var barWidth = Math.round((healthMaxWidth / maxHp) * (hp > 0 ? hp : 0));
            if(hitpoints) {
                hitpoints.style.width = barWidth + "px";
            }
        });

        this.game.onPlayerHurt(this.blinkHealthBar.bind(this));
    }

    blinkHealthBar() {
        var hitpoints = this.hitpointsEl || document.getElementById('hitpoints');
        if(!hitpoints) {
            return;
        }

        hitpoints.classList.add('white');
        setTimeout(function() {
            hitpoints.classList.remove('white');
        }, 500)
    }

    toggleButton() {
        var nameInput = /** @type {HTMLInputElement | null} */ (this.parchmentNameInputEl || document.querySelector('#parchment input')),
            playButton = this.playButtonEl || document.querySelector('#createcharacter .play'),
            character = this.characterEl || document.getElementById('character'),
            name = nameInput ? nameInput.value : '';

        if(name && name.length > 0) {
            if(playButton) {
                playButton.classList.remove('disabled');
            }
            if(character) {
                character.classList.remove('disabled');
            }
        } else {
            if(playButton) {
                playButton.classList.add('disabled');
            }
            if(character) {
                character.classList.add('disabled');
            }
        }
    }

    hideIntro(hidden_callback) {
        clearInterval(this.watchNameInputInterval);
        document.body.classList.remove('intro');
        setTimeout(function() {
            document.body.classList.add('game');
            hidden_callback();
        }, 1000);
    }

    showChat() {
        var chatbox = this.chatboxEl || document.getElementById('chatbox'),
            chatinput = this.chatinputEl || document.getElementById('chatinput'),
            chatbutton = this.chatbuttonEl || document.getElementById('chatbutton');

        if(this.game.started) {
            if(chatbox) {
                chatbox.classList.add('active');
            }
            if(chatinput) {
                chatinput.focus();
            }
            if(chatbutton) {
                chatbutton.classList.add('active');
            }
        }
    }

    hideChat() {
        var chatbox = this.chatboxEl || document.getElementById('chatbox'),
            chatinput = this.chatinputEl || document.getElementById('chatinput'),
            chatbutton = this.chatbuttonEl || document.getElementById('chatbutton');

        if(this.game.started) {
            if(chatbox) {
                chatbox.classList.remove('active');
            }
            if(chatinput) {
                chatinput.blur();
            }
            if(chatbutton) {
                chatbutton.classList.remove('active');
            }
        }
    }

    toggleInstructions() {
        var achievements = this.achievementsEl || document.getElementById('achievements'),
            achievementsButton = this.achievementsButtonEl || document.getElementById('achievementsbutton'),
            instructions = this.instructionsEl || document.getElementById('instructions');

        if(achievements && achievements.classList.contains('active')) {
            this.toggleAchievements();
            if(achievementsButton) {
                achievementsButton.classList.remove('active');
            }
        }
        if(instructions) {
            instructions.classList.toggle('active');
        }
    }

    toggleAchievements() {
        var instructions = this.instructionsEl || document.getElementById('instructions'),
            helpButton = this.helpButtonEl || document.getElementById('helpbutton'),
            achievements = this.achievementsEl || document.getElementById('achievements');

        if(instructions && instructions.classList.contains('active')) {
            this.toggleInstructions();
            if(helpButton) {
                helpButton.classList.remove('active');
            }
        }
        this.resetPage();
        if(achievements) {
            achievements.classList.toggle('active');
        }
    }

    resetPage() {
        var self = this,
            achievements = this.achievementsEl || document.getElementById('achievements');

        if(achievements && achievements.classList.contains('active')) {
            var onTransitionEnd = function() {
                achievements.classList.remove('page' + self.currentPage);
                achievements.classList.add('page1');
                self.currentPage = 1;
                achievements.removeEventListener(TRANSITIONEND, onTransitionEnd);
            };
            achievements.addEventListener(TRANSITIONEND, onTransitionEnd);
        }
    }

    initEquipmentIcons() {
        var scale = this.game.renderer.getScaleFactor();
        var getIconPath = function(spriteName) {
                return 'img/'+ scale +'/item-' + spriteName + '.png';
            },
            weapon = this.game.player.getWeaponName(),
            armor = this.game.player.getSpriteName(),
            weaponPath = getIconPath(weapon),
            armorPath = getIconPath(armor);

        if(this.weaponEl) {
            this.weaponEl.style.backgroundImage = 'url("' + weaponPath + '")';
        }
        if(armor !== 'firefox') {
            if(this.armorEl) {
                this.armorEl.style.backgroundImage = 'url("' + armorPath + '")';
            }
        }
    }

    hideWindows() {
        var achievements = this.achievementsEl || document.getElementById('achievements'),
            achievementsButton = this.achievementsButtonEl || document.getElementById('achievementsbutton'),
            instructions = this.instructionsEl || document.getElementById('instructions'),
            helpButton = this.helpButtonEl || document.getElementById('helpbutton'),
            body = this.bodyEl || document.body;

        if(achievements && achievements.classList.contains('active')) {
            this.toggleAchievements();
            if(achievementsButton) {
                achievementsButton.classList.remove('active');
            }
        }
        if(instructions && instructions.classList.contains('active')) {
            this.toggleInstructions();
            if(helpButton) {
                helpButton.classList.remove('active');
            }
        }
        if(body && body.classList.contains('credits')) {
            this.closeInGameScroll('credits');
        }
        if(body && body.classList.contains('legal')) {
            this.closeInGameScroll('legal');
        }
        if(body && body.classList.contains('about')) {
            this.closeInGameScroll('about');
        }
    }

    showAchievementNotification(id, name) {
        var notif = this.achievementNotificationEl || document.getElementById('achievement-notification'),
            button = this.achievementsButtonEl || document.getElementById('achievementsbutton'),
            nameEl = notif ? notif.querySelector('.name') : null;

        if(notif) {
            notif.className = 'active achievement' + id;
        }
        if(nameEl) {
            nameEl.textContent = name;
        }
        if(this.game.storage.getAchievementCount() === 1) {
            this.blinkInterval = setInterval(function() {
                if(button) {
                    button.classList.toggle('blink');
                }
            }, 500);
        }
        setTimeout(function() {
            if(notif) {
                notif.classList.remove('active');
            }
            if(button) {
                button.classList.remove('blink');
            }
        }, 5000);
    }

    displayUnlockedAchievement(id) {
        var achievementEl = document.querySelector('#achievements li.achievement' + id);

        var achievement = this.game.getAchievementById(id);
        if(achievement && achievement.hidden && achievementEl) {
            var nameEl = achievementEl.querySelector('.achievement-name'),
                descEl = achievementEl.querySelector('.achievement-description');
            if(nameEl) {
                nameEl.innerHTML = achievement.name;
            }
            if(descEl) {
                descEl.innerHTML = achievement.desc;
            }
        }
        if(achievementEl) {
            achievementEl.classList.add('unlocked');
        }
    }

    unlockAchievement(id, name) {
        this.showAchievementNotification(id, name);
        this.displayUnlockedAchievement(id);

        var unlockedAchievements = this.unlockedAchievementsEl || document.getElementById('unlocked-achievements'),
            nb = parseInt(unlockedAchievements ? unlockedAchievements.textContent : '0', 10) || 0;
        if(unlockedAchievements) {
            unlockedAchievements.textContent = String(nb + 1);
        }
    }

    initAchievementList(achievements) {
        var self = this,
            lists = document.getElementById('lists'),
            pageTemplate = document.getElementById('page-tmpl'),
            achievementTemplate = document.getElementById('achievement-tmpl'),
            page = 0,
            count = 0,
            /** @type {HTMLElement | null} */
            pageNode = null;

        if(!lists || !pageTemplate || !achievementTemplate) {
            return;
        }

        Object.keys(achievements).forEach(function(key) {
            var achievement = achievements[key];
            count++;

            var achievementNode = /** @type {HTMLElement} */ (achievementTemplate.cloneNode(true));
            achievementNode.removeAttribute('id');
            achievementNode.classList.add('achievement'+count);
            achievementNode.style.display = '';
            if(!achievement.hidden) {
                self.setAchievementData(achievementNode, achievement.name, achievement.desc);
            }
            var twitterLink = achievementNode.querySelector('.twitter');
            if(twitterLink) {
                twitterLink.setAttribute('href', 'http://twitter.com/share?url=http%3A%2F%2Fbrowserquest.mozilla.org&text=I%20unlocked%20the%20%27'+ achievement.name +'%27%20achievement%20on%20Mozilla%27s%20%23BrowserQuest%21&related=glecollinet:Creators%20of%20BrowserQuest%2Cwhatthefranck');
            }

            achievementNode.querySelectorAll('a').forEach(function(link) {
                link.addEventListener('click', function(event) {
                    var url = link.getAttribute('href');
                    self.openPopup('twitter', url);
                    event.preventDefault();
                    return false;
                });
            });

            if((count - 1) % 4 === 0) {
                page++;
                pageNode = /** @type {HTMLElement} */ (pageTemplate.cloneNode(true));
                pageNode.setAttribute('id', 'page'+page);
                pageNode.style.display = '';
                lists.appendChild(pageNode);
            }
            if(pageNode) {
                pageNode.appendChild(achievementNode);
            }
        });

        if(this.totalAchievementsEl) {
            this.totalAchievementsEl.textContent = String(document.querySelectorAll('#achievements li').length);
        }
    }

    initUnlockedAchievements(ids) {
        var self = this;
        
        ids.forEach(function(id) {
            self.displayUnlockedAchievement(id);
        });
        var unlockedAchievements = this.unlockedAchievementsEl || document.getElementById('unlocked-achievements');
        if(unlockedAchievements) {
            unlockedAchievements.textContent = String(ids.length);
        }
    }

    setAchievementData(el, name, desc) {
        if(!el) {
            return;
        }
        var nameEl = el.querySelector('.achievement-name'),
            descriptionEl = el.querySelector('.achievement-description');
        if(nameEl) {
            nameEl.innerHTML = name;
        }
        if(descriptionEl) {
            descriptionEl.innerHTML = desc;
        }
    }

    toggleScrollContent(content) {
        var parchment = this.parchmentEl || document.getElementById('parchment'),
            body = this.bodyEl || document.body,
            helpButton = this.helpButtonEl || document.getElementById('helpbutton'),
            currentState = parchment ? parchment.className : '';

        if(this.game.started) {
            if(parchment) {
                parchment.className = content;
            }
            if(body) {
                body.classList.remove('credits', 'legal', 'about');
                body.classList.toggle(content);
            }
                
            if(!this.game.player) {
                if(body) {
                    body.classList.toggle('death');
                }
            }
            
            if(content !== 'about') {
                if(helpButton) {
                    helpButton.classList.remove('active');
                }
            }
        } else {
            if(currentState !== 'animate') {
                if(currentState === content) {
                    this.animateParchment(currentState, this.frontPage);
                } else {
                    this.animateParchment(currentState, content);
                }
            }
        }
    }

    closeInGameScroll(content) {
        var body = this.bodyEl || document.body,
            parchment = this.parchmentEl || document.getElementById('parchment'),
            helpButton = this.helpButtonEl || document.getElementById('helpbutton');

        if(body) {
            body.classList.remove(content);
        }
        if(parchment) {
            parchment.classList.remove(content);
        }
        if(!this.game.player) {
            if(body) {
                body.classList.add('death');
            }
        }
        if(content === 'about') {
            if(helpButton) {
                helpButton.classList.remove('active');
            }
        }
    }
    
    togglePopulationInfo() {
        var population = this.populationEl || document.getElementById('population');
        if(population) {
            population.classList.toggle('visible');
        }
    }

    openPopup(type, url) {
        var h = window.innerHeight,
            w = window.innerWidth,
            popupHeight,
            popupWidth,
            top,
            left;

        switch(type) {
            case 'twitter':
                popupHeight = 450;
                popupWidth = 550;
                break;
            case 'facebook':
                popupHeight = 400;
                popupWidth = 580;
                break;
        }

        top = (h / 2) - (popupHeight / 2);
        left = (w / 2) - (popupWidth / 2);

        var newwindow = window.open(url, 'name', 'height=' + popupHeight + ',width=' + popupWidth + ',top=' + top + ',left=' + left);
        if(window.focus && newwindow) {
            newwindow.focus();
        }
    }

    animateParchment(origin, destination) {
        var self = this,
            parchment = this.parchmentEl || document.getElementById('parchment'),
            duration = 1;

        if(!parchment) {
            return;
        }

        if(this.isMobile) {
            parchment.classList.remove(origin);
            parchment.classList.add(destination);
        } else {
            if(this.isParchmentReady) {
                if(this.isTablet) {
                    duration = 0;
                }
                this.isParchmentReady = !this.isParchmentReady;
    
                parchment.classList.toggle('animate');
                parchment.classList.remove(origin);

                setTimeout(function() {
                    parchment.classList.toggle('animate');
                    parchment.classList.add(destination);
                }, duration * 1000);
    
                setTimeout(function() {
                    self.isParchmentReady = !self.isParchmentReady;
                }, duration * 1000);
            }
        }
    }

    animateMessages() {
        var messages = this.notificationWrapperEl || document.querySelector('#notifications div');
        if(messages) {
            messages.classList.add('top');
        }
    }

    resetMessagesPosition() {
        var wrapper = this.notificationWrapperEl || document.querySelector('#notifications div'),
            message1 = this.message1El || document.getElementById('message1'),
            message2 = this.message2El || document.getElementById('message2'),
            message = message2 ? message2.textContent : '';

        if(wrapper) {
            wrapper.classList.remove('top');
        }
        if(message2) {
            message2.textContent = '';
        }
        if(message1) {
            message1.textContent = message || '';
        }
    }

    showMessage(message) {
        var wrapper = this.notificationWrapperEl || document.querySelector('#notifications div'),
            messageEl = this.message2El || document.getElementById('message2');

        this.animateMessages();
        if(messageEl) {
            messageEl.textContent = message;
        }
        if(this.messageTimer) {
            this.resetMessageTimer();
        }

        this.messageTimer = setTimeout(function() {
                if(wrapper) {
                    wrapper.classList.add('top');
                }
        }, 5000);
    }

    resetMessageTimer() {
        clearTimeout(this.messageTimer);
    }
    
    resizeUi() {
        if(this.game) {
            if(this.game.started) {
                this.game.resize();
                this.initHealthBar();
                this.game.updateBars();
            } else {
                var newScale = this.game.renderer.getScaleFactor();
                this.game.renderer.rescale(newScale);
            }
        } 
    }
}

export default App;
