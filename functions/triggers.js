// functions/triggers.js
// Firestore triggers to maintain live data aggregates

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

try { admin.app(); } catch { admin.initializeApp(); }

const db = admin.firestore();
const { buildPlayerLiveData } = require('./modules/live-aggregator');

// NOTE:
// In the original version we tried to debounce rebuilds with setTimeout + Map.
// That pattern is unreliable in Cloud Functions because the process can be
// frozen/terminated after the handler returns. Here we just await the rebuilds
// directly; buildPlayerLiveData is idempotent and safe to call often.

// Trigger for player profile changes
const onPlayerProfileWrite = onDocumentWritten(
  'players/{actor}',
  async (event) => {
    const actor = event.params.actor;
    const cause = 'profile_update';
    console.log(`[Triggers] Profile update for ${actor}`);
    try {
      await buildPlayerLiveData(actor, cause);
    } catch (error) {
      console.error(`[Triggers] Failed to rebuild live data for ${actor}:`, error);
    }
  }
);

// Trigger for player inventory gems changes
const onPlayerGemsWrite = onDocumentWritten(
  'players/{actor}/inventory/gems',
  async (event) => {
    const actor = event.params.actor;
    const cause = 'gems_update';
    console.log(`[Triggers] Gems update for ${actor}`);
    try {
      await buildPlayerLiveData(actor, cause);
    } catch (error) {
      console.error(`[Triggers] Failed to rebuild live data for ${actor}:`, error);
    }
  }
);

// Trigger for player inventory summary changes
const onPlayerInventorySummaryWrite = onDocumentWritten(
  'players/{actor}/meta/inventory_summary',
  async (event) => {
    const actor = event.params.actor;
    const cause = 'inventory_summary_update';
    console.log(`[Triggers] Inventory summary update for ${actor}`);
    try {
      await buildPlayerLiveData(actor, cause);
    } catch (error) {
      console.error(`[Triggers] Failed to rebuild live data for ${actor}:`, error);
    }
  }
);

// Trigger for player speedboost changes
const onPlayerSpeedboostWrite = onDocumentWritten(
  'players/{actor}/inventory/speedboost',
  async (event) => {
    const actor = event.params.actor;
    const cause = 'speedboost_update';
    console.log(`[Triggers] Speedboost update for ${actor}`);
    try {
      await buildPlayerLiveData(actor, cause);
    } catch (error) {
      console.error(`[Triggers] Failed to rebuild live data for ${actor}:`, error);
    }
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
    try {
      await buildPlayerLiveData(actor, cause);
    } catch (error) {
      console.error(`[Triggers] Failed to rebuild live data for ${actor}:`, error);
    }
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
    try {
      await buildPlayerLiveData(actor, cause);
    } catch (error) {
      console.error(`[Triggers] Failed to rebuild live data for ${actor}:`, error);
    }
  }
);

// Trigger for staking data changes (LEGACY: /staking/{actor})
// If you fully migrated to players/{actor}/runtime/live.staked, you can remove this.
const onStakingWrite = onDocumentWritten(
  'staking/{actor}',
  async (event) => {
    const actor = event.params.actor;
    const cause = 'staking_update';
    console.log(`[Triggers] Staking data update for ${actor}`);
    try {
      await buildPlayerLiveData(actor, cause);
    } catch (error) {
      console.error(`[Triggers] Failed to rebuild live data for ${actor}:`, error);
    }
  }
);

// Trigger for global pricing changes
const onPricingWrite = onDocumentWritten(
  'runtime/pricing',
  async (event) => {
    const cause = 'global_pricing_update';
    console.log(`[Triggers] Global pricing update - rebuilding live data for recent players`);

    try {
      // Players active in the last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentPlayersQuery = db.collection('players')
        .where('lastSeenAt', '>', oneDayAgo)
        .limit(100);

      const recentPlayersSnap = await recentPlayersQuery.get();
      console.log(`[Triggers] Rebuilding live data for ${recentPlayersSnap.docs.length} recent players due to pricing change`);

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
    const cause = 'city_boosts_update';
    console.log(`[Triggers] City boosts update - rebuilding live data for recent players`);

    try {
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
  onCityBoostsWrite,
};