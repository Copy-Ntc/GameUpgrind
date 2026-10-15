// Simulador headless do Upgrind: roda a lógica do jogo sem navegador para testar bugs e balanceamento.
// Uso: node dev/sim.js <classe> <minutos> [compra=1] [espécie]
//   classe: knight | mage | ranger | rogue | necro
//   compra=1 simula um jogador que compra treinos e forja a cada 20s
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'js') + path.sep;

const noop = () => {};
const ctxStub = new Proxy({}, { get: (t, k) => k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : noop });
global.document = { createElement: () => ({ getContext: () => ctxStub, width: 0, height: 0, toDataURL: () => '' }), getElementById: () => null, addEventListener: noop, hidden: false };
global.window = { addEventListener: noop };
global.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = noop;

const logs = [];
global.UI = new Proxy({ addLog: (h, c) => logs.push(h) }, { get: (t, k) => t[k] || noop });
global.Render = { cam: {}, mapCanvas: null };

let code = '';
for (const f of ['util', 'data', 'heroes', 'sprites', 'audio', 'music', 'items', 'stats', 'mapgen', 'world', 'game', 'online-config', 'online']) code += fs.readFileSync(ROOT + f + '.js', 'utf8').replace(/^'use strict';/, '') + '\n';
code += '\nglobal.U=U;global.Game=Game;global.World=World;global.Stats=Stats;global.Items=Items;global.TRAINING=TRAINING;global.CLASSES=CLASSES;global.zoneScale=zoneScale;global.enemyScale=enemyScale;global.enemyAtkScale=enemyAtkScale;global.SKILLS=SKILLS;global.SPECIES=SPECIES;global.CLASS_ORDER=CLASS_ORDER;global.SCALE=SCALE;';
(0, eval)(code);
if (process.env.SCALE) { const [a, b, c, d] = process.env.SCALE.split(',').map(Number); Object.assign(SCALE, { item: a, ehp: b, eatk: c }, d ? { soul: d } : {}); }

const cls = process.argv[2] || 'knight';
const minutes = +(process.argv[3] || 30);
const buy = (process.argv[4] || '1') === '1';
const species = process.argv[5] || 'human';

Game.newGame(cls, species, 'Sim', false); // sem corações: mede até onde uma jornada chega
Game.enterZone(1, true);
const st = Game.state;
const DT = 1 / 30;
let t = 0, lastZone = 1, zoneStart = 0, buyT = 0;
const rows = [];
let lastDeaths = 0;
let errors = 0; let stuckReports = 0;
const t0 = Date.now();
while (t < minutes * 60) {
  try { World.update(Game.W, DT); } catch (e) { errors++; if (errors < 5) console.error('ERRO', e.stack); }
  t += DT;
  if (Game.transition) { const tr = Game.transition; Game.transition = null; tr.fn(); }
  if (st.zone !== lastZone) {
    rows.push({ z: lastZone, t: Math.round(t - zoneStart), lvl: st.level, gold: U.fmt(st.gold), pow: U.fmt(Game.power), deaths: st.stats.deaths - lastDeaths, hp: U.fmt(Game.stats.maxHp), atk: U.fmt(Game.stats.atk), eatk: U.fmt(16*enemyAtkScale(lastZone)), ehp: U.fmt(40*enemyScale(lastZone)) });
    lastDeaths = st.stats.deaths;
    lastZone = st.zone; zoneStart = t;
  }
  // detector de travamento
  const H = Game.W.hero;
  const key = H.x + ',' + H.y + ',' + Game.W.killed + ',' + st.stats.chests;
  if (key === global._lk) { global._still = (global._still || 0) + DT; } else { global._lk = key; global._still = 0; }
  if (global._still > 40 && !H.dead) {
    const W = Game.W; global._still = -1e9; stuckReports++;
    console.log('TRAVADO z=' + W.z + ' t=' + W.t.toFixed(0) + ' status=' + H.status + ' pos=' + H.x + ',' + H.y + ' explorado=' + (World.exploredPct(W)*100).toFixed(0) + '% boss=' + (W.boss && !W.boss.dead ? W.boss.x+','+W.boss.y+' aggro='+W.boss.aggro : 'morto') + ' portal=' + W.portal.active);
    let out = '';
    for (let y = Math.max(0,H.y-8); y < Math.min(W.h,H.y+9); y++) { for (let x = Math.max(0,H.x-16); x < Math.min(W.w,H.x+17); x++) { const i=y*W.w+x; const e=W.ents.find(e=>!e.dead&&e.x===x&&e.y===y); let ch = W.tiles[i]? (W.explored[i]?'.':',') : '#'; if (W.occ[i]===-1) ch='C'; if (e) ch = e.kind==='hero'?'@':e.kind==='minion'?'m':e.boss?'B':'e'; if (W.portal.x===x&&W.portal.y===y) ch='P'; out+=ch; } out+=String.fromCharCode(10); }
    console.log(out);
  }
  buyT += DT;
  if (buy && buyT > 20) {
    buyT = 0;
    // jogador ativo: compra o treino mais barato até acabar o ouro
    for (let k = 0; k < 200; k++) {
      let best = null, bc = Infinity;
      for (const tr of TRAINING) {
        const r = st.training[tr.id] || 0;
        if (tr.max && r >= tr.max) continue;
        const c = Stats.trainCost(tr, r);
        if (c < bc) { bc = c; best = tr; }
      }
      if (!best || st.gold < bc) break;
      Game.buyTraining(best.id, false);
    }
    // forja barata
    for (const s of ['weapon', 'chest', 'helm']) { const it = st.equip[s]; if (it && it.plus < 5 && st.gold > Items.forgeCost(it) * 3) Game.forge(it); }
  }
}
const W = Game.W;
console.log(`classe=${cls} espécie=${species} desbloqueios=${Game.state.unlocks.classes.length}c/${Game.state.unlocks.species.length}e tempo=${minutes}min real=${((Date.now() - t0) / 1000).toFixed(1)}s erros=${errors} travamentos=${stuckReports}`);
console.table(rows);
console.log(`Final: zona ${st.zone} (max ${st.maxZone}) nível ${st.level} kills ${st.stats.kills} baús ${st.stats.chests} mortes ${st.stats.deaths} itens ${st.stats.itemsFound} lend ${st.stats.legendaries} inv ${st.inv.length}`);
console.log(`Zona atual: t=${W.t.toFixed(0)}s killed ${W.killed}/${W.total} explorado ${(World.exploredPct(W) * 100).toFixed(0)}% status="${W.hero.status}" stuck=${W.stuckT.toFixed(1)}`);
console.log('Equip:', Object.values(st.equip).filter(Boolean).map(i => `${i.name}[${i.rarity}]+${i.plus}`).join(' | '));
console.log('Treino:', JSON.stringify(st.training), 'Talentos:', JSON.stringify(st.talents));
