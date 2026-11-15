class CosmicAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!this.ctx) {
      try {
        this.ctx = new Ctx();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playTone(freq: number, duration = 0.14, type: OscillatorType = 'sine', gainPeak = 0.08) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playClick() {
    this.playTone(520, 0.07, 'triangle', 0.06);
  }

  playPlace() {
    this.playTone(440, 0.09, 'sine', 0.07);
    setTimeout(() => this.playTone(660, 0.09, 'sine', 0.05), 45);
  }

  playStep(stepIdx = 0) {
    const scale = [392, 440, 493.88, 587.33, 659.25, 783.99];
    const freq = scale[stepIdx % scale.length];
    this.playTone(freq, 0.14, 'sine', 0.06);
  }

  playPulse() {
    this.playTone(587.33, 0.12, 'triangle', 0.05);
  }

  playSoftError() {
    this.playTone(220, 0.22, 'sine', 0.07);
    setTimeout(() => this.playTone(174.61, 0.28, 'sine', 0.06), 90);
  }

  playVictory() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, 0.34, 'sine', 0.075), idx * 95);
    });
  }
}

export const cosmicSound = new CosmicAudioEngine();
