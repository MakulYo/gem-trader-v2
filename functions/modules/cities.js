// functions/modules/cities.js
// CommonJS module for Firebase Functions v2

const { onRequest }  = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin          = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const corsLib        = require('cors');

// --- Config ---
const db = getFirestore();
const SEED_TOKEN = process.env.SEED_TOKEN || 'changeme-temp-token';

// CORS allowlist (env or functions config). Comma-separated list.
const RAW_ALLOW = process.env.CORS_ALLOW || (process.env.FUNCTIONS_CONFIG_CORS_ALLOW || '');
const ALLOWLIST = RAW_ALLOW.split(',').map(s => s.trim()).filter(Boolean);
const cors = corsLib({ origin: ALLOWLIST.length ? ALLOWLIST : true, credentials: false });

// --- Static city list (IDs must match your front-end choices) ---
const CITIES = [
  { id: 'mumbai',   name: 'Mumbai' },
  { id: 'zhecheng', name: 'Zhecheng' },
  { id: 'hongkong', name: 'Hong Kong' },
  { id: 'newyork',  name: 'New York' },
  { id: 'dubai',    name: 'Dubai' },
  { id: 'telaviv',  name: 'Tel Aviv' },
  { id: 'panama',   name: 'Panama' },
  { id: 'antwerpen',name: 'Antwerpen' },
  { id: 'london',   name: 'London' },
  { id: 'moscow',   name: 'Moscow' }
];

// Gem keys for the bonus matrix (polished types)
const GEM_KEYS = [
  'polished_amethyst','polished_topaz','polished_aquamarine','polished_opal',
  'polished_tanzanite','polished_jade','polished_emerald','polished_sapphire',
  'polished_ruby','polished_diamond',
];

// Helper: random bonus (0.01–0.10)
function rand(min = 0.01, max = 0.10) {
  return Math.round((Math.random() * (max - min) + min) * 1000) / 1000;
}

// Internal: write randomized city bonuses for all cities present in config
async function writeCityBonuses() {
  const snap = await db.doc('game_config/cities').get();
  const list = snap.exists ? (snap.data().list || []) : [];
  if (!list.length) return;

  const batch = db.batch();
  for (const { id } of list) {
    const bonuses = {};
    for (const k of GEM_KEYS) bonuses[k] = rand(0.01, 0.10);
    batch.set(
      db.doc(`city_boosts/${id}`),
      { bonuses, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }
  await batch.commit();
}

// --- Public endpoints ---

// GET /getCityMatrix
// Returns city list + current boosts (friendly for front-end)
const getCityMatrix = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

    const cfg = await db.doc('game_config/cities').get();
    const cities = cfg.exists ? (cfg.data().list || []) : [];

    const boosts = [];
    for (const c of cities) {
      const bdoc = await db.doc(`city_boosts/${c.id}`).get();
      boosts.push({
        id: c.id,
        bonuses: bdoc.exists ? (bdoc.data().bonuses || {}) : {}
      });
    }
    res.json({ cities, boosts });
  })
);

// POST /seedCities?token=…
const seedCities = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    if ((req.query.token || '') !== SEED_TOKEN) return res.status(403).json({ error: 'Forbidden' });

    await db.doc('game_config/cities').set(
      { list: CITIES, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    res.json({ ok: true, count: CITIES.length });
  })
);

// POST /seedBoostsInit?token=…
const seedBoostsInit = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    if ((req.query.token || '') !== SEED_TOKEN) return res.status(403).json({ error: 'Forbidden' });

    const batch = db.batch();
    for (const { id } of CITIES) {
      const bonuses = {};
      for (const g of GEM_KEYS) bonuses[g] = 0;
      batch.set(
        db.doc(`city_boosts/${id}`),
        { bonuses, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
    await batch.commit();
    res.json({ ok: true });
  })
);

// POST /updateBonusesNow?token=…
const updateBonusesNow = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    if ((req.query.token || '') !== SEED_TOKEN) return res.status(403).json({ error: 'Forbidden' });

    await writeCityBonuses();
    res.json({ ok: true });
  })
);

// Scheduler: rotate bonuses every 1 minute (adjust as needed)
const updateBonuses = onSchedule('every 1 minutes', async () => {
  await writeCityBonuses();
});

module.exports = {
  getCityMatrix,      // GET
  seedCities,         // POST + token
  seedBoostsInit,     // POST + token
  updateBonusesNow,   // POST + token
  updateBonuses,      // scheduled
};