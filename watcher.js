// ════════════════════════════════════════════════════════
// CRYPTOKASINO – BTC Payment Watcher
// Sleduje příchozí platby a připisuje balance hráčům
// Spusťte: node watcher.js
// ════════════════════════════════════════════════════════

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// ════════════════════════════════════════
// ⚙️ CONFIG
// ════════════════════════════════════════
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CHECK_INTERVAL = 60 * 1000;      // Kontrola každých 60 sekund
const REQUIRED_CONFIRMATIONS = 1;       // 1 potvrzení stačí
const MIN_DEPOSIT = 0.001;              // Minimální vklad v BTC
const WELCOME_BONUS_PERCENT = 100;      // 100% welcome bonus
const WELCOME_BONUS_MAX = 1.0;          // Max bonus 1.0 BTC

// ════════════════════════════════════════
// 🔐 SUPABASE
// ════════════════════════════════════════
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ════════════════════════════════════════
// 🎨 CONSOLE COLORS
// ════════════════════════════════════════
const C = {
  reset:  '\x1b[0m',
  gold:   '\x1b[33m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  blue:   '\x1b[34m',
  dim:    '\x1b[2m',
  bold:   '\x1b[1m',
};

function log(msg, type = 'info') {
  const time = new Date().toTimeString().substring(0, 8);
  const colors = { info: C.blue, success: C.green, error: C.red, warn: C.gold, dim: C.dim };
  const color = colors[type] || C.reset;
  console.log(`${C.dim}[${time}]${C.reset} ${color}${msg}${C.reset}`);
}

function logBanner() {
  console.log('');
  console.log(`${C.gold}╔════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.gold}║   💎 CRYPTOKASINO – Payment Watcher    ║${C.reset}`);
  console.log(`${C.gold}║   🔍 Monitoring BTC deposits...        ║${C.reset}`);
  console.log(`${C.gold}╚════════════════════════════════════════╝${C.reset}`);
  console.log('');
}

// ════════════════════════════════════════
// 🌐 UTXO FETCH s fallback
// ════════════════════════════════════════
async function getUTXO(address) {
  const apis = [
    `https://blockstream.info/api/address/${address}/utxo`,
    `https://mempool.space/api/address/${address}/utxo`,
  ];
  for (const url of apis) {
    try {
      const r = await axios.get(url, { timeout: 8000 });
      return Array.isArray(r.data) ? r.data : [];
    } catch {
      continue;
    }
  }
  return [];
}

async function getTxInfo(txid) {
  const apis = [
    `https://blockstream.info/api/tx/${txid}`,
    `https://mempool.space/api/tx/${txid}`,
  ];
  for (const url of apis) {
    try {
      const r = await axios.get(url, { timeout: 8000 });
      return r.data;
    } catch {
      continue;
    }
  }
  return null;
}

// ════════════════════════════════════════
// 💰 PROCESS DEPOSIT
// ════════════════════════════════════════
async function processDeposit(userId, address, utxo, hdIndex) {
  const amountBtc = utxo.value / 1e8;

  log(`💰 Processing deposit: ${amountBtc} BTC for user ${userId.substring(0, 8)}...`, 'success');

  try {
    // Získej aktuální profil
    const { data: profile, error: profileErr } = await sb
      .from('profiles')
      .select('balance, total_deposited, welcome_bonus_claimed, username')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      log(`❌ Profile not found for ${userId}`, 'error');
      return false;
    }

    const currentBalance = parseFloat(profile.balance || 0);
    const currentDeposited = parseFloat(profile.total_deposited || 0);

    // Vypočítej bonus
    let bonusAmount = 0;
    if (!profile.welcome_bonus_claimed && amountBtc >= MIN_DEPOSIT) {
      bonusAmount = Math.min(amountBtc * (WELCOME_BONUS_PERCENT / 100), WELCOME_BONUS_MAX);
      log(`🎁 Welcome bonus: +${bonusAmount.toFixed(8)} BTC pro ${profile.username}`, 'gold');
    }

    const newBalance = currentBalance + amountBtc + bonusAmount;
    const newDeposited = currentDeposited + amountBtc;

    // Update profilu
    const updateData = {
      balance: newBalance,
      total_deposited: newDeposited,
    };
    if (bonusAmount > 0) updateData.welcome_bonus_claimed = true;

    const { error: updateErr } = await sb
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (updateErr) {
      log(`❌ Balance update error: ${updateErr.message}`, 'error');
      return false;
    }

    // Ulož deposit
    await sb.from('deposits').insert({
      user_id: userId,
      btc_address: address,
      amount_btc: amountBtc,
      txid: utxo.txid,
      confirmations: REQUIRED_CONFIRMATIONS,
      required_confirmations: REQUIRED_CONFIRMATIONS,
      status: 'confirmed',
      hd_index: hdIndex,
      confirmed_at: new Date().toISOString(),
    });

    // Log transakce – deposit
    await sb.from('transactions').insert({
      user_id: userId,
      type: 'deposit',
      amount: amountBtc,
      balance_before: currentBalance,
      balance_after: currentBalance + amountBtc + bonusAmount,
      description: `BTC deposit confirmed: ${utxo.txid.substring(0, 16)}...`,
    });

    // Log transakce – bonus
    if (bonusAmount > 0) {
      await sb.from('bonuses').insert({
        user_id: userId,
        bonus_type: 'welcome',
        amount: bonusAmount,
        wagering_requirement: 30,
        status: 'active',
      });

      await sb.from('transactions').insert({
        user_id: userId,
        type: 'bonus',
        amount: bonusAmount,
        balance_before: currentBalance + amountBtc,
        balance_after: newBalance,
        description: `Welcome bonus 100%: +${bonusAmount.toFixed(8)} BTC`,
      });
    }

    // Označ adresu jako použitou
    await sb
      .from('hd_wallet_addresses')
      .update({ is_used: true })
      .eq('address', address);

    log(`✅ Credited: ${amountBtc} BTC + ${bonusAmount} bonus → ${profile.username} (new balance: ${newBalance.toFixed(8)} BTC)`, 'success');
    return true;

  } catch (e) {
    log(`❌ processDeposit error: ${e.message}`, 'error');
    return false;
  }
}

// ════════════════════════════════════════
// 🔍 CHECK ONE ADDRESS
// ════════════════════════════════════════
async function checkAddress(addrRecord) {
  const { address, user_id, hd_index } = addrRecord;

  try {
    const utxos = await getUTXO(address);

    if (!utxos || utxos.length === 0) return;

    // Načti již zpracované txid pro tuto adresu
    const { data: existing } = await sb
      .from('deposits')
      .select('txid')
      .eq('btc_address', address)
      .eq('status', 'confirmed');

    const knownTxids = new Set((existing || []).map(d => d.txid));

    for (const utxo of utxos) {
      // Přeskočit již zpracované
      if (knownTxids.has(utxo.txid)) continue;

      // Zkontroluj potvrzení
      if (!utxo.status?.confirmed) {
        log(`⏳ Pending TX: ${utxo.txid.substring(0, 16)}... (${utxo.value / 1e8} BTC) – čeká na potvrzení`, 'warn');

        // Ulož jako pending do deposits
        const { data: pendingExists } = await sb
          .from('deposits')
          .select('id')
          .eq('txid', utxo.txid)
          .single();

        if (!pendingExists) {
          await sb.from('deposits').insert({
            user_id,
            btc_address: address,
            amount_btc: utxo.value / 1e8,
            txid: utxo.txid,
            confirmations: 0,
            required_confirmations: REQUIRED_CONFIRMATIONS,
            status: 'pending',
            hd_index,
          });
          log(`📝 Pending deposit uložen: ${utxo.value / 1e8} BTC`, 'info');
        }
        continue;
      }

      // Zkontroluj minimální výši
      const amountBtc = utxo.value / 1e8;
      if (amountBtc < MIN_DEPOSIT) {
        log(`⚠️ Příliš malý deposit: ${amountBtc} BTC (min: ${MIN_DEPOSIT} BTC)`, 'warn');
        continue;
      }

      // Zpracuj deposit!
      await processDeposit(user_id, address, utxo, hd_index);
    }

    // Zkontroluj pending deposits – možná se potvrdily
    const { data: pendingDeposits } = await sb
      .from('deposits')
      .select('*')
      .eq('btc_address', address)
      .eq('status', 'pending');

    for (const pd of (pendingDeposits || [])) {
      const confirmedUtxo = utxos.find(u => u.txid === pd.txid && u.status?.confirmed);
      if (confirmedUtxo) {
        log(`✅ Pending TX se potvrdila: ${pd.txid.substring(0, 16)}...`, 'success');
        await processDeposit(user_id, address, confirmedUtxo, hd_index);
        // Smaž pending záznam
        await sb.from('deposits').delete().eq('id', pd.id);
      }
    }

  } catch (e) {
    log(`❌ checkAddress error (${address.substring(0, 16)}...): ${e.message}`, 'error');
  }
}

// ════════════════════════════════════════
// 🔄 MAIN WATCH LOOP
// ════════════════════════════════════════
let isRunning = false;
let cycleCount = 0;

async function watchCycle() {
  if (isRunning) {
    log('⏭️ Předchozí cyklus stále běží, přeskakuji...', 'warn');
    return;
  }

  isRunning = true;
  cycleCount++;

  log(`\n🔄 Cycle #${cycleCount} – ${new Date().toLocaleTimeString('cs-CZ')}`, 'info');

  try {
    // Načti všechny aktivní adresy ze Supabase
    const { data: addresses, error } = await sb
      .from('hd_wallet_addresses')
      .select('*')
      .eq('coin', 'BTC')
      .not('user_id', 'is', null);

    if (error) {
      log(`❌ Supabase error: ${error.message}`, 'error');
      isRunning = false;
      return;
    }

    if (!addresses || addresses.length === 0) {
      log('📭 Žádné adresy ke sledování', 'dim');
      isRunning = false;
      return;
    }

    log(`📍 Kontroluji ${addresses.length} adres...`, 'info');

    // Kontroluj adresy s pauzou mezi nimi (anti-rate-limit)
    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];
      await checkAddress(addr);

      // Pauza 500ms mezi adresami
      if (i < addresses.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    log(`✅ Cycle #${cycleCount} dokončen`, 'success');

  } catch (e) {
    log(`❌ Watch cycle error: ${e.message}`, 'error');
  }

  isRunning = false;
}

// ════════════════════════════════════════
// 📊 STATUS REPORT (každých 10 cyklů)
// ════════════════════════════════════════
async function statusReport() {
  try {
    const { data: profiles } = await sb
      .from('profiles')
      .select('username, balance')
      .order('balance', { ascending: false })
      .limit(5);

    const { data: recentDeposits } = await sb
      .from('deposits')
      .select('amount_btc, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('');
    console.log(`${C.gold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
    console.log(`${C.gold}📊 STATUS REPORT${C.reset}`);
    console.log(`${C.gold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);

    console.log(`${C.blue}👥 Top Balances:${C.reset}`);
    (profiles || []).forEach(p => {
      console.log(`   ${p.username}: ${C.green}${parseFloat(p.balance).toFixed(8)} BTC${C.reset}`);
    });

    console.log(`${C.blue}💰 Recent Deposits:${C.reset}`);
    (recentDeposits || []).forEach(d => {
      const status = d.status === 'confirmed' ? `${C.green}✅` : `${C.gold}⏳`;
      console.log(`   ${status} ${d.amount_btc} BTC – ${new Date(d.created_at).toLocaleTimeString('cs-CZ')}${C.reset}`);
    });

    console.log(`${C.gold}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}`);
    console.log('');

  } catch (e) {
    log(`❌ Status report error: ${e.message}`, 'error');
  }
}

// ════════════════════════════════════════
// 🚀 START
// ════════════════════════════════════════
async function start() {
  logBanner();

  // Test Supabase připojení
  try {
    const { data, error } = await sb.from('profiles').select('id').limit(1);
    if (error) throw new Error(error.message);
    log('✅ Supabase connected', 'success');
  } catch (e) {
    log(`❌ Supabase connection failed: ${e.message}`, 'error');
    process.exit(1);
  }

  log(`⚙️  Check interval: ${CHECK_INTERVAL / 1000}s`, 'info');
  log(`⚙️  Required confirmations: ${REQUIRED_CONFIRMATIONS}`, 'info');
  log(`⚙️  Min deposit: ${MIN_DEPOSIT} BTC`, 'info');
  log(`⚙️  Welcome bonus: ${WELCOME_BONUS_PERCENT}% (max ${WELCOME_BONUS_MAX} BTC)`, 'info');
  console.log('');

  // První cyklus hned
  await watchCycle();

  // Pak každých 60 sekund
  setInterval(watchCycle, CHECK_INTERVAL);

  // Status report každých 10 minut
  setInterval(statusReport, 10 * 60 * 1000);

  log('👀 Watcher běží... (Ctrl+C pro zastavení)', 'success');
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  log('👋 Watcher zastaven', 'warn');
  process.exit(0);
});

process.on('uncaughtException', (e) => {
  log(`❌ Uncaught exception: ${e.message}`, 'error');
});

process.on('unhandledRejection', (e) => {
  log(`❌ Unhandled rejection: ${e.message}`, 'error');
});

start();