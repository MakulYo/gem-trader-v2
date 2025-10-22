// functions/modules/leaderboard.js
// Monthly leaderboard powered by Firestore (backend-side).
// - Current (runtime) leaderboard is rebuilt on demand or by cron.
// - On season rollover, snapshot Top N to /leaderboard_seasons/{YYYYMM}.
// - Frontend calls GET /getLeaderboard?limit=100&actor=...&season=current|YYYYMM

const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const corsLib = require('cors');

const db = getFirestore(undefined, 'tsdgems');

// CORS same style as your other modules
const RAW_ALLOW  = process.env.CORS_ALLOW || '';
const ALLOWLIST  = RAW_ALLOW.split(',').map(s => s.trim()).filter(Boolean);
const cors       = corsLib({ origin: ALLOWLIST.length ? ALLOWLIST : true, credentials: false });

const SEED_TOKEN = process.env.SEED_TOKEN || 'changeme-temp-token';
const TOP_LIMIT_DEFAULT = 100;

// Helpers
function monthKey(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  return `${y}${m}`; // e.g., 202510
}
function requireActorOptional(req) {
  return (req.method === 'GET' ? (req.query.actor || '') : (req.body?.actor || '')).toString() || null;
}
function toNumber(n, def = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : def;
}

// ------- Core builders -------

// Compute current leaderboard from players/{actor}.ingameCurrency (descending).
// Writes to runtime/leaderboard_current: { topPlayers:[...], lastUpdated, season:YYYYMM }
async function rebuildLeaderboard(topLimit = TOP_LIMIT_DEFAULT) {
  const season = monthKey();
  const snap = await db.collection('players')
    .orderBy('ingameCurrency', 'desc')
    .limit(topLimit)
    .get();

  const topPlayers = snap.docs.map((d, i) => {
    const data = d.data() || {};
    return {
      rank: i + 1,
      actor: data.account || d.id,
      ingameCurrency: toNumber(data.ingameCurrency, 0)
    };
  });

  const ref = db.doc('runtime/leaderboard_current');
  await ref.set({
    season,
    topPlayers,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return { season, topPlayers };
}

// Snapshot current leaderboard to seasons/<YYYYMM>
// If payload not provided, it reads runtime doc.
async function snapshotSeason(seasonYyyymm, payload /* {season, topPlayers} | null */) {
  const season = seasonYyyymm || monthKey();
  let data = payload;

  if (!data) {
    const cur = await db.doc('runtime/leaderboard_current').get();
    data = cur.exists ? cur.data() : null;
  }
  if (!data || !Array.isArray(data.topPlayers)) {
    // Build on the fly if missing
    data = await rebuildLeaderboard(TOP_LIMIT_DEFAULT);
  }

  const seasonRef = db.collection('leaderboard_seasons').doc(season);
  await seasonRef.set({
    season,
    topPlayers: data.topPlayers,
    closedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // Optional: clear runtime top (so new month starts empty) — but do NOT touch player balances.
  // Only clear if the season we saved equals the runtime season.
  await db.doc('runtime/leaderboard_current').set({
    season: monthKey(), // ensure pointer is current month
    topPlayers: [],
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    lastSeason: season
  }, { merge: true });

  return { season, count: data.topPlayers.length };
}

// Compute current player's rank (global) and whether they're in Top list
// Rank = 1 + number of players with strictly greater ingameCurrency
async function getPlayerRank(actor, playerScore) {
  if (!actor) return null;
  const score = toNumber(playerScore, 0);

  // Count players with ingameCurrency > score
  const qs = await db.collection('players')
    .where('ingameCurrency', '>', score)
    .select() // projection (lighter)
    .get();

  const rank = 1 + (qs.size || 0);

  return { actor, rank, ingameCurrency: score };
}

// ------- HTTP Endpoints -------

// GET /getLeaderboard?limit=100&actor=foo&season=current|YYYYMM
const getLeaderboard = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

    try {
      const limit = Math.min(500, Math.max(1, Number(req.query.limit || TOP_LIMIT_DEFAULT)));
      const seasonParam = (req.query.season || 'current').toString();
      const actor = requireActorOptional(req);

      if (seasonParam !== 'current') {
        // Past season
        const doc = await db.collection('leaderboard_seasons').doc(seasonParam).get();
        if (!doc.exists) return res.json({ season: seasonParam, topPlayers: [], currentPlayer: null, lastUpdated: null });

        const seasonData = doc.data() || {};
        // Optionally recompute current player's rank vs that snapshot if actor provided
        let currentPlayer = null;
        if (actor) {
          const pos = (seasonData.topPlayers || []).findIndex(p => (p.actor || p.id) === actor);
          if (pos >= 0) {
            currentPlayer = { ...seasonData.topPlayers[pos], isInTop: true };
          } else {
            // Not in top; we can’t recompute snapshot rank cheaply without full season scores
            currentPlayer = { actor, rank: null, ingameCurrency: null, isInTop: false };
          }
        }
        const page = (seasonData.topPlayers || []).slice(0, limit);
        return res.json({
          season: seasonParam,
          topPlayers: page,
          lastUpdated: seasonData.closedAt || null,
          currentPlayer
        });
      }

      // current leaderboard
      const curRef = db.doc('runtime/leaderboard_current');
      const curSnap = await curRef.get();
      let cur = curSnap.exists ? (curSnap.data() || {}) : null;

      if (!cur || !Array.isArray(cur.topPlayers) || cur.topPlayers.length === 0) {
        // build if empty
        cur = await rebuildLeaderboard(limit);
      }

      const topPlayers = (cur.topPlayers || []).slice(0, limit);
      const season = cur.season || monthKey();
      const lastUpdated = cur.lastUpdated || null;

      let currentPlayer = null;
      if (actor) {
        // try to find in the top list first
        const idx = topPlayers.findIndex(p => p.actor === actor);
        if (idx >= 0) {
          currentPlayer = { ...topPlayers[idx], isInTop: true };
        } else {
          // compute from players collection (rank across all players)
          const playerDoc = await db.collection('players').doc(actor).get();
          const pdata = playerDoc.exists ? (playerDoc.data() || {}) : {};
          const rankInfo = await getPlayerRank(actor, toNumber(pdata.ingameCurrency, 0));
          currentPlayer = { ...rankInfo, isInTop: false };
        }
      }

      res.json({
        season,
        topPlayers,
        lastUpdated,
        currentPlayer
      });
    } catch (e) {
      console.error('[getLeaderboard]', e);
      res.status(500).json({ error: e.message || String(e) });
    }
  })
);

// POST /rebuildLeaderboard?token=...
const rebuildLeaderboardHttp = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    if ((req.query.token || '') !== SEED_TOKEN) return res.status(403).json({ error: 'Forbidden' });

    try {
      const limit = Math.min(500, Math.max(1, Number(req.query.limit || TOP_LIMIT_DEFAULT)));
      const out = await rebuildLeaderboard(limit);
      res.json({ ok: true, ...out });
    } catch (e) {
      console.error('[rebuildLeaderboard]', e);
      res.status(500).json({ error: e.message || String(e) });
    }
  })
);

// POST /closeSeasonNow?token=...
// Snapshots previous month (YYYYMM based on UTC "now - 1 minute"), clears current runtime list.
const closeSeasonNow = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    if ((req.query.token || '') !== SEED_TOKEN) return res.status(403).json({ error: 'Forbidden' });

    try {
      // Close the season indicated by runtime doc, else current month
      const runtime = await db.doc('runtime/leaderboard_current').get();
      const seasonToClose = runtime.exists && runtime.data()?.season ? runtime.data().season : monthKey();
      const curData = runtime.exists ? runtime.data() : null;
      const out = await snapshotSeason(seasonToClose, curData || null);
      res.json({ ok: true, ...out });
    } catch (e) {
      console.error('[closeSeasonNow]', e);
      res.status(500).json({ error: e.message || String(e) });
    }
  })
);

// --- Schedulers ---
// Refresh current leaderboard every 10 minutes (cheap read)
const leaderboardCron = onSchedule('every 10 minutes', async () => {
  try {
    await rebuildLeaderboard(TOP_LIMIT_DEFAULT);
    console.log('leaderboardCron: rebuilt ok');
  } catch (e) {
    console.error('leaderboardCron failed', e);
  }
});

// Close previous month at 00:05 UTC on the 1st (gives a 5m buffer)
const seasonCloseCron = onSchedule('5 0 1 * *', async () => {
  try {
    const now = new Date();
    // Close the month we just finished: if now is 2025-11-01, close 202510.
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    d.setUTCMinutes(d.getUTCMinutes() - 1);
    const seasonToClose = monthKey(d);
    await snapshotSeason(seasonToClose, null);
    console.log('seasonCloseCron: closed season', seasonToClose);
  } catch (e) {
    console.error('seasonCloseCron failed', e);
  }
});

module.exports = {
  getLeaderboard,         // GET
  rebuildLeaderboardHttp, // POST (token)
  closeSeasonNow,         // POST (token)
  leaderboardCron,        // schedule
  seasonCloseCron,        // schedule
};
