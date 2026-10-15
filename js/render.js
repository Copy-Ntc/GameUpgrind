'use strict';
// ============================================================
// Renderização em canvas: mapa, névoa, luz, entidades, efeitos
// ============================================================
const Render = {
  canvas: null, ctx: null, mini: null, mctx: null,
  dpr: 1, zoom: 2, unit: 2, TS: 32,
  cam: { x: 0, y: 0, init: false },
  mapCanvas: null, fogCanvas: null, lightCanvas: null,
  time: 0, miniT: 0,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.mini = document.getElementById('minimap');
    this.mctx = this.mini.getContext('2d');
    this.lightCanvas = document.createElement('canvas');
    this.zoom = window.innerWidth > 1700 ? 2.5 : 2;
    try { const z = parseFloat(localStorage.getItem('upgrind_zoom')); if (z) this.zoom = z; } catch (e) { /* sem storage */ }
    window.addEventListener('resize', () => this.resize());
    if (window.ResizeObserver) new ResizeObserver(() => this.resize()).observe(this.canvas.parentElement);
    this.canvas.parentElement.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const Z = [1.5, 2, 2.5, 3, 4];
      let i = Z.indexOf(this.zoom); if (i < 0) i = 1;
      i = U.clamp(i + (ev.deltaY < 0 ? 1 : -1), 0, Z.length - 1);
      this.zoom = Z[i];
      try { localStorage.setItem('upgrind_zoom', this.zoom); } catch (e) { /* sem storage */ }
      this.resize();
    }, { passive: false });
    this.resize();
  },

  resize() {
    const vp = this.canvas.parentElement;
    const w = vp.clientWidth, h = vp.clientHeight;
    if (!w || !h) return;
    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.unit = Math.max(1, Math.round(this.zoom * this.dpr));
    this.TS = 16 * this.unit;
    this.lightCanvas.width = Math.ceil(this.canvas.width / 4);
    this.lightCanvas.height = Math.ceil(this.canvas.height / 4);
    this.cam.init = false;
  },

  // ---------------------------------------------------------- mapa
  buildMap(W) {
    const c = document.createElement('canvas');
    c.width = W.w * 16; c.height = W.h * 16;
    const g = c.getContext('2d');
    const P = W.biome.pal, B = W.biome;
    const T = (x, y) => (x < 0 || y < 0 || x >= W.w || y >= W.h) ? 0 : W.tiles[y * W.w + x];
    const H = (x, y, s) => U.hash2(x, y, s + W.z * 7);
    const fill = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };

    g.fillStyle = P.bg; g.fillRect(0, 0, c.width, c.height);

    for (let ty = 0; ty < W.h; ty++) for (let tx = 0; tx < W.w; tx++) {
      const X = tx * 16, Y = ty * 16;
      if (T(tx, ty)) {
        // ---- Chão ----
        fill(X, Y, 16, 16, H(tx, ty, 1) < 0.5 ? P.floor : P.floor2);
        if (B.id === 'crypt') {
          g.fillStyle = U.shade(P.floor, -0.25);
          g.fillRect(X, Y + 7, 16, 1); g.fillRect(X + (ty % 2 ? 3 : 11), Y, 1, 7); g.fillRect(X + (ty % 2 ? 11 : 4), Y + 8, 1, 8);
        }
        const n = 4 + Math.floor(H(tx, ty, 2) * 6);
        for (let i = 0; i < n; i++) {
          const sx = Math.floor(H(tx, ty, 10 + i) * 16), sy = Math.floor(H(tx, ty, 30 + i) * 16);
          let col = P.speck[Math.floor(H(tx, ty, 50 + i) * 3)];
          if ((B.id === 'volcano' || B.id === 'void') && col === P.speck[2] && H(tx, ty, 70 + i) > 0.3) col = P.speck[0];
          fill(X + sx, Y + sy, 1, 1, col);
        }
        if (B.id === 'forest' || B.id === 'swamp') {
          for (let i = 0; i < 3; i++) if (H(tx, ty, 90 + i) < 0.5) {
            const sx = Math.floor(H(tx, ty, 95 + i) * 14) + 1, sy = Math.floor(H(tx, ty, 99 + i) * 13) + 2;
            fill(X + sx, Y + sy, 1, 2, P.speck[2]); fill(X + sx + 1, Y + sy - 1, 1, 2, P.speck[2]);
          }
        }
        if (B.id === 'desert' && H(tx, ty, 120) < 0.45) {
          const sy = 3 + Math.floor(H(tx, ty, 121) * 10);
          for (let i = 0; i < 9; i++) fill(X + 2 + i, Y + sy + (i % 4 < 2 ? 0 : 1), 1, 1, P.speck[2]);
        }
        if (B.id === 'ice' && H(tx, ty, 130) < 0.25) {
          let cx = 3 + Math.floor(H(tx, ty, 131) * 8), cy = 3 + Math.floor(H(tx, ty, 132) * 8);
          for (let i = 0; i < 6; i++) { fill(X + cx, Y + cy, 1, 1, P.speck[1]); cx += H(tx, ty, 133 + i) < 0.5 ? 1 : 0; cy += 1; }
        }
        if (B.id === 'volcano' && H(tx, ty, 140) < 0.12) {
          let cx = 2 + Math.floor(H(tx, ty, 141) * 10), cy = 2 + Math.floor(H(tx, ty, 142) * 10);
          for (let i = 0; i < 7; i++) { fill(X + cx, Y + cy, 1, 1, i % 3 ? '#ff5a1a' : '#ffb02a'); cx += 1; cy += H(tx, ty, 143 + i) < 0.5 ? 1 : -1; cy = U.clamp(cy, 0, 15); if (cx > 15) break; }
        }
        if (B.id === 'swamp' && H(tx, ty, 150) < 0.1) {
          fill(X + 3, Y + 6, 8, 4, P.puddle); fill(X + 4, Y + 5, 6, 6, P.puddle); fill(X + 5, Y + 6, 2, 1, U.shade(P.puddle, 0.3));
        }
        // Sombra de paredes adjacentes (oclusão)
        if (!T(tx, ty - 1)) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(X, Y, 16, 3); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(X, Y + 3, 16, 2); }
        if (!T(tx - 1, ty)) { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(X, Y, 2, 16); }
        if (!T(tx + 1, ty)) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(X + 14, Y, 2, 16); }
      } else {
        // ---- Parede ----
        const nearFloor = (() => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (T(tx + dx, ty + dy)) return true; return false; })();
        const face = T(tx, ty + 1) === 1;
        this.drawWall(g, W, tx, ty, X, Y, face, nearFloor, H, fill);
      }
    }
    // Decorações
    for (const d of W.decor) {
      const pal = decorPal(B.id, d.type);
      if (!pal) continue;
      const s = Sprites.get('d_' + d.type, pal);
      g.drawImage(s.c, d.x * 16 + d.ox - 2, d.y * 16 + d.oy - 2);
    }
    this.mapCanvas = c;
    W.mapDirty = false;
  },

  drawWall(g, W, tx, ty, X, Y, face, nearFloor, H, fill) {
    const P = W.biome.pal, style = W.biome.wall;
    if (!nearFloor) {
      fill(X, Y, 16, 16, U.shade(P.wallTop, -0.35));
      if (style === 'trees' && H(tx, ty, 3) < 0.6) { g.fillStyle = U.shade(P.wallTop, -0.15); g.beginPath(); g.arc(X + 8, Y + 8, 7, 0, 7); g.fill(); }
      return;
    }
    const topH = face ? 6 : 16;
    // Topo
    fill(X, Y, 16, topH, P.wallTop);
    if (style === 'trees') {
      const blobs = 3 + Math.floor(H(tx, ty, 4) * 3);
      for (let i = 0; i < blobs; i++) {
        const bx = X + 2 + H(tx, ty, 5 + i) * 12, by = Y + 2 + H(tx, ty, 9 + i) * (face ? 8 : 12), r = 3 + H(tx, ty, 13 + i) * 3;
        g.fillStyle = H(tx, ty, 17 + i) < 0.5 ? P.wallTop2 : P.wallHi;
        g.beginPath(); g.arc(Math.round(bx), Math.round(by), Math.round(r), 0, 7); g.fill();
      }
      if (H(tx, ty, 40) < 0.15) fill(X + 5 + Math.floor(H(tx, ty, 41) * 6), Y + 4, 2, 2, '#e8504a');
    } else {
      for (let i = 0; i < 6; i++) {
        const sx = Math.floor(H(tx, ty, 20 + i) * 15), sy = Math.floor(H(tx, ty, 26 + i) * (topH - 1));
        fill(X + sx, Y + sy, 2, 1, H(tx, ty, 32 + i) < 0.5 ? P.wallTop2 : P.wallHi);
      }
      if (style === 'crystal' && H(tx, ty, 50) < 0.35) {
        const cx = X + 3 + Math.floor(H(tx, ty, 51) * 9);
        fill(cx, Y + 2, 2, 4, '#8a5aff'); fill(cx, Y + 2, 1, 2, '#e0c8ff');
      }
      if (style === 'ice') { fill(X, Y, 16, 1, P.wallHi); }
    }
    // Bordas destacadas onde encontra chão
    const T = (x, y) => (x < 0 || y < 0 || x >= W.w || y >= W.h) ? 0 : W.tiles[y * W.w + x];
    if (T(tx, ty - 1)) fill(X, Y, 16, 1, P.wallHi);
    if (T(tx - 1, ty)) fill(X, Y, 1, topH, U.shade(P.wallHi, -0.1));
    if (T(tx + 1, ty)) fill(X + 15, Y, 1, topH, U.shade(P.wallTop, -0.3));
    if (!face) return;
    // Face frontal
    const FY = Y + 6, FH = 10;
    fill(X, FY, 16, FH, P.face);
    if (style === 'trees') {
      fill(X, FY, 16, 2, U.shade(P.wallTop, -0.2));
      const trunks = [2 + Math.floor(H(tx, ty, 60) * 3), 9 + Math.floor(H(tx, ty, 61) * 3)];
      fill(X, FY + 2, 16, FH - 2, P.faceDark);
      for (const t of trunks) { fill(X + t, FY + 2, 4, FH - 2, P.face); fill(X + t, FY + 2, 1, FH - 2, U.shade(P.face, 0.2)); }
      fill(X, Y + 15, 16, 1, U.shade(P.floor, -0.3));
    } else if (style === 'bricks') {
      g.fillStyle = P.faceDark;
      for (let r = 0; r < 3; r++) {
        g.fillRect(X, FY + r * 3 + 2, 16, 1);
        const off = (r + ty) % 2 ? 0 : 4;
        for (let k = off; k < 16; k += 8) g.fillRect(X + k, FY + r * 3, 1, 3);
      }
      fill(X, FY, 16, 1, U.shade(P.face, 0.15));
    } else {
      g.fillStyle = P.faceDark;
      g.fillRect(X, FY + 3 + Math.floor(H(tx, ty, 70) * 2), 16, 1);
      g.fillRect(X, FY + 7 + Math.floor(H(tx, ty, 71) * 2), 16, 1);
      for (let i = 0; i < 4; i++) fill(X + Math.floor(H(tx, ty, 72 + i) * 15), FY + 1 + Math.floor(H(tx, ty, 76 + i) * 8), 1, 2, P.faceDark);
      fill(X, FY, 16, 1, U.shade(P.face, 0.2));
      if (style === 'basalt' && H(tx, ty, 80) < 0.3) { const lx = X + 2 + Math.floor(H(tx, ty, 81) * 11); fill(lx, FY + 2, 1, 6, '#ff5a1a'); fill(lx, FY + 4, 1, 2, '#ffb02a'); }
      if (style === 'ice') { for (let i = 0; i < 3; i++) { const ix = X + 2 + Math.floor(H(tx, ty, 85 + i) * 12); fill(ix, FY + FH - 1, 1, 1, '#ffffff'); fill(ix, FY + FH - 3, 1, 2, P.wallHi); } }
      if (style === 'crystal' && H(tx, ty, 90) < 0.4) { const ix = X + 3 + Math.floor(H(tx, ty, 91) * 10); fill(ix, FY + 2, 2, 6, '#6a3aff'); fill(ix, FY + 2, 1, 3, '#c8a8ff'); }
    }
    fill(X, Y + 15, 16, 1, 'rgba(0,0,0,0.4)');
  },

  buildFog(W) {
    if (!this.fogCanvas || this.fogCanvas.width !== W.w || this.fogCanvas.height !== W.h) {
      this.fogCanvas = document.createElement('canvas');
      this.fogCanvas.width = W.w; this.fogCanvas.height = W.h;
    }
    const g = this.fogCanvas.getContext('2d');
    const img = g.createImageData(W.w, W.h);
    const [r, gg, b] = U.hexRgb(W.biome.pal.fog);
    for (let i = 0; i < W.w * W.h; i++) {
      const a = W.vis[i] ? 0 : W.explored[i] ? 140 : 255;
      img.data[i * 4] = r; img.data[i * 4 + 1] = gg; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = a;
    }
    g.putImageData(img, 0, 0);
    W.fogDirty = false;
  },

  // ---------------------------------------------------------- quadro
  frame(W, dt) {
    if (!W) return;
    this.time += dt;
    const ctx = this.ctx, cv = this.canvas, TS = this.TS, u = this.unit;
    if (W.mapDirty || !this.mapCanvas) this.buildMap(W);
    if (W.fogDirty) this.buildFog(W);

    // Câmera
    const hero = W.hero;
    const tx = (hero.rx + 0.5) * TS - cv.width / 2, ty = (hero.ry + 0.5) * TS - cv.height / 2;
    const mw = W.w * TS, mh = W.h * TS;
    const clampX = v => mw <= cv.width ? (mw - cv.width) / 2 : U.clamp(v, 0, mw - cv.width);
    const clampY = v => mh <= cv.height ? (mh - cv.height) / 2 : U.clamp(v, 0, mh - cv.height);
    if (!this.cam.init) { this.cam.x = clampX(tx); this.cam.y = clampY(ty); this.cam.init = true; }
    const k = 1 - Math.pow(0.002, dt);
    this.cam.x = clampX(U.lerp(this.cam.x, tx, k));
    this.cam.y = clampY(U.lerp(this.cam.y, ty, k));
    let sx = 0, sy = 0;
    if (W.shake > 0 && Game.state.settings.shake) { sx = (Math.random() - 0.5) * W.shake * u * 6; sy = (Math.random() - 0.5) * W.shake * u * 6; }
    const ox = Math.round(-this.cam.x + sx), oy = Math.round(-this.cam.y + sy);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = W.biome.pal.bg;
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(1, 0, 0, 1, ox, oy);

    // Mapa
    ctx.drawImage(this.mapCanvas, 0, 0, W.w * 16, W.h * 16, 0, 0, W.w * TS, W.h * TS);

    const vx0 = Math.floor(-ox / TS) - 2, vy0 = Math.floor(-oy / TS) - 2;
    const vx1 = vx0 + Math.ceil(cv.width / TS) + 4, vy1 = vy0 + Math.ceil(cv.height / TS) + 4;
    const onScreen = (x, y) => x >= vx0 && x <= vx1 && y >= vy0 && y <= vy1;
    const explored = (x, y) => W.explored[y * W.w + x];
    const visible = (x, y) => W.vis[y * W.w + x];

    // Lava/poças animadas (brilho)
    if (W.biome.id === 'volcano') {
      ctx.globalCompositeOperation = 'lighter';
      for (const d of W.decor) if (d.type === 'lava' && onScreen(d.x, d.y) && explored(d.x, d.y)) {
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(this.time * 3 + d.x);
        ctx.fillStyle = '#ff5a1a';
        ctx.beginPath(); ctx.arc((d.x + 0.5) * TS, (d.y + 0.5) * TS, TS * 0.45, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }

    // Portal
    if (explored(W.portal.x, W.portal.y)) this.drawPortal(W);

    // Tochas
    for (const t of W.torches) if (onScreen(t.x, t.y) && explored(t.x, t.y)) this.drawTorch(t);

    // Santuários
    for (const s of W.shrines) {
      if (!onScreen(s.x, s.y) || !explored(s.x, s.y)) continue;
      const D = SHRINES[s.type];
      const spr = Sprites.get('shrine', { a: '#8a8a9a', b: '#5a5a6a', g: s.used ? '#5a5a6a' : D.color, w: s.used ? '#7a7a8a' : '#ffffff' });
      if (!s.used) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25 + 0.1 * Math.sin(this.time * 3);
        const gr = ctx.createRadialGradient((s.x + 0.5) * TS, (s.y + 0.2) * TS, 0, (s.x + 0.5) * TS, (s.y + 0.2) * TS, TS * 1.1);
        gr.addColorStop(0, D.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr; ctx.fillRect((s.x - 1) * TS, (s.y - 1) * TS, TS * 3, TS * 3);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      this.drawSprite(spr, (s.x + 0.5) * TS, (s.y + 1) * TS, 1, false);
    }

    // Baús
    for (const c of W.chests) {
      if (c.gone || !onScreen(c.x, c.y) || !explored(c.x, c.y)) continue;
      const T = CHEST_TIERS[c.tier];
      if (T.rainbow && !c.opened) {
        // brilho arco-íris girando atrás do baú
        const cx = (c.x + 0.5) * TS, cy = (c.y + 0.6) * TS;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45 + 0.15 * Math.sin(this.time * 3);
        const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, TS * 1.4);
        gr.addColorStop(0, `hsl(${(this.time * 120) % 360}, 100%, 65%)`);
        gr.addColorStop(0.5, `hsla(${(this.time * 120 + 120) % 360}, 100%, 60%, .5)`);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr; ctx.fillRect(cx - TS * 1.4, cy - TS * 1.4, TS * 2.8, TS * 2.8);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        if (visible(c.x, c.y) && Math.random() < 0.35) World.part(W, c.x + U.rand(0.1, 0.9), c.y + U.rand(0.2, 0.8), 0, -0.8, `hsl(${Math.floor(Math.random() * 360)}, 100%, 65%)`, 0.9, 1.5, 0);
      }
      const spr = Sprites.get(c.opened ? 'chest_open' : 'chest', Object.assign({ k: '#1a1010', y: '#ffd04a' }, T.pal));
      let shx = 0;
      if (c.shaking && !c.opened) shx = Math.round(Math.sin(this.time * 50) * u);
      this.drawShadow((c.x + 0.5) * TS, (c.y + 1) * TS - u * 2, 0.8);
      this.drawSprite(spr, (c.x + 0.5) * TS + shx, (c.y + 1) * TS - u, 1, false);
      if (!c.opened && c.tier >= 1 && visible(c.x, c.y) && Math.random() < 0.06 * c.tier) {
        World.part(W, c.x + U.rand(0.2, 0.8), c.y + U.rand(0.3, 0.8), 0, -0.6, T.pal.g, 0.8, 1.5, 0);
      }
    }

    // Prisioneiro resgatável
    const R = W.recruit;
    if (R && explored(R.x, R.y) && onScreen(R.x, R.y)) this.drawRecruit(W, R);

    // Efeitos de chão
    for (const f of W.fx) if (f.type === 'telegraph' || f.type === 'cloud') this.drawFx(W, f);

    // Entidades (ordenadas por Y)
    const ents = W.ents.filter(e => {
      if (!onScreen(e.x, e.y)) return false;
      if (e.kind === 'enemy') return !e.hidden && (visible(e.x, e.y) || visible(e.nx, e.ny));
      return true;
    }).sort((a, b) => a.ry - b.ry);
    for (const e of ents) this.drawShadow((e.rx + 0.5) * TS, (e.ry + 1) * TS - u * 2, e.scale * (e.kind === 'hero' ? 0.85 : 0.8), e.fly);
    for (const e of ents) this.drawEnt(W, e);

    // Projéteis
    for (const p of W.proj) if (p.delay <= 0) this.drawProj(p);

    // Efeitos
    for (const f of W.fx) if (f.type !== 'telegraph' && f.type !== 'cloud') this.drawFx(W, f);

    // Partículas
    for (const p of W.parts) {
      const a = 1 - p.t / p.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const s = Math.max(1, Math.round(p.size * u / 2));
      ctx.fillRect(Math.round(p.x * TS - s / 2), Math.round(p.y * TS - s / 2), s, s);
    }
    ctx.globalAlpha = 1;

    // Escuridão (biomas sombrios)
    if (W.biome.dark > 0) this.drawLight(W, ox, oy);

    // Névoa de guerra
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.fogCanvas, 0, 0, W.w, W.h, -TS * 0.5 + TS * 0.5, 0, W.w * TS, W.h * TS);
    ctx.imageSmoothingEnabled = false;

    // Barras de vida
    for (const e of ents) if (e.kind !== 'hero' && !e.dead && (e.hp < e.maxHp || e.elite || e.boss || e.kind === 'minion')) this.drawHpBar(e);
    if (hero.opening) {
      const tot = hero.opening.kind === 'chest' ? 0.55 : 0.8;
      this.bar((hero.rx + 0.5) * TS, (hero.ry - 0.15) * TS, TS * 0.7, u * 1.5, 1 - hero.opening.t / tot, '#ffd04a');
    }

    // Textos flutuantes
    const fs = this.dpr * Math.max(1, this.zoom / 2);
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const t of W.texts) {
      const a = t.t > t.life * 0.6 ? 1 - (t.t - t.life * 0.6) / (t.life * 0.4) : 1;
      const pop = t.bold && t.t < 0.12 ? 1 + (0.12 - t.t) * 4 : 1;
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = `${t.bold ? 700 : 600} ${Math.round(t.size * fs * pop)}px 'Pixelify Sans', sans-serif`;
      ctx.lineWidth = 3 * fs;
      ctx.strokeStyle = 'rgba(10,6,14,0.9)';
      ctx.strokeText(t.text, t.x * TS, t.y * TS);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x * TS, t.y * TS);
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Minimapa
    this.miniT -= dt;
    if (this.miniT <= 0) { this.miniT = 0.15; this.drawMinimap(W); }
  },

  drawSprite(spr, cx, by, scale, flip, alpha = 1, flash = 0, tint = null) {
    const ctx = this.ctx;
    const ps = Math.max(1, Math.round(this.unit * scale));
    const w = spr.sw * ps, h = spr.sh * ps;
    const x = Math.round(cx - w / 2), y = Math.round(by - h);
    if (alpha < 1) ctx.globalAlpha = alpha;
    if (flip) {
      ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1);
      ctx.drawImage(spr.c, 0, 0, w, h);
      if (flash > 0) { ctx.globalAlpha = Math.min(1, flash * 8) * alpha; ctx.drawImage(spr.w, 0, 0, w, h); }
      if (tint) { ctx.globalAlpha = tint.a * alpha; ctx.drawImage(this.tinted(spr, tint.c), 0, 0, w, h); }
      ctx.restore();
    } else {
      ctx.drawImage(spr.c, x, y, w, h);
      if (flash > 0) { ctx.globalAlpha = Math.min(1, flash * 8) * alpha; ctx.drawImage(spr.w, x, y, w, h); }
      if (tint) { ctx.globalAlpha = tint.a * alpha; ctx.drawImage(this.tinted(spr, tint.c), x, y, w, h); }
    }
    ctx.globalAlpha = 1;
  },

  tinted(spr, color) {
    spr.tints = spr.tints || {};
    if (spr.tints[color]) return spr.tints[color];
    const c = document.createElement('canvas'); c.width = spr.sw; c.height = spr.sh;
    const g = c.getContext('2d');
    g.drawImage(spr.c, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    spr.tints[color] = c;
    return c;
  },

  drawShadow(cx, y, scale, fly) {
    const ctx = this.ctx, TS = this.TS;
    ctx.fillStyle = fly ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, y, TS * 0.3 * scale, TS * 0.1 * scale, 0, 0, 7);
    ctx.fill();
  },

  drawEnt(W, e) {
    const ctx = this.ctx, TS = this.TS, u = this.unit, t = this.time;
    let cx = (e.rx + 0.5) * TS, by = (e.ry + 1) * TS - u;
    if (e.moving) by -= Math.round(Math.abs(Math.sin(e.mt * Math.PI)) * u * 2);
    else if (!e.dead) by -= Math.round((Math.sin(t * 3 + e.bob) + 1) * 0.5 * u * 0.6);
    if (e.fly) by -= u * 5 + Math.round(Math.sin(t * 4 + e.bob) * u * 1.5);
    if (e.lunge) {
      const L = Math.hypot(e.lunge.dx, e.lunge.dy) || 1;
      const k = Math.sin((e.lunge.t / 0.15) * Math.PI) * u * 4;
      cx += e.lunge.dx / L * k; by += e.lunge.dy / L * k;
    }
    let alpha = 1, scale = e.scale || 1;
    if (e.dead) { alpha = Math.max(0, e.deathT / 0.45); by += (1 - alpha) * u * 4; }
    if (e.kind === 'minion' && e.life < 2) alpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 10));

    // Auras
    if (!e.dead && (e.elite || e.boss)) {
      const col = e.boss ? '#ff3a3a' : '#ffcf4a';
      ctx.globalAlpha = 0.45 + 0.2 * Math.sin(t * 4 + e.bob);
      ctx.strokeStyle = col; ctx.lineWidth = u;
      ctx.beginPath(); ctx.ellipse((e.rx + 0.5) * TS, (e.ry + 1) * TS - u * 2, TS * 0.42 * scale, TS * 0.15 * scale, 0, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (e.kind === 'hero' && e.shield > 0) {
      ctx.globalAlpha = 0.25 + 0.08 * Math.sin(t * 5);
      ctx.fillStyle = '#7ae8ff';
      ctx.beginPath(); ctx.arc(cx, by - TS * 0.45, TS * 0.62, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.7; ctx.strokeStyle = '#bff4ff'; ctx.lineWidth = u * 0.7; ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (e.kind === 'hero' && e.buffs.length) {
      const b = e.buffs[0];
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.ellipse(cx, (e.ry + 1) * TS - u * 2, TS * 0.45, TS * 0.16, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }

    const spr = Sprites.get(e.sprite, e.pal);
    let tint = null;
    if (e.effects.freeze > 0) tint = { c: '#7ad0ff', a: 0.55 };
    else if (e.dots && e.dots.length) tint = { c: e.dots[0].color, a: 0.18 + 0.1 * Math.sin(t * 8) };
    else if (e.kind === 'minion') tint = { c: '#4dff8a', a: 0.12 };
    if (e.type === 'ghost') alpha *= 0.75;
    const flip = e.face < 0;
    this.drawSprite(spr, cx, by, scale, flip, alpha, e.flash, tint);
    if (e.lord && !e.dead) {
      const crown = Sprites.get('crown', { g: '#ffd04a', r: '#ff3a5a' });
      const ps = Math.max(1, Math.round(u * scale));
      this.drawSprite(crown, cx, by - 16 * ps + ps * 1, scale, false, alpha);
    }
    // Atordoado
    if (e.effects.stun > 0 && !e.dead) {
      const ps = Math.max(1, Math.round(u * scale));
      for (let i = 0; i < 3; i++) {
        const a = t * 5 + i * 2.1;
        ctx.fillStyle = '#ffe060';
        ctx.fillRect(Math.round(cx + Math.cos(a) * TS * 0.3 * scale), Math.round(by - 17 * ps + Math.sin(a) * u * 2), u * 2, u * 2);
      }
    }
    if (e.kind === 'enemy' && e.casting && !e.dead) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 20);
      ctx.fillStyle = '#ff3a3a';
      ctx.font = `700 ${Math.round(14 * this.dpr)}px 'Pixelify Sans'`;
      ctx.textAlign = 'center';
      ctx.fillText('!', cx, by - 18 * Math.max(1, Math.round(u * scale)));
      ctx.globalAlpha = 1;
    }
  },

  bar(cx, y, w, h, frac, col, back = 'rgba(10,6,14,0.85)') {
    const ctx = this.ctx, u = this.unit;
    const x = Math.round(cx - w / 2), Y = Math.round(y);
    ctx.fillStyle = back; ctx.fillRect(x - u * 0.5, Y - u * 0.5, w + u, h + u);
    ctx.fillStyle = col; ctx.fillRect(x, Y, Math.max(0, w * U.clamp(frac, 0, 1)), h);
  },

  drawHpBar(e) {
    const TS = this.TS, u = this.unit;
    const s = e.scale || 1;
    const ps = Math.max(1, Math.round(u * s));
    let top = (e.ry + 1) * TS - u - 18 * ps - u * 3;
    if (e.fly) top -= u * 5;
    if (e.lord) top -= 5 * ps;
    const w = TS * 0.75 * Math.sqrt(s);
    let col = '#e5484d';
    if (e.kind === 'minion') col = '#4dff8a';
    else if (e.boss) col = '#ff3a3a';
    else if (e.elite) col = '#ffb83a';
    this.bar((e.rx + 0.5) * TS, top, w, Math.max(2, u * 1.2), e.hp / e.maxHp, col);
    if (e.kind === 'minion') this.bar((e.rx + 0.5) * TS, top + u * 2, w, Math.max(1, u * 0.6), e.life / e.maxLife, '#a0a0b0');
  },

  drawRecruit(W, R) {
    if (R.kind === 'relic') { this.drawRelicVault(W, R); return; }
    const ctx = this.ctx, TS = this.TS, u = this.unit, t = this.time;
    const spr = R.kind === 'class'
      ? Sprites.get(CLASSES[R.id].sprite, Sprites.heroPal(R.id, 'human'))
      : Sprites.get(Sprites.speciesSprite(R.id), Sprites.speciesPal(R.id));
    const cx = (R.x + 0.5) * TS, by = (R.y + 1) * TS - u;
    if (R.freed) {
      const k = (W.t - R.freedT) / 1.2;
      if (k >= 1) return;
      this.drawSprite(spr, cx, by - k * TS * 0.8, 1, false, 1 - k);
      return;
    }
    // Brilho dourado
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.22 + 0.08 * Math.sin(t * 3);
    const gr = ctx.createRadialGradient(cx, by - TS * 0.5, 0, cx, by - TS * 0.5, TS * 1.2);
    gr.addColorStop(0, '#ffe680'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(cx - TS * 1.2, by - TS * 1.7, TS * 2.4, TS * 2.4);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    this.drawShadow(cx, by - u, 0.8);
    this.drawSprite(spr, cx, by, 1, Math.sin(t * 0.7) > 0);
    // Jaula
    ctx.fillStyle = '#4a4458';
    const top = by - TS * 1.15, h = TS * 1.15;
    for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(cx - TS * 0.48 + i * TS * 0.24), Math.round(top), u, Math.round(h));
    ctx.fillRect(Math.round(cx - TS * 0.5), Math.round(top), Math.round(TS), u * 1.5);
    ctx.fillRect(Math.round(cx - TS * 0.5), Math.round(by - u * 1.5), Math.round(TS), u * 1.5);
    // Balão "!"
    const bob = Math.sin(t * 4) * u * 1.5;
    ctx.fillStyle = '#ffd04a';
    ctx.font = `700 ${Math.round(16 * this.dpr * Math.max(1, this.zoom / 2))}px 'Pixelify Sans', sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3 * this.dpr; ctx.strokeStyle = '#1a1206';
    ctx.strokeText('!', cx, top - u * 2 + bob);
    ctx.fillText('!', cx, top - u * 2 + bob);
  },

  // Cofre Ancestral: a arma da classe flutuando sobre um pedestal
  drawRelicVault(W, R) {
    const ctx = this.ctx, TS = this.TS, u = this.unit, t = this.time;
    const it = Sprites.relicItem(R.id, 0);
    const spr = Sprites.get(it.sprite, Sprites.itemPal(it));
    const cx = (R.x + 0.5) * TS, by = (R.y + 1) * TS - u;
    if (R.freed) {
      const k = (W.t - R.freedT) / 1.2;
      if (k >= 1) return;
      this.drawSprite(spr, cx, by - TS * 0.35 - k * TS, 1.1, false, 1 - k);
      return;
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.3 + 0.12 * Math.sin(t * 2.5);
    const gr = ctx.createRadialGradient(cx, by - TS * 0.6, 0, cx, by - TS * 0.6, TS * 1.5);
    gr.addColorStop(0, '#ffd04a'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(cx - TS * 1.5, by - TS * 2.1, TS * 3, TS * 3);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // Pedestal
    ctx.fillStyle = '#3a3448'; ctx.fillRect(Math.round(cx - TS * 0.42), Math.round(by - TS * 0.32), Math.round(TS * 0.84), Math.round(TS * 0.32));
    ctx.fillStyle = '#5a5470'; ctx.fillRect(Math.round(cx - TS * 0.48), Math.round(by - TS * 0.38), Math.round(TS * 0.96), u * 2);
    ctx.fillStyle = '#ffd04a'; ctx.fillRect(Math.round(cx - TS * 0.3), Math.round(by - TS * 0.2), Math.round(TS * 0.6), u);
    this.drawSprite(spr, cx, by - TS * 0.4 + Math.sin(t * 2) * u * 2, 1.1, false);
    const bob = Math.sin(t * 4) * u * 1.5;
    ctx.fillStyle = '#ffd04a';
    ctx.font = `700 ${Math.round(16 * this.dpr * Math.max(1, this.zoom / 2))}px 'Pixelify Sans', sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3 * this.dpr; ctx.strokeStyle = '#1a1206';
    ctx.strokeText('⚔', cx, by - TS * 1.45 + bob);
    ctx.fillText('⚔', cx, by - TS * 1.45 + bob);
  },

  drawTorch(t) {
    const ctx = this.ctx, TS = this.TS, u = this.unit;
    const cx = (t.x + 0.5) * TS, y = (t.y + 0.55) * TS;
    ctx.fillStyle = '#4a3020'; ctx.fillRect(Math.round(cx - u), Math.round(y), u * 2, u * 5);
    const f = Math.sin(this.time * 12 + t.ph) * 0.5 + Math.sin(this.time * 19 + t.ph * 2) * 0.5;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath(); ctx.arc(cx, y - u * 1.5, u * (2.6 + f * 0.5), 0, 7); ctx.fill();
    ctx.fillStyle = '#ffd060';
    ctx.beginPath(); ctx.arc(cx, y - u * 1.2, u * (1.4 + f * 0.3), 0, 7); ctx.fill();
    ctx.globalAlpha = 0.18;
    const gr = ctx.createRadialGradient(cx, y, 0, cx, y, TS * 1.6);
    gr.addColorStop(0, '#ff9a3a'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(cx - TS * 1.6, y - TS * 1.6, TS * 3.2, TS * 3.2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },

  drawPortal(W) {
    const ctx = this.ctx, TS = this.TS, u = this.unit, t = this.time;
    const p = W.portal;
    const cx = (p.x + 0.5) * TS, cy = (p.y + 0.55) * TS;
    // Círculo rúnico no chão
    ctx.strokeStyle = p.active ? 'rgba(200,160,255,0.8)' : 'rgba(120,110,140,0.6)';
    ctx.lineWidth = u;
    ctx.beginPath(); ctx.ellipse(cx, cy + TS * 0.15, TS * 0.7, TS * 0.32, 0, 0, 7); ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + (p.active ? t * 0.8 : 0);
      ctx.fillStyle = p.active ? '#d9b8ff' : '#6a6478';
      ctx.fillRect(Math.round(cx + Math.cos(a) * TS * 0.7 - u), Math.round(cy + TS * 0.15 + Math.sin(a) * TS * 0.32 - u), u * 2, u * 2);
    }
    if (!p.active) return;
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(cx, cy - TS * 0.3, 0, cx, cy - TS * 0.3, TS * 1.4);
    gr.addColorStop(0, 'rgba(184,116,255,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr; ctx.fillRect(cx - TS * 1.5, cy - TS * 1.8, TS * 3, TS * 3);
    for (let i = 0; i < 4; i++) {
      const rr = (0.35 + i * 0.1) * TS * (1 + 0.05 * Math.sin(t * 3 + i));
      ctx.strokeStyle = i % 2 ? 'rgba(94,230,255,0.7)' : 'rgba(184,116,255,0.8)';
      ctx.lineWidth = u * 1.2;
      ctx.beginPath(); ctx.ellipse(cx, cy - TS * 0.3, rr * 0.7, rr * 1.1, 0, t * (i % 2 ? 2 : -2), t * (i % 2 ? 2 : -2) + 4.5); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (Math.random() < 0.3) World.part(W, p.x + 0.5 + U.rand(-0.3, 0.3), p.y + 0.6, 0, U.rand(-1.6, -0.6), Math.random() < 0.5 ? '#d9b8ff' : '#7ae8ff', 1, 1.5, 0);
  },

  drawProj(p) {
    const ctx = this.ctx, TS = this.TS, u = this.unit;
    const col = PROJ_COLORS[p.kind] || '#fff';
    const x = p.x * TS, y = p.y * TS;
    if (p.kind === 'arrow' || p.kind === 'bigarrow') {
      const L = (p.kind === 'bigarrow' ? 10 : 6) * u;
      const ca = Math.cos(p.ang), sa = Math.sin(p.ang);
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = u * (p.kind === 'bigarrow' ? 1.5 : 1);
      ctx.beginPath(); ctx.moveTo(x - ca * L, y - sa * L); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = col; ctx.fillRect(Math.round(x - u), Math.round(y - u), u * 2, u * 2);
      if (p.kind === 'bigarrow') {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4;
        ctx.strokeStyle = '#fff6c0'; ctx.lineWidth = u * 3;
        ctx.beginPath(); ctx.moveTo(x - ca * L * 1.5, y - sa * L * 1.5); ctx.lineTo(x, y); ctx.stroke();
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      return;
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < p.trail.length; i++) {
      const [tx, ty] = p.trail[i];
      ctx.globalAlpha = (i + 1) / p.trail.length * 0.4;
      ctx.fillStyle = col;
      const s = u * (1 + i / p.trail.length * 1.5) * p.size;
      ctx.beginPath(); ctx.arc(tx * TS, ty * TS, s, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const r = u * 2.2 * p.size;
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(x, y, r * 2, 0, 7); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  },

  drawFx(W, f) {
    const ctx = this.ctx, TS = this.TS, u = this.unit;
    const p = f.t / f.life;
    const x = f.x * TS, y = f.y * TS;
    switch (f.type) {
      case 'ring': {
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = f.color; ctx.lineWidth = u * 2 * (1 - p) + u * 0.5;
        ctx.beginPath(); ctx.arc(x, y, f.r * TS * (0.25 + 0.75 * Math.sqrt(p)), 0, 7); ctx.stroke();
        ctx.globalAlpha = (1 - p) * 0.15; ctx.fillStyle = f.color; ctx.fill();
        break;
      }
      case 'holy': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - p) * 0.8;
        const gr = ctx.createRadialGradient(x, y, 0, x, y, f.r * TS);
        gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, f.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, f.r * TS, 0, 7); ctx.fill();
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2 + p;
          ctx.fillStyle = '#fff6c0';
          ctx.fillRect(Math.round(x + Math.cos(a) * f.r * TS * p - u), Math.round(y + Math.sin(a) * f.r * TS * p - TS * 2 * (1 - p)), u * 2, TS * 2 * (1 - p));
        }
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'telegraph': {
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(x, y, f.r * TS, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.arc(x, y, f.r * TS * p, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.8; ctx.strokeStyle = f.color; ctx.lineWidth = u;
        ctx.beginPath(); ctx.arc(x, y, f.r * TS, 0, 7); ctx.stroke();
        break;
      }
      case 'cloud': {
        const a = p < 0.15 ? p / 0.15 : p > 0.8 ? (1 - p) / 0.2 : 1;
        for (let i = 0; i < 7; i++) {
          const ang = i / 7 * Math.PI * 2 + f.t * 0.6;
          const rr = f.r * TS * (i === 0 ? 0 : 0.55);
          ctx.globalAlpha = a * 0.22;
          ctx.fillStyle = i % 2 ? f.color : '#2a8a4a';
          ctx.beginPath(); ctx.arc(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.6, f.r * TS * 0.55, 0, 7); ctx.fill();
        }
        if (Math.random() < 0.3) World.part(W, f.x + U.rand(-f.r, f.r) * 0.7, f.y + U.rand(-f.r, f.r) * 0.5, 0, -0.5, '#7aff9a', 0.7, 2, 0);
        break;
      }
      case 'chain': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - p;
        for (let pass = 0; pass < 2; pass++) {
          ctx.strokeStyle = pass ? '#ffffff' : f.color;
          ctx.lineWidth = pass ? u * 0.8 : u * 2.5;
          ctx.beginPath();
          for (let i = 0; i < f.pts.length; i++) {
            const [px, py] = f.pts[i];
            if (i === 0) { ctx.moveTo(px * TS, py * TS); continue; }
            const [ax, ay] = f.pts[i - 1];
            for (let s = 1; s <= 4; s++) {
              const k = s / 4;
              const jx = s < 4 ? (Math.random() - 0.5) * TS * 0.35 : 0, jy = s < 4 ? (Math.random() - 0.5) * TS * 0.35 : 0;
              ctx.lineTo((ax + (px - ax) * k) * TS + jx, (ay + (py - ay) * k) * TS + jy);
            }
          }
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'slash': {
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = f.color; ctx.lineWidth = u * 1.5 * (1 - p) + u * 0.5;
        ctx.beginPath(); ctx.arc(x, y, TS * (0.3 + 0.2 * p), f.ang - 1 + p * 0.6, f.ang + 0.6 + p * 0.6); ctx.stroke();
        break;
      }
      case 'impact': {
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = f.color; ctx.lineWidth = u * 1.5;
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2;
          const r0 = TS * 0.15 + TS * 0.4 * p, r1 = r0 + TS * 0.25 * (1 - p);
          ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke();
        }
        break;
      }
      case 'meteor': {
        const k = Math.min(1, p / 0.93);
        const mx = x + (1 - k) * TS * 4, my = y - (1 - k) * TS * 7;
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 6; i++) {
          const kk = Math.max(0, k - i * 0.04);
          ctx.globalAlpha = 0.6 - i * 0.09;
          ctx.fillStyle = i < 2 ? '#fff2a0' : '#ff6a1a';
          ctx.beginPath(); ctx.arc(x + (1 - kk) * TS * 4, y - (1 - kk) * TS * 7, TS * (0.45 - i * 0.05), 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#5a2a1a'; ctx.beginPath(); ctx.arc(mx, my, TS * 0.28, 0, 7); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        break;
      }
      case 'rain': {
        ctx.strokeStyle = '#e8e0c8'; ctx.lineWidth = u;
        ctx.globalAlpha = p > 0.85 ? (1 - p) / 0.15 : 1;
        for (let i = 0; i < 14; i++) {
          const ph = ((f.t * 2.2 + i * 0.137) % 1);
          const ax = x + (U.hash2(i, 1, 3) - 0.5) * 2 * f.r * TS * 0.8;
          const ay = y + (U.hash2(i, 2, 3) - 0.5) * 2 * f.r * TS * 0.5;
          const yy = ay - (1 - ph) * TS * 3;
          ctx.beginPath(); ctx.moveTo(ax - u * 2, yy - u * 6); ctx.lineTo(ax, yy); ctx.stroke();
        }
        ctx.globalAlpha = 0.12; ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.ellipse(x, y, f.r * TS, f.r * TS * 0.6, 0, 0, 7); ctx.fill();
        break;
      }
    }
    ctx.globalAlpha = 1;
  },

  drawLight(W, ox, oy) {
    const lc = this.lightCanvas, g = lc.getContext('2d');
    const TS = this.TS, s = 0.25;
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, lc.width, lc.height);
    g.fillStyle = `rgba(0,0,0,${W.biome.dark})`;
    g.fillRect(0, 0, lc.width, lc.height);
    g.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a = 1) => {
      const X = (x * TS + ox) * s, Y = (y * TS + oy) * s, R = r * TS * s;
      if (X < -R || Y < -R || X > lc.width + R || Y > lc.height + R) return;
      const gr = g.createRadialGradient(X, Y, 0, X, Y, R);
      gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(0.55, `rgba(0,0,0,${a * 0.75})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(X - R, Y - R, R * 2, R * 2);
    };
    const h = W.hero;
    hole(h.rx + 0.5, h.ry + 0.5, 7.5);
    for (const t of W.torches) if (W.explored[t.y * W.w + t.x]) hole(t.x + 0.5, t.y + 0.6, 2.8 + Math.sin(this.time * 9 + t.ph) * 0.12, 0.9);
    if (W.portal.active) hole(W.portal.x + 0.5, W.portal.y + 0.3, 3.5, 0.9);
    for (const p of W.proj) if (p.kind !== 'arrow') hole(p.x, p.y, 1.6, 0.7);
    for (const f of W.fx) if (f.type === 'ring' || f.type === 'holy' || f.type === 'meteor') hole(f.x, f.y, (f.r || 1) + 1, 0.7 * (1 - f.t / f.life));
    for (const s2 of W.shrines) if (!s2.used && W.explored[s2.y * W.w + s2.x]) hole(s2.x + 0.5, s2.y + 0.3, 1.8, 0.6);
    if (W.biome.id === 'volcano') for (const d of W.decor) if (d.type === 'lava') hole(d.x + 0.5, d.y + 0.5, 1.4, 0.6);
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(lc, 0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, ox, oy);
  },

  drawMinimap(W) {
    const c = this.mini, g = this.mctx;
    const s = W.w > 50 ? 2 : 3;
    if (c.width !== W.w * s || c.height !== W.h * s) { c.width = W.w * s; c.height = W.h * s; c.style.width = (W.w * s) + 'px'; c.style.height = (W.h * s) + 'px'; }
    g.fillStyle = '#07050b'; g.fillRect(0, 0, c.width, c.height);
    const fl = U.shade(W.biome.pal.floor, 0.15), wl = U.shade(W.biome.pal.wallTop, 0.1);
    for (let y = 0; y < W.h; y++) for (let x = 0; x < W.w; x++) {
      const i = y * W.w + x;
      if (!W.explored[i]) continue;
      g.fillStyle = W.tiles[i] ? (W.vis[i] ? U.shade(fl, 0.25) : fl) : wl;
      g.fillRect(x * s, y * s, s, s);
    }
    const dot = (x, y, col, r = s) => { g.fillStyle = col; g.fillRect(x * s - (r - s) / 2, y * s - (r - s) / 2, r, r); };
    for (const ch of W.chests) if (!ch.opened && W.explored[ch.y * W.w + ch.x]) dot(ch.x, ch.y, CHEST_TIERS[ch.tier].pal.g, s + 1);
    for (const sh of W.shrines) if (!sh.used && W.explored[sh.y * W.w + sh.x]) dot(sh.x, sh.y, SHRINES[sh.type].color, s + 1);
    if (W.explored[W.portal.y * W.w + W.portal.x] || W.portal.active) dot(W.portal.x, W.portal.y, W.portal.active ? '#d9b8ff' : '#6a6478', s + 2);
    if (W.recruit && !W.recruit.freed && W.explored[W.recruit.y * W.w + W.recruit.x]) dot(W.recruit.x, W.recruit.y, '#ffe680', s + 2);
    for (const e of W.ents) {
      if (e.dead || e.kind === 'hero') continue;
      if (e.kind === 'minion') { dot(e.x, e.y, '#4dff8a'); continue; }
      if (e.hidden) continue;
      if (W.vis[e.y * W.w + e.x] || (e.boss && W.explored[e.y * W.w + e.x])) dot(e.x, e.y, e.boss ? '#ff3a3a' : e.elite ? '#ffb83a' : '#e5484d', e.boss ? s + 2 : s);
    }
    const h = W.hero;
    if (Math.floor(this.time * 3) % 2 === 0 || h.dead) dot(h.x, h.y, '#ffffff', s + 2);
  },
};
