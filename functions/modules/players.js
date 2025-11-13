// functions/modules/players.js
'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');

try { admin.app(); } catch { admin.initializeApp(); }
const db = getFirestore();

const { getWaxBalance, getTsdmBalance, getOwnedNfts } = require('./chain');
const { buildPlayerLiveData } = require('./live-aggregator');

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

  const now = Timestamp.now();
  const ref = db.collection('players').doc(actor);
  const snap = await ref.get();

  const base = {
    account: actor,
    ingameCurrency: 0,
    tsdmBalance: 0,
    miningSlotsUnlocked: 1,  // First slot is free and auto-unlocked
    polishingSlotsUnlocked: 1,  // First slot is free and auto-unlocked
    monthlyScore: 0,
    nfts: { count: 0, lastSyncAt: now },
    balances: { WAX: 0, TSDM: 0 }
  };

  if (!snap.exists) {
    console.log(`[initPlayer] 🆕 Creating new player for actor: ${actor}`);
    await ref.set({ ...base, createdAt: now, lastSeenAt: now });
    // Create live doc synchronously for new players to ensure immediate availability
    console.log(`[initPlayer] Creating runtime/live doc synchronously for new player ${actor}`);
    await buildPlayerLiveData(actor, 'initPlayer');
    console.log(`[initPlayer] ✅ Player and runtime/live created successfully for ${actor}`);
    // Return with profile data
    res.json({ ok: true, profile: { id: actor, ...base } });
    // Sync inventory in background (don't await)
    syncNowInternal(actor).catch(e => console.error('[initPlayer] Background sync failed:', e));
    return;
  } else {
    // Ensure existing players have at least 1 mining slot and 1 polishing slot
    const existingData = snap.data();
    const updates = { lastSeenAt: now };
    let needsUpdate = false;
    
    if (!existingData.miningSlotsUnlocked || existingData.miningSlotsUnlocked < 1) {
      updates.miningSlotsUnlocked = 1;
      needsUpdate = true;
    }
    if (!existingData.polishingSlotsUnlocked || existingData.polishingSlotsUnlocked < 1) {
      updates.polishingSlotsUnlocked = 1;
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      await ref.update(updates);
    } else {
      await ref.update({ lastSeenAt: now });
    }
  }

  // For existing players: check if last sync was recent
  const existingData = snap.data();
  const lastSync = existingData.nfts?.lastSyncAt?.toMillis ? existingData.nfts.lastSyncAt.toMillis() : 0;
  const syncAge = Date.now() - lastSync;
  
  // If synced within last 15 minutes, skip sync and return cached data
  if (syncAge < 15 * 60 * 1000) {
    console.log(`[initPlayer] Using cached data for ${actor} (synced ${Math.floor(syncAge / 1000)}s ago)`);
    res.json({ ok: true, profile: { id: snap.id, ...existingData } });
    return;
  }

  // Otherwise sync and return fresh data
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
  if (!snap.exists) return res.json({ profile: null, inventory: [] });
  
  const data = snap.data() || {};
  // Make sure these exist even if missing in Firestore
  if (!data.balances) data.balances = { WAX: 0, TSDM: 0 };
  if (data.ingameCurrency == null) data.ingameCurrency = 0;

  // Load gems from inventory/gems subcollection
  const gemsSnap = await ref.collection('inventory').doc('gems').get();
  const gemsData = gemsSnap.exists ? gemsSnap.data() : {};
  
  // Separate rough and polished gems
  data.roughGems = {};
  data.polishedGems = {};
  
  Object.entries(gemsData).forEach(([key, value]) => {
    if (key.startsWith('rough_') || key === 'rough_gems') {
      data.roughGems[key] = value;
    } else if (key.startsWith('polished_')) {
      data.polishedGems[key] = value;
    }
  });

  res.json({ profile: snap.exists ? { id: snap.id, ...data } : null });
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
  const now = Timestamp.now();
  await db.collection('players').doc(actor).set({
    balances: { WAX: wax, TSDM: tsdm },
    nfts: { count: Number(nfts.length || 0), lastSyncAt: now },
    lastSeenAt: now,
  }, { merge: true });
}

// ========================================
// LEADERBOARD FUNCTIONS
// ========================================

const { onSchedule } = require('firebase-functions/v2/scheduler');

// Shared logic for refreshing leaderboard
async function refreshLeaderboardLogic() {
  console.log('[Leaderboard] Starting refresh...');
  
  const playersRef = db.collection('players');
  const snapshot = await playersRef.get();
  
  const entries = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    entries.push({
      actor: doc.id,
      ingameCurrency: Number(data.ingameCurrency || 0),
      createdAt: data.createdAt // For tie-breaking
    });
  });
  
  // Sort by ingameCurrency DESC, then by createdAt ASC (earlier = better)
  entries.sort((a, b) => {
    if (b.ingameCurrency !== a.ingameCurrency) {
      return b.ingameCurrency - a.ingameCurrency;
    }
    // Earlier createdAt wins
    const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return aTime - bTime;
  });
  
  // Assign ranks
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });
  
  // Store in Firestore
  await db.collection('global').doc('leaderboard').set({
    entries: entries,
    totalPlayers: entries.length,
    lastUpdated: Timestamp.now(),
    version: 1
  });
  
  console.log(`[Leaderboard] Updated with ${entries.length} players`);
  return entries.length;
}

// Scheduled function - runs every hour
const refreshLeaderboard = onSchedule({
  schedule: '0 * * * *',
  timeZone: 'UTC',
  region: 'us-central1'
}, async (event) => {
  try {
    const count = await refreshLeaderboardLogic();
    console.log(`[Leaderboard] Scheduled refresh completed: ${count} players`);
  } catch (error) {
    console.error('[Leaderboard] Scheduled refresh failed:', error);
    throw error;
  }
});

// GET /getLeaderboard?actor=xxx&limit=100
const getLeaderboard = onRequest(CORS, async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  
  try {
    const { actor, limit = '100' } = req.query;
    const limitNum = Math.min(parseInt(limit) || 100, 100);
    
    const leaderboardDoc = await db.collection('global').doc('leaderboard').get();
    
    if (!leaderboardDoc.exists) {
      return res.json({
        topPlayers: [],
        currentPlayer: null,
        totalPlayers: 0,
        lastUpdated: null
      });
    }
    
    const data = leaderboardDoc.data();
    const allEntries = data.entries || [];
    
    // Get top N players
    const topPlayers = allEntries.slice(0, limitNum);
    
    // Find current player
    let currentPlayer = null;
    if (actor) {
      const playerEntry = allEntries.find(e => e.actor === actor);
      if (playerEntry) {
        currentPlayer = {
          ...playerEntry,
          isInTop: playerEntry.rank <= limitNum
        };
      }
    }
    
    res.json({
      topPlayers,
      currentPlayer,
      totalPlayers: data.totalPlayers || 0,
      lastUpdated: data.lastUpdated
    });
    
  } catch (error) {
    console.error('[getLeaderboard]', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /triggerLeaderboardRefresh (for manual testing)
const triggerLeaderboardRefresh = onRequest(CORS, async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  
  try {
    const count = await refreshLeaderboardLogic();
    res.json({ 
      ok: true, 
      message: 'Leaderboard refreshed', 
      playersCount: count 
    });
  } catch (error) {
    console.error('[triggerLeaderboardRefresh]', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = { 
  initPlayer, 
  getDashboard, 
  syncNow,
  refreshLeaderboard,
  getLeaderboard,
  triggerLeaderboardRefresh
};