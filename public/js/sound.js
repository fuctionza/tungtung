/**
 * TungTung Sound Engine (Web Audio API procedural sound & upbeat BGM synthesizer)
 * Zero external audio files required - works instantly and reliably on all devices!
 */

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.bgmPlaying = false;
        this.bgmTimer = null;
        this.bgmStep = 0;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.muted) {
            this.stopBGM();
        } else {
            this.startBGM();
        }
        return this.muted;
    }

    // Upbeat Looping Game BGM (Pentatonic Chords & Walking Bass)
    startBGM() {
        if (this.muted || this.bgmPlaying) return;
        this.init();
        if (!this.ctx) return;
        this.bgmPlaying = true;
        this.playBGMStep();
    }

    stopBGM() {
        this.bgmPlaying = false;
        if (this.bgmTimer) {
            clearTimeout(this.bgmTimer);
            this.bgmTimer = null;
        }
    }

    playBGMStep() {
        if (!this.bgmPlaying || this.muted) return;
        this.init();
        if (!this.ctx) return;

        // Upbeat, cute chord progression (C - G - Am - F)
        const tempo = 124; // BPM
        const stepDuration = 60 / tempo / 2; // Eighth note duration

        const chords = [
            [261.63, 329.63, 392.00, 523.25], // C Major
            [196.00, 246.94, 293.66, 392.00], // G Major
            [220.00, 261.63, 329.63, 440.00], // A Minor
            [174.61, 220.00, 261.63, 349.23]  // F Major
        ];

        const bassNotes = [130.81, 98.00, 110.00, 87.31]; // C3, G2, A2, F2

        const chordIdx = Math.floor((this.bgmStep % 32) / 8);
        const beatInMeasure = this.bgmStep % 8;
        const currentChord = chords[chordIdx];
        const currentBass = bassNotes[chordIdx];

        const now = this.ctx.currentTime;

        // Bass on beats 0, 3, 4, 6
        if (beatInMeasure === 0 || beatInMeasure === 3 || beatInMeasure === 4 || beatInMeasure === 6) {
            const bOsc = this.ctx.createOscillator();
            const bGain = this.ctx.createGain();
            bOsc.type = 'triangle';
            bOsc.frequency.setValueAtTime(currentBass, now);

            bGain.gain.setValueAtTime(0.09, now);
            bGain.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 1.6);

            bOsc.connect(bGain);
            bGain.connect(this.ctx.destination);

            bOsc.start(now);
            bOsc.stop(now + stepDuration * 1.6);
        }

        // Playful Arpeggiated Melody on each eighth step
        const noteSequence = [0, 1, 2, 3, 2, 1, 3, 1];
        const noteFreq = currentChord[noteSequence[beatInMeasure]];

        const mOsc = this.ctx.createOscillator();
        const mGain = this.ctx.createGain();
        mOsc.type = 'sine';
        mOsc.frequency.setValueAtTime(noteFreq, now);

        mGain.gain.setValueAtTime(0.035, now);
        mGain.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 0.95);

        mOsc.connect(mGain);
        mGain.connect(this.ctx.destination);

        mOsc.start(now);
        mOsc.stop(now + stepDuration * 0.95);

        this.bgmStep++;
        this.bgmTimer = setTimeout(() => {
            this.playBGMStep();
        }, stepDuration * 1000);
    }

    // UI Click Tap
    playClick() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }

    // Cash Register "Cha-ching"
    playCashRegister() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const freqs = [987.77, 1318.51, 1975.53]; // B5, E6, B6
        
        freqs.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + idx * 0.06);

            gain.gain.setValueAtTime(0.2, now + idx * 0.06);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.2);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + idx * 0.06);
            osc.stop(now + idx * 0.06 + 0.2);
        });
    }

    // Knife Chop / Slice Sound
    playChop() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        // White noise burst for knife slice
        const bufferSize = this.ctx.sampleRate * 0.08;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1200, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        // Low thud of cutting board
        const osc = this.ctx.createOscillator();
        const thudGain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);

        thudGain.gain.setValueAtTime(0.4, now);
        thudGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

        osc.connect(thudGain);
        thudGain.connect(this.ctx.destination);

        noise.start(now);
        osc.start(now);
        noise.stop(now + 0.08);
        osc.stop(now + 0.08);
    }

    // Sizzling Pan Sound Effect
    playSizzle() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const duration = 0.6;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (0.5 + Math.sin(i * 0.05) * 0.5);
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2500, now);
        filter.Q.setValueAtTime(1.5, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start(now);
        noise.stop(now + duration);
    }

    // Success Chime / Correct Answer
    playSuccess() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.08);

            gain.gain.setValueAtTime(0.2, now + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + idx * 0.08);
            osc.stop(now + idx * 0.08 + 0.35);
        });
    }

    // Error / Wrong Answer
    playError() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.setValueAtTime(130, now + 0.1);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.3);
    }

    // Triumphant Fanfare for Podium / Winner
    playFanfare() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const melody = [
            { f: 523.25, t: 0.0, d: 0.15 },
            { f: 523.25, t: 0.15, d: 0.15 },
            { f: 523.25, t: 0.30, d: 0.15 },
            { f: 659.25, t: 0.45, d: 0.3 },
            { f: 587.33, t: 0.75, d: 0.15 },
            { f: 659.25, t: 0.90, d: 0.15 },
            { f: 783.99, t: 1.05, d: 0.6 }
        ];

        melody.forEach(n => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(n.f, now + n.t);

            gain.gain.setValueAtTime(0.25, now + n.t);
            gain.gain.exponentialRampToValueAtTime(0.01, now + n.t + n.d);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + n.t);
            osc.stop(now + n.t + n.d);
        });
    }

    // Pop In Animation sound
    playPop() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.08);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.09);
    }

    // Mortar & Pestle Pounding Sound Effect
    playPound() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        // Deep stone impact thud
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.12);
    }

    // Oven / Timer Ding chime
    playDing() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1760, now); // A6 bell

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.6);
    }
}

// Global instance
window.sound = new SoundEngine();

// Auto-start BGM on first user click, tap, or keypress (bypasses browser autoplay policies)
['click', 'touchstart', 'keydown'].forEach(evtType => {
    window.addEventListener(evtType, () => {
        if (window.sound) {
            window.sound.init();
            if (!window.sound.bgmPlaying && !window.sound.muted) {
                window.sound.startBGM();
            }
        }
    }, { once: false });
});
