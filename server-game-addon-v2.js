// ================================================================
// CRYPTOKASINO - HERNÍ ENDPOINTY v2.0
// Přidej PŘED řádek: app.listen(PORT, () => {
// ================================================================

// ── GAME SETTINGS CACHE (60s) ──────────────────────────────────
let _gsCache = {}, _gsCacheTime = 0;

async function getGameSettings(gameId) {
  if (Date.now() - _gsCacheTime > 60000) {
    const { data } = await sb.from('game_settings').select('*');
    if (data) { data.forEach(g => { _gsCache[g.id] = g; }); _gsCacheTime = Date.now(); }
  }
  return _gsCache[gameId] || null;
}

// ── HERNÍ LOGIKA ───────────────────────────────────────────────

function _crash(rtpPct) {
  const r = Math.random();
  if (r < 0.05) return 1.00;
  return parseFloat(Math.max(1.00, Math.min((-Math.log(1 - r * rtpPct/100) + 1), 1000)).toFixed(2));
}

function _dice(target, isOver, houseEdge) {
  const roll = parseFloat((Math.random() * 100).toFixed(2));
  const won  = isOver ? roll > target : roll < target;
  const raw  = isOver ? 100/(100-target) : 100/target;
  return { roll, won, payout: parseFloat((raw * (1-houseEdge/100)).toFixed(4)) };
}

function _randSym(syms) {
  const tw = syms.reduce((s,x)=>s+x.w,0);
  let r = Math.random()*tw;
  for (const s of syms) { r-=s.w; if(r<=0) return s; }
  return syms[syms.length-1];
}

function _slots(houseEdge) {
  const S=[
    {n:'Diamond',w:3,m3:50,m4:100,m5:200},{n:'Star',w:5,m3:20,m4:40,m5:80},
    {n:'Cherry',w:10,m3:8,m4:18,m5:35},{n:'Lemon',w:12,m3:5,m4:10,m5:20},
    {n:'Orange',w:12,m3:4,m4:8,m5:15},{n:'Grape',w:13,m3:3,m4:6,m5:12},
    {n:'Bell',w:13,m3:2,m4:5,m5:10},{n:'Melon',w:14,m3:2,m4:4,m5:8},
    {n:'Clover',w:14,m3:1,m4:3,m5:6},{n:'Bonus',w:4,m3:0,m4:0,m5:0}
  ];
  const grid=[];
  for(let c=0;c<5;c++){const col=[];for(let r=0;r<3;r++){let s=_randSym(S);if(Math.random()<0.15){const a=_randSym(S);if(a.n!==s.n)s=a;}col.push(s);}grid.push(col);}
  const mid=grid.map(c=>c[1]);
  let mult=0,cnt=1,first=mid[0];
  for(let i=1;i<5;i++){if(mid[i].n===first.n)cnt++;else break;}
  if(cnt>=3){const m=cnt===5?first.m5:cnt===4?first.m4:first.m3;mult=m*(1-houseEdge/100);}
  return{grid:grid.map(c=>c.map(s=>s.n)),multiplier:parseFloat(mult.toFixed(4))};
}

function _wheel(houseEdge) {
  const W={0:120,2:65,3:50,4:40,5:35,6:28,8:20,10:15,15:10,20:8};
  const segs=[
    {mult:0,count:22},{mult:2,count:8},{mult:3,count:6},
    {mult:4,count:4},{mult:5,count:3},{mult:6,count:2},{mult:8,count:2},{mult:10,count:1}
  ];
  const pool=[];
  segs.forEach(s=>{for(let i=0;i<s.count*(W[s.mult]||1);i++)pool.push(s.mult);});
  const mult=pool[Math.floor(Math.random()*pool.length)];
  const eff=mult>1?1+((mult-1)*(1-houseEdge/100)):mult;
  return{mult,effective:parseFloat(eff.toFixed(4))};
}

function _plinko(rows,risk,houseEdge) {
  const M={
    low:{8:[2.0,1.2,0.9,0.8,0.7,0.8,0.9,1.2,2.0],12:[8.9,3.0,1.4,1.1,1.0,0.9,0.7,0.9,1.0,1.1,1.4,3.0,8.9],14:[7.1,4.0,1.9,1.4,1.1,0.9,0.7,0.6,0.7,0.9,1.1,1.4,1.9,4.0,7.1],16:[16.0,9.0,2.0,1.4,1.2,1.0,0.7,0.5,0.4,0.5,0.7,1.0,1.2,1.4,2.0,9.0,16.0]},
    medium:{8:[3.0,1.5,0.8,0.5,0.3,0.5,0.8,1.5,3.0],12:[15.0,5.0,2.0,1.0,0.6,0.3,0.2,0.3,0.6,1.0,2.0,5.0,15.0],14:[20.0,7.0,3.0,1.5,0.8,0.4,0.2,0.2,0.4,0.8,1.5,3.0,7.0,20.0,20.0],16:[20.0,8.0,3.0,1.2,0.6,0.3,0.1,0.1,0.1,0.3,0.6,1.2,3.0,8.0,20.0,20.0,20.0]},
    high:{8:[6.0,3.0,1.0,0.3,0.2,0.3,1.0,3.0,6.0],12:[30.0,10.0,3.0,0.8,0.4,0.2,0.1,0.2,0.4,0.8,3.0,10.0,30.0],14:[50.0,15.0,5.0,2.0,0.8,0.3,0.1,0.1,0.3,0.8,2.0,5.0,15.0,50.0,50.0],16:[80.0,20.0,6.0,2.0,0.8,0.3,0.1,0.05,0.05,0.1,0.3,0.8,2.0,6.0,20.0,80.0,80.0]}
  };
  let pos=0;
  for(let i=0;i<rows;i++) pos+=Math.random()<0.52?0:1;
  const mults=M[risk]?.[rows]||M.low[12];
  let mult=mults[Math.min(pos,mults.length-1)];
  if(mult>1) mult=1+((mult-1)*(1-houseEdge/100));
  return{bucket:pos,multiplier:parseFloat(mult.toFixed(4))};
}

function _roulette() {
  return Math.floor(Math.random()*38); // 0-36 + 00(=37)
}

function _blackjack(houseEdge) {
  // Simulace blackjacku - dealer advantage
  const r=Math.random();
  if(r<0.495*(1-houseEdge/100)) return{won:true,mult:2.0,result:'win'};
  if(r<0.505*(1-houseEdge/100)) return{won:true,mult:2.5,result:'blackjack'};
  if(r<0.51) return{won:false,mult:1.0,result:'push'};
  return{won:false,mult:0,result:'lose'};
}

function _baccarat(houseEdge) {
  const r=Math.random();
  // Player 44.6%, Banker 45.8%, Tie 9.6%
  if(r<0.096) return{outcome:'tie',mult:9*(1-houseEdge/100)};
  if(r<0.096+0.458) return{outcome:'banker',mult:1.95*(1-houseEdge/100)};
  return{outcome:'player',mult:2*(1-houseEdge/100)};
}

function _mines(mineCount, revealedSafe, houseEdge) {
  const total=25, safe=total-mineCount;
  // Pravdepodobnost ze vsechno odhalene je bezpecne
  let prob=1;
  for(let i=0;i<revealedSafe;i++) prob*=(safe-i)/(total-i);
  const mult=parseFloat((prob>0?(1/prob)*(1-houseEdge/100):0).toFixed(4));
  const hitMine=Math.random()>(safe-revealedSafe)/(total-revealedSafe);
  return{hitMine,multiplier:hitMine?0:mult};
}

function _keno(picked, houseEdge) {
  // Keno - 20 cisel tazeno z 80
  const drawn=new Set();
  while(drawn.size<20) drawn.add(Math.floor(Math.random()*80)+1);
  const hits=picked.filter(n=>drawn.has(n)).length;
  const PAYOUTS={0:0,1:0,2:0,3:1,4:2,5:4,6:6,7:10,8:15,9:25,10:40};
  const basePayout=PAYOUTS[Math.min(hits,10)]||0;
  const mult=parseFloat((basePayout*(1-houseEdge/100)).toFixed(4));
  return{drawn:[...drawn].sort((a,b)=>a-b),hits,multiplier:mult};
}

function _hilo(card, guessHigher, houseEdge) {
  const newCard=Math.floor(Math.random()*13)+1; // 1-13
  const won=guessHigher?(newCard>card):(newCard<card);
  const prob=guessHigher?(13-card)/13:((card-1)/13);
  const mult=prob>0?parseFloat(((1/prob)*(1-houseEdge/100)).toFixed(4)):0;
  return{newCard,won,multiplier:won?mult:0};
}

function _craps(betType, houseEdge) {
  const d1=Math.floor(Math.random()*6)+1;
  const d2=Math.floor(Math.random()*6)+1;
  const total=d1+d2;
  let won=false, mult=0;
  if(betType==='pass'){
    won=total===7||total===11;
    if(total===2||total===3||total===12) won=false;
    mult=won?2*(1-houseEdge/100):0;
  } else if(betType==='dontpass'){
    won=total===2||total===3;
    mult=won?2*(1-houseEdge/100):0;
  } else if(betType==='field'){
    won=[2,3,4,9,10,11,12].includes(total);
    mult=won?(total===2||total===12?3:2)*(1-houseEdge/100):0;
  } else {
    // Any 7
    won=total===7;
    mult=won?5*(1-houseEdge/100):0;
  }
  return{dice:[d1,d2],total,won,multiplier:parseFloat(mult.toFixed(4))};
}

function _crazytime(houseEdge) {
  const SEGMENTS=[
    {name:'1',mult:1,count:21},{name:'2',mult:2,count:13},
    {name:'5',mult:5,count:7},{name:'10',mult:10,count:4},
    {name:'CrazyTime',mult:10,count:1},{name:'Pachinko',mult:5,count:2},
    {name:'CoinFlip',mult:3,count:4},{name:'CashHunt',mult:4,count:2}
  ];
  const pool=[];
  SEGMENTS.forEach(s=>{for(let i=0;i<s.count;i++)pool.push(s);});
  const result=pool[Math.floor(Math.random()*pool.length)];
  const eff=parseFloat((result.mult*(1-houseEdge/100)).toFixed(4));
  return{segment:result.name,multiplier:eff};
}

function _jackpot(houseEdge, jackpotAmount) {
  const r=Math.random();
  // 0.01% sance na jackpot
  if(r<0.0001 && jackpotAmount>0) return{won:true,jackpot:true,multiplier:0,jackpotAmount};
  // Normal spin
  const mult=r<0.3?parseFloat((Math.random()*3+1).toFixed(2)):0;
  return{won:mult>0,jackpot:false,multiplier:parseFloat((mult*(1-houseEdge/100)).toFixed(4))};
}

function _jackpotshow(houseEdge) {
  const TIERS=[
    {name:'Grand',mult:1000,prob:0.0005},
    {name:'Major',mult:100,prob:0.005},
    {name:'Minor',mult:20,prob:0.02},
    {name:'Mini',mult:5,prob:0.08},
    {name:'Normal',mult:2,prob:0.2},
    {name:'Lose',mult:0,prob:0.6945}
  ];
  const r=Math.random();
  let cum=0;
  for(const t of TIERS){
    cum+=t.prob;
    if(r<cum){
      const eff=t.mult>0?parseFloat((t.mult*(1-houseEdge/100)).toFixed(4)):0;
      return{tier:t.name,multiplier:eff};
    }
  }
  return{tier:'Lose',multiplier:0};
}

function _poker(houseEdge) {
  // Video poker - Jack or Better
  const HANDS=[
    {name:'Royal Flush',mult:800,prob:0.000154},
    {name:'Straight Flush',mult:50,prob:0.00109},
    {name:'Four of a Kind',mult:25,prob:0.00236},
    {name:'Full House',mult:9,prob:0.01151},
    {name:'Flush',mult:6,prob:0.01101},
    {name:'Straight',mult:4,prob:0.01123},
    {name:'Three of a Kind',mult:3,prob:0.07445},
    {name:'Two Pair',mult:2,prob:0.12928},
    {name:'Jacks or Better',mult:1,prob:0.21458},
    {name:'Nothing',mult:0,prob:0.54494}
  ];
  const r=Math.random();
  let cum=0;
  for(const h of HANDS){
    cum+=h.prob;
    if(r<cum){
      const eff=h.mult>0?parseFloat((h.mult*(1-houseEdge/100)).toFixed(4)):0;
      return{hand:h.name,multiplier:eff};
    }
  }
  return{hand:'Nothing',multiplier:0};
}

// ── HLAVNÍ ENDPOINT ────────────────────────────────────────────
app.post('/api/game/play', requireJWT, async (req, res) => {
  try {
    const { gameId, betBtc, options={} } = req.body;
    if (!gameId || !betBtc) return res.status(400).json({ error: 'Chybí gameId nebo betBtc' });

    const bet = parseFloat(betBtc);
    if (isNaN(bet) || bet <= 0) return res.status(400).json({ error: 'Neplatná sázka' });

    // Načti nastavení z DB
    const gs = await getGameSettings(gameId);
    if (!gs) return res.status(404).json({ error: 'Hra nenalezena: ' + gameId });
    if (gs.enabled === false) return res.status(403).json({ error: 'Hra je momentálně nedostupná' });

    const minBet   = parseFloat(gs.min_bet_btc || 0.0001);
    const maxBet   = parseFloat(gs.max_bet_btc || 0.1);
    const maxWin   = parseFloat(gs.max_win_btc || 1.0);
    const he       = parseFloat(gs.house_edge_pct || 5);
    const rtp      = parseFloat(gs.rtp_pct || 95);

    if (bet < minBet) return res.status(400).json({ error: `Min sázka: ${minBet} BTC` });
    if (bet > maxBet) return res.status(400).json({ error: `Max sázka: ${maxBet} BTC` });

    // Zkontroluj balance
    const { data: prof, error: profErr } = await sb.from('profiles').select('balance').eq('id', req.userId).single();
    if (profErr || !prof) return res.status(404).json({ error: 'Profil nenalezen' });
    if (parseFloat(prof.balance) < bet) return res.status(400).json({ error: 'Nedostatek BTC' });

    // Odečti sázku
    await sb.from('profiles').update({ balance: parseFloat(prof.balance) - bet }).eq('id', req.userId);

    // ── VÝSLEDEK PODLE HRY ─────────────────────────────────────
    let result = {}, mult = 0;

    switch (gameId) {
      case 'crash': {
        const cp  = _crash(rtp);
        const co  = parseFloat(options.cashoutAt || 2.0);
        const won = co <= cp;
        mult   = won ? co : 0;
        result = { crashPoint: cp, cashoutAt: co, won };
        break;
      }
      case 'dice': {
        const r = _dice(parseFloat(options.target||50), options.isOver!==false, he);
        mult   = r.won ? r.payout : 0;
        result = r;
        break;
      }
      case 'slots': {
        const r = _slots(he);
        mult   = r.multiplier;
        result = r;
        break;
      }
      case 'wheel': {
        const r = _wheel(he);
        mult   = r.effective;
        result = r;
        break;
      }
      case 'plinko': {
        const r = _plinko(parseInt(options.rows||12), options.risk||'low', he);
        mult   = r.multiplier;
        result = r;
        break;
      }
      case 'roulette': {
        const num  = _roulette();
        const bets = options.bets || [];
        const RED  = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
        const BLK  = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];
        let win = 0;
        bets.forEach(b => {
          if (b.type==='red'      && RED.includes(num))           win+=b.amount*2;
          if (b.type==='black'    && BLK.includes(num))           win+=b.amount*2;
          if (b.type==='even'     && num>0&&num%2===0)            win+=b.amount*2;
          if (b.type==='odd'      && num%2===1)                   win+=b.amount*2;
          if (b.type==='1to18'    && num>=1&&num<=18)             win+=b.amount*2;
          if (b.type==='19to36'   && num>=19&&num<=36)            win+=b.amount*2;
          if (b.type==='straight' && b.number===num)              win+=b.amount*36;
          if (b.type==='dozen1'   && num>=1&&num<=12)             win+=b.amount*3;
          if (b.type==='dozen2'   && num>=13&&num<=24)            win+=b.amount*3;
          if (b.type==='dozen3'   && num>=25&&num<=36)            win+=b.amount*3;
        });
        mult   = win>0 ? parseFloat((win*(1-he/100)/bet).toFixed(4)) : 0;
        result = { number: num };
        break;
      }
      case 'blackjack': {
        const r = _blackjack(he);
        mult   = r.won ? r.mult : 0;
        result = r;
        break;
      }
      case 'baccarat': {
        const r = _baccarat(he);
        const betOn = options.betOn || 'player';
        mult = betOn===r.outcome ? r.mult : (r.outcome==='tie'&&betOn==='tie'?r.mult:0);
        result = r;
        break;
      }
      case 'mines': {
        const r = _mines(parseInt(options.mineCount||3), parseInt(options.revealed||0), he);
        mult   = r.hitMine ? 0 : r.multiplier;
        result = r;
        break;
      }
      case 'keno': {
        const r = _keno(options.picked||[], he);
        mult   = r.multiplier;
        result = r;
        break;
      }
      case 'hilo': {
        const r = _hilo(parseInt(options.card||7), options.guessHigher!==false, he);
        mult   = r.multiplier;
        result = r;
        break;
      }
      case 'craps': {
        const r = _craps(options.betType||'pass', he);
        mult   = r.multiplier;
        result = r;
        break;
      }
      case 'crazytime': {
        const r = _crazytime(he);
        mult   = r.multiplier;
        result = r;
        break;
      }
      case 'jackpot': {
        const { data: jpData } = await sb.from('jackpot').select('amount_satoshi').eq('id',1).single();
        const jpBtc = jpData ? parseFloat(jpData.amount_satoshi||0)/1e8 : 0;
        const r = _jackpot(he, jpBtc);
        if (r.jackpot) {
          mult = 0;
          result = { ...r, payout: jpBtc };
          await sb.from('jackpot').update({ amount_satoshi: Math.round(0.001*1e8) }).eq('id',1);
        } else {
          mult   = r.multiplier;
          result = r;
        }
        break;
      }
      case 'jackpotshow': {
        const r = _jackpotshow(he);
        mult   = r.multiplier;
        result = r;
        break;
      }
      case 'poker': {
        const r = _poker(he);
        mult   = r.multiplier;
        result = r;
        break;
      }
      default:
        return res.status(400).json({ error: 'Neznámá hra: ' + gameId });
    }

    // ── VÝPLATA ────────────────────────────────────────────────
    const rawPayout = bet * mult;
    const payout    = parseFloat(Math.min(rawPayout, bet + maxWin).toFixed(8));
    const profit    = parseFloat((payout - bet).toFixed(8));

    // Přičti výhru
    if (payout > 0) {
      const { data: p2 } = await sb.from('profiles').select('balance').eq('id', req.userId).single();
      await sb.from('profiles').update({ balance: parseFloat(p2.balance) + payout }).eq('id', req.userId);
    }

    const newBalance = parseFloat(prof.balance) - bet + payout;

    // Ulož sázku
    await sb.from('bets').insert({
      user_id:        req.userId,
      game:           gameId,
      bet_satoshi:    Math.round(bet*1e8),
      profit_satoshi: Math.round(profit*1e8),
      multiplier:     mult,
      meta:           result,
      created_at:     new Date().toISOString()
    });

    // Aktualizuj statistiky hry
    await sb.from('game_settings').update({
      total_bets_count:  (parseInt(gs.total_bets_count||0)+1),
      total_wagered_btc: parseFloat((parseFloat(gs.total_wagered_btc||0)+bet).toFixed(8)),
      total_paid_btc:    parseFloat((parseFloat(gs.total_paid_btc||0)+payout).toFixed(8)),
      house_profit_btc:  parseFloat((parseFloat(gs.house_profit_btc||0)+bet-payout).toFixed(8)),
      updated_at:        new Date().toISOString()
    }).eq('id', gameId);

    console.log(`[GAME] ${gameId} | ${req.userEmail} | bet=${bet} mult=${mult} payout=${payout} profit=${profit>0?'+':''}${profit}`);

    res.json({ ok: true, result, mult, payout, profit, new_balance: parseFloat(newBalance.toFixed(8)) });

  } catch (e) {
    console.error('[GAME/PLAY]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── NASTAVENÍ HRY (pro hráče) ──────────────────────────────────
app.get('/api/game/settings/:gameId', requireJWT, async (req, res) => {
  try {
    const gs = await getGameSettings(req.params.gameId);
    if (!gs) return res.status(404).json({ error: 'Hra nenalezena' });
    if (!gs.enabled) return res.status(403).json({ error: 'Hra nedostupná' });
    res.json({ id:gs.id, name:gs.name, min_bet_btc:gs.min_bet_btc, max_bet_btc:gs.max_bet_btc, max_win_btc:gs.max_win_btc });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ADMIN: přehled nastavení ───────────────────────────────────
app.get('/admin/game/settings', requireApiKey, async (req, res) => {
  try {
    const { data } = await sb.from('game_settings').select('*').order('id');
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ADMIN: změna nastavení živě ────────────────────────────────
app.post('/admin/game/settings/:gameId', requireApiKey, async (req, res) => {
  try {
    const ok=['enabled','house_edge_pct','rtp_pct','min_bet_btc','max_bet_btc','max_win_btc'];
    const upd={};
    ok.forEach(k=>{ if(req.body[k]!==undefined) upd[k]=req.body[k]; });
    if (!Object.keys(upd).length) return res.status(400).json({ error: 'Žádné parametry' });
    upd.updated_at = new Date().toISOString();
    await sb.from('game_settings').update(upd).eq('id', req.params.gameId);
    _gsCacheTime = 0; // invaliduj cache
    console.log(`[ADMIN/GS] ${req.params.gameId} aktualizováno:`, upd);
    res.json({ ok: true, updated: upd });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ================================================================
// KONEC HERNÍCH ENDPOINTŮ — pokračuje app.listen(PORT, ...
// ================================================================
