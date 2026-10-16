'use strict';
const SAVE_KEY = 'upgrind_save_v1';
const SLOT_KEY = n => 'upgrind_slot_' + n;
const SLOT_COUNT = 3;
const BACKUP_PREFIX = 'upgrind_backup_';
const UNLOCK_KEY = 'upgrind_unlocks';
const PROFILE_KEY = 'upgrind_profile';
const META_KEYS = ['souls', 'soulUpg', 'stats', 'ach', 'settings', 'unlocks', 'encPity', 'classStats', 'speciesStats',
  'relics', 'shards', 'relicPity', 'fusions', 'vault', 'fusionPref', 'exclFound', 'exclPick'];
const META_SET = new Set(META_KEYS);
const EXCL_SLOTS = ['weapon', 'offhand'];

const Store = {
  mem: {}, ok: true,
  test() {
    try { localStorage.setItem('__upg', '1'); localStorage.removeItem('__upg'); this.ok = true; } catch (e) { this.ok = false; }
    return this.ok;
  },
  get(k) {
    if (k in this.mem) return this.mem[k];
    try { return localStorage.getItem(k); } catch (e) { this.ok = false; return null; }
  },
  set(k, v) {
    try { localStorage.setItem(k, v); delete this.mem[k]; } catch (e) { this.ok = false; this.mem[k] = v; }
  },
  del(k) {
    delete this.mem[k];
    try { localStorage.removeItem(k); } catch (e) { this.ok = false; }
  },
  keys() {
    const out = new Set(Object.keys(this.mem));
    try { for (let i = 0; i < localStorage.length; i++) out.add(localStorage.key(i)); } catch (e) {  }
    return [...out];
  },
};

const Ticker = {
  started: false,
  start(fn) {
    if (this.started) return;
    this.started = true;
    try {
      const src = 'let t=null;onmessage=e=>{clearInterval(t);t=setInterval(()=>postMessage(0),e.data)};';
      this.worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      this.worker.onmessage = fn;
      this.worker.postMessage(50);
    } catch (e) {
      setInterval(fn, 50);
    }
  },
};

const HEADSTART_LVL = 2;
const HEADSTART_RAR = 2;
const HEADSTART_POW = 120;
const QTY_STEPS = [1, 5, 10, 25, 50];
const DEFAULT_CLASSES = () => CLASS_ORDER.filter(id => CLASSES[id].unlock.t === 'default');
const DEFAULT_SPECIES = () => SPECIES_ORDER.filter(id => SPECIES[id].unlock.t === 'default');

const Game = {
  state: null, stats: null, W: null,
  speed: 1, paused: false, running: false,
  lastSim: 0, lastFrame: 0, saveT: 0, achT: 0, rateT: 0, rateAcc: { gold: 0, xp: 0 },
  transition: null, autoSold: { n: 0, gold: 0 },

  defaultState(cls, species, name, hardcore = true) {
    species = species || 'human';
    return {
      v: 4, name, cls, cls2: null, species, species2: null, level: 1, xp: 0, gold: 0, souls: 0,
      hardcore: !!hardcore, hearts: 3, pendingEnd: null, classStats: {}, speciesStats: {},
      runCls: cls, runSp: species, relics: {}, shards: 0, relicPity: 0, parked: false,
      talents: { [CLASSES[cls].skills[0]]: 1 },
      equip: { weapon: null, helm: null, chest: null, gloves: null, boots: null, ring: null, amulet: null, offhand: null },
      fusions: {}, autoFarmed: false, startZone: 1, vault: [], fusionPref: {}, exclFound: {}, exclPick: null,
      inv: [], training: {}, soulUpg: {},
      zone: 1, maxZone: 1, mode: 'advance', retreatLeft: 0, deathsInZone: 0, potions: 3,
      unlocks: { classes: DEFAULT_CLASSES(), species: DEFAULT_SPECIES() }, encPity: 0,
      stats: {
        kills: 0, chests: 0, bosses: 0, deaths: 0, goldEarned: 0, itemsFound: 0, epics: 0, legendaries: 0, mythics: 0,
        maxForge: 0, mimics: 0, shrines: 0, playTime: 0, maxLevel: 1, ascensions: 0, maxZone: 1, highestHit: 0, zonesCleared: 0, soulsEarned: 0,
        lordsKilled: 0, recruits: 0, gameOvers: 0, shards: 0,
      },
      ach: {},
      settings: {
        sound: true, volume: 0.5, music: true, musicVol: 0.45, musicTrack: 'auto', bgSfx: false,
        autoSell: 2, autoEquip: true, autoTalent: true, dmgNumbers: true, shake: true, exploreAll: true, speed: 1,
        buyQty: 1, autoFarmZone: 0,
      },
      rates: { gold: 0, xp: 0 },
      lastSave: Date.now(), created: Date.now(),
    };
  },

  newGame(cls, species, name, hardcore, opts = {}) {
    name = U.cleanName(name) || 'Herói';
    if (!this.profile) this.profile = this.defaultProfile();
    const P = this.profile;
    const fresh = this.attach(this.defaultState(cls, species, name, hardcore));
    this.state = fresh;
    this.recalc();
    const cap = opts.fromStart ? 1 : Math.min(1 + this.stats.startZone, Math.max(1, Math.floor((P.stats.maxZone || 1) / 2)));
    let sz = cap;
    for (; ; sz--) {
      fresh.zone = sz; fresh.maxZone = sz;
      fresh.level = sz > 1 ? Math.floor(sz * HEADSTART_LVL) : 1;
      fresh.talents = { [CLASSES[fresh.cls].skills[0]]: 1 };
      for (const k of EQUIP_SLOTS) fresh.equip[k] = null;
      this.giveStarter();
      this.recalc();
      if (fresh.settings.autoTalent) { this.autoTalents(); this.recalc(); }
      if (sz <= 1 || Stats.power(this.stats, sz) >= HEADSTART_POW * (fresh.hardcore ? 1.4 : 1) * enemyPowScale(sz)) break;
    }
    fresh.startZone = sz;
    const pref = P.fusionPref[cls], nw = fresh.equip.weapon;
    if (pref && pref !== cls && nw && !nw.excl && P.fusions[this.fusionKey(cls, pref)]) { Items.fuse(nw, pref); this.recalc(); }
    if (!P.exclPick) {
      for (const it of P.vault.splice(0)) {
        Items.retune(it, sz);
        const cur = fresh.equip[it.slot];
        if (!cur || Stats.compareItem(it, fresh) > 0) { fresh.equip[it.slot] = it; if (cur) fresh.inv.push(cur); this.recalc(); }
        else fresh.inv.push(it);
      }
    } else {
      for (const slot of EXCL_SLOTS) {
        const id = P.exclPick[slot];
        if (!id || !EXCLUSIVES[id] || EXCLUSIVES[id].slot !== slot || !P.exclFound[id]) continue;
        const vi = P.vault.findIndex(v => v.excl === id);
        const it = vi >= 0 ? P.vault.splice(vi, 1)[0] : Items.makeExclusive(id, sz);
        Items.retune(it, sz); it.isNew = false;
        const cur = fresh.equip[slot];
        fresh.equip[slot] = it;
        if (cur) fresh.inv.push(cur);
      }
      this.recalc();
    }
    this.recalc();
    fresh.potions = this.stats.potionMax;
    if (sz < cap) this.log(`O Atalho Astral levou você à zona <b>${sz}</b>, o mais longe que seu herói aguenta agora (limite ${cap}). Fortaleça-se no Altar para começar mais adiante.`, '');
    this.save();
  },

  syncExclFound() {
    const P = this.profile;
    if (!P) return;
    let changed = false;
    const mark = it => { if (it && it.excl && EXCLUSIVES[it.excl] && !P.exclFound[it.excl]) { P.exclFound[it.excl] = true; changed = true; } };
    for (const it of P.vault) mark(it);
    for (let n = 1; n <= SLOT_COUNT; n++) { const sv = this.peekSave(n); if (sv) for (const it of [...EQUIP_SLOTS.map(k => sv.equip && sv.equip[k]), ...(sv.inv || [])]) mark(it); }
    if (changed) this.saveProfile();
  },
  exclChoice(slot) {
    const P = this.profile, found = Object.keys(P.exclFound || {}).filter(id => EXCLUSIVES[id] && EXCLUSIVES[id].slot === slot);
    if (P.exclPick) return found.includes(P.exclPick[slot]) ? P.exclPick[slot] : null;
    return found[0] || null;
  },
  setExclChoice(slot, id) {
    const P = this.profile;
    if (!P.exclPick) P.exclPick = Object.fromEntries(EXCL_SLOTS.map(s => [s, this.exclChoice(s)]));
    P.exclPick[slot] = id && EXCLUSIVES[id] && P.exclFound[id] ? id : null;
    if (this.state) this.state.exclPick = P.exclPick;
    this.saveProfile();
  },

  giveStarter() {
    const st = this.state, z = Math.max(1, st.zone || 1);
    for (const slot of z > 1 ? SLOTS : ['weapon']) {
      const it = Items.generate(z, { cls: st.cls, slot, rarity: z > 1 ? HEADSTART_RAR : 0 });
      it.isNew = false;
      st.equip[slot] = it;
    }
  },

  migrate(s) {
    if (!CLASSES[s.cls]) s.cls = 'fighter';
    const d = this.defaultState(s.cls, s.species, s.name || 'Herói', false);
    for (const k in d) if (s[k] === undefined) s[k] = d[k];
    for (const k in d.stats) if (s.stats[k] === undefined) s.stats[k] = d.stats[k];
    for (const k in d.settings) if (s.settings[k] === undefined) s.settings[k] = d.settings[k];
    for (const k of EQUIP_SLOTS) if (s.equip[k] === undefined) s.equip[k] = null;
    if (!SPECIES[s.species]) s.species = 'human';
    for (const id of DEFAULT_CLASSES()) if (!s.unlocks.classes.includes(id)) s.unlocks.classes.push(id);
    for (const id of DEFAULT_SPECIES()) if (!s.unlocks.species.includes(id)) s.unlocks.species.push(id);
    if (!s.unlocks.classes.includes(s.cls)) s.unlocks.classes.push(s.cls);
    if (!s.unlocks.species.includes(s.species)) s.unlocks.species.push(s.species);
    if (s.cls2 && !CLASSES[s.cls2]) s.cls2 = null;
    if (s.species2 && !SPECIES[s.species2]) s.species2 = null;
    if (s.v < 4) { s.runCls = s.cls; s.runSp = s.species; s.v = 4; }
    if (!s.classStats[s.cls]) s.classStats[s.cls] = { best: s.maxZone || 1, kills: 0, bosses: 0 };
    const all = [...EQUIP_SLOTS.map(k => s.equip[k]), ...s.inv].filter(Boolean);
    for (const it of all) if (it.slot === 'weapon' && !it.cls && !it.excl) it.cls = s.cls;
    for (const it of all) if (it.excl && it.rarity !== EXCL_RARITY) it.rarity = EXCL_RARITY;
    for (const it of all) if (it.excl && EXCLUSIVES[it.excl]) s.exclFound[it.excl] = true;
    return s;
  },

  slot: 1,
  migrateLegacySave() {
    const old = Store.get(SAVE_KEY);
    if (old && !Store.get(SLOT_KEY(1))) Store.set(SLOT_KEY(1), old);
    if (old) Store.del(SAVE_KEY);
  },
  mergeUnlocks(...list) {
    const c = new Set(DEFAULT_CLASSES()), sp = new Set(DEFAULT_SPECIES());
    for (const u of list) {
      if (!u) continue;
      for (const id of u.classes || []) if (CLASSES[id]) c.add(id);
      for (const id of u.species || []) if (SPECIES[id]) sp.add(id);
    }
    return { classes: CLASS_ORDER.filter(id => c.has(id)), species: SPECIES_ORDER.filter(id => sp.has(id)) };
  },
  sharedUnlocks() { return this.mergeUnlocks(this.profile && this.profile.unlocks, this.state && this.state.unlocks); },

  profile: null,
  defaultProfile() {
    const d = this.defaultState('fighter', 'human', '', true);
    const p = { v: 5, pid: Date.now() + '-' + Math.floor(Math.random() * 1e6), lastSave: 0, owner: null, lastHero: null };
    for (const k of META_KEYS) p[k] = d[k];
    return p;
  },
  normalizeProfile(p) {
    const d = this.defaultProfile();
    for (const k in d) if (p[k] === undefined || p[k] === null && k !== 'owner' && k !== 'lastHero') p[k] = d[k];
    for (const k in d.stats) if (p.stats[k] === undefined) p.stats[k] = d.stats[k];
    for (const k in d.settings) if (p.settings[k] === undefined) p.settings[k] = d.settings[k];
    if (!Array.isArray(p.vault)) p.vault = [];
    for (const it of p.vault) if (it && it.excl && it.rarity !== EXCL_RARITY) it.rarity = EXCL_RARITY;
    if (!p.exclFound || typeof p.exclFound !== 'object') p.exclFound = {};
    for (const it of p.vault) if (it && it.excl && EXCLUSIVES[it.excl]) p.exclFound[it.excl] = true;
    p.unlocks = this.mergeUnlocks(p.unlocks);
    return p;
  },
  pickMeta(s) { const o = {}; for (const k of META_KEYS) if (s[k] !== undefined) o[k] = s[k]; return o; },
  buildProfile(sources) {
    const list = sources.filter(x => x && x.stats);
    if (!list.length) return this.defaultProfile();
    const key = x => [x.stats.ascensions || 0, x.stats.soulsEarned || 0, x.stats.playTime || 0];
    const primary = list.slice().sort((a, b) => { const x = key(a), y = key(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return y[i] - x[i]; return 0; })[0];
    const p = JSON.parse(JSON.stringify(this.pickMeta(primary)));
    Object.assign(p, {
      v: 5, pid: primary.pid || 'legado-' + (primary.created || 0), lastSave: primary.lastSave || 0, owner: primary.owner || null,
      lastHero: primary.lastHero || (primary.name ? { name: primary.name, cls: CLASSES[primary.cls] ? CLASSES[primary.cls].name : '', species: SPECIES[primary.species] ? SPECIES[primary.species].name : '' } : null),
    });
    p.ach = p.ach || {}; p.relics = p.relics || {}; p.fusions = p.fusions || {}; p.classStats = p.classStats || {}; p.speciesStats = p.speciesStats || {}; p.vault = p.vault || [];
    for (const x of list) {
      if (x === primary) continue;
      p.unlocks = this.mergeUnlocks(p.unlocks, x.unlocks);
      for (const k in x.ach || {}) if (x.ach[k]) p.ach[k] = true;
      for (const k in x.stats) if (typeof x.stats[k] === 'number') p.stats[k] = Math.max(p.stats[k] || 0, x.stats[k]);
      for (const c in x.relics || {}) if (!p.relics[c] || p.relics[c].r < x.relics[c].r) p.relics[c] = { r: x.relics[c].r };
      for (const k in x.fusions || {}) p.fusions[k] = true;
      for (const map of ['classStats', 'speciesStats']) for (const id in x[map] || {}) {
        const a = p[map][id] || (p[map][id] = {});
        for (const k in x[map][id]) a[k] = Math.max(a[k] || 0, x[map][id][k] || 0);
      }
      for (const it of x.vault || []) if (!p.vault.some(v => v.uid === it.uid)) p.vault.push(it);
      for (const k in x.exclFound || {}) if (x.exclFound[k]) (p.exclFound = p.exclFound || {})[k] = true;
    }
    return this.normalizeProfile(p);
  },
  loadProfile() {
    let p = null;
    try { p = JSON.parse(Store.get(PROFILE_KEY)); } catch (e) {  }
    if (!p || !p.stats) {
      const legacy = [];
      for (let n = 1; n <= SLOT_COUNT; n++) { const sv = this.peekSave(n); if (sv && sv.stats) legacy.push(sv); }
      p = this.buildProfile(legacy);
      let un = null;
      try { un = JSON.parse(Store.get(UNLOCK_KEY)); } catch (e) {  }
      p.unlocks = this.mergeUnlocks(p.unlocks, un);
    }
    Store.del(UNLOCK_KEY);
    this.setProfile(p);
    return this.profile;
  },
  setProfile(p) {
    this.profile = this.normalizeProfile(p);
    Store.set(PROFILE_KEY, JSON.stringify(this.profile));
  },
  saveProfile() {
    const P = this.profile;
    if (!P) return;
    P.lastSave = Date.now();
    if (Online.loggedIn) P.owner = Online.user.id;
    Store.set(PROFILE_KEY, JSON.stringify(P));
    Online.onSave(0);
  },
  attach(run) { for (const k of META_KEYS) run[k] = this.profile[k]; return run; },
  syncProfileFromState() {
    const st = this.state;
    if (!st || !this.profile) return;
    for (const k of META_KEYS) this.profile[k] = st[k];
    this.profile.lastHero = { name: st.name, cls: this.className(st), species: this.speciesName(st) };
  },
  runPart(st) { const o = {}; for (const k in st) if (!META_SET.has(k)) o[k] = st[k]; o.v = 5; return o; },
  peekSave(n = this.slot) { try { const s = JSON.parse(Store.get(SLOT_KEY(n))); return s && s.cls ? s : null; } catch (e) { return null; } },
  freeSlot() { for (let n = 1; n <= SLOT_COUNT; n++) if (!this.peekSave(n)) return n; return 0; },
  writeSlot(n, data) { Store.set(SLOT_KEY(n), JSON.stringify(data)); },
  deleteSlotLocal(n) { Store.del(SLOT_KEY(n)); },
  deleteSlot(n) {
    const sv = this.peekSave(n);
    const items = sv ? [...EQUIP_SLOTS.map(k => sv.equip && sv.equip[k]), ...(sv.inv || [])].filter(it => it && it.excl) : [];
    if (items.length && this.profile) { for (const it of items) if (!this.profile.vault.some(v => v.uid === it.uid)) this.profile.vault.push(it); this.saveProfile(); }
    this.deleteSlotLocal(n);
    Online.deleteCloud(n);
  },
  listBackups() {
    return Store.keys().filter(k => k && k.startsWith(BACKUP_PREFIX)).map(key => {
      try { const data = JSON.parse(Store.get(key)); return data && data.cls ? { key, data } : null; } catch (e) { return null; }
    }).filter(Boolean);
  },
  addBackup(data) { Store.set(BACKUP_PREFIX + (data.created || Date.now()), JSON.stringify(data)); },
  deleteBackup(key) { Store.del(key); },

  save() {
    if (!this.state) return;
    const st = this.state;
    st.lastSave = Date.now();
    if (Online.loggedIn) st.owner = Online.user.id;
    this.syncProfileFromState();
    this.saveProfile();
    Store.set(SLOT_KEY(this.slot), JSON.stringify(this.runPart(st)));
    Online.onSave(this.slot);
  },
  load(n = this.slot) {
    const s = this.peekSave(n);
    if (!s) return false;
    if (!this.profile) this.loadProfile();
    this.slot = n;
    this.state = this.migrate(this.attach(s));
    this.recalc();
    return true;
  },
  exitToMenu() {
    if (!this.state) return;
    this.state.parked = true;
    this.save();
    Online.scoreDirty = true;
    Online.flush();
    this.running = false;
    this.paused = false;
    this.transition = null;
    UI.closeModal();
    UI.showTitle('new');
  },
  exportSave() {
    this.save();
    const slots = [1, 2, 3].map(n => this.peekSave(n));
    return btoa(unescape(encodeURIComponent(JSON.stringify({ v: 5, profile: this.profile, slots }))));
  },
  importSave(str) {
    str = String(str || '').trim();
    if (str.length > 8e6) throw new Error('inválido');
    const s = U.cleanData(JSON.parse(decodeURIComponent(escape(atob(str)))));
    if (s && s.profile && Array.isArray(s.slots)) {
      s.profile.owner = null;
      this.setProfile(s.profile);
      s.slots.forEach((run, i) => { if (run && run.cls) { run.owner = null; this.writeSlot(i + 1, run); } else this.deleteSlotLocal(i + 1); });
    } else if (s && s.cls) {
      s.owner = null;
      this.setProfile(this.buildProfile([this.profile, s]));
      this.writeSlot(this.freeSlot() || 1, s);
    } else throw new Error('inválido');
  },
  hardReset() {
    this.save();
    this.deleteSlot(this.slot);
    this.running = false; this.paused = false; this.transition = null;
    this.state = null;
    UI.closeModal();
    UI.showTitle('new');
  },

  recalc() {
    const st = this.state;
    const W = this.W;
    const c2 = Stats.fusionCls2(st);
    if ((c2 || null) !== (st.cls2 || null)) this.setCls2(c2);
    const ratio = W && W.hero && W.hero.maxHp ? W.hero.hp / W.hero.maxHp : 1;
    this.stats = Stats.compute(st);
    this.power = Stats.power(this.stats, st.zone);
    if (W && W.hero) {
      W.hero.maxHp = this.stats.maxHp;
      if (!W.hero.dead) W.hero.hp = Math.max(1, Math.min(this.stats.maxHp, this.stats.maxHp * ratio));
    }
    if (st.potions > this.stats.potionMax) st.potions = this.stats.potionMax;
    UI.dirty('top', 'equip', 'talents', 'train', 'forge', 'asc', 'hall');
    if (this.cls2Changed) {
      this.cls2Changed = false;
      if (st.settings.autoTalent) this.autoTalents();
      UI.buildSkillbar && this.running && UI.buildSkillbar();
    }
  },
  setCls2(c2) {
    const st = this.state, old = st.cls2;
    if (old && CLASSES[old]) {
      const keep = new Set([...CLASSES[st.cls].skills, ...CLASSES[st.cls].passives]);
      for (const id of [...CLASSES[old].skills, ...CLASSES[old].passives]) if (!keep.has(id)) delete st.talents[id];
    }
    st.cls2 = c2 || null;
    this.cls2Changed = true;
    if (!this.running) return;
    if (c2) {
      UI.banner(this.className(), 'Multiclasse', 'purple', 2.4);
      this.log(`Multiclasse: <b>${this.className()}</b>. Você usa as habilidades das duas classes e ganha +${MULTI_SYNERGY}% de Dano e Vida, mas ${Math.round((MULTI_XP - 1) * 100)}% mais XP por nível.`, 'lvl');
    } else if (old) this.log(`Multiclasse desfeita: a arma fundida não está mais equipada.`, '');
  },

  start() {
    this.running = true;
    this.paused = false;
    this.transition = null;
    this.speed = this.state.settings.speed || 1;
    Sfx.enabled = this.state.settings.sound;
    Sfx.setVolume(this.state.settings.volume);
    Music.configure(this.state.settings);
    UI.initGame();
    if (!this.state.pendingEnd && !this.state.parked) this.offlineProgress();
    this.state.parked = false;
    this.enterZone(this.state.zone, true);
    if (this.state.pendingEnd) this.paused = true;
    this.lastSim = this.lastFrame = performance.now();
    if (this.loopsOn) return;
    this.loopsOn = true;
    requestAnimationFrame(t => this.frame(t));
    Ticker.start(() => this.pump());
    document.addEventListener('visibilitychange', () => {
      if (!this.running) return;
      if (document.hidden) { this.save(); Online.flush(); }
      else UI.dirty('top', 'zone', UI.tab);
    });
    window.addEventListener('beforeunload', () => { if (this.running) { this.save(); Online.flush(); } });
  },

  frame(ts) {
    requestAnimationFrame(t => this.frame(t));
    const dt = Math.min(0.1, Math.max(0, (ts - this.lastFrame) / 1000));
    this.lastFrame = ts;
    if (!this.running) return;
    this.pump();
    Render.frame(this.W, this.paused ? 0 : dt);
    UI.drawTransition(this.transition);
    UI.tick(dt);
  },

  pump() {
    if (!this.running) return;
    const now = performance.now();
    let dt = (now - this.lastSim) / 1000;
    this.lastSim = now;
    if (dt <= 0) return;
    if (dt > 30) { this.backgroundCatchUp(dt); dt = 0.05; }
    this.simulate(dt);
    this.housekeeping(dt);
    Music.update();
  },

  simulate(dt) {
    const st = this.state;
    if (this.transition) {
      this.transition.t -= Math.min(dt, 0.1);
      if (!this.transition.fired && this.transition.t <= this.transition.half) { this.transition.fired = true; this.transition.fn(); }
      if (this.transition.t <= 0) this.transition = null;
      return;
    }
    if (this.paused || !this.W) return;
    let sim = dt * this.speed;
    st.stats.playTime += dt;
    while (sim > 1e-6 && !this.transition) {
      const step = Math.min(sim, 1 / 30);
      World.update(this.W, step);
      sim -= step;
      this.rateT += step;
    }
  },

  housekeeping(dt) {
    const st = this.state;
    if (this.rateT >= 10) {
      const g = this.rateAcc.gold / this.rateT, x = this.rateAcc.xp / this.rateT;
      st.rates.gold = st.rates.gold ? st.rates.gold * 0.8 + g * 0.2 : g;
      st.rates.xp = st.rates.xp ? st.rates.xp * 0.8 + x * 0.2 : x;
      this.rateAcc.gold = 0; this.rateAcc.xp = 0; this.rateT = 0;
    }
    this.saveT += dt;
    if (this.saveT > 15) { this.saveT = 0; this.save(); }
    Online.tick(dt);
    this.achT += dt;
    if (this.achT > 1.5) { this.achT = 0; this.checkAchievements(); this.checkUnlocks(); this.flushAutoSold(); }
  },

  classStat(key, v) {
    const st = this.state;
    const add = (map, id) => {
      if (!id) return;
      const cs = map[id] || (map[id] = { best: 0, kills: 0, bosses: 0 });
      if (key === 'best') cs.best = Math.max(cs.best, v); else cs[key] = (cs[key] || 0) + v;
    };
    if (st.runCls === st.cls) add(st.classStats, st.cls);
    if (st.runSp === st.species) add(st.speciesStats, st.species);
  },

  enterZone(z, first) {
    const st = this.state;
    z = Math.max(1, z);
    st.zone = z;
    if (z > st.maxZone) st.maxZone = z;
    if (z > st.stats.maxZone) { st.stats.maxZone = z; Online.scoreDirty = true; }
    this.classStat('best', z);
    for (const it of [...EQUIP_SLOTS.map(k => st.equip[k]), ...st.inv]) if (it && it.excl) Items.retune(it, st.maxZone);
    st.deathsInZone = 0;
    this.recalc();
    this.W = World.create(z);
    Render.mapCanvas = null;
    Render.cam.init = false;
    if (!first) st.potions = Math.min(this.stats.potionMax, st.potions + 1);
    const b = this.W.biome;
    const cyc = MapGen.cycleOf(z);
    const sub = b.name + (cyc ? `, Ciclo ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][cyc] || cyc + 1}` : '');
    UI.banner(`Zona ${z}`, sub + (this.W.isLord ? ' · Covil do Senhor' : ''), this.W.isLord ? 'purple' : '', 2.4);
    this.log(`Entrando na <b>Zona ${z}</b>: ${sub}.`, '');
    if (this.W.chests.some(c => c.tier === 4)) {
      const sub = exclMissing(this.state).length ? 'Pode conter uma arma exclusiva' : 'Pode conter um item raríssimo';
      this.log(`🌈 <b class="c7">Um Baú Arco-Íris está escondido nesta zona!</b> ${sub}.`, 'loot');
      UI.toastText('🌈 Baú Arco-Íris nesta zona!', sub, '#ff7ae0');
    }
    const af = st.settings.autoFarmZone;
    if (af > 0 && !st.autoFarmed && st.mode === 'advance' && z >= af) {
      st.autoFarmed = true; st.mode = 'farm'; st.retreatLeft = 0;
      this.log(`Chegou na zona ${af}: modo <b>Farmar</b> ativado automaticamente.`, '');
      UI.banner('MODO FARMAR', `Zona ${af} alcançada`, '', 2.2);
    }
    Music.zone(b.id);
    UI.dirty('top', 'zone');
  },

  completeZone() {
    const st = this.state, W = this.W;
    st.stats.zonesCleared++;
    this.log(`<b>Zona ${W.z} concluída</b> em ${U.fmtTime(W.t)} · ${W.killed} inimigos · ${W.chestsOpened} baús · ${W.zoneItems} itens.`, 'good');
    Sfx.play('portal');
    let next = W.z;
    if (st.mode === 'advance') {
      if (st.retreatLeft > 0) { st.retreatLeft--; next = st.retreatLeft > 0 ? W.z : W.z + 1; }
      else next = W.z + 1;
    }
    this.goZone(next);
  },

  goZone(z) {
    this.transition = { t: 1.0, half: 0.5, fired: false, fn: () => this.enterZone(z) };
  },

  retreat() {
    const st = this.state;
    st.retreatLeft = 2;
    this.log(st.hardcore ? 'Recuando para a zona anterior para ficar mais forte antes de arriscar outro coração…' : 'Derrotado 3 vezes. Recuando para a zona anterior para ficar mais forte…', 'bad');
    this.goZone(Math.max(1, st.zone - 1));
  },

  setZone(z) {
    const st = this.state;
    z = U.clamp(z, 1, st.maxZone);
    if (z === st.zone) return;
    st.retreatLeft = 0;
    this.goZone(z);
  },

  toggleMode() {
    const st = this.state;
    st.mode = st.mode === 'advance' ? 'farm' : 'advance';
    st.retreatLeft = 0;
    this.log(st.mode === 'advance' ? 'Modo <b>Avançar</b>: seguirá para novas zonas.' : 'Modo <b>Farmar</b>: repetirá a zona atual.', '');
    UI.dirty('top', 'zone');
  },

  unlockKey(kind) { return kind === 'class' ? 'classes' : 'species'; },
  isUnlocked(kind, id) { return this.state.unlocks[this.unlockKey(kind)].includes(id); },
  unlock(kind, id, reason) {
    const st = this.state;
    const list = st.unlocks[this.unlockKey(kind)];
    if (list.includes(id)) return false;
    list.push(id);
    const def = kind === 'class' ? CLASSES[id] : SPECIES[id];
    const R = HERO_RARITY[def.rarity];
    const tag = kind === 'class' ? 'Nova Classe' : 'Nova Espécie';
    if (reason && reason.includes('resgatado')) st.stats.recruits++;
    UI.banner(`${tag}: ${def.name}`, reason || R.name, 'purple', 3.2);
    UI.toastText(`✦ ${tag}: ${def.name}`, `${R.name} · use no Salão dos Heróis`, R.color);
    this.log(`✦ <b style="color:${R.color}">${tag} desbloqueada: ${def.name}</b> (${R.name})${reason ? '. Meta: ' + reason : ''}. Experimente no <b>Salão dos Heróis</b>!`, 'lvl');
    Sfx.play('legendary');
    UI.dirty('hall');
    this.save();
    return true;
  },
  checkUnlocks() {
    const st = this.state;
    const test = (kind, id, u) => {
      if ((u.t !== 'stat' && u.t !== 'class') || this.isUnlocked(kind, id)) return;
      if ((st.stats.ascensions || 0) < (u.asc || 0)) return;
      const v = u.t === 'class' ? ((st.classStats[u.cls] || {})[u.stat] || 0) : (st.stats[u.stat] || 0);
      if (v >= u.goal) this.unlock(kind, id, unlockText(u));
    };
    for (const id of CLASS_ORDER) test('class', id, CLASSES[id].unlock);
    for (const id of SPECIES_ORDER) test('species', id, SPECIES[id].unlock);
  },
  pickEncounter(z) {
    const st = this.state;
    if (!st) return null;
    if (z >= RELIC_ZONE && RELICS[st.cls] && !(st.relics || {})[st.cls]) {
      const ch = 0.25 + (st.relicPity || 0) * 0.15;
      if (Math.random() < ch) { st.relicPity = 0; return { kind: 'relic', id: st.cls, name: RELICS[st.cls].name, label: RELICS[st.cls].name }; }
      st.relicPity = (st.relicPity || 0) + 1;
    }
    const biome = MapGen.biomeOf(z);
    const cands = [];
    const ok = u => u.t === 'encounter' && z >= u.minZone && (st.stats.ascensions || 0) >= (u.asc || 0) && (!u.biomes || u.biomes.includes(biome.id));
    for (const id of CLASS_ORDER) if (ok(CLASSES[id].unlock) && !this.isUnlocked('class', id)) cands.push({ kind: 'class', id });
    for (const id of SPECIES_ORDER) if (ok(SPECIES[id].unlock) && !this.isUnlocked('species', id)) cands.push({ kind: 'species', id });
    if (!cands.length) return null;
    const chance = 0.12 + (st.encPity || 0) * 0.04;
    if (Math.random() > chance) { st.encPity = (st.encPity || 0) + 1; return null; }
    st.encPity = 0;
    const c = U.pick(cands);
    const def = c.kind === 'class' ? CLASSES[c.id] : SPECIES[c.id];
    c.name = U.pick(NPC_NAMES);
    c.label = c.kind === 'class' ? def.name : def.name;
    return c;
  },

  switchClass(id) {
    const st = this.state;
    if (!this.isUnlocked('class', id) || st.cls === id) return;
    st.cls = id;
    st.runCls = null;
    st.talents = { [CLASSES[id].skills[0]]: 1 };
    if (st.equip.weapon) Items.convertWeapon(st.equip.weapon, id);
    for (const it of st.inv) if (it.slot === 'weapon') Items.convertWeapon(it, id);
    if (!st.equip.weapon) this.giveStarter();
    this.recalc();
    if (st.settings.autoTalent) this.autoTalents();
    this.refreshHero(true);
    UI.initGame();
    UI.banner(CLASSES[id].name, CLASSES[id].title, '', 2);
    this.log(`Você agora é um <b style="color:${CLASSES[id].color}">${CLASSES[id].name}</b>. Talentos redistribuídos e armas reforjadas.`, 'lvl');
    Sfx.play('ascend');
    this.save();
  },
  fusionKey(a, b) { return [a, b].sort().join('+'); },
  fusionCost(w) { return Items.forgeCost(w) * FUSION_GOLD; },
  fuseBlock(partner) {
    const st = this.state, w = st.equip.weapon;
    if (!Stats.multiclassOpen(st)) return `Liberada após ${MULTI_ASC} ascensões (você tem ${st.stats.ascensions})`;
    if (!Stats.mastered(st, st.cls)) return `Domine ${CLASSES[st.cls].name}: zona ${MASTERY_ZONE} numa jornada iniciada com ela`;
    if (!w) return 'Equipe uma arma';
    if (w.excl) return 'Armas exclusivas não podem ser fundidas';
    if (!partner || partner === st.cls) return 'Escolha outra classe';
    if (!this.isUnlocked('class', partner) || !Stats.mastered(st, partner)) return `Domine ${CLASSES[partner].name} primeiro`;
    if (w.fusion === partner) return 'Sua arma já está fundida com essa classe';
    if (!st.fusions[this.fusionKey(st.cls, partner)] && st.shards < FUSION_SHARDS) return `Aprender esta fusão custa ${FUSION_SHARDS} Fragmentos (você tem ${Math.floor(st.shards)})`;
    const cost = this.fusionCost(w);
    if (st.gold < cost) return `Custa ${U.fmt(cost)} de ouro`;
    return '';
  },
  canMulticlass(id) { return !this.fuseBlock(id); },
  fuseWeapon(partner) {
    const st = this.state, w = st.equip.weapon;
    if (this.fuseBlock(partner)) return false;
    const key = this.fusionKey(st.cls, partner);
    if (!st.fusions[key]) { st.shards -= FUSION_SHARDS; st.fusions[key] = true; }
    st.gold -= this.fusionCost(w);
    Items.fuse(w, partner);
    Sfx.play('legendary');
    this.recalc();
    UI.dirty('equip', 'forge', 'hall', 'talents');
    this.save();
    return true;
  },
  unfuseWeapon() {
    const w = this.state.equip.weapon;
    if (!w || !w.fusion) return;
    Items.unfuse(w);
    this.recalc();
    UI.dirty('equip', 'forge', 'hall', 'talents');
    this.save();
  },
  className(st = this.state) { return CLASSES[st.cls].name + (st.cls2 ? ' / ' + CLASSES[st.cls2].name : ''); },
  speciesName(st = this.state) { return SPECIES[st.species].name + (st.species2 ? ' / ' + SPECIES[st.species2].name : ''); },

  canMultiSpecies(id) {
    const st = this.state;
    return Stats.multiSpeciesOpen(st) && id !== st.species && this.isUnlocked('species', id) && Stats.speciesMastered(st, st.species) && Stats.speciesMastered(st, id);
  },
  setMultiSpecies(id) {
    const st = this.state;
    if (id && !this.canMultiSpecies(id)) return;
    st.species2 = id || null;
    this.recalc();
    this.refreshHero(false);
    UI.initGame();
    if (id) {
      UI.banner(this.speciesName(), 'Mestiçagem', 'purple', 2.4);
      this.log(`Mestiçagem: <b>${this.speciesName()}</b>. Você ganha 50% dos atributos da segunda espécie e +${MULTI_SP_SYNERGY}% de Dano e Vida, mas ${Math.round((MULTI_SP_XP - 1) * 100)}% mais XP por nível.`, 'lvl');
    } else this.log('Mestiçagem removida.', '');
    Sfx.play('ascend');
    this.save();
  },

  gainRelic(cls) {
    const st = this.state;
    if (!RELICS[cls] || st.relics[cls]) return;
    st.relics[cls] = { r: 0 };
    const R = RELICS[cls];
    UI.banner(R.name, 'Arma Ancestral encontrada!', 'purple', 3.4);
    UI.toastText(`⚔ ${R.name}`, 'Desperte-a no Salão com Fragmentos Ancestrais', '#ffd04a');
    this.log(`⚔ <b style="color:#ffd04a">${R.name}</b> é sua! A Arma Ancestral de ${CLASSES[cls].name} acompanha você em todas as jornadas com essa classe. Desperte sua raridade no <b>Salão</b>.`, 'lvl');
    Sfx.play('legendary');
    this.recalc();
    UI.dirty('hall', 'equip');
    this.save();
  },
  relicBlock(cls) {
    const st = this.state, R = st.relics[cls];
    if (!R) return 'Ainda não encontrada';
    if (R.r >= 5) return 'Raridade máxima';
    const nx = R.r + 1, best = ((st.classStats[cls] || {}).best || 0);
    if (best < RELIC_REQ[nx]) return `Requer zona ${RELIC_REQ[nx]} com ${CLASSES[cls].name} (recorde ${best})`;
    if (st.shards < RELIC_COST[nx]) return `Requer ${RELIC_COST[nx]} Fragmentos (você tem ${Math.floor(st.shards)})`;
    return '';
  },
  awakenRelic(cls) {
    const st = this.state;
    if (this.relicBlock(cls)) return;
    const R = st.relics[cls];
    st.shards -= RELIC_COST[R.r + 1];
    R.r++;
    const rn = RARITIES[R.r];
    UI.banner(RELICS[cls].name, `Despertada: ${RELIC_RNAME[R.r]}`, 'purple', 3);
    this.log(`⚔ <b style="color:${rn.color}">${RELICS[cls].name}</b> despertou: agora é <b style="color:${rn.color}">${RELIC_RNAME[R.r]}</b>!`, 'lvl');
    Sfx.play('legendary');
    this.recalc();
    this.save();
  },
  gainShards(n, x, y) {
    const st = this.state;
    st.shards = (st.shards || 0) + n;
    st.stats.shards = (st.stats.shards || 0) + n;
    if (this.W && x !== undefined) World.text(this.W, x + 0.5, y - 1, `+${n} Fragmento${n > 1 ? 's' : ''} Ancestra${n > 1 ? 'is' : 'l'}`, '#ffd04a', 12, 1.4);
    this.log(`+${n} <b style="color:#ffd04a">Fragmento${n > 1 ? 's' : ''} Ancestra${n > 1 ? 'is' : 'l'}</b> (total ${Math.floor(st.shards)}).`, 'loot');
    UI.dirty('hall');
  },

  canMaestria(id) {
    const st = this.state, m = MAESTRIA_IDX[id];
    return !!m && Stats.maestriaOpen(st) && Stats.talentFree(st) > 0 && (!m.max || (st.talents[id] || 0) < m.max);
  },
  maestriaUp(id, n = 1) {
    let done = 0;
    while (done < n && this.canMaestria(id)) { this.state.talents[id] = (this.state.talents[id] || 0) + 1; done++; }
    if (done) { Sfx.play('buy'); this.recalc(); }
  },

  switchSpecies(id) {
    const st = this.state;
    if (!this.isUnlocked('species', id) || st.species === id) return;
    st.species = id;
    st.runSp = null;
    if (st.species2 === id || (st.species2 && !Stats.speciesMastered(st, id))) st.species2 = null;
    this.recalc();
    this.refreshHero(false);
    UI.initGame();
    this.log(`Sua espécie agora é <b style="color:${HERO_RARITY[SPECIES[id].rarity].color}">${SPECIES[id].name}</b>.`, 'lvl');
    Sfx.play('buff');
    this.save();
  },
  refreshHero(classChanged) {
    const W = this.W, st = this.state;
    if (!W) return;
    const h = W.hero;
    h.cls = st.cls;
    h.sprite = CLASSES[st.cls].sprite;
    h.pal = Sprites.heroPal(st.cls, st.species);
    h.fly = this.stats.flags.has('flying');
    if (classChanged) {
      h.skillCd = {}; h.blades = null; h.target = null;
      for (const e of W.ents) if (e.kind === 'minion' && !e.dead) World.killMinion(W, e);
    }
    World.fx(W, 'holy', h.rx + 0.5, h.ry + 0.5, { r: 1.8, color: '#d9b8ff', life: 0.8 });
  },

  gainXp(x) {
    const st = this.state, S = this.stats;
    const bm = this.W ? World.buffMods(this.W.hero) : { xp: 0 };
    x *= (1 + S.xpPct / 100) * (1 + (bm.xp || 0));
    st.xp += x;
    this.rateAcc.xp += x;
    if (this.W) this.W.zoneXp += x;
    let leveled = false;
    while (st.xp >= Stats.needXpFor(st)) {
      st.xp -= Stats.needXpFor(st);
      st.level++;
      leveled = true;
      if (st.level > st.stats.maxLevel) st.stats.maxLevel = st.level;
      for (const id of Stats.talentIds(st)) {
        if (SKILLS[id].unlock === st.level) this.log(`Nova ${SKILLS[id].type === 'passive' ? 'habilidade passiva' : 'habilidade'} disponível: <b style="color:${SKILLS[id].color}">${SKILLS[id].name}</b>!`, 'lvl');
      }
    }
    if (leveled) {
      this.recalc();
      if (st.settings.autoTalent) this.autoTalents();
      const W = this.W;
      if (W && !W.hero.dead) {
        W.hero.hp = W.hero.maxHp;
        World.fx(W, 'ring', W.hero.rx + 0.5, W.hero.ry + 0.5, { r: 2.5, color: '#c9a0ff', life: 0.8 });
        World.fx(W, 'holy', W.hero.rx + 0.5, W.hero.ry + 0.5, { r: 1.5, color: '#b874ff', life: 0.7 });
        World.text(W, W.hero.rx + 0.5, W.hero.ry - 0.6, `NÍVEL ${st.level}!`, '#d9b8ff', 16, 1.6, -1, true);
      }
      Sfx.play('levelup');
      this.log(`<b>${U.esc(st.name)}</b> alcançou o <b>nível ${st.level}</b>!`, 'lvl');
      UI.dirty('talents');
    }
    UI.dirty('top');
  },

  gainGold(g) {
    const st = this.state, S = this.stats;
    const bm = this.W ? World.buffMods(this.W.hero) : { gold: 0 };
    g *= (1 + S.goldPct / 100) * (1 + (bm.gold || 0));
    g = Math.max(1, Math.round(g));
    st.gold += g;
    st.stats.goldEarned += g;
    this.rateAcc.gold += g;
    if (this.W) this.W.zoneGold += g;
    Sfx.play('coin', 120);
    UI.dirty('top', 'gold');
    return g;
  },

  gainPotion(x, y) {
    const st = this.state;
    if (st.potions >= this.stats.potionMax) return;
    st.potions++;
    if (this.W) World.text(this.W, x + 0.5, y - 0.2, '+Poção', '#ff7a9a', 11);
  },

  dropItem(item, x, y) {
    const st = this.state, W = this.W;
    if (!item.dup && this.stats.flags.has('fairyDust') && Math.random() < 0.2) {
      const twin = Items.generate(item.ilvl, { cls: st.cls, rarity: item.rarity, slot: item.slot, mf: this.stats.mf });
      twin.dup = true;
      setTimeout(() => this.dropItem(twin, x, y), 0);
      if (W) World.text(W, x + 0.5, y - 0.9, 'Pó de Fada!', '#ff9af0', 11);
    }
    st.stats.itemsFound++;
    if (item.rarity === 3) st.stats.epics++;
    if (item.rarity === 4) st.stats.legendaries++;
    if (item.rarity === 5) st.stats.mythics++;
    if (item.rarity === 6) st.stats.celestials = (st.stats.celestials || 0) + 1;
    if (W) W.zoneItems++;
    const col = RARITIES[item.rarity].color;
    const diff = Stats.compareItem(item);
    const equipIt = st.settings.autoEquip && diff > 0.002;

    if (!equipIt && this.isJunk(item)) {
      const p = this.autoSell(item);
      if (W && st.settings.dmgNumbers) World.text(W, x + 0.5, y - 0.4, `Vendido +${U.fmt(p)}`, col, 10, 1.1, -0.8);
      if (item.rarity >= 2) this.log(`Saque: <span class="c${item.rarity}">${U.esc(item.name)}</span> <span style="color:var(--dim)">(vendido automaticamente por ${U.fmt(p)} ouro)</span>`, 'loot');
      return;
    }

    if (W) {
      World.burst(W, x + 0.5, y + 0.5, col, 6 + item.rarity * 4, 3);
      if (item.rarity >= 3) {
        World.fx(W, 'ring', x + 0.5, y + 0.5, { r: 1.5 + item.rarity * 0.3, color: col, life: 0.9 });
        World.text(W, x + 0.5, y - 0.6, RARITIES[item.rarity].name.toUpperCase() + '!', col, 13, 1.6, -0.8, true);
      }
    }
    if (item.excl) {
      item.locked = true;
      st.exclFound[item.excl] = true;
      Sfx.play('legendary'); setTimeout(() => Sfx.play('ascend'), 400);
      UI.banner(item.name, `ARMA EXCLUSIVA! Criada por ${EXCLUSIVES[item.excl].by}`, 'purple', 4);
      this.log(`🌈 <b class="c7">${U.esc(item.name)}</b> é uma arma exclusiva criada por <b>${U.esc(EXCLUSIVES[item.excl].by)}</b>! Ela fica com você em todas as jornadas.`, 'loot');
    } else if (item.rarity === 6) { item.locked = true; Sfx.play('legendary'); setTimeout(() => Sfx.play('rare'), 300); UI.banner(item.name, 'Item CELESTIAL encontrado!', 'purple', 3.5); }
    else if (item.rarity >= 5) { Sfx.play('legendary'); UI.banner(item.name, 'Item Mítico encontrado!', 'red', 2.5); }
    else if (item.rarity === 4) { Sfx.play('legendary'); UI.banner(item.name, 'Item Lendário encontrado!', '', 2.2); }
    else if (item.rarity === 3) Sfx.play('epic');
    else if (item.rarity === 2) Sfx.play('rare');
    if (item.rarity >= 2) this.log(`Saque: <span class="c${item.rarity}">${U.esc(item.name)}</span> <span style="color:var(--dim)">(${RARITIES[item.rarity].name}, Nv ${item.ilvl})</span>`, 'loot');

    if (equipIt) {
      const old = st.equip[item.slot];
      this.equip(item, true);
      UI.toast(item, `Equipado! +${U.fmtNum(diff * 100, 1)}% Poder`);
      if (old) this.addToInv(old);
      return;
    }
    UI.toast(item);
    this.addToInv(item);
  },

  isJunk(item, lvl = this.state.settings.autoSell) {
    return lvl > 0 && item.rarity < lvl && !item.locked && item.plus === 0 && Stats.compareItem(item) <= 0;
  },

  addToInv(item) {
    const st = this.state;
    if (this.isJunk(item)) { this.autoSell(item); return; }
    const cap = Stats.invSize(st);
    if (st.inv.length >= cap) {
      let worst = item, ws = this.itemScore(item);
      for (const it of st.inv) {
        if (it.locked) continue;
        const s = this.itemScore(it);
        if (s < ws) { ws = s; worst = it; }
      }
      if (worst !== item) st.inv.splice(st.inv.indexOf(worst), 1);
      this.autoSell(worst);
      if (worst === item) return;
    }
    st.inv.push(item);
    UI.dirty('equip', 'forge');
  },
  itemScore(it) { return it.rarity * 10 + it.ilvl * 0.3 + Stats.compareItem(it) * 50 + it.plus * 3; },

  autoSell(item) {
    const p = Items.sellPrice(item);
    this.state.gold += p;
    this.state.stats.goldEarned += p;
    this.autoSold.n++; this.autoSold.gold += p;
    UI.dirty('top', 'gold');
    return p;
  },
  flushAutoSold() {
    if (this.autoSold.n > 0) {
      this.log(`Vendidos automaticamente: ${this.autoSold.n} ${this.autoSold.n > 1 ? 'itens' : 'item'} (+${U.fmt(this.autoSold.gold)} ouro).`, 'gold');
      this.autoSold.n = 0; this.autoSold.gold = 0;
    }
  },

  applyAutoSell() {
    const r = this.sellWhere(it => this.isJunk(it));
    if (r.n) this.log(`Auto-venda aplicada à mochila: ${r.n} ${r.n > 1 ? 'itens vendidos' : 'item vendido'} (+${U.fmt(r.gold)} ouro).`, 'gold');
    return r;
  },

  sellWhere(pred) {
    const st = this.state;
    let n = 0, gold = 0;
    st.inv = st.inv.filter(it => {
      if (it.locked || !pred(it)) return true;
      n++; gold += Items.sellPrice(it); return false;
    });
    if (n) {
      st.gold += gold; st.stats.goldEarned += gold;
      Sfx.play('coin');
      UI.dirty('equip', 'top', 'gold', 'forge');
    }
    return { n, gold };
  },
  sellPreview(pred) {
    let n = 0, gold = 0, up = 0;
    for (const it of this.state.inv) if (!it.locked && pred(it)) { n++; gold += Items.sellPrice(it); if (Stats.compareItem(it) > 0.002) up++; }
    return { n, gold, up };
  },
  bulkFilters() {
    const notUp = it => Stats.compareItem(it) <= 0.002;
    const f = RARITIES.map(R => ({ id: 'r' + R.id, label: `Todos os itens ${R.name.endsWith('m') ? R.name.slice(0, -1) + 'ns' : R.name.endsWith('l') ? R.name.slice(0, -1) + 'is' : R.name + 's'}`, color: R.color, pred: it => it.rarity === R.id, confirm: R.id >= 3 }));
    f.push({ id: 'junk', label: 'Tudo que não é melhoria', color: '#ece4d4', pred: it => notUp(it) && it.plus === 0 && it.rarity < 4, confirm: true });
    f.push({ id: 'all', label: 'Toda a mochila', color: '#ff8a8a', pred: () => true, confirm: true });
    return f;
  },

  findItem(uid) {
    const st = this.state;
    for (const s of EQUIP_SLOTS) if (st.equip[s] && st.equip[s].uid === uid) return { item: st.equip[s], where: 'equip' };
    const it = st.inv.find(i => i.uid === uid);
    return it ? { item: it, where: 'inv' } : null;
  },

  equip(item, fromDrop) {
    const st = this.state;
    if (item.slot === 'weapon' && item.cls && item.cls !== st.cls) Items.convertWeapon(item, st.cls);
    const i = st.inv.indexOf(item);
    if (i >= 0) st.inv.splice(i, 1);
    const old = st.equip[item.slot];
    st.equip[item.slot] = item;
    item.isNew = false;
    if (old && !fromDrop) st.inv.push(old);
    this.recalc();
    if (!fromDrop) Sfx.play('click');
    UI.dirty('equip', 'forge');
    return old;
  },

  unequip(slot) {
    const st = this.state;
    const it = st.equip[slot];
    if (!it) return;
    if (st.inv.length >= Stats.invSize(st)) { UI.notice('Mochila cheia!'); return; }
    st.equip[slot] = null;
    st.inv.push(it);
    this.recalc();
  },

  sell(item) {
    const st = this.state;
    const i = st.inv.indexOf(item);
    if (i < 0 || item.locked) return;
    st.inv.splice(i, 1);
    const p = Items.sellPrice(item);
    st.gold += p; st.stats.goldEarned += p;
    Sfx.play('coin');
    this.log(`Vendeu <span class="c${item.rarity}">${U.esc(item.name)}</span> por ${U.fmt(p)} ouro.`, 'gold');
    UI.dirty('equip', 'top', 'gold');
  },

  toggleLock(item) { item.locked = !item.locked; UI.dirty('equip', 'forge'); },

  sortInv() {
    this.state.inv.sort((a, b) => b.rarity - a.rarity || SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || b.ilvl - a.ilvl);
    UI.dirty('equip');
  },

  forge(item) {
    const st = this.state;
    const cost = Items.forgeCost(item);
    if (st.gold < cost) return null;
    st.gold -= cost;
    const ok = Math.random() < Items.forgeChance(item);
    if (ok) {
      item.plus++;
      if (item.plus > st.stats.maxForge) st.stats.maxForge = item.plus;
      Sfx.play('forgeOk');
      this.log(`Forja: <span class="c${item.rarity}">${U.esc(item.name)}</span> agora é <b>+${item.plus}</b>!`, 'good');
    } else {
      Sfx.play('forgeFail');
      this.log(`Forja falhou em <span class="c${item.rarity}">${U.esc(item.name)}</span>. O ouro foi perdido.`, 'bad');
    }
    this.recalc();
    return ok;
  },

  buyQty() { const q = this.state.settings.buyQty; return QTY_STEPS.includes(q) ? q : 1; },
  buyTraining(id, n = 1) {
    const st = this.state, t = TRAINING.find(x => x.id === id);
    const want = n === true || n === Infinity ? Infinity : Math.max(1, +n || 1);
    let k = 0;
    while (k < want) {
      const r = st.training[id] || 0;
      if (t.max && r >= t.max) break;
      const c = Stats.trainCost(t, r);
      if (st.gold < c) break;
      st.gold -= c; st.training[id] = r + 1; k++;
    }
    if (k) { Sfx.play('buy'); this.recalc(); }
    return k;
  },

  canTalent(id) {
    const st = this.state, sk = SKILLS[id];
    return st.level >= sk.unlock && (st.talents[id] || 0) < sk.max && Stats.talentFree(st) > 0;
  },
  talentUp(id) {
    if (!this.canTalent(id)) return;
    this.state.talents[id] = (this.state.talents[id] || 0) + 1;
    Sfx.play('buy');
    this.recalc();
  },
  autoTalents() {
    const st = this.state;
    let guard = 400;
    while (Stats.talentFree(st) > 0 && guard-- > 0) {
      const ids = Stats.talentIds(st).filter(id => st.level >= SKILLS[id].unlock && (st.talents[id] || 0) < SKILLS[id].max);
      if (!ids.length) {
        if (!Stats.maestriaOpen(st)) break;
        const opts = MAESTRIA.filter(m => m.w && (!m.max || (st.talents[m.id] || 0) < m.max));
        const pick = opts.reduce((a, b) => ((st.talents[b.id] || 0) / b.w < (st.talents[a.id] || 0) / a.w ? b : a));
        st.talents[pick.id] = (st.talents[pick.id] || 0) + 1;
        continue;
      }
      let pick = ids.find(id => !(st.talents[id] || 0) && SKILLS[id].type !== 'passive') || ids.find(id => !(st.talents[id] || 0));
      if (!pick) pick = ids.reduce((a, b) => ((st.talents[b] || 0) < (st.talents[a] || 0) ? b : a));
      st.talents[pick] = (st.talents[pick] || 0) + 1;
    }
    this.recalc();
  },
  resetTalents() {
    const st = this.state;
    st.talents = { [CLASSES[st.cls].skills[0]]: 1 };
    this.recalc();
    if (st.settings.autoTalent) this.autoTalents();
  },

  buySoul(id, n = 1) {
    const st = this.state, u = SOUL_UPGRADES.find(x => x.id === id);
    const want = n === true || n === Infinity ? Infinity : Math.max(1, +n || 1);
    let k = 0;
    while (k < want) {
      const r = st.soulUpg[id] || 0;
      if (u.max && r >= u.max) break;
      const c = Stats.soulCost(u, r);
      if (st.souls < c) break;
      st.souls -= c; st.soulUpg[id] = r + 1; k++;
    }
    if (k) { Sfx.play('buy'); this.recalc(); }
    return k;
  },

  endRun(gain, countAsc) {
    const st = this.state, n = this.slot;
    if (!st) return null;
    const info = { cls: st.cls, species: st.species, name: st.name, hardcore: st.hardcore, slot: n };
    for (const it of [...EQUIP_SLOTS.map(k => st.equip[k]), ...st.inv]) if (it && it.excl) { it.isNew = false; st.vault.push(it); }
    const w = st.equip.weapon;
    if (w && w.fusion && st.fusions[this.fusionKey(st.cls, w.fusion)]) st.fusionPref[st.cls] = w.fusion;
    st.souls += gain;
    st.stats.soulsEarned += gain;
    if (countAsc) st.stats.ascensions++;
    this.checkUnlocks();
    this.syncProfileFromState();
    this.saveProfile();
    this.deleteSlotLocal(n);
    Online.deleteCloud(n);
    Online.scoreDirty = true;
    Online.flush();
    this.running = false; this.paused = false; this.transition = null;
    this.state = null;
    return info;
  },
  finishRun(gain, countAsc, label, newCls, newSpecies, hardcore, fromStart) {
    const wasRunning = this.running;
    const info = this.endRun(gain, countAsc);
    if (!info) return;
    Sfx.play('ascend');
    if (newCls) {
      this.slot = info.slot;
      this.newGame(newCls, newSpecies || info.species, info.name, hardcore === undefined ? info.hardcore : hardcore, { fromStart });
      this.log(`<b style="color:#d9b8ff">${label}</b> Você recebeu <b>${U.fmt(gain)} Almas</b>. Uma nova jornada começa.`, 'lvl');
      if (wasRunning) this.start(); else this.enterZone(this.state.zone, true);
      UI.banner(label.toUpperCase(), `+${U.fmt(gain)} Almas`, 'purple', 3);
      return;
    }
    UI.closeModal();
    UI.selSlot = info.slot;
    UI.showTitle('new');
    UI.notice(`${label} +${U.fmt(gain)} Almas. Escolha o próximo herói!`, '#d9b8ff');
  },
  ascend(newCls, newSpecies, hardcore, fromStart) {
    const gain = Stats.soulsOnAscend(this.state);
    if (gain <= 0) return;
    this.finishRun(gain, true, 'Ascensão!', newCls, newSpecies, hardcore, fromStart);
  },

  gameOver() {
    const st = this.state;
    if (st.pendingEnd) return;
    const gain = st.maxZone >= 15 ? Stats.soulsOnAscend(st) : Math.floor(st.maxZone / 2);
    st.pendingEnd = { gain, zone: st.maxZone, level: st.level, kills: st.stats.kills };
    st.stats.gameOvers = (st.stats.gameOvers || 0) + 1;
    this.paused = true;
    this.save();
    Online.scoreDirty = true;
    Online.flush();
    Sfx.play('death');
    UI.gameOverModal();
  },
  finishGameOver(newCls, newSpecies, hardcore, fromStart) {
    const pe = this.state && this.state.pendingEnd;
    if (!pe) return;
    this.finishRun(pe.gain, pe.zone >= 15, 'Fim de jogo:', newCls, newSpecies, hardcore, fromStart);
  },

  achValue(a, st = this.state) { return a.val ? a.val(st) : st.stats[a.stat] || 0; },
  checkAchievements() {
    const st = this.state;
    let any = false;
    for (const a of ACHIEVEMENTS) {
      if (st.ach[a.id]) continue;
      if (this.achValue(a, st) >= a.goal) {
        st.ach[a.id] = true; any = true;
        const rw = Object.entries(a.reward).map(([k, v]) => Items.statLine(k, v)).join(', ');
        this.log(`🏆 Conquista: <b style="color:var(--gold)">${a.name}</b>. Recompensa: ${rw}`, 'good');
        UI.toastText(`🏆 ${a.name}`, rw, '#f2c25b');
        Sfx.play('rare');
      }
    }
    if (any) { this.recalc(); UI.dirty('ach'); }
  },

  offlineGains(sec, eff) {
    const st = this.state, z = st.zone;
    const rg = Math.max(st.rates.gold, 1.0 * zoneScale(z)), rx = Math.max(st.rates.xp, 1.5 * zoneScale(z));
    return { gold: rg * sec * eff, xp: rx * sec * eff, items: Math.min(40, Math.floor(sec / 75 * eff)) };
  },
  applyGains(g) {
    const st = this.state;
    st.gold += Math.round(g.gold); st.stats.goldEarned += Math.round(g.gold);
    const lv0 = st.level;
    st.xp += g.xp;
    while (st.xp >= Stats.needXpFor(st)) { st.xp -= Stats.needXpFor(st); st.level++; }
    if (st.level > st.stats.maxLevel) st.stats.maxLevel = st.level;
    let kept = 0;
    const before = this.autoSold.n;
    for (let i = 0; i < g.items; i++) {
      const it = Items.generate(st.zone, { cls: st.cls, mf: this.stats.mf });
      st.stats.itemsFound++;
      if (it.rarity === 3) st.stats.epics++;
      if (it.rarity === 4) st.stats.legendaries++;
      if (it.rarity === 5) st.stats.mythics++;
      if (it.rarity === 6) st.stats.celestials = (st.stats.celestials || 0) + 1;
      const d = Stats.compareItem(it);
      if (st.settings.autoEquip && d > 0.002) { const old = st.equip[it.slot]; this.equip(it, true); if (old) this.addToInv(old); }
      else this.addToInv(it);
      kept++;
    }
    const sold = this.autoSold.n - before;
    this.recalc();
    if (st.level > lv0 && st.settings.autoTalent) this.autoTalents();
    return { levels: st.level - lv0, items: kept, sold };
  },
  offlineProgress() {
    const st = this.state;
    const sec = Math.min(12 * 3600, (Date.now() - st.lastSave) / 1000);
    if (sec < 60) return;
    const eff = 0.5 + (this.stats.offline || 0) / 100;
    const g = this.offlineGains(sec, eff);
    const r = this.applyGains(g);
    this.autoSold.n = 0; this.autoSold.gold = 0;
    UI.offlineModal(sec, eff, g, r);
  },
  backgroundCatchUp(sec) {
    if (!this.state || !this.W) return;
    sec = Math.min(sec, 12 * 3600);
    const g = this.offlineGains(sec, 0.75);
    const r = this.applyGains(g);
    this.log(`Progresso enquanto a aba estava congelada (${U.fmtTime(sec)}): +${U.fmt(g.gold)} ouro, +${U.fmt(g.xp)} XP${r.levels ? `, +${r.levels} níveis` : ''}, ${r.items} itens.`, 'gold');
  },

  log(html, cls) { UI.addLog(html, cls); },
};
