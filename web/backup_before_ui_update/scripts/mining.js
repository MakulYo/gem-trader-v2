// TSDGEMS - Mining Page Script

class MiningGame extends TSDGEMSGame {
    constructor() {
        super();
        this.init();
    }

    init() {
        this.initializeMiningSlots();
        this.updateMiningDisplay();
        this.showNotification('Mining operations ready', 'info');
    }

    initializeMiningSlots() {
        // Initialize mining slots
        this.gameState.miningSlots.slots = Array.from({ length: 10 }, (_, i) => ({
            id: i + 1,
            unlocked: i < 3,
            rented: false,
            staked: false,
            workers: 0,
            equipment: null,
            durability: 100,
            production: 0
        }));
        
        this.renderMiningSlots();
    }

    renderMiningSlots() {
        const slotsGrid = document.getElementById('slots-grid');
        if (!slotsGrid) return;

        slotsGrid.innerHTML = this.gameState.miningSlots.slots.map(slot => {
            if (!slot.unlocked) {
                return `
                    <div class="mining-slot locked">
                        <div class="slot-header">
                            <h4>Slot ${slot.id}</h4>
                            <i class="fas fa-lock"></i>
                        </div>
                        <p>Unlock this slot to start mining</p>
                    </div>
                `;
            }

            const statusClass = slot.rented ? 'active' : 'available';
            return `
                <div class="mining-slot ${statusClass}">
                    <div class="slot-header">
                        <h4>Slot ${slot.id}</h4>
                        <span class="slot-status">${slot.rented ? 'Active' : 'Available'}</span>
                    </div>
                    ${slot.rented ? `
                        <div class="slot-info">
                            <p><i class="fas fa-users"></i> Workers: ${slot.workers}</p>
                            <p><i class="fas fa-wrench"></i> Durability: ${slot.durability}%</p>
                        </div>
                    ` : `
                        <button class="action-btn primary" onclick="game.rentSlot(${slot.id})">
                            Rent Slot
                        </button>
                    `}
                </div>
            `;
        }).join('');
    }

    rentSlot(slotId) {
        const slot = this.gameState.miningSlots.slots.find(s => s.id === slotId);
        if (!slot) return;

        if (slot.rented) {
            this.showNotification('This slot is already rented!', 'error');
            return;
        }

        // Simple rent logic
        slot.rented = true;
        this.gameState.miningSlots.rented++;
        this.renderMiningSlots();
        this.updateMiningDisplay();
        this.showNotification(`Slot ${slotId} rented successfully!`, 'success');
    }

    updateMiningDisplay() {
        // Update mining stats
        const activeSites = this.gameState.miningSlots.slots.filter(s => s.rented).length;
        const totalWorkforce = this.gameState.miningSlots.slots.reduce((sum, s) => sum + s.workers, 0);

        const activeSitesEl = document.getElementById('active-mining-sites');
        const totalWorkforceEl = document.getElementById('total-workforce');

        if (activeSitesEl) activeSitesEl.textContent = activeSites;
        if (totalWorkforceEl) totalWorkforceEl.textContent = totalWorkforce;

        this.updateHeaderStats();
    }
}

// Initialize mining when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new MiningGame();
    window.tsdgemsGame = game;
});

