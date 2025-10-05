// functions/modules/players.js

const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

try { admin.app(); } catch { admin.initializeApp(); }
const db = getFirestore(undefined, 'tsdgems');   // named DB

function monthKey(d = new Date()) {
  return d.toISOString().slice(0, 7).replace('-', ''); // YYYYMM
}

function requireActor(req, res) {
  const { actor } = req.method === 'GET' ? req.query : (req.body || {});
  if (!actor || typeof actor !== 'string') {
    res.status(400).json({ error: 'actor required' });
    return null;
  }
  return actor;
}

// Allow all origins during dev (change to array of origins later)
const CORS_OPT = { cors: true, region: 'us-central1' };

// POST /initPlayer
const initPlayer = onRequest(CORS_OPT, async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();   // (defensive)
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const actor = requireActor(req, res); if (!actor) return;

  const now = admin.firestore.Timestamp.now();
  const playerRef = db.collection('players').doc(actor);
  const snap = await playerRef.get();

  if (!snap.exists) {
    await playerRef.set({
      account: actor,
      createdAt: now,
      lastSeenAt: now,
      ingameCurrency: 0,
      tsdmBalance: 0,
      miningSlotsUnlocked: 0,
      polishingSlotsUnlocked: 0,
      monthlyScore: 0,
      flags: {}
    });
  } else {
    await playerRef.update({ lastSeenAt: now });
  }

  const month = monthKey();
  await db.collection('leaderboard_monthly').doc(month)
    .collection('entries').doc(actor)
    .set({ account: actor, score: (snap.data()?.monthlyScore ?? 0), updatedAt: now }, { merge: true });

  const fresh = await playerRef.get();
  res.json({ ok: true, profile: { id: fresh.id, ...fresh.data() } });
});

// GET /getDashboard?actor=<name>
const getDashboard = onRequest(CORS_OPT, async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();   // (defensive)
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const actor = requireActor(req, res); if (!actor) return;

  const ref = db.collection('players').doc(actor);
  const snap = await ref.get();
  if (!snap.exists) return res.json({ profile: null, inventory: [] });

  const invSnap = await ref.collection('inventory').limit(250).get();
  const inventory = invSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  res.json({ profile: { id: snap.id, ...snap.data() }, inventory });
});

module.exports = { initPlayer, getDashboard };
