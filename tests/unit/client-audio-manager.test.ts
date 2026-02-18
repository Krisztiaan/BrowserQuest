import { afterEach, beforeEach, expect, test } from 'bun:test';
import AudioManager from '../../client/audio';

type MockAudioSource = {
    buffer: AudioBuffer | null;
    loop: boolean;
    started: number;
    stopped: number;
    connect(node: unknown): void;
    disconnect(): void;
    start(when?: number): void;
    stop(when?: number): void;
};

type MockGain = {
    gain: {
        value: number;
        setValueAtTime(value: number, when: number): void;
        linearRampToValueAtTime(value: number, when: number): void;
        cancelScheduledValues(when: number): void;
    };
    connect(node: unknown): void;
    disconnect(): void;
};

class FakeAudioContext {
    state: AudioContextState = 'running';
    currentTime = 0;
    destination = {} as AudioDestinationNode;
    readonly createdSources: MockAudioSource[] = [];

    createGain(): GainNode {
        const gainControl = {
            value: 1,
            setValueAtTime(value: number): void {
                gainControl.value = value;
            },
            linearRampToValueAtTime(value: number): void {
                gainControl.value = value;
            },
            cancelScheduledValues(): void {},
        };

        const gainNode: MockGain = {
            gain: gainControl,
            connect(): void {},
            disconnect(): void {},
        };
        return gainNode as unknown as GainNode;
    }

    createBufferSource(): AudioBufferSourceNode {
        let startCount = 0;
        let stopCount = 0;
        const source: MockAudioSource = {
            buffer: null,
            loop: false,
            started: 0,
            stopped: 0,
            connect(): void {},
            disconnect(): void {},
            start(): void {
                startCount += 1;
                source.started = startCount;
            },
            stop(): void {
                stopCount += 1;
                source.stopped = stopCount;
            },
        };
        this.createdSources.push(source);
        return source as unknown as AudioBufferSourceNode;
    }

    resume(): Promise<void> {
        this.state = 'running';
        return Promise.resolve();
    }

    decodeAudioData(_audioData: ArrayBuffer): Promise<AudioBuffer> {
        return Promise.resolve({} as AudioBuffer);
    }
}

const originalAudioContext = (globalThis as typeof globalThis & { AudioContext?: unknown }).AudioContext;
const originalFetch = globalThis.fetch;

beforeEach(() => {
    (globalThis as typeof globalThis & { AudioContext?: unknown }).AudioContext = FakeAudioContext;
    globalThis.fetch = () => Promise.resolve(new Response(new Uint8Array([1, 2, 3]).buffer, { status: 200 }));
});

afterEach(() => {
    (globalThis as typeof globalThis & { AudioContext?: unknown }).AudioContext = originalAudioContext;
    globalThis.fetch = originalFetch;
});

test('music update does not spawn duplicate loop sources for the same area', () => {
    const manager = new AudioManager({
        player: { gridX: 5, gridY: 5 },
        renderer: { mobile: false },
    });

    manager.addArea(0, 0, 20, 20, 'village');
    (manager as unknown as { audioBuffers: Partial<Record<string, AudioBuffer>> }).audioBuffers.village = {} as AudioBuffer;

    manager.updateMusic();
    manager.updateMusic();

    const context = (manager as unknown as { context: FakeAudioContext }).context;
    expect(context.createdSources.length).toBe(1);
});

test('rapid area transitions keep at most one fading-out music source', () => {
    const manager = new AudioManager({
        player: { gridX: 1, gridY: 1 },
        renderer: { mobile: false },
    });

    manager.addArea(0, 0, 4, 4, 'village');
    manager.addArea(10, 10, 4, 4, 'beach');

    const internals = manager as unknown as {
        audioBuffers: Partial<Record<string, AudioBuffer>>;
        fadingOutMusic: unknown[];
    };
    internals.audioBuffers.village = {} as AudioBuffer;
    internals.audioBuffers.beach = {} as AudioBuffer;

    manager.updateMusic();

    manager.game.player.gridX = 11;
    manager.game.player.gridY = 11;
    manager.updateMusic();

    manager.game.player.gridX = 1;
    manager.game.player.gridY = 1;
    manager.updateMusic();

    expect(internals.fadingOutMusic.length).toBeLessThanOrEqual(1);
});
