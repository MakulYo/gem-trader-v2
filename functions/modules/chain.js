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

// New payment verification functions
async function getTransactionHistory(account, limit = 50) {
  const r = await fetch(`${WAX_API}/v1/history/get_actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account_name: account,
      pos: -1,
      offset: -limit
    })
  });
  if (!r.ok) throw new Error(`get_actions ${r.status}`);
  const data = await r.json();
  return Array.isArray(data?.actions) ? data.actions : [];
}

async function verifyTsdmTransfer(from, to, amount, memo, timeWindowMs = 10 * 60 * 1000) {
  try {
    console.log(`[verifyTsdmTransfer] Checking transfer: from=${from}, to=${to}, amount=${amount}, memo=${memo}`);
    const now = Date.now();
    const actions = await getTransactionHistory(to, 100);
    
    console.log(`[verifyTsdmTransfer] Found ${actions.length} actions for ${to}`);
    
    for (const action of actions) {
      const actAccount = action.action_trace?.act?.account;
      const actName = action.action_trace?.act?.name;
      const data = action.action_trace?.act?.data;
      
      // Log TSDM transfers for debugging
      if (actAccount === TSDM_CONTRACT && actName === 'transfer') {
        console.log(`[verifyTsdmTransfer] TSDM Transfer found: from=${data?.from}, to=${data?.to}, amount=${data?.quantity}, memo=${data?.memo}`);
      }
      
      if (actAccount !== TSDM_CONTRACT) continue;
      if (actName !== 'transfer') continue;
      if (!data) continue;
      
      // Check if this is the transfer we're looking for
      const transferAmount = parseFloat(data.quantity.split(' ')[0]);
      const actionTime = new Date(action.block_time).getTime();
      const isWithinWindow = now - actionTime <= timeWindowMs;
      
      console.log(`[verifyTsdmTransfer] Comparing: from=${data.from}===${from}, to=${data.to}===${to}, amount=${transferAmount}===${amount}, memo=${data.memo}===${memo}, withinWindow=${isWithinWindow}`);
      
      if (data.from === from && 
          data.to === to && 
          data.memo === memo &&
          transferAmount === amount &&
          isWithinWindow) {
        
        console.log(`[verifyTsdmTransfer] ✅ Transfer verified! txId=${action.action_trace?.trx_id}`);
        return {
          verified: true,
          txId: action.action_trace?.trx_id,
          blockTime: action.block_time,
          amount: transferAmount
        };
      }
    }
    
    console.log('[verifyTsdmTransfer] ❌ Transfer not found');
    return { verified: false };
  } catch (error) {
    console.error('[verifyTsdmTransfer] Error:', error);
    return { verified: false, error: error.message };
  }
}

module.exports = { 
  getWaxBalance, 
  getTsdmBalance, 
  getOwnedNfts,
  getTransactionHistory,
  verifyTsdmTransfer
};
