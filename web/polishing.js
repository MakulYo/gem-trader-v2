// TSDGEMS - Polishing Page Script (Backend-Connected)

// Polishing Constants (match backend)
const POLISHING_DURATION_MS = 1 * 60 * 60 * 1000; // 1 hour
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
        this.effectiveSlots = 0;
        this.refreshInterval = null;
        this.timerInterval = null;
        this.inventoryData = null;
        this.polishingTableNFTs = [];
        this.roughGemsCount = 0;
        this.polishedGems = {}; // { polished_diamond: X, polished_ruby: Y, ... }
        this.selectedSlotForStaking = null;
        this.stakedTables = {}; // { slotNum: { template_id, name } }
        
        this.init();
    }

    init() {
        console.log('[Polishing] Running init()...');
        this.setupWalletIntegration();
        this.setupWalletEventListeners();this.showNotification('Connect your wallet to access polishing operations', 'info');
        console.log('[Polishing] Init complete');
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
                connectBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
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
                    connectBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
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

            if (connectBtn) {
                connectBtn.innerHTML = '<i class="fas fa-check"></i> Connected';
            }
            
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
        // Check if already initialized - skip full reload
        if (this.isInitialized && this.lastDataLoad && (Date.now() - this.lastDataLoad) < 300000) {
            console.log('[Polishing] Already initialized, skipping full reload');
            // Just refresh active jobs and gem inventory (quick)
            await this.fetchActivePolishingJobs(actor);
            await this.fetchGemInventory(actor);
            this.renderPolishingSlots();
            return;
        }
        
        try {
            console.log('[Polishing] ========================================');
            console.log('[Polishing] Loading polishing data for actor:', actor);
            
            // Show loading state
            this.showLoadingState(true);
            
            this.showNotification('📊 Loading polishing data...', 'info');

            // Fetch all data in parallel for better performance
            // Note: initPlayer runs in background for new players
            const results = await Promise.all([
                this.backendService.getDashboard(actor),
                this.fetchActivePolishingJobs(actor).catch(() => ({ jobs: [] })),
                this.fetchInventoryData(actor).catch(() => null),
                this.fetchGemInventory(actor).catch(() => 0),
                this.backendService.getStakedAssets(actor).catch(() => ({ stakingData: {} }))
            ]);
            
            const [dashboard, activeJobs, inventoryData, gemInventory, stakedAssets] = results;

            if (dashboard && dashboard.player) {
                console.log('[Polishing] Player data loaded:', dashboard.player);
                
                // Update header
                const headerGameDollars = document.getElementById('header-game-dollars');
                if (headerGameDollars) {
                    const currency = dashboard.player.ingameCurrency || 0;
                    headerGameDollars.textContent = `Game $: ${currency.toLocaleString()}`;
                }
            }
            
            // Process active jobs
            if (activeJobs && activeJobs.jobs) {
                this.activeJobs = activeJobs.jobs;
            }
            
            // Process gem inventory
            if (gemInventory) {
                this.roughGemsCount = gemInventory;
            }
            
            // Process inventory data
            if (inventoryData) {
                // Process polish table NFTs
                if (inventoryData.equipmentDetails) {
                    const equipmentArray = Object.entries(inventoryData.equipmentDetails).map(([templateId, details]) => ({
                        template_id: templateId,
                        name: details.name,
                        count: details.count,
                        image: details.image,
                        imagePath: details.imagePath,
                        assets: details.assets || []
                    }));
                    
                    this.polishingTableNFTs = equipmentArray.filter(nft => {
                        const name = (nft.name || '').toLowerCase();
                        return name.includes('polishing');
                    });
                }
            }
            
            // Process staked assets
            if (stakedAssets && stakedAssets.stakingData) {
                const stakingData = stakedAssets.stakingData;
                this.stakedTables = {};
                this.stakedGems = {};
                
                if (stakingData.polishing) {
                    Object.entries(stakingData.polishing).forEach(([slotKey, slotData]) => {
                        const slotNum = parseInt(slotKey.replace('slot', ''));
                        
                        if (slotData.table) {
                            this.stakedTables[slotNum] = {
                                template_id: slotData.table.template_id,
                                name: slotData.table.name,
                                asset_id: slotData.table.asset_id
                            };
                        }
                        
                        if (slotData.gem) {
                            this.stakedGems[slotNum] = {
                                template_id: slotData.gem.template_id,
                                name: slotData.gem.name,
                                gemType: slotData.gem.gemType,
                                isPolished: slotData.gem.isPolished,
                                bonus: slotData.gem.bonus,
                                asset_id: slotData.gem.asset_id
                            };
                        }
                    });
                }
            }             this.renderPolishingSlots();
             this.updatePolishingStats();
             
             // Hide loading state
             this.showLoadingState(false);
             
             // Mark as initialized and track load time
            this.isInitialized = true;
            this.lastDataLoad = Date.now();
            
            // Start auto-refresh
            this.startAutoRefresh();
            
            // Start timer updates
            this.startTimerUpdates();
            
            this.showNotification('✅ Polishing data loaded!', 'success');
            console.log('[Polishing] ✅ Polishing data loaded successfully');
            console.log('[Polishing] ========================================');
            
        } catch (error) {
            console.error('[Polishing] Failed to load polishing data:', error);
            
            // Hide loading state on error
            this.showLoadingState(false);
            
            this.showNotification('❌ Failed to load polishing data: ' + error.message, 'error');}
    }

    async fetchActivePolishingJobs(actor) {
        try {
            console.log('[Polishing] Fetching active polishing jobs...');
            
            const url = `${this.backendService.apiBase}/getActivePolishing?actor=${encodeURIComponent(actor)}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`getActivePolishing failed: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('[Polishing] Active polishing jobs response:', data);
            
            const jobs = data.jobs || [];
            this.activeJobs = jobs;
            
            console.log('[Polishing] Active jobs:', this.activeJobs.length);
            console.log('[Polishing] Effective slots:', this.effectiveSlots);
            
            // Return data for Promise.all usage
            return { jobs };
            
        } catch (error) {
            console.error('[Polishing] Failed to fetch active jobs:', error);
            this.activeJobs = [];
            return { jobs: [] };
        }
    }

    async fetchInventoryData(actor) {
        try {
            console.log('[Polishing] Fetching inventory data...');
            
            const inventoryData = await this.backendService.getInventory(actor, false);
            console.log('[Polishing] Inventory data received:', inventoryData);
            
            // Update instance variables
            this.inventoryData = inventoryData;
            this.effectiveSlots = inventoryData.polishingSlots || 0;
            
            // Return data for Promise.all usage
            return inventoryData;
            
        } catch (error) {
            console.error('[Polishing] Failed to fetch inventory:', error);
            this.inventoryData = null;
            this.polishingTableNFTs = [];
            return null;
        }
    }

    async fetchGemInventory(actor) {
        try {
            console.log('[Polishing] Fetching gem inventory...');
            
            const inventoryData = await this.backendService.getInventory(actor, false);
            console.log('[Polishing] Full inventory data:', inventoryData);
            
            // Extract rough gem count (only one type)
            const roughGemsCount = inventoryData[ROUGH_GEM_KEY] || 0;
            
            // Extract all 10 specific polished gem types
            const polishedGems = {};
            POLISHED_GEM_TYPES.forEach(gemType => {
                polishedGems[gemType] = inventoryData[gemType] || 0;
            });
            
            // Update instance variables
            this.roughGemsCount = roughGemsCount;
            this.polishedGems = polishedGems;
            
            console.log('[Polishing] ROUGH_GEM_KEY:', ROUGH_GEM_KEY);
            console.log('[Polishing] Rough gems count:', this.roughGemsCount);
            console.log('[Polishing] Polished gems:', this.polishedGems);
            
            if (this.roughGemsCount === 0) {
                console.warn('[Polishing] No rough gems found! Button will be disabled.');
            }
            
            // Return data for Promise.all usage
            return roughGemsCount;
            
        } catch (error) {
            console.error('[Polishing] Failed to fetch gem inventory:', error);
            this.roughGemsCount = 0;
            this.polishedGems = {};
            return 0;
        }
    }

    async loadStakedAssets(actor) {
        try {
            console.log('[Polishing] Loading staked assets...');
            
            const stakingResponse = await this.backendService.getStakedAssets(actor);
            console.log('[Polishing] Staking data received:', stakingResponse);
            
            if (stakingResponse && stakingResponse.stakingData) {
                const stakingData = stakingResponse.stakingData;
                
                // Initialize staking data
                this.stakedTables = {};
                
                // Process polishing staking data
                if (stakingData.polishing) {
                    Object.entries(stakingData.polishing).forEach(([slotKey, slotData]) => {
                        const slotNum = parseInt(slotKey.replace('slot', ''));
                        
                        if (slotData.table) {
                            this.stakedTables[slotNum] = {
                                template_id: slotData.table.template_id,
                                name: slotData.table.name,
                                imagePath: slotData.table.imagePath || '',
                                asset_id: slotData.table.asset_id
                            };
                        }
                    });
                }
                
                console.log('[Polishing] Loaded staked tables:', this.stakedTables);
            } else {
                console.log('[Polishing] No staking data found, initializing empty');
                this.stakedTables = {};
            }
            
        } catch (error) {
            console.error('[Polishing] Failed to load staked assets:', error);
            this.stakedTables = {};
        }
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
                const unlockCost = POLISHING_SLOT_UNLOCK_COSTS[slot.slotNum - 1] || 0;
                return `
                    <div class="polishing-slot locked">
                        <div class="slot-header">
                            <span class="slot-locked">🔒 LOCKED</span>
                        </div>
                        <div class="slot-content-layout">
                            <p class="slot-description">Unlock this polishing slot</p>
                        </div>
                        <div class="slot-unlock-requirements">
                            <h4>Unlock Requirements:</h4>
                            <div class="unlock-req">
                                <span>Requires: Polishing Table (NFT)</span>
                                <small style="display: block; color: #888; margin-top: 5px;">No TSDM cost - Backend verifies NFT ownership</small>
                            </div>
                            <button onclick="game.unlockPolishingSlot(${slot.slotNum})" class="action-btn primary">
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
                                <span class="timer" data-finish="${job.finishAt}">
                                    ${this.formatTime(remaining)}
                                </span>
                            </p>
                            <div class="progress-bar" style="margin: 20px 0; background: rgba(255,255,255,0.1); border-radius: 8px; height: 20px; overflow: hidden;">
                                <div class="progress-fill" style="width: ${progress}%; background: ${isComplete ? 'linear-gradient(90deg, #00ff64, #00aa44)' : 'linear-gradient(90deg, #ff9500, #ff6b00)'}; height: 100%; transition: width 1s linear; ${isComplete ? 'animation: pulse 1s infinite;' : ''}"></div>
                            </div>
                            <p style="color: ${isComplete ? '#00ff64' : '#888'}; font-size: 1.2em; margin-top: 15px;">
                                ${isComplete ? '✅ Polishing Complete!' : `${Math.floor(progress)}% Complete`}
                            </p>
                        </div>
                        ${isComplete ? `
                            <button class="action-btn primary" onclick="game.completePolishing('${job.jobId}')" style="background: linear-gradient(135deg, #00ff64, #00cc50); border: 2px solid #00ff64; animation: pulse 2s infinite; font-size: 1.2em; padding: 18px; font-weight: bold; box-shadow: 0 4px 20px rgba(0, 255, 100, 0.4);">
                                <i class="fas fa-gift"></i> CLAIM REWARDS
                            </button>
                        ` : ''}
            </div>
                `;
    }

            // Available slot (unlocked but no job)
            const stakedTable = this.stakedTables[slot.slotNum];

            const maxAmount = Math.min(this.roughGemsCount, MAX_AMOUNT_PER_SLOT);
            
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
            const individualTableNFTs = [];
            this.polishingTableNFTs.forEach(nft => {
                // Use actual asset IDs if available from equipmentDetails
                const assets = nft.assets || [];
                const count = Math.max(assets.length, nft.count || 1);
                
                for (let i = 0; i < count; i++) {
                    individualTableNFTs.push({
                        ...nft,
                        asset_id: assets[i] || `${nft.template_id}-${i}`, // Use real asset ID or placeholder
                        uniqueId: `${nft.template_id}-${i}`
                    });
                }
            });
            
            // Filter out already staked tables
            let availableTables = individualTableNFTs.filter(nft => !stakedAssetIds.has(nft.asset_id));
            
            // Sort by priority/quality if needed (currently sorted by name)
            // You could add other sorting criteria here
            availableTables.sort((a, b) => a.name.localeCompare(b.name));
            
            console.log('[Polishing] Available tables after filtering and sorting:', availableTables.length, 'of', individualTableNFTs.length);
            
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
                ${availableTables.length < individualTableNFTs.length ? `
                    <div style="background: rgba(255, 152, 0, 0.1); border: 1px solid rgba(255, 152, 0, 0.3); border-radius: 6px; padding: 8px; margin-bottom: 10px;">
                        <p style="color: #ff9800; margin: 0; font-size: 0.8em;">
                            <i class="fas fa-info-circle"></i> ${individualTableNFTs.length - availableTables.length} table(s) already staked
                        </p>
                    </div>
                ` : ''}
                <div class="nft-gallery-grid" style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: ${window.innerWidth <= 768 ? '0.35rem' : '10px'}; padding: 5px; justify-content: start; overflow: visible;">
                    ${availableTables.map(nft => `
                        <div class="nft-card" style="border: 2px solid #ff9500; border-radius: 6px; padding: ${window.innerWidth <= 768 ? '6px' : '8px'}; background: rgba(0, 0, 0, 0.3); cursor: pointer; transition: all 0.3s; min-width: 0;" onclick="game.stakeTable('${nft.template_id}', ${slotNum}, '${nft.name}', '${nft.imagePath || ''}', '${nft.asset_id}')">
                            ${nft.imagePath ? `
                                <img src="${nft.imagePath}" alt="${nft.name}" style="width: 100%; height: ${window.innerWidth <= 768 ? 'auto' : '100px'}; aspect-ratio: ${window.innerWidth <= 768 ? '1' : 'auto'}; object-fit: cover; border-radius: 4px; margin-bottom: 8px;" onerror="this.style.display='none'">
                            ` : ''}
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
                    amount: amount
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
            
            // Refresh polishing data
            await this.fetchActivePolishingJobs(this.currentActor);
            await this.fetchGemInventory(this.currentActor);
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
        
        try {
            console.log('[Polishing] Completing polishing job:', jobId);
            
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
            
            // Refresh polishing data
            await this.fetchActivePolishingJobs(this.currentActor);
            await this.fetchGemInventory(this.currentActor);
            
            // Reload dashboard to update balances
            const dashboard = await this.backendService.getDashboard(this.currentActor);
            if (dashboard && dashboard.player) {
                const headerGameDollars = document.getElementById('header-game-dollars');
                if (headerGameDollars) {
                    const currency = dashboard.player.ingameCurrency || 0;
                    headerGameDollars.textContent = `Game $: ${currency.toLocaleString()}`;
                }
            }
            
            this.renderPolishingSlots();
            this.updatePolishingStats();} catch (error) {
            console.error('[Polishing] Failed to complete polishing:', error);
            this.showNotification('❌ Failed to claim rewards: ' + error.message, 'error');
        }
    }

    async unlockPolishingSlot(slotNum) {
        if (!this.currentActor) {
            this.showNotification('Please connect your wallet first', 'error');
            return;
        }
        
        const unlockCost = POLISHING_SLOT_UNLOCK_COSTS[slotNum - 1] || 0;
        
        try {
            console.log('[Polishing] Unlocking slot:', slotNum, '(No TSDM cost - Backend verifies NFT ownership)');
            this.showNotification(`Unlocking slot ${slotNum} (Backend will verify Polishing Table NFT)...`, 'info');
            
            // Create payment request
            const response = await fetch(`${this.backendService.apiBase}/unlockPolishingSlot`, {
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
            console.log('[Polishing] Payment request created:', data);
            
            // Show payment modal
            this.showPaymentModal(data.paymentId, unlockCost, slotNum, 'polishing_slot_unlock');
            
        } catch (error) {
            console.error('[Polishing] Failed to create payment request:', error);
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
                
                this.showNotification(`✅ Polishing slot ${slotNum} unlocked successfully!`, 'success');
                
                // Force reload polishing data after payment (bypass cache)
                this.isInitialized = false;
                await this.loadPolishingData(this.currentActor);
                
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

    async stakeTable(templateId, slotNum, name, imagePath, assetId) {
        console.log('[Polishing] Staking table:', name, 'to slot:', slotNum, 'asset_id:', assetId);
        
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
            
            if (result.success) {
                // Update local state with backend data
                await this.loadStakedAssets(this.currentActor);
                
                this.showNotification(`✅ Staked ${name} to Slot ${slotNum}!`, 'success');
                this.closeStakeModal();
                this.renderPolishingSlots();
            } else {
                throw new Error(result.error || 'Failed to stake table');
            }
        } catch (error) {
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
        
        try {
            const result = await this.backendService.unstakeAsset(
                this.currentActor,
                'polishing',
                slotNum,
                'table',
                stakedTable.asset_id
            );
            
            if (result.success) {
                // Update local state with backend data
                await this.loadStakedAssets(this.currentActor);
                
                this.showNotification(`✅ Unstaked ${stakedTable.name} from Slot ${slotNum}!`, 'success');
                this.renderPolishingSlots();
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
            
            if (hasCompleted) {
                this.renderPolishingSlots();
            }
        }, 1000);
    }

    startAutoRefresh() {
        if (!this.currentActor) return;
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.refreshInterval = setInterval(async () => {
            if (this.isLoggedIn && this.currentActor) {
                try {
                    await this.fetchActivePolishingJobs(this.currentActor);
                    this.renderPolishingSlots();
                    this.updatePolishingStats();
                } catch (error) {
                    console.error('[Polishing] Auto-refresh failed:', error);
                }
            }
        }, 30000);
        
        window.addEventListener('beforeunload', () => {
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
            }
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
            }
        });
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
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
                this.refreshInterval = null;
            }
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
});
