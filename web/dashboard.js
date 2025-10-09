// TSDGEMS - Dashboard Page Script (Backend-Connected)

class DashboardGame extends TSDGEMSGame {
    constructor() {
        super();
        
        console.log('========================================');
        console.log('🎮 DashboardGame Constructor');
        console.log('========================================');
        
        // Check if backend service exists
        if (!window.backendService) {
            console.error('❌ Backend Service not found in window object!');
            console.error('Available in window:', Object.keys(window).filter(k => k.includes('backend')));
        } else {
            console.log('✅ Backend Service found:', window.backendService);
        }
        
        this.backendService = window.backendService;
        this.isLoggedIn = false;
        this.currentActor = null;
        this.rawBackendData = null;
        this.realtimeUnsubscribers = [];
        
        console.log('Initializing dashboard...');
        this.init();
    }

    init() {
        console.log('[Dashboard] Running init()...');
        this.setupWalletIntegration();
        this.setupWalletEventListeners();
        this.createDebugPanel();
        
        // Check URL parameters for test mode
        const urlParams = new URLSearchParams(window.location.search);
        const testMode = urlParams.get('test');
        const testActor = urlParams.get('actor') || 'lucas3333555';
        
        if (testMode === 'true') {
            console.log('[Dashboard] 🧪 TEST MODE activated with actor:', testActor);
            this.showNotification(`🧪 Test Mode: Loading data for ${testActor}`, 'info');
            
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
        
        // Listen for new wallet connection
        window.addEventListener('wallet-connected', async (event) => {
            const { actor } = event.detail;
            console.log('[Dashboard] 🔗 Wallet connected event received, actor:', actor);
            
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
            console.log('[Dashboard] 🔄 Wallet session restored event received, actor:', actor);
            
            if (!actor) {
                console.error('[Dashboard] No actor in wallet-session-restored event');
                return;
            }
            
            this.currentActor = actor;
            this.isLoggedIn = true;
            
            // Update button state
            const connectBtn = document.getElementById('connectWalletBtn');
            if (connectBtn) {
                connectBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
                connectBtn.disabled = true;
            }
            
            // Load backend data with notifications
            this.showNotification(`🔄 Welcome back, ${actor}!`, 'info');
            setTimeout(() => {
                this.showNotification('📊 Loading profile data...', 'info');
            }, 300);
            
            await this.loadBackendData(actor);
        });
        
        console.log('[Dashboard] ✅ Wallet event listeners registered');
        
        // Check if wallet already has session info (in case event was missed)
        setTimeout(() => {
            if (window.walletSessionInfo && window.walletSessionInfo.actor && !this.currentActor) {
                const actor = window.walletSessionInfo.actor;
                console.log('[Dashboard] 🔍 Found existing wallet session via walletSessionInfo:', actor);
                this.currentActor = actor;
                this.isLoggedIn = true;
                
                // Update button state
                const connectBtn = document.getElementById('connectWalletBtn');
                if (connectBtn) {
                    connectBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
                    connectBtn.disabled = true;
                }
                
                this.showNotification(`🔄 Welcome back, ${actor}!`, 'info');
                setTimeout(() => {
                    this.showNotification('📊 Loading profile data...', 'info');
                }, 300);
                
                this.loadBackendData(actor);
            }
        }, 200);
    }

    createDebugPanel() {
        const main = document.querySelector('.main-content');
        if (!main) return;

        const debugPanel = document.createElement('div');
        debugPanel.id = 'backend-debug-panel';
        debugPanel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 400px;
            max-height: 500px;
            background: rgba(20, 20, 30, 0.95);
            border: 2px solid #00d4ff;
            border-radius: 8px;
            padding: 15px;
            z-index: 9999;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 212, 255, 0.3);
        `;

        debugPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong style="color: #00d4ff;">🔍 Backend Data Debug</strong>
                <button id="toggle-debug" style="background: #00d4ff; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; color: #000;">Collapse</button>
            </div>
            <div id="debug-content" style="max-height: 440px; overflow-y: auto;">
                <div style="color: #888; margin-bottom: 10px;">Waiting for backend data...</div>
            </div>
        `;

        main.appendChild(debugPanel);

        // Toggle functionality
        const toggleBtn = document.getElementById('toggle-debug');
        const content = document.getElementById('debug-content');
        let collapsed = false;

        toggleBtn.addEventListener('click', () => {
            collapsed = !collapsed;
            content.style.display = collapsed ? 'none' : 'block';
            toggleBtn.textContent = collapsed ? 'Expand' : 'Collapse';
        });
    }

    updateDebugPanel(data) {
        this.rawBackendData = data;
        const content = document.getElementById('debug-content');
        if (!content) {
            console.warn('[Dashboard] Debug panel content element not found');
            return;
        }

        const timestamp = new Date().toLocaleTimeString();
        const source = data.source || 'initial-load';
        const endpoint = data.endpoint || 'N/A';
        
        // Find player data in various possible locations
        let player = null;
        if (data.data && data.data.player) {
            player = data.data.player;
        } else if (data.data && data.data.dashboard && data.data.dashboard.player) {
            player = data.data.dashboard.player;
        } else if (data.player) {
            player = data.player;
        } else if (data.dashboard && data.dashboard.player) {
            player = data.dashboard.player;
        }

        console.log('[Dashboard] Debug panel update - player found:', !!player);
        
        // Extract key info for summary
        let summary = '';
        if (player) {
            const roughGemsCount = player.roughGems ? Object.keys(player.roughGems).length : 0;
            const polishedGemsCount = player.polishedGems ? Object.keys(player.polishedGems).length : 0;
            const roughGemsTotal = player.roughGems ? Object.values(player.roughGems).reduce((a, b) => a + b, 0) : 0;
            const polishedGemsTotal = player.polishedGems ? Object.values(player.polishedGems).reduce((a, b) => a + b, 0) : 0;
            
            summary = `
                <div style="margin: 10px 0; padding: 10px; background: rgba(0, 212, 255, 0.1); border-radius: 6px;">
                    <div style="color: #00d4ff; font-weight: bold;">Player Summary:</div>
                    <div style="margin-top: 5px; font-size: 11px; line-height: 1.6;">
                        Account: <span style="color: #00ff64;">${player.account || this.currentActor || 'N/A'}</span><br>
                        Game $: <span style="color: #ffc800;">${(player.ingameCurrency || 0).toLocaleString()}</span><br>
                        TSDM: <span style="color: #ffc800;">${((player.balances?.TSDM) || 0).toFixed(2)}</span><br>
                        Rough Gems: <span style="color: #ff00c8;">${roughGemsCount} types (${roughGemsTotal} total)</span><br>
                        Polished Gems: <span style="color: #00ff64;">${polishedGemsCount} types (${polishedGemsTotal} total)</span><br>
                        Mining Slots: <span style="color: #00d4ff;">${player.miningSlotsUnlocked || 0}/10</span>
                    </div>
                </div>
            `;
        } else {
            summary = `
                <div style="margin: 10px 0; padding: 10px; background: rgba(255, 200, 0, 0.1); border-radius: 6px;">
                    <div style="color: #ffc800; font-weight: bold;">⚠️ No Player Data Found</div>
                    <div style="margin-top: 5px; font-size: 11px;">
                        Connect wallet to load player data
                    </div>
                </div>
            `;
        }
        
        content.innerHTML = `
            <div style="color: #0f0; margin-bottom: 10px;">
                ✅ Last Update: ${timestamp} | 
                Source: <span style="color: #ffc800;">${source}</span> | 
                Endpoint: <span style="color: #00d4ff;">${endpoint}</span>
            </div>
            ${summary}
            <div style="background: rgba(0, 0, 0, 0.5); padding: 10px; border-radius: 4px; overflow-x: auto; max-height: 300px; overflow-y: auto;">
                <div style="color: #00d4ff; font-weight: bold; margin-bottom: 5px;">Full Backend Response:</div>
                <pre style="margin: 0; color: #a0a0a0; white-space: pre-wrap; word-wrap: break-word; font-size: 10px;">${JSON.stringify(data, null, 2)}</pre>
            </div>
        `;
    }

    setupWalletIntegration() {
        console.log('[Dashboard] Setting up wallet integration...');
        
        const connectBtn = document.getElementById('connectWalletBtn');
        if (connectBtn) {
            console.log('[Dashboard] Connect button found, adding listener');
            
            // Remove existing wallet.js listener first
            const newConnectBtn = connectBtn.cloneNode(true);
            connectBtn.parentNode.replaceChild(newConnectBtn, connectBtn);
            
            // Add our own listener that uses backend-service
            newConnectBtn.addEventListener('click', async () => {
                console.log('[Dashboard] Connect button clicked!');
                await this.connectWallet();
            });
        } else {
            console.warn('[Dashboard] Connect button NOT found!');
        }
        
        // Setup disconnect button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            console.log('[Dashboard] Logout button found, adding listener');
            
            // Remove existing listener
            const newLogoutBtn = logoutBtn.cloneNode(true);
            logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
            
            // Add our own listener
            newLogoutBtn.addEventListener('click', async () => {
                console.log('[Dashboard] Logout button clicked!');
                await this.disconnectWallet();
            });
        } else {
            console.warn('[Dashboard] Logout button NOT found!');
        }
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
            
            this.showNotification('🔗 Connecting to wallet...', 'info');
            
            // Use wallet.js to connect
            console.log('[Dashboard] Calling window.walletConnect()...');
            const actor = await window.walletConnect();
            
            console.log('[Dashboard] window.walletConnect() returned actor:', actor);
            
            if (!actor) {
                throw new Error('No actor returned from wallet');
            }

            this.currentActor = actor;
            this.isLoggedIn = true;

            // Update button to success state
            if (connectBtn) {
                connectBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
            }
            
            this.showNotification(`✅ Connected as ${actor}`, 'success');
            
            // Show loading profile data notification
            setTimeout(() => {
                this.showNotification('📊 Loading profile data...', 'info');
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
            
            this.showNotification('❌ Failed to connect wallet: ' + error.message, 'error');
            this.updateDebugPanel({ error: error.message, timestamp: new Date().toISOString() });
        }
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
            const data = await this.backendService.initializeFast(actor);
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
                console.error('[Dashboard] ❌ No player data in response!');
            }
            
            // Update debug panel with raw data
            this.updateDebugPanel({
                endpoint: 'initialize',
                actor: actor,
                data: data,
                timestamp: new Date().toISOString()
            });
            
            // Update dashboard with backend data
            this.updateDashboardFromBackend(data.dashboard);
            
            // Hide loading state
            this.showLoadingState(false);
            
            this.showNotification(`✅ Loaded in ${loadTime}s!`, 'success');
            console.log(`[Dashboard] ✅ Backend data loaded and UI updated in ${loadTime}s`);
            console.log('[Dashboard] ========================================');
            
            // Start auto-refresh
            this.startAutoRefresh();
            
        } catch (error) {
            console.error('[Dashboard] ❌ Failed to load backend data:', error);
            console.error('[Dashboard] Error details:', error.message);
            console.error('[Dashboard] Stack:', error.stack);
            this.showNotification('Failed to load game data: ' + error.message, 'error');
            this.updateDebugPanel({ error: error.message, stack: error.stack, timestamp: new Date().toISOString() });
        }
    }

    updateDashboardFromBackend(dashboard) {
        if (!dashboard || !dashboard.player) {
            console.error('[Dashboard] ❌ No player data in backend response!');
            console.log('[Dashboard] Received dashboard object:', dashboard);
            this.showNotification('⚠️ No player data received from backend', 'warning');
            return;
        }

        const player = dashboard.player;
        console.log('[Dashboard] ========== UPDATING UI ==========');
        console.log('[Dashboard] Player object:', player);

        // Ensure default values for missing fields
        const ingameCurrency = player.ingameCurrency || 0;
        const balances = player.balances || { WAX: 0, TSDM: 0 };
        const roughGems = player.roughGems || {};
        const polishedGems = player.polishedGems || {};
        
        console.log('[Dashboard] Extracted values:');
        console.log('[Dashboard] - ingameCurrency:', ingameCurrency);
        console.log('[Dashboard] - balances:', balances);
        console.log('[Dashboard] - TSDM:', balances.TSDM);
        console.log('[Dashboard] - roughGems:', roughGems);
        console.log('[Dashboard] - polishedGems:', polishedGems);

        // Update header game dollars
        const headerGameDollars = document.getElementById('header-game-dollars');
        if (headerGameDollars) {
            headerGameDollars.textContent = `Game $: ${ingameCurrency.toLocaleString()}`;
        }

        // Update dashboard cards
        const tsdBalance = document.getElementById('tsd-balance');
        if (tsdBalance) {
            tsdBalance.textContent = ingameCurrency.toLocaleString(undefined, { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            });
        }

        const activeWorkers = document.getElementById('active-workers');
        if (activeWorkers) {
            // Count workers from mining slots (if available)
            let totalWorkers = player.miningSlotsUnlocked || 0;
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

        // Update wallet display
        const walletAddress = document.getElementById('wallet-address');
        if (walletAddress) {
            walletAddress.textContent = this.currentActor || player.account || 'Unknown';
            walletAddress.classList.remove('hidden');
        }

        const walletBalance = document.getElementById('wallet-balance');
        if (walletBalance) {
            const tsdm = balances.TSDM || 0;
            walletBalance.textContent = `${tsdm.toFixed(2)} TSDM`;
            walletBalance.classList.remove('hidden');
        }

        // Update button state
        const connectBtn = document.getElementById('connectWalletBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        if (connectBtn) connectBtn.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.remove('hidden');

        console.log('[Dashboard] ✅ UI successfully updated!');
        console.log('[Dashboard] Final values displayed:');
        console.log('[Dashboard] - Account:', player.account);
        console.log('[Dashboard] - Ingame $:', ingameCurrency);
        console.log('[Dashboard] - TSDM:', balances.TSDM);
        console.log('[Dashboard] - Rough Gems types:', Object.keys(roughGems).length);
        console.log('[Dashboard] - Polished Gems types:', Object.keys(polishedGems).length);
        
        // Console validation only (no notification)
        if (balances.TSDM >= 400000000) {
            console.log('[Dashboard] 🎉 TSDM Balance is correct (>= 400M):', balances.TSDM.toLocaleString());
        } else {
            console.warn('[Dashboard] ⚠️ TSDM Balance might be incorrect (<400M):', balances.TSDM);
        }
        console.log('[Dashboard] ========================================');
    }

    async disconnectWallet() {
        console.log('[Dashboard] Starting wallet disconnect...');
        
        try {
            // Clean up realtime listeners
            this.cleanupRealtimeListeners();
            
            // Stop polling
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
                this.refreshInterval = null;
            }
            
            // Reset state
            this.currentActor = null;
            this.isLoggedIn = false;
            this.rawBackendData = null;
            
            // Reset UI to default values
            this.resetDashboardUI();
            
            // Show success notification
            this.showNotification('👋 Wallet disconnected', 'success');
            console.log('[Dashboard] ✅ Wallet disconnected successfully');
            
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
        if (logoutBtn) logoutBtn.classList.add('hidden');
        
        // Reset debug panel
        this.updateDebugPanel({
            status: 'disconnected',
            timestamp: new Date().toISOString()
        });
        
        console.log('[Dashboard] UI reset complete');
    }

    async startAutoRefresh() {
        if (!this.currentActor) {
            console.warn('[Dashboard] No actor set, cannot start auto-refresh');
            return;
        }

        // Try to use Firestore Realtime Listeners if available
        if (window.firebaseRealtimeService) {
            try {
                await window.firebaseRealtimeService.initialize();
                this.setupRealtimeListeners();
                return;
            } catch (error) {
                console.warn('[Dashboard] Realtime listeners failed, falling back to polling:', error);
            }
        }

        // Fallback: Polling method
        this.setupPolling();
    }

    setupRealtimeListeners() {
        console.log('[Dashboard] Setting up Firestore realtime listeners for:', this.currentActor);

        // Clean up old listeners if any
        this.cleanupRealtimeListeners();

        // Listen to Dashboard changes (player + base price)
        const [playerUnsubscribe, basePriceUnsubscribe] = window.firebaseRealtimeService.listenToDashboard(
            this.currentActor,
            (data) => {
                console.log('[Dashboard] 🔥 Dashboard data updated in realtime!', data);
                
                // Firestore listener returns raw player data
                // Wrap it in the expected structure { player: {...} }
                if (data.player) {
                    const normalizedData = {
                        player: data.player,
                        basePrice: data.basePrice
                    };
                    
                    this.updateDashboardFromBackend(normalizedData);
                    
                    // Update debug panel
                    this.updateDebugPanel({
                        source: 'realtime-listener',
                        actor: this.currentActor,
                        data: normalizedData,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        );

        this.realtimeUnsubscribers = [playerUnsubscribe, basePriceUnsubscribe];

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            this.cleanupRealtimeListeners();
        });

        console.log('[Dashboard] ✅ Realtime listeners active - instant updates enabled!');
    }

    setupPolling() {
        console.log('[Dashboard] ⏱️ Setting up polling (30s interval)...');

        // Refresh dashboard every 30 seconds
        this.refreshInterval = setInterval(async () => {
            if (this.isLoggedIn && this.currentActor) {
                try {
                    const dashboard = await this.backendService.refreshDashboard();
                    this.updateDashboardFromBackend(dashboard);
                    
                    // Update debug panel
                    this.updateDebugPanel({
                        source: 'polling',
                        endpoint: 'refreshDashboard',
                        actor: this.currentActor,
                        data: dashboard,
                        timestamp: new Date().toISOString()
                    });
                    
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

    cleanupRealtimeListeners() {
        if (this.realtimeUnsubscribers.length > 0) {
            console.log('[Dashboard] Cleaning up realtime listeners...');
            this.realtimeUnsubscribers.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            });
            this.realtimeUnsubscribers = [];
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
