// ═══════════════════════════════════════
// VLOZ TOTO DO server.js PRED:
// app.listen(PORT, () => {
// ═══════════════════════════════════════

// ================================================================
// HERNÍ ENDPOINTY PRO SERVER.JS
// Přidej tento kód do server.js před řádek:
// app.listen(PORT, () => {
// ================================================================

// ================================================================
// GAME SETTINGS CACHE (obnovuje se každých 60s)
// ================================================================
let gameSettingsCache = {};
let gameSettingsCacheTime = 0;

async function getGameSettings(gameId) {
  const now = Date.now();
  // Cache na 60 sekund - admin může měnit živě
  if (now - gameSettingsCacheTime > 60000) {
    const { data } = await sb.from('game_settings').select('*');
    if (data) {
      data.forEach(g => { gameSettingsCache[g.id] = g; });
      gameSettingsCacheTime = now;
      console.log('[GS] Game settings načteny z DB');
    }
  }
  return gameSettingsCache[gameId] || null;
}

// ================================================================
// POMOCNÉ FUNKCE
// ================================================================

// Crash point generace (Provably Fair)
function generateCrashPoint(rtpPct) {
  const r = Math.random();
  const rtp = rtpPct / 100;
  // 5% šance na okamžitý crash
  if (r < 0.05) return 1.00;
  // Exponenciální distribuce s house edge
  const crashPoint = Math.max(1.00, (-Math.log(1 - r * rtp) + 1));
  return parseFloat(Math.min(crashPoint, 1000).toFixed(2));
}

// Dice výsledek
function generateDiceResult(targetNumber, isOver, houseEdgePct) {
  const roll = Math.random() * 100;
  const won = isOver ? roll > targetNumber : roll < targetNumber;
  // Payout s house edge
  const truePayout = isOver
    ? 100 / (100 - targetNumber)
    : 100 / targetNumber;
  const payout = parseFloat((truePayout * (1 - houseEdgePct / 100)).toFixed(4));
  return { roll: parseFloat(roll.toFixed(2)), won, payout };
}

// Slots výsledek
function generateSlotsResult(houseEdgePct) {
  const SYMBOLS = [
    { name: 'Diamond', weight: 3,  m3: 50,  m4: 100, m5: 200 },
    { name: 'Star',    weight: 5,  m3: 20,  m4: 40,  m5: 80  },
    { name: 'Cherry',  weight: 10, m3: 8,   m4: 18,  m5: 35  },
    { name: 'Lemon',   weight: 12, m3: 5,   m4: 10,  m5: 20  },
    { name: 'Orange',  weight: 12, m3: 4,   m4: 8,   m5: 15  },
    { name: 'Grape',   weight: 13, m3: 3,   m4: 6,   m5: 12  },
    { name: 'Bell',    weight: 13, m3: 2,   m4: 5,   m5: 10  },
    { name: 'Melon',   weight: 14, m3: 2,   m4: 4,   m5: 8   },
    { name: 'Clover',  weight: 14, m3: 1,   m4: 3,   m5: 6   },
    { name: 'Bonus',   weight: 4,  m3: 0,   m4: 0,   m5: 0   },
  ];
  const totalWeight = SYMBOLS.reduce((s, sym) => s + sym.weight, 0);

  function randSym() {
    let r = Math.random() * totalWeight;
    for (const s of SYMBOLS) { r -= s.weight; if (r <= 0) return s; }
    return SYMBOLS[SYMBOLS.length - 1];
  }

  // Generuj 5x3 grid s anti-win biasem
  const grid = [];
  for (let col = 0; col < 5; col++) {
    const column = [];
    for (let row = 0; row < 3; row++) {
      let sym = randSym();
      // 15% šance na anti-match (house bias)
      if (Math.random() < 0.15) {
        const alt = randSym();
        if (alt.name !== sym.name) sym = alt;
      }
      column.push(sym);
    }
    grid.push(column);
  }

  // Vyhodnoť výhru na středním řádku
  const midRow = grid.map(col => col[1]);
  let totalMult = 0;
  let matchCount = 1;
  const first = midRow[0];
  for (let i = 1; i < 5; i++) {
    if (midRow[i].name === first.name) matchCount++;
    else break;
  }
  if (matchCount >= 3) {
    const m = matchCount === 5 ? first.m5 : matchCount === 4 ? first.m4 : first.m3;
    totalMult = m * (1 - houseEdgePct / 100);
  }

  return { grid: grid.map(col => col.map(s => s.name)), multiplier: parseFloat(totalMult.toFixed(4)) };
}

// Roulette výsledek
function generateRouletteResult() {
  // Americká ruleta (0-36 + 00)
  const result = Math.floor(Math.random() * 38); // 0-37, kde 37 = 00
  return result;
}

// Plinko výsledek
function generatePlinkoResult(rows, risk, houseEdgePct) {
  const MULTIPLIERS = {
    low: {
      8:  [2.0,1.2,0.9,0.8,0.7,0.8,0.9,1.2,2.0],
      12: [8.9,3.0,1.4,1.1,1.0,0.9,0.7,0.9,1.0,1.1,1.4,3.0,8.9],
      14: [7.1,4.0,1.9,1.4,1.1,0.9,0.7,0.6,0.7,0.9,1.1,1.4,1.9,4.0,7.1],
      16: [16.0,9.0,2.0,1.4,1.2,1.0,0.7,0.5,0.4,0.5,0.7,1.0,1.2,1.4,2.0,9.0,16.0],
    },
    medium: {
      8:  [3.0,1.5,0.8,0.5,0.3,0.5,0.8,1.5,3.0],
      12: [15.0,5.0,2.0,1.0,0.6,0.3,0.2,0.3,0.6,1.0,2.0,5.0,15.0],
      14: [20.0,7.0,3.0,1.5,0.8,0.4,0.2,0.2,0.4,0.8,1.5,3.0,7.0,20.0,20.0],
      16: [20.0,8.0,3.0,1.2,0.6,0.3,0.1,0.1,0.1,0.3,0.6,1.2,3.0,8.0,20.0,20.0,20.0],
    },
    high: {
      8:  [6.0,3.0,1.0,0.3,0.2,0.3,1.0,3.0,6.0],
      12: [30.0,10.0,3.0,0.8,0.4,0.2,0.1,0.2,0.4,0.8,3.0,10.0,30.0],
      14: [50.0,15.0,5.0,2.0,0.8,0.3,0.1,0.1,0.3,0.8,2.0,5.0,15.0,50.0,50.0],
      16: [80.0,20.0,6.0,2.0,0.8,0.3,0.1,0.05,0.05,0.1,0.3,0.8,2.0,6.0,20.0,80.0,80.0],
    }
  };

  // Simuluj pád kuličky binomicky s house biasem
  let position = 0;
  for (let i = 0; i < rows; i++) {
    // House bias - 55% šance jít doleva (ke středu)
    position += Math.random() < 0.52 ? 0 : 1;
  }

  const mults = MULTIPLIERS[risk]?.[rows] || MULTIPLIERS.low[12];
  const bucketIndex = Math.min(position, mults.length - 1);
  let mult = mults[bucketIndex];

  // Aplikuj house edge
  if (mult > 1) mult = 1 + (mult - 1) * (1 - houseEdgePct / 100);

  return { bucket: bucketIndex, multiplier: parseFloat(mult.toFixed(4)), position };
}

// ================================================================
// /api/game/play — HLAVNÍ HERNÍ ENDPOINT
// Hráč pošle sázku, server vrátí výsledek
// ================================================================
app.post('/api/game/play', requireJWT, async (req, res) => {
  try {
    const { gameId, betBtc, options } = req.body;

    if (!gameId || !betBtc) {
      return res.status(400).json({ error: 'Chybí gameId nebo betBtc' });
    }

    const betAmount = parseFloat(betBtc);
    if (betAmount <= 0) return res.status(400).json({ error: 'Neplatná sázka' });

    // Načti nastavení hry z DB
    const gs = await getGameSettings(gameId);
    if (!gs) return res.status(404).json({ error: 'Hra nenalezena: ' + gameId });

    // Zkontroluj zda je hra povolena
    if (gs.enabled === false) {
      return res.status(403).json({ error: 'Tato hra je momentálně nedostupná' });
    }

    // Zkontroluj limity sázky
    const minBet = parseFloat(gs.min_bet_btc || 0.0001);
    const maxBet = parseFloat(gs.max_bet_btc || 0.1);
    if (betAmount < minBet) return res.status(400).json({ error: `Minimální sázka: ${minBet} BTC` });
    if (betAmount > maxBet) return res.status(400).json({ error: `Maximální sázka: ${maxBet} BTC` });

    const houseEdge = parseFloat(gs.house_edge_pct || 5);
    const maxWin   = parseFloat(gs.max_win_btc || 1.0);
    const rtpPct   = parseFloat(gs.rtp_pct || 95);

    // Zkontroluj balance
    const { data: profile } = await sb.from('profiles')
      .select('balance').eq('id', req.userId).single();
    if (!profile) return res.status(404).json({ error: 'Profil nenalezen' });
    if (parseFloat(profile.balance) < betAmount) {
      return res.status(400).json({ error: 'Nedostatek BTC' });
    }

    // Odečti sázku
    await sb.from('profiles')
      .update({ balance: parseFloat(profile.balance) - betAmount })
      .eq('id', req.userId);

    // ── VÝPOČET VÝSLEDKU PODLE HRY ──
    let result = {};
    let payout = 0;

    switch (gameId) {
      case 'crash': {
        const crashPoint = generateCrashPoint(rtpPct);
        const cashoutAt  = parseFloat(options?.cashoutAt || 2.0);
        const won = cashoutAt <= crashPoint;
        payout = won ? Math.min(betAmount * cashoutAt, betAmount + maxWin) : 0;
        result = { crashPoint, cashoutAt, won };
        break;
      }
      case 'dice': {
        const target  = parseFloat(options?.target || 50);
        const isOver  = options?.isOver !== false;
        const diceRes = generateDiceResult(target, isOver, houseEdge);
        payout = diceRes.won ? Math.min(betAmount * diceRes.payout, betAmount + maxWin) : 0;
        result = diceRes;
        break;
      }
      case 'slots': {
        const slotsRes = generateSlotsResult(houseEdge);
        payout = slotsRes.multiplier > 0
          ? Math.min(betAmount * slotsRes.multiplier, betAmount + maxWin)
          : 0;
        result = slotsRes;
        break;
      }
      case 'plinko': {
        const rows    = parseInt(options?.rows || 12);
        const risk    = options?.risk || 'low';
        const plinRes = generatePlinkoResult(rows, risk, houseEdge);
        payout = Math.min(betAmount * plinRes.multiplier, betAmount + maxWin);
        result = plinRes;
        break;
      }
      case 'roulette': {
        const rouResult = generateRouletteResult();
        const bets      = options?.bets || []; // [{ type: 'red', amount: 0.001 }, ...]
        let winAmount   = 0;
        // Vyhodnoť sázky
        const RED   = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
        const BLACK = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];
        bets.forEach(b => {
          if (b.type === 'red'   && RED.includes(rouResult))   winAmount += b.amount * 2;
          if (b.type === 'black' && BLACK.includes(rouResult)) winAmount += b.amount * 2;
          if (b.type === 'even'  && rouResult > 0 && rouResult % 2 === 0) winAmount += b.amount * 2;
          if (b.type === 'odd'   && rouResult % 2 === 1) winAmount += b.amount * 2;
          if (b.type === 'straight' && b.number === rouResult) winAmount += b.amount * 36;
          if (b.type === '1to18' && rouResult >= 1 && rouResult <= 18) winAmount += b.amount * 2;
          if (b.type === '19to36' && rouResult >= 19 && rouResult <= 36) winAmount += b.amount * 2;
        });
        // Aplikuj house edge
        payout = Math.min(winAmount * (1 - houseEdge / 100), betAmount + maxWin);
        result = { number: rouResult };
        break;
      }
      default: {
        // Obecný výsledek pro ostatní hry
        const r   = Math.random();
        const won = r < (rtpPct / 100) * 0.5; // ~47.5% win rate
        const mult = won ? (1 + Math.random() * 2) : 0;
        payout = won ? Math.min(betAmount * mult, betAmount + maxWin) : 0;
        result = { won, multiplier: parseFloat(mult.toFixed(4)) };
      }
    }

    // Přičti výhru
    if (payout > 0) {
      const { data: updatedProfile } = await sb.from('profiles')
        .select('balance').eq('id', req.userId).single();
      await sb.from('profiles')
        .update({ balance: parseFloat(updatedProfile.balance) + payout })
        .eq('id', req.userId);
    }

    // Ulož sázku do DB
    const profitSat = Math.round((payout - betAmount) * 1e8);
    const betSat    = Math.round(betAmount * 1e8);
    await sb.from('bets').insert({
      user_id:         req.userId,
      game:            gameId,
      bet_satoshi:     betSat,
      profit_satoshi:  profitSat,
      multiplier:      result.multiplier || (payout / betAmount),
      meta:            result,
      created_at:      new Date().toISOString()
    });

    // Aktualizuj game_settings statistiky
    await sb.from('game_settings').update({
      total_bets_count:  sb.rpc('increment', { x: 1 }),
      total_wagered_btc: parseFloat((parseFloat(gs.total_wagered_btc || 0) + betAmount).toFixed(8)),
      total_paid_btc:    parseFloat((parseFloat(gs.total_paid_btc || 0) + payout).toFixed(8)),
      house_profit_btc:  parseFloat((parseFloat(gs.house_profit_btc || 0) + betAmount - payout).toFixed(8)),
    }).eq('id', gameId);

    // Odpověď
    const newBalance = parseFloat(profile.balance) - betAmount + payout;
    console.log(`[GAME] ${gameId} | ${req.userEmail} | bet=${betAmount} payout=${payout.toFixed(8)} profit=${(payout-betAmount).toFixed(8)}`);

    res.json({
      ok:          true,
      result,
      payout:      parseFloat(payout.toFixed(8)),
      profit:      parseFloat((payout - betAmount).toFixed(8)),
      new_balance: parseFloat(newBalance.toFixed(8)),
      game_id:     gameId,
      house_edge:  houseEdge,
      max_win:     maxWin
    });

  } catch (e) {
    console.error('[GAME/PLAY]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ================================================================
// /api/game/settings/:gameId — GET nastavení hry
// ================================================================
app.get('/api/game/settings/:gameId', requireJWT, async (req, res) => {
  try {
    const gs = await getGameSettings(req.params.gameId);
    if (!gs) return res.status(404).json({ error: 'Hra nenalezena' });
    if (!gs.enabled) return res.status(403).json({ error: 'Hra nedostupná' });
    // Vrať jen bezpečná data (ne house_edge)
    res.json({
      id:          gs.id,
      name:        gs.name,
      min_bet_btc: gs.min_bet_btc,
      max_bet_btc: gs.max_bet_btc,
      max_win_btc: gs.max_win_btc,
      rtp_pct:     gs.rtp_pct,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ================================================================
// /admin/game/settings — správa nastavení her
// ================================================================
app.get('/admin/game/settings', requireApiKey, async (req, res) => {
  try {
    const { data } = await sb.from('game_settings').select('*').order('id');
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/game/settings/:gameId', requireApiKey, async (req, res) => {
  try {
    const allowed = ['enabled','house_edge_pct','rtp_pct','min_bet_btc','max_bet_btc','max_win_btc'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Žádné platné parametry' });
    updates.updated_at = new Date().toISOString();
    await sb.from('game_settings').update(updates).eq('id', req.params.gameId);
    // Invaliduj cache
    gameSettingsCacheTime = 0;
    console.log(`[ADMIN/GS] ${req.params.gameId} aktualizováno:`, updates);
    res.json({ ok: true, updated: updates });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ================================================================
// KONEC HERNÍCH ENDPOINTŮ
// ================================================================
