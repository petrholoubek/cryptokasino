// ════════════════════════════════════════════════════════
// CRYPTOKASINO – HD Wallet Backend
// Node.js + Express + bitcoinjs-lib + Supabase
// ════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const bip39 = require('bip39');
const { BIP32Factory } = require('bip32');
const ecc = require('tiny-secp256k1');
const bitcoin = require('bitcoinjs-lib');
const { ECPairFactory } = require('ecpair');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ════════════════════════════════════════
// ⚙️ CONFIG
// ════════════════════════════════════════
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY || 'casino-secret-key';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ════════════════════════════════════════
// 🔐 SUPABASE
// ════════════════════════════════════════
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ════════════════════════════════════════
// 🔑 HD WALLET SETUP
// ════════════════════════════════════════
const SEED_PHRASE = process.env.SEED_PHRASE;

if (!SEED_PHRASE || !bip39.validateMnemonic(SEED_PHRASE)) {
  console.error('❌ Neplatný nebo chybějící SEED_PHRASE v .env!');
  process.exit(1);
}

const seed = bip39.mnemonicToSeedSync(SEED_PHRASE);
const root = bip32.fromSeed(seed, bitcoin.networks.bitcoin);

console.log('✅ HD Wallet inicializován');

// ════════════════════════════════════════
// 🔒 API KEY MIDDLEWARE
// ════════════════════════════════════════
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.key;
  if (key !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ════════════════════════════════════════
// 🔑 WALLET FUNKCE
// ════════════════════════════════════════
function getBTCAddress(index, change = false) {
  const path = `m/84'/0'/0'/${change ? 1 : 0}/${index}`;
  const child = root.derivePath(path);
  const keyPair = ECPair.fromPrivateKey(child.privateKey);
  const { address } = bitcoin.payments.p2wpkh({
    pubkey: keyPair.publicKey,
    network: bitcoin.networks.bitcoin
  });
  return { address, keyPair, path };
}

// ════════════════════════════════════════
// 🌐 UTXO FETCH (s fallback)
// ════════════════════════════════════════
async function getUTXO(address) {
  const urls = [
    `https://blockstream.info/api/address/${address}/utxo`,
    `https://mempool.space/api/address/${address}/utxo`
  ];
  for (const url of urls) {
    try {
      const r = await axios.get(url, { timeout: 8000 });
      return Array.isArray(r.data) ? r.data : [];
    } catch (e) {
      continue;
    }
  }
  return [];
}

async function getAddressBalance(address) {
  try {
    const utxos = await getUTXO(address);
    return utxos.reduce((sum, u) => sum + u.value, 0);
  } catch {
    return 0;
  }
}

async function getAddressTxs(address) {
  const urls = [
    `https://blockstream.info/api/address/${address}/txs`,
    `https://mempool.space/api/address/${address}/txs`
  ];
  for (const url of urls) {
    try {
      const r = await axios.get(url, { timeout: 8000 });
      return Array.isArray(r.data) ? r.data : [];
    } catch {
      continue;
    }
  }
  return [];
}

// ════════════════════════════════════════
// 📡 BROADCAST TX
// ════════════════════════════════════════
async function broadcastTx(txHex) {
  const apis = [
    'https://blockstream.info/api/tx',
    'https://mempool.space/api/tx'
  ];
  for (const api of apis) {
    try {
      const r = await axios.post(api, txHex, {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 10000
      });
      return r.data;
    } catch (e) {
      continue;
    }
  }
  throw new Error('Broadcast selhal na všech API');
}

// ════════════════════════════════════════
// 💾 PENDING TXS (pro RBF)
// ════════════════════════════════════════
const pendingTxs = {};

// ════════════════════════════════════════
// ════════════════════════════════════════
// 🎰 CASINO ENDPOINTY
// ════════════════════════════════════════
// ════════════════════════════════════════

// ── GET /casino/address/:userId ──────────
// Vrátí unikátní BTC adresu pro daného hráče
// Pokud neexistuje, vytvoří novou z HD indexu
app.get('/casino/address/:userId', requireApiKey, async (req, res) => {
  try {
    const { userId } = req.params;

    // Zkontroluj zda hráč již má adresu
    const { data: existing } = await sb
      .from('hd_wallet_addresses')
      .select('*')
      .eq('user_id', userId)
      .eq('coin', 'BTC')
      .order('hd_index', { ascending: true })
      .limit(1)
      .single();

    if (existing) {
      return res.json({
        address: existing.address,
        index: existing.hd_index,
        existing: true
      });
    }

    // Najdi další volný index
    const { data: lastAddr } = await sb
      .from('hd_wallet_addresses')
      .select('hd_index')
      .order('hd_index', { ascending: false })
      .limit(1)
      .single();

    const nextIndex = lastAddr ? lastAddr.hd_index + 1 : 0;
    const { address } = getBTCAddress(nextIndex);

    // Ulož do Supabase
    await sb.from('hd_wallet_addresses').insert({
      user_id: userId,
      address,
      hd_index: nextIndex,
      coin: 'BTC',
      is_used: false
    });

    console.log(`✅ Nová adresa pro ${userId}: ${address} (index ${nextIndex})`);

    res.json({ address, index: nextIndex, existing: false });

  } catch (e) {
    console.error('❌ /casino/address error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /casino/balance/:address ─────────
// Vrátí BTC zůstatek adresy v satoshi i BTC
app.get('/casino/balance/:address', requireApiKey, async (req, res) => {
  try {
    const { address } = req.params;
    const satoshi = await getAddressBalance(address);
    res.json({
      address,
      satoshi,
      btc: (satoshi / 1e8).toFixed(8)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /casino/deposit/check ───────────
// Zkontroluje příchozí platbu a připíše balance hráči
app.post('/casino/deposit/check', requireApiKey, async (req, res) => {
  try {
    const { userId, address } = req.body;

    const utxos = await getUTXO(address);

    if (!utxos || utxos.length === 0) {
      return res.json({ status: 'no_funds', confirmed: false });
    }

    // Načti existující deposits pro tuto adresu
    const { data: existingDeposits } = await sb
      .from('deposits')
      .select('txid')
      .eq('user_id', userId)
      .eq('btc_address', address)
      .eq('status', 'confirmed');

    const confirmedTxids = new Set((existingDeposits || []).map(d => d.txid));

    let newTotal = 0;
    const newDeposits = [];

    for (const utxo of utxos) {
      // Přeskočit již zpracované
      if (confirmedTxids.has(utxo.txid)) continue;

      // Zkontroluj konfirmace
      if (!utxo.status?.confirmed) continue;

      newTotal += utxo.value;
      newDeposits.push(utxo);
    }

    if (newDeposits.length === 0) {
      // Jsou UTXO ale čekají na potvrzení
      const pendingUtxos = utxos.filter(u => !u.status?.confirmed);
      return res.json({
        status: pendingUtxos.length > 0 ? 'pending' : 'already_processed',
        confirmed: false,
        pendingCount: pendingUtxos.length
      });
    }

    // Připiš balance hráči
    const btcAmount = newTotal / 1e8;

    // Získej aktuální balance
    const { data: profile } = await sb
      .from('profiles')
      .select('balance')
      .eq('id', userId)
      .single();

    const currentBalance = parseFloat(profile?.balance || 0);
    const newBalance = currentBalance + btcAmount;

    // Update balance
    await sb
      .from('profiles')
      .update({
        balance: newBalance,
        total_deposited: sb.rpc('increment', { x: btcAmount })
      })
      .eq('id', userId);

    // Ulož deposit záznamy
    for (const utxo of newDeposits) {
      // Najdi HD index pro tuto adresu
      const { data: addrData } = await sb
        .from('hd_wallet_addresses')
        .select('hd_index')
        .eq('address', address)
        .single();

      await sb.from('deposits').insert({
        user_id: userId,
        btc_address: address,
        amount_btc: utxo.value / 1e8,
        txid: utxo.txid,
        confirmations: 1,
        required_confirmations: 1,
        status: 'confirmed',
        hd_index: addrData?.hd_index || 0,
        confirmed_at: new Date().toISOString()
      });

      // Log transakce
      await sb.from('transactions').insert({
        user_id: userId,
        type: 'deposit',
        amount: utxo.value / 1e8,
        balance_before: currentBalance,
        balance_after: newBalance,
        description: `BTC deposit: ${utxo.txid.substring(0, 16)}...`,
        reference_id: null
      });

      // Označ adresu jako použitou
      await sb
        .from('hd_wallet_addresses')
        .update({ is_used: true })
        .eq('address', address);
    }

    console.log(`💰 Deposit: ${btcAmount} BTC pro ${userId}`);

    res.json({
      status: 'credited',
      confirmed: true,
      amount_btc: btcAmount,
      amount_satoshi: newTotal,
      new_balance: newBalance,
      deposits: newDeposits.length
    });

  } catch (e) {
    console.error('❌ deposit/check error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /casino/withdraw ─────────────────
// Zpracuje výběr BTC hráči
app.post('/casino/withdraw', requireApiKey, async (req, res) => {
  try {
    const { userId, toAddress, amountBtc, feeRate } = req.body;

    if (!userId || !toAddress || !amountBtc) {
      return res.status(400).json({ error: 'Chybí parametry' });
    }

    const rate = feeRate || 5;
    const amountSat = Math.floor(amountBtc * 1e8);
    const feeSat = 5000; // fixní fee ~0.00005 BTC

    // Zkontroluj balance hráče
    const { data: profile } = await sb
      .from('profiles')
      .select('balance')
      .eq('id', userId)
      .single();

    const balance = parseFloat(profile?.balance || 0);
    const totalNeeded = (amountSat + feeSat) / 1e8;

    if (balance < totalNeeded) {
      return res.status(400).json({
        error: 'Nedostatečný zůstatek',
        balance,
        needed: totalNeeded
      });
    }

    // Validace BTC adresy
    try {
      bitcoin.address.toOutputScript(toAddress, bitcoin.networks.bitcoin);
    } catch {
      return res.status(400).json({ error: 'Neplatná BTC adresa' });
    }

    // Najdi UTXO z casino wallet (scan prvních 50 adres)
    let allUtxos = [];
    for (let i = 0; i < 50; i++) {
      const { address, keyPair } = getBTCAddress(i);
      await new Promise(r => setTimeout(r, 300));
      const utxos = await getUTXO(address);
      if (utxos.length > 0) {
        utxos.forEach(u => allUtxos.push({ ...u, keyPair, address }));
      }
      if (allUtxos.reduce((s, u) => s + u.value, 0) >= amountSat + feeSat) break;
    }

    if (allUtxos.length === 0) {
      return res.status(400).json({ error: 'Casino wallet nemá prostředky' });
    }

    // Vyber UTXO
    allUtxos.sort((a, b) => b.value - a.value);
    let selected = [], total = 0;
    for (const u of allUtxos) {
      selected.push(u);
      total += u.value;
      if (total >= amountSat + feeSat) break;
    }

    if (total < amountSat + feeSat) {
      return res.status(400).json({ error: 'Nedostatek prostředků v casino wallet' });
    }

    // Sestav transakci
    const psbt = new bitcoin.Psbt({ network: bitcoin.networks.bitcoin });

    selected.forEach(u => {
      const payment = bitcoin.payments.p2wpkh({
        pubkey: u.keyPair.publicKey,
        network: bitcoin.networks.bitcoin
      });
      psbt.addInput({
        hash: u.txid,
        index: u.vout,
        witnessUtxo: { script: payment.output, value: BigInt(u.value) },
        sequence: 0xfffffffe
      });
    });

    // Output – hráč dostane
    psbt.addOutput({ address: toAddress, value: BigInt(amountSat) });

    // Change zpět do casino wallet
    const change = total - amountSat - feeSat;
    if (change > 546) {
      const { address: changeAddr } = getBTCAddress(0, true);
      psbt.addOutput({ address: changeAddr, value: BigInt(change) });
    }

    // Podpis
    selected.forEach((u, i) => psbt.signInput(i, u.keyPair));
    psbt.finalizeAllInputs();

    const txHex = psbt.extractTransaction().toHex();
    const txid = await broadcastTx(txHex);

    // Odečti balance hráči
    const newBalance = balance - totalNeeded;
    await sb.from('profiles')
      .update({ balance: newBalance, total_withdrawn: sb.rpc('increment', { x: amountBtc }) })
      .eq('id', userId);

    // Ulož withdrawal
    await sb.from('withdrawals').insert({
      user_id: userId,
      btc_address: toAddress,
      amount_btc: amountBtc,
      fee_btc: feeSat / 1e8,
      txid,
      status: 'sent',
      processed_at: new Date().toISOString()
    });

    // Log transakce
    await sb.from('transactions').insert({
      user_id: userId,
      type: 'withdrawal',
      amount: -amountBtc,
      balance_before: balance,
      balance_after: newBalance,
      description: `Withdrawal: ${txid.substring(0, 16)}...`
    });

    console.log(`💸 Withdrawal: ${amountBtc} BTC pro ${userId} → ${toAddress}`);

    res.json({
      ok: true,
      txid,
      amount_btc: amountBtc,
      fee_btc: feeSat / 1e8,
      new_balance: newBalance
    });

  } catch (e) {
    console.error('❌ withdraw error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
// 🔧 ADMIN ENDPOINTY
// ════════════════════════════════════════

// Scan všech adres a jejich zůstatků
app.get('/admin/scan', requireApiKey, async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 20;
    const results = [];
    let totalSat = 0;

    for (let i = 0; i < count; i++) {
      const { address } = getBTCAddress(i);
      await new Promise(r => setTimeout(r, 400));
      const utxos = await getUTXO(address);
      const sat = utxos.reduce((s, u) => s + u.value, 0);
      if (sat > 0 || i < 5) {
        results.push({ index: i, address, satoshi: sat, btc: (sat / 1e8).toFixed(8), utxos: utxos.length });
        totalSat += sat;
      }
    }

    res.json({
      addresses: results,
      total_satoshi: totalSat,
      total_btc: (totalSat / 1e8).toFixed(8)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Seznam všech adres
app.get('/admin/addresses', requireApiKey, async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 50;
    const addresses = [];
    for (let i = 0; i < count; i++) {
      const { address, path } = getBTCAddress(i);
      addresses.push({ index: i, address, path });
    }
    res.json(addresses);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Fee doporučení
app.get('/admin/fees', requireApiKey, async (req, res) => {
  try {
    const r = await axios.get('https://mempool.space/api/v1/fees/recommended', { timeout: 5000 });
    res.json(r.data);
  } catch (e) {
    res.json({ fastestFee: 10, halfHourFee: 5, hourFee: 3, economyFee: 2, minimumFee: 1 });
  }
});

// Statistiky casino wallet
app.get('/admin/stats', requireApiKey, async (req, res) => {
  try {
    const { data: deposits } = await sb.from('deposits').select('amount_btc').eq('status', 'confirmed');
    const { data: withdrawals } = await sb.from('withdrawals').select('amount_btc').eq('status', 'sent');
    const { data: users } = await sb.from('profiles').select('id, balance, username');

    const totalDeposited = deposits?.reduce((s, d) => s + parseFloat(d.amount_btc), 0) || 0;
    const totalWithdrawn = withdrawals?.reduce((s, w) => s + parseFloat(w.amount_btc), 0) || 0;
    const totalBalance = users?.reduce((s, u) => s + parseFloat(u.balance), 0) || 0;

    res.json({
      total_deposited_btc: totalDeposited.toFixed(8),
      total_withdrawn_btc: totalWithdrawn.toFixed(8),
      total_user_balance_btc: totalBalance.toFixed(8),
      house_profit_btc: (totalDeposited - totalWithdrawn - totalBalance).toFixed(8),
      user_count: users?.length || 0
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Seznam uživatelů
app.get('/admin/users', requireApiKey, async (req, res) => {
  try {
    const { data } = await sb
      .from('profiles')
      .select('id, username, email, balance, vip_level, total_deposited, total_withdrawn, created_at')
      .order('balance', { ascending: false });
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Manuální úprava balance
app.post('/admin/balance/adjust', requireApiKey, async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;
    const { data: profile } = await sb.from('profiles').select('balance').eq('id', userId).single();
    const newBalance = parseFloat(profile.balance) + parseFloat(amount);
    await sb.from('profiles').update({ balance: newBalance }).eq('id', userId);
    await sb.from('transactions').insert({
      user_id: userId,
      type: 'adjustment',
      amount: parseFloat(amount),
      balance_before: parseFloat(profile.balance),
      balance_after: newBalance,
      description: reason || 'Manual adjustment'
    });
    res.json({ ok: true, new_balance: newBalance });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Sweep – přesun všech prostředků na jednu adresu
app.post('/admin/sweep', requireApiKey, async (req, res) => {
  try {
    const { to, feeRate } = req.body;
    const rate = feeRate || 5;

    bitcoin.address.toOutputScript(to, bitcoin.networks.bitcoin);

    let allUtxos = [];
    for (let i = 0; i < 30; i++) {
      const { address, keyPair } = getBTCAddress(i);
      await new Promise(r => setTimeout(r, 400));
      const utxos = await getUTXO(address);
      utxos.forEach(u => allUtxos.push({ ...u, keyPair }));
    }

    if (!allUtxos.length) return res.status(400).json({ error: 'Žádné prostředky' });

    const total = allUtxos.reduce((s, u) => s + u.value, 0);
    const size = allUtxos.length * 68 + 31 + 10;
    const fee = rate * size;
    const sendValue = total - fee;

    if (sendValue < 546) return res.status(400).json({ error: 'Příliš malá částka' });

    const psbt = new bitcoin.Psbt({ network: bitcoin.networks.bitcoin });
    allUtxos.forEach(u => {
      const payment = bitcoin.payments.p2wpkh({ pubkey: u.keyPair.publicKey, network: bitcoin.networks.bitcoin });
      psbt.addInput({ hash: u.txid, index: u.vout, witnessUtxo: { script: payment.output, value: BigInt(u.value) }, sequence: 0xfffffffe });
    });
    psbt.addOutput({ address: to, value: BigInt(sendValue) });
    allUtxos.forEach((u, i) => psbt.signInput(i, u.keyPair));
    psbt.finalizeAllInputs();

    const txHex = psbt.extractTransaction().toHex();
    const txid = await broadcastTx(txHex);

    res.json({ ok: true, txid, total_btc: (total / 1e8).toFixed(8), fee_btc: (fee / 1e8).toFixed(8), sent_btc: (sendValue / 1e8).toFixed(8) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════
// 🏥 HEALTH CHECK
// ════════════════════════════════════════
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'CryptoKasino HD Wallet',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ════════════════════════════════════════
// 🚀 START
// ════════════════════════════════════════
app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════╗');
  console.log('║   💎 CRYPTOKASINO HD WALLET        ║');
  console.log('║   🚀 Server běží na portu ' + PORT + '     ║');
  console.log('╚════════════════════════════════════╝');
  console.log('');
  console.log('📡 Endpointy:');
  console.log('  GET  /casino/address/:userId');
  console.log('  GET  /casino/balance/:address');
  console.log('  POST /casino/deposit/check');
  console.log('  POST /casino/withdraw');
  console.log('  GET  /admin/scan');
  console.log('  GET  /admin/stats');
  console.log('  GET  /admin/users');
  console.log('  POST /admin/sweep');
  console.log('');
});