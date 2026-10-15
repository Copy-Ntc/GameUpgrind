'use strict';
// ============================================================
// Supabase falso, em memória, para testar contas, save na nuvem e placar
// sem servidor. Uso no console do navegador (com o jogo aberto):
//   const s = document.createElement('script'); s.src = 'dev/mock-online.js'; document.head.appendChild(s);
//   // depois: MockOnline.start()
// Tudo some ao recarregar a página.
// ============================================================
(() => {
  const db = { users: [], profiles: [], saves: [], leaderboard: [] };
  let session = null;
  const listeners = [];
  const clone = x => JSON.parse(JSON.stringify(x));
  const err = message => ({ data: null, error: { message } });

  const auth = {
    async getSession() { return { data: { session } }; },
    onAuthStateChange(cb) { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
    async signUp({ email, password, options }) {
      if (!/^\S+@\S+\.\S+$/.test(email)) return err('Unable to validate email address: invalid format');
      if (db.users.find(u => u.email === email)) return err('User already registered');
      if (!password || password.length < 6) return err('Password should be at least 6 characters');
      const u = { id: 'user-' + (db.users.length + 1), email, password, user_metadata: (options && options.data) || {} };
      db.users.push(u);
      session = { user: u };
      return { data: { user: u, session }, error: null };
    },
    async signInWithPassword({ email, password }) {
      const u = db.users.find(x => x.email === email && x.password === password);
      if (!u) return err('Invalid login credentials');
      session = { user: u };
      return { data: { user: u, session }, error: null };
    },
    async signOut() { session = null; listeners.forEach(f => f('SIGNED_OUT', null)); return { error: null }; },
    async resetPasswordForEmail() { return { error: null }; },
    async updateUser() { return { error: null }; },
  };

  function from(table) {
    const filters = [], orderBy = [];
    let op = 'select', payload = null, lim = 0, single = false, maybe = false;
    const api = {
      select() { return api; },
      eq(c, v) { filters.push(r => r[c] === v); return api; },
      ilike(c, v) { const re = new RegExp('^' + v.replace(/\\([\\%_])/g, '$1').replace(/[.*+?^${}()|[\]]/g, '\\$&') + '$', 'i'); filters.push(r => re.test(r[c])); return api; },
      order(c, o) { orderBy.push([c, o && o.ascending === false ? -1 : 1]); return api; },
      limit(n) { lim = n; return api; },
      single() { single = true; return api; },
      maybeSingle() { maybe = true; return api; },
      insert(p) { op = 'insert'; payload = p; return api; },
      update(p) { op = 'update'; payload = p; return api; },
      upsert(p) { op = 'upsert'; payload = p; return api; },
      delete() { op = 'delete'; return api; },
      then(res, rej) { return new Promise(r => setTimeout(r, 30)).then(run).then(res, rej); },
    };
    function run() {
      const T = db[table], uid = session && session.user.id;
      const match = r => filters.every(f => f(r));
      if (op === 'insert') {
        if (table === 'profiles' && payload.id !== uid) return err('new row violates row-level security policy');
        if (table === 'profiles' && T.some(r => r.name.toLowerCase() === payload.name.toLowerCase())) return err('duplicate key value violates unique constraint "profiles_name_lower"');
        T.push(clone(payload));
        return { data: single ? clone(payload) : [clone(payload)], error: null };
      }
      if (op === 'update') {
        const rs = T.filter(match).filter(r => table !== 'profiles' || r.id === uid);
        if (table === 'profiles' && payload.name && db.profiles.some(r => r.id !== uid && r.name.toLowerCase() === payload.name.toLowerCase())) return err('duplicate key value violates unique constraint "profiles_name_lower"');
        rs.forEach(r => Object.assign(r, clone(payload)));
        if (table === 'profiles' && payload.name) db.leaderboard.filter(l => l.user_id === uid).forEach(l => { l.name = payload.name; });
        return { data: single ? clone(rs[0]) : clone(rs), error: null };
      }
      if (op === 'upsert') {
        if (payload.user_id !== uid) return err('new row violates row-level security policy');
        const i = T.findIndex(r => r.user_id === payload.user_id && r.slot === payload.slot);
        if (i >= 0) T[i] = clone(payload); else T.push(clone(payload));
        return { data: null, error: null };
      }
      if (op === 'delete') {
        for (let i = T.length - 1; i >= 0; i--) if (match(T[i]) && (table !== 'saves' || T[i].user_id === uid)) T.splice(i, 1);
        return { data: null, error: null };
      }
      let rs = T.filter(match);
      if (table === 'saves') rs = rs.filter(r => r.user_id === uid);
      for (const [c, d] of orderBy.slice().reverse()) rs.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * d);
      if (lim) rs = rs.slice(0, lim);
      rs = clone(rs);
      if (maybe) return { data: rs[0] || null, error: null };
      if (single) return rs[0] ? { data: rs[0], error: null } : err('JSON object requested, multiple (or no) rows returned');
      return { data: rs, error: null };
    }
    return api;
  }

  async function rpc(fn, p) {
    await new Promise(r => setTimeout(r, 30));
    if (fn !== 'submit_score') return err('function not found');
    const uid = session && session.user.id;
    if (!uid) return err('not authenticated');
    const prof = db.profiles.find(x => x.id === uid);
    if (!prof) return err('no profile');
    let l = db.leaderboard.find(x => x.user_id === uid);
    if (!l) { l = { user_id: uid, max_zone: 0, max_hit: 0, play_time: 0, level: 0, ascensions: 0 }; db.leaderboard.push(l); }
    if (p.p_zone >= l.max_zone) Object.assign(l, { hero: p.p_hero, cls: p.p_cls, species: p.p_species });
    Object.assign(l, {
      name: prof.name, max_zone: Math.max(l.max_zone, p.p_zone), max_hit: Math.max(l.max_hit, p.p_hit),
      play_time: Math.max(l.play_time, p.p_time), level: Math.max(l.level, p.p_level), ascensions: Math.max(l.ascensions, p.p_asc),
      updated_at: new Date().toISOString(),
    });
    return { data: null, error: null };
  }

  window.MockOnline = {
    db,
    // Liga o modo online usando este servidor falso
    start() {
      window.supabase = { createClient() { return { auth, from, rpc }; } };
      ONLINE_CONFIG.url = 'https://mock.local';
      ONLINE_CONFIG.key = 'mock';
      Online.ready = false;
      UI.showTitle('new');
      return Online.init();
    },
  };
})();
