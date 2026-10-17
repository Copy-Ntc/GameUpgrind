'use strict';
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const VISION = 4.6;

const World = {
  W: null,
  nextId: 1,

  create(z) {
    const M = MapGen.generate(z, Game.pickEncounter ? Game.pickEncounter(z) : null);
    const n = M.w * M.h;
    const W = Object.assign(M, {
      explored: new Uint8Array(n), vis: new Uint8Array(n), occ: new Int32Array(n), flow: new Int32Array(n).fill(-1),
      ents: [], proj: [], fx: [], parts: [], texts: [], timers: [], sings: [],
      boss: null, killed: 0, total: 0, t: 0, phoenix: false, shake: 0,
      mapDirty: true, fogDirty: true, flowKey: -1, blacklist: new Set(), stuckT: 0,
      chestsOpened: 0, zoneGold: 0, zoneXp: 0, zoneItems: 0, completed: false, bossAnnounced: false, relentless: false,
      harvest: 0, frenzy: 0, raven: false, hands: false,
    });
    this.W = W;
    for (const c of W.chests) W.occ[this.idx(c.x, c.y)] = -1;
    for (const s of W.shrines) W.occ[this.idx(s.x, s.y)] = -1;
    if (W.recruit) W.occ[this.idx(W.recruit.x, W.recruit.y)] = -1;
    const S = Game.stats;
    const hero = this.makeEnt('hero', W.start.x, W.start.y, {
      hp: S.maxHp, maxHp: S.maxHp, cls: Game.state.cls, sprite: CLASSES[Game.state.cls].sprite, pal: Sprites.heroPal(Game.state.cls, Game.state.species),
      fly: (S.flags || new Set()).has('flying'),
      buffs: [], shield: 0, shieldT: 0, potionCd: 0, lastCombat: -99, skillCd: {}, status: 'Explorando…', opening: null, resting: false, ignore: new Map(),
    });
    W.hero = hero;
    this.addEnt(W, hero);
    for (const sp of W.spawns) this.spawnEnemy(W, sp);
    W.total = W.ents.filter(e => e.kind === 'enemy').length;
    this.updateVision(W);
    this.updateFlow(W, true);
    return W;
  },

  idx(x, y) { return y * this.W.w + x; },

  makeEnt(kind, x, y, props) {
    return Object.assign({
      id: this.nextId++, kind, x, y, nx: x, ny: y, mt: 0, moving: false, rx: x, ry: y, face: 1,
      hp: 1, maxHp: 1, atk: 1, armor: 0, atkSpd: 1, range: 1.5, move: 3, atkT: U.rand(0.2, 0.8),
      flash: 0, lunge: null, effects: {}, dots: [], dead: false, deathT: 0, aggro: false,
      bob: Math.random() * 10, scale: 1, dotT: 0,
    }, props);
  },
  addEnt(W, e) { W.ents.push(e); W.occ[e.y * W.w + e.x] = e.id; },

  spawnEnemy(W, sp, extra = {}) {
    const z = W.z, S = enemyScale(z), SA = enemyAtkScale(z);
    let def = ENEMIES[sp.type], name, sprite, pal, abil = [], lordDef = null;
    if (sp.lord) {
      lordDef = LORDS[sp.type];
      def = { hp: 1, atk: 1, spd: 0.8, move: 2.0, g: 'm', proj: lordDef.proj };
      name = lordDef.name; sprite = lordDef.sprite; pal = lordDef.pal; abil = lordDef.abil.slice();
    } else {
      name = def.name; sprite = def.sprite; pal = def.pal;
    }
    const gi = def.g === 'f' ? 1 : 0;
    let hp = 40 * S * def.hp, atk = 16 * SA * def.atk;
    if (z <= 5) { atk *= 0.55 + 0.09 * (z - 1); hp *= 0.75 + 0.05 * (z - 1); }
    let scale = 1, xpMult = 1;
    if (sp.elite) { hp *= 3; atk *= 1.6; scale = 1.15; xpMult = 3; name = name + ' ' + U.pick(ELITE_ADJ)[gi]; }
    if (sp.boss && !sp.lord) { hp *= 9; atk *= 1.8; scale = 1.6; xpMult = 12; name = name + ' ' + U.pick(CHAMP_ADJ)[gi]; abil = ['slam']; }
    if (sp.lord) { hp *= 16; atk *= 2.2; scale = 2.0; xpMult = 22; }
    if (sp.type === 'mimic') { xpMult = 8; scale = 1.1; }
    if (extra.weak) { hp *= 0.5; atk *= 0.7; xpMult *= 0.3; }
    const ranged = (def.range || 1.5) > 2;
    const e = this.makeEnt('enemy', sp.x, sp.y, {
      type: sp.type, def, name, sprite, pal, hp, maxHp: hp, atk, armor: def.armor || 0,
      atkSpd: (def.spd || 1) * 0.9, range: def.range || 1.5, ranged, proj: def.proj, move: def.move,
      elite: !!sp.elite, boss: !!sp.boss, lord: !!sp.lord, scale, xpMult, fly: !!def.fly,
      dodge: def.dodge || 0, poison: def.poison || 0, lifesteal: def.lifesteal || 0,
      home: { x: sp.x, y: sp.y }, wanderT: U.rand(1, 5), aggroR: sp.boss ? 5.5 : ranged ? 5.5 : 4.5,
      abil: abil.map(id => ({ id, t: U.rand(2, 4) })), lordDef, summoned: !!extra.summoned, lostT: 0,
    });
    if (sp.boss) W.boss = e;
    this.addEnt(W, e);
    return e;
  },

  walk(W, x, y) { return x >= 0 && y >= 0 && x < W.w && y < W.h && W.tiles[y * W.w + x] === 1; },
  free(W, x, y) { return this.walk(W, x, y) && W.occ[y * W.w + x] === 0; },
  dist(a, b) { return U.dist(a.x, a.y, b.x, b.y); },
  rdist(a, b) { return U.dist(a.rx, a.ry, b.rx, b.ry); },

  los(W, x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, x = x0, y = y0;
    for (;;) {
      if (x === x1 && y === y1) return true;
      if (!(x === x0 && y === y0) && W.tiles[y * W.w + x] === 0) return false;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
  },

  _bfs: null,
  bfs(W, sx, sy, goal, opt = {}) {
    const w = W.w, n = w * W.h;
    if (!this._bfs || this._bfs.n !== n) this._bfs = { n, prev: new Int32Array(n), q: new Int32Array(n), seen: new Int32Array(n), stamp: 0 };
    const B = this._bfs, stamp = ++B.stamp;
    const s = sy * w + sx;
    if (goal(sx, sy, s)) return [];
    let qh = 0, qt = 0;
    B.seen[s] = stamp; B.prev[s] = -1; B.q[qt++] = s;
    const maxN = opt.max || n;
    while (qh < qt && qh < maxN) {
      const i = B.q[qh++], x = i % w, y = (i / w) | 0;
      for (let k = 0; k < 8; k++) {
        const dx = N8[k][0], dy = N8[k][1];
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= w || Y >= W.h) continue;
        const j = Y * w + X;
        if (B.seen[j] === stamp || W.tiles[j] !== 1) continue;
        if (dx && dy && (W.tiles[y * w + X] !== 1 || W.tiles[Y * w + x] !== 1)) continue;
        if (opt.explored && !W.explored[j]) continue;
        const o = W.occ[j];
        const isGoal = goal(X, Y, j);
        if (o !== 0 && o !== opt.self && (o === -1 || opt.avoid) && !(isGoal && o !== -1)) continue;
        B.seen[j] = stamp; B.prev[j] = i;
        if (isGoal) {
          const path = [];
          let c = j;
          while (c !== s) { path.push(c); c = B.prev[c]; }
          return path.reverse();
        }
        B.q[qt++] = j;
      }
    }
    return null;
  },

  updateFlow(W, force) {
    const h = W.hero;
    const key = h.ny * W.w + h.nx;
    if (!force && key === W.flowKey) return;
    W.flowKey = key;
    const w = W.w, n = w * W.h, F = W.flow;
    F.fill(-1);
    const q = new Int32Array(n);
    let qh = 0, qt = 0;
    F[key] = 0; q[qt++] = key;
    while (qh < qt) {
      const i = q[qh++], x = i % w, y = (i / w) | 0;
      for (let k = 0; k < 8; k++) {
        const dx = N8[k][0], dy = N8[k][1], X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= w || Y >= W.h) continue;
        const j = Y * w + X;
        if (F[j] >= 0 || W.tiles[j] !== 1) continue;
        if (dx && dy && (W.tiles[y * w + X] !== 1 || W.tiles[Y * w + x] !== 1)) continue;
        F[j] = F[i] + 1; q[qt++] = j;
      }
    }
  },

  updateVision(W) {
    const h = W.hero, cx = h.x, cy = h.y, R = VISION, R2 = R * R;
    W.vis.fill(0);
    const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(W.w - 1, Math.ceil(cx + R));
    const y0 = Math.max(0, Math.floor(cy - R)), y1 = Math.min(W.h - 1, Math.ceil(cy + R));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > R2) continue;
      if (!this.los(W, cx, cy, x, y)) continue;
      const i = y * W.w + x;
      W.vis[i] = 1;
      if (!W.explored[i]) W.explored[i] = 1;
    }
    W.fogDirty = true;
    for (const c of W.chests) {
      if (!c.seen && !c.opened && W.vis[c.y * W.w + c.x]) {
        c.seen = true;
        if (c.tier === 4) { Game.log('🌈 Você avistou o <b class="c7">Baú Arco-Íris</b>!', 'loot'); UI.banner('BAÚ ARCO-ÍRIS', exclMissing(Game.state).length ? 'Pode conter uma arma exclusiva' : 'Pode conter um item raríssimo', 'purple', 2.4); }
        else if (c.tier >= 2) Game.log(`Você avistou um <span class="c${c.tier + 1}">${CHEST_TIERS[c.tier].name}</span>!`, 'loot');
      }
    }
    for (const s of W.shrines) {
      if (!s.seen && W.vis[s.y * W.w + s.x]) { s.seen = true; Game.log(`Um <b style="color:${SHRINES[s.type].color}">${SHRINES[s.type].name}</b> brilha à distância.`, 'good'); }
    }
    const rc = W.recruit;
    if (rc && !rc.seen && W.vis[rc.y * W.w + rc.x]) {
      rc.seen = true;
      Game.log(`Você avistou <b style="color:var(--gold)">${rc.name}</b> (${rc.label}) aprisionado! Liberte-o para recrutar.`, 'good');
      UI.toastText('Prisioneiro avistado!', `${rc.name} (${rc.label})`, '#f2c25b');
    }
  },

  frontier(W, x, y) {
    const w = W.w, i = y * w + x;
    if (!W.explored[i] || W.tiles[i] !== 1 || W.blacklist.has(i)) return false;
    for (let k = 0; k < 8; k++) {
      const X = x + N8[k][0], Y = y + N8[k][1];
      if (X < 0 || Y < 0 || X >= w || Y >= W.h) continue;
      if (!W.explored[Y * w + X]) return true;
    }
    return false;
  },

  exploredPct(W) {
    let f = 0, e = 0;
    for (let i = 0; i < W.tiles.length; i++) if (W.tiles[i]) { f++; if (W.explored[i]) e++; }
    return f ? e / f : 1;
  },

  startMove(W, e, nx, ny) {
    if (!this.walk(W, nx, ny)) return false;
    const j = ny * W.w + nx;
    const dx = nx - e.x, dy = ny - e.y;
    if (dx && dy && (!this.walk(W, e.x + dx, e.y) || !this.walk(W, e.x, e.y + dy))) return false;
    if (W.occ[j] !== 0 && W.occ[j] !== e.id) {
      const o = e.kind === 'hero' && W.occ[j] > 0 ? W.ents.find(m => m.id === W.occ[j]) : null;
      if (!o || o.kind !== 'minion' || o.moving || o.dead) return false;
      o.x = o.nx = o.rx = e.x; o.y = o.ny = o.ry = e.y;
      W.occ[e.y * W.w + e.x] = o.id;
    }
    W.occ[j] = e.id;
    e.nx = nx; e.ny = ny; e.mt = 0; e.moving = true; e.diag = !!(dx && dy);
    if (dx) e.face = dx > 0 ? 1 : -1;
    return true;
  },
  updateMove(W, e, dt, speed) {
    if (!e.moving) { e.rx = e.x; e.ry = e.y; return; }
    e.mt += dt * speed / (e.diag ? 1.41 : 1);
    if (e.mt >= 1) {
      const oi = e.y * W.w + e.x;
      if (W.occ[oi] === e.id) W.occ[oi] = 0;
      e.x = e.nx; e.y = e.ny; e.moving = false; e.mt = 0;
      W.occ[e.y * W.w + e.x] = e.id;
      e.rx = e.x; e.ry = e.y;
      if (e.kind === 'hero') this.onHeroStep(W, e);
      return;
    }
    e.rx = e.x + (e.nx - e.x) * e.mt;
    e.ry = e.y + (e.ny - e.y) * e.mt;
  },
  stepPath(W, e, path) {
    if (!path || !path.length) return false;
    const j = path[0];
    return this.startMove(W, e, j % W.w, (j / W.w) | 0);
  },
  releaseOcc(W, e) {
    const a = e.y * W.w + e.x, b = e.ny * W.w + e.nx;
    if (W.occ[a] === e.id) W.occ[a] = 0;
    if (W.occ[b] === e.id) W.occ[b] = 0;
  },
  freeNear(W, x, y, maxR = 4) {
    const p = this.bfs(W, x, y, (X, Y, j) => W.occ[j] === 0, { avoid: true, max: 200 });
    if (p && p.length) { const j = p[p.length - 1]; return [j % W.w, (j / W.w) | 0]; }
    if (W.occ[y * W.w + x] === 0) return [x, y];
    return null;
  },

  onHeroStep(W, hero) {
    this.updateVision(W);
    if (W.portal.active && hero.wantPortal && hero.x === W.portal.x && hero.y === W.portal.y && !W.completed) {
      W.completed = true;
      Game.completeZone();
    }
  },

  update(W, dt) {
    W.t += dt;
    const hero = W.hero;
    const S = Game.stats;

    if (hero.dead) {
      hero.deathT -= dt;
      if (hero.deathT <= 0) this.respawn(W);
    } else {
      this.heroTimers(W, hero, dt);
      this.updateSkills(W, hero, dt);
      if (!hero.moving) this.heroThink(W, hero, dt);
      const bm = this.buffMods(hero);
      const slow = hero.effects.slow > 0 ? 0.6 : 1;
      this.updateMove(W, hero, dt, S.moveSpd * (1 + bm.move) * slow);
    }
    this.updateFlow(W);

    for (const e of W.ents) {
      if (e.kind === 'hero') continue;
      if (e.dead) { e.deathT -= dt; continue; }
      this.entTimers(W, e, dt);
      if (e.dead) continue;
      if (e.kind === 'enemy') {
        if (e.boss) this.bossThink(W, e, dt);
        if (!e.moving && !e.casting) this.enemyThink(W, e, dt);
      } else if (e.kind === 'minion') {
        e.life -= dt;
        if (e.life <= 0) { this.killMinion(W, e); continue; }
        if (!e.moving) this.minionThink(W, e, dt);
      }
      const pulled = e.effects.pull > 0;
      const frozen = !pulled && (e.effects.freeze > 0 || e.effects.stun > 0);
      if (!frozen) this.updateMove(W, e, dt, pulled ? Math.max(5, e.move) : e.move * (e.effects.slow > 0 ? 0.6 : 1));
    }
    W.ents = W.ents.filter(e => !(e.dead && e.deathT <= 0 && e.kind !== 'hero'));

    for (const p of W.proj) {
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.life -= dt;
      if (p.tgt && !p.tgt.dead) { p.tx = p.tgt.rx + 0.5; p.ty = p.tgt.ry + 0.45; }
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.sqrt(dx * dx + dy * dy);
      const step = p.speed * dt;
      p.trail.push([p.x, p.y]);
      if (p.trail.length > 6) p.trail.shift();
      if (d <= step || p.life <= 0) {
        p.done = true;
        p.x = p.tx; p.y = p.ty;
        if (p.tgt && !p.tgt.dead) p.onHit(p.tgt, p);
        else if (p.aoe) p.onHit(null, p);
        this.impactFx(W, p);
      } else { p.x += dx / d * step; p.y += dy / d * step; p.ang = Math.atan2(dy, dx); }
    }
    W.proj = W.proj.filter(p => !p.done);
    if (W.sings && W.sings.length) this.updateSings(W, dt);

    if (W.timers.length) {
      for (const t of W.timers) { t.t -= dt; if (t.t <= 0 && !t.done) { t.done = true; t.fn(); } }
      W.timers = W.timers.filter(t => !t.done);
    }

    for (const f of W.fx) f.t += dt;
    W.fx = W.fx.filter(f => f.t < f.life);
    for (const p of W.parts) {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.grav || 0) * dt;
      if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
    }
    W.parts = W.parts.filter(p => p.t < p.life);
    for (const t of W.texts) { t.t += dt; t.y += t.vy * dt; t.vy *= 1 - 2.5 * dt; }
    W.texts = W.texts.filter(t => t.t < t.life);
    W.shake = Math.max(0, W.shake - dt * 3);
  },

  heroTimers(W, hero, dt) {
    const S = Game.stats;
    hero.atkT -= dt;
    hero.potionCd -= dt;
    hero.flash = Math.max(0, hero.flash - dt);
    if (hero.lunge) { hero.lunge.t -= dt; if (hero.lunge.t <= 0) hero.lunge = null; }
    for (const k in hero.effects) hero.effects[k] = Math.max(0, hero.effects[k] - dt);
    for (const b of hero.buffs) b.t -= dt;
    const before = hero.buffs.length;
    hero.buffs = hero.buffs.filter(b => b.t > 0);
    if (before !== hero.buffs.length) hero._bm = null;
    if (hero.shieldT > 0) { hero.shieldT -= dt; if (hero.shieldT <= 0) hero.shield = 0; }
    const bmr = this.buffMods(hero);
    let reg = S.regen + hero.maxHp * (bmr.regen || 0);
    const idle = W.t - hero.lastCombat > 2.5;
    if (idle) reg += hero.maxHp * (hero.resting ? 0.09 * (S.flags.has('trance') ? 1.6 : 1) : 0.04);
    hero.hp = Math.min(hero.maxHp, hero.hp + reg * dt);
    if (hero.dots.length) {
      hero.dotT -= dt;
      if (hero.dotT <= 0) {
        hero.dotT = 0.5;
        const pm = S.flags.has('poisonImmune') ? 0 : S.flags.has('poisonRes') ? 0.5 : 1;
        if (pm > 0) for (const d of hero.dots) this.hurtHero(W, d.dps * 0.5 * pm, null, { dot: true, color: d.color });
      }
      for (const d of hero.dots) d.t -= dt;
      hero.dots = hero.dots.filter(d => d.t > 0);
    }
    if (S.flags.has('holyAura')) {
      hero.auraT = (hero.auraT || 0) - dt;
      if (hero.auraT <= 0) {
        hero.auraT = 1;
        const near = this.enemiesNear(W, hero.rx, hero.ry, 2.2);
        for (const e of near) this.damage(W, e, S.atk * 0.6 * (1 - e.armor), { color: '#fff2a0', dot: true });
        if (near.length) this.fx(W, 'ring', hero.rx + 0.5, hero.ry + 0.5, { r: 2.2, color: '#fff2a0', life: 0.35 });
      }
    }
    if (S.powers.has('bluefire')) {
      hero.blueT = (hero.blueT || 0) - dt;
      if (Math.random() < dt * 14) {
        const a = Math.random() * Math.PI * 2, r = U.rand(0.6, 2.3);
        this.part(W, hero.rx + 0.5 + Math.cos(a) * r, hero.ry + 0.5 + Math.sin(a) * r, 0, -0.9, Math.random() < 0.4 ? '#bff4ff' : '#3a8aff', 0.6, 2, 0);
      }
      if (hero.blueT <= 0) {
        hero.blueT = 0.6;
        const near = this.enemiesNear(W, hero.rx, hero.ry, 2.5);
        for (const e of near) this.damage(W, e, S.atk * 0.45 * (1 - e.armor), { color: '#5ac8ff', dot: true });
        if (near.length) this.fx(W, 'ring', hero.rx + 0.5, hero.ry + 0.5, { r: 2.5, color: '#5ac8ff', life: 0.4 });
      }
    }
    if (S.powers.has('predator')) this.updatePrey(W, hero, dt);
    if (S.powers.has('spin')) this.updateSpin(W, hero, dt);
    if (S.powers.has('devour')) this.updateDevour(W, hero, dt);
    this.exclAura(W, hero, dt);
    if (S.powers.has('heaven') && !hero.dead) this.updateHeaven(W, hero);
    else if (W.heaven && !W.heaven.dead) { this.killMinion(W, W.heaven); W.heaven = null; }
    if (S.flags.has('starfall')) {
      hero.starT = (hero.starT === undefined ? 4 : hero.starT) - dt;
      const t = hero.target;
      if (hero.starT <= 0 && t && !t.dead && this.dist(hero, t) <= 7) { hero.starT = 10; this.meteor(W, t.rx, t.ry, 1.6, 4); }
    }
    if (hero.hp < hero.maxHp * 0.35 && Game.state.potions > 0 && hero.potionCd <= 0 && !hero.dead) this.drinkPotion(W, hero);
  },

  entTimers(W, e, dt) {
    e.atkT -= dt;
    e.flash = Math.max(0, e.flash - dt);
    if (e.lunge) { e.lunge.t -= dt; if (e.lunge.t <= 0) e.lunge = null; }
    for (const k in e.effects) e.effects[k] = Math.max(0, e.effects[k] - dt);
    if (e.dots.length) {
      e.dotT -= dt;
      if (e.dotT <= 0) {
        e.dotT = 0.5;
        for (const d of e.dots) {
          if (e.dead) break;
          this.damage(W, e, d.dps * 0.5, { color: d.color, dot: true });
        }
      }
      for (const d of e.dots) d.t -= dt;
      e.dots = e.dots.filter(d => d.t > 0);
    }
    if (e.casting) {
      e.casting.t -= dt;
      if (e.casting.t <= 0) { const c = e.casting; e.casting = null; c.fn(); }
    }
  },

  buffMods(hero) {
    if (hero._bm && hero._bmT === hero.buffs.length) return hero._bm;
    const m = { dmg: 0, def: 0, atkSpd: 0, crit: 0, dodge: 0, move: 0, gold: 0, xp: 0, lifesteal: 0, regen: 0 };
    for (const b of hero.buffs) for (const k in b.mods) m[k] = (m[k] || 0) + b.mods[k];
    hero._bm = m; hero._bmT = hero.buffs.length;
    return m;
  },
  addBuff(hero, id, name, color, dur, mods) {
    const ex = hero.buffs.find(b => b.id === id);
    if (ex) { ex.t = Math.max(ex.t, dur); ex.max = Math.max(ex.max, dur); }
    else hero.buffs.push({ id, name, color, t: dur, max: dur, mods });
    hero._bm = null;
  },

  heroThink(W, hero, dt) {
    const st = Game.state;
    hero.wantPortal = false;
    if (hero.effects.stun > 0 || hero.effects.freeze > 0) { hero.status = 'Atordoado!'; return; }
    if (hero.opening) {
      hero.opening.t -= dt;
      hero.status = hero.opening.kind === 'chest' ? 'Abrindo baú…' : hero.opening.kind === 'recruit' ? (hero.opening.obj.kind === 'relic' ? 'Reivindicando a Arma Ancestral…' : `Libertando ${hero.opening.obj.name}…`) : 'Ativando santuário…';
      if (hero.opening.t <= 0) {
        const o = hero.opening; hero.opening = null;
        if (o.kind === 'chest') this.openChest(W, o.obj);
        else if (o.kind === 'recruit') this.freeRecruit(W, o.obj);
        else this.useShrine(W, o.obj);
      }
      return;
    }

    if (this.breakLoop(W, hero, dt)) return;
    let tgt = this.pickTarget(W, hero);
    if (tgt && !tgt.aggro && hero.hp < hero.maxHp * 0.5) tgt = null;
    if (!tgt) {
      if (hero.resting) {
        if (hero.hp >= hero.maxHp * 0.97) hero.resting = false;
        else { hero.status = 'Descansando…'; W.stuckT = 0; if (Math.random() < dt * 1.2) this.text(W, hero.rx + 0.6, hero.ry - 0.2, 'z', '#c9c3ff', 11, 1.2, -0.6); return; }
      } else if (hero.hp < hero.maxHp * 0.5 && W.t - hero.lastCombat > 1) {
        hero.resting = true; hero.status = 'Descansando…'; return;
      }
    } else hero.resting = false;

    const S = Game.stats;
    if (tgt) {
      hero.target = tgt;
      hero.status = `Combatendo ${tgt.name}`;
      const d = this.dist(hero, tgt);
      const inRange = d <= S.range + 0.05 && (S.range < 2 || this.los(W, hero.x, hero.y, tgt.x, tgt.y));
      if (inRange) {
        W.stuckT = 0;
        hero.lastCombat = W.t;
        if (hero.atkT <= 0) this.heroAttack(W, hero, tgt);
        return;
      }
      const R = S.range;
      const goal = (x, y) => U.dist(x, y, tgt.x, tgt.y) <= R + 0.05 && (R < 2 || this.los(W, x, y, tgt.x, tgt.y));
      let path = this.bfs(W, hero.x, hero.y, goal, { self: hero.id, avoid: true, max: 1500 });
      if (!path) path = this.bfs(W, hero.x, hero.y, goal, { self: hero.id, max: 1500 });
      if (this.stepPath(W, hero, path)) { hero.tgtStuck = 0; return; }
      hero.tgtStuck = (hero.tgtStuck || 0) + dt;
      if (hero.tgtStuck > 2.5 && !tgt.aggro) { hero.ignore.set(tgt.id, W.t + 10); hero.tgtStuck = 0; hero.target = null; }
      else if (hero.tgtStuck > 6) { hero.ignore.set(tgt.id, W.t + 4); hero.tgtStuck = 0; hero.target = null; }
      this.stuck(W, hero, dt);
      return;
    }
    hero.target = null;

    const goals = new Map();
    const skip = o => o.skipUntil && o.skipUntil > W.t;
    for (const c of W.chests) if (!c.opened && !skip(c) && W.explored[c.y * W.w + c.x]) goals.set(c, 'chest');
    for (const s of W.shrines) if (!s.used && !skip(s) && W.explored[s.y * W.w + s.x]) goals.set(s, 'shrine');
    if (W.recruit && !W.recruit.freed && !skip(W.recruit) && W.explored[W.recruit.y * W.w + W.recruit.x]) goals.set(W.recruit, 'recruit');
    if (goals.size) {
      for (const [obj, kind] of goals) {
        if (Math.max(Math.abs(obj.x - hero.x), Math.abs(obj.y - hero.y)) <= 1) {
          hero.opening = { obj, kind, t: kind === 'chest' ? 0.55 : kind === 'recruit' ? 1.4 : 0.8 };
          hero.face = obj.x >= hero.x ? 1 : -1;
          obj.shaking = true;
          W.stuckT = 0;
          return;
        }
      }
      const list = [...goals.keys()];
      const goal = (x, y) => list.some(o => Math.max(Math.abs(o.x - x), Math.abs(o.y - y)) <= 1);
      const path = this.bfs(W, hero.x, hero.y, goal, { self: hero.id, avoid: true });
      if (path) {
        const k0 = goals.get(list[0]);
        hero.status = k0 === 'chest' ? 'Indo até um baú…' : k0 === 'recruit' ? (list[0].kind === 'relic' ? 'Indo ao Cofre Ancestral…' : 'Indo resgatar o prisioneiro…') : 'Indo ao santuário…';
        if (!this.stepPath(W, hero, path)) this.stuck(W, hero, dt);
        return;
      }
    }

    const bossAlive = W.boss && !W.boss.dead;
    if (bossAlive || st.settings.exploreAll) {
      const path = this.bfs(W, hero.x, hero.y, (x, y) => this.frontier(W, x, y), { self: hero.id, explored: true });
      if (path && path.length) {
        hero.status = 'Explorando…';
        if (this.stepPath(W, hero, path)) { W.stuckT = 0; return; }
        const path2 = this.bfs(W, hero.x, hero.y, (x, y) => this.frontier(W, x, y), { self: hero.id, explored: true, avoid: true });
        if (this.stepPath(W, hero, path2)) { W.stuckT = 0; return; }
        this.stuck(W, hero, dt, path[path.length - 1]);
        return;
      }
    }
    if (bossAlive) {
      const b = W.boss;
      hero.status = `Caçando ${b.name}`;
      hero.ignore.delete(b.id);
      const path = this.bfs(W, hero.x, hero.y, (x, y) => U.dist(x, y, b.x, b.y) <= 1.5, { self: hero.id });
      if (!this.stepPath(W, hero, path)) {
        if (this.dist(hero, b) <= 1.5) { this.alert(W, b); hero.target = b; }
        this.stuck(W, hero, dt);
      }
      return;
    }
    if (W.portal.active) {
      hero.status = 'Indo ao portal…';
      hero.wantPortal = true;
      const path = this.bfs(W, hero.x, hero.y, (x, y) => x === W.portal.x && y === W.portal.y, { self: hero.id });
      if (path && path.length === 0) { this.onHeroStep(W, hero); return; }
      if (!this.stepPath(W, hero, path)) this.stuck(W, hero, dt);
    }
  },

  breakLoop(W, hero, dt) {
    if (hero.resting || W.t - hero.lastCombat < 2) { hero.trail = []; hero.trailT = 0; return false; }
    hero.trailT = (hero.trailT || 0) + dt;
    if (hero.trailT < 0.5) return false;
    hero.trailT = 0;
    const tr = hero.trail || (hero.trail = []);
    tr.push(hero.y * W.w + hero.x);
    if (tr.length > 16) tr.shift();
    if (tr.length < 16 || new Set(tr).size > 4) return false;
    for (const i of tr) W.blacklist.add(i);
    for (const o of [...W.chests, ...W.shrines, W.recruit]) if (o && U.dist(o.x, o.y, hero.x, hero.y) <= 6) o.skipUntil = W.t + 30;
    if (hero.target) { hero.ignore.set(hero.target.id, W.t + 20); hero.target = null; }
    hero.trail = [];
    W.loops = (W.loops || 0) + 1;
    if (W.loops >= 3 && !(W.boss && !W.boss.dead)) W.portal.active = true;
    return true;
  },

  stuck(W, hero, dt, goalIdx) {
    W.stuckT += dt;
    if (goalIdx !== undefined && W.stuckT > 3) { W.blacklist.add(goalIdx); W.stuckT = 0; }
    if (W.stuckT > 4 && !hero.moving && Math.random() < dt * 2) {
      const opts = N8.map(([dx, dy]) => [hero.x + dx, hero.y + dy]).filter(([x, y]) => this.free(W, x, y));
      if (opts.length) { const [x, y] = U.pick(opts); this.startMove(W, hero, x, y); }
    }
    if (W.stuckT > 25 && !W.completed) {
      if (W.boss && !W.boss.dead) return;
      W.portal.active = true;
    }
  },

  pickTarget(W, hero) {
    let best = null, bs = Infinity;
    for (const e of W.ents) {
      if (e.kind !== 'enemy' || e.dead || e.hidden) continue;
      const ig = hero.ignore.get(e.id);
      if (ig && ig > W.t && !(e.aggro && this.dist(hero, e) <= 1.5)) continue;
      const d = this.dist(hero, e);
      const engaged = e.aggro && d < 9;
      const visible = W.vis[e.y * W.w + e.x] && d <= 6.5;
      if (!engaged && !visible) continue;
      let s = d - (engaged ? 3 : 0) - (hero.target === e ? 1.5 : 0) + (e.boss && !e.aggro ? 3 : 0);
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  },

  heroAttack(W, hero, tgt) {
    const S = Game.stats, bm = this.buffMods(hero);
    const rage = S.flags.has('rage') && hero.hp < hero.maxHp * 0.5 ? 1.3 : 1;
    hero.atkT = 1 / (S.atkSpd * (1 + bm.atkSpd) * rage * (1 + W.frenzy * 0.02));
    hero.face = tgt.x > hero.x ? 1 : tgt.x < hero.x ? -1 : hero.face;
    const cls = CLASSES[hero.cls];
    const twice = S.flags.has('extraArms') && Math.random() < 0.3;
    if (S.powers.has('spike')) {
      hero.spikeN = (hero.spikeN || 0) + 1;
      if (hero.spikeN >= 4) { hero.spikeN = 0; this.spikeSlam(W, tgt); }
    }
    if (S.powers.has('spin')) this.fx(W, 'spiral', tgt.rx + 0.5, tgt.ry + 0.5, { life: 0.3, ang: Math.atan2(tgt.y - hero.y, tgt.x - hero.x) });
    if (cls.ranged) {
      const spd = cls.proj === 'arrow' || cls.proj === 'bullet' ? 13 : 10;
      this.shoot(W, hero, tgt, cls.proj, (t) => this.heroHit(W, t, 1), { speed: spd });
      if (twice) this.shoot(W, hero, tgt, cls.proj, (t) => this.heroHit(W, t, 0.8), { speed: spd, delay: 0.1 });
      Sfx.play(cls.proj === 'arrow' ? 'shoot' : cls.proj === 'bullet' ? 'gun' : 'magic', 80);
    } else {
      hero.lunge = { dx: tgt.x - hero.x, dy: tgt.y - hero.y, t: 0.15 };
      this.heroHit(W, tgt, 1);
      if (twice) this.heroHit(W, tgt, 0.8);
      this.fx(W, 'slash', tgt.rx + 0.5, tgt.ry + 0.5, { life: 0.18, color: '#ffffff', ang: Math.atan2(tgt.y - hero.y, tgt.x - hero.x) });
      Sfx.play('swing', 90);
    }
  },

  spikeSlam(W, tgt) {
    const S = Game.stats, cx = tgt.rx, cy = tgt.ry;
    for (const e of this.enemiesNear(W, cx, cy, 2.2)) {
      this.heroHit(W, e, 2.2, { noProc: true, color: '#ffb84a' });
      if (!e.dead) { e.effects.stun = Math.max(e.effects.stun || 0, 0.6); e.dots.push({ dps: S.atk * 0.5, t: 3, color: '#ff7a2a' }); }
    }
    this.fx(W, 'ring', cx + 0.5, cy + 0.5, { r: 2.2, color: '#ff9a3a', life: 0.5 });
    this.fx(W, 'ring', cx + 0.5, cy + 0.5, { r: 1.2, color: '#6a4a2a', life: 0.6 });
    this.burst(W, cx + 0.5, cy + 0.6, '#6a4a2a', 18, 4);
    for (let i = 0; i < 14; i++) this.part(W, cx + 0.5 + U.rand(-1.8, 1.8), cy + 0.6 + U.rand(-1.2, 1.2), U.rand(-0.5, 0.5), U.rand(-3, -1), Math.random() < 0.5 ? '#ff7a2a' : '#ffd04a', 0.9, 2.5, 6);
    this.text(W, cx + 0.5, cy - 0.6, 'Terra Partida!', '#ffb84a', 12, 1, -1, true);
    if (Game.state.settings.shake) W.shake = Math.max(W.shake, 0.35);
    Sfx.play('boom', 120);
  },

  heroHit(W, t, mult, o = {}) {
    if (!t || t.dead) return 0;
    const S = Game.stats, hero = W.hero, bm = this.buffMods(hero);
    if (t.dodge && !o.noDodge && Math.random() < t.dodge) { this.text(W, t.rx + 0.5, t.ry, 'Errou', '#9a9aa8', 11); return 0; }
    let dmg = S.atk * mult * (1 + bm.dmg);
    if (S.powers.has('berserk')) dmg *= 1 + 0.6 * (1 - hero.hp / hero.maxHp);
    if (S.powers.has('executioner') && t.hp < t.maxHp * 0.3) dmg *= 1.5;
    if (t.boss || t.elite) { dmg *= 1 + S.bossDmg / 100; if (S.powers.has('slayer')) dmg *= 1.4; }
    if (t.effects.hex > 0) dmg *= 1.2;
    if (t.effects.halt > 0) dmg *= 1 + SPIN_HALT_DMG;
    dmg *= (1 + W.harvest / 100) * (1 + W.frenzy * 0.02);
    if (S.flags.has('charge') && !t.charged && !o.dot) { t.charged = true; dmg *= 2; }
    const crit = o.forceCrit || (!o.noCrit && Math.random() < (S.crit + bm.crit + (o.critBonus || 0)) / 100);
    if (crit) dmg *= S.critDmg / 100;
    dmg *= U.rand(0.92, 1.08) * (1 - t.armor);
    t.aggro || this.alert(W, t);
    this.damage(W, t, dmg, { crit, color: o.color });
    const ls = S.lifesteal + (bm.lifesteal || 0);
    if (!o.noLeech && ls > 0) this.healHero(W, dmg * ls / 100);
    if (o.drain) this.healHero(W, dmg * o.drain, true);
    if (!o.noProc) {
      if (S.powers.has('thunder') && Math.random() < 0.12) this.chain(W, t, 1.5, 2, { proc: true });
      if (S.powers.has('frost') && Math.random() < 0.15 && !t.dead) { t.effects.freeze = 1.2; this.text(W, t.rx + 0.5, t.ry - 0.3, 'Congelado', '#9ad8ff', 10); }
      if (S.flags.has('burnHit') && Math.random() < 0.15 && !t.dead) t.dots.push({ dps: S.atk * 0.5, t: 3, color: '#ff9a3a' });
      if (S.powers.has('dagon')) {
        if (!t.dead) {
          const d = t.dots.find(x => x.dagon);
          if (d) d.t = 3; else t.dots.push({ dps: S.atk * 0.4, t: 3, color: '#ff7a2a', dagon: true });
        }
        if (crit) {
          const cx = t.rx, cy = t.ry;
          for (const e of this.enemiesNear(W, cx, cy, 1.6)) if (e !== t) this.heroHit(W, e, 1, { noProc: true, noCrit: true, color: '#ff7a2a' });
          this.fx(W, 'ring', cx + 0.5, cy + 0.5, { r: 1.6, color: '#ff5a2a', life: 0.35 });
          for (let i = 0; i < 8; i++) this.part(W, cx + 0.5, cy + 0.5, U.rand(-2, 2), U.rand(-3, -0.5), Math.random() < 0.5 ? '#ff7a2a' : '#ffe08a', 0.7, 2, 5);
        }
      }
      if (S.flags.has('surge') && Math.random() < 0.1) {
        const cx = t.rx, cy = t.ry;
        for (const e of this.enemiesNear(W, cx, cy, 1.5)) this.heroHit(W, e, 1.5, { noProc: true, color: '#ff8ad8' });
        this.fx(W, 'ring', cx + 0.5, cy + 0.5, { r: 1.5, color: '#ff5aa0', life: 0.35 });
      }
    }
    return dmg;
  },

  damage(W, t, dmg, o = {}) {
    if (t.dead) return;
    t.hp -= dmg;
    t.flash = 0.12;
    const st = Game.state;
    if (dmg > st.stats.highestHit) st.stats.highestHit = dmg;
    if (st.settings.dmgNumbers) {
      if (o.crit) this.text(W, t.rx + 0.5, t.ry - 0.1, U.fmt(dmg) + '!', '#ffcf3a', 15, 0.9, -1.6, true);
      else this.text(W, t.rx + 0.5 + U.rand(-0.2, 0.2), t.ry + 0.1, U.fmt(dmg), o.color || (o.dot ? '#9aff7a' : '#ffffff'), o.dot ? 10 : 12, 0.7);
    }
    if (!o.dot) {
      this.burst(W, t.rx + 0.5, t.ry + 0.5, o.crit ? '#ffd04a' : '#ffffff', o.crit ? 7 : 3, 3);
      Sfx.play(o.crit ? 'crit' : 'hit', o.crit ? 60 : 45);
      if (o.crit && st.settings.shake) W.shake = Math.max(W.shake, 0.25);
    }
    if (t.hp <= 0) {
      if (t.kind === 'enemy') this.kill(W, t);
      else if (t.kind === 'minion') this.killMinion(W, t);
    }
  },

  alert(W, e) {
    if (e.aggro || e.dead) return;
    e.aggro = true; e.lostT = 0;
    if (e.hidden) return;
    if (e.boss && !W.bossAnnounced) {
      W.bossAnnounced = true;
      Game.log(`<b>${e.name}</b> desperta para a batalha!`, 'boss');
      Sfx.play('boss');
      Music.boss(true);
      if (e.lord) UI.banner(e.name, 'Senhor do bioma', 'red', 2.2);
    }
    for (const o of W.ents) {
      if (o.kind === 'enemy' && !o.aggro && !o.dead && !o.hidden && this.dist(o, e) <= 3.5 && this.los(W, o.x, o.y, e.x, e.y)) {
        o.aggro = true; o.lostT = 0;
      }
    }
  },

  healHero(W, amt, show) {
    const h = W.hero;
    if (h.dead || amt <= 0) return;
    const before = h.hp;
    h.hp = Math.min(h.maxHp, h.hp + amt);
    if (show && h.hp - before >= 1) this.text(W, h.rx + 0.5, h.ry - 0.1, '+' + U.fmt(h.hp - before), '#5aff8a', 11);
  },

  hurtHero(W, raw, src, o = {}) {
    const S = Game.stats, hero = W.hero, bm = this.buffMods(hero);
    if (hero.dead) return;
    hero.lastCombat = W.t;
    if (!o.dot && !o.unavoidable && Math.random() < (S.dodge + bm.dodge) / 100) {
      this.text(W, hero.rx + 0.5, hero.ry - 0.1, 'Esquiva', '#b8c0d0', 11);
      Sfx.play('dodge', 120);
      if (src && !src.dead && S.flags.has('deflect')) this.damage(W, src, S.atk * (1 - src.armor), { color: '#ffb84a' });
      return;
    }
    if (!o.dot && !o.unavoidable && S.flags.has('luck') && Math.random() < 0.08) {
      this.text(W, hero.rx + 0.5, hero.ry - 0.1, 'Sorte!', '#7aff9a', 11);
      return;
    }
    let dmg = raw * U.rand(0.9, 1.1) * (1 - S.dr / 100);
    if (!o.dot && Math.random() < S.block / 100) {
      dmg *= 0.4;
      this.text(W, hero.rx + 0.5, hero.ry - 0.3, 'Bloqueio', '#8ac8ff', 11);
      if (S.flags.has('bulwark')) this.healHero(W, hero.maxHp * 0.02);
      Sfx.play('block', 100);
    }
    const K = 30 * enemyAtkScale(W.z);
    const def = S.def * (1 + bm.def);
    dmg *= 1 - Math.min(0.85, def / (def + K));
    if (hero.shield > 0) {
      const a = Math.min(hero.shield, dmg);
      hero.shield -= a; dmg -= a;
      if (hero.shield <= 0) { hero.shield = 0; hero.shieldT = 0; }
    }
    if (dmg <= 0) return;
    hero.hp -= dmg;
    hero.flash = 0.12;
    if (Game.state.settings.dmgNumbers) this.text(W, hero.rx + 0.5, hero.ry + 0.1, '-' + U.fmt(dmg), o.color || '#ff5a5a', 11, 0.7);
    if (!o.dot) Sfx.play('hurt', 140);
    if (src && !src.dead && S.powers.has('thorns')) this.damage(W, src, raw * 0.35, { color: '#c8a0ff' });
    if (src && !src.dead && S.flags.has('hellish') && Math.random() < 0.2) { src.dots.push({ dps: S.atk * 0.8, t: 3, color: '#ff6a2a' }); this.alert(W, src); }
    if (src && src.lifesteal) src.hp = Math.min(src.maxHp, src.hp + dmg * src.lifesteal);
    if (hero.hp > 0 && hero.hp < hero.maxHp * 0.3 && S.flags.has('healingHands') && !W.hands) {
      W.hands = true;
      this.healHero(W, hero.maxHp * 0.35, true);
      this.fx(W, 'holy', hero.rx + 0.5, hero.ry + 0.5, { r: 1.6, color: '#fff2a0', life: 0.8 });
      this.text(W, hero.rx + 0.5, hero.ry - 0.7, 'Mãos Curativas!', '#fff2a0', 12, 1.2, -1, true);
    }
    if (hero.hp <= 0) this.heroDeath(W);
  },

  drinkPotion(W, hero) {
    const st = Game.state, S = Game.stats;
    st.potions--;
    hero.potionCd = 5;
    const amt = hero.maxHp * 0.4 * (1 + S.potionPct / 100);
    this.healHero(W, amt, true);
    Sfx.play('potion');
    for (let i = 0; i < 10; i++) this.part(W, hero.rx + 0.5 + U.rand(-0.3, 0.3), hero.ry + 0.6, U.rand(-0.3, 0.3), U.rand(-2.2, -1), '#ff5a7a', 0.7, 2.5, 0);
    Game.log('Você bebeu uma <b style="color:#ff5a7a">Poção de Vida</b>.', 'good');
  },

  heroDeath(W) {
    const hero = W.hero, S = Game.stats, st = Game.state;
    if (S.flags.has('relentless') && !W.relentless) {
      W.relentless = true;
      hero.hp = 1;
      this.text(W, hero.rx + 0.5, hero.ry - 0.6, 'Implacável!', '#7aff5a', 14, 1.4, -1, true);
      this.burst(W, hero.rx + 0.5, hero.ry + 0.5, '#7aff5a', 20, 4);
      Game.log('<b style="color:#7aff5a">Resistência Implacável!</b> Você se recusa a cair.', 'good');
      return;
    }
    if (S.flags.has('ravenRevive') && !W.raven) {
      W.raven = true;
      hero.hp = hero.maxHp * 0.6;
      this.fx(W, 'ring', hero.rx + 0.5, hero.ry + 0.5, { r: 3, color: '#8a8aa8', life: 0.8 });
      this.burst(W, hero.rx + 0.5, hero.ry + 0.5, '#2a2a3a', 30, 5);
      Game.log('<b style="color:#c8c8ff">Fôlego do Corvo!</b> Você retorna das sombras.', 'good');
      Sfx.play('legendary');
      return;
    }
    if (S.powers.has('phoenix') && !W.phoenix) {
      W.phoenix = true;
      hero.hp = hero.maxHp * 0.5;
      this.fx(W, 'ring', hero.rx + 0.5, hero.ry + 0.5, { r: 3, color: '#ff8a2a', life: 0.8 });
      this.burst(W, hero.rx + 0.5, hero.ry + 0.5, '#ffb02a', 30, 5);
      Game.log('<b style="color:#ff9a2e">Chama da Fênix!</b> Você renasce das cinzas.', 'good');
      Sfx.play('legendary');
      return;
    }
    if (st.potions > 0) {
      hero.hp = 1;
      this.drinkPotion(W, hero);
      this.text(W, hero.rx + 0.5, hero.ry - 0.8, 'Aguentou firme!', '#ff9ab0', 13, 1.3, -1, true);
      return;
    }
    hero.dead = true; hero.hp = 0; hero.deathT = 3.2; hero.moving = false; hero.opening = null; hero.resting = false;
    this.releaseOcc(W, hero);
    st.stats.deaths++;
    st.deathsInZone++;
    Sfx.play('death');
    if (st.hardcore) {
      st.hearts = Math.max(0, (st.hearts === undefined ? 3 : st.hearts) - 1);
      if (st.hearts <= 0) {
        UI.banner('FIM DE JOGO', 'Seus três corações se foram…', 'red', 3);
        Game.log(`<b>${U.esc(st.name)}</b> perdeu o último coração na zona ${W.z}. <b style="color:#ff6a6a">Fim de jogo.</b>`, 'bad');
      } else {
        UI.banner('DERROTADO', `${st.hearts} ${st.hearts > 1 ? 'corações restantes' : 'coração restante'} · recuando`, 'red', 2.8);
        Game.log(`<b>${U.esc(st.name)}</b> foi derrotado na zona ${W.z} e perdeu um coração (${st.hearts} restantes).`, 'bad');
      }
    } else {
      UI.banner('DERROTADO', st.deathsInZone >= 3 && W.z > 1 ? 'Recuando para se fortalecer…' : 'Retornando à entrada da zona…', 'red', 2.8);
      Game.log(`<b>${U.esc(st.name)}</b> foi derrotado na zona ${W.z}. (${st.deathsInZone}/3)`, 'bad');
    }
    this.burst(W, hero.rx + 0.5, hero.ry + 0.5, '#ff4a4a', 25, 4);
    for (const e of W.ents) {
      if (e.kind === 'minion' && !e.dead) this.killMinion(W, e);
      if (e.kind === 'enemy' && !e.dead) { e.aggro = false; e.hp = e.maxHp; e.dots = []; }
    }
    W.bossAnnounced = false;
    Music.boss(false);
    hero.dots = []; hero.buffs = []; hero.shield = 0; hero._bm = null;
  },

  respawn(W) {
    const hero = W.hero, st = Game.state;
    if (st.hardcore && st.hearts <= 0) { Game.gameOver(); return; }
    if (st.deathsInZone >= (st.hardcore ? 1 : 3) && W.z > 1 && st.mode === 'advance') { Game.retreat(); return; }
    hero.dead = false;
    hero.hp = hero.maxHp;
    let p = [W.start.x, W.start.y];
    if (W.occ[p[1] * W.w + p[0]] !== 0) p = this.freeNear(W, W.start.x, W.start.y) || p;
    hero.x = hero.nx = hero.rx = p[0]; hero.y = hero.ny = hero.ry = p[1];
    W.occ[hero.y * W.w + hero.x] = hero.id;
    hero.atkT = 0.5; hero.target = null;
    st.potions = Math.max(st.potions, 1);
    this.updateVision(W);
    this.updateFlow(W, true);
    this.fx(W, 'ring', hero.rx + 0.5, hero.ry + 0.5, { r: 2, color: '#ffffff', life: 0.6 });
  },

  heroSkillList(hero) {
    const st = Game.state;
    const out = [];
    for (const id of Stats.activeIds(st)) {
      const r = st.talents[id] || 0;
      if (r && st.level >= SKILLS[id].unlock) out.push([id, r]);
    }
    const sp = SPECIES[st.species];
    if (sp && sp.skill) out.push([sp.skill, U.clamp(1 + Math.floor(st.level / 8), 1, 10)]);
    return out;
  },

  updateSkills(W, hero, dt) {
    const S = Game.stats;
    for (const id in hero.skillCd) if (hero.skillCd[id] > 0) hero.skillCd[id] -= dt;
    if (hero.opening || hero.effects.stun > 0 || hero.effects.freeze > 0) return;
    if (hero.blades) this.updateBlades(W, hero, dt);
    for (const [id, r] of this.heroSkillList(hero)) {
      const sk = SKILLS[id];
      if ((hero.skillCd[id] || 0) > 0) continue;
      if (hero.moving && !['buff', 'shield', 'summon', 'heal'].includes(sk.type)) continue;
      if (this.cast(W, hero, id, sk, r)) {
        const echo = (S.powers.has('echo') && Math.random() < 0.2) || (S.flags.has('encore') && Math.random() < 0.15);
        hero.skillCd[id] = echo ? 0.5 : sk.cd * (1 - S.cdr / 100);
        UI.skillFlash(id);
        if (echo) this.text(W, hero.rx + 0.5, hero.ry - 0.8, 'Eco!', '#b874ff', 10);
        this.text(W, hero.rx + 0.5, hero.ry - 0.5, sk.name, sk.color, 11, 1.1, -0.8);
        break;
      }
    }
  },

  enemiesNear(W, x, y, r) {
    const out = [];
    for (const e of W.ents) if (e.kind === 'enemy' && !e.dead && !e.hidden && U.dist(e.rx, e.ry, x, y) <= r) out.push(e);
    return out;
  },

  applyOnHit(W, sk, tt, mult) {
    if (!tt || tt.dead) return;
    const S = Game.stats;
    if (sk.burn) tt.dots.push({ dps: S.atk * mult * sk.burn / 3, t: 3, color: '#ff9a3a' });
    if (sk.bleed) tt.dots.push({ dps: S.atk * mult * sk.bleed / 3, t: 3, color: '#ff5a5a' });
    if (sk.weaken) { tt.effects.weak = sk.weaken; this.text(W, tt.rx + 0.5, tt.ry - 0.4, 'Enfraquecido', '#ff9ad8', 10); }
    if (sk.hex) tt.effects.hex = sk.hex;
    if (sk.stun && Math.random() < sk.stun) { tt.effects.stun = sk.stunDur || 1; this.text(W, tt.rx + 0.5, tt.ry - 0.4, 'Atordoado', '#ffd04a', 10); }
    if (sk.chaos) {
      const k = U.randi(0, 2);
      if (k === 0) tt.dots.push({ dps: S.atk * mult * 0.15, t: 3, color: '#ff9a3a' });
      else if (k === 1) { tt.effects.freeze = 1; this.text(W, tt.rx + 0.5, tt.ry - 0.4, 'Congelado', '#9ad8ff', 10); }
      else this.chain(W, tt, mult * 0.4, 2, {});
    }
  },

  applyBuff(W, hero, id, sk, mods, dur) {
    const m = {};
    for (const k of ['dmg', 'def', 'atkSpd', 'crit', 'dodge', 'move', 'lifesteal', 'regen']) if (mods[k]) m[k] = mods[k];
    this.addBuff(hero, id, sk.name, sk.color, dur, m);
  },

  cast(W, hero, id, sk, r) {
    const S = Game.stats;
    const t = hero.target && !hero.target.dead ? hero.target : null;
    const range = S.range;
    const inRange = (tt, extra = 0) => tt && this.dist(hero, tt) <= Math.max(range, 1.5) + extra && this.los(W, hero.x, hero.y, tt.x, tt.y);
    const hx = hero.rx + 0.5, hy = hero.ry + 0.5;
    const glow = (rr = 1.5) => {
      this.fx(W, 'ring', hx, hy, { r: rr, color: sk.color, life: 0.5 });
      for (let i = 0; i < 12; i++) this.part(W, hx + U.rand(-0.4, 0.4), hy + 0.3, 0, U.rand(-2.5, -1), sk.color, 0.8, 2, 0);
    };
    switch (sk.type) {
      case 'strike': {
        if (!inRange(t)) return false;
        hero.lunge = { dx: t.x - hero.x, dy: t.y - hero.y, t: 0.2 };
        const mult = sk.mult(r), hits = sk.hits || 1;
        for (let i = 0; i < hits; i++) {
          const go = () => {
            if (t.dead) return;
            this.heroHit(W, t, mult, { forceCrit: sk.forceCrit, critBonus: sk.critBonus, drain: sk.drain, noProc: i > 0 });
            this.fx(W, 'impact', t.rx + 0.5, t.ry + 0.5, { color: sk.color, life: 0.35, r: 1 });
            if (i === hits - 1) this.applyOnHit(W, sk, t, mult);
          };
          if (i === 0) go(); else W.timers.push({ t: i * 0.12, fn: go });
        }
        if (sk.healSelf) this.healHero(W, hero.maxHp * sk.healSelf, true);
        if (sk.shield) { hero.shield = Math.max(hero.shield, hero.maxHp * sk.shield); hero.shieldT = Math.max(hero.shieldT, 6); }
        Sfx.play('crit');
        return true;
      }
      case 'proj': {
        if (!inRange(t, 0.5)) return false;
        const mult = sk.mult(r);
        this.shoot(W, hero, t, sk.proj, (tt, p) => {
          if (tt) this.heroHit(W, tt, mult, { drain: sk.drain, noDodge: sk.noDodge });
          if (sk.splash) {
            for (const e of this.enemiesNear(W, p.x - 0.5, p.y - 0.5, sk.splash)) if (e !== tt) this.heroHit(W, e, mult * 0.6, { noProc: true });
            this.fx(W, 'ring', p.x, p.y, { r: sk.splash, color: sk.color, life: 0.4 });
            Sfx.play('fire');
          }
          this.applyOnHit(W, sk, tt, mult);
        }, { speed: 11, size: 1.6, aoe: !!sk.splash });
        Sfx.play(sk.proj === 'bigarrow' ? 'shoot' : sk.proj === 'cannon' ? 'gun' : 'magic');
        return true;
      }
      case 'aoe': {
        const list = this.enemiesNear(W, hero.rx, hero.ry, sk.radius);
        if (!list.length) return false;
        const mult = sk.mult(r);
        let total = 0;
        for (const e of list) { total += this.heroHit(W, e, mult, { noProc: list.length > 3 }); this.applyOnHit(W, sk, e, mult); }
        const holy = sk.fx === 'holy';
        this.fx(W, holy ? 'holy' : 'ring', hx, hy, { r: sk.radius, color: sk.color, life: holy ? 0.9 : 0.4 });
        if (sk.heal) this.healHero(W, hero.maxHp * sk.heal(r) * (S.flags.has('blessedHeal') ? 1.3 : 1), true);
        if (sk.drain) this.healHero(W, total * sk.drain, true);
        if (sk.buff) this.applyBuff(W, hero, id, sk, sk.buff, sk.buffDur || 6);
        if (sk.ult) { W.shake = Math.max(W.shake, 0.5); Sfx.play('boom'); } else Sfx.play('swing');
        return true;
      }
      case 'chain': {
        if (!inRange(t, 0.5)) return false;
        this.chain(W, t, sk.mult(r), sk.jumps(r), { from: hero });
        Sfx.play('zap');
        return true;
      }
      case 'buff': {
        if (!t || this.dist(hero, t) > 6) return false;
        if (sk.selfDmg) { hero.hp = Math.max(1, hero.hp * (1 - sk.selfDmg)); hero.flash = 0.15; }
        this.applyBuff(W, hero, id, sk, sk.buff(r), sk.dur);
        if (sk.shield) { hero.shield = Math.max(hero.shield, hero.maxHp * sk.shield); hero.shieldT = Math.max(hero.shieldT, sk.dur); }
        glow();
        Sfx.play('buff');
        return true;
      }
      case 'shield': {
        if (!t || this.dist(hero, t) > 7 || hero.shield > 0) return false;
        hero.shield = hero.maxHp * sk.amount(r); hero.shieldT = sk.dur;
        if (sk.buff) this.applyBuff(W, hero, id, sk, sk.buff, sk.dur);
        this.fx(W, 'ring', hx, hy, { r: 1.2, color: sk.color, life: 0.5 });
        Sfx.play('buff');
        return true;
      }
      case 'heal': {
        if (hero.hp > hero.maxHp * sk.below) return false;
        this.healHero(W, hero.maxHp * sk.heal(r) * (S.flags.has('blessedHeal') ? 1.3 : 1), true);
        this.fx(W, 'holy', hx, hy, { r: 1.4, color: sk.color, life: 0.7 });
        glow(1.2);
        Sfx.play('potion');
        return true;
      }
      case 'multi': {
        const list = sk.sameTarget
          ? (inRange(t, 0.5) ? [t] : [])
          : this.enemiesNear(W, hero.rx, hero.ry, range + 0.5).filter(e => this.los(W, hero.x, hero.y, e.x, e.y)).sort((a, b) => this.dist(hero, a) - this.dist(hero, b));
        if (!list.length) return false;
        const n = sk.count(r), mult = sk.mult(r);
        for (let i = 0; i < n; i++) {
          const e = list[i % list.length];
          this.shoot(W, hero, e, sk.proj || 'arrow', (tt) => this.heroHit(W, tt, mult, { noProc: i > 0 }), { speed: 13, delay: i * 0.08 });
        }
        Sfx.play(sk.proj === 'eldritch' ? 'zap' : 'shoot');
        return true;
      }
      case 'rain': {
        if (!inRange(t, 1)) return false;
        const cx = t.rx, cy = t.ry, mult = sk.mult(r), kind = sk.kind || 'arrows';
        const gap = kind === 'bombs' ? 0.45 : 0.3;
        if (kind === 'arrows') this.fx(W, 'rain', cx + 0.5, cy + 0.5, { r: sk.radius, color: sk.color, life: sk.ticks * gap + 0.3 });
        else this.fx(W, 'telegraph', cx + 0.5, cy + 0.5, { r: sk.radius, color: sk.color, life: sk.ticks * gap + 0.2 });
        for (let i = 0; i < sk.ticks; i++) {
          W.timers.push({ t: 0.25 + i * gap, fn: () => {
            const ox = cx + U.rand(-0.6, 0.6), oy = cy + U.rand(-0.6, 0.6);
            for (const e of this.enemiesNear(W, ox, oy, sk.radius)) this.heroHit(W, e, mult, { noProc: true });
            if (kind === 'lightning') {
              this.fx(W, 'chain', 0, 0, { pts: [[ox + 0.5 + U.rand(-0.3, 0.3), oy - 4], [ox + 0.5, oy + 0.5]], color: '#bfe8ff', life: 0.25 });
              Sfx.play('zap', 40);
            } else if (kind === 'bombs') {
              this.fx(W, 'ring', ox + 0.5, oy + 0.5, { r: sk.radius * 0.8, color: '#ffb02a', life: 0.4 });
              this.burst(W, ox + 0.5, oy + 0.5, '#ff8a2a', 18, 5);
              W.shake = Math.max(W.shake, 0.3); Sfx.play('boom', 60);
            } else Sfx.play('shoot', 30);
          } });
        }
        return true;
      }
      case 'meteor': {
        if (!inRange(t, 1)) return false;
        this.meteor(W, t.rx, t.ry, sk.radius, sk.mult(r));
        return true;
      }
      case 'dot': {
        if (!inRange(t)) return false;
        t.dots.push({ dps: S.atk * sk.dps(r), t: sk.dur, color: sk.dotColor || '#7aff5a' });
        if (sk.hex) t.effects.hex = sk.hex;
        this.heroHit(W, t, sk.hitMult || 0.5, { noProc: true });
        this.fx(W, 'impact', t.rx + 0.5, t.ry + 0.5, { color: sk.color, life: 0.35, r: 1 });
        Sfx.play('swing');
        return true;
      }
      case 'plague': {
        if (!inRange(t, 1)) return false;
        const cx = t.rx, cy = t.ry;
        for (const e of this.enemiesNear(W, cx, cy, sk.radius)) {
          e.dots.push({ dps: S.atk * sk.dps(r), t: sk.dur, color: sk.dotColor || '#4dff8a' });
          if (sk.slow) e.effects.slow = sk.dur;
          this.alert(W, e);
        }
        this.fx(W, 'cloud', cx + 0.5, cy + 0.5, { r: sk.radius, color: sk.color, life: 2.5 });
        Sfx.play('fire');
        return true;
      }
      case 'blades': {
        const list = this.enemiesNear(W, hero.rx, hero.ry, sk.radius);
        if (!list.length) return false;
        hero.blades = { n: sk.hits, t: 0, iv: sk.interval || 0.25, mult: sk.mult(r), radius: sk.radius, color: sk.color, spin: !sk.interval };
        if (sk.buff) this.applyBuff(W, hero, id, sk, sk.buff, sk.buffDur || 4);
        return true;
      }
      case 'summon': {
        if (!t || this.dist(hero, t) > 7) return false;
        const type = sk.minion || 'skel';
        const alive = W.ents.filter(e => e.kind === 'minion' && !e.dead && e.mtype === type && !!e.champion === !!sk.champion).length;
        const extra = type === 'turret' && S.flags.has('extraTurret') ? 1 : 0;
        if (alive >= sk.maxMinions(r) + extra) return false;
        let made = 0;
        const dur = sk.dur * (extra ? 1.5 : 1);
        for (let i = 0; i < sk.count; i++) if (this.spawnMinion(W, hero, sk.hp(r), sk.dmg(r), dur, !!sk.champion, type)) made++;
        if (!made) return false;
        Sfx.play('summon');
        return true;
      }
      case 'wild': {
        if (!inRange(t, 1)) return false;
        const mult = sk.mult(r), roll = U.randi(0, 3);
        if (roll === 0) { this.meteor(W, t.rx, t.ry, 2.4, mult); this.text(W, hx, hy - 1, 'Meteoro Selvagem!', sk.color, 11); }
        else if (roll === 1) { this.chain(W, t, mult * 0.45, 6, { from: hero }); Sfx.play('zap'); this.text(W, hx, hy - 1, 'Tempestade Caótica!', sk.color, 11); }
        else if (roll === 2) { this.healHero(W, hero.maxHp * 0.35, true); this.applyBuff(W, hero, id, sk, { dmg: 0.4 }, 8); glow(); this.text(W, hx, hy - 1, 'Bênção Selvagem!', sk.color, 11); }
        else {
          for (const e of this.enemiesNear(W, hero.rx, hero.ry, 3.2)) { this.heroHit(W, e, mult * 0.8, { noProc: true }); e.effects.slow = 3; }
          this.fx(W, 'ring', hx, hy, { r: 3.2, color: sk.color, life: 0.6 }); Sfx.play('boom'); this.text(W, hx, hy - 1, 'Explosão Arcana!', sk.color, 11);
        }
        return true;
      }
    }
    return false;
  },

  meteor(W, cx, cy, radius, mult) {
    this.fx(W, 'meteor', cx + 0.5, cy + 0.5, { r: radius, color: '#ff5a2a', life: 0.75 });
    this.fx(W, 'telegraph', cx + 0.5, cy + 0.5, { r: radius, color: '#ff5a2a', life: 0.75 });
    W.timers.push({ t: 0.7, fn: () => {
      for (const e of this.enemiesNear(W, cx, cy, radius)) this.heroHit(W, e, mult, { noProc: true });
      this.fx(W, 'ring', cx + 0.5, cy + 0.5, { r: radius + 0.5, color: '#ffb02a', life: 0.5 });
      this.burst(W, cx + 0.5, cy + 0.5, '#ff8a2a', 30, 6);
      this.burst(W, cx + 0.5, cy + 0.5, '#5a3a2a', 14, 3);
      W.shake = 0.7; Sfx.play('boom');
    } });
    Sfx.play('fire');
  },

  updateBlades(W, hero, dt) {
    const b = hero.blades;
    b.t -= dt;
    if (b.t > 0) return;
    b.t = b.iv; b.n--;
    const list = this.enemiesNear(W, hero.rx, hero.ry, b.radius);
    for (const e of list) this.heroHit(W, e, b.mult, { noProc: true });
    this.fx(W, 'ring', hero.rx + 0.5, hero.ry + 0.5, { r: b.radius, color: b.color, life: 0.25 });
    if (b.spin) hero.face *= -1;
    Sfx.play('swing', 40);
    if (b.n <= 0) hero.blades = null;
  },

  chain(W, first, mult, jumps, o = {}) {
    const hit = [first];
    const pts = [];
    if (o.from) pts.push([o.from.rx + 0.5, o.from.ry + 0.3]);
    else pts.push([first.rx + 0.5, first.ry - 3]);
    pts.push([first.rx + 0.5, first.ry + 0.4]);
    this.heroHit(W, first, mult, { noProc: true, color: '#bfe8ff' });
    let cur = first;
    for (let i = 0; i < jumps; i++) {
      let best = null, bd = 3.6;
      for (const e of W.ents) {
        if (e.kind !== 'enemy' || e.dead || e.hidden || hit.includes(e)) continue;
        const d = this.rdist(e, cur);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) break;
      hit.push(best);
      pts.push([best.rx + 0.5, best.ry + 0.4]);
      this.heroHit(W, best, mult * Math.pow(0.88, i + 1), { noProc: true, color: '#bfe8ff' });
      cur = best;
    }
    this.fx(W, 'chain', 0, 0, { pts, color: '#bfe8ff', life: 0.3 });
    if (o.proc) Sfx.play('zap');
  },

  spawnMinion(W, hero, hpF, dmgF, dur, champion, type = 'skel') {
    const S = Game.stats;
    const p = this.freeNear(W, hero.x, hero.y);
    if (!p) return null;
    const def = ENEMIES['minion_' + type] || ENEMIES.minion_skel;
    const mp = 1 + S.minion / 100;
    const pal = type === 'skel' && champion ? { a: '#b8ffd0', k: '#ff3a3a', m: '#4dff8a', h: '#1a4a2a' } : def.pal;
    const m = this.makeEnt('minion', p[0], p[1], {
      name: champion ? 'Campeão ' + def.name : def.name, sprite: def.sprite, pal, mtype: type,
      hp: hero.maxHp * hpF * mp, maxHp: hero.maxHp * hpF * mp, atk: S.atk * dmgF * mp, atkSpd: def.spd || 1.1,
      range: def.range || 1.5, ranged: (def.range || 1.5) > 2, proj: def.proj, move: def.move,
      life: dur, maxLife: dur, champion, scale: champion ? 1.15 : 1,
    });
    this.addEnt(W, m);
    const col = type === 'wolf' ? '#9ad0b0' : type === 'imp' ? '#ff6a3a' : type === 'turret' ? '#5ae8ff' : '#4dff8a';
    this.fx(W, 'ring', m.rx + 0.5, m.ry + 0.5, { r: 1, color: col, life: 0.5 });
    this.burst(W, m.rx + 0.5, m.ry + 0.7, col, 10, 2.5);
    return m;
  },

  minionThink(W, m, dt) {
    const hero = W.hero;
    let tgt = null, bd = m.ranged ? m.range + 1.5 : 7;
    for (const e of W.ents) {
      if (e.kind !== 'enemy' || e.dead || e.hidden) continue;
      if (!e.aggro && !W.vis[e.y * W.w + e.x]) continue;
      const d = this.dist(m, e);
      if (d < bd && (!m.ranged || this.los(W, m.x, m.y, e.x, e.y))) { bd = d; tgt = e; }
    }
    if (tgt) {
      if (bd <= m.range) {
        if (m.atkT <= 0) {
          m.atkT = 1 / m.atkSpd;
          m.face = tgt.x >= m.x ? 1 : -1;
          this.alert(W, tgt);
          if (m.ranged) {
            this.shoot(W, m, tgt, m.proj || 'bullet', (tt) => this.damage(W, tt, m.atk * U.rand(0.9, 1.1) * (1 - tt.armor), { color: '#9affe8' }), { speed: 14 });
            Sfx.play('gun', 120);
          } else {
            m.lunge = { dx: tgt.x - m.x, dy: tgt.y - m.y, t: 0.15 };
            this.damage(W, tgt, m.atk * U.rand(0.9, 1.1) * (1 - tgt.armor), { color: '#9affb8' });
            if (Game.stats.flags.has('nature')) this.healHero(W, hero.maxHp * 0.01);
          }
        }
        return;
      }
      if (m.move <= 0) return;
      const path = this.bfs(W, m.x, m.y, (x, y) => U.dist(x, y, tgt.x, tgt.y) <= m.range, { self: m.id, avoid: true, max: 600 });
      this.stepPath(W, m, path);
      return;
    }
    if (m.move > 0 && this.dist(m, hero) > 2.5 && !hero.dead) {
      const path = this.bfs(W, m.x, m.y, (x, y) => U.dist(x, y, hero.x, hero.y) <= 1.9, { self: m.id, avoid: true, max: 900 });
      this.stepPath(W, m, path);
    }
  },

  heavenMult(S, it) {
    it = it || Game.state.equip.offhand;
    const plus = it && it.excl === 'heights' ? it.plus : 0;
    return HEAVEN_BASE * (1 + HEAVEN_PLUS * plus) * Math.max(0.2, 1 + S.raw.moveSpd / 100);
  },
  feedHunger(W) {
    const h = W.hero, b = h.buffs.find(x => x.id === 'hunger'), n = Math.min(PRED_MAX, (b ? b.n : 0) + 1);
    const mods = { gold: n * PRED_STEP, xp: n * PRED_STEP };
    if (b) Object.assign(b, { n, t: PRED_T, max: PRED_T, mods, name: `Fome ×${n}` });
    else h.buffs.push({ id: 'hunger', n, name: `Fome ×${n}`, color: '#8aff7a', t: PRED_T, max: PRED_T, mods });
    h._bm = null;
    return n;
  },
  updatePrey(W, hero, dt) {
    if (W.prey && W.prey.dead) W.prey = null;
    hero.preyT = (hero.preyT === undefined ? 3 : hero.preyT) - dt;
    if (W.prey || hero.preyT > 0) return;
    let best = null, bd = 1e9;
    for (const e of W.ents) {
      if (e.kind !== 'enemy' || e.dead || e.boss || e.hidden || e.summoned || !W.vis[e.y * W.w + e.x]) continue;
      const d = this.dist(hero, e);
      if (d <= 8 && d < bd) { bd = d; best = e; }
    }
    if (!best) { hero.preyT = 1; return; }
    hero.preyT = PRED_PREY_CD;
    best.prey = true; W.prey = best;
    this.text(W, best.rx + 0.5, best.ry - 0.6, 'Presa!', '#8aff7a', 11);
    this.fx(W, 'ring', best.rx + 0.5, best.ry + 0.5, { r: 1, color: '#8aff7a', life: 0.5 });
  },
  spinGain(W, it, n) {
    const L0 = spinLevel(it.spin);
    it.spin = (it.spin || 0) + n;
    const L = spinLevel(it.spin);
    if (L <= L0) return;
    Game.recalc();
    const h = W.hero;
    this.text(W, h.rx + 0.5, h.ry - 1, `Rotação nível ${L}!`, '#ff8ad8', 12, 1.2, -1, true);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; this.part(W, h.rx + 0.5, h.ry + 0.5, Math.cos(a) * 2.5, Math.sin(a) * 1.5, i % 2 ? '#ff8ad8' : '#5ac8ff', 0.6, 2, 0); }
    if (L === SPIN_HALT_LVL) Game.log('<b style="color:#ff8ad8">A Rotação chegou ao nível 10!</b> Agora ela consegue parar o universo.', 'loot');
  },
  updateSpin(W, hero, dt) {
    const it = Game.state.equip.weapon, L = it && it.excl === 'spin' ? spinLevel(it.spin) : 0;
    if (L < SPIN_HALT_LVL) return;
    hero.spinT = (hero.spinT === undefined ? 5 : hero.spinT) - dt;
    if (hero.spinT > 0) return;
    const near = this.enemiesNear(W, hero.rx, hero.ry, SPIN_HALT_R);
    if (!near.length) { hero.spinT = 0.5; return; }
    hero.spinT = Math.max(SPIN_HALT_MIN, SPIN_HALT_CD - 0.2 * (L - SPIN_HALT_LVL));
    for (const e of near) {
      const d = e.boss ? 1 : 2;
      e.effects.stun = Math.max(e.effects.stun || 0, d);
      e.effects.halt = Math.max(e.effects.halt || 0, d);
    }
    this.fx(W, 'halt', hero.rx + 0.5, hero.ry + 0.5, { life: 2, r: SPIN_HALT_R });
    this.fx(W, 'ring', hero.rx + 0.5, hero.ry + 0.5, { r: SPIN_HALT_R, color: '#ff8ad8', life: 0.8 });
    this.fx(W, 'ring', hero.rx + 0.5, hero.ry + 0.5, { r: SPIN_HALT_R * 0.55, color: '#5ac8ff', life: 0.6 });
    this.text(W, hero.rx + 0.5, hero.ry - 1, 'O universo parou!', '#ff8ad8', 13, 1.4, -1, true);
    if (Game.state.settings.shake) W.shake = Math.max(W.shake, 0.3);
    Sfx.play('summon');
  },
  devourPow(it, stacks) {
    const plus = it && it.excl === 'devour' ? it.plus : 0;
    return DEVOUR_MULT * (1 + DEVOUR_PLUS * plus) * (1 + DEVOUR_STACK * stacks);
  },
  updateDevour(W, hero, dt) {
    hero.devT = (hero.devT === undefined ? 2 : hero.devT) - dt;
    if (W.devStacks) { W.devStackT -= dt; if (W.devStackT <= 0) W.devStacks = 0; }
    if (hero.devT > 0) return;
    const cand = W.ents.filter(e => e.kind === 'enemy' && !e.dead && !e.hidden && W.vis[e.y * W.w + e.x] && this.dist(hero, e) <= 7);
    let best = null, bn = 0;
    for (const e of cand) {
      let n = 0;
      for (const o of cand) if (U.dist(o.x, o.y, e.x, e.y) <= DEVOUR_R) n++;
      if (n > bn) { bn = n; best = e; }
    }
    if (!best) { hero.devT = 0.5; return; }
    hero.devT = DEVOUR_CD * (1 - Game.stats.cdr / 100);
    const st = W.devStacks || 0;
    W.devStacks = 0;
    const pow = this.devourPow(Game.state.equip.offhand, st), r = DEVOUR_R + 0.12 * st;
    this.shoot(W, hero, best, 'void', (t, p) => this.addSing(W, p.x - 0.5, p.y - 0.45, pow, r), { speed: 9, size: 1.3 + st * 0.07, aoe: true });
    Sfx.play('magic', 80);
  },
  addSing(W, x, y, pow, r) {
    (W.sings || (W.sings = [])).push({ x, y, t: 0, life: DEVOUR_PULL, pow, r, pullT: 0, caught: new Set() });
    Sfx.play('zap', 80);
  },
  updateSings(W, dt) {
    for (const s of W.sings) {
      s.t += dt; s.pullT -= dt;
      if (s.t < s.life) {
        if (Math.random() < dt * 30) { const a = Math.random() * Math.PI * 2; this.part(W, s.x + 0.5 + Math.cos(a) * s.r, s.y + 0.5 + Math.sin(a) * s.r * 0.7, -Math.cos(a) * s.r * 2.2, -Math.sin(a) * s.r * 1.5, Math.random() < 0.6 ? '#b874ff' : '#7ae8ff', 0.45, 1.8, 0); }
        if (s.pullT > 0) continue;
        s.pullT = 0.12;
        const cx = Math.round(s.x), cy = Math.round(s.y);
        for (const e of this.enemiesNear(W, s.x, s.y, s.r)) {
          if (e.boss) continue;
          s.caught.add(e);
          if (e.moving || e.casting || !e.move) continue;
          e.effects.pull = 0.3;
          const dx = Math.sign(cx - e.x), dy = Math.sign(cy - e.y);
          if (!dx && !dy) continue;
          if (!this.startMove(W, e, e.x + dx, e.y + dy) && !(dx && this.startMove(W, e, e.x + dx, e.y))) { if (dy) this.startMove(W, e, e.x, e.y + dy); }
        }
        continue;
      }
      s.done = true;
      for (const e of this.enemiesNear(W, s.x, s.y, s.r + 0.3)) this.heroHit(W, e, s.pow, { noProc: true, noDodge: true, color: '#c89aff' });
      const n = [...s.caught].filter(e => e.kind === 'enemy').length;
      if (n) { W.devStacks = Math.min(DEVOUR_MAX, (W.devStacks || 0) + n); W.devStackT = DEVOUR_STACK_T; }
      this.fx(W, 'ring', s.x + 0.5, s.y + 0.5, { r: s.r + 0.3, color: '#b874ff', life: 0.5 });
      this.fx(W, 'ring', s.x + 0.5, s.y + 0.5, { r: s.r * 0.5, color: '#7ae8ff', life: 0.35 });
      this.burst(W, s.x + 0.5, s.y + 0.5, '#b874ff', 18, 5);
      if (n) this.text(W, s.x + 0.5, s.y - 0.4, `Devorou ${n}!`, '#d9b8ff', 11, 0.9, -1, true);
      if (Game.state.settings.shake) W.shake = Math.max(W.shake, 0.25);
      Sfx.play('boom', 120);
    }
    W.sings = W.sings.filter(s => !s.done);
  },
  exclAura(W, hero, dt) {
    const S = Game.stats, x = hero.rx + 0.5, y = hero.ry + 0.6, r = U.rand, P = (c, p) => Math.random() < p ? c[0] : c[1];
    if (S.powers.has('dagon') && Math.random() < dt * 8) this.part(W, x + r(-0.5, 0.5), y + r(-0.2, 0.3), r(-0.2, 0.2), r(-1.6, -0.8), P(['#ff7a2a', '#ffe08a'], 0.5), 0.7, 1.6, 0);
    if (S.powers.has('spike') && Math.random() < dt * 5) this.part(W, x + r(-0.6, 0.6), y + 0.35, r(-0.3, 0.3), r(-1.2, -0.5), P(['#8a6a4a', '#ff9a3a'], 0.6), 0.6, 1.8, 3);
    if (S.powers.has('heaven') && Math.random() < dt * 8) this.part(W, x + r(-0.8, 0.8), y + r(-0.6, 0.3), r(-0.6, 0.6), r(-1, -0.3), P(['#ffffff', '#ff9ad8'], 0.5), 0.5, 1.5, 0);
    if (S.powers.has('predator') && Math.random() < dt * 6) { const leaf = Math.random() < 0.55; this.part(W, x + r(-0.7, 0.7), y + r(-0.9, -0.4), r(-0.4, 0.4), leaf ? r(0.2, 0.6) : r(-1, -0.4), leaf ? P(['#3aa84a', '#8aff7a'], 0.5) : '#ffd04a', 0.9, 1.6, 0); }
    if (S.powers.has('spin') && Math.random() < dt * 8) { const a = W.t * 6; this.part(W, x + Math.cos(a) * 0.7, y + Math.sin(a) * 0.3, -Math.sin(a) * 1.2, Math.cos(a) * 0.5 - 0.4, P(['#ff8ad8', '#5ac8ff'], 0.6), 0.5, 1.5, 0); }
    if (S.powers.has('devour') && Math.random() < dt * 10) { const a = Math.random() * Math.PI * 2; this.part(W, x + Math.cos(a) * 1.6, y + Math.sin(a) * 0.9, -Math.cos(a) * 2.2, -Math.sin(a) * 1.3, P(['#b874ff', '#7ae8ff'], 0.6), 0.6, 1.5, 0); }
  },
  updateHeaven(W, hero) {
    const S = Game.stats;
    let m = W.heaven;
    if (!m || m.dead) {
      m = this.spawnMinion(W, hero, 1, this.heavenMult(S), 1e9, false, 'heaven');
      if (!m) return;
      m.heaven = true; W.heaven = m;
      this.fx(W, 'ring', m.rx + 0.5, m.ry + 0.5, { r: 1.4, color: '#7aff8a', life: 0.6 });
    }
    m.atk = S.atk * this.heavenMult(S);
    m.move = Math.max(6, S.moveSpd * 1.3);
    m.life = m.maxLife; m.hp = m.maxHp;
    if (this.dist(m, hero) > 2.6 && !m.moving) {
      const p = this.freeNear(W, hero.x, hero.y);
      if (p) {
        this.releaseOcc(W, m);
        m.x = m.nx = m.rx = p[0]; m.y = m.ny = m.ry = p[1];
        W.occ[m.y * W.w + m.x] = m.id;
        this.part(W, m.rx + 0.5, m.ry + 0.5, 0, -1.5, '#ff9ad8', 0.5, 2, 0);
      }
    }
  },

  killMinion(W, m) {
    if (m.dead) return;
    m.dead = true; m.deathT = 0.4;
    this.releaseOcc(W, m);
    this.burst(W, m.rx + 0.5, m.ry + 0.6, '#d8ffe0', 10, 2.5);
  },

  enemyThink(W, e, dt) {
    if (e.effects.stun > 0 || e.effects.freeze > 0 || e.effects.pull > 0 || e.hidden) return;
    const hero = W.hero;
    if (!e.aggro) {
      if (!hero.dead) {
        const d = this.dist(e, hero);
        if (d <= e.aggroR && W.vis[e.y * W.w + e.x] && this.los(W, e.x, e.y, hero.x, hero.y)) { this.alert(W, e); return; }
      }
      if (e.move > 0) {
        e.wanderT -= dt;
        if (e.wanderT <= 0) {
          e.wanderT = U.rand(2, 5);
          const opts = N8.map(([dx, dy]) => [e.x + dx, e.y + dy]).filter(([x, y]) => U.dist(x, y, e.home.x, e.home.y) <= 2.3 && this.free(W, x, y));
          if (opts.length) { const [x, y] = U.pick(opts); this.startMove(W, e, x, y); }
        }
      }
      return;
    }
    if (hero.dead) { e.aggro = false; return; }
    let tgt = hero, d = this.dist(e, hero);
    for (const m of W.ents) {
      if (m.kind !== 'minion' || m.dead || m.heaven) continue;
      const dm = this.dist(e, m);
      if (dm < d - 0.5) { d = dm; tgt = m; }
    }
    if (d > 12) { e.lostT += dt; if (e.lostT > 4) { e.aggro = false; return; } } else e.lostT = 0;
    if (d <= e.range + 0.05 && (!e.ranged || this.los(W, e.x, e.y, tgt.x, tgt.y))) {
      if (e.atkT <= 0) this.enemyAttack(W, e, tgt);
      return;
    }
    if (e.move <= 0) return;
    if (tgt !== hero) {
      let best = null, bd = d;
      for (const [dx, dy] of N8) {
        const x = e.x + dx, y = e.y + dy;
        if (!this.free(W, x, y)) continue;
        const dd = U.dist(x, y, tgt.x, tgt.y);
        if (dd < bd) { bd = dd; best = [x, y]; }
      }
      if (best) this.startMove(W, e, best[0], best[1]);
      return;
    }
    const F = W.flow, cur = F[e.y * W.w + e.x];
    let best = [], bv = cur < 0 ? 1e9 : cur;
    const side = [];
    for (const [dx, dy] of N8) {
      const x = e.x + dx, y = e.y + dy;
      if (!this.free(W, x, y)) continue;
      if (dx && dy && (!this.walk(W, e.x + dx, e.y) || !this.walk(W, e.x, e.y + dy))) continue;
      const v = F[y * W.w + x];
      if (v < 0) continue;
      if (v < bv) { bv = v; best = [[x, y]]; } else if (v === bv && v < cur) best.push([x, y]);
      else if (v === cur) side.push([x, y]);
    }
    if (best.length) { const [x, y] = U.pick(best); this.startMove(W, e, x, y); }
    else if (side.length && Math.random() < 0.3) { const [x, y] = U.pick(side); this.startMove(W, e, x, y); }
  },

  enemyAttack(W, e, tgt) {
    e.atkT = 1 / e.atkSpd * (e.effects.slow > 0 ? 1.5 : 1);
    e.face = tgt.x > e.x ? 1 : tgt.x < e.x ? -1 : e.face;
    if (e.ranged) {
      this.shoot(W, e, tgt, e.proj || 'arrow', (t) => this.enemyHit(W, e, t, 1), { speed: 8, enemy: true });
    } else {
      e.lunge = { dx: tgt.x - e.x, dy: tgt.y - e.y, t: 0.15 };
      this.enemyHit(W, e, tgt, 1);
    }
  },

  enemyHit(W, e, t, mult) {
    if (!t || t.dead) return;
    const raw = e.atk * mult * (e.effects.weak > 0 ? 0.7 : 1);
    if (t.kind === 'hero') {
      this.hurtHero(W, raw, e);
      if (e.poison && !t.dead && Math.random() < 0.5) t.dots.push({ dps: raw * e.poison, t: 3, color: '#7aff5a' });
    } else if (t.kind === 'minion') {
      if (t.heaven) return;
      t.hp -= raw * U.rand(0.9, 1.1) * 0.75;
      t.flash = 0.1;
      if (t.hp <= 0) this.killMinion(W, t);
    }
  },

  bossThink(W, b, dt) {
    if (!b.aggro || b.dead || W.hero.dead || b.casting) return;
    if (b.effects.stun > 0 || b.effects.freeze > 0) return;
    const hero = W.hero;
    const d = this.dist(b, hero);
    for (const a of b.abil) {
      a.t -= dt;
      if (a.t > 0) continue;
      if (a.id === 'slam' && d <= 3) {
        a.t = 7;
        const R = 2.3;
        const cx = b.rx, cy = b.ry;
        this.fx(W, 'telegraph', cx + 0.5, cy + 0.5, { r: R, color: '#ff3a3a', life: 1.0 });
        b.casting = { t: 1.0, fn: () => {
          if (b.dead) return;
          if (!hero.dead && U.dist(hero.rx, hero.ry, cx, cy) <= R) this.hurtHero(W, b.atk * 2.2, b, { unavoidable: true });
          for (const m of W.ents) if (m.kind === 'minion' && !m.dead && !m.heaven && U.dist(m.rx, m.ry, cx, cy) <= R) { m.hp -= b.atk * 2; if (m.hp <= 0) this.killMinion(W, m); }
          this.fx(W, 'ring', cx + 0.5, cy + 0.5, { r: R + 0.3, color: '#ff7a4a', life: 0.45 });
          this.burst(W, cx + 0.5, cy + 0.8, '#a08a7a', 20, 4);
          if (Game.state.settings.shake) W.shake = 0.8;
          Sfx.play('boom');
        } };
        return;
      }
      if (a.id === 'volley' && d <= 7) {
        a.t = 6;
        for (let i = 0; i < 5; i++) this.shoot(W, b, hero, b.lordDef ? b.lordDef.proj : 'shadow', (t) => this.enemyHit(W, b, t, 0.45), { speed: 7, delay: i * 0.14, enemy: true });
        return;
      }
      if (a.id === 'summon') {
        a.t = 14;
        const alive = W.ents.filter(e => e.summoned && !e.dead).length;
        if (alive >= 4) continue;
        const type = (b.lordDef && b.lordDef.summon) || U.pick(W.biome.enemies);
        for (let i = 0; i < 2; i++) {
          const p = this.freeNear(W, b.x, b.y);
          if (!p) break;
          const m = this.spawnEnemy(W, { x: p[0], y: p[1], type }, { weak: true, summoned: true });
          m.aggro = true;
          this.fx(W, 'ring', p[0] + 0.5, p[1] + 0.5, { r: 1, color: '#b874ff', life: 0.5 });
        }
        W.total += 2;
        this.text(W, b.rx + 0.5, b.ry - 1.2, 'Invocação!', '#d9b8ff', 12);
        Sfx.play('summon');
        return;
      }
    }
  },

  kill(W, e) {
    if (e.dead) return;
    const st = Game.state, S = Game.stats;
    e.dead = true; e.deathT = 0.45; e.hp = 0;
    this.releaseOcc(W, e);
    W.killed++;
    st.stats.kills++;
    Game.classStat('kills', 1);
    if (e.boss) Game.classStat('bosses', 1);
    if (S.flags.has('soulHarvest')) { this.healHero(W, W.hero.maxHp * 0.03); W.harvest = Math.min(40, W.harvest + 1); }
    if (S.flags.has('bloodFrenzy')) W.frenzy = Math.min(30, W.frenzy + 1);
    if (S.flags.has('raiseDead') && !e.boss && !e.summoned && Math.random() < 0.3 && !W.hero.dead) {
      const sk = this.spawnMinion(W, W.hero, 0.5, 0.5, 12, false, 'skel');
      if (sk) this.text(W, sk.rx + 0.5, sk.ry - 0.3, 'Erguido!', '#4dff8a', 10);
    }
    this.burst(W, e.rx + 0.5, e.ry + 0.6, e.pal.a || '#ffffff', e.boss ? 40 : 12, e.boss ? 6 : 3);
    Sfx.play('die', 70);
    const z = W.z, sc = zoneScale(z);
    const xp = 8 * Math.pow(1.16, z - 1) * e.xpMult;
    const goldMult = e.boss ? (e.lord ? 25 : 12) : e.elite ? 4 : e.type === 'mimic' ? 30 : 1;
    const gold = 4 * sc * U.rand(0.8, 1.2) * goldMult;
    const prey = !!(e.prey && S.powers.has('predator'));
    const hunger = S.powers.has('predator') ? this.feedHunger(W) : 0;
    const sw = st.equip.weapon;
    if (sw && sw.excl === 'spin' && !e.summoned) this.spinGain(W, sw, e.boss ? 5 : 1);
    Game.gainXp(xp * (prey ? PRED_PREY_MULT : 1));
    const got = Game.gainGold(gold * (prey ? PRED_PREY_MULT : 1));
    if (st.settings.dmgNumbers) this.text(W, e.rx + 0.5, e.ry - 0.35, '+' + U.fmt(got), '#ffd04a', 10, 0.9, -1);
    if (S.powers.has('midas')) for (let i = 0; i < 8; i++) this.part(W, e.rx + 0.5, e.ry + 0.5, U.rand(-2, 2), U.rand(-4, -1), '#ffd04a', 0.8, 2.5, 9);
    if (S.powers.has('vampire')) this.healHero(W, W.hero.maxHp * 0.04);
    let n = 0, minR = 0, boost = 0, ilvl = Math.max(1, z - (Math.random() < 0.4 ? 1 : 0));
    if (e.boss) { n = e.lord ? 3 : 2; minR = 2; boost = e.lord ? 0.4 : 0.2; ilvl = z + 1; }
    else if (e.type === 'mimic') { n = 3; minR = 2; boost = 0.5; ilvl = z + 1; st.stats.mimics++; }
    else if (e.elite) { n = Math.random() < 0.45 ? 1 : 0; minR = 1; boost = 0.15; ilvl = z; }
    else if (!e.summoned && Math.random() < 0.04) n = 1;
    for (let i = 0; i < n; i++) Game.dropItem(Items.generate(ilvl, { cls: st.cls, minR, mf: S.mf + hunger, boost }), e.rx, e.ry);
    if (prey) {
      W.prey = null;
      Game.dropItem(Items.generate(ilvl, { cls: st.cls, minR: 2, mf: S.mf + hunger, boost: 0.2 }), e.rx, e.ry);
      this.text(W, e.rx + 0.5, e.ry - 0.8, 'Presa abatida!', '#8aff7a', 12, 1.2, -1, true);
      for (let i = 0; i < 10; i++) this.part(W, e.rx + 0.5, e.ry + 0.5, U.rand(-2, 2), U.rand(-4, -1), i % 2 ? '#ffd04a' : '#8aff7a', 0.9, 2.5, 9);
    }
    if (!e.summoned && Math.random() < (e.boss ? 1 : e.elite ? 0.2 : 0.035)) Game.gainPotion(e.rx, e.ry);
    if (e.lord) Game.gainShards(1 + Math.floor(z / 25), e.rx, e.ry);
    else if (e.boss && Math.random() < 0.2) Game.gainShards(1, e.rx, e.ry);
    else if (e.type === 'mimic' && Math.random() < 0.25) Game.gainShards(1, e.rx, e.ry);
    if (e.boss) {
      st.stats.bosses++;
      if (e.lord) { st.stats.lordsKilled = (st.stats.lordsKilled || 0) + 1; st.stats['lord_' + e.type] = (st.stats['lord_' + e.type] || 0) + 1; }
      W.portal.active = true;
      Music.boss(false);
      Game.log(`<b>${e.name}</b> foi derrotado! Um portal se abriu.`, 'boss');
      UI.banner(e.lord ? 'SENHOR DERROTADO!' : 'CHEFE DERROTADO!', 'O portal para a próxima zona está aberto', '', 2.4);
      Sfx.play('victory');
      this.fx(W, 'ring', W.portal.x + 0.5, W.portal.y + 0.5, { r: 3, color: '#b874ff', life: 1 });
      if (st.settings.shake) W.shake = 0.6;
    } else if (e.elite) Game.log(`Você derrotou <b style="color:#ffcf6a">${e.name}</b>.`, '');
    else if (e.type === 'mimic') Game.log('O <b>Mímico</b> foi derrotado e deixou um tesouro!', 'loot');
  },

  openChest(W, c) {
    const st = Game.state, S = Game.stats;
    c.opened = true; c.shaking = false;
    W.chestsOpened++;
    if (c.mimic) {
      c.gone = true;
      W.occ[c.y * W.w + c.x] = 0;
      const m = this.spawnEnemy(W, { x: c.x, y: c.y, type: 'mimic', elite: false });
      W.total++;
      this.alert(W, m);
      this.text(W, c.x + 0.5, c.y - 0.4, 'É um Mímico!', '#ff5a5a', 13, 1.4);
      Game.log('O baú era um <b style="color:#ff5a5a">Mímico</b>!', 'bad');
      Sfx.play('boss');
      if (st.settings.shake) W.shake = 0.4;
      return;
    }
    st.stats.chests++;
    if (c.tier === 4) { this.openRainbowChest(W, c); return; }
    const T = CHEST_TIERS[c.tier];
    const z = W.z;
    let gold = 15 * zoneScale(z) * T.gold * U.rand(0.8, 1.2);
    if (S.powers.has('greed')) gold *= 2;
    const got = Game.gainGold(gold);
    const n = U.randi(T.items[0], T.items[1]);
    for (let i = 0; i < n; i++) Game.dropItem(Items.generate(z + (c.bossChest ? 1 : 0), { cls: st.cls, minR: T.minR, mf: S.mf, boost: T.id * 0.15 }), c.x, c.y);
    if (Math.random() < 0.25) Game.gainPotion(c.x, c.y);
    Sfx.play('chest');
    this.burst(W, c.x + 0.5, c.y + 0.5, T.pal.g, 16, 3.5);
    for (let i = 0; i < 8; i++) this.part(W, c.x + 0.5, c.y + 0.5, U.rand(-1.5, 1.5), U.rand(-4, -2), '#ffd04a', 0.9, 2, 9);
    Game.log(`Você abriu um <span class="c${Math.min(5, c.tier + (c.tier ? 1 : 0))}">${T.name}</span> (+${U.fmt(got)} ouro).`, 'gold');
  },

  openRainbowChest(W, c) {
    const st = Game.state, S = Game.stats, z = W.z, T = CHEST_TIERS[4];
    const got = Game.gainGold(15 * zoneScale(z) * T.gold * U.rand(0.9, 1.1));
    Game.gainShards(2, c.x, c.y);
    const missing = exclMissing(st).filter(id => !EXCLUSIVES[id].minZone || z >= EXCLUSIVES[id].minZone);
    const pick = missing.length && Math.random() < EXCL_CHANCE ? U.weighted(missing.map(id => ({ id, w: EXCLUSIVES[id].weight || 1 }))).id : null;
    if (pick && Math.random() < (EXCLUSIVES[pick].chance || 1)) {
      Game.dropItem(Items.makeExclusive(pick, st.maxZone), c.x, c.y);
    } else {
      const r = z >= RARITIES[6].minZone ? 6 : 5;
      Game.dropItem(Items.generate(z + 1, { cls: st.cls, rarity: r, mf: S.mf }), c.x, c.y);
      Game.log(`O Baú Arco-Íris trouxe um item <b class="c${r}">${RARITIES[r].name}</b>.${missing.length ? ' A arma exclusiva fica para a próxima!' : ''}`, 'loot');
    }
    const cols = ['#ff5a5a', '#ffb84a', '#ffe95a', '#5aff8a', '#5ac8ff', '#b874ff', '#ff7ae0'];
    for (let i = 0; i < 40; i++) this.part(W, c.x + 0.5, c.y + 0.5, U.rand(-3, 3), U.rand(-5, -1), cols[i % cols.length], 1.2, 2.5, 8);
    this.fx(W, 'ring', c.x + 0.5, c.y + 0.5, { r: 3, color: '#ff7ae0', life: 1 });
    Sfx.play('legendary');
    Game.log(`Você abriu o <b class="c7">Baú Arco-Íris</b> (+${U.fmt(got)} ouro).`, 'gold');
  },

  freeRecruit(W, R) {
    R.freed = true; R.freedT = W.t;
    W.occ[R.y * W.w + R.x] = 0;
    this.fx(W, 'holy', R.x + 0.5, R.y + 0.5, { r: 2, color: '#ffe680', life: 1 });
    this.burst(W, R.x + 0.5, R.y + 0.4, '#ffe680', 30, 4);
    if (R.kind === 'relic') Game.gainRelic(R.id);
    else Game.unlock(R.kind, R.id, `${R.name} foi resgatado(a)`);
  },

  useShrine(W, s) {
    const st = Game.state, hero = W.hero;
    s.used = true;
    st.stats.shrines++;
    const D = SHRINES[s.type];
    if (D.buff) {
      const mods = {};
      if (D.buff.dmg) mods.dmg = D.buff.dmg;
      if (D.buff.atkSpd) mods.atkSpd = D.buff.atkSpd;
      if (D.buff.move) mods.move = D.buff.move;
      if (D.buff.gold) mods.gold = D.buff.gold;
      if (D.buff.xp) mods.xp = D.buff.xp;
      this.addBuff(hero, 'shrine_' + s.type, D.short, D.color, D.dur, mods);
    } else {
      hero.hp = hero.maxHp;
      st.potions = Game.stats.potionMax;
    }
    this.fx(W, 'ring', s.x + 0.5, s.y + 0.5, { r: 2.5, color: D.color, life: 0.8 });
    this.burst(W, s.x + 0.5, s.y + 0.3, D.color, 24, 3);
    Sfx.play('shrine');
    Game.log(`<b style="color:${D.color}">${D.name}</b>: ${D.desc}${D.dur ? ` por ${D.dur}s` : ''}.`, 'good');
  },

  shoot(W, src, tgt, kind, onHit, o = {}) {
    W.proj.push({
      x: src.rx + 0.5, y: src.ry + 0.35, tx: tgt.rx + 0.5, ty: tgt.ry + 0.45, tgt, kind, onHit,
      speed: o.speed || 10, delay: o.delay || 0, life: 3, trail: [], size: o.size || 1, aoe: !!o.aoe, enemy: !!o.enemy, ang: 0,
    });
  },
  impactFx(W, p) {
    const col = PROJ_COLORS[p.kind] || '#ffffff';
    this.burst(W, p.x, p.y, col, p.size > 1 ? 10 : 4, 2.5);
  },
  fx(W, type, x, y, o = {}) { W.fx.push(Object.assign({ type, x, y, t: 0, life: 0.5 }, o)); },
  text(W, x, y, text, color, size = 12, life = 0.8, vy = -1.4, bold = false) {
    if (W.texts.length > 70) W.texts.shift();
    W.texts.push({ x, y, text, color, size, t: 0, life, vy, bold });
  },
  part(W, x, y, vx, vy, color, life, size = 2, grav = 0, glow = false) {
    if (W.parts.length > 500) return;
    W.parts.push({ x, y, vx, vy, color, life, t: 0, size, grav, glow, drag: 1.5 });
  },
  burst(W, x, y, color, n, spd) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = U.rand(0.3, 1) * spd;
      this.part(W, x, y, Math.cos(a) * s, Math.sin(a) * s - 0.5, color, U.rand(0.3, 0.6), U.rand(1.5, 3), 4);
    }
  },
};

const PROJ_COLORS = { arrow: '#e8e0c8', bigarrow: '#fff6c0', arcane: '#9ad8ff', fire: '#ff8a2a', shadow: '#b874ff', drain: '#ff4a6a', ice: '#9ad8ff', spit: '#9aff5a', beam: '#ff4aa0',
  holy: '#fff2a0', note: '#ff7ad0', thorn: '#7ad070', chaos: '#ff5aa0', eldritch: '#c070ff', bullet: '#ffe8a0', cannon: '#ffb02a',
  acid: '#9aff5a', coin: '#ffd04a', shuriken: '#d8e0ea', spirit: '#c8a8ff', void: '#b874ff' };
