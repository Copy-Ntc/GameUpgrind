'use strict';
const ICONS = {
  pause: '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="4" height="12" rx="1"/><rect x="9" y="2" width="4" height="12" rx="1"/></svg>',
  play: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11a.5.5 0 0 0 .77.42l8.5-5.5a.5.5 0 0 0 0-.84l-8.5-5.5A.5.5 0 0 0 4 2.5z"/></svg>',
  sound: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" stroke="none"/><path d="M11.5 5.5a3.5 3.5 0 0 1 0 5M13.5 3.5a6.5 6.5 0 0 1 0 9"/></svg>',
  mute: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" stroke="none"/><path d="M11 6l4 4M15 6l-4 4"/></svg>',
  trophy: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 1.5h8v1.5h2.5v1.8a3 3 0 0 1-3 3h-.2A4 4 0 0 1 9 9.9V12h2.5v2.5h-7V12H7V9.9A4 4 0 0 1 4.7 7.8h-.2a3 3 0 0 1-3-3V3H4zm0 3H3v.3a1.5 1.5 0 0 0 1.2 1.5A4 4 0 0 1 4 4.5zm8 0c0 .4 0 .9-.2 1.3A1.5 1.5 0 0 0 13 4.8v-.3z"/></svg>',
  exit: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2.5H3.5v11H9"/><path d="M7 8h7M11.5 5.5 14 8l-2.5 2.5"/></svg>',
  gear: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 5.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6zm6.3 3.7-.1-1.8 1.4-1.2-1.4-2.5-1.8.5-1.4-1L10.6 1H7.8l-.4 1.9-1.5.9-1.8-.5L2.7 5.8l1.4 1.3v1.8l-1.4 1.2 1.4 2.5 1.8-.5 1.5 1 .4 1.8h2.8l.4-1.9 1.4-.9 1.8.5 1.4-2.5z"/></svg>',
};

const DISCORD_URL = 'https://discord.gg/xjde9TyeYN';
const TABS = [['equip', 'Herói'], ['talents', 'Talentos'], ['hall', 'Salão'], ['train', 'Treino'], ['forge', 'Forja'], ['asc', 'Ascensão'], ['ach', 'Conquistas']];

const UI = {
  tab: 'equip', dirt: new Set(), tickT: 0, hudT: 0, logs: [], logFilter: 'all',
  forgeSel: 'weapon', renderT: {}, menuItem: null, titleMode: 'new', selCls: 'fighter', selSp: 'human', titleAnim: null,
  selecting: false, picked: new Set(),

  $(id) { return document.getElementById(id); },
  speeds() { return Game.stats && Game.stats.powers.has('heaven') ? [1, 2, 3, 5, 10] : [1, 2, 3, 5]; },
  renderSpeeds() { this.$('speed').innerHTML = this.speeds().map(v => `<button data-speed="${v}"${v === 10 ? ' class="heaven" title="Céu Acelerado: o tempo acelera"' : ''}>${v}x</button>`).join(''); },
  titleOpen() { const t = this.$('title-screen'); return !!t && !t.classList.contains('hidden'); },

  qtyBar() {
    const q = Game.buyQty();
    return `<div class="qty-bar"><span>Comprar</span>${QTY_STEPS.map(n => `<button data-act="qty" data-id="${n}" class="${q === n ? 'on' : ''}">×${n}</button>`).join('')}</div>`;
  },
  qtyInfo(costFn, rank, max, money) {
    const q = Game.buyQty();
    const b = Stats.bulk(costFn, rank, max, q, money);
    return { n: b.n, cost: b.cost, can: b.n > 0 && money >= b.cost, first: b.cost };
  },
  dirty(...k) { for (const x of k) this.dirt.add(x); },

  titleUnlocks() { return Game.sharedUnlocks(); },

  rarityTag(r) { const R = HERO_RARITY[r]; return `<span class="rtag" style="color:${R.color};border-color:${U.rgba(R.color, 0.5)}">${R.name}</span>`; },

  showTitle() {
    this.titleMode = 'new';
    const el = this.$('title-screen');
    el.classList.remove('hidden');
    const P = Game.profile || Game.loadProfile();
    Game.syncExclFound();
    const slots = [1, 2, 3].map(n => Game.peekSave(n));
    if (!this.selSlot || slots[this.selSlot - 1]) this.selSlot = Game.freeSlot();
    const un = this.titleUnlocks();
    if (!un.classes.includes(this.selCls)) this.selCls = un.classes[0];
    if (!un.species.includes(this.selSp)) this.selSp = 'human';
    let h = '<canvas class="bg" id="ts-bg"></canvas><div class="ts-wrap">';
    h += `<div class="ts-logo"><img class="ts-icon" src="img/icon-192.png" alt=""><h1>OverLevelGame</h1></div>`;
    h += `<div class="ts-tag">Escolha sua classe e espécie e deixe seu herói explorar masmorras infinitas sozinho: abrir baús, resgatar aliados, encontrar armas lendárias e ficar cada vez mais forte, até quando você não está olhando.</div>`;
    h += `<div class="ts-community"><a class="btn small discord" href="${DISCORD_URL}" target="_blank" rel="noopener noreferrer">💬 Discord da OverLevel</a><span>Novidades, dúvidas e o placar com a galera.</span><button class="btn small" id="ts-code" title="Recompensa para quem criou uma arma ou classe do jogo">🎁 Código de criador</button></div>`;
    if (Online.enabled) {
      const name = Online.profile ? U.esc(Online.profile.name) : '';
      h += `<div class="ts-account">${!Online.ready ? '<span>Conectando ao servidor…</span>'
        : Online.loggedIn ? `<span>👤 <b>${name}</b> · ☁ perfil e slots salvos na nuvem</span><button class="btn small" id="ts-board">🏆 Placar</button><button class="btn small" id="ts-pass">🔑 Trocar senha</button><button class="btn small ghost" id="ts-logout">Sair da conta</button>`
        : `<span>Entre com uma conta para salvar na nuvem e aparecer no placar.</span><button class="btn small gold" id="ts-login">Entrar / Criar conta</button><button class="btn small" id="ts-board">🏆 Placar</button>`}</div>`;
      if (Online.error) h += `<div class="ts-warn">${U.esc(Online.error)}</div>`;
    }
    if (!Store.ok) h += `<div class="ts-warn">⚠ Este navegador está bloqueando o salvamento (aba anônima ou navegador de aplicativo, como o do WhatsApp/Discord/Instagram). O progresso se perde ao fechar. Abra o jogo no Chrome, Edge ou Firefox${Online.enabled ? ' ou entre com uma conta para salvar na nuvem' : ''}.</div>`;
    const soulImg = `<img src="${Sprites.soulUrl()}" alt="">`;
    h += `<div class="ts-profile"><span class="tp-souls">${soulImg}<b>${U.fmt(P.souls)}</b> Almas</span><span><b>${P.stats.ascensions || 0}</b> ${(P.stats.ascensions || 0) === 1 ? 'ascensão' : 'ascensões'}</span><span>Recorde: <b>zona ${P.stats.maxZone || 1}</b></span><span><b>${un.classes.length}</b>/${CLASS_ORDER.length} classes · <b>${un.species.length}</b>/${SPECIES_ORDER.length} espécies</span>${P.vault.length ? `<span class="c6">🌈 ${P.vault.length} arma${P.vault.length > 1 ? 's' : ''} exclusiva${P.vault.length > 1 ? 's' : ''} para o próximo herói</span>` : ''}</div>`;
    h += '<div class="ts-slots">';
    slots.forEach((sv, i) => {
      const n = i + 1;
      if (sv) {
        const cl = CLASSES[sv.cls] ? sv.cls : 'fighter', spId = SPECIES[sv.species] ? sv.species : 'human';
        const c = CLASSES[cl], sp = SPECIES[spId];
        h += `<div class="ts-slot full"><div class="sl-n">Slot ${n}${sv.pendingEnd ? ' · <span style="color:#ff8a9a">Fim de jogo</span>' : ''}</div><img src="${Sprites.classUrl(cl, spId, 3)}" alt="">
          <div class="info"><b>${U.esc(sv.name)}</b>
          <span>${c.name}${sv.cls2 && CLASSES[sv.cls2] ? ' / ' + CLASSES[sv.cls2].name : ''} · ${sp.name}${sv.species2 && SPECIES[sv.species2] ? ' / ' + SPECIES[sv.species2].name : ''}</span>
          <span>Nível ${sv.level} · Zona ${sv.zone} · Melhor desta jornada: ${sv.maxZone || sv.zone}</span>
          <span class="sl-t">${sv.lastSave ? 'Salvo em ' + new Date(sv.lastSave).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}${sv.owner && Online.loggedIn && sv.owner === Online.user.id ? ' · ☁' : ''}</span></div>
          <div class="sl-btns"><button class="btn gold" data-cont="${n}">Continuar</button><button class="btn small danger" data-del="${n}">Apagar</button></div></div>`;
      } else {
        h += `<div class="ts-slot empty${this.selSlot === n ? ' sel' : ''}" data-newslot="${n}"><div class="sl-n">Slot ${n}</div><div class="sl-empty">Vazio</div><div class="hint">${this.selSlot === n ? 'O novo herói será criado aqui ↓' : 'Clique para criar um herói aqui'}</div></div>`;
      }
    });
    h += '</div>';
    const full = !this.selSlot;
    h += '<div class="ts-grid"><div class="ts-left">';
    h += `<div class="ts-h">${full ? 'Slots cheios. ' : `Novo herói no slot ${this.selSlot}. `}Classes <span>${un.classes.length}/${CLASS_ORDER.length} desbloqueadas</span></div><div class="pick-grid">`;
    for (const id of CLASS_ORDER) {
      const c = CLASSES[id], lk = !un.classes.includes(id), R = HERO_RARITY[c.rarity];
      h += `<div class="pick${lk ? ' locked' : ''}${id === this.selCls ? ' sel' : ''}" data-pick="class" data-id="${id}" style="--rc:${R.color}"><img src="${Sprites.classUrl(id, 'human', 3)}" alt=""><div class="pn">${c.name}</div>${lk ? '<div class="lk">🔒</div>' : ''}</div>`;
    }
    h += `</div><div class="ts-h">Espécie <span>${un.species.length}/${SPECIES_ORDER.length} desbloqueadas</span></div><div class="pick-grid sp">`;
    for (const id of SPECIES_ORDER) {
      const sp = SPECIES[id], lk = !un.species.includes(id), R = HERO_RARITY[sp.rarity];
      h += `<div class="pick${lk ? ' locked' : ''}${id === this.selSp ? ' sel' : ''}" data-pick="species" data-id="${id}" style="--rc:${R.color}"><img src="${Sprites.speciesUrl(id, 3)}" alt=""><div class="pn">${sp.name}</div>${lk ? '<div class="lk">🔒</div>' : ''}</div>`;
    }
    h += '</div></div><div class="ts-right"><div class="ts-detail" id="ts-detail"></div>';
    h += `<div class="ts-start"><input id="ts-name" maxlength="16" value="${U.esc(U.pick(HERO_NAMES))}" placeholder="Nome do herói"><button class="btn" id="ts-dice" title="Nome aleatório">Sortear</button></div>`;
    if ((P.soulUpg.head || 0) > 0) h += `<label class="ts-hc ts-zero"><input type="checkbox" id="ts-zero"><div><b>Começar da zona 1</b><span>Ignora o Atalho Astral e começa a jornada do início.</span></div></label>`;
    const found = Object.keys(P.exclFound || {}).filter(id => EXCLUSIVES[id]);
    if (found.length) {
      h += `<div class="ts-excl"><div class="ts-h">Armas exclusivas <span>${found.length}/${Object.keys(EXCLUSIVES).length} encontradas</span></div><div class="ex-chips">`;
      for (const id of found) h += `<span class="ex-chip"><img src="${Sprites.itemUrl({ sprite: EXCLUSIVES[id].sprite, rarity: EXCL_RARITY, excl: id, matColor: '#ffffff' })}" alt=""><b class="c7">${EXCLUSIVES[id].name}</b></span>`;
      h += '</div>';
      for (const slot of EXCL_SLOTS) {
        const opts = found.filter(id => EXCLUSIVES[id].slot === slot);
        if (!opts.length) continue;
        const cur = Game.exclChoice(slot);
        h += `<label class="ex-row"><span>${slot === 'weapon' ? 'Arma principal' : 'Arma secundária'}</span><select class="sel" data-excl="${slot}"><option value="">Nenhuma (começar sem)</option>${opts.map(id => `<option value="${id}" ${cur === id ? 'selected' : ''}>${EXCLUSIVES[id].name}</option>`).join('')}</select></label>`;
      }
      h += '<div class="hint" style="margin:6px 0 0">O novo herói começa com o que estiver escolhido aqui. O Baú Arco-Íris nunca repete uma exclusiva que você já encontrou.</div></div>';
    }
    h += `<div class="ts-start"><button class="btn gold big" id="ts-go" ${full ? 'disabled' : ''}>Começar Jornada</button></div>`;
    if (full) h += '<div class="hint" style="text-align:center">Os 3 slots estão ocupados. Continue um deles, ascenda ou apague um para criar outro herói.</div>';
    h += '</div></div>';
    h += '<div class="ts-foot">Almas, Altar, conquistas, Armas Ancestrais e as classes e espécies liberadas são do seu perfil e valem para todos os slots. Cada slot é uma jornada: ao ascender ou no Fim de Jogo ela termina, as Almas vão para o perfil e o slot fica livre para o próximo herói.<br>Role o mouse sobre o mapa para aproximar · <b>P</b> pausa · <b>1</b> a <b>4</b> velocidade · O jogo salva automaticamente</div></div>';
    el.innerHTML = h;

    el.querySelectorAll('[data-pick]').forEach(card => card.addEventListener('click', () => {
      Sfx.init(); Sfx.play('click');
      if (card.dataset.pick === 'class') this.selCls = card.dataset.id; else this.selSp = card.dataset.id;
      el.querySelectorAll(`[data-pick="${card.dataset.pick}"]`).forEach(c => c.classList.toggle('sel', c === card));
      this.renderTitleDetail();
    }));
    el.querySelectorAll('[data-cont]').forEach(b => b.onclick = () => {
      Sfx.init(); this.hideTitle();
      Game.load(+b.dataset.cont); Game.start();
      if (Game.state.pendingEnd) setTimeout(() => this.gameOverModal(), 50);
    });
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      const n = +b.dataset.del, sv = Game.peekSave(n);
      this.confirm('Apagar slot', `Apagar a jornada de <b>${U.esc(sv ? sv.name : '')}</b> (slot ${n})? Ela termina sem render Almas. O perfil (Almas, Altar, liberações e Armas Ancestrais) continua, e as armas exclusivas voltam para o próximo herói.`, 'Apagar', () => { Game.deleteSlot(n); this.selSlot = n; this.showTitle(); }, 'danger');
    });
    el.querySelectorAll('[data-newslot]').forEach(b => b.onclick = () => { Sfx.init(); Sfx.play('click'); this.selSlot = +b.dataset.newslot; this.showTitle(); });
    if (this.$('ts-login')) this.$('ts-login').onclick = () => { Sfx.init(); this.loginModal('in'); };
    if (this.$('ts-board')) this.$('ts-board').onclick = () => { Sfx.init(); this.boardModal(); };
    if (this.$('ts-pass')) this.$('ts-pass').onclick = () => { Sfx.init(); this.changePasswordModal(); };
    if (this.$('ts-code')) this.$('ts-code').onclick = () => { Sfx.init(); this.codeModal(); };
    el.querySelectorAll('[data-excl]').forEach(sel => sel.onchange = () => { Game.setExclChoice(sel.dataset.excl, sel.value || null); Sfx.play('click'); });
    if (this.$('ts-logout')) this.$('ts-logout').onclick = () => this.confirm('Sair da conta', 'Seu perfil e seus heróis continuam guardados na nuvem e voltam quando você entrar de novo. As cópias deste navegador serão removidas.', 'Sair da conta', async () => { await Online.signOut(); this.showTitle(); });
    const dice = this.$('ts-dice');
    if (dice) dice.onclick = () => { this.$('ts-name').value = U.pick(HERO_NAMES); };
    this.$('ts-go').onclick = () => {
      Sfx.init();
      const un2 = this.titleUnlocks();
      if (!un2.classes.includes(this.selCls) || !un2.species.includes(this.selSp)) { this.notice('Essa combinação ainda está bloqueada.', 'var(--red)'); return; }
      if (!this.selSlot) { this.notice('Os 3 slots estão ocupados. Apague um para começar outro herói.', 'var(--red)'); return; }
      const hc = false;
      const zero = !!(this.$('ts-zero') && this.$('ts-zero').checked);
      const name = (this.$('ts-name').value || '').trim() || U.pick(HERO_NAMES);
      this.hideTitle();
      Game.slot = this.selSlot;
      Game.newGame(this.selCls, this.selSp, name, hc, { fromStart: zero });
      Game.start();
    };
    this.renderTitleDetail();
    Music.title();
    this.animTitle();
  },

  renderTitleDetail() {
    const box = this.$('ts-detail');
    if (!box) return;
    const un = this.titleUnlocks();
    const c = CLASSES[this.selCls], s = SPECIES[this.selSp];
    const clk = !un.classes.includes(this.selCls), slk = !un.species.includes(this.selSp);
    let h = `<canvas id="ts-preview" width="120" height="120"></canvas>`;
    h += `<div class="td-name" style="color:${c.color}">${c.name} ${this.rarityTag(c.rarity)}</div><div class="td-ttl">${c.title}</div>`;
    if (clk) h += `<div class="td-lock">🔒 ${unlockText(c.unlock)}</div>`;
    h += `<div class="td-ds">${c.desc}</div><div class="cls-bars">`;
    for (const [k, v] of Object.entries(c.bars)) h += `<div class="b"><span>${k}</span><div class="pips">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= v ? 'on' : ''}"></i>`).join('')}</div></div>`;
    h += '</div>';
    if (c.innate) h += `<div class="td-innate"><b>✦ ${c.innate.name}</b> ${c.innate.desc}</div>`;
    h += '<div class="cls-skills">';
    for (const id of c.skills) h += `<div><b style="color:${SKILLS[id].color}">${SKILLS[id].name}</b>${SKILLS[id].unlock > 1 ? ` · nv ${SKILLS[id].unlock}` : ''}</div>`;
    h += '</div>';
    h += `<div class="td-sp"><img src="${Sprites.speciesUrl(this.selSp, 2)}" alt=""><div><div class="td-name sm">${s.name} ${this.rarityTag(s.rarity)}</div><div class="td-ds">${s.desc}</div></div></div>`;
    if (slk) h += `<div class="td-lock">🔒 ${unlockText(s.unlock)}</div>`;
    h += '<div class="td-traits">' + s.traits.map(([n, d]) => `<div><b>${n}:</b> ${d}</div>`).join('') + '</div>';
    box.innerHTML = h;
    const go = this.$('ts-go');
    if (go) go.disabled = clk || slk;
  },

  hideTitle() {
    this.$('title-screen').classList.add('hidden');
    if (this.titleAnim) cancelAnimationFrame(this.titleAnim);
    this.titleAnim = null;
  },

  animTitle() {
    if (this.titleAnim) cancelAnimationFrame(this.titleAnim);
    const bg = this.$('ts-bg');
    const ctx = bg.getContext('2d');
    const parts = [];
    let last = performance.now();
    const step = (ts) => {
      const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
      Music.update();
      if (bg.width !== innerWidth || bg.height !== innerHeight) { bg.width = innerWidth; bg.height = innerHeight; }
      ctx.clearRect(0, 0, bg.width, bg.height);
      if (parts.length < 90) parts.push({ x: Math.random() * bg.width, y: bg.height + 10, v: U.rand(15, 50), s: U.rand(1, 3), c: Math.random() < 0.7 ? '#f2a94a' : '#b874ff', w: U.rand(0, 6) });
      for (const p of parts) {
        p.y -= p.v * dt; p.x += Math.sin(ts / 1000 + p.w) * 10 * dt;
        ctx.globalAlpha = Math.min(1, p.y / bg.height) * 0.8;
        ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.s, p.s);
      }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].y < -10) parts.splice(i, 1);
      ctx.globalAlpha = 1;
      const pv = this.$('ts-preview');
      if (pv) {
        const g = pv.getContext('2d');
        g.clearRect(0, 0, 120, 120); g.imageSmoothingEnabled = false;
        const col = CLASSES[this.selCls].color;
        const gr = g.createRadialGradient(60, 66, 0, 60, 66, 58);
        gr.addColorStop(0, U.rgba(col, 0.35)); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 120, 120);
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(60, 110, 26, 7, 0, 0, 7); g.fill();
        const s = Sprites.get(CLASSES[this.selCls].sprite, Sprites.heroPal(this.selCls, this.selSp));
        const bob = Math.round(Math.sin(ts / 300) * 3);
        g.drawImage(s.c, 60 - s.sw * 3, 112 - s.sh * 6 + bob, s.sw * 6, s.sh * 6);
      }
      this.titleAnim = requestAnimationFrame(step);
    };
    this.titleAnim = requestAnimationFrame(step);
  },

  initGame() {
    this.$('app').classList.remove('hidden');
    const st = Game.state;
    this.$('ico-gold').src = Sprites.goldUrl();
    this.$('ico-soul').src = Sprites.soulUrl();
    this.$('btn-settings').innerHTML = ICONS.gear;
    this.$('btn-exit').innerHTML = ICONS.exit;
    this.$('btn-board').innerHTML = ICONS.trophy;
    this.$('btn-board').classList.toggle('hidden', !Online.enabled);
    this.$('tabs').innerHTML = TABS.map(([id, nm]) => `<button data-tab="${id}" class="${id === this.tab ? 'on' : ''}">${nm}</button>`).join('');
    this.renderSpeeds();
    const pc = this.$('portrait').getContext('2d');
    pc.clearRect(0, 0, 40, 40); pc.imageSmoothingEnabled = false;
    const spr = Sprites.get(CLASSES[st.cls].sprite, Sprites.heroPal(st.cls, st.species));
    pc.drawImage(spr.c, 2, 2, 36, 36);
    this.$('log-filters').innerHTML = [['all', 'Tudo'], ['loot', 'Saque'], ['events', 'Eventos']].map(([k, n]) => `<button data-lf="${k}" class="${k === this.logFilter ? 'on' : ''}">${n}</button>`).join('');
    this.buildSkillbar();
    if (!this.bound) this.bind();
    this.dirty('top', 'zone', 'equip', 'talents', 'train', 'forge', 'asc', 'ach', 'hall');
    this.selecting = false; this.picked.clear();
    this.renderTab(true);
  },

  bind() {
    this.bound = true;
    this.$('tabs').addEventListener('click', e => {
      const b = e.target.closest('[data-tab]'); if (!b) return;
      this.tab = b.dataset.tab;
      this.$('tabs').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      Sfx.play('click');
      this.renderTab(true);
    });
    this.$('speed').addEventListener('click', e => {
      const b = e.target.closest('[data-speed]'); if (!b) return;
      Game.speed = +b.dataset.speed; Game.state.settings.speed = Game.speed; this.dirty('top');
    });
    this.$('zone-prev').onclick = () => Game.setZone(Game.state.zone - 1);
    this.$('btn-mode').onclick = () => Game.toggleMode();
    this.$('btn-pause').onclick = () => this.setPause(!Game.paused);
    this.$('pause-veil').onclick = () => this.setPause(false);
    this.$('btn-sound').onclick = () => {
      const s = Game.state.settings; s.sound = !s.sound; Sfx.enabled = s.sound; Sfx.init(); this.dirty('top');
    };
    this.$('btn-settings').onclick = () => this.settingsModal();
    this.$('btn-exit').onclick = () => this.exitPrompt();
    this.$('btn-board').onclick = () => this.boardModal();
    this.$('log-filters').addEventListener('click', e => {
      const b = e.target.closest('[data-lf]'); if (!b) return;
      this.logFilter = b.dataset.lf;
      this.$('log-filters').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      this.renderLog();
    });
    const body = this.$('tab-body');
    body.addEventListener('click', e => this.onPanelClick(e));
    body.addEventListener('change', e => this.onPanelChange(e));
    document.addEventListener('mouseover', e => this.onHover(e));
    document.addEventListener('mousemove', e => { if (!this.$('tooltip').classList.contains('hidden')) this.placeTip(e.clientX, e.clientY); });
    document.addEventListener('mouseout', e => { if (e.target.closest('[data-uid],[data-skill],[data-tip]') && !e.relatedTarget?.closest?.('[data-uid],[data-skill],[data-tip]')) this.hideTip(); });
    document.addEventListener('click', e => { if (!e.target.closest('#menu') && !e.target.closest('[data-uid]') && !e.target.closest('[data-keepmenu]')) this.closeMenu(); });
    body.addEventListener('contextmenu', e => {
      const el = e.target.closest('.inv-grid [data-uid]');
      if (!el) return;
      e.preventDefault();
      const f = Game.findItem(el.dataset.uid);
      if (!f || f.where !== 'inv') return;
      this.quickSell(f.item, e.shiftKey);
    });
    this.$('menu').addEventListener('click', e => this.onMenu(e));
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || !Game.running) return;
      if (e.key === 'p' || e.key === 'P') this.setPause(!Game.paused);
      const sp = { 1: 1, 2: 2, 3: 3, 4: 5 }[e.key];
      const sp2 = e.key === '5' && this.speeds().includes(10) ? 10 : sp;
      if (sp2) { Game.speed = sp2; Game.state.settings.speed = sp2; this.dirty('top'); }
      if (e.key === 'Escape') { this.closeMenu(); this.closeModal(); }
    });
  },

  setPause(p) {
    Game.paused = p;
    this.$('pause-veil').classList.toggle('hidden', !p);
    this.dirty('top');
  },

  tick(dt) {
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.1; this.updateHud(); this.updateSkillbar(); }
    this.tickT -= dt;
    if (this.tickT > 0) return;
    this.tickT = 0.25;
    if (this.dirt.has('top') || this.dirt.has('zone')) { this.updateTop(); this.dirt.delete('top'); this.dirt.delete('zone'); }
    if (this.dirt.has('gold')) { this.dirt.delete('gold'); this.refreshGold(); }
    const map = { equip: 'equip', talents: 'talents', train: 'train', forge: 'forge', asc: 'asc', ach: 'ach', hall: 'hall' };
    const key = map[this.tab];
    if (this.dirt.has(key)) {
      const now = performance.now();
      const minGap = key === 'equip' ? 600 : key === 'ach' ? 1500 : 300;
      if (!this.renderT[key] || now - this.renderT[key] > minGap) {
        this.dirt.delete(key);
        this.renderT[key] = now;
        this.renderTab(false);
      }
    }
    const free = Stats.talentFree(Game.state);
    const tb = this.$('tabs').querySelector('[data-tab="talents"]');
    if (tb) {
      const want = free > 0 && !Game.state.settings.autoTalent ? `Talentos<span class="dot">${free}</span>` : 'Talentos';
      if (tb.innerHTML !== want) tb.innerHTML = want;
    }
  },

  updateTop() {
    const st = Game.state, S = Game.stats;
    const set = (id, v) => { const e = this.$(id); if (e.textContent !== String(v)) e.textContent = v; };
    set('hero-name', st.name);
    set('hero-sub', `${Game.className()} · Nível ${st.level}`);
    const need = Stats.needXpFor(st);
    this.$('xp-fill').style.width = (st.xp / need * 100).toFixed(1) + '%';
    set('xp-text', `${U.fmt(st.xp)} / ${U.fmt(need)} XP`);
    set('gold', U.fmt(st.gold));
    set('souls', U.fmt(st.souls));
    set('power', U.fmt(Game.power));
    set('zone-num', `Zona ${st.zone}`);
    set('zone-biome', MapGen.biomeOf(st.zone).name);
    this.$('zone-prev').disabled = st.zone <= 1;
    const mb = this.$('btn-mode');
    mb.className = 'mode-btn ' + (st.mode === 'advance' ? 'advance' : 'farm');
    mb.textContent = st.mode === 'advance' ? '▲ Avançar' : '⟳ Farmar';
    const spk = this.speeds().join();
    if (this._spk !== spk) { this._spk = spk; this.renderSpeeds(); }
    if (Game.speed > 5 && !this.speeds().includes(Game.speed)) { Game.speed = 5; Game.state.settings.speed = 5; }
    this.$('speed').querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.speed === Game.speed));
    this.$('btn-pause').innerHTML = Game.paused ? ICONS.play : ICONS.pause;
    this.$('btn-sound').innerHTML = st.settings.sound ? ICONS.sound : ICONS.mute;
    this.$('btn-sound').classList.toggle('on', st.settings.sound);
  },

  updateHud() {
    const W = Game.W, st = Game.state;
    if (!W) return;
    const h = W.hero;
    const exp = Math.round(World.exploredPct(W) * 100);
    const opened = W.chests.filter(c => c.opened).length;
    let tag = '';
    if (st.mode === 'farm') tag = '<span class="ztag farm">FARMANDO</span>';
    else if (st.retreatLeft > 0) tag = `<span class="ztag retreat">RECUANDO · ${st.retreatLeft}</span>`;
    else tag = '<span class="ztag adv">AVANÇANDO</span>';
    const zh = `<div class="zt">Zona ${W.z}${W.isLord ? ' · Covil' : ''}</div><div class="zb">${W.biome.name}</div><div class="zr"><span>Inimigos <b>${W.killed}/${W.total}</b></span><span>Baús <b>${opened}/${W.chests.length}</b></span><span><b>${exp}%</b></span></div>${tag}`;
    if (this._zh !== zh) { this.$('hud-zone').innerHTML = zh; this._zh = zh; }
    this.$('hp-fill').style.width = (h.hp / h.maxHp * 100).toFixed(1) + '%';
    this.$('shield-fill').style.width = Math.min(100, h.shield / h.maxHp * 100).toFixed(1) + '%';
    const ht = h.dead ? 'Derrotado' : `${U.fmt(Math.min(Math.ceil(h.hp), Math.ceil(h.maxHp)))} / ${U.fmt(Math.ceil(h.maxHp))}${h.shield > 0 ? ` (+${U.fmt(h.shield)})` : ''}`;
    if (this.$('hp-text').textContent !== ht) this.$('hp-text').textContent = ht;
    const stt = h.dead ? `Revivendo em ${Math.ceil(h.deathT)}s…` : h.status;
    if (this.$('hero-status').textContent !== stt) this.$('hero-status').textContent = stt;
    const pm = Game.stats.potionMax;
    const pk = st.potions + '/' + pm;
    if (this._pk !== pk) {
      this._pk = pk;
      const url = Sprites.potionUrl();
      let ph = '';
      ph += Array.from({ length: pm }, (_, i) => `<img src="${url}" class="${i < st.potions ? '' : 'empty'}" alt="">`).join('');
      this.$('potions').innerHTML = ph;
    }
    const bh = h.buffs.map(b => `<span class="buff" style="border-color:${b.color};color:${b.color}">${b.name} ${Math.ceil(b.t)}s</span>`).join('');
    if (this._bh !== bh) { this.$('buffs').innerHTML = bh; this._bh = bh; }
    const b = W.boss;
    const showBoss = b && !b.dead && b.aggro && !h.dead;
    this.$('hud-boss').classList.toggle('hidden', !showBoss);
    if (showBoss) {
      if (this.$('boss-name').textContent !== b.name) this.$('boss-name').textContent = b.name;
      this.$('boss-fill').style.width = (b.hp / b.maxHp * 100).toFixed(1) + '%';
      this.$('boss-text').textContent = `${U.fmt(Math.max(0, b.hp))} / ${U.fmt(b.maxHp)}`;
    }
  },

  skillbarIds() {
    const st = Game.state, sp = SPECIES[st.species];
    return [...Stats.activeIds(st), ...(sp && sp.skill ? [sp.skill] : [])];
  },
  buildSkillbar() {
    let h = '';
    for (const id of this.skillbarIds()) {
      const sk = SKILLS[id];
      if (sk.racial) h += '<div class="sb-sep"></div>';
      h += `<div class="skill${sk.racial ? ' racial' : ''}" data-skill="${id}" id="sk-${id}"><img src="${Sprites.skillUrl(sk.icon, sk.color, 52)}" alt=""><div class="cd" style="transform:scaleY(0)"></div><div class="cdt"></div><div class="rk"></div><div class="lk"></div></div>`;
    }
    this.$('skillbar').innerHTML = h;
  },
  updateSkillbar() {
    const st = Game.state, W = Game.W;
    if (!W) return;
    const h = W.hero, S = Game.stats;
    for (const id of this.skillbarIds()) {
      const el = this.$('sk-' + id);
      if (!el) continue;
      const sk = SKILLS[id], r = sk.racial ? U.clamp(1 + Math.floor(st.level / 8), 1, 10) : st.talents[id] || 0;
      const locked = st.level < sk.unlock || !r;
      el.classList.toggle('locked', locked);
      const lk = el.querySelector('.lk');
      const lkt = st.level < sk.unlock ? `Nível ${sk.unlock}` : !r ? 'Sem pontos' : '';
      if (lk.textContent !== lkt) lk.textContent = lkt;
      el.querySelector('.rk').textContent = r ? r : '';
      const cd = Math.max(0, h.skillCd[id] || 0), max = sk.cd * (1 - S.cdr / 100);
      el.querySelector('.cd').style.transform = `scaleY(${locked ? 0 : U.clamp(cd / max, 0, 1).toFixed(3)})`;
      el.querySelector('.cdt').textContent = !locked && cd > 0.05 ? (cd >= 10 ? Math.ceil(cd) : cd.toFixed(1)) : '';
      el.classList.toggle('ready', !locked && cd <= 0.05);
    }
  },
  skillFlash(id) {
    const el = this.$('sk-' + id);
    if (!el) return;
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  },

  refreshGold() {
    const st = Game.state, body = this.$('tab-body');
    if (this.tab !== 'train' && this.tab !== 'forge') return;
    body.querySelectorAll('[data-cost]').forEach(el => {
      const ok = st.gold >= +el.dataset.cost;
      if (el.tagName === 'BUTTON') el.disabled = !ok;
      else el.style.color = ok ? 'var(--gold)' : 'var(--red)';
    });
    const g = this.$('train-gold');
    if (g) g.textContent = U.fmt(st.gold);
  },

  renderTab(full) {
    const body = this.$('tab-body');
    const scroll = body.scrollTop;
    const fn = this['tab_' + this.tab];
    if (fn) body.innerHTML = fn.call(this);
    if (!full) body.scrollTop = scroll; else body.scrollTop = 0;
    this.renderT[this.tab] = performance.now();
  },

  itemHtml(it, opts = {}) {
    if (!it) return `<div class="item empty"></div>`;
    const up = opts.inv && Stats.compareItem(it) > 0.002;
    return `<div class="item r${it.rarity}${it.isNew && opts.inv ? ' new' : ''}" data-uid="${it.uid}"><img src="${Sprites.itemUrl(it)}" alt="">${it.plus ? `<span class="plus">+${it.plus}</span>` : ''}<span class="lvl">${it.ilvl}</span>${it.locked ? '<span class="lock">🔒</span>' : ''}${up ? '<span class="up">▲</span>' : ''}</div>`;
  },

  tab_equip() {
    const st = Game.state, S = Game.stats;
    let h = `<div class="sec"><div class="sec-h"><h3>Equipamento</h3><span class="sub">Poder <b style="color:#ffd9a0">${U.fmt(Game.power)}</b></span></div><div class="equip-grid" style="grid-template-columns:1fr 1fr">`;
    for (const s of EQUIP_SLOTS) {
      const it = st.equip[s];
      h += `<div class="eslot${it ? '' : ' empty'}">${this.itemHtml(it)}<div class="info"><div class="lbl">${SLOT_NAMES[s]}</div><div class="nm ${it ? 'c' + it.rarity : ''}">${it ? U.esc(it.name) + (it.plus ? ` +${it.plus}` : '') : s === 'offhand' ? 'Vazio · só armas exclusivas' : 'Vazio'}</div></div></div>`;
    }
    h += '</div>' + this.relicCard(st.cls, true) + '</div>';
    const K = 30 * enemyAtkScale(st.zone);
    const red = Math.min(0.85, S.def / (S.def + K)) * 100;
    const rows = [
      ['Vida', U.fmt(S.maxHp)], ['Dano', U.fmt(S.atk)],
      ['Armadura', `${U.fmt(S.def)} <span style="color:var(--muted);font-weight:400">(${U.fmtNum(red, 0)}%)</span>`], ['Vel. de Ataque', U.fmtNum(S.atkSpd, 2) + '/s'],
      ['Chance Crítica', U.fmtPct(S.crit)], ['Dano Crítico', U.fmtPct(S.critDmg, 0)],
      ['Esquiva', U.fmtPct(S.dodge)], ['Bloqueio', U.fmtPct(S.block)],
      ['Roubo de Vida', U.fmtPct(S.lifesteal)], ['Regeneração', U.fmt(S.regen) + '/s'],
      ['Vel. Movimento', U.fmtNum(S.moveSpd, 2)], ['Redução Recarga', U.fmtPct(S.cdr)],
      ['Ouro Extra', U.fmtPct(S.goldPct, 0)], ['Experiência', U.fmtPct(S.xpPct, 0)],
      ['Sorte', U.fmtPct(S.mf, 0)], ['Dano a Chefes', U.fmtPct(S.bossDmg, 0)],
    ];
    if (S.minion) rows.push(['Poder Lacaios', U.fmtPct(S.minion, 0)]);
    if (S.dr) rows.push(['Redução de Dano', U.fmtPct(S.dr, 0)]);
    h += `<div class="sec"><div class="sec-h"><h3>Atributos</h3></div><div class="stat-list">${rows.map(([a, b]) => `<div class="r"><span>${a}</span><span>${b}</span></div>`).join('')}</div>`;
    if (S.powers.size) h += `<div class="card" style="margin-top:10px">${[...S.powers].map(p => `<div style="margin-bottom:4px"><b style="color:var(--orange);font-family:var(--pixel)">✦ ${POWERS[p].name}</b> <span style="color:var(--muted);font-size:11px">${POWERS[p].desc}</span></div>`).join('')}</div>`;
    h += '</div>';
    const cap = Stats.invSize(st);
    const sel = this.selecting;
    h += `<div class="sec"><div class="sec-h"><h3>Mochila</h3><span class="sub">${st.inv.length}/${cap}</span></div>`;
    h += `<div class="inv-tools"><button class="btn small" data-act="bulkMenu" data-keepmenu>Vender ▾</button>
      <button class="btn small${sel ? ' gold' : ''}" data-act="selectMode">${sel ? 'Concluir seleção' : 'Selecionar p/ vender'}</button>
      <button class="btn small" data-act="sortInv">Ordenar</button>
      <select class="sel" data-set="autoSell" title="Vende automaticamente itens até essa raridade que não sejam melhorias (nunca vende exclusivas, itens travados ou forjados)">
        ${['Auto-venda: desligada', 'Auto-venda: Comuns', 'Auto-venda: até Incomuns', 'Auto-venda: até Raros', 'Auto-venda: até Épicos', 'Auto-venda: até Lendários', 'Auto-venda: até Míticos', 'Auto-venda: até Celestiais'].map((t, i) => `<option value="${i}" ${st.settings.autoSell === i ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
      <label class="chk"><input type="checkbox" data-set="autoEquip" ${st.settings.autoEquip ? 'checked' : ''}> Auto-equipar</label></div>`;
    if (sel) {
      let n = 0, g = 0;
      for (const it of st.inv) if (this.picked.has(it.uid) && !it.locked) { n++; g += Items.sellPrice(it); }
      h += `<div class="sel-bar"><span><b>${n}</b> ${n === 1 ? 'item selecionado' : 'itens selecionados'} · <b style="color:var(--gold)">${U.fmt(g)}</b> ouro</span>
        <span class="sb-btns"><button class="btn small" data-act="selAll">Todos</button><button class="btn small" data-act="selNone">Limpar</button>
        <button class="btn small danger" data-act="sellSelected" ${n ? '' : 'disabled'}>Vender</button></span></div>`;
    }
    h += `<div class="inv-grid${sel ? ' selecting' : ''}">`;
    for (const it of st.inv) {
      let ih = this.itemHtml(it, { inv: true });
      if (sel && this.picked.has(it.uid)) ih = ih.replace('class="item', 'class="item picked');
      h += ih;
    }
    for (let i = st.inv.length; i < cap; i++) h += '<div class="item empty"></div>';
    h += `</div><div class="hint" style="margin-top:8px">${sel ? 'Clique nos itens para marcá-los e depois em <b>Vender</b>. Itens travados nunca são vendidos.' : 'Clique em um item para equipar, vender ou travar. <b>Botão direito</b> vende na hora. <span class="up-g">▲</span> indica melhoria.'}</div></div>`;
    return h;
  },

  relicCard(cls, compact) {
    const st = Game.state, info = Stats.relicInfo(st, cls), def = RELICS[cls];
    if (!def) return '';
    if (!info) {
      return `<div class="relic-card locked"><div class="item empty"><img src="${Sprites.relicUrl(cls, 0)}" alt=""></div><div class="info"><div class="lbl">Arma Ancestral · ${CLASSES[cls].name}</div><div class="nm">${compact ? 'Ainda não encontrada' : def.name}</div><div class="ds">Encontre o <b>Cofre Ancestral</b> jogando de ${CLASSES[cls].name} a partir da zona ${RELIC_ZONE}. Só pode ser obtida uma vez.</div></div></div>`;
    }
    const R = RARITIES[info.r];
    const lines = Object.entries(info.stats).map(([k, v]) => k === 'atk' ? `+${U.fmt(v)} Dano (cresce com a zona recorde)` : Items.statLine(k, v)).join(' · ');
    const pw = info.powers.map(p => `<b style="color:var(--orange)">✦ ${POWERS[p].name}</b>`).join(' ');
    const nx = info.r < RELIC_MAX ? RARITIES[info.r + 1] : null;
    const block = Game.relicBlock(cls);
    let act = '';
    if (!compact && nx) act = `<button class="btn small purple" data-act="awaken" data-id="${cls}" ${block ? 'disabled' : ''}>Despertar → <span style="color:${nx.color}">${RELIC_RNAME[info.r + 1]}</span></button><div class="hint" style="margin:4px 0 0">${block || `Custa ${RELIC_COST[info.r + 1]} Fragmentos`}</div>`;
    else if (compact && nx) act = `<div class="hint" style="margin:4px 0 0">Próxima raridade: ${block || '<b style="color:var(--green)">pronta para despertar no Salão!</b>'}</div>`;
    return `<div class="relic-card" style="--rc:${R.color}"><div class="item r${info.r}"><img src="${Sprites.relicUrl(cls, info.r)}" alt=""></div><div class="info"><div class="lbl">Arma Ancestral · ${CLASSES[cls].name}${st.cls !== cls ? '' : ''}</div><div class="nm" style="color:${R.color}">${def.name} <span class="rtag" style="color:${R.color};border-color:${U.rgba(R.color, 0.5)}">${RELIC_RNAME[info.r]}</span></div><div class="ds">${lines}${pw ? '<br>' + pw : ''}${info.r < 3 ? `<br><span style="color:var(--muted)">Ganha o poder ${POWERS[def.powers[0]].name} ao despertar para Épica e ${POWERS[def.powers[1]].name} em Mítica.</span>` : info.r < 5 ? `<br><span style="color:var(--muted)">Ganha ${POWERS[def.powers[1]].name} em Mítica.</span>` : info.r < RELIC_MAX ? '<br><span style="color:var(--muted)">Em Celestial, o dano da arma e todos os bônus dela crescem ainda mais.</span>' : ''}</div>${act}</div></div>`;
  },

  tab_talents() {
    const st = Game.state, cls = CLASSES[st.cls], c2 = st.cls2 ? CLASSES[st.cls2] : null;
    const free = Stats.talentFree(st);
    let h = `<div class="sec"><div class="sec-h"><h3>Talentos de ${Game.className()}</h3><span class="pts-badge">${free} ${free === 1 ? 'ponto' : 'pontos'}</span></div>
      <div class="hint">Você ganha 1 ponto por nível. As habilidades ativas são lançadas automaticamente em combate.</div>
      <div class="inv-tools"><label class="chk"><input type="checkbox" data-set="autoTalent" ${st.settings.autoTalent ? 'checked' : ''}> Distribuir pontos automaticamente</label><button class="btn small" data-act="resetTalents" style="margin-left:auto">Redistribuir</button></div></div>`;
    const row = (id) => {
      const sk = SKILLS[id], r = st.talents[id] || 0, locked = st.level < sk.unlock;
      const can = Game.canTalent(id);
      const cur = sk.desc(Math.max(1, r));
      const nx = r > 0 && r < sk.max ? `<br><span class="nx">Próximo: ${sk.desc(r + 1).replace(/<\/?b>/g, '')}</span>` : '';
      return `<div class="up-row${locked ? ' locked' : ''}"><div class="ic"><img src="${Sprites.skillUrl(sk.icon, sk.color, 44)}" alt=""></div>
        <div><div class="nm" style="color:${r ? sk.color : 'inherit'}">${sk.name}<span class="rk">${r}/${sk.max}</span>${sk.ult ? '<span class="tag ult">SUPREMA</span>' : ''}${sk.cd ? `<span class="tag">${sk.cd}s</span>` : ''}</div>
        <div class="ds">${locked ? `<b>Desbloqueia no nível ${sk.unlock}.</b> ` : ''}${cur}${nx}</div></div>
        <div class="act"><button class="btn small gold" data-act="talent" data-id="${id}" ${can ? '' : 'disabled'}>+1</button></div></div>`;
    };
    const innate = (c, k) => c.innate ? `<div class="up-row innate"><div class="ic"><div class="glyph" style="color:${c.color}">✦</div></div><div><div class="nm" style="color:${c.color}">${c.innate.name}<span class="tag">INATO${k < 1 ? ' · 60%' : ''}</span></div><div class="ds">${c.innate.desc}</div></div><div></div></div>` : '';
    h += `<div class="sec"><div class="sec-h"><h3>Talento Inato</h3></div>${innate(cls, 1)}${c2 ? innate(c2, 0.6) : ''}</div>`;
    h += `<div class="sec"><div class="sec-h"><h3>Habilidades Ativas${c2 ? ' (' + cls.name + ')' : ''}</h3></div>` + cls.skills.map(row).join('') + '</div>';
    if (c2) h += `<div class="sec"><div class="sec-h"><h3>Habilidades Ativas (${c2.name})</h3></div>` + c2.skills.slice(0, 2).map(row).join('') + '</div>';
    h += `<div class="sec"><div class="sec-h"><h3>Passivas${c2 ? ' (' + cls.name + ')' : ''}</h3></div>` + cls.passives.map(row).join('') + '</div>';
    if (c2) h += `<div class="sec"><div class="sec-h"><h3>Passivas (${c2.name})</h3></div>` + c2.passives.map(row).join('') + '</div>';
    const mOpen = Stats.maestriaOpen(st);
    const mrow = m => {
      const r = st.talents[m.id] || 0, can = Game.canMaestria(m.id);
      const txt = v => Items.statLine(m.stat, v) + (m.also ? ' e ' + Items.statLine(m.also, v) : '');
      return `<div class="up-row${mOpen ? '' : ' locked'}"><div class="ic"><img src="${Sprites.skillUrl(m.icon, m.color, 44)}" alt=""></div>
        <div><div class="nm" style="color:${r ? m.color : 'inherit'}">${m.name}<span class="rk">${r}${m.max ? '/' + m.max : ''}</span></div>
        <div class="ds">${r ? txt(r * m.per) : 'Nenhum ainda'}<br><span class="nx">Próximo: ${txt((r + 1) * m.per)}</span></div></div>
        <div class="act"><button class="btn small gold" data-act="maestria" data-id="${m.id}" ${can ? '' : 'disabled'}>+1</button><button class="btn small" data-act="maestria10" data-id="${m.id}" ${can ? '' : 'disabled'}>+10</button></div></div>`;
    };
    h += `<div class="sec"><div class="sec-h"><h3>Maestria</h3><span class="sub">${mOpen ? 'sem limite de pontos' : 'nível ' + MAESTRIA_LVL}</span></div>
      <div class="hint">${mOpen ? 'Gaste aqui os pontos que sobram quando os talentos da classe estão no máximo. Não há limite de níveis (exceto Celeridade). Com a distribuição automática, os pontos extras vêm para cá sozinhos.' : `Desbloqueia no nível ${MAESTRIA_LVL}: talentos sem limite de nível para os pontos que sobrarem.`}</div>` + MAESTRIA.map(mrow).join('') + '</div>';
    return h;
  },

  tab_train() {
    const st = Game.state;
    const gold = `<img src="${Sprites.goldUrl()}" alt="">`;
    let h = `<div class="sec"><div class="sec-h"><h3>Campo de Treinamento</h3><span class="sub" style="display:flex;align-items:center;gap:5px;font:600 13px var(--pixel);color:var(--gold)"><img src="${Sprites.goldUrl()}" alt="" style="width:16px;height:16px;image-rendering:pixelated"><span id="train-gold">${U.fmt(st.gold)}</span></span></div><div class="hint">Melhorias compradas com ouro. São reiniciadas na Ascensão.</div>${this.qtyBar()}`;
    for (const t of TRAINING) {
      const r = st.training[t.id] || 0;
      const maxed = t.max && r >= t.max;
      const q = this.qtyInfo(x => Stats.trainCost(t, x), r, t.max, st.gold);
      h += `<div class="up-row"><div class="ic"><img src="${Sprites.skillUrl(t.icon, t.color, 44)}" alt=""></div>
        <div><div class="nm">${t.name}<span class="rk">Nv ${r}${t.max ? '/' + t.max : ''}</span></div>
        <div class="ds">Atual: <b>${r ? t.desc(Stats.trainVal(t, r), r) : 'nenhum'}</b>${maxed ? '' : `<br><span class="nx">${q.n > 1 ? `+${q.n} níveis` : 'Próximo'}: ${t.desc(Stats.trainVal(t, r + q.n), r + q.n)}</span>`}</div></div>
        <div class="act">${maxed ? '<span class="tag">MÁXIMO</span>' : `<div class="cost" data-cost="${q.first}" style="color:${q.can ? 'var(--gold)' : 'var(--red)'}">${gold}${U.fmt(q.cost)}</div>
        <button class="btn small gold" data-act="train" data-id="${t.id}" data-cost="${q.first}" ${q.can ? '' : 'disabled'}>Comprar${q.n > 1 ? ' ×' + q.n : ''}</button>`}</div></div>`;
    }
    return h + '</div>';
  },

  tab_forge() {
    const st = Game.state;
    let h = `<div class="sec"><div class="sec-h"><h3>Forja</h3><span class="sub">Aprimore seu equipamento</span></div>
      <div class="hint">Cada nível de aprimoramento multiplica os atributos principais do item por 1,08 (acumulativo: +10 dá ×2,16 e +20 dá ×4,66). A partir de +5 a forja pode falhar (o ouro é perdido, o item não).</div>
      <div class="forge-sel">`;
    for (const s of EQUIP_SLOTS) {
      const it = st.equip[s];
      if (s === 'offhand' && !it) continue;
      h += `<div data-act="forgeSel" data-slot="${s}" style="cursor:pointer">${it ? this.itemHtml(it).replace('class="item', `class="item${this.forgeSel === s ? ' sel' : ''}`) : `<div class="item empty${this.forgeSel === s ? ' sel' : ''}" title="${SLOT_NAMES[s]}"></div>`}</div>`;
    }
    h += '</div>';
    const it = st.equip[this.forgeSel];
    if (!it) {
      h += `<div class="card forge-box"><div class="forge-anvil">Nenhum item equipado em ${SLOT_NAMES[this.forgeSel]}.</div></div>`;
    } else {
      const cost = Items.forgeCost(it), ch = Items.forgeChance(it);
      const cur = Items.stats(it);
      const nxt = Items.stats(Object.assign({}, it, { plus: it.plus + 1 }));
      const lines = Object.keys(it.main).filter(k => !STAT_INFO[k].pct).map(k => `<div>${STAT_INFO[k].name}: <b>${U.fmt(cur[k])}</b> → <b class="up-g">${U.fmt(nxt[k])}</b></div>`).join('');
      h += `<div class="card forge-box"><div class="c${it.rarity}" style="font:600 15px var(--pixel)">${U.esc(it.name)}</div>
        <div class="big">+${it.plus} <span style="color:var(--muted);font-size:16px">→</span> +${it.plus + 1}</div>
        <div style="margin:8px 0;font-size:12px;display:grid;gap:2px">${lines}</div>
        <div class="chance" style="color:${ch >= 1 ? 'var(--green)' : ch >= 0.6 ? 'var(--gold)' : 'var(--red)'}">Chance de sucesso: ${Math.round(ch * 100)}%</div>
        <div class="meter" style="margin:8px auto;max-width:220px"><div style="width:${ch * 100}%"></div></div>
        <div class="cost" data-cost="${cost}" style="justify-content:center;display:flex;gap:6px;align-items:center;margin:8px 0;font:600 14px var(--pixel);color:${st.gold >= cost ? 'var(--gold)' : 'var(--red)'}"><img src="${Sprites.goldUrl()}" style="width:16px;height:16px;image-rendering:pixelated" alt="">${U.fmt(cost)}</div>
        <button class="btn gold" data-act="forge" data-cost="${cost}" ${st.gold >= cost ? '' : 'disabled'} style="min-width:160px">Forjar</button></div>`;
    }
    h += '</div>';
    h += this.fusionSection();
    return h;
  },

  fusionSection() {
    const st = Game.state, w = st.equip.weapon;
    let h = `<div class="sec"><div class="sec-h"><h3>Fusão de Armas · Multiclasse</h3><span class="sub">${Math.floor(st.shards || 0)} Fragmentos</span></div>
      <div class="hint">Funda sua arma com a arma de outra classe dominada: enquanto a arma fundida estiver equipada, você é <b>multiclasse</b> (habilidades das duas, +${MULTI_SYNERGY}% de Dano e Vida, ${Math.round((MULTI_XP - 1) * 100)}% mais XP por nível). Aprender cada fusão custa ${FUSION_SHARDS} Fragmentos uma única vez; depois, cada fusão custa só ouro. A fusão volta sozinha na arma inicial das próximas jornadas.</div>`;
    if (!Stats.multiclassOpen(st)) return h + `<div class="card" style="font-size:12px">🔒 Liberada após <b>${MULTI_ASC} ascensões</b> (você tem ${st.stats.ascensions}).</div></div>`;
    if (!Stats.mastered(st, st.cls)) return h + `<div class="card" style="font-size:12px">Domine <b>${CLASSES[st.cls].name}</b> primeiro: alcance a zona ${MASTERY_ZONE} numa jornada iniciada com ela.</div></div>`;
    if (!w) return h + '<div class="card" style="font-size:12px">Equipe uma arma para fundir.</div></div>';
    if (w.excl) return h + '<div class="card" style="font-size:12px">Armas exclusivas não podem ser fundidas. Equipe outra arma para virar multiclasse.</div></div>';
    if (w.fusion) h += `<div class="card fuse-cur"><img src="${Sprites.itemUrl(w)}" alt=""><div><b class="c${w.rarity}">${U.esc(w.name)}</b><div class="hint" style="margin:2px 0 0">Multiclasse ativa: <b>${Game.className()}</b></div></div><button class="btn small" data-act="unfuse">Desfazer</button></div>`;
    const opts = CLASS_ORDER.filter(c => c !== st.cls && Game.isUnlocked('class', c));
    h += '<div class="fuse-list">';
    for (const c of opts) {
      const block = Game.fuseBlock(c), learned = st.fusions && st.fusions[Game.fusionKey(st.cls, c)];
      const preview = Sprites.url(Sprites.fusionSprite(w.preFusion ? w.preFusion.sprite : w.sprite, WEAPON_BASES[c][0].sprite), Sprites.itemPal(w), 2, { key: 'fz' + c + w.uid });
      h += `<div class="fuse-opt${Stats.mastered(st, c) ? '' : ' locked'}"><img src="${preview}" alt=""><div><b style="color:${CLASSES[c].color}">${CLASSES[c].name}</b>${learned ? ' <span class="tag">aprendida</span>' : ''}<div class="hint" style="margin:0">${block || `Custa ${U.fmt(Game.fusionCost(w))} de ouro${learned ? '' : ` + ${FUSION_SHARDS} Fragmentos`}`}</div></div><button class="btn small purple" data-act="fuse" data-id="${c}" ${block ? 'disabled' : ''}>Fundir</button></div>`;
    }
    return h + '</div></div>';
  },

  tab_asc() {
    const st = Game.state;
    const gain = Stats.soulsOnAscend(st);
    const soul = `<img src="${Sprites.soulUrl()}" alt="">`;
    let h = `<div class="asc-hero"><div style="font:600 13px var(--pixel);color:var(--muted)">ALMAS</div><div class="souls-big">${soul}${U.fmt(st.souls)}</div>
      <div style="margin:8px 0 12px;font-size:12px;color:#cfc4de">${st.maxZone >= 15 ? `Ascender agora concede <b style="color:#d9b8ff">+${U.fmt(gain)} Almas</b> (zona recorde desta jornada: ${st.maxZone}).` : `Alcance a <b>zona 15</b> para poder ascender. (Atual: ${st.maxZone})`}</div>
      <button class="btn purple" data-act="ascend" ${gain > 0 ? '' : 'disabled'}>Ascender</button>
      <div class="hint" style="margin-top:10px">Ascender termina esta jornada: as Almas vão para o seu perfil, o slot fica livre e você escolhe o próximo herói no menu. Almas, Altar, conquistas, Armas Ancestrais e liberações nunca se perdem.</div></div>`;
    const s = st.settings;
    h += `<div class="sec"><div class="sec-h"><h3>Automação</h3></div>
      <div class="set-row"><div><div class="l">Farmar automaticamente na zona</div><div class="d">Ao chegar nessa zona, troca para o modo Farmar (uma vez por jornada). 0 = desligado.</div></div><input class="num" type="number" min="0" max="9999" data-set="autoFarmZone" value="${s.autoFarmZone || 0}"></div></div>`;
    h += `<div class="sec"><div class="sec-h"><h3>Altar das Almas</h3></div>${this.qtyBar()}`;
    for (const u of SOUL_UPGRADES) {
      const r = st.soulUpg[u.id] || 0;
      const maxed = u.max && r >= u.max;
      const q = this.qtyInfo(x => Stats.soulCost(u, x), r, u.max, st.souls);
      h += `<div class="up-row"><div class="ic"><img src="${Sprites.skillUrl(u.icon, u.color, 44)}" alt=""></div>
        <div><div class="nm">${u.name}<span class="rk">Nv ${r}${u.max ? '/' + u.max : ''}</span></div>
        <div class="ds">Atual: <b>${r ? u.desc(Stats.soulVal(u, r)) : 'nenhum'}</b>${maxed ? '' : `<br><span class="nx">${q.n > 1 ? `+${q.n} níveis` : 'Próximo'}: ${u.desc(Stats.soulVal(u, r + q.n))}</span>`}</div></div>
        <div class="act">${maxed ? '<span class="tag">MÁXIMO</span>' : `<div class="cost" style="color:${q.can ? '#d9b8ff' : 'var(--red)'}">${soul}${U.fmt(q.cost)}</div><button class="btn small purple" data-act="soul" data-id="${u.id}" ${q.can ? '' : 'disabled'}>Comprar${q.n > 1 ? ' ×' + q.n : ''}</button>`}</div></div>`;
    }
    return h + '</div>';
  },

  tab_ach() {
    const st = Game.state;
    const done = ACHIEVEMENTS.filter(a => st.ach[a.id]).length;
    let h = `<div class="sec"><div class="sec-h"><h3>Conquistas</h3><span class="sub">${done}/${ACHIEVEMENTS.length}</span></div>`;
    const list = [...ACHIEVEMENTS].sort((a, b) => (!!st.ach[a.id]) - (!!st.ach[b.id]));
    for (const a of list) {
      const v = Game.achValue(a, st), ok = !!st.ach[a.id], f = a.time ? x => U.fmtTime(x) : U.fmt;
      const pct = Math.min(1, v / a.goal);
      const rw = Object.entries(a.reward).map(([k, x]) => Items.statLine(k, x)).join(', ');
      h += `<div class="ach${ok ? ' done' : ''}"><div class="medal">${ok ? '★' : '☆'}</div><div><div class="nm">${a.name}</div><div class="ds">${a.desc}</div>${ok ? '' : `<div class="meter"><div style="width:${pct * 100}%"></div></div>`}</div><div class="rw">${rw}<br><span style="color:var(--muted);font-weight:400">${ok ? 'Concluída' : `${f(Math.min(v, a.goal))}/${f(a.goal)}`}</span></div></div>`;
    }
    h += '</div>';
    const s = st.stats;
    const rows = [
      ['Tempo de jogo', U.fmtTime(s.playTime)], ['Inimigos derrotados', U.fmtInt(s.kills)], ['Chefes derrotados', U.fmtInt(s.bosses)],
      ['Baús abertos', U.fmtInt(s.chests)], ['Zonas concluídas', U.fmtInt(s.zonesCleared)], ['Zona recorde', s.maxZone],
      ['Nível recorde', s.maxLevel], ['Itens encontrados', U.fmtInt(s.itemsFound)], ['Épicos', s.epics], ['Lendários', s.legendaries], ['Míticos', s.mythics],
      ['Ouro total', U.fmt(s.goldEarned)], ['Maior golpe', U.fmt(s.highestHit)], ['Maior forja', '+' + s.maxForge], ['Derrotas', s.deaths], ['Ascensões', s.ascensions],
    ];
    h += `<div class="sec"><div class="sec-h"><h3>Estatísticas</h3></div><div class="stat-list">${rows.map(([a, b]) => `<div class="r"><span>${a}</span><span>${b}</span></div>`).join('')}</div></div>`;
    return h;
  },

  onPanelClick(e) {
    const it = e.target.closest('[data-uid]');
    if (it && !e.target.closest('[data-act="forgeSel"]')) {
      if (this.selecting && e.target.closest('.inv-grid')) {
        const uid = it.dataset.uid;
        if (this.picked.has(uid)) this.picked.delete(uid); else this.picked.add(uid);
        Sfx.play('click');
        this.renderTab(false);
        return;
      }
      this.openMenu(it.dataset.uid, e.clientX, e.clientY);
      return;
    }
    const a = e.target.closest('[data-act]');
    if (!a || a.disabled) return;
    const id = a.dataset.id;
    switch (a.dataset.act) {
      case 'bulkMenu': this.openBulkMenu(a); break;
      case 'selectMode': this.selecting = !this.selecting; this.picked.clear(); this.renderTab(false); break;
      case 'selAll': for (const x of Game.state.inv) if (!x.locked) this.picked.add(x.uid); this.renderTab(false); break;
      case 'selNone': this.picked.clear(); this.renderTab(false); break;
      case 'sellSelected': {
        const set = new Set(this.picked);
        const pv = Game.sellPreview(x => set.has(x.uid));
        const hasGood = Game.state.inv.some(x => set.has(x.uid) && !x.locked && (x.rarity >= 3 || Stats.compareItem(x) > 0.002));
        const go = () => { const r = Game.sellWhere(x => set.has(x.uid)); this.picked.clear(); this.selecting = false; this.soldNotice(r); this.renderTab(false); };
        if (hasGood) this.confirm('Vender selecionados', `Vender <b>${pv.n}</b> itens por <b style="color:var(--gold)">${U.fmt(pv.gold)}</b> ouro? A seleção inclui itens Épicos+ ou melhorias.`, 'Vender', go, 'danger');
        else go();
        break;
      }
      case 'sortInv': Game.sortInv(); this.renderTab(false); break;
      case 'talent': Game.talentUp(id); this.renderTab(false); break;
      case 'resetTalents': this.confirm('Redistribuir talentos', 'Todos os pontos serão devolvidos para você distribuir novamente.', 'Redistribuir', () => { Game.resetTalents(); this.renderTab(false); }); break;
      case 'qty': Game.state.settings.buyQty = +id; Sfx.play('click'); this.renderTab(false); break;
      case 'train': Game.buyTraining(id, Game.buyQty()); this.renderTab(false); break;
      case 'fuse': {
        const w = Game.state.equip.weapon;
        this.confirm('Fundir arma', `Fundir <b class="c${w.rarity}">${U.esc(w.name)}</b> com a arma de <b style="color:${CLASSES[id].color}">${CLASSES[id].name}</b>? Enquanto ela estiver equipada você será <b>${CLASSES[Game.state.cls].name} / ${CLASSES[id].name}</b>.`, 'Fundir', () => { if (Game.fuseWeapon(id)) this.notice('Armas fundidas! Agora você é multiclasse.', 'var(--green)'); this.renderTab(false); }, 'purple');
        break;
      }
      case 'unfuse': Game.unfuseWeapon(); this.renderTab(false); break;
      case 'forgeSel': this.forgeSel = a.dataset.slot; Sfx.play('click'); this.renderTab(false); break;
      case 'forge': {
        const item = Game.state.equip[this.forgeSel];
        if (item) { const ok = Game.forge(item); this.renderTab(false); this.notice(ok ? `Sucesso! Agora +${item.plus}` : 'A forja falhou…', ok ? 'var(--green)' : 'var(--red)'); }
        break;
      }
      case 'soul': Game.buySoul(id, Game.buyQty()); this.renderTab(false); break;
      case 'ascend': {
        const gain = Stats.soulsOnAscend(Game.state);
        this.confirm('Ascender', `Você receberá <b style="color:#d9b8ff">${U.fmt(gain)} Almas</b> e esta jornada termina: o slot fica livre e você volta ao menu para criar o próximo herói, com qualquer classe e espécie liberada. Almas, Altar, conquistas, Armas Ancestrais e liberações continuam no seu perfil, e as armas exclusivas vão com o próximo herói.`, 'Ascender', () => Game.ascend(), 'purple');
        break;
      }
      case 'useClass':
        this.confirm('Trocar de classe', `Tornar-se <b style="color:${CLASSES[id].color}">${CLASSES[id].name}</b>? Seus talentos serão redistribuídos e suas armas reforjadas para a nova classe (raridade, nível e aprimoramento são mantidos).`, 'Trocar', () => { Game.switchClass(id); this.renderTab(false); });
        break;
      case 'useSpecies': Game.switchSpecies(id); this.renderTab(false); break;
      case 'maestria': Game.maestriaUp(id, 1); this.renderTab(false); break;
      case 'maestria10': Game.maestriaUp(id, 10); this.renderTab(false); break;
      case 'awaken': Game.awakenRelic(id); this.renderTab(false); break;
      case 'setMultiSp':
        if (!id) { Game.setMultiSpecies(null); this.renderTab(false); break; }
        this.confirm('Mestiçagem', `Combinar <b>${SPECIES[Game.state.species].name}</b> com <b>${SPECIES[id].name}</b>? Cada nível passa a exigir ${Math.round((MULTI_SP_XP - 1) * 100)}% mais XP.`, 'Combinar', () => { Game.setMultiSpecies(id); this.renderTab(false); }, 'purple');
        break;
      case 'goForge': this.tab = 'forge'; this.$('tabs').querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.tab === 'forge')); this.renderTab(true); setTimeout(() => { const f = this.$('tab-body').querySelector('.fuse-list'); if (f) f.scrollIntoView({ block: 'center' }); }, 30); break;
    }
  },
  onPanelChange(e) {
    const t = e.target, k = t.dataset.set;
    if (!k) return;
    const st = Game.state;
    if (t.type === 'checkbox') st.settings[k] = t.checked; else st.settings[k] = +t.value;
    if (k === 'autoTalent' && t.checked) Game.autoTalents();
    if (k === 'autoSell') {
      const r = Game.applyAutoSell();
      if (r.n) this.notice(`Auto-venda: ${r.n} ${r.n > 1 ? 'itens vendidos' : 'item vendido'} (+${U.fmt(r.gold)} ouro)`, 'var(--gold)');
    }
    this.renderTab(false);
  },

  soldNotice(r) {
    if (r.n) {
      this.notice(`Vendidos ${r.n} ${r.n > 1 ? 'itens' : 'item'} por ${U.fmt(r.gold)} ouro`, 'var(--gold)');
      Game.log(`Vendeu ${r.n} ${r.n > 1 ? 'itens' : 'item'} por ${U.fmt(r.gold)} ouro.`, 'gold');
    } else this.notice('Nenhum item para vender.');
  },

  quickSell(item, skipConfirm) {
    if (item.locked) { this.notice('Item travado. Destrave para vender.'); return; }
    const go = () => { Game.sell(item); this.renderTab(false); };
    if (item.rarity >= 3 && !skipConfirm) this.confirm('Vender item', `Vender <span class="c${item.rarity}">${U.esc(item.name)}</span> (${RARITIES[item.rarity].name}) por ${U.fmt(Items.sellPrice(item))} ouro?<br><small style="color:var(--muted)">Dica: Shift + botão direito vende sem perguntar.</small>`, 'Vender', go, 'danger');
    else go();
  },

  openBulkMenu(btn) {
    const m = this.$('menu');
    this.menuItem = null;
    this.hideTip();
    let h = '<div class="mh">Venda em massa</div><div class="mnote">Itens travados nunca são vendidos</div>';
    for (const f of Game.bulkFilters()) {
      const pv = Game.sellPreview(f.pred);
      h += `<button data-bulk="${f.id}" ${pv.n ? '' : 'disabled'}><span style="color:${f.color}">${f.label}</span><span class="mc">${pv.n}${pv.up ? ` <span class="up-g">▲${pv.up}</span>` : ''} · ${U.fmt(pv.gold)}</span></button>`;
    }
    m.innerHTML = h;
    m.classList.remove('hidden');
    const r = btn.getBoundingClientRect(), mr = m.getBoundingClientRect();
    m.style.left = Math.min(r.left, innerWidth - mr.width - 8) + 'px';
    m.style.top = Math.min(r.bottom + 4, innerHeight - mr.height - 8) + 'px';
  },

  openMenu(uid, x, y) {
    const f = Game.findItem(uid);
    if (!f) return;
    const it = f.item;
    it.isNew = false;
    this.menuItem = it;
    this.hideTip();
    let h = `<div class="mh c${it.rarity}">${U.esc(it.name)}</div>`;
    if (f.where === 'inv') {
      h += `<button data-m="equip">Equipar</button>`;
      h += `<button data-m="lock">${it.locked ? 'Destravar' : 'Travar'}</button>`;
      h += `<button data-m="sell" ${it.locked ? 'disabled style="opacity:.4"' : ''}>Vender (${U.fmt(Items.sellPrice(it))} ouro)</button>`;
    } else {
      h += `<button data-m="forge">Forjar</button>`;
      h += `<button data-m="lock">${it.locked ? 'Destravar' : 'Travar'}</button>`;
      h += `<button data-m="unequip">Desequipar</button>`;
    }
    const m = this.$('menu');
    m.innerHTML = h;
    m.classList.remove('hidden');
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
    m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
  },
  closeMenu() { this.$('menu').classList.add('hidden'); this.menuItem = null; },
  onMenu(e) {
    const bk = e.target.closest('[data-bulk]');
    if (bk) {
      if (bk.disabled) return;
      const f = Game.bulkFilters().find(x => x.id === bk.dataset.bulk);
      this.closeMenu();
      const pv = Game.sellPreview(f.pred);
      const go = () => { this.soldNotice(Game.sellWhere(f.pred)); this.renderTab(false); };
      if (f.confirm || pv.up) this.confirm('Venda em massa', `${f.label}: vender <b>${pv.n}</b> ${pv.n > 1 ? 'itens' : 'item'} por <b style="color:var(--gold)">${U.fmt(pv.gold)}</b> ouro?${pv.up ? `<br><small class="up-g">Inclui ${pv.up} ${pv.up > 1 ? 'itens que seriam melhorias' : 'item que seria melhoria'} (▲).</small>` : ''}`, 'Vender', go, 'danger');
      else go();
      return;
    }
    const b = e.target.closest('[data-m]');
    if (!b || !this.menuItem) return;
    const it = this.menuItem;
    switch (b.dataset.m) {
      case 'equip': Game.equip(it); break;
      case 'sell': this.closeMenu(); this.quickSell(it); return;
      case 'lock': Game.toggleLock(it); break;
      case 'unequip': Game.unequip(it.slot); break;
      case 'forge': this.forgeSel = it.slot; this.tab = 'forge'; this.$('tabs').querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.tab === 'forge')); break;
    }
    this.closeMenu();
    this.renderTab(false);
  },

  tab_hall() {
    const st = Game.state;
    const C = CLASSES[st.cls], S = SPECIES[st.species];
    let h = `<div class="sec"><div class="sec-h"><h3>Salão dos Heróis</h3></div>
      <div class="hall-cur"><img src="${Sprites.classUrl(st.cls, st.species, 3)}" alt=""><div><div class="hc-n" style="color:${C.color}">${C.name} ${S.name}</div>
      <div class="hint" style="margin:2px 0 0">Troque de classe ou espécie quando quiser. Mas recordes de classe e espécie (domínio, metas e Armas Ancestrais) só contam para a classe e a espécie com que a jornada <b>começou</b>.</div></div></div></div>`;
    const prog = u => {
      if (u.t === 'creator') {
        const done = ACHIEVEMENTS.filter(a => st.ach[a.id]).length, asc = st.stats.ascensions || 0;
        return `<div class="meter"><div style="width:${Math.min(100, done / ACHIEVEMENTS.length * 100)}%"></div></div><div class="hc-p">${done}/${ACHIEVEMENTS.length} conquistas · ${Math.min(asc, u.asc)}/${u.asc} ascensões</div>`;
      }
      if (u.t !== 'stat') return '';
      const v = st.stats[u.stat] || 0;
      return `<div class="meter"><div style="width:${Math.min(100, v / u.goal * 100)}%"></div></div><div class="hc-p">${U.fmt(Math.min(v, u.goal))}/${U.fmt(u.goal)}</div>`;
    };
    const card = (kind, id) => {
      const def = kind === 'class' ? CLASSES[id] : SPECIES[id];
      const R = HERO_RARITY[def.rarity];
      const owned = Game.isUnlocked(kind, id);
      const cur = kind === 'class' ? st.cls === id : st.species === id;
      const img = kind === 'class' ? Sprites.classUrl(id, st.species, 3) : Sprites.speciesUrl(id, 3);
      let tip = `<div class='tt-name' style='color:${R.color}'>${def.name}</div><div class='tt-sub'>${kind === 'class' ? 'Classe' : 'Espécie'} ${R.name}${def.title ? ' · ' + def.title : ''}</div><div style='color:#d8cfe6'>${def.desc}</div>`;
      if (kind === 'class' && def.innate) tip += `<div class='tt-sep'></div><div><b style='color:var(--gold)'>✦ ${def.innate.name}:</b> <span style='color:var(--muted)'>${def.innate.desc}</span></div>`;
      if (kind === 'class') tip += `<div class='tt-sep'></div>` + def.skills.map(sid => `<div><b style='color:${SKILLS[sid].color}'>${SKILLS[sid].name}</b><span style='color:var(--muted)'>${SKILLS[sid].unlock > 1 ? ' · nv ' + SKILLS[sid].unlock : ''}</span></div>`).join('');
      else tip += `<div class='tt-sep'></div>` + def.traits.map(([n, d]) => `<div><b style='color:#e8dff5'>${n}:</b> <span style='color:var(--muted)'>${d}</span></div>`).join('');
      if (!owned) tip += `<div class='tt-foot'><span>🔒 ${unlockText(def.unlock)}</span></div>`;
      let act;
      const cs = (kind === 'class' ? st.classStats[id] : (st.speciesStats || {})[id]) || {};
      const isM = kind === 'class' ? Stats.mastered(st, id) : Stats.speciesMastered(st, id);
      const mastery = owned ? `<div class="hc-m${isM ? ' ok' : ''}">${isM ? (kind === 'class' ? '★ Dominada' : '★ Dominada') : `Recorde: zona ${cs.best || 0}/${MASTERY_ZONE}`}</div>` : '';
      const multiBtn = kind === 'class' ? '' : (Game.canMultiSpecies(id) ? `<button class="btn small purple" data-act="setMultiSp" data-id="${id}">Mestiço</button>` : '');
      if (cur) act = '<span class="hc-cur">Atual</span>' + mastery;
      else if (kind === 'class' && st.cls2 === id) act = '<span class="hc-cur" style="color:#c9a0ff">Secundária</span>' + mastery;
      else if (kind === 'species' && st.species2 === id) act = '<span class="hc-cur" style="color:#c9a0ff">Secundária</span>' + mastery;
      else if (owned) act = `<button class="btn small gold" data-act="${kind === 'class' ? 'useClass' : 'useSpecies'}" data-id="${id}">Usar</button>${multiBtn}${mastery}`;
      else act = `<div class="hc-lock">${unlockText(def.unlock)}</div>${prog(def.unlock)}`;
      return `<div class="hcard${owned ? '' : ' locked'}${cur ? ' cur' : ''}" style="--rc:${R.color}" data-tip="${tip.replace(/"/g, '&quot;')}"><img src="${img}" alt=""><div class="hc-n">${def.name}</div><div class="hc-r" style="color:${R.color}">${R.name}</div>${act}</div>`;
    };
    const nc = st.unlocks.classes.length, ns = st.unlocks.species.length;
    const open = Stats.multiclassOpen(st);
    const mHint = !open
      ? `🔒 Liberada após <b>${MULTI_ASC} ascensões</b> (você tem ${st.stats.ascensions}).`
      : !Stats.mastered(st, st.cls)
      ? `Domine a classe atual (zona <b>${MASTERY_ZONE}</b> numa jornada iniciada com ela) para combiná-la com outra classe dominada.`
      : st.cls2 ? `Ativa: <b>${Game.className()}</b> (pela arma fundida).` : 'Vá na <b>Forja</b> e funda sua arma com a de outra classe dominada.';
    const learned = Object.keys(st.fusions || {});
    h += `<div class="sec"><div class="sec-h"><h3>Multiclasse</h3><button class="btn small purple" data-act="goForge">Fusão na Forja</button></div>
      <div class="card multi-card"><div class="hint" style="margin:0 0 6px">A multiclasse vem da <b>fusão de armas</b>: na Forja, sua arma se funde com a arma de outra classe dominada (ex.: espada + arco). Equipada, ela dá as habilidades das duas classes (4 + 2), as passivas das duas, +${MULTI_SYNERGY}% de Dano e Vida e o inato da secundária a 60%. Em troca, cada nível exige ${Math.round((MULTI_XP - 1) * 100)}% mais XP.</div><div style="font-size:12px">${mHint}</div>${learned.length ? `<div class="hint" style="margin:6px 0 0">Fusões aprendidas: ${learned.map(k => k.split('+').map(c => CLASSES[c] ? CLASSES[c].name : c).join(' + ')).join(' · ')}</div>` : ''}</div></div>`;
    const spOpen = Stats.multiSpeciesOpen(st);
    const sHint = !spOpen
      ? `🔒 Liberada após <b>${MULTI_SP_ASC} ascensões</b> (você tem ${st.stats.ascensions}).`
      : !Stats.speciesMastered(st, st.species)
      ? `Domine a espécie atual (zona <b>${MASTERY_ZONE}</b> numa jornada iniciada com ela) para combiná-la com outra espécie dominada.`
      : st.species2 ? `Ativa: <b>${Game.speciesName()}</b>.` : 'Escolha uma espécie dominada abaixo (botão <b>Mestiço</b>) para combinar com a atual.';
    h += `<div class="sec"><div class="sec-h"><h3>Mestiçagem</h3>${st.species2 ? '<button class="btn small" data-act="setMultiSp" data-id="">Remover</button>' : ''}</div>
      <div class="card multi-card"><div class="hint" style="margin:0 0 6px">Combine duas espécies dominadas: a segunda soma ${Math.round(MULTI_SP_SHARE * 100)}% dos atributos dela (sem os poderes), vale a raridade mais alta e dá +${MULTI_SP_SYNERGY}% de Dano e Vida. Em troca, cada nível exige ${Math.round((MULTI_SP_XP - 1) * 100)}% mais XP (acumula com a multiclasse).</div><div style="font-size:12px">${sHint}</div></div></div>`;
    const nr = Object.keys(st.relics || {}).length;
    h += `<div class="sec"><div class="sec-h"><h3>Armas Ancestrais</h3><span class="sub">${nr}/${CLASS_ORDER.length} · <b style="color:var(--gold)">${Math.floor(st.shards || 0)}</b> Fragmentos</span></div>
      <div class="hint">Cada classe tem uma arma exclusiva, encontrada uma única vez no <b>Cofre Ancestral</b> (aparece jogando com a classe a partir da zona ${RELIC_ZONE}). Ela acompanha a classe em todas as jornadas e pode ser despertada de Comum até Celestial com <b style="color:var(--gold)">Fragmentos Ancestrais</b> e recordes cada vez maiores com a classe. Os fragmentos caem dos Senhores de bioma e, às vezes, de chefes e Mímicos.</div>
      <div class="relic-list">${[st.cls, ...CLASS_ORDER.filter(c => c !== st.cls)].map(c => this.relicCard(c, false)).join('')}</div></div>`;
    h += `<div class="sec"><div class="sec-h"><h3>Classes</h3><span class="sub">${nc}/${CLASS_ORDER.length}</span></div><div class="hall-grid">${CLASS_ORDER.map(id => card('class', id)).join('')}</div></div>`;
    h += `<div class="sec"><div class="sec-h"><h3>Espécies</h3><span class="sub">${ns}/${SPECIES_ORDER.length}</span></div><div class="hall-grid">${SPECIES_ORDER.map(id => card('species', id)).join('')}</div></div>`;
    h += '<div class="hint">Prisioneiros aparecem nas masmorras numa jaula com um <b style="color:var(--gold)">!</b> dourado. O herói vai até eles sozinho para libertá-los.</div>';
    return h;
  },

  onHover(e) {
    const el = e.target.closest('[data-uid],[data-skill],[data-tip]');
    if (!el || !this.$('menu').classList.contains('hidden')) return;
    const tip = this.$('tooltip');
    if (el.dataset.uid) {
      const f = Game.findItem(el.dataset.uid);
      if (!f) return;
      const it = f.item;
      if (it.isNew) { it.isNew = false; el.classList.remove('new'); }
      const cur = Game.state.equip[it.slot];
      if (f.where === 'inv' && cur) {
        tip.className = 'compare';
        tip.innerHTML = `<div>${Items.tooltip(it, { tag: 'Na mochila' })}</div><div>${Items.tooltip(cur, { tag: 'Equipado', compare: false })}</div>`;
      } else {
        tip.className = '';
        tip.innerHTML = Items.tooltip(it, { tag: f.where === 'equip' ? 'Equipado' : '' });
      }
    } else if (el.dataset.skill) {
      const sk = SKILLS[el.dataset.skill], r = sk.racial ? U.clamp(1 + Math.floor(Game.state.level / 8), 1, 10) : Game.state.talents[el.dataset.skill] || 0;
      tip.className = '';
      tip.innerHTML = `<div class="tt-name" style="color:${sk.color}">${sk.name}</div><div class="tt-sub">${sk.racial ? `Racial (${SPECIES[Game.state.species].name}) · ` : ''}${sk.type === 'passive' ? 'Passiva' : `Ativa · Recarga ${sk.cd}s`} · Rank ${r}/${sk.max}${sk.ult ? ' · Suprema' : ''}</div><div style="color:#d8cfe6">${sk.desc(Math.max(1, r))}</div>${Game.state.level < sk.unlock ? `<div class="tt-foot"><span>Desbloqueia no nível ${sk.unlock}</span></div>` : ''}`;
    } else {
      tip.className = '';
      tip.innerHTML = el.dataset.tip;
    }
    tip.classList.remove('hidden');
    this.placeTip(e.clientX, e.clientY);
  },
  placeTip(x, y) {
    const t = this.$('tooltip');
    const r = t.getBoundingClientRect();
    let L = x + 16, T = y + 12;
    if (L + r.width > innerWidth - 8) L = x - r.width - 16;
    if (T + r.height > innerHeight - 8) T = Math.max(8, innerHeight - r.height - 8);
    t.style.left = Math.max(8, L) + 'px';
    t.style.top = T + 'px';
  },
  hideTip() { this.$('tooltip').classList.add('hidden'); },

  banner(title, sub, cls = '', dur = 2) {
    const b = this.$('banner');
    if (!b) return;
    b.className = 'banner show ' + cls;
    b.innerHTML = `<div class="b1">${U.esc(title)}</div>${sub ? `<div class="b2">${U.esc(sub)}</div>` : ''}`;
    clearTimeout(this._bt);
    this._bt = setTimeout(() => b.classList.remove('show'), dur * 1000);
  },
  pushToast(html, color) {
    const box = this.$('toasts');
    if (!box) return;
    const d = document.createElement('div');
    d.className = 'toast';
    d.style.borderColor = color;
    d.innerHTML = html;
    box.prepend(d);
    while (box.children.length > 5) box.lastChild.remove();
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 400); }, 3200);
  },
  toast(item, extra) {
    const col = RARITIES[item.rarity].color;
    this.pushToast(`<img src="${Sprites.itemUrl(item)}" alt=""><span><span class="c${item.rarity}">${U.esc(item.name)}</span>${extra ? `<br><small style="color:var(--green)">${extra}</small>` : ''}</span>`, col);
  },
  toastText(title, sub, color) {
    this.pushToast(`<span><b style="color:${color}">${title}</b>${sub ? `<br><small style="color:var(--muted)">${sub}</small>` : ''}</span>`, color);
  },
  notice(msg, color = 'var(--text)') { this.pushToast(`<span style="color:${color}">${msg}</span>`, '#3c3056'); },
  nowPlaying(name) {
    const np = this.$('np-name');
    if (np) np.textContent = name;
    if (!Game.running || document.hidden) return;
    this.pushToast(`<span><b style="color:#c9a0ff">♪ ${name}</b><br><small style="color:var(--muted)">Trilha sonora</small></span>`, '#6f3fb0');
  },

  drawTransition(tr) {
    let f = this.$('fade');
    if (!f) {
      f = document.createElement('div'); f.id = 'fade';
      f.style.cssText = 'position:absolute;inset:0;background:#05030a;pointer-events:none;opacity:0;z-index:3';
      this.$('viewport').appendChild(f);
    }
    const a = tr ? 1 - Math.abs(tr.t - tr.half) / tr.half : 0;
    f.style.opacity = U.clamp(a, 0, 1).toFixed(2);
  },

  addLog(html, cls = '') {
    const entry = { html, cls, t: U.clock() };
    this.logs.push(entry);
    if (this.logs.length > 150) this.logs.shift();
    if (!this.logPass(entry)) return;
    const box = this.$('log');
    if (!box) return;
    const near = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.insertAdjacentHTML('beforeend', this.logLine(entry));
    while (box.children.length > 150) box.firstChild.remove();
    if (near) box.scrollTop = box.scrollHeight;
  },
  logPass(e) {
    if (this.logFilter === 'all') return true;
    const loot = e.cls === 'loot' || e.cls === 'gold';
    return this.logFilter === 'loot' ? loot : !loot;
  },
  logLine(e) { return `<div class="ln ${e.cls}"><span class="t">${e.t}</span>${e.html}</div>`; },
  renderLog() {
    const box = this.$('log');
    box.innerHTML = this.logs.filter(e => this.logPass(e)).map(e => this.logLine(e)).join('');
    box.scrollTop = box.scrollHeight;
  },

  modal(title, body, buttons = [], opts = {}) {
    this.closeModal();
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal"><div class="modal-h"><span>${title}</span>${opts.locked ? '' : '<button class="icon-btn" data-close>✕</button>'}</div><div class="modal-b">${body}</div>${buttons.length ? `<div class="modal-f">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-b="${i}">${b.label}</button>`).join('')}</div>` : ''}</div>`;
    bg.addEventListener('click', e => {
      if (!opts.locked && (e.target === bg || e.target.closest('[data-close]'))) { this.closeModal(); return; }
      const b = e.target.closest('[data-b]');
      if (b) { const def = buttons[+b.dataset.b]; if (def.close !== false) this.closeModal(); if (def.fn) def.fn(bg); }
    });
    this.$('modal-root').appendChild(bg);
    return bg;
  },
  closeModal() { this.$('modal-root').innerHTML = ''; },
  confirm(title, msg, okLabel, fn, cls = 'gold') {
    this.modal(title, `<p style="margin:0;color:#d8cfe6">${msg}</p>`, [{ label: 'Cancelar' }, { label: okLabel, cls, fn }]);
  },

  onlineChanged() {
    const ts = this.$('title-screen');
    if (ts && !ts.classList.contains('hidden') && this.titleMode === 'new' && !this.$('modal-root').children.length) this.showTitle('new');
    if (this.$('btn-board')) this.$('btn-board').classList.toggle('hidden', !Online.enabled);
  },

  loginModal(mode = 'in') {
    const up = mode === 'up';
    const body = `<div class="lg-tabs"><button data-lg="in" class="${up ? '' : 'on'}">Entrar</button><button data-lg="up" class="${up ? 'on' : ''}">Criar conta</button></div>
      ${up ? '<label class="lg-f"><span>Apelido (aparece no placar)</span><input id="lg-name" maxlength="20" autocomplete="nickname"></label>' : ''}
      <label class="lg-f"><span>E-mail</span><input id="lg-email" type="email" autocomplete="email"></label>
      <label class="lg-f"><span>Senha${up ? ` (mínimo ${MIN_PASS} caracteres)` : ''}</span><input id="lg-pass" type="password" autocomplete="${up ? 'new-password' : 'current-password'}"></label>
      ${Online.captchaOn() ? '<div class="lg-captcha" id="lg-captcha"></div>' : ''}
      <div class="lg-msg" id="lg-msg"></div>
      ${up ? '' : '<button class="lg-link" data-lg="forgot">Esqueci minha senha</button>'}
      <p class="hint" style="margin:8px 0 0">A conta guarda seu perfil e seus 3 slots na nuvem, para você continuar em outro navegador ou computador, e coloca suas marcas no placar.</p>`;
    const submit = async (bg) => {
      const msg = bg.querySelector('#lg-msg'), btn = bg.querySelector('.modal-f .gold');
      const email = bg.querySelector('#lg-email').value.trim(), pass = bg.querySelector('#lg-pass').value;
      if (!email || !pass) { msg.textContent = 'Preencha e-mail e senha.'; return; }
      btn.disabled = true; msg.style.color = 'var(--muted)'; msg.textContent = 'Conectando…';
      try {
        if (up) {
          const r = await Online.signUp(email, pass, bg.querySelector('#lg-name').value);
          if (r === 'confirm') { msg.style.color = 'var(--gold)'; msg.textContent = 'Conta criada! Abra o e-mail de confirmação que enviamos e depois volte aqui para entrar.'; btn.disabled = false; return; }
        } else await Online.signIn(email, pass);
        this.closeModal();
        this.notice(`Bem-vindo(a), ${U.esc(Online.profile.name)}! Seus slots estão sincronizados.`, 'var(--green)');
        this.showTitle('new');
      } catch (e) {
        msg.style.color = 'var(--red)'; msg.textContent = Online.errText(e); btn.disabled = false;
      }
    };
    const m = this.modal(up ? 'Criar conta' : 'Entrar', body, [{ label: 'Cancelar' }, { label: up ? 'Criar conta' : 'Entrar', cls: 'gold', close: false, fn: submit }]);
    m.querySelectorAll('[data-lg]').forEach(b => b.onclick = async () => {
      if (b.dataset.lg !== 'forgot') { this.loginModal(b.dataset.lg); return; }
      const msg = m.querySelector('#lg-msg'), email = m.querySelector('#lg-email').value.trim();
      if (!email) { msg.style.color = 'var(--red)'; msg.textContent = 'Digite seu e-mail acima e clique de novo em "Esqueci minha senha".'; return; }
      try { await Online.resetPassword(email); msg.style.color = 'var(--gold)'; msg.textContent = 'Enviamos um link para trocar a senha. Abra-o neste navegador.'; }
      catch (e) { msg.style.color = 'var(--red)'; msg.textContent = Online.errText(e); }
    });
    m.addEventListener('keydown', e => { if (e.key === 'Enter') submit(m); });
    Online.mountCaptcha(m.querySelector('#lg-captcha'));
    setTimeout(() => { const f = m.querySelector(up ? '#lg-name' : '#lg-email'); if (f) f.focus(); }, 30);
  },

  codeModal() {
    const body = `<div class="hint" style="margin:0 0 8px">Quem criou uma arma exclusiva ou uma classe do jogo recebe um código. Digite aqui para liberar a recompensa no seu perfil.</div>
      <label class="lg-f"><span>Código</span><input id="cc-code" type="text" maxlength="40" autocomplete="off" spellcheck="false" placeholder="OLG-XXXX-XXXX-XXXX"></label>
      <div class="lg-msg" id="cc-msg"></div>`;
    const m = this.modal('Código de criador', body, [{ label: 'Fechar' }, { label: 'Resgatar', cls: 'gold', close: false, fn: async (bg) => {
      const msg = bg.querySelector('#cc-msg'), btn = bg.querySelector('.modal-f .gold');
      btn.disabled = true; msg.style.color = 'var(--muted)'; msg.textContent = 'Conferindo…';
      const r = await Game.redeemCode(bg.querySelector('#cc-code').value);
      btn.disabled = false;
      msg.style.color = r.ok ? 'var(--green)' : 'var(--red)'; msg.textContent = r.msg;
      if (r.ok) { Sfx.play('legendary'); this.showTitle(); }
    } }]);
    setTimeout(() => { const f = m.querySelector('#cc-code'); if (f) f.focus(); }, 30);
  },

  changePasswordModal() {
    if (!Online.loggedIn) { this.notice('Entre na conta para trocar a senha.', 'var(--red)'); return; }
    const body = `<label class="lg-f"><span>Senha atual</span><input id="cp-cur" type="password" autocomplete="current-password"></label>
      <label class="lg-f"><span>Nova senha (mínimo ${MIN_PASS} caracteres)</span><input id="cp-new" type="password" autocomplete="new-password"></label>
      <label class="lg-f"><span>Repita a nova senha</span><input id="cp-new2" type="password" autocomplete="new-password"></label>
      ${Online.captchaOn() ? '<div class="lg-captcha" id="cp-captcha"></div>' : ''}
      <div class="lg-msg" id="cp-msg"></div>`;
    const m = this.modal('Trocar senha', body, [{ label: 'Cancelar' }, { label: 'Salvar nova senha', cls: 'gold', close: false, fn: async (bg) => {
      const msg = bg.querySelector('#cp-msg'), btn = bg.querySelector('.modal-f .gold');
      const cur = bg.querySelector('#cp-cur').value, nw = bg.querySelector('#cp-new').value, nw2 = bg.querySelector('#cp-new2').value;
      if (!cur || !nw) { msg.style.color = 'var(--red)'; msg.textContent = 'Preencha a senha atual e a nova.'; return; }
      if (nw !== nw2) { msg.style.color = 'var(--red)'; msg.textContent = 'As duas senhas novas não são iguais.'; return; }
      btn.disabled = true; msg.style.color = 'var(--muted)'; msg.textContent = 'Salvando…';
      try { await Online.changePassword(cur, nw); this.closeModal(); this.notice('Senha alterada!', 'var(--green)'); }
      catch (e) { msg.style.color = 'var(--red)'; msg.textContent = Online.errText(e); btn.disabled = false; }
    } }]);
    Online.mountCaptcha(m.querySelector('#cp-captcha'));
    setTimeout(() => { const f = m.querySelector('#cp-cur'); if (f) f.focus(); }, 30);
  },

  newPasswordModal() {
    const m = this.modal('Nova senha', `<label class="lg-f"><span>Digite a nova senha (mínimo ${MIN_PASS} caracteres)</span><input id="np-pass" type="password" autocomplete="new-password"></label><div class="lg-msg" id="np-msg"></div>`,
      [{ label: 'Salvar senha', cls: 'gold', close: false, fn: async (bg) => {
        const msg = bg.querySelector('#np-msg');
        try { await Online.setNewPassword(bg.querySelector('#np-pass').value); this.closeModal(); this.notice('Senha alterada! Você já está conectado.', 'var(--green)'); this.showTitle('new'); }
        catch (e) { msg.style.color = 'var(--red)'; msg.textContent = Online.errText(e); }
      } }]);
    setTimeout(() => { const f = m.querySelector('#np-pass'); if (f) f.focus(); }, 30);
  },

  boardModal(col = 'max_zone') {
    if (!Online.enabled || !Online.sb) { this.notice(Online.enabled ? 'Ainda conectando ao placar…' : 'O placar online não está configurado.', 'var(--red)'); return; }
    if (Online.loggedIn) { Game.state && Game.running && Game.save(); Online.scoreDirty = true; Online.flush(); }
    const tabs = BOARD_COLS.map(([k, n]) => `<button data-lb="${k}" class="${k === col ? 'on' : ''}">${n}</button>`).join('');
    const m = this.modal('🏆 Placar', `<div class="lg-tabs lb-tabs">${tabs}</div><div class="lb-body" id="lb-body"><div class="hint">Carregando…</div></div>
      <p class="hint" style="margin:8px 0 0">${Online.loggedIn ? 'Suas marcas são enviadas sozinhas enquanto você joga (a cada 2 minutos e ao bater recorde de zona).' : 'Entre com uma conta na tela inicial para aparecer aqui.'} Tempo de jogo soma os 3 slots da conta.</p>`, [{ label: 'Fechar', cls: 'gold' }]);
    m.querySelector('.modal').classList.add('wide');
    m.querySelectorAll('[data-lb]').forEach(b => b.onclick = () => this.boardModal(b.dataset.lb));
    const fmt = { max_zone: v => `Zona ${v}`, max_hit: v => U.fmt(v), play_time: v => U.fmtTime(v), level: v => `Nv ${v}` };
    Online.top(col).then(rows => {
      const body = m.querySelector('#lb-body');
      if (!body) return;
      if (!rows.length) { body.innerHTML = '<div class="hint">Ninguém no placar ainda. Seja o primeiro!</div>'; return; }
      const me = Online.user && Online.user.id;
      body.innerHTML = `<table class="lb"><thead><tr><th>#</th><th>Jogador</th><th>Herói</th><th>${BOARD_COLS.find(c => c[0] === col)[1]}</th></tr></thead><tbody>` +
        rows.map((r, i) => `<tr class="${r.user_id === me ? 'me' : ''}"><td class="pos">${['🥇', '🥈', '🥉'][i] || i + 1}</td><td><b>${U.esc(r.name)}</b></td><td class="hero">${U.esc(r.hero || '')}<br><small>${U.esc(r.cls || '')} · ${U.esc(r.species || '')}</small></td><td class="val">${fmt[col](r[col])}</td></tr>`).join('') +
        '</tbody></table>';
    }).catch(e => { const body = m.querySelector('#lb-body'); if (body) body.innerHTML = `<div class="hint" style="color:var(--red)">${U.esc(Online.errText(e))}</div>`; });
  },

  exitPrompt() {
    this.confirm('Sair para o menu', `O progresso fica salvo no <b>slot ${Game.slot}</b> e o herói espera parado até você voltar (sem progresso offline). Você pode continuar este herói ou jogar com outro slot.`, 'Sair', () => Game.exitToMenu());
  },

  settingsModal() {
    const s = Game.state.settings;
    const tog = (k, l, d) => `<div class="set-row"><div><div class="l">${l}</div><div class="d">${d}</div></div><input type="checkbox" data-s="${k}" ${s[k] ? 'checked' : ''}></div>`;
    const trackOpts = `<option value="auto" ${s.musicTrack === 'auto' ? 'selected' : ''}>Automática (por bioma)</option>` + MUSIC_ORDER.map(id => `<option value="${id}" ${s.musicTrack === id ? 'selected' : ''}>${MUSIC_TRACKS[id].name}</option>`).join('');
    const body = `<div class="set-h">Áudio</div>
      ${tog('music', 'Música', 'Trilha sonora procedural com 10 faixas: uma para cada bioma, para o título e para os chefes')}
      <div class="set-row"><div><div class="l">Volume da música</div></div><input type="range" min="0" max="1" step="0.05" value="${s.musicVol}" data-s="musicVol"></div>
      <div class="set-row"><div><div class="l">Faixa</div><div class="d">Tocando agora: <span id="np-name">${Music.currentName() || 'nenhuma'}</span></div></div><select class="sel" data-s="musicTrack">${trackOpts}</select></div>
      ${tog('sound', 'Efeitos sonoros', 'Golpes, saque, magias e interface')}
      <div class="set-row"><div><div class="l">Volume dos efeitos</div></div><input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-s="volume"></div>
      ${tog('bgSfx', 'Efeitos em segundo plano', 'Tocar efeitos com a aba minimizada (a música sempre continua)')}
      <div class="set-h">Jogo</div>
      ${tog('dmgNumbers', 'Números de dano', 'Mostrar dano flutuante no mapa')}
      ${tog('shake', 'Tremor de tela', 'Em críticos, explosões e chefes')}
      ${tog('exploreAll', 'Explorar tudo', 'Explorar o mapa inteiro antes de usar o portal (mais baús)')}
      ${tog('autoEquip', 'Auto-equipar', 'Equipa automaticamente itens melhores')}
      ${tog('autoTalent', 'Talentos automáticos', 'Distribui pontos de talento sozinho')}
      <div class="set-row"><div><div class="l">Salvamento</div><div class="d">Exporte para guardar um backup ou jogar em outro navegador</div></div><div style="display:flex;gap:6px"><button class="btn small" data-x="export">Exportar</button><button class="btn small" data-x="import">Importar</button></div></div>
      ${Online.enabled ? `<div class="set-h">Conta e placar</div>
      <div class="set-row"><div><div class="l">${Online.loggedIn ? `Conectado como <b>${U.esc(Online.profile.name)}</b>` : 'Sem conta'}</div><div class="d">${Online.loggedIn ? `Os slots são enviados para a nuvem a cada minuto e ao sair.${Online.lastPush ? ' Último envio: ' + new Date(Online.lastPush).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '.' : ''}${Online.error ? ' <span style="color:var(--red)">' + U.esc(Online.error) + '</span>' : ''}` : 'Saia para o menu e entre com uma conta para salvar na nuvem e entrar no placar.'}</div></div><div style="display:flex;gap:6px">${Online.loggedIn ? '<button class="btn small" data-x="sync">Salvar agora</button><button class="btn small" data-x="pass">Trocar senha</button>' : ''}<button class="btn small" data-x="board">🏆 Placar</button></div></div>` : ''}
      <div class="set-row"><div><div class="l">Sair para o menu</div><div class="d">Salva e volta para a tela de slots (até 3 heróis)</div></div><button class="btn small" data-x="exit">Sair</button></div>
      <div class="set-row"><div><div class="l" style="color:var(--red)">Apagar este slot</div><div class="d">Apaga o herói do slot ${Game.slot} e todo o progresso dele (irreversível)</div></div><button class="btn small danger" data-x="reset">Apagar</button></div>`;
    const m = this.modal('Configurações', body, [{ label: 'Fechar', cls: 'gold' }]);
    m.addEventListener('input', e => {
      const k = e.target.dataset.s; if (!k) return;
      s[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.tagName === 'SELECT' && k === 'musicTrack' ? e.target.value : +e.target.value;
      if (k === 'music' || k === 'musicVol' || k === 'musicTrack') { Sfx.init(); Music.configure(s); }
      if (k === 'sound') { Sfx.enabled = s.sound; Sfx.init(); }
      if (k === 'volume') Sfx.setVolume(s.volume);
      if (k === 'autoTalent' && s.autoTalent) Game.autoTalents();
      this.dirty('top', this.tab);
    });
    m.addEventListener('click', e => {
      const x = e.target.closest('[data-x]'); if (!x) return;
      if (x.dataset.x === 'export') {
        const code = Game.exportSave();
        this.modal('Exportar progresso', `<p class="hint">Copie e guarde este código:</p><textarea readonly id="exp-code">${code}</textarea>`, [{ label: 'Copiar', cls: 'gold', fn: () => { navigator.clipboard && navigator.clipboard.writeText(code); this.notice('Código copiado!'); } }]);
        const ta = document.getElementById('exp-code'); if (ta) ta.onclick = () => ta.select();
      } else if (x.dataset.x === 'import') {
        this.modal('Importar progresso', `<p class="hint">Cole o código exportado. O perfil e os 3 slots deste navegador serão substituídos.</p><textarea id="imp-code"></textarea>`, [{ label: 'Cancelar' }, { label: 'Importar', cls: 'gold', close: false, fn: (bg) => {
          try { Game.importSave(bg.querySelector('#imp-code').value); location.reload(); } catch (err) { this.notice('Código inválido.', 'var(--red)'); }
        } }]);
      } else if (x.dataset.x === 'pass') {
        this.changePasswordModal();
      } else if (x.dataset.x === 'sync') {
        Game.save(); Online.scoreDirty = true;
        Online.flush().then(() => this.notice(Online.error ? U.esc(Online.error) : '☁ Progresso enviado para a nuvem!', Online.error ? 'var(--red)' : 'var(--green)'));
      } else if (x.dataset.x === 'board') {
        this.boardModal();
      } else if (x.dataset.x === 'exit') {
        this.closeModal(); this.exitPrompt();
      } else if (x.dataset.x === 'reset') {
        this.confirm('Apagar este slot', `Todo o progresso do slot ${Game.slot} será perdido permanentemente. Tem certeza?`, 'Apagar', () => Game.hardReset(), 'danger');
      }
    });
  },

  gameOverModal() {
    const st = Game.state, pe = st.pendingEnd;
    if (!pe) return;
    this.modal('Fim de Jogo', `<p style="margin:0 0 6px;color:#d8cfe6"><b>${U.esc(st.name)}</b> (${Game.className()}) perdeu os três corações.</p>
      <div class="offline-list">
        <div><span>Zona alcançada</span><b>${pe.zone}</b></div>
        <div><span>Nível</span><b style="color:#c9a0ff">${pe.level}</b></div>
        <div><span>Almas obtidas</span><b style="color:#d9b8ff">+${U.fmt(pe.gain)}</b></div>
      </div>
      <p class="hint" style="margin-top:10px">A jornada terminou e o slot fica livre. Almas, Altar, conquistas e liberações continuam no seu perfil.${pe.zone >= 15 ? ' Esta jornada <b>conta como uma ascensão</b>.' : ''}</p>`,
      [{ label: 'Voltar ao menu', cls: 'gold', fn: () => Game.finishGameOver() }], { locked: true });
  },

  offlineModal(sec, eff, g, r) {
    this.modal('Bem-vindo de volta!', `<p style="margin:0 0 4px;color:#d8cfe6">Seu herói continuou explorando por <b>${U.fmtTime(sec)}</b> (eficiência ${Math.round(eff * 100)}%).</p>
      <div class="offline-list">
        <div><span>Ouro</span><b>+${U.fmt(g.gold)}</b></div>
        <div><span>Experiência</span><b style="color:#c9a0ff">+${U.fmt(g.xp)}</b></div>
        ${r.levels ? `<div><span>Níveis</span><b style="color:#c9a0ff">+${r.levels}</b></div>` : ''}
        <div><span>Itens encontrados</span><b style="color:var(--text)">${r.items}${r.sold ? ` <small style="color:var(--muted);font-family:var(--sans)">(${r.sold} vendidos)</small>` : ''}</b></div>
      </div>`, [{ label: 'Continuar', cls: 'gold' }]);
  },
};
