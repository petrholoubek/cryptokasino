// ── CryptoKasino AI Chat Agent ─────────────────────────────────
(function(){
  var page = window.location.pathname.split('/').pop() || 'index.html';
  var allowed = ['index.html','casino.html','live.html','sports.html',''];
  if(!allowed.includes(page)) return;

  var SP = 'You are Kasey, AI support for CryptoKasino (www.cryptokasino.io). Helpful, friendly, concise. Use emojis. Answer in same language as user.\n\nWe have 20 GAMES + Sports Betting = 21 total:\n1) Crash - multiplier grows, cash out before crash, provably fair\n2) Slots - match symbols on reels, RTP 95%, jackpot on 3 matching\n3) Roulette - 0-36, Red/Black=2x, single number=35x, European style\n4) Poker - Texas Holdem, best 5-card hand wins\n5) Blackjack - beat dealer to 21, blackjack pays 3:2, dealer stands 17\n6) Dice - pick over/under and target number, adjustable risk/payout\n7) Mines - pick tiles avoid mines, cash out anytime, more tiles = higher mult\n8) Plinko - drop ball through pegs into multiplier slots, up to 100x\n9) Wheel - spin for 1x to 100x multipliers\n10) Craps - bet on dice rolls, Pass/DontPass/Come/Place bets\n11) Baccarat - Player/Banker/Tie, Banker wins most, Tie pays 8:1\n12) CrazyTime - wheel game show, bonus rounds CoinFlip/Pachinko/CashHunt\n13) Keno - pick 1-10 numbers from 80, more matches = bigger win\n14) HiLo - guess if next card Higher or Lower, chain wins for bigger mult\n15) Jackpot - progressive jackpot slot, 0.5pct of every bet contributes, ~21 BTC\n16) Dragon Tower - climb 9-floor tower, pick safe tiles avoid dragons, 3 difficulties Easy/Medium/Hard, max 3786x on Hard, cash out anytime, provably fair\n17) Video Poker - Jacks or Better, hold best cards draw new ones, Royal Flush=800x, Four of a Kind=25x, Full House=9x, Flush=6x, Straight=4x, Three=3x, TwoPair=2x, JacksOrBetter=1x, RTP 98pct\n18) Egypt Gold Slots - ancient Egypt theme, progressive multipliers, coming soon\n19) Neon City Slots - cyberpunk theme, wilds and free spins, coming soon\n20) Dragon Slots - dragon theme with jackpot bonus round, coming soon\n+ Sports Betting - football and more, accumulators, odds 1.72x-3.80x\n\nDEPOSITS: Unique BTC address per player, 1 blockchain confirmation, no minimum, instant credit\nWITHDRAWALS: Min 0.001 BTC, fee 0.00005 BTC, instant automated, 1 per 60 seconds\nWELCOME BONUS: 50pct match first deposit, max 0.001 BTC, auto-credited\nVIP 5 levels: Bronze(5pct cashback from 0.1 BTC wagered), Silver(10pct from 0.5 BTC), Gold(15pct from 2 BTC), Diamond(20pct from 5 BTC), Royal(25pct+manager from 10 BTC)\nAFFILIATE: 25pct Standard, 30pct Silver 10+ players, 35pct Gold 50+ players, Friday BTC payouts, affiliate@cryptokasino.io\nPROVABLY FAIR: SHA-256, server seed + client seed + nonce, verify at verify.html\nSUPPORT: support@cryptokasino.io';

  var hist = [], busy = false;

  var css = document.createElement('style');
  css.textContent = '#ckBtn{position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#c8920a,#f5c842);border:none;cursor:pointer;box-shadow:0 0 25px rgba(212,160,23,.5);font-size:1.3rem;transition:all .2s;}#ckBtn:hover{transform:scale(1.1);}#ckN{position:absolute;top:-3px;right:-3px;width:16px;height:16px;background:#f87171;border-radius:50%;font-size:.55rem;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;animation:ckP 2s infinite;}@keyframes ckP{0%,100%{box-shadow:0 0 0 0 rgba(248,113,113,.5);}70%{box-shadow:0 0 0 6px rgba(248,113,113,0);}}#ckW{position:fixed;bottom:4.8rem;right:1.5rem;z-index:9999;width:330px;height:470px;background:rgba(2,8,30,.98);border:1px solid rgba(212,160,23,.3);border-radius:18px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6);transform:scale(0) translateY(20px);transform-origin:bottom right;transition:all .3s cubic-bezier(.34,1.56,.64,1);opacity:0;pointer-events:none;}#ckW.open{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}#ckH{background:rgba(5,15,50,.9);padding:.7rem 1rem;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(212,160,23,.2);}#ckHt{font-family:"Cinzel",serif;font-size:.7rem;font-weight:700;color:#F5C842;display:flex;align-items:center;gap:.5rem;}#ckHd{width:6px;height:6px;background:#4ade80;border-radius:50%;box-shadow:0 0 5px #4ade80;animation:ckP 1.5s infinite;}#ckX{background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;font-size:1rem;padding:.1rem;}#ckX:hover{color:#fff;}#ckM{flex:1;overflow-y:auto;padding:.7rem;display:flex;flex-direction:column;gap:.5rem;}#ckM::-webkit-scrollbar{width:2px;}#ckM::-webkit-scrollbar-thumb{background:rgba(212,160,23,.3);}.ckr{display:flex;gap:.45rem;animation:ckIn .25s ease;}@keyframes ckIn{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);}}.ckr.u{flex-direction:row-reverse;}.cka{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.7rem;flex-shrink:0;}.cka.bot{background:linear-gradient(135deg,#c8920a,#f5c842);color:#000;}.cka.u{background:rgba(96,165,250,.2);color:#60a5fa;border:1px solid rgba(96,165,250,.3);}.ckb{max-width:84%;padding:.5rem .75rem;border-radius:10px;font-size:.77rem;line-height:1.5;color:#e8e8ff;}.ckr.bot .ckb{background:rgba(5,15,50,.9);border:1px solid rgba(60,120,255,.2);border-radius:3px 10px 10px 10px;}.ckr.u .ckb{background:rgba(96,165,250,.1);border:1px solid rgba(96,165,250,.2);border-radius:10px 3px 10px 10px;}.ckt{display:flex;gap:.3rem;padding:.3rem 0;}.ckt span{width:6px;height:6px;background:rgba(255,255,255,.3);border-radius:50%;animation:ckB .8s infinite;}.ckt span:nth-child(2){animation-delay:.12s;}.ckt span:nth-child(3){animation-delay:.24s;}@keyframes ckB{0%,60%,100%{transform:translateY(0);}30%{transform:translateY(-5px);}}#ckQ{display:flex;flex-wrap:wrap;gap:.3rem;padding:0 .7rem .5rem;}.ckq{background:rgba(60,120,255,.08);border:1px solid rgba(60,120,255,.2);color:#93c5fd;font-size:.6rem;padding:.22rem .55rem;border-radius:10px;cursor:pointer;transition:all .2s;}.ckq:hover{background:rgba(60,120,255,.18);}#ckIr{display:flex;gap:.45rem;padding:.6rem;border-top:1px solid rgba(60,120,255,.15);}#ckI{flex:1;background:rgba(5,15,50,.8);border:1px solid rgba(60,120,255,.2);border-radius:7px;padding:.45rem .65rem;font-size:.77rem;color:#e8e8ff;outline:none;resize:none;font-family:"Crimson Text",serif;}#ckI:focus{border-color:rgba(96,165,250,.5);}#ckS{background:linear-gradient(135deg,#c8920a,#e8b020);color:#000;border:none;width:30px;height:30px;border-radius:7px;cursor:pointer;font-size:.85rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s;}#ckS:hover{transform:scale(1.08);}#ckS:disabled{opacity:.5;cursor:not-allowed;transform:none;}@media(max-width:420px){#ckW{width:calc(100vw - 2rem);right:1rem;}}';
  document.head.appendChild(css);

  var el = document.createElement('div');
  el.innerHTML = '<button id="ckBtn" onclick="ckT()">🤖<div id="ckN">1</div></button><div id="ckW"><div id="ckH"><div id="ckHt"><div id="ckHd"></div>Kasey — AI Support</div><button id="ckX" onclick="ckT()">✕</button></div><div id="ckM"></div><div id="ckQ"><span class="ckq" onclick="ckA(\'How to deposit BTC?\')">💰 Deposit</span><span class="ckq" onclick="ckA(\'What games do you have?\')">🎮 Games</span><span class="ckq" onclick="ckA(\'How does Crash work?\')">🚀 Crash</span><span class="ckq" onclick="ckA(\'Tell me about VIP\')">👑 VIP</span><span class="ckq" onclick="ckA(\'What is welcome bonus?\')">🎁 Bonus</span><span class="ckq" onclick="ckA(\'How does Provably Fair work?\')">✅ Fair</span></div><div id="ckIr"><textarea id="ckI" rows="1" placeholder="Ask anything..." onkeydown="ckK(event)"></textarea><button id="ckS" onclick="ckSend()">&#10148;</button></div></div>';
  document.body.appendChild(el);

  setTimeout(function(){ckAdd('bot','Hey! 👋 I\'m **Kasey**, your CryptoKasino AI. Ask me about games, bonuses, deposits or anything else!');},2500);

  window.ckT=function(){var w=document.getElementById('ckW'),n=document.getElementById('ckN');w.classList.toggle('open');if(n)n.style.display='none';};
  window.ckA=function(q){document.getElementById('ckI').value=q;ckSend();document.getElementById('ckQ').style.display='none';};
  window.ckK=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ckSend();}};

  function ckAdd(role,text){
    var m=document.getElementById('ckM'),d=document.createElement('div');
    d.className='ckr '+role;
    var c=text.replace(/\*\*(.*?)\*\*/g,'<b>$1</b>').replace(/\*(.*?)\*/g,'<i>$1</i>').replace(/\n/g,'<br>');
    d.innerHTML='<div class="cka '+role+'">'+(role==='bot'?'🤖':'👤')+'</div><div class="ckb">'+c+'</div>';
    m.appendChild(d);m.scrollTop=m.scrollHeight;
  }

  window.ckSend=async function(){
    var inp=document.getElementById('ckI'),btn=document.getElementById('ckS'),txt=inp.value.trim();
    if(!txt||busy)return;
    inp.value='';busy=true;btn.disabled=true;
    ckAdd('user',txt);hist.push({role:'user',content:txt});
    var m=document.getElementById('ckM'),td=document.createElement('div');
    td.className='ckr bot';td.id='ckTyp';
    td.innerHTML='<div class="cka bot">🤖</div><div class="ckb"><div class="ckt"><span></span><span></span><span></span></div></div>';
    m.appendChild(td);m.scrollTop=m.scrollHeight;
    try{
      var r=await fetch('https://api.cryptokasino.io/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:hist,system:SP})});
      var d=await r.json();
      var te=document.getElementById('ckTyp');if(te)te.remove();
      if(d.content&&d.content[0]){var rep=d.content[0].text;hist.push({role:'assistant',content:rep});ckAdd('bot',rep);}
    }catch(e){var te2=document.getElementById('ckTyp');if(te2)te2.remove();ckAdd('bot','Connection error. Email: support@cryptokasino.io 📧');}
    busy=false;btn.disabled=false;
  };
})();
