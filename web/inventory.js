// TSDGEMS - NFT Inventory Page

class InventoryPage extends TSDGEMSGame {
    constructor() {
        super();
        this.inventoryData = null;
        this.allNFTs = [];
        this.filteredNFTs = [];
        this.currentActor = null;
        this.collections = new Set();
        this.schemas = new Set();
        this.stakedAssetIds = new Set(); // Track staked assets
        this.currentPage = 1;
        this.isLoggedIn = false;

        this.awaitingInitialRealtime = false;
        this.initialRealtimePromise = null;
        this.initialRealtimeResolver = null;
        this.initialRealtimeReject = null;
        this.realtimeData = this.getEmptyRealtimeState();
        this.initialRealtimeTimer = null;
        this.realtimeHandlersRegistered = false;

        this.handleWalletConnected = this.handleWalletConnected.bind(this);
        this.handleWalletSessionRestored = this.handleWalletSessionRestored.bind(this);
        this.handleWalletDisconnected = this.handleWalletDisconnected.bind(this);

        // Mobile optimization: fewer items per page to reduce memory usage
        this.isMobile = this.detectMobile();
        this.itemsPerPage = this.isMobile ? 12 : 20;

        // Mobile optimization: clear cache when page becomes hidden
        if (this.isMobile) {
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    console.log('[Inventory] 📱 Mobile page hidden, clearing inventory cache');
                    this.clearInventoryCache();
                }
            });
        }

        this.setupRealtimeEventHandlers();
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

    clearInventoryCache() {
        // Clear inventory data to free memory on mobile
        this.inventoryData = null;
        this.allNFTs = [];
        this.filteredNFTs = [];

        // Clear DataManager cache for inventory if available
        if (window.dataManager) {
            window.dataManager.invalidate('inventory');
        }

        console.log('[Inventory] 📱 Inventory cache cleared');
    }

    init() {
        this.setupEventListeners();

        // Delayed wallet check to ensure wallet.js is fully initialized
        setTimeout(() => {
            this.checkWalletAndLoadInventory();
        }, 200);

        this.prepareInventoryForRealtime();
        this.showNotification('Inventory system ready', 'info');
        console.log('[Inventory] Init complete, starting backendService.getInventory()...');
    }

    getEmptyRealtimeState() {
        return {
            live: null,
            summary: null,
            gems: null,
            speedboost: null,
            miningSlots: [],
            polishingSlots: [],
            assets: [],
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
            console.log('[InventoryRealtime] live aggregate received, hasSummary:', !!live?.inventorySummary, 'hasGems:', !!live?.gems, 'hasAssets:', !!live?.inventoryAssets);
            this.mergeLiveInventoryData(live);
            this.renderRealtimeInventory();
        };

        this.onRealtimeInventorySummary = (event) => {
            const { actor, summary } = event.detail || {};
            if (!this.isEventForCurrentActor(actor)) {
                return;
            }
            console.log('[InventoryRealtime] inventory-summary update, total:', summary?.total || summary?.totalNFTs || 0);
            this.realtimeData.summary = summary || null;
            this.renderRealtimeInventory();
        };

        this.onRealtimeInventoryGems = (event) => {
            const { actor, gems } = event.detail || {};
            if (!this.isEventForCurrentActor(actor)) {
                return;
            }
            console.log('[InventoryRealtime] inventory-gems update, gem types:', Object.keys(gems || {}).length);
            this.realtimeData.gems = gems || {};
            this.renderRealtimeInventory();
        };

        this.onRealtimeInventorySpeedboost = (event) => {
            const { actor, speedboost } = event.detail || {};
            if (!this.isEventForCurrentActor(actor)) {
                return;
            }
            this.realtimeData.speedboost = speedboost || null;
        };

        this.onRealtimeMiningSlots = (event) => {
            const { actor, slots } = event.detail || {};
            if (!this.isEventForCurrentActor(actor)) {
                return;
            }
            this.realtimeData.miningSlots = Array.isArray(slots) ? slots : [];
            this.rebuildStakedAssetIds();
            if (this.inventoryData) {
                this.renderNFTs();
            }
        };

        this.onRealtimePolishingSlots = (event) => {
            const { actor, slots } = event.detail || {};
            if (!this.isEventForCurrentActor(actor)) {
                return;
            }
            this.realtimeData.polishingSlots = Array.isArray(slots) ? slots : [];
            this.rebuildStakedAssetIds();
            if (this.inventoryData) {
                this.renderNFTs();
            }
        };

        window.addEventListener('realtime:live', this.onRealtimeLive);
        window.addEventListener('realtime:inventory-summary', this.onRealtimeInventorySummary);
        window.addEventListener('realtime:inventory-gems', this.onRealtimeInventoryGems);
        window.addEventListener('realtime:inventory-speedboost', this.onRealtimeInventorySpeedboost);
        window.addEventListener('realtime:mining-slots', this.onRealtimeMiningSlots);
        window.addEventListener('realtime:polishing-slots', this.onRealtimePolishingSlots);
    }

    prepareInventoryForRealtime() {
        this.clearInitialRealtimeTimer();

        const statPlaceholders = {
            'total-nfts': '--',
            'polished-gems': '--',
            'rough-gems': '--',
            'equipment-count': '--',
            'unique-templates': '--'
        };

        Object.entries(statPlaceholders).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });

        this.showLoadingState();
    }

    clearInitialRealtimeTimer() {
        if (this.initialRealtimeTimer) {
            clearTimeout(this.initialRealtimeTimer);
            this.initialRealtimeTimer = null;
        }
    }

    handleRealtimeStartFailure(error) {
        console.error('[Inventory] Failed to start realtime inventory stream:', error);
        this.clearInitialRealtimeTimer();
        this.awaitingInitialRealtime = false;
        this.rejectInitialRealtime(error);
        this.showEmptyState('error');
        this.showNotification('Failed to start realtime inventory: ' + error.message, 'error');
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
        this.stakedAssetIds = new Set();
        this.inventoryData = null;
        this.allNFTs = [];
        this.filteredNFTs = [];
    }

    isEventForCurrentActor(actor) {
        return Boolean(this.currentActor) && actor === this.currentActor;
    }

    startRealtimeForActor(actor) {
        if (!actor) {
            console.warn('[Inventory] No actor provided, skipping realtime start');
            return Promise.resolve();
        }

        if (this.awaitingInitialRealtime && this.currentActor === actor && this.initialRealtimePromise) {
            console.log('[Inventory] Realtime stream already active - waiting for next update');
            return this.initialRealtimePromise;
        }

        if (!this.awaitingInitialRealtime && this.inventoryData) {
            console.log('[Inventory] Realtime inventory already synced - skipping restart');
            return Promise.resolve();
        }

        this.cleanupRealtimeSession();
        this.prepareInventoryForRealtime();

        this.realtimeData = this.getEmptyRealtimeState();
        this.awaitingInitialRealtime = true;

        this.resetInitialRealtimePromise();
        this.initialRealtimePromise = new Promise((resolve, reject) => {
            this.initialRealtimeResolver = resolve;
            this.initialRealtimeReject = reject;
        });

        // Wait for TSDRealtime to be available (with timeout)
        const waitForTSDRealtime = () => {
            return new Promise((resolve, reject) => {
                const start = Date.now();
                const timeout = 5000; // 5 second timeout
                
                const check = () => {
                    if (window.TSDRealtime && typeof window.TSDRealtime.start === 'function') {
                        resolve();
                        return;
                    }
                    
                    if (Date.now() - start > timeout) {
                        reject(new Error('TSDRealtime not available after 5 seconds. Check console for [Realtime] logs.'));
                        return;
                    }
                    
                    setTimeout(check, 100);
                };
                
                check();
            });
        };

        waitForTSDRealtime()
            .then(() => {
                try {
                    window.TSDRealtime.start(actor);
                } catch (error) {
                    this.handleRealtimeStartFailure(error);
                    throw error;
                }
            })
            .catch((error) => {
                this.handleRealtimeStartFailure(error);
                throw error;
            });

        this.initialRealtimeTimer = setTimeout(() => {
            if (this.awaitingInitialRealtime) {
                this.showNotification('Waiting for realtime inventory data...', 'info');
            }
        }, 4000);

        return this.initialRealtimePromise;
    }

    mergeLiveInventoryData(live) {
        if (!live || typeof live !== 'object') {
            return;
        }

        this.realtimeData.live = live;

        if (live.inventorySummary !== undefined) {
            this.realtimeData.summary = live.inventorySummary;
        }
        if (live.gems !== undefined) {
            this.realtimeData.gems = live.gems;
        }

        if (Array.isArray(live.inventoryAssets)) {
            this.realtimeData.assets = live.inventoryAssets;
        } else if (live.inventory && Array.isArray(live.inventory.assets)) {
            this.realtimeData.assets = live.inventory.assets;
        } else if (Array.isArray(live.assets)) {
            this.realtimeData.assets = live.assets;
        }

        if (Array.isArray(live.miningSlots)) {
            this.realtimeData.miningSlots = live.miningSlots;
        }
        if (Array.isArray(live.polishingSlots)) {
            this.realtimeData.polishingSlots = live.polishingSlots;
        }

        this.rebuildStakedAssetIds();
    }

    // Realtime: Only update stats, not reload NFT list (NFT list comes from backend)
    renderRealtimeInventory() {
        const hasSummary = !!(this.realtimeData.summary && Object.keys(this.realtimeData.summary).length);
        const hasGems = !!(this.realtimeData.gems && Object.keys(this.realtimeData.gems).length);

        if (this.awaitingInitialRealtime && (hasSummary || hasGems)) {
            this.awaitingInitialRealtime = false;
            this.clearInitialRealtimeTimer();
            this.resolveInitialRealtime();
            console.log('[InventoryRealtime] Initial realtime data received, clearing loading state');
        }

        // Realtime: Only update stats from realtime data, don't rebuild NFT list
        // NFT list should be loaded once from backend, not from realtime
        if (this.inventoryData) {
            // Update stats from realtime summary/gems
            const summary = this.realtimeData.summary || {};
            if (summary.polished !== undefined) this.inventoryData.polished = summary.polished;
            if (summary.rough !== undefined) this.inventoryData.rough = summary.rough;
            if (summary.equipment !== undefined) this.inventoryData.equipment = summary.equipment;
            if (summary.total !== undefined) this.inventoryData.total = summary.total;
            
            // Update gems from realtime
            if (this.realtimeData.gems) {
                this.inventoryData.gems = this.realtimeData.gems;
            }
        }

        // Rebuild staked asset IDs (for showing staked badges)
        this.rebuildStakedAssetIds();
        
        // Update stats display only
        this.updateStats();
        
        // Re-render NFTs only if staked status changed (to update badges)
        if (this.allNFTs.length > 0) {
            this.renderNFTs();
        }
    }

    buildInventoryDataFromRealtime(assets = this.getRealtimeAssets()) {
        const summary = this.realtimeData.summary || {};
        const templateCounts = summary.templateCounts || summary.templates || null;
        const totalFromSummary = summary.total ?? summary.totalNFTs ?? summary.inventoryTotal;

        const data = {
            ...summary,
            total: Number.isFinite(totalFromSummary) ? totalFromSummary : assets.length,
            polished: summary.polished ?? summary.polishedTotal ?? summary.totalPolished ?? 0,
            rough: summary.rough ?? summary.roughTotal ?? summary.totalRough ?? 0,
            equipment: summary.equipment ?? summary.equipmentCount ?? 0,
            uniqueTemplates: summary.uniqueTemplates ?? summary.unique ?? (templateCounts ? Object.keys(templateCounts).length : 0),
            assets,
            templateCounts,
            gems: this.realtimeData.gems || {},
            collection: summary.collection || 'tsdmediagems'
        };

        return data;
    }

    getRealtimeAssets() {
        const normalizeAssets = (value) => {
            if (!value) {
                return null;
            }
            if (Array.isArray(value)) {
                return value;
            }
            if (typeof value === 'object') {
                return Object.values(value);
            }
            return null;
        };

        let assets = normalizeAssets(this.realtimeData.assets);
        if (assets) {
            return assets;
        }

        const summary = this.realtimeData.summary;
        if (summary) {
            assets = normalizeAssets(summary.assets);
            if (assets) {
                return assets;
            }
            assets = normalizeAssets(summary.inventoryAssets);
            if (assets) {
                return assets;
            }
            assets = normalizeAssets(summary.items);
            if (assets) {
                return assets;
            }
        }

        const live = this.realtimeData.live;
        if (live) {
            assets = normalizeAssets(live.inventoryAssets);
            if (assets) {
                return assets;
            }
            assets = normalizeAssets(live.assets);
            if (assets) {
                return assets;
            }
            if (live.inventory) {
                assets = normalizeAssets(live.inventory.assets);
                if (assets) {
                    return assets;
                }
            }
        }

        return [];
    }

    rebuildStakedAssetIds() {
        const staked = new Set();
        const register = (assetId) => {
            if (assetId) {
                staked.add(String(assetId));
            }
        };

        const miningSlots = Array.isArray(this.realtimeData.miningSlots) ? this.realtimeData.miningSlots : [];
        miningSlots.forEach((slot) => {
            register(slot?.mine?.asset_id);

            if (Array.isArray(slot?.staked)) {
                slot.staked.forEach(item => register(item?.asset_id));
            }
            if (Array.isArray(slot?.workers)) {
                slot.workers.forEach(worker => register(worker?.asset_id));
            }
            if (Array.isArray(slot?.speedboost)) {
                slot.speedboost.forEach(boost => register(boost?.asset_id));
            }
        });

        const polishingSlots = Array.isArray(this.realtimeData.polishingSlots) ? this.realtimeData.polishingSlots : [];
        polishingSlots.forEach((slot) => {
            register(slot?.table?.asset_id);
            if (Array.isArray(slot?.gems)) {
                slot.gems.forEach(gem => register(gem?.asset_id));
            }
        });

        this.stakedAssetIds = staked;
    }

    async handleWalletConnected(event) {
        const actor = event?.detail?.actor;
        if (!actor) {
            console.warn('[Inventory] wallet-connected event received without actor');
            return;
        }

        await this.onActorAvailable(actor, {
            loadingMessage: `Loading inventory for ${actor}...`,
            successMessage: 'Inventory synced from realtime feed!'
        });
    }

    async handleWalletSessionRestored(event) {
        const actor = event?.detail?.actor;
        if (!actor) {
            return;
        }

        await this.onActorAvailable(actor, {
            loadingMessage: `Restoring inventory for ${actor}...`,
            successMessage: 'Inventory synced from realtime feed!'
        });
    }

    handleWalletDisconnected() {
        console.log('[Inventory] Wallet disconnected event received');

        if (window.TSDRealtime && typeof window.TSDRealtime.stop === 'function') {
            window.TSDRealtime.stop();
        }

        this.currentActor = null;
        this.isLoggedIn = false;
        this.cleanupRealtimeSession();

        this.allNFTs = [];
        this.filteredNFTs = [];
        this.resetInventoryStats();
        this.showEmptyState('no-wallet');
        this.showNotification('Wallet disconnected', 'info');
    }

    resetInventoryStats() {
        const defaults = {
            'total-nfts': '0',
            'polished-gems': '0',
            'rough-gems': '0',
            'equipment-count': '0',
            'unique-templates': '0'
        };

        Object.entries(defaults).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    async onActorAvailable(actor, { loadingMessage, successMessage } = {}) {
        this.currentActor = actor;
        this.isLoggedIn = true;

        if (loadingMessage) {
            this.showNotification(loadingMessage, 'info');
        }

        try {
            await this.loadInventory(false);
            if (successMessage) {
                this.showNotification(successMessage, 'success');
            }
        } catch (error) {
            console.error('[Inventory] Failed to initialize realtime inventory:', error);
        }
    }

    async checkWalletAndLoadInventory() {
        console.log('[Inventory] Setting up wallet event listeners...');
        
        window.addEventListener('wallet-connected', this.handleWalletConnected);
        window.addEventListener('wallet-session-restored', this.handleWalletSessionRestored);
        window.addEventListener('wallet-disconnected', this.handleWalletDisconnected);

        console.log('[Inventory] Checking walletSessionInfo:', window.walletSessionInfo);
        
        if (window.walletSessionInfo && window.walletSessionInfo.actor) {
            const actor = window.walletSessionInfo.actor;
            console.log('[Inventory] Using existing wallet session:', actor);
            await this.handleWalletSessionRestored({ detail: { actor } });
        } else {
            console.log('[Inventory] No wallet session found yet, waiting for connection...');
            this.showEmptyState('no-wallet');
        }
    }

    async loadInventory(forceRefresh = false) {
        // Realtime: NFT list comes from backend, stats come from realtime
        console.log('[Inventory] loadInventory called - loading NFT list from backend for actor:', this.currentActor);
        
        if (!this.currentActor) {
            console.log('[Inventory] No actor connected, skipping inventory load');
            this.showNotification('Connect your wallet to view inventory', 'info');
            this.showEmptyState('no-wallet');
            return;
        }

        // Guard: Ensure backendService is available
        const backendService = this.backendService || window.backendService;
        if (!backendService || typeof backendService.getInventory !== 'function') {
            console.error('[Inventory] backendService.getInventory is not available', backendService);
            this.showNotification('Inventory service not available. Please refresh the page.', 'error');
            this.showEmptyState('error');
            return;
        }

        // Start realtime for stats updates
        this.startRealtimeForActor(this.currentActor);

        // Load NFT list from backend (only once, not from realtime)
        try {
            console.log('[Inventory] Loading NFT list from backend...');
            const inventoryData = await backendService.getInventory(this.currentActor, forceRefresh);
            
            // Realtime: Clear loading spinner on success or error
            if (inventoryData && inventoryData.assets) {
                this.inventoryData = inventoryData;
                this.processInventoryData();
                this.updateStats();
                this.renderNFTs(); // This replaces content, clearing spinner
                console.log('[InventoryRealtime] NFT list loaded from backend, count:', this.allNFTs.length);
            } else {
                console.warn('[Inventory] No assets in backend response');
                this.showEmptyState('no-results'); // This replaces content, clearing spinner
            }
        } catch (error) {
            console.error('[Inventory] Failed to load NFT list from backend:', error);
            this.showNotification('Failed to load inventory: ' + error.message, 'error');
            this.showEmptyState('error'); // This replaces content, clearing spinner
        }
    }

    processInventoryData() {
        console.log('[Inventory] processInventoryData called');
        console.log('[Inventory] inventoryData:', this.inventoryData);
        
        // NEW: Use assets array if available (contains real asset IDs)
        if (this.inventoryData && this.inventoryData.assets && this.inventoryData.assets.length > 0) {
            console.log('[Inventory] Using assets array with real asset IDs:', this.inventoryData.assets.length, 'assets');
            
            this.allNFTs = [];
            this.collections.clear();
            this.schemas.clear();
            
            this.inventoryData.assets.forEach(asset => {
                // Build the image path
                let finalImagePath = null;
                if (asset.imagePath) {
                    finalImagePath = asset.imagePath;
                } else if (asset.image) {
                    finalImagePath = `assets/gallery_images/${asset.image}`;
                }
                
                console.log(`[Inventory] Processing asset ${asset.asset_id} (${asset.name}): template=${asset.template_id}, schema="${asset.schema}", mint=${asset.template_mint}`);
                
                this.allNFTs.push({
                    asset_id: asset.asset_id,
                    template_id: asset.template_id,
                    template_mint: asset.template_mint,
                    collection: this.inventoryData.collection || 'tsdmediagems',
                    name: asset.name,
                    image: finalImagePath,
                    schema: asset.schema,
                    mining_power: asset.mp || 0,
                    category: asset.category,
                    boost: asset.boost || 0
                });
                
                this.collections.add(this.inventoryData.collection || 'tsdmediagems');
                if (asset.schema) {
                    this.schemas.add(asset.schema);
                }
            });
            
            console.log('[Inventory] Total NFTs created:', this.allNFTs.length);
            
            // Realtime: Stable sort for NFTs to prevent shuffling
            // Sort by template_id first (numeric), then asset_id (numeric) for consistent ordering
            this.allNFTs.sort((a, b) => {
                const templateA = Number(a.template_id) || 0;
                const templateB = Number(b.template_id) || 0;
                if (templateA !== templateB) {
                    return templateA - templateB;
                }
                const assetA = Number(a.asset_id) || 0;
                const assetB = Number(b.asset_id) || 0;
                return assetA - assetB;
            });
            
            this.filteredNFTs = [...this.allNFTs];
            console.log('[InventoryRealtime] NFT list sorted and ready, count:', this.allNFTs.length);
        }
        // FALLBACK: Use old templateCounts method if assets array not available
        else if (this.inventoryData && this.inventoryData.templateCounts) {
            console.log('[Inventory] Falling back to templateCounts (no assets array):', Object.keys(this.inventoryData.templateCounts).length, 'templates');
            
            this.allNFTs = [];
            this.collections.clear();
            this.schemas.clear();
            
            Object.entries(this.inventoryData.templateCounts).forEach(([key, templateData]) => {
                const templateId = templateData.template_id;
                const count = templateData.count;
                const name = templateData.name;
                const image = templateData.image;
                const imagePath = templateData.imagePath;
                const schema = templateData.schema;
                const totalMiningPower = templateData.total_mining_power || 0;
                const mp = templateData.mp || 0;

                console.log(`[Inventory] Processing template ${templateId} (${name}): count=${count}, image="${image}", schema="${schema}"`);

                for (let i = 0; i < count; i++) {
                    // Use imagePath if available, otherwise build fallback path
                    let finalImagePath = null;
                    if (imagePath) {
                        // Always use the correct path for gallery_images
                        finalImagePath = imagePath;
                    } else if (image) {
                        finalImagePath = `assets/gallery_images/${image}`;
                    }
                    
                    console.log(`[Inventory] Template ${templateId} [${i}]: finalImagePath="${finalImagePath}"`);

                    this.allNFTs.push({
                        template_id: templateId,
                        template_mint: 'unknown', // Fallback for template-based data
                        asset_id: `${templateId}-${i}`, // Fallback pseudo-ID
                        collection: this.inventoryData.collection || 'tsdmediagems',
                        name: name,
                        image: finalImagePath,
                        schema: schema,
                        mining_power: mp,
                        total_mining_power: totalMiningPower,
                        data: templateData
                    });
                }
                this.collections.add(this.inventoryData.collection || 'tsdmediagems');
                if (schema) {
                    this.schemas.add(schema);
                }
            });

            console.log('[Inventory] Total NFTs created:', this.allNFTs.length);
            
            // Realtime: Stable sort for NFTs to prevent shuffling
            // Sort by template_id first (numeric), then asset_id (numeric) for consistent ordering
            this.allNFTs.sort((a, b) => {
                const templateA = Number(a.template_id) || 0;
                const templateB = Number(b.template_id) || 0;
                if (templateA !== templateB) {
                    return templateA - templateB;
                }
                const assetA = Number(a.asset_id) || 0;
                const assetB = Number(b.asset_id) || 0;
                return assetA - assetB;
            });
            
            this.filteredNFTs = [...this.allNFTs];
            console.log('[InventoryRealtime] NFT list sorted and ready, count:', this.allNFTs.length);
        }
        else {
            console.log('[Inventory] No inventory data available');
            this.allNFTs = [];
            this.filteredNFTs = [];
            return;
        }
        
        // Populate schema filter
        const schemaFilter = document.getElementById('schema-filter');
        if (schemaFilter) {
            schemaFilter.innerHTML = '<option value="">All Schemas</option>';
            this.schemas.forEach(schema => {
                const option = document.createElement('option');
                option.value = schema;
                option.textContent = schema.charAt(0).toUpperCase() + schema.slice(1);
                schemaFilter.appendChild(option);
            });
        }
    }

    getTemplateName(templateId) {
        // Map template IDs to names
        const templateNames = {
            894387: 'Polished Diamond',
            894388: 'Polished Ruby',
            894389: 'Polished Sapphire',
            894390: 'Polished Emerald',
            894391: 'Polished Jade',
            894392: 'Polished Tanzanite',
            894393: 'Polished Opal',
            894394: 'Polished Aquamarine',
            894395: 'Polished Topaz',
            894396: 'Polished Amethyst',
            894397: 'Rough Diamond',
            894398: 'Rough Ruby',
            894399: 'Rough Sapphire',
            894400: 'Rough Emerald',
            894401: 'Rough Jade',
            894402: 'Rough Tanzanite',
            894403: 'Rough Opal',
            894404: 'Rough Aquamarine',
            894405: 'Rough Topaz',
            894406: 'Rough Amethyst',
        };
        return templateNames[templateId] || `Template #${templateId}`;
    }

    updateStats() {
        const totalNFTs = document.getElementById('total-nfts');
        const polishedGems = document.getElementById('polished-gems');
        const roughGems = document.getElementById('rough-gems');
        const equipmentCount = document.getElementById('equipment-count');
        const uniqueTemplates = document.getElementById('unique-templates');

        if (totalNFTs) totalNFTs.textContent = this.inventoryData?.total || this.allNFTs.length;
        if (polishedGems) polishedGems.textContent = this.inventoryData?.polished || 0;
        if (roughGems) roughGems.textContent = this.inventoryData?.rough || 0;
        if (equipmentCount) equipmentCount.textContent = this.inventoryData?.equipment || 0;
        if (uniqueTemplates) uniqueTemplates.textContent = this.inventoryData?.uniqueTemplates || Object.keys(this.inventoryData?.templateCounts || {}).length;
    }

    renderNFTs() {
        const content = document.getElementById('inventory-content');
        if (!content) return;

        if (this.filteredNFTs.length === 0) {
            this.showEmptyState('no-results');
            // Hide pagination when no results
            document.getElementById('pagination-controls').style.display = 'none';
            return;
        }

        // Calculate pagination
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageNFTs = this.filteredNFTs.slice(startIndex, endIndex);
        const maxPages = Math.ceil(this.filteredNFTs.length / this.itemsPerPage);

        // Update pagination info
        const pageInfo = document.getElementById('page-info');
        if (pageInfo) {
            pageInfo.textContent = `Page ${this.currentPage} of ${maxPages}`;
        }

        // Update pagination button states
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');
        
        if (prevBtn) {
            prevBtn.disabled = this.currentPage === 1;
            prevBtn.style.opacity = this.currentPage === 1 ? '0.5' : '1';
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.currentPage === maxPages;
            nextBtn.style.opacity = this.currentPage === maxPages ? '0.5' : '1';
        }

        // Show pagination controls
        const paginationControls = document.getElementById('pagination-controls');
        if (paginationControls && maxPages > 1) {
            paginationControls.style.display = 'flex';
        } else if (paginationControls) {
            paginationControls.style.display = 'none';
        }

        const grid = document.createElement('div');
        grid.className = 'inventory-grid';

        pageNFTs.forEach(nft => {
            const card = this.createNFTCard(nft);
            grid.appendChild(card);
        });

        content.innerHTML = '';
        content.appendChild(grid);
    }

    createNFTCard(nft) {
        const card = document.createElement('div');
        card.className = 'nft-card';
        
        // Check if this asset is staked
        const isStaked = this.stakedAssetIds.has(nft.asset_id);
        
        // Get schema icon
        const schemaIcon = this.getSchemaIcon(nft.schema);
        
        // Get schema color
        const schemaColor = this.getSchemaColor(nft.schema);
        
        // Mining Power display for equipment
        let specialAttributes = '';
        if ((nft.schema === 'equipment' || nft.schema === 'tools') && nft.mining_power > 0) {
            specialAttributes += `
                <div class="nft-attribute">
                    <span class="nft-attribute-key">Mining Power:</span> ${nft.mining_power} MP
                </div>`;
        }
        if (nft.schema === 'speedboost' && typeof nft.boost === 'number') {
            specialAttributes += `
                <div class="nft-attribute">
                    <span class="nft-attribute-key">Speed Boost:</span> ${(nft.boost * 100).toFixed(2)}%
                </div>`;
        }
        
        // Create image element with fallback logic
        let imageElement = '';
        if (nft.image) {
            console.log(`[Inventory] Creating image element for ${nft.name} with path: ${nft.image}`);
            imageElement = `
                <img src="${nft.image}" alt="${nft.name}" class="nft-image" 
                     style="width: 100%; height: 100%; object-fit: contain;"
                     onload="console.log('âœ… Image loaded:', this.src);"
                     onerror="console.log('âŒ Image failed:', this.src); this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="nft-image-fallback" style="display: none; align-items: center; justify-content: center; height: 100%; color: #555;">
                    <i class="fas ${schemaIcon}" style="font-size: 3rem;"></i>
                </div>
            `;
        } else {
            imageElement = `<i class="fas ${schemaIcon} nft-placeholder"></i>`;
        }
        
        // Mint badge for all NFTs (not just workers)
        const mintBadge = nft.template_mint && nft.template_mint !== 'unknown' ?
            `<div class="mint-badge">#${nft.template_mint}</div>` : '';

        card.innerHTML = `
            <div class="nft-card-header">
                <span class="nft-template-id">Template #${nft.template_id}</span>
                ${isStaked ? '<span class="staked-badge" style="background: linear-gradient(135deg, #ff9500, #ff6b00); color: #fff; padding: 3px 8px; border-radius: 4px; font-size: 0.75em; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;"><i class="fas fa-lock" style="font-size: 0.85em;"></i>Staked</span>' : '<span class="nft-asset-id">' + nft.asset_id + '</span>'}
            </div>
            <div class="nft-image-container">
                ${imageElement}
                ${mintBadge}
            </div>
            <div class="nft-name">${nft.name}</div>
            <div class="nft-collection" style="color: ${schemaColor};">
                <i class="fas ${schemaIcon}"></i> ${nft.schema || 'unknown'}
            </div>
            <div class="nft-attributes">
                ${specialAttributes}
                <div class="nft-attribute">
                    <span class="nft-attribute-key">Collection:</span> ${nft.collection}
                </div>
            </div>
        `;

        return card;
    }

    getSchemaIcon(schema) {
        switch (schema) {
            case 'gems': return 'fa-gem';
            case 'equipment': return 'fa-industry';
            case 'tools': return 'fa-tools';
            case 'shards': return 'fa-shapes';
            case 'speedboost': return 'fa-bolt';
            default: return 'fa-box';
        }
    }

    getSchemaColor(schema) {
        switch (schema) {
            case 'gems': return '#00ff64';
            case 'equipment': return '#00d4ff';
            case 'tools': return '#ff9500';
            case 'shards': return '#ff6b6b';
            case 'speedboost': return '#ffa500';
            default: return '#aaa';
        }
    }

    showLoadingState() {
        const content = document.getElementById('inventory-content');
        if (!content) return;

        content.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p style="margin-top: 20px; color: #aaa;">Loading your NFTs...</p>
            </div>
        `;
    }

    showEmptyState(type) {
        const content = document.getElementById('inventory-content');
        if (!content) return;

        let icon, title, message;
        
        switch (type) {
            case 'no-wallet':
                icon = 'fa-wallet';
                title = 'No Wallet Connected';
                message = 'Connect your WAX wallet to view your NFT inventory';
                break;
            case 'no-results':
                icon = 'fa-search';
                title = 'No NFTs Found';
                message = 'Try adjusting your filters or refresh your inventory';
                break;
            case 'error':
                icon = 'fa-exclamation-triangle';
                title = 'Error Loading Inventory';
                message = 'Please try refreshing or check your connection';
                break;
            default:
                icon = 'fa-box-open';
                title = 'No NFTs';
                message = 'Your inventory is empty';
        }

        content.innerHTML = `
            <div class="empty-state">
                <i class="fas ${icon}"></i>
                <h3>${title}</h3>
                <p>${message}</p>
            </div>
        `;
    }

    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.filterNFTs();
            });
        }

        // Schema filter
        const schemaFilter = document.getElementById('schema-filter');
        if (schemaFilter) {
            schemaFilter.addEventListener('change', () => {
                this.currentPage = 1; // Reset to page 1 on filter change
                this.filterNFTs();
            });
        }
        
        // Pagination controls
        const prevBtn = document.getElementById('prev-page-btn');
        const nextBtn = document.getElementById('next-page-btn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.renderNFTs();
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const maxPages = Math.ceil(this.filteredNFTs.length / this.itemsPerPage);
                if (this.currentPage < maxPages) {
                    this.currentPage++;
                    this.renderNFTs();
                }
            });
        }
    }

    filterNFTs() {
        const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
        const schema = document.getElementById('schema-filter')?.value || '';

        this.filteredNFTs = this.allNFTs.filter(nft => {
            const matchesSearch = !searchTerm ||
                nft.name.toLowerCase().includes(searchTerm) ||
                nft.template_id.toString().includes(searchTerm) ||
                (nft.template_mint && nft.template_mint.toString().includes(searchTerm)) ||
                (nft.asset_id && nft.asset_id.toString().includes(searchTerm));
            
            const matchesSchema = !schema || nft.schema === schema;

            return matchesSearch && matchesSchema;
        });

        this.currentPage = 1; // Reset to page 1 after filtering
        this.renderNFTs();
    }
}

// Initialize inventory page when DOM loads
let inventoryPage;
document.addEventListener('DOMContentLoaded', () => {
    inventoryPage = new InventoryPage();
    window.tsdgemsInventory = inventoryPage;
    window.tsdgemsGame = inventoryPage;  // Also set as tsdgemsGame for global Game $ updates
});

