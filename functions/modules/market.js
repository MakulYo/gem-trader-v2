const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
try { admin.app(); } catch { admin.initializeApp(); }

const db = getFirestore(undefined, 'tsdgems'); // <-- IMPORTANT

const SEED_TOKEN = process.env.SEED_TOKEN || 'changeme-temp-token';

async function fetchBtcUsd() {
  const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
  if (!res.ok) throw new Error(`BTC API ${res.status}`);
  const json = await res.json();
  const usd = json?.bitcoin?.usd;
  if (typeof usd !== 'number') throw new Error('BTC price missing');
  return usd;
}

async function writeMarketFromBtc() {
  const btc = await fetchBtcUsd();
  const base = Number((btc / 100).toFixed(3));
  const ref = db.doc('game_config/gems');
  const snap = await ref.get();
  if (!snap.exists) throw new Error('game_config/gems not found');
  const data = snap.data();
  const update = {};
  for (const k of Object.keys(data)) {
    if (k.startsWith('polished_')) update[`${k}.current_price`] = base;
  }
  update.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  await ref.update(update);
  return { btc, base };
}

const market_updateFromBtc = onSchedule('every 1 minutes', async () => {
  await writeMarketFromBtc();
});

const market_updateNow = onRequest(async (req, res) => {
  if ((req.query.token || '') !== SEED_TOKEN) return res.status(403).send('Forbidden');
  try {
    const r = await writeMarketFromBtc();
    res.json({ ok: true, ...r });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = { market_updateFromBtc, market_updateNow };
