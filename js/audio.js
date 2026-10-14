'use strict';
// ============================================================
// Efeitos sonoros sintetizados com WebAudio (sem arquivos)
// ============================================================
const Sfx = {
  ctx: null, master: null, enabled: true, volume: 0.5, last: {}, noiseBuf: null,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume * 1.2;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  },
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v * 1.2; },

  tone(freq, dur, type = 'square', vol = 0.2, delay = 0, slide = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.2, freq = 1200, q = 1, delay = 0, type = 'bandpass') {
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.02);
  },

  play(name, throttle = 60) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    // Efeitos ficam mudos com a aba em segundo plano (a música continua)
    if (document.hidden && !(typeof Game !== 'undefined' && Game.state && Game.state.settings.bgSfx)) return;
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < throttle) return;
    this.last[name] = now;
    const f = this.sounds[name];
    if (f) f.call(this);
  },

  sounds: {
    hit() { this.noise(0.07, 0.18, 900 + Math.random() * 400, 1.2); this.tone(140 + Math.random() * 30, 0.06, 'square', 0.05, 0, 0.5); },
    crit() { this.noise(0.1, 0.28, 1600, 0.8); this.tone(520, 0.09, 'square', 0.08, 0, 1.6); },
    swing() { this.noise(0.08, 0.08, 2400, 2, 0, 'highpass'); },
    shoot() { this.tone(900, 0.08, 'triangle', 0.06, 0, 0.4); },
    magic() { this.tone(660, 0.12, 'sine', 0.08, 0, 1.8); this.tone(990, 0.1, 'sine', 0.04, 0.03, 1.5); },
    fire() { this.noise(0.3, 0.2, 500, 0.6, 0, 'lowpass'); this.tone(180, 0.25, 'sawtooth', 0.05, 0, 0.4); },
    zap() { for (let i = 0; i < 4; i++) this.tone(1200 + Math.random() * 1200, 0.04, 'square', 0.05, i * 0.025); },
    boom() { this.noise(0.6, 0.45, 220, 0.5, 0, 'lowpass'); this.tone(90, 0.5, 'sine', 0.3, 0, 0.3); },
    hurt() { this.tone(220, 0.12, 'sawtooth', 0.08, 0, 0.5); },
    block() { this.tone(1400, 0.06, 'square', 0.06); this.noise(0.05, 0.12, 3000, 3); },
    dodge() { this.noise(0.1, 0.06, 3000, 1, 0, 'highpass'); },
    die() { this.noise(0.18, 0.15, 600, 1); this.tone(300, 0.18, 'square', 0.06, 0, 0.3); },
    coin() { this.tone(988, 0.06, 'square', 0.06); this.tone(1319, 0.12, 'square', 0.06, 0.06); },
    chest() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.1, i * 0.06)); this.noise(0.1, 0.1, 400, 1); },
    rare() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.08, i * 0.05)); },
    epic() { [523, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.25, 'sine', 0.1, i * 0.06)); },
    legendary() {
      [392, 523, 659, 784].forEach((f) => this.tone(f, 1.1, 'sawtooth', 0.035, 0));
      [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.08, 0.15 + i * 0.08));
    },
    levelup() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.16, 'square', 0.07, i * 0.07)); this.tone(1568, 0.5, 'triangle', 0.08, 0.35); },
    boss() { this.tone(70, 1.0, 'sawtooth', 0.12, 0, 0.6); this.noise(0.8, 0.2, 150, 0.4, 0, 'lowpass'); },
    victory() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'square', 0.08, i * 0.11)); this.tone(1047, 0.7, 'triangle', 0.1, 0.45); },
    portal() { this.tone(200, 0.8, 'sine', 0.12, 0, 4); this.tone(300, 0.8, 'triangle', 0.05, 0.1, 3); },
    potion() { for (let i = 0; i < 5; i++) this.tone(400 + i * 120 + Math.random() * 60, 0.05, 'sine', 0.08, i * 0.04); },
    shrine() { [659, 880, 1109, 1319].forEach((f, i) => this.tone(f, 0.4, 'sine', 0.07, i * 0.05)); },
    death() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.1, i * 0.18)); },
    click() { this.tone(1800, 0.03, 'square', 0.04); },
    buy() { this.tone(880, 0.05, 'square', 0.05); this.tone(1320, 0.08, 'square', 0.05, 0.05); },
    gun() { this.noise(0.08, 0.22, 1200, 0.8); this.tone(160, 0.08, 'square', 0.06, 0, 0.4); },
    forgeOk() { this.noise(0.12, 0.3, 2500, 4); [880, 1320, 1760].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.08, 0.05 + i * 0.07)); },
    forgeFail() { this.noise(0.15, 0.3, 1800, 3); this.tone(200, 0.3, 'sawtooth', 0.08, 0.05, 0.5); },
    summon() { this.tone(110, 0.4, 'sawtooth', 0.08, 0, 2); this.noise(0.3, 0.1, 300, 1); },
    buff() { this.tone(440, 0.2, 'triangle', 0.08, 0, 2); this.tone(660, 0.2, 'triangle', 0.06, 0.06, 2); },
    ascend() { [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.6, 'sine', 0.07, i * 0.1)); },
  },
};
