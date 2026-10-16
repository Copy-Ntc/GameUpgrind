'use strict';

const RARITIES = [
  { id: 0, name: 'Comum', color: '#c9c3b8', mult: 1.0, affixes: 0, weight: 640, sell: 1 },
  { id: 1, name: 'Incomum', color: '#5fd068', mult: 1.22, affixes: 1, weight: 260, sell: 2 },
  { id: 2, name: 'Raro', color: '#4fa3ff', mult: 1.5, affixes: 2, weight: 70, sell: 5 },
  { id: 3, name: 'Épico', color: '#b874ff', mult: 1.85, affixes: 3, weight: 12, sell: 12 },
  { id: 4, name: 'Lendário', color: '#ff9a2e', mult: 2.35, affixes: 4, weight: 0.8, sell: 30, minZone: 4 },
  { id: 5, name: 'Mítico', color: '#ff4d6d', mult: 3.1, affixes: 5, weight: 0.08, sell: 80, minZone: 12 },
  { id: 6, name: 'Celestial', color: '#7af0ff', mult: 4.1, affixes: 6, weight: 0.006, sell: 220, minZone: 150 },
  { id: 7, name: 'Exclusivo', color: '#ff7ae0', mult: 4.8, affixes: 0, weight: 0, sell: 300, excl: true },
];
const RARITY_ADJ = [
  ['Comum', 'Comum'], ['Incomum', 'Incomum'], ['Raro', 'Rara'], ['Épico', 'Épica'], ['Lendário', 'Lendária'], ['Mítico', 'Mítica'],
  ['Celestial', 'Celestial'], ['Exclusivo', 'Exclusiva'],
];

const MATERIALS = {
  metal: { names: ['Bronze', 'Ferro', 'Aço', 'Mithril', 'Adamantita', 'Oricalco', 'Obsidiana', 'Astralita'],
    colors: ['#c98a4a', '#9aa3ad', '#d5dde6', '#8fe3ff', '#7dffb4', '#ffd35a', '#8a6ab0', '#ff8af0'] },
  wood: { names: ['Pinho', 'Carvalho', 'Teixo', 'Freixo', 'Ébano', 'Pau-Brasil', 'Sândalo Rúnico', 'Árvore-Mundo'],
    colors: ['#c9a06a', '#a8764a', '#8a5a3a', '#d8c08a', '#4a3a4a', '#c8462a', '#7a4ab0', '#5affc8'] },
  cloth: { names: ['Linho', 'Lã', 'Seda', 'Seda Élfica', 'Tecido Rúnico', 'Seda Lunar', 'Tecido Sombrio', 'Fio Astral'],
    colors: ['#d8ccb0', '#a89070', '#e0d8f0', '#7ad8a0', '#6a8ad8', '#c8d8ff', '#5a3a7a', '#ff9af0'] },
  leather: { names: ['Couro Cru', 'Couro', 'Couro Fervido', 'Pele de Wyvern', 'Pele de Basilisco', 'Pele de Dragão', 'Pele Demoníaca', 'Pele Astral'],
    colors: ['#a07a50', '#8a5a34', '#6a4024', '#5a8a5a', '#8a8a3a', '#b83a2a', '#6a1a3a', '#c86aff'] },
  jewel: { names: ['Cobre', 'Prata', 'Ouro', 'Platina', 'Rubi', 'Safira', 'Diamante', 'Astralita'],
    colors: ['#d07a40', '#d8e0ea', '#ffd04a', '#e8f0f8', '#ff3a5a', '#3a7aff', '#c8ffff', '#ff8af0'] },
};

const SLOTS = ['weapon', 'helm', 'chest', 'gloves', 'boots', 'ring', 'amulet'];
const SLOT_NAMES = { weapon: 'Arma', helm: 'Cabeça', chest: 'Peito', gloves: 'Mãos', boots: 'Pés', ring: 'Anel', amulet: 'Amuleto', offhand: 'Secundária' };
const EQUIP_SLOTS = [...SLOTS, 'offhand'];
const SLOT_WEIGHTS = { weapon: 20, helm: 14, chest: 14, gloves: 13, boots: 13, ring: 13, amulet: 13 };

const SLOT_MAIN = {
  weapon: { atk: 6 },
  helm: { def: 2.2, hp: 10 },
  chest: { def: 4.5, hp: 18 },
  gloves: { atk: 1.6, def: 1.2 },
  boots: { def: 1.8, hp: 7 },
  ring: { atk: 2.4 },
  amulet: { hp: 9, atk: 1.3 },
};

const STAT_INFO = {
  atk: { name: 'Dano', pct: false },
  hp: { name: 'Vida', pct: false },
  def: { name: 'Armadura', pct: false },
  regen: { name: 'Regeneração', pct: false, suf: '/s' },
  atkSpd: { name: 'Vel. de Ataque', pct: true },
  crit: { name: 'Chance Crítica', pct: true },
  critDmg: { name: 'Dano Crítico', pct: true },
  dodge: { name: 'Esquiva', pct: true },
  block: { name: 'Bloqueio', pct: true },
  lifesteal: { name: 'Roubo de Vida', pct: true },
  moveSpd: { name: 'Vel. de Movimento', pct: true },
  goldPct: { name: 'Ouro Extra', pct: true },
  xpPct: { name: 'Experiência Extra', pct: true },
  mf: { name: 'Sorte', pct: true },
  cdr: { name: 'Redução de Recarga', pct: true },
  dmgPct: { name: 'Dano Total', pct: true },
  hpPct: { name: 'Vida Total', pct: true },
  defPct: { name: 'Armadura Total', pct: true },
  bossDmg: { name: 'Dano a Chefes e Elites', pct: true },
  minion: { name: 'Poder dos Lacaios', pct: true },
  potionPct: { name: 'Cura de Poções', pct: true },
};

const AFFIXES = [
  { k: 'atk', flat: true, min: 1.0, max: 2.2, adj: ['Afiado', 'Afiada', 'Afiados', 'Afiadas'], w: 12 },
  { k: 'hp', flat: true, min: 5, max: 12, adj: ['Robusto', 'Robusta', 'Robustos', 'Robustas'], w: 12 },
  { k: 'def', flat: true, min: 1.0, max: 2.6, adj: ['Reforçado', 'Reforçada', 'Reforçados', 'Reforçadas'], w: 10 },
  { k: 'regen', flat: true, min: 0.25, max: 0.7, adj: ['Revigorante', 'Revigorante', 'Revigorantes', 'Revigorantes'], w: 6 },
  { k: 'atkSpd', min: 3, max: 8, adj: ['Veloz', 'Veloz', 'Velozes', 'Velozes'], w: 8 },
  { k: 'crit', min: 1.5, max: 4, adj: ['Preciso', 'Precisa', 'Precisos', 'Precisas'], w: 8 },
  { k: 'critDmg', min: 8, max: 25, adj: ['Cruel', 'Cruel', 'Cruéis', 'Cruéis'], w: 8 },
  { k: 'dodge', min: 1.5, max: 4, adj: ['Ágil', 'Ágil', 'Ágeis', 'Ágeis'], w: 6 },
  { k: 'lifesteal', min: 0.8, max: 2.5, adj: ['Vampírico', 'Vampírica', 'Vampíricos', 'Vampíricas'], w: 6 },
  { k: 'moveSpd', min: 3, max: 8, adj: ['Alado', 'Alada', 'Alados', 'Aladas'], w: 5, slots: ['boots', 'amulet', 'chest', 'ring'] },
  { k: 'goldPct', min: 6, max: 20, adj: ['Dourado', 'Dourada', 'Dourados', 'Douradas'], w: 7 },
  { k: 'xpPct', min: 5, max: 15, adj: ['Sábio', 'Sábia', 'Sábios', 'Sábias'], w: 7 },
  { k: 'mf', min: 4, max: 12, adj: ['Afortunado', 'Afortunada', 'Afortunados', 'Afortunadas'], w: 6 },
  { k: 'cdr', min: 2, max: 5, adj: ['Arcano', 'Arcana', 'Arcanos', 'Arcanas'], w: 5 },
  { k: 'dmgPct', min: 4, max: 12, adj: ['Brutal', 'Brutal', 'Brutais', 'Brutais'], w: 8 },
  { k: 'hpPct', min: 4, max: 10, adj: ['Vigoroso', 'Vigorosa', 'Vigorosos', 'Vigorosas'], w: 7 },
  { k: 'bossDmg', min: 8, max: 22, adj: ['Implacável', 'Implacável', 'Implacáveis', 'Implacáveis'], w: 5 },
  { k: 'minion', min: 8, max: 20, adj: ['Profano', 'Profana', 'Profanos', 'Profanas'], w: 7, cls: ['necro'] },
  { k: 'block', min: 2, max: 5, adj: ['Defensor', 'Defensora', 'Defensores', 'Defensoras'], w: 6, cls: ['knight'] },
];

const POWERS = {
  thunder: { name: 'Fúria da Tempestade', desc: '12% de chance ao acertar de invocar um raio que causa 150% de dano em até 3 inimigos.' },
  vampire: { name: 'Sede de Sangue', desc: 'Abates restauram 4% da Vida máxima.' },
  executioner: { name: 'Executor', desc: '+50% de dano contra inimigos abaixo de 30% de Vida.' },
  slayer: { name: 'Matador de Titãs', desc: '+40% de dano contra Chefes e Elites.' },
  midas: { name: 'Toque de Midas', desc: '+40% de Ouro. Inimigos derrotados explodem em moedas.' },
  phoenix: { name: 'Chama da Fênix', desc: 'Uma vez por zona, renasce com 50% de Vida ao ser derrotado.' },
  frost: { name: 'Toque Glacial', desc: 'Ataques têm 15% de chance de congelar o alvo por 1,2s.' },
  echo: { name: 'Eco Arcano', desc: 'Habilidades têm 20% de chance de não entrar em recarga.' },
  berserk: { name: 'Fúria Berserker', desc: 'Até +60% de dano conforme sua Vida diminui.' },
  thorns: { name: 'Espinhos', desc: 'Reflete 35% do dano recebido ao atacante.' },
  greed: { name: 'Ganância do Dragão', desc: '+25% de Sorte e baús concedem o dobro de ouro.' },
  swift: { name: 'Passos do Vento', desc: '+20% de Vel. de Movimento e +10% de Vel. de Ataque.' },
  dagon: { name: 'Chama de Dagon', desc: 'Todo golpe incendeia o alvo (40% do Dano por segundo, 3s). Críticos explodem em chamas, causando 100% do Dano aos inimigos próximos.', excl: true },
  spike: { name: 'Terra Partida', desc: 'A cada 4 ataques, golpeia o chão: 220% do Dano em área, atordoa por 0,6s e deixa as rachaduras em chamas (50% do Dano por segundo, 3s).', excl: true },
  bluefire: { name: 'Fogo Azul Sagrado', desc: 'Chamas azuis giram ao seu redor e queimam quem se aproxima: 45% do Dano a cada 0,6s num raio de 2,5.', excl: true },
};

const RAINBOW_ZONE = 40;
const RAINBOW_CHANCE = 0.012;
const EXCL_CHANCE = 0.12;
const EXCLUSIVES = {
  dagon: {
    name: 'Dagon', bname: 'Adaga', g: 'f', slot: 'weapon', sprite: 'i_dagon', by: 'PIRADO DA CABEÇA',
    pal: { m: '#ff7a2a', d: '#b8360e', l: '#ffe08a', h: '#3a1a10', g: '#ffd04a', r: '#ff2a5a', w: '#fff6d0', k: '#1b1424', y: '#ffd04a' },
    bmult: 1.0, main: { atkSpd: 20 }, affixes: { crit: 12, critDmg: 50, dmgPct: 35, atkSpd: 15 }, powers: ['dagon'],
    lore: 'Forjada no coração de um vulcão, nunca para de queimar.',
  },
  spike: {
    name: 'Espinho Pesado', bname: 'Martelão', g: 'm', slot: 'weapon', sprite: 'i_spike', by: 'superpenis',
    pal: { m: '#5a9ad8', d: '#2a4a7a', l: '#bfe4ff', h: '#2a2a35', g: '#9aa3ad', r: '#ff5a2a', w: '#ffffff', k: '#6a6a7a', y: '#ffd04a' },
    bmult: 1.5, main: { atkSpd: -20 }, affixes: { dmgPct: 45, hpPct: 25, bossDmg: 40, critDmg: 30 }, powers: ['spike'],
    lore: 'Pesado demais para qualquer um, menos para quem já perdeu o medo.',
  },
  jesus: {
    name: 'JesusSalva', bname: 'Cruz', g: 'f', slot: 'offhand', sprite: 'i_jesus', by: 'Wendeu Delicia',
    pal: { m: '#f2c25b', d: '#a8701a', l: '#fff2b0', r: '#5ac8ff', f: '#3a8aff', c: '#bff4ff', w: '#ffffff' },
    main: { hp: 14, def: 3.5 }, affixes: { hpPct: 25, dr: 10, regenPct: 0.5, dmgPct: 20 }, powers: ['bluefire'],
    lore: 'Arma secundária: queima com fogo azul quem ousa chegar perto.',
  },
};

const LEGEND_NAMES = {
  weapon: ['Fúria do Dragão', 'Lamento Eterno', 'Aurora Sangrenta', 'Juramento do Rei', 'Presa do Leviatã', 'Sussurro da Morte', 'Chama Primordial', 'Quebra-Mundos', 'Canção do Crepúsculo', 'Ruína dos Titãs'],
  helm: ['Coroa do Rei Caído', 'Visão do Oráculo', 'Elmo do Titã', 'Olhar da Medusa', 'Mente do Arquimago'],
  chest: ['Égide Imortal', 'Manto da Noite Eterna', 'Couraça do Colosso', 'Pele do Wyrm', 'Abraço da Fênix'],
  gloves: ['Mãos do Destino', 'Garras do Grifo', 'Toque do Lich', 'Punhos da Tempestade'],
  boots: ['Passos de Hermes', 'Botas de Sete Léguas', 'Trilha do Fantasma', 'Andarilho do Vento'],
  ring: ['Anel do Eclipse', 'Elo Infinito', 'Olho de Tigre', 'Selo de Salomão', 'Anel dos Nibelungos'],
  amulet: ['Coração da Montanha', 'Lágrima de Estrela', 'Amuleto de Anúbis', 'Relicário Sagrado', 'Olho de Hórus'],
};
const EXCL_RARITY = 7;
const CELESTIAL_NAMES = ['Aurora Eterna', 'Firmamento', 'Coroa das Estrelas', 'Lança do Zênite', 'Véu Celeste', 'Juízo Astral', 'Luz Primordial', 'Canto das Esferas', 'Asa do Serafim', 'Horizonte Infinito', 'Brilho do Éter', 'Nova Ardente'];
const MYTHIC_NAMES = ['Ira dos Deuses', 'Fim dos Tempos', 'Alvorada Divina', 'Ruína Eterna', 'Coração do Abismo', 'Voz do Vazio', 'Lâmina do Destino', 'Promessa Celestial', 'Eco da Criação', 'Último Suspiro'];

const ENEMIES = {
  slime: { name: 'Slime', g: 'm', sprite: 'slime', pal: { a: '#6cd65a', b: '#3e9a3a', w: '#d0ffb8', e: '#183018' }, hp: 0.8, atk: 0.8, spd: 0.8, move: 2.0 },
  wolf: { name: 'Lobo', g: 'm', sprite: 'wolf', pal: { a: '#8a8580', b: '#5d5853', w: '#d8d0c4', e: '#ffd23a' }, hp: 0.85, atk: 1.1, spd: 1.1, move: 3.4 },
  goblin: { name: 'Goblin', g: 'm', sprite: 'goblin', pal: { a: '#6fb04a', b: '#4a3020', e: '#ff3a3a', t: '#f0f0e0', h: '#7a5230', m: '#8a6040' }, hp: 1.0, atk: 1.0, spd: 1.0, move: 2.8 },
  goblin_archer: { name: 'Goblin Arqueiro', g: 'm', sprite: 'goblin', pal: { a: '#8ab04a', b: '#4a3020', e: '#ffd23a', t: '#f0f0e0', h: '#3a6a3a', m: '#c8a070' }, hp: 0.7, atk: 0.9, spd: 0.8, move: 2.6, range: 4, proj: 'arrow' },
  bat: { name: 'Morcego', g: 'm', sprite: 'bat', pal: { a: '#5a3a6a', b: '#3a2448', e: '#ff4a4a' }, hp: 0.6, atk: 0.9, spd: 1.4, move: 3.8, fly: true },
  spider: { name: 'Aranha', g: 'f', sprite: 'spider', pal: { a: '#3a2a3a', b: '#2a1a2a', w: '#8a6a8a', e: '#ff3030' }, hp: 0.9, atk: 1.1, spd: 1.0, move: 3.2, poison: 0.3 },
  skeleton: { name: 'Esqueleto', g: 'm', sprite: 'skeleton', pal: { a: '#e8e2d0', k: '#1b1424', m: '#9aa4b0', h: '#6b4628' }, hp: 1.1, atk: 1.0, spd: 1.0, move: 2.6, armor: 0.1 },
  sk_archer: { name: 'Esqueleto Arqueiro', g: 'm', sprite: 'skeleton', pal: { a: '#d8d0b8', k: '#1b1424', m: '#8a6a3a', h: '#6b4628' }, hp: 0.8, atk: 0.95, spd: 0.8, move: 2.4, range: 4.5, proj: 'arrow' },
  scorpion: { name: 'Escorpião', g: 'm', sprite: 'scorpion', pal: { a: '#c8803a', b: '#7a4a1a', s: '#ff3a3a', e: '#1b1424' }, hp: 1.1, atk: 1.1, spd: 0.9, move: 2.8, armor: 0.15, poison: 0.25 },
  snake: { name: 'Serpente', g: 'f', sprite: 'snake', pal: { a: '#c8a040', b: '#8a6a20', e: '#1b1424', t: '#ff3a5a' }, hp: 0.8, atk: 1.2, spd: 1.2, move: 3.0 },
  mummy: { name: 'Múmia', g: 'f', sprite: 'mummy', pal: { a: '#d8ccaa', b: '#9a8c6a', e: '#3aff7a' }, hp: 1.5, atk: 0.9, spd: 0.8, move: 1.9 },
  toxic_slime: { name: 'Slime Tóxico', g: 'm', sprite: 'slime', pal: { a: '#a65ad6', b: '#6a2a9a', w: '#e8b8ff', e: '#1a0a2a' }, hp: 0.9, atk: 0.9, spd: 0.8, move: 2.0, poison: 0.35 },
  frog: { name: 'Homem-Sapo', g: 'm', sprite: 'frog', pal: { a: '#5aa04a', b: '#e8d890', e: '#ffe040', r: '#2a4a2a', m: '#9a8a6a' }, hp: 1.1, atk: 1.0, spd: 1.0, move: 2.8 },
  plant: { name: 'Planta Carnívora', g: 'f', sprite: 'plant', pal: { a: '#d0405a', w: '#ff9ab0', t: '#f8f0d8', r: '#5a0a1a', g: '#3a8a3a', l: '#4aa04a', b: '#5a3a2a' }, hp: 1.2, atk: 1.0, spd: 0.7, move: 0, range: 3.5, proj: 'spit' },
  snow_wolf: { name: 'Lobo das Neves', g: 'm', sprite: 'wolf', pal: { a: '#dfe8f0', b: '#9ab0c8', w: '#ffffff', e: '#3ab0ff' }, hp: 0.95, atk: 1.15, spd: 1.1, move: 3.4 },
  ice_elem: { name: 'Elemental de Gelo', g: 'm', sprite: 'elemental', pal: { a: '#3a8ad8', b: '#8ad0ff', w: '#ffffff', e: '#0a2a4a' }, hp: 0.9, atk: 1.05, spd: 0.8, move: 2.2, range: 4, proj: 'ice', fly: true },
  yeti: { name: 'Yeti', g: 'm', sprite: 'golem', pal: { a: '#e8eef4', b: '#9ab0c8', e: '#3a8ad8' }, hp: 1.7, atk: 1.2, spd: 0.7, move: 2.2 },
  imp: { name: 'Diabrete', g: 'm', sprite: 'goblin', pal: { a: '#d0402a', b: '#2a1a1a', e: '#ffe040', t: '#ffffff', h: '#3a1a1a', m: '#ff8a2a' }, hp: 0.8, atk: 1.1, spd: 1.3, move: 3.4 },
  fire_elem: { name: 'Elemental de Fogo', g: 'm', sprite: 'elemental', pal: { a: '#ff6a1a', b: '#ffb02a', w: '#fff2a0', e: '#3a0a00' }, hp: 0.9, atk: 1.15, spd: 0.8, move: 2.2, range: 4, proj: 'fire', fly: true },
  salamander: { name: 'Salamandra', g: 'f', sprite: 'snake', pal: { a: '#ff7a2a', b: '#c83a1a', e: '#1b1424', t: '#ffe040' }, hp: 1.1, atk: 1.15, spd: 1.0, move: 3.0 },
  ghost: { name: 'Fantasma', g: 'm', sprite: 'ghost', pal: { a: '#d8e8f8', b: '#9ab0d0', k: '#1b1424' }, hp: 0.9, atk: 1.1, spd: 1.0, move: 2.6, fly: true, dodge: 0.15 },
  vampire: { name: 'Vampiro', g: 'm', sprite: 'cultist', pal: { h: '#1b1424', s: '#d8d0e0', e: '#ff2a2a', t: '#ffffff', a: '#2a1a2a', w: '#e8e8e8', r: '#8a1a2a', b: '#5a0a1a', k: '#1b1424' }, hp: 1.3, atk: 1.2, spd: 1.0, move: 2.8, lifesteal: 0.3 },
  cultist: { name: 'Cultista', g: 'm', sprite: 'cultist', pal: { h: '#4a2a6a', s: '#2a1a3a', e: '#ff4aff', t: '#2a1a3a', a: '#4a2a6a', w: '#c8a040', r: '#3a1a5a', b: '#2a0a3a', k: '#1b1424' }, hp: 0.9, atk: 1.1, spd: 0.8, move: 2.4, range: 4, proj: 'shadow' },
  eye: { name: 'Observador', g: 'm', sprite: 'eye', pal: { a: '#6a2a8a', w: '#f0e8f0', i: '#d83a3a', k: '#0a0a0a', b: '#4a1a6a' }, hp: 1.0, atk: 1.2, spd: 0.7, move: 2.0, range: 4.5, proj: 'beam', fly: true },
  demon: { name: 'Demônio', g: 'm', sprite: 'demon', pal: { a: '#c82a2a', b: '#2a1a1a', e: '#ffe040', t: '#ffffff', w: '#5a1a2a' }, hp: 1.4, atk: 1.3, spd: 1.0, move: 2.8 },
  horror: { name: 'Horror Abissal', g: 'm', sprite: 'demon', pal: { a: '#4a2a8a', b: '#1a0a2a', e: '#40ffd0', t: '#c0ffe8', w: '#2a1a4a' }, hp: 1.6, atk: 1.25, spd: 0.9, move: 2.6 },
  mimic: { name: 'Mímico', g: 'm', sprite: 'mimic', pal: { a: '#8a5a2a', b: '#4a3020', g: '#e8b33a', t: '#f8f0d8', k: '#2a0a0a', e: '#ffe040', r: '#d83a5a' }, hp: 3.5, atk: 1.6, spd: 1.1, move: 3.0 },
  minion_skel: { name: 'Esqueleto', g: 'm', sprite: 'skeleton', pal: { a: '#c8ffd8', k: '#0a3a1a', m: '#4dff8a', h: '#2a6a3a' }, hp: 1, atk: 1, spd: 1.1, move: 3.6 },
  gorka: { name: 'Gorka', g: 'm', sprite: 'ape', pal: { a: '#4a3a3a', b: '#2a1e1e', w: '#8a7a6a', e: '#ffd04a' }, hp: 1.5, atk: 1.25, spd: 0.9, move: 2.8 },
  gnoll_hunter: { name: 'Gnoll Caçador', g: 'm', sprite: 'goblin', pal: { a: '#b89a5a', b: '#4a3020', e: '#ff3a3a', t: '#f0f0e0', h: '#6a4a2a', m: '#8a6a3a' }, hp: 0.9, atk: 1.1, spd: 1.0, move: 3.0, range: 4.2, proj: 'arrow' },
  harpy: { name: 'Harpia', g: 'f', sprite: 'harpy', pal: { h: '#8a5a3a', s: '#e0b890', e: '#ff3a3a', c: '#a87a4a', a: '#c8a070', y: '#ffd04a' }, hp: 0.8, atk: 1.15, spd: 1.3, move: 3.8, fly: true, dodge: 0.1 },
  basilisk: { name: 'Basilisco', g: 'm', sprite: 'snake', pal: { a: '#5a8a4a', b: '#3a5a2a', e: '#ffe040', t: '#ff3a5a' }, hp: 1.3, atk: 1.15, spd: 0.9, move: 2.6, armor: 0.15, poison: 0.25 },
  sahuagin: { name: 'Sahuagin', g: 'm', sprite: 'frog', pal: { a: '#3a8a6a', b: '#c8e0b0', e: '#ff5a3a', r: '#1a4a3a', m: '#8a9aa0' }, hp: 1.1, atk: 1.15, spd: 1.1, move: 3.0 },
  giant_crab: { name: 'Caranguejo Gigante', g: 'm', sprite: 'crab', pal: { a: '#d8503a', b: '#8a2a1a', e: '#1b1424', w: '#ffb08a' }, hp: 1.6, atk: 1.1, spd: 0.8, move: 2.4, armor: 0.3 },
  siren: { name: 'Sereia', g: 'f', sprite: 'cultist', pal: { h: '#2a8a9a', s: '#7ac8c8', e: '#5affff', t: '#ffffff', a: '#2a6a8a', w: '#c8e8f0', r: '#1a4a6a', b: '#0a2a3a', k: '#0a1a24' }, hp: 0.9, atk: 1.2, spd: 0.9, move: 2.6, range: 4.5, proj: 'ice' },
  angler: { name: 'Peixe-Lanterna', g: 'm', sprite: 'eye', pal: { a: '#1a3a4a', w: '#d8f0f0', i: '#ffe040', k: '#0a0a0a', b: '#0a2a3a' }, hp: 1.0, atk: 1.25, spd: 0.8, move: 2.2, range: 4.5, proj: 'beam', fly: true },
  warg: { name: 'Warg', g: 'm', sprite: 'wolf', pal: { a: '#3a3440', b: '#1e1a24', w: '#8a8090', e: '#ff3a3a' }, hp: 1.1, atk: 1.3, spd: 1.25, move: 3.8 },
  wendigo: { name: 'Wendigo', g: 'm', sprite: 'ape', pal: { a: '#c8c0b8', b: '#6a6058', w: '#e8e0d8', e: '#5affd0' }, hp: 1.5, atk: 1.35, spd: 1.0, move: 3.0, lifesteal: 0.2 },
  draugr: { name: 'Draugr', g: 'm', sprite: 'skeleton', pal: { a: '#9ab0c8', k: '#0a1a2a', m: '#4a6a8a', h: '#2a3a4a' }, hp: 1.4, atk: 1.2, spd: 0.9, move: 2.6, armor: 0.2 },
  wraith: { name: 'Espectro da Névoa', g: 'm', sprite: 'ghost', pal: { a: '#6a6a8a', b: '#3a3a5a', k: '#c8c8ff' }, hp: 1.0, atk: 1.3, spd: 1.1, move: 2.8, fly: true, dodge: 0.25 },
  cyclops: { name: 'Ciclope', g: 'm', sprite: 'cyclops', pal: { a: '#c89a7a', b: '#6a4a2a', w: '#ffffff', k: '#1b1424', t: '#f0e8d8', m: '#7a5a3a' }, hp: 2.0, atk: 1.4, spd: 0.7, move: 2.2 },
  medusa: { name: 'Medusa', g: 'f', sprite: 'snake', pal: { a: '#6a9a5a', b: '#3a6a3a', e: '#ffe040', t: '#c83aff' }, hp: 1.1, atk: 1.3, spd: 1.0, move: 2.6, range: 4, proj: 'spit' },
  cerberus: { name: 'Cérbero', g: 'm', sprite: 'wolf', pal: { a: '#5a1a1a', b: '#2a0a0a', w: '#ff8a3a', e: '#ffe040' }, hp: 1.4, atk: 1.35, spd: 1.2, move: 3.6 },
  satyr: { name: 'Sátiro', g: 'm', sprite: 'goblin', pal: { a: '#c89a6a', b: '#5a3a2a', e: '#ffd04a', t: '#f0f0e0', h: '#6a4a2a', m: '#e0c08a' }, hp: 1.0, atk: 1.2, spd: 1.2, move: 3.2 },
  valkyrie: { name: 'Valquíria', g: 'f', sprite: 'cultist', pal: { h: '#ffe080', s: '#f4d8c0', e: '#5ab0ff', t: '#ffffff', a: '#d8d8e8', w: '#ffd04a', r: '#9aa8c8', b: '#5a6888', k: '#1b1424' }, hp: 1.3, atk: 1.35, spd: 1.0, move: 3.0 },
  griffin: { name: 'Grifo', g: 'm', sprite: 'harpy', pal: { h: '#f0f0f0', s: '#ffe080', e: '#1b1424', c: '#c89a5a', a: '#e8d8b0', y: '#ffb02a' }, hp: 1.3, atk: 1.35, spd: 1.15, move: 3.8, fly: true },
  thunderbird: { name: 'Pássaro-Trovão', g: 'm', sprite: 'bat', pal: { a: '#3a6ad8', b: '#ffe040', e: '#ffffff' }, hp: 1.0, atk: 1.3, spd: 1.3, move: 4.0, fly: true, range: 4.5, proj: 'arcane' },
  fallen_angel: { name: 'Anjo Caído', g: 'm', sprite: 'demon', pal: { a: '#e8e0f0', b: '#2a2238', e: '#ff3a3a', t: '#ffffff', w: '#5a4a6a' }, hp: 1.6, atk: 1.45, spd: 1.0, move: 3.0 },
};

const LORDS = {
  ent: { name: 'Ent Ancião', sprite: 'golem', pal: { a: '#6a4a2a', b: '#3a8a3a', e: '#c8ff5a' }, abil: ['slam', 'summon'], summon: 'slime' },
  crystal_golem: { name: 'Golem de Cristal', sprite: 'golem', pal: { a: '#7a6aa8', b: '#c8a8ff', e: '#ffffff' }, abil: ['slam', 'volley'], proj: 'ice' },
  pharaoh: { name: 'Faraó Amaldiçoado', sprite: 'mummy', pal: { a: '#e8c84a', b: '#3a5aaa', e: '#ff3a3a' }, abil: ['volley', 'summon'], proj: 'shadow', summon: 'scorpion' },
  hydra: { name: 'Hidra do Lodo', sprite: 'snake', pal: { a: '#4a8a3a', b: '#2a5a2a', e: '#ff3a3a', t: '#ffe040' }, abil: ['volley', 'slam'], proj: 'spit' },
  colossus: { name: 'Colosso Glacial', sprite: 'golem', pal: { a: '#bfe0ff', b: '#4a8ad8', e: '#ffffff' }, abil: ['slam', 'volley'], proj: 'ice' },
  dragon: { name: 'Dragão Ígneo', sprite: 'dragon', pal: { a: '#c83a1a', b: '#2a1a1a', e: '#ffe040', w: '#8a2a1a', c: '#ffb04a', t: '#ff8a2a' }, abil: ['volley', 'slam'], proj: 'fire' },
  lich: { name: 'Lich Supremo', sprite: 'skeleton', pal: { a: '#b8a0e8', k: '#4dff8a', m: '#6a3aaa', h: '#2a1a4a' }, abil: ['summon', 'volley'], proj: 'shadow', summon: 'skeleton' },
  devourer: { name: 'Devorador de Mundos', sprite: 'eye', pal: { a: '#2a1a5a', w: '#ffe8f0', i: '#ff3aa0', k: '#0a0a0a', b: '#4a1a8a' }, abil: ['volley', 'slam', 'summon'], proj: 'beam', summon: 'horror' },
  chimera: { name: 'Quimera Ancestral', sprite: 'dragon', pal: { a: '#c88a3a', b: '#3a2a1a', e: '#ff3a3a', w: '#6a8a3a', c: '#ffd04a', t: '#ff8a2a' }, abil: ['slam', 'volley'], proj: 'fire' },
  kraken: { name: 'O Kraken', sprite: 'kraken', pal: { a: '#8a3a6a', b: '#4a1a3a', w: '#ffe8f0', e: '#1b1424' }, abil: ['slam', 'summon', 'volley'], proj: 'ice', summon: 'giant_crab' },
  fenrir: { name: 'Fenrir', sprite: 'wolf', pal: { a: '#4a5a7a', b: '#1a2234', w: '#c8d8ff', e: '#5affff' }, abil: ['slam', 'summon'], summon: 'warg' },
  titan: { name: 'Titã Primordial', sprite: 'cyclops', pal: { a: '#d8b070', b: '#8a5a2a', w: '#ffffff', k: '#ff3a1a', t: '#f0e8d8', m: '#ffd04a' }, abil: ['slam', 'volley'], proj: 'fire' },
  seraph_lord: { name: 'Serafim Caído', sprite: 'demon', pal: { a: '#fff2d0', b: '#c8a040', e: '#7af0ff', t: '#ffffff', w: '#ffe080' }, abil: ['volley', 'summon', 'slam'], proj: 'holy', summon: 'valkyrie' },
};

const ELITE_ADJ = [['Feroz', 'Feroz'], ['Furioso', 'Furiosa'], ['Sombrio', 'Sombria'], ['Brutal', 'Brutal'], ['Raivoso', 'Raivosa'], ['Vil', 'Vil']];
const CHAMP_ADJ = [['Colossal', 'Colossal'], ['Ancestral', 'Ancestral'], ['Sanguinário', 'Sanguinária'], ['Corrompido', 'Corrompida'], ['Primordial', 'Primordial'], ['Supremo', 'Suprema']];

const BIOMES = [
  { id: 'forest', name: 'Floresta Sussurrante', wall: 'trees', organic: 0.6, dark: 0,
    pal: { floor: '#4a6e33', floor2: '#527838', speck: ['#62903f', '#3b5a2a', '#76a84a'], wallTop: '#173016', wallTop2: '#1f4a1c', wallHi: '#2e6326', face: '#4a3424', faceDark: '#2a1c12', bg: '#081206', fog: '#050904' },
    decor: ['grass', 'grass', 'flower', 'mushroom', 'rock', 'bush'], enemies: ['slime', 'wolf', 'goblin', 'goblin_archer'], lord: 'ent' },
  { id: 'cave', name: 'Cavernas Esquecidas', wall: 'rock', organic: 0.35, dark: 0.42,
    pal: { floor: '#3a3440', floor2: '#423b49', speck: ['#4e4657', '#2c2731', '#5a5064'], wallTop: '#1e1a24', wallTop2: '#28222f', wallHi: '#3a3344', face: '#4a4252', faceDark: '#2e2834', bg: '#07060a', fog: '#040306' },
    decor: ['rock', 'crystal', 'bones', 'mushroom', 'pebbles'], enemies: ['bat', 'spider', 'skeleton', 'sk_archer'], lord: 'crystal_golem', torches: true },
  { id: 'desert', name: 'Areias Escaldantes', wall: 'sandstone', organic: 0.45, dark: 0,
    pal: { floor: '#c8a464', floor2: '#d0ad6c', speck: ['#dcbc7c', '#b08c50', '#e4c88c'], wallTop: '#8a5e30', wallTop2: '#9a6a38', wallHi: '#b4844a', face: '#a87440', faceDark: '#7a4e24', bg: '#2a1a0a', fog: '#140c04' },
    decor: ['cactus', 'bones', 'rock', 'skull', 'pebbles'], enemies: ['scorpion', 'snake', 'mummy'], lord: 'pharaoh' },
  { id: 'swamp', name: 'Pântano Pútrido', wall: 'trees', organic: 0.7, dark: 0.25,
    pal: { floor: '#3a4a2a', floor2: '#34442a', speck: ['#4a5a30', '#2a3820', '#5a6a3a'], wallTop: '#1a2a1a', wallTop2: '#24361e', wallHi: '#34502a', face: '#3a3020', faceDark: '#221a10', bg: '#080c06', fog: '#050804', puddle: '#2a4a3a' },
    decor: ['puddle', 'mushroom', 'grass', 'lily', 'bones'], enemies: ['toxic_slime', 'frog', 'plant'], lord: 'hydra' },
  { id: 'ice', name: 'Picos Gélidos', wall: 'ice', organic: 0.5, dark: 0,
    pal: { floor: '#c8d8e8', floor2: '#d4e2ee', speck: ['#e8f2fa', '#a8bcd0', '#ffffff'], wallTop: '#5a7a9a', wallTop2: '#6a8aaa', wallHi: '#9ac0e0', face: '#7a9ac0', faceDark: '#4a6a8a', bg: '#0a1420', fog: '#060a10' },
    decor: ['icicle', 'rock', 'snow', 'snow', 'crystal'], enemies: ['snow_wolf', 'ice_elem', 'yeti'], lord: 'colossus' },
  { id: 'volcano', name: 'Forja Infernal', wall: 'basalt', organic: 0.4, dark: 0.35,
    pal: { floor: '#3a2622', floor2: '#422a24', speck: ['#5a3428', '#2a1a16', '#ff6a2a'], wallTop: '#1a1010', wallTop2: '#241614', wallHi: '#3a2420', face: '#2a1a18', faceDark: '#1a0e0c', bg: '#0a0403', fog: '#060202', lava: '#ff5a1a' },
    decor: ['ember', 'rock', 'lava', 'bones', 'skull'], enemies: ['imp', 'fire_elem', 'salamander'], lord: 'dragon' },
  { id: 'crypt', name: 'Cripta Sombria', wall: 'bricks', organic: 0.0, dark: 0.45,
    pal: { floor: '#34303c', floor2: '#3a3544', speck: ['#46404f', '#28242e', '#504860'], wallTop: '#16141c', wallTop2: '#1e1b26', wallHi: '#2e2a38', face: '#3e3848', faceDark: '#26222e', bg: '#050408', fog: '#030205' },
    decor: ['tomb', 'bones', 'skull', 'candle', 'cobweb'], enemies: ['skeleton', 'ghost', 'vampire', 'cultist'], lord: 'lich', torches: true },
  { id: 'void', name: 'Abismo Astral', wall: 'crystal', organic: 0.55, dark: 0.38,
    pal: { floor: '#221a3a', floor2: '#281e44', speck: ['#3a2a5a', '#1a1230', '#8a5aff'], wallTop: '#0e0a1a', wallTop2: '#160f28', wallHi: '#3a2a6a', face: '#2a1e4a', faceDark: '#140e28', bg: '#030208', fog: '#020105' },
    decor: ['crystal', 'star', 'crystal', 'rock', 'ember'], enemies: ['eye', 'demon', 'horror', 'cultist'], lord: 'devourer' },
  { id: 'jungle', name: 'Selva Esmeralda', wall: 'trees', organic: 0.75, dark: 0.18,
    pal: { floor: '#3a6a3a', floor2: '#407440', speck: ['#4e8a4a', '#2e5a2e', '#6aa05a'], wallTop: '#0e2a12', wallTop2: '#163a1a', wallHi: '#2a6a2e', face: '#3a2a1a', faceDark: '#22180e', bg: '#040e06', fog: '#030803' },
    decor: ['grass', 'flower', 'bush', 'mushroom', 'lily', 'grass'], enemies: ['gorka', 'gnoll_hunter', 'harpy', 'basilisk'], lord: 'chimera' },
  { id: 'sea', name: 'Recife Afogado', wall: 'rock', organic: 0.6, dark: 0.32,
    pal: { floor: '#2a4a5a', floor2: '#2e5262', speck: ['#3a6272', '#1e3a48', '#5ac8d8'], wallTop: '#0e2230', wallTop2: '#14303e', wallHi: '#2a5a6a', face: '#1e4250', faceDark: '#122a36', bg: '#020a10', fog: '#01060a', puddle: '#2a7a8a' },
    decor: ['puddle', 'crystal', 'rock', 'bones', 'lily'], enemies: ['sahuagin', 'giant_crab', 'siren', 'angler'], lord: 'kraken' },
  { id: 'shadow', name: 'Terras Sombrias', wall: 'rock', organic: 0.45, dark: 0.5,
    pal: { floor: '#2a2630', floor2: '#2e2a36', speck: ['#3a3444', '#1e1a24', '#6a4a8a'], wallTop: '#0e0c12', wallTop2: '#16131c', wallHi: '#2a2434', face: '#24202c', faceDark: '#16131c', bg: '#030205', fog: '#020103' },
    decor: ['bones', 'skull', 'cobweb', 'tomb', 'rock'], enemies: ['warg', 'wendigo', 'draugr', 'wraith'], lord: 'fenrir', torches: true },
  { id: 'titans', name: 'Ruínas dos Titãs', wall: 'sandstone', organic: 0.3, dark: 0,
    pal: { floor: '#c8c0b0', floor2: '#d0c8b8', speck: ['#dcd4c4', '#b0a898', '#e8e0d0'], wallTop: '#8a8478', wallTop2: '#9a9488', wallHi: '#c8c0b0', face: '#aaa294', faceDark: '#7a7468', bg: '#1a1814', fog: '#0e0d0a' },
    decor: ['rock', 'pebbles', 'bones', 'skull', 'tomb'], enemies: ['cyclops', 'medusa', 'cerberus', 'satyr'], lord: 'titan' },
  { id: 'celestial', name: 'Cidadela Celeste', wall: 'crystal', organic: 0.5, dark: 0,
    pal: { floor: '#e8e0f0', floor2: '#f0e8f8', speck: ['#ffffff', '#d0c8e0', '#ffe8a0'], wallTop: '#a898c8', wallTop2: '#b8a8d8', wallHi: '#f0e8ff', face: '#c8b8e8', faceDark: '#9888b8', bg: '#2a2440', fog: '#1a1628' },
    decor: ['star', 'crystal', 'flower', 'snow'], enemies: ['valkyrie', 'griffin', 'thunderbird', 'fallen_angel'], lord: 'seraph_lord' },
];

const CHEST_TIERS = [
  { id: 0, name: 'Baú de Madeira', pal: { a: '#8a5a2a', b: '#4a3020', g: '#c8a040', w: '#b07a40' }, minR: 0, items: [1, 1], gold: 1, w: 60 },
  { id: 1, name: 'Baú de Ferro', pal: { a: '#6a7080', b: '#3a3e4a', g: '#d8e0e8', w: '#9aa0b0' }, minR: 1, items: [1, 2], gold: 2, w: 28 },
  { id: 2, name: 'Baú Dourado', pal: { a: '#d8a020', b: '#8a5a10', g: '#fff0a0', w: '#ffd060' }, minR: 2, items: [2, 2], gold: 4, w: 10 },
  { id: 3, name: 'Baú de Cristal', pal: { a: '#8a4ad8', b: '#4a2a8a', g: '#ffb0ff', w: '#c08aff' }, minR: 3, items: [2, 3], gold: 8, w: 2 },
  { id: 4, name: 'Baú Arco-Íris', pal: { a: '#ff5ad8', b: '#4a1a6a', g: '#7affff', w: '#ffe07a' }, minR: 5, items: [1, 1], gold: 25, w: 0, rainbow: true },
];

const SHRINES = {
  fury: { name: 'Santuário da Fúria', short: 'Fúria', color: '#ff4a3a', buff: { dmg: 0.5 }, dur: 60, desc: '+50% de dano' },
  swift: { name: 'Santuário dos Ventos', short: 'Ventos', color: '#5ae8ff', buff: { atkSpd: 0.3, move: 0.3 }, dur: 60, desc: '+30% de velocidade' },
  fortune: { name: 'Santuário da Fortuna', short: 'Fortuna', color: '#ffd04a', buff: { gold: 1.0 }, dur: 60, desc: '+100% de ouro' },
  wisdom: { name: 'Santuário da Sabedoria', short: 'Sabedoria', color: '#b874ff', buff: { xp: 1.0 }, dur: 60, desc: '+100% de experiência' },
  life: { name: 'Fonte da Vida', color: '#4cff7a', buff: null, dur: 0, desc: 'Cura total e poções' },
};

const TRAINING = [
  { id: 'str', name: 'Treino de Força', stat: 'trainDmg', per: 2, comp: true, base: 25, growth: 1.25, icon: 'sk_sword', color: '#ff7a4a', desc: v => `Dano ×${U.fmtMult(v)} (cada nível ×1,02)` },
  { id: 'vit', name: 'Treino de Vitalidade', stat: 'trainHp', per: 2, comp: true, base: 25, growth: 1.25, icon: 'sk_heart', color: '#ff5a62', desc: v => `Vida ×${U.fmtMult(v)} (cada nível ×1,02)` },
  { id: 'end', name: 'Treino de Resistência', stat: 'trainDef', per: 2, comp: true, base: 35, growth: 1.25, icon: 'sk_shield', color: '#9aa3ad', desc: v => `Armadura ×${U.fmtMult(v)} (cada nível ×1,02)` },
  { id: 'agi', name: 'Treino de Agilidade', stat: 'atkSpd', per: 1.5, base: 80, growth: 1.3, max: 50, icon: 'sk_wind', color: '#7ad070', desc: v => `+${U.fmtNum(v)}% de Vel. de Ataque` },
  { id: 'pre', name: 'Treino de Precisão', stat: 'crit', per: 0.5, base: 100, growth: 1.3, max: 50, icon: 'sk_eye', color: '#ffd04a', desc: v => `+${U.fmtNum(v)}% de Chance Crítica` },
  { id: 'fer', name: 'Golpes Ferozes', stat: 'critDmg', per: 4, base: 120, growth: 1.28, icon: 'sk_star', color: '#ff5aa0', desc: v => `+${U.fmtNum(v)}% de Dano Crítico` },
  { id: 'gre', name: 'Ganância', stat: 'goldPct', per: 6, base: 60, growth: 1.27, icon: 'sk_coin', color: '#ffd04a', desc: v => `+${U.fmtNum(v)}% de Ouro` },
  { id: 'wis', name: 'Estudos Antigos', stat: 'xpPct', per: 5, base: 60, growth: 1.27, icon: 'sk_book', color: '#b874ff', desc: v => `+${U.fmtNum(v)}% de Experiência` },
  { id: 'luk', name: 'Ritual da Sorte', stat: 'mf', per: 2, max: 50, base: 150, growth: 1.32, icon: 'sk_clover', color: '#4cff7a', desc: v => `+${U.fmtNum(v)}% de Sorte (itens mais raros)` },
  { id: 'alc', name: 'Alquimia', stat: 'potionPct', per: 8, base: 90, growth: 1.3, max: 25, icon: 'sk_potion', color: '#ff4a6a', desc: (v, r) => `+${U.fmtNum(v)}% de cura das poções, +${Math.floor(r / 5)} poções máx.` },
  { id: 'spd', name: 'Corrida', stat: 'moveSpd', per: 3, base: 50, growth: 1.3, max: 20, icon: 'sk_boot', color: '#5ae8ff', desc: v => `+${U.fmtNum(v)}% de Vel. de Movimento` },
];

const SOUL_UPGRADES = [
  { id: 'power', name: 'Poder Ancestral', stat: 'soulDmg', per: 8, comp: true, base: 1, growth: 1.25, icon: 'sk_sword', color: '#ff7a4a', desc: v => `+${U.fmt(v)}% de Dano (cada nível ×1,08)` },
  { id: 'vigor', name: 'Vigor Eterno', stat: 'soulHp', per: 8, comp: true, base: 1, growth: 1.25, icon: 'sk_heart', color: '#ff5a62', desc: v => `+${U.fmt(v)}% de Vida (cada nível ×1,08)` },
  { id: 'aegis', name: 'Égide Imortal', stat: 'soulDef', per: 8, comp: true, base: 1, growth: 1.25, icon: 'sk_shield', color: '#9aa3ad', desc: v => `+${U.fmt(v)}% de Armadura (cada nível ×1,08)` },
  { id: 'fortune', name: 'Fortuna Divina', stat: 'goldPct', per: 25, base: 1, growth: 1.3, icon: 'sk_coin', color: '#ffd04a', desc: v => `+${v}% de Ouro` },
  { id: 'wisdom', name: 'Sabedoria Antiga', stat: 'xpPct', per: 20, base: 1, growth: 1.3, icon: 'sk_book', color: '#b874ff', desc: v => `+${v}% de Experiência` },
  { id: 'luck', name: 'Bênção do Destino', stat: 'mf', per: 10, base: 2, growth: 1.35, icon: 'sk_clover', color: '#4cff7a', desc: v => `+${v}% de Sorte` },
  { id: 'haste', name: 'Pressa Etérea', stat: 'atkSpd', per: 3, base: 2, growth: 1.4, max: 20, icon: 'sk_wind', color: '#5ae8ff', desc: v => `+${v}% de Vel. de Ataque e Movimento` },
  { id: 'talent', name: 'Iluminação', stat: 'talentPts', per: 2, base: 3, growth: 1.5, max: 25, icon: 'sk_star', color: '#fff2a0', desc: v => `+${v} pontos de talento` },
  { id: 'bag', name: 'Bolsa Dimensional', stat: 'invSlots', per: 6, base: 2, growth: 1.6, max: 10, icon: 'sk_bag', color: '#c8a070', desc: v => `+${v} espaços na mochila` },
  { id: 'head', name: 'Atalho Astral', stat: 'startZone', per: 2, base: 5, growth: 1.45, max: 25, icon: 'sk_portal', color: '#b874ff', desc: v => `Começa novas jornadas até a zona ${1 + v}, já com nível e equipamento (máx. metade do recorde e o que o herói aguentar)` },
  { id: 'soul', name: 'Colheita de Almas', stat: 'soulPct', per: 10, base: 5, growth: 1.5, icon: 'sk_skull', color: '#d9b8ff', desc: v => `+${v}% de Almas ao ascender` },
  { id: 'dream', name: 'Sonhos Lúcidos', stat: 'offline', per: 10, base: 3, growth: 1.5, max: 5, icon: 'sk_clock', color: '#7ae8ff', desc: v => `Progresso offline: ${50 + v}% de eficiência` },
];

const ACHIEVEMENTS = [
  { id: 'kill100', name: 'Caçador', desc: 'Derrote 100 inimigos', stat: 'kills', goal: 100, reward: { dmgPct: 2 } },
  { id: 'kill1k', name: 'Exterminador', desc: 'Derrote 1.000 inimigos', stat: 'kills', goal: 1000, reward: { dmgPct: 3 } },
  { id: 'kill10k', name: 'Lenda Viva', desc: 'Derrote 10.000 inimigos', stat: 'kills', goal: 10000, reward: { dmgPct: 5 } },
  { id: 'kill50k', name: 'Ceifador', desc: 'Derrote 50.000 inimigos', stat: 'kills', goal: 50000, reward: { dmgPct: 8 } },
  { id: 'chest25', name: 'Saqueador', desc: 'Abra 25 baús', stat: 'chests', goal: 25, reward: { goldPct: 5 } },
  { id: 'chest250', name: 'Caçador de Tesouros', desc: 'Abra 250 baús', stat: 'chests', goal: 250, reward: { goldPct: 10 } },
  { id: 'chest2k', name: 'Dragão do Tesouro', desc: 'Abra 2.000 baús', stat: 'chests', goal: 2000, reward: { mf: 10 } },
  { id: 'boss5', name: 'Matador de Chefes', desc: 'Derrote 5 chefes', stat: 'bosses', goal: 5, reward: { bossDmg: 5 } },
  { id: 'boss50', name: 'Flagelo dos Chefes', desc: 'Derrote 50 chefes', stat: 'bosses', goal: 50, reward: { bossDmg: 10 } },
  { id: 'boss250', name: 'Regicida', desc: 'Derrote 250 chefes', stat: 'bosses', goal: 250, reward: { bossDmg: 15 } },
  { id: 'zone10', name: 'Explorador', desc: 'Alcance a zona 10', stat: 'maxZone', goal: 10, reward: { hpPct: 3 } },
  { id: 'zone25', name: 'Desbravador', desc: 'Alcance a zona 25', stat: 'maxZone', goal: 25, reward: { hpPct: 5 } },
  { id: 'zone40', name: 'Andarilho do Abismo', desc: 'Alcance a zona 40', stat: 'maxZone', goal: 40, reward: { dmgPct: 8 } },
  { id: 'zone60', name: 'Além do Fim', desc: 'Alcance a zona 60', stat: 'maxZone', goal: 60, reward: { dmgPct: 12 } },
  { id: 'lvl25', name: 'Veterano', desc: 'Alcance o nível 25', stat: 'maxLevel', goal: 25, reward: { xpPct: 5 } },
  { id: 'lvl50', name: 'Herói', desc: 'Alcance o nível 50', stat: 'maxLevel', goal: 50, reward: { xpPct: 10 } },
  { id: 'lvl100', name: 'Semideus', desc: 'Alcance o nível 100', stat: 'maxLevel', goal: 100, reward: { xpPct: 15 } },
  { id: 'epic1', name: 'Brilho Violeta', desc: 'Encontre um item Épico', stat: 'epics', goal: 1, reward: { mf: 3 } },
  { id: 'leg1', name: 'Relíquia Lendária', desc: 'Encontre um item Lendário', stat: 'legendaries', goal: 1, reward: { mf: 5 } },
  { id: 'leg10', name: 'Colecionador', desc: 'Encontre 10 itens Lendários', stat: 'legendaries', goal: 10, reward: { mf: 8 } },
  { id: 'myth1', name: 'Toque Divino', desc: 'Encontre um item Mítico', stat: 'mythics', goal: 1, reward: { mf: 10 } },
  { id: 'forge10', name: 'Mestre Ferreiro', desc: 'Aprimore um item até +10', stat: 'maxForge', goal: 10, reward: { defPct: 5 } },
  { id: 'forge15', name: 'Forjador de Lendas', desc: 'Aprimore um item até +15', stat: 'maxForge', goal: 15, reward: { dmgPct: 5 } },
  { id: 'mimic1', name: 'Isso não é um baú!', desc: 'Derrote um Mímico', stat: 'mimics', goal: 1, reward: { goldPct: 5 } },
  { id: 'gold1m', name: 'Magnata', desc: 'Acumule 1M de ouro no total', stat: 'goldEarned', goal: 1e6, reward: { goldPct: 8 } },
  { id: 'asc1', name: 'Renascido', desc: 'Ascenda pela primeira vez', stat: 'ascensions', goal: 1, reward: { xpPct: 5 } },
  { id: 'asc5', name: 'Ciclo Eterno', desc: 'Ascenda 5 vezes', stat: 'ascensions', goal: 5, reward: { dmgPct: 5 } },
  { id: 'death10', name: 'Persistente', desc: 'Seja derrotado 10 vezes', stat: 'deaths', goal: 10, reward: { hpPct: 3 } },
  { id: 'shrine20', name: 'Devoto', desc: 'Ative 20 santuários', stat: 'shrines', goal: 20, reward: { xpPct: 5 } },
  { id: 'zone100', name: 'Centenário', desc: 'Alcance a zona 100', stat: 'maxZone', goal: 100, reward: { dmgPct: 10 } },
  { id: 'zone150', name: 'Coração das Trevas', desc: 'Alcance a zona 150', stat: 'maxZone', goal: 150, reward: { hpPct: 10 } },
  { id: 'zone200', name: 'Além do Limite', desc: 'Alcance a zona 200', stat: 'maxZone', goal: 200, reward: { dmgPct: 15 } },
  { id: 'zone250', name: 'OverLevel', desc: 'Alcance a zona 250', stat: 'maxZone', goal: 250, reward: { dmgPct: 20 } },
  { id: 'zone300', name: 'Senhor das Masmorras', desc: 'Alcance a zona 300', stat: 'maxZone', goal: 300, reward: { hpPct: 20 } },
  { id: 'zone400', name: 'Além do Horizonte', desc: 'Alcance a zona 400', stat: 'maxZone', goal: 400, reward: { dmgPct: 25 } },
  { id: 'zone500', name: 'Fim da Jornada', desc: 'Alcance a zona 500', stat: 'maxZone', goal: 500, reward: { dmgPct: 30, hpPct: 30 } },
  { id: 'lvl300', name: 'Avatar', desc: 'Alcance o nível 300', stat: 'maxLevel', goal: 300, reward: { xpPct: 10 } },
  { id: 'lvl450', name: 'Transcendente', desc: 'Alcance o nível 450', stat: 'maxLevel', goal: 450, reward: { xpPct: 15 } },
  { id: 'lvl800', name: 'Divindade', desc: 'Alcance o nível 800', stat: 'maxLevel', goal: 800, reward: { xpPct: 20 } },
  { id: 'asc10', name: 'Roda do Destino', desc: 'Ascenda 10 vezes', stat: 'ascensions', goal: 10, reward: { dmgPct: 5 } },
  { id: 'asc25', name: 'Eterno Retorno', desc: 'Ascenda 25 vezes', stat: 'ascensions', goal: 25, reward: { hpPct: 8 } },
  { id: 'asc50', name: 'Além da Morte', desc: 'Ascenda 50 vezes', stat: 'ascensions', goal: 50, reward: { dmgPct: 10 } },
  { id: 'kill250k', name: 'Apocalipse', desc: 'Derrote 250.000 inimigos', stat: 'kills', goal: 250000, reward: { dmgPct: 8 } },
  { id: 'kill1m', name: 'Fim das Eras', desc: 'Derrote 1.000.000 de inimigos', stat: 'kills', goal: 1000000, reward: { dmgPct: 12 } },
  { id: 'boss5k', name: 'Rei dos Reis', desc: 'Derrote 5.000 chefes', stat: 'bosses', goal: 5000, reward: { bossDmg: 20 } },
  { id: 'lord250', name: 'Domador de Senhores', desc: 'Derrote 250 Senhores de bioma', stat: 'lordsKilled', goal: 250, reward: { bossDmg: 10 } },
  { id: 'lord1k', name: 'Senhor dos Senhores', desc: 'Derrote 1.000 Senhores de bioma', stat: 'lordsKilled', goal: 1000, reward: { bossDmg: 15 } },
  { id: 'hit21', name: 'Golpe Devastador', desc: 'Cause 1 sextilhão de dano num só golpe', stat: 'highestHit', goal: 1e21, reward: { dmgPct: 5 } },
  { id: 'hit42', name: 'Fúria Cósmica', desc: 'Cause 1 tredecilhão (1 seguido de 42 zeros) de dano num só golpe', stat: 'highestHit', goal: 1e42, reward: { dmgPct: 10 } },
  { id: 'chest25k', name: 'Rei dos Baús', desc: 'Abra 25.000 baús', stat: 'chests', goal: 25000, reward: { goldPct: 15 } },
  { id: 'mimic1k', name: 'Caçador de Mímicos', desc: 'Derrote 1.000 Mímicos', stat: 'mimics', goal: 1000, reward: { mf: 5 } },
  { id: 'leg5k', name: 'Arsenal Lendário', desc: 'Encontre 5.000 itens Lendários', stat: 'legendaries', goal: 5000, reward: { mf: 10 } },
  { id: 'myth1k', name: 'Panteão', desc: 'Encontre 1.000 itens Míticos', stat: 'mythics', goal: 1000, reward: { mf: 12 } },
  { id: 'excl1', name: 'Toque do Arco-Íris', desc: 'Encontre uma arma exclusiva', val: st => achExclusives(st), goal: 1, reward: { mf: 5 } },
  { id: 'exclAll', name: 'Coleção Arco-Íris', desc: 'Encontre todas as armas exclusivas', val: st => achExclusives(st), get goal() { return Object.keys(EXCLUSIVES).length; }, reward: { dmgPct: 10 } },
  { id: 'allCls', name: 'Todas as Classes', desc: 'Desbloqueie todas as classes', val: () => Game.sharedUnlocks().classes.length, get goal() { return CLASS_ORDER.length; }, reward: { xpPct: 10 } },
  { id: 'allSp', name: 'Todas as Espécies', desc: 'Desbloqueie todas as espécies', val: () => Game.sharedUnlocks().species.length, get goal() { return SPECIES_ORDER.length; }, reward: { hpPct: 10 } },
  { id: 'master8', name: 'Mestre de Armas', desc: 'Domine 8 classes (zona 50 numa jornada iniciada com cada uma)', val: st => CLASS_ORDER.filter(c => Stats.mastered(st, c)).length, goal: 8, reward: { dmgPct: 8 } },
  { id: 'masterAll', name: 'Grão-Mestre', desc: 'Domine todas as classes', val: st => CLASS_ORDER.filter(c => Stats.mastered(st, c)).length, get goal() { return CLASS_ORDER.length; }, reward: { dmgPct: 15 } },
  { id: 'relic8', name: 'Arsenal Ancestral', desc: 'Encontre 8 Armas Ancestrais', val: st => Object.keys(st.relics || {}).length, goal: 8, reward: { defPct: 8 } },
  { id: 'relicMyth', name: 'Lendas Despertas', desc: 'Desperte 5 Armas Ancestrais até Mítica', val: st => Object.values(st.relics || {}).filter(r => r.r >= 5).length, goal: 5, reward: { dmgPct: 12 } },
  { id: 'fusion5', name: 'Alquimista de Guerra', desc: 'Aprenda 5 fusões de armas', val: st => Object.keys(st.fusions || {}).length, goal: 5, reward: { xpPct: 8 } },
  { id: 'recruit25', name: 'Libertador', desc: 'Resgate 25 prisioneiros', stat: 'recruits', goal: 25, reward: { hpPct: 5 } },
  { id: 'shrine5k', name: 'Peregrino', desc: 'Ative 5.000 santuários', stat: 'shrines', goal: 5000, reward: { xpPct: 8 } },
  { id: 'time24', name: 'Dedicação', desc: 'Jogue por 24 horas', stat: 'playTime', goal: 24 * 3600, time: true, reward: { goldPct: 10 } },
  { id: 'time100', name: 'Vida de Aventureiro', desc: 'Jogue por 100 horas', stat: 'playTime', goal: 100 * 3600, time: true, reward: { xpPct: 10 } },
  { id: 'celest1', name: 'Luz Celestial', desc: 'Encontre um item Celestial', stat: 'celestials', goal: 1, reward: { mf: 8 } },
  { id: 'celest100', name: 'Constelação', desc: 'Encontre 100 itens Celestiais', stat: 'celestials', goal: 100, reward: { dmgPct: 12 } },
  { id: 'chosen', name: 'Escolhido dos Céus', desc: 'Desbloqueie uma classe ou espécie Celestial', val: () => { const u = Game.sharedUnlocks(); return u.classes.filter(c => CLASSES[c].rarity === HERO_CELESTIAL).length + u.species.filter(x => SPECIES[x].rarity === HERO_CELESTIAL).length; }, goal: 1, reward: { xpPct: 12 } },
  { id: 'newlords', name: 'Caçador de Lendas', desc: 'Derrote a Quimera, o Kraken, Fenrir, o Titã e o Serafim Caído', val: st => ['chimera', 'kraken', 'fenrir', 'titan', 'seraph_lord'].filter(k => (st.stats['lord_' + k] || 0) > 0).length, goal: 5, reward: { bossDmg: 15 } },
];
function achExclusiveIds(st) {
  const ids = new Set(Object.keys(st.exclFound || {}).filter(id => EXCLUSIVES[id]));
  for (const it of [...(st.vault || []), ...Object.values(st.equip || {}), ...(st.inv || [])]) if (it && it.excl) ids.add(it.excl);
  return ids;
}
function exclMissing(st) { const own = achExclusiveIds(st); return Object.keys(EXCLUSIVES).filter(id => !own.has(id)); }
function achExclusives(st) { return achExclusiveIds(st).size; }

const HERO_NAMES = ['Aldric', 'Bryndis', 'Caelum', 'Darius', 'Elara', 'Fenrir', 'Gwendal', 'Hakon', 'Isolde', 'Jorund', 'Kaelen', 'Lyra', 'Morwen', 'Nyx', 'Orin', 'Perseu', 'Ragnar', 'Seraphine', 'Thalia', 'Ulric', 'Valen', 'Wren', 'Ysolde', 'Zephyr', 'Tupã', 'Iara', 'Jaci', 'Rudá', 'Ceci', 'Ubirajara'];
