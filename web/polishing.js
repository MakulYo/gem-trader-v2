// TSDGEMS - Polishing Page Script (Backend-Connected)

// Polishing Constants (match backend)
// Dev environment: 1 minute, Prod: 1 hour
const isDev = window.location.hostname.includes('tsdgems-dev');
const POLISHING_DURATION_MS = isDev ? 1 * 60 * 1000 : 1 * 60 * 60 * 1000;
const MAX_POLISHING_SLOTS = 10;
const MAX_AMOUNT_PER_SLOT = 500;

// Slot unlock costs (NO TSDM COSTS - Backend checks for polishing tables)
const POLISHING_SLOT_UNLOCK_COSTS = [
  0,      // Slot 1 - Free/Already unlocked
  0,      // Slot 2 - Free (Backend checks for polishing tables)
  0,      // Slot 3 - Free (Backend checks for polishing tables)
  0,      // Slot 4 - Free (Backend checks for polishing tables)
  0,      // Slot 5 - Free (Backend checks for polishing tables)
  0,      // Slot 6 - Free (Backend checks for polishing tables)
  0,      // Slot 7 - Free (Backend checks for polishing tables)
  0,      // Slot 8 - Free (Backend checks for polishing tables)
  0,      // Slot 9 - Free (Backend checks for polishing tables)
  0       // Slot 10 - Free (Backend checks for polishing tables)
];

// Only one general rough gem type (input)
const ROUGH_GEM_KEY = 'rough_gems';

// 10 specific polished gem types (output)
const POLISHED_GEM_TYPES = [
    'polished_diamond',
    'polished_ruby',
    'polished_sapphire',
    'polished_emerald',
    'polished_jade',
    'polished_tanzanite',
    'polished_opal',
    'polished_aquamarine',
    'polished_topaz',
    'polished_amethyst'
];

class PolishingGame extends TSDGEMSGame {
    constructor() {
        super();
        
        console.log('[Polishing] ========================================');
        console.log('[Polishing] 🎨 PolishingGame Constructor');
        console.log('[Polishing] ========================================');
        
        this.backendService = window.backendService;
        this.isLoggedIn = false;
        this.currentActor = null;
        this.activeJobs = [];
        this.pendingCompletionJobs = new Set();
        this.effectiveSlots = 0;
        this.timerInterval = null;
        this.inventoryData = null;
        this.polishingTableNFTs = [];
        this.roughGemsCount = 0;
        this.polishedGems = {}; // { polished_diamond: X, polished_ruby: Y, ... }
        this.selectedSlotForStaking = null;
        this.stakedTables = {}; // { slotNum: { template_id, name } }
        
        this.awaitingInitialRealtime = false;
        this.initialRealtimePromise = null;
        this.initialRealtimeResolver = null;
        this.initialRealtimeReject = null;
        this.initialRealtimeTimer = null;
        this.realtimeHandlersRegistered = false;
        this.realtimeData = this.getEmptyRealtimeState();

        // Mobile optimization
        this.isMobile = this.detectMobile();
        if (this.isMobile) {
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    console.log('[Polishing] 📱 Mobile page hidden, clearing polishing cache');
                    this.clearPolishingCache();
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

    clearPolishingCache() {
        // Clear polishing data to free memory on mobile
        this.inventoryData = null;
        this.polishingTableNFTs = [];

        // Clear DataManager cache for polishing-related data
        if (window.dataManager) {
            window.dataManager.invalidate('inventory');
            window.dataManager.invalidate('stakedAssets');
        }

        console.log('[Polishing] 📱 Polishing cache cleared');
    }

    init() {
        console.log('[Polishing] Running init()...');
        this.setupWalletIntegration();
        this.setupWalletEventListeners();
        this.showNotification('Connect your wallet to access polishing operations', 'info');
        console.log('[Polishing] Init complete');
    }

    // 🔥 Setup listeners for live polishing slots data
    setupLiveDataListeners() {
        console.log('[Polishing] Setting up realtime listeners...');

        if (this.realtimeHandlersRegistered) {
            return;
        }

        this.realtimeHandlersRegistered = true;

        this.onRealtimeLive = (event) => {
            const { actor, live } = event.detail || {};
            if (!this.isEventForCurrentActor(actor)) {
                return;
            }
            console.log('[PolishingRealtime] live aggregate received, polishingSlots:', live?.polishingSlots?.length || 0);
            this.mergeLiveData(live);
        };

        this.onRealtimeProfile = (event) => {
            const { actor, profile } = event.detail || {};
            if (!this.isEventForCurrentActor(actor) || !profile) {
                return;
            }
            this.applyProfileFromRealtime(profile);
        };

        this.onRealtimePolishingSlots = (event) => {
            const { actor, slots } = event.detail || {};
            if (!this.isEventForCurrentActor(actor)) {
                return;
            }
            console.log('[PolishingRealtime] polishing-slots update, slots:', slots?.map(slot => ({
                id: slot.id,
                state: slot.state,
                hasTable: !!slot.staked?.find(s => s.type === 'table')
            })));
            this.applyPolishingSlotsFromRealtime(slots);
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
            console.log('[PolishingRealtime] inventory-gems update, roughGems:', gems?.rough_gems || 0, 'polishedTypes:', Object.keys(gems || {}).filter(k => k.startsWith('polished_')).length);
            this.applyGemsFromRealtime(gems);
        };

        window.addEventListener('realtime:live', this.onRealtimeLive);
        window.addEventListener('realtime:profile', this.onRealtimeProfile);
        window.addEventListener('realtime:polishing-slots', this.onRealtimePolishingSlots);
        window.addEventListener('realtime:inventory-summary', this.onRealtimeInventorySummary);
        window.addEventListener('realtime:inventory-gems', this.onRealtimeInventoryGems);
    }

    getEmptyRealtimeState() {
        return {
            live: null,
            profile: null,
            polishingSlots: [],
            inventory: null,
            inventorySummary: null,
            gems: null
        };
    }

    preparePolishingForRealtime() {
        this.showLoadingState(true);
    }

    clearInitialRealtimeTimer() {
        if (this.initialRealtimeTimer) {
            clearTimeout(this.initialRealtimeTimer);
            this.initialRealtimeTimer = null;
        }
    }

    handleRealtimeStartFailure(error) {
        console.error('[Polishing] Failed to start realtime polishing stream:', error);
        this.clearInitialRealtimeTimer();
        this.awaitingInitialRealtime = false;
        this.showLoadingState(false);
        this.rejectInitialRealtime(error);
        this.showNotification('Failed to start realtime polishing data: ' + error.message, 'error');
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
        this.clearInitialRealtimeTimer();
        this.awaitingInitialRealtime = false;
        this.resetInitialRealtimePromise();
        this.realtimeData = this.getEmptyRealtimeState();
        this.activeJobs = [];
        this.stakedTables = {};
        this.inventoryData = null;
        this.polishingTableNFTs = [];
        this.roughGemsCount = 0;
        this.polishedGems = {};
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
            console.warn('[Polishing] No actor provided, skipping realtime start');
            return Promise.resolve();
        }

        const sameActor = this.currentActor === actor;
        if (sameActor && !this.awaitingInitialRealtime && this.realtimeData.polishingSlots.length > 0) {
            console.log('[Polishing] Realtime polishing data already active');
            return Promise.resolve();
        }

        this.currentActor = actor;
        this.isLoggedIn = true;

        this.cleanupRealtimeSession();
        this.preparePolishingForRealtime();

        this.awaitingInitialRealtime = true;
        this.initialRealtimePromise = new Promise((resolve, reject) => {
            this.initialRealtimeResolver = resolve;
            this.initialRealtimeReject = reject;
        });

        if (window.TSDRealtime && typeof window.TSDRealtime.start === 'function') {
            try {
                window.TSDRealtime.start(actor);
            } catch (error) {
                this.handleRealtimeStartFailure(error);
                throw error;
            }
        } else {
            const error = new Error('TSDRealtime is not available');
            this.handleRealtimeStartFailure(error);
            throw error;
        }

        this.initialRealtimeTimer = setTimeout(() => {
            if (this.awaitingInitialRealtime) {
                this.showNotification('Waiting for realtime polishing data...', 'info');
            }
        }, 4000);

        return this.initialRealtimePromise;
    }

    markRealtimeInitialized() {
        if (!this.awaitingInitialRealtime) {
            return;
        }
        this.awaitingInitialRealtime = false;
        this.clearInitialRealtimeTimer();
        this.showLoadingState(false);
        this.resolveInitialRealtime();
    }

    mergeLiveData(live) {
        if (!live || typeof live !== 'object') {
            return;
        }

        this.realtimeData.live = live;

        if (live.profile) {
            this.applyProfileFromRealtime(live.profile);
        }
        if (live.polishingSlots) {
            this.applyPolishingSlotsFromRealtime(live.polishingSlots);
        }
        if (live.inventory) {
            this.applyInventoryFromRealtime(live.inventory);
        } else if (live.inventorySummary) {
            this.applyInventorySummaryFromRealtime(live.inventorySummary);
        }
        if (live.gems) {
            this.applyGemsFromRealtime(live.gems);
        }
    }

    applyProfileFromRealtime(profile) {
        const rawCurrency = Number(profile.ingameCurrency ?? profile.ingame_currency ?? 0);
        const previousCurrency = Number(this.currentGameDollars ?? 0);
        const sanitizedCurrency = Number.isFinite(rawCurrency) ? rawCurrency : 0;
        const effectiveCurrency = sanitizedCurrency <= 0 && previousCurrency > 0
            ? previousCurrency
            : sanitizedCurrency;
        this.updateGameDollars(effectiveCurrency, false);

        if (typeof profile.polishingSlotsUnlocked === 'number') {
            const unlocked = Math.max(0, Math.min(profile.polishingSlotsUnlocked, MAX_POLISHING_SLOTS));
            if (unlocked !== this.effectiveSlots) {
                this.effectiveSlots = unlocked;
                this.renderPolishingSlots();
            }
        }
    }

    applyPolishingSlotsFromRealtime(slots) {
        if (!Array.isArray(slots)) {
            return;
        }
        this.realtimeData.polishingSlots = slots;
        this.updatePolishingSlotsFromLive(slots);
        this.updatePolishingStats();
        this.startTimerUpdates();
        this.markRealtimeInitialized();
    }

    applyInventoryFromRealtime(inventoryData) {
        if (!inventoryData || typeof inventoryData !== 'object') {
            return;
        }

        this.realtimeData.inventory = {
            ...(this.realtimeData.inventory || {}),
            ...inventoryData
        };

        this.inventoryData = this.realtimeData.inventory;
        this.processInventoryDetails(this.inventoryData);
        this.renderPolishingSlots();
        this.updatePolishingStats();
    }

    applyInventorySummaryFromRealtime(summary) {
        if (!summary || typeof summary !== 'object') {
            return;
        }
        this.realtimeData.inventorySummary = summary;
        if (summary.inventory) {
            this.applyInventoryFromRealtime(summary.inventory);
        }
    }

    updatePolishingSlotsFromLive(slots) {
        if (!Array.isArray(slots)) {
            slots = [];
        }

        const previousJobs = Array.isArray(this.activeJobs) ? this.activeJobs : [];
        const jobBySlot = new Map(previousJobs.map(job => [job.slotNum, job]));
        const updatedJobs = [];
        const updatedPending = new Set();
        const nextStakedTables = {};

        slots.forEach((slot) => {
            const slotNum = Number(slot?.id ?? slot?.slotNum ?? slot?.slot_id ?? slot?.slot);
            if (!slotNum || Number.isNaN(slotNum)) {
                return;
            }

            const stakedAssets = Array.isArray(slot?.staked) ? slot.staked : [];
            const tableAsset = stakedAssets.find(asset => (asset?.type || '').toLowerCase() === 'table');
            if (tableAsset && tableAsset.asset_id) {
                nextStakedTables[slotNum] = {
                    template_id: tableAsset.template_id,
                    name: tableAsset.name || `Table ${slotNum}`,
                    imagePath: tableAsset.imagePath || tableAsset.image || '',
                    asset_id: tableAsset.asset_id
                };
            }

            const state = String(slot?.state || slot?.status || '').toLowerCase();
            if (state === 'active' || state === 'complete' || state === 'ready') {
                const previousJob = jobBySlot.get(slotNum) || {};
                const jobId = slot.jobId || previousJob.jobId || `slot${slotNum}`;
                if (this.pendingCompletionJobs.has(jobId)) {
                    updatedPending.add(jobId);
                    return;
                }

                const startedAt = this.toMillis(slot.startedAt ?? previousJob.startedAt ?? null);
                const finishAt = this.toMillis(slot.finishAt ?? previousJob.finishAt ?? null);
                const amountIn = Number(slot.amountIn ?? slot.amount ?? slot.gemsIn ?? previousJob.amountIn ?? 0);
                const power = Number(slot.power ?? previousJob.power ?? 0);

                updatedJobs.push({
                    slotNum,
                    jobId,
                    startedAt,
                    finishAt: finishAt ?? (startedAt ? startedAt + POLISHING_DURATION_MS : null),
                    amountIn,
                    power
                });
            }
        });

        this.pendingCompletionJobs = updatedPending;
        this.stakedTables = nextStakedTables;
        this.activeJobs = updatedJobs;
        this.polishingSlots = slots;

        this.renderPolishingSlots();
    }

    toMillis(value) {
        if (!value) return null;
        if (typeof value === 'number') return value;
        if (value instanceof Date) return value.getTime();
        if (typeof value === 'string') {
            const parsed = Date.parse(value);
            return Number.isNaN(parsed) ? null : parsed;
        }
        if (typeof value.toMillis === 'function') {
            return value.toMillis();
        }
        if (typeof value === 'object' && value._seconds != null) {
            const seconds = Number(value._seconds);
            const nanos = Number(value._nanoseconds || 0);
            if (Number.isFinite(seconds)) {
                return (seconds * 1000) + Math.floor(nanos / 1e6);
            }
        }
        return null;
    }

    applyGemsFromRealtime(gems) {
        if (!gems || typeof gems !== 'object') {
            return;
        }
        this.realtimeData.gems = gems;
        this.roughGemsCount = Number(gems[ROUGH_GEM_KEY] ?? 0);

        const polished = {};
        POLISHED_GEM_TYPES.forEach(type => {
            polished[type] = Number(gems[type] ?? 0);
        });
        this.polishedGems = polished;

        this.updatePolishingStats();
        this.renderPolishingSlots();
    }

    processInventoryDetails(inventoryData) {
        this.polishingTableNFTs = [];
        if (!inventoryData || !inventoryData.equipmentDetails) {
            return;
        }

        const equipmentArray = Object.entries(inventoryData.equipmentDetails).flatMap(([templateId, details]) => {
            const assets = details.assets || [];
            return assets.map(assetId => {
                const assetDetails = (inventoryData.assets || []).find(asset => asset.asset_id === assetId);
                return {
                    template_id: templateId,
                    template_mint: assetDetails ? assetDetails.template_mint : 'unknown',
                    name: details.name,
                    image: details.image,
                    imagePath: details.imagePath,
                    asset_id: assetId
                };
            });
        });

        this.polishingTableNFTs = equipmentArray.filter(nft => (nft.name || '').toLowerCase().includes('polishing'));
    }

    setupWalletEventListeners() {
        console.log('[Polishing] Setting up wallet event listeners...');
        
        window.addEventListener('wallet-connected', async (event) => {
            const { actor } = event.detail;
            console.log('[Polishing] 🔗 Wallet connected event received, actor:', actor);
            
            if (!actor) return;
            
            this.currentActor = actor;
            this.isLoggedIn = true;
            
            await this.loadPolishingData(actor);
        });
        
        window.addEventListener('wallet-session-restored', async (event) => {
            const { actor } = event.detail;
            console.log('[Polishing] 🔄 Wallet session restored event received, actor:', actor);
            
            if (!actor) return;
            
            this.currentActor = actor;
            this.isLoggedIn = true;
            
            const connectBtn = document.getElementById('connectWalletBtn');
            if (connectBtn) {
                // Let wallet.js control the button label; only disable here
                connectBtn.disabled = true;
            }
            
            this.showNotification(`🔄 Welcome back, ${actor}!`, 'info');
            await this.loadPolishingData(actor);
        });
        
        console.log('[Polishing] ✅ Wallet event listeners registered');
        
        setTimeout(() => {
            if (window.walletSessionInfo && window.walletSessionInfo.actor && !this.currentActor) {
                const actor = window.walletSessionInfo.actor;
                console.log('[Polishing] 🔍 Found existing wallet session:', actor);
                this.currentActor = actor;
                this.isLoggedIn = true;
                
                const connectBtn = document.getElementById('connectWalletBtn');
                if (connectBtn) {
                    connectBtn.disabled = true;
                }
                
                this.showNotification(`🔄 Welcome back, ${actor}!`, 'info');
                this.loadPolishingData(actor);
            }
        }, 200);
    }

    setupWalletIntegration() {
        console.log('[Polishing] Setting up wallet integration...');
        
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
    }

    async connectWallet() {
        const connectBtn = document.getElementById('connectWalletBtn');
        const originalText = connectBtn ? connectBtn.innerHTML : '';
        
        try {
            console.log('[Polishing] Starting wallet connection...');
            
            if (connectBtn) {
                connectBtn.disabled = true;
                connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
            }
            
            this.showNotification('🔗 Connecting to wallet...', 'info');
            
            const actor = await window.walletConnect();
            console.log('[Polishing] Wallet connected, actor:', actor);
            
            if (!actor) {
                throw new Error('No actor returned from wallet');
            }

            this.currentActor = actor;
            this.isLoggedIn = true;

            // Button label handled by wallet.js
            
            this.showNotification(`✅ Connected as ${actor}`, 'success');
            
            await this.loadPolishingData(actor);
            
        } catch (error) {
            console.error('[Polishing] Wallet connection failed:', error);
            
            if (connectBtn) {
                connectBtn.disabled = false;
                connectBtn.innerHTML = originalText;
            }
            
            this.showNotification('❌ Failed to connect wallet: ' + error.message, 'error');}
    }

    async loadPolishingData(actor) {
        // LEGACY WRAPPER: Manual data fetching removed - relying solely on realtime events
        // All polishing data loading is now handled via TSDRealtime events (realtime:polishing-slots, realtime:inventory-gems, etc.)
        console.log('[PolishingLegacyLoader] loadPolishingData called - now just starts realtime for actor:', actor);
        
        if (!actor) {
            console.warn('[Polishing] loadPolishingData called without actor');
            return;
        }

        if (this.awaitingInitialRealtime && this.currentActor === actor && this.initialRealtimePromise) {
            console.log('[Polishing] Realtime load already in progress - waiting for next update');
            return this.initialRealtimePromise;
        }

        return this.startRealtimeForActor(actor);
    }

    /**
     * Extract all staked asset IDs from staking data
     * @returns {Set<string>} Set of staked asset_ids
     */
    getStakedAssetIds() {
        const stakedAssetIds = new Set();
        
        // Add staked polishing tables
        Object.values(this.stakedTables).forEach(table => {
            if (table.asset_id) {
                stakedAssetIds.add(table.asset_id);
            }
        });
        
        console.log('[Polishing] Found', stakedAssetIds.size, 'staked asset IDs');
        return stakedAssetIds;
    }

    renderPolishingSlots() {
        const slotsGrid = document.getElementById('polishing-slots-grid');
        if (!slotsGrid) {
            console.warn('[Polishing] No slots grid element found');
            return;
        }

        console.log('[Polishing] Rendering polishing slots...');
        console.log('[Polishing] - Effective slots:', this.effectiveSlots);
        console.log('[Polishing] - Active jobs:', this.activeJobs.length);
        
        if (this.effectiveSlots === 0) {
            slotsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: rgba(255, 149, 0, 0.1); border: 2px dashed rgba(255, 149, 0, 0.3); border-radius: 12px;">
                    <i class="fas fa-tools" style="font-size: 4rem; color: #ff9500; margin-bottom: 20px;"></i>
                    <h3 style="color: #ff9500; margin-bottom: 15px; font-size: 1.5em;">No Polishing Tables Available</h3>
                    <p style="color: #888; margin-bottom: 15px; font-size: 1.1em;">You need to own Polishing Table NFTs to unlock polishing slots.</p>
                    <p style="color: #aaa; font-size: 0.95rem; margin-bottom: 25px;">Each Polishing Table unlocks 1 slot (max 10 slots)</p>
                    <a href="https://neftyblocks.com/collection/tsdmediagems" target="_blank" rel="noopener" class="action-btn primary" style="display: inline-block; text-decoration: none;">
                        <i class="fas fa-shopping-cart"></i> Buy Polishing Tables
                    </a>
                </div>
            `;
            return;
        }

        const slots = [];
        
        for (let i = 0; i < MAX_POLISHING_SLOTS; i++) {
            const slotNum = i + 1;
            const isUnlocked = i < this.effectiveSlots;
            const activeJob = this.activeJobs.find(job => job.slotNum === slotNum);
            
            slots.push({
                slotNum,
                isUnlocked,
                activeJob
            });
        }

        slotsGrid.innerHTML = slots.map(slot => {
            if (!slot.isUnlocked) {
                return `
                    <div class="polishing-slot locked">
                        <div class="slot-header">
                            <span class="slot-locked">🔒 LOCKED</span>
                        </div>
                        <div class="slot-content-layout">
                            <p class="slot-description">Purchase Polishing Table NFTs to unlock this slot</p>
                        </div>
                    </div>
                `;
            }

            if (slot.activeJob) {
                const job = slot.activeJob;
                const now = Date.now();
                const remaining = Math.max(0, job.finishAt - now);
                const progress = Math.min(100, ((POLISHING_DURATION_MS - remaining) / POLISHING_DURATION_MS) * 100);
                const isComplete = remaining === 0;
                
                return `
                    <div class="polishing-slot active ${isComplete ? 'complete' : 'in-progress'}" data-job-id="${job.jobId}" style="border: 2px solid ${isComplete ? '#00ff64' : '#ff9500'}; box-shadow: 0 0 20px ${isComplete ? 'rgba(0, 255, 100, 0.3)' : 'rgba(255, 149, 0, 0.3)'};">
                        <div class="slot-header">
                            <h4>Slot ${slot.slotNum} ${isComplete ? '💎' : '✨'}</h4>
                            <span class="slot-status ${isComplete ? 'complete' : 'active'}" style="background: ${isComplete ? '#00ff64' : '#ff9500'}; color: #000; padding: 4px 12px; border-radius: 12px; font-weight: bold;">
                                ${isComplete ? '✅ Ready to Collect' : '✨ Polishing'}
                            </span>
                        </div>
                        <div class="slot-info" style="padding: 30px 20px; text-align: center;">
                            <p style="color: #ff9500; font-size: 1.1em; margin-bottom: 15px;">
                                <i class="fas fa-gem"></i> Polishing ${job.amountIn.toLocaleString()} Rough Gems
                            </p>
                            <p style="font-size: 2.5em; font-weight: bold; color: ${isComplete ? '#00ff64' : '#ff9500'}; margin-bottom: 20px;">
                                <span class="timer" data-finish="${job.finishAt}" data-job-id="${job.jobId}">
                                    ${this.formatTime(remaining)}
                                </span>
                            </p>
                            <div class="progress-bar" style="margin: 20px 0; background: rgba(255,255,255,0.1); border-radius: 8px; height: 20px; overflow: hidden;">
                                <div class="progress-fill" style="width: ${progress}%; background: ${isComplete ? 'linear-gradient(90deg, #00ff64, #00aa44)' : 'linear-gradient(90deg, #ff9500, #ff6b00)'}; height: 100%; transition: width 1s linear;"></div>
                            </div>
                            <p style="color: ${isComplete ? '#00ff64' : '#888'}; font-size: 1.2em; margin-top: 15px;">
                                ${isComplete ? '✅ Polishing Complete!' : `${Math.floor(progress)}% Complete`}
                            </p>
                        </div>
                        ${isComplete ? `
                            <button class="action-btn claim-btn" onclick="game.completePolishing('${job.jobId}')">
                                <i class="fas fa-gift"></i> CLAIM REWARDS
                            </button>
                        ` : ''}
            </div>
                `;
    }

            // Available slot (unlocked but no job)
            const stakedTable = this.stakedTables[slot.slotNum];

            const maxAmount = Math.min(this.roughGemsCount, MAX_AMOUNT_PER_SLOT);

            // Get template_mint for table if available
            const tableInventoryAsset = stakedTable && this.inventoryData && this.inventoryData.assets ?
                this.inventoryData.assets.find(asset => asset.asset_id === stakedTable.asset_id) : null;
            const tableTemplateMint = tableInventoryAsset && tableInventoryAsset.template_mint !== 'unknown' ?
                tableInventoryAsset.template_mint : null;

            return `
                <div class="polishing-slot ${stakedTable ? 'rented' : 'available'}">
                    <div class="slot-header">
                        ${stakedTable ? `<span class="slot-staked">✨ ${stakedTable.name}</span>` : ''}
                    </div>
                    <div class="slot-content-layout">
                        ${stakedTable && stakedTable.imagePath ? `
                            <div class="slot-polishing-image-container" style="text-align: center; margin: 15px 0;">
                                <img src="${stakedTable.imagePath}"
                                     class="slot-polishing-image"
                                     alt="${stakedTable.name}"
                                     style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; border: 2px solid rgba(255, 149, 0, 0.3);">
                                ${tableTemplateMint ? `<div style="margin-top: 8px; color: #ffd700; font-size: 0.8em; font-weight: 600;">Mint #${tableTemplateMint}</div>` : ''}
                            </div>
                        ` : ''}
                        <p class="slot-description">${stakedTable ? 'Enter amount and start polishing' : 'Stake a Polishing Table NFT to begin'}</p>
                    </div>
                    ${stakedTable ? `
                        <div style="margin: 15px 0; padding: 15px; background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 8px;">
                            <p style="color: #00d4ff; margin: 0 0 5px 0; font-size: 0.85em;">
                                <i class="fas fa-gem"></i> Rough Gems Available: <strong>${this.roughGemsCount.toLocaleString()}</strong>
                            </p>
                            <p style="color: #888; margin: 0; font-size: 0.8em;">
                                <i class="fas fa-info-circle"></i> Max per slot: ${MAX_AMOUNT_PER_SLOT.toLocaleString()}
                            </p>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <label style="color: #ff9500; display: block; margin-bottom: 8px; font-weight: 600; font-size: 0.9em;">
                                Amount to Polish:
                            </label>
                            <input type="number" 
                                   id="polish-amount-slot-${slot.slotNum}" 
                                   min="1" 
                                   max="${maxAmount}" 
                                   value="${Math.min(10, maxAmount)}" 
                                   ${this.roughGemsCount === 0 ? 'disabled' : ''}
                                   style="width: 100%; padding: 12px; background: rgba(0, 0, 0, 0.3); border: 2px solid #ff9500; border-radius: 8px; color: white; font-size: 1.1em; text-align: center; font-weight: bold;"
                                   oninput="this.value = Math.max(1, Math.min(${maxAmount}, parseInt(this.value) || 1))">
                            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin-top: 8px;">
                                <button onclick="document.getElementById('polish-amount-slot-${slot.slotNum}').value = 1" class="action-btn secondary" style="padding: 6px; font-size: 0.8em;">1x</button>
                                <button onclick="document.getElementById('polish-amount-slot-${slot.slotNum}').value = Math.min(10, ${maxAmount})" class="action-btn secondary" style="padding: 6px; font-size: 0.8em;">10x</button>
                                <button onclick="document.getElementById('polish-amount-slot-${slot.slotNum}').value = Math.floor(${maxAmount} / 2)" class="action-btn secondary" style="padding: 6px; font-size: 0.8em;">50%</button>
                                <button onclick="document.getElementById('polish-amount-slot-${slot.slotNum}').value = ${maxAmount}" class="action-btn secondary" style="padding: 6px; font-size: 0.8em;">Max</button>
                            </div>
                        </div>
                    ` : ''}
                    <div class="slot-actions" style="display: flex; flex-direction: column; gap: 0.5rem;">
                        ${stakedTable ? `
                            <button onclick="game.startPolishingDirect(${slot.slotNum})" class="action-btn primary" ${this.roughGemsCount === 0 ? 'disabled' : ''}>
                                <i class="fas fa-play"></i> Start Polishing (1 Hour)
                            </button>
                            <button onclick="game.unstakeTable(${slot.slotNum})" class="action-btn warning">
                                <i class="fas fa-times"></i> Unstake Table
                            </button>
                        ` : `
                            <button onclick="game.openStakeTableModal(${slot.slotNum})" class="action-btn secondary">
                                <i class="fas fa-table"></i> Stake Polishing Table
                            </button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    }

    updatePolishingStats() {
        const totalPolished = Object.values(this.polishedGems).reduce((sum, val) => sum + val, 0);
        const totalInventory = this.roughGemsCount + totalPolished;
        
        const roughEl = document.getElementById('rough-gems-polishing-count');
        const polishedEl = document.getElementById('polished-gems-polishing-count');
        const tablesEl = document.getElementById('polishing-tables-count');
        const inventoryEl = document.getElementById('total-inventory-gems');
        
        // Count staked tables
        const stakedTablesCount = Object.keys(this.stakedTables).length;
        
        if (roughEl) roughEl.textContent = this.roughGemsCount.toLocaleString();
        if (polishedEl) polishedEl.textContent = totalPolished.toLocaleString();
        if (tablesEl) tablesEl.textContent = `${stakedTablesCount}/10`;
        if (inventoryEl) inventoryEl.textContent = totalInventory.toLocaleString();
        
        // Update polished gems table
        this.renderPolishedGemsTable();
    }

    renderPolishedGemsTable() {
        const tableBody = document.getElementById('polished-gems-table-body');
        if (!tableBody) return;

        const gemInfo = [
            { type: 'polished_diamond', name: 'Diamond', chance: '3%', rarity: 'Legendary', color: '#b9f2ff' },
            { type: 'polished_ruby', name: 'Ruby', chance: '5%', rarity: 'Epic', color: '#ff6b9d' },
            { type: 'polished_sapphire', name: 'Sapphire', chance: '10%', rarity: 'Rare', color: '#4169e1' },
            { type: 'polished_emerald', name: 'Emerald', chance: '10%', rarity: 'Rare', color: '#50c878' },
            { type: 'polished_jade', name: 'Jade', chance: '11.66%', rarity: 'Uncommon', color: '#00a86b' },
            { type: 'polished_tanzanite', name: 'Tanzanite', chance: '11.66%', rarity: 'Uncommon', color: '#5d3fd3' },
            { type: 'polished_opal', name: 'Opal', chance: '11.66%', rarity: 'Uncommon', color: '#a8c3bc' },
            { type: 'polished_aquamarine', name: 'Aquamarine', chance: '11.66%', rarity: 'Uncommon', color: '#7fffd4' },
            { type: 'polished_topaz', name: 'Topaz', chance: '11.66%', rarity: 'Uncommon', color: '#ffc87c' },
            { type: 'polished_amethyst', name: 'Amethyst', chance: '11.66%', rarity: 'Uncommon', color: '#9966cc' }
        ];

        tableBody.innerHTML = gemInfo.map(gem => {
            const owned = this.polishedGems[gem.type] || 0;
            return `
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                    <td style="padding: 12px;">
                        <span style="color: ${gem.color}; font-weight: 600;">
                            <i class="fas fa-gem"></i> ${gem.name}
                        </span>
                    </td>
                    <td style="padding: 12px; text-align: center; color: #ff9500; font-weight: 600;">
                        ${gem.chance}
                    </td>
                    <td style="padding: 12px; text-align: center; color: ${gem.rarity === 'Legendary' ? '#b9f2ff' : gem.rarity === 'Epic' ? '#ff6b9d' : gem.rarity === 'Rare' ? '#4169e1' : '#aaa'};">
                        ${gem.rarity}
                    </td>
                    <td style="padding: 12px; text-align: right; color: #00d4ff; font-weight: 600;">
                        ${owned.toLocaleString()}
                    </td>
                </tr>
            `;
        }).join('');
    }

    openStakeTableModal(slotNum) {
        console.log('[Polishing] Opening stake table modal for slot:', slotNum);
        
        this.selectedSlotForStaking = slotNum;
        
        // Get staked asset IDs to filter them out
        const stakedAssetIds = this.getStakedAssetIds();
        console.log('[Polishing] Staked asset IDs:', stakedAssetIds);
        
        let galleryContent = '';
        
        if (this.polishingTableNFTs.length === 0) {
            galleryContent = `
                <div style="text-align: center; padding: 60px 20px; background: rgba(0, 0, 0, 0.2); border-radius: 8px; border: 2px dashed #888;">
                    <i class="fas fa-table" style="font-size: 64px; color: #888; margin-bottom: 20px;"></i>
                    <h3 style="color: #ff9500; margin-bottom: 15px; font-size: 1.3em;">No Polishing Table NFTs Available</h3>
                    <p style="color: #888; margin-bottom: 30px; max-width: 400px; margin-left: auto; margin-right: auto;">
                        You don't own any Polishing Table NFTs yet. Purchase them on NeftyBlocks!
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
            // Filter out already staked tables
            let availableTables = this.polishingTableNFTs.filter(nft => !stakedAssetIds.has(nft.asset_id));

            // Sort by priority/quality if needed (currently sorted by name)
            // You could add other sorting criteria here
            availableTables.sort((a, b) => a.name.localeCompare(b.name));
            
            console.log('[Polishing] Available tables after filtering and sorting:', availableTables.length, 'of', this.polishingTableNFTs.length);
            
            if (availableTables.length === 0) {
                // All tables are already staked
                galleryContent = `
                    <div style="text-align: center; padding: 60px 20px; background: rgba(255, 152, 0, 0.1); border-radius: 8px; border: 2px solid #ff9800;">
                        <i class="fas fa-check-circle" style="font-size: 64px; color: #ff9800; margin-bottom: 20px;"></i>
                        <h3 style="color: #ff9800; margin-bottom: 15px; font-size: 1.3em;">All Tables Already Staked!</h3>
                        <p style="color: #888; margin-bottom: 30px; max-width: 400px; margin-left: auto; margin-right: auto;">
                            All your polishing table NFTs are currently staked. Unstake a table from another slot or purchase more on NeftyBlocks.
                        </p>
                        <button class="action-btn secondary" onclick="game.closeStakeModal()">
                            <i class="fas fa-times"></i> Close
                        </button>
                    </div>
                `;
            } else {
            
            galleryContent = `
                <p style="margin-bottom: 10px; color: #888; font-size: 0.9em;">
                    Select a Polishing Table NFT to stake in this slot.
                </p>
                ${availableTables.length < this.polishingTableNFTs.length ? `
                    <div style="background: rgba(255, 152, 0, 0.1); border: 1px solid rgba(255, 152, 0, 0.3); border-radius: 6px; padding: 8px; margin-bottom: 10px;">
                        <p style="color: #ff9800; margin: 0; font-size: 0.8em;">
                            <i class="fas fa-info-circle"></i> ${this.polishingTableNFTs.length - availableTables.length} table(s) already staked
                        </p>
                    </div>
                ` : ''}
                <div class="nft-gallery-grid" style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: ${window.innerWidth <= 768 ? '0.35rem' : '10px'}; padding: 5px; justify-content: start; overflow: visible;">
                    ${availableTables.map(nft => `
                        <div class="nft-card" style="border: 2px solid #ff9500; border-radius: 6px; padding: ${window.innerWidth <= 768 ? '6px' : '8px'}; background: rgba(0, 0, 0, 0.3); cursor: pointer; transition: all 0.3s; min-width: 0;" onclick="game.stakeTable('${nft.template_id}', ${slotNum}, '${nft.name}', '${nft.imagePath || ''}', '${nft.asset_id}')">
                            <div style="position: relative;">
                                ${nft.imagePath ? `
                                    <img src="${nft.imagePath}" alt="${nft.name}" style="width: 100%; height: ${window.innerWidth <= 768 ? 'auto' : '100px'}; aspect-ratio: ${window.innerWidth <= 768 ? '1' : 'auto'}; object-fit: cover; border-radius: 4px; margin-bottom: 8px;" onerror="this.style.display='none'">
                                ` : ''}
                                ${nft.template_mint && nft.template_mint !== 'unknown' ? `<div class="mint-badge">#${nft.template_mint}</div>` : ''}
                            </div>
                            <h4 style="color: #ff9500; margin-bottom: 4px; font-size: ${window.innerWidth <= 768 ? '0.7em' : '0.85em'};">${nft.name}</h4>
                        </div>
                    `).join('')}
                </div>
            `;
            }
        }
        
        const modalContent = `${galleryContent}`;
        
        const modalOverlay = document.getElementById('modal-overlay');
        const modalBody = document.getElementById('modal-body');
        
        if (modalBody) {
            modalBody.innerHTML = modalContent;
            
            // Target the .modal container (parent of modalBody) and modal-header
            const modalContainer = modalBody.parentElement;
            const modalHeader = modalContainer.querySelector('.modal-header');
            
            if (modalHeader) {
                modalHeader.innerHTML = `
                    <h3><i class="fas fa-table"></i> Stake Polishing Table to Slot ${slotNum}</h3>
                    <button class="modal-close" onclick="game.closeStakeModal()" style="background: none; border: none; color: #a0a0a0; font-size: 1.5rem; cursor: pointer;">
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
                    // Desktop: Auto-adjust width to fit 4 tables
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

    openStartPolishingModal(slotNum) {
        console.log('[Polishing] Opening start polishing modal for slot:', slotNum);
        
        this.selectedSlotForStaking = slotNum;
        
        // Check if table is staked
        const stakedTable = this.stakedTables[slotNum];
        if (!stakedTable) {
            this.showNotification('❌ Please stake a Polishing Table first!', 'error');
            return;
        }
        
        // Check if rough gems are available
        if (this.roughGemsCount === 0) {
            this.showNotification('❌ No rough gems available to polish!', 'error');
            return;
        }
        
        const maxAmount = Math.min(this.roughGemsCount, MAX_AMOUNT_PER_SLOT);
        
        const modalContent = `
            <div class="polishing-amount-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-gem"></i> Start Polishing - Slot ${slotNum}</h3>
                    <button class="modal-close" onclick="game.closeStakeModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div style="text-align: center; margin-bottom: 25px;">
                        <i class="fas fa-gem" style="font-size: 3rem; color: #ff9500; margin-bottom: 15px;"></i>
                        <p style="color: #888; margin-bottom: 15px; font-size: 1.1em;">How many rough gems do you want to polish?</p>
                        <p style="color: #ff9500; font-size: 1.2em; font-weight: bold;">
                            <i class="fas fa-layer-group"></i> Available: ${this.roughGemsCount.toLocaleString()}
                        </p>
                        <p style="color: #888; font-size: 0.9em; margin-top: 8px;">
                            <i class="fas fa-info-circle"></i> Max per slot: ${MAX_AMOUNT_PER_SLOT.toLocaleString()}
                        </p>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label style="color: #888; display: block; margin-bottom: 8px; font-weight: 600;">Amount to Polish:</label>
                        <input type="number" id="polish-amount-input" min="1" max="${maxAmount}" value="${Math.min(1, maxAmount)}" 
                               style="width: 100%; padding: 15px; background: rgba(0, 0, 0, 0.3); border: 2px solid #ff9500; border-radius: 8px; color: white; font-size: 1.3em; text-align: center; font-weight: bold;"
                               oninput="this.value = Math.max(1, Math.min(${maxAmount}, parseInt(this.value) || 1))">
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 25px;">
                        <button onclick="document.getElementById('polish-amount-input').value = 1" class="action-btn secondary" style="padding: 10px; font-size: 0.9em;">1x</button>
                        <button onclick="document.getElementById('polish-amount-input').value = Math.min(10, ${maxAmount})" class="action-btn secondary" style="padding: 10px; font-size: 0.9em;">10x</button>
                        <button onclick="document.getElementById('polish-amount-input').value = Math.floor(${maxAmount} / 2)" class="action-btn secondary" style="padding: 10px; font-size: 0.9em;">50%</button>
                        <button onclick="document.getElementById('polish-amount-input').value = ${maxAmount}" class="action-btn secondary" style="padding: 10px; font-size: 0.9em;">Max</button>
                    </div>
                    <div style="background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <p style="color: #00d4ff; margin: 0; font-size: 0.9em;">
                            <i class="fas fa-clock"></i> Polishing Duration: <strong>1 Hour</strong>
                        </p>
                        <p style="color: #00d4ff; margin: 5px 0 0 0; font-size: 0.9em;">
                            <i class="fas fa-exchange-alt"></i> Conversion: <strong>1:1</strong> (exact amount)
                        </p>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="game.confirmStartPolishing(${slotNum})" class="action-btn primary" style="flex: 1; font-size: 1.1em; padding: 15px;">
                            <i class="fas fa-play"></i> Start Polishing
                        </button>
                        <button onclick="game.closeStakeModal()" class="action-btn secondary">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        const modalOverlay = document.getElementById('modal-overlay');
        const modalBody = document.getElementById('modal-body');
        
        if (modalBody) {
            modalBody.innerHTML = modalContent;
        }
        
        if (modalOverlay) {
            openModal(modalOverlay);
        }
    }

    async startPolishingDirect(slotNum) {
        console.log('[Polishing] startPolishingDirect called, slotNum:', slotNum);

        // Show loading state on button
        const button = document.querySelector(`button[onclick*="startPolishingDirect(${slotNum})"]`);
        const originalText = button ? button.innerHTML : '';
        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting...';
        }

        try {
            const amountInput = document.getElementById(`polish-amount-slot-${slotNum}`);
            console.log('[Polishing] Amount input element:', amountInput);
            const amount = parseInt(amountInput?.value || 0);
            console.log('[Polishing] Amount to polish:', amount);

            if (!amount || amount <= 0) {
                this.showNotification('❌ Please enter a valid amount!', 'error');
                return;
            }

            if (amount > this.roughGemsCount) {
                this.showNotification('❌ Not enough rough gems!', 'error');
                return;
            }

            if (amount > MAX_AMOUNT_PER_SLOT) {
                this.showNotification(`❌ Maximum ${MAX_AMOUNT_PER_SLOT} gems per slot!`, 'error');
                return;
            }

            await this.startPolishing(amount, slotNum);
        } finally {
            // Restore button state
            if (button) {
                button.disabled = false;
                button.innerHTML = originalText;
            }
        }
    }

    async confirmStartPolishing(slotNum) {
        const amountInput = document.getElementById('polish-amount-input');
        const amount = parseInt(amountInput?.value || 0);
        
        if (!amount || amount <= 0) {
            this.showNotification('❌ Please enter a valid amount!', 'error');
            return;
        }
        
        if (amount > this.roughGemsCount) {
            this.showNotification('❌ Not enough rough gems!', 'error');
            return;
        }
        
        if (amount > MAX_AMOUNT_PER_SLOT) {
            this.showNotification(`❌ Maximum ${MAX_AMOUNT_PER_SLOT} gems per slot!`, 'error');
            return;
        }
        
        await this.startPolishing(amount, slotNum);
    }

    async startPolishing(amount, slotNum) {
        if (!this.currentActor) {
            this.showNotification('Please connect your wallet first', 'error');
            return;
        }
        
        const stakedTable = this.stakedTables[slotNum];
        if (!stakedTable) {
            this.showNotification('❌ Please stake a Polishing Table first!', 'error');
            return;
        }
        
        try {
            console.log('[Polishing] Starting polishing, amount:', amount);
            this.showNotification(`✨ Starting polishing ${amount.toLocaleString()} rough gems...`, 'info');
            
            const response = await fetch(`${this.backendService.apiBase}/startPolishing`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    actor: this.currentActor,
                    amount: amount,
                    slotNum: slotNum
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to start polishing');
            }
            
            const data = await response.json();
            console.log('[Polishing] Polishing started:', data);
            
            const finishAt = data.finishAt || (Date.now() + POLISHING_DURATION_MS);
            const remainingTime = Math.max(0, finishAt - Date.now());
            const minutes = Math.floor(remainingTime / (1000 * 60));
            
            this.showNotification(`✅ Polishing ${amount.toLocaleString()} gems! Complete in ${minutes}m`, 'success');
            
            // Close modal
            this.closeStakeModal();
            
            // Wait for realtime updates to refresh slots and inventory
            this.showNotification('Realtime update pending...', 'info');
            this.renderPolishingSlots();
            this.updatePolishingStats();
            
            // Start timer updates if not already running
            if (!this.timerInterval) {
                this.startTimerUpdates();
            }} catch (error) {
            console.error('[Polishing] Failed to start polishing:', error);
            this.showNotification('❌ Failed to start polishing: ' + error.message, 'error');
        }
    }

    async completePolishing(jobId) {
        if (!this.currentActor) {
            this.showNotification('Please connect your wallet first', 'error');
            return;
        }

        // Prevent multiple clicks by disabling the button
        const claimButton = document.querySelector(`button[onclick*="completePolishing('${jobId}')"]`);
        if (claimButton) {
            claimButton.disabled = true;
            claimButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Claiming...';
            claimButton.style.opacity = '0.7';
        }

        try {
            console.log('[Polishing] Completing polishing job:', jobId);
            
            // Optimistic UI: remove job locally so the slot returns to normal instantly
            this.activeJobs = this.activeJobs.filter(j => j.jobId !== jobId);
            this.pendingCompletionJobs.add(jobId);
            this.renderPolishingSlots();

            const response = await fetch(`${this.backendService.apiBase}/completePolishing`, {
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
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to complete polishing');
            }
            
            const data = await response.json();
            console.log('[Polishing] Polishing completed:', data);
            
            const result = data.result;
            const totalOut = result.totalOut || 0;
            const results = result.results || {};
            
            // Show reward popup with actual results
            this.showRewardPopup(totalOut, 'Polished Gems', results);
            
            this.showNotification('Realtime update pending...', 'info');
            this.renderPolishingSlots();
            this.updatePolishingStats();
        } catch (error) {
            console.error('[Polishing] Failed to complete polishing:', error);
            this.showNotification('❌ Failed to claim rewards: ' + error.message, 'error');
            this.pendingCompletionJobs.delete(jobId);
        } finally {
            // Re-enable the button
            if (claimButton) {
                claimButton.disabled = false;
                claimButton.innerHTML = '<i class="fas fa-gift"></i> CLAIM REWARDS';
                claimButton.style.opacity = '1';
            }
        }
    }

    updateGemCountsFromRealtime(gemsData) {
        // Update rough gems count from realtime data
        const roughGemsCount = gemsData.rough_gems || 0;
        this.roughGemsCount = roughGemsCount;

        console.log('[Polishing] ✅ Updated rough gems count from realtime:', this.roughGemsCount);

        // Update the UI counters
        this.updatePolishingStats();

        // Refresh slot displays if needed
        this.renderPolishingSlots();
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
                                <span class="value">Unlock Polishing Slot ${slotNum}</span>
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
                
                this.showNotification(`✅ Polishing slot ${slotNum} unlocked successfully! Realtime update pending...`, 'success');
                
                // UI will update automatically via realtime:polishing-slots event
                
                // Close modal after delay
                setTimeout(() => {
                    this.closePaymentModal();
                }, 3000);
                
            } else {
                throw new Error('Payment verification failed');
            }
            
        } catch (error) {
            console.error('[Polishing] Payment execution failed:', error);
            
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
            console.error('[Polishing] Failed to cancel payment:', error);
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

    closeStakeModal() {
        const modalOverlay = document.getElementById('modal-overlay');
        closeModalElement(modalOverlay);
        this.selectedSlotForStaking = null;
    }

    showStakingLoadingState(isLoading, message = '') {
        let loader = document.getElementById('staking-loading-overlay');
        
        // Add fadeOut animation styles if not already present
        if (!document.querySelector('#staking-loading-styles')) {
            const style = document.createElement('style');
            style.id = 'staking-loading-styles';
            style.textContent = `
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        if (isLoading) {
            if (!loader) {
                loader = document.createElement('div');
                loader.id = 'staking-loading-overlay';
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
                    z-index: 10001;
                    animation: fadeIn 0.3s ease;
                    overflow: hidden;
                `;
                
                document.body.appendChild(loader);
            }
            
            loader.innerHTML = `
                <div style="text-align: center; padding: 20px; max-width: 90%;">
                    <div style="font-size: 5rem; color: #ff9500; margin-bottom: 30px; animation: pulse 2s ease-in-out infinite;">
                        <i class="fas fa-table"></i>
                    </div>
                    <h2 style="color: #ff9500; margin-bottom: 20px; font-size: 2em; font-weight: bold;">Staking Polishing Table</h2>
                    <div style="color: #888; font-size: 1.2em; margin-bottom: 40px;">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span style="margin-left: 10px;">${message || 'Validating ownership and staking table...'}</span>
                    </div>
                    <div style="color: #555; font-size: 1em;">
                        Please wait while we verify your NFT ownership
                    </div>
                </div>
            `;
            
            loader.style.display = 'flex';
        } else {
            if (loader) {
                loader.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => {
                    loader.style.display = 'none';
                }, 300);
            }
        }
    }

    async stakeTable(templateId, slotNum, name, imagePath, assetId) {
        console.log('[Polishing] Staking table:', name, 'to slot:', slotNum, 'asset_id:', assetId);
        
        // Show loading screen
        this.showStakingLoadingState(true, 'Validating NFT ownership...');
        
        try {
            const result = await this.backendService.stakeAsset(
                this.currentActor,
                'polishing',
                slotNum,
                'table',
                {
                    asset_id: assetId,
                    template_id: templateId,
                    name: name,
                    imagePath: imagePath
                }
            );
            
            // Hide loading screen
            this.showStakingLoadingState(false);
            
            if (result.success) {
                // Optimistically update local state while waiting for realtime
                this.stakedTables[slotNum] = {
                    template_id: templateId,
                    name,
                    imagePath,
                    asset_id: assetId
                };

                this.showNotification(`✅ Staked ${name} to Slot ${slotNum}!`, 'success');
                this.showNotification('Realtime update pending...', 'info');
                this.closeStakeModal();
                this.renderPolishingSlots();
                this.updatePolishingStats();
            } else {
                throw new Error(result.error || 'Failed to stake table');
            }
        } catch (error) {
            // Hide loading screen on error
            this.showStakingLoadingState(false);
            
            console.error('[Polishing] Failed to stake table:', error);
            this.showNotification(`❌ Failed to stake table: ${error.message}`, 'error');
        }
    }

    async unstakeTable(slotNum) {
        console.log('[Polishing] Unstaking table from slot:', slotNum);

        const stakedTable = this.stakedTables[slotNum];
        if (!stakedTable) {
            this.showNotification('❌ No table staked in this slot!', 'error');
            return;
        }

        // Show confirmation modal
        this.showUnstakeConfirmationModal(slotNum, stakedTable.name);
    }

    showUnstakeConfirmationModal(slotNum, tableName) {
        const modalContent = `
            <div style="text-align: center; padding: 30px 20px;">
                <div style="font-size: 4rem; color: #ff9500; margin-bottom: 20px;">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h3 style="color: #ff9500; margin-bottom: 20px; font-size: 1.5em; font-weight: bold;">
                    Confirm Unstaking
                </h3>
                <p style="color: #888; margin-bottom: 25px; font-size: 1.1em; line-height: 1.6;">
                    Are you sure you want to unstake <strong>${tableName}</strong> from Slot ${slotNum}?
                </p>
                <p style="color: #aaa; margin-bottom: 30px; font-size: 0.95em; line-height: 1.6;">
                    This will remove the polishing table from this slot and make it available in your inventory again.
                </p>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button onclick="game.confirmUnstakeTable(${slotNum})" class="action-btn warning" style="padding: 12px 30px; font-size: 1em;">
                        <i class="fas fa-times"></i> Unstake Table
                    </button>
                    <button onclick="game.closeStakeModal()" class="action-btn secondary" style="padding: 12px 30px; font-size: 1em;">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </div>
        `;

        const modalOverlay = document.getElementById('modal-overlay');
        const modalBody = document.getElementById('modal-body');

        if (modalBody) {
            modalBody.innerHTML = modalContent;

            const modalContainer = modalBody.parentElement;
            const modalHeader = modalContainer.querySelector('.modal-header');

            if (modalHeader) {
                modalHeader.innerHTML = `
                    <h3><i class="fas fa-times"></i> Unstake Polishing Table</h3>
                    <button class="modal-close" onclick="game.closeStakeModal()" style="background: none; border: none; color: #a0a0a0; font-size: 1.5rem; cursor: pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                `;
            }
        }

        if (modalOverlay) {
            openModal(modalOverlay);
        }
    }

    async confirmUnstakeTable(slotNum) {
        console.log('[Polishing] Confirming unstake of table from slot:', slotNum);

        const stakedTable = this.stakedTables[slotNum];
        if (!stakedTable) {
            this.showNotification('❌ No table staked in this slot!', 'error');
            return;
        }
        
        try {
            const result = await this.backendService.unstakeAsset(
                this.currentActor,
                'polishing',
                slotNum,
                'table',
                stakedTable.asset_id
            );

            if (result.success) {
                delete this.stakedTables[slotNum];
                this.showNotification(`✅ Unstaked ${stakedTable.name} from Slot ${slotNum}!`, 'success');
                this.showNotification('Realtime update pending...', 'info');
                this.closeStakeModal(); // Close the confirmation modal
                this.renderPolishingSlots();
                this.updatePolishingStats();
            } else {
                throw new Error(result.error || 'Failed to unstake table');
            }
        } catch (error) {
            console.error('[Polishing] Failed to unstake table:', error);
            this.showNotification(`❌ Failed to unstake table: ${error.message}`, 'error');
        }
    }

    formatTime(ms) {
        if (ms <= 0) return '00:00:00';
        
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((ms % (1000 * 60)) / 1000);
        
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    startTimerUpdates() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        // Track completed jobs to avoid repeated full re-renders while finished
        if (!this.completedJobsRendered) this.completedJobsRendered = new Set();
        this.timerInterval = setInterval(() => {
            const timers = document.querySelectorAll('.timer');
            let shouldRerender = false;
            
            timers.forEach(timer => {
                const finishAt = parseInt(timer.dataset.finish);
                const jobId = timer.dataset.jobId;
                const now = Date.now();
                const remaining = Math.max(0, finishAt - now);
                
                timer.textContent = this.formatTime(remaining);
                
                if (remaining === 0 && jobId && !this.completedJobsRendered.has(jobId)) {
                    this.completedJobsRendered.add(jobId);
                    shouldRerender = true;
                }
            });
            
            if (shouldRerender) {
                this.renderPolishingSlots();
            }
        }, 1000);
    }

    async startAutoRefresh() {
        if (!this.currentActor) return;

        if (window.TSDRealtime) {
            try {
                console.log('[Polishing] 🎯 Ensuring TSDRealtime is running for polishing data...');
                window.TSDRealtime.start(this.currentActor);
            } catch (error) {
                console.warn('[Polishing] TSDRealtime start failed:', error);
            }
        }
    }

    showLoadingState(isLoading) {
        let loader = document.getElementById('polishing-loading-overlay');
        
        if (isLoading) {
            if (!loader) {
                loader = document.createElement('div');
                loader.id = 'polishing-loading-overlay';
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
                    z-index: 10000;
                    animation: fadeIn 0.3s ease;
                    overflow: hidden;
                `;
                
                loader.innerHTML = `
                    <div style="text-align: center; padding: 20px; max-width: 90%;">
                        <div style="font-size: 5rem; color: #ff9500; margin-bottom: 30px; animation: pulse 2s ease-in-out infinite;">
                            ✨
                        </div>
                        <h2 style="color: #ff9500; margin-bottom: 20px; font-size: 2em; font-weight: bold;">Loading Polishing Data</h2>
                        <div style="color: #888; font-size: 1.2em; margin-bottom: 40px;">
                            <i class="fas fa-spinner fa-spin"></i>
                            <span style="margin-left: 10px;">Preparing your polishing station...</span>
                        </div>
                        <div style="color: #555; font-size: 1em;">
                            Please wait while we synchronize your data
                        </div>
                    </div>
                `;
                
                // Add animation styles
                if (!document.querySelector('#polishing-loading-styles')) {
                    const style = document.createElement('style');
                    style.id = 'polishing-loading-styles';
                    style.textContent = `
                        @keyframes pulse {
                            0%, 100% { transform: scale(1); opacity: 1; }
                            50% { transform: scale(1.1); opacity: 0.8; }
                        }
                        @keyframes fadeIn {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                    `;
                    document.head.appendChild(style);
                }
                
                document.body.appendChild(loader);
            }
            loader.style.display = 'flex';
        } else {
            if (loader) {
                loader.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => {
                    loader.style.display = 'none';
                }, 300);
            }
        }
    }

    async disconnectWallet() {
        console.log('[Polishing] Disconnecting wallet...');
        
        try {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
            
            this.currentActor = null;
            this.isLoggedIn = false;
            this.activeJobs = [];
            this.effectiveSlots = 0;
            this.roughGemsCount = 0;
            this.polishedGems = {};
            
            this.resetPolishingUI();
            
            this.showNotification('👋 Wallet disconnected', 'success');
            
        } catch (error) {
            console.error('[Polishing] Disconnect failed:', error);
            this.showNotification('Failed to disconnect: ' + error.message, 'error');
        }
    }

    resetPolishingUI() {
        const headerGameDollars = document.getElementById('header-game-dollars');
        if (headerGameDollars) {
            headerGameDollars.textContent = 'Game $: 0';
        }

        const roughEl = document.getElementById('rough-gems-polishing-count');
        const polishedEl = document.getElementById('polished-gems-polishing-count');
        const tablesEl = document.getElementById('polishing-tables-count');
        
        if (roughEl) roughEl.textContent = '0';
        if (polishedEl) polishedEl.textContent = '0';
        if (tablesEl) tablesEl.textContent = '0';
        
        const slotsGrid = document.getElementById('polishing-slots-grid');
        if (slotsGrid) {
            slotsGrid.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">Connect your wallet to view polishing slots</p>';
        }
        
        const connectBtn = document.getElementById('connectWalletBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        
        if (connectBtn) {
            connectBtn.classList.remove('hidden');
            connectBtn.disabled = false;
            connectBtn.innerHTML = 'Connect Wallet';
        }
        if (logoutBtn) logoutBtn.classList.add('hidden');}

    showRewardPopup(amount, gemType, results = null) {
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
            animation: fadeIn 0.3s ease-out;
        `;
        
        // Create sparkle particles container
        const sparkleContainer = document.createElement('div');
        sparkleContainer.style.cssText = 'position: absolute; width: 100%; height: 100%; pointer-events: none; overflow: hidden;';
        
        // Generate sparkle particles (orange theme)
        for (let i = 0; i < 30; i++) {
            const sparkle = document.createElement('div');
            sparkle.style.cssText = `
                position: absolute;
                width: ${Math.random() * 4 + 2}px;
                height: ${Math.random() * 4 + 2}px;
                background: radial-gradient(circle, #ff9500, transparent);
                border-radius: 50%;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                opacity: 0;
                animation: sparkleParticle ${Math.random() * 2 + 1}s infinite;
                animation-delay: ${Math.random() * 1}s;
                box-shadow: 0 0 10px rgba(255, 149, 0, 0.8);
            `;
            sparkleContainer.appendChild(sparkle);
        }
        
        overlay.appendChild(sparkleContainer);
        
        // Gem color mapping (same as polishing table)
        const gemColors = {
            'polished_diamond': '#b9f2ff',
            'polished_ruby': '#ff6b9d',
            'polished_sapphire': '#4169e1',
            'polished_emerald': '#50c878',
            'polished_jade': '#00a86b',
            'polished_tanzanite': '#5d3fd3',
            'polished_opal': '#a8c3bc',
            'polished_aquamarine': '#7fffd4',
            'polished_topaz': '#ffc87c',
            'polished_amethyst': '#9966cc'
        };
        
        // Create beautiful breakdown from results if available
        let breakdownHtml = '';
        if (results && typeof results === 'object' && Object.keys(results).length > 0) {
            const gemTypes = Object.entries(results)
                .filter(([_, count]) => count > 0)
                .map(([gemType, count]) => ({
                    type: gemType,
                    count: count,
                    name: gemType.replace('polished_', '').replace(/_/g, ' ')
                        .split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' '),
                    color: gemColors[gemType] || '#ff9500'
                }))
                .sort((a, b) => b.count - a.count); // Sort by count descending
            
            if (gemTypes.length > 0) {
                breakdownHtml = `
                    <div style="margin-top: 20px; padding: 20px; background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 10px; max-height: 250px; overflow-y: auto;">
                        <div style="color: #00d4ff; font-weight: 600; margin-bottom: 15px; font-size: 1.1em;">
                            <i class="fas fa-gem"></i> Polished Gems:
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${gemTypes.map(gem => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: ${gem.color}15; border-radius: 8px; border-left: 3px solid ${gem.color};">
                                    <span style="color: ${gem.color}; font-weight: 500;"><i class="fas fa-gem"></i> ${gem.name}</span>
                                    <span style="color: ${gem.color}; font-weight: bold; font-size: 1.1em;">${gem.count}x</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }
        
        // Create popup content
        const popup = document.createElement('div');
        popup.style.cssText = `
            background: linear-gradient(135deg, #1a1a2e, #16213e);
            border: 2px solid #ff9500;
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            box-shadow: 0 0 50px rgba(255, 149, 0, 0.5);
            animation: popIn 0.5s ease-out;
            position: relative;
            overflow: hidden;
            z-index: 1;
        `;
        
        popup.innerHTML = `
            <h2 style="color: #ff9500; font-size: 2em; margin: 20px 0; text-shadow: 0 0 20px rgba(255, 149, 0, 0.5);">
                Polished Gems Ready!
            </h2>
            <div style="background: rgba(255, 149, 0, 0.1); border: 2px solid #ff9500; border-radius: 15px; padding: 30px; margin: 20px 0;">
                <div style="font-size: 4em; color: #ff9500; font-weight: bold; margin-bottom: 10px;">
                    ${amount.toLocaleString()}
                </div>
                <div style="font-size: 1.5em; color: #00d4ff; font-weight: 600;">
                    ${gemType}
                </div>
                ${breakdownHtml}
            </div>
            <button onclick="this.closest('[style*=\\'position: fixed\\']').remove()" style="
                background: linear-gradient(135deg, #ff9500, #ff7700);
                border: none;
                padding: 15px 40px;
                border-radius: 8px;
                color: #000;
                font-size: 1.2em;
                font-weight: bold;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(255, 149, 0, 0.3);
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
}

// Initialize polishing when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Polishing] Initializing PolishingGame...');
    game = new PolishingGame();
    window.game = game; // Make game globally accessible for onclick handlers
    window.tsdgemsGame = game;
    console.log('[Polishing] window.game set:', window.game);

    // Setup realtime inventory listeners
    window.addEventListener('inventory:updated', (event) => {
        const { type, data } = event.detail;
        console.log('[Polishing] 🔄 Realtime inventory update received:', type, data);

        if (type === 'gems' && game) {
            game.updateGemCountsFromRealtime(data);
        }
    });
});
