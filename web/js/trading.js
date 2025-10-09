// TSDGEMS - Trading Page Script (Backend-Connected)

class TradingGame extends TSDGEMSGame {
    constructor() {
        super();
        this.backendService = window.backendService;
        this.gemPriceChart = null;
        this.cityMatrix = null;
        this.basePriceData = null;
        this.currentActor = null;
        this.rawBackendData = null;
        this.refreshInterval = null;
        this.boostsData = null;
        this.init();
    }

    init() {
        this.setupTradingSubpages();
        this.createDebugPanel();
        this.loadInitialData();
        this.showNotification('Loading trading markets...', 'info');
    }

    async loadInitialData() {
        try {
            // Load city matrix and base price immediately (no wallet required)
            console.log('[Trading] Loading initial data...');
            const [cityMatrix, basePriceData] = await Promise.all([
                this.backendService.getCityMatrix(),
                this.backendService.getBasePrice()
            ]);

            this.cityMatrix = cityMatrix;
            this.basePriceData = basePriceData;

            console.log('[Trading] City Matrix loaded:', cityMatrix);
            console.log('[Trading] Base Price loaded:', basePriceData);
            
            // Test the data structure
            console.log('[Trading] Testing cityMatrix structure:');
            console.log('- cityMatrix type:', typeof cityMatrix);
            console.log('- cityMatrix keys:', Object.keys(cityMatrix || {}));
            if (cityMatrix && cityMatrix.boosts) {
                console.log('- boosts type:', typeof cityMatrix.boosts);
                console.log('- boosts keys:', Object.keys(cityMatrix.boosts));
                console.log('- first city data:', Object.keys(cityMatrix.boosts)[0], cityMatrix.boosts[Object.keys(cityMatrix.boosts)[0]]);
            }

            // Update debug panel
            this.updateDebugPanel({
                cityMatrix: cityMatrix,
                basePrice: basePriceData,
                timestamp: new Date().toISOString()
            });

            // Render UI components
            this.renderBasePriceDisplay();
            this.renderCityMatrix();
            this.initializeGemPriceChart();
            this.renderStakingGrid();
            
            this.showNotification('Trading markets loaded!', 'success');
            
            // Start auto-refresh for backend data
            this.startAutoRefresh();
            
        } catch (error) {
            console.error('[Trading] Failed to load initial data:', error);
            this.showNotification('Failed to load trading data: ' + error.message, 'error');
            this.updateDebugPanel({ 
                error: error.message, 
                stack: error.stack,
                timestamp: new Date().toISOString() 
            });
        }
    }

    async startAutoRefresh() {
        // Try to use Firestore Realtime Listeners if available
        if (window.firebaseRealtimeService) {
            try {
                await window.firebaseRealtimeService.initialize();
                this.setupRealtimeListeners();
                return;
            } catch (error) {
                console.warn('[Trading] Realtime listeners failed, falling back to polling:', error);
            }
        }

        // Fallback: Polling method
        this.setupPolling();
    }

    setupRealtimeListeners() {
        console.log('[Trading] Setting up Firestore realtime listeners...');

        // Listen to Base Price changes
        const basePriceUnsubscribe = window.firebaseRealtimeService.listenToBasePrice((data) => {
            console.log('[Trading] 🔥 Base price updated in realtime!', data);
            this.basePriceData = data;
            this.renderBasePriceDisplay();
        });

        // Listen to City Matrix changes (cities + boosts)
        const [citiesUnsubscribe, boostsUnsubscribe] = window.firebaseRealtimeService.listenToCityMatrix((data) => {
            console.log('[Trading] 🔥 City matrix updated in realtime!', data);
            this.cityMatrix = data;
            this.renderCityMatrix();
        });

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            console.log('[Trading] Cleaning up realtime listeners...');
            basePriceUnsubscribe();
            citiesUnsubscribe();
            boostsUnsubscribe();
        });

        console.log('[Trading] ✅ Realtime listeners active - instant updates enabled!');
    }

    setupPolling() {
        // Clear existing interval if any
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Refresh every 60 seconds (city boosts update every minute on backend)
        this.refreshInterval = setInterval(async () => {
            try {
                console.log('[Trading] Auto-refreshing backend data...');
                
                // Fetch updated data in parallel
                const [cityMatrix, basePriceData] = await Promise.all([
                    this.backendService.getCityMatrix(),
                    this.backendService.getBasePrice()
                ]);

                // Update local data
                this.cityMatrix = cityMatrix;
                this.basePriceData = basePriceData;

                // Re-render UI components
                this.renderBasePriceDisplay();
                this.renderCityMatrix();

                console.log('[Trading] Auto-refresh completed');
                
            } catch (error) {
                console.error('[Trading] Auto-refresh failed:', error);
            }
        }, 60000); // 60 seconds

        console.log('[Trading] ⏱️ Polling started (60s interval) - realtime not available');

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
            }
        });

        // Pause refresh when page is hidden, resume when visible
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (this.refreshInterval) {
                    clearInterval(this.refreshInterval);
                    this.refreshInterval = null;
                    console.log('[Trading] Polling paused (page hidden)');
                }
            } else {
                if (!this.refreshInterval) {
                    this.setupPolling();
                    console.log('[Trading] Polling resumed (page visible)');
                }
            }
        });
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
                <strong style="color: #00d4ff;">🔍 Trading Backend Debug</strong>
                <button id="toggle-debug" style="background: #00d4ff; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; color: #000;">Collapse</button>
            </div>
            <div id="debug-content" style="max-height: 540px; overflow-y: auto;">
                <div style="color: #888; margin-bottom: 10px;">Loading backend data...</div>
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
            <div style="background: rgba(0, 0, 0, 0.5); padding: 10px; border-radius: 4px; overflow-x: auto; margin-bottom: 10px;">
                <strong style="color: #ff0;">City Matrix:</strong>
                <pre style="margin: 5px 0 0 0; color: #00d4ff; white-space: pre-wrap; word-wrap: break-word;">${JSON.stringify(data.cityMatrix || {}, null, 2)}</pre>
            </div>
            <div style="background: rgba(0, 0, 0, 0.5); padding: 10px; border-radius: 4px; overflow-x: auto;">
                <strong style="color: #ff0;">Base Price:</strong>
                <pre style="margin: 5px 0 0 0; color: #00d4ff; white-space: pre-wrap; word-wrap: break-word;">${JSON.stringify(data.basePrice || {}, null, 2)}</pre>
            </div>
        `;
    }

    renderBasePriceDisplay() {
        const valueEl = document.getElementById('base-price-value');
        const updateEl = document.getElementById('base-price-update');
        const matrixBasePriceEl = document.getElementById('matrix-base-price');

        if (!this.basePriceData) {
            if (valueEl) valueEl.textContent = 'N/A';
            if (updateEl) updateEl.textContent = 'No data available';
            if (matrixBasePriceEl) matrixBasePriceEl.textContent = 'Base price: loading…';
            return;
        }

        // Use basePrice from backend data
        const price = this.basePriceData.basePrice || 0;
        const btcPrice = this.basePriceData.btcUsd || 0;
        const source = this.basePriceData.source || 'unknown';
        
        // Handle Firebase Timestamp format
        let lastUpdate = 'Unknown';
        if (this.basePriceData.updatedAt) {
            if (this.basePriceData.updatedAt._seconds) {
                // Firebase Timestamp format
                lastUpdate = new Date(this.basePriceData.updatedAt._seconds * 1000).toLocaleString();
            } else if (typeof this.basePriceData.updatedAt === 'number') {
                // Unix timestamp
                lastUpdate = new Date(this.basePriceData.updatedAt).toLocaleString();
            } else if (this.basePriceData.updatedAt.toDate) {
                // Firestore Timestamp object
                lastUpdate = this.basePriceData.updatedAt.toDate().toLocaleString();
            }
        }

        if (valueEl) {
            valueEl.textContent = `${price.toFixed(2)} Game $`;
        }

        if (updateEl) {
            updateEl.innerHTML = `
                <i class="fas fa-clock"></i> Last updated: ${lastUpdate}
                <br>
                <i class="fas fa-bitcoin"></i> BTC: $${btcPrice.toLocaleString()} (${source})
            `;
        }

        if (matrixBasePriceEl) {
            matrixBasePriceEl.textContent = `Base price: ${price.toFixed(2)} Game $`;
        }
    }

    renderCityMatrix() {
        if (!this.cityMatrix || !this.cityMatrix.boosts) {
            console.warn('[Trading] No city matrix boosts data available');
            const wrapper = document.getElementById('city-boost-matrix-wrapper');
            if (wrapper) {
                wrapper.innerHTML = '<p style="text-align: center; color: #888; padding: 40px;">No city boost data available</p>';
            }
            return;
        }

        let { boosts } = this.cityMatrix;
        
        console.log('[Trading] Full cityMatrix object:', this.cityMatrix);
        console.log('[Trading] Raw boosts data:', boosts);
        console.log('[Trading] Boosts type:', typeof boosts);
        console.log('[Trading] Is Array:', Array.isArray(boosts));

        // Convert boosts array to object format if needed
        // Backend returns: boosts: [{ id: 'mumbai', bonuses: {...} }, ...]
        // We need: boosts: { mumbai: {...}, zhecheng: {...}, ... }
        if (Array.isArray(boosts)) {
            console.log('[Trading] Converting boosts array to object...');
            const boostsObj = {};
            boosts.forEach(cityBoost => {
                if (cityBoost.id && cityBoost.bonuses) {
                    boostsObj[cityBoost.id] = cityBoost.bonuses;
                }
            });
            boosts = boostsObj;
            console.log('[Trading] Converted boosts:', boosts);
        }

        // Store converted boosts for use in other methods
        this.boostsData = boosts;

        // Get city IDs from boosts object
        let cityIds = [];
        let gemTypes = [];
        
        if (boosts && typeof boosts === 'object') {
            cityIds = Object.keys(boosts);
            
            // Get all unique gem types from all cities
            const allGemTypes = new Set();
            cityIds.forEach(cityId => {
                if (boosts[cityId] && typeof boosts[cityId] === 'object') {
                    Object.keys(boosts[cityId]).forEach(gemType => {
                        allGemTypes.add(gemType);
                    });
                }
            });
            gemTypes = Array.from(allGemTypes).sort();
        }
        
        console.log('[Trading] Extracted cityIds:', cityIds);
        console.log('[Trading] Extracted gemTypes:', gemTypes);
        
        if (cityIds.length === 0) {
            const wrapper = document.getElementById('city-boost-matrix-wrapper');
            if (wrapper) {
                wrapper.innerHTML = '<p style="text-align: center; color: #888; padding: 40px;">No cities in boost data</p>';
            }
            return;
        }

        console.log('[Trading] Cities:', cityIds);
        console.log('[Trading] Gem types:', gemTypes);

        // Populate dropdowns
        const citySelect = document.getElementById('matrix-city-select');
        if (citySelect) {
            citySelect.innerHTML = '<option value="">Select a city...</option>' + 
                cityIds.map(cityId => `<option value="${cityId}">${cityId.toUpperCase()}</option>`).join('');
        }

        const gemSelect = document.getElementById('matrix-gem-select');
        if (gemSelect && gemTypes.length > 0) {
            gemSelect.innerHTML = '<option value="">Select a gem...</option>' + 
                gemTypes.map(gemType => `<option value="${gemType}">${this.formatGemName(gemType)}</option>`).join('');
        }

        // Create matrix visualization
        this.renderMatrixTable(cityIds, gemTypes, boosts);

        // Setup sell controls
        this.setupSellControls();
    }

    renderMatrixTable(cityIds, gemTypes, boosts) {
        const wrapper = document.getElementById('city-boost-matrix-wrapper');
        if (!wrapper) return;

        if (gemTypes.length === 0) {
            wrapper.innerHTML = '<p style="text-align: center; color: #888; padding: 40px;">No gem types in boost data</p>';
            return;
        }

        // Get city full names from cityMatrix.cities if available
        const cityNames = {};
        if (this.cityMatrix && this.cityMatrix.cities) {
            this.cityMatrix.cities.forEach(city => {
                cityNames[city.id] = city.name || city.id.toUpperCase();
            });
        }

        // Create table
        let html = '<table class="city-boost-matrix"><thead><tr>';
        html += '<th></th>';
        
        // Header row with gem types
        gemTypes.forEach(gemType => {
            html += `<th><i class="fas fa-gem"></i> ${this.formatGemName(gemType)}</th>`;
        });
        
        html += '</tr></thead><tbody>';

        // Data rows
        cityIds.forEach(cityId => {
            const cityName = cityNames[cityId] || cityId.toUpperCase();
            html += `<tr><td class="city-name"><i class="fas fa-map-marker-alt"></i> ${cityName}</td>`;
            
            gemTypes.forEach(gemType => {
                const boostValue = boosts[cityId]?.[gemType];
                console.log(`[Trading] City: ${cityId}, Gem: ${gemType}, Raw boost value:`, boostValue);
                
                // Handle different data types and ensure we have a valid number
                let boost = 0;
                if (typeof boostValue === 'number' && !isNaN(boostValue)) {
                    boost = boostValue;
                } else if (typeof boostValue === 'string' && !isNaN(parseFloat(boostValue))) {
                    boost = parseFloat(boostValue);
                } else {
                    console.warn(`[Trading] Invalid boost value for ${cityId}.${gemType}:`, boostValue);
                }
                
                const percentage = (boost * 100).toFixed(1);
                
                html += `<td class="boost-cell" data-city="${cityId}" data-gem="${gemType}" title="City: ${cityName}, Gem: ${this.formatGemName(gemType)}, Boost: ${percentage}%"><span class="boost-bubble">${percentage}%</span></td>`;
            });
            
            html += '</tr>';
        });

        html += '</tbody></table>';
        
        wrapper.innerHTML = html;
        console.log('[Trading] Matrix table rendered successfully');
        
        // Add click handlers to cells
        this.attachMatrixCellClickHandlers();
    }

    attachMatrixCellClickHandlers() {
        const cells = document.querySelectorAll('.boost-cell');
        cells.forEach(cell => {
            cell.addEventListener('click', (e) => {
                const cityId = e.target.dataset.city;
                const gemType = e.target.dataset.gem;
                
                if (!cityId || !gemType) return;
                
                console.log('[Trading] Cell clicked:', { cityId, gemType });
                
                // Update dropdowns
                const citySelect = document.getElementById('matrix-city-select');
                const gemSelect = document.getElementById('matrix-gem-select');
                
                if (citySelect) {
                    citySelect.value = cityId;
                    console.log('[Trading] Set city dropdown to:', cityId);
                }
                
                if (gemSelect) {
                    gemSelect.value = gemType;
                    console.log('[Trading] Set gem dropdown to:', gemType);
                }
                
                // Trigger summary update
                const event = new Event('change');
                if (citySelect) citySelect.dispatchEvent(event);
                
                // Visual feedback - highlight selected cell
                document.querySelectorAll('.boost-cell').forEach(c => c.classList.remove('selected'));
                e.target.classList.add('selected');
                
                this.showNotification(`Selected: ${this.formatGemName(gemType)} in ${cityId.toUpperCase()}`, 'info');
            });
        });
    }

    formatGemName(gemType) {
        // Convert "polished_emerald" to "Polished Emerald"
        return gemType
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    setupSellControls() {
        const citySelect = document.getElementById('matrix-city-select');
        const gemSelect = document.getElementById('matrix-gem-select');
        const amountInput = document.getElementById('matrix-sell-amount');
        const sellBtn = document.getElementById('matrix-sell-btn');

        const updateSummary = () => {
            const city = citySelect?.value;
            const gem = gemSelect?.value;
            const amount = parseInt(amountInput?.value || 1);

            if (!city || !gem || !this.boostsData || !this.basePriceData) {
                // Reset summary
                const boostEl = document.getElementById('matrix-summary-boost');
                const stakingEl = document.getElementById('matrix-summary-staking');
                const priceEl = document.getElementById('matrix-summary-price');
                
                if (boostEl) boostEl.textContent = 'Boost: Select city & gem';
                if (stakingEl) stakingEl.textContent = 'Staking Bonus: +0%';
                if (priceEl) priceEl.textContent = 'Est. Payout: 0 Game $';
                return;
            }

            const boost = this.boostsData[city]?.[gem] || 0;
            const basePrice = this.basePriceData.basePrice || 0;
            const stakingBonus = 0; // TODO: Get from player data
            
            const totalMultiplier = 1 + boost + stakingBonus;
            const estimatedPayout = basePrice * totalMultiplier * amount;

            // Update summary
            const boostEl = document.getElementById('matrix-summary-boost');
            const stakingEl = document.getElementById('matrix-summary-staking');
            const priceEl = document.getElementById('matrix-summary-price');

            if (boostEl) boostEl.textContent = `Boost: +${(boost * 100).toFixed(1)}%`;
            if (stakingEl) stakingEl.textContent = `Staking Bonus: +${(stakingBonus * 100).toFixed(1)}%`;
            if (priceEl) priceEl.textContent = `Est. Payout: ${estimatedPayout.toFixed(2)} Game $`;
        };

        if (citySelect) citySelect.addEventListener('change', updateSummary);
        if (gemSelect) gemSelect.addEventListener('change', updateSummary);
        if (amountInput) amountInput.addEventListener('input', updateSummary);

        if (sellBtn) {
            sellBtn.addEventListener('click', () => {
                const city = citySelect?.value;
                const gem = gemSelect?.value;
                const amount = amountInput?.value;
                
                if (!city || !gem) {
                    this.showNotification('Please select a city and gem type!', 'warning');
                    return;
                }
                
                this.showNotification(`Selling ${amount} ${this.formatGemName(gem)} in ${city.toUpperCase()} - Coming soon!`, 'info');
            });
        }

        // Initial update
        updateSummary();
    }

    initializeGemPriceChart() {
        const chartCanvas = document.getElementById('gem-price-chart');
        const status = document.getElementById('pricing-status');
        if (!chartCanvas || !status) return;

        // Destroy existing chart if it exists
        if (this.gemPriceChart) {
            this.gemPriceChart.destroy();
        }

        const ctx = chartCanvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, chartCanvas.offsetHeight || 320);
        gradient.addColorStop(0, 'rgba(0, 212, 255, 0.35)');
        gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');

        // Prepare chart data from backend
        let labels = [];
        let dataPoints = [];

        if (this.basePriceData && this.basePriceData.history) {
            // Use history data from backend
            labels = this.basePriceData.history.map(entry => {
                const date = new Date(entry.timestamp);
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            });
            dataPoints = this.basePriceData.history.map(entry => entry.price);
        }

        this.gemPriceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Gem Base Price (BTC / 100)',
                    data: dataPoints,
                    borderColor: '#00d4ff',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    tension: 0.25,
                    pointRadius: 0,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: { color: '#a0a0a0' },
                        grid: { display: false }
                    },
                    y: {
                        ticks: { color: '#a0a0a0' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#ffffff' }
                    }
                }
            }
        });

        if (this.basePriceData) {
            const price = this.basePriceData.basePrice || 0;
            let lastUpdate = 'Unknown';
            if (this.basePriceData.updatedAt) {
                if (this.basePriceData.updatedAt._seconds) {
                    lastUpdate = new Date(this.basePriceData.updatedAt._seconds * 1000).toLocaleString();
                } else if (typeof this.basePriceData.updatedAt === 'number') {
                    lastUpdate = new Date(this.basePriceData.updatedAt).toLocaleString();
                } else if (this.basePriceData.updatedAt.toDate) {
                    lastUpdate = this.basePriceData.updatedAt.toDate().toLocaleString();
                }
            }
            status.textContent = `Current: ${price.toFixed(2)} Game $ (Updated: ${lastUpdate})`;
        } else {
            status.textContent = 'Chart initialized - waiting for data';
        }
    }

    setupTradingSubpages() {
        const subpageToggle = document.getElementById('trading-subpage-toggle');
        if (!subpageToggle) return;

        subpageToggle.addEventListener('click', (event) => {
            const button = event.target.closest('.toggle-btn');
            if (!button) return;
            const target = button.getAttribute('data-target');
            if (!target) return;

            document.querySelectorAll('#trading-subpage-toggle .toggle-btn').forEach(btn => {
                btn.classList.toggle('active', btn === button);
            });

            document.querySelectorAll('.trading-subpage').forEach(section => {
                section.classList.toggle('active', section.id === `trading-subpage-${target}`);
            });
        });
    }

    renderStakingGrid() {
        const stakingGrid = document.getElementById('staking-grid');
        if (!stakingGrid) return;

        const stakingSlots = Array.from({ length: 10 }, (_, i) => ({
            id: i + 1,
            staked: false,
            gemType: null,
            bonus: 0
        }));

        stakingGrid.innerHTML = stakingSlots.map(slot => `
            <div class="staking-slot ${slot.staked ? 'active' : 'empty'}">
                <div class="slot-header">
                    <h4>Slot ${slot.id}</h4>
                    ${slot.staked ? `<span class="bonus">+${slot.bonus}%</span>` : ''}
                </div>
                ${slot.staked ? `
                    <p>Gem: ${slot.gemType}</p>
                ` : `
                    <p>Stake a gem to activate</p>
                `}
            </div>
        `).join('');
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

// Initialize trading when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new TradingGame();
    window.tsdgemsGame = game;
});
