// functions/index.js
const admin = require('firebase-admin');
try { admin.app(); } catch { admin.initializeApp(); }

const { onRequest } = require('firebase-functions/v2/https');
const healthcheck = onRequest((req, res) => res.json({ ok: true }));

const players = require('./modules/players');
// (cities later once we confirm deploy is green)

module.exports = Object.assign(
  { healthcheck },
  players
);
