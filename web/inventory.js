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
        this.init();
    }

    init() {
        this.createDebugPanel();
        this.updateDebugPanel();
        this.setupEventListeners();
        
        // Delayed wallet check to ensure wallet.js is fully initialized
        setTimeout(() => {
            this.checkWalletAndLoadInventory();
        }, 200);
        
        this.showNotification('Inventory system ready', 'info');
    }

    createDebugPanel() {
        const main = document.querySelector('.main-content');
        if (!main) return;

        const debugPanel = document.createElement('div');
        debugPanel.id = 'inventory-debug-panel';
        debugPanel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 450px;
            max-height: 600px;
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
                <strong style="color: #00d4ff;">🔍 Inventory Debug</strong>
                <button id="toggle-inventory-debug" style="background: #00d4ff; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; color: #000;">Collapse</button>
            </div>
            <div id="inventory-debug-content" style="max-height: 540px; overflow-y: auto;">
                <div style="color: #888; margin-bottom: 10px;">Waiting for inventory data...</div>
            </div>
        `;

        main.appendChild(debugPanel);

        // Toggle functionality
        const toggleBtn = document.getElementById('toggle-inventory-debug');
        const content = document.getElementById('inventory-debug-content');
        let collapsed = false;

        toggleBtn.addEventListener('click', () => {
            collapsed = !collapsed;
            content.style.display = collapsed ? 'none' : 'block';
            toggleBtn.textContent = collapsed ? 'Expand' : 'Collapse';
        });
    }

    updateDebugPanel() {
        const content = document.getElementById('inventory-debug-content');
        if (!content) return;

        const timestamp = new Date().toLocaleTimeString();
        
        let html = `
            <div style="color: ${this.inventoryData ? '#0f0' : '#f80'}; margin-bottom: 10px;">
                ${this.inventoryData ? '✅' : '⚠️'} ${this.currentActor ? `Connected: ${this.currentActor}` : 'No wallet connected'} | Last Update: ${timestamp}
            </div>
        `;

        if (this.inventoryData) {
            // Parse updatedAt safely
            let updatedAtStr = 'N/A';
            if (this.inventoryData.updatedAt) {
                try {
                    if (this.inventoryData.updatedAt._seconds) {
                        updatedAtStr = new Date(this.inventoryData.updatedAt._seconds * 1000).toLocaleString();
                    } else if (typeof this.inventoryData.updatedAt === 'number') {
                        updatedAtStr = new Date(this.inventoryData.updatedAt).toLocaleString();
                    } else if (this.inventoryData.updatedAt.toDate) {
                        updatedAtStr = this.inventoryData.updatedAt.toDate().toLocaleString();
                    } else {
                        updatedAtStr = String(this.inventoryData.updatedAt);
                    }
                } catch (e) {
                    updatedAtStr = 'Parse Error';
                }
            }

            html += `
                <div style="background: rgba(0, 0, 0, 0.5); padding: 10px; border-radius: 4px; overflow-x: auto; margin-bottom: 10px;">
                    <strong style="color: #ff0;">Summary:</strong>
                    <pre style="margin: 5px 0 0 0; color: #0f0; white-space: pre-wrap; word-wrap: break-word;">Total NFTs: ${this.allNFTs.length}
Polished: ${this.inventoryData.polished || 0}
Rough: ${this.inventoryData.rough || 0}
Collections: ${this.collections.size}
Templates: ${Object.keys(this.inventoryData.byTemplate || {}).length}
Cached: ${this.inventoryData.cached ? 'Yes' : 'No'}${this.inventoryData.stale ? ' (Stale)' : ''}
Updated: ${updatedAtStr}</pre>
                </div>
                <div style="background: rgba(0, 0, 0, 0.5); padding: 10px; border-radius: 4px; overflow-x: auto; margin-bottom: 10px;">
                    <strong style="color: #ff0;">By Template:</strong>
                    <pre style="margin: 5px 0 0 0; color: #00d4ff; white-space: pre-wrap; word-wrap: break-word; max-height: 150px; overflow-y: auto;">${JSON.stringify(this.inventoryData.byTemplate || {}, null, 2)}</pre>
                </div>
                <div style="background: rgba(0, 0, 0, 0.5); padding: 10px; border-radius: 4px; overflow-x: auto;">
                    <strong style="color: #ff0;">Full Data:</strong>
                    <pre style="margin: 5px 0 0 0; color: #00d4ff; white-space: pre-wrap; word-wrap: break-word; max-height: 200px; overflow-y: auto;">${JSON.stringify(this.inventoryData, null, 2)}</pre>
                </div>
            `;
        } else {
            html += `
                <div style="background: rgba(0, 0, 0, 0.5); padding: 10px; border-radius: 4px; text-align: center;">
                    <p style="color: #888; margin: 0;">No inventory data loaded yet.</p>
                    <p style="color: #888; margin: 5px 0 0 0; font-size: 10px;">${this.currentActor ? 'Loading inventory...' : 'Connect your wallet to load inventory.'}</p>
                </div>
            `;
        }
        
        content.innerHTML = html;
    }

    async checkWalletAndLoadInventory() {
        console.log('[Inventory] Setting up wallet event listeners...');
        
        // Listen for new wallet connection
        window.addEventListener('wallet-connected', async (e) => {
            console.log('[Inventory] ✅ Wallet connected event received:', e.detail);
            this.currentActor = e.detail.actor;
            await this.loadInventory(false);
        });

        // Listen for restored session
        window.addEventListener('wallet-session-restored', async (e) => {
            console.log('[Inventory] ✅ Wallet session restored event received:', e.detail);
            this.currentActor = e.detail.actor;
            await this.loadInventory(false);
        });

        // Check if wallet info is already available
        console.log('[Inventory] Checking walletSessionInfo:', window.walletSessionInfo);
        
        if (window.walletSessionInfo && window.walletSessionInfo.actor) {
            this.currentActor = window.walletSessionInfo.actor;
            console.log('[Inventory] ✅ Using existing wallet session:', this.currentActor);
            await this.loadInventory(false);
        } else {
            console.log('[Inventory] ⏳ No wallet session found yet, waiting for connection...');
            this.showEmptyState('no-wallet');
        }
    }

    async loadInventory(forceRefresh = false) {
        if (!this.currentActor) {
            console.log('[Inventory] No actor connected, skipping inventory load');
            this.showNotification('Connect your wallet to view inventory', 'info');
            this.updateDebugPanel();
            this.showEmptyState('no-wallet');
            return;
        }

        try {
            console.log('[Inventory] Loading inventory for:', this.currentActor);
            this.showLoadingState();
            this.showNotification(forceRefresh ? 'Refreshing inventory from blockchain...' : 'Loading inventory...', 'info');
            
            // Get full NFT data - we'll need to fetch from AtomicAssets directly for full details
            // For now, use the inventory summary
            this.inventoryData = await this.backendService.getInventory(this.currentActor, forceRefresh);
            
            console.log('[Inventory] Inventory loaded:', this.inventoryData);
            
            // For demonstration, we'll show template-based data
            // In production, you'd want to fetch full NFT details
            this.processInventoryData();
            this.updateStats();
            this.renderNFTs();
            this.updateDebugPanel();
            
            const cacheStatus = this.inventoryData.cached ? '(cached)' : '(live)';
            this.showNotification(`Inventory loaded ${cacheStatus}`, 'success');
        } catch (error) {
            console.error('[Inventory] Failed to load inventory:', error);
            this.showNotification('Failed to load inventory: ' + error.message, 'error');
            this.updateDebugPanel();
            this.showEmptyState('error');
        }
    }

    processInventoryData() {
        console.log('[Inventory] processInventoryData called');
        console.log('[Inventory] inventoryData:', this.inventoryData);
        
        if (!this.inventoryData || !this.inventoryData.templateCounts) {
            console.log('[Inventory] No templateCounts data available');
            this.allNFTs = [];
            this.filteredNFTs = [];
            return;
        }

        // Convert templateCounts data to NFT cards
        this.allNFTs = [];
        this.collections.clear();
        
        console.log('[Inventory] Processing templateCounts:', Object.keys(this.inventoryData.templateCounts).length, 'templates');
        
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
                if (image) {
                    // Always use the correct path for gallery_images
                    finalImagePath = `assets/gallery_images/${image}`;
                }
                
                console.log(`[Inventory] Template ${templateId} [${i}]: finalImagePath="${finalImagePath}"`);

                this.allNFTs.push({
                    template_id: templateId,
                    asset_id: `${templateId}-${i}`,
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
        });

        console.log('[Inventory] Total NFTs created:', this.allNFTs.length);
        this.filteredNFTs = [...this.allNFTs];
        
        // Populate collection filter
        const collectionFilter = document.getElementById('collection-filter');
        if (collectionFilter) {
            collectionFilter.innerHTML = '<option value="">All Collections</option>';
            this.collections.forEach(collection => {
                const option = document.createElement('option');
                option.value = collection;
                option.textContent = collection;
                collectionFilter.appendChild(option);
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
        const miningPower = document.getElementById('mining-power');
        const uniqueTemplates = document.getElementById('unique-templates');

        if (totalNFTs) totalNFTs.textContent = this.inventoryData?.total || this.allNFTs.length;
        if (polishedGems) polishedGems.textContent = this.inventoryData?.polished || 0;
        if (roughGems) roughGems.textContent = this.inventoryData?.rough || 0;
        if (equipmentCount) equipmentCount.textContent = this.inventoryData?.equipment || 0;
        if (miningPower) miningPower.textContent = this.inventoryData?.totalMiningPower || 0;
        if (uniqueTemplates) uniqueTemplates.textContent = this.inventoryData?.uniqueTemplates || Object.keys(this.inventoryData?.templateCounts || {}).length;
    }

    renderNFTs() {
        const content = document.getElementById('inventory-content');
        if (!content) return;

        if (this.filteredNFTs.length === 0) {
            this.showEmptyState('no-results');
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'inventory-grid';

        this.filteredNFTs.forEach(nft => {
            const card = this.createNFTCard(nft);
            grid.appendChild(card);
        });

        content.innerHTML = '';
        content.appendChild(grid);
    }

    createNFTCard(nft) {
        const card = document.createElement('div');
        card.className = 'nft-card';
        
        // Get schema icon
        const schemaIcon = this.getSchemaIcon(nft.schema);
        
        // Get schema color
        const schemaColor = this.getSchemaColor(nft.schema);
        
        // Mining Power display for equipment
        const miningPowerDisplay = (nft.schema === 'equipment' || nft.schema === 'tools') && nft.mining_power > 0 ? 
            `<div class="nft-attribute">
                <span class="nft-attribute-key">Mining Power:</span> ${nft.mining_power} MP
            </div>` : '';
        
        // Create image element with fallback logic
        let imageElement = '';
        if (nft.image) {
            console.log(`[Inventory] Creating image element for ${nft.name} with path: ${nft.image}`);
            imageElement = `
                <img src="${nft.image}" alt="${nft.name}" class="nft-image" 
                     style="width: 100%; height: 100%; object-fit: contain;"
                     onload="console.log('✅ Image loaded:', this.src);"
                     onerror="console.log('❌ Image failed:', this.src); this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="nft-image-fallback" style="display: none; align-items: center; justify-content: center; height: 100%; color: #555;">
                    <i class="fas ${schemaIcon}" style="font-size: 3rem;"></i>
                </div>
            `;
        } else {
            imageElement = `<i class="fas ${schemaIcon} nft-placeholder"></i>`;
        }
        
        card.innerHTML = `
            <div class="nft-card-header">
                <span class="nft-template-id">Template #${nft.template_id}</span>
                <span class="nft-asset-id">${nft.asset_id}</span>
            </div>
            <div class="nft-image-container">
                ${imageElement}
            </div>
            <div class="nft-name">${nft.name}</div>
            <div class="nft-collection" style="color: ${schemaColor};">
                <i class="fas ${schemaIcon}"></i> ${nft.schema || 'unknown'}
            </div>
            <div class="nft-attributes">
                ${miningPowerDisplay}
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
            default: return 'fa-box';
        }
    }

    getSchemaColor(schema) {
        switch (schema) {
            case 'gems': return '#00ff64';
            case 'equipment': return '#00d4ff';
            case 'tools': return '#ff9500';
            case 'shards': return '#ff6b6b';
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

        // Collection filter
        const collectionFilter = document.getElementById('collection-filter');
        if (collectionFilter) {
            collectionFilter.addEventListener('change', () => {
                this.filterNFTs();
            });
        }
    }

    filterNFTs() {
        const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
        const collection = document.getElementById('collection-filter')?.value || '';

        this.filteredNFTs = this.allNFTs.filter(nft => {
            const matchesSearch = !searchTerm || 
                nft.name.toLowerCase().includes(searchTerm) ||
                nft.template_id.toString().includes(searchTerm);
            
            const matchesCollection = !collection || nft.collection === collection;

            return matchesSearch && matchesCollection;
        });

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
            this.renderNFTs();
            this.updateDebugPanel();
            this.showNotification('Inventory refreshed from blockchain!', 'success');
        } catch (error) {
            console.error('[Inventory] Failed to refresh inventory:', error);
            this.showNotification('Failed to refresh inventory: ' + error.message, 'error');
            this.updateDebugPanel();
        }
    }
}

// Initialize inventory page when DOM loads
let inventoryPage;
document.addEventListener('DOMContentLoaded', () => {
    inventoryPage = new InventoryPage();
    window.tsdgemsInventory = inventoryPage;
});

