import InfoManager from './infomanager';
import BubbleManager from './bubble';
import Renderer from './renderer';
import Map from './map';
import type Animation from './animation';
import type Sprite from './sprite';
import { initializeGameSessionConnection } from './game-session/connect/initializer';
import { bootstrapGameRuntime } from './game-runtime-bootstrap';
import { initializeGameSpatialState } from './game-spatial-state';
import {
    makeNpcDialogue,
    makePlayerAttackMob,
    makePlayerOpenChest,
    makePlayerTalkToNpc,
    movePlayerToItem,
} from './game-player-interactions';
import { processPlayerClick, updatePlayerHoverState } from './game-player-input';
import {
    findFreeAdjacentNonDiagonalPosition,
    hasMobOnTile,
    tryMovingCharacterToDifferentTile,
} from './game-mob-positioning';
import {
    forEachAnimatedGameTile,
    forEachEntityByDepthInView,
    forEachGameEntity,
    forEachGameMob,
    forEachVisibleGameTile,
    forEachVisibleGameTileIndex,
} from './game-visibility-iterators';
import {
    areSpritesLoaded,
    loadSpriteForScale as loadSpriteForScaleRuntime,
    loadSpriteScale as loadSpriteScaleRuntime,
    loadSprites as loadSpritesRuntime,
    setSpriteScale as setSpriteScaleRuntime,
} from './game-sprite-runtime';
import {
    initGameAnimations,
    initGameCursors,
    initGameHurtSprites,
    initGameShadows,
    initGameSilhouettes,
} from './game-visual-runtime';
import {
    getChestAtPosition,
    getEntityAtPosition,
    getItemAtPosition,
    getMobAtPosition,
    getNpcAtPosition,
} from './game-entity-lookups';
import AnimatedTile from './tile';
import Warrior from './warrior';
import type GameClient from './gameclient';
import AudioManager from './audio';
import Updater from './updater';
import Transition from './transition';
import type Pathfinder from './pathfinder';
import type Camera from './camera';
import { createAchievementDefinitions } from './game-achievements';
import type { AchievementDefinition } from './game-achievements';
import Item from './item';
import Mob from './mob';
import Npc from './npc';
import Player from './player';
import Character from './character';
import Chest from './chest';
import config from './config';
import log from './platform/log';
import Types from '../shared/gametypes-browser';
import type { EntityKind } from '../shared/entity-kind-domain';
import { requestAnimFrame } from './platform/util';
import type { AchievementId, AchievementKey } from './achievement-domain';
import { SPRITE_KEYS } from './asset-key-domain';
import type { AudioSoundKey, CursorKey, MusicKey, SpriteKey } from './asset-key-domain';
import type Storage from './storage';
import { Evented } from '../shared/evented';
import type { TypedEventSource } from '../shared/typed-event-emitter';

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
type RuntimeServerConfig = { host: string; port: number; dispatcher: boolean };
type AppLike = {
    config: { server?: RuntimeServerConfig } | null;
    initAchievementList(achievements: Record<string, AchievementDefinition>): void;
    initUnlockedAchievements(unlocked: AchievementId[]): void;
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
    currentCursorOrientation?: number | null;
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
    lastHovered: GridIndexedEntity | null;

    constructor(
        app: AppLike,
        bubbleContainer: string | Element | null,
        canvas: HTMLCanvasElement,
        background: HTMLCanvasElement,
        foreground: HTMLCanvasElement,
        input: HTMLInputElement
    ) {
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

        this.setBubbleManager(new BubbleManager(bubbleContainer));
        this.setRenderer(new Renderer(this, canvas, background, foreground));
        this.setChatInput(input);
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

    setStorage(storage: Storage): void {
        this.storage = storage;
    }

    setRenderer(renderer: Renderer): void {
        this.renderer = renderer;
    }

    setUpdater(updater: Updater): void {
        this.updater = updater;
    }

    setPathfinder(pathfinder: Pathfinder): void {
        this.pathfinder = pathfinder;
    }

    setChatInput(element: HTMLInputElement): void {
        this.chatinput = element;
    }

    setBubbleManager(bubbleManager: BubbleManager): void {
        this.bubbleManager = bubbleManager;
    }

    loadMap(): void {
        const self = this;

        this.map = new Map(!this.renderer.upscaledRendering, this);

        this.map.ready(function () {
            log.info('Map loaded.');
            const tilesetIndex = self.renderer.upscaledRendering ? 0 : self.renderer.scale - 1;
            self.renderer.setTileset(self.map.tilesets[tilesetIndex]);
        });
    }

    initPlayer(): void {
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

    initShadows(): void {
        initGameShadows(this);
    }

    initCursors(): void {
        initGameCursors(this);
    }

    initAnimations(): void {
        initGameAnimations(this);
    }

    initHurtSprites(): void {
        initGameHurtSprites(this);
    }

    initSilhouettes(): void {
        initGameSilhouettes(this);
    }

    initAchievements(): void {
        this.achievements = createAchievementDefinitions(this.storage);

        this.app.initAchievementList(this.achievements);

        if (this.storage.hasAlreadyPlayed()) {
            this.app.initUnlockedAchievements(this.storage.data.achievements.unlocked);
        }
    }

    getAchievementById(id: string | number): AchievementDefinition | null {
        let found: AchievementDefinition | null = null;
        Object.keys(this.achievements).forEach(function (key: string) {
            const achievement = this.achievements[key];
            if (achievement.id === parseInt(String(id), 10)) {
                found = achievement;
            }
        }, this);
        return found;
    }

    loadSpriteForScale(name: SpriteKey, scale: number): void {
        loadSpriteForScaleRuntime(this, name, scale);
    }

    loadSpriteScale(scale: number): void {
        loadSpriteScaleRuntime(this, scale);
    }

    setSpriteScale(scale: number): void {
        setSpriteScaleRuntime(this, scale);
    }

    loadSprites(): void {
        log.info('Loading sprites...');
        loadSpritesRuntime(this);
    }

    spritesLoaded(): boolean {
        return areSpritesLoaded(this);
    }

    setCursor(name: CursorKey, orientation?: number): void {
        if (name in this.cursors) {
            this.currentCursor = this.cursors[name];
            this.currentCursorOrientation = orientation;
        } else {
            log.error('Unknown cursor name :' + name);
        }
    }

    updateCursorLogic(): void {
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

    focusPlayer(): void {
        this.renderer.camera.lookAt(this.player);
    }

    addEntity(entity: GridIndexedEntity): void {
        const self = this;

        if (this.entities[entity.id] === undefined) {
            this.entities[entity.id] = entity;
            this.registerEntityPosition(entity);

            if (!(entity instanceof Item && entity.wasDropped) && !(this.renderer.mobile || this.renderer.tablet)) {
                entity.fadeIn(this.currentTime);
            }

            if (this.renderer.mobile || this.renderer.tablet) {
                entity.on('dirty', function (e: GridIndexedEntity) {
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

    removeEntity(entity: GridIndexedEntity): void {
        if (entity.id in this.entities) {
            this.unregisterEntityPosition(entity);
            delete this.entities[entity.id];
        } else {
            log.error('Cannot remove entity. Unknown ID : ' + entity.id);
        }
    }

    addItem(item: Item, x: number, y: number): void {
        item.setSprite(this.sprites[item.getSpriteName()]);
        item.setGridPosition(x, y);
        item.setAnimation('idle', 150);
        this.addEntity(item);
    }

    removeItem(item: Item | null): void {
        if (item) {
            this.removeFromItemGrid(item, item.gridX, item.gridY);
            this.removeFromRenderingGrid(item, item.gridX, item.gridY);
            delete this.entities[item.id];
        } else {
            log.error('Cannot remove item. Unknown ID : ' + item.id);
        }
    }

    initPathingGrid(): void {
        this.pathingGrid = [];
        for (let i = 0; i < this.map.height; i += 1) {
            this.pathingGrid[i] = [];
            for (let j = 0; j < this.map.width; j += 1) {
                this.pathingGrid[i][j] = this.map.grid[i][j];
            }
        }
        log.info('Initialized the pathing grid with static colliding cells.');
    }

    initEntityGrid(): void {
        this.entityGrid = [];
        for (let i = 0; i < this.map.height; i += 1) {
            this.entityGrid[i] = [];
            for (let j = 0; j < this.map.width; j += 1) {
                this.entityGrid[i][j] = {};
            }
        }
        log.info('Initialized the entity grid.');
    }

    initRenderingGrid(): void {
        this.renderingGrid = [];
        for (let i = 0; i < this.map.height; i += 1) {
            this.renderingGrid[i] = [];
            for (let j = 0; j < this.map.width; j += 1) {
                this.renderingGrid[i][j] = {};
            }
        }
        log.info('Initialized the rendering grid.');
    }

    initItemGrid(): void {
        this.itemGrid = [];
        for (let i = 0; i < this.map.height; i += 1) {
            this.itemGrid[i] = [];
            for (let j = 0; j < this.map.width; j += 1) {
                this.itemGrid[i][j] = {};
            }
        }
        log.info('Initialized the item grid.');
    }

    /**
     *
     */
    initAnimatedTiles(): void {
        const self = this,
            m = this.map;

        this.animatedTiles = [];
        this.forEachVisibleTile(function (id: number, index: number) {
            if (m.isAnimatedTile(id)) {
                const tile = new AnimatedTile(id, m.getTileAnimationLength(id), m.getTileAnimationDelay(id), index),
                    pos = self.map.tileIndexToGridPosition(tile.index);

                tile.x = pos.x;
                tile.y = pos.y;
                self.animatedTiles.push(tile);
            }
        }, 1);
        //log.info("Initialized animated tiles.");
    }

    addToRenderingGrid(entity: GridIndexedEntity, x: number, y: number): void {
        if (!this.map.isOutOfBounds(x, y)) {
            this.renderingGrid[y][x][entity.id] = entity;
        }
    }

    removeFromRenderingGrid(entity: GridIndexedEntity | null, x: number, y: number): void {
        if (entity && this.renderingGrid[y][x] && entity.id in this.renderingGrid[y][x]) {
            delete this.renderingGrid[y][x][entity.id];
        }
    }

    removeFromEntityGrid(entity: GridIndexedEntity, x: number, y: number): void {
        if (this.entityGrid[y][x][entity.id]) {
            delete this.entityGrid[y][x][entity.id];
        }
    }

    removeFromItemGrid(item: Item | null, x: number, y: number): void {
        if (item && this.itemGrid[y][x][item.id]) {
            delete this.itemGrid[y][x][item.id];
        }
    }

    removeFromPathingGrid(x: number, y: number): void {
        this.pathingGrid[y][x] = 0;
    }

    /**
     * Registers the entity at two adjacent positions on the grid at the same time.
     * This situation is temporary and should only occur when the entity is moving.
     * This is useful for the hit testing algorithm used when hovering entities with the mouse cursor.
     */
    registerEntityDualPosition(entity: GridIndexedEntity): void {
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
     */
    unregisterEntityPosition(entity: GridIndexedEntity): void {
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

    registerEntityPosition(entity: GridIndexedEntity): void {
        const x = entity.gridX,
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

    setServerOptions(host: string, port: number, username: string): void {
        this.host = host;
        this.port = port;
        this.username = username;
    }

    loadAudio(): void {
        this.audioManager = new AudioManager(this);
    }

    initMusicAreas(): void {
        const self = this;
        this.map.musicAreas.forEach(function (area: { x: number; y: number; w: number; h: number; id: MusicKey }) {
            self.audioManager.addArea(area.x, area.y, area.w, area.h, area.id);
        });
    }

    run(onStarted: () => void) {
        const self = this;

        this.loadSprites();
        this.setUpdater(new Updater(this));
        this.camera = this.renderer.camera;

        this.setSpriteScale(this.renderer.scale);

        const wait = setInterval(function () {
            if (self.map.isLoaded && self.spritesLoaded()) {
                self.ready = true;
                log.debug('All sprites loaded.');
                bootstrapGameRuntime(self, onStarted);

                clearInterval(wait);
            }
        }, 100);
    }

    tick(): void {
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

    start(): void {
        this.tick();
        this.hasNeverStarted = false;
        log.info('Game loop started.');
    }

    stop(): void {
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

    connect(onStarted: () => void) {
        initializeGameSessionConnection(this, onStarted);
    }

    /**
     * Links two entities in an attacker<-->target relationship.
     * This is just a utility method to wrap a set of instructions.
     */
    createAttackLink(attacker: Character, target: Character): void {
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
    sendHello(): void {
        this.client.sendHello(this.player);
    }

    /**
     * Converts the current mouse position on the screen to world grid coordinates.
     */
    getMouseGridPosition(): { x: number; y: number } {
        const mx = this.mouse.x,
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
     */
    makeCharacterGoTo(character: Character, x: number, y: number): void {
        if (!this.map.isOutOfBounds(x, y)) {
            character.go(x, y);
        }
    }

    /**
     *
     */
    makeCharacterTeleportTo(character: Character, x: number, y: number): void {
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
    makePlayerGoTo(x: number, y: number): void {
        this.makeCharacterGoTo(this.player, x, y);
    }

    /**
     * Moves the current player towards a specific item.
     * @see makeCharacterGoTo
     */
    makePlayerGoToItem(item: Item | null): void {
        movePlayerToItem(this, item);
    }

    /**
     *
     */
    makePlayerTalkTo(npc: Npc | null): void {
        makePlayerTalkToNpc(this, npc);
    }

    makePlayerOpenChest(chest: Chest | null): void {
        makePlayerOpenChest(this, chest);
    }

    /**
     *
     */
    makePlayerAttack(mob: Mob): void {
        makePlayerAttackMob(this, mob);
    }

    /**
     *
     */
    makeNpcTalk(npc: Npc | null): void {
        makeNpcDialogue(this, npc);
    }

    /**
     * Loops through all the entities currently present in the game.
     */
    forEachEntity(callback: (entity: GridIndexedEntity) => void) {
        forEachGameEntity(this, callback);
    }

    /**
     * Same as forEachEntity but only for instances of the Mob subclass.
     * @see forEachEntity
     */
    forEachMob(callback: (mob: Mob) => void) {
        forEachGameMob(this, callback);
    }

    /**
     * Loops through all entities visible by the camera and sorted by depth :
     * Lower 'y' value means higher depth.
     * Note: This is used by the Renderer to know in which order to render entities.
     */
    forEachVisibleEntityByDepth(callback: (entity: GridIndexedEntity) => void) {
        forEachEntityByDepthInView(this, callback);
    }

    /**
     *
     */
    forEachVisibleTileIndex(callback: (tileIndex: number) => void, extra: number) {
        forEachVisibleGameTileIndex(this, callback, extra);
    }

    /**
     *
     */
    forEachVisibleTile(callback: (tileId: number, tileIndex: number) => void, extra: number) {
        forEachVisibleGameTile(this, callback, extra);
    }

    /**
     *
     */
    forEachAnimatedTile(callback: (tile: DirtyAnimatedTile) => void) {
        forEachAnimatedGameTile(this, callback);
    }

    /**
     * Returns the entity located at the given position on the world grid.
     */
    getEntityAt(x: number, y: number): GridIndexedEntity | null {
        return getEntityAtPosition(this, x, y);
    }

    getMobAt(x: number, y: number): Mob | null {
        return getMobAtPosition(this, x, y);
    }

    getNpcAt(x: number, y: number): Npc | null {
        return getNpcAtPosition(this, x, y);
    }

    getChestAt(x: number, y: number): Chest | null {
        return getChestAtPosition(this, x, y);
    }

    getItemAt(x: number, y: number): Item | null {
        return getItemAtPosition(this, x, y) as Item | null;
    }

    /**
     * Returns true if an entity is located at the given position on the world grid.
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
    findPath(character: Character, x: number, y: number, ignoreList?: GridIndexedEntity[]): GridPath {
        const self = this,
            grid = this.pathingGrid;
        let path: GridPath = [];

        if (this.map.isColliding(x, y)) {
            return path;
        }

        if (this.pathfinder && character) {
            if (ignoreList) {
                ignoreList.forEach(function (entity: GridIndexedEntity) {
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
    togglePathingGrid(): void {
        this.debugPathing = !this.debugPathing;
    }

    /**
     * Toggles the visibility of the FPS counter and other debugging info.
     */
    toggleDebugInfo(): void {
        if (this.renderer) {
            this.renderer.isDebugInfoVisible = !this.renderer.isDebugInfoVisible;
        }
    }

    /**
     *
     */
    movecursor(): void {
        updatePlayerHoverState(this);
    }

    /**
     * Processes game logic when the user triggers a click/touch event during the game.
     */
    click(): void {
        processPlayerClick(this);
    }

    isMobOnSameTile(mob: Character, x?: number, y?: number): boolean {
        return hasMobOnTile(this, mob, x, y);
    }

    getFreeAdjacentNonDiagonalPosition(entity: Character): { x: number; y: number; o: number } | null {
        return findFreeAdjacentNonDiagonalPosition(this, entity);
    }

    tryMovingToADifferentTile(character: Character): boolean {
        return tryMovingCharacterToDifferentTile(this, character);
    }

    /**
     *
     */
    onCharacterUpdate(character: Character): void {
        const time = this.currentTime,
            self = this;

        // If mob has finished moving to a different tile in order to avoid stacking, attack again from the new position.
        if (character.previousTarget && !character.isMoving() && character instanceof Mob) {
            const t = character.previousTarget;

            if (t instanceof Character && this.getEntityById(t.id)) {
                // does it still exist?
                character.previousTarget = null;
                this.createAttackLink(character, t);
                return;
            }
        }

        if (character.isAttacking() && !character.previousTarget) {
            const isMoving = this.tryMovingToADifferentTile(character); // Don't let multiple mobs stack on the same tile when attacking a player.

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
        const c = this.camera;

        x = x - c.gridX;
        y = y - c.gridY;

        return x === 0 || y === 0 || x === c.gridW - 1 || y === c.gridH - 1;
    }

    /**
     *
     */
    getZoningOrientation(x: number, y: number): number {
        const c = this.camera;
        let orientation = Types.Orientations.DOWN;

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

    startZoningFrom(x: number, y: number): void {
        this.zoningOrientation = this.getZoningOrientation(x, y);

        if (this.renderer.mobile || this.renderer.tablet) {
            const z = this.zoningOrientation,
                c = this.camera,
                ts = this.renderer.tilesize,
                xoffset = (c.gridW - 2) * ts,
                yoffset = (c.gridH - 2) * ts;
            let nextX = c.x;
            let nextY = c.y;

            if (z === Types.Orientations.LEFT || z === Types.Orientations.RIGHT) {
                nextX = z === Types.Orientations.LEFT ? c.x - xoffset : c.x + xoffset;
            } else if (z === Types.Orientations.UP || z === Types.Orientations.DOWN) {
                nextY = z === Types.Orientations.UP ? c.y - yoffset : c.y + yoffset;
            }
            c.setPosition(nextX, nextY);

            this.renderer.clearScreen(this.renderer.context);
            this.endZoning();

            // Force immediate drawing of all visible entities in the new zone
            this.forEachVisibleEntityByDepth(function (entity: GridIndexedEntity) {
                entity.setDirty();
            });
        } else {
            this.currentZoning = new Transition();
        }
        this.bubbleManager.clean();
        this.client.sendZone();
    }

    enqueueZoningFrom(x: number, y: number): void {
        this.zoningQueue.push({ x: x, y: y });

        if (this.zoningQueue.length === 1) {
            this.startZoningFrom(x, y);
        }
    }

    endZoning(): void {
        this.currentZoning = null;
        this.resetZone();
        this.zoningQueue.shift();

        if (this.zoningQueue.length > 0) {
            const pos = this.zoningQueue[0];
            this.startZoningFrom(pos.x, pos.y);
        }
    }

    isZoning(): boolean {
        return this.currentZoning !== null;
    }

    resetZone(): void {
        this.bubbleManager.clean();
        this.initAnimatedTiles();
        this.renderer.renderStaticCanvases();
    }

    resetCamera(): void {
        this.camera.focusEntity(this.player);
        this.resetZone();
    }

    say(message: string): void {
        this.client.sendChat(message);
    }

    createBubble(id: EntityId, message: string): void {
        this.bubbleManager.create(String(id), message, this.currentTime);
    }

    destroyBubble(id: EntityId): void {
        this.bubbleManager.destroyBubble(String(id));
    }

    assignBubbleTo(character: BubbleAnchor): void {
        const bubble = this.bubbleManager.getBubbleById(String(character.id));

        if (bubble && bubble.element) {
            const s = this.renderer.scale,
                t = 16 * s, // tile size
                x = (character.x - this.camera.x) * s,
                w = (bubble.element.offsetWidth || 0) + 24,
                offset = w / 2 - t / 2;
            let offsetY = 12;

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

            const y = (character.y - this.camera.y) * s - t * 2 - offsetY;

            bubble.element.style.left = x - offset + 'px';
            bubble.element.style.top = y + 'px';
        }
    }

    restart(): void {
        log.debug('Beginning restart');

        initializeGameSpatialState(this, { resetEntities: true });

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

    resize(): void {
        const x = this.camera.x,
            y = this.camera.y,
            currentScale = this.renderer.scale,
            newScale = this.renderer.getScaleFactor();

        this.renderer.rescale(newScale);
        this.camera = this.renderer.camera;
        this.camera.setPosition(x, y);

        this.renderer.renderStaticCanvases();
    }

    updateBars(): void {
        if (this.player) {
            this.emit('playerHealthChange', this.player.hitPoints, this.player.maxHitPoints);
        }
    }

    getDeadMobPosition(mobId: EntityId): GridPosition | undefined {
        let position: GridPosition | undefined;

        if (mobId in this.deathpositions) {
            position = this.deathpositions[mobId];
            delete this.deathpositions[mobId];
        }

        return position;
    }

    tryUnlockingAchievement(name: AchievementKey): void {
        let achievement: AchievementDefinition | null = null;
        if (name in this.achievements) {
            achievement = this.achievements[name];

            if (achievement && achievement.isCompleted() && this.storage.unlockAchievement(achievement.id)) {
                this.emit('achievementUnlock', achievement.id, achievement.name, achievement.desc);
                this.audioManager.playSound('achievement');
            }
        }
    }

    showNotification(message: string): void {
        this.emit('notification', message);
    }

    removeObsoleteEntities(): void {
        const obsoleteEntities: GridIndexedEntity[] = this.obsoleteEntities || [],
            nb = obsoleteEntities.length,
            self = this;

        if (nb > 0) {
            obsoleteEntities.forEach(function (entity: GridIndexedEntity) {
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
                        .filter(function (entity: GridIndexedEntity) {
                            return entity.id !== self.player.id;
                        })
                        .map(function (entity: GridIndexedEntity) {
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
    updateCursor(): void {
        this.movecursor();
        this.updateCursorLogic();
    }

    /**
     * Change player plateau mode when necessary
     */
    updatePlateauMode(): void {
        if (this.map.isPlateau(this.player.gridX, this.player.gridY)) {
            this.player.isOnPlateau = true;
        } else {
            this.player.isOnPlateau = false;
        }
    }

    updatePlayerCheckpoint(): void {
        const checkpoint = this.map.getCurrentCheckpoint(this.player);

        if (checkpoint) {
            const lastCheckpoint = this.player.lastCheckpoint;
            if (!lastCheckpoint || (lastCheckpoint && lastCheckpoint.id !== checkpoint.id)) {
                this.player.lastCheckpoint = checkpoint;
                this.client.sendCheck(checkpoint.id);
            }
        }
    }

    checkUndergroundAchievement(): void {
        const music = this.audioManager.getSurroundingMusic(this.player);

        if (music) {
            if (music.name === 'cave') {
                this.tryUnlockingAchievement('UNDERGROUND');
            }
        }
    }

    forEachEntityAround(x: number, y: number, r: number, callback: (entity: GridIndexedEntity) => void) {
        for (let i = x - r, max_i = x + r; i <= max_i; i += 1) {
            for (let j = y - r, max_j = y + r; j <= max_j; j += 1) {
                if (!this.map.isOutOfBounds(i, j)) {
                    const entities = this.renderingGrid[j][i];
                    if (entities) {
                        Object.keys(entities).forEach(function (id: string) {
                            callback(entities[id]);
                        });
                    }
                }
            }
        }
    }

    checkOtherDirtyRects(r1: DirtyRect, source: DirtyRectSource, x: number, y: number): void {
        const r = this.renderer;

        this.forEachEntityAround(x, y, 2, function (e2: GridIndexedEntity) {
            if (source && 'id' in source && e2.id === source.id) {
                return;
            }
            if (!e2.isDirty) {
                const r2 = r.getEntityBoundingRect(e2);
                if (r.isIntersecting(r1, r2)) {
                    e2.setDirty();
                }
            }
        });

        if (source && !('index' in source)) {
            this.forEachAnimatedTile(function (tile: DirtyAnimatedTile) {
                if (!tile.isDirty) {
                    const r2 = r.getTileBoundingRect(tile);
                    if (r.isIntersecting(r1, r2)) {
                        tile.isDirty = true;
                    }
                }
            });
        }

        if (!this.drawTarget && this.selectedCellVisible) {
            const targetRect = r.getTargetBoundingRect();
            if (r.isIntersecting(r1, targetRect)) {
                this.drawTarget = true;
                this.renderer.targetRect = targetRect;
            }
        }
    }
}

export default Game;
