const admin = require('firebase-admin');
try { admin.app(); } catch { admin.initializeApp(); }

const { onRequest } = require('firebase-functions/v2/https');
const healthcheck = onRequest((req, res) => res.json({ ok: true }));

const players       = require('./modules/players');
const cities        = require('./modules/cities');
const chart         = require('./modules/chart');
const inventory     = require('./modules/inventory');
const mining        = require('./modules/mining');
const polishing     = require('./modules/polishing');
const payments      = require('./modules/payments');
const staking       = require('./modules/staking');
const trading       = require('./modules/trading');
const leaderboard   = require('./modules/leaderboard');
const seasonsModule = require('./modules/seasons');
const liveAggregator = require('./modules/live-aggregator');
const triggers = require('./triggers');

module.exports = {
  healthcheck,
  ...players,
  ...cities,
  ...chart,
  ...inventory,
  ...mining,
  ...polishing,
  ...payments,
  ...staking,
  ...trading,
  ...leaderboard,
  ...seasonsModule,
  ...liveAggregator,
  ...triggers,
};
