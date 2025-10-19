// TSDGEMS - Mining Page Script (Backend-Connected)

// Mining Constants (match backend)
const MINING_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours
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
        this.rawBackendData = null;
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
        
        this.init();
    }

    init() {
        console.log('[Mining] Running init()...');
        this.setupWalletIntegration();
        this.setupWalletEventListeners();
        this.createDebugPanel();
        
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
                connectBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
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
                    connectBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
                    connectBtn.disabled = true;
                }
                
                this.showNotification(`🔄 Welcome back, ${actor}!`, 'info');
                this.loadMiningData(actor);
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
                <strong style="color: #00d4ff;">🔍 Mining Backend Debug</strong>
                <button id="toggle-debug" style="background: #00d4ff; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; color: #000;">Collapse</button>
            </div>
            <div id="debug-content" style="max-height: 440px; overflow-y: auto;">
                <div style="color: #888; margin-bottom: 10px;">Waiting for backend data...</div>
            </div>
        `;

        main.appendChild(debugPanel);

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
        if (!content) return;

        const timestamp = new Date().toLocaleTimeString();
        
        let summary = '';
        if (this.activeJobs && this.activeJobs.length > 0) {
            summary = `
                <div style="margin: 10px 0; padding: 10px; background: rgba(0, 212, 255, 0.1); border-radius: 6px;">
                    <div style="color: #00d4ff; font-weight: bold;">Mining Summary:</div>
                    <div style="margin-top: 5px; font-size: 11px; line-height: 1.6;">
                        Active Jobs: <span style="color: #00ff64;">${this.activeJobs.length}</span><br>
                        Available Slots: <span style="color: #ffc800;">${this.effectiveSlots - this.activeJobs.length}/${this.effectiveSlots}</span><br>
                        Total Slots: <span style="color: #00d4ff;">${MAX_SLOTS}</span>
                    </div>
                </div>
            `;
        }
        
        content.innerHTML = `
            <div style="color: #0f0; margin-bottom: 10px;">
                ✅ Last Update: ${timestamp}
            </div>
            ${summary}
            <div style="background: rgba(0, 0, 0, 0.5); padding: 10px; border-radius: 4px; overflow-x: auto; max-height: 300px; overflow-y: auto;">
                <strong style="color: #ff0;">Mining Data:</strong>
                <pre style="margin: 5px 0 0 0; color: #00d4ff; white-space: pre-wrap; word-wrap: break-word; font-size: 10px;">${JSON.stringify(data, null, 2)}</pre>
            </div>
        `;
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

            if (connectBtn) {
                connectBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
            }
            
            this.showNotification(`✅ Connected as ${actor}`, 'success');
            
            await this.loadMiningData(actor);
            
        } catch (error) {
            console.error('[Mining] Wallet connection failed:', error);
            
            if (connectBtn) {
                connectBtn.disabled = false;
                connectBtn.innerHTML = originalText;
            }
            
            this.showNotification('❌ Failed to connect wallet: ' + error.message, 'error');
            this.updateDebugPanel({ error: error.message, timestamp: new Date().toISOString() });
        }
    }

    async loadMiningData(actor) {
        try {
            console.log('[Mining] ========================================');
            console.log('[Mining] Loading mining data for actor:', actor);
            
            this.showNotification('📊 Loading mining data...', 'info');

            // Initialize player first
            await this.backendService.initPlayer(actor);
            
            // Get dashboard to retrieve player info and mining power
            const dashboard = await this.backendService.getDashboard(actor);

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
            
            // Fetch active mining jobs
            await this.fetchActiveMiningJobs(actor);
            
            // Fetch inventory to get Mine NFTs
            await this.fetchInventoryData(actor);
                
                // Update debug panel
                this.updateDebugPanel({
                    actor: actor,
                dashboard: dashboard,
                activeJobs: this.activeJobs,
                effectiveSlots: this.effectiveSlots,
                mineNFTs: this.mineNFTs,
                    timestamp: new Date().toISOString()
                });
                
            // Render UI
                this.renderMiningSlots();
                this.updateMiningStats();
            
            // Start auto-refresh
            this.startAutoRefresh();
            
            // Start timer updates
            this.startTimerUpdates();
            
            this.showNotification('✅ Mining data loaded!', 'success');
            console.log('[Mining] ✅ Mining data loaded successfully');
            console.log('[Mining] ========================================');
            
        } catch (error) {
            console.error('[Mining] Failed to load mining data:', error);
            this.showNotification('❌ Failed to load mining data: ' + error.message, 'error');
            this.updateDebugPanel({ 
                error: error.message, 
                stack: error.stack,
                timestamp: new Date().toISOString() 
            });
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
            
            this.activeJobs = data.jobs || [];
            
            console.log('[Mining] Active jobs:', this.activeJobs.length);
            console.log('[Mining] Effective slots:', this.effectiveSlots);
            
        } catch (error) {
            console.error('[Mining] Failed to fetch active jobs:', error);
            this.activeJobs = [];
        }
    }

    async fetchInventoryData(actor) {
        try {
            console.log('[Mining] Fetching inventory data...');
            
            const inventoryData = await this.backendService.getInventory(actor, false);
            console.log('[Mining] Inventory data received:', inventoryData);
            
            this.inventoryData = inventoryData;
            
            // Filter for Mine NFTs from equipmentDetails
            if (inventoryData && inventoryData.equipmentDetails) {
                console.log('[Mining] equipmentDetails type:', typeof inventoryData.equipmentDetails);
                console.log('[Mining] equipmentDetails:', inventoryData.equipmentDetails);
                
                // Convert object to array with template_id
                const equipmentArray = Object.entries(inventoryData.equipmentDetails).map(([templateId, details]) => ({
                    template_id: templateId,
                    name: details.name,
                    count: details.count,
                    mp: details.mp,
                    image: details.image,
                    imagePath: details.imagePath
                }));
                
                // Filter for Mine NFTs
                this.mineNFTs = equipmentArray.filter(nft => {
                    const name = (nft.name || '').toLowerCase();
                    return name.includes('mine');
                });
                
                // Filter for Worker NFTs (all equipment except mines and polishing tables)
                this.workerNFTs = equipmentArray.filter(nft => {
                    const name = (nft.name || '').toLowerCase();
                    return !name.includes('mine') && !name.includes('polishing');
                });
                
                console.log('[Mining] Mine NFTs found:', this.mineNFTs.length);
                console.log('[Mining] Mine NFTs:', this.mineNFTs);
                console.log('[Mining] Worker NFTs found:', this.workerNFTs.length);
                console.log('[Mining] Worker NFTs:', this.workerNFTs);
            } else {
                console.warn('[Mining] No equipmentDetails in inventory data');
                console.log('[Mining] Available keys:', Object.keys(inventoryData || {}));
                this.mineNFTs = [];
                this.workerNFTs = [];
            }
            
        } catch (error) {
            console.error('[Mining] Failed to fetch inventory:', error);
            this.inventoryData = null;
            this.mineNFTs = [];
            this.workerNFTs = [];
        }
    }

    renderMiningSlots() {
        const slotsGrid = document.getElementById('slots-grid');
        if (!slotsGrid) {
            console.warn('[Mining] No slots grid element found');
            return;
        }

        console.log('[Mining] Rendering mining slots...');
        console.log('[Mining] - Effective slots:', this.effectiveSlots);
        console.log('[Mining] - Active jobs:', this.activeJobs.length);
        
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
                
                return `
                    <div class="mining-slot active ${isComplete ? 'complete' : 'in-progress'}" data-job-id="${job.jobId}" style="border: 2px solid ${isComplete ? '#00ff64' : '#00d4ff'}; box-shadow: 0 0 20px ${isComplete ? 'rgba(0, 255, 100, 0.3)' : 'rgba(0, 212, 255, 0.3)'};">
                        <div class="slot-header">
                            <h4>Slot ${slot.slotNum} ${isComplete ? '💎' : '⛏️'}</h4>
                            <span class="slot-status ${isComplete ? 'complete' : 'active'}" style="background: ${isComplete ? '#00ff64' : '#00d4ff'}; color: #000; padding: 4px 12px; border-radius: 12px; font-weight: bold;">
                                ${isComplete ? '✅ Ready to Collect' : '⛏️ Mining in Progress'}
                            </span>
                        </div>
                        <div class="slot-info" style="padding: 30px 20px; text-align: center;">
                            <p style="font-size: 2.5em; font-weight: bold; color: ${isComplete ? '#00ff64' : '#00d4ff'}; margin-bottom: 20px;">
                                <span class="timer" data-finish="${job.finishAt}">
                                    ${this.formatTime(remaining)}
                                </span>
                            </p>
                            <div class="progress-bar" style="margin: 20px 0; background: rgba(255,255,255,0.1); border-radius: 8px; height: 20px; overflow: hidden;">
                                <div class="progress-fill" style="width: ${progress}%; background: ${isComplete ? 'linear-gradient(90deg, #00ff64, #00aa44)' : 'linear-gradient(90deg, #00d4ff, #0088ff)'}; height: 100%; transition: width 1s linear; ${isComplete ? 'animation: pulse 1s infinite;' : ''}"></div>
                            </div>
                            <p style="color: ${isComplete ? '#00ff64' : '#888'}; font-size: 1.2em; margin-top: 15px;">
                                ${isComplete ? '✅ Mining Complete!' : `${Math.floor(progress)}% Complete`}
                            </p>
                        </div>
                        ${isComplete ? `
                            <button class="action-btn primary" onclick="game.completeMining('${job.jobId}')" style="background: linear-gradient(135deg, #00ff64, #00cc50); border: 2px solid #00ff64; animation: pulse 2s infinite; font-size: 1.2em; padding: 18px; font-weight: bold; box-shadow: 0 4px 20px rgba(0, 255, 100, 0.4);">
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

            return `
                <div class="mining-slot ${stakedMine ? 'rented' : 'available'}">
                    <div class="slot-header">
                        ${stakedMine ? `<span class="slot-staked">⛏️ ${stakedMine.name}</span>` : ''}
                    </div>
                    <div class="slot-content-layout">
                        <p class="slot-description">${stakedMine ? 'Staked mining operation ready to start' : 'Stake a mine NFT to begin operations'}</p>
                        <div class="slot-mine-image-container">
                            <img src="assets/images/${mineImagePath}" 
                                 class="slot-mine-image ${isGreyedImage ? 'greyed' : ''}" 
                                 alt="${stakedMine ? stakedMine.name : 'Mine placeholder'}" 
                                 style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px;">
                        </div>
                    </div>
                    ${stakedMine || stakedWorkers.length > 0 ? `
                        <div class="slot-workers">
                            <div class="worker-info">
                                <span>Workers: ${stakedWorkers.length}${stakedMine ? `/${this.getWorkerLimit(stakedMine.name)}` : ''}</span>
                                <span class="mining-power">MP: ${totalMP.toLocaleString()}</span>
                            </div>
                            ${stakedWorkers.length > 0 ? `
                                <button onclick="game.toggleWorkersList(${slot.slotNum})" class="action-btn secondary" style="width: 100%; margin: 0.5rem 0; padding: 0.6rem; font-size: 0.85em;">
                                    <i class="fas fa-users"></i> Manage ${stakedWorkers.length} Worker${stakedWorkers.length > 1 ? 's' : ''}
                                    <i class="fas fa-chevron-down" id="workers-chevron-${slot.slotNum}" style="margin-left: 0.5rem;"></i>
                                </button>
                                <div id="workers-list-${slot.slotNum}" style="display: none; margin-top: 0.5rem; padding: 0.75rem; background: rgba(0, 0, 0, 0.3); border-radius: 8px; max-height: 300px; overflow-y: auto;">
                                    <div style="margin-bottom: 0.75rem; padding: 0.5rem; background: rgba(0, 212, 255, 0.1); border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                                        <span style="color: #00d4ff; font-size: 0.85em;">
                                            <i class="fas fa-info-circle"></i> Select workers to unstake
                                        </span>
                                        <span id="unstake-count-${slot.slotNum}" style="color: #ff6b6b; font-size: 0.85em; font-weight: bold;">
                                            0 selected
                                        </span>
                                    </div>
                                    ${stakedWorkers.map((w, idx) => `
                                        <div class="worker-unstake-card" id="worker-unstake-${slot.slotNum}-${idx}" 
                                             style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem; background: rgba(0, 212, 255, 0.1); border-radius: 6px; margin-bottom: 0.5rem; border: 2px solid rgba(0, 212, 255, 0.2); cursor: pointer; transition: all 0.3s;"
                                             onclick="game.toggleWorkerForUnstake(${slot.slotNum}, ${idx})">
                                            <div style="flex: 1; pointer-events: none;">
                                                <div style="color: #ffffff; font-weight: 600; font-size: 0.9em;">${w.name}</div>
                                                <div style="color: #ffd700; font-size: 0.85em;"><i class="fas fa-hammer"></i> ${w.mp.toLocaleString()} MP</div>
                                            </div>
                                            <div class="unstake-checkbox" style="width: 20px; height: 20px; border: 2px solid #00d4ff; border-radius: 4px; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; pointer-events: none;">
                                                <i class="fas fa-check" style="color: #ff6b6b; font-size: 12px; display: none;"></i>
                                            </div>
                                        </div>
                                    `).join('')}
                                    <button id="unstake-selected-${slot.slotNum}" onclick="game.unstakeSelectedWorkers(${slot.slotNum})" 
                                            class="action-btn warning" 
                                            style="width: 100%; margin-top: 0.75rem; opacity: 0.5;" disabled>
                                        <i class="fas fa-times"></i> Unstake Selected Workers
                                    </button>
                                </div>
                            ` : ''}
                            <div class="slot-actions">
                                <button onclick="game.startMining(${slot.slotNum})" class="action-btn primary">
                                    <i class="fas fa-play"></i> Start Mining
                                </button>
                                ${stakedMine ? `
                                    <button onclick="game.unstakeMine(${slot.slotNum})" class="action-btn warning">
                                        <i class="fas fa-times"></i> Unstake Mine
                                    </button>
                                ` : `
                                    <button onclick="game.openStakeMineModal(${slot.slotNum})" class="action-btn secondary">
                                        <i class="fas fa-mountain"></i> Stake Mine NFT
                                    </button>
                                `}
                                <button onclick="game.openStakeWorkersModal(${slot.slotNum})" class="action-btn secondary">
                                    <i class="fas fa-users"></i> ${stakedWorkers.length > 0 ? 'Add More' : 'Stake'} Workers
                                </button>
                            </div>
                        </div>
                    ` : `
                        <div class="slot-actions">
                            ${stakedMine && stakedWorkers.length > 0 ? `
                                <button onclick="game.startMining(${slot.slotNum})" class="action-btn primary">
                                    <i class="fas fa-play"></i> Start Mining
                                </button>
                            ` : ''}
                            ${!stakedMine ? `
                                <button onclick="game.openStakeMineModal(${slot.slotNum})" class="action-btn secondary">
                                    <i class="fas fa-mountain"></i> Stake Mine NFT
                                </button>
                            ` : ''}
                            ${stakedMine ? `
                                <button onclick="game.unstakeMine(${slot.slotNum})" class="action-btn warning">
                                    <i class="fas fa-times"></i> Unstake Mine
                                </button>
                                <button onclick="game.openStakeWorkersModal(${slot.slotNum})" class="action-btn secondary">
                                    <i class="fas fa-users"></i> ${stakedWorkers.length > 0 ? 'Add More' : 'Stake'} Workers
                                </button>
                            ` : ''}
                        </div>
                    `}
                </div>
            `;
        }).join('');
    }

    updateMiningStats() {
        const activeSitesEl = document.getElementById('active-mining-sites');
        const totalWorkforceEl = document.getElementById('total-workforce');

        if (activeSitesEl) {
            activeSitesEl.textContent = this.activeJobs.length;
        }
        
        if (totalWorkforceEl) {
            // This would come from inventory in a real scenario
            totalWorkforceEl.textContent = '0';
        }
    }

    async startMining(slotNum) {
        if (!this.currentActor) {
            this.showNotification('Please connect your wallet first', 'error');
            return;
        }
        
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
        
        try {
            console.log('[Mining] Starting mining for slot:', slotNum);
            this.showNotification('⛏️ Starting mining job...', 'info');
            
            const response = await fetch(`${this.backendService.apiBase}/startMining`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ actor: this.currentActor })
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
            
            this.updateDebugPanel({
                action: 'startMining',
                result: data,
                finishAt: finishAt,
                remainingTime: remainingTime,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('[Mining] Failed to start mining:', error);
            this.showNotification('❌ Failed to start mining: ' + error.message, 'error');
        }
    }

    async completeMining(jobId) {
        if (!this.currentActor) {
            this.showNotification('Please connect your wallet first', 'error');
            return;
        }
        
        try {
            console.log('[Mining] Completing mining job:', jobId);
            this.showNotification('📦 Collecting rewards...', 'info');
            
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
            
            // Show success notification with gem details
            this.showNotification(`💎 Claimed ${amount}x Rough Gems!`, 'success');
            
            // Refresh mining data to clear the completed job
            await this.fetchActiveMiningJobs(this.currentActor);
            
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
            
            this.updateDebugPanel({
                action: 'completeMining',
                result: data,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('[Mining] Failed to complete mining:', error);
            this.showNotification('❌ Failed to claim rewards: ' + error.message, 'error');
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
            this.showNotification(`🔓 Unlocking mining slot ${slotNum} (${unlockCost.toLocaleString()} TSDM)...`, 'info');
            
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
                throw new Error(errorData.error || 'Failed to unlock slot');
            }
            
            const data = await response.json();
            console.log('[Mining] Slot unlocked:', data);
            
            this.showNotification(`✅ Mining slot ${slotNum} unlocked! (Cost: ${data.costPaid.toLocaleString()} TSDM)`, 'success');
            
            // Reload mining data to reflect changes
            await this.loadMiningData(this.currentActor);
            
        } catch (error) {
            console.error('[Mining] Failed to unlock slot:', error);
            this.showNotification('❌ Failed to unlock slot: ' + error.message, 'error');
        }
    }

    openStakeMineModal(slotNum) {
        console.log('[Mining] Opening stake mine modal for slot:', slotNum);
        
        this.selectedSlotForStaking = slotNum;
        
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
            const individualMineNFTs = [];
            this.mineNFTs.forEach(nft => {
                for (let i = 0; i < (nft.count || 1); i++) {
                    individualMineNFTs.push({
                        ...nft,
                        uniqueId: `${nft.template_id}-${i}`
                    });
                }
            });
            
            galleryContent = `
                <p style="margin-bottom: 15px; color: #888;">
                    Select a Mine NFT to stake in this slot. Staked mines provide passive mining power.
                </p>
                <div class="nft-gallery-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; max-height: 500px; overflow-y: auto; padding: 10px;">
                    ${individualMineNFTs.map(nft => `
                        <div class="nft-card" style="border: 2px solid #00d4ff; border-radius: 8px; padding: 10px; background: rgba(0, 0, 0, 0.3); cursor: pointer; transition: all 0.3s;" onclick="game.stakeMine('${nft.template_id}', ${slotNum}, ${nft.mp}, '${nft.name}')">
                            ${nft.imagePath ? `
                                <img src="${nft.imagePath}" alt="${nft.name}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;" onerror="this.style.display='none'">
                            ` : ''}
                            <h4 style="color: #00d4ff; margin-bottom: 5px; font-size: 0.9em;">${nft.name}</h4>
                            <p style="color: #00ff64; font-size: 0.85em; font-weight: bold; margin: 5px 0;">
                                <i class="fas fa-hammer"></i> ${(nft.mp || 0).toLocaleString()} MP
                            </p>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        const modalContent = `
            <div class="nft-stake-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-mountain"></i> Stake Mine NFT to Slot ${slotNum}</h3>
                    <button class="modal-close" onclick="game.closeStakeModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${galleryContent}
                </div>
            </div>
        `;
        
        // Show modal
        const modalOverlay = document.getElementById('modal-overlay');
        const modalBody = document.getElementById('modal-body');
        
        if (modalBody) {
            modalBody.innerHTML = modalContent;
        }
        
        if (modalOverlay) {
            modalOverlay.classList.add('active');
        }
    }

    openStakeWorkersModal(slotNum) {
        console.log('[Mining] Opening stake workers modal for slot:', slotNum);
        
        this.selectedSlotForStaking = slotNum;
        
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
                const individualWorkerNFTs = [];
                this.workerNFTs.forEach(nft => {
                    for (let i = 0; i < (nft.count || 1); i++) {
                        individualWorkerNFTs.push({
                            ...nft,
                            uniqueId: `${nft.template_id}-${i}`
                        });
                    }
                });
                
                const remainingSlots = workerLimit - currentWorkers;
                
                galleryContent = `
                    <div style="background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
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
                    <p style="margin-bottom: 15px; color: #888;">
                        Select multiple Worker NFTs to stake (max ${remainingSlots} more). Click to toggle selection.
                    </p>
                    <div class="nft-gallery-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; max-height: 400px; overflow-y: auto; padding: 10px;">
                        ${individualWorkerNFTs.map((nft, idx) => `
                            <div class="nft-card worker-select-card" id="worker-card-${idx}" 
                                 style="border: 2px solid #00d4ff; border-radius: 8px; padding: 10px; background: rgba(0, 0, 0, 0.3); cursor: pointer; transition: all 0.3s; position: relative;" 
                                 onclick="game.toggleWorkerSelection(${idx}, '${nft.template_id}', ${nft.mp}, '${nft.name}', ${slotNum}, ${remainingSlots})">
                                <div class="selection-checkbox" style="position: absolute; top: 5px; right: 5px; width: 24px; height: 24px; border: 2px solid #00d4ff; border-radius: 4px; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center;">
                                    <i class="fas fa-check" style="color: #00ff64; font-size: 14px; display: none;"></i>
                                </div>
                                ${nft.imagePath ? `
                                    <img src="${nft.imagePath}" alt="${nft.name}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;" onerror="this.style.display='none'">
                                ` : ''}
                                <h4 style="color: #00d4ff; margin-bottom: 5px; font-size: 0.9em;">${nft.name}</h4>
                                <p style="color: #00ff64; font-size: 0.85em; font-weight: bold; margin: 5px 0;">
                                    <i class="fas fa-hammer"></i> ${(nft.mp || 0).toLocaleString()} MP
                                </p>
                            </div>
                        `).join('')}
                    </div>
                    <div style="margin-top: 20px; display: flex; gap: 10px;">
                        <button id="confirm-stake-workers" class="action-btn primary" style="flex: 1;" onclick="game.confirmStakeWorkers(${slotNum})" disabled>
                            <i class="fas fa-check"></i> Stake Selected Workers
                        </button>
                        <button class="action-btn secondary" onclick="game.closeStakeModal()">
                            <i class="fas fa-times"></i> Cancel
                        </button>
                    </div>
                `;
            }
        }
        
        const modalContent = `
            <div class="nft-stake-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-users"></i> Stake Worker NFTs to Slot ${slotNum}</h3>
                    <button class="modal-close" onclick="game.closeStakeModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${galleryContent}
                </div>
            </div>
        `;
        
        // Show modal
        const modalOverlay = document.getElementById('modal-overlay');
        const modalBody = document.getElementById('modal-body');
        
        if (modalBody) {
            modalBody.innerHTML = modalContent;
        }
        
        if (modalOverlay) {
            modalOverlay.classList.add('active');
        }
    }

    closeStakeModal() {
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.classList.remove('active');
        }
        this.selectedSlotForStaking = null;
        this.selectedWorkers = []; // Reset selection when closing modal
    }

    stakeMine(templateId, slotNum, mp, name) {
        console.log('[Mining] Staking mine:', name, 'to slot:', slotNum);
        
        // Store staked mine (client-side only for now)
        this.stakedMines[slotNum] = {
            template_id: templateId,
            name: name,
            mp: mp
        };
        
        this.showNotification(`✅ Staked ${name} to Slot ${slotNum}!`, 'success');
        this.closeStakeModal();
        this.renderMiningSlots();
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

    toggleWorkerSelection(cardIdx, templateId, mp, name, slotNum, remainingSlots) {
        const card = document.getElementById(`worker-card-${cardIdx}`);
        const checkbox = card.querySelector('.selection-checkbox i');
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
            checkbox.style.display = 'none';
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
                name
            });
            card.style.border = '2px solid #00ff64';
            card.style.background = 'rgba(0, 255, 100, 0.1)';
            checkbox.style.display = 'block';
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

    confirmStakeWorkers(slotNum) {
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
        
        // Initialize workers array if needed
        if (!this.stakedWorkers[slotNum]) {
            this.stakedWorkers[slotNum] = [];
        }
        
        // Add all selected workers
        this.selectedWorkers.forEach(worker => {
            this.stakedWorkers[slotNum].push({
                template_id: worker.template_id,
                name: worker.name,
                mp: worker.mp
            });
        });
        
        const count = this.selectedWorkers.length;
        const workerLimit = this.getWorkerLimit(stakedMine.name);
        const totalWorkers = this.stakedWorkers[slotNum].length;
        
        this.showNotification(`✅ Staked ${count} worker${count > 1 ? 's' : ''} to Slot ${slotNum}! (${totalWorkers}/${workerLimit})`, 'success');
        
        // Clear selection
        this.selectedWorkers = [];
        this.closeStakeModal();
        this.renderMiningSlots();
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

    unstakeSelectedWorkers(slotNum) {
        if (this.selectedWorkersForUnstake.size === 0) {
            this.showNotification('❌ Please select at least one worker to unstake!', 'error');
            return;
        }
        
        console.log('[Mining] Unstaking multiple workers from slot:', slotNum);
        
        // Convert Set to array of indices and sort in reverse order
        const indices = Array.from(this.selectedWorkersForUnstake)
            .filter(key => key.startsWith(`${slotNum}-`))
            .map(key => parseInt(key.split('-')[1]))
            .sort((a, b) => b - a); // Sort descending to remove from end first
        
        if (indices.length === 0) return;
        
        const workers = this.stakedWorkers[slotNum];
        if (!workers) return;
        
        const removedWorkers = [];
        
        // Remove workers in reverse order to maintain correct indices
        indices.forEach(index => {
            if (workers[index]) {
                removedWorkers.push(workers[index]);
                workers.splice(index, 1);
            }
        });
        
        // Clean up empty array
        if (workers.length === 0) {
            delete this.stakedWorkers[slotNum];
        }
        
        const count = removedWorkers.length;
        this.showNotification(`✅ Unstaked ${count} worker${count > 1 ? 's' : ''} from Slot ${slotNum}!`, 'success');
        
        // Clear selection
        this.selectedWorkersForUnstake.clear();
        this.renderMiningSlots();
    }

    unstakeWorker(slotNum, workerIndex) {
        console.log('[Mining] Unstaking worker at index:', workerIndex, 'from slot:', slotNum);
        
        if (this.stakedWorkers[slotNum] && this.stakedWorkers[slotNum][workerIndex]) {
            const worker = this.stakedWorkers[slotNum][workerIndex];
            this.stakedWorkers[slotNum].splice(workerIndex, 1);
            
            // Clean up empty array
            if (this.stakedWorkers[slotNum].length === 0) {
                delete this.stakedWorkers[slotNum];
            }
            
            this.showNotification(`✅ Unstaked ${worker.name} from Slot ${slotNum}!`, 'success');
            this.renderMiningSlots();
        }
    }

    unstakeMine(slotNum) {
        console.log('[Mining] Unstaking mine from slot:', slotNum);
        
        if (this.stakedMines[slotNum]) {
            const mine = this.stakedMines[slotNum];
            delete this.stakedMines[slotNum];
            
            this.showNotification(`✅ Unstaked ${mine.name} from Slot ${slotNum}!`, 'success');
            this.renderMiningSlots();
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
            let hasCompleted = false;
            
            timers.forEach(timer => {
                const finishAt = parseInt(timer.dataset.finish);
                const now = Date.now();
                const remaining = Math.max(0, finishAt - now);
                
                timer.textContent = this.formatTime(remaining);
                
                if (remaining === 0) {
                    hasCompleted = true;
                }
            });
            
            // Re-render if any job completed
            if (hasCompleted) {
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
        
        this.updateDebugPanel({
            status: 'disconnected',
            timestamp: new Date().toISOString()
        });
    }
}

// Initialize mining when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new MiningGame();
    window.tsdgemsGame = game;
});
