// ── CryptoKasino AI Chat Agent ─────────────────────────────────
(function(){
  var page = window.location.pathname.split('/').pop() || 'index.html';
  var allowed = ['index.html','casino.html','live.html','sports.html',''];
  if(!allowed.includes(page)) return;

  var SP = 'You are Kasey, AI support for CryptoKasino (www.cryptokasino.io). Be helpful, friendly, concise. Use emojis. Answer in same language as user.\n\nCASINO: Bitcoin only | 16+ games + Sports | Provably Fair | Jackpot ~21 BTC\n\nCURRENT GAMES: Crash, Slots, Roulette, Poker, Dice, Blackjack, Plinko, Mines, CrazyTime, Wheel, Jackpot, Baccarat, Craps, Keno, HiLo, Sports\n\nNEW GAMES (launched):\n- Dragon Tower: 9-floor tower, avoid dragons, 3 difficulties, max 3786x, cash out anytime\n- Video Poker: Jacks or Better, hold & draw, Royal Flush = 800x, RTP 98%\n\nCOMING SOON:\n- Egypt Gold Slots, Neon City Slots, Dragon Slots (more coming regularly!)\n\nRULES: Crash=cash out before crash | Slots=match symbols | Roulette=0-36 Red/Black 2x | Blackjack=beat dealer 21 | Dice=over/under | Plinko=up to 100x | Mines=avoid mines cash out | Baccarat=Player/Banker/Tie | Keno=pick 1-10 from 80 | HiLo=higher/lower | Sports=odds 1.72-3.80x | DragonTower=climb floors avoid dragons | VideoPoker=hold best cards draw new\n\nDEPOSITS: Unique BTC address | 1 confirmation | No minimum\nWITHDRAWALS: Min 0.001 BTC | Fee 0.00005 BTC | Instant\nWELCOME BONUS: 50% first deposit max 0.001 BTC auto\nVIP: Bronze(5%)→Silver(10%)→Gold(15%)→Diamond(20%)→Royal(25%+manager)\nAFFILIATE: 25-35% commission | Friday BTC payouts\nPROVABLY FAIR: SHA-256 | Verify at verify.html\nSUPPORT: support@cryptokasino.io';

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
