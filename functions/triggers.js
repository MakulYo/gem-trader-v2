// functions/triggers.js
// Firestore triggers to maintain live data aggregates

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { buildPlayerLiveData } = require('./modules/live-aggregator');

// Debounce configuration - prevent rapid successive rebuilds
const DEBOUNCE_MS = 2000; // 2 seconds
const debounceCache = new Map(); // actor -> timeoutId

function debounceLiveRebuild(actor, cause) {
  // Clear any existing timeout for this actor
  const existingTimeout = debounceCache.get(actor);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  // Set new timeout
  const timeoutId = setTimeout(async () => {
    try {
      await buildPlayerLiveData(actor, cause);
    } catch (error) {
      console.error(`[Triggers] Failed to rebuild live data for ${actor}:`, error);
    }
    debounceCache.delete(actor);
  }, DEBOUNCE_MS);

  debounceCache.set(actor, timeoutId);
}

// Trigger for player profile changes
const onPlayerProfileWrite = onDocumentWritten(
  'players/{actor}',
  async (event) => {
    const actor = event.params.actor;
    const cause = 'profile_update';
    console.log(`[Triggers] Profile update for ${actor}`);
    debounceLiveRebuild(actor, cause);
  }
);

// Trigger for player inventory gems changes
const onPlayerGemsWrite = onDocumentWritten(
  'players/{actor}/inventory/gems',
  async (event) => {
    const actor = event.params.actor;
    const cause = 'gems_update';
    console.log(`[Triggers] Gems update for ${actor}`);
    debounceLiveRebuild(actor, cause);
  }
);

// Trigger for player inventory summary changes
const onPlayerInventorySummaryWrite = onDocumentWritten(
  'players/{actor}/meta/inventory_summary',
  async (event) => {
    const actor = event.params.actor;
    const cause = 'inventory_summary_update';
    console.log(`[Triggers] Inventory summary update for ${actor}`);
    debounceLiveRebuild(actor, cause);
  }
);

// Trigger for player speedboost changes
const onPlayerSpeedboostWrite = onDocumentWritten(
  'players/{actor}/inventory/speedboost',
  async (event) => {
    const actor = event.params.actor;
    const cause = 'speedboost_update';
    console.log(`[Triggers] Speedboost update for ${actor}`);
    debounceLiveRebuild(actor, cause);
  }
);

// Trigger for mining active job changes
const onMiningActiveWrite = onDocumentWritten(
  'players/{actor}/mining_active/{jobId}',
  async (event) => {
    const actor = event.params.actor;
    const jobId = event.params.jobId;
    const cause = `mining_active_${jobId}`;
    console.log(`[Triggers] Mining active job ${jobId} update for ${actor}`);
    debounceLiveRebuild(actor, cause);
  }
);

// Trigger for polishing active job changes
const onPolishingActiveWrite = onDocumentWritten(
  'players/{actor}/polishing_active/{jobId}',
  async (event) => {
    const actor = event.params.actor;
    const jobId = event.params.jobId;
    const cause = `polishing_active_${jobId}`;
    console.log(`[Triggers] Polishing active job ${jobId} update for ${actor}`);
    debounceLiveRebuild(actor, cause);
  }
);

// Trigger for staking data changes
const onStakingWrite = onDocumentWritten(
  'staking/{actor}',
  async (event) => {
    const actor = event.params.actor;
    const cause = 'staking_update';
    console.log(`[Triggers] Staking data update for ${actor}`);
    debounceLiveRebuild(actor, cause);
  }
);

// Trigger for global pricing changes
const onPricingWrite = onDocumentWritten(
  'runtime/pricing',
  async (event) => {
    // This affects ALL players, so we need to find all active players
    // For now, we'll rebuild live data for any player who has been active recently
    // In production, you might want a more efficient approach like broadcasting an event
    const cause = 'global_pricing_update';
    console.log(`[Triggers] Global pricing update - rebuilding live data for all recent players`);

    try {
      const admin = require('firebase-admin');
      const db = admin.firestore();

      // Get players active in the last 24 hours (adjust as needed)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentPlayersQuery = db.collection('players')
        .where('lastSeenAt', '>', oneDayAgo)
        .limit(100); // Limit to prevent too many rebuilds

      const recentPlayersSnap = await recentPlayersQuery.get();

      console.log(`[Triggers] Rebuilding live data for ${recentPlayersSnap.docs.length} recent players due to pricing change`);

      // Rebuild for each recent player
      const rebuildPromises = recentPlayersSnap.docs.map(doc => {
        const actor = doc.id;
        return buildPlayerLiveData(actor, cause).catch(error => {
          console.error(`[Triggers] Failed to rebuild for ${actor}:`, error);
        });
      });

      await Promise.all(rebuildPromises);
    } catch (error) {
      console.error(`[Triggers] Failed to handle global pricing update:`, error);
    }
  }
);

// Trigger for city boosts changes
const onCityBoostsWrite = onDocumentWritten(
  'city_boosts/{boostId}',
  async (event) => {
    // Similar to pricing, this affects all players
    const cause = 'city_boosts_update';
    console.log(`[Triggers] City boosts update - rebuilding live data for all recent players`);

    try {
      const admin = require('firebase-admin');
      const db = admin.firestore();

      // Get players active in the last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentPlayersQuery = db.collection('players')
        .where('lastSeenAt', '>', oneDayAgo)
        .limit(100);

      const recentPlayersSnap = await recentPlayersQuery.get();

      console.log(`[Triggers] Rebuilding live data for ${recentPlayersSnap.docs.length} recent players due to boosts change`);

      const rebuildPromises = recentPlayersSnap.docs.map(doc => {
        const actor = doc.id;
        return buildPlayerLiveData(actor, cause).catch(error => {
          console.error(`[Triggers] Failed to rebuild for ${actor}:`, error);
        });
      });

      await Promise.all(rebuildPromises);
    } catch (error) {
      console.error(`[Triggers] Failed to handle city boosts update:`, error);
    }
  }
);

module.exports = {
  onPlayerProfileWrite,
  onPlayerGemsWrite,
  onPlayerInventorySummaryWrite,
  onPlayerSpeedboostWrite,
  onMiningActiveWrite,
  onPolishingActiveWrite,
  onStakingWrite,
  onPricingWrite,
  onCityBoostsWrite
};
