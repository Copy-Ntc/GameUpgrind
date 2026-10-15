'use strict';
// ============================================================
// Online (opcional): conta, save na nuvem e placar via Supabase.
// Só liga quando js/online-config.js tem a URL e a chave do projeto;
// sem isso o jogo funciona igual, salvando apenas no navegador.
// ============================================================
const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js';
// Impressão digital do arquivo acima: se o CDN entregar qualquer coisa diferente, o navegador recusa.
// Ao trocar a versão, gere de novo (veja ONLINE.md).
const SUPABASE_SRI = 'sha384-rwykjmWNwVxboyFmvK9OXN0wj9hnMHA2aAHtits54DuACyCq0M2PrSNxhRb+hvXT';
const TURNSTILE_JS = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const MIN_PASS = 8;               // senha mínima para contas novas (deixe igual à do painel do Supabase)
const CLOUD_PUSH_EVERY = 60;   // segundos entre envios do save para a nuvem
const SCORE_PUSH_EVERY = 120;  // segundos entre envios para o placar
const BOARD_COLS = [
  ['max_zone', 'Zona'],
  ['max_hit', 'Maior golpe'],
  ['play_time', 'Tempo de jogo'],
  ['level', 'Nível'],
];

const PROFILE_SLOT = 0;          // na tabela saves, o slot 0 guarda o perfil (progresso permanente)
const PROFILE_SQL_HINT = 'Para guardar o perfil na nuvem, rode o arquivo online/atualizacao-perfil.sql no SQL Editor do Supabase (veja ONLINE.md). Enquanto isso, o perfil fica salvo neste navegador.';

const Online = {
  enabled: false, ready: false, sb: null, user: null, profile: null, error: '', profileBlocked: false,
  dirty: new Set(), pushT: 0, scoreT: 0, scoreDirty: false, busy: false, lastPush: 0, recovering: false,
  captcha: { id: null, token: '' },

  configured() { return typeof ONLINE_CONFIG !== 'undefined' && !!ONLINE_CONFIG.url && !!ONLINE_CONFIG.key; },
  get loggedIn() { return !!(this.user && this.profile); },

  async init() {
    if (!this.configured()) { this.ready = true; return; }
    this.enabled = true;
    try {
      await this.loadLib();
      this.sb = window.supabase.createClient(ONLINE_CONFIG.url, ONLINE_CONFIG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      this.sb.auth.onAuthStateChange((ev, session) => {
        if (ev === 'PASSWORD_RECOVERY') { this.recovering = true; setTimeout(() => UI.newPasswordModal(), 0); }
        if (ev === 'SIGNED_OUT') { this.user = null; this.profile = null; UI.onlineChanged(); }
      });
      const { data } = await this.sb.auth.getSession();
      if (data.session) await this.afterLogin(data.session.user);
    } catch (e) {
      console.warn('[online]', e);
      this.error = 'Sem conexão com o servidor do placar. O jogo continua salvando no navegador.';
    }
    this.ready = true;
    UI.onlineChanged();
  },

  loadLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = SUPABASE_CDN;
      s.integrity = SUPABASE_SRI;
      s.crossOrigin = 'anonymous';
      s.onload = () => res();
      s.onerror = () => rej(new Error('Falha ao carregar a biblioteca do Supabase'));
      document.head.appendChild(s);
    });
  },

  // ---------------------------------------------------------- anti-robô (Cloudflare Turnstile, opcional)
  // Liga quando ONLINE_CONFIG.turnstile tem a "site key"; o Supabase confere o token no cadastro, login e troca de senha.
  captchaOn() { return typeof ONLINE_CONFIG !== 'undefined' && !!ONLINE_CONFIG.turnstile; },
  loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    if (!this._tsLoad) this._tsLoad = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = TURNSTILE_JS; s.async = true;
      s.onload = () => res();
      s.onerror = () => { this._tsLoad = null; rej(new Error('Falha ao carregar a verificação anti-robô')); };
      document.head.appendChild(s);
    });
    return this._tsLoad;
  },
  async mountCaptcha(el) {
    if (!this.captchaOn() || !el) return;
    this.captcha.token = '';
    if (this.captcha.id != null && window.turnstile) { try { window.turnstile.remove(this.captcha.id); } catch (e) { /* já saiu */ } }
    this.captcha.id = null;
    try { await this.loadTurnstile(); } catch (e) { el.textContent = 'Não foi possível carregar a verificação anti-robô. Verifique a internet.'; return; }
    if (!el.isConnected) return;
    this.captcha.id = window.turnstile.render(el, {
      sitekey: ONLINE_CONFIG.turnstile, theme: 'dark', language: 'pt-br',
      callback: t => { this.captcha.token = t; },
      'expired-callback': () => { this.captcha.token = ''; },
      'error-callback': () => { this.captcha.token = ''; },
    });
  },
  captchaToken() {
    if (!this.captchaOn()) return undefined;
    if (!this.captcha.token) throw new Error('Confirme a verificação anti-robô (a caixa acima dos botões) e tente de novo.');
    return this.captcha.token;
  },
  // Cada token vale uma vez só: depois de cada tentativa, pede outro
  resetCaptcha() {
    this.captcha.token = '';
    if (this.captcha.id != null && window.turnstile) { try { window.turnstile.reset(this.captcha.id); } catch (e) { /* ok */ } }
  },

  // Mensagens de erro do Supabase em português
  errText(e) {
    const m = String((e && e.message) || e || '');
    if (/captcha/i.test(m)) return 'A verificação anti-robô falhou ou expirou. Marque a caixa de novo.';
    if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/already registered|already been registered/i.test(m)) return 'Esse e-mail já tem uma conta. Use "Entrar".';
    if (/password should be at least|weak password/i.test(m)) { const n = (m.match(/at least (\d+)/i) || [])[1] || MIN_PASS; return `A senha precisa ter pelo menos ${n} caracteres.`; }
    if (/email not confirmed/i.test(m)) return 'Confirme seu e-mail (veja a caixa de entrada) antes de entrar.';
    if (/rate limit|too many|security purposes/i.test(m)) return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
    if (/invalid.*email|email.*invalid|unable to validate email/i.test(m)) return 'E-mail inválido.';
    if (/failed to fetch|network/i.test(m)) return 'Sem conexão com o servidor. Verifique a internet.';
    if (/duplicate key|profiles_name_lower/i.test(m)) return 'Esse apelido já está em uso.';
    return m || 'Algo deu errado. Tente de novo.';
  },

  validName(name) { return /^[\p{L}\p{N}_ .-]{2,20}$/u.test(name) && name.trim().length >= 2; },

  async nameTaken(name) {
    const { data, error } = await this.sb.from('profiles').select('id').ilike('name', name.replace(/[\\%_]/g, '\\$&')).limit(1);
    if (error) throw error;
    return data.length > 0;
  },

  async signUp(email, pass, name) {
    name = (name || '').trim();
    if (!this.validName(name)) throw new Error('Apelido inválido: use de 2 a 20 letras, números, espaço, _ . ou -.');
    if (String(pass || '').length < MIN_PASS) throw new Error(`A senha precisa ter pelo menos ${MIN_PASS} caracteres.`);
    if (await this.nameTaken(name)) throw new Error('Esse apelido já está em uso.');
    const captchaToken = this.captchaToken();
    const { data, error } = await this.sb.auth.signUp({ email, password: pass, options: { data: { name }, emailRedirectTo: location.origin + location.pathname, captchaToken } }).finally(() => this.resetCaptcha());
    if (error) throw error;
    if (!data.session) return 'confirm'; // o projeto exige confirmar o e-mail
    await this.afterLogin(data.user);
    return 'ok';
  },

  async signIn(email, pass) {
    const captchaToken = this.captchaToken();
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password: pass, options: { captchaToken } }).finally(() => this.resetCaptcha());
    if (error) throw error;
    await this.afterLogin(data.user);
  },

  async resetPassword(email) {
    const captchaToken = this.captchaToken();
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname, captchaToken }).finally(() => this.resetCaptcha());
    if (error) throw error;
  },
  async setNewPassword(pass) {
    if (String(pass || '').length < MIN_PASS) throw new Error(`A senha precisa ter pelo menos ${MIN_PASS} caracteres.`);
    const { error } = await this.sb.auth.updateUser({ password: pass });
    if (error) throw error;
    this.recovering = false;
  },

  async afterLogin(user) {
    this.user = user;
    let { data: prof, error } = await this.sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) throw error;
    if (!prof) {
      // primeiro login: cria o perfil com o apelido escolhido no cadastro
      let name = ((user.user_metadata && user.user_metadata.name) || (user.email || 'heroi').split('@')[0]).slice(0, 20);
      if (!this.validName(name)) name = 'Heroi' + Math.floor(Math.random() * 9000 + 1000);
      for (let i = 0; i < 4 && !prof; i++) {
        const ins = await this.sb.from('profiles').insert({ id: user.id, name }).select().single();
        if (!ins.error) prof = ins.data;
        else if (/duplicate|profiles_name_lower/i.test(ins.error.message)) name = name.slice(0, 15) + Math.floor(Math.random() * 9000 + 1000);
        else throw ins.error;
      }
    }
    this.profile = prof;
    await this.syncSlots();
    this.scoreDirty = true;
    UI.onlineChanged();
  },

  async signOut() {
    if (!this.user) return;
    await this.flush();
    const uid = this.user.id;
    // os heróis desta conta continuam na nuvem; tira as cópias locais para a próxima conta
    for (let n = 1; n <= SLOT_COUNT; n++) { const sv = Game.peekSave(n); if (sv && sv.owner === uid) Game.deleteSlotLocal(n); }
    // o perfil da conta também sai deste navegador (volta inteiro ao entrar de novo)
    Game.setProfile(Game.defaultProfile());
    if (!Game.running) { Game.state = null; Game.W = null; }
    try { await this.sb.auth.signOut(); } catch (e) { /* ok */ }
    this.user = null; this.profile = null;
    UI.onlineChanged();
  },

  async rename(name) {
    name = (name || '').trim();
    if (!this.validName(name)) throw new Error('Apelido inválido: use de 2 a 20 letras, números, espaço, _ . ou -.');
    const { data, error } = await this.sb.from('profiles').update({ name }).eq('id', this.user.id).select().single();
    if (error) throw error;
    this.profile = data;
  },

  // ---------------------------------------------------------- save na nuvem
  // Junta os slots do navegador com os da nuvem sem perder nenhum herói.
  // local/cloud: arrays de 3 posições (save ou null). extras: heróis guardados à parte.
  merge(local, cloud, uid, extras = []) {
    const out = [null, null, null], upload = new Set(), orphans = [...extras];
    for (let i = 0; i < 3; i++) {
      let l = local[i];
      const c = cloud[i];
      if (l && l.owner && l.owner !== uid) { orphans.push(l); l = null; } // herói de outra conta: não mistura
      if (l && c) {
        if (l.created === c.created) {
          if ((l.lastSave || 0) > (c.lastSave || 0)) { out[i] = l; upload.add(i); } else out[i] = c;
        } else { out[i] = c; orphans.push(l); }
      } else if (l) { out[i] = l; upload.add(i); }
      else out[i] = c;
    }
    const lost = [];
    for (const o of orphans) {
      if (o.owner && o.owner !== uid) { lost.push(o); continue; }
      if (out.some(s => s && s.created === o.created)) continue;
      const k = out.indexOf(null);
      if (k >= 0) { out[k] = o; upload.add(k); } else lost.push(o);
    }
    return { slots: out, upload, lost };
  },

  // Decide qual perfil vale ao entrar na conta
  hasProgress(p) { return !!p && ((p.stats.ascensions || 0) > 0 || (p.souls || 0) > 0 || (p.stats.playTime || 0) > 600); },
  pickProfile(localP, cloudP, legacy, uid) {
    const mine = localP && (!localP.owner || localP.owner === uid) ? localP : null;
    if (cloudP && cloudP.stats) {
      if (mine && mine.pid === cloudP.pid) return (mine.lastSave || 0) > (cloudP.lastSave || 0) ? { p: mine, upload: true } : { p: cloudP, upload: false };
      if (mine && !mine.owner && this.hasProgress(mine)) return { p: cloudP, upload: false, backup: mine };
      return { p: cloudP, upload: false };
    }
    // conta ainda sem perfil na nuvem: junta este navegador com os saves antigos da conta
    return { p: Game.buildProfile([mine, ...legacy]), upload: true };
  },

  async syncSlots() {
    if (!this.user) return;
    const uid = this.user.id;
    const { data, error } = await this.sb.from('saves').select('slot, data').eq('user_id', uid);
    if (error) throw error;
    const cloud = [null, null, null];
    let cloudP = null;
    for (const r of data || []) {
      let d = null;
      try { d = U.cleanData(r.data); } catch (e) { console.warn('[online] save da nuvem ignorado', e); }
      if (!d || typeof d !== 'object') continue;
      if (r.slot === PROFILE_SLOT) cloudP = d;
      else if (r.slot >= 1 && r.slot <= 3 && d.cls) cloud[r.slot - 1] = d;
    }
    const pick = this.pickProfile(Game.profile, cloudP, cloud.filter(x => x && x.stats), uid);
    if (pick.backup) {
      Store.set('upgrind_profile_backup_' + pick.backup.pid, JSON.stringify(pick.backup));
      UI.notice('Esta conta já tinha um perfil na nuvem e ele foi carregado. O progresso que estava neste navegador sem conta ficou guardado como cópia.', 'var(--gold)');
    }
    pick.p.owner = uid;
    Game.setProfile(pick.p);
    if (pick.upload) this.dirty.add(PROFILE_SLOT);
    const local = [1, 2, 3].map(n => Game.peekSave(n));
    const backups = Game.listBackups();
    const m = this.merge(local, cloud, uid, backups.map(b => b.data));
    for (const b of backups) Game.deleteBackup(b.key);
    for (let i = 0; i < 3; i++) {
      if (m.slots[i]) { m.slots[i].owner = uid; Game.writeSlot(i + 1, m.slots[i]); } else Game.deleteSlotLocal(i + 1);
    }
    for (const o of m.lost) Game.addBackup(o);
    if (m.lost.length) UI.notice(`${m.lost.length} herói(s) não couberam nos 3 slots e ficaram guardados neste navegador. Libere um slot e entre de novo para recuperar.`, 'var(--gold)');
    for (const i of m.upload) await this.upload(i + 1, Game.runPart(m.slots[i]));
    if (this.dirty.has(PROFILE_SLOT)) { this.dirty.delete(PROFILE_SLOT); await this.uploadProfile(); }
  },
  // O perfil vai no slot 0; se o banco ainda não aceita o slot 0, avisa e segue salvando no navegador
  async uploadProfile() {
    if (this.profileBlocked || !Game.profile) return;
    try { await this.upload(PROFILE_SLOT, Game.profile); }
    catch (e) {
      if (/check constraint|saves_slot_check|violates/i.test(String(e && e.message))) { this.profileBlocked = true; this.error = PROFILE_SQL_HINT; return; }
      throw e;
    }
  },

  async upload(n, data) {
    if (!this.user || !data) return;
    data.owner = this.user.id;
    const { error } = await this.sb.from('saves').upsert({ user_id: this.user.id, slot: n, data, updated_at: new Date().toISOString() });
    if (error) throw error;
  },

  onSave(n) { if (this.loggedIn) this.dirty.add(n); },
  deleteCloud(n) {
    if (!this.loggedIn) return;
    this.dirty.delete(n);
    this.sb.from('saves').delete().eq('user_id', this.user.id).eq('slot', n).then(({ error }) => { if (error) console.warn('[online]', error); });
    this.scoreDirty = true;
  },

  // Envia o que mudou (chamado periodicamente, ao sair da run e ao esconder a aba)
  async flush() {
    if (!this.loggedIn || this.busy) return;
    this.busy = true;
    try {
      for (const n of [...this.dirty]) {
        this.dirty.delete(n);
        if (n === PROFILE_SLOT) { try { await this.uploadProfile(); } catch (e) { this.dirty.add(n); throw e; } continue; }
        const data = n === Game.slot && Game.state ? Game.runPart(Game.state) : Game.peekSave(n);
        if (!data) continue;
        try { await this.upload(n, data); } catch (e) { this.dirty.add(n); throw e; }
      }
      this.lastPush = Date.now();
      if (this.scoreDirty) await this.submitScore();
      this.error = this.profileBlocked ? PROFILE_SQL_HINT : '';
    } catch (e) {
      console.warn('[online]', e);
      this.error = this.errText(e);
    }
    this.busy = false;
  },

  tick(dt) {
    if (!this.loggedIn) return;
    this.pushT += dt; this.scoreT += dt;
    if (this.scoreT > SCORE_PUSH_EVERY) { this.scoreT = 0; this.scoreDirty = true; }
    if (this.pushT > CLOUD_PUSH_EVERY && (this.dirty.size || this.scoreDirty)) { this.pushT = 0; this.flush(); }
  },

  // ---------------------------------------------------------- placar
  // As marcas são do perfil (todas as jornadas); o herói mostrado é o atual ou o último jogado
  scoreFrom(P, hero) {
    if (!P || !P.stats) return null;
    const s = P.stats, h = hero || P.lastHero || { name: '', cls: '', species: '' };
    return {
      p_hero: h.name || '', p_cls: h.cls || '', p_species: h.species || '',
      p_zone: s.maxZone || 0, p_hit: s.highestHit || 0, p_time: Math.floor(s.playTime || 0), p_level: s.maxLevel || 0, p_asc: s.ascensions || 0,
    };
  },
  async submitScore() {
    if (!this.loggedIn) return;
    const hero = Game.state && Game.running ? { name: Game.state.name, cls: Game.className(), species: Game.speciesName() } : null;
    const p = this.scoreFrom(Game.profile, hero);
    this.scoreDirty = false;
    if (!p) return;
    const { error } = await this.sb.rpc('submit_score', p);
    if (error) { this.scoreDirty = true; throw error; }
  },
  async top(col, limit = 50) {
    const { data, error } = await this.sb.from('leaderboard')
      .select('user_id,name,hero,cls,species,max_zone,max_hit,play_time,level,ascensions')
      .order(col, { ascending: false }).order('updated_at', { ascending: true }).limit(limit);
    if (error) throw error;
    return data || [];
  },
};
