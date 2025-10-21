// TSDGEMS - Data Manager
// Zentraler Cache Manager für Performance-Optimierung

class DataManager {
    constructor() {
        this.cache = {
            dashboard: { data: null, timestamp: null, ttl: 5 * 60 * 1000 }, // 5 min
            inventory: { data: null, timestamp: null, ttl: 5 * 60 * 1000 },
            cityMatrix: { data: null, timestamp: null, ttl: 5 * 60 * 1000 },
            basePrice: { data: null, timestamp: null, ttl: 5 * 60 * 1000 },
            leaderboard: { data: null, timestamp: null, ttl: 5 * 60 * 1000 },
            activeMining: { data: null, timestamp: null, ttl: 30 * 1000 }, // 30 sec (active data)
            activePolishing: { data: null, timestamp: null, ttl: 30 * 1000 },
            stakedAssets: { data: null, timestamp: null, ttl: 5 * 60 * 1000 }
        };
        this.loadingStates = new Map();
        this.backendService = window.backendService;
        this.currentActor = null;
        
        console.log('[DataManager] Data Manager initialized');
    }

    isValidCache(cacheKey) {
        const cached = this.cache[cacheKey];
        if (!cached.data || !cached.timestamp) return false;
        return (Date.now() - cached.timestamp) < cached.ttl;
    }

    async get(cacheKey, fetchFunction, forceRefresh = false) {
        // Return cached if valid and not forcing refresh
        if (!forceRefresh && this.isValidCache(cacheKey)) {
            console.log(`[DataManager] ✓ Returning cached ${cacheKey}`);
            return this.cache[cacheKey].data;
        }

        // Check if already loading
        if (this.loadingStates.has(cacheKey)) {
            console.log(`[DataManager] ⏳ Waiting for existing ${cacheKey} request`);
            return await this.loadingStates.get(cacheKey);
        }

        // Start new fetch
        console.log(`[DataManager] 🔄 Fetching fresh ${cacheKey}`);
        const loadPromise = fetchFunction().then(data => {
            this.cache[cacheKey].data = data;
            this.cache[cacheKey].timestamp = Date.now();
            this.loadingStates.delete(cacheKey);
            console.log(`[DataManager] ✅ Cached ${cacheKey}`);
            return data;
        }).catch(error => {
            this.loadingStates.delete(cacheKey);
            console.error(`[DataManager] ❌ Failed to fetch ${cacheKey}:`, error);
            throw error;
        });

        this.loadingStates.set(cacheKey, loadPromise);
        return await loadPromise;
    }

    // Preload critical data when actor connects
    async preloadCriticalData(actor) {
        this.currentActor = actor;
        console.log('[DataManager] 🚀 Preloading critical data for', actor);
        
        const startTime = Date.now();
        
        // Load in parallel
        const promises = [
            this.getDashboard(actor).catch(e => console.error('[DataManager] Dashboard preload failed:', e)),
            this.getInventory(actor).catch(e => console.error('[DataManager] Inventory preload failed:', e)),
            this.getCityMatrix().catch(e => console.error('[DataManager] CityMatrix preload failed:', e)),
            this.getBasePrice().catch(e => console.error('[DataManager] BasePrice preload failed:', e))
        ];

        await Promise.allSettled(promises);
        
        const elapsed = Date.now() - startTime;
        console.log(`[DataManager] ✅ Critical data preloaded in ${elapsed}ms`);
    }

    async getDashboard(actor) {
        if (!actor) actor = this.currentActor;
        return this.get('dashboard', () => this.backendService.getDashboard(actor));
    }

    async getInventory(actor, forceRefresh = false) {
        if (!actor) actor = this.currentActor;
        return this.get('inventory', () => this.backendService.getInventory(actor, forceRefresh), forceRefresh);
    }

    async getCityMatrix() {
        return this.get('cityMatrix', () => this.backendService.getCityMatrix());
    }

    async getBasePrice() {
        return this.get('basePrice', () => this.backendService.getBasePrice());
    }

    async getLeaderboard(actor, limit = 100) {
        if (!actor) actor = this.currentActor;
        return this.get('leaderboard', () => this.backendService.getLeaderboard(actor, limit));
    }

    async getActiveMining(actor) {
        if (!actor) actor = this.currentActor;
        return this.get('activeMining', () => this.backendService.getActiveMining(actor));
    }

    async getActivePolishing(actor) {
        if (!actor) actor = this.currentActor;
        return this.get('activePolishing', () => this.backendService.getActivePolishing(actor));
    }

    async getStakedAssets(actor) {
        if (!actor) actor = this.currentActor;
        return this.get('stakedAssets', () => this.backendService.getStakedAssets(actor));
    }

    // Invalidate cache when data changes
    invalidate(cacheKey) {
        if (this.cache[cacheKey]) {
            this.cache[cacheKey].data = null;
            this.cache[cacheKey].timestamp = null;
            console.log(`[DataManager] 🗑️ Invalidated cache: ${cacheKey}`);
        }
    }

    // Invalidate multiple caches
    invalidateMultiple(...cacheKeys) {
        cacheKeys.forEach(key => this.invalidate(key));
    }

    // Clear all cache
    clearAll() {
        Object.keys(this.cache).forEach(key => this.invalidate(key));
        console.log('[DataManager] 🗑️ All cache cleared');
    }

    // Get cache stats
    getCacheStats() {
        const stats = {};
        Object.keys(this.cache).forEach(key => {
            const cached = this.cache[key];
            stats[key] = {
                hasData: !!cached.data,
                isValid: this.isValidCache(key),
                age: cached.timestamp ? Date.now() - cached.timestamp : null
            };
        });
        return stats;
    }
}

// Global instance - wait for backendService to be ready
if (window.backendService) {
    window.dataManager = new DataManager();
    console.log('[DataManager] Data Manager ready');
} else {
    // Wait for backend service
    const checkInterval = setInterval(() => {
        if (window.backendService) {
            clearInterval(checkInterval);
            window.dataManager = new DataManager();
            console.log('[DataManager] Data Manager ready (delayed)');
        }
    }, 100);
}

