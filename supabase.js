// ════════════════════════════════════════════════════════
// CRYPTOKASINO — supabase.js  v2.0
// DEMO/REAL SEPARATION — demo nikdy nejde do DB
// ════════════════════════════════════════════════════════
 
(async function () {
 
  // ── CONFIG ───────────────────────────────────────────
  const SUPABASE_URL = 'https://cckybsbawnsbvxwloxcr.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNja3lic2Jhd25zYnZ4d2xveGNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzE5NjAsImV4cCI6MjA5MDkwNzk2MH0.M-hl7VXWF52jfnkg3zu78yiY_CT4yn3ljefej0BN2oY';
 
  // ── INIT ─────────────────────────────────────────────
  let sb = null;
  let _session = null;
  let _profile = null;
 
  // ═══════════════════════════════════════════════════
  // DEMO MODE FIREWALL
  // isDemoMode() = true  → žádné DB operace, tiché ignorování
  // isDemoMode() = false → reálné BTC, DB operace povoleny
  //
  // Pravidla:
  //  - Nepřihlášený hráč → VŽDY demo
  //  - Přihlášený + gameMode='demo' → demo (žádné DB operace)
  //  - Přihlášený + gameMode='real' → real (DB operace povoleny)
  //
  // DŮLEŽITÉ: Každá hra si sama spravuje window._ckGameMode
  // supabase.js ho pouze čte — nikdy nepíše
  // ═══════════════════════════════════════════════════
 
  function isDemoMode() {
    // 1. Nepřihlášený = vždy demo
    if (!_session) return true;
    // 2. Hra nastavila explicitní demo mode
    if (window._ckGameMode === 'demo') return true;
    // 3. Hra nastavila real mode
    if (window._ckGameMode === 'real') return false;
    // 4. Fallback — pokud hra neregistrovala mode, považuj za demo (bezpečné)
    return true;
  }
 
  try {
    const { createClient } = supabase;
    sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data } = await sb.auth.getSession();
    _session = data?.session || null;
  } catch (e) {
    console.warn('[CK] Supabase init failed:', e.message);
  }
 
  // ── INTERNAL ─────────────────────────────────────────
  async function _getProfile() {
    if (!sb || !_session) return null;
    if (_profile) return _profile;
    try {
      const { data } = await sb
        .from('profiles')
        .select('id, username, balance, vip_level, total_wagered')
        .eq('id', _session.user.id)
        .single();
      _profile = data;
      return _profile;
    } catch (e) {
      console.warn('[CK] getProfile error:', e.message);
      return null;
    }
  }
 
  // ════════════════════════════════════════════════════
  // PUBLIC API — window.CK
  // ════════════════════════════════════════════════════
  window.CK = {
 
    // ── Registrace game mode (volá se z každé hry) ───
    // Hry volají: CK.setGameMode('demo') nebo CK.setGameMode('real')
    // Tím se nastaví globální firewall pro všechny DB operace
    setGameMode(mode) {
      window._ckGameMode = mode; // 'demo' | 'real'
      console.log('[CK] GameMode set to:', mode, '| DB ops:', mode === 'real' ? 'ENABLED' : 'BLOCKED');
    },
 
    // ── Aktuální game mode ───────────────────────────
    getGameMode() {
      return window._ckGameMode || 'demo';
    },
 
    // ── Je demo? ─────────────────────────────────────
    isDemo() {
      return isDemoMode();
    },
 
    // ── Je hráč přihlášen? ───────────────────────────
    isLoggedIn() {
      return !!_session;
    },
 
    // ── User ─────────────────────────────────────────
    getUser() {
      return _session?.user || null;
    },
 
    // ── Username ─────────────────────────────────────
    async getUsername() {
      const p = await _getProfile();
      return p?.username || _session?.user?.email?.split('@')[0] || 'Guest';
    },
 
    // ── Balance v BTC (VŽDY reálná z DB) ─────────────
    // Hry samy spravují demoBalance lokálně
    // Tato funkce vrací POUZE reálnou DB balance
    async getBalance() {
      if (!_session) return 0; // nepřihlášený = 0 (hry si samy nastaví demo)
      const p = await _getProfile();
      if (!p) return 0;
      return parseFloat(p.balance || 0);
    },
 
    // ── Balance v satoshi ────────────────────────────
    async getBalanceSat() {
      const bal = await this.getBalance();
      return Math.floor(bal * 1e8);
    },
 
    // ── Refresh balance ──────────────────────────────
    async refreshBalance() {
      _profile = null;
      return await this.getBalance();
    },
 
    // ── Odečti sázku — POUZE v real mode ────────────
    async deductBet(satoshi) {
      // FIREWALL: demo mode = tiché ignorování, žádný DB zápis
      if (isDemoMode()) {
        console.log('[CK] deductBet BLOCKED (demo mode)');
        return { ok: true, demo: true };
      }
      if (!sb || !_session) return { ok: true, demo: true };
 
      try {
        const { data, error } = await sb.rpc('deduct_balance', {
          p_user_id: _session.user.id,
          p_amount_sat: Math.floor(satoshi)
        });
        if (error) throw error;
        _profile = null;
        return { ok: true, new_balance: data };
      } catch (e) {
        console.warn('[CK] deductBet error:', e.message);
        return { ok: false, error: e.message };
      }
    },
 
    // ── Přičti výhru — POUZE v real mode ────────────
    async addWin(satoshi) {
      // FIREWALL: demo mode = tiché ignorování
      if (isDemoMode()) {
        console.log('[CK] addWin BLOCKED (demo mode)');
        return { ok: true, demo: true };
      }
      if (!sb || !_session) return { ok: true, demo: true };
 
      try {
        const { data, error } = await sb.rpc('add_balance', {
          p_user_id: _session.user.id,
          p_amount_sat: Math.floor(satoshi)
        });
        if (error) throw error;
        _profile = null;
        return { ok: true, new_balance: data };
      } catch (e) {
        console.warn('[CK] addWin error:', e.message);
        return { ok: false, error: e.message };
      }
    },
 
    // ── Zapiš sázku do DB — POUZE v real mode ────────
    async logBet(game, betSatoshi, profitSatoshi, multiplier = 0, meta = {}) {
      // FIREWALL: demo mode = absolutně žádný DB zápis
      if (isDemoMode()) {
        console.log('[CK] logBet BLOCKED (demo mode) game:', game, 'bet:', betSatoshi);
        return; // tiché ignorování
      }
      if (!sb || !_session) return;
 
      try {
        await sb.from('bets').insert({
          user_id:        _session.user.id,
          game,
          bet_satoshi:    Math.floor(betSatoshi),
          profit_satoshi: Math.floor(profitSatoshi),
          multiplier:     parseFloat(multiplier) || 0,
          meta,
          created_at:     new Date().toISOString()
        });
 
        // Update game_settings counters
        try {
          const { data: gs } = await sb
            .from('game_settings')
            .select('total_bets_count,total_wagered_sat,total_profit_sat')
            .eq('game_id', game)
            .single();
          if (gs) {
            await sb.from('game_settings').update({
              total_bets_count: (parseInt(gs.total_bets_count) || 0) + 1,
              total_wagered_sat: (parseInt(gs.total_wagered_sat) || 0) + Math.floor(betSatoshi),
              total_profit_sat: (parseInt(gs.total_profit_sat) || 0) + (-Math.floor(profitSatoshi)),
              updated_at: new Date().toISOString()
            }).eq('game_id', game);
          }
        } catch (e2) { /* game_settings update není kritické */ }
 
      } catch (e) {
        console.warn('[CK] logBet error:', e.message);
      }
    },
 
    // ── Kompletní sázka (deduct + win + log) ─────────
    // FIREWALL: v demo mode jen loguje lokálně, žádné DB
    async placeBet(game, betSatoshi, profitSatoshi, multiplier = 0, meta = {}) {
      if (isDemoMode()) {
        console.log('[CK] placeBet BLOCKED (demo mode)');
        return { ok: true, demo: true };
      }
 
      const deduct = await this.deductBet(betSatoshi);
      if (!deduct.ok && !deduct.demo) return deduct;
 
      if (profitSatoshi > 0) {
        await this.addWin(profitSatoshi);
      }
 
      await this.logBet(game, betSatoshi, profitSatoshi - betSatoshi, multiplier, meta);
      const newBal = await this.refreshBalance();
      return { ok: true, new_balance: newBal };
    },
 
    // ── Jackpot ──────────────────────────────────────
    async getJackpot() {
      if (!sb) return 0.001;
      try {
        const { data } = await sb
          .from('jackpot')
          .select('amount_satoshi')
          .eq('id', 1)
          .single();
        return data ? parseFloat(data.amount_satoshi) / 1e8 : 0.001;
      } catch (e) {
        return 0.001;
      }
    },
 
    async triggerJackpot() {
      if (isDemoMode()) return null; // FIREWALL
      if (!sb || !_session) return null;
      try {
        const jackpotBtc = await this.getJackpot();
        await sb.rpc('add_balance', {
          p_user_id: _session.user.id,
          p_amount_sat: Math.floor(jackpotBtc * 1e8)
        });
        await sb.rpc('reset_jackpot', { p_winner_id: _session.user.id });
        _profile = null;
        return jackpotBtc;
      } catch (e) {
        console.warn('[CK] triggerJackpot error:', e.message);
        return null;
      }
    },
 
    // ── VIP level ────────────────────────────────────
    async getVipLevel() {
      const p = await _getProfile();
      return p?.vip_level || 'none';
    },
 
    // ── Bet history ──────────────────────────────────
    async getBetHistory(game = null, limit = 20) {
      if (!sb || !_session) return [];
      try {
        let q = sb
          .from('bets')
          .select('*')
          .eq('user_id', _session.user.id)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (game) q = q.eq('game', game);
        const { data } = await q;
        return data || [];
      } catch (e) {
        return [];
      }
    },
 
    // ── Session stats ─────────────────────────────────
    async getSessionStats(game) {
      if (!sb || !_session) return null;
      try {
        const { data } = await sb
          .from('bets')
          .select('bet_satoshi, profit_satoshi, multiplier')
          .eq('user_id', _session.user.id)
          .eq('game', game)
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
 
        if (!data || !data.length) return null;
        const totalBet    = data.reduce((s, b) => s + parseInt(b.bet_satoshi || 0), 0);
        const totalProfit = data.reduce((s, b) => s + parseInt(b.profit_satoshi || 0), 0);
        const wins        = data.filter(b => parseInt(b.profit_satoshi) > 0).length;
        const maxMulti    = Math.max(...data.map(b => parseFloat(b.multiplier || 0)));
        return { bets: data.length, wagered: totalBet / 1e8, profit: totalProfit / 1e8, winRate: data.length ? Math.round(wins / data.length * 100) : 0, bestMulti: maxMulti };
      } catch (e) {
        return null;
      }
    },
 
    // ── Update header balance ────────────────────────
    async updateHeaderBalance() {
      // Zobraz správnou balance dle aktuálního game mode
      const el = document.getElementById('headerBal');
      if (!el) return 0;
      if (isDemoMode()) {
        // V demo mode zobrazuj demo balance z hry (lokální proměnná)
        // Hry samy volají updateBal() — toto je jen fallback
        return 0;
      }
      const bal = await this.getBalance();
      el.textContent = bal.toFixed(8) + ' BTC';
      return bal;
    },
 
    // ── Require login ────────────────────────────────
    requireLogin(message = 'Please login to play') {
      if (!_session) {
        alert(message);
        window.location.href = 'login.html';
        return false;
      }
      return true;
    },
 
    // ── Logout ───────────────────────────────────────
    async logout() {
      if (sb) await sb.auth.signOut();
      window.location.href = 'login.html';
    },
 
    // ── Realtime balance subscribe ───────────────────
    subscribeBalance(callback) {
      if (!sb || !_session) return null;
      return sb
        .channel('balance:' + _session.user.id)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'profiles',
          filter: 'id=eq.' + _session.user.id
        }, (payload) => {
          _profile = payload.new;
          const bal = parseFloat(payload.new.balance || 0);
          if (!isDemoMode()) {
            const el = document.getElementById('headerBal');
            if (el) el.textContent = bal.toFixed(8) + ' BTC';
          }
          if (callback) callback(bal);
        })
        .subscribe();
    },
 
    // ── Game Settings ─────────────────────────────────
    async getGameSettings(gameId) {
      if (!window._gsCache) window._gsCache = {};
      if (!window._gsTTL) window._gsTTL = {};
      const now = Date.now(), TTL = 60000;
 
      if (window._gsCache[gameId] && (now - (window._gsTTL[gameId] || 0)) < TTL) {
        return window._gsCache[gameId];
      }
 
      const defaults = {
        crash:      { rtp: 97,   house_edge: 3   },
        slots:      { rtp: 95,   house_edge: 5   },
        roulette:   { rtp: 94.74,house_edge: 5.26},
        blackjack:  { rtp: 99.5, house_edge: 0.5 },
        dice:       { rtp: 98,   house_edge: 2   },
        mines:      { rtp: 97,   house_edge: 3   },
        plinko:     { rtp: 96,   house_edge: 4   },
        wheel:      { rtp: 96,   house_edge: 4   },
        poker:      { rtp: 97,   house_edge: 3   },
        craps:      { rtp: 98.6, house_edge: 1.4 },
        baccarat:   { rtp: 98.94,house_edge: 1.06},
        crazytime:  { rtp: 95,   house_edge: 5   },
        keno:       { rtp: 92,   house_edge: 8   },
        hilo:       { rtp: 97,   house_edge: 3   },
        limbo:      { rtp: 96,   house_edge: 4   },
        jackpot:    { rtp: 90,   house_edge: 10  },
        jackpotshow:{ rtp: 96.5, house_edge: 3.5 },
      };
 
      try {
        if (!sb) throw new Error('no sb');
        const { data, error } = await sb
          .from('game_settings')
          .select('*')
          .eq('game_id', gameId)
          .single();
        if (error || !data) throw new Error('not found');
        window._gsCache[gameId] = data;
        window._gsTTL[gameId] = now;
        return data;
      } catch (e) {
        console.warn('[CK] getGameSettings fallback for:', gameId);
        const def = defaults[gameId] || { rtp: 96, house_edge: 4 };
        window._gsCache[gameId] = def;
        window._gsTTL[gameId] = now;
        return def;
      }
    },
 
    clearGameSettingsCache(gameId) {
      if (!window._gsCache) return;
      if (gameId) delete window._gsCache[gameId];
      else window._gsCache = {};
    },
 
    // ── Raw Supabase client ──────────────────────────
    getClient() {
      return sb;
    }
 
  };
 
  // ── AUTO INIT ─────────────────────────────────────────
  // Neinicializuj balance display automaticky —
  // každá hra to dělá sama po nastavení gameMode
  console.log('[CK] supabase.js v2.0 loaded. Session:', !!_session, '| Default mode: DEMO (safe)');
  if (_session) {
    console.log('[CK] User:', _session.user.email);
    console.log('[CK] IMPORTANT: DB ops blocked until game calls CK.setGameMode("real")');
  }
 
})();
