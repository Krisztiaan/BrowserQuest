import Area from './area';
import log from './platform/log';
import { AUDIO_SOUND_KEYS, MUSIC_KEYS } from './asset-key-domain';
import type { AudioSoundKey, MusicKey } from './asset-key-domain';

type AreaMusic = {
    name: MusicKey;
};

type AudioEntity = {
    gridX: number;
    gridY: number;
};

type AudioGame = {
    player: AudioEntity;
    renderer: {
        mobile: boolean;
    };
};

type AreaMusicRegion = Area & {
    musicName: MusicKey;
};

type ActiveMusic = {
    name: MusicKey;
    source: AudioBufferSourceNode;
};

type AudioContextCtor = new () => AudioContext;

const AUDIO_EXTENSION = 'mp3';
const SOUND_BASE_PATH = 'audio/sounds/';
const MUSIC_BASE_PATH = 'audio/music/';

class AudioManager {
    enabled: boolean;
    game: AudioGame;
    areas: AreaMusicRegion[];

    private context: AudioContext | null;
    private masterGain: GainNode | null;
    private musicGain: GainNode | null;
    private sfxGain: GainNode | null;
    private uiGain: GainNode | null;
    private audioBuffers: Partial<Record<MusicKey | AudioSoundKey, AudioBuffer>>;
    private preloadPromise: Promise<void> | null;
    private currentMusic: ActiveMusic | null;
    private unlockListenersInstalled: boolean;

    constructor(game: AudioGame) {
        this.enabled = true;
        this.game = game;
        this.areas = [];

        this.context = null;
        this.masterGain = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.uiGain = null;
        this.audioBuffers = {};
        this.preloadPromise = null;
        this.currentMusic = null;
        this.unlockListenersInstalled = false;

        const contextCtor = this.resolveAudioContextCtor();
        if (!contextCtor) {
            log.error('WebAudio is not supported in this browser. Audio is disabled.');
            this.enabled = false;
            return;
        }

        this.context = new contextCtor();
        this.masterGain = this.context.createGain();
        this.musicGain = this.context.createGain();
        this.sfxGain = this.context.createGain();
        this.uiGain = this.context.createGain();

        this.masterGain.gain.value = 1;
        this.musicGain.gain.value = 1;
        this.sfxGain.gain.value = 1;
        this.uiGain.gain.value = 1;

        this.musicGain.connect(this.masterGain);
        this.sfxGain.connect(this.masterGain);
        this.uiGain.connect(this.masterGain);
        this.masterGain.connect(this.context.destination);

        this.installUnlockListeners();
        this.preloadPromise = this.preloadAssets();
    }

    toggle(): void {
        if (!this.context || !this.masterGain) {
            return;
        }

        if (this.enabled) {
            this.enabled = false;
            this.stopCurrentMusic();
            this.masterGain.gain.value = 0;
            return;
        }

        this.enabled = true;
        this.masterGain.gain.value = 1;
        this.updateMusic();
    }

    playSound(name: AudioSoundKey): void {
        if (!this.enabled || !this.context || !this.sfxGain) {
            return;
        }

        const buffer = this.audioBuffers[name];
        if (!buffer) {
            return;
        }

        if (this.context.state !== 'running') {
            void this.resumeAudioContext();
            return;
        }

        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.sfxGain);
        source.start(0);
    }

    addArea(x: number, y: number, width: number, height: number, musicName: MusicKey): void {
        const area = new Area(x, y, width, height) as AreaMusicRegion;
        area.musicName = musicName;
        this.areas.push(area);
    }

    getSurroundingMusic(entity: AudioEntity | null): AreaMusic | null {
        const area = this.areas.find((candidate) => candidate.contains(entity));
        if (!area) {
            return null;
        }
        return { name: area.musicName };
    }

    updateMusic(): void {
        if (!this.enabled) {
            this.stopCurrentMusic();
            return;
        }

        const music = this.getSurroundingMusic(this.game.player);
        if (!music) {
            this.stopCurrentMusic();
            return;
        }

        if (this.currentMusic?.name === music.name) {
            return;
        }

        this.playMusic(music.name);
    }

    private resolveAudioContextCtor(): AudioContextCtor | null {
        const globalScope = globalThis as typeof globalThis & { webkitAudioContext?: AudioContextCtor };
        if (typeof globalScope.AudioContext === 'function') {
            return globalScope.AudioContext;
        }
        if (typeof globalScope.webkitAudioContext === 'function') {
            return globalScope.webkitAudioContext;
        }
        return null;
    }

    private installUnlockListeners(): void {
        if (this.unlockListenersInstalled || typeof document === 'undefined') {
            return;
        }

        document.addEventListener('pointerdown', this.handleUnlockGesture, { passive: true });
        document.addEventListener('touchstart', this.handleUnlockGesture, { passive: true });
        document.addEventListener('keydown', this.handleUnlockGesture);
        this.unlockListenersInstalled = true;
    }

    private removeUnlockListeners(): void {
        if (!this.unlockListenersInstalled || typeof document === 'undefined') {
            return;
        }

        document.removeEventListener('pointerdown', this.handleUnlockGesture);
        document.removeEventListener('touchstart', this.handleUnlockGesture);
        document.removeEventListener('keydown', this.handleUnlockGesture);
        this.unlockListenersInstalled = false;
    }

    private readonly handleUnlockGesture = (): void => {
        void this.resumeAudioContext();
    };

    private async resumeAudioContext(): Promise<void> {
        const context = this.context;
        if (!context) {
            return;
        }

        if (context.state !== 'running') {
            try {
                await context.resume();
            } catch (error) {
                log.debug('Audio context resume deferred: ' + String(error));
                return;
            }
        }

        if (context.state !== 'running') {
            return;
        }

        this.removeUnlockListeners();
        this.updateMusic();
    }

    private async preloadAssets(): Promise<void> {
        if (!this.context) {
            return;
        }

        log.info('Loading sound files...');
        await Promise.all(AUDIO_SOUND_KEYS.map((name) => this.preloadBuffer(name, SOUND_BASE_PATH)));

        if (this.game.renderer.mobile) {
            return;
        }

        log.info('Loading music files...');
        const [firstMusic, ...remainingMusic] = [...MUSIC_KEYS];
        await this.preloadBuffer(firstMusic, MUSIC_BASE_PATH);
        await Promise.all(remainingMusic.map((name) => this.preloadBuffer(name, MUSIC_BASE_PATH)));
    }

    private async preloadBuffer(name: MusicKey | AudioSoundKey, basePath: string): Promise<void> {
        if (!this.context) {
            return;
        }

        const path = `${basePath}${name}.${AUDIO_EXTENSION}`;

        try {
            const response = await fetch(path, {
                method: 'GET',
                cache: 'force-cache',
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const encoded = await response.arrayBuffer();
            const decoded = await this.context.decodeAudioData(encoded.slice(0));
            this.audioBuffers[name] = decoded;
            log.debug(path + ' is ready to play.');
        } catch {
            log.error('Error: ' + path + ' could not be loaded.');
        }
    }

    private playMusic(name: MusicKey): void {
        if (!this.context || !this.musicGain) {
            return;
        }

        const startPlayback = (): void => {
            const buffer = this.audioBuffers[name];
            if (!buffer || !this.context || !this.musicGain) {
                return;
            }

            this.stopCurrentMusic();

            const source = this.context.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.connect(this.musicGain);
            source.start(0);
            this.currentMusic = { name, source };
        };

        if (this.context.state !== 'running') {
            void this.resumeAudioContext().then(() => {
                if (this.context?.state === 'running' && this.enabled) {
                    startPlayback();
                }
            });
            return;
        }

        startPlayback();
    }

    private stopCurrentMusic(): void {
        if (!this.currentMusic) {
            return;
        }

        this.currentMusic.source.stop();
        this.currentMusic.source.disconnect();
        this.currentMusic = null;
    }
}

export default AudioManager;
