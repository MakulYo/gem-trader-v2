// TSDGEMS - Dashboard Page Script

class DashboardGame extends TSDGEMSGame {
    constructor() {
        super();
        this.init();
    }

    init() {
        this.updateDashboard();
        this.startDashboardUpdates();
        this.showNotification('Welcome to TSDGEMS! Start mining to earn rewards.', 'info');
    }

    updateDashboard() {
        // Update all dashboard stats
        const tsdBalance = document.getElementById('tsd-balance');
        const activeWorkers = document.getElementById('active-workers');
        const roughGemsCount = document.getElementById('rough-gems-count');
        const polishedGemsCount = document.getElementById('polished-gems-count');
        const miningSlotsCount = document.getElementById('mining-slots-count');
        const tsdmBalance = document.getElementById('tsdm-balance');

        if (tsdBalance) tsdBalance.textContent = this.gameState.trading.totalGameDollars.toFixed(2);
        if (activeWorkers) activeWorkers.textContent = this.gameState.player.activeWorkers;
        
        // Calculate total rough gems
        const totalRoughGems = Object.values(this.gameState.player.roughGems).reduce((a, b) => a + b, 0);
        if (roughGemsCount) roughGemsCount.textContent = totalRoughGems;
        
        // Calculate total polished gems
        const totalPolishedGems = Object.values(this.gameState.player.polishedGems).reduce((a, b) => a + b, 0);
        if (polishedGemsCount) polishedGemsCount.textContent = totalPolishedGems;
        
        if (miningSlotsCount) {
            miningSlotsCount.textContent = `${this.gameState.miningSlots.rented}/${this.gameState.miningSlots.maxSlots}`;
        }
        
        if (tsdmBalance) tsdmBalance.textContent = this.gameState.player.tsdBalance.toFixed(2);

        this.updateHeaderStats();
    }

    startDashboardUpdates() {
        // Update dashboard every 5 seconds
        setInterval(() => {
            this.updateDashboard();
        }, 5000);
    }
}

// Initialize dashboard when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new DashboardGame();
    window.tsdgemsGame = game;
});

