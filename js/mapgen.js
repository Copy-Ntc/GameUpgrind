'use strict';
const MapGen = {
  biomeOf(z) { return BIOMES[Math.floor((z - 1) / 5) % BIOMES.length]; },
  cycleOf(z) { return Math.floor((z - 1) / 40); },

  generate(z, encounter) {
    const biome = this.biomeOf(z);
    const isLord = z % 5 === 0;
    const w = 42 + Math.min(14, Math.floor(z / 3));
    const h = 32 + Math.min(8, Math.floor(z / 5));
    const T = new Uint8Array(w * h);
    const idx = (x, y) => y * w + x;
    const inb = (x, y) => x > 0 && y > 0 && x < w - 1 && y < h - 1;
    const setF = (x, y) => { if (inb(x, y)) T[idx(x, y)] = 1; };

    const rooms = [];
    const target = U.randi(9, 13);
    for (let t = 0; t < 400 && rooms.length < target; t++) {
      const rw = U.randi(5, 10), rh = U.randi(4, 8);
      const rx = U.randi(2, w - rw - 3), ry = U.randi(2, h - rh - 3);
      if (rooms.some(r => rx < r.x + r.w + 2 && rx + rw + 2 > r.x && ry < r.y + r.h + 2 && ry + rh + 2 > r.y)) continue;
      rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + (rw >> 1), cy: ry + (rh >> 1) });
    }
    for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) setF(x, y);

    const wide = biome.organic > 0.4;
    const hline = (x0, x1, y) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) { setF(x, y); if (wide && Math.random() < 0.5) setF(x, y + 1); } };
    const vline = (y0, y1, x) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) { setF(x, y); if (wide && Math.random() < 0.5) setF(x + 1, y); } };
    const corridor = (a, b) => {
      if (Math.random() < 0.5) { hline(a.cx, b.cx, a.cy); vline(a.cy, b.cy, b.cx); }
      else { vline(a.cy, b.cy, a.cx); hline(a.cx, b.cx, b.cy); }
    };
    const inTree = [0], rest = rooms.map((_, i) => i).slice(1);
    const d2 = (a, b) => (a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2;
    while (rest.length) {
      let best = null, bd = Infinity;
      for (const i of inTree) for (const j of rest) { const d = d2(rooms[i], rooms[j]); if (d < bd) { bd = d; best = [i, j]; } }
      corridor(rooms[best[0]], rooms[best[1]]);
      inTree.push(best[1]); rest.splice(rest.indexOf(best[1]), 1);
    }
    const loops = U.randi(2, 3);
    for (let k = 0; k < loops; k++) {
      const a = U.pick(rooms), b = U.pick(rooms);
      if (a !== b && d2(a, b) < 22 * 22) corridor(a, b);
    }

    const org = biome.organic;
    if (org > 0) {
      for (let it = 0; it < 2; it++) {
        const add = [];
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
          if (T[idx(x, y)]) continue;
          const n = T[idx(x - 1, y)] + T[idx(x + 1, y)] + T[idx(x, y - 1)] + T[idx(x, y + 1)];
          if (n > 0 && Math.random() < org * 0.33) add.push([x, y]);
        }
        for (const [x, y] of add) setF(x, y);
      }
    }
    for (let it = 0; it < 2; it++) {
      const add = [];
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (T[idx(x, y)]) continue;
        let n8 = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) n8 += T[idx(x + dx, y + dy)];
        const n4 = T[idx(x - 1, y)] + T[idx(x + 1, y)] + T[idx(x, y - 1)] + T[idx(x, y + 1)];
        if (n8 >= 6 || n4 >= 3) add.push([x, y]);
      }
      for (const [x, y] of add) setF(x, y);
    }

    let start = rooms[0];
    for (const r of rooms) if (r.cx + r.cy < start.cx + start.cy) start = r;
    const dist = this.bfsDist(T, w, h, start.cx, start.cy);
    let bossRoom = rooms[0], bdist = -1;
    for (const r of rooms) { const d = dist[idx(r.cx, r.cy)]; if (r !== start && d > bdist) { bdist = d; bossRoom = r; } }

    const taken = new Set();
    const key = (x, y) => x + ',' + y;
    const take = (x, y) => taken.add(key(x, y));
    const isFree = (x, y) => T[idx(x, y)] === 1 && !taken.has(key(x, y));
    take(start.cx, start.cy);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) take(start.cx + dx, start.cy + dy);

    const interior = (x, y) => {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!T[idx(x + dx, y + dy)]) return false;
      return true;
    };
    const randIn = (r, tries = 30, solid = false) => {
      for (let t = 0; t < tries; t++) {
        const x = U.randi(r.x, r.x + r.w - 1), y = U.randi(r.y, r.y + r.h - 1);
        if (isFree(x, y) && (!solid || interior(x, y))) return [x, y];
      }
      return null;
    };

    const spawns = [];
    const portal = { x: bossRoom.cx, y: bossRoom.cy, active: false };
    take(portal.x, portal.y);
    let bx = bossRoom.cx + 1, by = bossRoom.cy;
    if (!isFree(bx, by)) { const p = randIn(bossRoom); if (p) [bx, by] = p; }
    take(bx, by);
    const bossType = isLord ? biome.lord : U.pick(biome.enemies);
    spawns.push({ x: bx, y: by, type: bossType, boss: true, lord: isLord });
    const guards = isLord ? 3 : 2;
    for (let i = 0; i < guards; i++) {
      const p = randIn(bossRoom);
      if (p) { take(p[0], p[1]); spawns.push({ x: p[0], y: p[1], type: U.pick(biome.enemies), elite: Math.random() < 0.3 }); }
    }

    const eliteChance = Math.min(0.15, 0.06 + z * 0.002);
    const packMax = 3 + Math.min(3, Math.floor(z / 8));
    for (const r of rooms) {
      if (r === start || r === bossRoom) continue;
      const area = r.w * r.h;
      const n = U.clamp(Math.round(area / 13 + U.rand(-1, 1)), 1, packMax);
      const packType = U.pick(biome.enemies);
      for (let i = 0; i < n; i++) {
        const p = randIn(r);
        if (!p) continue;
        take(p[0], p[1]);
        spawns.push({ x: p[0], y: p[1], type: Math.random() < 0.6 ? packType : U.pick(biome.enemies), elite: Math.random() < eliteChance });
      }
    }
    const corridorTiles = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (!T[idx(x, y)]) continue;
      if (rooms.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)) continue;
      if (dist[idx(x, y)] < 8) continue;
      corridorTiles.push([x, y]);
    }
    U.shuffle(corridorTiles);
    const wanderers = U.randi(3, 6);
    for (let i = 0, c = 0; i < corridorTiles.length && c < wanderers; i++) {
      const [x, y] = corridorTiles[i];
      if (!isFree(x, y)) continue;
      take(x, y); c++;
      spawns.push({ x, y, type: U.pick(biome.enemies), elite: Math.random() < eliteChance });
    }

    const chests = [];
    const deadEnds = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (!T[idx(x, y)]) continue;
      const n4 = T[idx(x - 1, y)] + T[idx(x + 1, y)] + T[idx(x, y - 1)] + T[idx(x, y + 1)];
      if (n4 === 1 && dist[idx(x, y)] > 5) deadEnds.push([x, y]);
    }
    U.shuffle(deadEnds);
    const nChests = U.randi(5, 8);
    const placeChest = (x, y, bonus) => {
      let tier = U.weighted(CHEST_TIERS).id;
      if (bonus && tier < 3 && Math.random() < 0.5) tier++;
      const mimic = z >= 3 && Math.random() < 0.045;
      chests.push({ x, y, tier, opened: false, mimic, seen: false });
      take(x, y);
    };
    for (const [x, y] of deadEnds) { if (chests.length >= Math.ceil(nChests / 2)) break; if (isFree(x, y)) placeChest(x, y, true); }
    const chestRooms = rooms.filter(r => r !== start);
    for (let t = 0; t < 60 && chests.length < nChests; t++) {
      const p = randIn(U.pick(chestRooms), 30, true);
      if (p) placeChest(p[0], p[1], false);
    }
    if (z >= RAINBOW_ZONE && Math.random() < RAINBOW_CHANCE) {
      for (let t = 0; t < 40; t++) {
        const p = randIn(U.pick(chestRooms), 30, true);
        if (p) { chests.push({ x: p[0], y: p[1], tier: 4, opened: false, mimic: false, seen: false }); take(p[0], p[1]); break; }
      }
    }
    const bp = randIn(bossRoom, 40, true);
    if (bp) { chests.push({ x: bp[0], y: bp[1], tier: isLord ? 3 : 2, opened: false, mimic: false, seen: false, bossChest: true }); take(bp[0], bp[1]); }

    const shrines = [];
    if (z >= 2) {
      const ns = Math.random() < 0.6 ? (Math.random() < 0.3 ? 2 : 1) : 0;
      const types = Object.keys(SHRINES);
      for (let i = 0; i < ns; i++) {
        const r = U.pick(rooms.filter(r => r !== start && r !== bossRoom));
        if (!r) break;
        const p = randIn(r, 40, true);
        if (p) { shrines.push({ x: p[0], y: p[1], type: U.pick(types), used: false, seen: false }); take(p[0], p[1]); }
      }
    }

    let recruit = null;
    if (encounter) {
      const pool = rooms.filter(r => r !== start && r !== bossRoom);
      for (let t = 0; t < 30 && !recruit && pool.length; t++) {
        const r = U.pick(pool);
        const p = randIn(r, 40, true);
        if (!p) continue;
        recruit = Object.assign({}, encounter, { x: p[0], y: p[1], freed: false, seen: false });
        take(p[0], p[1]);
        const relic = encounter.kind === 'relic';
        const guards = relic ? 4 : 2 + (z >= 10 ? 1 : 0);
        for (let i = 0; i < guards; i++) {
          const g = randIn(r);
          if (g) { take(g[0], g[1]); spawns.push({ x: g[0], y: g[1], type: U.pick(biome.enemies), elite: relic || Math.random() < 0.5 }); }
        }
      }
    }

    const decor = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (!T[idx(x, y)] || taken.has(key(x, y))) continue;
      if (Math.random() < 0.075) decor.push({ x, y, type: U.pick(biome.decor), ox: U.randi(2, 6), oy: U.randi(2, 6) });
    }
    const torches = [];
    if (biome.torches || biome.dark > 0.3) {
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (T[idx(x, y)] === 0 && T[idx(x, y + 1)] === 1 && Math.random() < 0.07) torches.push({ x, y, ph: Math.random() * 10 });
      }
    }

    return { z, biome, isLord, w, h, tiles: T, rooms, start: { x: start.cx, y: start.cy }, bossRoom, portal, spawns, chests, shrines, decor, torches, recruit };
  },

  bfsDist(T, w, h, sx, sy) {
    const d = new Int32Array(w * h).fill(-1);
    const q = new Int32Array(w * h);
    let qh = 0, qt = 0;
    d[sy * w + sx] = 0; q[qt++] = sy * w + sx;
    while (qh < qt) {
      const i = q[qh++], x = i % w, y = (i / w) | 0;
      const nb = [i - 1, i + 1, i - w, i + w];
      for (let k = 0; k < 4; k++) {
        const j = nb[k];
        if (k === 0 && x === 0) continue;
        if (k === 1 && x === w - 1) continue;
        if (j < 0 || j >= w * h || !T[j] || d[j] >= 0) continue;
        d[j] = d[i] + 1; q[qt++] = j;
      }
    }
    return d;
  },
};
