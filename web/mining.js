// TSDGEMS - Mining Page Script (Backend-Connected)

// Mining Constants (match backend)
const MINING_DURATION_MS = 3 * 60 * 60 * 1000; // 3 hours
const MINING_COST_TSDM = 50;
const MAX_SLOTS = 10;

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
                const unlockCost = 100; // Cost: 100 TSDM per slot
                return `
                    <div class="mining-slot locked">
                        <div class="slot-header">
                            <span class="slot-cost">${unlockCost} TSDM</span>
                            <span class="slot-locked">🔒 LOCKED</span>
                        </div>
                        <div class="slot-content-layout">
                            <p class="slot-description">Unlock this slot to expand your mining operations and increase your gem production potential</p>
                        </div>
                        <div class="slot-unlock-requirements">
                            <h4>Unlock Requirements:</h4>
                            <div class="unlock-req">
                                <span>Cost: ${unlockCost} TSDM</span>
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
                        <div class="slot-info">
                            <p style="font-size: 1.1em; font-weight: bold; color: ${isComplete ? '#00ff64' : '#00d4ff'};">
                                <i class="fas fa-clock"></i> Time Remaining: 
                                <span class="timer" data-finish="${job.finishAt}" style="color: ${isComplete ? '#00ff64' : '#00d4ff'};">
                                    ${this.formatTime(remaining)}
                                </span>
                            </p>
                            <div class="progress-bar" style="margin-top: 15px; background: rgba(255,255,255,0.1); border-radius: 8px; height: 12px; overflow: hidden;">
                                <div class="progress-fill" style="width: ${progress}%; background: ${isComplete ? 'linear-gradient(90deg, #00ff64, #00aa44)' : 'linear-gradient(90deg, #00d4ff, #0088ff)'}; height: 100%; transition: width 1s linear; ${isComplete ? 'animation: pulse 1s infinite;' : ''}"></div>
                            </div>
                            <p style="margin-top: 10px; color: #888; font-size: 0.9em;">
                                <i class="fas fa-coins"></i> Cost Paid: ${MINING_COST_TSDM} TSDM
                            </p>
                            <p style="color: #888; font-size: 0.9em;">
                                <i class="fas fa-percent"></i> Progress: ${Math.floor(progress)}%
                            </p>
                        </div>
                        ${isComplete ? `
                            <button class="action-btn primary" onclick="game.completeMining('${job.jobId}')" style="background: #00ff64; animation: pulse 2s infinite;">
                                <i class="fas fa-gem"></i> Collect Rough Gems
                            </button>
                        ` : `
                            <button class="action-btn secondary" disabled style="opacity: 0.6;">
                                <i class="fas fa-hourglass-half fa-spin"></i> Mining...
                            </button>
                        `}
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
                                <span>Workers: ${stakedWorkers.length}</span>
                                <span class="mining-power">MP: ${totalMP.toLocaleString()}</span>
                            </div>
                            ${stakedWorkers.length > 0 ? `
                                <button onclick="game.toggleWorkersList(${slot.slotNum})" class="action-btn secondary" style="width: 100%; margin: 0.5rem 0; padding: 0.6rem; font-size: 0.85em;">
                                    <i class="fas fa-users"></i> View ${stakedWorkers.length} Worker${stakedWorkers.length > 1 ? 's' : ''}
                                    <i class="fas fa-chevron-down" id="workers-chevron-${slot.slotNum}" style="margin-left: 0.5rem;"></i>
                                </button>
                                <div id="workers-list-${slot.slotNum}" style="display: none; margin-top: 0.5rem; padding: 0.75rem; background: rgba(0, 0, 0, 0.3); border-radius: 8px; max-height: 180px; overflow-y: auto;">
                                    ${stakedWorkers.map((w, idx) => `
                                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem; background: rgba(0, 212, 255, 0.1); border-radius: 6px; margin-bottom: 0.5rem; border: 1px solid rgba(0, 212, 255, 0.2);">
                                            <div style="flex: 1;">
                                                <div style="color: #ffffff; font-weight: 600; font-size: 0.9em;">${w.name}</div>
                                                <div style="color: #ffd700; font-size: 0.85em;"><i class="fas fa-hammer"></i> ${w.mp.toLocaleString()} MP</div>
                                            </div>
                                            <button onclick="game.unstakeWorker(${slot.slotNum}, ${idx})" class="action-btn" style="background: rgba(231, 76, 60, 0.3); border: 1px solid #e74c3c; padding: 0.4rem 0.7rem; font-size: 0.75em;">
                                                <i class="fas fa-times"></i>
                                            </button>
                                        </div>
                                    `).join('')}
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
                            <button onclick="game.startMining(${slot.slotNum})" class="action-btn primary">
                                <i class="fas fa-play"></i> Start Mining
                            </button>
                            <button onclick="game.openStakeMineModal(${slot.slotNum})" class="action-btn secondary">
                                <i class="fas fa-mountain"></i> Stake Mine NFT
                            </button>
                            <button onclick="game.openStakeWorkersModal(${slot.slotNum})" class="action-btn secondary">
                                <i class="fas fa-users"></i> Stake Workers
                        </button>
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
            console.log('[Mining] Mining started:', data);
            
            this.showNotification('✅ Mining job started! Check back in 3 hours.', 'success');
            
            // Refresh mining data
            await this.fetchActiveMiningJobs(this.currentActor);
            this.renderMiningSlots();
            this.updateMiningStats();
            this.updateDebugPanel({
                action: 'startMining',
                result: data,
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
            this.showNotification('📦 Collecting gems...', 'info');
            
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
            const gemType = result.roughType;
            const amount = result.yieldAmt;
            
            this.showNotification(`✅ Collected ${amount}x ${gemType} rough gems!`, 'success');
            
            // Refresh mining data
            await this.fetchActiveMiningJobs(this.currentActor);
            this.renderMiningSlots();
            this.updateMiningStats();
            this.updateDebugPanel({
                action: 'completeMining',
                result: data,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('[Mining] Failed to complete mining:', error);
            this.showNotification('❌ Failed to collect gems: ' + error.message, 'error');
        }
    }

    async unlockSlot(slotNum) {
        if (!this.currentActor) {
            this.showNotification('Please connect your wallet first', 'error');
            return;
        }
        
        try {
            console.log('[Mining] Unlocking slot:', slotNum);
            this.showNotification(`🔓 Unlocking mining slot ${slotNum}...`, 'info');
            
            const response = await fetch(`${this.backendService.apiBase}/unlockMiningSlot`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ actor: this.currentActor })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to unlock slot');
            }
            
            const data = await response.json();
            console.log('[Mining] Slot unlocked:', data);
            
            this.showNotification(`✅ Mining slot ${slotNum} unlocked! (Cost: ${data.costPaid} TSDM)`, 'success');
            
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
            // Show NFT gallery with smaller images
            galleryContent = `
                <p style="margin-bottom: 15px; color: #888;">
                    Select a Mine NFT to stake in this slot. Staked mines provide passive mining power.
                </p>
                <div class="nft-gallery-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; max-height: 500px; overflow-y: auto; padding: 10px;">
                    ${this.mineNFTs.map(nft => `
                        <div class="nft-card" style="border: 2px solid #00d4ff; border-radius: 8px; padding: 10px; background: rgba(0, 0, 0, 0.3); cursor: pointer; transition: all 0.3s;" onclick="game.stakeMine('${nft.template_id}', ${slotNum}, ${nft.mp}, '${nft.name}')">
                            ${nft.imagePath ? `
                                <img src="${nft.imagePath}" alt="${nft.name}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;" onerror="this.style.display='none'">
                            ` : ''}
                            <h4 style="color: #00d4ff; margin-bottom: 5px; font-size: 0.9em;">${nft.name}</h4>
                            <p style="color: #00ff64; font-size: 0.85em; font-weight: bold; margin: 5px 0;">
                                <i class="fas fa-hammer"></i> ${(nft.mp || 0).toLocaleString()} MP
                            </p>
                            <p style="color: #888; font-size: 0.75em;">
                                <i class="fas fa-layer-group"></i> Owned: ${nft.count || 0}
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
            // Show NFT gallery with smaller images
            galleryContent = `
                <p style="margin-bottom: 15px; color: #888;">
                    Select Worker NFTs to stake in this slot. Each worker contributes to your total mining power.
                </p>
                <div class="nft-gallery-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; max-height: 500px; overflow-y: auto; padding: 10px;">
                    ${this.workerNFTs.map(nft => `
                        <div class="nft-card" style="border: 2px solid #00d4ff; border-radius: 8px; padding: 10px; background: rgba(0, 0, 0, 0.3); cursor: pointer; transition: all 0.3s;" onclick="game.stakeWorker('${nft.template_id}', ${slotNum}, ${nft.mp}, '${nft.name}')">
                            ${nft.imagePath ? `
                                <img src="${nft.imagePath}" alt="${nft.name}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;" onerror="this.style.display='none'">
                            ` : ''}
                            <h4 style="color: #00d4ff; margin-bottom: 5px; font-size: 0.9em;">${nft.name}</h4>
                            <p style="color: #00ff64; font-size: 0.85em; font-weight: bold; margin: 5px 0;">
                                <i class="fas fa-hammer"></i> ${(nft.mp || 0).toLocaleString()} MP
                            </p>
                            <p style="color: #888; font-size: 0.75em;">
                                <i class="fas fa-layer-group"></i> Owned: ${nft.count || 0}
                            </p>
                        </div>
                    `).join('')}
                </div>
            `;
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

    stakeWorker(templateId, slotNum, mp, name) {
        console.log('[Mining] Staking worker:', name, 'to slot:', slotNum);
        
        // Add worker to staked workers array for this slot
        if (!this.stakedWorkers[slotNum]) {
            this.stakedWorkers[slotNum] = [];
        }
        
        this.stakedWorkers[slotNum].push({
            template_id: templateId,
            name: name,
            mp: mp
        });
        
        this.showNotification(`✅ Staked ${name} to Slot ${slotNum}!`, 'success');
        this.closeStakeModal();
        this.renderMiningSlots();
    }

    toggleWorkersList(slotNum) {
        const workersList = document.getElementById(`workers-list-${slotNum}`);
        const chevron = document.getElementById(`workers-chevron-${slotNum}`);
        
        if (workersList && chevron) {
            const isHidden = workersList.style.display === 'none';
            workersList.style.display = isHidden ? 'block' : 'none';
            chevron.className = isHidden ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
        }
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
