// TSDGEMS - Trading Page Script (Backend-Connected)

class TradingGame extends TSDGEMSGame {
    constructor() {
        super();
        this.backendService = window.backendService;
        this.gemPriceChart = null;
        this.cityMatrix = null;
        this.basePriceData = null;
        this.currentActor = null;
        this.refreshInterval = null;
        this.boostsData = null;
        this.chartData = null;
        this.currentChartDays = 30;
        this.stakedGems = {};
        this.inventoryData = null;
        this.polishedGemsCount = {}; // Track polished gems available for trading
        this.init();
    }

    init() {
        this.setupTradingSubpages();
        this.setupChartControls();
        this.setupActorListener();this.loadInitialData();
        this.showNotification('Loading trading markets...', 'info');
        
        // Check if actor is already available after a short delay
        setTimeout(() => {
            if (this.currentActor) {
                console.log('[Trading] Actor detected during init:', this.currentActor);
                this.updateStakingGrid();
            }
        }, 1000);
    }

    setupActorListener() {
        // Listen for actor changes from wallet
        window.addEventListener('walletConnected', (e) => {
            this.currentActor = e.detail.actor;
            console.log('[Trading] Actor connected:', this.currentActor);
            // Load staked gems to show active benefits
            this.loadStakedGems();
            this.loadPolishedGemsCount();
            this.updateStakingGrid();
        });

        window.addEventListener('wallet-session-restored', (e) => {
            this.currentActor = e.detail.actor;
            console.log('[Trading] Actor session restored:', this.currentActor);
            // Load staked gems to show active benefits
            this.loadStakedGems();
            this.loadPolishedGemsCount();
            this.updateStakingGrid();
        });

        window.addEventListener('walletDisconnected', (e) => {
            this.currentActor = null;
            console.log('[Trading] Actor disconnected');
            this.stakedGems = {};
            this.polishedGemsCount = {};
            this.renderActiveBenefits();
            this.updateStakingGrid();
            this.renderCityMatrix(); // Re-render matrix without counts
        });

        // Also check if actor is already set
        if (window.walletSessionInfo && window.walletSessionInfo.actor) {
            this.currentActor = window.walletSessionInfo.actor;
            console.log('[Trading] Actor already set:', this.currentActor);
            // Load staked gems immediately to show active benefits
            this.loadStakedGems();
            this.loadPolishedGemsCount();
            this.updateStakingGrid();
        }
    }

    async loadPolishedGemsCount() {
        if (!this.currentActor) {
            this.polishedGemsCount = {};
            this.renderCityMatrix(); // Re-render without counts
            return;
        }

        try {
            console.log('[Trading] Loading polished gems count...');
            const inventoryData = await this.backendService.getInventory(this.currentActor, false);
            
            // Extract polished gems count (same format as polishing page)
            const POLISHED_GEM_TYPES = [
                'polished_diamond',
                'polished_ruby',
                'polished_emerald',
                'polished_sapphire',
                'polished_topaz',
                'polished_amethyst',
                'polished_aquamarine',
                'polished_jade',
                'polished_opal',
                'polished_tanzanite'
            ];
            
            this.polishedGemsCount = {};
            POLISHED_GEM_TYPES.forEach(gemType => {
                this.polishedGemsCount[gemType] = inventoryData[gemType] || 0;
            });
            
            console.log('[Trading] Polished gems count:', this.polishedGemsCount);
            
            // Re-render the matrix with updated counts
            this.renderCityMatrix();
        } catch (error) {
            console.error('[Trading] Failed to load polished gems count:', error);
            this.polishedGemsCount = {};
        }
    }

    updateStakingGrid() {
        // Re-render staking grid when actor changes
        const stakingSubpage = document.getElementById('trading-subpage-staking');
        if (stakingSubpage && stakingSubpage.classList.contains('active')) {
            this.renderStakingGrid();
        }
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
            }            this.renderBasePriceDisplay();
            this.renderCityMatrix();
            this.initializeGemPriceChart();
            // Don't render staking grid here - will be rendered when actor is set
            
            this.showNotification('Trading markets loaded!', 'success');
            
            // Start auto-refresh for backend data
            this.startAutoRefresh();
            
        } catch (error) {
            console.error('[Trading] Failed to load initial data:', error);
            this.showNotification('Failed to load trading data: ' + error.message, 'error');}
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
                <i class="fab fa-btc"></i> BTC: $${btcPrice.toLocaleString()} (${source})
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
            // Sort gem types by rarity order
            const rarityOrder = [
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
            const orderIndex = (gem) => {
                const key = gem.startsWith('polished_') || gem.startsWith('rough_')
                    ? gem.replace('rough_', 'polished_')
                    : `polished_${gem}`;
                const idx = rarityOrder.indexOf(key);
                return idx === -1 ? 999 : idx;
            };
            gemTypes = Array.from(allGemTypes).sort((a, b) => orderIndex(a) - orderIndex(b));
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
        
        // Header row with gem types and available counts
        gemTypes.forEach(gemType => {
            const availableCount = this.getAvailableGemCount(gemType);
            html += `<th><i class="fas fa-gem"></i> ${this.formatGemName(gemType)}<br><small style="color: #00ff64; font-size: 0.75em;">Own: ${availableCount}</small></th>`;
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

    getAvailableGemCount(gemType) {
        if (!this.polishedGemsCount) return 0;
        
        // Convert gem type to inventory key (e.g., "polished_diamond" -> "polished_diamond")
        const gemKey = `polished_${gemType.replace(/polished_/, '')}`;
        
        return this.polishedGemsCount[gemKey] || 0;
    }

  getCurrentQuote(city, gem, amount) {
        const boost = this.boostsData?.[city]?.[gem] || 0;
        const basePrice = this.basePriceData?.basePrice || 0;
        const gemBoost = this.getGemBoostForType(gem);
        const cityMultiplier = 1 + boost;
        const gemMultiplier = 1 + gemBoost;
        const estimatedPayout = basePrice * cityMultiplier * gemMultiplier * (parseInt(amount) || 1);
        return { basePrice, boost, gemBoost, estimatedPayout };
  }

  async confirmPriceChangeIfNeeded(oldQuote, newQuote) {
        const changed = oldQuote && newQuote && (
            Math.abs(oldQuote.basePrice - newQuote.basePrice) > 1e-9 ||
            Math.abs(oldQuote.boost - newQuote.boost) > 1e-9 ||
            Math.abs(oldQuote.gemBoost - newQuote.gemBoost) > 1e-9
        );
        if (!changed) return true;

        return await new Promise((resolve) => {
            // Build lightweight confirmation modal
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.display = 'flex';
            modal.innerHTML = `
                <div class="modal" style="max-width: 520px;">
                    <div class="modal-header">
                        <h3><i class="fas fa-exclamation-triangle"></i> Price Changed</h3>
                        <button class="modal-close" id="price-change-close"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="modal-body">
                        <p style="color:#ccc; margin-bottom:12px;">The market changed right before your sale. Do you want to proceed with the new conditions?</p>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
                          <div style="color:#888">Old payout</div>
                          <div style="text-align:right; color:#888">${oldQuote.estimatedPayout.toFixed(2)} Game $</div>
                          <div style="color:#fff">New payout</div>
                          <div style="text-align:right; color:#fff">${newQuote.estimatedPayout.toFixed(2)} Game $</div>
                        </div>
                        <div class="payment-actions" style="justify-content:flex-end;">
                          <button class="action-btn secondary" id="price-change-cancel"><i class="fas fa-times"></i> Cancel</button>
                          <button class="action-btn primary" id="price-change-confirm"><i class="fas fa-check"></i> Proceed</button>
                        </div>
                    </div>
                </div>`;
            document.body.appendChild(modal);

            const cleanup = (val) => { modal.remove(); resolve(val); };
            modal.querySelector('#price-change-close')?.addEventListener('click', () => cleanup(false));
            modal.querySelector('#price-change-cancel')?.addEventListener('click', () => cleanup(false));
            modal.querySelector('#price-change-confirm')?.addEventListener('click', () => cleanup(true));
        });
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
                if (gemSelect) gemSelect.dispatchEvent(event);
                
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
        // Prevent multiple initializations
        if (this._sellControlsInitialized) {
            console.log('[Trading] Sell controls already initialized, skipping');
            return;
        }
        this._sellControlsInitialized = true;

        // Remove existing event listeners to prevent duplicates
        const citySelect = document.getElementById('matrix-city-select');
        const gemSelect = document.getElementById('matrix-gem-select');
        const amountInput = document.getElementById('matrix-sell-amount');
        const sellBtn = document.getElementById('matrix-sell-btn');

        // Clone and replace elements to remove all existing event listeners
        if (citySelect) {
            const newCitySelect = citySelect.cloneNode(true);
            citySelect.parentNode.replaceChild(newCitySelect, citySelect);
            const finalCitySelect = document.getElementById('matrix-city-select');
            if (finalCitySelect) finalCitySelect.value = newCitySelect.value;
        }

        if (gemSelect) {
            const newGemSelect = gemSelect.cloneNode(true);
            gemSelect.parentNode.replaceChild(newGemSelect, gemSelect);
            const finalGemSelect = document.getElementById('matrix-gem-select');
            if (finalGemSelect) finalGemSelect.value = newGemSelect.value;
        }

        if (amountInput) {
            const newAmountInput = amountInput.cloneNode(true);
            amountInput.parentNode.replaceChild(newAmountInput, amountInput);
            const finalAmountInput = document.getElementById('matrix-sell-amount');
            if (finalAmountInput) finalAmountInput.value = newAmountInput.value;
        }

        // Store button state before cloning
        let oldButtonState = null;
        if (sellBtn) {
            oldButtonState = {
                disabled: sellBtn.disabled,
                innerHTML: sellBtn.innerHTML,
                opacity: sellBtn.style.opacity
            };
            const newSellBtn = sellBtn.cloneNode(true);
            sellBtn.parentNode.replaceChild(newSellBtn, sellBtn);
        }

        // Re-get references after cloning
        const finalCitySelect = document.getElementById('matrix-city-select');
        const finalGemSelect = document.getElementById('matrix-gem-select');
        const finalAmountInput = document.getElementById('matrix-sell-amount');
        const finalSellBtn = document.getElementById('matrix-sell-btn');

        // Restore button state
        if (finalSellBtn && oldButtonState) {
            finalSellBtn.disabled = oldButtonState.disabled;
            finalSellBtn.innerHTML = oldButtonState.innerHTML;
            finalSellBtn.style.opacity = oldButtonState.opacity;
        }

        const updateSummary = () => {
            const city = finalCitySelect?.value;
            const gem = finalGemSelect?.value;
            const amount = parseInt(finalAmountInput?.value || 1);

            // Update max fill button state
            const maxFillBtn = document.getElementById('matrix-max-fill-btn');
            if (maxFillBtn) {
                const hasGemSelected = !!gem;
                const hasGemsAvailable = hasGemSelected && (this.polishedGemsCount[gem] || 0) > 0;
                maxFillBtn.disabled = !hasGemsAvailable;
                maxFillBtn.style.opacity = hasGemsAvailable ? '1' : '0.5';
                maxFillBtn.style.cursor = hasGemsAvailable ? 'pointer' : 'not-allowed';
            }

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
            
            // Get gem boost from staked gems
            const gemBoost = this.getGemBoostForType(gem);
            
            // boost is already a decimal (0.019 = 1.9%), gemBoost is also decimal (0.05 = 5%)
            const cityMultiplier = 1 + boost;
            const gemMultiplier = 1 + gemBoost;
            const estimatedPayout = basePrice * cityMultiplier * gemMultiplier * amount;

            // Update summary
            const boostEl = document.getElementById('matrix-summary-boost');
            const stakingEl = document.getElementById('matrix-summary-staking');
            const priceEl = document.getElementById('matrix-summary-price');

            if (boostEl) boostEl.textContent = `City Boost: +${(boost * 100).toFixed(1)}%`;
            if (stakingEl) stakingEl.textContent = `Gem Staking Bonus: +${(gemBoost * 100).toFixed(0)}%`;
            if (priceEl) priceEl.textContent = `Est. Payout: ${estimatedPayout.toFixed(2)} Game $`;
        };

        if (finalCitySelect) finalCitySelect.addEventListener('change', updateSummary);
        if (finalGemSelect) {
            finalGemSelect.addEventListener('change', () => {
                console.log('[Trading] Gem type changed, resetting amount to 1');
                // Reset amount to 1 when gem type changes
                if (finalAmountInput) {
                    finalAmountInput.value = 1;
                }
                updateSummary();
            });
        }
        if (finalAmountInput) finalAmountInput.addEventListener('input', updateSummary);

        // Max fill button
        const maxFillBtn = document.getElementById('matrix-max-fill-btn');
        if (maxFillBtn) {
            maxFillBtn.addEventListener('click', () => {
                const gem = finalGemSelect?.value;
                if (!gem) {
                    this.showNotification('Please select a gem type first!', 'warning');
                    return;
                }

                const maxAmount = this.polishedGemsCount[gem] || 0;
                if (maxAmount === 0) {
                    this.showNotification('No gems of this type available!', 'warning');
                    return;
                }

                if (finalAmountInput) {
                    finalAmountInput.value = maxAmount;
                    // Trigger the summary update
                    updateSummary();
                }
            });
        }

        if (finalSellBtn) {
            finalSellBtn.addEventListener('click', async () => {
                const city = finalCitySelect?.value;
                const gem = finalGemSelect?.value;
                const amount = parseInt(finalAmountInput?.value);

                if (!city || !gem || !amount) {
                    this.showNotification('Please select a city, gem type, and amount!', 'warning');
                    return;
                }

                if (!this.currentActor) {
                    this.showNotification('Please connect your wallet first', 'error');
                    return;
                }

                // Capture current quote before refreshing
                const oldQuote = this.getCurrentQuote(city, gem, amount);

                // Fetch latest price/boost to detect changes
                try {
                    const [freshBasePrice, freshMatrix] = await Promise.all([
                        this.backendService.getBasePrice(),
                        this.backendService.getCityMatrix()
                    ]);

                    // Update local caches
                    this.basePriceData = freshBasePrice;
                    if (freshMatrix && freshMatrix.boosts) {
                        let boosts = freshMatrix.boosts;
                        if (Array.isArray(boosts)) {
                            const obj = {}; boosts.forEach(c => c?.id && (obj[c.id] = c.bonuses)); boosts = obj;
                        }
                        this.boostsData = boosts;
                    }

                    const newQuote = this.getCurrentQuote(city, gem, amount);

                    const changed = Math.abs(newQuote.estimatedPayout - oldQuote.estimatedPayout) > 0.0001;

                    const proceed = await this.confirmPriceChangeIfNeeded(oldQuote, newQuote);
                    if (!proceed) return;

                    this.setSellButtonLoading(true, finalSellBtn);
                    await this.handleGemSale(city, gem, amount);
                } catch (error) {
                    console.error('[Trading] Error before selling:', error);
                    this.showNotification('Failed to prepare sale: ' + error.message, 'error');
                } finally {
                    this.setSellButtonLoading(false, finalSellBtn);
                }
            });
        }

        // Initial update
        updateSummary();
    }

    updateSellControls() {
        // Only update the UI state without re-attaching event listeners
        const gemSelect = document.getElementById('matrix-gem-select');
        const amountInput = document.getElementById('matrix-sell-amount');

        // Update the max fill button state
        const maxFillBtn = document.getElementById('matrix-max-fill-btn');
        if (maxFillBtn && gemSelect) {
            const gem = gemSelect.value;
            const hasGemSelected = !!gem;
            const hasGemsAvailable = hasGemSelected && (this.polishedGemsCount[gem] || 0) > 0;
            maxFillBtn.disabled = !hasGemsAvailable;
            maxFillBtn.style.opacity = hasGemsAvailable ? '1' : '0.5';
            maxFillBtn.style.cursor = hasGemsAvailable ? 'pointer' : 'not-allowed';
        }

        // Update the summary display
        const updateSummary = () => {
            const citySelect = document.getElementById('matrix-city-select');
            const finalGemSelect = document.getElementById('matrix-gem-select');
            const finalAmountInput = document.getElementById('matrix-sell-amount');
            const city = citySelect?.value;
            const gem = finalGemSelect?.value;
            const amount = parseInt(finalAmountInput?.value || 1);

            // Update max fill button state
            const maxFillBtn = document.getElementById('matrix-max-fill-btn');
            if (maxFillBtn) {
                const hasGemSelected = !!gem;
                const hasGemsAvailable = hasGemSelected && (this.polishedGemsCount[gem] || 0) > 0;
                maxFillBtn.disabled = !hasGemsAvailable;
                maxFillBtn.style.opacity = hasGemsAvailable ? '1' : '0.5';
                maxFillBtn.style.cursor = hasGemsAvailable ? 'pointer' : 'not-allowed';
            }

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

            // Get gem boost from staked gems
            const gemBoost = this.getGemBoostForType(gem);

            // boost is already a decimal (0.019 = 1.9%), gemBoost is also decimal (0.05 = 5%)
            const cityMultiplier = 1 + boost;
            const gemMultiplier = 1 + gemBoost;
            const estimatedPayout = basePrice * cityMultiplier * gemMultiplier * amount;

            // Update summary
            const boostEl = document.getElementById('matrix-summary-boost');
            const stakingEl = document.getElementById('matrix-summary-staking');
            const priceEl = document.getElementById('matrix-summary-price');

            if (boostEl) boostEl.textContent = `City Boost: +${(boost * 100).toFixed(1)}%`;
            if (stakingEl) stakingEl.textContent = `Gem Staking Bonus: +${(gemBoost * 100).toFixed(0)}%`;
            if (priceEl) priceEl.textContent = `Est. Payout: ${estimatedPayout.toFixed(2)} Game $`;
        };

        updateSummary();
    }

    setSellButtonLoading(isLoading, sellBtn = null) {
        if (!sellBtn) {
            sellBtn = document.getElementById('matrix-sell-btn');
        }
        if (!sellBtn) return;
        
        if (isLoading) {
            // Disable button and show loading animation
            sellBtn.disabled = true;
            sellBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Selling...';
            sellBtn.style.opacity = '0.7';
            sellBtn.style.cursor = 'not-allowed';
        } else {
            // Re-enable button and restore original content
            sellBtn.disabled = false;
            sellBtn.innerHTML = '<i class="fas fa-coins"></i> Sell Gems';
            sellBtn.style.opacity = '1';
            sellBtn.style.cursor = 'pointer';
        }
    }

    async initializeGemPriceChart() {
        const chartCanvas = document.getElementById('gem-price-chart');
        const status = document.getElementById('pricing-status');
        if (!chartCanvas || !status) return;

        // Destroy existing chart if it exists
        if (this.gemPriceChart) {
            this.gemPriceChart.destroy();
        }

        // Load chart data from API
        status.textContent = 'Loading chart data...';
        try {
            await this.loadChartData(this.currentChartDays);
        } catch (error) {
            console.error('[Trading] Failed to load chart data:', error);
            status.textContent = 'Failed to load chart data: ' + error.message;
            return;
        }

        const ctx = chartCanvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, chartCanvas.offsetHeight || 320);
        gradient.addColorStop(0, 'rgba(0, 212, 255, 0.35)');
        gradient.addColorStop(1, 'rgba(0, 212, 255, 0)');

        // Prepare chart data from API response
        let labels = [];
        let dataPoints = [];
        let btcDataPoints = [];

        if (this.chartData && this.chartData.points && Array.isArray(this.chartData.points)) {
            // chartData.points is [{t: ms, btcUsd: number, basePrice: number}, ...]
            const points = this.chartData.points;
            
            labels = points.map(point => {
                const date = new Date(point.t);
                // Format based on time range
                if (this.currentChartDays <= 1) {
                    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                } else if (this.currentChartDays <= 7) {
                    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' });
                } else {
                    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
                }
            });
            
            dataPoints = points.map(point => point.basePrice);
            btcDataPoints = points.map(point => point.btcUsd);
        }

        this.gemPriceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Gem Base Price (Game $)',
                    data: dataPoints,
                    borderColor: '#00d4ff',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    tension: 0.25,
                    pointRadius: dataPoints.length > 100 ? 0 : 2,
                    fill: true,
                    yAxisID: 'y'
                }, {
                    label: 'Bitcoin Price (USD)',
                    data: btcDataPoints,
                    borderColor: '#f7931a',
                    backgroundColor: 'rgba(247, 147, 26, 0.1)',
                    borderWidth: 1,
                    tension: 0.25,
                    pointRadius: 0,
                    fill: false,
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        ticks: { 
                            color: '#a0a0a0',
                            maxTicksLimit: 10
                        },
                        grid: { display: false }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Gem Base Price (Game $)',
                            color: '#00d4ff'
                        },
                        ticks: { color: '#00d4ff' },
                        grid: { color: 'rgba(0, 212, 255, 0.1)' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'BTC Price (USD)',
                            color: '#f7931a'
                        },
                        ticks: { color: '#f7931a' },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#ffffff' }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    if (context.datasetIndex === 0) {
                                        label += context.parsed.y.toFixed(2) + ' Game $';
                                    } else {
                                        label += '$' + context.parsed.y.toLocaleString();
                                    }
                                }
                                return label;
                            }
                        }
                    }
                }
            }
        });

        // Update status with current data info
        if (this.chartData && this.chartData.points && this.chartData.points.length > 0) {
            const latestPoint = this.chartData.points[this.chartData.points.length - 1];
            const date = new Date(latestPoint.t);
            status.textContent = `Showing ${this.chartData.days} day${this.chartData.days > 1 ? 's' : ''} of data | ${this.chartData.points.length} data points | Latest: ${latestPoint.basePrice.toFixed(2)} Game $ @ ${date.toLocaleString()}`;
        } else {
            status.textContent = 'Chart initialized - no data available';
        }
    }

    async loadChartData(days = 30) {
        try {
            console.log('[Trading] Loading chart data for', days, 'days...');
            this.chartData = await this.backendService.getChartData(days);
            console.log('[Trading] Chart data loaded:', this.chartData);
            this.currentChartDays = days;
            return this.chartData;
        } catch (error) {
            console.error('[Trading] Failed to load chart data:', error);
            throw error;
        }
    }

    async updateChartTimeframe(days) {
        const status = document.getElementById('pricing-status');
        if (status) {
            status.textContent = `Loading ${days} day${days > 1 ? 's' : ''} of data...`;
        }
        
        this.currentChartDays = days;
        await this.initializeGemPriceChart();
    }

    setupChartControls() {
        const timeframeSelect = document.getElementById('chart-timeframe-select');
        const refreshBtn = document.getElementById('chart-refresh-btn');

        if (timeframeSelect) {
            timeframeSelect.addEventListener('change', async (e) => {
                const days = e.target.value;
                console.log('[Trading] Chart timeframe changed to:', days);
                try {
                    await this.updateChartTimeframe(days);
                    this.showNotification(`Chart updated to ${days} day${days > 1 ? 's' : ''}`, 'success');
                } catch (error) {
                    console.error('[Trading] Failed to update chart:', error);
                    this.showNotification('Failed to update chart: ' + error.message, 'error');
                }
            });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                console.log('[Trading] Refreshing chart data...');
                const icon = refreshBtn.querySelector('i');
                if (icon) {
                    icon.classList.add('fa-spin');
                }
                
                try {
                    await this.updateChartTimeframe(this.currentChartDays);
                    this.showNotification('Chart refreshed successfully!', 'success');
                } catch (error) {
                    console.error('[Trading] Failed to refresh chart:', error);
                    this.showNotification('Failed to refresh chart: ' + error.message, 'error');
                } finally {
                    if (icon) {
                        icon.classList.remove('fa-spin');
                    }
                }
            });

            // Hover effect
            refreshBtn.addEventListener('mouseenter', () => {
                refreshBtn.style.background = '#00a8cc';
            });
            refreshBtn.addEventListener('mouseleave', () => {
                refreshBtn.style.background = '#00d4ff';
            });
        }
    }

    setupTradingSubpages() {
        const subpageToggle = document.getElementById('trading-subpage-toggle');
        if (!subpageToggle) return;

        subpageToggle.addEventListener('click', async (event) => {
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

            // Load specific data when switching to staking page
            if (target === 'staking') {
                await this.renderStakingGrid();
            }
        });
    }

    async renderStakingGrid() {
        const stakingGrid = document.getElementById('staking-grid');
        if (!stakingGrid) return;

        // Load staked gems if we have an actor
        if (this.currentActor) {
            await this.loadStakedGems();
        } else {
            // Clear staked gems if no actor
            this.stakedGems = {};
        }

        stakingGrid.innerHTML = `
            <div class="staking-slots-container">
                ${Array.from({length: 10}, (_, i) => i + 1).map(slotNum => {
                    const slot = this.stakedGems[`slot${slotNum}`] || null;
                    return this.renderGemStakingSlot(slotNum, slot);
                }).join('')}
            </div>
        `;
    }

    getSlotGemType(slotNum) {
        const slotGemTypes = {
            1: 'Diamond',
            2: 'Ruby', 
            3: 'Sapphire',
            4: 'Emerald',
            5: 'Jade',
            6: 'Tanzanite',
            7: 'Opal',
            8: 'Aquamarine',
            9: 'Topaz',
            10: 'Amethyst'
        };
        return slotGemTypes[slotNum] || 'Unknown';
    }

    getGemColor(gemType) {
        const gemColors = {
            'Diamond': '#b9f2ff',
            'Ruby': '#ff6b9d',
            'Sapphire': '#4169e1',
            'Emerald': '#50c878',
            'Jade': '#00a86b',
            'Tanzanite': '#5d3fd3',
            'Opal': '#a8c3bc',
            'Aquamarine': '#7fffd4',
            'Topaz': '#ffc87c',
            'Amethyst': '#9966cc'
        };
        return gemColors[gemType] || '#ffffff';
    }

    renderGemStakingSlot(slotNum, slotData) {
        const expectedGemType = this.getSlotGemType(slotNum);
        const gemColor = this.getGemColor(expectedGemType);
        
        if (!slotData) {
            // Empty slot - show stake button or connect wallet message
            if (!this.currentActor) {
                return `
                    <div id="gem-slot-${slotNum}" class="gem-staking-slot empty" style="border-color: ${gemColor};">
                        <div class="slot-number" style="color: ${gemColor};">${expectedGemType}</div>
                        <div class="slot-placeholder">
                            <i class="fas fa-wallet fa-3x" style="opacity: 0.3; color: ${gemColor};"></i>
                            <p>Connect Wallet</p>
                            <small>Connect your wallet to stake gems</small>
                        </div>
                        <button class="action-btn primary" disabled style="border-color: ${gemColor};">
                            <i class="fas fa-lock"></i> Connect Wallet First
                        </button>
                    </div>
                `;
            }
            
            return `
                <div id="gem-slot-${slotNum}" class="gem-staking-slot empty" style="border-color: ${gemColor};">
                    <div class="slot-number" style="color: ${gemColor};">${expectedGemType}</div>
                    <div class="slot-placeholder">
                        <i class="fas fa-gem fa-3x" style="opacity: 0.3; color: ${gemColor};"></i>
                        <p style="color: ${gemColor};">Empty Slot</p>
                        <small>Stake ${expectedGemType} NFTs here</small>
                    </div>
                    <button class="action-btn primary" onclick="game.openGemStakingModal(${slotNum})" style="background: linear-gradient(135deg, ${gemColor}, ${gemColor}dd); border-color: ${gemColor};">
                        <i class="fas fa-plus"></i> Stake ${expectedGemType}
                    </button>
                </div>
            `;
        }

        // Staked slot - show gem and bonus
        const gem = slotData.gem;
        return `
            <div id="gem-slot-${slotNum}" class="gem-staking-slot staked" style="border: 2px solid ${gemColor}; box-shadow: 0 0 20px ${gemColor}33;">
                <div class="slot-header">
                    <span class="slot-number" style="color: ${gemColor};">${expectedGemType}</span>
                    <span class="gem-type-badge" style="background: ${gemColor}33; color: ${gemColor}; border-color: ${gemColor}55;">${gem.isPolished ? 'Polished' : 'Rough'}</span>
                </div>
                <div class="gem-display" style="background-image: url('${gem.imagePath}'); background-size: cover; background-position: center; background-repeat: no-repeat;">
                    <h4 style="color: ${gemColor};">${gem.name}</h4>
                    <div class="bonus-indicator" style="background: linear-gradient(135deg, ${gemColor}, ${gemColor}cc); color: #000;">
                        <i class="fas fa-arrow-up"></i> +${(gem.bonus * 100).toFixed(0)}% Selling Bonus
            </div>
                </div>
                <button class="action-btn danger" onclick="game.unstakeGem(${slotNum}, '${gem.asset_id}')" style="border-color: #ff4444;">
                    <i class="fas fa-times"></i> Unstake
                </button>
            </div>
        `;
    }

    // ========================================
    // GEM STAKING METHODS
    // ========================================

    async loadStakedGems() {
        if (!this.currentActor) return;
        
        try {
            console.log('[Trading] Loading staked gems for', this.currentActor);
            this.stakedGems = await this.backendService.getStakedGems(this.currentActor);
            console.log('[Trading] Loaded staked gems:', this.stakedGems);
            
            // Update active benefits display
            this.renderActiveBenefits();
        } catch (error) {
            console.error('[Trading] Failed to load staked gems:', error);
            this.stakedGems = {};
        }
    }

    renderActiveBenefits() {
        const benefitsDisplay = document.getElementById('benefits-display');
        if (!benefitsDisplay) return;

        if (!this.currentActor) {
            benefitsDisplay.innerHTML = `
                <p style="color: #888;">Connect your wallet to view your active benefits</p>
            `;
            return;
        }

        // Collect all active gem bonuses
        const activeBonuses = [];
        Object.entries(this.stakedGems).forEach(([slotKey, slotData]) => {
            if (slotData && slotData.gem) {
                const gem = slotData.gem;
                activeBonuses.push({
                    gemType: gem.gemType,
                    bonus: gem.bonus,
                    isPolished: gem.isPolished,
                    name: gem.name,
                    imagePath: gem.imagePath
                });
            }
        });

        if (activeBonuses.length === 0) {
            benefitsDisplay.innerHTML = `
                <p style="color: #888;">
                    <i class="fas fa-info-circle"></i> No active gem staking bonuses. 
                    Stake gems in the "Gems Staking" tab to unlock selling bonuses!
                </p>
            `;
            return;
        }

        // Render active bonuses
        benefitsDisplay.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px;">
                ${activeBonuses.map(bonus => {
                    const gemColor = this.getGemColor(bonus.gemType);
                    return `
                        <div style="background-image: url('${bonus.imagePath}'); background-size: cover; background-position: center; background-repeat: no-repeat; border: 2px solid ${gemColor}; border-radius: 8px; padding: 15px; text-align: center; min-height: 200px; position: relative; overflow: hidden; background-color: rgba(0, 0, 0, 0.4); background-blend-mode: overlay; display: flex; flex-direction: column; justify-content: space-between;">
                            <div style="position: relative; z-index: 2;">
                                <h4 style="color: ${gemColor}; margin: 5px 0; font-size: 0.95em; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);">${bonus.gemType}</h4>
                                <p style="color: #fff; font-size: 0.85em; margin: 5px 0; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);">${bonus.isPolished ? 'Polished' : 'Rough'}</p>
                            </div>
                            <div style="position: relative; z-index: 2; margin-top: auto;">
                                <div style="background: linear-gradient(135deg, ${gemColor}, ${gemColor}cc); color: #000; padding: 6px 10px; border-radius: 6px; font-weight: bold; font-size: 0.9em; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);">
                                    <i class="fas fa-arrow-up"></i> +${(bonus.bonus * 100).toFixed(0)}% Selling Bonus
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    async openGemStakingModal(slotNum) {
        console.log(`[Trading] openGemStakingModal called for slot ${slotNum}`);
        
        if (!this.currentActor) {
            console.error('[Trading] No actor connected');
            this.showNotification('Please connect your wallet first', 'error');
            return;
        }

        try {
            const expectedGemType = this.getSlotGemType(slotNum);
            console.log(`[Trading] Expected gem type: ${expectedGemType}`);

            // Load inventory data if not already loaded
            if (!this.inventoryData) {
                console.log('[Trading] Loading inventory data...');
                this.inventoryData = await this.backendService.getInventory(this.currentActor);
                console.log('[Trading] Inventory data loaded');
            }

            // Get gem NFTs from inventory
            const gemNFTs = this.extractGemNFTsFromInventory();
            console.log(`[Trading] Found ${gemNFTs.length} total gem NFTs in inventory`);
            
            // Filter for the expected gem type only
            const typeGems = gemNFTs.filter(nft => nft.gemType === expectedGemType);
            console.log(`[Trading] Found ${typeGems.length} ${expectedGemType} NFTs`);
            
            // Filter out already staked gems
            const stakedAssetIds = this.getStakedAssetIds();
            console.log(`[Trading] ${stakedAssetIds.size} gems currently staked`);
            const availableGems = typeGems.filter(nft => !stakedAssetIds.has(nft.asset_id));
            console.log(`[Trading] ${availableGems.length} ${expectedGemType} NFTs available for staking`);

            if (availableGems.length === 0) {
                if (typeGems.length === 0) {
                    console.log(`[Trading] User owns no ${expectedGemType} NFTs`);
                    this.showNotification(`You don't own any ${expectedGemType} NFTs`, 'warning');
                } else {
                    console.log(`[Trading] All ${expectedGemType} NFTs are already staked`);
                    this.showNotification(`All your ${expectedGemType} NFTs are already staked`, 'warning');
                }
                return;
            }

            console.log(`[Trading] Opening modal with ${availableGems.length} gems`);
            this.showGemStakingModal(slotNum, availableGems);
        } catch (error) {
            console.error('[Trading] Error in openGemStakingModal:', error);
            this.showNotification('Failed to load gems: ' + error.message, 'error');
        }
    }

    extractGemNFTsFromInventory() {
        const gemNFTs = [];
        
        if (!this.inventoryData) {
            console.log('[Trading] No inventory data available');
            return gemNFTs;
        }

        // Gem Type Mapping (support both string and number keys)
        const GEM_TYPE_MAP = {
            // Polished
            '894387': 'Diamond', '894388': 'Ruby', '894389': 'Sapphire', '894390': 'Emerald',
            '894391': 'Jade', '894392': 'Tanzanite', '894393': 'Opal', '894394': 'Aquamarine',
            '894395': 'Topaz', '894396': 'Amethyst',
            // Rough
            '894397': 'Diamond', '894398': 'Ruby', '894399': 'Sapphire', '894400': 'Emerald',
            '894401': 'Jade', '894402': 'Tanzanite', '894403': 'Opal', '894404': 'Aquamarine',
            '894405': 'Topaz', '894406': 'Amethyst'
        };

        console.log('[Trading] Extracting gem NFTs from inventory...');
        console.log('[Trading] Available inventory keys:', Object.keys(this.inventoryData));
        
        // Process polished gems from polishedDetails
        if (this.inventoryData.polishedDetails) {
            console.log('[Trading] Processing polished gems...');
            Object.entries(this.inventoryData.polishedDetails).forEach(([templateId, details]) => {
                const gemType = GEM_TYPE_MAP[templateId];
                if (gemType && details.assets) {
                    console.log(`[Trading] Found ${details.assets.length}x Polished ${gemType} NFTs (template ${templateId})`);
                    details.assets.forEach(assetId => {
                        gemNFTs.push({
                            asset_id: assetId,
                            template_id: templateId,
                            name: details.name,
                            gemType: gemType,
                            isPolished: true,
                            imagePath: details.imagePath || `assets/gallery_images/${details.image || '(1).png'}`
                        });
                    });
                }
            });
        }
        
        // Process rough gems from roughDetails
        if (this.inventoryData.roughDetails) {
            console.log('[Trading] Processing rough gems...');
            Object.entries(this.inventoryData.roughDetails).forEach(([templateId, details]) => {
                const gemType = GEM_TYPE_MAP[templateId];
                if (gemType && details.assets) {
                    console.log(`[Trading] Found ${details.assets.length}x Rough ${gemType} NFTs (template ${templateId})`);
                    details.assets.forEach(assetId => {
                        gemNFTs.push({
                            asset_id: assetId,
                            template_id: templateId,
                            name: details.name,
                            gemType: gemType,
                            isPolished: false,
                            imagePath: details.imagePath || `assets/gallery_images/${details.image || '(1).png'}`
                        });
                    });
                }
            });
        }

        console.log(`[Trading] Total gem NFTs extracted: ${gemNFTs.length}`);
        return gemNFTs;
    }

    getStakedAssetIds() {
        const stakedAssetIds = new Set();
        Object.values(this.stakedGems).forEach(slotData => {
            if (slotData.gem && slotData.gem.asset_id) {
                stakedAssetIds.add(slotData.gem.asset_id);
            }
        });
        return stakedAssetIds;
    }

    showGemStakingModal(slotNum, availableGems) {
        console.log(`[Trading] showGemStakingModal called with ${availableGems.length} gems`);
        
        // Remove existing modal if present
        const existingModal = document.getElementById('gem-staking-modal');
        if (existingModal) {
            console.log('[Trading] Removing existing modal');
            existingModal.remove();
        }
        
        const expectedGemType = this.getSlotGemType(slotNum);

        const modalHTML = `
            <div class="modal-overlay" id="gem-staking-modal" style="display: flex; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8); z-index: 10000; align-items: center; justify-content: center; overflow-y: auto; padding: 2rem 0;">
                <div class="modal-content" style="background: rgba(20, 20, 30, 0.95); border: 2px solid #00d4ff; border-radius: 12px; padding: 30px; max-width: 800px; width: 90%; max-height: calc(100vh - 4rem); overflow-y: auto;">
                    <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h3 style="color: #00d4ff; margin: 0;">Stake ${expectedGemType} - Slot ${slotNum}</h3>
                        <button class="close-btn" onclick="game.closeGemStakingModal()" style="background: transparent; border: none; color: #fff; font-size: 2em; cursor: pointer; padding: 0; width: 40px; height: 40px;">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p style="color: #888; margin-bottom: 20px;">
                            Select a ${expectedGemType} gem to stake in slot ${slotNum}. Staked gems provide selling bonuses for their specific type.
                        </p>
                        <div class="gem-selection-grid">
                            <div class="gem-type-group">
                                <h4 style="color: #00d4ff; margin-bottom: 15px;">${expectedGemType} NFTs (${availableGems.length} available)</h4>
                                <div class="gem-cards" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px;">
                                    ${availableGems.map(gem => `
                                        <div class="gem-card" onclick="game.stakeGemToSlot(${slotNum}, '${gem.asset_id}', ${gem.template_id}, '${gem.name}', '${gem.gemType}', '${gem.imagePath}')" style="background: rgba(0, 0, 0, 0.4); border: 2px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 15px; text-align: center; cursor: pointer; transition: all 0.3s;">
                                            <img src="${gem.imagePath}" alt="${gem.name}" onerror="this.src='assets/gallery_images/(1).png'" style="width: 100%; height: 120px; object-fit: cover; border-radius: 4px; margin-bottom: 10px;">
                                            <p style="color: #fff; margin: 5px 0; font-weight: 600;">${gem.name}</p>
                                            <small style="color: #888;">ID: ${gem.asset_id}</small>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        console.log('[Trading] Inserting modal HTML into body');
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        console.log('[Trading] Modal inserted, checking if visible');
        const insertedModal = document.getElementById('gem-staking-modal');
        if (insertedModal) {
            console.log('[Trading] Modal element found in DOM');
            // Scroll to center the modal in viewport
            setTimeout(() => {
                const modalContent = insertedModal.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                }
            }, 50);
        } else {
            console.error('[Trading] Modal element NOT found in DOM after insertion!');
        }
    }

    async stakeGemToSlot(slotNum, assetId, templateId, name, gemType, imagePath) {
        try {
            console.log(`[Trading] Staking gem ${assetId} to slot ${slotNum}`);
            
            // Close modal first
            this.closeGemStakingModal();
            
            // Show loading state in the slot
            this.showSlotLoading(slotNum, name);
            
            // Now do the actual backend call
            const result = await this.backendService.stakeGem(this.currentActor, slotNum, {
                asset_id: assetId,
                template_id: templateId,
                name: name,
                imagePath: imagePath
            });

            if (result.success) {
                // Update with actual backend data
                await this.loadStakedGems();
                await this.renderStakingGrid();
                this.showNotification(`✅ Staked ${name} to Slot ${slotNum}!`, 'success');
            } else {
                // Revert on failure
                await this.renderStakingGrid();
                this.showNotification('Failed to stake gem', 'error');
            }
        } catch (error) {
            console.error('[Trading] Failed to stake gem:', error);
            // Revert on error
            this.stakedGems[`slot${slotNum}`] = null;
            await this.renderStakingGrid();
            this.showNotification('Failed to stake gem: ' + error.message, 'error');
        }
    }

    showSlotLoading(slotNum, gemName) {
        const slotElement = document.querySelector(`#gem-slot-${slotNum}`);
        if (slotElement) {
            slotElement.innerHTML = `
                <div style="position: relative; width: 100%; height: 100%; min-height: 220px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px;">
                    <div class="loading-spinner" style="font-size: 3em; color: #00d4ff; animation: spin 1s linear infinite; margin-bottom: 20px;">
                        <i class="fas fa-circle-notch"></i>
                    </div>
                    <p style="color: #00d4ff; font-weight: 600; font-size: 1.1em; margin: 0;">Staking ${gemName}...</p>
                    <p style="color: #888; font-size: 0.9em; margin-top: 5px;">Please wait</p>
                    <style>
                        @keyframes spin {
                            from { transform: rotate(0deg); }
                            to { transform: rotate(360deg); }
                        }
                    </style>
                </div>
            `;
        }
    }
    
    async unstakeGem(slotNum, assetId) {
        try {
            console.log(`[Trading] Unstaking gem ${assetId} from slot ${slotNum}`);
            
            // Store current value for reverting on error
            const previousSlotData = this.stakedGems[`slot${slotNum}`];
            
            // Optimistic UI update - remove from local state immediately
            this.stakedGems[`slot${slotNum}`] = null;
            await this.renderStakingGrid();
            this.showNotification('Unstaking gem...', 'info');
            
            // Now do the actual backend call
            const result = await this.backendService.unstakeGem(this.currentActor, slotNum, assetId);

            if (result.success) {
                // Update with actual backend data
                await this.loadStakedGems();
                await this.renderStakingGrid();
                this.showNotification(`✅ Unstaked gem from Slot ${slotNum}!`, 'success');
            } else {
                // Revert on failure
                this.stakedGems[`slot${slotNum}`] = previousSlotData;
                await this.renderStakingGrid();
                this.showNotification('Failed to unstake gem', 'error');
            }
        } catch (error) {
            console.error('[Trading] Failed to unstake gem:', error);
            // Revert on error
            const previousSlotData = this.stakedGems[`slot${slotNum}`] ? null : previousSlotData;
            this.stakedGems[`slot${slotNum}`] = previousSlotData;
            await this.renderStakingGrid();
            this.showNotification('Failed to unstake gem: ' + error.message, 'error');
        }
    }

    closeGemStakingModal() {
        const modal = document.getElementById('gem-staking-modal');
        if (modal) {
            modal.remove();
        }
    }

    // ========================================
    // GEM SELLING METHODS
    // ========================================

    getGemBoostForType(gemType) {
        // Convert gemType from "polished_amethyst" to "Amethyst"
        let cleanGemType = gemType.replace('polished_', '').replace('rough_', '');
        cleanGemType = cleanGemType.charAt(0).toUpperCase() + cleanGemType.slice(1).toLowerCase();
        
        console.log(`[Trading] Looking for gem boost: ${gemType} → ${cleanGemType}`);
        
        // Search through staked gems for the requested gem type
        for (const [slotKey, slotData] of Object.entries(this.stakedGems)) {
            if (slotData && slotData.gem && slotData.gem.gemType === cleanGemType) {
                console.log(`[Trading] Found staked ${cleanGemType} with ${slotData.gem.bonus * 100}% bonus`);
                return slotData.gem.bonus || 0;
            }
        }
        
        console.log(`[Trading] No staked ${cleanGemType} found`);
        return 0;
    }

    async handleGemSale(cityId, gemType, amount, expectedQuote = null) {
        try {
            console.log(`[Trading] Selling ${amount}x ${gemType} in ${cityId} for ${this.currentActor}`);
            
            // Backend now accepts both formats (polished_emerald or Emerald)
            const payloadExpected = expectedQuote ? {
                basePrice: this.basePriceData?.basePrice || 0,
                cityBoost: this.boostsData?.[cityId]?.[gemType] || 0,
                gemBoost: this.getGemBoostForType(gemType),
                totalPayout: Math.floor((expectedQuote.estimatedPayout || 0))
            } : undefined;

            let result;
            try {
                result = await this.backendService.sellGems(this.currentActor, gemType, amount, cityId, payloadExpected);
            } catch (e) {
                // Handle 409 price_changed from backend
                if (e && e.status === 409 && e.data?.error === 'price_changed') {
                    const server = e.data.server || {};
                    const client = e.data.client || {};
                    const proceed = await this.confirmPriceChangeIfNeeded(
                        { estimatedPayout: client.totalPayout || 0, basePrice: client.basePrice, boost: client.cityBoostDecimal, gemBoost: client.gemBoost },
                        { estimatedPayout: server.totalPayout || 0, basePrice: server.basePrice, boost: server.cityBoostDecimal, gemBoost: server.gemBoost }
                    );
                    if (!proceed) return;
                    // Retry without expectation (accept server state)
                    result = await this.backendService.sellGems(this.currentActor, gemType, amount, cityId);
                } else {
                    throw e;
                }
            }
            
            if (result.success) {
                // Post-verify payout matches expected (if provided)
                if (expectedQuote) {
                    const expectedRounded = Math.floor(expectedQuote.estimatedPayout);
                    if (Math.abs((result.totalPayout || 0) - expectedRounded) !== 0) {
                        console.warn('[Trading] Payout mismatch. expected=', expectedRounded, 'actual=', result.totalPayout);
                    }
                }
                // Format gem name nicely
                const gemName = this.formatGemName(gemType);
                
                this.showNotification(
                    `💰 Sold ${amount}x ${gemName} for ${result.totalPayout.toFixed(2)} Game $! (+${result.totalPayout.toFixed(2)} Game $)`, 
                    'success'
                );
                
                // Refresh displays
                await this.loadPlayerData();
                await this.loadStakedGems();
                await this.loadPolishedGemsCount(); // Refresh available gems count
                
                console.log('[Trading] Updated Game $:', result.totalPayout);
                
                // Update summary to reflect new boost calculations
                this.updateSellControls();
            }
        } catch (error) {
            console.error('[Trading] Failed to sell gems:', error);
            this.showNotification(`Failed to sell gems: ${error.message}`, 'error');
        }
    }

    async loadPlayerData() {
        if (!this.currentActor) return;
        
        try {
            const dashboardData = await this.backendService.getDashboard(this.currentActor);
            console.log('[Trading] Dashboard data loaded:', dashboardData);
            
            if (dashboardData && dashboardData.profile) {
                const currency = dashboardData.profile.ingameCurrency || 0;
                console.log('[Trading] Updating header with new currency:', currency);
                
                // Dispatch global event to update Game $ with animation
                window.dispatchEvent(new CustomEvent('gameDollars:update', {
                    detail: { amount: currency, animate: true }
                }));
                console.log('[Trading] Dispatched gameDollars:update event');
            } else {
                console.warn('[Trading] No profile data in dashboard response');
            }
        } catch (error) {
            console.error('[Trading] Failed to load player data:', error);
        }
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
    window.game = game; // Make globally accessible for onclick handlers
});
