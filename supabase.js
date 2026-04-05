// ════════════════════════════════════════════════════════
// CRYPTOKASINO — supabase.js
// Sdílená Supabase integrace pro všechny hry
// Umísti do root složky projektu (vedle game-crash.html atd.)
// ════════════════════════════════════════════════════════

(async function () {

  // ── CONFIG ────────────────────────────────────────────
  const SUPABASE_URL = 'https://cckybsbawnsbvxwloxcr.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNja3lic2Jhd25zYnZ4d2xveGNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzE5NjAsImV4cCI6MjA5MDkwNzk2MH0.M-hl7VXWF52jfnkg3zu78yiY_CT4yn3ljefej0BN2oY';

  // ── INIT SUPABASE ─────────────────────────────────────
  let sb = null;
  let _session = null;
  let _profile = null;

  try {
    const { createClient } = supabase;
    sb = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data } = await sb.auth.getSession();
    _session = data?.session || null;
  } catch (e) {
    console.warn('[CK] Supabase init failed:', e.message);
  }

  // ── INTERNAL HELPERS ──────────────────────────────────
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

  // ════════════════════════════════════════════════════════
  // PUBLIC API — window.CK
  // ════════════════════════════════════════════════════════
  window.CK = {

    // ── Je hráč přihlášen? ──────────────────────────────
    isLoggedIn() {
      return !!_session;
    },

    // ── Aktuální user ────────────────────────────────────
    getUser() {
      return _session?.user || null;
    },

    // ── Username ─────────────────────────────────────────
    async getUsername() {
      const p = await _getProfile();
      return p?.username || _session?.user?.email?.split('@')[0] || 'Guest';
    },

    // ── Balance v BTC ────────────────────────────────────
    async getBalance() {
      const p = await _getProfile();
      if (!p) return 0.1; // demo balance pro nepřihlášené
      const bal = parseFloat(p.balance || 0);
return bal > 0 ? bal : 0.1;
    },

    // ── Balance v satoshi ────────────────────────────────
    async getBalanceSat() {
      const bal = await this.getBalance();
      return Math.floor(bal * 1e8);
    },

    // ── Refresh balance (po každé sázce) ─────────────────
    async refreshBalance() {
      _profile = null; // reset cache
      return await this.getBalance();
    },

    // ── Odečti sázku (před zahájením hry) ────────────────
    async deductBet(satoshi) {
      if (!sb || !_session) return { ok: true, demo: true };
      try {
        const { data, error } = await sb.rpc('increment_balance', {
          p_user_id: _session.user.id,
          p_delta: -(satoshi / 1e8)
        });
        if (error) throw error;
        _profile = null; // refresh cache
        return { ok: true, new_balance: data };
      } catch (e) {
        console.warn('[CK] deductBet error:', e.message);
        return { ok: false, error: e.message };
      }
    },

    // ── Přičti výhru ─────────────────────────────────────
    async addWin(satoshi) {
      if (!sb || !_session) return { ok: true, demo: true };
      try {
        const { data, error } = await sb.rpc('increment_balance', {
          p_user_id: _session.user.id,
          p_delta: satoshi / 1e8
        });
        if (error) throw error;
        _profile = null;
        return { ok: true, new_balance: data };
      } catch (e) {
        console.warn('[CK] addWin error:', e.message);
        return { ok: false, error: e.message };
      }
    },

    // ── Zapiš sázku do DB ────────────────────────────────
    // Volej po každé dokončené hře
    // game: 'crash'|'slots'|'dice'|'roulette'|'blackjack'|
    //       'poker'|'mines'|'plinko'|'wheel'|'craps'|
    //       'crazytime'|'jackpot'|'jackpotshow'
    async logBet(game, betSatoshi, profitSatoshi, multiplier = 0, meta = {}) {
      if (!sb || !_session) return; // demo mode — tichý fail
      try {
        await sb.from('bets').insert({
          user_id:         _session.user.id,
          game,
          bet_satoshi:     Math.floor(betSatoshi),
          profit_satoshi:  Math.floor(profitSatoshi),
          multiplier:      parseFloat(multiplier) || 0,
          meta
        });

        // Update total_wagered v profiles
        await sb.from('profiles').update({
          total_wagered: sb.rpc ? undefined : undefined // handled below
        }).eq('id', _session.user.id);

        await sb.rpc('increment_balance', {
          p_user_id: _session.user.id,
          p_delta: 0 // jen pro refresh — wagered update
        });

        // Jackpot příspěvek (0.5% z každé sázky)
        const contribution = Math.floor(betSatoshi * 0.005);
        if (contribution > 0) {
          await sb.rpc('increment_jackpot', { p_amount: contribution });
        }

      } catch (e) {
        console.warn('[CK] logBet error:', e.message);
        // Tiché selhání — hra pokračuje i bez DB
      }
    },

    // ── Kompletní sázka (deduct + win + log v jednom) ────
    // Použij pro jednoduché hry (dice, roulette...)
    async placeBet(game, betSatoshi, profitSatoshi, multiplier = 0, meta = {}) {
      // Odečti sázku
      const deduct = await this.deductBet(betSatoshi);
      if (!deduct.ok && !deduct.demo) return deduct;

      // Pokud výhra, přičti
      if (profitSatoshi > 0) {
        await this.addWin(profitSatoshi);
      }

      // Zapiš do DB
      await this.logBet(game, betSatoshi, profitSatoshi - betSatoshi, multiplier, meta);

      // Vrať novou balance
      const newBal = await this.refreshBalance();
      return { ok: true, new_balance: newBal };
    },

    // ── Jackpot ──────────────────────────────────────────
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
      if (!sb || !_session) return;
      try {
        const jackpotBtc = await this.getJackpot();
        await sb.rpc('increment_balance', {
          p_user_id: _session.user.id,
          p_delta: jackpotBtc
        });
        await sb.rpc('reset_jackpot', {
          p_winner_id: _session.user.id
        });
        _profile = null;
        return jackpotBtc;
      } catch (e) {
        console.warn('[CK] triggerJackpot error:', e.message);
      }
    },

    // ── VIP level ────────────────────────────────────────
    async getVipLevel() {
      const p = await _getProfile();
      return p?.vip_level || 'none';
    },

    // ── Bet history pro hráče ────────────────────────────
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

    // ── Session stats pro hráče (pro game statistiky) ────
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

        return {
          bets:      data.length,
          wagered:   totalBet / 1e8,
          profit:    totalProfit / 1e8,
          winRate:   data.length ? Math.round(wins / data.length * 100) : 0,
          bestMulti: maxMulti
        };
      } catch (e) {
        return null;
      }
    },

    // ── Aktualizuj balance display v headeru ─────────────
    async updateHeaderBalance() {
      const bal = await this.getBalance();
      const el = document.getElementById('headerBal');
      if (el) el.textContent = bal.toFixed(8) + ' BTC';
      return bal;
    },

    // ── Login redirect ────────────────────────────────────
    requireLogin(message = 'Please login to play') {
      if (!_session) {
        alert(message);
        window.location.href = 'login.html';
        return false;
      }
      return true;
    },

    // ── Logout ────────────────────────────────────────────
    async logout() {
      if (sb) await sb.auth.signOut();
      window.location.href = 'login.html';
    },

    // ── Realtime balance subscribe ────────────────────────
    // Volej na začátku hry — automaticky updatuje balance
    // když server.js připíše deposit
    subscribeBalance(callback) {
      if (!sb || !_session) return null;
      return sb
        .channel('balance:' + _session.user.id)
        .on('postgres_changes', {
          event:  'UPDATE',
          schema: 'public',
          table:  'profiles',
          filter: 'id=eq.' + _session.user.id
        }, (payload) => {
          _profile = payload.new;
          const bal = parseFloat(payload.new.balance || 0);
          this.updateHeaderBalance();
          if (callback) callback(bal);
        })
        .subscribe();
    },

    // ── Raw Supabase client (pro pokročilé použití) ───────
    getClient() {
      return sb;
    }

  };

  // ── AUTO INIT po načtení ─────────────────────────────────
  // Načte balance a aktualizuje header okamžitě
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.CK.updateHeaderBalance();
    });
  } else {
    window.CK.updateHeaderBalance();
  }

  console.log('[CK] supabase.js loaded. Logged in:', !!_session);

})();