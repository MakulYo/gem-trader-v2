// functions/modules/chart.js
// Provides current base price and historical series for charts.

const { onRequest }  = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin          = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const corsLib        = require('cors');
const fetch          = (...a) => import('node-fetch').then(({default: f}) => f(...a));

const db = getFirestore(undefined, 'tsdgems');

// --- CORS allowlist ---
const RAW_ALLOW  = process.env.CORS_ALLOW || '';
const ALLOWLIST  = RAW_ALLOW.split(',').map(s => s.trim()).filter(Boolean);
const cors       = corsLib({ origin: ALLOWLIST.length ? ALLOWLIST : true, credentials: false });

const SEED_TOKEN = process.env.SEED_TOKEN || 'changeme-temp-token';

// --- Derivation rule: basePrice = 1% of BTC/USD
function deriveBasePrice(btcUsd) {
  return Number((btcUsd * 0.01).toFixed(2)); // 2 decimals is enough here
}

// --- Fetchers (CoinGecko) ---
async function fetchBtcNow() {
  const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';
  const r = await fetch(url, { headers: { 'accept': 'application/json' } });
  if (!r.ok) throw new Error(`coingecko-now ${r.status}`);
  const j = await r.json();
  const v = Number(j?.bitcoin?.usd);
  if (!isFinite(v)) throw new Error('bad btc usd');
  return v;
}

// days: 1, 7, 30, 90, 180, 365, 'max'; interval: 'hourly' or 'daily' (CG auto-picks)
async function fetchBtcHistory(days = 30) {
  const d = encodeURIComponent(days);
  const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${d}`;
  const r = await fetch(url, { headers: { 'accept': 'application/json' } });
  if (!r.ok) throw new Error(`coingecko-hist ${r.status}`);
  const j = await r.json();
  // j.prices is [ [ms, price], ... ]
  const arr = Array.isArray(j?.prices) ? j.prices : [];
  return arr.map(([ms, usd]) => ({
    t: Number(ms),                 // epoch ms
    btcUsd: Number(usd),
    basePrice: deriveBasePrice(Number(usd)),
  }));
}

// --- Lightweight cache (Firestore) to ease rate limits ---
// runtime/pricing:
//   { btcUsd, basePrice, updatedAt, source }
// runtime/pricing_history_{days}:
//   { days, points:[{t,btcUsd,basePrice}], updatedAt }
async function refreshNow() {
  const btcUsd = await fetchBtcNow();
  const base   = deriveBasePrice(btcUsd);
  await db.doc('runtime/pricing').set({
    btcUsd, basePrice: base, source: 'coingecko',
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { btcUsd, basePrice: base };
}

async function getOrRefreshHistory(days = 30) {
  const docId = `runtime/pricing_history_${days}`;
  const snap  = await db.doc(docId).get();
  const now   = Date.now();

  // Reuse cache if newer than 5 minutes
  if (snap.exists) {
    const data = snap.data() || {};
    const updatedAt = data.updatedAt?.toMillis?.() || 0;
    if (now - updatedAt < 5 * 60 * 1000 && Array.isArray(data.points)) {
      return { days, points: data.points };
    }
  }

  const points = await fetchBtcHistory(days);
  await db.doc(docId).set({
    days,
    points,
    updatedAt: FieldValue.serverTimestamp(),
    source: 'coingecko',
  }, { merge: true });

  return { days, points };
}

// --- HTTP Endpoints ---

// GET /getBasePrice   -> { basePrice, btcUsd, updatedAt, source }
const getBasePrice = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
    const snap = await db.doc('runtime/pricing').get();
    if (!snap.exists) {
      // cold start: refresh once
      const cur = await refreshNow();
      return res.json({ ...cur, updatedAt: null, source: 'coingecko' });
    }
    const data = snap.data() || {};
    res.json({
      basePrice: Number(data.basePrice || 0),
      btcUsd:    Number(data.btcUsd || 0),
      updatedAt: data.updatedAt || null,
      source:    data.source || 'unknown',
    });
  })
);

// POST /refreshBasePrice?token=… -> { ok, basePrice, btcUsd }
const refreshBasePrice = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    if ((req.query.token || '') !== SEED_TOKEN) return res.status(403).json({ error: 'Forbidden' });
    try {
      const out = await refreshNow();
      res.json({ ok: true, ...out });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  })
);

// GET /getChart?days=30 -> { days, points:[{t,btcUsd,basePrice}] }
const getChart = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
    const daysParam = req.query.days || 30;
    const days = String(daysParam).match(/^(1|7|14|30|90|180|365|max)$/) ? daysParam : 30;
    try {
      const out = await getOrRefreshHistory(days);
      res.json(out);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  })
);

// --- Scheduler (optional): keep current price warm every 5 minutes ---
const chartCron = onSchedule('every 5 minutes', async () => {
  try { await refreshNow(); } catch (e) { console.error('chart cron failed', e); }
});

// POST /chartTick?token=...  -> add one point to history_30
const chartTick = onRequest((req, res) =>
  cors(req, res, async () => {
    if ((req.query.token || '') !== SEED_TOKEN) return res.status(403).json({ error: 'Forbidden' });
    try {
      const snap = await db.doc('runtime/pricing').get();
      if (!snap.exists) throw new Error('pricing missing');
      const { btcUsd = 0, basePrice = 0 } = snap.data() || {};
      const now = Date.now();
      const histRef = db.doc('runtime/pricing_history_30');
      const hist = (await histRef.get()).data() || { points: [] };
      const points = Array.isArray(hist.points) ? hist.points : [];
      points.push({ t: now, btcUsd, basePrice });
      // keep only last 30 days (~43200 min)
      const cutoff = now - 30 * 24 * 60 * 60 * 1000;
      const filtered = points.filter(p => p.t >= cutoff);
      await histRef.set({
        days: 30,
        points: filtered,
        updatedAt: FieldValue.serverTimestamp(),
        source: 'cron',
      }, { merge: true });
      res.json({ ok: true, added: filtered.length });
    } catch (e) {
      console.error('chartTick', e);
      res.status(500).json({ error: e.message });
    }
  })
);

// Scheduler: extend history automatically every 5 minutes
const chartHistoryCron = onSchedule('every 5 minutes', async () => {
  try {
    const snap = await db.doc('runtime/pricing').get();
    if (!snap.exists) return;
    const { btcUsd = 0, basePrice = 0 } = snap.data() || {};
    const now = Date.now();
    const histRef = db.doc('runtime/pricing_history_30');
    const hist = (await histRef.get()).data() || { points: [] };
    const points = Array.isArray(hist.points) ? hist.points : [];
    points.push({ t: now, btcUsd, basePrice });
    const cutoff = now - 30 * 24 * 60 * 60 * 1000;
    const filtered = points.filter(p => p.t >= cutoff);
    await histRef.set({
      days: 30,
      points: filtered,
      updatedAt: FieldValue.serverTimestamp(),
      source: 'auto',
    }, { merge: true });
    console.log('chartHistoryCron tick ok', filtered.length);
  } catch (e) {
    console.error('chartHistoryCron failed', e);
  }
});


module.exports = {
  getBasePrice,
  refreshBasePrice,
  getChart,
  chartCron,
  chartTick,
  chartHistoryCron,
};
