// TSDGEMS - Data Manager
// Zentraler Cache Manager für Performance-Optimierung

class DataManager {
    constructor() {
        // Detect mobile devices for optimized caching
        this.isMobile = this.detectMobile();
        const mobileMultiplier = this.isMobile ? 0.3 : 1; // 70% shorter TTL on mobile

        // Get environment for cache isolation
        this.env = window.firebaseEnv || 'prod';
        this.envPrefix = `${this.env}_`;

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
        this.liveData = null; // Store the latest live data aggregate

        // Memory monitoring for mobile
        if (this.isMobile) {
            this.startMemoryMonitoring();
        }

        // Setup realtime listeners for inventory sync
        this.setupRealtimeListeners();

        // Clean up any old environment-contaminated data
        this.cleanupOldData();

        console.log(`[DataManager] Data Manager initialized (${this.isMobile ? 'mobile' : 'desktop'} mode - ${this.env})`);
    }

    setupRealtimeListeners() {
        console.log('[DataManager] Setting up realtime listeners...');

        // 🔥 PRIMARY: Listen for live data aggregate updates (hydrates all caches)
        window.addEventListener('realtime:live', (event) => {
            const { actor, live } = event.detail;
            if (actor === this.currentActor && live) {
                console.log('[DataManager] 🔥 Live data hydration:', Object.keys(live));
                this.hydrateFromLiveData(live);
            }
        });

        // Legacy granular listeners (will be phased out as pages migrate to live data)
        // Listen for inventory gems updates
        window.addEventListener('realtime:inventory-gems', (event) => {
            const { actor, gems } = event.detail;
            if (actor === this.currentActor) {
                console.log('[DataManager] 🔄 Realtime gems update:', gems);
                this.updateInventoryGems(gems);
            }
        });

        // Listen for inventory summary updates
        window.addEventListener('realtime:inventory-summary', (event) => {
            const { actor, summary } = event.detail;
            if (actor === this.currentActor) {
                console.log('[DataManager] 🔄 Realtime inventory summary update:', summary);
                this.updateInventorySummary(summary);
            }
        });

        // Listen for speedboost updates
        window.addEventListener('realtime:inventory-speedboost', (event) => {
            const { actor, speedboost } = event.detail;
            if (actor === this.currentActor) {
                console.log('[DataManager] 🔄 Realtime speedboost update:', speedboost);
                this.updateInventorySpeedboost(speedboost);
            }
        });
    }

    updateInventoryGems(gems) {
        const cached = this.cache.inventory;
        if (cached.data) {
            // Merge gems data into existing inventory cache
            cached.data = { ...cached.data, ...gems };
            cached.timestamp = Date.now();
            console.log('[DataManager] ✅ Updated cached inventory with realtime gems');

            // Emit event to notify components of inventory change
            window.dispatchEvent(new CustomEvent('inventory:updated', {
                detail: { type: 'gems', data: gems }
            }));
        }
    }

    updateInventorySummary(summary) {
        const cached = this.cache.inventory;
        if (cached.data) {
            // Merge summary data into existing inventory cache
            cached.data = { ...cached.data, ...summary };
            cached.timestamp = Date.now();
            console.log('[DataManager] ✅ Updated cached inventory with realtime summary');

            // Emit event to notify components of inventory change
            window.dispatchEvent(new CustomEvent('inventory:updated', {
                detail: { type: 'summary', data: summary }
            }));
        }
    }

    updateInventorySpeedboost(speedboost) {
        const cached = this.cache.inventory;
        if (cached.data) {
            // Merge speedboost data into existing inventory cache
            cached.data = { ...cached.data, speedboost };
            cached.timestamp = Date.now();
            console.log('[DataManager] ✅ Updated cached inventory with realtime speedboost');

            // Emit event to notify components of inventory change
            window.dispatchEvent(new CustomEvent('inventory:updated', {
                detail: { type: 'speedboost', data: speedboost }
            }));
        }
    }

    // 🔥 PRIMARY HYDRATION: Update all caches from live data aggregate
    hydrateFromLiveData(live) {
        const now = Date.now();
        this.liveData = live; // Store the latest live data

        // 1. Hydrate inventory cache (gems + inventory summary)
        if (live.gems || live.inventorySummary) {
            const inventoryCache = this.cache.inventory;
            if (!inventoryCache.data) {
                inventoryCache.data = {};
            }

            // Merge gems and summary data
            if (live.gems) {
                inventoryCache.data = { ...inventoryCache.data, ...live.gems };
            }
            if (live.inventorySummary) {
                inventoryCache.data = { ...inventoryCache.data, ...live.inventorySummary };
            }
            inventoryCache.timestamp = now;

            console.log('[DataManager] 🔥 Hydrated inventory cache from live data');

            // Emit inventory updated event
            window.dispatchEvent(new CustomEvent('inventory:updated', {
                detail: { type: 'live-hydration', data: inventoryCache.data }
            }));
        }

        // 2. Hydrate dashboard cache (profile data)
        if (live.profile) {
            const dashboardCache = this.cache.dashboard;
            if (!dashboardCache.data) {
                dashboardCache.data = {};
            }
            dashboardCache.data.player = live.profile;
            dashboardCache.timestamp = now;
            console.log('[DataManager] 🔥 Hydrated dashboard cache from live data');
        }

        // 3. Hydrate base price cache
        if (live.pricing) {
            const priceCache = this.cache.basePrice;
            priceCache.data = live.pricing;
            priceCache.timestamp = now;
            console.log('[DataManager] 🔥 Hydrated base price cache from live data');
        }

        // 4. Hydrate city matrix cache (boosts)
        if (live.boosts) {
            const cityCache = this.cache.cityMatrix;
            cityCache.data = live.boosts;
            cityCache.timestamp = now;
            console.log('[DataManager] 🔥 Hydrated city matrix cache from live data');
        }

        // 5. Hydrate active mining/polishing (slots data)
        if (live.miningSlots) {
            const miningCache = this.cache.activeMining;
            miningCache.data = live.miningSlots;
            miningCache.timestamp = now;
            console.log('[DataManager] 🔥 Hydrated active mining cache from live data');
        }

        if (live.polishingSlots) {
            const polishingCache = this.cache.activePolishing;
            polishingCache.data = live.polishingSlots;
            polishingCache.timestamp = now;
            console.log('[DataManager] 🔥 Hydrated active polishing cache from live data');
        }

        // 6. Update Game $ from live profile data
        if (live.profile && live.profile.ingameCurrency !== undefined) {
            const env = window.firebaseEnv || 'prod';
            const cacheKey = `tsdgems_game_dollars_${env}`;
            localStorage.setItem(cacheKey, live.profile.ingameCurrency.toString());

            // Update header display if Game $ is currently shown
            if (window.tsdgemsGame && typeof window.tsdgemsGame.updateGameDollars === 'function') {
                window.tsdgemsGame.updateGameDollars(live.profile.ingameCurrency, false);
            }
        }

        console.log('[DataManager] 🔥 Live data hydration complete');
    }

    // 🔥 Check if live data is available and recent
    hasLiveData() {
        return this.liveData !== null;
    }

    // 🔥 Get live data if available
    getLiveData() {
        return this.liveData;
    }

    // 🔥 Get specific data from live data or cache
    getLiveOrCached(key) {
        if (this.liveData && this.liveData[key]) {
            return this.liveData[key];
        }
        return this.get(key);
    }

    // Clean up old environment-contaminated data
    cleanupOldData() {
        try {
            // Clear old Game $ localStorage keys that don't have environment prefix
            const oldGameDollarsKey = 'tsdgems_game_dollars';
            if (localStorage.getItem(oldGameDollarsKey)) {
                console.log(`[DataManager] 🧹 Removing old Game $ key: ${oldGameDollarsKey}`);
                localStorage.removeItem(oldGameDollarsKey);
            }

            // Clear any other old cache keys that might exist
            // This is a safety measure for any future cache contamination
            console.log(`[DataManager] ✅ Environment isolation active (${this.env})`);
        } catch (error) {
            console.warn('[DataManager] Failed to cleanup old data:', error);
        }
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
        // Use environment-specific cache key
        const envCacheKey = `${this.envPrefix}${cacheKey}`;
        // Return cached if valid and not forcing refresh
        if (!forceRefresh && this.isValidCache(cacheKey)) {
            console.log(`[DataManager] ✓ Returning cached ${cacheKey} (${this.env})`);
            return this.cache[cacheKey].data;
        }

        // Check if already loading
        if (this.loadingStates.has(envCacheKey)) {
            console.log(`[DataManager] ⏳ Waiting for existing ${cacheKey} request (${this.env})`);
            return await this.loadingStates.get(envCacheKey);
        }

        // Start new fetch
        console.log(`[DataManager] 🔄 Fetching fresh ${cacheKey} (${this.env})`);
        const loadPromise = fetchFunction().then(data => {
            this.cache[cacheKey].data = data;
            this.cache[cacheKey].timestamp = Date.now();
            this.loadingStates.delete(envCacheKey);
            console.log(`[DataManager] ✅ Cached ${cacheKey} (${this.env})`);
            return data;
        }).catch(error => {
            this.loadingStates.delete(envCacheKey);
            console.error(`[DataManager] ❌ Failed to fetch ${cacheKey} (${this.env}):`, error);
            throw error;
        });

        this.loadingStates.set(envCacheKey, loadPromise);
        return await loadPromise;
    }

    // Invalidate cache when data changes
    invalidate(cacheKey) {
        if (this.cache[cacheKey]) {
            this.cache[cacheKey].data = null;
            this.cache[cacheKey].timestamp = null;
            // Also clear any loading states for this cache key
            const envCacheKey = `${this.envPrefix}${cacheKey}`;
            this.loadingStates.delete(envCacheKey);
            console.log(`[DataManager] 🗑️ Invalidated cache: ${cacheKey} (${this.env})`);
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

