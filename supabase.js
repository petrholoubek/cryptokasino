// ════════════════════════════════════════════════════════
// CRYPTOKASINO — supabase.js  v2.2
// DEMO/REAL SEPARATION — demo nikdy nejde do DB
// NOVA FUNKCE: initHeader() — automaticky upravuje header
//
// OPRAVY v2.2:
//  - initHeader() — po prihlaseni zmeni [Login] na [👤 Jméno]
//  - getGameSettings: eq('id') — spravny sloupec
//  - logBet: rtp_pct, total_wagered_btc — spravne nazvy
//  - Demo mode: neprihlaseni hraci mohou hrat bez omezeni
// ════════════════════════════════════════════════════════

(async function () {

  // ── CONFIG ───────────────────────────────────────────
  const SUPABASE_URL = 'https://cckybsbawnsbvxwloxcr.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNja3lic2Jhd25zYnZ4d2xveGNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzE5NjAsImV4cCI6MjA5MDkwNzk2MH0.M-hl7VXWF52jfnkg3zu78yiY_CT4yn3ljefej0BN2oY';

  let sb       = null;
  let _session = null;
  let _profile = null;

  // ════════════════════════════════════════════════════
  // DEMO MODE FIREWALL
  //  Neprihlaseny hrac          → VZDY demo (hraje zdarma)
  //  Prihlaseny + mode='demo'   → demo (zadne DB operace)
  //  Prihlaseny + mode='real'   → real (DB operace povoleny)
  // ════════════════════════════════════════════════════
  function isDemoMode() {
    if (!_session)                       return true;
    if (window._ckGameMode === 'demo')   return true;
    if (window._ckGameMode === 'real')   return false;
    return true;
  }

  // ── Supabase init ─────────────────────────────────
  try {
    const { createClient } = supabase;
    sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data } = await sb.auth.getSession();
    _session = data?.session || null;
  } catch (e) {
    console.warn('[CK] Supabase init failed:', e.message);
  }

  // ── Nacti profil z DB ─────────────────────────────
  async function _getProfile() {
    if (!sb || !_session) return null;
    if (_profile) return _profile;
    try {
      const { data } = await sb
        .from('profiles')
        .select('id, username, balance, vip_level, total_wagered, total_deposited')
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
  // INIT HEADER — automaticky upravi header na kazde strance
  // Vola se automaticky po nacteni supabase.js
  // Pokud je hrac prihlasen → zmeni [Login] na [👤 Jméno ▾]
  // ════════════════════════════════════════════════════
  async function initHeader() {
    const loginBtn  = document.querySelector('a.btn-login, .btn-login');
    const headerBal = document.getElementById('headerBal');
    const mobileMenu = document.getElementById('mobileMenu');

    if (!loginBtn) return;

    if (!_session) {
      // Neprihlaseny — nechej Login button jak je
      return;
    }

    // Prihlaseny — nacti profil
    const p = await _getProfile();
    const username = p?.username || _session.user.email?.split('@')[0] || 'Player';
    const balance  = parseFloat(p?.balance || 0);

    // Zmen [Login] na [👤 Jméno ▾] s dropdownem
    loginBtn.outerHTML = `
      <div class="user-menu-wrap" style="position:relative;">
        <button class="user-menu-btn" onclick="toggleUserMenu()" style="
          display:flex;align-items:center;gap:.45rem;
          background:rgba(212,160,23,.1);border:1px solid rgba(212,160,23,.28);
          color:var(--gold-light,#F5C842);padding:.38rem .85rem;border-radius:6px;
          font-family:'Cinzel',serif;font-size:.68rem;font-weight:700;cursor:pointer;
          transition:all .2s;white-space:nowrap;
        ">
          <span>👤</span>
          <span id="ckUsername">${username}</span>
          <span style="font-size:.55rem;opacity:.7;">▾</span>
        </button>
        <div id="userDropdown" style="
          display:none;position:absolute;right:0;top:calc(100% + 6px);
          background:rgba(8,5,12,.99);border:1px solid rgba(212,160,23,.25);
          border-radius:12px;padding:.5rem;min-width:180px;z-index:300;
          box-shadow:0 8px 32px rgba(0,0,0,.8);
        ">
          <div style="padding:.5rem .75rem .4rem;border-bottom:1px solid rgba(212,160,23,.1);margin-bottom:.3rem;">
            <div style="font-family:'Cinzel',serif;font-size:.58rem;color:var(--text-dim,#8a7a50);letter-spacing:.1em;text-transform:uppercase;">Balance</div>
            <div style="font-family:'Cinzel',serif;font-size:.88rem;font-weight:700;color:#4ade80;">${balance.toFixed(8)} BTC</div>
          </div>
          <a href="profile.html" style="display:flex;align-items:center;gap:.5rem;padding:.52rem .75rem;border-radius:7px;color:var(--text-dim,#8a7a50);text-decoration:none;font-family:'Cinzel',serif;font-size:.68rem;transition:all .2s;" onmouseover="this.style.background='rgba(212,160,23,.08)';this.style.color='#F5C842'" onmouseout="this.style.background='';this.style.color=''">
            👤 My Profile
          </a>
          <a href="deposit.html" style="display:flex;align-items:center;gap:.5rem;padding:.52rem .75rem;border-radius:7px;color:var(--text-dim,#8a7a50);text-decoration:none;font-family:'Cinzel',serif;font-size:.68rem;transition:all .2s;" onmouseover="this.style.background='rgba(212,160,23,.08)';this.style.color='#F5C842'" onmouseout="this.style.background='';this.style.color=''">
            ₿ Deposit BTC
          </a>
          <a href="casino.html" style="display:flex;align-items:center;gap:.5rem;padding:.52rem .75rem;border-radius:7px;color:var(--text-dim,#8a7a50);text-decoration:none;font-family:'Cinzel',serif;font-size:.68rem;transition:all .2s;" onmouseover="this.style.background='rgba(212,160,23,.08)';this.style.color='#F5C842'" onmouseout="this.style.background='';this.style.color=''">
            🎰 Casino
          </a>
          <div style="border-top:1px solid rgba(212,160,23,.1);margin-top:.3rem;padding-top:.3rem;">
            <button onclick="window.CK&&window.CK.logout()" style="display:flex;align-items:center;gap:.5rem;padding:.52rem .75rem;border-radius:7px;color:#f87171;background:none;border:none;font-family:'Cinzel',serif;font-size:.68rem;cursor:pointer;width:100%;transition:all .2s;" onmouseover="this.style.background='rgba(248,113,113,.08)'" onmouseout="this.style.background=''">
              🚪 Logout
            </button>
          </div>
        </div>
      </div>
    `;

    // Aktualizuj balance v headeru
    if (headerBal) {
      headerBal.textContent = balance.toFixed(8) + ' BTC';
      headerBal.style.color = '#4ade80';
    }

    // Pridej do mobile menu
    if (mobileMenu) {
      // Odstran stary login link z mobile menu
      const mobileLogin = mobileMenu.querySelector('a[href="login.html"]');
      if (mobileLogin) {
        mobileLogin.outerHTML = `
          <a href="profile.html">👤 ${username}</a>
          <a href="deposit.html">₿ Deposit</a>
        `;
      }
    }

    // Toggle dropdown
    window.toggleUserMenu = function() {
      const dd = document.getElementById('userDropdown');
      if (!dd) return;
      dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
    };

    // Zavri dropdown pri kliknuti mimo
    document.addEventListener('click', function(e) {
      const wrap = document.querySelector('.user-menu-wrap');
      if (wrap && !wrap.contains(e.target)) {
        const dd = document.getElementById('userDropdown');
        if (dd) dd.style.display = 'none';
      }
    });

    console.log('[CK] Header initialized for:', username);
  }

  // ════════════════════════════════════════════════════
  // PUBLIC API — window.CK
  // ════════════════════════════════════════════════════
  window.CK = {

    setGameMode(mode) {
      window._ckGameMode = mode;
      console.log('[CK] GameMode:', mode, '| DB:', mode === 'real' ? 'ENABLED' : 'BLOCKED');
    },

    getGameMode()  { return window._ckGameMode || 'demo'; },
    isDemo()       { return isDemoMode(); },
    isLoggedIn()   { return !!_session; },
    getUser()      { return _session?.user || null; },

    async getUsername() {
      const p = await _getProfile();
      return p?.username || _session?.user?.email?.split('@')[0] || 'Guest';
    },

    async getBalance() {
      if (!_session) return 0;
      const p = await _getProfile();
      return parseFloat(p?.balance || 0);
    },

    async getBalanceSat() {
      return Math.floor((await this.getBalance()) * 1e8);
    },

    async refreshBalance() {
      _profile = null;
      return await this.getBalance();
    },

    // ── Odecti sazku — POUZE v real mode ─────────────
    async deductBet(satoshi) {
      if (isDemoMode()) return { ok: true, demo: true };
      if (!sb || !_session) return { ok: true, demo: true };
      try {
        const { data, error } = await sb.rpc('deduct_balance', {
          p_user_id: _session.user.id, p_amount_sat: Math.floor(satoshi)
        });
        if (error) throw error;
        _profile = null;
        return { ok: true, new_balance: data };
      } catch (e) {
        console.warn('[CK] deductBet error:', e.message);
        return { ok: false, error: e.message };
      }
    },

    // ── Pricti vyhru — POUZE v real mode ─────────────
    async addWin(satoshi) {
      if (isDemoMode()) return { ok: true, demo: true };
      if (!sb || !_session) return { ok: true, demo: true };
      try {
        const { data, error } = await sb.rpc('add_balance', {
          p_user_id: _session.user.id, p_amount_sat: Math.floor(satoshi)
        });
        if (error) throw error;
        _profile = null;
        return { ok: true, new_balance: data };
      } catch (e) {
        console.warn('[CK] addWin error:', e.message);
        return { ok: false, error: e.message };
      }
    },

    // ── Zapis sazku — POUZE v real mode ──────────────
    async logBet(game, betSatoshi, profitSatoshi, multiplier = 0, meta = {}) {
      if (isDemoMode()) return;
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
        // game_settings update — spravne nazvy sloupcu
        try {
          const betBtc    = Math.floor(betSatoshi)    / 1e8;
          const profitBtc = Math.floor(profitSatoshi) / 1e8;
          const { data: gs } = await sb
            .from('game_settings')
            .select('total_bets_count, total_wagered_btc, total_paid_btc, house_profit_btc')
            .eq('id', game)
            .single();
          if (gs) {
            await sb.from('game_settings').update({
              total_bets_count:  (parseInt(gs.total_bets_count)    || 0) + 1,
              total_wagered_btc: (parseFloat(gs.total_wagered_btc) || 0) + betBtc,
              total_paid_btc:    (parseFloat(gs.total_paid_btc)    || 0) + Math.max(0, profitBtc),
              house_profit_btc:  (parseFloat(gs.house_profit_btc)  || 0) + (betBtc - Math.max(0, profitBtc)),
              updated_at:        new Date().toISOString()
            }).eq('id', game);
          }
        } catch (e2) { /* neni kriticke */ }
      } catch (e) {
        console.warn('[CK] logBet error:', e.message);
      }
    },

    async placeBet(game, betSatoshi, profitSatoshi, multiplier = 0, meta = {}) {
      if (isDemoMode()) return { ok: true, demo: true };
      const deduct = await this.deductBet(betSatoshi);
      if (!deduct.ok && !deduct.demo) return deduct;
      if (profitSatoshi > 0) await this.addWin(profitSatoshi);
      await this.logBet(game, betSatoshi, profitSatoshi - betSatoshi, multiplier, meta);
      const newBal = await this.refreshBalance();
      return { ok: true, new_balance: newBal };
    },

    // ── Jackpot ──────────────────────────────────────
    async getJackpot() {
      if (!sb) return 0.001;
      try {
        const { data } = await sb.from('jackpot').select('amount_satoshi').eq('id', 1).single();
        return data ? parseFloat(data.amount_satoshi) / 1e8 : 0.001;
      } catch { return 0.001; }
    },

    async triggerJackpot() {
      if (isDemoMode()) return null;
      if (!sb || !_session) return null;
      try {
        const jpBtc = await this.getJackpot();
        await sb.rpc('add_balance', { p_user_id: _session.user.id, p_amount_sat: Math.floor(jpBtc * 1e8) });
        await sb.from('jackpot').update({
          amount_satoshi: 100000,
          last_winner_id: _session.user.id,
          last_won_at:    new Date().toISOString(),
          updated_at:     new Date().toISOString()
        }).eq('id', 1);
        _profile = null;
        return jpBtc;
      } catch (e) {
        console.warn('[CK] triggerJackpot error:', e.message);
        return null;
      }
    },

    async getVipLevel() {
      const p = await _getProfile();
      return p?.vip_level || 'none';
    },

    async getBetHistory(game = null, limit = 20) {
      if (!sb || !_session) return [];
      try {
        let q = sb.from('bets').select('*')
          .eq('user_id', _session.user.id)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (game) q = q.eq('game', game);
        const { data } = await q;
        return data || [];
      } catch { return []; }
    },

    async getSessionStats(game) {
      if (!sb || !_session) return null;
      try {
        const { data } = await sb.from('bets')
          .select('bet_satoshi, profit_satoshi, multiplier')
          .eq('user_id', _session.user.id)
          .eq('game', game)
          .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString());
        if (!data?.length) return null;
        const totalBet    = data.reduce((s, b) => s + parseInt(b.bet_satoshi    || 0), 0);
        const totalProfit = data.reduce((s, b) => s + parseInt(b.profit_satoshi || 0), 0);
        const wins        = data.filter(b => parseInt(b.profit_satoshi) > 0).length;
        return {
          bets: data.length, wagered: totalBet/1e8, profit: totalProfit/1e8,
          winRate: Math.round(wins/data.length*100),
          bestMulti: Math.max(...data.map(b => parseFloat(b.multiplier || 0)))
        };
      } catch { return null; }
    },

    async updateHeaderBalance() {
      const el = document.getElementById('headerBal');
      if (!el || isDemoMode()) return 0;
      const bal = await this.getBalance();
      el.textContent = bal.toFixed(8) + ' BTC';
      return bal;
    },

    requireLogin(message = 'Please login to play for real BTC') {
      if (!_session) {
        alert(message);
        window.location.href = 'login.html';
        return false;
      }
      return true;
    },

    async logout() {
      if (sb) await sb.auth.signOut();
      window.location.href = 'index.html';
    },

    subscribeBalance(callback) {
      if (!sb || !_session) return null;
      return sb.channel('balance:' + _session.user.id)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'profiles',
          filter: 'id=eq.' + _session.user.id
        }, (payload) => {
          _profile = payload.new;
          const bal = parseFloat(payload.new.balance || 0);
          if (!isDemoMode()) {
            const el = document.getElementById('headerBal');
            if (el) el.textContent = bal.toFixed(8) + ' BTC';
            // Aktualizuj i dropdown balance
            const dbBal = document.querySelector('#userDropdown .green-bal');
            if (dbBal) dbBal.textContent = bal.toFixed(8) + ' BTC';
          }
          if (callback) callback(bal);
        }).subscribe();
    },

    // ── Game Settings ─────────────────────────────────
    async getGameSettings(gameId) {
      if (!window._gsCache) window._gsCache = {};
      if (!window._gsTTL)   window._gsTTL   = {};
      const now = Date.now(), TTL = 60000;

      if (window._gsCache[gameId] && (now - (window._gsTTL[gameId] || 0)) < TTL) {
        return window._gsCache[gameId];
      }

      const defaults = {
        crash:       { rtp_pct: 97,    house_edge_pct: 3    },
        slots:       { rtp_pct: 96.5,  house_edge_pct: 3.5  },
        roulette:    { rtp_pct: 94.74, house_edge_pct: 5.26 },
        blackjack:   { rtp_pct: 99,    house_edge_pct: 1    },
        dice:        { rtp_pct: 98,    house_edge_pct: 2    },
        mines:       { rtp_pct: 97,    house_edge_pct: 3    },
        plinko:      { rtp_pct: 97.5,  house_edge_pct: 2.5  },
        wheel:       { rtp_pct: 96,    house_edge_pct: 4    },
        poker:       { rtp_pct: 97,    house_edge_pct: 3    },
        craps:       { rtp_pct: 98.6,  house_edge_pct: 1.4  },
        baccarat:    { rtp_pct: 98.94, house_edge_pct: 1.06 },
        crazytime:   { rtp_pct: 95,    house_edge_pct: 5    },
        keno:        { rtp_pct: 92,    house_edge_pct: 8    },
        hilo:        { rtp_pct: 97,    house_edge_pct: 3    },
        jackpot:     { rtp_pct: 90,    house_edge_pct: 10   },
        jackpotshow: { rtp_pct: 96.5,  house_edge_pct: 3.5  },
      };

      try {
        if (!sb) throw new Error('no sb');
        const { data, error } = await sb
          .from('game_settings')
          .select('*')
          .eq('id', gameId)
          .single();
        if (error || !data) throw new Error('not found');
        window._gsCache[gameId] = data;
        window._gsTTL[gameId]   = now;
        return data;
      } catch {
        const def = defaults[gameId] || { rtp_pct: 96, house_edge_pct: 4 };
        window._gsCache[gameId] = def;
        window._gsTTL[gameId]   = now;
        return def;
      }
    },

    clearGameSettingsCache(gameId) {
      if (!window._gsCache) return;
      if (gameId) delete window._gsCache[gameId];
      else window._gsCache = {};
    },

    getClient() { return sb; }
  };

  // ── AUTO INIT ─────────────────────────────────────
  // Inicializuj header automaticky po nacteni stranky
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeader);
  } else {
    initHeader();
  }

  console.log('[CK] supabase.js v2.2 loaded | Session:', !!_session, '| Mode: DEMO (safe default)');
  if (_session) console.log('[CK] User:', _session.user.email);

})();
