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
    gain: GainNode;
    stopHandle: ReturnType<typeof setTimeout> | null;
};

type ActiveSfxVoice = {
    key: AudioSoundKey;
    source: AudioBufferSourceNode;
    priority: number;
    startedAtMs: number;
};

type SfxStats = {
    requested: number;
    played: number;
    droppedDisabled: number;
    droppedNoBuffer: number;
    droppedDuplicate: number;
    droppedCooldown: number;
    droppedVoiceBudget: number;
};

type AudioContextCtor = new () => AudioContext;

const AUDIO_EXTENSION = 'ogg';
const SOUND_BASE_PATH = 'audio/sounds/';
const MUSIC_BASE_PATH = 'audio/music/';
const MUSIC_FADE_DURATION_SECONDS = 0.4;
const MAX_SFX_VOICES = 10;
const SFX_STATS_LOG_THROTTLE_MS = 1000;
const SOUND_COOLDOWN_MS: Readonly<Partial<Record<AudioSoundKey, number>>> = {
    hit1: 80,
    hit2: 80,
    hurt: 100,
    chat: 120,
    loot: 100,
    heal: 160,
    npc: 220,
    'npc-end': 220,
    teleport: 250,
};
const SOUND_PRIORITY: Readonly<Partial<Record<AudioSoundKey, number>>> = {
    death: 100,
    revive: 95,
    achievement: 90,
    teleport: 85,
    hurt: 70,
    heal: 65,
    kill1: 60,
    kill2: 60,
    chest: 55,
    loot: 50,
    chat: 35,
    npc: 30,
    'npc-end': 30,
    hit1: 20,
    hit2: 20,
    firefox: 10,
    noloot: 10,
};

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
    private fadingOutMusic: ActiveMusic[];
    private queuedSfx: AudioSoundKey[];
    private queuedSfxFlushHandle: ReturnType<typeof setTimeout> | null;
    private activeSfxVoices: ActiveSfxVoice[];
    private sfxLastPlayedAtMs: Partial<Record<AudioSoundKey, number>>;
    private sfxStats: SfxStats;
    private lastSfxStatsLogAtMs: number;
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
        this.fadingOutMusic = [];
        this.queuedSfx = [];
        this.queuedSfxFlushHandle = null;
        this.activeSfxVoices = [];
        this.sfxLastPlayedAtMs = {};
        this.sfxStats = {
            requested: 0,
            played: 0,
            droppedDisabled: 0,
            droppedNoBuffer: 0,
            droppedDuplicate: 0,
            droppedCooldown: 0,
            droppedVoiceBudget: 0,
        };
        this.lastSfxStatsLogAtMs = 0;
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
        this.sfxStats.requested += 1;

        if (!this.enabled || !this.context || !this.sfxGain) {
            this.sfxStats.droppedDisabled += 1;
            return;
        }

        this.queuedSfx.push(name);
        this.scheduleSfxFlush();
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

        this.transitionToMusic(music.name);
    }

    getSfxStats(): Readonly<SfxStats> {
        return { ...this.sfxStats };
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

    private transitionToMusic(name: MusicKey): void {
        if (!this.context || !this.musicGain) {
            return;
        }

        const context = this.context;
        const startPlayback = (): void => {
            this.stopFadingOutMusic();

            const nextMusic = this.createLoopingMusic(name);
            if (!nextMusic) {
                return;
            }

            nextMusic.gain.gain.setValueAtTime(0, context.currentTime);
            nextMusic.gain.gain.linearRampToValueAtTime(1, context.currentTime + MUSIC_FADE_DURATION_SECONDS);

            const previousMusic = this.currentMusic;
            if (previousMusic) {
                this.fadeOutAndStop(previousMusic);
            }

            this.currentMusic = nextMusic;
        };

        if (context.state !== 'running') {
            void this.resumeAudioContext().then(() => {
                if (this.context?.state === 'running' && this.enabled) {
                    startPlayback();
                }
            });
            return;
        }

        startPlayback();
    }

    private createLoopingMusic(name: MusicKey): ActiveMusic | null {
        if (!this.context || !this.musicGain) {
            return null;
        }

        const buffer = this.audioBuffers[name];
        if (!buffer) {
            return null;
        }

        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const gain = this.context.createGain();
        gain.gain.value = 1;

        source.connect(gain);
        gain.connect(this.musicGain);
        source.start(0);

        return {
            name,
            source,
            gain,
            stopHandle: null,
        };
    }

    private fadeOutAndStop(music: ActiveMusic): void {
        if (!this.context) {
            return;
        }

        music.gain.gain.cancelScheduledValues(this.context.currentTime);
        music.gain.gain.setValueAtTime(music.gain.gain.value, this.context.currentTime);
        music.gain.gain.linearRampToValueAtTime(0, this.context.currentTime + MUSIC_FADE_DURATION_SECONDS);

        const stopDelayMs = Math.ceil(MUSIC_FADE_DURATION_SECONDS * 1000) + 50;
        music.stopHandle = setTimeout(() => {
            music.source.stop();
            music.source.disconnect();
            music.gain.disconnect();
            music.stopHandle = null;
            this.fadingOutMusic = this.fadingOutMusic.filter((entry) => entry !== music);
        }, stopDelayMs);

        this.fadingOutMusic.push(music);
    }

    private stopFadingOutMusic(): void {
        for (const music of this.fadingOutMusic) {
            if (music.stopHandle) {
                clearTimeout(music.stopHandle);
                music.stopHandle = null;
            }
            music.source.stop();
            music.source.disconnect();
            music.gain.disconnect();
        }
        this.fadingOutMusic = [];
    }

    private stopCurrentMusic(): void {
        this.stopFadingOutMusic();
        this.stopAllSfxVoices();
        this.clearQueuedSfx();

        if (!this.currentMusic) {
            return;
        }

        this.currentMusic.source.stop();
        this.currentMusic.source.disconnect();
        this.currentMusic.gain.disconnect();
        if (this.currentMusic.stopHandle) {
            clearTimeout(this.currentMusic.stopHandle);
            this.currentMusic.stopHandle = null;
        }
        this.currentMusic = null;
    }

    private scheduleSfxFlush(): void {
        if (this.queuedSfxFlushHandle) {
            return;
        }

        this.queuedSfxFlushHandle = setTimeout(() => {
            this.queuedSfxFlushHandle = null;
            this.flushQueuedSfx();
        }, 0);
    }

    private clearQueuedSfx(): void {
        if (this.queuedSfxFlushHandle) {
            clearTimeout(this.queuedSfxFlushHandle);
            this.queuedSfxFlushHandle = null;
        }
        this.queuedSfx = [];
    }

    private getSfxPriority(key: AudioSoundKey): number {
        return SOUND_PRIORITY[key] ?? 40;
    }

    private getSfxCooldownMs(key: AudioSoundKey): number {
        return SOUND_COOLDOWN_MS[key] ?? 0;
    }

    private pruneFinishedSfxVoices(): void {
        this.activeSfxVoices = this.activeSfxVoices.filter((voice) => voice.source.buffer !== null);
    }

    private stopAllSfxVoices(): void {
        for (const voice of this.activeSfxVoices) {
            voice.source.stop();
            voice.source.disconnect();
            voice.source.buffer = null;
        }
        this.activeSfxVoices = [];
    }

    private flushQueuedSfx(): void {
        if (!this.enabled || !this.context || !this.sfxGain) {
            this.sfxStats.droppedDisabled += this.queuedSfx.length;
            this.queuedSfx = [];
            return;
        }

        if (this.context.state !== 'running') {
            void this.resumeAudioContext();
            this.sfxStats.droppedDisabled += this.queuedSfx.length;
            this.queuedSfx = [];
            return;
        }

        this.pruneFinishedSfxVoices();
        const nowMs = Date.now();
        const queue = this.queuedSfx;
        this.queuedSfx = [];

        if (queue.length === 0) {
            return;
        }

        const deduped: Array<{ key: AudioSoundKey; priority: number; index: number }> = [];
        const seen = new Set<AudioSoundKey>();
        for (let index = 0; index < queue.length; index += 1) {
            const key = queue[index];
            if (!key) {
                continue;
            }
            if (seen.has(key)) {
                this.sfxStats.droppedDuplicate += 1;
                continue;
            }
            seen.add(key);
            deduped.push({ key, priority: this.getSfxPriority(key), index });
        }

        deduped.sort((left, right) => {
            if (right.priority !== left.priority) {
                return right.priority - left.priority;
            }
            return left.index - right.index;
        });

        for (const entry of deduped) {
            const cooldownMs = this.getSfxCooldownMs(entry.key);
            const lastPlayedAtMs = this.sfxLastPlayedAtMs[entry.key] ?? 0;
            if (cooldownMs > 0 && nowMs - lastPlayedAtMs < cooldownMs) {
                this.sfxStats.droppedCooldown += 1;
                continue;
            }

            const buffer = this.audioBuffers[entry.key];
            if (!buffer) {
                this.sfxStats.droppedNoBuffer += 1;
                continue;
            }

            if (this.activeSfxVoices.length >= MAX_SFX_VOICES) {
                const preemptible = this.activeSfxVoices
                    .filter((voice) => voice.priority < entry.priority)
                    .sort((left, right) => left.priority - right.priority || left.startedAtMs - right.startedAtMs)[0];
                if (!preemptible) {
                    this.sfxStats.droppedVoiceBudget += 1;
                    continue;
                }
                preemptible.source.stop();
                preemptible.source.disconnect();
                preemptible.source.buffer = null;
                this.activeSfxVoices = this.activeSfxVoices.filter((voice) => voice !== preemptible);
            }

            const source = this.context.createBufferSource();
            source.buffer = buffer;
            source.connect(this.sfxGain);
            source.start(0);
            source.onended = () => {
                source.disconnect();
                source.buffer = null;
                this.activeSfxVoices = this.activeSfxVoices.filter((voice) => voice.source !== source);
            };
            this.activeSfxVoices.push({
                key: entry.key,
                source,
                priority: entry.priority,
                startedAtMs: nowMs,
            });
            this.sfxLastPlayedAtMs[entry.key] = nowMs;
            this.sfxStats.played += 1;
        }

        this.logSfxStatsIfNeeded(nowMs);
    }

    private logSfxStatsIfNeeded(nowMs: number): void {
        const droppedTotal = this.sfxStats.droppedDisabled
            + this.sfxStats.droppedNoBuffer
            + this.sfxStats.droppedDuplicate
            + this.sfxStats.droppedCooldown
            + this.sfxStats.droppedVoiceBudget;
        if (droppedTotal === 0) {
            return;
        }
        if (nowMs - this.lastSfxStatsLogAtMs < SFX_STATS_LOG_THROTTLE_MS) {
            return;
        }

        this.lastSfxStatsLogAtMs = nowMs;
        log.debug(
            'audio.sfx'
                + ` requested=${this.sfxStats.requested}`
                + ` played=${this.sfxStats.played}`
                + ` dropped.disabled=${this.sfxStats.droppedDisabled}`
                + ` dropped.noBuffer=${this.sfxStats.droppedNoBuffer}`
                + ` dropped.duplicate=${this.sfxStats.droppedDuplicate}`
                + ` dropped.cooldown=${this.sfxStats.droppedCooldown}`
                + ` dropped.voiceBudget=${this.sfxStats.droppedVoiceBudget}`
        );
    }
}

export default AudioManager;
