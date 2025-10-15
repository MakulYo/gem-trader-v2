// TSDGEMS - Polishing Page Script
// For in-game earned gems only (not NFTs)

class PolishingGame extends TSDGEMSGame {
    constructor() {
        super();
        this.gemTypes = [
            { name: 'Diamond', chance: 3, rarity: 'legendary' },
            { name: 'Ruby', chance: 5, rarity: 'epic' },
            { name: 'Sapphire', chance: 7, rarity: 'rare' },
            { name: 'Emerald', chance: 10, rarity: 'rare' },
            { name: 'Jade', chance: 11.66, rarity: 'uncommon' },
            { name: 'Tanzanite', chance: 11.66, rarity: 'uncommon' },
            { name: 'Opal', chance: 11.66, rarity: 'uncommon' },
            { name: 'Aquamarine', chance: 11.66, rarity: 'uncommon' },
            { name: 'Topaz', chance: 11.66, rarity: 'uncommon' },
            { name: 'Amethyst', chance: 11.66, rarity: 'uncommon' }
        ];
        this.init();
    }

    async init() {
        // Wait for wallet to be ready before loading inventory
        this.setupWalletListeners();
        
        // Check if wallet is already available
        if (window.walletSessionInfo && window.walletSessionInfo.actor) {
            await this.loadInventoryData();
        } else {
            console.log('[Polishing] Waiting for wallet connection...');
        }
        
        this.initializePolishingSlots();
        this.renderGemDistribution();
        this.updatePolishingDisplay();
        this.showNotification('Polishing station ready', 'info');
    }

    setupWalletListeners() {
        // Listen for wallet connection/restoration
        window.addEventListener('wallet-connected', async (e) => {
            console.log('[Polishing] Wallet connected, loading inventory...');
            await this.loadInventoryData();
            this.initializePolishingSlots();
            this.renderPolishingSlots();
        });

        window.addEventListener('wallet-session-restored', async (e) => {
            console.log('[Polishing] Wallet session restored, loading inventory...');
            await this.loadInventoryData();
            this.initializePolishingSlots();
            this.renderPolishingSlots();
        });
    }

    async loadInventoryData() {
        try {
            // Get inventory data to determine polishing slots
            if (window.walletSessionInfo && window.walletSessionInfo.actor) {
                // Use global backend service instance
                if (!window.backendService) {
                    console.error('[Polishing] Backend service not available yet');
                    this.polishingSlots = 0;
                    this.polishingTableCount = 0;
                    return;
                }
                
                const inventoryData = await window.backendService.getInventory(window.walletSessionInfo.actor, false);
                this.polishingSlots = inventoryData.polishingSlots || 0;
                this.polishingTableCount = inventoryData.polishingTableCount || 0;
                console.log(`[Polishing] Loaded inventory: ${this.polishingTableCount} Polishing Tables, ${this.polishingSlots} slots available`);
            } else {
                this.polishingSlots = 0;
                this.polishingTableCount = 0;
                console.log('[Polishing] No wallet connected, 0 polishing slots available');
            }
        } catch (error) {
            console.error('[Polishing] Failed to load inventory data:', error);
            this.polishingSlots = 0;
            this.polishingTableCount = 0;
        }
    }

    initializePolishingSlots() {
        const slotCount = this.polishingSlots || 0;
        console.log(`[Polishing] Initializing ${slotCount} polishing slots`);
        
        this.gameState.polishing.slots = Array.from({ length: slotCount }, (_, i) => ({
            id: i + 1,
            staked: false,
            polishing: false,
            progress: 0,
            tableId: null
        }));
        
        this.renderPolishingSlots();
    }

    renderPolishingSlots() {
        const slotsGrid = document.getElementById('polishing-slots-grid');
        if (!slotsGrid) return;

        // Show message if no polishing tables
        if (this.polishingSlots === 0) {
            slotsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; background: rgba(255, 149, 0, 0.1); border: 2px dashed rgba(255, 149, 0, 0.3); border-radius: 12px;">
                    <i class="fas fa-tools" style="font-size: 3rem; color: #ff9500; margin-bottom: 15px;"></i>
                    <h3 style="color: #ff9500; margin-bottom: 10px;">No Polishing Tables</h3>
                    <p style="color: #888; margin-bottom: 15px;">You need to own Polishing Tables to unlock polishing slots.</p>
                    <p style="color: #aaa; font-size: 0.9rem;">Each Polishing Table unlocks 1 slot (max 10 slots)</p>
                    <a href="shop.html" style="display: inline-block; margin-top: 15px; padding: 10px 20px; background: #ff9500; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">
                        <i class="fas fa-shopping-cart"></i> Visit Shop
                    </a>
                </div>
            `;
            return;
        }

        slotsGrid.innerHTML = this.gameState.polishing.slots.map(slot => `
            <div class="polishing-slot ${slot.staked ? 'active' : 'empty'}">
                <div class="slot-header">
                    <h4>Slot ${slot.id}</h4>
                    ${slot.polishing ? '<span class="slot-status">Polishing...</span>' : ''}
                </div>
                ${slot.staked ? `
                    <div class="slot-info">
                        <p>Table ID: ${slot.tableId || 'N/A'}</p>
                        ${slot.polishing ? `<p>Progress: ${slot.progress}%</p>` : ''}
                    </div>
                ` : `
                    <p>Stake a polishing table to activate</p>
                `}
            </div>
        `).join('');
    }

    renderGemDistribution() {
        const tableBody = document.getElementById('inventory-table-body');
        if (!tableBody) return;

        // Display gem types with drop chances (for in-game earned gems)
        tableBody.innerHTML = this.gemTypes.map(gem => {
            const owned = this.gameState.player.polishedGems[gem.name.toLowerCase()] || 0;
            return `
                <tr>
                    <td>${gem.name}</td>
                    <td>${gem.chance}%</td>
                    <td>${owned}</td>
                </tr>
            `;
        }).join('');
    }

    updatePolishingDisplay() {
        // Update polishing stats from local game state (in-game gems only)
        const totalRough = Object.values(this.gameState.player.roughGems || {}).reduce((a, b) => a + b, 0);
        const totalPolished = Object.values(this.gameState.player.polishedGems || {}).reduce((a, b) => a + b, 0);
        const totalInventory = totalRough + totalPolished;

        const roughEl = document.getElementById('rough-gems-polishing-count');
        const polishedEl = document.getElementById('polished-gems-polishing-count');
        const inventoryEl = document.getElementById('total-inventory-gems');

        if (roughEl) roughEl.textContent = totalRough;
        if (polishedEl) polishedEl.textContent = totalPolished;
        if (inventoryEl) inventoryEl.textContent = totalInventory;

        // Re-render gem distribution table
        this.renderGemDistribution();

        this.updateHeaderStats();
    }
}

// Initialize polishing when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new PolishingGame();
    window.tsdgemsGame = game;
});
