// TSDGEMS - Mining Page Script (Backend-Connected)

// Mining Constants (match backend)
// Dev environment: 1 minute, Prod: 3 hours
const isDev = window.location.hostname.includes('tsdgems-dev');
const MINING_DURATION_MS = isDev ? 1 * 60 * 1000 : 3 * 60 * 60 * 1000;
const MINING_COST_TSDM = 50;
const MAX_SLOTS = 10;

// Worker limits based on mine size
const WORKER_LIMITS = {
    'Small Mine': 10,
    'Medium Mine': 20,
    'Large Mine': 30
};

// Slot unlock costs (slot 1 is free, already unlocked)
const SLOT_UNLOCK_COSTS = [
    0,      // Slot 1 - Free/Already unlocked
    250,    // Slot 2
    500,    // Slot 3
    1000,   // Slot 4
    2000,   // Slot 5
    4000,   // Slot 6
    8000,   // Slot 7
    16000,  // Slot 8
    20000,  // Slot 9
    25000   // Slot 10
];

// Speedboost mapping (template_id -> boost percentage)
const SPEEDBOOST_BY_TEMPLATE = {
    '901514': { boost: 0.0625, image: 'Rusty_Minecart.png', name: 'Rusty Minecart' },
    '901513': { boost: 0.125,  image: 'Greased_Minecart.png', name: 'Greased Minecart' },
    '901512': { boost: 0.25,   image: 'Refined_Minecart.png', name: 'Refined Minecart' },
    '901510': { boost: 0.5,    image: 'Arcane_Minecart.png', name: 'Arcane Minecart' },
    '901511': { boost: 1.0,    image: 'Golden_Express.png', name: 'Golden Express' }
};

function getSpeedboostImage(templateId) {
    const info = SPEEDBOOST_BY_TEMPLATE[String(templateId)];
    return info && info.image ? `assets/images/${info.image}` : null;
}

function getSpeedboostName(templateId, fallbackName) {
    const info = SPEEDBOOST_BY_TEMPLATE[String(templateId)];
    return (info && info.name) || fallbackName || 'Speedboost';
}

class MiningGame extends TSDGEMSGame {
    constructor() {
        super();

        window.game = this;
        window.tsdgemsGame = this;
        
        console.log('[Mining] ========================================');
        console.log('[Mining] 🎮 MiningGame Constructor');
        console.log('[Mining] ========================================');
        
        this.backendService = window.backendService;
        this.isLoggedIn = false;
        this.currentActor = null;
        this.activeJobs = [];
        this.effectiveSlots = 0;
        this.timerInterval = null;
        this.inventoryData = null;
        this.mineNFTs = [];
        this.workerNFTs = [];
        this.speedboostNFTs = [];
        this.selectedSlotForStaking = null;
        this.stakedMines = {}; // { slotNum: { template_id, name, mp } }
        this.stakedWorkers = {}; // { slotNum: [worker objects] }
        this.stakedSpeedboosts = {}; // { slotNum: speedboost object or array }
        this.selectedWorkers = []; // For multi-selection when staking
        this.selectedWorkersForUnstake = new Set(); // For multi-selection when unstaking
        this.completedJobsRendered = new Set(); // Track jobs that already triggered a completion re-render
        this.pendingCompletionJobs = new Set(); // Jobs we optimistically removed
        this.loadingOverlayDepth = 0;

        this.awaitingInitialRealtime = false;
        this.initialRealtimePromise = null;
        this.initialRealtimeResolver = null;
        this.initialRealtimeReject = null;
        this.initialRealtimeTimer = null;
        this.realtimeHandlersRegistered = false;
        this.realtimeData = this.getEmptyRealtimeState();

        // Mobile optimization
        this.isMobile = this.detectMobile();

        // Realtime: Removed rebuild live data button - no longer needed with realtime architecture
        setTimeout(() => {
          const rebuildBtn = document.getElementById('rebuild-live-btn');
          if (rebuildBtn) {
            rebuildBtn.style.display = 'none'; // Hide the button
          }
        }, 1000);

        if (this.isMobile) {
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    console.log('[Mining] 📱 Mobile page hidden, clearing mining cache');
                    this.clearMiningCache();
                }
            });
        }

        this.init();

        // 🔥 Setup live data listeners for instant updates
        this.setupLiveDataListeners();
    }

    detectMobile() {
        // Check for mobile devices
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isMobileDevice = /android|avantgo|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(userAgent);

        // Also check screen size as backup
        const isSmallScreen = window.innerWidth <= 768 || window.innerHeight <= 600;

        return isMobileDevice || isSmallScreen;
    }

    clearMiningCache() {
        // Clear mining data to free memory on mobile
        this.inventoryData = null;
        this.mineNFTs = [];
        this.workerNFTs = [];
        this.speedboostNFTs = [];

        // Clear DataManager cache for mining-related data
        if (window.dataManager) {
            window.dataManager.invalidate('inventory');
            window.dataManager.invalidate('stakedAssets');
        }

        console.log('[Mining] 📱 Mining cache cleared');
    }

    // 🔥 Setup listeners for live mining slots data
    setupLiveDataListeners() {
        if (this.realtimeHandlersRegistered) {
            return;
        }

        this.realtimeHandlersRegistered = true;

        this.onRealtimeLive = (event) => {
            const { actor, live } = event.detail || {};
            if (!this.isEventForCurrentActor(actor)) {
                return;
            }
            console.log('[MiningRealtime] live aggregate received, miningSlots:', live?.miningSlots?.length || 0);
            this.mergeLiveData(live);
        };

        this.onRealtimeProfile = (event) => {
            const { actor, profile } = event.detail || {};
            if (!this.isEventForCurrentActor(actor) || !profile) {
                return;
            }
            this.applyProfileFromRealtime(profile);
        };

        this.onRealtimeMiningSlots = (event) => {
            const { actor, slots } = event.detail || {};
            if (!this.isEventForCurrentActor(actor)) {
                return;
            }
            console.log('[MiningRealtime] slots update, slots:', slots?.map(slot => ({
                id: slot.id,
                state: slot.state,
                stakedCount: slot.staked?.length || 0
            })));
            this.applyMiningSlotsFromRealtime(slots);
        };

        this.onRealtimeInventorySummary = (event) => {
            const { actor, summary } = event.detail || {};
            if (!this.isEventForCurrentActor(actor)) {
                return;
            }
            this.applyInventorySummaryFromRealtime(summary);
        };

        this.onRealtimeInventoryGems = (event) => {
            const { actor, gems } = event.detail || {};
            if (!this.isEventForCurrentActor(actor)) {
                return;
            }
            this.applyGemsFromRealtime(gems);
        };

        this.onRealtimeInventorySpeedboost = (event) => {
            const { actor, speedboost } = event.detail || {};
            if (!this.isEventForCurrentActor(actor)) {
                return;
            }
            this.realtimeData.speedboost = speedboost || null;
            if (this.realtimeData.inventory) {
                this.applyInventoryFromRealtime({ ...this.realtimeData.inventory, speedboostDetails: speedboost || this.realtimeData.inventory.speedboostDetails });
            }
        };

        window.addEventListener('realtime:live', this.onRealtimeLive);
        window.addEventListener('realtime:profile', this.onRealtimeProfile);
        window.addEventListener('realtime:mining-slots', this.onRealtimeMiningSlots);
        window.addEventListener('realtime:inventory-summary', this.onRealtimeInventorySummary);
        window.addEventListener('realtime:inventory-gems', this.onRealtimeInventoryGems);
        window.addEventListener('realtime:inventory-speedboost', this.onRealtimeInventorySpeedboost);
    }

    cleanupRealtimeListeners() {
        if (!this.realtimeHandlersRegistered) {
            return;
        }

        console.log('[Mining] Cleaning up realtime event listeners');
        
        window.removeEventListener('realtime:live', this.onRealtimeLive);
        window.removeEventListener('realtime:profile', this.onRealtimeProfile);
        window.removeEventListener('realtime:mining-slots', this.onRealtimeMiningSlots);
        window.removeEventListener('realtime:inventory-summary', this.onRealtimeInventorySummary);
        window.removeEventListener('realtime:inventory-gems', this.onRealtimeInventoryGems);
        window.removeEventListener('realtime:inventory-speedboost', this.onRealtimeInventorySpeedboost);
        
        this.realtimeHandlersRegistered = false;
    }

    getEmptyRealtimeState() {
        return {
            live: null,
            profile: null,
            miningSlots: [],
            inventory: null,
            inventorySummary: null,
            gems: null,
            speedboost: null
        };
    }

    prepareMiningForRealtime() {
        this.showLoadingState(true);
    }

    clearInitialRealtimeTimer() {
        if (this.initialRealtimeTimer) {
            clearTimeout(this.initialRealtimeTimer);
            this.initialRealtimeTimer = null;
        }
    }

    handleRealtimeStartFailure(error) {
        console.error('[Mining] Failed to start realtime mining stream:', error);
        this.clearInitialRealtimeTimer();
        this.awaitingInitialRealtime = false;
        this.showLoadingState(false);
        this.rejectInitialRealtime(error);
        this.showNotification('Failed to start realtime mining data: ' + error.message, 'error');
    }

    resetInitialRealtimePromise() {
        this.initialRealtimePromise = null;
        this.initialRealtimeResolver = null;
        this.initialRealtimeReject = null;
    }

    resolveInitialRealtime() {
        if (!this.initialRealtimePromise) {
            return;
        }
        if (this.initialRealtimeResolver) {
            this.initialRealtimeResolver();
        }
        this.resetInitialRealtimePromise();
    }

    rejectInitialRealtime(error) {
        if (!this.initialRealtimePromise) {
            return;
        }
        if (this.initialRealtimeReject) {
            this.initialRealtimeReject(error);
        }
        this.resetInitialRealtimePromise();
    }

    cleanupRealtimeSession() {
        this.cleanupRealtimeListeners();
        this.clearInitialRealtimeTimer();
        this.awaitingInitialRealtime = false;
        this.resetInitialRealtimePromise();
        this.realtimeData = this.getEmptyRealtimeState();
        this.activeJobs = [];
        this.stakedMines = {};
        this.stakedWorkers = {};
        this.inventoryData = null;
        this.mineNFTs = [];
        this.workerNFTs = [];
        this.speedboostNFTs = [];
        this.pendingCompletionJobs = new Set();
        this.completedJobsRendered = new Set();
        this.loadingOverlayDepth = 0;
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    isEventForCurrentActor(actor) {
        return Boolean(this.currentActor) && actor === this.currentActor;
    }

    startRealtimeForActor(actor) {
        if (!actor) {
            console.warn('[Mining] No actor provided, skipping realtime start');
            return Promise.resolve();
        }

        // Realtime: Check if global realtime is already running for this actor
        const sameActor = this.currentActor === actor;
        const globalRealtimeActive = window.TSDRealtime && window.TSDRealtime._actor === actor;
        
        // Realtime: If global realtime is active, use cached data for instant load
        if (globalRealtimeActive && window.TSDRealtime._last && window.TSDRealtime._last.live) {
            console.log('[MiningInit] TSDRealtime ready for actor:', actor, '- using cached live data');
            const cachedLive = window.TSDRealtime._last.live;
            this.mergeLiveData(cachedLive);
            // Mark as initialized immediately if we have data (even if empty)
            this.markRealtimeInitialized();
            return Promise.resolve();
        }
        
        if (sameActor && !this.awaitingInitialRealtime) {
            console.log('[Mining] Realtime mining data already active');
            return Promise.resolve();
        }

        this.currentActor = actor;
        this.isLoggedIn = true;

        // Realtime: Don't start TSDRealtime here - it's started globally in wallet.js
        // Just wait for the global realtime to emit events
        // Realtime: Don't clean up session if we're about to prepare for realtime
        // The cleanup should only happen on wallet disconnect, not on session restore
        // this.cleanupRealtimeSession();
        this.prepareMiningForRealtime();

        this.awaitingInitialRealtime = true;
        this.initialRealtimePromise = new Promise((resolve, reject) => {
            this.initialRealtimeResolver = resolve;
            this.initialRealtimeReject = reject;
        });

        // Realtime: Timeout fallback - initialize with empty state after 5 seconds
        this.initialRealtimeTimer = setTimeout(() => {
            if (this.awaitingInitialRealtime) {
                console.warn('[MiningInit] Timeout - starting with empty state (no realtime data received)');
                // Initialize with empty state for new accounts
                this.effectiveSlots = 0;
                this.realtimeData.miningSlots = [];
                this.realtimeData.profile = { miningSlotsUnlocked: 0, balances: { TSDM: 0 } };
                this.markRealtimeInitialized();
                this.showNotification('Mining initialized. Waiting for data...', 'info');
            }
        }, 5000);

        // Realtime: Check if global realtime is already running and has data
        if (window.TSDRealtime && window.TSDRealtime._actor === actor) {
            console.log('[MiningInit] TSDRealtime already running globally for actor:', actor);
            // If we have cached data, use it immediately
            if (window.TSDRealtime._last && window.TSDRealtime._last.live) {
                console.log('[MiningInit] Using cached live data for instant load');
                this.mergeLiveData(window.TSDRealtime._last.live);
            }
        } else {
            console.log('[MiningInit] Waiting for global TSDRealtime to start (should be started by wallet.js)');
        }

        return this.initialRealtimePromise;
    }

    markRealtimeInitialized() {
        if (!this.awaitingInitialRealtime) {
            return;
        }
        console.log('[MiningInit] Clearing loading state');
        this.awaitingInitialRealtime = false;
        this.clearInitialRealtimeTimer();
        this.showLoadingState(false);
        this.resolveInitialRealtime();
    }

    mergeLiveData(live) {
        if (!live || typeof live !== 'object') {
            console.log('[MiningInit] mergeLiveData: live data is empty or invalid');
            // Realtime: For new accounts, initialize with empty state
            this.effectiveSlots = 0;
            this.realtimeData.miningSlots = [];
            this.markRealtimeInitialized();
            return;
        }

        console.log('[MiningInit] live.miningSlots =', live.miningSlots?.length ?? 0, ', miningSlotsUnlocked =', live.profile?.miningSlotsUnlocked ?? 0, ', hasStaked =', !!live.staked?.mining);
        this.realtimeData.live = live;

        // Realtime: Always apply profile (even if empty) to set miningSlotsUnlocked
        if (live.profile) {
            this.applyProfileFromRealtime(live.profile);
        } else {
            // New account - no profile yet, initialize with defaults
            console.log('[MiningInit] No profile in live data, initializing with defaults');
            this.effectiveSlots = 0;
            this.realtimeData.profile = { miningSlotsUnlocked: 0, balances: { TSDM: 0 } };
            this.markRealtimeInitialized();
        }
        
        // Realtime: Handle miningSlots - treat undefined as empty array
        // New backend structure: staking data is in live.staked.mining, but slots should already have staked items
        if (live.miningSlots) {
            this.applyMiningSlotsFromRealtime(live.miningSlots);
        } else {
            // New account - no mining slots yet
            console.log('[MiningInit] No miningSlots in live data, using empty array');
            this.applyMiningSlotsFromRealtime([]);
        }
        
        // New backend structure: Also check live.staked.mining as fallback if slots don't have staked data
        if (live.staked?.mining && typeof live.staked.mining === 'object') {
            console.log('[MiningInit] Found live.staked.mining, ensuring staking data is applied');
            // The staking data should already be in the slots, but we can use this as a fallback
            // updateStakedAssetsFromLive will handle the actual staking data from slots
        }
        
        if (live.inventory) {
            this.applyInventoryFromRealtime(live.inventory);
        } else if (live.inventorySummary) {
            this.applyInventorySummaryFromRealtime(live.inventorySummary);
        }
        if (live.speedboost) {
            this.realtimeData.speedboost = live.speedboost;
        }
        if (live.gems) {
            this.applyGemsFromRealtime(live.gems);
        }
    }

    // Realtime: Update profile data from realtime events
    applyProfileFromRealtime(profile) {
        // Realtime: Handle undefined/null profile for new accounts
        if (!profile || typeof profile !== 'object') {
            console.log('[MiningInit] applyProfileFromRealtime: profile is empty, using defaults');
            profile = { miningSlotsUnlocked: 0, balances: { TSDM: 0 } };
        }

        this.realtimeData.profile = profile;

        // Realtime: Get currency from live.profile only
        const rawCurrency = Number(profile.ingameCurrency ?? profile.ingame_currency ?? 0);
        const previousCurrency = Number(this.currentGameDollars ?? 0);
        const sanitizedCurrency = Number.isFinite(rawCurrency) ? rawCurrency : 0;
        const effectiveCurrency = sanitizedCurrency <= 0 && previousCurrency > 0
            ? previousCurrency
            : sanitizedCurrency;
        this.updateGameDollars(effectiveCurrency, false);

        const tsdmBalance = document.getElementById('tsdm-balance-mining');
        if (tsdmBalance) {
            // Realtime: Get TSDM balance from live.profile.balances only
            const tsdm = Number(profile.balances?.TSDM ?? profile.balances?.tsdm ?? 0);
            tsdmBalance.textContent = tsdm.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }

        // Realtime: Get mining slots unlocked count from live.profile only - NO FALLBACKS
        // Must use only live.profile.miningSlotsUnlocked, no assumptions about MAX_SLOTS
        // Realtime: Treat undefined as 0 for new accounts
        const unlocked = Number(profile.miningSlotsUnlocked ?? 0);
        const previousSlots = this.effectiveSlots;
        // Realtime: Use unlocked count directly from profile, don't cap at MAX_SLOTS
        this.effectiveSlots = Math.max(0, unlocked); // Ensure non-negative
        console.log('[MiningInit] miningSlotsUnlocked =', unlocked, ', effectiveSlots =', this.effectiveSlots);
        if (unlocked !== previousSlots) {
            this.renderMiningSlots();
        }

        // Realtime: Always mark as initialized after receiving profile (even if empty)
        this.markRealtimeInitialized();
    }

    // Realtime: render mining slots from live.miningSlots only
    applyMiningSlotsFromRealtime(slots) {
        // Realtime: Handle undefined/null slots for new accounts - treat as empty array
        if (!Array.isArray(slots)) {
            console.log('[MiningInit] applyMiningSlotsFromRealtime: slots is not an array, using empty array:', slots);
            slots = [];
        }
        console.log('[MiningInit] Clearing loading state - mining slots count:', slots.length);
        console.log('[MiningRealtime] Applying mining slots from realtime, count:', slots.length);
        this.realtimeData.miningSlots = slots;
        this.updateMiningSlotsFromLive(slots);
        this.updateStakedAssetsFromLive(slots);
        this.updateMiningStats();
        this.startTimerUpdates();
        // Immediately update timers after applying realtime data
        this.updateTimersImmediately();
        // Realtime: Mark as initialized even if slots array is empty (for new accounts)
        this.markRealtimeInitialized();
    }

    applyInventoryFromRealtime(inventoryData) {
        if (!inventoryData || typeof inventoryData !== 'object') {
            return;
        }

        const merged = {
            ...(this.realtimeData.inventory || {}),
            ...inventoryData
        };

        if (!merged.speedboostDetails && this.realtimeData.speedboost) {
            merged.speedboostDetails = this.realtimeData.speedboost;
        }

        this.realtimeData.inventory = merged;
        this.inventoryData = merged;
        this.updateInventoryStructures(merged);
        this.renderMiningSlots(true);
        this.updateMiningStats();
    }

    applyInventorySummaryFromRealtime(summary) {
        if (!summary || typeof summary !== 'object') {
            return;
        }

        this.realtimeData.inventorySummary = summary;

        if (summary.inventory) {
            this.applyInventoryFromRealtime(summary.inventory);
        } else if (!this.realtimeData.inventory || Object.keys(this.realtimeData.inventory).length === 0) {
            this.applyInventoryFromRealtime(summary);
        } else {
            this.applyInventoryFromRealtime({ ...this.realtimeData.inventory, ...summary });
        }
    }

    applyGemsFromRealtime(gems) {
        if (!gems || typeof gems !== 'object') {
            return;
        }
        this.realtimeData.gems = gems;
    }

    // Realtime: Update mining slots from live data (timing/state only)
    updateMiningSlotsFromLive(slots) {
        // Guard: ensure slots is a valid array
        if (!Array.isArray(slots)) {
            console.warn('[Mining] ⚠️ Invalid slots data in updateMiningSlotsFromLive, using empty array:', slots);
            slots = [];
        }

        console.log('[MiningRealtime] Updating mining slots timing/state from live data, slots count:', slots.length);

        // Convert live slots format to activeJobs format (timing/state only)
        // Guard: filter out invalid slots and ensure slot.id exists
        // Realtime: Use actual jobId from live.miningSlots (set by live-aggregator)
        const activeJobs = slots
            .filter(slot => {
                if (!slot || typeof slot !== 'object') return false;
                if (slot.id === undefined || slot.id === null) return false;
                return slot.state === 'active' || slot.state === 'running';
            })
            .map(slot => ({
                jobId: slot.jobId || null, // Use real jobId from live doc, not fake one
                slotId: `slot_${slot.id}`,
                slotNum: slot.id,
                startedAt: slot.startedAt || null,
                finishAt: slot.finishAt || null,
                power: slot.power || 0,
                state: slot.state || 'idle',
                slotMiningPower: slot.power || 0 // For reward estimation
            }));

        this.activeJobs = activeJobs;
        console.log('[MiningRealtime] Active jobs from live data:', this.activeJobs.length);

        // Clean up any pending/completed job flags that no longer exist in live data
        const activeJobIds = new Set(this.activeJobs.map(job => job.jobId).filter(Boolean));
        if (this.pendingCompletionJobs && this.pendingCompletionJobs.size > 0) {
            Array.from(this.pendingCompletionJobs).forEach(jobId => {
                if (!activeJobIds.has(jobId)) {
                    this.pendingCompletionJobs.delete(jobId);
                }
            });
        }
        if (this.completedJobsRendered && this.completedJobsRendered.size > 0) {
            Array.from(this.completedJobsRendered).forEach(jobId => {
                if (!activeJobIds.has(jobId)) {
                    this.completedJobsRendered.delete(jobId);
                }
            });
        }

        // Note: Asset updates are handled separately by updateStakedAssetsFromLive
        // Only re-render if we have valid data
        if (this.stakedMines !== undefined && this.stakedWorkers !== undefined) {
            // Force immediate render when slots change from realtime
            this.renderMiningSlots(true);
        }
    }

    // Realtime: Update staked assets from live data
    updateStakedAssetsFromLive(slots) {
        // Guard: ensure slots is a valid array
        if (!Array.isArray(slots)) {
            console.warn('[Mining] ⚠️ Invalid slots data in updateStakedAssetsFromLive, using empty array:', slots);
            slots = [];
        }

        console.log('[MiningRealtime] Updating staked assets from live data, slots count:', slots.length);

        // Reset staked assets
        this.stakedMines = {};
        this.stakedWorkers = {};
        this.stakedSpeedboosts = {};

        slots.forEach(slot => {
            // Guard: skip invalid slot data
            if (!slot || typeof slot !== 'object') {
                return;
            }

            // Guard: ensure slot.id exists and is a valid number
            const slotNum = slot.id;
            if (slotNum === undefined || slotNum === null || isNaN(Number(slotNum))) {
                console.warn('[Mining] ⚠️ Invalid slot ID, skipping slot:', slot);
                return;
            }

            // Guard: ensure staked is an array
            if (!slot.staked || !Array.isArray(slot.staked)) {
                // Slot exists but has no staked items - this is valid, just skip
                return;
            }

            const mines = slot.staked.filter(asset => asset && asset.type === 'mine');
            const workers = slot.staked.filter(asset => asset && asset.type === 'worker');
            const speedboosts = slot.staked.filter(asset => asset && asset.type === 'speedboost');

            if (mines.length > 0) {
                this.stakedMines[slotNum] = mines[0]; // Usually only one mine per slot
                console.log(`[Mining] ✅ Slot ${slotNum} has staked mine:`, mines[0].asset_id);
            }

            if (workers.length > 0) {
                this.stakedWorkers[slotNum] = workers;
                console.log(`[Mining] ✅ Slot ${slotNum} has ${workers.length} staked workers:`, workers.map(w => w.asset_id));
            }

            let speedboost = null;
            if (slot.speedBoost) {
                speedboost = slot.speedBoost;
            } else if (speedboosts.length > 0) {
                speedboost = speedboosts[0];
            }

            if (speedboost) {
                const boostValue = typeof speedboost.boost === 'number'
                    ? speedboost.boost
                    : (typeof speedboost.multiplier === 'number' ? (speedboost.multiplier - 1) : 0);
                this.stakedSpeedboosts[slotNum] = speedboost;
                console.log(`[Mining] ✅ Slot ${slotNum} has speedboost ${speedboost.asset_id} with ${(boostValue * 100).toFixed(1)}% boost`);
            }
        });

        console.log(`[Mining] ✅ Updated staked assets - mines: ${Object.keys(this.stakedMines).length}, workers: ${Object.keys(this.stakedWorkers).length}, speedboosts: ${Object.keys(this.stakedSpeedboosts).length}`);
        console.log(`[Mining] 📊 Staked assets by slot:`, {
            mines: Object.keys(this.stakedMines),
            workers: Object.keys(this.stakedWorkers),
            speedboosts: Object.keys(this.stakedSpeedboosts)
        });

        // Re-render to show updated staked assets (force immediate update)
        this.renderMiningSlots(true);
    }

    init() {
        console.log('[Mining] Running init()...');
        this.setupWalletIntegration();
        this.setupWalletEventListeners();
        
        // Check URL parameters for test mode
        const urlParams = new URLSearchParams(window.location.search);
        const testMode = urlParams.get('test');
        const testActor = urlParams.get('actor') || 'lucas3333555';
        
        if (testMode === 'true') {
            console.log('[Mining] 🧪 TEST MODE activated with actor:', testActor);
            this.showNotification(`🧪 Test Mode: Loading data for ${testActor}`, 'info');
            
            setTimeout(async () => {
                try {
            this.currentActor = testActor;
            this.isLoggedIn = true;
            // Test mode: bypass realtime for manual testing
            await this.loadMiningData(testActor);
                } catch (error) {
                    console.error('[Mining] Test mode failed:', error);
                    this.showNotification('Test mode failed: ' + error.message, 'error');
                }
            }, 500);
        } else {
        this.showNotification('Connect your wallet to access mining operations', 'info');
        }
        
        console.log('[Mining] Init complete, listeners registered, waiting for live data...');
    }

    setupWalletEventListeners() {
        console.log('[Mining] Setting up wallet event listeners...');
        
        // Listen for wallet connection
        window.addEventListener('wallet-connected', async (event) => {
            const { actor } = event.detail;
            console.log('[Mining] 🔗 Wallet connected event received, actor:', actor);
            
            if (!actor) return;
            
            this.currentActor = actor;
            this.isLoggedIn = true;
            
            await this.loadMiningData(actor);
        });
        
        // Listen for restored session
        window.addEventListener('wallet-session-restored', async (event) => {
            const { actor } = event.detail;
            console.log('[Mining] 🔄 Wallet session restored event received, actor:', actor);
            
            if (!actor) return;
            
            this.currentActor = actor;
            this.isLoggedIn = true;
            
            const connectBtn = document.getElementById('connectWalletBtn');
            if (connectBtn) {
                // Let wallet.js control the button label; only disable here
                connectBtn.disabled = true;
            }
            
            this.showNotification(`🔄 Welcome back, ${actor}!`, 'info');
            await this.loadMiningData(actor);
        });
        
        console.log('[Mining] ✅ Wallet event listeners registered');
        
        // Check if wallet already has session
        setTimeout(() => {
            if (window.walletSessionInfo && window.walletSessionInfo.actor && !this.currentActor) {
                const actor = window.walletSessionInfo.actor;
                console.log('[Mining] 🔍 Found existing wallet session:', actor);
                this.currentActor = actor;
                this.isLoggedIn = true;
                
                const connectBtn = document.getElementById('connectWalletBtn');
                if (connectBtn) {
                    connectBtn.disabled = true;
                }
                
                this.showNotification(`🔄 Welcome back, ${actor}!`, 'info');
                this.loadMiningData(actor);
            }
        }, 200);
    }


    setupWalletIntegration() {
        console.log('[Mining] Setting up wallet integration...');
        
        const connectBtn = document.getElementById('connectWalletBtn');
        if (connectBtn) {
            const newConnectBtn = connectBtn.cloneNode(true);
            connectBtn.parentNode.replaceChild(newConnectBtn, connectBtn);
            
            newConnectBtn.addEventListener('click', async () => {
                await this.connectWallet();
            });
        }
        
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            const newLogoutBtn = logoutBtn.cloneNode(true);
            logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
            
            newLogoutBtn.addEventListener('click', async () => {
                await this.disconnectWallet();
            });
        }
        
        // Realtime: Removed refresh button - data updates automatically via realtime
        const refreshBtn = document.getElementById('refresh-mining-btn');
        if (refreshBtn) {
            refreshBtn.style.display = 'none'; // Hide the button
        }
    }
    
    async refreshInventory() {
        if (!this.currentActor) {
            this.showNotification('Connect your wallet first!', 'warning');
            return;
        }

        this.showNotification('Inventory updates automatically via realtime stream.', 'info');
    }

    async connectWallet() {
        const connectBtn = document.getElementById('connectWalletBtn');
        const originalText = connectBtn ? connectBtn.innerHTML : '';
        
        try {
            console.log('[Mining] Starting wallet connection...');
            
            if (connectBtn) {
                connectBtn.disabled = true;
                connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
            }
            
            this.showNotification('🔗 Connecting to wallet...', 'info');
            
            const actor = await window.walletConnect();
            console.log('[Mining] Wallet connected, actor:', actor);
            
            if (!actor) {
                throw new Error('No actor returned from wallet');
            }

            this.currentActor = actor;
            this.isLoggedIn = true;

            // Button label handled by wallet.js
            
            this.showNotification(`✅ Connected as ${actor}`, 'success');
            
            await this.loadMiningData(actor);
            
        } catch (error) {
            console.error('[Mining] Wallet connection failed:', error);
            
            if (connectBtn) {
                connectBtn.disabled = false;
                connectBtn.innerHTML = originalText;
            }
            
            this.showNotification('❌ Failed to connect wallet: ' + error.message, 'error');
        }
    }

    async loadMiningData(actor) {
        console.log('[MiningLegacyLoader] loadMiningData called - now just starts realtime for actor:', actor);
        if (!actor) {
            console.warn('[Mining] loadMiningData called without actor');
            return;
        }

        if (this.awaitingInitialRealtime && this.currentActor === actor && this.initialRealtimePromise) {
            console.log('[Mining] Realtime load already in progress - waiting for next update');
            return this.initialRealtimePromise;
        }

        return this.startRealtimeForActor(actor);
    }

    // LEGACY FUNCTIONS - NO LONGER USED
    // Mining UI is now driven purely by TSDRealtime events (realtime:live / realtime:mining-slots)
    // These functions were previously used for manual data fetching but are now redundant

    /*
    async fetchActiveMiningJobs(actor) {
        console.log('[Mining] fetchActiveMiningJobs relying on realtime state');
        if (actor && this.currentActor && actor !== this.currentActor) {
            console.warn('[Mining] fetchActiveMiningJobs actor mismatch, returning empty jobs');
            return { jobs: [] };
        }
        return { jobs: Array.isArray(this.activeJobs) ? this.activeJobs : [] };
    }

    async fetchInventoryData(actor) {
        console.log('[Mining] fetchInventoryData relying on realtime inventory snapshot');
        if (actor && this.currentActor && actor !== this.currentActor) {
            return null;
        }
        return this.inventoryData;
    }

    async loadStakedAssets(actor, preloadedResponse = null) {
        console.log('[Mining] loadStakedAssets relying on realtime slots');
        if (actor && this.currentActor && actor !== this.currentActor) {
            return {};
        }

        if (preloadedResponse && preloadedResponse.stakingData && preloadedResponse.stakingData.mining) {
            const slots = Object.entries(preloadedResponse.stakingData.mining).map(([slotKey, slotData]) => {
                const slotNum = parseInt(slotKey.replace('slot', ''), 10);
                return {
                    id: slotNum,
                    staked: this.normalizeStakedItems(slotData)
                };
            });
            this.updateStakedAssetsFromLive(slots);
            this.updateMiningStats();
            return preloadedResponse.stakingData;
        }

        if (Array.isArray(this.realtimeData.miningSlots)) {
            this.updateStakedAssetsFromLive(this.realtimeData.miningSlots);
            this.updateMiningStats();
        }

        return {
            mining: this.stakedMines,
            workers: this.stakedWorkers
        };
    }
    */

    normalizeStakedItems(slotData) {
        if (!slotData) {
            return [];
        }

        const collected = [];
        if (slotData.mine) {
            collected.push({ type: 'mine', ...slotData.mine });
        }
        if (Array.isArray(slotData.workers)) {
            slotData.workers.forEach(worker => collected.push({ type: 'worker', ...worker }));
        }
        if (Array.isArray(slotData.speedboost)) {
            slotData.speedboost.forEach(boost => collected.push({ type: 'speedboost', ...boost }));
        }
        return collected;
    }

    /**
     * Extract all staked asset IDs from staking data
     * @returns {Set<string>} Set of staked asset_ids
     */
    getStakedAssetIds() {
        const stakedAssetIds = new Set();
        
        // Add staked mines
        Object.values(this.stakedMines).forEach(mine => {
            if (mine.asset_id) {
                stakedAssetIds.add(String(mine.asset_id));
            }
        });
        
        // Add staked workers
        Object.values(this.stakedWorkers).forEach(workers => {
            if (Array.isArray(workers)) {
                workers.forEach(worker => {
                    if (worker.asset_id) {
                        stakedAssetIds.add(String(worker.asset_id));
                    }
                });
            }
        });

        // Add staked speedboosts
        // Guard: ensure stakedSpeedboosts is initialized
        if (this.stakedSpeedboosts) {
            Object.values(this.stakedSpeedboosts).forEach(speedboostRaw => {
                const speedboost = Array.isArray(speedboostRaw) ? speedboostRaw[0] : speedboostRaw;
                if (speedboost && speedboost.asset_id) {
                    stakedAssetIds.add(String(speedboost.asset_id));
                }
            });
        }
        
        console.log('[Mining] Found', stakedAssetIds.size, 'staked asset IDs');
        return stakedAssetIds;
    }

    renderMiningSlots(forceImmediate = false) {
        // Use debouncing to prevent rapid re-renders, but allow forcing immediate updates
        const now = Date.now();
        if (!forceImmediate && this._lastRenderTime && (now - this._lastRenderTime) < 200) {
            // Skip render if last render was less than 200ms ago (unless forced)
            console.log('[Mining] Skipping rapid render');
            return;
        }
        this._lastRenderTime = now;

        this._doRenderMiningSlots();
        // Immediately update timers after rendering
        this.updateTimersImmediately();
    }

    renderSpeedboostSlots() {
        const slotsGrid = document.getElementById('speedboost-slots-grid');
        if (!slotsGrid) {
            console.warn('[Mining] No speedboost slots grid element found');
            return;
        }

        console.log('[Mining] Rendering speedboost slots...');

        const slots = [];
        for (let i = 0; i < MAX_SLOTS; i++) {
            const slotNum = i + 1;
            const isMiningSlotUnlocked = i < this.effectiveSlots;
            // Guard: ensure stakedSpeedboosts is initialized
            const rawSpeedboost = (this.stakedSpeedboosts && this.stakedSpeedboosts[slotNum]) || null;
            const stakedSpeedboost = rawSpeedboost ? (Array.isArray(rawSpeedboost) ? rawSpeedboost[0] : rawSpeedboost) : null;
            const stakedMine = this.stakedMines[slotNum];

            slots.push({
                slotNum,
                isMiningSlotUnlocked,
                stakedSpeedboost,
                stakedMine
            });
        }

        slotsGrid.innerHTML = slots.map(slot => {
            const canUseSpeedboost = slot.isMiningSlotUnlocked;
            const slotStatus = canUseSpeedboost ? (slot.stakedSpeedboost ? 'staked' : 'empty') : 'locked';

            const mineName = slot.stakedMine && slot.stakedMine.name ? slot.stakedMine.name : 'No mine staked';
            let mineMP = Number(slot.stakedMine && slot.stakedMine.mp ? slot.stakedMine.mp : 0);
            if (Number.isNaN(mineMP)) {
                mineMP = 0;
            }

            return `
                <div class="speedboost-slot ${slotStatus}">
                    <div class="speedboost-slot-header">
                        <h4 class="speedboost-slot-title">Slot ${slot.slotNum}</h4>
                        <span class="speedboost-slot-status ${slotStatus}">
                            ${slot.stakedSpeedboost ? 'BOOSTED' : 'EMPTY'}
                        </span>
                    </div>
                    <div class="speedboost-content">
                        <div class="mine-info-display" style="padding: 0.75rem; background: rgba(0, 212, 255, 0.1); border-radius: 8px; border: 1px solid rgba(0, 212, 255, 0.3); margin-bottom: 1rem;">
                            <div style="display: flex; align-items: center; gap: 0.75rem;">
                                <div style="position: relative;">
                                    <img src="assets/images/small_mine.png"
                                         style="width: 50px; height: 50px; border-radius: 6px; border: 2px solid #00d4ff;"
                                         alt="${mineName}"
                                         onerror="this.src='assets/gallery_images/(1).png'">
                                </div>
                                <div style="flex: 1;">
                                    <div style="color: #00d4ff; font-weight: 600; font-size: 0.9em;">${mineName}</div>
                                    <div style="color: #ffd700; font-size: 0.8em; font-weight: 500;"><i class="fas fa-hammer"></i> ${mineMP.toLocaleString()} MP</div>
                                </div>
                            </div>
                        </div>

                        ${slot.stakedSpeedboost ? `
                            <div class="speedboost-nft-display">
                                <div style="position: relative;">
                                    ${(() => {
                                        // Guard: ensure speedboost is an object
                                        if (!slot.stakedSpeedboost) return '';
                                        const sb = slot.stakedSpeedboost;
                                        const displayImage = sb.imagePath || getSpeedboostImage(sb.template_id);
                                        if (displayImage) {
                                            return `
                                                <img src="${displayImage}"
                                                     class="speedboost-nft-image"
                                                     alt="${getSpeedboostName(sb.template_id, sb.name)}">
                                            `;
                                        }
                                        return `
                                            <div class="speedboost-image-fallback" style="width: 80px; height: 80px; border-radius: 8px; border: 2px dashed rgba(255,165,0,0.4); display: flex; align-items: center; justify-content: center; color: rgba(255,165,0,0.7);">
                                                <i class="fas fa-bolt" style="font-size: 1.5rem;"></i>
                                            </div>
                                        `;
                                    })()}
                                    ${(() => {
                                        // Guard: ensure speedboost is an object
                                        if (!slot.stakedSpeedboost) return '';
                                        const sb = slot.stakedSpeedboost;
                                        // Get template_mint for speedboost if available
                                        const speedboostInventoryAsset = this.inventoryData && this.inventoryData.assets ?
                                            this.inventoryData.assets.find(asset => asset.asset_id === sb.asset_id) : null;
                                        const speedboostTemplateMint = speedboostInventoryAsset && speedboostInventoryAsset.template_mint !== 'unknown' ?
                                            speedboostInventoryAsset.template_mint : null;
                                        return speedboostTemplateMint ? `
                                            <span class="mint-badge" style="position: absolute; bottom: -2px; left: 50%; transform: translateX(-50%); background: #ffd700; color: #000; padding: 2px 6px; border-radius: 10px; font-size: 0.7em; font-weight: bold; border: 1px solid #000;">#${speedboostTemplateMint}</span>
                                        ` : '';
                                    })()}
                                </div>
                                <div class="speedboost-nft-info">
                                    ${(() => {
                                        // Guard: ensure speedboost is an object
                                        if (!slot.stakedSpeedboost) return '';
                                        const sb = slot.stakedSpeedboost;
                                        const boost = sb.boost || (sb.multiplier ? sb.multiplier - 1 : 0) || 0;
                                        return `
                                            <div class="speedboost-nft-name">${getSpeedboostName(sb.template_id, sb.name)}</div>
                                            <div class="speedboost-nft-boost">Speed +${(boost * 100).toFixed(1)}% / ×${(1 + boost).toFixed(2)}</div>
                                            <div class="speedboost-nft-mint">Reduces mining time by ${(boost * 100).toFixed(1)}%</div>
                                        `;
                                    })()}
                                </div>
                            </div>
                            <div class="speedboost-actions">
                                <button onclick="game.unstakeSpeedboost(${slot.slotNum})" class="action-btn warning">
                                    <i class="fas fa-times"></i> Unstake
                                </button>
                            </div>
                        ` : `
                            <div style="text-align: center; padding: 1rem; color: #888;">
                                <i class="fas fa-bolt" style="font-size: 2.5rem; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                                <p style="font-size: 0.9rem; margin-bottom: 0.5rem;">No Speedboost staked</p>
                                <div style="font-size: 0.8rem; opacity: 0.7; margin-bottom: 1rem;">
                                    Available boosts: 6.25% • 12.5% • 25% • 50% • 100%
                                </div>
                            </div>
                            <div class="speedboost-actions">
                                <button onclick="game.openStakeSpeedboostModal(${slot.slotNum})" class="action-btn primary" ${canUseSpeedboost ? '' : 'disabled'}>
                                    <i class="fas fa-bolt"></i> Stake Speedboost
                                </button>
                            </div>
                        `}
                    </div>
                </div>
            `;
        }).join('');

    }


    refreshSpeedboostSlots() {
        console.log('[Mining] Refreshing speedboost slots...');
        this.loadInventoryAndAssets().then(() => {
            this.renderSpeedboostSlots();
        }).catch(error => {
            console.error('[Mining] Failed to refresh speedboost slots:', error);
            this.showNotification('❌ Failed to refresh speedboost slots', 'error');
            // Render placeholder slots even if data refresh failed
            this.renderSpeedboostSlots();
        });
    }

    initSpeedboostPage() {
        console.log('[Mining] Initializing speedboost page...');

        // Realtime: Removed refresh button - data updates automatically via realtime
        const refreshBtn = document.getElementById('refresh-speedboost-btn');
        if (refreshBtn) {
            refreshBtn.style.display = 'none'; // Hide the button
        }

        // Render placeholders immediately
        this.renderSpeedboostSlots();

        // Load data and render speedboost slots
        this.loadInventoryAndAssets().then(() => {
            this.renderSpeedboostSlots();
        }).catch(error => {
            console.error('[Mining] Failed to load data for speedboost page:', error);
            this.showNotification('❌ Failed to load speedboost data', 'error');
            // Keep placeholder slots visible even on failure
            this.renderSpeedboostSlots();
        });
    }

    _doRenderMiningSlots() {
        const slotsGrid = document.getElementById('slots-grid');
        if (!slotsGrid) {
            console.warn('[Mining] No slots grid element found');
            return;
        }

        // Preserve currently open dropdown states and scroll positions before re-rendering
        const openDropdowns = [];
        const scrollPositions = {};
        for (let slotNum = 1; slotNum <= 10; slotNum++) {
            const workersList = document.getElementById(`workers-list-${slotNum}`);
            if (workersList) {
                if (workersList.style.display !== 'none') {
                    openDropdowns.push(slotNum);
                }
                // Always preserve scroll position for all lists
                scrollPositions[slotNum] = workersList.scrollTop;
            }
        }

        // Realtime: Rendering mining slots from live.profile.miningSlotsUnlocked only
        // NO FALLBACK to MAX_SLOTS - only render what's actually unlocked
        console.log('[MiningRealtime] Rendering mining slots: unlockedCount =', this.effectiveSlots, 'from live.profile.miningSlotsUnlocked');
        console.log('[Mining] - Active jobs:', this.activeJobs.length);
        console.log('[Mining] - Preserving open dropdowns:', openDropdowns);
        
        const slots = [];
        
        // Realtime: Create slots based on actual slot IDs from live.miningSlots
        // This ensures staked assets match correctly (they use slot.id as key)
        const liveSlotIds = new Set();
        if (Array.isArray(this.realtimeData.miningSlots)) {
            this.realtimeData.miningSlots.forEach(slot => {
                if (slot && slot.id !== undefined && slot.id !== null) {
                    liveSlotIds.add(Number(slot.id));
                }
            });
        }
        
        // Realtime: Only create slots up to effectiveSlots (from live.profile), not MAX_SLOTS
        // If effectiveSlots is 0, show no unlocked slots. If it's 5, show 5 slots.
        for (let i = 0; i < this.effectiveSlots; i++) {
            const slotNum = i + 1;
            const isUnlocked = true; // All slots in this loop are unlocked
            const activeJob = this.activeJobs.find(job => job.slotId === `slot_${slotNum}`);
            
            slots.push({
                slotNum,
                isUnlocked,
                activeJob
            });
        }
        
        // Realtime: Also show locked slots beyond effectiveSlots (up to MAX_SLOTS for UI)
        // But only if we have some unlocked slots, otherwise show empty state
        if (this.effectiveSlots > 0 && this.effectiveSlots < MAX_SLOTS) {
            for (let i = this.effectiveSlots; i < MAX_SLOTS; i++) {
                const slotNum = i + 1;
                slots.push({
                    slotNum,
                    isUnlocked: false,
                    activeJob: null
                });
            }
        }

        // Realtime: render mining slots from live.miningSlots only
        // Guard: ensure safe array access for unlock costs
        slotsGrid.innerHTML = slots.map(slot => {
            if (!slot.isUnlocked) {
                // Guard: safe array access - slotNum is 1-based, array is 0-based
                const slotIndex = slot.slotNum - 1;
                const unlockCost = (slotIndex >= 0 && slotIndex < SLOT_UNLOCK_COSTS.length) 
                    ? SLOT_UNLOCK_COSTS[slotIndex] 
                    : 0;
                return `
                    <div class="mining-slot locked">
                        <div class="slot-header">
                            <span class="slot-cost">${unlockCost.toLocaleString()} TSDM</span>
                            <span class="slot-locked">🔒 LOCKED</span>
                        </div>
                        <div class="slot-content-layout">
                            <p class="slot-description">Unlock this slot to expand your mining operations and increase your gem production potential</p>
                        </div>
                        <div class="slot-unlock-requirements">
                            <h4>Unlock Requirements:</h4>
                            <div class="unlock-req">
                                <span>Cost: ${unlockCost.toLocaleString()} TSDM</span>
                            </div>
                            <button onclick="game.unlockSlot(${slot.slotNum})" class="action-btn primary">
                                <i class="fas fa-unlock"></i> Unlock Slot
                            </button>
                        </div>
                    </div>
                `;
            }

            if (slot.activeJob) {
                const job = slot.activeJob;
                const now = Date.now();
                const isPendingClaim = Boolean(job.jobId && this.pendingCompletionJobs && this.pendingCompletionJobs.has(job.jobId));

                // Calculate effective duration with speedboost
                const baseDurationMs = job.baseDurationMs || MINING_DURATION_MS;
                let effectiveDurationMs = job.effectiveDurationMs || baseDurationMs;
                let speedBoostPct = job.slotSpeedBoostPct || 0;
                let speedBoostMultiplier = job.slotSpeedBoostMultiplier || (1 + speedBoostPct);

                if (!job.effectiveDurationMs) {
                    // Fallback: calculate client-side from staked speedboost
                    // Guard: ensure stakedSpeedboosts is initialized
                    const stakedSpeedboostRaw = (this.stakedSpeedboosts && this.stakedSpeedboosts[slot.slotNum]) || null;
                    const stakedSpeedboost = stakedSpeedboostRaw ? (Array.isArray(stakedSpeedboostRaw) ? stakedSpeedboostRaw[0] : stakedSpeedboostRaw) : null;
                    if (stakedSpeedboost) {
                        const fallbackBoost = typeof stakedSpeedboost.boost === 'number'
                            ? stakedSpeedboost.boost
                            : (typeof stakedSpeedboost.multiplier === 'number' ? (stakedSpeedboost.multiplier - 1) : 0);
                        if (fallbackBoost > 0) {
                            speedBoostPct = fallbackBoost;
                            speedBoostMultiplier = 1 + fallbackBoost;
                            effectiveDurationMs = Math.max(1, Math.round(baseDurationMs / speedBoostMultiplier));
                        }
                    }
                }

                if (!Number.isFinite(speedBoostMultiplier) || speedBoostMultiplier <= 0) {
                    speedBoostMultiplier = 1;
                }
                if (!Number.isFinite(effectiveDurationMs) || effectiveDurationMs <= 0) {
                    effectiveDurationMs = baseDurationMs;
                }

                const hasSpeedboost = speedBoostMultiplier > 1;
                const speedBoostInfo = hasSpeedboost
                    ? `Speed +${(speedBoostPct * 100).toFixed(1)}% / ×${speedBoostMultiplier.toFixed(2)}`
                    : null;

                const remaining = Math.max(0, job.finishAt - now);
                const progress = effectiveDurationMs > 0
                    ? Math.min(100, Math.max(0, ((effectiveDurationMs - remaining) / effectiveDurationMs) * 100))
                    : 0;
                const isComplete = remaining === 0;
                const showClaimButton = isComplete && !isPendingClaim;

                const slotMP = job.slotMiningPower || 0;
                const expectedRewards = Math.max(1, Math.floor(slotMP / 20));
                const effectiveDurationText = this.formatTime(effectiveDurationMs);
                const baseDurationText = this.formatTime(baseDurationMs);
                
                return `
                    <div class="mining-slot active ${isComplete ? 'complete' : 'in-progress'}" data-job-id="${job.jobId}" style="border: 2px solid ${isComplete ? '#00ff64' : '#00d4ff'}; box-shadow: 0 0 20px ${isComplete ? 'rgba(0, 255, 100, 0.3)' : 'rgba(0, 212, 255, 0.3)'}; display: flex; flex-direction: column;">
                        <div class="slot-header">
                            <h4>Slot ${slot.slotNum} ${isComplete ? (isPendingClaim ? '⏳' : '💎') : '⛏️'}</h4>
                            <span class="slot-status ${isComplete ? 'complete' : 'active'}" style="background: ${isComplete ? '#00ff64' : '#00d4ff'}; color: #000; padding: 4px 12px; border-radius: 12px; font-weight: bold;">
                                ${isPendingClaim ? 'Processing claim...' : (isComplete ? '✅ Ready to Collect' : '⛏️ Mining in Progress')}
                            </span>
                        </div>
                        <div class="slot-info" style="padding: 30px 20px; text-align: center; display: flex; flex-direction: column; flex-grow: 1;">
                            <div class="mining-stats-block">
                                <div class="mining-stat mining-stat-power">
                                    <span class="mining-stat-label">Mining Power</span>
                                    <span class="mining-stat-value">
                                        <i class="fas fa-hammer"></i>
                                        <span>${slotMP.toLocaleString()} MP</span>
                                    </span>
                                </div>
                                <div class="mining-stat mining-stat-reward">
                                    <span class="mining-stat-label">
                                        <i class="fas fa-gem"></i>
                                        <span>${isComplete ? 'Rewards' : 'Expected'}</span>
                                    </span>
                                    <span class="mining-stat-value">
                                        ${expectedRewards.toLocaleString()} Rough Gems
                                    </span>
                                </div>
                            </div>
                            <p style="font-size: 2.5em; font-weight: bold; color: ${isComplete ? '#00ff64' : '#00d4ff'}; margin-bottom: 20px;">
                                <span class="timer" data-finish="${job.finishAt}" data-job-id="${job.jobId}">
                                    ${this.formatTime(remaining)}
                                </span>
                            </p>
                            <div class="progress-bar" style="margin: 20px 0; background: rgba(255,255,255,0.1); border-radius: 8px; height: 20px; overflow: hidden;">
                                <div class="progress-fill" style="width: ${progress}%; background: ${isComplete ? 'linear-gradient(90deg, #00ff64, #00aa44)' : 'linear-gradient(90deg, #00d4ff, #0088ff)'}; height: 100%; transition: width 1s linear;"></div>
                            </div>
                            ${speedBoostInfo ? `
                                <div class="speedboost-applied" style="margin-top: 6px; color: #ffd700; font-weight: 500;">
                                    ⚡ ${speedBoostInfo}<br>
                                    <small style="color: rgba(255, 215, 0, 0.8);">Base ${baseDurationText} → Boosted ${effectiveDurationText}</small>
                                </div>
                            ` : ''}
                            <p style="color: ${isComplete ? '#00ff64' : '#888'}; font-size: 1.2em; margin-top: 15px;">
                                ${isPendingClaim ? '⏳ Claim in progress...' : (isComplete ? '✅ Mining Complete!' : `${Math.floor(progress)}% Complete`)}
                            </p>
                        </div>
                        ${showClaimButton ? `
                            <button class="action-btn claim-btn mining-claim-btn" onclick="game.completeMining('${job.jobId}')">
                                <i class="fas fa-gift"></i> CLAIM REWARDS
                            </button>
                        ` : isPendingClaim ? `
                            <div class="claiming-indicator" style="padding: 1rem; text-align: center; color: #ffd700;">
                                <i class="fas fa-spinner fa-spin"></i> Finalizing rewards...
                            </div>
                        ` : ''}
                    </div>
                `;
            }

            // Available slot (unlocked but no job)
            const stakedMine = this.stakedMines[slot.slotNum];
            const stakedWorkers = this.stakedWorkers[slot.slotNum] || [];
            // Guard: ensure stakedSpeedboosts is initialized
            const stakedSpeedboostRaw = (this.stakedSpeedboosts && this.stakedSpeedboosts[slot.slotNum]) || null;
            // Guard: handle both single object and array (for backward compatibility)
            const stakedSpeedboost = stakedSpeedboostRaw ? (Array.isArray(stakedSpeedboostRaw) ? stakedSpeedboostRaw[0] : stakedSpeedboostRaw) : null;

            const inventoryAssets = Array.isArray(this.inventoryData?.assets) ? this.inventoryData.assets : [];

            // Filter to only owned workers (those with mint numbers)
            const ownedWorkers = stakedWorkers.filter(w => {
                const inventoryAsset = inventoryAssets.find(asset => asset.asset_id === w.asset_id);
                const templateMint = inventoryAsset && inventoryAsset.template_mint !== 'unknown' ?
                    inventoryAsset.template_mint : null;
                return templateMint !== null;
            });

            // Calculate total MP using only owned workers
            const mineMP = stakedMine ? (Number(stakedMine.mp) || 0) : 0;
            const workersMP = ownedWorkers.reduce((sum, w) => sum + (Number(w.mp) || 0), 0);
            const totalMP = mineMP + workersMP;
            
            // Get appropriate mine image
            const getMineImage = () => {
                if (!stakedMine) return 'small_mine.png';
                
                const nameToImage = {
                    'Small Mine': 'small_mine.png',
                    'Medium Mine': 'medium_mine.png', 
                    'Large Mine': 'large_mine.png'
                };
                
                // Match by name
                for (const [key, imagePath] of Object.entries(nameToImage)) {
                    if (stakedMine.name.toLowerCase().includes(key.toLowerCase())) {
                        return imagePath;
                    }
                }
                return 'small_mine.png';
            };

            const mineImagePath = getMineImage();
            const isGreyedImage = !stakedMine;

            // Get template_mint for mine if available
            const mineInventoryAsset = stakedMine ?
                inventoryAssets.find(asset => asset.asset_id === stakedMine.asset_id) : null;
            const mineTemplateMint = mineInventoryAsset && mineInventoryAsset.template_mint !== 'unknown' ?
                mineInventoryAsset.template_mint : null;

            return `
                <div class="mining-slot ${stakedMine ? 'rented' : 'available'}">
                    <div class="slot-header">
                        ${stakedMine ? `<span class="slot-staked">⛏️ ${stakedMine.name}</span>` : ''}
                    </div>
                    <div class="slot-content-layout">
                        <p class="slot-description">${stakedMine ? 'Staked mining operation ready to start' : 'Stake a mine NFT to begin operations'}</p>
                        <div class="slot-mine-image-container">
                            ${stakedMine ? `
                                <div style="position: relative; display: inline-block;">
                                    <img src="assets/images/${mineImagePath}"
                                         class="slot-mine-image"
                                         onclick="game.confirmUnstakeMine(${slot.slotNum})"
                                         alt="${stakedMine.name}"
                                         style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; cursor: pointer; transition: transform 0.2s; opacity: 0.9;"
                                         onmouseover="this.style.transform='scale(1.05)'; this.style.opacity='1';"
                                         onmouseout="this.style.transform='scale(1)'; this.style.opacity='0.9';"
                                         title="Click to unstake mine">
                                    <div style="position: absolute; top: 4px; right: 4px; background: #ff4444; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: pointer;" onclick="game.confirmUnstakeMine(${slot.slotNum})" title="Unstake mine">
                                        <i class="fas fa-times" style="color: white; font-size: 12px; font-weight: bold;"></i>
                                    </div>
                                </div>
                                ${mineTemplateMint ? `<div style="text-align: center; margin-top: 8px; color: #ffd700; font-size: 0.8em; font-weight: 600;">Mint #${mineTemplateMint}</div>` : ''}
                            ` : `
                                <img src="assets/images/${mineImagePath}"
                                     class="slot-mine-image ${isGreyedImage ? 'greyed' : ''}"
                                     alt="Mine placeholder"
                                     style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px;">
                            `}
                        </div>
                    </div>
                    ${stakedMine || ownedWorkers.length > 0 ? `
                        <div class="slot-workers">
                            <div class="worker-info">
                                <span>Workers: ${ownedWorkers.length}${stakedMine ? `/${this.getWorkerLimit(stakedMine.name)}` : ''}</span>
                                <span class="mining-power">MP: ${totalMP.toLocaleString()}</span>
                            </div>
                            ${ownedWorkers.length > 0 ? `
                                <div id="workers-list-${slot.slotNum}" style="display: none; margin-top: 0.5rem; padding: 0.75rem; padding-bottom: 4rem; background: rgba(0, 0, 0, 0.3); border-radius: 8px; max-height: 400px; overflow-y: auto; position: relative;">
                                    <div style="margin-bottom: 0.75rem; padding: 0.5rem; background: rgba(0, 212, 255, 0.1); border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                                        <span style="color: #00d4ff; font-size: 0.85em;">
                                            <i class="fas fa-info-circle"></i> Select workers to unstake
                                        </span>
                                        <span id="unstake-count-${slot.slotNum}" style="color: #ff6b6b; font-size: 0.85em; font-weight: bold;">
                                            0 selected
                                        </span>
                                    </div>
                                    ${(() => {
                                        // Filter workers to only show those with mint numbers (owned workers)
                                        const ownedWorkers = stakedWorkers.filter((w, originalIdx) => {
                                            const inventoryAsset = this.inventoryData && this.inventoryData.assets ?
                                                this.inventoryData.assets.find(asset => asset.asset_id === w.asset_id) : null;
                                            const templateMint = inventoryAsset && inventoryAsset.template_mint !== 'unknown' ?
                                                inventoryAsset.template_mint : null;
                                            return templateMint !== null; // Only include workers with mint numbers
                                        });

                                        // Calculate selected count for this slot
                                        let selectedCount = 0;
                                        return ownedWorkers.map((w, filteredIdx) => {
                                            // Find the original index in the full stakedWorkers array
                                            const originalIdx = stakedWorkers.findIndex(worker => worker.asset_id === w.asset_id);
                                            const isLast = filteredIdx === ownedWorkers.length - 1;
                                            const workerKey = `${slot.slotNum}-${originalIdx}`;
                                            const isSelected = this.selectedWorkersForUnstake.has(workerKey);
                                            if (isSelected) selectedCount++;
                                            // Try to get template_mint from inventory data
                                            const inventoryAsset = this.inventoryData && this.inventoryData.assets ?
                                                this.inventoryData.assets.find(asset => asset.asset_id === w.asset_id) : null;
                                            const templateMint = inventoryAsset && inventoryAsset.template_mint !== 'unknown' ?
                                                inventoryAsset.template_mint : null;

                                            return `
                                            <div class="worker-unstake-card" id="worker-unstake-${slot.slotNum}-${originalIdx}"
                                                 style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem; background: ${isSelected ? 'rgba(255, 107, 107, 0.1)' : 'rgba(0, 212, 255, 0.1)'}; border-radius: 6px; margin-bottom: ${isLast ? '0.75rem' : '0.5rem'}; border: 2px solid ${isSelected ? '#ff6b6b' : 'rgba(0, 212, 255, 0.2)'}; cursor: pointer; transition: all 0.3s; position: relative;"
                                                 onclick="game.toggleWorkerForUnstake(${slot.slotNum}, ${originalIdx})">
                                                <div style="flex: 1; pointer-events: none;">
                                                    <div style="color: #ffffff; font-weight: 600; font-size: 0.9em;">${w.name}</div>
                                                    <div style="color: #ffd700; font-size: 0.85em;"><i class="fas fa-hammer"></i> ${w.mp.toLocaleString()} MP${templateMint ? ` <span style="color: #ffd700; font-weight: bold;">#${templateMint}</span>` : ''}</div>
                                                </div>
                                                <div class="unstake-checkbox" style="width: 20px; height: 20px; border: 2px solid #00d4ff; border-radius: 4px; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; pointer-events: none;">
                                                    <i class="fas fa-check" style="color: #ff6b6b; font-size: 12px; display: ${isSelected ? 'block' : 'none'};"></i>
                                                </div>
                                            </div>
                                        `;
                                        }).join('') + `
                                        <button id="unstake-selected-${slot.slotNum}" onclick="game.unstakeSelectedWorkers(${slot.slotNum})"
                                                class="action-btn warning"
                                                style="width: calc(100% - 1.5rem); position: sticky; bottom: 0.75rem; left: 0.75rem; right: 0.75rem; margin-top: 0.75rem; ${selectedCount > 0 ? 'opacity: 1;' : 'opacity: 0.5;'} z-index: 10;" ${selectedCount > 0 ? '' : 'disabled'}>
                                            <i class="fas fa-times"></i> Unstake Selected Workers
                                        </button>`;
                                    })()}
                                </div>
                            ` : ''}


                            <div class="slot-actions">
                                ${ownedWorkers.length > 0 ? `
                                    <button onclick="game.toggleWorkersList(${slot.slotNum})" class="action-btn secondary">
                                        <i class="fas fa-users"></i> Manage ${ownedWorkers.length} Worker${ownedWorkers.length > 1 ? 's' : ''}
                                        <i class="fas fa-chevron-down" id="workers-chevron-${slot.slotNum}" style="margin-left: 0.5rem;"></i>
                                    </button>
                                ` : ''}
                                <button onclick="game.startMining(${slot.slotNum})" class="action-btn primary start-mining-btn" data-slot="${slot.slotNum}">
                                    <i class="fas fa-play"></i> Start Mining
                                </button>
                                ${!stakedMine ? `
                                    <button onclick="game.openStakeMineModal(${slot.slotNum})" class="action-btn secondary">
                                        <i class="fas fa-mountain"></i> Stake Mine NFT
                                    </button>
                                ` : ''}
                                <button onclick="game.openStakeWorkersModal(${slot.slotNum})" class="action-btn secondary">
                                    <i class="fas fa-users"></i> ${stakedWorkers.length > 0 ? 'Add More' : 'Stake'} Workers
                                </button>
                            </div>
                        </div>
                    ` : `
                        <div class="slot-actions">
                            ${stakedMine && stakedWorkers.length > 0 ? `
                                <button onclick="game.startMining(${slot.slotNum})" class="action-btn primary start-mining-btn" data-slot="${slot.slotNum}">
                                    <i class="fas fa-play"></i> Start Mining
                                </button>
                            ` : ''}
                            ${!stakedMine ? `
                                <button onclick="game.openStakeMineModal(${slot.slotNum})" class="action-btn secondary">
                                    <i class="fas fa-mountain"></i> Stake Mine NFT
                                </button>
                            ` : ''}
                            ${stakedMine ? `
                                <button onclick="game.openStakeWorkersModal(${slot.slotNum})" class="action-btn secondary">
                                    <i class="fas fa-users"></i> ${stakedWorkers.length > 0 ? 'Add More' : 'Stake'} Workers
                                </button>
                            ` : ''}
                        </div>
                    `}
                </div>
            `;
        }).join('');

        // Restore open dropdowns, worker selections, and scroll positions immediately after rendering (no delay to prevent flicker)
        if (openDropdowns.length > 0) {
            console.log(`[Mining] Will restore ${openDropdowns.length} dropdowns:`, openDropdowns);
            openDropdowns.forEach(slotNum => {
                const workersList = document.getElementById(`workers-list-${slotNum}`);
                const chevron = document.getElementById(`workers-chevron-${slotNum}`);
                if (workersList && chevron && workersList.style.display === 'none') {
                    // Temporarily disable transitions to prevent flicker
                    const originalTransition = workersList.style.transition;
                    workersList.style.transition = 'none';
                    chevron.style.transition = 'none';

                    workersList.style.display = 'block';
                    chevron.style.transform = 'rotate(180deg)';

                    // Restore scroll position
                    const savedScrollTop = scrollPositions[slotNum] || 0;
                    workersList.scrollTop = savedScrollTop;

                    // Re-enable transitions after a brief moment
                    setTimeout(() => {
                        workersList.style.transition = originalTransition;
                        chevron.style.transition = 'transform 0.3s ease';
                    }, 10);

                    console.log(`[Mining] ✅ Restored dropdown for slot ${slotNum} with scroll position ${savedScrollTop}`);
                } else if (workersList && workersList.style.display !== 'none') {
                    // Still restore scroll position even if already open
                    const savedScrollTop = scrollPositions[slotNum] || 0;
                    workersList.scrollTop = savedScrollTop;
                    console.log(`[Mining] Dropdown for slot ${slotNum} was already open, restored scroll position ${savedScrollTop}`);
                } else {
                    console.log(`[Mining] Could not find dropdown elements for slot ${slotNum}`);
                }
            });
        }

        // Update worker selection count displays
        openDropdowns.forEach(slotNum => {
            const countSpan = document.getElementById(`unstake-count-${slotNum}`);
            if (countSpan) {
                // Count selected workers for this slot
                const slotSelections = Array.from(this.selectedWorkersForUnstake)
                    .filter(key => key.startsWith(`${slotNum}-`)).length;
                countSpan.textContent = `${slotSelections} selected`;
            }
        });
    }

    updateMiningStats() {
        const activeSitesEl = document.getElementById('active-mining-sites');
        const totalWorkforceEl = document.getElementById('total-workforce');
        const totalMiningPowerEl = document.getElementById('total-mining-power');

        if (activeSitesEl) {
            // Count slots with staked mines
            const stakedMinesCount = Object.keys(this.stakedMines).length;
            activeSitesEl.textContent = stakedMinesCount;
        }
        
        if (totalWorkforceEl) {
            // Calculate total staked workers
            let totalStakedWorkers = 0;
            Object.values(this.stakedWorkers).forEach(workers => {
                if (Array.isArray(workers)) {
                    totalStakedWorkers += workers.length;
                }
            });
            
            // Calculate total possible workers based on mines
            let totalPossibleWorkers = 0;
            Object.values(this.stakedMines).forEach(mine => {
                if (mine && mine.name) {
                    const limit = WORKER_LIMITS[mine.name] || 0;
                    totalPossibleWorkers += limit;
                }
            });
            
            totalWorkforceEl.textContent = `${totalStakedWorkers}${totalPossibleWorkers > 0 ? `/${totalPossibleWorkers}` : ''}`;
        }
        
        if (totalMiningPowerEl) {
            // Calculate total mining power across all slots
            let totalMiningPower = 0;
            
            // Sum up mining power from all staked mines
            Object.values(this.stakedMines).forEach(mine => {
                if (mine && mine.mp) {
                    totalMiningPower += mine.mp;
                }
            });
            
            // Sum up mining power from all staked workers
            Object.values(this.stakedWorkers).forEach(workers => {
                if (Array.isArray(workers)) {
                    workers.forEach(worker => {
                        if (worker && worker.mp) {
                            totalMiningPower += worker.mp;
                        }
                    });
                }
            });
            
            totalMiningPowerEl.textContent = totalMiningPower.toLocaleString();
        }
    }

    async startMining(slotNum) {
        if (!this.currentActor) {
            this.showNotification('Please connect your wallet first', 'error');
            return;
        }

        // Show loading state on button
        const button = document.querySelector(`button.start-mining-btn[data-slot="${slotNum}"]`);
        const originalText = button ? button.innerHTML : '';
        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';
        }

        try {
            // Check if mine and worker are staked
            const stakedMine = this.stakedMines[slotNum];
            const stakedWorkers = this.stakedWorkers[slotNum] || [];

            if (!stakedMine) {
                this.showNotification('❌ Please stake a mine first!', 'error');
                return;
            }

            if (stakedWorkers.length === 0) {
                this.showNotification('❌ Please stake at least one worker!', 'error');
                return;
            }

            console.log('[Mining] Starting mining for slot:', slotNum);
            this.showNotification('⛏️ Starting mining job...', 'info');
            
            const response = await fetch(`${this.backendService.apiBase}/startMining`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    actor: this.currentActor,
                    slotNum: slotNum
                })
            });
            
            if (!response.ok) {
                console.log('[Mining] Start mining failed with status:', response.status, response.statusText);

                let errorData = null;
                try {
                    errorData = await response.json();
                    console.log('[Mining] Error response JSON:', errorData);
                } catch (parseError) {
                    console.log('[Mining] Error parsing JSON, trying text:', parseError);
                    // If response isn't valid JSON, try to get text
                    const errorText = await response.text().catch(() => 'Unknown error');
                    console.log('[Mining] Error response text:', errorText);
                    
                    // Handle season-locked errors
                    if (response.status === 403 && (errorText.includes('season-locked') || errorText === 'season-locked')) {
                        console.warn('[Mining] Season locked - cannot start mining');
                        this.showNotification('⏸️ Season is locked. Mining cannot be started until the season unlocks.', 'error');
                        if (button) {
                            button.disabled = false;
                            button.innerHTML = originalText;
                        }
                        return;
                    }
                    
                    throw new Error(`Failed to start mining: ${response.status} ${response.statusText} - ${errorText}`);
                }

                // Handle season-locked errors (403)
                if (response.status === 403 && (errorData.error === 'season-locked' || errorData.error?.includes('season-locked'))) {
                    console.warn('[Mining] Season locked - cannot start mining');
                    this.showNotification('⏸️ Season is locked. Mining cannot be started until the season unlocks.', 'error');
                    if (button) {
                        button.disabled = false;
                        button.innerHTML = originalText;
                    }
                    return;
                }

                // Handle ownership validation errors specifically
                if (errorData.error && errorData.error.startsWith('ownership_missing:')) {
                    console.log('[Mining] Detected ownership_missing error, showing modal');
                    const missingList = errorData.error.replace('ownership_missing: ', '');
                    const missingDetails = errorData.details || [];

                    // Show persistent modal requiring manual action
                    this.showMissingWorkersModal(missingList, missingDetails, slotNum);
                    if (button) {
                        button.disabled = false;
                        button.innerHTML = originalText;
                    }
                    return;
                }

                console.log('[Mining] Error not ownership_missing, throwing generic error');
                if (button) {
                    button.disabled = false;
                    button.innerHTML = originalText;
                }
                throw new Error(errorData.error || 'Failed to start mining');
            }
            
            const data = await response.json();
            console.log('[Mining] Mining started successfully:', data);
            
            // Extract timing information from backend response
            const baseDurationMs = data.baseDurationMs || MINING_DURATION_MS;
            const effectiveDurationMs = data.effectiveDurationMs || baseDurationMs;
            const finishAt = data.finishAt || (Date.now() + effectiveDurationMs);
            const remainingTime = Math.max(0, finishAt - Date.now());
            const speedBoostPct = data.slotSpeedBoostPct || 0;
            const speedBoostMultiplier = data.slotSpeedBoostMultiplier || (1 + speedBoostPct);
            const boostText = speedBoostPct > 0
                ? ` (Speed +${(speedBoostPct * 100).toFixed(1)}% / ×${speedBoostMultiplier.toFixed(2)})`
                : '';
            
            console.log('[MiningAction] startMining slot=' + slotNum + ', result=success');
            this.showNotification(`✅ Mining job started! Complete in ${this.formatTime(remainingTime)}${boostText}`, 'success');
            this.showNotification('Awaiting realtime confirmation for the new mining job...', 'info');
            
            // Realtime: Don't mutate local state - wait for realtime update
            // Start timer updates if not already running
            if (!this.timerInterval) {
                this.startTimerUpdates();
            }
            
        } catch (error) {
            console.error('[Mining] Failed to start mining:', error);
            this.showNotification('❌ Failed to start mining: ' + error.message, 'error');
        } finally {
            // Restore button state
            if (button) {
                button.disabled = false;
                button.innerHTML = originalText;
            }
        }
    }

    showMissingWorkersModal(missingList, missingDetails, slotNum) {
        console.log('[Mining] Showing missing workers modal:', { missingList, missingDetails, slotNum });

        // Debug: Check for duplicates
        const assetIds = missingDetails.map(w => w.asset_id);
        const uniqueAssetIds = [...new Set(assetIds)];
        if (assetIds.length !== uniqueAssetIds.length) {
            console.warn('[Mining] Duplicate workers found in missingDetails:', assetIds);
            // Filter out duplicates
            const seen = new Set();
            missingDetails = missingDetails.filter(worker => {
                if (seen.has(worker.asset_id)) {
                    return false;
                }
                seen.add(worker.asset_id);
                return true;
            });
        }

        // Debug: Check mint numbers
        missingDetails.forEach((worker, index) => {
            console.log(`[Mining] Worker ${index}: ${worker.name} - Mint: ${worker.template_mint} - Asset: ${worker.asset_id}`);
        });

        const modalContent = `
            <div class="missing-workers-modal">
                <div class="modal-header">
                    <h3>⚠️ Missing Workers Detected</h3>
                    <p>The following workers are no longer owned by you:</p>
                </div>
                <div class="modal-body">
                    <div class="missing-workers-list">
                        ${missingDetails.map(worker =>
                            `<div class="missing-worker-item">
                                <span class="worker-name">${worker.name}</span>
                                <span class="worker-details">Template ${worker.template_id}${worker.template_mint && worker.template_mint !== 'unknown' ? `, Mint #${worker.template_mint}` : ''}</span>
                            </div>`
                        ).join('')}
                    </div>
                    <p class="modal-info">These workers will be automatically removed from your staking configuration.</p>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-primary" onclick="game.closeMissingWorkersModal(${slotNum}, [${missingDetails.map(w => `'${w.asset_id}'`).join(', ')}])">
                        Remove Workers & Continue
                    </button>
                </div>
            </div>
        `;

        // Create and show modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay active'; // Add 'active' class to make it visible
        modal.innerHTML = `
            <div class="modal-content missing-workers-modal-wrapper">
                ${modalContent}
            </div>
        `;
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        };

        console.log('[Mining] Appending modal to body');
        document.body.appendChild(modal);
        console.log('[Mining] Modal appended, should be visible now');
    }

    async closeMissingWorkersModal(slotNum, assetIdsToRemove) {
        // Remove the modal
        const modal = document.querySelector('.missing-workers-modal-wrapper');
        if (modal) {
            modal.closest('.modal-overlay').remove();
        }

        try {
            // Remove each missing worker
            for (const assetId of assetIdsToRemove) {
                await this.backendService.unstakeAsset(this.currentActor, 'mining', slotNum, 'worker', assetId);
                console.log(`[Mining] Auto-removed unowned worker ${assetId} from slot ${slotNum}`);
            }

            // UI will update automatically via realtime:mining-slots event
            console.log('[Mining] Waiting for realtime update after worker removal...');
            
            // Show success notification
            const count = assetIdsToRemove.length;
            this.showNotification(`✅ Removed ${count} unowned worker${count > 1 ? 's' : ''} from Slot ${slotNum}. Realtime update pending...`, 'success');

        } catch (error) {
            console.error('[Mining] Failed to remove unowned workers:', error);
            this.showNotification('❌ Failed to remove unowned workers: ' + error.message, 'error');
        }
    }

    async completeMining(jobId) {
        if (!this.currentActor) {
            this.showNotification('Please connect your wallet first', 'error');
            return;
        }

        // Prevent multiple clicks by disabling the button
        const claimButton = document.querySelector(`button[onclick*="completeMining('${jobId}')"]`);
        if (claimButton) {
            claimButton.disabled = true;
            claimButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Claiming...';
            claimButton.style.opacity = '0.7';
        }

        // Dropdown preservation is now handled globally in renderMiningSlots()

        try {
            console.log('[Mining] Completing mining job:', jobId);
            
            // Realtime: Guard against null/undefined jobId
            if (!jobId) {
                throw new Error('Job ID is required to complete mining');
            }

            // Find the job to get estimated values
            const job = this.activeJobs.find(j => j.jobId === jobId);
            let estimatedAmount = 0;
            let estimatedMP = 0;

            if (job) {
                // Calculate estimated yield based on mining power and duration
                estimatedMP = job.slotMiningPower || job.power || 0;
                const duration = job.startedAt ? (Date.now() - job.startedAt) : 0;
                const expectedGems = Math.floor(estimatedMP / 20);
                estimatedAmount = expectedGems;
            }

            // Realtime: Don't update UI optimistically - wait for realtime confirmation
            // Show loading state on button only
            this.pendingCompletionJobs.add(jobId);
            
            const response = await fetch(`${this.backendService.apiBase}/completeMining`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    actor: this.currentActor,
                    jobId: jobId
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMsg = errorData.error || `HTTP ${response.status}`;
                
                // Handle season-locked errors (403)
                if (response.status === 403 && (errorData.error === 'season-locked' || errorMsg.includes('season-locked'))) {
                    console.warn('[Mining] Season locked - cannot complete mining');
                    this.showNotification('⏸️ Season is locked. Mining cannot be completed until the season unlocks.', 'error');
                    if (claimButton) {
                        claimButton.disabled = false;
                        claimButton.innerHTML = '<i class="fas fa-check"></i> Claim';
                        claimButton.style.opacity = '1';
                    }
                    this.pendingCompletionJobs.delete(jobId);
                    return;
                }
                
                // Realtime: On error, revert optimistic UI and wait for realtime update
                if (response.status === 404 || errorMsg.includes('not found') || errorMsg.includes('already completed')) {
                    console.log('[MiningAction] Job not found or already completed, reverting optimistic UI');
                    // Remove from pending - realtime will update the actual state
                    this.pendingCompletionJobs.delete(jobId);
                    // Re-render to show actual state from live.miningSlots (force immediate update)
                    this.renderMiningSlots(true);
                    this.showNotification('Job already completed or not found. Waiting for realtime update...', 'info');
                } else {
                    if (claimButton) {
                        claimButton.disabled = false;
                        claimButton.innerHTML = '<i class="fas fa-check"></i> Claim';
                        claimButton.style.opacity = '1';
                    }
                    this.pendingCompletionJobs.delete(jobId);
                    throw new Error(errorMsg);
                }
                return;
            }
            
            const data = await response.json();
            console.log('[MiningAction] completeMining slot=..., result=success');
            
            const result = data.result;
            const amount = result.yieldAmt || 0;
            const slotMP = result.slotMiningPower || 0;
            const effectiveMP = result.effectiveMiningPower || 0;

            // Check if MP was reduced due to unowned workers
            if (job && job.slotMiningPower > effectiveMP) {
                const deductedMP = job.slotMiningPower - effectiveMP;
                const ownershipInfo = result.ownershipAtCompletion;

                let notificationMessage = `⚠️ ${deductedMP.toLocaleString()} MP removed - workers no longer owned:`;

                if (ownershipInfo && ownershipInfo.missingAssets && ownershipInfo.missingAssets.length > 0) {
                    const removedWorkers = ownershipInfo.missingAssets
                        .filter(asset => asset.type === 'worker')
                        .map(worker => `#${worker.template_mint}`)
                        .join(', ');

                    if (removedWorkers) {
                        notificationMessage += ` ${removedWorkers}`;
                    }
                }

                this.showNotification(notificationMessage, 'warning');
            }

            // Realtime: Show reward popup with actual values, then wait for realtime update
            this.showRewardPopup(amount, 'Rough Gems', effectiveMP);
            this.showNotification('Awaiting realtime confirmation...', 'info');
            
            // Realtime: Don't update UI here - wait for realtime:live event to remove job
            
        } catch (error) {
            console.error('[Mining] Failed to complete mining:', error);
            // Realtime: On error, just remove from pending and show error
            this.pendingCompletionJobs.delete(jobId);
            // Realtime: Don't modify activeJobs - let realtime update handle it
            this.showNotification('❌ Failed to claim rewards: ' + error.message, 'error');
        } finally {
            // Re-enable the button
            if (claimButton) {
                claimButton.disabled = false;
                claimButton.innerHTML = '<i class="fas fa-gift"></i> CLAIM REWARDS';
                claimButton.style.opacity = '1';
            }
        }
    }

    async unlockSlot(slotNum) {
        if (!this.currentActor) {
            this.showNotification('Please connect your wallet first', 'error');
            return;
        }
        
        const unlockCost = SLOT_UNLOCK_COSTS[slotNum - 1] || 0;
        
        try {
            console.log('[Mining] Unlocking slot:', slotNum, 'Cost:', unlockCost, 'TSDM');
            this.showNotification(`🔓 Creating payment request for slot ${slotNum} (${unlockCost.toLocaleString()} TSDM)...`, 'info');
            
            // Create payment request
            const response = await fetch(`${this.backendService.apiBase}/unlockMiningSlot`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    actor: this.currentActor,
                    targetSlot: slotNum
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create payment request');
            }
            
            const data = await response.json();
            console.log('[Mining] Payment request created:', data);
            
            // Show payment modal
            this.showPaymentModal(data.paymentId, unlockCost, slotNum, 'mining_slot_unlock');
            
        } catch (error) {
            console.error('[Mining] Failed to create payment request:', error);
            this.showNotification('❌ Failed to create payment request: ' + error.message, 'error');
        }
    }

    showPaymentModal(paymentId, amount, slotNum, paymentType) {
        const modalContent = `
            <div class="payment-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-credit-card"></i> Complete Payment</h3>
                    <button class="modal-close" onclick="game.closePaymentModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="payment-info">
                        <div class="payment-details">
                            <h4>Payment Details</h4>
                            <div class="detail-row">
                                <span class="label">Amount:</span>
                                <span class="value">${amount.toLocaleString()} TSDM</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">Destination:</span>
                                <span class="value">tillo1212121</span>
                            </div>
                            <div class="detail-row">
                                <span class="label">Purpose:</span>
                                <span class="value">Unlock Mining Slot ${slotNum}</span>
                            </div>
                        </div>
                        
                        <div class="payment-status" id="payment-status">
                            <div class="status-pending">
                                <i class="fas fa-clock"></i>
                                <span>Payment request created. Please complete the blockchain transaction.</span>
                            </div>
                        </div>
                        
                        <div class="payment-actions">
                            <button id="execute-payment-btn" class="action-btn primary" onclick="game.executePayment('${paymentId}', ${amount}, '${paymentType}', ${slotNum})">
                                <i class="fas fa-paper-plane"></i> Execute Payment
                            </button>
                            <button class="action-btn secondary" onclick="game.cancelPayment('${paymentId}')">
                                <i class="fas fa-times"></i> Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Create modal if it doesn't exist
        let modal = document.getElementById('payment-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'payment-modal';
            modal.className = 'modal-overlay';
            document.body.appendChild(modal);
        }
        
        modal.innerHTML = modalContent;
        modal.style.display = 'flex';
        
        // Scroll to center the modal in viewport
        setTimeout(() => {
            const modalBox = modal.querySelector('.payment-modal, .modal');
            if (modalBox) {
                modalBox.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
        }, 50);
        
        // Store payment info for later use
        this.currentPayment = {
            paymentId,
            amount,
            slotNum,
            type: paymentType
        };
    }

    async executePayment(paymentId, amount, paymentType, slotNum) {
        try {
            const executeBtn = document.getElementById('execute-payment-btn');
            const statusDiv = document.getElementById('payment-status');
            
            // Update UI
            executeBtn.disabled = true;
            executeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            
            statusDiv.innerHTML = `
                <div class="status-processing">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Executing blockchain transaction...</span>
                </div>
            `;
            
            // Execute payment using PaymentService
            const result = await window.paymentService.processPayment(
                paymentType,
                amount,
                { slotNum },
                (progress) => {
                    statusDiv.innerHTML = `
                        <div class="status-processing">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span>${progress}</span>
                        </div>
                    `;
                }
            );
            
            if (result.success) {
                statusDiv.innerHTML = `
                    <div class="status-success">
                        <i class="fas fa-check-circle"></i>
                        <span>Payment completed successfully!</span>
                        <div class="tx-info">
                            <small>Transaction ID: ${result.txId}</small>
                        </div>
                    </div>
                `;
                
                this.showNotification(`✅ Mining slot ${slotNum} unlocked successfully!`, 'success');
                this.showNotification('Realtime update in progress. Your dashboard will refresh automatically.', 'info');
                
                // Close modal after delay
                setTimeout(() => {
                    this.closePaymentModal();
                }, 3000);
                
            } else {
                throw new Error('Payment verification failed');
            }
            
        } catch (error) {
            console.error('[Mining] Payment execution failed:', error);
            
            const statusDiv = document.getElementById('payment-status');
            statusDiv.innerHTML = `
                <div class="status-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Payment failed: ${error.message}</span>
                </div>
            `;
            
            const executeBtn = document.getElementById('execute-payment-btn');
            executeBtn.disabled = false;
            executeBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Retry Payment';
            
            this.showNotification('❌ Payment failed: ' + error.message, 'error');
        }
    }

    async cancelPayment(paymentId) {
        try {
            await window.paymentService.cancelPayment(paymentId);
            this.showNotification('Payment cancelled', 'info');
            this.closePaymentModal();
        } catch (error) {
            console.error('[Mining] Failed to cancel payment:', error);
            this.showNotification('❌ Failed to cancel payment: ' + error.message, 'error');
        }
    }

    closePaymentModal() {
        const modal = document.getElementById('payment-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.currentPayment = null;
    }

    openStakeMineModal(slotNum) {
        console.log('[Mining] Opening stake mine modal for slot:', slotNum);
        
        this.selectedSlotForStaking = slotNum;
        
        // Get staked asset IDs to filter them out
        const stakedAssetIds = this.getStakedAssetIds();
        console.log('[Mining] Staked asset IDs:', stakedAssetIds);
        
        // Create modal content
        let galleryContent = '';
        
        if (this.mineNFTs.length === 0) {
            // No mines owned - show message with link to shop
            galleryContent = `
                <div style="text-align: center; padding: 60px 20px; background: rgba(0, 0, 0, 0.2); border-radius: 8px; border: 2px dashed #888;">
                    <i class="fas fa-mountain" style="font-size: 64px; color: #888; margin-bottom: 20px;"></i>
                    <h3 style="color: #00d4ff; margin-bottom: 15px; font-size: 1.3em;">No Mine NFTs Available</h3>
                    <p style="color: #888; margin-bottom: 30px; max-width: 400px; margin-left: auto; margin-right: auto;">
                        You don't own any Mine NFTs yet. Purchase mining equipment on NeftyBlocks to boost your mining operations!
                    </p>
                    <a href="https://neftyblocks.com/collection/tsdmediagems" target="_blank" rel="noopener" class="action-btn primary" style="display: inline-block; text-decoration: none;">
                        <i class="fas fa-shopping-cart"></i> Visit Shop
                    </a>
                    <button class="action-btn secondary" onclick="game.closeStakeModal()" style="margin-left: 10px;">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            `;
        } else {
            // Show NFT gallery with smaller images - each NFT displayed individually
            // Filter out already staked mines
            const availableMines = this.mineNFTs.filter(nft => !stakedAssetIds.has(nft.asset_id));
            console.log('[Mining] Available mines after filtering:', availableMines.length, 'of', this.mineNFTs.length);
            
            if (availableMines.length === 0) {
                // All mines are already staked
                galleryContent = `
                    <div style="text-align: center; padding: 60px 20px; background: rgba(255, 152, 0, 0.1); border-radius: 8px; border: 2px solid #ff9800;">
                        <i class="fas fa-check-circle" style="font-size: 64px; color: #ff9800; margin-bottom: 20px;"></i>
                        <h3 style="color: #ff9800; margin-bottom: 15px; font-size: 1.3em;">All Mines Already Staked!</h3>
                        <p style="color: #888; margin-bottom: 30px; max-width: 400px; margin-left: auto; margin-right: auto;">
                            All your mine NFTs are currently staked. Unstake a mine from another slot or purchase more on NeftyBlocks.
                        </p>
                        <button class="action-btn secondary" onclick="game.closeStakeModal()">
                            <i class="fas fa-times"></i> Close
                        </button>
                    </div>
                `;
            } else {
            
            galleryContent = `
                <p style="margin-bottom: 15px; color: #888;">
                    Select a Mine NFT to stake in this slot. Staked mines provide passive mining power.
                </p>
                ${availableMines.length < this.mineNFTs.length ? `
                    <div style="background: rgba(255, 152, 0, 0.1); border: 1px solid rgba(255, 152, 0, 0.3); border-radius: 6px; padding: 10px; margin-bottom: 15px;">
                        <p style="color: #ff9800; margin: 0; font-size: 0.85em;">
                            <i class="fas fa-info-circle"></i> ${this.mineNFTs.length - availableMines.length} mine(s) already staked
                        </p>
                    </div>
                ` : ''}
                <div class="nft-gallery-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; max-height: 500px; overflow-y: auto; padding: 10px;">
                    ${availableMines.map(nft => `
                        <div class="nft-card" style="border: 2px solid #00d4ff; border-radius: 8px; padding: 10px; background: rgba(0, 0, 0, 0.3); cursor: pointer; transition: all 0.3s;" onclick="game.stakeMine('${nft.template_id}', ${slotNum}, ${nft.mp}, '${nft.name}', '${nft.asset_id}')">
                            <div style="position: relative;">
                                ${nft.imagePath ? `
                                    <img src="${nft.imagePath}" alt="${nft.name}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;" onerror="this.style.display='none'">
                                ` : ''}
                                ${nft.template_mint && nft.template_mint !== 'unknown' ? `<div class="mint-badge">#${nft.template_mint}</div>` : ''}
                            </div>
                            <h4 style="color: #00d4ff; margin-bottom: 5px; font-size: 0.9em;">${nft.name}</h4>
                            <p style="color: #00ff64; font-size: 0.85em; font-weight: bold; margin: 5px 0;">
                                <i class="fas fa-hammer"></i> ${(nft.mp || 0).toLocaleString()} MP
                            </p>
                        </div>
                    `).join('')}
                </div>
            `;
            }
        }
        
        const modalContent = `
            <div style="display: flex; flex-direction: column; height: 100%; max-height: 70vh;">
                <div style="flex: 1; overflow-y: auto; overflow-x: hidden;">
                    ${galleryContent}
                </div>
            </div>
        `;
        
        // Show modal
        const modalOverlay = document.getElementById('modal-overlay');
        const modalBody = document.getElementById('modal-body');
        
        if (modalBody) {
            modalBody.innerHTML = modalContent;
            // Remove width restriction from parent modal
            // Target the .modal container (parent of modalBody)
            const modalContainer = modalBody.parentElement;
            if (modalContainer) {
                modalContainer.style.maxWidth = '1400px';
                modalContainer.style.width = '92%';
                modalContainer.style.maxHeight = '85vh';
                modalContainer.style.overflow = 'hidden';
            }
        }
        
        if (modalOverlay) {
            openModal(modalOverlay);
        }
    }

    openStakeWorkersModal(slotNum) {
        console.log('[Mining] Opening stake workers modal for slot:', slotNum);
        
        this.selectedSlotForStaking = slotNum;
        
        // Get staked asset IDs to filter them out
        const stakedAssetIds = this.getStakedAssetIds();
        console.log('[Mining] Staked asset IDs:', stakedAssetIds);
        
        // Check if mine is staked and get worker limit
        const stakedMine = this.stakedMines[slotNum];
        const currentWorkers = this.stakedWorkers[slotNum] ? this.stakedWorkers[slotNum].length : 0;
        const workerLimit = stakedMine ? this.getWorkerLimit(stakedMine.name) : 10;
        
        // Create modal content
        let galleryContent = '';
        
        if (this.workerNFTs.length === 0) {
            // No workers owned - show message with link to shop
            galleryContent = `
                <div style="text-align: center; padding: 60px 20px; background: rgba(0, 0, 0, 0.2); border-radius: 8px; border: 2px dashed #888;">
                    <i class="fas fa-users" style="font-size: 64px; color: #888; margin-bottom: 20px;"></i>
                    <h3 style="color: #00d4ff; margin-bottom: 15px; font-size: 1.3em;">No Worker NFTs Available</h3>
                    <p style="color: #888; margin-bottom: 30px; max-width: 400px; margin-left: auto; margin-right: auto;">
                        You don't own any Worker NFTs yet. Purchase workers on NeftyBlocks to increase your mining power!
                    </p>
                    <a href="https://neftyblocks.com/collection/tsdmediagems" target="_blank" rel="noopener" class="action-btn primary" style="display: inline-block; text-decoration: none;">
                        <i class="fas fa-shopping-cart"></i> Visit Shop
                    </a>
                    <button class="action-btn secondary" onclick="game.closeStakeModal()" style="margin-left: 10px;">
                        <i class="fas fa-times"></i> Close
                    </button>
                </div>
            `;
        } else {
            // Check if limit is reached
            if (currentWorkers >= workerLimit) {
                galleryContent = `
                    <div style="text-align: center; padding: 60px 20px; background: rgba(255, 152, 0, 0.1); border-radius: 8px; border: 2px solid #ff9800;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 64px; color: #ff9800; margin-bottom: 20px;"></i>
                        <h3 style="color: #ff9800; margin-bottom: 15px; font-size: 1.3em;">Worker Limit Reached!</h3>
                        <p style="color: #888; margin-bottom: 20px; max-width: 400px; margin-left: auto; margin-right: auto;">
                            ${stakedMine ? stakedMine.name : 'This mine'} can only have <strong style="color: #ff9800;">${workerLimit} workers</strong> maximum.
                        </p>
                        <p style="color: #888; margin-bottom: 30px;">
                            Currently staked: <strong style="color: #00d4ff;">${currentWorkers}/${workerLimit}</strong>
                        </p>
                        <button class="action-btn secondary" onclick="game.closeStakeModal()">
                            <i class="fas fa-times"></i> Close
                        </button>
                    </div>
                `;
            } else {
                // Show NFT gallery with smaller images - each NFT displayed individually
                // Filter out already staked workers
                let availableWorkers = this.workerNFTs.filter(nft => !stakedAssetIds.has(nft.asset_id));

                // Sort by MP in descending order (highest first)
                availableWorkers.sort((a, b) => (b.mp || 0) - (a.mp || 0));

                console.log('[Mining] Available workers after filtering and sorting:', availableWorkers.length, 'of', this.workerNFTs.length);
                
                const remainingSlots = workerLimit - currentWorkers;
                
                if (availableWorkers.length === 0) {
                    // All workers are already staked
                    galleryContent = `
                        <div style="text-align: center; padding: 60px 20px; background: rgba(255, 152, 0, 0.1); border-radius: 8px; border: 2px solid #ff9800;">
                            <i class="fas fa-check-circle" style="font-size: 64px; color: #ff9800; margin-bottom: 20px;"></i>
                            <h3 style="color: #ff9800; margin-bottom: 15px; font-size: 1.3em;">All Workers Already Staked!</h3>
                            <p style="color: #888; margin-bottom: 30px; max-width: 400px; margin-left: auto; margin-right: auto;">
                                All your worker NFTs are currently staked. Unstake workers from another slot or purchase more on NeftyBlocks.
                            </p>
                            <button class="action-btn secondary" onclick="game.closeStakeModal()">
                                <i class="fas fa-times"></i> Close
                            </button>
                        </div>
                    `;
                } else {
                
                galleryContent = `
                    <div style="position: sticky; top: 0; background: rgba(0, 212, 255, 0.15); border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 15px; z-index: 5; backdrop-filter: blur(5px);">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <p style="color: #00d4ff; margin: 0; font-weight: bold;">
                                <i class="fas fa-info-circle"></i> Workers: ${currentWorkers}/${workerLimit}
                                ${stakedMine ? ` (${stakedMine.name})` : ''}
                            </p>
                            <p style="color: #00ff64; margin: 0; font-weight: bold;" id="worker-selection-count">
                                Selected: <span id="selected-worker-count">0</span>/${remainingSlots}
                            </p>
                        </div>
                    </div>
                    ${availableWorkers.length < this.workerNFTs.length ? `
                        <div style="background: rgba(255, 152, 0, 0.1); border: 1px solid rgba(255, 152, 0, 0.3); border-radius: 6px; padding: 10px; margin-bottom: 15px;">
                            <p style="color: #ff9800; margin: 0; font-size: 0.85em;">
                                <i class="fas fa-info-circle"></i> ${this.workerNFTs.length - availableWorkers.length} worker(s) already staked
                            </p>
                        </div>
                    ` : ''}
                    <p style="margin-bottom: 10px; color: #888; font-size: 0.9em;">
                        Select multiple Worker NFTs to stake (max ${remainingSlots} more). Click to toggle selection.
                    </p>
                    <div class="nft-gallery-grid" style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: ${window.innerWidth <= 768 ? '0.35rem' : '10px'}; padding: 5px; justify-content: start; overflow: visible;">
                        ${availableWorkers.map((nft, idx) => {
                            const isSelected = this.selectedWorkers && this.selectedWorkers.some(w => w.asset_id === nft.asset_id);
                            return `
                            <div class="nft-card worker-select-card" id="worker-card-${idx}"
                                 style="border: 2px solid ${isSelected ? '#00ff64' : '#00d4ff'}; border-radius: 6px; padding: ${window.innerWidth <= 768 ? '6px' : '8px'}; background: ${isSelected ? 'rgba(0, 255, 100, 0.2)' : 'rgba(0, 0, 0, 0.3)'}; cursor: pointer; transition: all 0.3s; position: relative; min-width: 0; box-shadow: ${isSelected ? '0 0 15px rgba(0, 255, 100, 0.4)' : 'none'};"
                                 onclick="game.toggleWorkerSelection(${idx}, '${nft.template_id}', ${nft.mp}, '${nft.name}', ${slotNum}, ${remainingSlots}, '${nft.asset_id}')">
                                <div style="position: relative;">
                                    ${nft.imagePath ? `
                                        <img src="${nft.imagePath}" alt="${nft.name}" style="width: 100%; height: ${window.innerWidth <= 768 ? 'auto' : '100px'}; aspect-ratio: ${window.innerWidth <= 768 ? '1' : 'auto'}; object-fit: cover; border-radius: 4px; margin-bottom: 8px;" onerror="this.style.display='none'">
                                    ` : ''}
                                    ${nft.template_mint && nft.template_mint !== 'unknown' ? `<div class="mint-badge">#${nft.template_mint}</div>` : ''}
                                </div>
                                <h4 style="color: #00d4ff; margin-bottom: 4px; font-size: ${window.innerWidth <= 768 ? '0.7em' : '0.85em'};">${nft.name}</h4>
                                <p style="color: #00ff64; font-size: ${window.innerWidth <= 768 ? '0.65em' : '0.8em'}; font-weight: bold; margin: 4px 0;">
                                    <i class="fas fa-hammer"></i> ${(nft.mp || 0).toLocaleString()} MP
                                </p>
                            </div>
                        `}).join('')}
                    </div>
                    <div style="position: sticky; bottom: 0; background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 10px; margin: 10px -10px -10px -10px; border-top: 1px solid rgba(0, 212, 255, 0.2); display: flex; gap: 10px; z-index: 10;">
                        <button id="confirm-stake-workers" class="action-btn primary" style="flex: 1;" onclick="game.confirmStakeWorkers(${slotNum})" disabled>
                            <i class="fas fa-check"></i> Stake Selected Workers
                        </button>
                        <button class="action-btn secondary" style="flex: 1;" onclick="game.closeStakeModal()">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    </div>
                `;
                }
            }
        }
        
        const modalContent = `${galleryContent}`;
        
        // Show modal
        const modalOverlay = document.getElementById('modal-overlay');
        const modalBody = document.getElementById('modal-body');
        
        if (modalBody) {
            modalBody.innerHTML = modalContent;
            // Target the .modal container (parent of modalBody) and modal-header
            const modalContainer = modalBody.parentElement;
            const modalHeader = modalContainer.querySelector('.modal-header');
            
            if (modalHeader) {
                modalHeader.innerHTML = `
                    <h3><i class="fas fa-users"></i> Stake Worker NFTs to Slot ${slotNum}</h3>
                    <button class="modal-close" onclick="game.closeStakeModal()">
                        <i class="fas fa-times"></i>
                    </button>
                `;
            }
            
            if (modalContainer) {
                // Responsive width: Desktop vs Mobile
                const isMobile = window.innerWidth <= 768;
                
                if (isMobile) {
                    // Mobile: Full width with padding
                    modalContainer.style.maxWidth = '98vw';
                    modalContainer.style.width = '98vw';
                    modalContainer.style.padding = '1rem 0.5rem';
                } else {
                    // Desktop: Auto-adjust width to fit 4 workers: 4x180px + 3x10px (gaps) + 2x16px (padding) + ~40px (buttons) ≈ 850px
                    modalContainer.style.maxWidth = '850px';
                    modalContainer.style.width = 'auto';
                }
                
                modalContainer.style.maxHeight = '85vh';
                modalContainer.style.overflow = 'hidden';
                modalContainer.style.display = 'flex';
                modalContainer.style.flexDirection = 'column';
            }
            
            modalBody.style.display = 'flex';
            modalBody.style.flexDirection = 'column';
            modalBody.style.flex = '1';
            modalBody.style.overflowY = 'auto';
            modalBody.style.overflowX = 'hidden';
            modalBody.style.minHeight = '0';
        }
        
        if (modalOverlay) {
            openModal(modalOverlay);
        }
    }

    closeStakeModal() {
        console.log('[Mining] closeStakeModal called');
        const modalOverlay = document.getElementById('modal-overlay');
        closeModalElement(modalOverlay);
        console.log('[Mining] Modal overlay removed active class');
        this.selectedSlotForStaking = null;
        this.selectedWorkers = []; // Reset selection when closing modal
        console.log('[Mining] Modal closed, selection cleared');
    }

    async openStakeSpeedboostModal(slotNum) {
        console.log('[Mining] Opening stake speedboost modal for slot:', slotNum);

        this.showLoadingState(true, 'Loading Speedboosts...');

        try {
            // Refresh inventory/staked data to ensure latest state (force refresh to avoid cached values)
            try {
                await this.loadInventoryAndAssets(true);
            } catch (refreshError) {
                console.warn('[Mining] Failed to refresh inventory before opening speedboost modal:', refreshError);
                // Continue with best-effort data
            }

            // Get available speedboosts (not already staked)
            const stakedAssetIds = this.getStakedAssetIds();
            // Guard: ensure stakedSpeedboosts is initialized
            const stakedSpeedboostIds = new Set(
                (this.stakedSpeedboosts ? Object.values(this.stakedSpeedboosts) : [])
                    .map(sb => Array.isArray(sb) ? sb[0] : sb)
                    .filter(sb => sb && sb.asset_id)
                    .map(sb => String(sb.asset_id))
            );

            const availableSpeedboosts = this.speedboostNFTs.filter(nft => {
                const assetId = String(nft.asset_id);
                return !stakedAssetIds.has(assetId) && !stakedSpeedboostIds.has(assetId);
            });

            console.log('[Mining] Available speedboosts:', availableSpeedboosts.length, 'of', this.speedboostNFTs.length);

            // Guard: ensure stakedSpeedboosts is initialized
            const currentSpeedboostRaw = (this.stakedSpeedboosts && this.stakedSpeedboosts[slotNum]) || null;
            const currentSpeedboost = currentSpeedboostRaw ? (Array.isArray(currentSpeedboostRaw) ? currentSpeedboostRaw[0] : currentSpeedboostRaw) : null;

            // Ensure overlay has time to render before modal injection
            await new Promise(resolve => requestAnimationFrame(resolve));

            this.showSpeedboostStakingModal(slotNum, availableSpeedboosts, currentSpeedboost);
        } catch (error) {
            console.error('[Mining] Failed to open speedboost modal:', error);
            this.showNotification(`❌ Failed to load speedboosts: ${error.message}`, 'error');
        } finally {
            this.showLoadingState(false);
        }
    }

    showSpeedboostStakingModal(slotNum, availableSpeedboosts, currentSpeedboost = null) {
        console.log(`[Mining] showSpeedboostStakingModal called with ${availableSpeedboosts.length} speedboosts (current: ${currentSpeedboost ? currentSpeedboost.asset_id : 'none'})`);

        // Remove existing modal if present
        const existingModal = document.getElementById('speedboost-staking-modal');
        if (existingModal) {
            console.log('[Mining] Removing existing modal');
            existingModal.remove();
        }

        const modalHTML = `
            <div class="modal-overlay" id="speedboost-staking-modal" style="display: flex; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8); z-index: 10000; align-items: center; justify-content: center; overflow-y: auto; padding: 2rem 0;">
                <div class="modal-content" style="background: rgba(20, 20, 30, 0.95); border: 2px solid #ffa500; border-radius: 12px; padding: 30px; max-width: 800px; width: 90%; max-height: calc(100vh - 4rem); overflow-y: auto;">
                    <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h3 style="color: #ffa500; margin: 0;"><i class="fas fa-bolt"></i> Stake Speedboost - Slot ${slotNum}</h3>
                        <button class="close-btn" onclick="game.closeSpeedboostStakingModal()" style="background: transparent; border: none; color: #fff; font-size: 2em; cursor: pointer; padding: 0; width: 40px; height: 40px;">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p style="color: #888; margin-bottom: 20px;">
                            Select a Speedboost NFT to apply to slot ${slotNum}. Speedboosts reduce mining time for faster gem production.
                        </p>
                        ${(() => {
                            if (!currentSpeedboost) return '';
                            const boost = typeof currentSpeedboost.boost === 'number'
                                ? currentSpeedboost.boost
                                : (typeof currentSpeedboost.multiplier === 'number' ? (currentSpeedboost.multiplier - 1) : 0);
                            const boostText = `Speed +${(boost * 100).toFixed(1)}% / ×${(1 + boost).toFixed(2)}`;
                            return `
                                <div class="current-speedboost-notice" style="border: 1px solid rgba(255,165,0,0.4); background: rgba(255,165,0,0.12); border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
                                    <div style="display: flex; align-items: center; gap: 12px;">
                                        <i class="fas fa-info-circle" style="color: #ffd700; font-size: 1.4em;"></i>
                                        <div>
                                            <div style="color: #ffd700; font-weight: 600;">Current Speedboost</div>
                                            <div style="color: #fff;">${getSpeedboostName(currentSpeedboost.template_id, currentSpeedboost.name)}</div>
                                            <div style="color: rgba(255,215,0,0.8); font-size: 0.9em;">${boostText}</div>
                                            <div style="color: #888; font-size: 0.85em; margin-top: 4px;">Selecting a new Speedboost will automatically replace the current one.</div>
                                        </div>
                                    </div>
                                </div>
                            `;
                        })()}
                        ${availableSpeedboosts.length === 0 ? `
                            <div style="text-align: center; padding: 60px 20px; background: rgba(0, 0, 0, 0.2); border-radius: 8px; border: 2px dashed #888;">
                                <i class="fas fa-bolt" style="font-size: 64px; color: #888; margin-bottom: 20px;"></i>
                                <h3 style="color: #ffa500; margin-bottom: 15px; font-size: 1.3em;">No Speedboost NFTs Available</h3>
                                <p style="color: #888; margin-bottom: 30px; max-width: 400px; margin-left: auto; margin-right: auto;">
                                    You don't own any Speedboost NFTs yet, or all are already staked. Purchase speedboosts on NeftyBlocks to reduce mining time!
                                </p>
                                <a href="https://neftyblocks.com/collection/tsdmediagems" target="_blank" rel="noopener" class="action-btn primary" style="display: inline-block; text-decoration: none;">
                                    <i class="fas fa-shopping-cart"></i> Visit Shop
                                </a>
                                <button class="action-btn secondary" onclick="game.closeSpeedboostStakingModal()" style="margin-left: 10px;">
                                    <i class="fas fa-times"></i> Close
                                </button>
                            </div>
                        ` : `
                            <div class="speedboost-selection-grid">
                                <div class="speedboost-type-group">
                                    <h4 style="color: #ffa500; margin-bottom: 15px;">Speedboost NFTs (${availableSpeedboosts.length} available)</h4>
                                    <div class="speedboost-cards" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px;">
                                        ${availableSpeedboosts.map(speedboost => {
                                            const boostInfo = SPEEDBOOST_BY_TEMPLATE[speedboost.template_id] || { boost: 0 };
                                            const boost = speedboost.boost ?? boostInfo.boost ?? 0;
                                            const cardImagePath = speedboost.imagePath || getSpeedboostImage(speedboost.template_id);
                                            const cardDisplayName = getSpeedboostName(speedboost.template_id, speedboost.name);
                                            return `
                                                <div class="speedboost-card" onclick="game.stakeSpeedboostToSlot(${slotNum}, '${speedboost.asset_id}')" style="background: rgba(0, 0, 0, 0.4); border: 2px solid rgba(255, 165, 0, 0.3); border-radius: 8px; padding: 15px; text-align: center; cursor: pointer; transition: all 0.3s;">
                                                    <div style="position: relative;">
                                                        ${cardImagePath ? `
                                                            <img src="${cardImagePath}" alt="${cardDisplayName}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 4px; margin-bottom: 10px; border: 2px solid #ffa500;">
                                                        ` : `
                                                            <div style="width: 100%; height: 120px; border: 2px dashed rgba(255, 165, 0, 0.4); border-radius: 4px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; color: rgba(255,165,0,0.7);">
                                                                <i class="fas fa-bolt" style="font-size: 2rem;"></i>
                                                            </div>
                                                        `}
                                                        ${speedboost.template_mint && speedboost.template_mint !== 'unknown' ? `<div class="mint-badge" style="position: absolute; bottom: -2px; left: 50%; transform: translateX(-50%); background: #ffd700; color: #000; padding: 2px 6px; border-radius: 10px; font-size: 0.7em; font-weight: bold; border: 1px solid #000;">#${speedboost.template_mint}</div>` : ''}
                                                    </div>
                                                    <p style="color: #fff; margin: 5px 0; font-weight: 600;">${cardDisplayName}</p>
                                                    <p style="color: #ffd700; font-size: 0.9em; font-weight: bold;">Speed +${(boost * 100).toFixed(1)}% / ×${(1 + boost).toFixed(2)}</p>
                                                    <small style="color: #888;">ID: ${speedboost.asset_id}</small>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;

        console.log('[Mining] Inserting speedboost modal HTML into body');
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        console.log('[Mining] Speedboost modal inserted, should be visible');
    }

    closeSpeedboostStakingModal() {
        console.log('[Mining] closeSpeedboostStakingModal called');
        const modal = document.getElementById('speedboost-staking-modal');
        if (modal) {
            modal.remove();
        }
        console.log('[Mining] Speedboost modal closed');
    }

    async stakeSpeedboostToSlot(slotNum, assetId) {
        console.log('[Mining] Staking speedboost:', assetId, 'to slot:', slotNum);

        // Disable all speedboost cards in modal during processing
        const modal = document.getElementById('speedboost-staking-modal');
        const speedboostCards = modal ? modal.querySelectorAll('.speedboost-card') : [];
        speedboostCards.forEach(card => {
            card.style.pointerEvents = 'none';
            card.style.opacity = '0.5';
            card.style.cursor = 'not-allowed';
        });

        // Disable close button
        const closeBtn = modal ? modal.querySelector('.close-btn') : null;
        if (closeBtn) {
            closeBtn.disabled = true;
            closeBtn.style.pointerEvents = 'none';
            closeBtn.style.opacity = '0.5';
        }

        try {
            // Show loading state while staking
            this.showLoadingState(true, 'Staking speedboost...');

            const speedboostNFT = this.speedboostNFTs.find(nft => nft.asset_id === assetId);
            const templateId = speedboostNFT ? speedboostNFT.template_id : null;
            const info = templateId ? SPEEDBOOST_BY_TEMPLATE[String(templateId)] : null;
            const boost = speedboostNFT?.boost ?? info?.boost ?? 0;
            const multiplier = 1 + boost;

            const result = await this.backendService.stakeAsset(
                this.currentActor,
                'mining',
                slotNum,
                'speedboost',
                {
                    asset_id: assetId,
                    template_id: templateId ? Number(templateId) : undefined,
                    name: speedboostNFT ? speedboostNFT.name : (templateId ? getSpeedboostName(templateId) : 'Speedboost'),
                    boost: boost,
                    multiplier: multiplier,
                    imagePath: speedboostNFT?.imagePath || null
                }
            );

            if (result.success) {
                // Optimistic update: update local state immediately
                if (result.stakingData && result.stakingData.mining) {
                    const slotKey = `slot${slotNum}`;
                    const slotData = result.stakingData.mining[slotKey];
                    if (slotData) {
                        if (slotData.speedboost) {
                            this.stakedSpeedboosts[slotNum] = slotData.speedboost;
                        } else if (Array.isArray(slotData.speedboosts) && slotData.speedboosts.length > 0) {
                            this.stakedSpeedboosts[slotNum] = slotData.speedboosts[0];
                        }
                    }
                }

                // Close modal
                this.closeSpeedboostStakingModal();

                // Hide loading state
                this.showLoadingState(false);

                // Re-render to show updated state (force immediate update)
                this.renderMiningSlots(true);
                this.renderSpeedboostSlots();

                this.showNotification(`✅ Staked ${speedboostNFT ? speedboostNFT.name : 'Speedboost'} to Slot ${slotNum}!`, 'success');
            } else {
                throw new Error(result.error || 'Failed to stake speedboost');
            }
        } catch (error) {
            console.error('[Mining] Failed to stake speedboost:', error);
            
            // Re-enable modal elements on error
            speedboostCards.forEach(card => {
                card.style.pointerEvents = 'auto';
                card.style.opacity = '1';
                card.style.cursor = 'pointer';
            });
            if (closeBtn) {
                closeBtn.disabled = false;
                closeBtn.style.pointerEvents = 'auto';
                closeBtn.style.opacity = '1';
            }

            this.showLoadingState(false);
            this.showNotification(`❌ Failed to stake speedboost: ${error.message}`, 'error');
        }
    }

    async unstakeSpeedboost(slotNum) {
        console.log('[Mining] Unstaking speedboost from slot:', slotNum);

        // Guard: ensure stakedSpeedboosts is initialized and handle both single object and array
        const stakedSpeedboostRaw = (this.stakedSpeedboosts && this.stakedSpeedboosts[slotNum]) || null;
        const stakedSpeedboost = stakedSpeedboostRaw ? (Array.isArray(stakedSpeedboostRaw) ? stakedSpeedboostRaw[0] : stakedSpeedboostRaw) : null;

        if (!stakedSpeedboost || !stakedSpeedboost.asset_id) {
            this.showNotification('❌ No speedboost staked in this slot!', 'error');
            return;
        }

        // Disable unstake button during processing
        const unstakeBtn = document.querySelector(`button[onclick="game.unstakeSpeedboost(${slotNum})"]`);
        const originalBtnText = unstakeBtn ? unstakeBtn.innerHTML : '';
        if (unstakeBtn) {
            unstakeBtn.disabled = true;
            unstakeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            unstakeBtn.style.pointerEvents = 'none';
            unstakeBtn.style.opacity = '0.5';
        }

        try {
            this.showLoadingState(true, 'Unstaking speedboost...');

            const result = await this.backendService.unstakeAsset(
                this.currentActor,
                'mining',
                slotNum,
                'speedboost',
                stakedSpeedboost.asset_id
            );

            if (result.success) {
                // Optimistic update: remove from local state immediately
                delete this.stakedSpeedboosts[slotNum];

                // Re-render to show updated state (force immediate update)
                this.renderMiningSlots(true);
                this.renderSpeedboostSlots();

                this.showNotification(`✅ Unstaked ${stakedSpeedboost.name || 'Speedboost'} from Slot ${slotNum}!`, 'success');
            } else {
                throw new Error(result.error || 'Failed to unstake speedboost');
            }
        } catch (error) {
            console.error('[Mining] Failed to unstake speedboost:', error);
            
            // Re-enable button on error
            if (unstakeBtn) {
                unstakeBtn.disabled = false;
                unstakeBtn.innerHTML = originalBtnText;
                unstakeBtn.style.pointerEvents = 'auto';
                unstakeBtn.style.opacity = '1';
            }

            this.showNotification(`❌ Failed to unstake speedboost: ${error.message}`, 'error');
        } finally {
            this.showLoadingState(false);
        }
    }

    async stakeMine(templateId, slotNum, mp, name, assetId) {
        console.log('[Mining] Staking mine:', name, 'to slot:', slotNum, 'asset_id:', assetId);
        
        try {
            // Show loading state while staking
            this.showLoadingState(true, 'Staking mine...');
            
            const result = await this.backendService.stakeAsset(
                this.currentActor,
                'mining',
                slotNum,
                'mine',
                {
                    asset_id: assetId,
                    template_id: templateId,
                    name: name,
                    mp: mp
                }
            );
            
            // Hide loading state
            this.showLoadingState(false);
            
            if (result.success) {
                // UI will update automatically via realtime:mining-slots event
                this.showNotification(`✅ Staked ${name} to Slot ${slotNum}! Realtime update pending...`, 'success');
                this.closeStakeModal();
            } else {
                throw new Error(result.error || 'Failed to stake mine');
            }
        } catch (error) {
            console.error('[Mining] Failed to stake mine:', error);
            this.showLoadingState(false);
            this.showNotification(`❌ Failed to stake mine: ${error.message}`, 'error');
        }
    }

    getWorkerLimit(mineName) {
        // Determine worker limit based on mine type
        for (const [mineType, limit] of Object.entries(WORKER_LIMITS)) {
            if (mineName && mineName.includes(mineType)) {
                return limit;
            }
        }
        return 10; // Default to small mine limit
    }

    toggleWorkerSelection(cardIdx, templateId, mp, name, slotNum, remainingSlots, assetId) {
        const card = document.getElementById(`worker-card-${cardIdx}`);
        const countSpan = document.getElementById('selected-worker-count');
        const confirmBtn = document.getElementById('confirm-stake-workers');

        // Check if already selected
        const existingIndex = this.selectedWorkers.findIndex(w =>
            w.cardIdx === cardIdx && w.template_id === templateId
        );

        if (existingIndex >= 0) {
            // Deselect
            this.selectedWorkers.splice(existingIndex, 1);
            card.style.border = '2px solid #00d4ff';
            card.style.background = 'rgba(0, 0, 0, 0.3)';
            card.style.boxShadow = 'none';
        } else {
            // Check if we can add more
            if (this.selectedWorkers.length >= remainingSlots) {
                this.showNotification(`❌ You can only select ${remainingSlots} more worker(s)!`, 'error');
                return;
            }

            // Select
            this.selectedWorkers.push({
                cardIdx,
                template_id: templateId,
                mp,
                name,
                asset_id: assetId
            });
            card.style.border = '2px solid #00ff64';
            card.style.background = 'rgba(0, 255, 100, 0.2)';
            card.style.boxShadow = '0 0 15px rgba(0, 255, 100, 0.4)';
        }
        
        // Update counter
        countSpan.textContent = this.selectedWorkers.length;
        
        // Enable/disable confirm button
        confirmBtn.disabled = this.selectedWorkers.length === 0;
        if (this.selectedWorkers.length > 0) {
            confirmBtn.style.opacity = '1';
        } else {
            confirmBtn.style.opacity = '0.5';
        }
    }

    async confirmStakeWorkers(slotNum) {
        if (this.selectedWorkers.length === 0) {
            this.showNotification('❌ Please select at least one worker!', 'error');
            return;
        }
        
        console.log('[Mining] Staking multiple workers to slot:', slotNum);
        
        // Check if mine is staked
        const stakedMine = this.stakedMines[slotNum];
        if (!stakedMine) {
            this.showNotification('❌ Please stake a mine first!', 'error');
            return;
        }
        
        // Store count before clearing (needed for notification)
        const count = this.selectedWorkers.length;
        
        try {
            // Show loading state while staking
            this.showLoadingState(true, 'Staking workers...');
            
            // OPTIMIZED: Batch stake all workers in a single API call
            const result = await this.backendService.stakeWorkersBatch(
                this.currentActor,
                'mining',
                slotNum,
                this.selectedWorkers
            );
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to stake workers');
            }
            
            // Hide loading state
            this.showLoadingState(false);
            
            // Update local state from response (has correct data from backend)
            if (result.stakingData && result.stakingData.mining) {
                // Update mines
                Object.entries(result.stakingData.mining).forEach(([slotKey, slotData]) => {
                    const slotNum = parseInt(slotKey.replace('slot', ''));
                    if (slotData.mine) {
                        this.stakedMines[slotNum] = slotData.mine;
                    }
                });
                
                // Update workers for the specific slot
                const slotKey = `slot${slotNum}`;
                if (result.stakingData.mining[slotKey] && result.stakingData.mining[slotKey].workers) {
                    this.stakedWorkers[slotNum] = result.stakingData.mining[slotKey].workers;
                }
            }
            
            const workerLimit = this.getWorkerLimit(stakedMine.name);
            const totalWorkers = this.stakedWorkers[slotNum] ? this.stakedWorkers[slotNum].length : 0;
            
            // Close modal and update UI (force immediate update)
            this.selectedWorkers = [];
            this.closeStakeModal();
            this.renderMiningSlots(true);
            
            this.showNotification(`✅ Staked ${count} worker${count > 1 ? 's' : ''} to Slot ${slotNum}! (${totalWorkers}/${workerLimit})`, 'success');
            
            console.log('[Mining] ✅ Worker staking complete, modal closed, UI updated');
            
            // Skip redundant fetchActiveMiningJobs - it's not needed after staking
            // this.fetchActiveMiningJobs(this.currentActor);
            
        } catch (error) {
            console.error('[Mining] Failed to stake workers:', error);
            this.showLoadingState(false);
            this.showNotification(`❌ Failed to stake workers: ${error.message}`, 'error');
        }
    }

    stakeWorker(templateId, slotNum, mp, name) {
        console.log('[Mining] Staking worker:', name, 'to slot:', slotNum);
        
        // Check if mine is staked
        const stakedMine = this.stakedMines[slotNum];
        if (!stakedMine) {
            this.showNotification('❌ Please stake a mine first!', 'error');
            return;
        }
        
        // Check worker limit based on mine type
        const workerLimit = this.getWorkerLimit(stakedMine.name);
        const currentWorkers = this.stakedWorkers[slotNum] ? this.stakedWorkers[slotNum].length : 0;
        
        if (currentWorkers >= workerLimit) {
            this.showNotification(`❌ ${stakedMine.name} can only have ${workerLimit} workers maximum!`, 'error');
            return;
        }
        
        // Add worker to staked workers array for this slot
        if (!this.stakedWorkers[slotNum]) {
            this.stakedWorkers[slotNum] = [];
        }
        
        this.stakedWorkers[slotNum].push({
            template_id: templateId,
            name: name,
            mp: mp
        });
        
        this.showNotification(`✅ Staked ${name} to Slot ${slotNum}! (${currentWorkers + 1}/${workerLimit})`, 'success');
        this.closeStakeModal();
        this.renderMiningSlots(true);
    }

    toggleWorkersList(slotNum) {
        const workersList = document.getElementById(`workers-list-${slotNum}`);
        const chevron = document.getElementById(`workers-chevron-${slotNum}`);
        
        if (workersList && chevron) {
            const isHidden = workersList.style.display === 'none';
            
            if (!isHidden) {
                // Closing the list - clear unstake selections
                this.selectedWorkersForUnstake.clear();
            }
            
            workersList.style.display = isHidden ? 'block' : 'none';
            chevron.className = isHidden ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
        }
    }

    toggleWorkerForUnstake(slotNum, workerIndex) {
        const card = document.getElementById(`worker-unstake-${slotNum}-${workerIndex}`);
        const checkbox = card.querySelector('.unstake-checkbox i');
        const countSpan = document.getElementById(`unstake-count-${slotNum}`);
        const unstakeBtn = document.getElementById(`unstake-selected-${slotNum}`);
        
        const key = `${slotNum}-${workerIndex}`;
        
        if (this.selectedWorkersForUnstake.has(key)) {
            // Deselect
            this.selectedWorkersForUnstake.delete(key);
            card.style.border = '2px solid rgba(0, 212, 255, 0.2)';
            card.style.background = 'rgba(0, 212, 255, 0.1)';
            checkbox.style.display = 'none';
        } else {
            // Select
            this.selectedWorkersForUnstake.add(key);
            card.style.border = '2px solid #ff6b6b';
            card.style.background = 'rgba(255, 107, 107, 0.1)';
            checkbox.style.display = 'block';
        }
        
        // Update counter
        const count = this.selectedWorkersForUnstake.size;
        countSpan.textContent = `${count} selected`;
        
        // Enable/disable unstake button
        unstakeBtn.disabled = count === 0;
        unstakeBtn.style.opacity = count === 0 ? '0.5' : '1';
    }

    async unstakeSelectedWorkers(slotNum) {
        console.log('[Mining] unstakeSelectedWorkers called for slot:', slotNum);
        console.log('[Mining] Selected workers:', Array.from(this.selectedWorkersForUnstake));
        
        if (this.selectedWorkersForUnstake.size === 0) {
            this.showNotification('❌ Please select at least one worker to unstake!', 'error');
            return;
        }
        
        console.log('[Mining] Unstaking multiple workers from slot:', slotNum);
        
        try {
            // Convert Set to array of indices
            const indices = Array.from(this.selectedWorkersForUnstake)
                .filter(key => key.startsWith(`${slotNum}-`))
                .map(key => parseInt(key.split('-')[1]));
            
            console.log('[Mining] Worker indices to unstake:', indices);
            
            if (indices.length === 0) {
                console.log('[Mining] No valid indices found');
                return;
            }
            
            const workers = this.stakedWorkers[slotNum];
            if (!workers) {
                console.log('[Mining] No workers found in slot', slotNum);
                return;
            }
            
            console.log('[Mining] Current workers in slot:', workers);
            
            // IMPORTANT: Extract asset_ids BEFORE unstaking (to avoid index issues)
            const assetIdsToUnstake = indices
                .filter(index => workers[index])
                .map(index => workers[index].asset_id);
            
            console.log('[Mining] Unstaking asset_ids:', assetIdsToUnstake);
            
            // Show loading state while unstaking
            this.showLoadingState(true, 'Unstaking workers...');
            
            // Unstake in background
            const unstakePromises = assetIdsToUnstake.map(assetId => {
                console.log('[Mining] Unstaking worker with asset_id:', assetId);
                return this.backendService.unstakeAsset(
                    this.currentActor,
                    'mining',
                    slotNum,
                    'worker',
                    assetId
                );
            });
            
            await Promise.all(unstakePromises);
            
            // Hide loading state
            this.showLoadingState(false);
            
            // UI will update automatically via realtime:mining-slots event
            this.selectedWorkersForUnstake.clear();
            
            const count = assetIdsToUnstake.length;
            this.showNotification(`✅ Unstaked ${count} worker${count > 1 ? 's' : ''} from Slot ${slotNum}! Realtime update pending...`, 'success');
            
        } catch (error) {
            console.error('[Mining] Failed to unstake workers:', error);
            console.error('[Mining] Error stack:', error.stack);
            this.showLoadingState(false);
            this.showNotification(`❌ Failed to unstake workers: ${error.message}`, 'error');
        }
    }

    async unstakeWorker(slotNum, workerIndex) {
        console.log('[Mining] Unstaking worker at index:', workerIndex, 'from slot:', slotNum);
        
        const worker = this.stakedWorkers[slotNum] && this.stakedWorkers[slotNum][workerIndex];
        if (!worker) {
            this.showNotification('❌ Worker not found!', 'error');
            return;
        }
        
        try {
            const result = await this.backendService.unstakeAsset(
                this.currentActor,
                'mining',
                slotNum,
                'worker',
                worker.asset_id
            );
            
            if (result.success) {
                // UI will update automatically via realtime:mining-slots event
                this.showNotification(`✅ Unstaked ${worker.name} from Slot ${slotNum}! Realtime update pending...`, 'success');
            } else {
                throw new Error(result.error || 'Failed to unstake worker');
            }
        } catch (error) {
            console.error('[Mining] Failed to unstake worker:', error);
            this.showNotification(`❌ Failed to unstake worker: ${error.message}`, 'error');
        }
    }

    confirmUnstakeMine(slotNum) {
        const stakedMine = this.stakedMines[slotNum];
        if (!stakedMine) {
            this.showNotification('❌ No mine staked in this slot!', 'error');
            return;
        }
        
        // Show custom confirmation modal
        this.showUnstakeConfirmModal(slotNum, stakedMine);
    }
    
    showUnstakeConfirmModal(slotNum, stakedMine) {
        const modalContent = `
            <div class="unstake-confirm-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-exclamation-triangle"></i> Confirm Unstake</h3>
                    <button class="modal-close" onclick="game.closeUnstakeConfirmModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="text-align: center; padding: 30px;">
                    <div style="font-size: 4em; color: #ff9500; margin-bottom: 20px;">
                        <i class="fas fa-hand-point-left"></i>
                    </div>
                    <h4 style="color: #00d4ff; margin-bottom: 15px; font-size: 1.3em;">
                        Are you sure you want to unstake?
                    </h4>
                    <div style="background: rgba(255, 149, 0, 0.1); border: 2px solid rgba(255, 149, 0, 0.3); border-radius: 12px; padding: 20px; margin: 20px 0;">
                        <div style="color: #00d4ff; font-weight: 600; font-size: 1.1em; margin-bottom: 10px;">
                            <i class="fas fa-mountain"></i> ${stakedMine.name}
                        </div>
                        <div style="color: #888; font-size: 0.95em;">
                            Slot ${slotNum}
                        </div>
                    </div>
                    <div style="color: #ff6b6b; margin: 20px 0; font-size: 0.95em;">
                        <i class="fas fa-info-circle"></i> This will stop all mining operations in this slot.
                    </div>
                    <div style="display: flex; gap: 15px; justify-content: center; margin-top: 30px;">
                        <button id="confirm-unstake-btn" class="action-btn warning" onclick="game.unstakeMine(${slotNum}); game.closeUnstakeConfirmModal();" style="padding: 12px 30px; font-size: 1em;">
                            <i class="fas fa-check"></i> Confirm Unstake
                        </button>
                        <button class="action-btn secondary" onclick="game.closeUnstakeConfirmModal()" style="padding: 12px 30px; font-size: 1em;">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Create modal if it doesn't exist
        let modal = document.getElementById('unstake-confirm-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'unstake-confirm-modal';
            modal.className = 'modal-overlay';
            document.body.appendChild(modal);
        }
        
        modal.innerHTML = modalContent;
        modal.style.display = 'flex';
        
        // Scroll to center the modal in viewport
        setTimeout(() => {
            const modalBox = modal.querySelector('.unstake-confirm-modal, .modal');
            if (modalBox) {
                modalBox.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
        }, 50);
    }
    
    closeUnstakeConfirmModal() {
        const modal = document.getElementById('unstake-confirm-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async unstakeMine(slotNum) {
        console.log('[Mining] Unstaking mine from slot:', slotNum);
        
        const stakedMine = this.stakedMines[slotNum];
        if (!stakedMine) {
            this.showNotification('❌ No mine staked in this slot!', 'error');
            return;
        }
        
        try {
            const result = await this.backendService.unstakeAsset(
                this.currentActor,
                'mining',
                slotNum,
                'mine',
                stakedMine.asset_id
            );
            
            if (result.success) {
                // UI will update automatically via realtime:mining-slots event
                this.showNotification(`✅ Unstaked ${stakedMine.name} from Slot ${slotNum}! Realtime update pending...`, 'success');
            } else {
                throw new Error(result.error || 'Failed to unstake mine');
            }
        } catch (error) {
            console.error('[Mining] Failed to unstake mine:', error);
            this.showNotification(`❌ Failed to unstake mine: ${error.message}`, 'error');
        }
    }


    formatTime(ms) {
        if (ms <= 0) return '00:00:00';
        
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((ms % (1000 * 60)) / 1000);
        
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    updateTimersImmediately() {
        // Update all timers immediately without waiting for interval
        const timers = document.querySelectorAll('.timer');
        let shouldRerender = false;
        
        timers.forEach(timer => {
            const finishAt = parseInt(timer.dataset.finish);
            const jobId = timer.dataset.jobId;
            if (!finishAt || isNaN(finishAt)) return;
            
            const now = Date.now();
            const remaining = Math.max(0, finishAt - now);
            
            timer.textContent = this.formatTime(remaining);
            
            if (remaining === 0 && jobId && !this.completedJobsRendered.has(jobId)) {
                this.completedJobsRendered.add(jobId);
                shouldRerender = true; // Trigger a single re-render on first completion
            }
        });
        
        if (shouldRerender) {
            // Use setTimeout to avoid re-render during current render cycle
            setTimeout(() => this.renderMiningSlots(true), 0);
        }
    }

    startTimerUpdates() {
        // Update timers every second
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        this.timerInterval = setInterval(() => {
            const timers = document.querySelectorAll('.timer');
            let shouldRerender = false;
            
            timers.forEach(timer => {
                const finishAt = parseInt(timer.dataset.finish);
                const jobId = timer.dataset.jobId;
                if (!finishAt || isNaN(finishAt)) return;
                
                const now = Date.now();
                const remaining = Math.max(0, finishAt - now);
                
                timer.textContent = this.formatTime(remaining);
                
                if (remaining === 0 && jobId && !this.completedJobsRendered.has(jobId)) {
                    this.completedJobsRendered.add(jobId);
                    shouldRerender = true; // Trigger a single re-render on first completion
                }
            });
            
            if (shouldRerender) {
                this.renderMiningSlots(true);
            }
        }, 1000);
    }

    showLoadingState(isLoading, message = 'Loading Mining Data') {
        let loader = document.getElementById('mining-loading-overlay');
        
        if (isLoading) {
            this.loadingOverlayDepth = (this.loadingOverlayDepth || 0) + 1;
            if (!loader) {
                loader = document.createElement('div');
                loader.id = 'mining-loading-overlay';
                loader.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0, 0, 0, 0.9);
                    backdrop-filter: blur(10px);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    z-index: 20000;
                    pointer-events: all;
                    animation: fadeIn 0.3s ease;
                    overflow: hidden;
                `;
                
                document.body.appendChild(loader);
            }
            
            loader.innerHTML = `
                <div style="text-align: center; padding: 20px; max-width: 90%;">
                    <div style="font-size: 5rem; color: #00d4ff; margin-bottom: 30px; animation: spin 1s linear infinite;">
                        ⛏️
                    </div>
                    <h2 style="color: #00d4ff; margin-bottom: 20px; font-size: 2em; font-weight: bold;">${message}</h2>
                    <div style="color: #888; font-size: 1.2em; margin-bottom: 40px;">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span style="margin-left: 10px;">Please wait...</span>
                    </div>
                </div>
            `;
            
            // Add animation styles if not present
            if (!document.querySelector('#mining-loading-styles')) {
                const style = document.createElement('style');
                style.id = 'mining-loading-styles';
                style.textContent = `
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                `;
                document.head.appendChild(style);
            }
            
            loader.style.display = 'flex';
        } else {
            this.loadingOverlayDepth = Math.max((this.loadingOverlayDepth || 0) - 1, 0);
            if (loader && this.loadingOverlayDepth === 0) {
                loader.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => {
                    if (this.loadingOverlayDepth === 0) {
                        loader.style.display = 'none';
                    }
                }, 300);
            }
        }
    }

    async disconnectWallet() {
        console.log('[Mining] Disconnecting wallet...');
        
        try {
            // Realtime: Cleanup listeners but don't stop global realtime stream
            // Global realtime is managed by wallet.js, not individual pages
            this.cleanupRealtimeListeners();

            // Stop intervals
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
            
            // Reset state
            this.currentActor = null;
            this.isLoggedIn = false;
            this.activeJobs = [];
            this.effectiveSlots = 0;
            
            // Reset UI
            this.resetMiningUI();
            
            this.showNotification('👋 Wallet disconnected', 'success');
            
        } catch (error) {
            console.error('[Mining] Disconnect failed:', error);
            this.showNotification('Failed to disconnect: ' + error.message, 'error');
        }
    }

    resetMiningUI() {
        const headerGameDollars = document.getElementById('header-game-dollars');
        if (headerGameDollars) {
            headerGameDollars.textContent = 'Game $: 0';
        }
        
        const activeSitesEl = document.getElementById('active-mining-sites');
        const totalWorkforceEl = document.getElementById('total-workforce');
        
        if (activeSitesEl) activeSitesEl.textContent = '0';
        if (totalWorkforceEl) totalWorkforceEl.textContent = '0';
        
        const slotsGrid = document.getElementById('slots-grid');
        if (slotsGrid) {
            slotsGrid.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">Connect your wallet to view mining slots</p>';
        }
        
        const connectBtn = document.getElementById('connectWalletBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        
        if (connectBtn) {
            connectBtn.classList.remove('hidden');
            connectBtn.disabled = false;
            connectBtn.innerHTML = 'Connect Wallet';
        }
        if (logoutBtn) logoutBtn.classList.add('hidden');
    }

    showRewardPopup(amount, gemType, mp = null) {
        // Create popup overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(5px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            pointer-events: none;
            animation: fadeIn 0.3s ease-out;
        `;
        
        // Create sparkle particles container
        const sparkleContainer = document.createElement('div');
        sparkleContainer.style.cssText = 'position: absolute; width: 100%; height: 100%; pointer-events: none; overflow: hidden;';
        
        // Generate sparkle particles
        for (let i = 0; i < 30; i++) {
            const sparkle = document.createElement('div');
            sparkle.style.cssText = `
                position: absolute;
                width: ${Math.random() * 4 + 2}px;
                height: ${Math.random() * 4 + 2}px;
                background: radial-gradient(circle, #fff, transparent);
                border-radius: 50%;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                opacity: 0;
                animation: sparkleParticle ${Math.random() * 2 + 1}s infinite;
                animation-delay: ${Math.random() * 1}s;
                box-shadow: 0 0 10px rgba(0, 255, 100, 0.8);
            `;
            sparkleContainer.appendChild(sparkle);
        }
        
        overlay.appendChild(sparkleContainer);
        
        // Create popup content
        const popup = document.createElement('div');
        popup.style.cssText = `
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            border: 2px solid #00ff64;
            border-radius: 20px;
            padding: 40px;
            pointer-events: auto;
            text-align: center;
            box-shadow: 0 0 50px rgba(0, 255, 100, 0.5);
            animation: popIn 0.5s ease-out;
            position: relative;
            overflow: hidden;
            z-index: 1;
        `;
        
        popup.innerHTML = `
            <h2 style="color: #00ff64; font-size: 2em; margin: 20px 0; text-shadow: 0 0 20px rgba(0, 255, 100, 0.5);">
                Rewards Claimed!
            </h2>
            <div style="background: rgba(0, 255, 100, 0.1); border: 2px solid #00ff64; border-radius: 15px; padding: 30px; margin: 20px 0;">
                <div style="font-size: 4em; color: #00ff64; font-weight: bold; margin-bottom: 10px;">
                    ${amount.toLocaleString()}
                </div>
                <div style="font-size: 1.5em; color: #00d4ff; font-weight: 600;">
                    ${gemType}
                </div>
                ${mp ? `<div style="color: #888; margin-top: 10px; font-size: 0.9em;">
                    ${mp.toLocaleString()} MP
                </div>` : ''}
            </div>
            <button onclick="this.closest('[style*=\\'position: fixed\\']').remove()" style="
                background: linear-gradient(135deg, #00ff64, #00cc50);
                border: none;
                padding: 15px 40px;
                border-radius: 8px;
                color: #000;
                font-size: 1.2em;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(0, 255, 100, 0.3);
                transition: all 0.3s;
            ">
                Awesome!
            </button>
        `;
        
        overlay.appendChild(popup);
        document.body.appendChild(overlay);
        
        // Add sparkle animation CSS
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes popIn {
                from { transform: scale(0.5) rotate(-10deg); opacity: 0; }
                to { transform: scale(1) rotate(0deg); opacity: 1; }
            }
            @keyframes sparkleParticle {
                0% { opacity: 0; transform: scale(0) translateY(0); }
                20% { opacity: 1; transform: scale(1) translateY(0); }
                80% { opacity: 1; transform: scale(1) translateY(-20px); }
                100% { opacity: 0; transform: scale(0) translateY(-40px); }
            }
        `;
        document.head.appendChild(style);
    }

    async loadInventoryAndAssets(forceRefresh = false) {
        if (!this.currentActor) {
            console.warn('[Mining] loadInventoryAndAssets called without currentActor');
            return;
        }

        if (forceRefresh) {
            this.showNotification('Inventory updates automatically via realtime data.', 'info');
        }

        if (this.inventoryData) {
            this.updateInventoryStructures(this.inventoryData);
        }

        if (Array.isArray(this.realtimeData.miningSlots)) {
            this.updateStakedAssetsFromLive(this.realtimeData.miningSlots);
        }

        return {
            inventoryData: this.inventoryData,
            stakedAssets: {
                mining: this.stakedMines,
                workers: this.stakedWorkers
            }
        };
    }

    updateInventoryStructures(inventoryData) {
        this.inventoryData = inventoryData || null;
        this.mineNFTs = [];
        this.workerNFTs = [];
        this.speedboostNFTs = [];

        if (!inventoryData) {
            return;
        }

        if (inventoryData.equipmentDetails) {
            const equipmentArray = Object.entries(inventoryData.equipmentDetails).map(([templateId, details]) => {
                const assets = details.assets || [];
                return assets.map(assetId => {
                    const assetDetails = (inventoryData.assets || []).find(asset => asset.asset_id === assetId);
                    return {
                        template_id: templateId,
                        template_mint: assetDetails ? assetDetails.template_mint : 'unknown',
                        name: details.name,
                        mp: details.mp,
                        image: details.image,
                        imagePath: details.imagePath,
                        asset_id: assetId
                    };
                });
            }).flat();

            this.mineNFTs = equipmentArray.filter(nft => (nft.name || '').toLowerCase().includes('mine'));
            this.workerNFTs = equipmentArray.filter(nft => {
                const name = (nft.name || '').toLowerCase();
                return !name.includes('mine') && !name.includes('polishing');
            });
        }

        const speedboostDetails = inventoryData.speedboostDetails || {};
        const assets = inventoryData.assets || [];
        const processed = new Set();
        const speedboostList = [];

        Object.entries(speedboostDetails).forEach(([templateId, details]) => {
            const assetIds = details.assets || [];
            assetIds.forEach(assetId => {
                const assetRecord = assets.find(asset => asset.asset_id === assetId) || {};
                const info = SPEEDBOOST_BY_TEMPLATE[String(templateId)] || { boost: details.boost || 0 };
                speedboostList.push({
                    asset_id: assetId,
                    template_id: String(templateId),
                    template_mint: assetRecord.template_mint || 'unknown',
                    name: details.name || assetRecord.name || getSpeedboostName(templateId),
                    boost: assetRecord.boost ?? details.boost ?? info.boost ?? 0,
                    imagePath: details.imagePath || assetRecord.imagePath || getSpeedboostImage(templateId)
                });
                processed.add(assetId);
            });
        });

        assets.forEach(asset => {
            const templateId = String(asset.template_id || asset.template?.template_id);
            if (!SPEEDBOOST_BY_TEMPLATE[templateId]) {
                return;
            }
            if (processed.has(asset.asset_id)) {
                return;
            }
            const info = SPEEDBOOST_BY_TEMPLATE[templateId];
            speedboostList.push({
                asset_id: asset.asset_id,
                template_id: templateId,
                template_mint: asset.template_mint || 'unknown',
                name: getSpeedboostName(templateId, asset.name),
                boost: asset.boost ?? info.boost ?? 0,
                imagePath: asset.imagePath || getSpeedboostImage(templateId)
            });
        });

        this.speedboostNFTs = speedboostList;
        console.log('[Mining] speedboostNFTs prepared:', this.speedboostNFTs.length);
    }
}

// Initialize mining when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new MiningGame();
    window.game = game;
    window.tsdgemsGame = game;
});
