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

class MiningGame extends TSDGEMSGame {
    constructor() {
        super();
        
        console.log('[Mining] ========================================');
        console.log('[Mining] 🎮 MiningGame Constructor');
        console.log('[Mining] ========================================');
        
        this.backendService = window.backendService;
        this.isLoggedIn = false;
        this.currentActor = null;
        this.activeJobs = [];
        this.effectiveSlots = 0;
        this.refreshInterval = null;
        this.timerInterval = null;
        this.inventoryData = null;
        this.mineNFTs = [];
        this.workerNFTs = [];
        this.selectedSlotForStaking = null;
        this.stakedMines = {}; // { slotNum: { template_id, name, mp } }
        this.stakedWorkers = {}; // { slotNum: [worker objects] }
        this.selectedWorkers = []; // For multi-selection when staking
        this.selectedWorkersForUnstake = new Set(); // For multi-selection when unstaking
        this.completedJobsRendered = new Set(); // Track jobs that already triggered a completion re-render
        this.pendingCompletionJobs = new Set(); // Jobs we optimistically removed

        // Mobile optimization
        this.isMobile = this.detectMobile();
        if (this.isMobile) {
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    console.log('[Mining] 📱 Mobile page hidden, clearing mining cache');
                    this.clearMiningCache();
                }
            });
        }

        this.init();
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

        // Clear DataManager cache for mining-related data
        if (window.dataManager) {
            window.dataManager.invalidate('inventory');
            window.dataManager.invalidate('stakedAssets');
        }

        console.log('[Mining] 📱 Mining cache cleared');
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
                    await this.loadMiningData(testActor);
                } catch (error) {
                    console.error('[Mining] Test mode failed:', error);
                    this.showNotification('Test mode failed: ' + error.message, 'error');
                }
            }, 500);
        } else {
        this.showNotification('Connect your wallet to access mining operations', 'info');
        }
        
        console.log('[Mining] Init complete');
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
        
        // Refresh button
        const refreshBtn = document.getElementById('refresh-mining-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                const icon = refreshBtn.querySelector('i');
                if (icon) icon.classList.add('fa-spin');
                
                await this.refreshInventory();
                
                if (icon) icon.classList.remove('fa-spin');
            });
        }
    }
    
    async refreshInventory() {
        if (!this.currentActor) {
            this.showNotification('Connect your wallet first!', 'warning');
            return;
        }

        try {
            console.log('[Mining] Refreshing inventory from blockchain...');
            this.showNotification('Fetching fresh data from blockchain...', 'info');
            
            // Force refresh inventory data
            this.inventoryData = await this.backendService.refreshInventory(this.currentActor);
            
            console.log('[Mining] Inventory refreshed:', this.inventoryData);
            
            // Reload mining data with fresh inventory
            this.isInitialized = false;
            await this.loadMiningData(this.currentActor);
            
            this.showNotification('Inventory refreshed from blockchain!', 'success');
        } catch (error) {
            console.error('[Mining] Failed to refresh inventory:', error);
            this.showNotification('Failed to refresh inventory: ' + error.message, 'error');
        }
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
        // Check if already initialized - skip full reload
        if (this.isInitialized && this.lastDataLoad && (Date.now() - this.lastDataLoad) < 300000) {
            console.log('[Mining] Already initialized, skipping full reload');
            // Just refresh active jobs (quick)
            await this.fetchActiveMiningJobs(actor);
            this.renderMiningSlots();
            return;
        }
        
        try {
            console.log('[Mining] ========================================');
            console.log('[Mining] Loading mining data for actor:', actor);
            
            // Show loading state
            this.showLoadingState(true);
            
            this.showNotification('📊 Loading mining data...', 'info');

            // Fetch all data in parallel for better performance
            // Note: initPlayer is async in background for new players
            const results = await Promise.all([
                this.backendService.getDashboard(actor),
                this.fetchActiveMiningJobs(actor).catch(() => ({ jobs: [] })),
                this.fetchInventoryData(actor).catch(() => null),
                this.backendService.getStakedAssets(actor).catch(() => ({ stakingData: {} }))
            ]);
            
            const [dashboard, activeJobs, inventoryData, stakedAssets] = results;

            if (dashboard && dashboard.player) {
                console.log('[Mining] Player data loaded:', dashboard.player);
                
                // Get effective mining slots from player profile
                this.effectiveSlots = Math.min(dashboard.player.miningSlotsUnlocked || 0, MAX_SLOTS);
                console.log('[Mining] Mining slots unlocked:', dashboard.player.miningSlotsUnlocked);
                console.log('[Mining] Effective slots:', this.effectiveSlots);
                
                // Update header
                const headerGameDollars = document.getElementById('header-game-dollars');
                if (headerGameDollars) {
                    const currency = dashboard.player.ingameCurrency || 0;
                    headerGameDollars.textContent = `Game $: ${currency.toLocaleString()}`;
                }
                
                // Update TSDM balance in mining stats
                const tsdmBalance = document.getElementById('tsdm-balance-mining');
                if (tsdmBalance) {
                    const tsdm = dashboard.player.balances?.TSDM || 0;
                    tsdmBalance.textContent = tsdm.toLocaleString(undefined, { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                    });
                }
            }
            
            // Process active mining jobs
            if (activeJobs && activeJobs.jobs) {
                this.activeJobs = activeJobs.jobs;
            }
            
            // Process inventory data
            if (inventoryData) {
                this.inventoryData = inventoryData;
                // Process mine and worker NFTs
                if (inventoryData && inventoryData.equipmentDetails) {
                    const equipmentArray = Object.entries(inventoryData.equipmentDetails).map(([templateId, details]) => {
                        // Create individual NFT objects with template_mint
                        const assets = details.assets || [];
                        return assets.map(assetId => {
                            const assetDetails = inventoryData.assets.find(asset => asset.asset_id === assetId);
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
                    
                    this.mineNFTs = equipmentArray.filter(nft => {
                        const name = (nft.name || '').toLowerCase();
                        return name.includes('mine');
                    });
                    
                    this.workerNFTs = equipmentArray.filter(nft => {
                        const name = (nft.name || '').toLowerCase();
                        return !name.includes('mine') && !name.includes('polishing');
                    });
                }
            }
            
            // Process staked assets
            if (stakedAssets && stakedAssets.stakingData) {
                const stakingData = stakedAssets.stakingData;
                this.stakedMines = {};
                this.stakedWorkers = {};
                
                if (stakingData.mining) {
                    Object.entries(stakingData.mining).forEach(([slotKey, slotData]) => {
                        const slotNum = parseInt(slotKey.replace('slot', ''));
                        
                        if (slotData.mine) {
                            this.stakedMines[slotNum] = {
                                template_id: slotData.mine.template_id,
                                name: slotData.mine.name,
                                mp: slotData.mine.mp,
                                asset_id: slotData.mine.asset_id
                            };
                        }
                        
                        if (slotData.workers && slotData.workers.length > 0) {
                            this.stakedWorkers[slotNum] = slotData.workers.map(worker => ({
                                template_id: worker.template_id,
                                name: worker.name,
                                mp: worker.mp,
                                asset_id: worker.asset_id
                            }));
                        }
                    });
                }
            }
                
                 // Render UI
                 this.renderMiningSlots();
                 this.updateMiningStats();
             
             // Hide loading state
             this.showLoadingState(false);
             
             // Mark as initialized and track load time
            this.isInitialized = true;
            this.lastDataLoad = Date.now();
            
            // Start auto-refresh
                this.startAutoRefresh();
                
            // Start timer updates
            this.startTimerUpdates();
            
            this.showNotification('✅ Mining data loaded!', 'success');
            console.log('[Mining] ✅ Mining data loaded successfully');
            console.log('[Mining] ========================================');
            
        } catch (error) {
            console.error('[Mining] Failed to load mining data:', error);
            
            // Hide loading state on error
            this.showLoadingState(false);
            
            this.showNotification('❌ Failed to load mining data: ' + error.message, 'error');
        }
    }

    async fetchActiveMiningJobs(actor) {
        try {
            console.log('[Mining] Fetching active mining jobs...');
            
            const url = `${this.backendService.apiBase}/getActiveMining?actor=${encodeURIComponent(actor)}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`getActiveMining failed: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('[Mining] Active mining jobs response:', data);
            
            const jobs = data.jobs || [];
            // Filter out jobs that were just claimed optimistically
            this.activeJobs = jobs.filter(j => !this.pendingCompletionJobs.has(j.jobId));
            
            console.log('[Mining] Active jobs:', this.activeJobs.length);
            console.log('[Mining] Effective slots:', this.effectiveSlots);
            
            // Return data for Promise.all usage
            return { jobs };
            
        } catch (error) {
            console.error('[Mining] Failed to fetch active jobs:', error);
            this.activeJobs = [];
            return { jobs: [] };
        }
    }

    async fetchInventoryData(actor) {
        try {
            console.log('[Mining] Fetching inventory data...');
            
            const inventoryData = await this.backendService.getInventory(actor, false);
            console.log('[Mining] Inventory data received:', inventoryData);
            
            // Return data for Promise.all usage
            return inventoryData;
            
        } catch (error) {
            console.error('[Mining] Failed to fetch inventory:', error);
            return null;
        }
    }

    async loadStakedAssets(actor) {
        try {
            console.log('[Mining] Loading staked assets...');
            
            const stakingResponse = await this.backendService.getStakedAssets(actor);
            console.log('[Mining] Staking data received:', stakingResponse);
            
            if (stakingResponse && stakingResponse.stakingData) {
                const stakingData = stakingResponse.stakingData;
                
                // Initialize staking data
                this.stakedMines = {};
                this.stakedWorkers = {};
                
                // Process mining staking data
                if (stakingData.mining) {
                    Object.entries(stakingData.mining).forEach(([slotKey, slotData]) => {
                        const slotNum = parseInt(slotKey.replace('slot', ''));
                        
                        if (slotData.mine) {
                            this.stakedMines[slotNum] = {
                                template_id: slotData.mine.template_id,
                                name: slotData.mine.name,
                                mp: slotData.mine.mp,
                                asset_id: slotData.mine.asset_id
                            };
                        }
                        
                        // Always set workers array, even if empty (ensures UI updates correctly)
                        if (slotData.workers && slotData.workers.length > 0) {
                            this.stakedWorkers[slotNum] = slotData.workers.map(worker => ({
                                template_id: worker.template_id,
                                name: worker.name,
                                mp: worker.mp,
                                asset_id: worker.asset_id
                            }));
                        } else {
                            // Explicitly set to empty array if no workers (or workers property doesn't exist)
                            this.stakedWorkers[slotNum] = [];
                        }
                    });
                }
                
                console.log('[Mining] Loaded staked mines:', this.stakedMines);
                console.log('[Mining] Loaded staked workers:', this.stakedWorkers);
            } else {
                console.log('[Mining] No staking data found, initializing empty');
                this.stakedMines = {};
                this.stakedWorkers = {};
            }
            
        } catch (error) {
            console.error('[Mining] Failed to load staked assets:', error);
            this.stakedMines = {};
            this.stakedWorkers = {};
        }
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
                stakedAssetIds.add(mine.asset_id);
            }
        });
        
        // Add staked workers
        Object.values(this.stakedWorkers).forEach(workers => {
            if (Array.isArray(workers)) {
                workers.forEach(worker => {
                    if (worker.asset_id) {
                        stakedAssetIds.add(worker.asset_id);
                    }
                });
            }
        });
        
        console.log('[Mining] Found', stakedAssetIds.size, 'staked asset IDs');
        return stakedAssetIds;
    }

    renderMiningSlots() {
        // Use a more aggressive debouncing to prevent rapid re-renders
        const now = Date.now();
        if (this._lastRenderTime && (now - this._lastRenderTime) < 200) {
            // Skip render if last render was less than 200ms ago
            console.log('[Mining] Skipping rapid render');
            return;
        }
        this._lastRenderTime = now;

        this._doRenderMiningSlots();
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

        console.log('[Mining] Rendering mining slots...');
        console.log('[Mining] - Effective slots:', this.effectiveSlots);
        console.log('[Mining] - Active jobs:', this.activeJobs.length);
        console.log('[Mining] - Preserving open dropdowns:', openDropdowns);
        
        const slots = [];
        
        // Create slot objects for each effective slot
        for (let i = 0; i < MAX_SLOTS; i++) {
            const slotNum = i + 1;
            const isUnlocked = i < this.effectiveSlots;
            const activeJob = this.activeJobs.find(job => job.slotId === `slot_${slotNum}`);
            
            slots.push({
                slotNum,
                isUnlocked,
                activeJob
            });
        }

        slotsGrid.innerHTML = slots.map(slot => {
            if (!slot.isUnlocked) {
                const unlockCost = SLOT_UNLOCK_COSTS[slot.slotNum - 1] || 0;
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
                const remaining = Math.max(0, job.finishAt - now);
                const progress = Math.min(100, ((MINING_DURATION_MS - remaining) / MINING_DURATION_MS) * 100);
                const isComplete = remaining === 0;
                
                const slotMP = job.slotMiningPower || 0;
                const expectedRewards = Math.max(1, Math.floor(slotMP / 20));
                
                return `
                    <div class="mining-slot active ${isComplete ? 'complete' : 'in-progress'}" data-job-id="${job.jobId}" style="border: 2px solid ${isComplete ? '#00ff64' : '#00d4ff'}; box-shadow: 0 0 20px ${isComplete ? 'rgba(0, 255, 100, 0.3)' : 'rgba(0, 212, 255, 0.3)'}; display: flex; flex-direction: column;">
                        <div class="slot-header">
                            <h4>Slot ${slot.slotNum} ${isComplete ? '💎' : '⛏️'}</h4>
                            <span class="slot-status ${isComplete ? 'complete' : 'active'}" style="background: ${isComplete ? '#00ff64' : '#00d4ff'}; color: #000; padding: 4px 12px; border-radius: 12px; font-weight: bold;">
                                ${isComplete ? '✅ Ready to Collect' : '⛏️ Mining in Progress'}
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
                            <p style="color: ${isComplete ? '#00ff64' : '#888'}; font-size: 1.2em; margin-top: 15px;">
                                ${isComplete ? '✅ Mining Complete!' : `${Math.floor(progress)}% Complete`}
                            </p>
                        </div>
                        ${isComplete ? `
                            <button class="action-btn claim-btn mining-claim-btn" onclick="game.completeMining('${job.jobId}')">
                                <i class="fas fa-gift"></i> CLAIM REWARDS
                            </button>
                        ` : ''}
                    </div>
                `;
            }

            // Available slot (unlocked but no job)
            const stakedMine = this.stakedMines[slot.slotNum];
            const stakedWorkers = this.stakedWorkers[slot.slotNum] || [];
            
            // Calculate total MP
            const mineMP = stakedMine ? stakedMine.mp : 0;
            const workersMP = stakedWorkers.reduce((sum, w) => sum + w.mp, 0);
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
            const mineInventoryAsset = stakedMine && this.inventoryData && this.inventoryData.assets ?
                this.inventoryData.assets.find(asset => asset.asset_id === stakedMine.asset_id) : null;
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
                    ${stakedMine || stakedWorkers.length > 0 ? `
                        <div class="slot-workers">
                            <div class="worker-info">
                                <span>Workers: ${stakedWorkers.length}${stakedMine ? `/${this.getWorkerLimit(stakedMine.name)}` : ''}</span>
                                <span class="mining-power">MP: ${totalMP.toLocaleString()}</span>
                            </div>
                            ${stakedWorkers.length > 0 ? `
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
                                        // Calculate selected count for this slot
                                        let selectedCount = 0;
                                        return stakedWorkers.map((w, idx) => {
                                            const isLast = idx === stakedWorkers.length - 1;
                                            const workerKey = `${slot.slotNum}-${idx}`;
                                            const isSelected = this.selectedWorkersForUnstake.has(workerKey);
                                            if (isSelected) selectedCount++;
                                            // Try to get template_mint from inventory data
                                            const inventoryAsset = this.inventoryData && this.inventoryData.assets ?
                                                this.inventoryData.assets.find(asset => asset.asset_id === w.asset_id) : null;
                                            const templateMint = inventoryAsset && inventoryAsset.template_mint !== 'unknown' ?
                                                inventoryAsset.template_mint : null;

                                            return `
                                            <div class="worker-unstake-card" id="worker-unstake-${slot.slotNum}-${idx}"
                                                 style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem; background: ${isSelected ? 'rgba(255, 107, 107, 0.1)' : 'rgba(0, 212, 255, 0.1)'}; border-radius: 6px; margin-bottom: ${isLast ? '0.75rem' : '0.5rem'}; border: 2px solid ${isSelected ? '#ff6b6b' : 'rgba(0, 212, 255, 0.2)'}; cursor: pointer; transition: all 0.3s; position: relative;"
                                                 onclick="game.toggleWorkerForUnstake(${slot.slotNum}, ${idx})">
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
                                ${stakedWorkers.length > 0 ? `
                                    <button onclick="game.toggleWorkersList(${slot.slotNum})" class="action-btn secondary">
                                        <i class="fas fa-users"></i> Manage ${stakedWorkers.length} Worker${stakedWorkers.length > 1 ? 's' : ''}
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
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to start mining');
            }
            
            const data = await response.json();
            console.log('[Mining] Mining started successfully:', data);
            
            // Extract timing information from backend response
            // Backend returns: { ok: true, jobId, finishAt }
            const finishAt = data.finishAt || (Date.now() + MINING_DURATION_MS);
            const remainingTime = Math.max(0, finishAt - Date.now());
            const hours = Math.floor(remainingTime / (1000 * 60 * 60));
            const minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
            
            this.showNotification(`✅ Mining job started! Complete in ${hours}h ${minutes}m`, 'success');
            
            // Refresh mining data to show the active job with timer
            await this.fetchActiveMiningJobs(this.currentActor);
            this.renderMiningSlots();
            this.updateMiningStats();
            
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

            // Find the job to get estimated values
            const job = this.activeJobs.find(j => j.jobId === jobId);
            let estimatedAmount = 0;
            let estimatedMP = 0;

            if (job) {
                // Calculate estimated yield based on mining power and duration
                estimatedMP = job.slotMiningPower || 0;
                const duration = Date.now() - job.startedAt;
                const expectedGems = Math.floor(estimatedMP / 20);
                estimatedAmount = expectedGems;
            }

            // Show reward popup immediately with estimated values
            this.showRewardPopup(estimatedAmount, 'Rough Gems', estimatedMP);

            // Optimistic UI: remove the completed job locally and update UI immediately
            this.activeJobs = this.activeJobs.filter(j => j.jobId !== jobId);
            this.pendingCompletionJobs.add(jobId);
            this.renderMiningSlots();
            this.updateMiningStats();
            
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
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to complete mining');
            }
            
            const data = await response.json();
            console.log('[Mining] Mining completed:', data);
            
            const result = data.result;
            const gemKey = result.roughKey || 'rough_gems';
            const amount = result.yieldAmt;
            const slotMP = result.slotMiningPower || 0;
            
            // Delay server sync slightly to avoid state bouncing
            await new Promise(r => setTimeout(r, 1500));
            // Retry a few times until the job disappears server-side
            for (let attempt = 0; attempt < 3; attempt++) {
                await this.fetchActiveMiningJobs(this.currentActor);
                if (!this.activeJobs.find(j => j.jobId === jobId)) break;
                await new Promise(r => setTimeout(r, 1500));
            }
            
            // Reload dashboard to update balances
            const dashboard = await this.backendService.getDashboard(this.currentActor);
            if (dashboard && dashboard.player) {
                // Update header with new currency
                const headerGameDollars = document.getElementById('header-game-dollars');
                if (headerGameDollars) {
                    const currency = dashboard.player.ingameCurrency || 0;
                    headerGameDollars.textContent = `Game $: ${currency.toLocaleString()}`;
                }
            }
            
            // Re-render slots (the completed job will be removed, slot returns to available state)
            this.renderMiningSlots();
            this.updateMiningStats();
            
        } catch (error) {
            console.error('[Mining] Failed to complete mining:', error);
            this.showNotification('❌ Failed to claim rewards: ' + error.message, 'error');
        } finally {
            // Re-enable the button
            if (claimButton) {
                claimButton.disabled = false;
                claimButton.innerHTML = '<i class="fas fa-gift"></i> CLAIM REWARDS';
                claimButton.style.opacity = '1';
            }
            // Remove from pending set after sync attempts
            this.pendingCompletionJobs.delete(jobId);
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
                
                // Force reload mining data after payment (bypass cache)
                this.isInitialized = false;
                await this.loadMiningData(this.currentActor);
                
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
                // Reload staked assets from backend to ensure UI is in sync
                await this.loadStakedAssets(this.currentActor);
                
                this.showNotification(`✅ Staked ${name} to Slot ${slotNum}!`, 'success');
                this.closeStakeModal();
                this.renderMiningSlots();
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
            
            // Close modal and update UI
            this.selectedWorkers = [];
            this.closeStakeModal();
            this.renderMiningSlots();
            
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
        this.renderMiningSlots();
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
            
            // Reload from backend to sync state
            await this.loadStakedAssets(this.currentActor);
            
            this.selectedWorkersForUnstake.clear();
            this.renderMiningSlots();
            
            const count = assetIdsToUnstake.length;
            this.showNotification(`✅ Unstaked ${count} worker${count > 1 ? 's' : ''} from Slot ${slotNum}!`, 'success');
            
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
                // Reload staked assets from backend to ensure UI is in sync
                await this.loadStakedAssets(this.currentActor);
                
                this.showNotification(`✅ Unstaked ${worker.name} from Slot ${slotNum}!`, 'success');
                this.renderMiningSlots();
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
                // Reload staked assets from backend to ensure UI is in sync
                await this.loadStakedAssets(this.currentActor);
                
                this.showNotification(`✅ Unstaked ${stakedMine.name} from Slot ${slotNum}!`, 'success');
                this.renderMiningSlots();
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
                const now = Date.now();
                const remaining = Math.max(0, finishAt - now);
                
                timer.textContent = this.formatTime(remaining);
                
                if (remaining === 0 && jobId && !this.completedJobsRendered.has(jobId)) {
                    this.completedJobsRendered.add(jobId);
                    shouldRerender = true; // Trigger a single re-render on first completion
                }
            });
            
            if (shouldRerender) {
                this.renderMiningSlots();
            }
        }, 1000);
    }

    startAutoRefresh() {
        if (!this.currentActor) return;
        
        // Refresh mining data every 30 seconds
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.refreshInterval = setInterval(async () => {
            if (this.isLoggedIn && this.currentActor) {
                try {
                    await this.fetchActiveMiningJobs(this.currentActor);
                    this.renderMiningSlots();
                    this.updateMiningStats();
                } catch (error) {
                    console.error('[Mining] Auto-refresh failed:', error);
                }
            }
        }, 30000);
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
            }
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
            }
        });
    }

    showLoadingState(isLoading, message = 'Loading Mining Data') {
        let loader = document.getElementById('mining-loading-overlay');
        
        if (isLoading) {
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
                    z-index: 10000;
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
            if (loader) {
                loader.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => {
                    loader.style.display = 'none';
                }, 300);
            }
        }
    }

    async disconnectWallet() {
        console.log('[Mining] Disconnecting wallet...');
        
        try {
            // Stop intervals
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
                this.refreshInterval = null;
            }
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
}

// Initialize mining when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new MiningGame();
    window.tsdgemsGame = game;
});
