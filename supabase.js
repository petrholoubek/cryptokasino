// ════════════════════════════════════════════════════════
// CRYPTOKASINO — supabase.js  v2.4
// DEMO/REAL SEPARATION — demo nikdy nejde do DB
// NOVA FUNKCE: initHeader() — automaticky upravuje header
// NOVA FUNKCE: VIP system — badge, level, progress
//
// OPRAVY v2.4:
//  - Přidány egypt_gold, neon_city, dragon_slots do defaults
//  - Přidán sports do defaults
//  - Aktualizován AI agent loader
// ════════════════════════════════════════════════════════

(async function () {

  // ── CONFIG ───────────────────────────────────────────
  const SUPABASE_URL = 'https://cckybsbawnsbvxwloxcr.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNja3lic2Jhd25zYnZ4d2xveGNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzE5NjAsImV4cCI6MjA5MDkwNzk2MH0.M-hl7VXWF52jfnkg3zu78yiY_CT4yn3ljefej0BN2oY';

  let sb       = null;
  let _session = null;
  let _profile = null;

  // ════════════════════════════════════════════════════
  // VIP DEFINICE
  // ════════════════════════════════════════════════════
  const VIP_LEVELS = {
    none:     { order: 0, min: 0,    label: 'Member',   icon: '&#128100;', color: '#8898cc', cashback: 0,  maxWith: 0.5,  reload: 0  },
    bronze:   { order: 1, min: 0.01, label: 'Bronze',   icon: '&#129350;', color: '#cd7f32', cashback: 1,  maxWith: 0.5,  reload: 0  },
    silver:   { order: 2, min: 0.05, label: 'Silver',   icon: '&#129352;', color: '#adb5bd', cashback: 2,  maxWith: 1.0,  reload: 5  },
    gold:     { order: 3, min: 0.20, label: 'Gold',     icon: '&#129351;', color: '#D4A017', cashback: 3,  maxWith: 2.0,  reload: 10 },
    platinum: { order: 4, min: 0.50, label: 'Platinum', icon: '&#128142;', color: '#e5e4e2', cashback: 5,  maxWith: 5.0,  reload: 15 },
    diamond:  { order: 5, min: 1.00, label: 'Diamond',  icon: '&#128306;', color: '#60a5fa', cashback: 8,  maxWith: null, reload: 20 },
  };

  function _calculateVipLevel(wageredBtc) {
    const w = parseFloat(wageredBtc || 0);
    if (w >= 1.00) return 'diamond';
    if (w >= 0.50) return 'platinum';
    if (w >= 0.20) return 'gold';
    if (w >= 0.05) return 'silver';
    if (w >= 0.01) return 'bronze';
    return 'none';
  }

  function _getNextVipLevel(currentLevel) {
    const order = ['none','bronze','silver','gold','platinum','diamond'];
    const idx = order.indexOf(currentLevel);
    if (idx === -1 || idx >= order.length - 1) return null;
    return order[idx + 1];
  }

  function _hexToRgb(hex) {
    if (!hex || hex.length < 7) return '136,152,204';
    try {
      const r = parseInt(hex.slice(1,3), 16);
      const g = parseInt(hex.slice(3,5), 16);
      const b = parseInt(hex.slice(5,7), 16);
      return `${r},${g},${b}`;
    } catch(e) { return '136,152,204'; }
  }

  // ════════════════════════════════════════════════════
  // DEMO MODE FIREWALL
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
    // Nastav window.CK.sb HNED - pred await - aby ostatni stranky nenecekaly
    if (window.CK) window.CK.sb = sb;
    const { data } = await sb.auth.getSession();
    _session = data?.session || null;
    if (_session && window.CK && window.CK.setGameMode) {
      window.CK.setGameMode('real');
    }
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
        .select('id, username, balance, vip_level, total_wagered_btc, total_deposited, cashback_earned_btc')
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
  // VIP BADGE RENDER
  // Zobrazí VIP badge v headeru vedle username
  // ════════════════════════════════════════════════════
  function _renderVipBadge(vipLevel) {
    const vipEl = document.getElementById('headerVip');
    if (!vipEl) return;
    const vd = VIP_LEVELS[vipLevel] || VIP_LEVELS.none;
    if (!vipLevel || vipLevel === 'none') {
      vipEl.style.display = 'none';
      return;
    }
    const col = vd.color;
    const rgb = _hexToRgb(col);
    vipEl.innerHTML = vd.icon + ' ' + vd.label.toUpperCase();
    vipEl.style.cssText = `
      background: rgba(${rgb}, 0.12);
      border: 1px solid rgba(${rgb}, 0.35);
      color: ${col};
      padding: 0.28rem 0.7rem;
      border-radius: 20px;
      font-family: 'Cinzel', serif;
      font-size: 0.62rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      cursor: pointer;
      text-decoration: none;
    `;
    vipEl.onclick = () => { window.location.href = 'vip.html'; };
  }

  // ════════════════════════════════════════════════════
  // INIT HEADER
  // ════════════════════════════════════════════════════
  async function initHeader() {
    const loginBtn   = document.querySelector('a.btn-login, .btn-login');
    const headerBal  = document.getElementById('headerBal');
    const mobileMenu = document.getElementById('mobileMenu');

    if (!loginBtn) return;

    if (!_session) {
      return; // Neprihlaseny — nechej Login button
    }

    // Prihlaseny — nacti profil
    const p = await _getProfile();
    const username = p?.username || _session.user.email?.split('@')[0] || 'Player';
    const balance  = parseFloat(p?.balance || 0);
    const vipLevel = p?.vip_level || 'none';
    const vd = VIP_LEVELS[vipLevel] || VIP_LEVELS.none;

    // VIP badge text pro dropdown
    const vipBadgeHtml = vipLevel !== 'none'
      ? `<div style="padding:.3rem .75rem .4rem;border-bottom:1px solid rgba(60,120,255,0.1);margin-bottom:.2rem;">
           <span style="font-family:'Cinzel',serif;font-size:0.55rem;letter-spacing:0.1em;text-transform:uppercase;padding:0.18rem 0.55rem;border-radius:10px;font-weight:700;background:rgba(${_hexToRgb(vd.color)},0.12);color:${vd.color};border:1px solid rgba(${_hexToRgb(vd.color)},0.3);">
             ${vd.icon} ${vd.label.toUpperCase()}
           </span>
         </div>`
      : '';

    // Zmen [Login] na [👤 Jméno ▾]
    loginBtn.outerHTML = `
      <div class="user-menu-wrap" style="position:relative;">
        <button class="user-menu-btn" onclick="toggleUserMenu()" style="
          display:flex;align-items:center;gap:.45rem;
          background:rgba(212,160,23,.1);border:1px solid rgba(212,160,23,.28);
          color:var(--gold-light,#F5C842);padding:.38rem .85rem;border-radius:6px;
          font-family:'Cinzel',serif;font-size:.68rem;font-weight:700;cursor:pointer;
          transition:all .2s;white-space:nowrap;
        ">
          <span>${vipLevel !== 'none' ? vd.icon : '&#128100;'}</span>
          <span id="ckUsername">${username}</span>
          <span style="font-size:.55rem;opacity:.7;">&#9660;</span>
        </button>
        <div id="userDropdown" style="
          display:none;position:absolute;right:0;top:calc(100% + 6px);
          background:rgba(2,6,20,.99);border:1px solid rgba(60,120,255,0.25);
          border-radius:12px;padding:.5rem;min-width:195px;z-index:300;
          box-shadow:0 8px 32px rgba(0,0,0,.8);
        ">
          ${vipBadgeHtml}
          <div style="padding:.5rem .75rem .4rem;border-bottom:1px solid rgba(60,120,255,0.1);margin-bottom:.3rem;">
            <div style="font-family:'Cinzel',serif;font-size:.58rem;color:#8898cc;letter-spacing:.1em;text-transform:uppercase;">Balance</div>
            <div id="dropdownBal" style="font-family:'Cinzel',serif;font-size:.88rem;font-weight:700;color:#4ade80;">${balance.toFixed(8)} BTC</div>
          </div>
          <a href="profile.html" style="display:flex;align-items:center;gap:.5rem;padding:.52rem .75rem;border-radius:7px;color:#8898cc;text-decoration:none;font-family:'Cinzel',serif;font-size:.68rem;transition:all .2s;" onmouseover="this.style.background='rgba(60,120,255,.08)';this.style.color='#93c5fd'" onmouseout="this.style.background='';this.style.color=''">
            &#128100; My Profile
          </a>
          <a href="vip.html" style="display:flex;align-items:center;gap:.5rem;padding:.52rem .75rem;border-radius:7px;color:#8898cc;text-decoration:none;font-family:'Cinzel',serif;font-size:.68rem;transition:all .2s;" onmouseover="this.style.background='rgba(212,160,23,.08)';this.style.color='#F5C842'" onmouseout="this.style.background='';this.style.color=''">
            &#127942; VIP Program
          </a>
          <a href="deposit.html" style="display:flex;align-items:center;gap:.5rem;padding:.52rem .75rem;border-radius:7px;color:#8898cc;text-decoration:none;font-family:'Cinzel',serif;font-size:.68rem;transition:all .2s;" onmouseover="this.style.background='rgba(60,120,255,.08)';this.style.color='#93c5fd'" onmouseout="this.style.background='';this.style.color=''">
            &#8383; Deposit BTC
          </a>
          <a href="casino.html" style="display:flex;align-items:center;gap:.5rem;padding:.52rem .75rem;border-radius:7px;color:#8898cc;text-decoration:none;font-family:'Cinzel',serif;font-size:.68rem;transition:all .2s;" onmouseover="this.style.background='rgba(60,120,255,.08)';this.style.color='#93c5fd'" onmouseout="this.style.background='';this.style.color=''">
            &#127918; Casino
          </a>
          <div style="border-top:1px solid rgba(60,120,255,0.1);margin-top:.3rem;padding-top:.3rem;">
            <button onclick="window.CK&&window.CK.logout()" style="display:flex;align-items:center;gap:.5rem;padding:.52rem .75rem;border-radius:7px;color:#f87171;background:none;border:none;font-family:'Cinzel',serif;font-size:.68rem;cursor:pointer;width:100%;transition:all .2s;" onmouseover="this.style.background='rgba(248,113,113,.08)'" onmouseout="this.style.background=''">
              &#128682; Logout
            </button>
          </div>
        </div>
      </div>
    `;

    // Aktualizuj balance v headeru
    if (headerBal) {
      headerBal.textContent = balance.toFixed(8) + ' BTC';
    }

    // VIP badge v headeru (pokud existuje #headerVip)
    _renderVipBadge(vipLevel);

    // Mobile menu update
    if (mobileMenu) {
      const mobileLogin = mobileMenu.querySelector('a[href="login.html"]');
      if (mobileLogin) {
        mobileLogin.outerHTML = `
          <a href="profile.html">&#128100; ${username}</a>
          <a href="vip.html">&#127942; VIP Program</a>
          <a href="deposit.html">&#8383; Deposit</a>
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

    console.log('[CK] Header initialized for:', username, '| VIP:', vipLevel);
  }

  // ════════════════════════════════════════════════════
  // PUBLIC API — window.CK
  // ════════════════════════════════════════════════════
  window.CK = {

    sb, // expose for advanced use

    setGameMode(mode) {
      window._ckGameMode = mode;
      console.log('[CK] GameMode:', mode, '| DB:', mode === 'real' ? 'ENABLED' : 'BLOCKED');
    },

    getGameMode()  { return window._ckGameMode || 'demo'; },
    isDemo()       { return isDemoMode(); },
    isLoggedIn()   { return !!_session; },
    getUser()      { return _session?.user || null; },
    getSession: async () => _session,

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

    // ── VIP funkce ────────────────────────────────────

    async getVipLevel() {
      const p = await _getProfile();
      return p?.vip_level || 'none';
    },

    async getVipInfo() {
      const p = await _getProfile();
      const level = p?.vip_level || 'none';
      const wagered = parseFloat(p?.total_wagered_btc || 0);
      const vd = VIP_LEVELS[level] || VIP_LEVELS.none;
      const nextLevel = _getNextVipLevel(level);
      const nextVd = nextLevel ? VIP_LEVELS[nextLevel] : null;

      let progress = 100;
      let toNextLevel = 0;
      if (nextVd) {
        const currMin = vd.min;
        const nextMin = nextVd.min;
        progress = Math.min(Math.round(((wagered - currMin) / (nextMin - currMin)) * 100), 100);
        toNextLevel = Math.max(0, nextMin - wagered);
      }

      return {
        level,
        label: vd.label,
        icon: vd.icon,
        color: vd.color,
        cashback: vd.cashback,
        maxWithdrawal: vd.maxWith,
        reloadBonus: vd.reload,
        totalWagered: wagered,
        nextLevel,
        nextLabel: nextVd?.label || null,
        progress,
        toNextLevel: parseFloat(toNextLevel.toFixed(5)),
        isMaxLevel: !nextLevel,
      };
    },

    renderVipBadge(vipLevel) {
      _renderVipBadge(vipLevel);
    },

    getVipLevels() {
      return VIP_LEVELS;
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
async addWin(satoshi, gameId = null) {
  if (isDemoMode()) return { ok: true, demo: true };
  if (!sb || !_session) return { ok: true, demo: true };
  try {
    // ✅ Použij RPC funkci s max win protection
    const { data, error } = await sb.rpc('add_balance_with_cap', {
      p_user_id: _session.user.id, 
      p_amount_sat: Math.floor(satoshi),
      p_game_id: gameId
    });
    if (error) throw error;
    _profile = null;
    return { ok: true, new_balance: data };
  } catch (e) {
    console.warn('[CK] addWin error:', e.message);
    return { ok: false, error: e.message };
  }
},

// ── Zápis sázky — POUZE v real mode ──────────────
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

    // Update game_settings statistiky
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

    // VIP: update total_wagered_btc v profiles
    try {
      const betBtc = Math.floor(betSatoshi) / 1e8;
      const { data: prof } = await sb
        .from('profiles')
        .select('total_wagered_btc, vip_level')
        .eq('id', _session.user.id)
        .single();
      if (prof) {
        const newWagered = (parseFloat(prof.total_wagered_btc) || 0) + betBtc;
        const newVipLevel = _calculateVipLevel(newWagered);
        const updateData = { total_wagered_btc: newWagered };
        // Povys VIP pokud je cas
        if (newVipLevel !== prof.vip_level &&
            (VIP_LEVELS[newVipLevel]?.order || 0) > (VIP_LEVELS[prof.vip_level]?.order || 0)) {
          updateData.vip_level = newVipLevel;
          updateData.vip_upgraded_at = new Date().toISOString();
          console.log('[CK] VIP upgrade:', prof.vip_level, '→', newVipLevel);
          _profile = null;
          _showVipUpgradeNotification(newVipLevel);
        }
        await sb.from('profiles').update(updateData).eq('id', _session.user.id);
        if (updateData.vip_level) _profile = null;
      }
    } catch (e3) { /* VIP update neni kriticke */ }

  } catch (e) {
    console.warn('[CK] logBet error:', e.message);
  }
},

async placeBet(game, betSatoshi, profitSatoshi, multiplier = 0, meta = {}) {
  if (isDemoMode()) return { ok: true, demo: true };
  const deduct = await this.deductBet(betSatoshi);
  if (!deduct.ok && !deduct.demo) return deduct;
  
  // ✅ Apply max win cap before adding
  let cappedProfit = profitSatoshi;
  if (profitSatoshi > 0) {
    const gameSettings = await this.getGameSettings(game);
    const maxWinSat = Math.floor((gameSettings?.max_win_btc || 1.0) * 1e8);
    const houseEdge = gameSettings?.house_edge_pct ? gameSettings.house_edge_pct / 100 : 0.03;
    
    // Apply house edge
    const afterEdge = Math.floor(profitSatoshi * (1 - houseEdge));
    
    // Cap at max win
    cappedProfit = Math.min(afterEdge, maxWinSat);
    
    if (cappedProfit < profitSatoshi) {
      console.warn('[CK] placeBet capped:', (profitSatoshi/1e8).toFixed(8), '→', (cappedProfit/1e8).toFixed(8), 'BTC');
    }
    
    await this.addWin(cappedProfit, game);
  }
  
  await this.logBet(game, betSatoshi, cappedProfit - betSatoshi, multiplier, meta); // ✅ JEN TOTO!
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

async triggerJackpot(gameId = null) {
  if (isDemoMode()) return null;
  if (!sb || !_session) return null;
  try {
    const jpBtc = await this.getJackpot();
    
    // ✅ Apply max win cap to jackpot
    let cappedJpBtc = jpBtc;
    if (gameId) {
      const gameSettings = await this.getGameSettings(gameId);
      const maxWin = gameSettings?.max_win_btc || 1.0;
      if (jpBtc > maxWin) {
        console.warn('[CK] Jackpot capped:', jpBtc.toFixed(8), '→', maxWin.toFixed(8), 'BTC');
        cappedJpBtc = maxWin;
      }
    }
    
    await sb.rpc('add_balance', { 
      p_user_id: _session.user.id, 
      p_amount_sat: Math.floor(cappedJpBtc * 1e8) 
    });
    await sb.from('jackpot').update({
      amount_satoshi: 100000,
      last_winner_id: _session.user.id,
      last_won_at:    new Date().toISOString(),
      updated_at:     new Date().toISOString()
    }).eq('id', 1);
    _profile = null;
    return cappedJpBtc;
  } catch (e) {
    console.warn('[CK] triggerJackpot error:', e.message);
    return null;
  }
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
      const dbBal = document.getElementById('dropdownBal');
      if (dbBal) dbBal.textContent = bal.toFixed(8) + ' BTC';
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
          // Update VIP pokud se zmenil
          if (payload.new.vip_level !== payload.old?.vip_level) {
            _renderVipBadge(payload.new.vip_level);
          }
          if (!isDemoMode()) {
            const el = document.getElementById('headerBal');
            if (el) el.textContent = bal.toFixed(8) + ' BTC';
            const dbBal = document.getElementById('dropdownBal');
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
  // Crash game
  crash:         { rtp_pct: 97,    house_edge_pct: 3    },
  
  // Slots
  slots:         { rtp_pct: 96.5,  house_edge_pct: 3.5  },
  jackpot:       { rtp_pct: 90,    house_edge_pct: 10   },
  egypt_gold:    { rtp_pct: 96.5,  house_edge_pct: 3.5  },
  neon_city:     { rtp_pct: 96.5,  house_edge_pct: 3.5  },
  dragon_slots:  { rtp_pct: 96.5,  house_edge_pct: 3.5  },
  sweet_bonanza: { rtp_pct: 96.5,  house_edge_pct: 3.5  },
  book_treasures:      { rtp_pct: 96.5,  house_edge_pct: 3.5  },
  mega_fortune:        { rtp_pct: 96.6,  house_edge_pct: 3.4  },
  viking_runestrike:   { rtp_pct: 96.5,  house_edge_pct: 3.5  },
  wild_west_gold_rush: { rtp_pct: 96.5,  house_edge_pct: 3.5  },
  
  // Table games
  roulette:      { rtp_pct: 94.74, house_edge_pct: 5.26 },
  blackjack:     { rtp_pct: 99,    house_edge_pct: 1    },
  baccarat:      { rtp_pct: 98.94, house_edge_pct: 1.06 },
  craps:         { rtp_pct: 98.6,  house_edge_pct: 1.4  },
  
  // Card games
  poker:         { rtp_pct: 97,    house_edge_pct: 3    },
  video_poker:   { rtp_pct: 98,    house_edge_pct: 2    },
  
  // Casual games
  dice:          { rtp_pct: 98,    house_edge_pct: 2    },
  mines:         { rtp_pct: 97,    house_edge_pct: 3    },
  plinko:        { rtp_pct: 97.5,  house_edge_pct: 2.5  },
  wheel:         { rtp_pct: 96,    house_edge_pct: 4    },
  hilo:          { rtp_pct: 97,    house_edge_pct: 3    },
  keno:          { rtp_pct: 92,    house_edge_pct: 8    },
  
  // Special games
  dragon_tower:  { rtp_pct: 96,    house_edge_pct: 4    },
  crazytime:     { rtp_pct: 95,    house_edge_pct: 5    },
  jackpotshow:   { rtp_pct: 96.5,  house_edge_pct: 3.5  },
  
  // Sports
  sports:        { rtp_pct: 95,    house_edge_pct: 5    },
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


   // ── Server game endpoint ──────────────────────────
    serverUrl: 'https://api.cryptokasino.io',
    async callGameServer(gameId, betBtc, options) {
      try {
        var token = null;
        if (_session && _session.access_token) token = _session.access_token;
        if (!token && sb) {
          var sess = await sb.auth.getSession();
          if (sess && sess.data && sess.data.session) token = sess.data.session.access_token;
        }
        if (!token) throw new Error('No JWT token');
        
        // ✅ MAX WIN PROTECTION - client-side enforcement
        if (options && (options.rawPayout || options.multiplier)) {
          const gameSettings = await this.getGameSettings(gameId);
          const maxWin = gameSettings?.max_win_btc || 1.0;
          const houseEdge = gameSettings?.house_edge_pct ? gameSettings.house_edge_pct / 100 : 0.03;
          
          const rawPayout = options.rawPayout || (betBtc * (options.multiplier || 0));
          const afterEdge = rawPayout * (1 - houseEdge);
          const cappedPayout = Math.min(afterEdge, maxWin);
          
          // Enforce cap in options
          options.cappedPayout = cappedPayout;
          options.maxWinApplied = cappedPayout < rawPayout;
          
          console.log('[CK] Max win check:', {
            game: gameId,
            bet: betBtc.toFixed(5),
            mult: options.multiplier,
            raw: rawPayout.toFixed(5),
            afterEdge: afterEdge.toFixed(5),
            capped: cappedPayout.toFixed(5),
            limited: options.maxWinApplied
          });
        }
        
        var resp = await fetch('https://api.cryptokasino.io/api/game/play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ gameId: gameId, betBtc: betBtc, options: options || {} })
        });
        if (!resp.ok) throw new Error('Server error: ' + resp.status);
        var data = await resp.json();
        if (!data.ok) throw new Error(data.error || 'Unknown error');
        console.log('[SERVER]', gameId, 'result:', data);
        _profile = null; // refresh balance
        return data;
      } catch(e) {
        console.warn('[SERVER] Fallback:', e.message);
        return null;
      }
    },
    getClient() { return sb; }
  };

  // ── VIP Upgrade notifikace ────────────────────────
  function _showVipUpgradeNotification(newLevel) {
    const vd = VIP_LEVELS[newLevel];
    if (!vd) return;
    const notif = document.createElement('div');
    notif.style.cssText = `
      position:fixed;top:80px;right:1.5rem;z-index:9999;
      background:rgba(2,6,20,0.99);border:2px solid ${vd.color};
      border-radius:16px;padding:1.2rem 1.5rem;max-width:320px;
      box-shadow:0 0 40px rgba(${_hexToRgb(vd.color)},0.4);
      font-family:'Crimson Text',serif;animation:vipSlideIn 0.5s cubic-bezier(0.34,1.56,0.64,1);
    `;
    notif.innerHTML = `
      <div style="font-size:2rem;text-align:center;margin-bottom:0.5rem">${vd.icon}</div>
      <div style="font-family:'Cinzel',serif;font-size:0.72rem;letter-spacing:0.2em;text-transform:uppercase;color:${vd.color};text-align:center;margin-bottom:0.3rem">VIP Upgrade!</div>
      <div style="font-family:'Cinzel',serif;font-size:1rem;font-weight:700;color:${vd.color};text-align:center;margin-bottom:0.5rem">${vd.label.toUpperCase()}</div>
      <div style="font-size:0.82rem;color:#8898cc;text-align:center;line-height:1.5">Gratulujeme! Byl jsi povýšen<br>na ${vd.label} úroveň! 🎉</div>
      <div style="text-align:center;margin-top:0.8rem">
        <a href="vip.html" style="font-family:'Cinzel',serif;font-size:0.65rem;color:${vd.color};text-decoration:none;border:1px solid ${vd.color};padding:0.25rem 0.8rem;border-radius:6px;">Zobrazit výhody</a>
      </div>
    `;
    // CSS animace
    if (!document.getElementById('vipNotifStyle')) {
      const style = document.createElement('style');
      style.id = 'vipNotifStyle';
      style.textContent = '@keyframes vipSlideIn{from{opacity:0;transform:translateX(40px) scale(0.9);}to{opacity:1;transform:translateX(0) scale(1);}}';
      document.head.appendChild(style);
    }
    document.body.appendChild(notif);
    // Auto-remove po 6s
    setTimeout(() => {
      notif.style.animation = 'vipSlideIn 0.3s ease reverse';
      setTimeout(() => { if (notif.parentNode) notif.parentNode.removeChild(notif); }, 300);
    }, 6000);
    // Klik pro zavření
    notif.onclick = () => { if (notif.parentNode) notif.parentNode.removeChild(notif); };
  }

  // ── AUTO INIT HEADER ──────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeader);
  } else {
    initHeader();
  }

  console.log('[CK] supabase.js v2.4 loaded | Session:', !!_session, '| VIP: enabled');
  if (_session) {
    console.log('[CK] User:', _session.user.email);
    window._ckSession = _session;  // Globally accessible pro hry
  }
  // Auto nastaveni real mode po detekci session
  if (_session) {
    window._ckGameMode = 'real';
    console.log('[CK] GameMode: real (auto)');
  }


// ── AI AGENT LOADER ────────────────────────────────────────────
(function(){
  var page = window.location.pathname.split('/').pop() || 'index.html';
  var allowed = [
    'index.html',
    'casino.html',
    'live.html',
    'sports.html',
    ''
  ];
  if(!allowed.includes(page)) return;
  var s = document.createElement('script');
  s.src = 'ck-agent.js';
  document.head.appendChild(s);
})();
