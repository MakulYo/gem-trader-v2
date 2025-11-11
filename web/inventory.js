// TSDGEMS - NFT Inventory Page

class InventoryPage extends TSDGEMSGame {
    constructor() {
        super();
        this.backendService = window.backendService;
        this.inventoryData = null;
        this.allNFTs = [];
        this.filteredNFTs = [];
        this.currentActor = null;
        this.collections = new Set();
        this.schemas = new Set();
        this.stakedAssetIds = new Set(); // Track staked assets
        this.currentPage = 1;

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

    init() {this.setupEventListeners();

        // Delayed wallet check to ensure wallet.js is fully initialized
        setTimeout(() => {
            this.checkWalletAndLoadInventory();
        }, 200);

        this.showNotification('Inventory system ready', 'info');
    }

    async checkWalletAndLoadInventory() {
        console.log('[Inventory] Setting up wallet event listeners...');
        
        // Listen for new wallet connection
        window.addEventListener('wallet-connected', async (e) => {
            console.log('[Inventory] [OK] Wallet connected event received:', e.detail);
            this.currentActor = e.detail.actor;
            await this.loadInventory(false);
        });

        // Listen for restored session
        window.addEventListener('wallet-session-restored', async (e) => {
            console.log('[Inventory] [OK] Wallet session restored event received:', e.detail);
            this.currentActor = e.detail.actor;
            await this.loadInventory(false);
        });

        // Check if wallet info is already available
        console.log('[Inventory] Checking walletSessionInfo:', window.walletSessionInfo);
        
        if (window.walletSessionInfo && window.walletSessionInfo.actor) {
            this.currentActor = window.walletSessionInfo.actor;
            console.log('[Inventory] [OK] Using existing wallet session:', this.currentActor);
            await this.loadInventory(false);
        } else {
            console.log('[Inventory] â³ No wallet session found yet, waiting for connection...');
            this.showEmptyState('no-wallet');
        }
    }

    async loadInventory(forceRefresh = false) {
        if (!this.currentActor) {
            console.log('[Inventory] No actor connected, skipping inventory load');
            this.showNotification('Connect your wallet to view inventory', 'info');this.showEmptyState('no-wallet');
            return;
        }

        try {
            console.log('[Inventory] Loading inventory for:', this.currentActor);
            this.showLoadingState();
            this.showNotification(forceRefresh ? 'Refreshing inventory from blockchain...' : 'Loading inventory...', 'info');
            
            // Load inventory and staked assets in parallel
            const [inventoryData, stakedAssets] = await Promise.all([
                this.backendService.getInventory(this.currentActor, forceRefresh),
                this.loadStakedAssetsForInventory(this.currentActor)
            ]);
            
            this.inventoryData = inventoryData;
            
            console.log('[Inventory] Inventory loaded:', this.inventoryData);
            console.log('[Inventory] Staked assets loaded:', this.stakedAssetIds.size, 'assets');
            
            // For demonstration, we'll show template-based data
            // In production, you'd want to fetch full NFT details
            this.processInventoryData();
            this.updateStats();
            this.renderNFTs();const cacheStatus = this.inventoryData.cached ? '(cached)' : '(live)';
            this.showNotification(`Inventory loaded ${cacheStatus}`, 'success');
        } catch (error) {
            console.error('[Inventory] Failed to load inventory:', error);
            this.showNotification('Failed to load inventory: ' + error.message, 'error');this.showEmptyState('error');
        }
    }

    async loadStakedAssetsForInventory(actor) {
        try {
            console.log('[Inventory] Loading staked assets for inventory display...');
            
            const stakingResponse = await this.backendService.getStakedAssets(actor);
            console.log('[Inventory] Staking data received:', stakingResponse);
            
            // Extract all staked asset IDs
            this.stakedAssetIds = new Set();
            
            if (stakingResponse && stakingResponse.stakingData) {
                const stakingData = stakingResponse.stakingData;
                
                // Check mining page
                if (stakingData.mining) {
                    Object.values(stakingData.mining).forEach(slotData => {
                        if (slotData.mine?.asset_id) {
                            this.stakedAssetIds.add(slotData.mine.asset_id);
                        }
                        if (slotData.workers) {
                            slotData.workers.forEach(w => {
                                if (w.asset_id) this.stakedAssetIds.add(w.asset_id);
                            });
                        }
                    });
                }
                
                // Check polishing page
                if (stakingData.polishing) {
                    Object.values(stakingData.polishing).forEach(slotData => {
                        if (slotData.table?.asset_id) {
                            this.stakedAssetIds.add(slotData.table.asset_id);
                        }
                    });
                }
            }
            
            console.log('[Inventory] Found', this.stakedAssetIds.size, 'staked assets');
            return this.stakedAssetIds;
            
        } catch (error) {
            console.error('[Inventory] Failed to load staked assets:', error);
            this.stakedAssetIds = new Set();
            return this.stakedAssetIds;
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
            this.filteredNFTs = [...this.allNFTs];
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
            this.filteredNFTs = [...this.allNFTs];
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
        // Refresh button
        const refreshBtn = document.getElementById('refresh-inventory-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                const icon = refreshBtn.querySelector('i');
                if (icon) icon.classList.add('fa-spin');
                
                await this.refreshInventory();
                
                if (icon) icon.classList.remove('fa-spin');
            });
        }

        // Search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
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

        // Realtime inventory update listeners
        window.addEventListener('inventory:updated', (event) => {
            console.log('[Inventory] 🔄 Realtime inventory update received:', event.detail);
            // Refresh inventory data from backend to get full updated inventory
            this.loadInventory(true); // Force refresh
        });
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

    async refreshInventory() {
        if (!this.currentActor) {
            this.showNotification('Connect your wallet first!', 'warning');
            return;
        }

        try {
            console.log('[Inventory] Refreshing inventory from blockchain...');
            this.showNotification('Fetching fresh data from blockchain...', 'info');
            
            this.inventoryData = await this.backendService.refreshInventory(this.currentActor);
            
            console.log('[Inventory] Inventory refreshed:', this.inventoryData);
            console.log('[Inventory] polishingTableCount:', this.inventoryData.polishingTableCount);
            console.log('[Inventory] polishingSlots:', this.inventoryData.polishingSlots);
            this.processInventoryData();
            this.updateStats();
            this.renderNFTs();this.showNotification('Inventory refreshed from blockchain!', 'success');
        } catch (error) {
            console.error('[Inventory] Failed to refresh inventory:', error);
            this.showNotification('Failed to refresh inventory: ' + error.message, 'error');}
    }
}

// Initialize inventory page when DOM loads
let inventoryPage;
document.addEventListener('DOMContentLoaded', () => {
    inventoryPage = new InventoryPage();
    window.tsdgemsInventory = inventoryPage;
    window.tsdgemsGame = inventoryPage;  // Also set as tsdgemsGame for global Game $ updates
});

