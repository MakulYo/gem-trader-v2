// TSDGEMS - Polishing Page Script (Backend-Connected)

// Polishing Constants (match backend)
const POLISHING_DURATION_MS = 1 * 60 * 60 * 1000; // 1 hour
const MAX_POLISHING_SLOTS = 10;
const MAX_AMOUNT_PER_SLOT = 500;

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
        this.rawBackendData = null;
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
        this.setupWalletEventListeners();
        this.createDebugPanel();
        
        this.showNotification('Connect your wallet to access polishing operations', 'info');
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
            border: 2px solid #ff9500;
            border-radius: 8px;
            padding: 15px;
            z-index: 9999;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(255, 149, 0, 0.3);
        `;

        debugPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong style="color: #ff9500;">🔍 Polishing Backend Debug</strong>
                <button id="toggle-debug" style="background: #ff9500; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; color: #000;">Collapse</button>
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
        
        content.innerHTML = `
            <div style="color: #0f0; margin-bottom: 10px;">
                ✅ Last Update: ${timestamp}
            </div>
            <div style="background: rgba(0, 0, 0, 0.5); padding: 10px; border-radius: 4px; overflow-x: auto; max-height: 300px; overflow-y: auto;">
                <strong style="color: #ff0;">Polishing Data:</strong>
                <pre style="margin: 5px 0 0 0; color: #ff9500; white-space: pre-wrap; word-wrap: break-word; font-size: 10px;">${JSON.stringify(data, null, 2)}</pre>
            </div>
        `;
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
            
            this.showNotification('❌ Failed to connect wallet: ' + error.message, 'error');
            this.updateDebugPanel({ error: error.message, timestamp: new Date().toISOString() });
        }
    }

    async loadPolishingData(actor) {
        try {
            console.log('[Polishing] ========================================');
            console.log('[Polishing] Loading polishing data for actor:', actor);
            
            this.showNotification('📊 Loading polishing data...', 'info');

            // Initialize player first
            await this.backendService.initPlayer(actor);
            
            // Get dashboard to retrieve player info
            const dashboard = await this.backendService.getDashboard(actor);

            if (dashboard && dashboard.player) {
                console.log('[Polishing] Player data loaded:', dashboard.player);
                
                // Update header
                const headerGameDollars = document.getElementById('header-game-dollars');
                if (headerGameDollars) {
                    const currency = dashboard.player.ingameCurrency || 0;
                    headerGameDollars.textContent = `Game $: ${currency.toLocaleString()}`;
                }
            }
            
            // Fetch active polishing jobs
            await this.fetchActivePolishingJobs(actor);
            
            // Fetch inventory to get Polishing Table NFTs and Gems
            await this.fetchInventoryData(actor);
            
            // Fetch gem inventory from backend
            await this.fetchGemInventory(actor);
                
            // Update debug panel
            this.updateDebugPanel({
                actor: actor,
                dashboard: dashboard,
                activeJobs: this.activeJobs,
                effectiveSlots: this.effectiveSlots,
                polishingTableNFTs: this.polishingTableNFTs,
                roughGemsCount: this.roughGemsCount,
                polishedGems: this.polishedGems,
                timestamp: new Date().toISOString()
            });
                
            // Render UI
            this.renderPolishingSlots();
            this.updatePolishingStats();
            
            // Start auto-refresh
            this.startAutoRefresh();
            
            // Start timer updates
            this.startTimerUpdates();
            
            this.showNotification('✅ Polishing data loaded!', 'success');
            console.log('[Polishing] ✅ Polishing data loaded successfully');
            console.log('[Polishing] ========================================');
            
        } catch (error) {
            console.error('[Polishing] Failed to load polishing data:', error);
            this.showNotification('❌ Failed to load polishing data: ' + error.message, 'error');
            this.updateDebugPanel({ 
                error: error.message, 
                stack: error.stack,
                timestamp: new Date().toISOString() 
            });
        }
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
            
            this.activeJobs = data.jobs || [];
            
            console.log('[Polishing] Active jobs:', this.activeJobs.length);
            console.log('[Polishing] Effective slots:', this.effectiveSlots);
            
        } catch (error) {
            console.error('[Polishing] Failed to fetch active jobs:', error);
            this.activeJobs = [];
        }
    }

    async fetchInventoryData(actor) {
        try {
            console.log('[Polishing] Fetching inventory data...');
            
            const inventoryData = await this.backendService.getInventory(actor, false);
            console.log('[Polishing] Inventory data received:', inventoryData);
            
            this.inventoryData = inventoryData;
            this.effectiveSlots = inventoryData.polishingSlots || 0;
            
            // Filter for Polishing Table NFTs from equipmentDetails
            if (inventoryData && inventoryData.equipmentDetails) {
                const equipmentArray = Object.entries(inventoryData.equipmentDetails).map(([templateId, details]) => ({
                    template_id: templateId,
                    name: details.name,
                    count: details.count,
                    image: details.image,
                    imagePath: details.imagePath
                }));
                
                this.polishingTableNFTs = equipmentArray.filter(nft => {
                    const name = (nft.name || '').toLowerCase();
                    return name.includes('polishing');
                });
                
                console.log('[Polishing] Polishing Table NFTs found:', this.polishingTableNFTs.length);
                console.log('[Polishing] Effective slots:', this.effectiveSlots);
            } else {
                this.polishingTableNFTs = [];
            }
            
        } catch (error) {
            console.error('[Polishing] Failed to fetch inventory:', error);
            this.inventoryData = null;
            this.polishingTableNFTs = [];
        }
    }

    async fetchGemInventory(actor) {
        try {
            console.log('[Polishing] Fetching gem inventory...');
            
            const inventoryData = await this.backendService.getInventory(actor, false);
            console.log('[Polishing] Full inventory data:', inventoryData);
            
            // Extract rough gem count (only one type)
            this.roughGemsCount = inventoryData[ROUGH_GEM_KEY] || 0;
            
            // Extract all 10 specific polished gem types
            this.polishedGems = {};
            POLISHED_GEM_TYPES.forEach(gemType => {
                this.polishedGems[gemType] = inventoryData[gemType] || 0;
            });
            
            console.log('[Polishing] ROUGH_GEM_KEY:', ROUGH_GEM_KEY);
            console.log('[Polishing] Rough gems count:', this.roughGemsCount);
            console.log('[Polishing] Polished gems:', this.polishedGems);
            
            if (this.roughGemsCount === 0) {
                console.warn('[Polishing] No rough gems found! Button will be disabled.');
            }
            
        } catch (error) {
            console.error('[Polishing] Failed to fetch gem inventory:', error);
            this.roughGemsCount = 0;
            this.polishedGems = {};
        }
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
                        <div style="margin-top: 15px; padding: 15px; background: rgba(255, 149, 0, 0.1); border: 1px solid rgba(255, 149, 0, 0.3); border-radius: 8px;">
                            <p style="color: #ff9500; font-size: 0.9em; margin: 0;">
                                <i class="fas fa-info-circle"></i> Unlock by owning Polishing Table NFTs
                            </p>
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
        
        if (roughEl) roughEl.textContent = this.roughGemsCount.toLocaleString();
        if (polishedEl) polishedEl.textContent = totalPolished.toLocaleString();
        if (tablesEl) tablesEl.textContent = this.polishingTableNFTs.length;
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
                for (let i = 0; i < (nft.count || 1); i++) {
                    individualTableNFTs.push({
                        ...nft,
                        uniqueId: `${nft.template_id}-${i}`
                    });
                }
            });
            
            galleryContent = `
                <p style="margin-bottom: 15px; color: #888;">
                    Select a Polishing Table NFT to stake in this slot.
                </p>
                <div class="nft-gallery-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; max-height: 500px; overflow-y: auto; padding: 10px;">
                    ${individualTableNFTs.map(nft => `
                        <div class="nft-card" style="border: 2px solid #ff9500; border-radius: 8px; padding: 10px; background: rgba(0, 0, 0, 0.3); cursor: pointer; transition: all 0.3s;" onclick="game.stakeTable('${nft.template_id}', ${slotNum}, '${nft.name}', '${nft.imagePath || ''}')">
                            ${nft.imagePath ? `
                                <img src="${nft.imagePath}" alt="${nft.name}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;" onerror="this.style.display='none'">
                            ` : ''}
                            <h4 style="color: #ff9500; margin-bottom: 5px; font-size: 0.9em;">${nft.name}</h4>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        const modalContent = `
            <div class="nft-stake-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-table"></i> Stake Polishing Table to Slot ${slotNum}</h3>
                    <button class="modal-close" onclick="game.closeStakeModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${galleryContent}
                </div>
            </div>
        `;
        
        const modalOverlay = document.getElementById('modal-overlay');
        const modalBody = document.getElementById('modal-body');
        
        if (modalBody) {
            modalBody.innerHTML = modalContent;
        }
        
        if (modalOverlay) {
            modalOverlay.classList.add('active');
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
            modalOverlay.classList.add('active');
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
            }
            
            this.updateDebugPanel({
                action: 'startPolishing',
                result: data,
                finishAt: finishAt,
                remainingTime: remainingTime,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
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
            this.showNotification('📦 Collecting polished gems...', 'info');
            
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
            const amount = result.outAmount;
            const polishedType = result.polishedType;
            
            // Get gem name from type (e.g., "polished_diamond" -> "Diamond")
            const gemName = polishedType.replace('polished_', '').charAt(0).toUpperCase() + 
                           polishedType.replace('polished_', '').slice(1);
            
            this.showNotification(`💎 Claimed ${amount.toLocaleString()}x Polished ${gemName}!`, 'success');
            
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
            this.updatePolishingStats();
            
            this.updateDebugPanel({
                action: 'completePolishing',
                result: data,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('[Polishing] Failed to complete polishing:', error);
            this.showNotification('❌ Failed to claim rewards: ' + error.message, 'error');
        }
    }

    closeStakeModal() {
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.classList.remove('active');
        }
        this.selectedSlotForStaking = null;
    }

    stakeTable(templateId, slotNum, name, imagePath) {
        console.log('[Polishing] Staking table:', name, 'to slot:', slotNum);
        
        this.stakedTables[slotNum] = {
            template_id: templateId,
            name: name,
            imagePath: imagePath
        };
        
        this.showNotification(`✅ Staked ${name} to Slot ${slotNum}!`, 'success');
        this.closeStakeModal();
        this.renderPolishingSlots();
    }

    unstakeTable(slotNum) {
        console.log('[Polishing] Unstaking table from slot:', slotNum);
        
        if (this.stakedTables[slotNum]) {
            const table = this.stakedTables[slotNum];
            delete this.stakedTables[slotNum];
            
            this.showNotification(`✅ Unstaked ${table.name} from Slot ${slotNum}!`, 'success');
            this.renderPolishingSlots();
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
        if (logoutBtn) logoutBtn.classList.add('hidden');
        
        this.updateDebugPanel({
            status: 'disconnected',
            timestamp: new Date().toISOString()
        });
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
