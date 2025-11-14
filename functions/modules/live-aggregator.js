// functions/modules/live-aggregator.js
'use strict';

const admin = require('firebase-admin');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { onRequest } = require('firebase-functions/v2/https');

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
      console.log(`[LiveAggregator] ⚠️ No profile found for ${actor}, creating minimal profile structure context`);
      // We still proceed, treating this as a new account
    }

    // 2. Fetch gems inventory
    const gemsRef = db.collection('players').doc(actor).collection('inventory').doc('gems');
    const gemsSnap = await gemsRef.get();
    const rawGems = gemsSnap.exists ? gemsSnap.data() : {};

    const gems = {
      rough: rawGems.rough || {},
      polished: rawGems.polished || {},
      // keep legacy keys for backward compatibility
      ...rawGems
    };

    // 3. Fetch inventory summary
    const summaryRef = db.collection('players').doc(actor).collection('meta').doc('inventory_summary');
    const summarySnap = await summaryRef.get();
    const rawSummary = summarySnap.exists ? summarySnap.data() : null;

    const inventorySummary = rawSummary || {
      total: 0,
      totalNFTs: 0,
      polished: 0,
      rough: 0,
      equipment: 0,
      miningSlots: 0,
      polishingSlots: 0,
      uniqueTemplates: 0,
      templateCounts: {}
    };

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

    // 6. Build minimal *live* profile FIRST (needed for unlocked slot limits)
    const balances = profile?.balances || {};

    const miningSlotsUnlockedFromProfile = profile
      ? (Number(profile.miningSlotsUnlocked ?? profile.mining_slots_unlocked ?? 0) || 0)
      : 0;
    const polishingSlotsUnlockedFromProfile = profile
      ? (Number(profile.polishingSlotsUnlocked ?? profile.polishing_slots_unlocked ?? 0) || 0)
      : 0;

    const hasManualMiningOverride =
      profile && profile.miningSlotsUnlockedManual !== undefined && profile.miningSlotsUnlockedManual !== null;
    const hasManualPolishingOverride =
      profile && profile.polishingSlotsUnlockedManual !== undefined && profile.polishingSlotsUnlockedManual !== null;

    const defaultMiningSlots = 1;
    const defaultPolishingSlots = 1;

    const liveProfile = {
      ingameCurrency: profile ? (Number(profile.ingameCurrency ?? profile.ingame_currency ?? 0) || 0) : 0,
      level: profile?.level || 1,
      name: profile?.account || actor,
      balances: {
        TSDM: Number(balances.TSDM ?? balances.tsdm ?? 0) || 0,
        WAX: Number(balances.WAX ?? balances.wax ?? 0) || 0
      },
      // — CRITICAL: only profile (or manual override) controls unlocks, not staking
      miningSlotsUnlocked: hasManualMiningOverride
        ? Number(profile.miningSlotsUnlockedManual)
        : (miningSlotsUnlockedFromProfile > 0 ? miningSlotsUnlockedFromProfile : defaultMiningSlots),
      polishingSlotsUnlocked: hasManualPolishingOverride
        ? Number(profile.polishingSlotsUnlockedManual)
        : (polishingSlotsUnlockedFromProfile > 0 ? polishingSlotsUnlockedFromProfile : defaultPolishingSlots)
    };

    // 7. Fetch mining active jobs
    const miningSlots = [];
    const miningActiveRef = db.collection('players').doc(actor).collection('mining_active');
    const miningActiveSnap = await miningActiveRef.get();
    console.log(`[LiveAggregator] 📊 Found ${miningActiveSnap.docs.length} mining active jobs for ${actor}`);

    const activeJobsBySlot = new Map();
    miningActiveSnap.docs.forEach(doc => {
      const jobData = doc.data();
      const slotId = jobData.slotId
        ? parseInt(jobData.slotId.replace('slot_', ''), 10)
        : 1;
      const jobId = doc.id;
      console.log(
        `[LiveAggregator] 📊 Mining job: jobId=${jobId}, slotId=${slotId}, power=${jobData.power}, startedAt=${jobData.startedAt}, boost=${jobData.slotSpeedBoostPct ?? 0}`
      );
      activeJobsBySlot.set(slotId, {
        jobId,
        startedAt: jobData.startedAt || null,
        finishAt: jobData.finishAt || null,
        power: jobData.power || jobData.slotMiningPower || 0,
        effectiveDurationMs: jobData.effectiveDurationMs || null,
        baseDurationMs: jobData.baseDurationMs || null,
        slotSpeedBoostPct: jobData.slotSpeedBoostPct || 0,
        slotSpeedBoostMultiplier: jobData.slotSpeedBoostMultiplier || 1,
        slotSpeedBoostAssetId: jobData.slotSpeedBoostAssetId || null
      });
    });

    // 8. Mining slots from staking (respect unlock limit)
    if (stakingData.mining) {
      Object.entries(stakingData.mining).forEach(([slotKey, slotData]) => {
        const slotNum = parseInt(slotKey.replace(/slot[_]?/, ''), 10);
        if (Number.isNaN(slotNum)) return;

        if (slotNum <= liveProfile.miningSlotsUnlocked) {
          const activeJob = activeJobsBySlot.get(slotNum);
          miningSlots.push({
            id: slotNum,
            jobId: activeJob?.jobId || null,
            state: activeJob ? 'active' : 'idle',
            startedAt: activeJob?.startedAt || null,
            finishAt: activeJob?.finishAt || null,
            power: activeJob?.power || 0,
            effectiveDurationMs: activeJob?.effectiveDurationMs || null,
            baseDurationMs: activeJob?.baseDurationMs || null,
            slotSpeedBoostPct: activeJob?.slotSpeedBoostPct || 0,
            slotSpeedBoostMultiplier: activeJob?.slotSpeedBoostMultiplier || 1,
            slotSpeedBoostAssetId: activeJob?.slotSpeedBoostAssetId || null,
            staked: [] // filled later
          });
        } else {
          console.warn(
            `[LiveAggregator] ⚠️ Mining slot ${slotNum} exists in staking data but user only has ${liveProfile.miningSlotsUnlocked} slots unlocked. Skipping.`
          );
        }
      });
    }

    // Ensure active jobs without staking entries are still represented (respect unlock limit)
    activeJobsBySlot.forEach((jobData, slotNum) => {
      const alreadyExists = miningSlots.some(slot => slot.id === slotNum);
      if (!alreadyExists && slotNum <= liveProfile.miningSlotsUnlocked) {
        console.warn(
          `[LiveAggregator] ⚠️ Mining slot ${slotNum} has an active job but no staking data. Creating fallback entry.`
        );
        miningSlots.push({
          id: slotNum,
          jobId: jobData.jobId || null,
          state: 'active',
          startedAt: jobData.startedAt || null,
          finishAt: jobData.finishAt || null,
          power: jobData.power || 0,
          effectiveDurationMs: jobData.effectiveDurationMs || null,
          baseDurationMs: jobData.baseDurationMs || null,
          slotSpeedBoostPct: jobData.slotSpeedBoostPct || 0,
          slotSpeedBoostMultiplier: jobData.slotSpeedBoostMultiplier || 1,
          slotSpeedBoostAssetId: jobData.slotSpeedBoostAssetId || null,
          staked: []
        });
      } else if (!alreadyExists && slotNum > liveProfile.miningSlotsUnlocked) {
        console.warn(
          `[LiveAggregator] ⚠️ Mining slot ${slotNum} has an active job but exceeds unlock limit (${liveProfile.miningSlotsUnlocked}). Skipping.`
        );
      }
    });

    console.log(`[LiveAggregator] 📊 Created ${miningSlots.length} mining slots from staking data`);

    // 9. Polishing active jobs
    const polishingSlots = [];
    const polishingActiveRef = db.collection('players').doc(actor).collection('polishing_active');
    const polishingActiveSnap = await polishingActiveRef.get();
    console.log(`[LiveAggregator] 📊 Found ${polishingActiveSnap.docs.length} polishing active jobs for ${actor}`);

    const activePolishingJobsBySlot = new Map();
    polishingActiveSnap.docs.forEach(doc => {
      const jobData = doc.data();
      const slotId = jobData.slotId
        ? parseInt(jobData.slotId.replace('slot_', ''), 10)
        : 1;
      const jobId = doc.id;
      console.log(
        `[LiveAggregator] 📊 Polishing job: jobId=${jobId}, slotId=${slotId}, power=${jobData.power}, startedAt=${jobData.startedAt}`
      );
      activePolishingJobsBySlot.set(slotId, {
        jobId,
        startedAt: jobData.startedAt || null,
        finishAt: jobData.finishAt || null,
        power: jobData.power || 0
      });
    });

    // Polishing slots from staking (respect unlock limit)
    if (stakingData.polishing) {
      Object.entries(stakingData.polishing).forEach(([slotKey, slotData]) => {
        const slotNum = parseInt(slotKey.replace(/slot[_]?/, ''), 10);
        if (Number.isNaN(slotNum)) return;

        if (slotNum <= liveProfile.polishingSlotsUnlocked) {
          const activeJob = activePolishingJobsBySlot.get(slotNum);
          polishingSlots.push({
            id: slotNum,
            jobId: activeJob?.jobId || null,
            state: activeJob ? 'active' : 'idle',
            startedAt: activeJob?.startedAt || null,
            finishAt: activeJob?.finishAt || null,
            power: activeJob?.power || 0,
            staked: [] // filled later
          });
        } else {
          console.warn(
            `[LiveAggregator] ⚠️ Polishing slot ${slotNum} exists in staking data but user only has ${liveProfile.polishingSlotsUnlocked} slots unlocked. Skipping.`
          );
        }
      });
    }

    console.log(`[LiveAggregator] 📊 Created ${polishingSlots.length} polishing slots from staking data`);

    activePolishingJobsBySlot.forEach((jobData, slotNum) => {
      const alreadyExists = polishingSlots.some(slot => slot.id === slotNum);
      if (!alreadyExists && slotNum <= liveProfile.polishingSlotsUnlocked) {
        console.warn(
          `[LiveAggregator] ⚠️ Polishing slot ${slotNum} has an active job but no staking data. Creating fallback entry.`
        );
        polishingSlots.push({
          id: slotNum,
          jobId: jobData.jobId || null,
          state: 'active',
          startedAt: jobData.startedAt || null,
          finishAt: jobData.finishAt || null,
          power: jobData.power || 0,
          staked: []
        });
      } else if (!alreadyExists && slotNum > liveProfile.polishingSlotsUnlocked) {
        console.warn(
          `[LiveAggregator] ⚠️ Polishing slot ${slotNum} has an active job but exceeds unlock limit (${liveProfile.polishingSlotsUnlocked}). Skipping.`
        );
      }
    });

    // --- Speedboost helpers ---
    const computeSpeedboostBoost = (asset) => {
      if (!asset) return 0;
      const rawBoost = Number(asset.boost);
      if (Number.isFinite(rawBoost) && rawBoost > 0) {
        return rawBoost;
      }
      const rawMultiplier = Number(asset.multiplier);
      if (Number.isFinite(rawMultiplier) && rawMultiplier > 0) {
        return Math.max(0, rawMultiplier - 1);
      }
      return 0;
    };

    const computeSpeedboostMultiplier = (asset, boostHint = null) => {
      if (!asset) return 1;
      const rawMultiplier = Number(asset.multiplier);
      if (Number.isFinite(rawMultiplier) && rawMultiplier > 0) {
        return rawMultiplier;
      }
      const boost = boostHint !== null ? boostHint : computeSpeedboostBoost(asset);
      return 1 + boost;
    };

    const pickSpeedboost = (slotData) => {
      if (!slotData || typeof slotData !== 'object') return null;

      if (slotData.speedboost) {
        return slotData.speedboost;
      }

      if (Array.isArray(slotData.speedboosts) && slotData.speedboosts.length > 0) {
        return slotData.speedboosts.reduce((best, candidate) => {
          if (!best) return candidate;
          return computeSpeedboostBoost(candidate) > computeSpeedboostBoost(best) ? candidate : best;
        }, null);
      }

      return null;
    };

    // normalizeAsset with fixed braces + extra fields
    const normalizeAsset = (asset, type) => {
      if (!asset) return null;

      const assetId = asset.asset_id || asset.assetId;
      if (!assetId) return null;

      const normalized = {
        asset_id: assetId,
        type: asset.type || type
      };

      const templateId = asset.template_id || asset.templateId;
      if (templateId) normalized.template_id = templateId;

      const name = asset.name || asset.display_name || `${type} ${assetId}`;
      if (name) normalized.name = name;

      if (normalized.type === 'speedboost') {
        const boost = computeSpeedboostBoost(asset);
        const multiplier = computeSpeedboostMultiplier(asset, boost);
        normalized.boost = boost;
        normalized.multiplier = multiplier;
        normalized.mp = 0;

        const rarity = asset.rarity;
        if (rarity) normalized.rarity = rarity;

        const templateMint = asset.template_mint || asset.templateMint;
        if (templateMint) normalized.template_mint = templateMint;

        const imagePath = asset.imagePath || asset.image_url;
        if (imagePath) normalized.imagePath = imagePath;
      } else {
        const mpValue = Number(asset.mp ?? asset.miningPower ?? 0);
        normalized.mp = Number.isFinite(mpValue) ? mpValue : 0;

        const multiplier = Number(asset.multiplier ?? asset.boost ?? 1);
        if (Number.isFinite(multiplier) && multiplier !== 1) {
          normalized.multiplier = multiplier;
        }

        const templateMint = asset.template_mint || asset.templateMint;
        if (templateMint) normalized.template_mint = templateMint;

        const imagePath = asset.imagePath || asset.image_url;
        if (imagePath) normalized.imagePath = imagePath;

        if (type === 'gem') {
          const gemType = asset.gemType || asset.gem_type || asset.typeName;
          if (gemType) normalized.gemType = gemType;

          if (asset.bonus !== undefined) {
            const bonus = Number(asset.bonus);
            normalized.bonus = Number.isFinite(bonus) ? bonus : 0;
          }

          if (asset.isPolished !== undefined) {
            normalized.isPolished = Boolean(asset.isPolished);
          } else if (asset.is_polished !== undefined) {
            normalized.isPolished = Boolean(asset.is_polished);
          }
        }
      }

      return normalized;
    };

    // Populate staked assets for mining slots
    miningSlots.forEach(slot => {
      const slotData =
        stakingData.mining?.[`slot${slot.id}`] ||
        stakingData.mining?.[`slot_${slot.id}`];

      if (slotData) {
        console.log(`[LiveAggregator] 🎯 Populating mining slot ${slot.id}:`, {
          hasMine: !!slotData.mine,
          workersCount: slotData.workers?.length || 0,
          speedboostAsset: slotData.speedboost?.asset_id || pickSpeedboost(slotData)?.asset_id || null,
          legacySpeedboostCount: Array.isArray(slotData.speedboosts) ? slotData.speedboosts.length : 0,
          slotDataKeys: Object.keys(slotData)
        });

        slot.staked = [];

        if (slotData.mine) {
          const normalizedMine = normalizeAsset(slotData.mine, 'mine');
          if (normalizedMine) slot.staked.push(normalizedMine);
        }

        if (Array.isArray(slotData.workers)) {
          slotData.workers.forEach(worker => {
            const normalizedWorker = normalizeAsset(worker, 'worker');
            if (normalizedWorker) slot.staked.push(normalizedWorker);
          });
        }

        const rawSpeedboost = pickSpeedboost(slotData);
        if (rawSpeedboost) {
          const normalizedSpeedboost = normalizeAsset(rawSpeedboost, 'speedboost');
          if (normalizedSpeedboost) {
            slot.speedBoost = normalizedSpeedboost;
            slot.speedBoostPct = normalizedSpeedboost.boost;
            slot.speedBoostMultiplier = normalizedSpeedboost.multiplier;
            slot.staked.push({ ...normalizedSpeedboost });
          }
        }

        if (!slot.speedBoost) {
          slot.speedBoost = null;
          slot.speedBoostPct = 0;
          slot.speedBoostMultiplier = 1;
        }

        console.log(
          `[LiveAggregator] ✅ Populated mining slot ${slot.id} with ${slot.staked.length} assets:`,
          slot.staked.map(s => ({ type: s.type, asset_id: s.asset_id, boost: s.boost ?? null }))
        );
      } else {
        console.log(`[LiveAggregator] ⚠️ No staking data found for mining slot ${slot.id}`);
        slot.staked = [];
      }
    });

    console.log(
      `[LiveAggregator] 📊 Mining slots summary:`,
      miningSlots.map(s => ({
        id: s.id,
        state: s.state,
        stakedCount: s.staked.length,
        stakedTypes: s.staked.map(asset => asset.type),
        speedBoostPct: s.speedBoostPct || 0
      }))
    );

    // Populate staked assets for polishing slots
    polishingSlots.forEach(slot => {
      const slotData =
        stakingData.polishing?.[`slot${slot.id}`] ||
        stakingData.polishing?.[`slot_${slot.id}`];

      if (slotData) {
        console.log(`[LiveAggregator] 🎨 Populating polishing slot ${slot.id}:`, {
          hasTable: !!slotData.table,
          gemsCount: slotData.gems?.length || 0,
          slotDataKeys: Object.keys(slotData)
        });

        slot.staked = [];

        if (slotData.table) {
          const normalizedTable = normalizeAsset(slotData.table, 'table');
          if (normalizedTable) slot.staked.push(normalizedTable);
        }

        if (Array.isArray(slotData.gems)) {
          slotData.gems.forEach(gem => {
            const normalizedGem = normalizeAsset(gem, 'gem');
            if (normalizedGem) slot.staked.push(normalizedGem);
          });
        }

        console.log(
          `[LiveAggregator] ✅ Populated polishing slot ${slot.id} with ${slot.staked.length} assets:`,
          slot.staked.map(s => ({ type: s.type, asset_id: s.asset_id }))
        );
      } else {
        console.log(`[LiveAggregator] ⚠️ No staking data found for polishing slot ${slot.id}`);
        slot.staked = [];
      }
    });

    console.log(
      `[LiveAggregator] 📊 Polishing slots summary:`,
      polishingSlots.map(s => ({
        id: s.id,
        state: s.state,
        stakedCount: s.staked.length,
        stakedTypes: s.staked.map(asset => asset.type)
      }))
    );

    // 10. Fetch global runtime data
    const pricingRef = db.collection('runtime').doc('pricing');
    const pricingSnap = await pricingRef.get();
    const pricing = pricingSnap.exists ? pricingSnap.data() : {};

    const boostsRef = db.collection('city_boosts');
    const boostsSnap = await boostsRef.get();
    const boosts = boostsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 11. Build live data structure
    const liveData = {
      profile: liveProfile,
      gems,
      inventorySummary,
      speedboost: speedboost || {},
      miningSlots,
      polishingSlots,
      pricing: pricing || {},
      boosts: boosts || [],
      serverTime,
      lastUpdatedAt: serverTime
    };

    // 12. Final validation - ensure non-empty slots if unlocked
    const finalLiveData = { ...liveData };

    if (
      finalLiveData.profile.miningSlotsUnlocked >= 1 &&
      (!finalLiveData.miningSlots || finalLiveData.miningSlots.length === 0)
    ) {
      console.warn(
        `[LiveAggregator] ⚠️ miningSlots was empty despite ${finalLiveData.profile.miningSlotsUnlocked} unlocked - creating default slot`
      );
      finalLiveData.miningSlots = [{
        id: 1,
        jobId: null,
        state: 'idle',
        startedAt: null,
        finishAt: null,
        power: 0,
        effectiveDurationMs: null,
        baseDurationMs: null,
        slotSpeedBoostPct: 0,
        slotSpeedBoostMultiplier: 1,
        slotSpeedBoostAssetId: null,
        staked: []
      }];
    }

    if (
      finalLiveData.profile.polishingSlotsUnlocked >= 1 &&
      (!finalLiveData.polishingSlots || finalLiveData.polishingSlots.length === 0)
    ) {
      console.warn(
        `[LiveAggregator] ⚠️ polishingSlots was empty despite ${finalLiveData.profile.polishingSlotsUnlocked} unlocked - creating default slot`
      );
      finalLiveData.polishingSlots = [{
        id: 1,
        jobId: null,
        state: 'idle',
        startedAt: null,
        finishAt: null,
        power: 0,
        staked: []
      }];
    }

    // 13. Write to live document
    const liveRef = db.collection('players').doc(actor).collection('runtime').doc('live');
    await liveRef.set(finalLiveData);

    console.log(`[LiveAggregator] ✅ Live data structure for ${actor}:`, {
      hasProfile: !!finalLiveData.profile,
      miningSlotsUnlocked: finalLiveData.profile.miningSlotsUnlocked,
      polishingSlotsUnlocked: finalLiveData.profile.polishingSlotsUnlocked,
      miningSlotsCount: finalLiveData.miningSlots.length,
      polishingSlotsCount: finalLiveData.polishingSlots.length,
      miningSlotsEmptyVsUnlocked:
        finalLiveData.miningSlots.length === 0 && finalLiveData.profile.miningSlotsUnlocked > 0
          ? '❌ EMPTY but unlocked!'
          : '✅ OK',
      polishingSlotsEmptyVsUnlocked:
        finalLiveData.polishingSlots.length === 0 && finalLiveData.profile.polishingSlotsUnlocked > 0
          ? '❌ EMPTY but unlocked!'
          : '✅ OK',
      hasGems:
        !!finalLiveData.gems &&
        (Object.keys(finalLiveData.gems.rough || {}).length > 0 ||
         Object.keys(finalLiveData.gems.polished || {}).length > 0),
      hasInventorySummary: !!finalLiveData.inventorySummary,
      hasBoosts: Array.isArray(finalLiveData.boosts) && finalLiveData.boosts.length > 0,
      hasPricing: !!finalLiveData.pricing && Object.keys(finalLiveData.pricing).length > 0
    });

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
const rebuildPlayerLive = onRequest({ cors: true, region: 'us-central1' }, async (req, res) => {
  console.log(`[rebuildPlayerLive] 🚀 FUNCTION CALLED with body:`, JSON.stringify(req.body));
  try {
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