// TSDGEMS - Data Manager
// Zentraler Cache Manager für Performance-Optimierung

class DataManager {
    constructor() {
        // Detect mobile devices for optimized caching
        this.isMobile = this.detectMobile();
        const mobileMultiplier = this.isMobile ? 0.3 : 1; // 70% shorter TTL on mobile

        this.cache = {
            dashboard: { data: null, timestamp: null, ttl: Math.floor(5 * 60 * 1000 * mobileMultiplier) }, // 5 min / 1.5 min
            inventory: { data: null, timestamp: null, ttl: Math.floor(2 * 60 * 1000 * mobileMultiplier) }, // 2 min / 40 sec (reduced)
            cityMatrix: { data: null, timestamp: null, ttl: Math.floor(3 * 60 * 1000 * mobileMultiplier) }, // 3 min / 1 min (reduced)
            basePrice: { data: null, timestamp: null, ttl: Math.floor(5 * 60 * 1000 * mobileMultiplier) }, // 5 min / 1.5 min
            leaderboard: { data: null, timestamp: null, ttl: Math.floor(10 * 60 * 1000 * mobileMultiplier) }, // 10 min / 3 min (reduced)
            activeMining: { data: null, timestamp: null, ttl: 30 * 1000 }, // 30 sec (same for active data)
            activePolishing: { data: null, timestamp: null, ttl: 30 * 1000 }, // 30 sec (same for active data)
            stakedAssets: { data: null, timestamp: null, ttl: Math.floor(3 * 60 * 1000 * mobileMultiplier) } // 3 min / 1 min (reduced)
        };
        this.loadingStates = new Map();
        this.backendService = window.backendService;
        this.currentActor = null;

        // Memory monitoring for mobile
        if (this.isMobile) {
            this.startMemoryMonitoring();
        }

        console.log(`[DataManager] Data Manager initialized (${this.isMobile ? 'mobile' : 'desktop'} mode)`);
    }

    detectMobile() {
        // Check for mobile devices
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isMobileDevice = /android|avantgo|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(userAgent);

        // Also check screen size as backup
        const isSmallScreen = window.innerWidth <= 768 || window.innerHeight <= 600;

        return isMobileDevice || isSmallScreen;
    }

    startMemoryMonitoring() {
        // Monitor memory usage on mobile every 30 seconds
        this.memoryCheckInterval = setInterval(() => {
            this.checkMemoryUsage();
        }, 30 * 1000);

        // Aggressive cleanup on page visibility change for mobile
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isMobile) {
                console.log('[DataManager] 📱 Mobile device hidden, clearing non-critical cache');
                this.clearNonCriticalCache();
            }
        });
    }

    checkMemoryUsage() {
        if (!this.isMobile) return;

        try {
            // Check if performance.memory is available (Chrome-based browsers)
            if (performance.memory) {
                const memUsage = performance.memory.usedJSHeapSize / performance.memory.totalJSHeapSize;
                console.log(`[DataManager] 📱 Memory usage: ${(memUsage * 100).toFixed(1)}%`);

                // If memory usage is high (>80%), clear some cache
                if (memUsage > 0.8) {
                    console.warn('[DataManager] 📱 High memory usage detected, clearing cache');
                    this.clearNonCriticalCache();
                }
            }
        } catch (e) {
            // Memory API not available, use fallback
            console.log('[DataManager] 📱 Memory monitoring not available');
        }
    }

    clearNonCriticalCache() {
        // Clear cache items that aren't immediately needed
        const nonCriticalKeys = ['leaderboard', 'cityMatrix'];
        nonCriticalKeys.forEach(key => {
            this.invalidate(key);
        });

        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
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

