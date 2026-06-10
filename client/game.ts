import InfoManager from './infomanager';
import BubbleManager from './bubble';
import Renderer from './renderer';
import GameMap from './map';
import type Animation from './animation';
import type Sprite from './sprite';
import { initializeGameConnection } from './runtime/connection';
import { bootstrapGameRuntime } from './game-runtime-bootstrap';
import { initializeGameSpatialState } from './game-spatial-state';
import { buildPathingIgnoreList, type PathingIgnoreEntity } from './runtime/pathing-ignore-list';
import { applyDynamicOccupancyOverlayToGrid } from './runtime/pathing-dynamic-occupancy';
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
import AnimatedTile from './tile';
import Warrior from './warrior';
import type GameClient from './gameclient';
import type { RuntimeEntity } from './client-boundary-types';
import AudioManager from './audio';
import Transition from './transition';
import Pathfinder from './pathfinder';
import type Camera from './camera';
import { createAchievementDefinitions } from './game-achievements';
import type { AchievementDefinition } from './game-achievements';
import Item from './item';
import Mob from './mob';
import Npc from './npc';
import Character, { type CharacterEvents } from './character';
import type Chest from './chest';
import config from './config';
import log from './platform/log';
import Types from '../shared/gametypes-browser';
import type { EntityKind } from '../shared/entity-kind-domain';
import { requestAnimFrame } from './platform/util';
import { isAchievementId, type AchievementId, type AchievementKey } from './achievement-domain';
import { SPRITE_KEYS } from './asset-key-domain';
import type { CursorKey, MusicKey, SpriteKey } from './asset-key-domain';
import type Storage from './storage';
import { Evented } from '../shared/evented';
import type { MergeEvents, TypedEventMap, TypedEventSource } from '../shared/typed-event-emitter';
import type { EntityId } from '../shared/domain/ids';
import { isEntityId } from '../shared/domain/ids';
import { ClientWorldKernel } from './ecs/world-kernel';
import { ClientFrameScheduler } from './ecs/frame-scheduler';
import { runClientClickIntentSystem } from './ecs/systems/client-click-intent-system';
import { runClientCommandApplySystem } from './ecs/systems/client-command-apply-system';
import { runClientCursorSystem } from './ecs/systems/client-cursor-system';
import { runClientEnvironmentSystem } from './ecs/systems/client-environment-system';
import { runClientHoverStateSystem } from './ecs/systems/client-hover-state-system';
import {
    clearClientInteractionIntentWithSideEffects,
    runClientInteractionIntentSystem,
} from './ecs/systems/client-interaction-intent-system';
import { runClientKernelReplicationSyncSystem } from './ecs/systems/client-kernel-replication-sync-system';
import { runClientMoveInputPredictionSystem } from './ecs/systems/client-move-input-prediction-system';
import { runClientPlayerMoveInputOutboxSystem } from './ecs/systems/client-player-move-input-outbox-system';
import { runClientPlayerMoveOutboxSystem } from './ecs/systems/client-player-move-outbox-system';
import { runClientDoorPortalSystem } from './ecs/systems/client-door-portal-system';
import { runClientRuntimeEventSystem } from './ecs/systems/client-runtime-event-system';
import { runClientSpatialSyncSystem } from './ecs/systems/client-spatial-sync-system';
import { runClientTimeSystem } from './ecs/systems/client-time-system';
import { runClientRenderSystem } from './ecs/systems/client-render-system';
import { runClientCombatSystem } from './ecs/systems/client-combat-system';
import { runClientSimulationSystem } from './ecs/systems/client-simulation-system';
import Timer from './timer';
import { resolveStartupWaitOutcome } from './game-startup-wait';
import { resolveClientMovementNetcodeMode } from './netcode-mode';

type GridPosition = { x: number; y: number };
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
    getSpriteName(): string;
    setGridPosition(x: number, y: number): void;
    setDirty(): void;
    setHighlight(isHighlighted: boolean): void;
    setWeaponName?(name: string): void;
};
type DirtyAnimatedTile = AnimatedTile & { isDirty?: boolean };
type GridPath = Array<[number, number]>;
type DirtyRect = {
    x: number;
    y: number;
    w: number;
    h: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
};
type DirtyRectSource = GridIndexedEntity | DirtyAnimatedTile | null;
type BubbleAnchor = { id: EntityId | string | number; x: number; y: number };
type RuntimeServerConfig = { wsUrl: string; dispatcher: boolean };
type CharacterEventEnvelope = MergeEvents<CharacterEvents, TypedEventMap>;
type AppLike = {
    config: { server?: RuntimeServerConfig } | null;
    initAchievementList(achievements: Record<string, AchievementDefinition>): void;
    initUnlockedAchievements(unlocked: AchievementId[]): void;
};
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

function isGridIndexedItem(item: Item): item is Item & GridIndexedEntity {
    return isEntityId(item.id);
}

export type GameEventSource = TypedEventSource<GameEvents>;

function overlayValueToPathingValue(value: number): number {
    return value === 0 ? 0 : 1;
}

function applyChunkOverlayPathingToGrid({
    grid,
    cache,
    isOutOfBounds,
}: {
    grid: number[][];
    cache: ClientWorldKernel['clientChunkOverlayCache'];
    isOutOfBounds: (x: number, y: number) => boolean;
}): () => void {
    const original = new globalThis.Map<string, number>();

    cache.forEachPresentGlobal((x, y, value) => {
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || isOutOfBounds(x, y)) {
            return;
        }
        const row = grid[y];
        if (row?.[x] === undefined) {
            return;
        }

        const key = `${x},${y}`;
        if (!original.has(key)) {
            original.set(key, row[x] ?? 0);
        }
        row[x] = overlayValueToPathingValue(value);
    });

    return () => {
        for (const [key, prev] of original.entries()) {
            const [xs, ys] = key.split(',');
            const x = Number(xs);
            const y = Number(ys);
            if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
                continue;
            }
            const row = grid[y];
            if (row?.[x] === undefined) {
                continue;
            }
            row[x] = prev;
        }
        original.clear();
    };
}

class Game extends Evented<GameEvents> {
    app: AppLike;
    ready: boolean;
    started: boolean;
    hasNeverStarted: boolean;
    renderer: Renderer;
    pathfinder: Pathfinder | null;
    chatinput: HTMLInputElement | null;
    bubbleManager: BubbleManager | null;
    audioManager: AudioManager | null;
    player: Warrior;
    entities: Record<string, GridIndexedEntity>;
    deathpositions: Record<string, GridPosition>;
    playerId: EntityId | null;
    currentCursor: Sprite | null;
    currentCursorOrientation?: number | null;
    mouse: { x: number; y: number };
    zoningQueue: Array<{ x: number; y: number }>;
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
    storage!: Storage;
    map: GameMap | null;
    shadows: Record<string, Sprite>;
    targetAnimation: Animation | null;
    sparksAnimation: Animation | null;
    achievements: Record<string, AchievementDefinition>;
    spritesets: Array<Record<string, Sprite>>;
    wsUrl: string;
    username: string;
    camera!: Camera;
    currentTime: number;
    playerAggroTimer: Timer;
    isStopped: boolean;
    client: GameClient | null;
    kernel: ClientWorldKernel;
    frameScheduler: ClientFrameScheduler<Game>;
    zoningOrientation: number | null;
    obsoleteEntities: GridIndexedEntity[] | null;
    drawTarget: boolean;
    lastHovered: GridIndexedEntity | null;
    connectionStartedCallback: (() => void) | null;
    reviveWelcomeTimeout: ReturnType<typeof setTimeout> | null;

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

        this.pathfinder = null;
        this.chatinput = null;
        this.bubbleManager = null;
        this.audioManager = null;

        // Player
        this.player = new Warrior('player', '');

        // Game state
        this.entities = {};
        this.deathpositions = {};
        this.playerId = null;
        this.currentCursor = null;
        this.mouse = { x: 0, y: 0 };
        this.zoningQueue = [];

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
        this.wsUrl = '';
        this.username = '';
        this.currentTime = 0;
        this.playerAggroTimer = new Timer(1000);
        this.isStopped = false;
        this.client = null;
        this.kernel = new ClientWorldKernel();
        this.kernel.setClientMovementNetcodeMode(resolveClientMovementNetcodeMode());
        this.frameScheduler = new ClientFrameScheduler<Game>();
        this.frameScheduler.add('pre_update', (game) => runClientTimeSystem(game));
        this.frameScheduler.add('pre_update', (game) => runClientRuntimeEventSystem(game));
        this.frameScheduler.add('pre_update', (game) => runClientCommandApplySystem(game));
        this.frameScheduler.add('pre_update', (game) => runClientKernelReplicationSyncSystem(game));
        this.frameScheduler.add('pre_update', (game) => runClientCommandApplySystem(game));
        this.frameScheduler.add('pre_update', (game) => runClientSpatialSyncSystem(game));
        this.frameScheduler.add('pre_update', (game) => runClientCommandApplySystem(game));
        this.frameScheduler.add('pre_update', (game) => runClientHoverStateSystem(game));
        this.frameScheduler.add('pre_update', (game) => runClientClickIntentSystem(game));
        this.frameScheduler.add('pre_update', (game) => runClientMoveInputPredictionSystem(game));
        this.frameScheduler.add('pre_update', (game) => runClientCommandApplySystem(game));
        this.frameScheduler.add('pre_update', (game) => runClientCursorSystem(game));
        this.frameScheduler.add('update', (game) => runClientSimulationSystem(game));
        this.frameScheduler.add('update', (game) => runClientCombatSystem(game));
        this.frameScheduler.add('update', (game) => runClientCommandApplySystem(game));
        this.frameScheduler.add('post_update', (game) => runClientDoorPortalSystem(game));
        this.frameScheduler.add('post_update', (game) => runClientSpatialSyncSystem(game));
        this.frameScheduler.add('post_update', (game) => runClientPlayerMoveInputOutboxSystem(game));
        this.frameScheduler.add('post_update', (game) => runClientPlayerMoveOutboxSystem(game));
        this.frameScheduler.add('post_update', (game) => runClientEnvironmentSystem(game));
        this.frameScheduler.add('post_update', (game) => runClientInteractionIntentSystem(game));
        this.frameScheduler.add('post_update', (game) => runClientCommandApplySystem(game));
        this.frameScheduler.add('render', (game) => runClientRenderSystem(game));
        this.zoningOrientation = null;
        this.obsoleteEntities = null;
        this.drawTarget = false;
        this.lastHovered = null;
        this.connectionStartedCallback = null;
        this.reviveWelcomeTimeout = null;

        this.setBubbleManager(new BubbleManager(bubbleContainer));
        this.renderer = new Renderer(this, canvas, background, foreground);
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

    setPathfinder(pathfinder: Pathfinder): void {
        this.pathfinder = pathfinder;

        // Characters expect a path resolver callback; without it, clicks/moves log errors and do nothing.
        const self = this;
        const install = function <TEvents extends CharacterEventEnvelope>(character: Character<TEvents>): void {
            character.setPathRequestResolver(function (x: number, y: number) {
                return self.findPath(character, x, y, buildPathingIgnoreList(character));
            });
        };

        install(this.player);
        Object.values(this.entities).forEach(function (entity) {
            if (entity instanceof Character) {
                install(entity);
            }
        });
    }

    setChatInput(element: HTMLInputElement): void {
        this.chatinput = element;
    }

    setBubbleManager(bubbleManager: BubbleManager): void {
        this.bubbleManager = bubbleManager;
    }

    loadMap(mapId = this.kernel.activeMapId ?? 'world_01'): void {
        const renderer = this.renderer;
        const map = new GameMap(!renderer.upscaledRendering, this, mapId);
        this.map = map;
        map.setCollisionOverrideResolver((x, y) => this.kernel.clientChunkOverlayCache.getGlobal(x, y));

        map.ready(() => {
            log.info('Map loaded.');
            const tilesetIndex = renderer.upscaledRendering ? 0 : renderer.scale - 1;
            renderer.setTileset(map.tilesets[tilesetIndex]);
        });
    }

    async loadMapById(mapId: string): Promise<void> {
        const nextMapId = mapId.trim();
        if (nextMapId.length === 0) {
            throw new Error('Map id must be a non-empty string.');
        }
        const map = this.map;
        if (!map) {
            throw new Error('Cannot switch maps before initial map runtime is loaded.');
        }
        if (map.mapId === nextMapId) {
            return;
        }

        await map.loadRuntimeMapById(nextMapId);
        map.setCollisionOverrideResolver((x, y) => this.kernel.clientChunkOverlayCache.getGlobal(x, y));

        const tilesetIndex = this.renderer.upscaledRendering ? 0 : this.renderer.scale - 1;
        this.renderer.setTileset(map.tilesets[tilesetIndex]);

        this.kernel.resetClientSpatialState(map.grid);
        this.kernel.clientChunkOverlayCache.clear();
        this.setPathfinder(new Pathfinder(map.width, map.height));

        this.initMusicAreas();
        this.initAnimatedTiles();
        this.resetZone();
    }

    initPlayer(): void {
        this.kernel.clearClientLootAttempt();

        this.player.setSprite(this.sprites[this.player.getSpriteName()] ?? null);
        this.player.idle();

        log.debug('Finished initPlayer');
    }

    stopPlayerCombat(): void {
        if (this.player.isAttacking() || this.player.followingMode || this.player.hasTarget()) {
            this.player.disengage();
            this.player.idle();
        }
    }

    onEntityRemoved(removedId: EntityId): void {
        if (this.kernel.clientInteractionIntent?.targetId === removedId) {
            clearClientInteractionIntentWithSideEffects(this);
        }

        if (this.player.hasTarget() && this.player.target?.id === removedId) {
            this.stopPlayerCombat();
        }

        Object.values(this.entities).forEach((entity) => {
            if (!(entity instanceof Character)) {
                return;
            }
            if (entity.hasTarget() && entity.target?.id === removedId) {
                entity.disengage();
                entity.idle();
            }
        });
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
        const numericId = Number.parseInt(String(id), 10);
        for (const key of Object.keys(this.achievements)) {
            const achievement = this.achievements[key];
            if (!achievement) {
                continue;
            }
            if (achievement.id === numericId) {
                return achievement;
            }
        }
        return null;
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
        const cursor = this.cursors[name];
        if (cursor) {
            this.currentCursor = cursor;
            this.currentCursorOrientation = orientation;
        } else {
            log.error('Unknown cursor name :' + name);
        }
    }

    focusPlayer(): void {
        this.renderer.camera.lookAt(this.player);
    }

    addEntity(entity: GridIndexedEntity): void {
        const self = this;

        if (this.entities[entity.id] === undefined) {
            this.entities[entity.id] = entity;

            // Ensure movement/pathfinding works for all spawned characters.
            if (this.pathfinder && entity instanceof Character) {
                this.setPathfinder(this.pathfinder);
            }
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
            this.onEntityRemoved(entity.id);
            delete this.entities[entity.id];
        } else {
            log.error('Cannot remove entity. Unknown ID : ' + entity.id);
        }
    }

    addItem(item: Item, x: number, y: number): void {
        if (!isGridIndexedItem(item)) {
            log.error('Cannot add item. Non-entity-id item reference.');
            return;
        }
        item.setSprite(this.sprites[item.getSpriteName()] ?? null);
        item.setGridPosition(x, y);
        item.setAnimation('idle', 150);
        this.addEntity(item);
    }

    addItemFromUnknown(item: RuntimeEntity, x: number, y: number): void {
        if (item instanceof Item) {
            this.addItem(item, x, y);
            return;
        }
        log.error('Cannot add item. Unknown item reference.');
    }

    removeItem(item: Item | null): void {
        if (!item) {
            log.error('Cannot remove item. Unknown item reference.');
            return;
        }
        if (!isGridIndexedItem(item)) {
            log.error('Cannot remove item. Non-entity-id item reference.');
            return;
        }
        this.removeEntity(item);
    }

    /**
     *
     */
    initAnimatedTiles(): void {
        const self = this;
        const m = this.map;
        if (!m) {
            return;
        }

        this.animatedTiles = [];
        this.forEachVisibleTile(function (id: number, index: number) {
            if (m.isAnimatedTile(id)) {
                const length = m.getTileAnimationLength(id);
                const delay = m.getTileAnimationDelay(id);
                if (typeof length !== 'number' || typeof delay !== 'number') {
                    return;
                }
                const tile = new AnimatedTile(id, length, delay, index),
                    pos = m.tileIndexToGridPosition(tile.index);

                tile.x = pos.x;
                tile.y = pos.y;
                self.animatedTiles?.push(tile);
            }
        }, 1);
        //log.info("Initialized animated tiles.");
    }


    setServerOptions(wsUrl: string, username: string): void {
        this.wsUrl = wsUrl;
        this.username = username;
    }

    setPlayerId(id: EntityId): void {
        this.player.id = id;
        this.playerId = id;
    }

    setPlayerName(name: string): void {
        this.player.name = name;
    }

    setPlayerGridPosition(x: number, y: number): void {
        this.player.setGridPosition(x, y);
    }

    setPlayerMaxHitPoints(hp: number): void {
        this.player.setMaxHitPoints(hp);
    }

    setPlayerHealth(points: number): void {
        this.player.hitPoints = points;
    }

    loadAudio(): void {
        this.audioManager = new AudioManager(this);
    }

    initMusicAreas(): void {
        const map = this.map;
        const audioManager = this.audioManager;
        if (!map || !audioManager) {
            return;
        }
        audioManager.areas = [];
        map.musicAreas.forEach(function (area: { x: number; y: number; w: number; h: number; id: MusicKey }) {
            audioManager.addArea(area.x, area.y, area.w, area.h, area.id);
        });
        audioManager.updateMusic();
    }

    run(onStarted: () => void, onFailed?: (reason: string) => void) {
        const self = this;
        const startWaitAt = Date.now();

        this.loadSprites();
        this.camera = this.renderer.camera;

        this.setSpriteScale(this.renderer.scale);

        const failStartup = (reason: string): void => {
            clearInterval(wait);
            log.error(reason);
            this.emit('notification', reason);
            if (onFailed) {
                onFailed(reason);
            }
        };

        const wait = setInterval(function () {
            const map = self.map;
            const outcome = resolveStartupWaitOutcome({
                mapLoaded: map?.isLoaded === true,
                spritesLoaded: self.spritesLoaded(),
                mapLoadError: map ? map.getLoadError() : null,
                elapsedMs: Date.now() - startWaitAt,
            });
            if (outcome === 'ready') {
                self.ready = true;
                log.debug('All sprites loaded.');
                bootstrapGameRuntime(self, onStarted);
                clearInterval(wait);
                return;
            }
            if (outcome === 'map_error') {
                failStartup('Unable to load map data. Please reload the page.');
                return;
            }
            if (outcome === 'timeout') {
                failStartup('Game startup timed out while loading assets. Please reload the page.');
            }
        }, 100);
    }

    tick(): void {
        this.frameScheduler.runFrame(this);

        if (!this.isStopped) {
            requestAnimFrame(() => this.tick());
        }
    }

    start(): void {
        this.tick();
        this.hasNeverStarted = false;
        log.info('Game loop started.');
    }

    stop(): void {
        this.client?.sendChunkUnsubscribe();
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
        initializeGameConnection(this, onStarted);
    }

    /**
     * Links two entities in an attacker<-->target relationship.
     * This is just a utility method to wrap a set of instructions.
     */
    createAttackLink<TAttackerEvents extends CharacterEventEnvelope, TTargetEvents extends CharacterEventEnvelope>(
        attacker: Character<TAttackerEvents>,
        target: Character<TTargetEvents>
    ): void {
        if (attacker.hasTarget()) {
            attacker.removeTarget();
        }

        // Movement is server-authoritative; attack links must not start client-side follow/pathing.
        attacker.attackingMode = true;
        attacker.followingMode = false;
        attacker.setTarget(target);

        if (attacker.id !== this.playerId) {
            target.addAttacker(attacker);
        }
    }

    /**
     * Sends a "hello" message to the server, as a way of initiating the player connection handshake.
     * @see GameClient.sendHello
     */
    sendHello(): void {
        this.kernel.enqueueClientCommand({ type: 'clientSendHello' });
    }

    /**
     * Converts the current mouse position on the screen to world grid coordinates.
     */
    getMouseGridPosition(): { x: number; y: number } {
        const mx = this.mouse.x,
            my = this.mouse.y,
            c = this.renderer.camera,
            s = this.renderer.scale,
            ts = this.renderer.tilesize;

        // Use precise camera world coordinates (not floored gridX/gridY) so mouse picking stays aligned
        // while camera follows sub-tile reconciliation/smoothing.
        const worldX = mx / s + c.x;
        const worldY = my / s + c.y;
        const x = Math.floor(worldX / ts);
        const y = Math.floor(worldY / ts);

        return { x: x, y: y };
    }

    /**
     * Moves a character to a given location on the world grid.
     */
    makeCharacterGoTo<TEvents extends CharacterEventEnvelope>(character: Character<TEvents>, x: number, y: number): void {
        if (this.map && !this.map.isOutOfBounds(x, y)) {
            character.go(x, y);
        }
    }

    /**
     *
     */
    makeCharacterTeleportTo<TEvents extends CharacterEventEnvelope>(
        character: Character<TEvents>,
        x: number,
        y: number
    ): void {
        if (this.map && !this.map.isOutOfBounds(x, y)) {
            character.setGridPosition(x, y);

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
        if (!item) {
            return;
        }
        // Navigation to items is movement only; explicit pickup happens via interaction intent + loot command.
        this.makePlayerGoTo(item.gridX, item.gridY);
    }

    /**
     *
     */
    makePlayerTalkTo(npc: Npc | null): void {
        if (!npc) {
            return;
        }
        this.player.setTarget(npc);
        this.player.follow(npc);
    }

    makePlayerOpenChest(chest: Chest | null): void {
        if (!chest) {
            return;
        }
        this.player.setTarget(chest);
        this.player.follow(chest);
    }

    /**
     *
     */
    makePlayerAttack(mob: Mob): void {
        this.createAttackLink(this.player, mob);
    }

    /**
     *
     */
    makeNpcTalk(npc: Npc | null): void {
        if (!npc) {
            return;
        }

        const message = npc.talk();
        if (message) {
            this.createBubble(npc.id, message);
            this.assignBubbleTo(npc);
            this.audioManager?.playSound('npc');
        } else {
            this.destroyBubble(npc.id);
            this.audioManager?.playSound('npc-end');
        }
        this.tryUnlockingAchievement('SMALL_TALK');

        if (npc.kind === Types.Entities.RICK) {
            this.tryUnlockingAchievement('RICKROLLD');
        }
    }

    /**
     * Loops through all the entities currently present in the game.
     */
    forEachEntity(callback: (entity: GridIndexedEntity) => void) {
        Object.keys(this.entities).forEach((id: string) => {
            const entity = this.entities[id];
            if (entity) {
                callback(entity);
            }
        });
    }

    /**
     * Same as forEachEntity but only for instances of the Mob subclass.
     * @see forEachEntity
     */
    forEachMob(callback: (mob: Mob) => void) {
        Object.keys(this.entities).forEach((id: string) => {
            const entity = this.entities[id];
            if (entity instanceof Mob) {
                callback(entity);
            }
        });
    }

    /**
     * Loops through all entities visible by the camera and sorted by depth :
     * Lower 'y' value means higher depth.
     * Note: This is used by the Renderer to know in which order to render entities.
     */
    forEachVisibleEntityByDepth(callback: (entity: GridIndexedEntity) => void) {
        const map = this.map;
        const renderer = this.renderer;
        if (!map) {
            return;
        }

        this.camera.forEachVisiblePosition(
            (x: number, y: number) => {
                if (!map.isOutOfBounds(x, y)) {
                    const ids = this.kernel.getClientRenderIdsAt(x, y);
                    for (const id of ids) {
                        const entity = this.entities[String(id)];
                        if (entity) {
                            callback(entity);
                        }
                    }
                }
            },
            renderer.mobile ? 0 : 2
        );
    }

    /**
     *
     */
    forEachVisibleTileIndex(callback: (tileIndex: number) => void, extra: number) {
        const map = this.map;
        if (!map) {
            return;
        }

        this.camera.forEachVisiblePosition((x: number, y: number) => {
            if (!map.isOutOfBounds(x, y)) {
                callback(map.GridPositionToTileIndex(x, y) - 1);
            }
        }, extra);
    }

    /**
     *
     */
    forEachVisibleTile(callback: (tileId: number, tileIndex: number) => void, extra: number) {
        const map = this.map;
        if (!map?.isLoaded) {
            return;
        }

        this.forEachVisibleTileIndex((tileIndex: number) => {
            const x = tileIndex % map.width;
            const y = Math.floor(tileIndex / map.width);
            const overlayValue = this.kernel.clientChunkOverlayCache.getGlobal(x, y);
            if (overlayValue !== null) {
                const overlayTileId = overlayValue - 1;
                if (overlayValue > 0 && !map.isForegroundTileId(overlayTileId)) {
                    callback(overlayTileId, tileIndex);
                }
                return;
            }

            const tileData = map.data[tileIndex];
            if (tileData === undefined) {
                return;
            }
            if (Array.isArray(tileData)) {
                tileData.forEach((id: number) => {
                    callback(id - 1, tileIndex);
                });
                return;
            }

            if (typeof tileData === 'number' && !Number.isNaN(tileData - 1)) {
                callback(tileData - 1, tileIndex);
            }
        }, extra);
    }

    forEachVisibleForegroundTile(callback: (tileId: number, tileIndex: number) => void, extra: number) {
        const map = this.map;
        if (!map?.isLoaded) {
            return;
        }

        this.forEachVisibleTileIndex((tileIndex: number) => {
            const x = tileIndex % map.width;
            const y = Math.floor(tileIndex / map.width);
            const overlayValue = this.kernel.clientChunkOverlayCache.getGlobal(x, y);
            if (overlayValue !== null) {
                const overlayTileId = overlayValue - 1;
                if (overlayValue > 0 && map.isForegroundTileId(overlayTileId)) {
                    callback(overlayTileId, tileIndex);
                }
                return;
            }

            const tileData = map.foreground[tileIndex];
            if (tileData === undefined) {
                return;
            }
            if (Array.isArray(tileData)) {
                tileData.forEach((id: number) => {
                    callback(id - 1, tileIndex);
                });
                return;
            }

            if (typeof tileData === 'number' && !Number.isNaN(tileData - 1)) {
                callback(tileData - 1, tileIndex);
            }
        }, extra);
    }

    /**
     *
     */
    forEachAnimatedTile(callback: (tile: DirtyAnimatedTile) => void) {
        if (!this.animatedTiles) {
            return;
        }
        this.animatedTiles.forEach((tile: DirtyAnimatedTile) => callback(tile));
    }

    /**
     * Finds a path to a grid position for the specified character.
     * The path will pass through any entity present in the ignore list.
     */
    findPath<TEvents extends CharacterEventEnvelope>(
        character: Character<TEvents> & PathingIgnoreEntity & { id: EntityId | string | number },
        x: number,
        y: number,
        ignoreList?: PathingIgnoreEntity[]
    ): GridPath {
        let path: GridPath = [];
        const map = this.map;

        if (!map || map.isColliding(x, y)) {
            return path;
        }
        if (!map.isSameNavigationIsland(character.gridX, character.gridY, x, y)) {
            return path;
        }

        this.kernel.ensureClientPathingGrid(map.grid);
        if (!this.kernel.clientPathingGrid) {
            return path;
        }

        const pathfinder = this.pathfinder;
        if (pathfinder) {
            const excludeIds = new Set<EntityId>();
            if (isEntityId(character.id)) {
                excludeIds.add(character.id);
            }
            const restoreChunkOverlay = applyChunkOverlayPathingToGrid({
                grid: this.kernel.clientPathingGrid,
                cache: this.kernel.clientChunkOverlayCache,
                isOutOfBounds: (cx, cy) => map.isOutOfBounds(cx, cy),
            });
            const restoreDynamicOccupancy = applyDynamicOccupancyOverlayToGrid({
                grid: this.kernel.clientPathingGrid,
                records: this.kernel.clientSpatialRecords.entries(),
                isOutOfBounds: (cx, cy) => map.isOutOfBounds(cx, cy),
                excludeIds,
            });

            try {
                if (ignoreList) {
                    ignoreList.forEach(function (entity: PathingIgnoreEntity) {
                        pathfinder.ignoreEntity(entity);
                    });
                }

                path = pathfinder.findPath(this.kernel.clientPathingGrid, character, x, y, false, { variant: 'DiagonalFree' });
            } finally {
                if (ignoreList) {
                    pathfinder.clearIgnoreList();
                }
                restoreDynamicOccupancy();
                restoreChunkOverlay();
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
        this.renderer.isDebugInfoVisible = !this.renderer.isDebugInfoVisible;
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
        let orientation: number = Types.Orientations.DOWN;

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
        this.bubbleManager?.clean();
        this.kernel.enqueueClientCommand({ type: 'clientSendZone' });
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
            if (pos) {
                this.startZoningFrom(pos.x, pos.y);
            }
        }
    }

    isZoning(): boolean {
        return this.currentZoning !== null;
    }

    resetZone(): void {
        this.bubbleManager?.clean();
        this.initAnimatedTiles();
        this.renderer.renderStaticCanvases();

        // Mobile/tablet renderer uses dirty-rect drawing; after a zone/camera reset the screen may be cleared
        // with no dirty entities to trigger an immediate redraw. Force a redraw of the newly visible set.
        if (this.started && (this.renderer.mobile || this.renderer.tablet)) {
            this.forEachVisibleEntityByDepth(function (entity: GridIndexedEntity) {
                entity.setDirty();
            });
        }
    }

    resetCamera(): void {
        if (this.map) {
            const bounds = this.resolveCameraWorldBounds();
            if (bounds) {
                const viewportWorldWidth = this.renderer.getWidth() / this.renderer.scale;
                const viewportWorldHeight = this.renderer.getHeight() / this.renderer.scale;
                const desiredX = Math.round(this.player.x - (viewportWorldWidth / 2));
                const desiredY = Math.round(this.player.y - (viewportWorldHeight / 2));

                this.camera.setPosition(
                    Math.max(bounds.minX, Math.min(desiredX, bounds.maxX)),
                    Math.max(bounds.minY, Math.min(desiredY, bounds.maxY))
                );
            }
        } else {
            this.camera.focusEntity(this.player);
        }
        this.resetZone();
    }

    say(message: string): void {
        this.kernel.enqueueClientCommand({ type: 'clientSendChat', message });
    }

    createBubble(id: EntityId | string | number, message: string): void {
        this.bubbleManager?.create(String(id), message, this.currentTime);
    }

    destroyBubble(id: EntityId | string | number): void {
        this.bubbleManager?.destroyBubble(String(id));
    }

    clearReviveWelcomeTimeout(): void {
        const pending = this.reviveWelcomeTimeout;
        if (pending) {
            clearTimeout(pending);
            this.reviveWelcomeTimeout = null;
        }
    }

    armReviveWelcomeTimeout(): void {
        this.clearReviveWelcomeTimeout();

        const TIMEOUT_MS = 6_000;
        this.reviveWelcomeTimeout = setTimeout(() => {
            this.reviveWelcomeTimeout = null;
            if (this.playerId !== null) {
                return;
            }

            log.error('Revive handshake timed out (WELCOME not received); reconnecting');
            this.showNotification('Connection hiccup while reviving… reconnecting.');

            this.kernel.drainClientCommands();
            this.kernel.drainClientRuntimeEvents();
            this.client?.reconnectSilently();
        }, TIMEOUT_MS);
    }

    assignBubbleTo(character: BubbleAnchor): void {
        const bubble = this.bubbleManager?.getBubbleById(String(character.id));

        if (bubble) {
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

        this.clearReviveWelcomeTimeout();
        this.client?.sendChunkUnsubscribe();
        this.kernel.resetWorldState();
        initializeGameSpatialState(this, { resetEntities: true });

        this.player = new Warrior('player', this.username);
        this.initPlayer();
        this.playerId = null;

        this.started = true;
        this.client?.enable();
        this.sendHello();

        this.storage.incrementRevives();

        if (this.renderer.mobile || this.renderer.tablet) {
            this.renderer.clearScreen(this.renderer.context);
        }

        this.armReviveWelcomeTimeout();
        log.debug('Finished restart');
    }

    resize(): void {
        const x = this.camera.x,
            y = this.camera.y,
            newScale = this.renderer.getScaleFactor();

        this.renderer.rescale(newScale);
        this.camera = this.renderer.camera;
        const bounds = this.resolveCameraWorldBounds();
        if (bounds) {
            this.camera.setPosition(
                Math.max(bounds.minX, Math.min(x, bounds.maxX)),
                Math.max(bounds.minY, Math.min(y, bounds.maxY))
            );
        } else {
            this.camera.setPosition(x, y);
        }

        this.resetZone();
    }

    resolveCameraWorldBounds():
        | {
              minX: number;
              maxX: number;
              minY: number;
              maxY: number;
          }
        | null {
        const map = this.map;
        if (!map) {
            return null;
        }

        const mapWorldWidth = map.width * this.renderer.tilesize;
        const mapWorldHeight = map.height * this.renderer.tilesize;
        const viewportWorldWidth = this.renderer.getWidth() / this.renderer.scale;
        const viewportWorldHeight = this.renderer.getHeight() / this.renderer.scale;

        const minX = mapWorldWidth <= viewportWorldWidth ? -(viewportWorldWidth - mapWorldWidth) / 2 : 0;
        const minY = mapWorldHeight <= viewportWorldHeight ? -(viewportWorldHeight - mapWorldHeight) / 2 : 0;
        const maxX = mapWorldWidth <= viewportWorldWidth ? minX : mapWorldWidth - viewportWorldWidth;
        const maxY = mapWorldHeight <= viewportWorldHeight ? minY : mapWorldHeight - viewportWorldHeight;

        return { minX, maxX, minY, maxY };
    }

    updateBars(): void {
        this.emit('playerHealthChange', this.player.hitPoints, this.player.maxHitPoints);
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
            achievement = this.achievements[name] ?? null;

            if (achievement?.isCompleted?.() && isAchievementId(achievement.id) && this.storage.unlockAchievement(achievement.id)) {
                this.kernel.enqueueClientCommand({
                    type: 'clientSendAchievement',
                    achievementId: achievement.id,
                });
                this.emit('achievementUnlock', achievement.id, achievement.name, achievement.desc);
                this.audioManager?.playSound('achievement');
            }
        }
    }

    showNotification(message: string): void {
        this.emit('notification', message);
    }

    removeObsoleteEntities(): void {
        const obsoleteEntities: GridIndexedEntity[] = this.obsoleteEntities ?? [],
            nb = obsoleteEntities.length,
            self = this;

        if (nb > 0) {
            obsoleteEntities.forEach(function (entity: GridIndexedEntity) {
                if (entity.id !== self.player.id) {
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

    checkUndergroundAchievement(): void {
        const music = this.audioManager?.getSurroundingMusic(this.player);

        if (music) {
            if (music.name === 'cave') {
                this.tryUnlockingAchievement('UNDERGROUND');
            }
        }
    }

    forEachEntityAround(x: number, y: number, r: number, callback: (entity: GridIndexedEntity) => void) {
        const map = this.map;
        if (!map) {
            return;
        }
        for (let i = x - r, max_i = x + r; i <= max_i; i += 1) {
            for (let j = y - r, max_j = y + r; j <= max_j; j += 1) {
                if (!map.isOutOfBounds(i, j)) {
                    const ids = this.kernel.getClientRenderIdsAt(i, j);
                    for (const id of ids) {
                        const entity = this.entities[String(id)];
                        if (entity) {
                            callback(entity);
                        }
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
