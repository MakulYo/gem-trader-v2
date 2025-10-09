// TSDGEMS - Mining Page Script (Backend-Connected)

class MiningGame extends TSDGEMSGame {
    constructor() {
        super();
        this.backendService = window.backendService;
        this.currentActor = null;
        this.miningData = null;
        this.rawBackendData = null;
        this.init();
    }

    init() {
        this.setupWalletIntegration();
        this.createDebugPanel();
        this.showNotification('Connect your wallet to access mining operations', 'info');
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

        // Toggle functionality
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
                ✅ Connected | Last Update: ${timestamp}
            </div>
            <div style="background: rgba(0, 0, 0, 0.5); padding: 10px; border-radius: 4px; overflow-x: auto;">
                <strong style="color: #ff0;">Mining Data:</strong>
                <pre style="margin: 5px 0 0 0; color: #00d4ff; white-space: pre-wrap; word-wrap: break-word;">${JSON.stringify(data, null, 2)}</pre>
            </div>
        `;
    }

    setupWalletIntegration() {
        const connectBtn = document.getElementById('connectWalletBtn');
        if (connectBtn) {
            connectBtn.addEventListener('click', async () => {
                await this.connectWallet();
            });
        }
    }

    async connectWallet() {
        try {
            this.showNotification('Connecting wallet...', 'info');
            
            const actor = await window.walletConnect();
            
            if (!actor) {
                throw new Error('No actor returned from wallet');
            }

            this.currentActor = actor;
            this.showNotification(`Connected as ${actor}`, 'success');
            
            // Load mining data
            await this.loadMiningData(actor);
            
        } catch (error) {
            console.error('[Mining] Wallet connection failed:', error);
            this.showNotification('Failed to connect wallet: ' + error.message, 'error');
            this.updateDebugPanel({ 
                error: error.message, 
                stack: error.stack,
                timestamp: new Date().toISOString() 
            });
        }
    }

    async loadMiningData(actor) {
        try {
            this.showNotification('Loading mining data...', 'info');

            // Initialize player and get dashboard
            await this.backendService.initPlayer(actor);
            const dashboard = await this.backendService.getDashboard(actor);

            if (dashboard && dashboard.mining) {
                this.miningData = dashboard.mining;
                
                // Update debug panel
                this.updateDebugPanel({
                    actor: actor,
                    mining: dashboard.mining,
                    player: dashboard.player,
                    timestamp: new Date().toISOString()
                });
                
                this.renderMiningSlots();
                this.updateMiningStats();
                this.showNotification('Mining data loaded!', 'success');
            } else {
                this.showNotification('No mining data available', 'warning');
                this.updateDebugPanel({
                    actor: actor,
                    warning: 'No mining data in dashboard',
                    dashboard: dashboard,
                    timestamp: new Date().toISOString()
                });
            }
            
        } catch (error) {
            console.error('[Mining] Failed to load mining data:', error);
            this.showNotification('Failed to load mining data: ' + error.message, 'error');
            this.updateDebugPanel({ 
                error: error.message, 
                stack: error.stack,
                timestamp: new Date().toISOString() 
            });
        }
    }

    renderMiningSlots() {
        const slotsGrid = document.getElementById('slots-grid');
        if (!slotsGrid || !this.miningData || !this.miningData.slots) {
            console.warn('[Mining] No slots grid or mining data');
            return;
        }

        const slots = this.miningData.slots;
        const slotIds = Object.keys(slots).sort();

        slotsGrid.innerHTML = slotIds.map(slotId => {
            const slot = slots[slotId];
            
            if (!slot.unlocked) {
                return `
                    <div class="mining-slot locked">
                        <div class="slot-header">
                            <h4>Slot ${slotId}</h4>
                            <i class="fas fa-lock"></i>
                        </div>
                        <p>Unlock this slot to start mining</p>
                    </div>
                `;
            }

            const statusClass = slot.rented ? 'active' : 'available';
            const workers = slot.workers || 0;
            const durability = slot.durability || 100;

            return `
                <div class="mining-slot ${statusClass}">
                    <div class="slot-header">
                        <h4>Slot ${slotId}</h4>
                        <span class="slot-status">${slot.rented ? 'Active' : 'Available'}</span>
                    </div>
                    ${slot.rented ? `
                        <div class="slot-info">
                            <p><i class="fas fa-users"></i> Workers: ${workers}</p>
                            <p><i class="fas fa-wrench"></i> Durability: ${durability}%</p>
                            ${slot.equipment ? `<p><i class="fas fa-tools"></i> Equipment: ${slot.equipment}</p>` : ''}
                        </div>
                    ` : `
                        <button class="action-btn primary" onclick="game.rentSlot('${slotId}')">
                            Rent Slot
                        </button>
                    `}
                </div>
            `;
        }).join('');
    }

    updateMiningStats() {
        if (!this.miningData || !this.miningData.slots) return;

        const slots = this.miningData.slots;
        const slotArray = Object.values(slots);

        // Calculate active sites
        const activeSites = slotArray.filter(s => s.rented).length;
        const totalWorkforce = slotArray.reduce((sum, s) => sum + (s.workers || 0), 0);

        const activeSitesEl = document.getElementById('active-mining-sites');
        const totalWorkforceEl = document.getElementById('total-workforce');

        if (activeSitesEl) activeSitesEl.textContent = activeSites;
        if (totalWorkforceEl) totalWorkforceEl.textContent = totalWorkforce;

        // Update header
        const headerGameDollars = document.getElementById('header-game-dollars');
        if (headerGameDollars && this.miningData.player) {
            const currency = this.miningData.player.ingameCurrency || 0;
            headerGameDollars.textContent = `Game $: ${currency.toLocaleString()}`;
        }
    }

    rentSlot(slotId) {
        this.showNotification('Renting functionality will be implemented soon!', 'info');
        console.log('[Mining] Rent slot requested:', slotId);
    }
}

// Initialize mining when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new MiningGame();
    window.tsdgemsGame = game;
});
