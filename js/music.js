'use strict';
const SCALES = {
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  hijaz: [0, 1, 4, 5, 7, 8, 10],
  locrian2: [0, 2, 3, 5, 6, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  whole: [0, 2, 4, 6, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
};

const INST = {
  warmPad: { wave: 'sawtooth', vol: 0.03, attack: 0.9, release: 1.4, cutoff: 900, detune: 7 },
  softPad: { wave: 'triangle', vol: 0.045, attack: 0.7, release: 1.2, detune: 5 },
  darkPad: { wave: 'sawtooth', vol: 0.026, attack: 1.3, release: 1.6, cutoff: 520, detune: 10 },
  organ: { wave: 'sine', vol: 0.045, attack: 0.15, release: 0.7, partial: 2, partialVol: 0.5 },
  brass: { wave: 'sawtooth', vol: 0.032, attack: 0.08, release: 0.4, cutoff: 1300, detune: 6 },
  bassTri: { wave: 'triangle', vol: 0.13, attack: 0.01, release: 0.12 },
  bassSaw: { wave: 'sawtooth', vol: 0.06, attack: 0.01, release: 0.08, cutoff: 420, q: 3 },
  pluck: { wave: 'square', vol: 0.022, attack: 0.004, decay: 0.24, cutoff: 1800 },
  oud: { wave: 'sawtooth', vol: 0.035, attack: 0.004, decay: 0.38, cutoff: 1500, q: 2 },
  bell: { wave: 'sine', vol: 0.045, attack: 0.002, decay: 1.6, partial: 2.76, partialVol: 0.35 },
  celesta: { wave: 'sine', vol: 0.035, attack: 0.002, decay: 0.75, partial: 4, partialVol: 0.2 },
  flute: { wave: 'sine', vol: 0.065, attack: 0.06, release: 0.16, vibrato: 4, vibRate: 5 },
  lead: { wave: 'triangle', vol: 0.06, attack: 0.02, release: 0.16, vibrato: 3, vibRate: 5.5 },
  leadSq: { wave: 'square', vol: 0.03, attack: 0.01, release: 0.1, cutoff: 2200, vibrato: 3, vibRate: 6 },
  choir: { wave: 'sine', vol: 0.045, attack: 0.28, release: 0.5, vibrato: 5, vibRate: 4.5, detune: 6 },
  drone: { wave: 'sawtooth', vol: 0.028, attack: 2, release: 2, cutoff: 340, detune: 4 },
};

const MUSIC_TRACKS = {
  title: { name: 'Crônicas do Abismo', bpm: 78, root: 57, scale: 'aeolian', prog: [0, 5, 2, 6], barsPerChord: 2, loopBars: 16, reverb: 0.45, seed: 11,
    pad: { inst: 'warmPad', oct: -1 }, bass: { inst: 'bassTri', oct: -2, pattern: 'x.......x.......' },
    arp: { inst: 'pluck', oct: 0, pattern: 'x.x.x.x.x.x.x.x.', order: 'updown' }, lead: { inst: 'lead', oct: 0, density: 0.35 },
    drums: { kick: 'x.......x.......', tom: '............x...', vol: 0.55 }, bell: { inst: 'bell', oct: 1, density: 0.04 },
    sections: ['pb', 'pba', 'pbal', 'pbaldk'] },
  forest: { name: 'Floresta Sussurrante', bpm: 100, root: 62, scale: 'dorian', prog: [0, 3, 0, 6], barsPerChord: 1, loopBars: 16, reverb: 0.3, seed: 23,
    pad: { inst: 'softPad', oct: -1 }, bass: { inst: 'bassTri', oct: -2, pattern: 'x.....x.x.......' },
    arp: { inst: 'pluck', oct: 0, pattern: 'x.xxx.x.x.xxx.x.', order: 'up' }, lead: { inst: 'flute', oct: 1, density: 0.5 },
    drums: { kick: 'x.......x.......', hat: '..x...x...x...x.', shaker: 'x.x.x.x.x.x.x.x.', vol: 0.5 },
    sections: ['pa', 'pab', 'pabl', 'pabld'] },
  cave: { name: 'Ecos da Caverna', bpm: 64, root: 52, scale: 'phrygian', prog: [0, 1, 0, 6], barsPerChord: 2, loopBars: 16, reverb: 0.7, seed: 37,
    drone: { inst: 'drone', oct: -2 }, pad: { inst: 'darkPad', oct: -1 }, bass: { inst: 'bassTri', oct: -2, pattern: 'x...............' },
    bell: { inst: 'bell', oct: 1, density: 0.09 }, lead: { inst: 'celesta', oct: 1, density: 0.18 },
    drums: { tom: 'x.........x.....', vol: 0.5 },
    sections: ['ok', 'opk', 'opbk', 'opbkld'] },
  desert: { name: 'Miragem Escaldante', bpm: 112, root: 60, scale: 'hijaz', prog: [0, 0, 1, 0], barsPerChord: 2, loopBars: 16, reverb: 0.3, seed: 41,
    drone: { inst: 'drone', oct: -2 }, bass: { inst: 'bassTri', oct: -2, pattern: 'x..x..x.x..x..x.' },
    arp: { inst: 'oud', oct: 0, pattern: 'x.xx.x.xx.x.x.xx', order: 'random' }, lead: { inst: 'oud', oct: 1, density: 0.6 },
    drums: { tom: 'x..x..x...x..x..', hat: '..x...x...x.x.x.', snare: '....x.......x...', vol: 0.6 },
    sections: ['ob', 'obd', 'obad', 'obald'] },
  swamp: { name: 'Lodo e Névoa', bpm: 76, root: 55, scale: 'locrian2', prog: [0, 4, 0, 3], barsPerChord: 2, loopBars: 16, reverb: 0.5, seed: 53,
    pad: { inst: 'darkPad', oct: -1 }, bass: { inst: 'bassSaw', oct: -2, pattern: 'x.......x..x....' },
    arp: { inst: 'pluck', oct: -1, pattern: 'x...x...x...x...', order: 'random' }, lead: { inst: 'flute', oct: 0, density: 0.3 },
    drums: { kick: 'x.......x.......', tom: '......x.......x.', vol: 0.5 }, bell: { inst: 'celesta', oct: 0, density: 0.06 },
    sections: ['pb', 'pbk', 'pbak', 'pbald'] },
  ice: { name: 'Cristais Eternos', bpm: 88, root: 64, scale: 'aeolian', prog: [0, 5, 3, 4], barsPerChord: 2, loopBars: 16, reverb: 0.6, seed: 67,
    pad: { inst: 'softPad', oct: -1 }, arp: { inst: 'celesta', oct: 1, pattern: 'xxxxxxxxxxxxxxxx', order: 'updown' },
    bass: { inst: 'bassTri', oct: -2, pattern: 'x.......x.......' }, lead: { inst: 'lead', oct: 1, density: 0.28 },
    drums: { shaker: '..x...x...x...x.', vol: 0.4 },
    sections: ['a', 'pa', 'pab', 'pabld'] },
  volcano: { name: 'Coração da Forja', bpm: 136, root: 52, scale: 'harmonic', prog: [0, 5, 4, 0], barsPerChord: 1, loopBars: 16, reverb: 0.25, seed: 79,
    pad: { inst: 'brass', oct: -1 }, bass: { inst: 'bassSaw', oct: -2, pattern: 'x.x.x.x.x.x.x.xx' },
    lead: { inst: 'leadSq', oct: 0, density: 0.5 }, arp: { inst: 'pluck', oct: 0, pattern: 'x.x.x.x.x.x.x.x.', order: 'up' },
    drums: { kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', vol: 0.7 },
    sections: ['bd', 'pbd', 'pbdl', 'pbdla'] },
  crypt: { name: 'Réquiem Sombrio', bpm: 68, root: 50, scale: 'harmonic', prog: [0, 3, 4, 0], barsPerChord: 2, loopBars: 16, reverb: 0.65, seed: 83,
    pad: { inst: 'organ', oct: 0 }, bass: { inst: 'bassTri', oct: -2, pattern: 'x.......x.......' },
    bell: { inst: 'bell', oct: -1, pattern: 'x...............' }, lead: { inst: 'choir', oct: 0, density: 0.3 },
    drums: { tom: 'x.......x.......', vol: 0.4 },
    sections: ['pk', 'pkb', 'pkbl', 'pkbld'] },
  void: { name: 'Sussurros do Vazio', bpm: 82, root: 59, scale: 'whole', prog: [0, 1, 0, 2], barsPerChord: 2, loopBars: 16, reverb: 0.75, seed: 97,
    drone: { inst: 'drone', oct: -2 }, pad: { inst: 'darkPad', oct: 0 }, arp: { inst: 'celesta', oct: 1, pattern: 'x..x..x...x..x..', order: 'random' },
    lead: { inst: 'choir', oct: 1, density: 0.22 }, bell: { inst: 'bell', oct: 1, density: 0.05 },
    sections: ['op', 'opa', 'opak', 'opakl'] },
  boss: { name: 'Confronto', bpm: 150, root: 50, scale: 'harmonic', prog: [0, 5, 6, 4], barsPerChord: 1, loopBars: 16, reverb: 0.2, seed: 101,
    pad: { inst: 'brass', oct: -1 }, bass: { inst: 'bassSaw', oct: -2, pattern: 'xxxxxxxxxxxxxxxx' },
    lead: { inst: 'leadSq', oct: 0, density: 0.55 },
    drums: { kick: 'x...x...x...x...', snare: '....x.......x..x', hat: 'x.xxx.xxx.xxx.xx', vol: 0.75 },
    sections: ['bd', 'pbd', 'pbdl', 'pbdl'] },
};
const MUSIC_ORDER = ['title', 'forest', 'cave', 'desert', 'swamp', 'ice', 'volcano', 'crypt', 'void', 'boss'];

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const Music = {
  enabled: true, volume: 0.45, forced: 'auto', zoneTrack: 'title', bossOn: false, wanted: 'title',
  cur: null, out: null, rev: null,

  configure(s) {
    this.enabled = !!s.music;
    this.volume = s.musicVol === undefined ? 0.45 : s.musicVol;
    this.forced = s.musicTrack || 'auto';
    this.applyVolume();
    this.pick();
  },
  applyVolume() { if (this.out) this.out.gain.setTargetAtTime(this.volume * 2.6, Sfx.ctx.currentTime, 0.1); },
  zone(id) { this.zoneTrack = MUSIC_TRACKS[id] ? id : 'title'; this.bossOn = false; this.pick(); },
  boss(on) { if (this.bossOn === on) return; this.bossOn = on; this.pick(); },
  title() { this.zoneTrack = 'title'; this.bossOn = false; this.pick(); },
  pick() { this.wanted = !this.enabled ? null : this.forced !== 'auto' ? this.forced : this.bossOn ? 'boss' : this.zoneTrack; },
  currentName() { return this.cur ? this.cur.def.name : null; },

  setup() {
    const c = Sfx.ctx;
    if (!c) return false;
    if (this.out) return true;
    this.out = c.createGain();
    this.out.gain.value = this.volume * 2.6;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -20; comp.ratio.value = 3;
    this.out.connect(comp); comp.connect(c.destination);
    this.rev = c.createConvolver();
    this.rev.buffer = this.impulse(2.8);
    this.rev.connect(this.out);
    return true;
  },
  impulse(sec) {
    const c = Sfx.ctx, len = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return b;
  },

  update() {
    const c = Sfx.ctx;
    if (!c || c.state !== 'running') return;
    if (!this.setup()) return;
    const curId = this.cur ? this.cur.id : null;
    if (this.wanted !== curId) this.switchTo(this.wanted);
    if (this.cur) this.schedule();
  },

  switchTo(id) {
    const c = Sfx.ctx, now = c.currentTime;
    if (this.cur) {
      const g = this.cur.gain;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + 1.6);
      setTimeout(() => { try { g.disconnect(); } catch (e) {  } }, 4000);
      this.cur = null;
    }
    if (!id || !MUSIC_TRACKS[id]) return;
    const def = MUSIC_TRACKS[id];
    const bus = c.createGain();
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + 2);
    bus.connect(gain); gain.connect(this.out);
    const send = c.createGain(); send.gain.value = def.reverb;
    gain.connect(send); send.connect(this.rev);
    this.cur = {
      id, def, bus, gain, step: 0, nextTime: now + 0.15, stepDur: 60 / def.bpm / 4, variant: 0,
      mel: this.genMelody(def, 0), arpI: 0, rng: mulberry32(def.seed * 7919),
    };
    if (typeof UI !== 'undefined' && UI.nowPlaying) UI.nowPlaying(def.name);
  },

  schedule() {
    const c = Sfx.ctx, cur = this.cur;
    if (cur.nextTime < c.currentTime - 0.25) cur.nextTime = c.currentTime + 0.05;
    const ahead = c.currentTime + 1.2;
    let guard = 0;
    while (cur.nextTime < ahead && guard++ < 96) {
      this.playStep(cur, cur.step, cur.nextTime);
      cur.nextTime += cur.stepDur;
      cur.step++;
    }
  },

  genMelody(def, variant) {
    const map = {};
    if (!def.lead) return map;
    const rng = mulberry32(def.seed * 131 + variant * 977 + 7);
    const L = SCALES[def.scale].length;
    const dens = def.lead.density;
    let deg = Math.floor(L / 2) + 1;
    const motif = () => {
      const notes = [];
      let p = 0;
      while (p < 32) {
        const strong = p % 8 === 0, beat = p % 4 === 0;
        const prob = strong ? 0.9 : beat ? dens + 0.2 : dens * 0.55;
        if (rng() < prob) {
          let l = [2, 2, 2, 4, 4, 6, 8][Math.floor(rng() * 7)];
          if (p + l > 32) l = 32 - p;
          const r = rng();
          deg += r < 0.34 ? 1 : r < 0.68 ? -1 : r < 0.8 ? 2 : r < 0.92 ? -2 : (rng() < 0.5 ? 4 : -3);
          deg = U.clamp(deg, -1, L + 5);
          notes.push({ p, l, deg });
          p += l;
        } else p += 2;
      }
      return notes;
    };
    const vary = m => m.map((n, i) => (i >= m.length - 3 ? Object.assign({}, n, { deg: n.deg + (rng() < 0.5 ? 1 : -1) }) : n));
    const A = motif(), B = motif(), C = motif();
    const order = [A, vary(A), B, A, A, vary(A), C, vary(B)];
    order.forEach((m, i) => { for (const n of m) map[i * 32 + n.p] = n; });
    return map;
  },

  midiOf(def, deg, oct = 0) {
    const sc = SCALES[def.scale], L = sc.length;
    return def.root + 12 * oct + 12 * Math.floor(deg / L) + sc[((deg % L) + L) % L];
  },
  hz(m) { return 440 * Math.pow(2, (m - 69) / 12); },

  playStep(cur, step, t) {
    const def = cur.def;
    const loopSteps = def.loopBars * 16;
    const s = step % loopSteps;
    if (s === 0 && step > 0) { cur.variant = (cur.variant + 1) % 3; cur.mel = this.genMelody(def, cur.variant); }
    const bar = Math.floor(s / 16), pos = s % 16;
    const layers = def.sections[Math.floor(bar / 4) % def.sections.length];
    const has = ch => layers.includes(ch);
    const chordDeg = def.prog[Math.floor(bar / def.barsPerChord) % def.prog.length];
    const chord = [chordDeg, chordDeg + 2, chordDeg + 4];
    const L = SCALES[def.scale].length;
    const sd = cur.stepDur;
    const chordStart = pos === 0 && bar % def.barsPerChord === 0;

    if (def.drone && has('o') && pos === 0 && bar % 2 === 0) this.voice(cur, t, this.hz(this.midiOf(def, 0, def.drone.oct)), sd * 32, INST[def.drone.inst]);
    if (def.pad && has('p') && chordStart) {
      for (const d of chord) this.voice(cur, t, this.hz(this.midiOf(def, d, def.pad.oct)), sd * 16 * def.barsPerChord * 0.95, INST[def.pad.inst]);
    }
    if (def.bass && has('b')) {
      const ch = def.bass.pattern[pos];
      if (ch === 'x') this.voice(cur, t, this.hz(this.midiOf(def, chordDeg, def.bass.oct)), sd * 1.8, INST[def.bass.inst]);
    }
    if (def.arp && has('a') && def.arp.pattern[pos] === 'x') {
      const tones = [...chord, chord[0] + L];
      let i;
      if (def.arp.order === 'random') i = Math.floor(cur.rng() * tones.length);
      else if (def.arp.order === 'updown') { const cyc = [0, 1, 2, 3, 2, 1]; i = cyc[cur.arpI % cyc.length]; }
      else i = cur.arpI % tones.length;
      cur.arpI++;
      this.voice(cur, t, this.hz(this.midiOf(def, tones[i], def.arp.oct)), sd * 1.5, INST[def.arp.inst]);
    }
    if (def.lead && has('l')) {
      const n = cur.mel[s];
      if (n) {
        let deg = n.deg;
        if (s % 4 === 0) {
          let best = deg, bd = 99;
          for (const k of [-1, 0, 1]) for (const c of chord) { const cand = c + k * L; const d = Math.abs(cand - deg); if (d < bd) { bd = d; best = cand; } }
          deg = best;
        }
        this.voice(cur, t, this.hz(this.midiOf(def, deg, def.lead.oct)), sd * n.l * 0.92, INST[def.lead.inst]);
      }
    }
    if (def.bell && has('k')) {
      const hit = def.bell.pattern ? def.bell.pattern[pos] === 'x' : cur.rng() < def.bell.density;
      if (hit) {
        const d = def.bell.pattern ? chordDeg : chord[Math.floor(cur.rng() * 3)] + (cur.rng() < 0.4 ? L : 0);
        this.voice(cur, t, this.hz(this.midiOf(def, d, def.bell.oct)), sd * 4, INST[def.bell.inst]);
      }
    }
    if (def.drums && has('d')) {
      const D = def.drums, v = D.vol || 0.6;
      if (D.kick && D.kick[pos] === 'x') this.kick(cur, t, v);
      if (D.snare && D.snare[pos] === 'x') this.snare(cur, t, v);
      if (D.hat && D.hat[pos] === 'x') this.noiseHit(cur, t, 0.035, v * 0.05, 'highpass', 7500);
      if (D.shaker && D.shaker[pos] === 'x') this.noiseHit(cur, t, 0.05, v * 0.03, 'highpass', 5200);
      if (D.tom && D.tom[pos] === 'x') this.tom(cur, t, v);
    }
  },

  voice(cur, t, freq, dur, o) {
    const c = Sfx.ctx;
    const g = c.createGain();
    const a = o.attack || 0.01, rel = o.release || 0.1;
    let end;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol, t + a);
    if (o.decay) {
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + o.decay);
      end = t + a + o.decay + 0.05;
    } else {
      const hold = Math.max(a, dur);
      g.gain.setValueAtTime(o.vol, t + hold);
      g.gain.linearRampToValueAtTime(0.0001, t + hold + rel);
      end = t + hold + rel + 0.05;
    }
    let dest = g;
    if (o.cutoff) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = o.cutoff; f.Q.value = o.q || 0.7;
      f.connect(g); dest = f;
    }
    const oscs = [];
    const mk = (det, type) => {
      const osc = c.createOscillator();
      osc.type = type || o.wave || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (det) osc.detune.value = det;
      osc.connect(dest);
      oscs.push(osc);
    };
    mk(0);
    if (o.detune) mk(o.detune);
    if (o.partial) {
      const osc = c.createOscillator();
      osc.type = 'sine'; osc.frequency.setValueAtTime(freq * o.partial, t);
      const pg = c.createGain(); pg.gain.value = o.partialVol || 0.3;
      osc.connect(pg); pg.connect(dest);
      oscs.push(osc);
    }
    if (o.vibrato) {
      const lfo = c.createOscillator(); lfo.frequency.value = o.vibRate || 5;
      const lg = c.createGain(); lg.gain.value = o.vibrato;
      lfo.connect(lg);
      for (const osc of oscs) lg.connect(osc.frequency);
      lfo.start(t); lfo.stop(end);
    }
    g.connect(cur.bus);
    for (const osc of oscs) { osc.start(t); osc.stop(end); }
  },

  kick(cur, t, v) {
    const c = Sfx.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    g.gain.setValueAtTime(v * 0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o.connect(g); g.connect(cur.bus);
    o.start(t); o.stop(t + 0.3);
  },
  tom(cur, t, v) {
    const c = Sfx.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(95, t + 0.25);
    g.gain.setValueAtTime(v * 0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g); g.connect(cur.bus);
    o.start(t); o.stop(t + 0.35);
  },
  snare(cur, t, v) {
    this.noiseHit(cur, t, 0.16, v * 0.12, 'bandpass', 1900);
    const c = Sfx.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(190, t);
    g.gain.setValueAtTime(v * 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g); g.connect(cur.bus);
    o.start(t); o.stop(t + 0.12);
  },
  noiseHit(cur, t, dur, vol, type, freq) {
    const c = Sfx.ctx;
    if (!Sfx.noiseBuf) return;
    const src = c.createBufferSource(); src.buffer = Sfx.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(cur.bus);
    src.start(t, Math.random() * 0.3); src.stop(t + dur + 0.02);
  },
};
