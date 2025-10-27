// TSDGEMS - Backend Service
// Zentrale Kommunikation mit Firebase Functions

// Backend API Base URL (Firebase Functions)
// Auto-detect local emulator or use production
// For local: use empty string to use hosting rewrites on port 5000
// For production: use full CloudFunctions URL
const IS_LOCALHOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = IS_LOCALHOST 
    ? ''  // Use hosting rewrites (same origin, port 5000)
    : 'https://us-central1-tsdgems-trading.cloudfunctions.net';

console.log('[Backend] API Base URL:', API_BASE || 'Using hosting rewrites', '(Localhost:', IS_LOCALHOST, ')');

class BackendService {
    constructor() {
        this.currentActor = null;
        this.dashboardData = null;
        this.cityMatrix = null;
        this.basePriceData = null;
        this.apiBase = API_BASE;
        
        console.log('[Backend] Backend Service initialized with API Base:', this.apiBase);
    }

    /**
     * Generic GET request helper
     * @param {string} endpoint - API endpoint
     * @param {object} params - Query parameters
     * @returns {Promise<any>}
     */
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = `${this.apiBase}${endpoint}${queryString ? '?' + queryString : ''}`;
        
        console.log(`[Backend] GET request: ${url}`);
        
        this.showLoadingIndicator(endpoint);
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`GET ${endpoint} failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            this.hideLoadingIndicator(endpoint);
            return data;
        } catch (error) {
            this.hideLoadingIndicator(endpoint);
            throw error;
        }
    }

    /**
     * Generic POST request helper
     * @param {string} endpoint - API endpoint
     * @param {object} data - Request body data
     * @returns {Promise<any>}
     */
    async post(endpoint, data = {}) {
        const url = `${this.apiBase}${endpoint}`;
        
        console.log(`[Backend] POST request: ${url}`, data);
        
        this.showLoadingIndicator(endpoint);
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`POST ${endpoint} failed: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            this.hideLoadingIndicator(endpoint);
            return result;
        } catch (error) {
            this.hideLoadingIndicator(endpoint);
            throw error;
        }
    }

    /**
     * Show loading indicator
     * @param {string} endpoint 
     */
    showLoadingIndicator(endpoint) {
        window.dispatchEvent(new CustomEvent('loading:start', { detail: { endpoint } }));
    }

    /**
     * Hide loading indicator
     * @param {string} endpoint 
     */
    hideLoadingIndicator(endpoint) {
        window.dispatchEvent(new CustomEvent('loading:end', { detail: { endpoint } }));
    }

    /**
     * Initialize player in backend
     * @param {string} actor - WAX account name
     */
    async initPlayer(actor) {
        try {
            console.log('[Backend] Initializing player:', actor);
            const data = await this.post('/initPlayer', { actor });
            console.log('[Backend] Player initialized:', data);
            return data;
        } catch (error) {
            console.error('[Backend] Error initializing player:', error);
            throw error;
        }
    }

    /**
     * Get dashboard data for player
     * @param {string} actor - WAX account name
     */
    async getDashboard(actor) {
        try {
            console.log('[Backend] ==========================================');
            console.log('[Backend] Fetching dashboard for actor:', actor);
            
            // Build URL - handle both absolute and relative paths
            let url;
            if (this.apiBase) {
                // Production: use full URL
                url = new URL(`${this.apiBase}/getDashboard`);
                url.searchParams.set('actor', actor);
            } else {
                // Local: use relative path with query params
                url = `/getDashboard?actor=${encodeURIComponent(actor)}`;
            }
            console.log('[Backend] Request URL:', url.toString ? url.toString() : url);
            
            const response = await fetch(url);
            console.log('[Backend] Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Backend] getDashboard failed:', response.status, errorText);
                throw new Error(`getDashboard failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('[Backend] Raw getDashboard response:', data);
            console.log('[Backend] - Has profile?', !!data.profile);
            console.log('[Backend] - Profile data:', data.profile);
            
            // Normalize response structure: backend returns { profile: {...} }
            // but frontend expects { player: {...} }
            if (data.profile) {
                this.dashboardData = {
                    player: data.profile,
                    inventory: data.inventory || []
                };
                console.log('[Backend] Normalized dashboard data:', this.dashboardData);
                console.log('[Backend] - Player account:', this.dashboardData.player.account);
                console.log('[Backend] - Player ingameCurrency:', this.dashboardData.player.ingameCurrency);
                console.log('[Backend] - Player balances:', this.dashboardData.player.balances);
                console.log('[Backend] - Player TSDM:', this.dashboardData.player.balances?.TSDM);
                
                // Auto-update Game $ in header on all pages
                const currency = data.profile.ingameCurrency || 0;
                window.dispatchEvent(new CustomEvent('gameDollars:update', {
                    detail: { amount: currency, animate: false }
                }));
                console.log('[Backend] Dispatched gameDollars:update event:', currency);
            } else {
                console.warn('[Backend] No profile in response, using data as-is');
                this.dashboardData = data;
            }
            
            console.log('[Backend] ✅ Dashboard data ready');
            console.log('[Backend] ==========================================');
            return this.dashboardData;
        } catch (error) {
            console.error('[Backend] ❌ Error fetching dashboard:', error);
            console.error('[Backend] Error message:', error.message);
            console.error('[Backend] Stack:', error.stack);
            throw error;
        }
    }

    /**
     * Get city boost matrix
     */
    async getCityMatrix() {
        try {
            console.log('[Backend] Fetching city matrix...');
            const response = await fetch(`${this.apiBase}/getCityMatrix`);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`getCityMatrix failed: ${response.status} - ${errorText}`);
            }

            this.cityMatrix = await response.json();
            console.log('[Backend] City matrix loaded:', this.cityMatrix);
            return this.cityMatrix;
        } catch (error) {
            console.error('[Backend] Error fetching city matrix:', error);
            throw error;
        }
    }

    /**
     * Get base price and history
     */
    async getBasePrice() {
        try {
            console.log('[Backend] Fetching base price...');
            const response = await fetch(`${this.apiBase}/getBasePrice`);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`getBasePrice failed: ${response.status} - ${errorText}`);
            }

            this.basePriceData = await response.json();
            console.log('[Backend] Base price loaded:', this.basePriceData);
            return this.basePriceData;
        } catch (error) {
            console.error('[Backend] Error fetching base price:', error);
            throw error;
        }
    }

    /**
     * Get chart data for specific timeframe
     * @param {string|number} days - Number of days (1, 7, 14, 30, 90, 180, 365, 'max')
     */
    async getChartData(days = 30) {
        try {
            console.log('[Backend] Fetching chart data for', days, 'days...');
            
            // Build URL - handle both absolute and relative paths
            let url;
            if (this.apiBase) {
                // Production: use full URL
                url = new URL(`${this.apiBase}/getChart`);
                url.searchParams.set('days', days);
            } else {
                // Local: use relative path with query params
                url = `/getChart?days=${days}`;
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`getChart failed: ${response.status} - ${errorText}`);
            }

            const chartData = await response.json();
            console.log('[Backend] Chart data loaded:', chartData);
            return chartData;
        } catch (error) {
            console.error('[Backend] Error fetching chart data:', error);
            throw error;
        }
    }

    /**
     * Get inventory data for player
     * @param {string} actor - WAX account name
     * @param {boolean} refresh - Force refresh from blockchain
     */
    async getInventory(actor, refresh = false) {
        try {
            console.log('[Backend] Fetching inventory for actor:', actor, 'refresh:', refresh);
            
            // Build URL - handle both absolute and relative paths
            let url;
            if (this.apiBase) {
                // Production: use full URL
                url = new URL(`${this.apiBase}/getInventory`);
                url.searchParams.set('actor', actor);
                if (refresh) {
                    url.searchParams.set('refresh', 'true');
                }
            } else {
                // Local: use relative path with query params
                url = `/getInventory?actor=${encodeURIComponent(actor)}`;
                if (refresh) {
                    url += '&refresh=true';
                }
            }
            
            const response = await fetch(url);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`getInventory failed: ${response.status} - ${errorText}`);
            }

            const inventoryData = await response.json();
            console.log('[Backend] Inventory data loaded:', inventoryData);
            return inventoryData;
        } catch (error) {
            console.error('[Backend] Error fetching inventory:', error);
            throw error;
        }
    }

    /**
     * Refresh inventory from blockchain
     * @param {string} actor - WAX account name
     */
    async refreshInventory(actor) {
        try {
            console.log('[Backend] Refreshing inventory from blockchain for:', actor);
            const response = await fetch(`${this.apiBase}/refreshInventory`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ actor })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`refreshInventory failed: ${response.status} - ${errorText}`);
            }

            const inventoryData = await response.json();
            console.log('[Backend] Inventory refreshed:', inventoryData);
            return inventoryData;
        } catch (error) {
            console.error('[Backend] Error refreshing inventory:', error);
            throw error;
        }
    }

    /**
     * Full initialization flow (OPTIMIZED)
     * @param {string} actor - WAX account name
     */
    async initialize(actor) {
        this.currentActor = actor;
        
        try {
            console.log('[Backend] Starting FAST initialization for:', actor);
            const startTime = performance.now();
            
            // Run ALL operations in parallel for maximum speed
            // initPlayer will sync blockchain data in background
            console.log('[Backend] Loading all data in parallel (including initPlayer)...');
            const [initResult, dashboard, cityMatrix, basePrice] = await Promise.all([
                this.initPlayer(actor),
                this.getDashboard(actor),
                this.getCityMatrix(),
                this.getBasePrice()
            ]);

            const endTime = performance.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            console.log(`[Backend] ✅ All data loaded in ${duration}s`);
            
            return {
                dashboard,
                cityMatrix,
                basePrice
            };
        } catch (error) {
            console.error('[Backend] Initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * Fast initialization - skip blockchain sync for instant load
     * @param {string} actor - WAX account name
     */
    async initializeFast(actor) {
        this.currentActor = actor;
        
        try {
            console.log('[Backend] Starting INSTANT initialization (cached data only):', actor);
            const startTime = performance.now();
            
            // Get cached data only (no blockchain sync)
            const [dashboard, cityMatrix, basePrice] = await Promise.all([
                this.getDashboard(actor),
                this.getCityMatrix(),
                this.getBasePrice()
            ]);

            const endTime = performance.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            console.log(`[Backend] ⚡ Cached data loaded in ${duration}s`);
            
            // Trigger blockchain sync in background (don't wait)
            this.initPlayer(actor).then(() => {
                console.log('[Backend] 🔄 Background blockchain sync completed');
            }).catch(error => {
                console.warn('[Backend] Background sync failed:', error);
            });
            
            return {
                dashboard,
                cityMatrix,
                basePrice
            };
        } catch (error) {
            console.error('[Backend] Fast initialization failed:', error);
            throw error;
        }
    }

    /**
     * Refresh dashboard data
     */
    async refreshDashboard() {
        if (!this.currentActor) {
            throw new Error('No actor set. Please login first.');
        }
        return await this.getDashboard(this.currentActor);
    }

    /**
     * Refresh city matrix data
     */
    async refreshCityMatrix() {
        return await this.getCityMatrix();
    }

    /**
     * Refresh base price data
     */
    async refreshBasePrice() {
        return await this.getBasePrice();
    }

    // ========================================
    // STAKING METHODS
    // ========================================

    /**
     * Stake an asset to a specific slot
     * @param {string} actor - WAX account name
     * @param {string} page - Page type ('mining' or 'polishing')
     * @param {number} slotNum - Slot number
     * @param {string} assetType - Asset type ('mine', 'worker', 'table')
     * @param {object} assetData - Asset data including asset_id
     * @returns {Promise<any>}
     */
    async stakeAsset(actor, page, slotNum, assetType, assetData) {
        console.log(`[Backend] Staking ${assetType} to ${page} slot ${slotNum} for ${actor}`);
        return await this.post('/stakeAsset', { 
            actor, 
            page, 
            slotNum, 
            assetType, 
            assetData 
        });
    }

    /**
     * Batch stake multiple workers to a specific slot (optimized for performance)
     * @param {string} actor - WAX account name
     * @param {string} page - Page type ('mining' or 'polishing')
     * @param {number} slotNum - Slot number
     * @param {any[]} workers - Array of worker objects { asset_id, template_id, name, mp }
     * @returns {Promise<any>}
     */
    async stakeWorkersBatch(actor, page, slotNum, workers) {
        console.log(`[Backend] Batch staking ${workers.length} workers to ${page} slot ${slotNum} for ${actor}`);
        return await this.post('/stakeWorkersBatch', { 
            actor, 
            page, 
            slotNum, 
            workers 
        });
    }

    /**
     * Unstake an asset from a specific slot
     * @param {string} actor - WAX account name
     * @param {string} page - Page type ('mining' or 'polishing')
     * @param {number} slotNum - Slot number
     * @param {string} assetType - Asset type ('mine', 'worker', 'table')
     * @param {string} assetId - Asset ID to unstake
     * @returns {Promise<any>}
     */
    async unstakeAsset(actor, page, slotNum, assetType, assetId) {
        console.log(`[Backend] Unstaking ${assetType} ${assetId} from ${page} slot ${slotNum} for ${actor}`);
        return await this.post('/unstakeAsset', { 
            actor, 
            page, 
            slotNum, 
            assetType, 
            assetId 
        });
    }

    /**
     * Get all staked assets for an actor
     * @param {string} actor - WAX account name
     * @returns {Promise<any>}
     */
    async getStakedAssets(actor) {
        console.log(`[Backend] Getting staked assets for ${actor}`);
        return await this.get('/getStakedAssets', { actor });
    }

    // ========================================
    // GEM STAKING METHODS
    // ========================================

    /**
     * Stake a gem to a specific slot
     * @param {string} actor - WAX account name
     * @param {number} slotNum - Slot number
     * @param {object} assetData - Gem asset data
     * @returns {Promise<any>}
     */
    async stakeGem(actor, slotNum, assetData) {
        console.log(`[Backend] Staking gem to slot ${slotNum} for ${actor}`);
        return await this.stakeAsset(actor, 'gems', slotNum, 'gem', assetData);
    }

    /**
     * Unstake a gem from a specific slot
     * @param {string} actor - WAX account name
     * @param {number} slotNum - Slot number
     * @param {string} assetId - Asset ID to unstake
     * @returns {Promise<any>}
     */
    async unstakeGem(actor, slotNum, assetId) {
        console.log(`[Backend] Unstaking gem from slot ${slotNum} for ${actor}`);
        return await this.unstakeAsset(actor, 'gems', slotNum, 'gem', assetId);
    }

    /**
     * Get all staked gems for an actor
     * @param {string} actor - WAX account name
     * @returns {Promise<any>}
     */
    async getStakedGems(actor) {
        console.log(`[Backend] Getting staked gems for ${actor}`);
        const result = await this.getStakedAssets(actor);
        return result.stakingData?.gems || {};
    }

    // ========================================
    // GEM SELLING METHODS
    // ========================================

    /**
     * Sell gems with city boost and gem staking boost
     * @param {string} actor - WAX account name
     * @param {string} gemType - Gem type (e.g., 'Diamond', 'Ruby')
     * @param {number} amount - Amount to sell
     * @param {string} cityId - City ID for boost calculation
     * @returns {Promise<any>}
     */
    async sellGems(actor, gemType, amount, cityId) {
        console.log(`[Backend] Selling ${amount}x ${gemType} in ${cityId} for ${actor}`);
        return await this.post('/sellGems', { 
            actor, 
            gemType, 
            amount, 
            cityId 
        });
    }

    /**
     * Get sales history for an actor
     * @param {string} actor - WAX account name
     * @returns {Promise<any>}
     */
    async getSalesHistory(actor) {
        console.log(`[Backend] Getting sales history for ${actor}`);
        return await this.get('/getSalesHistory', { actor });
    }

    // ========================================
    // LEADERBOARD METHODS
    // ========================================

    /**
     * Get leaderboard data
     * @param {string|null} actor - Optional: Current player's actor name
     * @param {number} limit - Number of top players to fetch (max 100)
     * @returns {Promise<{topPlayers: Array, currentPlayer: Object|null, totalPlayers: number, lastUpdated: any}>}
     */
    async getLeaderboard(actor = null, limit = 100) {
        console.log(`[Backend] Fetching leaderboard (limit: ${limit}${actor ? `, actor: ${actor}` : ''})`);
        const params = { limit: limit.toString() };
        if (actor) params.actor = actor;
        
        return await this.get('/getLeaderboard', params);
    }

    /**
     * Manually trigger leaderboard refresh (for testing)
     * @returns {Promise<any>}
     */
    async triggerLeaderboardRefresh() {
        console.log('[Backend] Triggering manual leaderboard refresh');
        return await this.post('/triggerLeaderboardRefresh', {});
    }

    // ========================================
    // SEASON METHODS
    // ========================================

    /**
     * Get current season state and schedule
     * @returns {Promise<{ok: boolean, season: string, phase: string, lockEndsAt: number|null, ...}>}
     */
    async getSeasonState() {
        console.log('[Backend] Fetching season state');
        try {
            const response = await this.get('/getSeasonState');
            console.log('[Backend] Season state loaded:', response);
            return response;
        } catch (error) {
            console.error('[Backend] Error fetching season state:', error);
            // Return default state if API fails
            return {
                ok: true,
                season: 'active',
                phase: 'active',
                lockEndsAt: null
            };
        }
    }

    /**
     * Get season schedule with timing information
     * @returns {Promise<{ok: boolean, season: string, phase: string, startAt: number, lockStartAt: number, lockEndAt: number, offDays: number}>}
     */
    async getSeasonSchedule() {
        console.log('[Backend] Fetching season schedule');
        try {
            const response = await this.get('/getSeasonSchedule');
            console.log('[Backend] Season schedule loaded:', response);
            return response;
        } catch (error) {
            console.error('[Backend] Error fetching season schedule:', error);
            throw error;
        }
    }
}

// Global instance
console.log('[Backend] Creating global backend service instance');
window.backendService = new BackendService();
console.log('[Backend] Backend service ready');
