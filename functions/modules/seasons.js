// functions/modules/seasons.js
// Monthly seasons with a fixed 5-day off-season (lock) before month end.
// Active: from the 1st 00:00 UTC until lockStart (00:00 UTC, 5 days before month end)
// Lock:   from lockStart until 1st 00:05 UTC next month

const { onRequest }  = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin          = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const corsLib        = require('cors');

const db = getFirestore(undefined, 'tsdgems');

const RAW_ALLOW  = process.env.CORS_ALLOW || '';
const ALLOWLIST  = RAW_ALLOW.split(',').map(s => s.trim()).filter(Boolean);
const cors       = corsLib({ origin: ALLOWLIST.length ? ALLOWLIST : true, credentials: false });

const SEED_TOKEN = process.env.SEED_TOKEN || 'changeme-temp-token';
const OFF_DAYS = 5; // <-- fixed 5-day break

function monthKey(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  return `${y}${m}`;
}

function endOfMonthUTC(d = new Date()) {
  // First day of next month 00:00 UTC minus 1 ms
  const firstNext = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0));
  return new Date(firstNext.getTime() - 1);
}

/** Compute schedule for the *current* month. */
function computeScheduleNow() {
  const now = new Date();
  const startAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0);

  const eom = endOfMonthUTC(now);                // e.g., 2025-10-31T23:59:59.999Z
  // 5-day lock starts at 00:00 of (lastDay - 5 + 1) == lastDay - 4
  const lockStartDay = eom.getUTCDate() - OFF_DAYS + 1; // inclusive day count
  const lockStartAt = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), lockStartDay, 0, 0, 0);

  // Open new season at 00:05 UTC on the 1st of next month
  const lockEndAt = Date.UTC(eom.getUTCFullYear(), eom.getUTCMonth() + 1, 1, 0, 5, 0);

  return { startAt, lockStartAt, lockEndAt, offDays: OFF_DAYS };
}

const STATE_DOC = db.doc('runtime/season_state');

async function readState() {
  const s = await STATE_DOC.get();
  if (s.exists) return s.data();
  const init = {
    season: monthKey(),
    phase: 'active',
    lockEndsAt: null,
    lastChangeAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await STATE_DOC.set(init, { merge: true });
  return init;
}

async function setState(patch) {
  await STATE_DOC.set(
    { ...patch, lastChangeAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
  const s = await STATE_DOC.get();
  return s.data() || patch;
}

// --- Public endpoints ---

// GET /getSeasonState
const getSeasonState = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
    try {
      const s = await readState();
      res.json({ ok: true, ...s });
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
    }
  })
);

// (optional helper for UI timers)
// GET /getSeasonSchedule
const getSeasonSchedule = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
    try {
      const sched = computeScheduleNow();
      const state = await readState();
      res.json({ ok: true, season: state.season, phase: state.phase, ...sched });
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
    }
  })
);

// Manual lock (mostly for testing)
// POST /enterLockWindow?token=... { minutes?: number }
const enterLockWindow = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    if ((req.query.token || '') !== SEED_TOKEN) return res.status(403).json({ error: 'Forbidden' });

    try {
      const cur = await readState();
      const minutes = Math.max(1, Math.min(7 * 24 * 60, Number(req.body?.minutes || 15)));
      const lockEndsAt = Date.now() + minutes * 60 * 1000;
      const out = await setState({ phase: 'lock', lockEndsAt, season: cur.season });
      res.json({ ok: true, state: out });
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
    }
  })
);

// POST /openNewSeason?token=...
// Snapshots the *previous* season and flips to the new month.
const openNewSeason = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    if ((req.query.token || '') !== SEED_TOKEN) return res.status(403).json({ error: 'Forbidden' });

    try {
      // lazy import to avoid circular init during cold start
      const { snapshotSeason } = require('./leaderboard');

      const now = new Date();
      const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      prev.setUTCMinutes(prev.getUTCMinutes() - 1);         // last minute of previous month
      const seasonToClose = monthKey(prev);

      await snapshotSeason(seasonToClose, null);

      const newSeason = monthKey();
      const out = await setState({ season: newSeason, phase: 'active', lockEndsAt: null });
      res.json({ ok: true, state: out, closed: seasonToClose, opened: newSeason });
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
    }
  })
);

// --- Schedulers ---

// Enter LOCK automatically at 00:05 UTC on the day lock should start
// (computed as 5 days before month end)
const autoLockCron = onSchedule('5 0 * * *', async () => {
  const { lockStartAt, lockEndAt } = computeScheduleNow();
  const now = Date.now();

  // If we're within 10 minutes after the intended lockStartAt -> enter lock once
  if (now >= lockStartAt && now < lockStartAt + 10 * 60 * 1000) {
    await setState({ phase: 'lock', lockEndsAt, season: monthKey() });
    console.log('autoLockCron: entered lock window until', new Date(lockEndAt).toISOString());
  }
});

// Open the new season at 00:05 UTC on the 1st
const autoOpenCron = onSchedule('5 0 1 * *', async () => {
  try {
    await openNewSeason.run({});
    console.log('autoOpenCron: new season opened');
  } catch (e) {
    console.error('autoOpenCron failed', e);
  }
});

module.exports = {
  getSeasonState,
  getSeasonSchedule, // (optional, handy for UI)
  enterLockWindow,
  openNewSeason,
  autoLockCron,
  autoOpenCron,
};
