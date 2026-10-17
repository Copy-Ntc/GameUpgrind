'use strict';
const MULTI_XP = 1.4;
const MULTI_SYNERGY = 15;
const MULTI_SP_XP = 1.25;
const MULTI_SP_SYNERGY = 10;
const MULTI_SP_SHARE = 0.5;
const INNATE_CAP = 300;

const Stats = {
  needXp(L) { return Math.floor(100 * Math.pow(1.1, L - 1)); },
  needXpFor(st, L = st.level) { return Math.floor(this.needXp(L) * (st.cls2 ? MULTI_XP : 1) * (st.species2 ? MULTI_SP_XP : 1)); },
  growth(L) { return Math.pow(1.04, L - 1); },

  fusionCls2(st, eq = st.equip) {
    const w = eq && eq.weapon;
    if (!w || !w.fusion || w.fusion === st.cls || !CLASSES[w.fusion]) return null;
    if (!this.multiclassOpen(st) || !this.mastered(st, st.cls) || !this.mastered(st, w.fusion)) return null;
    return w.fusion;
  },

  activeIds(st, c2 = st.cls2) {
    const ids = [...CLASSES[st.cls].skills];
    if (c2 && CLASSES[c2]) ids.push(...CLASSES[c2].skills.slice(0, 2));
    return ids;
  },
  passiveIds(st, c2 = st.cls2) {
    const ids = [...CLASSES[st.cls].passives];
    if (c2 && CLASSES[c2]) ids.push(...CLASSES[c2].passives);
    return ids;
  },
  talentIds(st) { return [...this.activeIds(st), ...this.passiveIds(st)]; },

  relicInfo(st, cls = st.cls) {
    const R = st.relics && st.relics[cls];
    if (!R || !RELICS[cls]) return null;
    const def = RELICS[cls], r = R.r;
    const list = WEAPON_BASES[cls];
    const base = list[list.length - 1];
    const ilvl = Math.max(1, st.maxZone || 1);
    const stats = { atk: SLOT_MAIN.weapon.atk * zoneScale(ilvl) * RARITIES[r].mult * (base.atk || 1) * RELIC_ATK, dmgPct: RELIC_DMG[r] };
    for (const k in def.per) stats[k] = (stats[k] || 0) + def.per[k] * (r + 1);
    const powers = r >= 5 ? def.powers.slice(0, 2) : r >= 3 ? [def.powers[0]] : [];
    return { def, r, ilvl, stats, powers, base };
  },

  trainVal(t, r) { return t.comp ? this.soulVal(t, r) : r * t.per; },
  soulVal(u, r) { return u.comp ? (Math.pow(1 + u.per / 100, r) - 1) * 100 : r * u.per; },

  compute(st, override) {
    const c = CLASSES[st.cls], b = c.base;
    const eq = override ? Object.assign({}, st.equip, override) : st.equip;
    const c2id = this.fusionCls2(st, eq);
    const c2 = c2id ? CLASSES[c2id] : null;
    const rar = Math.max(c.rarity || 0, c2 ? c2.rarity || 0 : 0);
    const g = this.growth(st.level);
    const sp = SPECIES[st.species] || SPECIES.human;
    const sp2 = st.species2 ? SPECIES[st.species2] : null;
    const spRar = Math.max(sp.rarity || 0, sp2 ? sp2.rarity || 0 : 0);
    const base = c2 ? {
      hp: (b.hp + c2.base.hp) / 2, atk: (b.atk + c2.base.atk) / 2, def: (b.def + c2.base.def) / 2,
      crit: Math.max(b.crit, c2.base.crit), critDmg: Math.max(b.critDmg, c2.base.critDmg), dodge: Math.max(b.dodge, c2.base.dodge),
      block: Math.max(b.block, c2.base.block), lifesteal: Math.max(b.lifesteal, c2.base.lifesteal),
    } : b;
    const s = {
      hp: base.hp * g, atk: base.atk * g, def: base.def * g, regen: 0,
      atkSpd: 0, crit: base.crit, critDmg: base.critDmg, dodge: base.dodge, block: base.block, lifesteal: base.lifesteal,
      moveSpd: 0, goldPct: 0, xpPct: 0, mf: 0, cdr: 0, dmgPct: 0, hpPct: 0, defPct: 0, bossDmg: 0, minion: 0, potionPct: 0,
      soulDmg: 0, soulHp: 0, soulDef: 0, trainDmg: 0, trainHp: 0, trainDef: 0, talentPts: 0, invSlots: 0, startZone: 0, soulPct: 0, offline: 0, dr: 0, regenPct: 0,
    };
    const flags = new Set(sp.flags || []);
    for (const k in sp.stats) s[k] = (s[k] || 0) + sp.stats[k];
    if (sp2) {
      for (const k in sp2.stats) s[k] = (s[k] || 0) + sp2.stats[k] * MULTI_SP_SHARE;
      s.dmgPct += MULTI_SP_SYNERGY; s.hpPct += MULTI_SP_SYNERGY;
    }
    const lv = Math.min(st.level, INNATE_CAP);
    const addInnate = (cls, k) => {
      const inn = cls.innate;
      if (!inn) return;
      for (const st2 in inn.per) s[st2] = (s[st2] || 0) + inn.per[st2] * lv * k;
      for (const f of inn.flags || []) flags.add(f);
    };
    addInnate(c, 1);
    if (c2) {
      addInnate(c2, 0.6);
      s.dmgPct += MULTI_SYNERGY; s.hpPct += MULTI_SYNERGY;
    }
    const powers = new Set();
    for (const slot of EQUIP_SLOTS) {
      const it = eq[slot];
      if (!it) continue;
      const is = Items.stats(it);
      for (const k in is) s[k] = (s[k] || 0) + is[k];
      for (const p of it.powers) powers.add(p);
    }
    const rel = this.relicInfo(st);
    if (rel) {
      for (const k in rel.stats) s[k] = (s[k] || 0) + rel.stats[k];
      for (const p of rel.powers) powers.add(p);
    }
    if (c2) { const rel2 = this.relicInfo(st, c2id); if (rel2) s.dmgPct += rel2.stats.dmgPct * 0.5; }
    for (const t of TRAINING) { const r = st.training[t.id] || 0; if (r) s[t.stat] += this.trainVal(t, r); }
    for (const id of this.passiveIds(st, c2id)) { const r = st.talents[id] || 0; if (r) s[SKILLS[id].stat] += r * SKILLS[id].per; }
    for (const m of MAESTRIA) {
      const r = st.talents[m.id] || 0;
      if (!r) continue;
      s[m.stat] += r * m.per;
      if (m.also) s[m.also] += r * m.per;
    }
    for (const a of ACHIEVEMENTS) if (st.ach[a.id]) for (const k in a.reward) s[k] += a.reward[k];
    for (const u of SOUL_UPGRADES) {
      const r = st.soulUpg[u.id] || 0;
      if (!r) continue;
      const v = this.soulVal(u, r);
      s[u.stat] += v;
      if (u.id === 'haste') s.moveSpd += v;
    }
    if (powers.has('greed')) s.mf += 25;
    if (powers.has('swift')) { s.moveSpd += 20; s.atkSpd += 10; }
    if (powers.has('midas')) s.goldPct += 40;
    if (powers.has('heaven')) s.moveSpd += 10;

    const rm = HERO_RARITY[rar].mult * HERO_RARITY[spRar].spMult;
    const out = {
      maxHp: Math.max(1, s.hp * (1 + s.hpPct / 100) * (1 + s.soulHp / 100) * (1 + s.trainHp / 100) * rm),
      atk: s.atk * (1 + s.dmgPct / 100) * (1 + s.soulDmg / 100) * (1 + s.trainDmg / 100) * rm,
      def: s.def * (1 + s.defPct / 100) * (1 + s.soulDef / 100) * (1 + s.trainDef / 100) * HERO_RARITY[rar].mult,
      atkSpd: Math.max(0.2, b.atkSpd * (1 + s.atkSpd / 100)),
      crit: U.clamp(s.crit, 0, 75),
      critDmg: s.critDmg,
      dodge: U.clamp(s.dodge, 0, 60),
      block: U.clamp(s.block, 0, 50),
      lifesteal: s.lifesteal,
      moveSpd: Math.min(8, 3.2 * (1 + s.moveSpd / 100)),
      goldPct: s.goldPct, xpPct: s.xpPct, mf: s.mf,
      cdr: U.clamp(s.cdr, 0, 50),
      bossDmg: s.bossDmg, minion: s.minion, potionPct: s.potionPct,
      range: b.range,
      dr: U.clamp(s.dr, 0, 60),
      flags,
      powers,
      talentPts: s.talentPts, invSlots: s.invSlots, startZone: s.startZone, soulPct: s.soulPct, offline: s.offline,
      raw: s,
    };
    out.regen = s.regen + out.maxHp * (0.005 + s.regenPct / 100);
    out.potionMax = 3 + Math.floor((st.training.alc || 0) / 5);
    return out;
  },

  power(s, z) {
    const K = 30 * enemyAtkScale(Math.max(1, z || 1));
    const red = Math.min(0.8, s.def / (s.def + K));
    const dps = s.atk * s.atkSpd * (1 + (s.crit / 100) * (s.critDmg / 100 - 1)) * (1 + s.bossDmg / 400) * (1 + s.minion / 400);
    const ehp = s.maxHp / (1 - red) / (1 - s.dodge / 100) / (1 - s.block / 100 * 0.6) / (1 - (s.dr || 0) / 100) * (1 + s.lifesteal / 25) + s.regen * 8;
    const util = 1 + (s.goldPct + s.xpPct) / 900 + s.mf / 700 + s.cdr / 150 + s.raw.moveSpd / 500;
    return Math.sqrt(dps * ehp) * util;
  },

  compareItem(item, st = Game.state) {
    const z = st.zone;
    const cur = Game.stats ? Game.stats : this.compute(st);
    const p0 = this.power(cur, z);
    const p1 = this.power(this.compute(st, { [item.slot]: item }), z);
    return p0 > 0 ? (p1 - p0) / p0 : 1;
  },

  talentTotal(st) { return Math.max(0, st.level - 1) + (Game.stats ? Game.stats.talentPts : 0); },
  talentSpent(st) {
    let n = 0;
    for (const id of this.talentIds(st)) n += st.talents[id] || 0;
    for (const m of MAESTRIA) n += st.talents[m.id] || 0;
    return n - 1;
  },
  talentFree(st) { return this.talentTotal(st) - this.talentSpent(st); },
  maestriaOpen(st) { return st.level >= MAESTRIA_LVL; },

  trainCost(t, rank) { return Math.ceil(t.base * Math.pow(t.growth, rank) * (1 + rank * 0.05)); },
  soulCost(u, rank) { return Math.ceil(u.base * Math.pow(u.growth, rank) * (1 + rank * 0.1)); },
  bulk(costFn, rank, max, n, money) {
    let k = 0, total = 0;
    while (k < n && (!max || rank + k < max)) {
      const c = costFn(rank + k);
      if (n === Infinity && total + c > money) break;
      total += c; k++;
      if (k > 5000) break;
    }
    return { n: k, cost: total };
  },
  soulsOnAscend(st) {
    if (st.maxZone < 15) return 0;
    const sp = Game.stats ? Game.stats.soulPct : 0;
    const z = st.maxZone;
    const raw = Math.pow(z - 9, 1.5) * Math.pow(SCALE.soul, z - 15) * (1 + sp / 100) + st.level * 0.2;
    return Math.floor(raw);
  },
  invSize(st) { return 30 + (st.soulUpg.bag || 0) * 6; },

  mastered(st, cls) { return ((st.classStats || {})[cls] || {}).best >= MASTERY_ZONE; },
  speciesMastered(st, sp) { return ((st.speciesStats || {})[sp] || {}).best >= MASTERY_ZONE; },
  multiclassOpen(st) { return (st.stats.ascensions || 0) >= MULTI_ASC; },
  multiSpeciesOpen(st) { return (st.stats.ascensions || 0) >= MULTI_SP_ASC; },
};
