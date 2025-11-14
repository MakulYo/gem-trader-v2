// TSDGEMS - Dashboard Page Script (Backend-Connected)

class DashboardGame extends TSDGEMSGame {
    constructor() {
        super();
        
        console.log('========================================');
        console.log('[GAME] DashboardGame Constructor');
        console.log('========================================');
        
        // Check if backend service exists
        if (!window.backendService) {
            console.error('â Backend Service not found in window object!');
            console.error('Available in window:', Object.keys(window).filter(k => k.includes('backend')));
        } else {
            console.log('[OK] Backend Service found:', window.backendService);
        }
        
        this.backendService = window.backendService;
        this.isLoggedIn = false;
        this.currentActor = null;

        this.realtimeHandlersRegistered = false;
        this.awaitingInitialRealtime = false;
        this.initialRealtimePromise = null;
        this.initialRealtimeResolver = null;
        this.initialRealtimeReject = null;
        this.realtimeData = this.getEmptyRealtimeState();
        this.initialRealtimeTimer = null;

        console.log('Initializing dashboard...');
        this.setupRealtimeEventHandlers();
        this.init();
    }

    init() {
        console.log('[Dashboard] Running init()...');
        this.setupWalletIntegration();
        this.setupWalletEventListeners();// Check URL parameters for test mode
        const urlParams = new URLSearchParams(window.location.search);
        const testMode = urlParams.get('test');
        const testActor = urlParams.get('actor') || 'lucas3333555';
        
        if (testMode === 'true') {
            console.log('[Dashboard] [TEST] TEST MODE activated with actor:', testActor);
            this.showNotification(`[TEST] Test Mode: Loading data for ${testActor}`, 'info');
            
            // Auto-connect in test mode
            setTimeout(async () => {
                try {
                    this.currentActor = testActor;
                    this.isLoggedIn = true;
                    await this.loadBackendData(testActor);
                } catch (error) {
                    console.error('[Dashboard] Test mode failed:', error);
                    this.showNotification('Test mode failed: ' + error.message, 'error');
                }
            }, 500);
        } else {
            this.showNotification('Welcome to TSDGEMS! Please connect your wallet to start.', 'info');
        }
        
        console.log('[Dashboard] Init complete, waiting for realtime...');
    }

    setupWalletEventListeners() {
        console.log('[Dashboard] Setting up wallet event listeners...');

        // Listen for new wallet connection
        window.addEventListener('wallet-connected', async (event) => {
            const { actor } = event.detail;
            console.log('[Dashboard] [CONNECT] Wallet connected event received, actor:', actor);
            
            if (!actor) {
                console.error('[Dashboard] No actor in wallet-connected event');
                return;
            }
            
            this.currentActor = actor;
            this.isLoggedIn = true;
            
            // Load backend data
            await this.loadBackendData(actor);
        });
        
        // Listen for restored session (already logged in)
        window.addEventListener('wallet-session-restored', async (event) => {
            const { actor } = event.detail;
            console.log('[Dashboard] [RESTORE] Wallet session restored event received, actor:', actor);
            
            if (!actor) {
                console.error('[Dashboard] No actor in wallet-session-restored event');
                return;
            }
            
            this.currentActor = actor;
            this.isLoggedIn = true;
            
            // Update button state
            const connectBtn = document.getElementById('connectWalletBtn');
            if (connectBtn) {
                // Let wallet.js control the button label; only disable here
                connectBtn.disabled = true;
            }
            
            // Load backend data with notifications
            this.showNotification(`Welcome back, ${actor}!`, 'info');
            setTimeout(() => {
                this.showNotification('Loading profile data...', 'info');
            }, 300);
            
            await this.loadBackendData(actor);
        });
        
        // CRITICAL: Listen for wallet disconnect
        window.addEventListener('wallet-disconnected', () => {
            console.log('[Dashboard] [DISCONNECT] Wallet disconnected event received');

            if (window.TSDRealtime && typeof window.TSDRealtime.stop === 'function') {
                window.TSDRealtime.stop();
            }

            this.cleanupRealtimeSession();

            this.currentActor = null;
            this.isLoggedIn = false;

            this.resetDashboardUI();
            this.showNotification('Disconnected from wallet', 'info');
            console.log('[Dashboard] [OK] Dashboard cleaned up after disconnect');
        });
        
        console.log('[Dashboard] [OK] Wallet event listeners registered');
        
        // Check if wallet already has session info (in case event was missed)
        setTimeout(() => {
            if (window.walletSessionInfo && window.walletSessionInfo.actor && !this.currentActor) {
                const actor = window.walletSessionInfo.actor;
                console.log('[Dashboard] ðŸ” Found existing wallet session via walletSessionInfo:', actor);
                this.currentActor = actor;
                this.isLoggedIn = true;
                
                // Update button state
                const connectBtn = document.getElementById('connectWalletBtn');
                if (connectBtn) {
                    connectBtn.disabled = true;
                }
                
                this.showNotification(`Welcome back, ${actor}!`, 'info');
                setTimeout(() => {
                    this.showNotification('Loading profile data...', 'info');
                }, 300);
                
                this.loadBackendData(actor);
            }
        }, 200);
    }


    setupWalletIntegration() {
        console.log('[Dashboard] Setting up wallet integration...');
        
        // DON'T override wallet.js buttons - just listen for events instead
        // wallet.js handles the connect/disconnect buttons and dispatches events
        
        console.log('[Dashboard] Relying on wallet.js for button handling');
        console.log('[Dashboard] Dashboard will respond to wallet-connected and wallet-disconnected events');
    }

    async connectWallet() {
        const connectBtn = document.getElementById('connectWalletBtn');
        const originalText = connectBtn ? connectBtn.innerHTML : '';
        
        try {
            console.log('[Dashboard] Starting wallet connection...');
            
            // Show loading state on button
            if (connectBtn) {
                connectBtn.disabled = true;
                connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
                connectBtn.style.cursor = 'wait';
            }
            
            this.showNotification('Connecting to wallet...', 'info');
            
            // Wait for wallet.js to be ready
            console.log('[Dashboard] Checking if wallet.js is ready...');
            if (typeof window.walletConnect !== 'function') {
                console.warn('[Dashboard] window.walletConnect not available yet, waiting...');
                
                // Wait up to 5 seconds for wallet.js to load
                let attempts = 0;
                while (typeof window.walletConnect !== 'function' && attempts < 50) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    attempts++;
                }
                
                if (typeof window.walletConnect !== 'function') {
                    throw new Error('Wallet module not loaded. Please refresh the page.');
                }
            }
            
            // Use wallet.js to connect
            console.log('[Dashboard] Calling window.walletConnect()...');
            const actor = await window.walletConnect();
            
            console.log('[Dashboard] window.walletConnect() returned actor:', actor);
            
            if (!actor) {
                throw new Error('No actor returned from wallet');
            }

            this.currentActor = actor;
            this.isLoggedIn = true;

            // Button label is handled by wallet.js; nothing to change here
            
            this.showNotification(`Connected as ${actor}`, 'success');
            
            // Show loading profile data notification
            setTimeout(() => {
                this.showNotification('Loading profile data...', 'info');
            }, 500);
            
            // Initialize backend and load data
            console.log('[Dashboard] Now loading backend data for:', actor);
            await this.loadBackendData(actor);
            
        } catch (error) {
            console.error('[Dashboard] Wallet connection failed:', error);
            
            // Reset button on error
            if (connectBtn) {
                connectBtn.disabled = false;
                connectBtn.innerHTML = originalText;
                connectBtn.style.cursor = 'pointer';
            }
            
            this.showNotification('â Failed to connect wallet: ' + error.message, 'error');}
    }

    async loadBackendData(actor) {
        // DISABLED: Manual data fetching removed - relying solely on realtime events
        // All data loading is now handled via TSDRealtime events (realtime:live, realtime:profile, etc.)
        
        if (!actor) {
            console.warn('[Dashboard] No actor provided, skipping realtime start');
            return;
        }

        if (this.awaitingInitialRealtime && this.currentActor === actor && this.initialRealtimePromise) {
            console.log('[Dashboard] Realtime load already in progress; waiting for first update');
            return this.initialRealtimePromise;
        }

        this.currentActor = actor;
        this.isLoggedIn = true;

        // Realtime: Don't clean up session if we're about to prepare for realtime
        // The cleanup should only happen on wallet disconnect, not on session restore
        // this.cleanupRealtimeSession();
        this.prepareDashboardForRealtime();

        this.realtimeData = this.getEmptyRealtimeState();
        this.awaitingInitialRealtime = true;

        this.resetInitialRealtimePromise();
        this.initialRealtimePromise = new Promise((resolve, reject) => {
            this.initialRealtimeResolver = resolve;
            this.initialRealtimeReject = reject;
        });

        // Realtime: Don't start TSDRealtime here - it's started globally in wallet.js
        // Check if global realtime is already running and has cached data
        if (window.TSDRealtime && window.TSDRealtime._actor === actor) {
            console.log('[Dashboard] TSDRealtime already running globally for actor:', actor);
            // If we have cached data, use it immediately for instant load
            if (window.TSDRealtime._last && window.TSDRealtime._last.live) {
                console.log('[Dashboard] Using cached live data for instant load');
                this.mergeLiveData(window.TSDRealtime._last.live);
                // Render dashboard immediately to trigger initialization
                this.renderRealtimeDashboard();
            }
        } else {
            console.log('[Dashboard] Waiting for global TSDRealtime to start (should be started by wallet.js)');
        }

        return this.initialRealtimePromise;
    }

    updateDashboardFromProfile(profile) {
        if (!profile) {
            console.warn('[Dashboard] No profile data available; keeping loading state active');
            return;
        }

        console.log('[Dashboard] updateDashboardFromProfile called, profile:', profile, 'balances:', profile.balances);

        const rawCurrency = Number(profile.ingameCurrency ?? profile.ingame_currency ?? 0);
        const previousCurrency = Number(this.currentGameDollars ?? 0);
        const sanitizedCurrency = Number.isFinite(rawCurrency) ? rawCurrency : 0;
        const effectiveCurrency = sanitizedCurrency <= 0 && previousCurrency > 0
            ? previousCurrency
            : sanitizedCurrency;
        // Realtime: Get mining slots unlocked from live.profile.miningSlotsUnlocked only
        const balances = profile.balances || {};
        const unlocked = Number(profile.miningSlotsUnlocked ?? profile.mining_slots_unlocked ?? 0);
        
        console.log('[Dashboard] updateDashboardFromProfile: balances object:', balances, 'TSDM:', balances.TSDM ?? balances.tsdm);

        this.updateGameDollars(effectiveCurrency, false);
        const displayCurrency = this.currentGameDollars ?? effectiveCurrency;

        const tsdBalance = document.getElementById('tsd-balance');
        if (tsdBalance) {
            tsdBalance.textContent = displayCurrency.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }

        // Realtime: Display mining slots count from live.profile only
        const miningSlotsCount = document.getElementById('mining-slots-count');
        if (miningSlotsCount) {
            // Realtime: Use unlocked count directly, don't assume 10 total
            miningSlotsCount.textContent = `${unlocked}/10`;
        }

        // Realtime: Get TSDM balance from live.profile.balances only
        const tsdmBalance = document.getElementById('tsdm-balance');
        if (tsdmBalance) {
            const tsdm = Number(balances.TSDM ?? balances.tsdm ?? 0);
            console.log('[Dashboard] updateDashboardFromProfile: Setting tsdm-balance to:', tsdm, 'from balances:', balances);
            tsdmBalance.textContent = tsdm.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            console.log('[DashboardRealtime] Updated TSDM balance from live.profile.balances:', tsdm);
        } else {
            console.warn('[Dashboard] updateDashboardFromProfile: tsdm-balance element not found!');
        }

        const walletBalance = document.getElementById('wallet-balance');
        if (walletBalance) {
            const tsdm = Number(balances.TSDM ?? balances.tsdm ?? 0);
            console.log('[Dashboard] updateDashboardFromProfile: Setting wallet-balance to:', tsdm);
            walletBalance.textContent = `${tsdm.toFixed(2)} TSDM`;
            walletBalance.classList.remove('hidden');
        } else {
            console.warn('[Dashboard] updateDashboardFromProfile: wallet-balance element not found!');
        }
    }

    // Realtime: Get gem counts from live.gems only (consistent with polishing/trading)
    // Structure: live.gems.rough (object) and live.gems.polished (object)
    updateGemCountsFromRealtime(gemsData = {}) {
        const roughGemsCount = document.getElementById('rough-gems-count');
        const polishedGemsCount = document.getElementById('polished-gems-count');

        if (!roughGemsCount && !polishedGemsCount) {
            return;
        }

        // Realtime: Use live.gems as single source of truth
        // Handle both nested (live.gems.rough, live.gems.polished) and flat (rough_gems, polished_*) structures
        let totalRough = 0;
        let totalPolished = 0;

        if (gemsData.rough && typeof gemsData.rough === 'object') {
            // Nested structure: live.gems.rough = { rough_diamond: X, rough_ruby: Y, ... }
            totalRough = Object.values(gemsData.rough).reduce((sum, val) => sum + Number(val || 0), 0);
        } else if (gemsData.rough_gems !== undefined) {
            // Flat structure: live.gems.rough_gems = number
            totalRough = Number(gemsData.rough_gems || 0);
        } else {
            // Fallback: sum all rough_* keys
            Object.entries(gemsData).forEach(([key, value]) => {
                if (key.startsWith('rough_') || key === 'rough') {
                    totalRough += Number(value || 0);
                }
            });
        }

        if (gemsData.polished && typeof gemsData.polished === 'object') {
            // Nested structure: live.gems.polished = { polished_diamond: X, polished_ruby: Y, ... }
            totalPolished = Object.values(gemsData.polished).reduce((sum, val) => sum + Number(val || 0), 0);
        } else {
            // Flat structure: sum all polished_* keys
            Object.entries(gemsData).forEach(([key, value]) => {
                if (key.startsWith('polished_')) {
                    totalPolished += Number(value || 0);
                }
            });
        }

        const gameCurrency = this.realtimeData.profile?.ingameCurrency ?? this.realtimeData.profile?.ingame_currency ?? 0;
        const tsdm = this.realtimeData.profile?.balances?.TSDM ?? this.realtimeData.profile?.balances?.tsdm ?? 0;

        console.log('[DashboardRealtime] Updated from live: rough=' + totalRough + ', polished=' + totalPolished + ', game$=' + gameCurrency + ', TSDM=' + tsdm);

        if (roughGemsCount) {
            roughGemsCount.textContent = Number.isFinite(totalRough) ? totalRough : 0;
        }
        if (polishedGemsCount) {
            polishedGemsCount.textContent = Number.isFinite(totalPolished) ? totalPolished : 0;
        }
    }

    updateActiveWorkersFromSlots(slots) {
        const activeWorkers = document.getElementById('active-workers');
        if (!activeWorkers) {
            return;
        }

        if (!Array.isArray(slots)) {
            activeWorkers.textContent = '0';
            return;
        }

        const totalWorkers = slots.reduce((total, slot) => total + this.calculateWorkersForSlot(slot), 0);
        activeWorkers.textContent = totalWorkers;
    }

    calculateWorkersForSlot(slot) {
        if (!slot || !Array.isArray(slot.staked)) {
            return 0;
        }

        let workers = 0;
        slot.staked.forEach((item) => {
            const type = String(item?.type ?? item?.category ?? '').toLowerCase();
            if (type.includes('worker')) {
                workers += 1;
            }
        });

        if (workers === 0) {
            workers = slot.staked.length;
        }

        return workers;
    }

    getEmptyRealtimeState() {
        return {
            live: null,
            profile: null,
            gems: null,
            inventorySummary: null,
            speedboost: null,
            miningSlots: null,
            polishingSlots: null,
            basePrice: null,
            cityBoosts: null,
        };
    }

    setupRealtimeEventHandlers() {
        if (this.realtimeHandlersRegistered) {
            return;
        }

        this.realtimeHandlersRegistered = true;

        this.onRealtimeLive = (event) => {
            const { actor, live } = event.detail || {};
            if (!this.isEventForCurrentActor(actor)) {
                return;
            }
            this.mergeLiveData(live);
            this.renderRealtimeDashboard();
        };

        this.onRealtimeProfile = (event) => {
            const { actor, profile } = event.detail || {};
            if (!this.isEventForCurrentActor(actor)) {
                return;
            }
            console.log('[Dashboard] realtime:profile event received, profile:', profile, 'hasBalances:', !!profile?.balances, 'TSDM:', profile?.balances?.TSDM ?? profile?.balances?.tsdm);
            this.realtimeData.profile = profile || null;
            this.renderRealtimeDashboard();
        };

        this.onRealtimeGems = (event) => {
            const { actor, gems } = event.detail || {};
            if (!this.isEventForCurrentActor(actor)) {
                return;
            }
            this.realtimeData.gems = gems || {};
            this.renderRealtimeDashboard();
        };

        this.onRealtimeSummary = (event) => {
            const { actor, summary } = event.detail || {};
            if (!this.isEventForCurrentActor(actor)) {
                return;
            }
            this.realtimeData.inventorySummary = summary || null;
            this.renderRealtimeDashboard();
        };

        this.onRealtimeMiningSlots = (event) => {
            const { actor, slots } = event.detail || {};
            if (!this.isEventForCurrentActor(actor)) {
                return;
            }
            this.realtimeData.miningSlots = Array.isArray(slots) ? slots : [];
            this.renderRealtimeDashboard();
        };

        window.addEventListener('realtime:live', this.onRealtimeLive);
        window.addEventListener('realtime:profile', this.onRealtimeProfile);
        window.addEventListener('realtime:inventory-gems', this.onRealtimeGems);
        window.addEventListener('realtime:inventory-summary', this.onRealtimeSummary);
        window.addEventListener('realtime:mining-slots', this.onRealtimeMiningSlots);
    }

    cleanupRealtimeListeners() {
        if (!this.realtimeHandlersRegistered) {
            return;
        }

        console.log('[Dashboard] Cleaning up realtime event listeners');
        
        window.removeEventListener('realtime:live', this.onRealtimeLive);
        window.removeEventListener('realtime:profile', this.onRealtimeProfile);
        window.removeEventListener('realtime:inventory-gems', this.onRealtimeGems);
        window.removeEventListener('realtime:inventory-summary', this.onRealtimeSummary);
        window.removeEventListener('realtime:mining-slots', this.onRealtimeMiningSlots);
        
        this.realtimeHandlersRegistered = false;
    }

    prepareDashboardForRealtime() {
        this.clearInitialRealtimeTimer();

        const placeholders = {
            'tsd-balance': '--',
            'active-workers': '--',
            'rough-gems-count': '--',
            'polished-gems-count': '--',
            'mining-slots-count': '--',
            'tsdm-balance': '--'
        };

        Object.entries(placeholders).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });

        const walletBalance = document.getElementById('wallet-balance');
        if (walletBalance && this.isLoggedIn) {
            walletBalance.textContent = '-- TSDM';
            walletBalance.classList.remove('hidden');
        }

        this.showLoadingState(true);

        // Realtime: Timeout fallback - initialize with empty state after 5 seconds
        this.initialRealtimeTimer = setTimeout(() => {
            if (this.awaitingInitialRealtime) {
                console.warn('[DashboardInit] Timeout - starting with empty state (no realtime data received)');
                // Initialize with empty state for new accounts
                this.realtimeData.profile = { miningSlotsUnlocked: 0, balances: { TSDM: 0 } };
                this.realtimeData.gems = {};
                // Guard: ensure method exists before calling
                if (typeof this.markRealtimeInitialized === 'function') {
                    this.markRealtimeInitialized();
                } else {
                    console.error('[DashboardInit] markRealtimeInitialized is not a function!', typeof this.markRealtimeInitialized);
                    // Fallback: manually clear loading state
                    this.awaitingInitialRealtime = false;
                    this.clearInitialRealtimeTimer();
                    this.showLoadingState(false);
                    if (this.initialRealtimeResolver) {
                        this.initialRealtimeResolver();
                    }
                }
                this.showNotification('Dashboard initialized. Waiting for data...', 'info');
            }
        }, 5000);
    }

    clearInitialRealtimeTimer() {
        if (this.initialRealtimeTimer) {
            clearTimeout(this.initialRealtimeTimer);
            this.initialRealtimeTimer = null;
        }
    }

    handleRealtimeStartFailure(error) {
        console.error('[Dashboard] Failed to start realtime:', error);
        this.clearInitialRealtimeTimer();
        this.awaitingInitialRealtime = false;
        this.showLoadingState(false);
        this.rejectInitialRealtime(error);
        this.showNotification('Failed to start realtime: ' + error.message, 'error');
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

    resetInitialRealtimePromise() {
        this.initialRealtimePromise = null;
        this.initialRealtimeResolver = null;
        this.initialRealtimeReject = null;
    }

    mergeLiveData(live) {
        if (!live || typeof live !== 'object') {
            console.log('[Dashboard] mergeLiveData: live data is empty or invalid');
            return;
        }

        console.log('[Dashboard] mergeLiveData: merging live data, hasProfile:', !!live.profile, 'hasGems:', !!live.gems);
        if (live.profile) {
            console.log('[Dashboard] mergeLiveData: profile.balances:', live.profile.balances, 'TSDM:', live.profile.balances?.TSDM ?? live.profile.balances?.tsdm);
        }
        this.realtimeData.live = live;

        if (live.profile !== undefined) {
            this.realtimeData.profile = live.profile;
            console.log('[Dashboard] mergeLiveData: Set realtimeData.profile, balances:', this.realtimeData.profile?.balances);
        }
        if (live.gems !== undefined) {
            this.realtimeData.gems = live.gems;
        }
        if (live.inventorySummary !== undefined) {
            this.realtimeData.inventorySummary = live.inventorySummary;
        }
        if (live.speedboost !== undefined) {
            this.realtimeData.speedboost = live.speedboost;
        }
        if (live.miningSlots !== undefined) {
            this.realtimeData.miningSlots = Array.isArray(live.miningSlots) ? live.miningSlots : [];
        }
        if (live.polishingSlots !== undefined) {
            this.realtimeData.polishingSlots = Array.isArray(live.polishingSlots) ? live.polishingSlots : [];
        }
        if (live.pricing !== undefined) {
            this.realtimeData.basePrice = live.pricing;
        }
        if (live.boosts !== undefined) {
            this.realtimeData.cityBoosts = live.boosts;
        }
    }

    renderRealtimeDashboard() {
        const { profile, gems, inventorySummary, miningSlots } = this.realtimeData;

        console.log('[Dashboard] renderRealtimeDashboard: awaitingInitialRealtime:', this.awaitingInitialRealtime, 
                    'hasProfile:', !!profile, 'hasGems:', !!gems, 'hasSummary:', !!inventorySummary, 'hasMiningSlots:', !!miningSlots);

        if (this.awaitingInitialRealtime && (profile || gems || inventorySummary || miningSlots)) {
            console.log('[Dashboard] renderRealtimeDashboard: Resolving initial realtime promise');
            this.awaitingInitialRealtime = false;
            this.clearInitialRealtimeTimer();
            this.showLoadingState(false);
            this.resolveInitialRealtime();
        }

        if (profile) {
            this.updateDashboardFromProfile(profile);
        }

        if (profile || gems || inventorySummary) {
            // Realtime: Update gem counts from live.gems only
            this.updateGemCountsFromRealtime(gems);
        }

        if (miningSlots) {
            this.updateActiveWorkersFromSlots(miningSlots);
        }
    }

    isEventForCurrentActor(actor) {
        return Boolean(this.currentActor) && actor === this.currentActor;
    }

    cleanupRealtimeSession() {
        this.cleanupRealtimeListeners();
        this.clearInitialRealtimeTimer();
        this.awaitingInitialRealtime = false;
        this.realtimeData = this.getEmptyRealtimeState();
        this.resetInitialRealtimePromise();
    }

    async disconnectWallet() {
        console.log('[Dashboard] Starting wallet disconnect...');
        
        try {
            // Realtime: Cleanup listeners but don't stop global realtime stream
            // Global realtime is managed by wallet.js, not individual pages
            this.cleanupRealtimeListeners();

            this.cleanupRealtimeSession();

            this.currentActor = null;
            this.isLoggedIn = false;
            
            // Reset UI to default values
            this.resetDashboardUI();
            
            // Show success notification
            this.showNotification('Wallet disconnected', 'success');
            console.log('[Dashboard] [OK] Wallet disconnected successfully');
            
        } catch (error) {
            console.error('[Dashboard] Disconnect failed:', error);
            this.showNotification('Failed to disconnect: ' + error.message, 'error');
        }
    }

    resetDashboardUI() {
        console.log('[Dashboard] Resetting UI to default state...');
        
        // Reset header
        const headerGameDollars = document.getElementById('header-game-dollars');
        if (headerGameDollars) {
            headerGameDollars.textContent = 'Game $: 0';
        }
        
        // Reset dashboard cards
        const tsdBalance = document.getElementById('tsd-balance');
        if (tsdBalance) tsdBalance.textContent = '0.00';
        
        const activeWorkers = document.getElementById('active-workers');
        if (activeWorkers) activeWorkers.textContent = '0';
        
        const roughGemsCount = document.getElementById('rough-gems-count');
        if (roughGemsCount) roughGemsCount.textContent = '0';
        
        const polishedGemsCount = document.getElementById('polished-gems-count');
        if (polishedGemsCount) polishedGemsCount.textContent = '0';
        
        const miningSlotsCount = document.getElementById('mining-slots-count');
        if (miningSlotsCount) miningSlotsCount.textContent = '0/10';
        
        const tsdmBalance = document.getElementById('tsdm-balance');
        if (tsdmBalance) tsdmBalance.textContent = '0.00';
        
        // Hide wallet display
        const walletAddress = document.getElementById('wallet-address');
        if (walletAddress) {
            walletAddress.textContent = '';
            walletAddress.classList.add('hidden');
        }
        
        const walletBalance = document.getElementById('wallet-balance');
        if (walletBalance) {
            walletBalance.textContent = '0.00 TSDM';
            walletBalance.classList.add('hidden');
        }
        
        // Update button state
        const connectBtn = document.getElementById('connectWalletBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        if (connectBtn) {
            connectBtn.classList.remove('hidden');
            connectBtn.disabled = false;
            connectBtn.innerHTML = 'Connect Wallet';
            connectBtn.style.cursor = 'pointer';
        }
        if (logoutBtn) {
            logoutBtn.classList.add('hidden');
        }
    }

    showLoadingState(isLoading) {
        const statCards = document.querySelectorAll('.stat-card');
        const statValues = document.querySelectorAll('.stat-value');
        
        statCards.forEach(card => {
            if (isLoading) {
                card.style.opacity = '0.6';
                card.style.filter = 'blur(1px)';
                card.style.transition = 'all 0.3s ease';
            } else {
                card.style.opacity = '1';
                card.style.filter = 'none';
                card.style.transition = 'all 0.5s ease';
            }
        });
        
        statValues.forEach(el => {
            if (isLoading) {
                // Add loading spinner
                if (!el.querySelector('.loading-spinner')) {
                    const spinner = document.createElement('i');
                    spinner.className = 'fas fa-spinner fa-spin loading-spinner';
                    spinner.style.marginLeft = '10px';
                    spinner.style.color = '#00d4ff';
                    el.appendChild(spinner);
                }
            } else {
                // Remove loading spinner
                const spinner = el.querySelector('.loading-spinner');
                if (spinner) {
                    spinner.remove();
                }
            }
        });
    }
}

// Initialize dashboard when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new DashboardGame();
    window.tsdgemsGame = game;
});
