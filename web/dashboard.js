// TSDGEMS - Dashboard Page Script (Backend-Connected)

class DashboardGame extends TSDGEMSGame {
    constructor() {
        super();
        
        console.log('========================================');
        console.log('[GAME] DashboardGame Constructor');
        console.log('========================================');
        
        // Check if backend service exists
        if (!window.backendService) {
            console.error('âŒ Backend Service not found in window object!');
            console.error('Available in window:', Object.keys(window).filter(k => k.includes('backend')));
        } else {
            console.log('[OK] Backend Service found:', window.backendService);
        }
        
        this.backendService = window.backendService;
        this.isLoggedIn = false;
        this.currentActor = null;
        
        console.log('Initializing dashboard...');
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
        
        console.log('[Dashboard] Init complete');
    }

    setupWalletEventListeners() {
        console.log('[Dashboard] Setting up wallet event listeners...');

        // Setup realtime inventory listeners
        this.setupInventoryRealtimeListeners();
        
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
            
            // Clear current actor and login state
            this.currentActor = null;
            this.isLoggedIn = false;
            
            // Stop polling
            if (this.pollingInterval) {
                console.log('[Dashboard] Stopping polling interval');
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
            }
            
            // Reset UI values to disconnected state
            const elements = {
                'tsd-balance': '0.00',
                'active-workers': '0',
                'rough-gems-count': '0',
                'polished-gems-count': '0',
                'mining-slots-count': '0/10',
                'tsdm-balance': '0.00',
                'header-game-dollars': 'Game $: 0'
            };
            
            Object.entries(elements).forEach(([id, value]) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            });
            
            // Hide wallet balance only (address is handled by wallet.js button)
            const walletBalance = document.getElementById('wallet-balance');
            if (walletBalance) {
                walletBalance.textContent = '0.00 TSD';
                walletBalance.classList.add('hidden');
                console.log('[Dashboard] Wallet balance hidden');
            }
            
            // Ensure Connect button is visible (wallet.js should handle this, but double-check)
            const connectBtn = document.getElementById('connectWalletBtn');
            if (connectBtn) {
                connectBtn.classList.remove('hidden');
                console.log('[Dashboard] Connect button visibility ensured');
            }
            
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.classList.add('hidden');
                console.log('[Dashboard] Logout button hidden');
            }
            
            // Clear notifications and show disconnect message
            this.showNotification('Disconnected from wallet', 'info');console.log('[Dashboard] [OK] Dashboard cleaned up after disconnect');
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
            
            this.showNotification('âŒ Failed to connect wallet: ' + error.message, 'error');}
    }

    async loadBackendData(actor) {
        try {
            console.log('[Dashboard] ========================================');
            console.log('[Dashboard] Loading backend data for actor:', actor);
            
            // Show loading state immediately with visual feedback
            this.showLoadingState(true);

            // Initialize player and get all data from backend (FAST mode)
            console.log('[Dashboard] Calling backendService.initializeFast() for instant load...');
            const startTime = performance.now();
            
            // Load dashboard and staking data in parallel
            const [data, stakedData] = await Promise.all([
                this.backendService.initializeFast(actor),
                this.backendService.getStakedAssets(actor).catch(e => {
                    console.warn('[Dashboard] Failed to load staking data:', e);
                    return { stakingData: {} };
                })
            ]);
            
            // Store staked assets for worker count
            this.stakedAssets = stakedData.stakingData || {};
            
            const loadTime = ((performance.now() - startTime) / 1000).toFixed(2);
            
            console.log('[Dashboard] Backend initialize response:', data);
            console.log('[Dashboard] - dashboard:', data.dashboard);
            console.log('[Dashboard] - cityMatrix:', data.cityMatrix);
            console.log('[Dashboard] - basePrice:', data.basePrice);
            
            if (data.dashboard && data.dashboard.player) {
                console.log('[Dashboard] Player data found:', data.dashboard.player);
                console.log('[Dashboard] - Account:', data.dashboard.player.account);
                console.log('[Dashboard] - Ingame $:', data.dashboard.player.ingameCurrency);
                console.log('[Dashboard] - Balances:', data.dashboard.player.balances);
                console.log('[Dashboard] - TSDM:', data.dashboard.player.balances?.TSDM);
            } else {
                console.error('[Dashboard] âŒ No player data in response!');
            }            this.updateDashboardFromBackend(data.dashboard);
            
            // Hide loading state
            this.showLoadingState(false);
            
            this.showNotification(`Loaded in ${loadTime}s!`, 'success');
            console.log(`[Dashboard] [OK] Backend data loaded and UI updated in ${loadTime}s`);
            console.log('[Dashboard] ========================================');
            
            // Start auto-refresh
            this.startAutoRefresh();
            
        } catch (error) {
            console.error('[Dashboard] âŒ Failed to load backend data:', error);
            console.error('[Dashboard] Error details:', error.message);
            console.error('[Dashboard] Stack:', error.stack);
            this.showNotification('Failed to load game data: ' + error.message, 'error');}
    }

    updateDashboardFromBackend(dashboard) {
        if (!dashboard || !dashboard.player) {
            console.error('[Dashboard] âŒ No player data in backend response!');
            console.log('[Dashboard] Received dashboard object:', dashboard);
            this.showNotification('âš ï¸ No player data received from backend', 'warning');
            return;
        }

        const player = dashboard.player;
        console.log('[Dashboard] ========== UPDATING UI ==========');
        console.log('[Dashboard] Player object:', player);

        // Ensure default values for missing fields
        const rawCurrency = Number(player.ingameCurrency ?? player.ingame_currency ?? 0);
        const previousCurrency = Number(this.currentGameDollars ?? 0);
        const sanitizedCurrency = Number.isFinite(rawCurrency) ? rawCurrency : 0;
        const effectiveCurrency = sanitizedCurrency <= 0 && previousCurrency > 0
            ? previousCurrency
            : sanitizedCurrency;
        const balances = player.balances || { WAX: 0, TSDM: 0 };
        const roughGems = player.roughGems || {};
        const polishedGems = player.polishedGems || {};
        
        console.log('[Dashboard] Extracted values:');
        console.log('[Dashboard] - ingameCurrency (raw):', rawCurrency);
        console.log('[Dashboard] - ingameCurrency (effective):', effectiveCurrency);
        console.log('[Dashboard] - balances:', balances);
        console.log('[Dashboard] - TSDM:', balances.TSDM);
        console.log('[Dashboard] - roughGems:', roughGems);
        console.log('[Dashboard] - polishedGems:', polishedGems);

        // Update header game dollars
        this.updateGameDollars(effectiveCurrency, false);
        const displayCurrency = this.currentGameDollars;

        // Update dashboard cards
        const tsdBalance = document.getElementById('tsd-balance');
        if (tsdBalance) {
            tsdBalance.textContent = displayCurrency.toLocaleString(undefined, { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });
        }

        const activeWorkers = document.getElementById('active-workers');
        if (activeWorkers) {
            // Count staked workers from mining slots
            let totalWorkers = 0;
            if (this.stakedAssets && this.stakedAssets.mining) {
                Object.values(this.stakedAssets.mining).forEach(slot => {
                    if (slot.workers && Array.isArray(slot.workers)) {
                        totalWorkers += slot.workers.length;
                    }
                });
            }
            activeWorkers.textContent = totalWorkers;
        }

        const roughGemsCount = document.getElementById('rough-gems-count');
        if (roughGemsCount) {
            const totalRough = Object.values(roughGems).reduce((a, b) => a + b, 0);
            roughGemsCount.textContent = totalRough;
        }

        const polishedGemsCount = document.getElementById('polished-gems-count');
        if (polishedGemsCount) {
            const totalPolished = Object.values(polishedGems).reduce((a, b) => a + b, 0);
            polishedGemsCount.textContent = totalPolished;
        }

        const miningSlotsCount = document.getElementById('mining-slots-count');
        if (miningSlotsCount) {
            const unlocked = player.miningSlotsUnlocked || 0;
            miningSlotsCount.textContent = `${unlocked}/10`;
        }

        const tsdmBalance = document.getElementById('tsdm-balance');
        if (tsdmBalance) {
            const tsdm = balances.TSDM || 0;
            tsdmBalance.textContent = tsdm.toLocaleString(undefined, { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });
        }

        // Update wallet balance only (address is shown in button)
        const walletBalance = document.getElementById('wallet-balance');
        if (walletBalance) {
            const tsdm = balances.TSDM || 0;
            walletBalance.textContent = `${tsdm.toFixed(2)} TSDM`;
            walletBalance.classList.remove('hidden');
        }

        // DON'T update button states here - wallet.js handles that
        // This was causing conflicts with wallet.js

        console.log('[Dashboard] [OK] UI successfully updated!');
        console.log('[Dashboard] Final values displayed:');
        console.log('[Dashboard] - Account:', player.account);
        console.log('[Dashboard] - Ingame $:', displayCurrency);
        console.log('[Dashboard] - TSDM:', balances.TSDM);
        console.log('[Dashboard] - Rough Gems types:', Object.keys(roughGems).length);
        console.log('[Dashboard] - Polished Gems types:', Object.keys(polishedGems).length);
        
        // Console validation only (no notification)
        if (balances.TSDM >= 400000000) {
            console.log('[Dashboard] [SUCCESS] TSDM Balance is correct (>= 400M):', balances.TSDM.toLocaleString());
        } else {
            console.warn('[Dashboard] âš ï¸ TSDM Balance might be incorrect (<400M):', balances.TSDM);
        }
        console.log('[Dashboard] ========================================');
    }

    async disconnectWallet() {
        console.log('[Dashboard] Starting wallet disconnect...');
        
        try {
            // Clean up realtime listeners
            
            // Stop polling
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
                this.refreshInterval = null;
            }
            
            // Reset state
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
        if (logoutBtn) logoutBtn.classList.add('hidden');    }

    setupInventoryRealtimeListeners() {
        console.log('[Dashboard] Setting up realtime inventory listeners...');

        // Listen for inventory updates from dataManager
        window.addEventListener('inventory:updated', (event) => {
            const { type, data } = event.detail;
            console.log('[Dashboard] 🔄 Realtime inventory update received:', type, data);

            if (type === 'gems') {
                // Update gem counts in dashboard
                this.updateGemCountsFromRealtime(data);
            }
        });
    }

    updateGemCountsFromRealtime(gemsData) {
        // Extract rough and polished gems
        const roughGems = {};
        const polishedGems = {};

        Object.entries(gemsData).forEach(([key, value]) => {
            if (key.startsWith('rough_') || key === 'rough_gems') {
                roughGems[key] = value;
            } else if (key.startsWith('polished_')) {
                polishedGems[key] = value;
            }
        });

        // Update dashboard counters
        const roughGemsCount = document.getElementById('rough-gems-count');
        if (roughGemsCount) {
            const totalRough = Object.values(roughGems).reduce((a, b) => a + b, 0);
            roughGemsCount.textContent = totalRough;
        }

        const polishedGemsCount = document.getElementById('polished-gems-count');
        if (polishedGemsCount) {
            const totalPolished = Object.values(polishedGems).reduce((a, b) => a + b, 0);
            polishedGemsCount.textContent = totalPolished;
        }

        console.log('[Dashboard] ✅ Updated gem counts from realtime data');
    }

    async startAutoRefresh() {
        if (!this.currentActor) {
            console.warn('[Dashboard] No actor set, cannot start auto-refresh');
            return;
        }

        // Try to use TSDRealtime if available
        if (window.TSDRealtime) {
            try {
                console.log('[Dashboard] 🎯 Starting TSDRealtime for dashboard data...');
                window.TSDRealtime.start(this.currentActor);
                console.log('[Dashboard] ✅ TSDRealtime active - instant updates enabled!');
                return;
            } catch (error) {
                console.warn('[Dashboard] TSDRealtime failed, falling back to polling:', error);
            }
        } else {
            console.warn('[Dashboard] TSDRealtime not available');
        }

        // Fallback: Polling method
        this.setupPolling();
    }


    setupPolling() {
        console.log('[Dashboard] [POLLING] Setting up polling (30s interval)...');

        // Refresh dashboard every 30 seconds
        this.refreshInterval = setInterval(async () => {
            if (this.isLoggedIn && this.currentActor) {
                try {
                    const dashboard = await this.backendService.refreshDashboard();
                    this.updateDashboardFromBackend(dashboard);
                } catch (error) {
                    console.error('[Dashboard] Auto-refresh failed:', error);
                }
            }
        }, 30000);

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
            }
        });

        // Pause refresh when page is hidden, resume when visible
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (this.refreshInterval) {
                    clearInterval(this.refreshInterval);
                    this.refreshInterval = null;
                    console.log('[Dashboard] Polling paused (page hidden)');
                }
            } else {
                if (!this.refreshInterval && this.isLoggedIn && this.currentActor) {
                    this.setupPolling();
                    console.log('[Dashboard] Polling resumed (page visible)');
                }
            }
        });
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
