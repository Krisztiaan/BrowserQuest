import InfoManager from './infomanager';
import BubbleManager from './bubble';
import Renderer from './renderer';
import Map from './map';
import Animation from './animation';
import Sprite from './sprite';
import { initializeGameSessionConnection } from './game-session-connect-initializer';
import AnimatedTile from './tile';
import Warrior from './warrior';
import GameClient from './gameclient';
import AudioManager from './audio';
import Updater from './updater';
import Transition from './transition';
import Pathfinder from './pathfinder';
import type Camera from './camera';
import Item from './item';
import Mob from './mob';
import Npc from './npc';
import Player from './player';
import Character from './character';
import Chest from './chest';
import config from './config';
import log from './compat/log';
import Types from './compat/gametypes';
import type { EntityKind } from './compat/gametypes';
import { requestAnimFrame } from './compat/util';
import type { AchievementId, AchievementKey } from './achievement-domain';
import { SPRITE_KEYS } from './asset-key-domain';
import type { AudioSoundKey, CursorKey, SpriteKey } from './asset-key-domain';
import Storage from './storage';
import { Evented } from '../../shared/js/evented';
import type { TypedEventSource } from '../../shared/js/typed-event-emitter';

type GridPosition = { x: number; y: number };
type EntityId = string | number;
type GridIndexedEntity = {
    id: EntityId;
    kind: EntityKind;
    x: number;
    y: number;
    gridX: number;
    gridY: number;
    nextGridX?: number;
    nextGridY?: number;
    isDirty: boolean;
    dirtyRect?: DirtyRect | null;
    oldDirtyRect?: DirtyRect | null;
    fadeIn(currentTime: number): void;
    on(eventName: 'dirty', callback: (entity: GridIndexedEntity) => void): void;
    clean(): void;
    blink(speed: number): void;
    setSprite(sprite: Sprite | null): void;
    setDirty(): void;
    setHighlight(isHighlighted: boolean): void;
    setWeaponName?(name: string): void;
};
type DirtyAnimatedTile = AnimatedTile & { isDirty?: boolean };
type GridPath = Array<[number, number]>;
type DirtyRect = Record<string, number>;
type DirtyRectSource = GridIndexedEntity | DirtyAnimatedTile | null;
type BubbleAnchor = { id: EntityId; x: number; y: number };
const isHighlightableEntity = (entity: GridIndexedEntity): entity is HighlightableEntity =>
    typeof entity.setHighlight === 'function';
type RuntimeServerConfig = { host: string; port: number; dispatcher: boolean };
type AchievementDefinition = {
    id: number;
    name: string;
    desc: string;
    hidden?: boolean;
    isCompleted?: () => boolean;
};
type AppLike = {
    config: { server?: RuntimeServerConfig } | null;
    initAchievementList(achievements: Record<string, AchievementDefinition>): void;
    initUnlockedAchievements(unlocked: AchievementId[]): void;
};
type HighlightableEntity = GridIndexedEntity & {
    isHighlighted?: boolean;
    setHighlight(isHighlighted: boolean): void;
};
type EntityGridCell = Record<string, GridIndexedEntity>;
type EntityGrid = EntityGridCell[][];
type GameEvents = {
    gameStart: [];
    disconnect: [message: string];
    playerDeath: [];
    playerHealthChange: [hp: number, maxHp: number];
    playerHurt: [];
    playerEquipmentChange: [];
    nbPlayersChange: [worldPlayers: number, totalPlayers: number];
    notification: [message: string];
    playerInvincible: [];
    achievementUnlock: [id: AchievementId, name: string, description: string];
};

export type GameEventSource = TypedEventSource<GameEvents>;

class Game extends Evented<GameEvents> {
    app: AppLike;
    ready: boolean;
    started: boolean;
    hasNeverStarted: boolean;
    renderer: Renderer | null;
    updater: Updater | null;
    pathfinder: Pathfinder | null;
    chatinput: HTMLInputElement | null;
    bubbleManager: BubbleManager | null;
    audioManager: AudioManager | null;
    player: Warrior;
    entities: Record<string, GridIndexedEntity>;
    deathpositions: Record<string, GridPosition>;
    entityGrid: EntityGrid | null;
    pathingGrid: number[][] | null;
    renderingGrid: EntityGrid | null;
    itemGrid: EntityGrid | null;
    playerId: number | string | null;
    currentCursor: Sprite | null;
    currentCursorOrientation: number | null;
    mouse: { x: number; y: number };
    zoningQueue: Array<{ x: number; y: number }>;
    previousClickPosition: Partial<{ x: number; y: number }>;
    selectedX: number;
    selectedY: number;
    selectedCellVisible: boolean;
    targetColor: string;
    targetCellVisible: boolean;
    clearTarget: boolean;
    hoveringTarget: boolean;
    hoveringMob: boolean;
    hoveringItem: boolean;
    hoveringCollidingTile: boolean;
    hoveringPlateauTile: boolean;
    hoveringNpc: boolean;
    hoveringChest: boolean;
    infoManager: InfoManager;
    currentZoning: Transition | null;
    cursors: Record<string, Sprite>;
    sprites: Record<string, Sprite>;
    animatedTiles: DirtyAnimatedTile[] | null;
    debugPathing: boolean;
    spriteNames: SpriteKey[];
    storage: Storage;
    map: Map | null;
    shadows: Record<string, Sprite>;
    targetAnimation: Animation | null;
    sparksAnimation: Animation | null;
    achievements: Record<string, AchievementDefinition>;
    spritesets: Array<Record<string, Sprite>>;
    host: string;
    port: number;
    username: string;
    camera!: Camera;
    currentTime: number;
    isStopped: boolean;
    client: GameClient | null;
    zoningOrientation: number | null;
    obsoleteEntities: GridIndexedEntity[] | null;
    drawTarget: boolean;
    lastHovered: HighlightableEntity | null;

    constructor(app: AppLike) {
        super();
        this.app = app;
        this.app.config = config;
        this.ready = false;
        this.started = false;
        this.hasNeverStarted = true;

        this.renderer = null;
        this.updater = null;
        this.pathfinder = null;
        this.chatinput = null;
        this.bubbleManager = null;
        this.audioManager = null;

        // Player
        this.player = new Warrior('player', '');

        // Game state
        this.entities = {};
        this.deathpositions = {};
        this.entityGrid = null;
        this.pathingGrid = null;
        this.renderingGrid = null;
        this.itemGrid = null;
        this.playerId = null;
        this.currentCursor = null;
        this.mouse = { x: 0, y: 0 };
        this.zoningQueue = [];
        this.previousClickPosition = {};

        this.selectedX = 0;
        this.selectedY = 0;
        this.selectedCellVisible = false;
        this.targetColor = 'rgba(255, 255, 255, 0.5)';
        this.targetCellVisible = true;
        this.clearTarget = false;
        this.hoveringTarget = false;
        this.hoveringMob = false;
        this.hoveringItem = false;
        this.hoveringCollidingTile = false;
        this.hoveringPlateauTile = false;
        this.hoveringNpc = false;
        this.hoveringChest = false;

        // combat
        this.infoManager = new InfoManager(this);

        // zoning
        this.currentZoning = null;

        this.cursors = {};

        this.sprites = {};
        this.spritesets = [];
        this.shadows = {};

        // tile animation
        this.animatedTiles = null;

        // debug
        this.debugPathing = false;

        // sprites
        this.spriteNames = [...SPRITE_KEYS];
        this.map = null;
        this.targetAnimation = null;
        this.sparksAnimation = null;
        this.achievements = {};
        this.host = '';
        this.port = 0;
        this.username = '';
        this.currentTime = 0;
        this.isStopped = false;
        this.client = null;
        this.zoningOrientation = null;
        this.obsoleteEntities = null;
        this.drawTarget = false;
        this.lastHovered = null;
    }

    setup(
        bubbleContainer: string | Element | null,
        canvas: HTMLCanvasElement,
        background: HTMLCanvasElement,
        foreground: HTMLCanvasElement,
        input: HTMLInputElement
    ) {
        this.setBubbleManager(new BubbleManager(bubbleContainer));
        this.setRenderer(new Renderer(this, canvas, background, foreground));
        this.setChatInput(input);
    }

    setStorage(storage: Storage) {
        this.storage = storage;
    }

    setRenderer(renderer: Renderer) {
        this.renderer = renderer;
    }

    setUpdater(updater: Updater) {
        this.updater = updater;
    }

    setPathfinder(pathfinder: Pathfinder) {
        this.pathfinder = pathfinder;
    }

    setChatInput(element: HTMLInputElement) {
        this.chatinput = element;
    }

    setBubbleManager(bubbleManager: BubbleManager) {
        this.bubbleManager = bubbleManager;
    }

    loadMap() {
        var self = this;

        this.map = new Map(!this.renderer.upscaledRendering, this);

        this.map.ready(function () {
            log.info('Map loaded.');
            var tilesetIndex = self.renderer.upscaledRendering ? 0 : self.renderer.scale - 1;
            self.renderer.setTileset(self.map.tilesets[tilesetIndex]);
        });
    }

    initPlayer() {
        if (this.storage.hasAlreadyPlayed() && this.storage.data.player) {
            if (this.storage.data.player.armor && this.storage.data.player.weapon) {
                this.player.setSpriteName(this.storage.data.player.armor);
                this.player.setWeaponName(this.storage.data.player.weapon);
            }
        }

        this.player.setSprite(this.sprites[this.player.getSpriteName()]);
        this.player.idle();

        log.debug('Finished initPlayer');
    }

    initShadows() {
        this.shadows = {};
        this.shadows['small'] = this.sprites['shadow16'];
    }

    initCursors() {
        this.cursors['hand'] = this.sprites['hand'];
        this.cursors['sword'] = this.sprites['sword'];
        this.cursors['loot'] = this.sprites['loot'];
        this.cursors['target'] = this.sprites['target'];
        this.cursors['arrow'] = this.sprites['arrow'];
        this.cursors['talk'] = this.sprites['talk'];
    }

    initAnimations() {
        this.targetAnimation = new Animation('idle_down', 4, 0, 16, 16);
        this.targetAnimation.setSpeed(50);

        this.sparksAnimation = new Animation('idle_down', 6, 0, 16, 16);
        this.sparksAnimation.setSpeed(120);
    }

    initHurtSprites() {
        var self = this;

        Types.forEachArmorKind(function (kind, kindName) {
            self.sprites[kindName].createHurtSprite();
        });
    }

    initSilhouettes() {
        var self = this;

        Types.forEachMobOrNpcKind(function (kind, kindName) {
            self.sprites[kindName].createSilhouette();
        });
        self.sprites['chest'].createSilhouette();
        self.sprites['item-cake'].createSilhouette();
    }

    initAchievements() {
        var self = this;

        this.achievements = {
            A_TRUE_WARRIOR: {
                id: 1,
                name: 'A True Warrior',
                desc: 'Find a new weapon',
            },
            INTO_THE_WILD: {
                id: 2,
                name: 'Into the Wild',
                desc: 'Venture outside the village',
            },
            ANGRY_RATS: {
                id: 3,
                name: 'Angry Rats',
                desc: 'Kill 10 rats',
                isCompleted: function () {
                    return self.storage.getRatCount() >= 10;
                },
            },
            SMALL_TALK: {
                id: 4,
                name: 'Small Talk',
                desc: 'Talk to a non-player character',
            },
            FAT_LOOT: {
                id: 5,
                name: 'Fat Loot',
                desc: 'Get a new armor set',
            },
            UNDERGROUND: {
                id: 6,
                name: 'Underground',
                desc: 'Explore at least one cave',
            },
            AT_WORLDS_END: {
                id: 7,
                name: "At World's End",
                desc: 'Reach the south shore',
            },
            COWARD: {
                id: 8,
                name: 'Coward',
                desc: 'Successfully escape an enemy',
            },
            TOMB_RAIDER: {
                id: 9,
                name: 'Tomb Raider',
                desc: 'Find the graveyard',
            },
            SKULL_COLLECTOR: {
                id: 10,
                name: 'Skull Collector',
                desc: 'Kill 10 skeletons',
                isCompleted: function () {
                    return self.storage.getSkeletonCount() >= 10;
                },
            },
            NINJA_LOOT: {
                id: 11,
                name: 'Ninja Loot',
                desc: "Get hold of an item you didn't fight for",
            },
            NO_MANS_LAND: {
                id: 12,
                name: "No Man's Land",
                desc: 'Travel through the desert',
            },
            HUNTER: {
                id: 13,
                name: 'Hunter',
                desc: 'Kill 50 enemies',
                isCompleted: function () {
                    return self.storage.getTotalKills() >= 50;
                },
            },
            STILL_ALIVE: {
                id: 14,
                name: 'Still Alive',
                desc: 'Revive your character five times',
                isCompleted: function () {
                    return self.storage.getTotalRevives() >= 5;
                },
            },
            MEATSHIELD: {
                id: 15,
                name: 'Meatshield',
                desc: 'Take 5,000 points of damage',
                isCompleted: function () {
                    return self.storage.getTotalDamageTaken() >= 5000;
                },
            },
            HOT_SPOT: {
                id: 16,
                name: 'Hot Spot',
                desc: 'Enter the volcanic mountains',
            },
            HERO: {
                id: 17,
                name: 'Hero',
                desc: 'Defeat the final boss',
            },
            FOXY: {
                id: 18,
                name: 'Foxy',
                desc: 'Find the Firefox costume',
                hidden: true,
            },
            FOR_SCIENCE: {
                id: 19,
                name: 'For Science',
                desc: 'Enter into a portal',
                hidden: true,
            },
            RICKROLLD: {
                id: 20,
                name: "Rickroll'd",
                desc: 'Take some singing lessons',
                hidden: true,
            },
        };

        Object.keys(this.achievements).forEach(function (key) {
            var obj = this.achievements[key];
            if (!obj.isCompleted) {
                obj.isCompleted = function () {
                    return true;
                };
            }
            if (!obj.hidden) {
                obj.hidden = false;
            }
        }, this);

        this.app.initAchievementList(this.achievements);

        if (this.storage.hasAlreadyPlayed()) {
            this.app.initUnlockedAchievements(this.storage.data.achievements.unlocked);
        }
    }

    getAchievementById(id: string | number): AchievementDefinition | null {
        var found: AchievementDefinition | null = null;
        Object.keys(this.achievements).forEach(function (key) {
            var achievement = this.achievements[key];
            if (achievement.id === parseInt(String(id), 10)) {
                found = achievement;
            }
        }, this);
        return found;
    }

    loadSpriteForScale(name: SpriteKey, scale: number) {
        var index = scale - 1;

        if (!this.spritesets[index]) {
            this.spritesets[index] = {};
        }
        if (!this.spritesets[index][name]) {
            this.spritesets[index][name] = new Sprite(name, scale);
        }
    }

    loadSpriteScale(scale: number) {
        this.spriteNames.forEach(function (name) {
            this.loadSpriteForScale(name, scale);
        }, this);
    }

    setSpriteScale(scale: number) {
        var self = this;

        if (this.renderer.upscaledRendering) {
            this.sprites = this.spritesets[0] || {};
        } else {
            this.loadSpriteScale(scale);
            this.sprites = this.spritesets[scale - 1] || {};

            Object.keys(this.entities).forEach(function (id) {
                var entity = this.entities[id];
                entity.sprite = null;
                entity.setSprite(self.sprites[entity.getSpriteName()]);
            }, this);
            this.initHurtSprites();
            this.initShadows();
            this.initCursors();
        }
    }

    loadSprites() {
        log.info('Loading sprites...');
        this.spritesets = [];
        this.spritesets[0] = {};
        this.spritesets[1] = {};
        this.spritesets[2] = {};
        if (this.renderer.upscaledRendering) {
            this.loadSpriteScale(1);
            return;
        }
        this.loadSpriteScale(this.renderer.scale);
    }

    spritesLoaded() {
        if (
            Object.keys(this.sprites).some(function (name) {
                return !this.sprites[name].isLoaded;
            }, this)
        ) {
            return false;
        }
        return true;
    }

    setCursor(name: CursorKey, orientation?: number) {
        if (name in this.cursors) {
            this.currentCursor = this.cursors[name];
            this.currentCursorOrientation = orientation;
        } else {
            log.error('Unknown cursor name :' + name);
        }
    }

    updateCursorLogic() {
        if (this.hoveringCollidingTile && this.started) {
            this.targetColor = 'rgba(255, 50, 50, 0.5)';
        } else {
            this.targetColor = 'rgba(255, 255, 255, 0.5)';
        }

        if (this.hoveringMob && this.started) {
            this.setCursor('sword');
            this.hoveringTarget = false;
            this.targetCellVisible = false;
        } else if (this.hoveringNpc && this.started) {
            this.setCursor('talk');
            this.hoveringTarget = false;
            this.targetCellVisible = false;
        } else if ((this.hoveringItem || this.hoveringChest) && this.started) {
            this.setCursor('loot');
            this.hoveringTarget = false;
            this.targetCellVisible = true;
        } else {
            this.setCursor('hand');
            this.hoveringTarget = false;
            this.targetCellVisible = true;
        }
    }

    focusPlayer() {
        this.renderer.camera.lookAt(this.player);
    }

    addEntity(entity: GridIndexedEntity) {
        var self = this;

        if (this.entities[entity.id] === undefined) {
            this.entities[entity.id] = entity;
            this.registerEntityPosition(entity);

            if (!(entity instanceof Item && entity.wasDropped) && !(this.renderer.mobile || this.renderer.tablet)) {
                entity.fadeIn(this.currentTime);
            }

            if (this.renderer.mobile || this.renderer.tablet) {
                entity.on('dirty', function (e) {
                    if (self.camera.isVisible(e)) {
                        const dirtyRect: DirtyRect = self.renderer.getEntityBoundingRect(e);
                        e.dirtyRect = dirtyRect;
                        self.checkOtherDirtyRects(dirtyRect, e, e.gridX, e.gridY);
                    }
                });
            }
        } else {
            log.error('This entity already exists : ' + entity.id + ' (' + entity.kind + ')');
        }
    }

    removeEntity(entity: GridIndexedEntity) {
        if (entity.id in this.entities) {
            this.unregisterEntityPosition(entity);
            delete this.entities[entity.id];
        } else {
            log.error('Cannot remove entity. Unknown ID : ' + entity.id);
        }
    }

    addItem(item: Item, x: number, y: number) {
        item.setSprite(this.sprites[item.getSpriteName()]);
        item.setGridPosition(x, y);
        item.setAnimation('idle', 150);
        this.addEntity(item);
    }

    removeItem(item: Item | null) {
        if (item) {
            this.removeFromItemGrid(item, item.gridX, item.gridY);
            this.removeFromRenderingGrid(item, item.gridX, item.gridY);
            delete this.entities[item.id];
        } else {
            log.error('Cannot remove item. Unknown ID : ' + item.id);
        }
    }

    initPathingGrid() {
        this.pathingGrid = [];
        for (var i = 0; i < this.map.height; i += 1) {
            this.pathingGrid[i] = [];
            for (var j = 0; j < this.map.width; j += 1) {
                this.pathingGrid[i][j] = this.map.grid[i][j];
            }
        }
        log.info('Initialized the pathing grid with static colliding cells.');
    }

    initEntityGrid() {
        this.entityGrid = [];
        for (var i = 0; i < this.map.height; i += 1) {
            this.entityGrid[i] = [];
            for (var j = 0; j < this.map.width; j += 1) {
                this.entityGrid[i][j] = {};
            }
        }
        log.info('Initialized the entity grid.');
    }

    initRenderingGrid() {
        this.renderingGrid = [];
        for (var i = 0; i < this.map.height; i += 1) {
            this.renderingGrid[i] = [];
            for (var j = 0; j < this.map.width; j += 1) {
                this.renderingGrid[i][j] = {};
            }
        }
        log.info('Initialized the rendering grid.');
    }

    initItemGrid() {
        this.itemGrid = [];
        for (var i = 0; i < this.map.height; i += 1) {
            this.itemGrid[i] = [];
            for (var j = 0; j < this.map.width; j += 1) {
                this.itemGrid[i][j] = {};
            }
        }
        log.info('Initialized the item grid.');
    }

    /**
     *
     */
    initAnimatedTiles() {
        var self = this,
            m = this.map;

        this.animatedTiles = [];
        this.forEachVisibleTile(function (id, index) {
            if (m.isAnimatedTile(id)) {
                var tile = new AnimatedTile(id, m.getTileAnimationLength(id), m.getTileAnimationDelay(id), index),
                    pos = self.map.tileIndexToGridPosition(tile.index);

                tile.x = pos.x;
                tile.y = pos.y;
                self.animatedTiles.push(tile);
            }
        }, 1);
        //log.info("Initialized animated tiles.");
    }

    addToRenderingGrid(entity: GridIndexedEntity, x: number, y: number) {
        if (!this.map.isOutOfBounds(x, y)) {
            this.renderingGrid[y][x][entity.id] = entity;
        }
    }

    removeFromRenderingGrid(entity: GridIndexedEntity | null, x: number, y: number) {
        if (entity && this.renderingGrid[y][x] && entity.id in this.renderingGrid[y][x]) {
            delete this.renderingGrid[y][x][entity.id];
        }
    }

    removeFromEntityGrid(entity: GridIndexedEntity, x: number, y: number) {
        if (this.entityGrid[y][x][entity.id]) {
            delete this.entityGrid[y][x][entity.id];
        }
    }

    removeFromItemGrid(item: Item | null, x: number, y: number) {
        if (item && this.itemGrid[y][x][item.id]) {
            delete this.itemGrid[y][x][item.id];
        }
    }

    removeFromPathingGrid(x: number, y: number) {
        this.pathingGrid[y][x] = 0;
    }

    /**
     * Registers the entity at two adjacent positions on the grid at the same time.
     * This situation is temporary and should only occur when the entity is moving.
     * This is useful for the hit testing algorithm used when hovering entities with the mouse cursor.
     *
     * @param {Character} entity The moving entity
     */
    registerEntityDualPosition(entity: GridIndexedEntity) {
        if (entity) {
            this.entityGrid[entity.gridY][entity.gridX][entity.id] = entity;

            this.addToRenderingGrid(entity, entity.gridX, entity.gridY);

            if (
                entity.nextGridX !== undefined &&
                entity.nextGridY !== undefined &&
                entity.nextGridX >= 0 &&
                entity.nextGridY >= 0
            ) {
                this.entityGrid[entity.nextGridY][entity.nextGridX][entity.id] = entity;
                if (!(entity instanceof Player)) {
                    this.pathingGrid[entity.nextGridY][entity.nextGridX] = 1;
                }
            }
        }
    }

    /**
     * Clears the position(s) of this entity in the entity grid.
     *
     * @param {Character} entity The moving entity
     */
    unregisterEntityPosition(entity: GridIndexedEntity) {
        if (entity) {
            this.removeFromEntityGrid(entity, entity.gridX, entity.gridY);
            this.removeFromPathingGrid(entity.gridX, entity.gridY);

            this.removeFromRenderingGrid(entity, entity.gridX, entity.gridY);

            if (
                entity.nextGridX !== undefined &&
                entity.nextGridY !== undefined &&
                entity.nextGridX >= 0 &&
                entity.nextGridY >= 0
            ) {
                this.removeFromEntityGrid(entity, entity.nextGridX, entity.nextGridY);
                this.removeFromPathingGrid(entity.nextGridX, entity.nextGridY);
            }
        }
    }

    registerEntityPosition(entity: GridIndexedEntity) {
        var x = entity.gridX,
            y = entity.gridY;

        if (entity) {
            if (entity instanceof Character || entity instanceof Chest) {
                this.entityGrid[y][x][entity.id] = entity;
                if (!(entity instanceof Player)) {
                    this.pathingGrid[y][x] = 1;
                }
            }
            if (entity instanceof Item) {
                this.itemGrid[y][x][entity.id] = entity;
            }

            this.addToRenderingGrid(entity, x, y);
        }
    }

    setServerOptions(host: string, port: number, username: string) {
        this.host = host;
        this.port = port;
        this.username = username;
    }

    loadAudio() {
        this.audioManager = new AudioManager(this);
    }

    initMusicAreas() {
        var self = this;
        this.map.musicAreas.forEach(function (area) {
            self.audioManager.addArea(area.x, area.y, area.w, area.h, area.id);
        });
    }

    run(started_callback: () => void) {
        var self = this;

        this.loadSprites();
        this.setUpdater(new Updater(this));
        this.camera = this.renderer.camera;

        this.setSpriteScale(this.renderer.scale);

        var wait = setInterval(function () {
            if (self.map.isLoaded && self.spritesLoaded()) {
                self.ready = true;
                log.debug('All sprites loaded.');

                self.loadAudio();

                self.initMusicAreas();
                self.initAchievements();
                self.initCursors();
                self.initAnimations();
                self.initShadows();
                self.initHurtSprites();

                if (!self.renderer.mobile && !self.renderer.tablet && self.renderer.upscaledRendering) {
                    self.initSilhouettes();
                }

                self.initEntityGrid();
                self.initItemGrid();
                self.initPathingGrid();
                self.initRenderingGrid();

                self.setPathfinder(new Pathfinder(self.map.width, self.map.height));

                self.initPlayer();
                self.setCursor('hand');

                self.connect(started_callback);

                clearInterval(wait);
            }
        }, 100);
    }

    tick() {
        this.currentTime = new Date().getTime();

        if (this.started) {
            this.updateCursorLogic();
            this.updater?.update();
            this.renderer?.renderFrame();
        }

        if (!this.isStopped) {
            requestAnimFrame(this.tick.bind(this));
        }
    }

    start() {
        this.tick();
        this.hasNeverStarted = false;
        log.info('Game loop started.');
    }

    stop() {
        log.info('Game stopped.');
        this.isStopped = true;
    }

    entityIdExists(id: EntityId): boolean {
        return id in this.entities;
    }

    getEntityById(id: EntityId): GridIndexedEntity | undefined {
        if (id in this.entities) {
            return this.entities[id];
        } else {
            log.error('Unknown entity id : ' + id, true);
        }
    }

    connect(started_callback: () => void) {
        initializeGameSessionConnection(this, started_callback);
    }

    /**
     * Links two entities in an attacker<-->target relationship.
     * This is just a utility method to wrap a set of instructions.
     *
     * @param {Character} attacker The attacker entity
     * @param {Character} target The target entity
     */
    createAttackLink(attacker: Character, target: Character) {
        if (attacker.hasTarget()) {
            attacker.removeTarget();
        }
        attacker.engage(target);

        if (attacker.id !== this.playerId) {
            target.addAttacker(attacker);
        }
    }

    /**
     * Sends a "hello" message to the server, as a way of initiating the player connection handshake.
     * @see GameClient.sendHello
     */
    sendHello() {
        this.client.sendHello(this.player);
    }

    /**
     * Converts the current mouse position on the screen to world grid coordinates.
     * @returns {Object} An object containing x and y properties.
     */
    getMouseGridPosition(): { x: number; y: number } {
        var mx = this.mouse.x,
            my = this.mouse.y,
            c = this.renderer.camera,
            s = this.renderer.scale,
            ts = this.renderer.tilesize,
            offsetX = mx % (ts * s),
            offsetY = my % (ts * s),
            x = (mx - offsetX) / (ts * s) + c.gridX,
            y = (my - offsetY) / (ts * s) + c.gridY;

        return { x: x, y: y };
    }

    /**
     * Moves a character to a given location on the world grid.
     *
     * @param {Number} x The x coordinate of the target location.
     * @param {Number} y The y coordinate of the target location.
     */
    makeCharacterGoTo(character: Character, x: number, y: number) {
        if (!this.map.isOutOfBounds(x, y)) {
            character.go(x, y);
        }
    }

    /**
     *
     */
    makeCharacterTeleportTo(character: Character, x: number, y: number) {
        if (!this.map.isOutOfBounds(x, y)) {
            this.unregisterEntityPosition(character);

            character.setGridPosition(x, y);

            this.registerEntityPosition(character);
            this.assignBubbleTo(character);
        } else {
            log.debug('Teleport out of bounds: ' + x + ', ' + y);
        }
    }

    /**
     * Moves the current player to a given target location.
     * @see makeCharacterGoTo
     */
    makePlayerGoTo(x: number, y: number) {
        this.makeCharacterGoTo(this.player, x, y);
    }

    /**
     * Moves the current player towards a specific item.
     * @see makeCharacterGoTo
     */
    makePlayerGoToItem(item: Item | null) {
        if (item) {
            this.player.isLootMoving = true;
            this.makePlayerGoTo(item.gridX, item.gridY);
            this.client.sendLootMove(item, item.gridX, item.gridY);
        }
    }

    /**
     *
     */
    makePlayerTalkTo(npc: Npc | null) {
        if (npc) {
            this.player.setTarget(npc);
            this.player.follow(npc);
        }
    }

    makePlayerOpenChest(chest: Chest | null) {
        if (chest) {
            this.player.setTarget(chest);
            this.player.follow(chest);
        }
    }

    /**
     *
     */
    makePlayerAttack(mob: Mob) {
        this.createAttackLink(this.player, mob);
        this.client.sendAttack(mob);
    }

    /**
     *
     */
    makeNpcTalk(npc: Npc | null) {
        var msg;

        if (npc) {
            msg = npc.talk();
            this.previousClickPosition = {};
            if (msg) {
                this.createBubble(npc.id, msg);
                this.assignBubbleTo(npc);
                this.audioManager.playSound('npc');
            } else {
                this.destroyBubble(npc.id);
                this.audioManager.playSound('npc-end');
            }
            this.tryUnlockingAchievement('SMALL_TALK');

            if (npc.kind === Types.Entities.RICK) {
                this.tryUnlockingAchievement('RICKROLLD');
            }
        }
    }

    /**
     * Loops through all the entities currently present in the game.
     * @param {Function} callback The function to call back (must accept one entity argument).
     */
    forEachEntity(callback: (entity: GridIndexedEntity) => void) {
        Object.keys(this.entities).forEach(function (id) {
            callback(this.entities[id]);
        }, this);
    }

    /**
     * Same as forEachEntity but only for instances of the Mob subclass.
     * @see forEachEntity
     */
    forEachMob(callback: (mob: Mob) => void) {
        Object.keys(this.entities).forEach(function (id) {
            var entity = this.entities[id];
            if (entity instanceof Mob) {
                callback(entity);
            }
        }, this);
    }

    /**
     * Loops through all entities visible by the camera and sorted by depth :
     * Lower 'y' value means higher depth.
     * Note: This is used by the Renderer to know in which order to render entities.
     */
    forEachVisibleEntityByDepth(callback: (entity: GridIndexedEntity) => void) {
        var self = this,
            m = this.map;

        this.camera.forEachVisiblePosition(
            function (x, y) {
                if (!m.isOutOfBounds(x, y)) {
                    if (self.renderingGrid[y][x]) {
                        var entities = self.renderingGrid[y][x];
                        Object.keys(entities).forEach(function (id) {
                            callback(entities[id]);
                        });
                    }
                }
            },
            this.renderer.mobile ? 0 : 2
        );
    }

    /**
     *
     */
    forEachVisibleTileIndex(callback: (tileIndex: number) => void, extra: number) {
        var m = this.map;

        this.camera.forEachVisiblePosition(function (x, y) {
            if (!m.isOutOfBounds(x, y)) {
                callback(m.GridPositionToTileIndex(x, y) - 1);
            }
        }, extra);
    }

    /**
     *
     */
    forEachVisibleTile(callback: (tileId: number, tileIndex: number) => void, extra: number) {
        var self = this,
            m = this.map;

        if (m.isLoaded) {
            this.forEachVisibleTileIndex(function (tileIndex) {
                if (Array.isArray(m.data[tileIndex])) {
                    m.data[tileIndex].forEach(function (id) {
                        callback(id - 1, tileIndex);
                    });
                } else {
                    if (Number.isNaN(m.data[tileIndex] - 1)) {
                        //throw Error("Tile number for index:"+tileIndex+" is NaN");
                    } else {
                        callback(m.data[tileIndex] - 1, tileIndex);
                    }
                }
            }, extra);
        }
    }

    /**
     *
     */
    forEachAnimatedTile(callback: (tile: DirtyAnimatedTile) => void) {
        if (this.animatedTiles) {
            this.animatedTiles.forEach(function (tile) {
                callback(tile);
            });
        }
    }

    /**
     * Returns the entity located at the given position on the world grid.
     * @returns {import('./entity').default | null} the entity located at (x, y) or null if there is none.
     */
    getEntityAt(x: number, y: number): GridIndexedEntity | null {
        if (this.map.isOutOfBounds(x, y) || !this.entityGrid) {
            return null;
        }

        var entities = this.entityGrid[y][x],
            entity = null;
        if (entities && Object.keys(entities).length > 0) {
            entity = entities[Object.keys(entities)[0]];
        } else {
            entity = this.getItemAt(x, y);
        }
        return entity;
    }

    getMobAt(x: number, y: number): Mob | null {
        var entity = this.getEntityAt(x, y);
        if (entity && entity instanceof Mob) {
            return entity;
        }
        return null;
    }

    getNpcAt(x: number, y: number): Npc | null {
        var entity = this.getEntityAt(x, y);
        if (entity && entity instanceof Npc) {
            return entity;
        }
        return null;
    }

    getChestAt(x: number, y: number): Chest | null {
        var entity = this.getEntityAt(x, y);
        if (entity && entity instanceof Chest) {
            return entity;
        }
        return null;
    }

    getItemAt(x: number, y: number): Item | null {
        if (this.map.isOutOfBounds(x, y) || !this.itemGrid) {
            return null;
        }
        var items = this.itemGrid[y][x],
            item = null;

        if (items && Object.keys(items).length > 0) {
            // If there are potions/burgers stacked with equipment items on the same tile, always get expendable items first.
            Object.keys(items).forEach(function (id) {
                var i = items[id];
                if (Types.isExpendableItem(i.kind)) {
                    item = i;
                }
            });

            // Else, get the first item of the stack
            if (!item) {
                item = items[Object.keys(items)[0]];
            }
        }
        return item;
    }

    /**
     * Returns true if an entity is located at the given position on the world grid.
     * @returns {Boolean} Whether an entity is at (x, y).
     */
    isEntityAt(x: number, y: number): boolean {
        return this.getEntityAt(x, y) !== null;
    }

    isMobAt(x: number, y: number): boolean {
        return this.getMobAt(x, y) !== null;
    }

    isItemAt(x: number, y: number): boolean {
        return this.getItemAt(x, y) !== null;
    }

    isNpcAt(x: number, y: number): boolean {
        return this.getNpcAt(x, y) !== null;
    }

    isChestAt(x: number, y: number): boolean {
        return this.getChestAt(x, y) !== null;
    }

    /**
     * Finds a path to a grid position for the specified character.
     * The path will pass through any entity present in the ignore list.
     */
    findPath(character: Character, x: number, y: number, ignoreList?: GridIndexedEntity[]) {
        var self = this,
            grid = this.pathingGrid,
            path: GridPath = [];

        if (this.map.isColliding(x, y)) {
            return path;
        }

        if (this.pathfinder && character) {
            if (ignoreList) {
                ignoreList.forEach(function (entity) {
                    self.pathfinder.ignoreEntity(entity);
                });
            }

            path = this.pathfinder.findPath(grid, character, x, y, false);

            if (ignoreList) {
                this.pathfinder.clearIgnoreList();
            }
        } else {
            log.error('Error while finding the path to ' + x + ', ' + y + ' for ' + character.id);
        }
        return path;
    }

    /**
     * Toggles the visibility of the pathing grid for debugging purposes.
     */
    togglePathingGrid() {
        if (this.debugPathing) {
            this.debugPathing = false;
        } else {
            this.debugPathing = true;
        }
    }

    /**
     * Toggles the visibility of the FPS counter and other debugging info.
     */
    toggleDebugInfo() {
        if (this.renderer && this.renderer.isDebugInfoVisible) {
            this.renderer.isDebugInfoVisible = false;
        } else {
            this.renderer.isDebugInfoVisible = true;
        }
    }

    /**
     *
     */
    movecursor() {
        var mouse = this.getMouseGridPosition(),
            x = mouse.x,
            y = mouse.y;

        if (this.player && !this.renderer.mobile && !this.renderer.tablet) {
            this.hoveringCollidingTile = this.map.isColliding(x, y);
            this.hoveringPlateauTile = this.player.isOnPlateau ? !this.map.isPlateau(x, y) : this.map.isPlateau(x, y);
            this.hoveringMob = this.isMobAt(x, y);
            this.hoveringItem = this.isItemAt(x, y);
            this.hoveringNpc = this.isNpcAt(x, y);
            this.hoveringChest = this.isChestAt(x, y);

            if (this.hoveringMob || this.hoveringNpc || this.hoveringChest) {
                var entity = this.getEntityAt(x, y);

                if (
                    entity &&
                    isHighlightableEntity(entity) &&
                    !entity.isHighlighted &&
                    this.renderer.supportsSilhouettes
                ) {
                    if (this.lastHovered) {
                        this.lastHovered.setHighlight(false);
                    }
                    this.lastHovered = entity;
                    entity.setHighlight(true);
                }
            } else if (this.lastHovered) {
                this.lastHovered.setHighlight(false);
                this.lastHovered = null;
            }
        }
    }

    /**
     * Processes game logic when the user triggers a click/touch event during the game.
     */
    click() {
        var pos = this.getMouseGridPosition(),
            entity;

        if (pos.x === this.previousClickPosition.x && pos.y === this.previousClickPosition.y) {
            return;
        } else {
            this.previousClickPosition = pos;
        }

        if (
            this.started &&
            this.player &&
            !this.isZoning() &&
            !this.isZoningTile(this.player.nextGridX, this.player.nextGridY) &&
            !this.player.isDead &&
            !this.hoveringCollidingTile &&
            !this.hoveringPlateauTile
        ) {
            entity = this.getEntityAt(pos.x, pos.y);

            if (entity instanceof Mob) {
                this.makePlayerAttack(entity);
            } else if (entity instanceof Item) {
                this.makePlayerGoToItem(entity);
            } else if (entity instanceof Npc) {
                if (this.player.isAdjacentNonDiagonal(entity) === false) {
                    this.makePlayerTalkTo(entity);
                } else {
                    this.makeNpcTalk(entity);
                }
            } else if (entity instanceof Chest) {
                this.makePlayerOpenChest(entity);
            } else {
                this.makePlayerGoTo(pos.x, pos.y);
            }
        }
    }

    isMobOnSameTile(mob: Character, x?: number, y?: number): boolean {
        var X = x || mob.gridX,
            Y = y || mob.gridY,
            list = this.entityGrid[Y][X],
            result = false;

        if (!list) {
            return false;
        }

        Object.keys(list).forEach(function (id) {
            var entity = list[id];
            if (entity instanceof Mob && entity.id !== mob.id) {
                result = true;
            }
        });
        return result;
    }

    getFreeAdjacentNonDiagonalPosition(entity: Character): { x: number; y: number; o: number } | null {
        var self = this,
            result = null;

        entity.forEachAdjacentNonDiagonalPosition(function (x, y, orientation) {
            if (!result && !self.map.isColliding(x, y) && !self.isMobAt(x, y)) {
                result = { x: x, y: y, o: orientation };
            }
        });
        return result;
    }

    tryMovingToADifferentTile(character: Character): boolean {
        var attacker = character,
            target = character.target;

        if (attacker && target && target instanceof Player) {
            if (!target.isMoving() && attacker.getDistanceToEntity(target) === 0) {
                var pos;

                switch (target.orientation) {
                    case Types.Orientations.UP:
                        pos = { x: target.gridX, y: target.gridY - 1, o: target.orientation };
                        break;
                    case Types.Orientations.DOWN:
                        pos = { x: target.gridX, y: target.gridY + 1, o: target.orientation };
                        break;
                    case Types.Orientations.LEFT:
                        pos = { x: target.gridX - 1, y: target.gridY, o: target.orientation };
                        break;
                    case Types.Orientations.RIGHT:
                        pos = { x: target.gridX + 1, y: target.gridY, o: target.orientation };
                        break;
                }

                if (pos) {
                    attacker.previousTarget = target;
                    attacker.disengage();
                    attacker.idle();
                    this.makeCharacterGoTo(attacker, pos.x, pos.y);
                    target.adjacentTiles[pos.o] = true;

                    return true;
                }
            }

            if (!target.isMoving() && attacker.isAdjacentNonDiagonal(target) && this.isMobOnSameTile(attacker)) {
                pos = this.getFreeAdjacentNonDiagonalPosition(target);

                // avoid stacking mobs on the same tile next to a player
                // by making them go to adjacent tiles if they are available
                if (pos && !target.adjacentTiles[pos.o]) {
                    if (this.player.target && attacker.id === this.player.target.id) {
                        return false; // never unstack the player's target
                    }

                    attacker.previousTarget = target;
                    attacker.disengage();
                    attacker.idle();
                    this.makeCharacterGoTo(attacker, pos.x, pos.y);
                    target.adjacentTiles[pos.o] = true;

                    return true;
                }
            }
        }
        return false;
    }

    /**
     *
     */
    onCharacterUpdate(character: Character) {
        var time = this.currentTime,
            self = this;

        // If mob has finished moving to a different tile in order to avoid stacking, attack again from the new position.
        if (character.previousTarget && !character.isMoving() && character instanceof Mob) {
            var t = character.previousTarget;

            if (t instanceof Character && this.getEntityById(t.id)) {
                // does it still exist?
                character.previousTarget = null;
                this.createAttackLink(character, t);
                return;
            }
        }

        if (character.isAttacking() && !character.previousTarget) {
            var isMoving = this.tryMovingToADifferentTile(character); // Don't let multiple mobs stack on the same tile when attacking a player.

            if (character.canAttack(time)) {
                if (!isMoving) {
                    // don't hit target if moving to a different tile.
                    if (
                        character.hasTarget() &&
                        character.getOrientationTo(character.target) !== character.orientation
                    ) {
                        character.lookAtTarget();
                    }

                    character.hit();

                    if (character.id === this.playerId) {
                        this.client.sendHit(character.target);
                    }

                    if (character instanceof Player && this.camera.isVisible(character)) {
                        const hitSound: AudioSoundKey = Math.floor(Math.random() * 2 + 1) === 1 ? 'hit1' : 'hit2';
                        this.audioManager.playSound(hitSound);
                    }

                    if (
                        character.hasTarget() &&
                        character.target.id === this.playerId &&
                        this.player &&
                        !this.player.invincible
                    ) {
                        this.client.sendHurt(character);
                    }
                }
            } else {
                if (
                    character.hasTarget() &&
                    character.isDiagonallyAdjacent(character.target) &&
                    character.target instanceof Player &&
                    !character.target.isMoving()
                ) {
                    character.follow(character.target);
                }
            }
        }
    }

    /**
     *
     */
    isZoningTile(x: number, y: number): boolean {
        var c = this.camera;

        x = x - c.gridX;
        y = y - c.gridY;

        if (x === 0 || y === 0 || x === c.gridW - 1 || y === c.gridH - 1) {
            return true;
        }
        return false;
    }

    /**
     *
     */
    getZoningOrientation(x: number, y: number): number {
        var orientation = Types.Orientations.DOWN,
            c = this.camera;

        x = x - c.gridX;
        y = y - c.gridY;

        if (x === 0) {
            orientation = Types.Orientations.LEFT;
        } else if (y === 0) {
            orientation = Types.Orientations.UP;
        } else if (x === c.gridW - 1) {
            orientation = Types.Orientations.RIGHT;
        } else if (y === c.gridH - 1) {
            orientation = Types.Orientations.DOWN;
        }

        return orientation;
    }

    startZoningFrom(x: number, y: number) {
        this.zoningOrientation = this.getZoningOrientation(x, y);

        if (this.renderer.mobile || this.renderer.tablet) {
            var z = this.zoningOrientation,
                c = this.camera,
                ts = this.renderer.tilesize,
                nextX = c.x,
                nextY = c.y,
                xoffset = (c.gridW - 2) * ts,
                yoffset = (c.gridH - 2) * ts;

            if (z === Types.Orientations.LEFT || z === Types.Orientations.RIGHT) {
                nextX = z === Types.Orientations.LEFT ? c.x - xoffset : c.x + xoffset;
            } else if (z === Types.Orientations.UP || z === Types.Orientations.DOWN) {
                nextY = z === Types.Orientations.UP ? c.y - yoffset : c.y + yoffset;
            }
            c.setPosition(nextX, nextY);

            this.renderer.clearScreen(this.renderer.context);
            this.endZoning();

            // Force immediate drawing of all visible entities in the new zone
            this.forEachVisibleEntityByDepth(function (entity) {
                entity.setDirty();
            });
        } else {
            this.currentZoning = new Transition();
        }
        this.bubbleManager.clean();
        this.client.sendZone();
    }

    enqueueZoningFrom(x: number, y: number) {
        this.zoningQueue.push({ x: x, y: y });

        if (this.zoningQueue.length === 1) {
            this.startZoningFrom(x, y);
        }
    }

    endZoning() {
        this.currentZoning = null;
        this.resetZone();
        this.zoningQueue.shift();

        if (this.zoningQueue.length > 0) {
            var pos = this.zoningQueue[0];
            this.startZoningFrom(pos.x, pos.y);
        }
    }

    isZoning(): boolean {
        return this.currentZoning !== null;
    }

    resetZone() {
        this.bubbleManager.clean();
        this.initAnimatedTiles();
        this.renderer.renderStaticCanvases();
    }

    resetCamera() {
        this.camera.focusEntity(this.player);
        this.resetZone();
    }

    say(message: string) {
        this.client.sendChat(message);
    }

    createBubble(id: EntityId, message: string) {
        this.bubbleManager.create(String(id), message, this.currentTime);
    }

    destroyBubble(id: EntityId) {
        this.bubbleManager.destroyBubble(String(id));
    }

    assignBubbleTo(character: BubbleAnchor) {
        var bubble = this.bubbleManager.getBubbleById(String(character.id));

        if (bubble && bubble.element) {
            var s = this.renderer.scale,
                t = 16 * s, // tile size
                x = (character.x - this.camera.x) * s,
                w = (bubble.element.offsetWidth || 0) + 24,
                offset = w / 2 - t / 2,
                offsetY,
                y;

            if (character instanceof Npc) {
                offsetY = 0;
            } else {
                if (s === 2) {
                    if (this.renderer.mobile) {
                        offsetY = 0;
                    } else {
                        offsetY = 15;
                    }
                } else {
                    offsetY = 12;
                }
            }

            y = (character.y - this.camera.y) * s - t * 2 - offsetY;

            bubble.element.style.left = x - offset + 'px';
            bubble.element.style.top = y + 'px';
        }
    }

    restart() {
        log.debug('Beginning restart');

        this.entities = {};
        this.initEntityGrid();
        this.initPathingGrid();
        this.initRenderingGrid();

        this.player = new Warrior('player', this.username);
        this.initPlayer();

        this.started = true;
        this.client.enable();
        this.sendHello();

        this.storage.incrementRevives();

        if (this.renderer.mobile || this.renderer.tablet) {
            this.renderer.clearScreen(this.renderer.context);
        }

        log.debug('Finished restart');
    }

    onGameStart(callback: () => void) {
        this.on('gameStart', callback);
    }

    onDisconnect(callback: (message: string) => void) {
        this.on('disconnect', callback);
    }

    onPlayerDeath(callback: () => void) {
        this.on('playerDeath', callback);
    }

    onPlayerHealthChange(callback: (hp: number, maxHp: number) => void) {
        this.on('playerHealthChange', callback);
    }

    onPlayerHurt(callback: () => void) {
        this.on('playerHurt', callback);
    }

    onPlayerEquipmentChange(callback: () => void) {
        this.on('playerEquipmentChange', callback);
    }

    onNbPlayersChange(callback: (worldPlayers: number, totalPlayers: number) => void) {
        this.on('nbPlayersChange', callback);
    }

    onNotification(callback: (message: string) => void) {
        this.on('notification', callback);
    }

    onPlayerInvincible(callback: () => void) {
        this.on('playerInvincible', callback);
    }

    resize() {
        var x = this.camera.x,
            y = this.camera.y,
            currentScale = this.renderer.scale,
            newScale = this.renderer.getScaleFactor();

        this.renderer.rescale(newScale);
        this.camera = this.renderer.camera;
        this.camera.setPosition(x, y);

        this.renderer.renderStaticCanvases();
    }

    updateBars() {
        if (this.player) {
            this.emit('playerHealthChange', this.player.hitPoints, this.player.maxHitPoints);
        }
    }

    getDeadMobPosition(mobId: EntityId): GridPosition | undefined {
        var position: GridPosition | undefined;

        if (mobId in this.deathpositions) {
            position = this.deathpositions[mobId];
            delete this.deathpositions[mobId];
        }

        return position;
    }

    onAchievementUnlock(callback: (id: AchievementId, name: string, description: string) => void) {
        this.on('achievementUnlock', callback);
    }

    tryUnlockingAchievement(name: AchievementKey) {
        var achievement = null;
        if (name in this.achievements) {
            achievement = this.achievements[name];

            if (achievement.isCompleted() && this.storage.unlockAchievement(achievement.id)) {
                this.emit('achievementUnlock', achievement.id, achievement.name, achievement.desc);
                this.audioManager.playSound('achievement');
            }
        }
    }

    showNotification(message: string) {
        this.emit('notification', message);
    }

    removeObsoleteEntities() {
        var obsoleteEntities: GridIndexedEntity[] = this.obsoleteEntities || [],
            nb = obsoleteEntities.length,
            self = this;

        if (nb > 0) {
            obsoleteEntities.forEach(function (entity) {
                if (entity.id != self.player.id) {
                    // never remove yourself
                    self.removeEntity(entity);
                }
            });
            log.debug(
                'Removed ' +
                    nb +
                    ' entities: ' +
                    obsoleteEntities
                        .filter(function (entity) {
                            return entity.id !== self.player.id;
                        })
                        .map(function (entity) {
                            return entity.id;
                        })
            );
            this.obsoleteEntities = null;
        }
    }

    /**
     * Fake a mouse move event in order to update the cursor.
     *
     * For instance, to get rid of the sword cursor in case the mouse is still hovering over a dying mob.
     * Also useful when the mouse is hovering a tile where an item is appearing.
     */
    updateCursor() {
        this.movecursor();
        this.updateCursorLogic();
    }

    /**
     * Change player plateau mode when necessary
     */
    updatePlateauMode() {
        if (this.map.isPlateau(this.player.gridX, this.player.gridY)) {
            this.player.isOnPlateau = true;
        } else {
            this.player.isOnPlateau = false;
        }
    }

    updatePlayerCheckpoint() {
        var checkpoint = this.map.getCurrentCheckpoint(this.player);

        if (checkpoint) {
            var lastCheckpoint = this.player.lastCheckpoint;
            if (!lastCheckpoint || (lastCheckpoint && lastCheckpoint.id !== checkpoint.id)) {
                this.player.lastCheckpoint = checkpoint;
                this.client.sendCheck(checkpoint.id);
            }
        }
    }

    checkUndergroundAchievement() {
        var music = this.audioManager.getSurroundingMusic(this.player);

        if (music) {
            if (music.name === 'cave') {
                this.tryUnlockingAchievement('UNDERGROUND');
            }
        }
    }

    forEachEntityAround(x: number, y: number, r: number, callback: (entity: GridIndexedEntity) => void) {
        for (var i = x - r, max_i = x + r; i <= max_i; i += 1) {
            for (var j = y - r, max_j = y + r; j <= max_j; j += 1) {
                if (!this.map.isOutOfBounds(i, j)) {
                    var entities = this.renderingGrid[j][i];
                    if (entities) {
                        Object.keys(entities).forEach(function (id) {
                            callback(entities[id]);
                        });
                    }
                }
            }
        }
    }

    checkOtherDirtyRects(r1: DirtyRect, source: DirtyRectSource, x: number, y: number) {
        var r = this.renderer;

        this.forEachEntityAround(x, y, 2, function (e2) {
            if (source && 'id' in source && e2.id === source.id) {
                return;
            }
            if (!e2.isDirty) {
                var r2 = r.getEntityBoundingRect(e2);
                if (r.isIntersecting(r1, r2)) {
                    e2.setDirty();
                }
            }
        });

        if (source && !('index' in source)) {
            this.forEachAnimatedTile(function (tile) {
                if (!tile.isDirty) {
                    var r2 = r.getTileBoundingRect(tile);
                    if (r.isIntersecting(r1, r2)) {
                        tile.isDirty = true;
                    }
                }
            });
        }

        if (!this.drawTarget && this.selectedCellVisible) {
            var targetRect = r.getTargetBoundingRect();
            if (r.isIntersecting(r1, targetRect)) {
                this.drawTarget = true;
                this.renderer.targetRect = targetRect;
            }
        }
    }
}

export default Game;
