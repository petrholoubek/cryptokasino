// Spusťte: node generate-addresses.js
// Vygeneruje adresy z xpub a vypíše je jako JS pole

const { BIP32Factory } = require('bip32');
const ecc = require('tiny-secp256k1');
const bitcoin = require('bitcoinjs-lib');
const bip32 = BIP32Factory(ecc);

const XPUB = 'xpub6CgGgyk6cVjpLkXj7zpLYhPQ44wPHSUmtwTvoDZ8jxWkuBRaqHWYtd77LmnEjDcqArcANBM3y6yv4GW1XkdZp81VH26BKNqNawBArsqsqYJ';

const node = bip32.fromBase58(XPUB);
const addresses = [];

for(let i = 0; i < 500; i++){
  const child = node.derive(0).derive(i);
  const { address } = bitcoin.payments.p2wpkh({
    pubkey: child.publicKey,
    network: bitcoin.networks.bitcoin
  });
  addresses.push(address);
}

console.log('const XPUB_ADDRESSES = ' + JSON.stringify(addresses, null, 0) + ';');
console.log('\nCelkem adres:', addresses.length);
console.log('První adresa:', addresses[0]);
console.log('Poslední adresa:', addresses[addresses.length-1]);