'use strict';
// ============================================================
// Online (opcional): conta, save na nuvem e placar via Supabase.
// Só liga quando js/online-config.js tem a URL e a chave do projeto;
// sem isso o jogo funciona igual, salvando apenas no navegador.
// ============================================================
const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js';
const CLOUD_PUSH_EVERY = 60;   // segundos entre envios do save para a nuvem
const SCORE_PUSH_EVERY = 120;  // segundos entre envios para o placar
const BOARD_COLS = [
  ['max_zone', 'Zona'],
  ['max_hit', 'Maior golpe'],
  ['play_time', 'Tempo de jogo'],
  ['level', 'Nível'],
];

const Online = {
  enabled: false, ready: false, sb: null, user: null, profile: null, error: '',
  dirty: new Set(), pushT: 0, scoreT: 0, scoreDirty: false, busy: false, lastPush: 0, recovering: false,

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
      s.onload = () => res();
      s.onerror = () => rej(new Error('Falha ao carregar a biblioteca do Supabase'));
      document.head.appendChild(s);
    });
  },

  // Mensagens de erro do Supabase em português
  errText(e) {
    const m = String((e && e.message) || e || '');
    if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/already registered|already been registered/i.test(m)) return 'Esse e-mail já tem uma conta. Use "Entrar".';
    if (/password should be at least|weak password/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
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
    if (await this.nameTaken(name)) throw new Error('Esse apelido já está em uso.');
    const { data, error } = await this.sb.auth.signUp({ email, password: pass, options: { data: { name }, emailRedirectTo: location.origin + location.pathname } });
    if (error) throw error;
    if (!data.session) return 'confirm'; // o projeto exige confirmar o e-mail
    await this.afterLogin(data.user);
    return 'ok';
  },

  async signIn(email, pass) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    await this.afterLogin(data.user);
  },

  async resetPassword(email) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw error;
  },
  async setNewPassword(pass) {
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

  async syncSlots() {
    if (!this.user) return;
    const uid = this.user.id;
    const { data, error } = await this.sb.from('saves').select('slot, data').eq('user_id', uid);
    if (error) throw error;
    const cloud = [null, null, null];
    for (const r of data || []) if (r.slot >= 1 && r.slot <= 3 && r.data && r.data.cls) cloud[r.slot - 1] = r.data;
    const local = [1, 2, 3].map(n => Game.peekSave(n));
    const backups = Game.listBackups();
    const m = this.merge(local, cloud, uid, backups.map(b => b.data));
    for (const b of backups) Game.deleteBackup(b.key);
    for (let i = 0; i < 3; i++) {
      if (m.slots[i]) { m.slots[i].owner = uid; Game.writeSlot(i + 1, m.slots[i]); } else Game.deleteSlotLocal(i + 1);
    }
    for (const o of m.lost) Game.addBackup(o);
    if (m.lost.length) UI.notice(`${m.lost.length} herói(s) não couberam nos 3 slots e ficaram guardados neste navegador. Libere um slot e entre de novo para recuperar.`, 'var(--gold)');
    for (const i of m.upload) await this.upload(i + 1, m.slots[i]);
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
        const data = n === Game.slot && Game.state ? Game.state : Game.peekSave(n);
        this.dirty.delete(n);
        try { await this.upload(n, data); } catch (e) { this.dirty.add(n); throw e; }
      }
      this.lastPush = Date.now();
      if (this.scoreDirty) await this.submitScore();
      this.error = '';
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
  // Melhores marcas somando os slots da conta (o servidor só guarda se for recorde)
  scoreFrom(saves) {
    if (!saves.length) return null;
    let best = saves[0], hit = 0, time = 0, lvl = 0, asc = 0;
    for (const s of saves) {
      if ((s.stats.maxZone || 0) > (best.stats.maxZone || 0)) best = s;
      hit = Math.max(hit, s.stats.highestHit || 0);
      time += s.stats.playTime || 0;
      lvl = Math.max(lvl, s.stats.maxLevel || s.level || 0);
      asc = Math.max(asc, s.stats.ascensions || 0);
    }
    return {
      p_hero: best.name, p_cls: Game.className(best), p_species: Game.speciesName(best),
      p_zone: best.stats.maxZone || 0, p_hit: hit, p_time: Math.floor(time), p_level: lvl, p_asc: asc,
    };
  },
  async submitScore() {
    if (!this.loggedIn) return;
    const uid = this.user.id;
    const saves = [1, 2, 3].map(n => (n === Game.slot && Game.state && Game.running ? Game.state : Game.peekSave(n)))
      .filter(s => s && (!s.owner || s.owner === uid));
    const p = this.scoreFrom(saves);
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
