// functions/modules/chain.js
'use strict';

// No require('firebase-functions') here.
// Node 20+ has global fetch.

const WAX_API        = process.env.WAX_API        || 'https://wax.greymass.com';
const ATOMIC_API     = process.env.ATOMIC_API     || 'https://wax.api.atomicassets.io';
const TOKEN_CONTRACT = process.env.TOKEN_CONTRACT || 'eosio.token';

// Your token:
const TSDM_CONTRACT  = process.env.TSDM_CONTRACT  || 'lucas3333555';
const TSDM_SYMBOL    = process.env.TSDM_SYMBOL    || 'TSDM';

async function getCurrencyBalance(contract, account, symbol) {
  const r = await fetch(`${WAX_API}/v1/chain/get_currency_balance`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ code: contract, account, symbol }),
  });
  if (!r.ok) throw new Error(`get_currency_balance ${contract}:${symbol} ${r.status}`);
  const arr = await r.json();
  if (!Array.isArray(arr) || !arr[0]) return 0;
  const [amt] = arr[0].split(' ');
  return Number(amt || 0);
}

async function getWaxBalance(account)  { return getCurrencyBalance(TOKEN_CONTRACT, account, 'WAX'); }
async function getTsdmBalance(account) { return TSDM_CONTRACT ? getCurrencyBalance(TSDM_CONTRACT, account, TSDM_SYMBOL) : 0; }

async function getOwnedNfts(account, collection) {
  const u = new URL(`${ATOMIC_API}/atomicassets/v1/assets`);
  u.searchParams.set('owner', account);
  if (collection) u.searchParams.set('collection_name', collection);
  u.searchParams.set('page','1'); u.searchParams.set('limit','100');
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(`atomicassets assets ${r.status}`);
  const data = await r.json();
  return Array.isArray(data?.data) ? data.data : [];
}

module.exports = { getWaxBalance, getTsdmBalance, getOwnedNfts };
