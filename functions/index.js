// functions/index.js
const admin = require('firebase-admin');
try { admin.app(); } catch { admin.initializeApp(); }

const { onRequest } = require('firebase-functions/v2/https');

// Healthcheck so there’s always at least one function
const healthcheck = onRequest((req, res) => res.json({ ok: true }));

// Import modules
const players = require('./modules/players');
const cities  = require('./modules/cities');

// Export (avoid spread for max compatibility)
module.exports = Object.assign(
  { healthcheck },
  players,
  cities
);
