import Storage from './storage';
import log from './platform/log';
import { TRANSITIONEND } from './platform/util';
import type { AchievementId } from './achievement-domain';
import { resolveImageAssetPath } from './image-assets';

type AchievementView = {
    id: number;
    name: string;
    desc: string;
    hidden?: boolean;
};

type RuntimeConfig = {
    server: { wsUrl: string; dispatcher: boolean };
};
type ScrollContent = 'credits' | 'legal' | 'about';
type PointerPosition = { pageX: number; pageY: number };

type AppGame = {
    renderer: {
        mobile: boolean;
        tablet: boolean;
        getScaleFactor(): number;
        getWidth(): number;
        getHeight(): number;
        rescale(scale: number): void;
    };
    map?: { isLoaded: boolean; getLoadError?: () => string | null } | null;
    mouse: { x: number; y: number };
    started: boolean;
    player: {
        getWeaponName(): string | null;
        getSpriteName(): string;
    } | null;
    storage: { getAchievementCount(): number };
    loadMap(): void;
    setServerOptions(wsUrl: string, username: string): void;
    run(callback: () => void, onFailed?: (reason: string) => void): void;
    on(eventName: 'playerHealthChange', callback: (hp: number, maxHp: number) => void): void;
    on(eventName: 'playerHurt', callback: () => void): void;
    getAchievementById(id: AchievementId): AchievementView | null | undefined;
    resize(): void;
    updateBars(): void;
};

class App {
    currentPage: number;
    blinkInterval: ReturnType<typeof setInterval> | null;
    isParchmentReady: boolean;
    ready: boolean;
    config: RuntimeConfig | null;
    storage: Storage;
    isStarting: boolean;
    playButtonEl: Element | null;
    containerEl: HTMLElement | null;
    characterEl: HTMLElement | null;
    chatboxEl: HTMLElement | null;
    chatinputEl: HTMLElement | null;
    chatbuttonEl: HTMLElement | null;
    healthbarEl: HTMLElement | null;
    hitpointsEl: HTMLElement | null;
    parchmentNameInputEl: HTMLInputElement | null;
    populationEl: HTMLElement | null;
    bodyEl: HTMLElement;
    achievementsEl: HTMLElement | null;
    achievementsButtonEl: HTMLElement | null;
    instructionsEl: HTMLElement | null;
    helpButtonEl: HTMLElement | null;
    parchmentEl: HTMLElement | null;
    weaponEl: HTMLElement | null;
    armorEl: HTMLElement | null;
    notificationWrapperEl: Element | null;
    message1El: HTMLElement | null;
    message2El: HTMLElement | null;
    achievementNotificationEl: HTMLElement | null;
    unlockedAchievementsEl: HTMLElement | null;
    totalAchievementsEl: HTMLElement | null;
    frontPage: string;
    game: AppGame | null;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    supportsWorkers: boolean;
    messageTimer: ReturnType<typeof setTimeout> | null;

    constructor() {
        this.currentPage = 1;
        this.blinkInterval = null;
        this.isParchmentReady = true;
        this.ready = false;
        this.config = null;
        this.storage = new Storage();
        this.isStarting = false;
        this.playButtonEl = document.querySelector('#createcharacter .play');
        this.containerEl = document.getElementById('container');
        this.characterEl = document.getElementById('character');
        this.chatboxEl = document.getElementById('chatbox');
        this.chatinputEl = document.getElementById('chatinput');
        this.chatbuttonEl = document.getElementById('chatbutton');
        this.healthbarEl = document.getElementById('healthbar');
        this.hitpointsEl = document.getElementById('hitpoints');
        this.parchmentNameInputEl = document.querySelector<HTMLInputElement>('#parchment input');
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
        this.game = null;
        this.isMobile = false;
        this.isTablet = false;
        this.isDesktop = true;
        this.supportsWorkers = false;
        this.messageTimer = null;

        if (this.storage.hasAlreadyPlayed()) {
            this.frontPage = 'loadcharacter';
        }
    }

    setGame(game: AppGame): void {
        this.game = game;
        this.updateDeviceClasses();
        this.supportsWorkers = !!window.Worker;
        this.ready = true;
        this.syncPhoneViewport();
    }

    updateDeviceClasses(): void {
        const renderer = this.game?.renderer;
        if (!renderer) {
            return;
        }

        this.isMobile = renderer.mobile;
        this.isTablet = renderer.tablet;
        this.isDesktop = !(this.isMobile || this.isTablet);

        const isPhone = renderer.mobile && !renderer.tablet;
        this.bodyEl.classList.toggle('tablet', renderer.tablet);
        this.bodyEl.classList.toggle('phone', isPhone);
    }

    syncPhoneViewport(): void {
        if (!this.bodyEl.classList.contains('phone')) {
            return;
        }

        const foreground = document.getElementById('foreground') as HTMLCanvasElement | null;
        if (!foreground || foreground.width <= 0 || foreground.height <= 0) {
            return;
        }

        this.bodyEl.style.setProperty('--game-width', `${foreground.width}px`);
        this.bodyEl.style.setProperty('--game-height', `${foreground.height}px`);
    }

    center(): void {
        window.scrollTo(0, 1);
    }

    canStartGame(): boolean {
        const mapLoadError = this.game?.map?.getLoadError?.() ?? null;
        if (mapLoadError) {
            return false;
        }
        if (this.isDesktop) {
            return !!(this.game?.map?.isLoaded);
        } else {
            return !!this.game;
        }
    }

    tryStartingGame(username: string, onStarting?: () => void): void {
        const self = this,
            playButton = this.playButtonEl ?? document.querySelector('#createcharacter .play');
        const startAttemptAt = Date.now();
        const maxStartWaitMs = 20_000;

        const clearPlayLoading = (): void => {
            if (!self.isMobile && playButton) {
                playButton.classList.remove('loading');
            }
        };

        const failStart = (message: string): void => {
            clearPlayLoading();
            self.isStarting = false;
            self.showMessage(message);
        };

        if (username === '' || this.isStarting) {
            return;
        }

        this.isStarting = true;

        if (!this.ready || !this.canStartGame()) {
            if (!this.isMobile && playButton) {
                // on desktop and tablets, add a spinner to the play button
                playButton.classList.add('loading');
            }
            const watchCanStart = setInterval(function () {
                log.debug('waiting...');
                const mapLoadError = self.game?.map?.getLoadError?.() ?? null;
                if (mapLoadError) {
                    clearInterval(watchCanStart);
                    failStart('Unable to load map data. Please reload the page.');
                    return;
                }
                if (Date.now() - startAttemptAt >= maxStartWaitMs) {
                    clearInterval(watchCanStart);
                    failStart('Game start timed out while loading. Please reload the page.');
                    return;
                }
                if (self.canStartGame()) {
                    setTimeout(function () {
                        clearPlayLoading();
                    }, 1500);
                    clearInterval(watchCanStart);
                    self.startGame(username, onStarting);
                }
            }, 100);
        } else {
            this.startGame(username, onStarting);
        }
    }

    startGame(username: string, onStarting?: () => void): void {
        const self = this;
        const game = this.game;
        if (!game) {
            this.isStarting = false;
            this.showMessage('Game is not ready yet. Please retry.');
            return;
        }

        if (onStarting) {
            onStarting();
        }
        this.hideIntro(function () {
            if (!self.isDesktop) {
                // On mobile and tablet we load the map after the player has clicked
                // on the PLAY button instead of loading it in a web worker.
                game.loadMap();
            }
            self.start(username);
        });
    }

    start(username: string): void {
        const game = this.game;
        if (!game) {
            this.isStarting = false;
            this.showMessage('Game is not ready yet. Please retry.');
            return;
        }
        const self = this;
        const firstTimePlaying = !self.storage.hasAlreadyPlayed();

        if (username && !game.started) {
            const config = this.config;
            const serverConfig = config?.server ?? { wsUrl: 'ws://localhost/ws', dispatcher: false };

            log.debug('Starting game with runtime server config.');
            game.setServerOptions(serverConfig.wsUrl, username);

            this.center();
            game.run(
                function () {
                    self.isStarting = false;
                    self.bodyEl.classList.add('started');
                    if (firstTimePlaying) {
                        self.toggleInstructions();
                    }
                },
                function (reason: string) {
                    self.isStarting = false;
                    self.showMessage(reason);
                }
            );
        }
    }

    setMouseCoordinates(event: PointerPosition): void {
        const game = this.game;
        if (!game) {
            return;
        }
        const container = this.containerEl ?? document.getElementById('container');
        if (!container) {
            return;
        }
        const isPhone = game.renderer.mobile && !game.renderer.tablet;

        const scale = game.renderer.getScaleFactor();
        const width = game.renderer.getWidth();
        const height = game.renderer.getHeight();
        const mouse = game.mouse;

        if (isPhone) {
            const viewport = document.getElementById('foreground');
            const gamePos = (viewport ?? container).getBoundingClientRect();

            mouse.x = event.pageX - (gamePos.left + window.scrollX);
            mouse.y = event.pageY - (gamePos.top + window.scrollY);
        } else {
            const gamePos = container.getBoundingClientRect();
            mouse.x = event.pageX - (gamePos.left + window.scrollX) - (this.isMobile ? 0 : 5 * scale);
            mouse.y = event.pageY - (gamePos.top + window.scrollY) - (this.isMobile ? 0 : 7 * scale);
        }

        if (mouse.x <= 0) {
            mouse.x = 0;
        } else if (mouse.x >= width) {
            mouse.x = width - 1;
        }

        if (mouse.y <= 0) {
            mouse.y = 0;
        } else if (mouse.y >= height) {
            mouse.y = height - 1;
        }
    }

    initHealthBar(): void {
        const game = this.game;
        if (!game) {
            return;
        }
        const scale = game.renderer.getScaleFactor(),
            healthbar = this.healthbarEl ?? document.getElementById('healthbar'),
            hitpoints = this.hitpointsEl ?? document.getElementById('hitpoints'),
            healthMaxWidth = (healthbar ? healthbar.offsetWidth : 0) - 12 * scale;

        game.on('playerHealthChange', function (hp, maxHp) {
            const barWidth = Math.round((healthMaxWidth / maxHp) * (hp > 0 ? hp : 0));
            if (hitpoints) {
                hitpoints.style.width = barWidth + 'px';
            }
        });

        game.on('playerHurt', () => this.blinkHealthBar());
    }

    blinkHealthBar(): void {
        const hitpoints = this.hitpointsEl ?? document.getElementById('hitpoints');
        if (!hitpoints) {
            return;
        }

        hitpoints.classList.add('white');
        setTimeout(function () {
            hitpoints.classList.remove('white');
        }, 500);
    }

    toggleButton(): void {
        const nameInput = this.parchmentNameInputEl ?? document.querySelector<HTMLInputElement>('#parchment input'),
            playButton = this.playButtonEl ?? document.querySelector('#createcharacter .play'),
            character = this.characterEl ?? document.getElementById('character'),
            name = nameInput ? nameInput.value : '';

        if (name && name.length > 0) {
            if (playButton) {
                playButton.classList.remove('disabled');
            }
            if (character) {
                character.classList.remove('disabled');
            }
        } else {
            if (playButton) {
                playButton.classList.add('disabled');
            }
            if (character) {
                character.classList.add('disabled');
            }
        }
    }

    hideIntro(onHidden: () => void): void {
        document.body.classList.remove('intro');
        setTimeout(function () {
            document.body.classList.add('game');
            onHidden();
        }, 1000);
    }

    showChat(): void {
        const game = this.game;
        if (!game) {
            return;
        }
        const chatbox = this.chatboxEl ?? document.getElementById('chatbox'),
            chatinput = this.chatinputEl ?? document.getElementById('chatinput'),
            chatbutton = this.chatbuttonEl ?? document.getElementById('chatbutton');

        if (game.started) {
            if (chatbox) {
                chatbox.classList.add('active');
            }
            if (chatinput) {
                chatinput.focus();
            }
            if (chatbutton) {
                chatbutton.classList.add('active');
            }
        }
    }

    hideChat(): void {
        const game = this.game;
        if (!game) {
            return;
        }
        const chatbox = this.chatboxEl ?? document.getElementById('chatbox'),
            chatinput = this.chatinputEl ?? document.getElementById('chatinput'),
            chatbutton = this.chatbuttonEl ?? document.getElementById('chatbutton');

        if (game.started) {
            if (chatbox) {
                chatbox.classList.remove('active');
            }
            if (chatinput) {
                chatinput.blur();
            }
            if (chatbutton) {
                chatbutton.classList.remove('active');
            }
        }
    }

    toggleInstructions(): void {
        const achievements = this.achievementsEl ?? document.getElementById('achievements'),
            achievementsButton = this.achievementsButtonEl ?? document.getElementById('achievementsbutton'),
            instructions = this.instructionsEl ?? document.getElementById('instructions');

        if (achievements?.classList.contains('active')) {
            this.toggleAchievements();
            if (achievementsButton) {
                achievementsButton.classList.remove('active');
            }
        }
        if (instructions) {
            instructions.classList.toggle('active');
        }
    }

    toggleAchievements(): void {
        const instructions = this.instructionsEl ?? document.getElementById('instructions'),
            helpButton = this.helpButtonEl ?? document.getElementById('helpbutton'),
            achievements = this.achievementsEl ?? document.getElementById('achievements');

        if (instructions?.classList.contains('active')) {
            this.toggleInstructions();
            if (helpButton) {
                helpButton.classList.remove('active');
            }
        }
        this.resetPage();
        if (achievements) {
            achievements.classList.toggle('active');
        }
        this.stopAchievementBlink();
    }

    resetPage(): void {
        const self = this,
            achievements = this.achievementsEl ?? document.getElementById('achievements');

        if (achievements?.classList.contains('active')) {
            const onTransitionEnd = function () {
                achievements.classList.remove('page' + self.currentPage);
                achievements.classList.add('page1');
                self.currentPage = 1;
                achievements.removeEventListener(TRANSITIONEND, onTransitionEnd);
            };
            achievements.addEventListener(TRANSITIONEND, onTransitionEnd);
        }
    }

    initEquipmentIcons(): void {
        const game = this.game;
        if (!game?.player) {
            return;
        }
        const scale = game.renderer.getScaleFactor();
        const getIconPath = function (spriteName: string) {
                return resolveImageAssetPath(scale, 'item-' + spriteName);
            },
            weapon = game.player.getWeaponName(),
            armor = game.player.getSpriteName(),
            weaponPath = typeof weapon === 'string' ? getIconPath(weapon) : null,
            armorPath = getIconPath(armor);

        if (weaponPath && this.weaponEl) {
            this.weaponEl.style.backgroundImage = 'url("' + weaponPath + '")';
        }
        if (armor !== 'firefox') {
            if (this.armorEl) {
                this.armorEl.style.backgroundImage = 'url("' + armorPath + '")';
            }
        }
    }

    hideWindows(): void {
        const achievements = this.achievementsEl ?? document.getElementById('achievements'),
            achievementsButton = this.achievementsButtonEl ?? document.getElementById('achievementsbutton'),
            instructions = this.instructionsEl ?? document.getElementById('instructions'),
            helpButton = this.helpButtonEl ?? document.getElementById('helpbutton'),
            body = this.bodyEl;

        if (achievements?.classList.contains('active')) {
            this.toggleAchievements();
            if (achievementsButton) {
                achievementsButton.classList.remove('active');
            }
        }
        if (instructions?.classList.contains('active')) {
            this.toggleInstructions();
            if (helpButton) {
                helpButton.classList.remove('active');
            }
        }
        if (body.classList.contains('credits')) {
            this.closeInGameScroll('credits');
        }
        if (body.classList.contains('legal')) {
            this.closeInGameScroll('legal');
        }
        if (body.classList.contains('about')) {
            this.closeInGameScroll('about');
        }
    }

    showAchievementNotification(id: AchievementId, name: string): void {
        const game = this.game;
        if (!game) {
            return;
        }
        const notif = this.achievementNotificationEl ?? document.getElementById('achievement-notification'),
            button = this.achievementsButtonEl ?? document.getElementById('achievementsbutton'),
            nameEl = notif ? notif.querySelector('.name') : null;

        if (notif) {
            notif.className = 'active achievement' + id;
        }
        if (nameEl) {
            nameEl.textContent = name;
        }
        if (game.storage.getAchievementCount() === 1 && !this.blinkInterval) {
            this.blinkInterval = setInterval(function () {
                if (button) {
                    button.classList.toggle('blink');
                }
            }, 500);
        }
        setTimeout(() => {
            if (notif) {
                notif.classList.remove('active');
            }
            this.stopAchievementBlink();
        }, 5000);
    }

    stopAchievementBlink(): void {
        if (this.blinkInterval) {
            clearInterval(this.blinkInterval);
            this.blinkInterval = null;
        }
        const button = this.achievementsButtonEl ?? document.getElementById('achievementsbutton');
        if (button) {
            button.classList.remove('blink');
        }
    }

    displayUnlockedAchievement(id: AchievementId): void {
        const game = this.game;
        if (!game) {
            return;
        }
        const achievementEl = document.querySelector('#achievements li.achievement' + id);

        const achievement = game.getAchievementById(id);
        if (achievement && achievement.hidden && achievementEl) {
            const nameEl = achievementEl.querySelector('.achievement-name'),
                descEl = achievementEl.querySelector('.achievement-description');
            if (nameEl) {
                nameEl.innerHTML = achievement.name;
            }
            if (descEl) {
                descEl.innerHTML = achievement.desc;
            }
        }
        if (achievementEl) {
            achievementEl.classList.add('unlocked');
        }
    }

    unlockAchievement(id: AchievementId, name: string): void {
        this.showAchievementNotification(id, name);
        this.displayUnlockedAchievement(id);

        const unlockedAchievements = this.unlockedAchievementsEl ?? document.getElementById('unlocked-achievements');
        const parsed = Number.parseInt(unlockedAchievements?.textContent ?? '0', 10);
        const nb = Number.isFinite(parsed) ? parsed : 0;
        if (unlockedAchievements) {
            unlockedAchievements.textContent = String(nb + 1);
        }
    }

    initAchievementList(achievements: Record<string, AchievementView>): void {
        const self = this,
            lists = document.getElementById('lists'),
            pageTemplate = document.getElementById('page-tmpl'),
            achievementTemplate = document.getElementById('achievement-tmpl');
        let page = 0;
        let count = 0;
        let pageNode: HTMLElement | null = null;

        if (!lists || !pageTemplate || !achievementTemplate) {
            return;
        }

        Object.keys(achievements).forEach(function (key: string) {
            const achievement = achievements[key];
            if (!achievement) {
                return;
            }
            count++;

            const achievementNode = achievementTemplate.cloneNode(true) as HTMLElement;
            achievementNode.removeAttribute('id');
            achievementNode.classList.add('achievement' + count);
            achievementNode.style.display = '';
            if (!achievement.hidden) {
                self.setAchievementData(achievementNode, achievement.name, achievement.desc);
            }
            const twitterLink = achievementNode.querySelector('.twitter');
            if (twitterLink) {
                twitterLink.setAttribute(
                    'href',
                    'http://twitter.com/share?url=http%3A%2F%2Fbrowserquest.mozilla.org&text=I%20unlocked%20the%20%27' +
                        achievement.name +
                        '%27%20achievement%20on%20Mozilla%27s%20%23BrowserQuest%21&related=glecollinet:Creators%20of%20BrowserQuest%2Cwhatthefranck'
                );
            }

            achievementNode.querySelectorAll('a').forEach(function (link: Element) {
                link.addEventListener('click', function (event: Event) {
                    const url = link.getAttribute('href');
                    if (!url) {
                        return;
                    }
                    self.openPopup(url);
                    event.preventDefault();
                    return false;
                });
            });

            if ((count - 1) % 4 === 0) {
                page++;
                pageNode = pageTemplate.cloneNode(true) as HTMLElement;
                pageNode.setAttribute('id', 'page' + page);
                pageNode.style.display = '';
                lists.appendChild(pageNode);
            }
            if (pageNode) {
                pageNode.appendChild(achievementNode);
            }
        });

        if (this.totalAchievementsEl) {
            this.totalAchievementsEl.textContent = String(document.querySelectorAll('#achievements li').length);
        }
    }

    initUnlockedAchievements(ids: AchievementId[]): void {
        const self = this;

        ids.forEach(function (id: AchievementId) {
            self.displayUnlockedAchievement(id);
        });
        const unlockedAchievements = this.unlockedAchievementsEl ?? document.getElementById('unlocked-achievements');
        if (unlockedAchievements) {
            unlockedAchievements.textContent = String(ids.length);
        }
    }

    setAchievementData(el: Element | null, name: string, desc: string): void {
        if (!el) {
            return;
        }
        const nameEl = el.querySelector('.achievement-name'),
            descriptionEl = el.querySelector('.achievement-description');
        if (nameEl) {
            nameEl.innerHTML = name;
        }
        if (descriptionEl) {
            descriptionEl.innerHTML = desc;
        }
    }

    toggleScrollContent(content: ScrollContent): void {
        const game = this.game;
        const parchment = this.parchmentEl ?? document.getElementById('parchment'),
            body = this.bodyEl,
            helpButton = this.helpButtonEl ?? document.getElementById('helpbutton'),
            currentState = parchment ? parchment.className : '';

        if (game?.started) {
            if (parchment) {
                parchment.className = content;
            }
            body.classList.remove('credits', 'legal', 'about');
            body.classList.toggle(content);

            if (!game.player) {
                body.classList.toggle('death');
            }

            if (content !== 'about') {
                if (helpButton) {
                    helpButton.classList.remove('active');
                }
            }
        } else {
            if (currentState !== 'animate') {
                if (currentState === content) {
                    this.animateParchment(currentState, this.frontPage);
                } else {
                    this.animateParchment(currentState, content);
                }
            }
        }
    }

    closeInGameScroll(content: ScrollContent): void {
        const game = this.game;
        const body = this.bodyEl,
            parchment = this.parchmentEl ?? document.getElementById('parchment'),
            helpButton = this.helpButtonEl ?? document.getElementById('helpbutton');

        body.classList.remove(content);
        if (parchment) {
            parchment.classList.remove(content);
        }
        if (!game?.player) {
            body.classList.add('death');
        }
        if (content === 'about') {
            if (helpButton) {
                helpButton.classList.remove('active');
            }
        }
    }

    togglePopulationInfo(): void {
        const population = this.populationEl ?? document.getElementById('population');
        if (population) {
            population.classList.toggle('visible');
        }
    }

    openPopup(url: string): void {
        const h = window.innerHeight,
            w = window.innerWidth;
        const popupHeight = 450;
        const popupWidth = 550;

        const top = h / 2 - popupHeight / 2;
        const left = w / 2 - popupWidth / 2;

        const newwindow = window.open(
            url,
            'name',
            'height=' + popupHeight + ',width=' + popupWidth + ',top=' + top + ',left=' + left
        );
        newwindow?.focus();
    }

    animateParchment(origin: string, destination: string): void {
        const self = this,
            parchment = this.parchmentEl ?? document.getElementById('parchment');
        let duration = 1;

        if (!parchment) {
            return;
        }

        if (this.isMobile) {
            parchment.classList.remove(origin);
            parchment.classList.add(destination);
        } else {
            if (this.isParchmentReady) {
                if (this.isTablet) {
                    duration = 0;
                }
                this.isParchmentReady = !this.isParchmentReady;

                parchment.classList.toggle('animate');
                parchment.classList.remove(origin);

                setTimeout(function () {
                    parchment.classList.toggle('animate');
                    parchment.classList.add(destination);
                }, duration * 1000);

                setTimeout(function () {
                    self.isParchmentReady = !self.isParchmentReady;
                }, duration * 1000);
            }
        }
    }

    animateMessages(): void {
        const messages = this.notificationWrapperEl ?? document.querySelector('#notifications div');
        if (messages) {
            messages.classList.add('top');
        }
    }

    resetMessagesPosition(): void {
        const wrapper = this.notificationWrapperEl ?? document.querySelector('#notifications div'),
            message1 = this.message1El ?? document.getElementById('message1'),
            message2 = this.message2El ?? document.getElementById('message2'),
            message = message2 ? message2.textContent : null;

        if (wrapper) {
            wrapper.classList.remove('top');
        }
        if (message2) {
            message2.textContent = '';
        }
        if (message1) {
            message1.textContent = message ?? '';
        }
    }

    showMessage(message: string): void {
        const wrapper = this.notificationWrapperEl ?? document.querySelector('#notifications div'),
            messageEl = this.message2El ?? document.getElementById('message2');

        this.animateMessages();
        if (messageEl) {
            messageEl.textContent = message;
        }
        if (this.messageTimer) {
            this.resetMessageTimer();
        }

        this.messageTimer = setTimeout(function () {
            if (wrapper) {
                wrapper.classList.add('top');
            }
        }, 5000);
    }

    resetMessageTimer(): void {
        if (this.messageTimer !== null) {
            clearTimeout(this.messageTimer);
            this.messageTimer = null;
        }
    }

    resizeUi(): void {
        if (this.game) {
            if (this.game.started) {
                this.game.resize();
                this.initHealthBar();
                this.game.updateBars();
            } else {
                const newScale = this.game.renderer.getScaleFactor();
                this.game.renderer.rescale(newScale);
            }
            this.updateDeviceClasses();
            this.syncPhoneViewport();
        }
    }
}

export default App;
