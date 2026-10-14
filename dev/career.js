// Simula uma "carreira" com várias jornadas: ascende quando o progresso trava (ou no Fim de Jogo),
// compra melhorias do Altar, desperta Armas Ancestrais e registra quando cada coisa é desbloqueada.
// Uso: node dev/career.js <horas> [classe inicial] [corações=1] [relatório a cada N horas=0]
// Variável SCALE="item,vidaInimigo,danoInimigo[,almas]" (ex.: 1.17,1.25,1.24,1.04) testa outra escala sem editar o jogo.
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
global.UI = new Proxy({}, { get: () => noop });
global.Render = { cam: {}, mapCanvas: null };

let code = '';
for (const f of ['util', 'data', 'heroes', 'sprites', 'audio', 'music', 'items', 'stats', 'mapgen', 'world', 'game']) code += fs.readFileSync(ROOT + f + '.js', 'utf8').replace(/^'use strict';/, '') + '\n';
code += '\nObject.assign(global,{U,Game,World,Stats,Items,TRAINING,SOUL_UPGRADES,CLASSES,SPECIES,CLASS_ORDER,SPECIES_ORDER,HERO_RARITY,RELICS,RARITIES,RELIC_RNAME,SCALE});';
(0, eval)(code);
if (process.env.SCALE) { const [a, b, c, d] = process.env.SCALE.split(',').map(Number); Object.assign(SCALE, { item: a, ehp: b, eatk: c }, d ? { soul: d } : {}); }

const hours = +(process.argv[2] || 10);
const startCls = process.argv[3] || 'fighter';
const hardcore = (process.argv[4] || '1') === '1';
const reportEvery = +(process.argv[5] || 0);
Game.newGame(startCls, 'human', 'Sim', hardcore);
Game.enterZone(1, true);
const DT = 1 / 30;
let t = 0, buyT = 0, bestT = 0, runStart = 0, nextReport = reportEvery * 3600;
const events = [];
const fmtT = s => `${Math.floor(s / 3600)}h${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}`;
const known = new Set([...Game.state.unlocks.classes.map(c => 'c:' + c), ...Game.state.unlocks.species.map(c => 's:' + c)]);
const relicsSeen = {};
let lastBest = 1;

function buyStuff() {
  const st = Game.state;
  for (let k = 0; k < 300; k++) {
    let best = null, bc = Infinity;
    for (const tr of TRAINING) { const r = st.training[tr.id] || 0; if (tr.max && r >= tr.max) continue; const c = Stats.trainCost(tr, r); if (c < bc) { bc = c; best = tr; } }
    if (!best || st.gold < bc) break;
    Game.buyTraining(best.id, false);
  }
  for (const s of ['weapon', 'chest', 'helm']) { const it = st.equip[s]; if (it && it.plus < 8 && st.gold > Items.forgeCost(it) * 3) Game.forge(it); }
  for (let k = 0; k < 100; k++) {
    let best = null, bc = Infinity;
    for (const u of SOUL_UPGRADES) { const r = st.soulUpg[u.id] || 0; if (u.max && r >= u.max) continue; const c = Stats.soulCost(u, r); if (c < bc) { bc = c; best = u; } }
    if (!best || st.souls < bc) break;
    Game.buySoul(best.id);
  }
  for (const c of Object.keys(st.relics)) while (!Game.relicBlock(c)) Game.awakenRelic(c);
}
// Escolhe a classe/espécie desbloqueada mais rara para a próxima jornada
function pickBest(kind) {
  const st = Game.state;
  const list = kind === 'class' ? st.unlocks.classes : st.unlocks.species;
  const defs = kind === 'class' ? CLASSES : SPECIES;
  return list.slice().sort((a, b) => defs[b].rarity - defs[a].rarity)[0];
}
// Multiclasse/mestiçagem com a melhor opção dominada
function tryHybrid() {
  const st = Game.state;
  if (!st.cls2) { const c = CLASS_ORDER.filter(id => Game.canMulticlass(id)).sort((a, b) => CLASSES[b].rarity - CLASSES[a].rarity)[0]; if (c) { Game.setMulticlass(c); events.push(`${fmtT(t)}  MULTICLASSE ${Game.className()}`); } }
  if (!st.species2) { const s = SPECIES_ORDER.filter(id => Game.canMultiSpecies(id)).sort((a, b) => SPECIES[b].rarity - SPECIES[a].rarity)[0]; if (s) { Game.setMultiSpecies(s); events.push(`${fmtT(t)}  MESTIÇAGEM ${Game.speciesName()}`); } }
}

while (t < hours * 3600) {
  World.update(Game.W, DT);
  t += DT;
  if (Game.transition) { const tr = Game.transition; Game.transition = null; tr.fn(); }
  const st = Game.state;
  for (const c of st.unlocks.classes) if (!known.has('c:' + c)) { known.add('c:' + c); events.push(`${fmtT(t)}  classe ${CLASSES[c].name} (${HERO_RARITY[CLASSES[c].rarity].name}) · asc ${st.stats.ascensions}`); }
  for (const c of st.unlocks.species) if (!known.has('s:' + c)) { known.add('s:' + c); events.push(`${fmtT(t)}  espécie ${SPECIES[c].name} (${HERO_RARITY[SPECIES[c].rarity].name}) · asc ${st.stats.ascensions}`); }
  for (const c in st.relics) if (relicsSeen[c] !== st.relics[c].r) { relicsSeen[c] = st.relics[c].r; events.push(`${fmtT(t)}  arma ancestral ${RELICS[c].name} → ${RELIC_RNAME[st.relics[c].r]}`); }
  if (st.maxZone > lastBest) { lastBest = st.maxZone; bestT = t; }
  buyT += DT;
  if (buyT > 20) { buyT = 0; buyStuff(); Game.checkUnlocks(); Game.checkAchievements(); tryHybrid(); }
  if (reportEvery && t >= nextReport) { nextReport += reportEvery * 3600; events.push(`${fmtT(t)}  -- recorde geral ${st.stats.maxZone}, jornada atual zona ${st.zone} nível ${st.level}, almas ${U.fmt(st.souls)}, fragmentos ${Math.floor(st.shards)}`); }
  // Ascende após 25 min sem recorde (ou no Fim de Jogo)
  if (st.pendingEnd || (st.maxZone >= 15 && t - bestT > 25 * 60)) {
    const cls = pickBest('class'), sp = pickBest('species');
    events.push(`${fmtT(t)}  ${st.pendingEnd ? 'FIM DE JOGO' : 'ascensão'} na zona ${st.maxZone} (${Game.className()} ${Game.speciesName()}, nível ${st.level}, jornada de ${fmtT(t - runStart)}, +${U.fmt(st.pendingEnd ? st.pendingEnd.gain : Stats.soulsOnAscend(st))} almas) → ${CLASSES[cls].name} ${SPECIES[sp].name}`);
    if (st.pendingEnd) Game.finishGameOver(cls, sp, hardcore); else Game.ascend(cls, sp, hardcore);
    events[events.length - 1] += ` (recomeça na zona ${Game.state.zone}, nível ${Game.state.level})`;
    tryHybrid();
    lastBest = Game.state.maxZone; bestT = t; runStart = t;
  }
}
const st = Game.state;
console.log(events.join('\n'));
console.log(`\nApós ${hours}h: ${st.unlocks.classes.length}/${CLASS_ORDER.length} classes, ${st.unlocks.species.length}/${SPECIES_ORDER.length} espécies, ${st.stats.ascensions} ascensões, recorde zona ${st.stats.maxZone}, almas ${U.fmt(st.souls)}, fragmentos ${Math.floor(st.shards)}, armas ${Object.keys(st.relics).length}`);
