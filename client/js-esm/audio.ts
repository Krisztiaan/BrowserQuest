import Area from './area';
import Detect from './compat/detect';
import log from './compat/log';
import { AUDIO_SOUND_KEYS, MUSIC_KEYS } from './asset-key-domain';
import type { AudioSoundKey, MusicKey } from './asset-key-domain';

type ManagedAudio = HTMLAudioElement & {
    fadingOut?: ReturnType<typeof setInterval> | null;
    fadingIn?: ReturnType<typeof setInterval> | null;
};

type AreaMusic = {
    sound: ManagedAudio | null;
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

class AudioManager {
    enabled: boolean;
    extension: string;
    sounds: Partial<Record<MusicKey | AudioSoundKey, ManagedAudio[]>>;
    game: AudioGame;
    currentMusic: AreaMusic | null;
    areas: Array<Area & { musicName?: MusicKey }>;
    musicNames: MusicKey[];
    soundNames: AudioSoundKey[];

    constructor(game: AudioGame) {
        this.enabled = true;
        this.extension = Detect.canPlayMP3() ? 'mp3' : 'ogg';
        this.sounds = {};
        this.game = game;
        this.currentMusic = null;
        this.areas = [];
        this.musicNames = [...MUSIC_KEYS];
        this.soundNames = [...AUDIO_SOUND_KEYS];

        const loadMusicFiles = () => {
            // disable music on mobile devices
            if (!this.game.renderer.mobile) {
                log.info('Loading music files...');
                // Load the village music first, as players always start here
                const firstMusic = this.musicNames.shift();
                if (firstMusic) {
                    this.loadMusic(firstMusic, () => {
                        // Then, load all the other music files
                        this.musicNames.forEach((name) => {
                            this.loadMusic(name);
                        });
                    });
                }
            }
        };

        const loadSoundFiles = () => {
            let counter = this.soundNames.length;
            log.info('Loading sound files...');
            this.soundNames.forEach((name) => {
                this.loadSound(name, () => {
                    counter -= 1;
                    if (counter === 0) {
                        // Disable music on Safari - See bug 738008
                        if (!Detect.isSafari()) {
                            loadMusicFiles();
                        }
                    }
                });
            });
        };

        if (!(Detect.isSafari() && Detect.isWindows())) {
            loadSoundFiles();
        } else {
            this.enabled = false; // Disable audio on Safari Windows
        }
    }

    toggle(): void {
        if (this.enabled) {
            this.enabled = false;

            if (this.currentMusic) {
                this.resetMusic(this.currentMusic);
            }
        } else {
            this.enabled = true;

            if (this.currentMusic) {
                this.currentMusic = null;
            }
            this.updateMusic();
        }
    }

    load(
        basePath: string,
        name: MusicKey | AudioSoundKey,
        loaded_callback?: (() => void) | null,
        channels = 1
    ): void {
        const path = basePath + name + '.' + this.extension;
        const sound = document.createElement('audio') as ManagedAudio;

        const onReady = () => {
            sound.removeEventListener('canplaythrough', onReady, false);
            log.debug(path + ' is ready to play.');
            if (loaded_callback) {
                loaded_callback();
            }
        };
        sound.addEventListener('canplaythrough', onReady, false);
        sound.addEventListener('error', () => {
            log.error('Error: ' + path + ' could not be loaded.');
            this.sounds[name] = [];
        }, false);

        sound.preload = 'auto';
        sound.src = path;
        sound.load();

        this.sounds[name] = [sound];
        for (let i = 0; i < channels - 1; i += 1) {
            this.sounds[name].push(sound.cloneNode(true) as ManagedAudio);
        }
    }

    loadSound(name: AudioSoundKey, handleLoaded?: (() => void) | null): void {
        this.load('audio/sounds/', name, handleLoaded, 4);
    }

    loadMusic(name: MusicKey, handleLoaded?: (() => void) | null): void {
        this.load('audio/music/', name, handleLoaded, 1);
        const music = this.sounds[name]?.[0];
        if (music) {
            music.loop = true;
            music.addEventListener('ended', function () { music.play(); }, false);
        }
    }

    getSound(name: MusicKey | AudioSoundKey): ManagedAudio | null {
        if (!this.sounds[name] || this.sounds[name].length === 0) {
            return null;
        }
        let sound = this.sounds[name].find((entry) => entry.ended || entry.paused) || null;
        if (sound && sound.ended) {
            sound.currentTime = 0;
        } else {
            sound = this.sounds[name][0];
        }
        return sound;
    }

    playSound(name: AudioSoundKey): void {
        const sound = this.enabled && this.getSound(name);
        if (sound) {
            sound.play();
        }
    }

    addArea(x: number, y: number, width: number, height: number, musicName: MusicKey): void {
        const area = new Area(x, y, width, height) as Area & { musicName?: MusicKey };
        area.musicName = musicName;
        this.areas.push(area);
    }

    getSurroundingMusic(entity: AudioEntity | null): AreaMusic | null {
        let music: AreaMusic | null = null;
        const area = this.areas.find((candidate) => candidate.contains(entity));

        if (area && area.musicName) {
            music = { sound: this.getSound(area.musicName), name: area.musicName };
        }
        return music;
    }

    updateMusic(): void {
        if (this.enabled) {
            const music = this.getSurroundingMusic(this.game.player);

            if (music) {
                if (!this.isCurrentMusic(music)) {
                    if (this.currentMusic) {
                        this.fadeOutCurrentMusic();
                    }
                    this.playMusic(music);
                }
            } else {
                this.fadeOutCurrentMusic();
            }
        }
    }

    isCurrentMusic(music: AreaMusic): boolean {
        return !!(this.currentMusic && music.name === this.currentMusic.name);
    }

    playMusic(music: AreaMusic | null): void {
        if (this.enabled && music && music.sound) {
            if (music.sound.fadingOut) {
                this.fadeInMusic(music);
            } else {
                music.sound.volume = 1;
                music.sound.play();
            }
            this.currentMusic = music;
        }
    }

    resetMusic(music: AreaMusic | null): void {
        if (music && music.sound && music.sound.readyState > 0) {
            music.sound.pause();
            music.sound.currentTime = 0;
        }
    }

    fadeOutMusic(music: AreaMusic | null, ended_callback: (music: AreaMusic) => void): void {
        if (music && music.sound && !music.sound.fadingOut) {
            this.clearFadeIn(music);
            music.sound.fadingOut = setInterval(() => {
                const step = 0.02;
                const volume = music.sound ? music.sound.volume - step : 0;

                if (this.enabled && music.sound && volume >= step) {
                    music.sound.volume = volume;
                } else if (music.sound) {
                    music.sound.volume = 0;
                    this.clearFadeOut(music);
                    ended_callback(music);
                }
            }, 50);
        }
    }

    fadeInMusic(music: AreaMusic | null): void {
        if (music && music.sound && !music.sound.fadingIn) {
            this.clearFadeOut(music);
            music.sound.fadingIn = setInterval(() => {
                const step = 0.01;
                const volume = music.sound ? music.sound.volume + step : 1;

                if (this.enabled && music.sound && volume < 1 - step) {
                    music.sound.volume = volume;
                } else if (music.sound) {
                    music.sound.volume = 1;
                    this.clearFadeIn(music);
                }
            }, 30);
        }
    }

    clearFadeOut(music: AreaMusic): void {
        if (music.sound && music.sound.fadingOut) {
            clearInterval(music.sound.fadingOut);
            music.sound.fadingOut = null;
        }
    }

    clearFadeIn(music: AreaMusic): void {
        if (music.sound && music.sound.fadingIn) {
            clearInterval(music.sound.fadingIn);
            music.sound.fadingIn = null;
        }
    }

    fadeOutCurrentMusic(): void {
        if (this.currentMusic) {
            this.fadeOutMusic(this.currentMusic, (music) => {
                this.resetMusic(music);
            });
            this.currentMusic = null;
        }
    }
}

export default AudioManager;
