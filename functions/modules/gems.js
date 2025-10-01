const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
try { admin.app(); } catch { admin.initializeApp(); }
const db = getFirestore(undefined, 'tsdgems'); // <-- IMPORTANT
const SEED_TOKEN = process.env.SEED_TOKEN || 'changeme-temp-token';

const city_seedGems = onRequest(async (req, res) => {
  if ((req.query.token || '') !== SEED_TOKEN) return res.status(403).send('Forbidden');
  await db.doc('game_config/gems').set({
    polished_amethyst:   { base_price: 150,  current_price: 150 },
    polished_topaz:      { base_price: 180,  current_price: 180 },
    polished_aquamarine: { base_price: 200,  current_price: 200 },
    polished_opal:       { base_price: 600,  current_price: 600 },
    polished_tanzanite:  { base_price: 250,  current_price: 250 },
    polished_jade:       { base_price: 330,  current_price: 330 },
    polished_emerald:    { base_price: 712,  current_price: 712 },
    polished_sapphire:   { base_price: 460,  current_price: 460 },
    polished_ruby:       { base_price: 495,  current_price: 495 },
    polished_diamond:    { base_price: 1152, current_price: 1152 },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: false });
  res.json({ ok: true });
});

module.exports = { city_seedGems };
