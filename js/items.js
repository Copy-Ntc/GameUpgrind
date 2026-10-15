'use strict';
// ============================================================
// Itens: geração, nomes, atributos, preços e tooltips
// ============================================================
const Items = {
  tierOf(ilvl) { return U.clamp(Math.floor((ilvl - 1) / 5), 0, 7); },
  gIdx(g) { return { m: 0, f: 1, mp: 2, fp: 3 }[g] || 0; },

  rollRarity(z, minR = 0, mf = 0, boost = 0) {
    const luck = 1 + mf / 100 + boost;
    const opts = RARITIES.filter(r => !r.excl && r.id >= minR && (!r.minZone || z >= r.minZone));
    if (!opts.length) return minR;
    return U.weighted(opts, r => r.weight * Math.pow(luck, r.id * 0.6)).id;
  },

  rollSlot() {
    return U.weighted(SLOTS.map(s => ({ s, w: SLOT_WEIGHTS[s] }))).s;
  },

  // Gera item. opts: { cls, minR, mf, boost, slot, rarity }
  generate(ilvl, opts = {}) {
    ilvl = Math.max(1, Math.round(ilvl));
    const cls = opts.cls || 'knight';
    const rarity = opts.rarity !== undefined ? opts.rarity : this.rollRarity(ilvl, opts.minR || 0, opts.mf || 0, opts.boost || 0);
    const slot = opts.slot || this.rollSlot();
    const R = RARITIES[rarity];
    let base;
    if (slot === 'weapon') base = U.pick(WEAPON_BASES[cls]);
    else if (slot === 'ring' || slot === 'amulet') base = U.pick(JEWELRY[slot]);
    else base = U.pick(ARMOR_SETS[(CLASSES[cls] || CLASSES.fighter).armor][slot]);
    const tier = this.tierOf(ilvl);
    const matDef = MATERIALS[base.mat];
    const S = zoneScale(ilvl);
    const q = U.rand(0.9, 1.1);

    const item = {
      uid: U.uid(), slot, base: base.id || base.name, bname: base.name, g: base.g, sprite: base.sprite,
      mat: base.mat, tier, matName: matDef.names[tier], matColor: matDef.colors[tier],
      rarity, ilvl, main: {}, affixes: [], powers: [], plus: 0, locked: false, isNew: true,
    };
    if (slot === 'weapon') { item.cls = cls; item.bmult = base.atk; }

    // Atributos principais
    const sm = SLOT_MAIN[slot];
    for (const k in sm) {
      let v = sm[k] * S * R.mult * q;
      if (slot === 'weapon' && k === 'atk') v *= base.atk;
      item.main[k] = v;
    }
    if (slot === 'weapon') {
      if (base.spd) item.main.atkSpd = base.spd;
      if (base.extra) for (const k in base.extra) item.main[k] = base.extra[k];
    }
    if (slot === 'boots') item.main.moveSpd = 4;

    // Afixos
    const pool = AFFIXES.filter(a => (!a.slots || a.slots.includes(slot)) && (!a.cls || a.cls.includes(cls)));
    const n = R.affixes;
    const used = new Set();
    for (let i = 0; i < n && pool.length; i++) {
      const cand = pool.filter(a => !used.has(a.k));
      if (!cand.length) break;
      const a = U.weighted(cand);
      used.add(a.k);
      let v;
      if (a.flat) v = U.rand(a.min, a.max) * S * (1 + 0.1 * rarity);
      else v = Math.round(U.rand(a.min, a.max) * (1 + 0.12 * rarity) * (1 + Math.min(ilvl, 100) / 80) * 10) / 10;
      item.affixes.push({ k: a.k, v, flat: !!a.flat });
    }

    // Poderes lendários
    const pkeys = Object.keys(POWERS).filter(k => !POWERS[k].excl);
    if (rarity >= 4) item.powers.push(U.pick(pkeys));
    if (rarity >= 5) { let p; do { p = U.pick(pkeys); } while (item.powers.includes(p)); item.powers.push(p); }

    item.name = this.makeName(item);
    return item;
  },

  // Arma exclusiva (raridade Exclusiva). Os atributos são calculados para o nível ilvl.
  makeExclusive(id, ilvl) {
    const D = EXCLUSIVES[id], R = RARITIES[6], S = zoneScale(Math.max(1, ilvl));
    const item = {
      uid: U.uid(), slot: D.slot, base: id, bname: D.bname, g: D.g, sprite: D.sprite, excl: id, by: D.by,
      mat: 'metal', tier: 0, matName: '', matColor: D.pal.m,
      rarity: 6, ilvl: Math.max(1, Math.round(ilvl)), main: {}, affixes: [], powers: D.powers.slice(), plus: 0, locked: true, isNew: true, name: D.name,
    };
    if (D.slot === 'weapon') { item.main.atk = SLOT_MAIN.weapon.atk * S * R.mult * D.bmult; item.bmult = D.bmult; }
    for (const k in D.main) item.main[k] = STAT_INFO[k].pct ? D.main[k] : D.main[k] * S * R.mult;
    for (const k in D.affixes) item.affixes.push({ k, v: D.affixes[k], flat: false });
    return item;
  },
  // Exclusivas e Armas Ancestrais crescem junto com a zona recorde da jornada
  retune(item, ilvl) {
    ilvl = Math.max(1, Math.round(ilvl));
    if (!item.excl || item.ilvl === ilvl) return;
    const k = zoneScale(ilvl) / zoneScale(item.ilvl);
    for (const s in item.main) if (!STAT_INFO[s].pct) item.main[s] *= k;
    item.ilvl = ilvl;
  },

  // Fusão (multiclasse): a arma ganha a forma da arma de outra classe
  fusionName(it, partner) {
    const b = WEAPON_BASES[partner][0];
    const fem = it.g === 'f' || it.g === 'fp';
    return `${it.bname.split(' ')[0]}-${b.name.split(' ')[0]} ${fem ? 'Fundida' : 'Fundido'}`;
  },
  fuse(it, partner) {
    const b = WEAPON_BASES[partner][0];
    if (!it.fusion) { it.preFusion = { sprite: it.sprite, name: it.name }; }
    it.fusion = partner;
    it.sprite = Sprites.fusionSprite(it.preFusion.sprite, b.sprite);
    it.name = this.fusionName(it, partner);
  },
  unfuse(it) {
    if (!it.fusion) return;
    if (it.preFusion) { it.sprite = it.preFusion.sprite; it.name = it.preFusion.name; }
    delete it.fusion; delete it.preFusion;
  },

  // Reforja uma arma para a base de outra classe, mantendo raridade, nível, afixos e aprimoramento
  convertWeapon(it, cls) {
    if (it.excl) return; // armas exclusivas servem para qualquer classe
    if (it.slot !== 'weapon' || it.cls === cls || !WEAPON_BASES[cls]) return;
    this.unfuse(it);
    const old = WEAPON_INDEX[it.base];
    const oldMult = it.bmult || (old ? old.atk : 1);
    const nb = U.pick(WEAPON_BASES[cls]);
    it.main.atk = (it.main.atk || 0) / oldMult * nb.atk;
    delete it.main.atkSpd;
    if (old && old.extra) for (const k in old.extra) delete it.main[k];
    if (nb.spd) it.main.atkSpd = nb.spd;
    if (nb.extra) Object.assign(it.main, nb.extra);
    const M = MATERIALS[nb.mat];
    Object.assign(it, { base: nb.id, bname: nb.name, g: nb.g, sprite: nb.sprite, mat: nb.mat, matName: M.names[it.tier], matColor: M.colors[it.tier], cls, bmult: nb.atk });
    if (it.rarity < 4) it.name = this.makeName(it);
  },

  makeName(item) {
    if (item.excl) return EXCLUSIVES[item.excl].name;
    if (item.rarity === 5) return U.pick(MYTHIC_NAMES);
    if (item.rarity === 4) return U.pick(LEGEND_NAMES[item.slot]);
    let n = item.bname;
    if (item.affixes.length) {
      const a = AFFIXES.find(x => x.k === item.affixes[0].k);
      if (a) n += ' ' + a.adj[this.gIdx(item.g)];
    }
    return n + ' de ' + item.matName;
  },

  // Subtítulo: "Espada Épica · Nv 12"
  typeLine(item) {
    const gi = this.gIdx(item.g);
    const adj = RARITY_ADJ[item.rarity][gi % 2 === 1 ? 1 : 0];
    let adjTxt = adj;
    if (item.g === 'mp' || item.g === 'fp') adjTxt = adj.endsWith('m') ? adj.slice(0, -1) + 'ns' : adj + 's';
    return `${item.bname} ${adjTxt}`;
  },

  // Atributos totais do item (com aprimoramento da forja)
  stats(item) {
    const out = {};
    const pm = 1 + 0.08 * item.plus;
    for (const k in item.main) {
      const flat = !STAT_INFO[k].pct;
      out[k] = (out[k] || 0) + (flat ? item.main[k] * pm : item.main[k]);
    }
    for (const a of item.affixes) out[a.k] = (out[a.k] || 0) + (a.flat ? a.v * (1 + 0.03 * item.plus) : a.v);
    return out;
  },

  sellPrice(item) {
    return Math.ceil(3 * zoneScale(item.ilvl) * RARITIES[item.rarity].sell * (1 + 0.2 * item.plus));
  },

  forgeCost(item) {
    return Math.ceil(12 * zoneScale(item.ilvl) * (1 + item.rarity * 0.6) * Math.pow(1.38, item.plus));
  },
  forgeChance(item) {
    if (item.plus < 5) return 1;
    return Math.max(0.2, 1 - (item.plus - 4) * 0.08);
  },

  fmtStatVal(k, v) {
    const info = STAT_INFO[k];
    if (!info) return U.fmt(v);
    if (info.pct) return (v >= 0 ? '+' : '') + U.fmtNum(v, 1) + '%';
    return '+' + U.fmt(v) + (info.suf || '');
  },
  statLine(k, v) {
    const info = STAT_INFO[k];
    return `${this.fmtStatVal(k, v)} ${info ? info.name : k}`;
  },

  // HTML do tooltip
  tooltip(item, opts = {}) {
    const R = RARITIES[item.rarity];
    const st = Game.state;
    let h = '';
    if (opts.tag) h += `<div class="eq-tag">${opts.tag}</div>`;
    h += `<div class="tt-name c${item.rarity}">${U.esc(item.name)}${item.plus ? ` <span style="color:#ffe39a">+${item.plus}</span>` : ''}</div>`;
    h += `<div class="tt-sub">${this.typeLine(item)} · Nível ${item.ilvl}</div>`;
    const pm = 1 + 0.08 * item.plus;
    for (const k in item.main) {
      const info = STAT_INFO[k];
      const v = info.pct ? item.main[k] : item.main[k] * pm;
      if (info.pct) h += `<div class="tt-main" style="font-weight:500;font-size:12px">${this.statLine(k, v)}</div>`;
      else h += `<div class="tt-main"><span style="color:#fff">${U.fmt(v)}</span> ${info.name}</div>`;
    }
    if (item.affixes.length) {
      h += '<div class="tt-sep"></div>';
      for (const a of item.affixes) {
        const v = a.flat ? a.v * (1 + 0.03 * item.plus) : a.v;
        h += `<div class="tt-aff">${this.statLine(a.k, v)}</div>`;
      }
    }
    for (const p of item.powers) {
      const P = POWERS[p];
      h += `<div class="tt-pow"><b>✦ ${P.name}</b>${P.desc}</div>`;
    }
    if (item.fusion) h += `<div class="tt-pow"><b>⚔ Fusão com ${CLASSES[item.fusion].name}</b>Equipada, torna você multiclasse ${CLASSES[item.cls] ? CLASSES[item.cls].name : ''} / ${CLASSES[item.fusion].name} (se as duas classes estiverem dominadas).</div>`;
    if (item.excl) {
      const D = EXCLUSIVES[item.excl];
      h += `<div class="tt-lore">“${D.lore}”</div><div class="tt-by">Criada por <b>${U.esc(D.by)}</b> · fica com você entre jornadas</div>`;
    }
    if (opts.compare !== false && st) {
      const cur = st.equip[item.slot];
      if (cur !== item) {
        const diff = Stats.compareItem(item);
        const cls = diff > 0.0005 ? 'up-g' : diff < -0.0005 ? 'dn-r' : '';
        const txt = cur ? `${diff >= 0 ? '+' : ''}${U.fmtNum(diff * 100, 1)}% de Poder` : 'Espaço vazio — melhoria!';
        h += `<div class="tt-cmp">Comparado ao equipado: <b class="${cls}">${txt}</b>`;
        if (cur) {
          const a = this.stats(item), b = this.stats(cur);
          const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
          const lines = [];
          for (const k of keys) {
            const d = (a[k] || 0) - (b[k] || 0);
            if (Math.abs(d) < 0.05) continue;
            lines.push(`<span class="${d > 0 ? 'up-g' : 'dn-r'}">${d > 0 ? '▲' : '▼'} ${STAT_INFO[k].pct ? U.fmtNum(Math.abs(d), 1) + '%' : U.fmt(Math.abs(d))} ${STAT_INFO[k].name}</span>`);
          }
          if (lines.length) h += '<div style="margin-top:4px;display:grid;gap:1px">' + lines.join('') + '</div>';
        }
        h += '</div>';
      }
    }
    h += `<div class="tt-foot"><span>Vende por ${U.fmt(this.sellPrice(item))} ouro</span>${item.locked ? '<span>🔒 Travado</span>' : ''}</div>`;
    return h;
  },
};
