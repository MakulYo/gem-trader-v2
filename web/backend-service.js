// TSDGEMS - Backend Service
// Zentrale Kommunikation mit Firebase Functions

// Backend API Base URL (Firebase Functions)
const API_BASE = 'https://us-central1-tsdgems-trading.cloudfunctions.net';

class BackendService {
    constructor() {
        this.currentActor = null;
        this.dashboardData = null;
        this.cityMatrix = null;
        this.basePriceData = null;
        this.apiBase = API_BASE;
    }

    /**
     * Initialize player in backend
     * @param {string} actor - WAX account name
     */
    async initPlayer(actor) {
        try {
            console.log('[Backend] Initializing player:', actor);
            const response = await fetch(`${this.apiBase}/initPlayer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ actor })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`initPlayer failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
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
            const url = new URL(`${this.apiBase}/getDashboard`);
            url.searchParams.set('actor', actor);
            console.log('[Backend] Request URL:', url.toString());
            
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
            const url = new URL(`${this.apiBase}/getChart`);
            url.searchParams.set('days', days);
            
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
            const url = new URL(`${this.apiBase}/getInventory`);
            url.searchParams.set('actor', actor);
            if (refresh) {
                url.searchParams.set('refresh', '1');
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
}

// Global instance
console.log('[Backend] Creating global backend service instance');
window.backendService = new BackendService();
console.log('[Backend] Backend service ready');
