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

    // 5. Fetch staked assets from global staking collection (BEFORE building slots)
    const stakingRef = db.collection('staking').doc(actor);
    const stakingSnap = await stakingRef.get();
    const stakingData = stakingSnap.exists ? stakingSnap.data() : { mining: {}, polishing: {} };

    console.log(`[LiveAggregator] 🔍 Staking data for ${actor}:`, {
      exists: stakingSnap.exists,
      hasMining: !!stakingData.mining,
      miningKeys: stakingData.mining ? Object.keys(stakingData.mining) : [],
      hasPolishing: !!stakingData.polishing,
      polishingKeys: stakingData.polishing ? Object.keys(stakingData.polishing) : []
    });

    // 6. Fetch mining active jobs
    const miningSlots = [];
    const miningActiveRef = db.collection('players').doc(actor).collection('mining_active');
    const miningActiveSnap = await miningActiveRef.get();
    console.log(`[LiveAggregator] 📊 Found ${miningActiveSnap.docs.length} mining active jobs for ${actor}`);

    // Create a map of active jobs by slot ID
    const activeJobsBySlot = new Map();
    miningActiveSnap.docs.forEach(doc => {
      const jobData = doc.data();
      const slotId = jobData.slotId ? parseInt(jobData.slotId.replace('slot_', ''), 10) : 1;
      console.log(`[LiveAggregator] 📊 Mining job: slotId=${slotId}, power=${jobData.power}, startedAt=${jobData.startedAt}`);
      activeJobsBySlot.set(slotId, {
        startedAt: jobData.startedAt || null,
        finishAt: jobData.finishAt || null,
        power: jobData.power || 0
      });
    });

    // Now get all staked mining slots (not just active ones)
    if (stakingData.mining) {
      Object.entries(stakingData.mining).forEach(([slotKey, slotData]) => {
        // Handle both 'slot_1' and 'slot1' formats
        const slotNum = parseInt(slotKey.replace(/slot[_]?/, ''), 10);
        if (!isNaN(slotNum)) {
          const activeJob = activeJobsBySlot.get(slotNum);
          miningSlots.push({
            id: slotNum,
            state: activeJob ? 'active' : 'idle',
            startedAt: activeJob?.startedAt || null,
            finishAt: activeJob?.finishAt || null,
            power: activeJob?.power || 0,
            staked: [] // Will be populated below
          });
        }
      });
    }

    console.log(`[LiveAggregator] 📊 Created ${miningSlots.length} mining slots from staking data`);

    // 7. Fetch polishing active jobs
    const polishingSlots = [];
    const polishingActiveRef = db.collection('players').doc(actor).collection('polishing_active');
    const polishingActiveSnap = await polishingActiveRef.get();
    console.log(`[LiveAggregator] 📊 Found ${polishingActiveSnap.docs.length} polishing active jobs for ${actor}`);

    // Create a map of active polishing jobs by slot ID
    const activePolishingJobsBySlot = new Map();
    polishingActiveSnap.docs.forEach(doc => {
      const jobData = doc.data();
      const slotId = jobData.slotId ? parseInt(jobData.slotId.replace('slot_', ''), 10) : 1;
      console.log(`[LiveAggregator] 📊 Polishing job: slotId=${slotId}, power=${jobData.power}, startedAt=${jobData.startedAt}`);
      activePolishingJobsBySlot.set(slotId, {
        startedAt: jobData.startedAt || null,
        finishAt: jobData.finishAt || null,
        power: jobData.power || 0
      });
    });

    // Now get all staked polishing slots (not just active ones)
    if (stakingData.polishing) {
      Object.entries(stakingData.polishing).forEach(([slotKey, slotData]) => {
        // Handle both 'slot_1' and 'slot1' formats
        const slotNum = parseInt(slotKey.replace(/slot[_]?/, ''), 10);
        if (!isNaN(slotNum)) {
          const activeJob = activePolishingJobsBySlot.get(slotNum);
          polishingSlots.push({
            id: slotNum,
            state: activeJob ? 'active' : 'idle',
            startedAt: activeJob?.startedAt || null,
            finishAt: activeJob?.finishAt || null,
            power: activeJob?.power || 0,
            staked: [] // Will be populated below
          });
        }
      });
    }

    console.log(`[LiveAggregator] 📊 Created ${polishingSlots.length} polishing slots from staking data`);

    // Helper function to normalize asset with type field
    const normalizeAsset = (asset, type) => {
      if (!asset) return null;
      return {
        asset_id: asset.asset_id || asset.assetId,
        template_id: asset.template_id || asset.templateId,
        name: asset.name || `${type} ${asset.asset_id || asset.assetId}`,
        type: asset.type || type,
        mp: asset.mp || asset.miningPower || 0,
        multiplier: asset.multiplier || asset.boost || 1.0
      };
    };

    // Populate staked assets for mining slots (slots already created above)
    miningSlots.forEach(slot => {
      const slotData = stakingData.mining?.[`slot${slot.id}`] || stakingData.mining?.[`slot_${slot.id}`];
      if (slotData) {
        console.log(`[LiveAggregator] 🎯 Populating mining slot ${slot.id}:`, {
          hasMine: !!slotData.mine,
          workersCount: slotData.workers?.length || 0,
          speedboostsCount: slotData.speedboosts?.length || 0,
          slotDataKeys: Object.keys(slotData)
        });
        slot.staked = [];
        
        // Add mine (normalized with type)
        if (slotData.mine) {
          const normalizedMine = normalizeAsset(slotData.mine, 'mine');
          if (normalizedMine) slot.staked.push(normalizedMine);
        }
        
        // Add workers (normalized with type)
        if (slotData.workers && Array.isArray(slotData.workers)) {
          slotData.workers.forEach(worker => {
            const normalizedWorker = normalizeAsset(worker, 'worker');
            if (normalizedWorker) slot.staked.push(normalizedWorker);
          });
        }
        
        // Add speedboosts (normalized with type)
        if (slotData.speedboosts && Array.isArray(slotData.speedboosts)) {
          slotData.speedboosts.forEach(speedboost => {
            const normalizedSpeedboost = normalizeAsset(speedboost, 'speedboost');
            if (normalizedSpeedboost) slot.staked.push(normalizedSpeedboost);
          });
        }
        
        console.log(`[LiveAggregator] ✅ Populated mining slot ${slot.id} with ${slot.staked.length} assets:`, slot.staked.map(s => ({ type: s.type, asset_id: s.asset_id })));
      } else {
        console.log(`[LiveAggregator] ⚠️ No staking data found for mining slot ${slot.id}`);
        slot.staked = [];
      }
    });

    console.log(`[LiveAggregator] 📊 Mining slots summary:`, miningSlots.map(s => ({
      id: s.id,
      state: s.state,
      stakedCount: s.staked.length,
      stakedTypes: s.staked.map(asset => asset.type)
    })));

    // Populate staked assets for polishing slots (slots already created above)
    polishingSlots.forEach(slot => {
      const slotData = stakingData.polishing?.[`slot${slot.id}`] || stakingData.polishing?.[`slot_${slot.id}`];
      if (slotData) {
        console.log(`[LiveAggregator] 🎨 Populating polishing slot ${slot.id}:`, {
          hasTable: !!slotData.table,
          gemsCount: slotData.gems?.length || 0,
          slotDataKeys: Object.keys(slotData)
        });
        slot.staked = [];
        
        // Add table (normalized with type)
        if (slotData.table) {
          const normalizedTable = normalizeAsset(slotData.table, 'table');
          if (normalizedTable) slot.staked.push(normalizedTable);
        }
        
        // Add gems (normalized with type)
        if (slotData.gems && Array.isArray(slotData.gems)) {
          slotData.gems.forEach(gem => {
            const normalizedGem = normalizeAsset(gem, 'gem');
            if (normalizedGem) slot.staked.push(normalizedGem);
          });
        }
        
        console.log(`[LiveAggregator] ✅ Populated polishing slot ${slot.id} with ${slot.staked.length} assets:`, slot.staked.map(s => ({ type: s.type, asset_id: s.asset_id })));
      } else {
        console.log(`[LiveAggregator] ⚠️ No staking data found for polishing slot ${slot.id}`);
        slot.staked = [];
      }
    });

    console.log(`[LiveAggregator] 📊 Polishing slots summary:`, polishingSlots.map(s => ({
      id: s.id,
      state: s.state,
      stakedCount: s.staked.length,
      stakedTypes: s.staked.map(asset => asset.type)
    })));


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
