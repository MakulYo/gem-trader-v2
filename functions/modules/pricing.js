const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
try { admin.app(); } catch { admin.initializeApp(); }

const db = getFirestore(undefined, 'tsdgems'); // <-- IMPORTANT

const MARKET_DOC = 'game_config/gems';
const BOOSTS_COL = 'city_boosts'; // docs keyed by city id (nyc, ldn, ...)

const price_preview = onRequest(async (req, res) => {
  try {
    const city = (req.query.city || '').toLowerCase();       // e.g. 'nyc'
    const gem  = (req.query.gem  || '').toLowerCase();       // e.g. 'polished_opal'
    const amt  = Number(req.query.amount || 1);

    if (!city || !gem) return res.status(400).json({ ok:false, error:'city & gem required' });

    const [marketSnap, boostSnap] = await Promise.all([
      db.doc(MARKET_DOC).get(),
      db.doc(`${BOOSTS_COL}/${city}`).get()
    ]);
    if (!marketSnap.exists) return res.status(400).json({ ok:false, error:'market missing' });

    const m = marketSnap.data() || {};
    const gemRow = m[gem];
    if (!gemRow || typeof gemRow.current_price !== 'number') {
      return res.status(400).json({ ok:false, error:`gem ${gem} missing` });
    }

    const base = gemRow.current_price;
    const boostPct = (boostSnap.exists && boostSnap.data().bonuses?.[gem]) || 0; // e.g. 0.083
    const effUnit = Math.round(base * (1 + boostPct) * 1000) / 1000;
    const total   = Math.round(effUnit * amt * 1000) / 1000;

    res.set('Cache-Control', 'public, max-age=30');
    return res.json({
      ok: true,
      city, gem, amount: amt,
      base_price: base,
      city_boost_pct: boostPct,
      effective_unit: effUnit,
      total
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:e.message });
  }
});

module.exports = { price_preview };
