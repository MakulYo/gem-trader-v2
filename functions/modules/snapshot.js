const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
try { admin.app(); } catch { admin.initializeApp(); }

const db = getFirestore(undefined, 'tsdgems'); // <-- IMPORTANT
const initPlayer = onRequest((req, res) =>
  cors(req, res, async () => {
    // your logic here
  })
);

const city_publicSnapshot = onRequest(async (req, res) => {
  try {
    const citiesSnap = await db.doc('game_config/cities').get();
    const cities = citiesSnap.exists ? (citiesSnap.data().list || []) : [];

    const gemsSnap = await db.doc('game_config/gems').get();
    const gems = gemsSnap.exists ? gemsSnap.data() : {};

    const boosts = {};
    const boostSnaps = await Promise.all(
      cities.map(c => db.doc(`city_boosts/${c.id}`).get())
    );
    boostSnaps.forEach((s, i) => {
      boosts[cities[i].id] = s.exists ? (s.data().bonuses || {}) : {};
    });

    res.set('Cache-Control', 'public, max-age=30');
    res.json({ cities, gems, boosts });
  } catch (e) {
    console.error('city_publicSnapshot error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = { city_publicSnapshot };
