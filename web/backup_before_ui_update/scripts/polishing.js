// TSDGEMS - Polishing Page Script

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

    init() {
        this.initializePolishingSlots();
        this.renderGemDistribution();
        this.updatePolishingDisplay();
        this.showNotification('Polishing station ready', 'info');
    }

    initializePolishingSlots() {
        this.gameState.polishing.slots = Array.from({ length: 5 }, (_, i) => ({
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
        // Update polishing stats
        const totalRough = Object.values(this.gameState.player.roughGems).reduce((a, b) => a + b, 0);
        const totalPolished = Object.values(this.gameState.player.polishedGems).reduce((a, b) => a + b, 0);
        const totalInventory = totalRough + totalPolished;

        const roughEl = document.getElementById('rough-gems-polishing-count');
        const polishedEl = document.getElementById('polished-gems-polishing-count');
        const inventoryEl = document.getElementById('total-inventory-gems');

        if (roughEl) roughEl.textContent = totalRough;
        if (polishedEl) polishedEl.textContent = totalPolished;
        if (inventoryEl) inventoryEl.textContent = totalInventory;

        this.updateHeaderStats();
    }
}

// Initialize polishing when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new PolishingGame();
    window.tsdgemsGame = game;
});

