const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
try { admin.app(); } catch { admin.initializeApp(); }
const initPlayer = onRequest((req, res) =>
  cors(req, res, async () => {
    // your logic here
  })
);

const db = getFirestore(undefined, 'tsdgems'); // <-- IMPORTANT


const SEED_TOKEN = process.env.SEED_TOKEN || 'changeme-temp-token';

const CITIES = [
  { id: 'mum', name: 'Mumbai' }, { id: 'zhe', name: 'Zhecheng' },
  { id: 'hkg', name: 'Hong Kong' }, { id: 'nyc', name: 'New York' },
  { id: 'dub', name: 'Dubai' }, { id: 'tlv', name: 'Tel Aviv' },
  { id: 'pnm', name: 'Panama' }, { id: 'ant', name: 'Antwerp' },
  { id: 'ldn', name: 'London' }, { id: 'mos', name: 'Moscow' },
];

const GEM_KEYS = [
  'polished_amethyst','polished_topaz','polished_aquamarine','polished_opal',
  'polished_tanzanite','polished_jade','polished_emerald','polished_sapphire',
  'polished_ruby','polished_diamond',
];

function rand(min = 0.01, max = 0.10) {
  return Math.round((Math.random() * (max - min) + min) * 1000) / 1000;
}

async function writeCityBonuses() {
  const snap = await db.doc('game_config/cities').get();
  const list = snap.exists ? (snap.data().list || []) : [];
  if (!list.length) return;
  const batch = db.batch();
  for (const { id } of list) {
    const bonuses = {};
    for (const k of GEM_KEYS) bonuses[k] = rand(0.01, 0.10);
    batch.set(db.doc(`city_boosts/${id}`), {
      bonuses,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
}

const city_seedCities = onRequest(async (req, res) => {
  if ((req.query.token || '') !== SEED_TOKEN) return res.status(403).send('Forbidden');
  await db.doc('game_config/cities').set({
    list: CITIES,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  res.json({ ok: true, count: CITIES.length });
});

const city_seedBoostsInit = onRequest(async (req, res) => {
  if ((req.query.token || '') !== SEED_TOKEN) return res.status(403).send('Forbidden');
  const batch = db.batch();
  for (const { id } of CITIES) {
    const bonuses = {};
    for (const g of GEM_KEYS) bonuses[g] = 0;
    batch.set(db.doc(`city_boosts/${id}`), {
      bonuses,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();
  res.json({ ok: true });
});

const city_updateBonuses = onSchedule('every 1 minutes', async () => {
  await writeCityBonuses();
});

const city_updateBonusesNow = onRequest(async (req, res) => {
  if ((req.query.token || '') !== SEED_TOKEN) return res.status(403).send('Forbidden');
  await writeCityBonuses();
  res.json({ ok: true });
});

module.exports = {
  city_seedCities,
  city_seedBoostsInit,
  city_updateBonuses,
  city_updateBonusesNow,
};
