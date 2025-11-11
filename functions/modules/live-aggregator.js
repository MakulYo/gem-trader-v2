// functions/modules/live-aggregator.js
'use strict';

const admin = require('firebase-admin');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

try { admin.app(); } catch { admin.initializeApp(); }
const db = getFirestore();

/**
 * Builds and writes the live data aggregate for a player
 * @param {string} actor - Player actor
 * @param {string} cause - Optional cause for logging (e.g., 'profile_update', 'mining_slot_1')
 * @returns {Promise<void>}
 */
async function buildPlayerLiveData(actor, cause = 'unknown') {
  console.log(`[LiveAggregator] 🔄 STARTING build for ${actor} (cause: ${cause})`);

  const startTime = Date.now();
  const serverTime = Timestamp.now();

  try {
    // 1. Fetch profile data
    const profileRef = db.collection('players').doc(actor);
    const profileSnap = await profileRef.get();
    const profile = profileSnap.exists ? profileSnap.data() : null;

    if (!profile) {
      console.log(`[LiveAggregator] No profile found for ${actor}, skipping live data build`);
      return;
    }

    // 2. Fetch gems inventory
    const gemsRef = db.collection('players').doc(actor).collection('inventory').doc('gems');
    const gemsSnap = await gemsRef.get();
    const gems = gemsSnap.exists ? gemsSnap.data() : {};

    // 3. Fetch inventory summary
    const summaryRef = db.collection('players').doc(actor).collection('meta').doc('inventory_summary');
    const summarySnap = await summaryRef.get();
    const inventorySummary = summarySnap.exists ? summarySnap.data() : null;

    // 4. Fetch speedboost items
    const speedboostRef = db.collection('players').doc(actor).collection('inventory').doc('speedboost');
    const speedboostSnap = await speedboostRef.get();
    const speedboost = speedboostSnap.exists ? speedboostSnap.data() : {};

    // 5. Fetch mining active jobs
    const miningSlots = [];
    const miningActiveRef = db.collection('players').doc(actor).collection('mining_active');
    const miningActiveSnap = await miningActiveRef.get();
    console.log(`[LiveAggregator] 📊 Found ${miningActiveSnap.docs.length} mining active jobs for ${actor}`);
    miningActiveSnap.docs.forEach(doc => {
      const jobData = doc.data();
      const slotId = jobData.slotId ? parseInt(jobData.slotId.replace('slot_', ''), 10) : 1;
      console.log(`[LiveAggregator] 📊 Mining job: slotId=${slotId}, power=${jobData.power}, startedAt=${jobData.startedAt}`);
      miningSlots.push({
        id: slotId,
        state: 'active',
        startedAt: jobData.startedAt || null,
        finishAt: jobData.finishAt || null,
        power: jobData.power || 0,
        staked: [] // Will be populated from staking data below
      });
    });

    // 6. Fetch polishing active jobs
    const polishingSlots = [];
    const polishingActiveRef = db.collection('players').doc(actor).collection('polishing_active');
    const polishingActiveSnap = await polishingActiveRef.get();
    polishingActiveSnap.docs.forEach(doc => {
      const jobData = doc.data();
      polishingSlots.push({
        id: jobData.slotId ? parseInt(jobData.slotId.replace('slot_', ''), 10) : 1,
        state: 'active',
        startedAt: jobData.startedAt || null,
        finishAt: jobData.finishAt || null,
        power: jobData.power || 0,
        staked: [] // Will be populated from staking data below
      });
    });

    // 7. Fetch staked assets from global staking collection
    const stakingRef = db.collection('staking').doc(actor);
    const stakingSnap = await stakingRef.get();
    const stakingData = stakingSnap.exists ? stakingSnap.data() : { mining: {}, polishing: {} };

    console.log(`[LiveAggregator] 🔍 Staking data for ${actor}:`, {
      exists: stakingSnap.exists,
      hasMining: !!stakingData.mining,
      miningKeys: stakingData.mining ? Object.keys(stakingData.mining) : [],
      miningSlot1: stakingData.mining?.slot_1 ? 'EXISTS' : 'MISSING',
      miningSlot2: stakingData.mining?.slot_2 ? 'EXISTS' : 'MISSING',
      hasPolishing: !!stakingData.polishing,
      polishingKeys: stakingData.polishing ? Object.keys(stakingData.polishing) : [],
      fullData: stakingSnap.exists ? stakingData : 'DOCUMENT_NOT_FOUND'
    });

    // Populate staked assets for mining slots
    if (stakingData.mining) {
      Object.entries(stakingData.mining).forEach(([slotKey, slotData]) => {
        // Handle both 'slot_1' and 'slot1' formats
        const slotNum = parseInt(slotKey.replace(/slot[_]?/, ''), 10);
        console.log(`[LiveAggregator] 🎯 Processing mining slot key '${slotKey}' -> num ${slotNum}:`, {
          slotExists: !!miningSlots.find(slot => slot.id === slotNum),
          hasMine: !!slotData.mine,
          workersCount: slotData.workers?.length || 0,
          slotIds: miningSlots.map(s => s.id),
          slotDataKeys: Object.keys(slotData)
        });
        if (!isNaN(slotNum)) {
          const miningSlot = miningSlots.find(slot => slot.id === slotNum);
          if (miningSlot) {
            miningSlot.staked = [];
            if (slotData.mine) miningSlot.staked.push(slotData.mine);
            if (slotData.workers) miningSlot.staked.push(...slotData.workers);
            console.log(`[LiveAggregator] ✅ Populated mining slot ${slotNum} with ${miningSlot.staked.length} assets:`, miningSlot.staked.map(s => ({ type: s.type, asset_id: s.asset_id })));
          } else {
            console.log(`[LiveAggregator] ❌ Mining slot ${slotNum} not found in active jobs, skipping stake population`);
          }
        } else {
          console.log(`[LiveAggregator] ❌ Could not parse slot number from key '${slotKey}'`);
        }
      });
    } else {
      console.log(`[LiveAggregator] ❌ No mining staking data found for ${actor}`);
    }

    // Populate staked assets for polishing slots
    if (stakingData.polishing) {
      Object.entries(stakingData.polishing).forEach(([slotKey, slotData]) => {
        // Handle both 'slot_1' and 'slot1' formats
        const slotNum = parseInt(slotKey.replace(/slot[_]?/, ''), 10);
        console.log(`[LiveAggregator] 🎨 Processing polishing slot key '${slotKey}' -> num ${slotNum}:`, {
          slotExists: !!polishingSlots.find(slot => slot.id === slotNum),
          hasTable: !!slotData.table,
          gemsCount: slotData.gems?.length || 0,
          slotIds: polishingSlots.map(s => s.id)
        });
        if (!isNaN(slotNum)) {
          const polishingSlot = polishingSlots.find(slot => slot.id === slotNum);
          if (polishingSlot) {
            polishingSlot.staked = [];
            if (slotData.table) polishingSlot.staked.push(slotData.table);
            if (slotData.gems) polishingSlot.staked.push(...slotData.gems);
            console.log(`[LiveAggregator] ✅ Populated polishing slot ${slotNum} with ${polishingSlot.staked.length} assets:`, polishingSlot.staked.map(s => ({ type: s.type, asset_id: s.asset_id })));
          } else {
            console.log(`[LiveAggregator] ❌ Polishing slot ${slotNum} not found in active jobs, skipping stake population`);
          }
        } else {
          console.log(`[LiveAggregator] ❌ Could not parse polishing slot number from key '${slotKey}'`);
        }
      });
    } else {
      console.log(`[LiveAggregator] ❌ No polishing staking data found for ${actor}`);
    }

    // 8. Fetch global runtime data
    const pricingRef = db.collection('runtime').doc('pricing');
    const pricingSnap = await pricingRef.get();
    const pricing = pricingSnap.exists ? pricingSnap.data() : {};

    const boostsRef = db.collection('city_boosts');
    const boostsSnap = await boostsRef.get();
    const boosts = boostsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 8. Build minimal profile data
    const liveProfile = {
      ingameCurrency: profile.ingameCurrency || 0,
      level: profile.level || 1,
      name: profile.account || actor,
      miningSlotsUnlocked: profile.miningSlotsUnlocked || 1,
      polishingSlotsUnlocked: profile.polishingSlotsUnlocked || 0
    };

    // 9. Build live data structure
    const liveData = {
      profile: liveProfile,
      gems: gems,
      inventorySummary: inventorySummary,
      speedboost: speedboost,
      miningSlots: miningSlots,
      polishingSlots: polishingSlots,
      pricing: pricing,
      boosts: boosts,
      serverTime: serverTime,
      lastUpdatedAt: serverTime
    };

    // 10. Write to live document
    const liveRef = db.collection('players').doc(actor).collection('runtime').doc('live');
    await liveRef.set(liveData);

    const duration = Date.now() - startTime;
    console.log(`[LiveAggregator] ✅ Built and wrote live data for ${actor} in ${duration}ms`);

  } catch (error) {
    console.error(`[LiveAggregator] ❌ Failed to build live data for ${actor}:`, error);
    throw error;
  }
}

/**
 * HTTP function to rebuild live data (admin/debug use)
 */
const { onRequest } = require('firebase-functions/v2/https');
const rebuildPlayerLive = onRequest({ cors: true, region: 'us-central1' }, async (req, res) => {
  console.log(`[rebuildPlayerLive] 🚀 FUNCTION CALLED with body:`, JSON.stringify(req.body));
  try {
    // TEMP: Skip auth for debugging
    // if (!req.headers.authorization) {
    //   return res.status(401).json({ error: 'Authentication required' });
    // }

    const { actor } = req.body.data || req.body;
    console.log(`[rebuildPlayerLive] 📝 Extracted actor: ${actor}`);
    if (!actor) {
      console.log(`[rebuildPlayerLive] ❌ No actor provided`);
      return res.status(400).json({ error: 'actor parameter required' });
    }

    console.log(`[rebuildPlayerLive] 🔄 Starting manual rebuild for ${actor}`);
    await buildPlayerLiveData(actor, 'manual_rebuild');
    console.log(`[rebuildPlayerLive] ✅ Rebuild completed for ${actor}`);
    return res.json({ success: true, message: `Rebuilt live data for ${actor}` });
  } catch (error) {
    console.error('[rebuildPlayerLive] 💥 Error during rebuild:', error);
    console.error('[rebuildPlayerLive] Stack:', error.stack);
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
});

module.exports = {
  buildPlayerLiveData,
  rebuildPlayerLive
};
