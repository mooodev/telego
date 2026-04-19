export class SoundManager {
    constructor() {
        this.enabled = true;
        this.buffers = {
            stonePlace: this.createAudio('sounds/stonePlace.mp3', 0.55),
            stonePlaceCharge: this.createAudio('sounds/stonePlaceCharge.mp3', 0.6),
            stoneCapture: this.createAudio('sounds/stoneCapture.mp3', 0.55),
        };
    }

    createAudio(src, volume) {
        const audio = new Audio(src);
        audio.preload = 'auto';
        audio.volume = volume;
        return audio;
    }

    play(name) {
        if (!this.enabled) return;
        const buffer = this.buffers[name];
        if (!buffer) return;

        const instance = buffer.cloneNode();
        instance.volume = buffer.volume;
        instance.play().catch(() => {});
    }

    playStonePlacement({ chargeDuration = 0, captureCount = 0 }) {
        const isCharged = chargeDuration >= 240;
        this.play(isCharged ? 'stonePlaceCharge' : 'stonePlace');
        if (captureCount > 0) {
            window.setTimeout(() => this.play('stoneCapture'), isCharged ? 120 : 60);
        }
    }
}
