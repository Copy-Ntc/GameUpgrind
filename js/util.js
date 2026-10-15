'use strict';
const U = {
  rand(a, b) { return a + Math.random() * (b - a); },
  randi(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  chance(p) { return Math.random() < p; },
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); },
  shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  },
  weighted(items, wfn) {
    let total = 0;
    for (const it of items) total += Math.max(0, wfn ? wfn(it) : it.w);
    if (total <= 0) return items[0];
    let r = Math.random() * total;
    for (const it of items) {
      r -= Math.max(0, wfn ? wfn(it) : it.w);
      if (r <= 0) return it;
    }
    return items[items.length - 1];
  },
  uid() { return Math.random().toString(36).slice(2, 9) + (U._uidc = (U._uidc || 0) + 1).toString(36); },
  hash2(x, y, s = 0) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  },

  SUFFIX: ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'Ud', 'Dd', 'Td'],
  fmt(n) {
    if (n === undefined || n === null || isNaN(n)) return '0';
    if (!isFinite(n)) return '∞';
    const neg = n < 0; n = Math.abs(n);
    let s;
    if (n < 1000) {
      s = (n < 10 && n % 1 !== 0) ? (Math.round(n * 10) / 10).toString() : Math.floor(n).toString();
    } else {
      const i = Math.floor(Math.log10(n) / 3);
      if (i >= U.SUFFIX.length) s = n.toExponential(2).replace('+', '');
      else {
        const v = n / Math.pow(1000, i);
        s = (v < 10 ? (Math.floor(v * 100) / 100).toFixed(2) : v < 100 ? (Math.floor(v * 10) / 10).toFixed(1) : Math.floor(v)) + U.SUFFIX[i];
      }
    }
    return (neg ? '-' : '') + s;
  },
  fmtInt(n) { return Math.floor(n).toLocaleString('pt-BR'); },
  fmtPct(v, d = 1) {
    const r = Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
    return r.toLocaleString('pt-BR', { maximumFractionDigits: d }) + '%';
  },
  fmtNum(v, d = 1) {
    const r = Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
    return r.toLocaleString('pt-BR', { maximumFractionDigits: d });
  },
  fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
    if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
    return `${s}s`;
  },
  clock() {
    const d = new Date();
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  },
  esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  cleanName(s, max = 16) {
    return String(s == null ? '' : s).replace(/[<>"&`\\\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '').trim().slice(0, max);
  },
  cleanData(v, depth = 0, budget = { n: 0 }) {
    if (++budget.n > 400000 || depth > 24) throw new Error('dados grandes demais');
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'string') return v.length > 2000 ? '' : v.replace(/[<>"&`\\]/g, '');
    if (Array.isArray(v)) return v.map(x => U.cleanData(x, depth + 1, budget));
    if (typeof v === 'object') {
      const o = {};
      for (const k of Object.keys(v)) {
        if (k === '__proto__' || k === 'constructor' || k === 'prototype' || k.length > 64 || /[<>"&`\\'\s]/.test(k)) continue;
        o[k] = U.cleanData(v[k], depth + 1, budget);
      }
      return o;
    }
    return null;
  },
  $(sel) { return document.querySelector(sel); },
  mix(c1, c2, t) {
    const a = U.hexRgb(c1), b = U.hexRgb(c2);
    return U.rgbHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  },
  hexRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  },
  rgbHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.round(U.clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
  },
  shade(c, amt) { return amt >= 0 ? U.mix(c, '#ffffff', amt) : U.mix(c, '#000000', -amt); },
  rgba(c, a) { const [r, g, b] = U.hexRgb(c); return `rgba(${r},${g},${b},${a})`; },
};

const SCALE = { item: 1.175, ehp: 1.25, eatk: 1.24, soul: 1.05 };
function zoneScale(z) { return Math.pow(SCALE.item, z - 1); }
function enemyScale(z) { return Math.pow(SCALE.ehp, z - 1); }
function enemyAtkScale(z) { return Math.pow(SCALE.eatk, z - 1); }
function enemyPowScale(z) { return Math.sqrt(enemyScale(z) * enemyAtkScale(z)); }
