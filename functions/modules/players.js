// functions/modules/players.js
'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

try { admin.app(); } catch { admin.initializeApp(); }
const db = getFirestore(undefined, 'tsdgems'); // named DB

const { getWaxBalance, getTsdmBalance, getOwnedNfts } = require('./chain');

// Built-in CORS from v2 (no external 'cors' lib)
const CORS = { cors: true, region: 'us-central1' };

function monthKey(d = new Date()) { return d.toISOString().slice(0,7).replace('-', ''); }

function requireActor(req, res) {
  const { actor } = req.method === 'GET' ? req.query : (req.body || {});
  if (!actor || typeof actor !== 'string') {
    res.status(400).json({ error: 'actor required' });
    return null;
  }
  return actor;
}

// POST /initPlayer { actor }
const initPlayer = onRequest(CORS, async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const actor = requireActor(req, res); if (!actor) return;

  const now = admin.firestore.Timestamp.now();
  const ref = db.collection('players').doc(actor);
  const snap = await ref.get();

  const base = {
    account: actor,
    ingameCurrency: 0,
    tsdmBalance: 0,
    miningSlotsUnlocked: 0,
    polishingSlotsUnlocked: 0,
    monthlyScore: 0,
    nfts: { count: 0, lastSyncAt: now },
    balances: { WAX: 0, TSDM: 0 }
  };

  if (!snap.exists) {
    await ref.set({ ...base, createdAt: now, lastSeenAt: now });
  } else {
    await ref.update({ lastSeenAt: now });
  }

  // sync balances + NFTs (read-only on-chain)
  await syncNowInternal(actor);

  const fresh = await ref.get();
  res.json({ ok: true, profile: { id: fresh.id, ...fresh.data() } });
});

// GET /getDashboard?actor=...
const getDashboard = onRequest(CORS, async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const actor = requireActor(req, res); if (!actor) return;

  const ref = db.collection('players').doc(actor);
  const snap = await ref.get();
  res.json({ profile: snap.exists ? { id: snap.id, ...snap.data() } : null });
});

// POST /syncNow { actor } (manual re-sync)
const syncNow = onRequest(CORS, async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const actor = requireActor(req, res); if (!actor) return;
  await syncNowInternal(actor);
  res.json({ ok: true });
});

async function syncNowInternal(actor) {
  const [wax, tsdm, nfts] = await Promise.all([
    getWaxBalance(actor).catch(() => 0),
    getTsdmBalance(actor).catch(() => 0),
    getOwnedNfts(actor, process.env.ATOMIC_COLLECTION).catch(() => [])
  ]);
  const now = admin.firestore.Timestamp.now();
  await db.collection('players').doc(actor).set({
    balances: { WAX: wax, TSDM: tsdm },
    nfts: { count: Number(nfts.length || 0), lastSyncAt: now },
    lastSeenAt: now,
  }, { merge: true });
}

module.exports = { initPlayer, getDashboard, syncNow };
