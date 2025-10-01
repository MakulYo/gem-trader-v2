// functions/index.js
const admin = require('firebase-admin');
try { admin.app(); } catch { admin.initializeApp(); }

const { onRequest } = require('firebase-functions/v2/https');

// tiny sanity endpoint so deploys always have at least one fn
const healthcheck = onRequest((req, res) => res.json({ ok: true }));

// import our modules (each exports an object of functions)
const cities   = require('./modules/cities');
const gems     = require('./modules/gems');
const market   = require('./modules/market');
const snapshot = require('./modules/snapshot');
const pricing  = require('./modules/pricing');
const players  = require('./modules/players');


// Avoid object spread — use Object.assign for max compatibility
module.exports = Object.assign(
  { healthcheck },
  cities,
  gems,
  market,
  snapshot,
  pricing,
  players
);
