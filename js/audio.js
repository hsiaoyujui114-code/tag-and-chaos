// 《代號：極限追逐》(Tag & Chaos) — Procedural Web Audio 8-Bit Sound Engine

class RetroAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.heartbeatTimer = 0;
  }

  ensureCtx() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setMuted(m) {
    this.muted = m;
  }

  tone(freq, dur = 0.1, type = 'square', vol = 0.08, slideTo = null, delay = 0) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + dur);
    }
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  }

  noise(dur = 0.12, vol = 0.08, delay = 0) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const sampleRate = ctx.sampleRate;
    const len = Math.floor(sampleRate * dur);
    const buf = ctx.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }

  playPickup() {
    this.tone(523, 0.06, 'square', 0.07, null, 0);
    this.tone(659, 0.06, 'square', 0.07, null, 0.055);
    this.tone(784, 0.1, 'square', 0.08, null, 0.11);
  }

  playDash() {
    this.tone(240, 0.14, 'triangle', 0.09, 520, 0);
    this.noise(0.07, 0.04, 0);
  }

  playLunge() {
    this.tone(180, 0.16, 'sawtooth', 0.09, 95, 0);
  }

  playCatch() {
    this.tone(440, 0.08, 'sawtooth', 0.1, 140, 0);
    this.tone(220, 0.18, 'square', 0.11, 80, 0.07);
    this.noise(0.1, 0.07, 0.02);
  }

  playShield() {
    this.tone(330, 0.08, 'sine', 0.1, 880, 0);
    this.tone(880, 0.14, 'triangle', 0.08, 440, 0.08);
  }

  playSlip() {
    this.tone(600, 0.18, 'sine', 0.09, 220, 0);
    this.tone(260, 0.15, 'sine', 0.08, 520, 0.14);
  }

  playFreeze() {
    this.tone(1100, 0.08, 'triangle', 0.07, 1600, 0);
    this.tone(1400, 0.12, 'sine', 0.07, 700, 0.06);
  }

  playSnap() {
    this.noise(0.09, 0.13, 0);
    this.tone(900, 0.06, 'square', 0.1, 180, 0);
    this.tone(320, 0.12, 'sawtooth', 0.08, 120, 0.05);
  }

  playBounce() {
    this.tone(160, 0.2, 'sine', 0.11, 640, 0);
  }

  playTeleport() {
    this.tone(320, 0.07, 'sine', 0.08, 960, 0);
    this.tone(960, 0.11, 'sine', 0.08, 420, 0.07);
  }

  playGate() {
    this.tone(140, 0.14, 'square', 0.09, 85, 0);
    this.noise(0.08, 0.06, 0.04);
  }

  playCrateBreak() {
    this.noise(0.14, 0.1, 0);
    this.tone(190, 0.1, 'square', 0.07, 70, 0);
  }

  playFlashbang() {
    this.noise(0.25, 0.12, 0);
    this.tone(2200, 0.35, 'sine', 0.05, 1800, 0.02);
  }

  playSmoke() {
    this.noise(0.22, 0.08, 0);
    this.tone(180, 0.15, 'triangle', 0.05, 90, 0);
  }

  playEvent() {
    this.tone(392, 0.09, 'square', 0.08, null, 0);
    this.tone(523, 0.09, 'square', 0.08, null, 0.09);
    this.tone(659, 0.18, 'square', 0.09, null, 0.18);
  }

  playKey() {
    this.tone(880, 0.07, 'triangle', 0.09, null, 0);
    this.tone(1174, 0.08, 'triangle', 0.09, null, 0.07);
    this.tone(1567, 0.15, 'triangle', 0.1, null, 0.14);
  }

  playEmote() {
    this.tone(720, 0.05, 'sine', 0.05, 920, 0);
  }

  playCountdown(go = false) {
    if (go) {
      this.tone(880, 0.14, 'square', 0.09, null, 0);
      this.tone(1174, 0.22, 'square', 0.09, null, 0.08);
    } else {
      this.tone(440, 0.1, 'square', 0.07, null, 0);
    }
  }

  playHeartbeat(intensity = 0.5) {
    const v = 0.04 + intensity * 0.07;
    this.tone(72, 0.08, 'sine', v, 44, 0);
    this.tone(60, 0.1, 'sine', v * 0.75, 38, 0.11);
  }

  playWin() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => this.tone(n, 0.14, 'square', 0.08, null, i * 0.11));
  }

  playLose() {
    const notes = [392, 349, 311, 261];
    notes.forEach((n, i) => this.tone(n, 0.16, 'sawtooth', 0.07, null, i * 0.13));
  }
}

export const audio = new RetroAudio();
