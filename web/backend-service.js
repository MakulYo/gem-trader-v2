// TSDGEMS - Backend Service
// Central communication with Firebase Functions

// -------- Choose the correct Functions base by hostname --------
const HOST = location.hostname;

const API_BASE =
  HOST.includes('localhost') || HOST === '127.0.0.1'
    // Local dev: use Hosting rewrites (relative paths)
    ? ''
    // Dev site (tsdgems-dev.*)
    : HOST.includes('tsdgems-dev')
      ? 'https://us-central1-tsdm-6896d.cloudfunctions.net'
      // Prod site (tsdgems.xyz + firebaseapp/web.app fallbacks)
      : 'https://us-central1-tsdgems-trading.cloudfunctions.net';

console.log('[Backend] API Base URL:', API_BASE || '(relative via hosting rewrites)', 'host=', HOST);

// ---------------------------------------------------------------

class BackendService {
  constructor() {
    this.currentActor = null;
    this.dashboardData = null;
    this.cityMatrix = null;
    this.basePriceData = null;
    this.apiBase = API_BASE;

    console.log('[Backend] Backend Service initialized with API Base:', this.apiBase);
  }

  // ---------------------- HTTP helpers ------------------------

  /**
   * Generic GET request helper
   * @param {string} endpoint
   * @param {object} params
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
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData = null;
        try {
          errorData = JSON.parse(errorText);
        } catch (_) {
          // Not JSON, use text as error message
        }

        // Handle season-locked errors (403)
        if (response.status === 403) {
          const errorMessage = errorData?.error || errorText || 'season-locked';
          if (errorMessage.includes('season-locked') || errorMessage === 'season-locked') {
            console.warn(`[Backend] Season locked error on GET ${endpoint}`);
            // Emit custom event for season lock
            window.dispatchEvent(new CustomEvent('season-locked', {
              detail: { endpoint, method: 'GET', error: errorMessage }
            }));
            const err = new Error(errorMessage);
            err.status = 403;
            err.error = 'season-locked';
            err.data = errorData;
            this.hideLoadingIndicator(endpoint);
            throw err;
          }
        }

        const err = new Error(`GET ${endpoint} failed: ${response.status} - ${errorText}`);
        err.status = response.status;
        err.data = errorData;
        this.hideLoadingIndicator(endpoint);
        throw err;
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
   * @param {string} endpoint
   * @param {object} data
   * @returns {Promise<any>}
   */
  async post(endpoint, data = {}) {
    const url = `${this.apiBase}${endpoint}`;

    console.log(`[Backend] POST request: ${url}`, data);

    this.showLoadingIndicator(endpoint);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData = null;
        try {
          errorData = JSON.parse(errorText);
        } catch (_) {
          // Not JSON, use text as error message
        }

        // Handle season-locked errors (403)
        if (response.status === 403) {
          const errorMessage = errorData?.error || errorText || 'season-locked';
          if (errorMessage.includes('season-locked') || errorMessage === 'season-locked') {
            console.warn(`[Backend] Season locked error on POST ${endpoint}`);
            // Emit custom event for season lock
            window.dispatchEvent(new CustomEvent('season-locked', {
              detail: { endpoint, method: 'POST', error: errorMessage }
            }));
            const err = new Error(errorMessage);
            err.status = 403;
            err.error = 'season-locked';
            err.data = errorData;
            this.hideLoadingIndicator(endpoint);
            throw err;
          }
        }

        const err = new Error(`POST ${endpoint} failed: ${response.status} - ${errorText}`);
        err.status = response.status;
        err.data = errorData;
        this.hideLoadingIndicator(endpoint);
        throw err;
      }

      const result = await response.json();
      this.hideLoadingIndicator(endpoint);
      return result;
    } catch (error) {
      this.hideLoadingIndicator(endpoint);
      throw error;
    }
  }

  // -------------------- Loading indicators --------------------

  showLoadingIndicator(endpoint) {
    window.dispatchEvent(new CustomEvent('loading:start', { detail: { endpoint } }));
  }

  hideLoadingIndicator(endpoint) {
    window.dispatchEvent(new CustomEvent('loading:end', { detail: { endpoint } }));
  }

  // ---------------------- Player / Dashboard ------------------

  /**
   * Initialize player in backend
   * @param {string} actor
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
   * @param {string} actor
   */
  async getDashboard(actor) {
    try {
      console.log('[Backend] ==========================================');
      console.log('[Backend] Fetching dashboard for actor:', actor);

      // Build URL - handle absolute (prod/dev) and relative (localhost)
      let url;
      if (this.apiBase) {
        url = new URL(`${this.apiBase}/getDashboard`);
        url.searchParams.set('actor', actor);
      } else {
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

      // Normalize to expected shape { player: {...} }
      if (data.profile) {
        const previousCurrency = Number(this.dashboardData?.player?.ingameCurrency ?? 0);
        const rawCurrency = Number(data.profile.ingameCurrency ?? data.profile.ingame_currency ?? 0);
        const sanitizedCurrency = Number.isFinite(rawCurrency) ? rawCurrency : 0;
        const stableCurrency = sanitizedCurrency <= 0 && previousCurrency > 0
          ? previousCurrency
          : sanitizedCurrency;

        this.dashboardData = {
          player: { ...data.profile, ingameCurrency: stableCurrency },
          inventory: data.inventory || []
        };
        // Backward compatibility for legacy callers expecting .profile
        this.dashboardData.profile = this.dashboardData.player;

        // Update Game $ header (respect existing balance if backend reports zero)
        window.dispatchEvent(new CustomEvent('gameDollars:update', {
          detail: { amount: stableCurrency, animate: false }
        }));
      } else {
        this.dashboardData = data;
      }

      console.log('[Backend] [OK] Dashboard data ready');
      console.log('[Backend] ==========================================');
      return this.dashboardData;
    } catch (error) {
      console.error('[Backend] [ERROR] Error fetching dashboard:', error);
      throw error;
    }
  }

  // ------------------------- Matrix / Price -------------------

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

  async getChartData(days = 30) {
    try {
      console.log('[Backend] Fetching chart data for', days, 'days...');

      let url;
      if (this.apiBase) {
        url = new URL(`${this.apiBase}/getChart`);
        url.searchParams.set('days', days);
      } else {
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

  // --------------------------- Inventory ---------------------

  async getInventory(actor, refresh = false) {
    try {
      console.log('[Backend] Fetching inventory for actor:', actor, 'refresh:', refresh);

      let url;
      if (this.apiBase) {
        url = new URL(`${this.apiBase}/getInventory`);
        url.searchParams.set('actor', actor);
        if (refresh) url.searchParams.set('refresh', 'true');
      } else {
        url = `/getInventory?actor=${encodeURIComponent(actor)}${refresh ? '&refresh=true' : ''}`;
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

  async refreshInventory(actor) {
    try {
      console.log('[Backend] Refreshing inventory from blockchain for:', actor);
      const response = await fetch(`${this.apiBase}/refreshInventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // ------------------------ Init flows -----------------------

  async initialize(actor) {
    this.currentActor = actor;

    try {
      console.log('[Backend] Starting FAST initialization for:', actor);
      const startTime = performance.now();

      const [initResult, dashboard, cityMatrix, basePrice] = await Promise.all([
        this.initPlayer(actor),
        this.getDashboard(actor),
        this.getCityMatrix(),
        this.getBasePrice()
      ]);

      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log(`[Backend] [OK] All data loaded in ${duration}s`);

      return { dashboard, cityMatrix, basePrice };
    } catch (error) {
      console.error('[Backend] Initialization failed:', error);
      throw error;
    }
  }

  async initializeFast(actor) {
    this.currentActor = actor;

    try {
      console.log('[Backend] Starting INSTANT initialization (cached data only):', actor);
      const startTime = performance.now();

      const [dashboard, cityMatrix, basePrice] = await Promise.all([
        this.getDashboard(actor),
        this.getCityMatrix(),
        this.getBasePrice()
      ]);

      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log(`[Backend] [FAST] Cached data loaded in ${duration}s`);

      // Background sync (fire-and-forget)
      this.initPlayer(actor).catch(err => console.warn('[Backend] Background sync failed:', err));

      return { dashboard, cityMatrix, basePrice };
    } catch (error) {
      console.error('[Backend] Fast initialization failed:', error);
      throw error;
    }
  }

  // --------------------------- Refreshers --------------------

  async refreshDashboard() {
    if (!this.currentActor) throw new Error('No actor set. Please login first.');
    return await this.getDashboard(this.currentActor);
  }
  async refreshCityMatrix() { return await this.getCityMatrix(); }
  async refreshBasePrice() { return await this.getBasePrice(); }

  /**
   * Rebuild player live data (forces refresh of live aggregate including chain balances)
   * @param {string} actor
   */
  async rebuildPlayerLive(actor) {
    console.log(`[Backend] Rebuilding live data for ${actor}`);
    // Firebase Functions v2 URLs are lowercase
    return await this.post('/rebuildplayerlive', { actor });
  }

  // ----------------------------- Staking ---------------------

  async stakeAsset(actor, page, slotNum, assetType, assetData) {
    console.log(`[Backend] Staking ${assetType} to ${page} slot ${slotNum} for ${actor}`);
    return await this.post('/stakeAsset', { actor, page, slotNum, assetType, assetData });
  }

  async stakeWorkersBatch(actor, page, slotNum, workers) {
    console.log(`[Backend] Batch staking ${workers.length} workers to ${page} slot ${slotNum} for ${actor}`);
    return await this.post('/stakeWorkersBatch', { actor, page, slotNum, workers });
  }

  async unstakeAsset(actor, page, slotNum, assetType, assetId) {
    console.log(`[Backend] Unstaking ${assetType} ${assetId} from ${page} slot ${slotNum} for ${actor}`);
    return await this.post('/unstakeAsset', { actor, page, slotNum, assetType, assetId });
  }

  async getStakedAssets(actor) {
    console.log(`[Backend] Getting staked assets for ${actor}`);
    return await this.get('/getStakedAssets', { actor });
  }

  // ------------- Gem staking helpers (wrappers) --------------

  async stakeGem(actor, slotNum, assetData) {
    return await this.stakeAsset(actor, 'gems', slotNum, 'gem', assetData);
  }
  async unstakeGem(actor, slotNum, assetId) {
    return await this.unstakeAsset(actor, 'gems', slotNum, 'gem', assetId);
  }
  async getStakedGems(actor) {
    const result = await this.getStakedAssets(actor);
    return result.stakingData?.gems || {};
  }

  // --------------------------- Selling -----------------------

  async sellGems(actor, gemType, amount, cityId, expected) {
    console.log(`[Backend] Selling ${amount}x ${gemType} in ${cityId} for ${actor}`);
    const url = `${this.apiBase}/sellGems`;
    const payload = { actor, gemType, amount, cityId };
    if (expected) payload.expected = expected;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let data = null;
      try { data = await response.json(); } catch (_) {}
      const err = new Error(`POST /sellGems failed: ${response.status}`);
      err.status = response.status;
      err.data = data;
      throw err;
    }
    return await response.json();
  }

  async getSalesHistory(actor) {
    return await this.get('/getSalesHistory', { actor });
  }

  // --------------------------- Leaderboard -------------------

  async getLeaderboard(actor = null, limit = 100) {
    console.log(`[Backend] Fetching leaderboard (limit: ${limit}${actor ? `, actor: ${actor}` : ''})`);
    const params = { limit: limit.toString() };
    if (actor) params.actor = actor;
    return await this.get('/getLeaderboard', params);
  }

  async triggerLeaderboardRefresh() {
    return await this.post('/triggerLeaderboardRefresh', {});
  }

  // ----------------------------- Seasons --------------------

  async getSeasonState() {
    console.log('[Backend] Fetching season state');
    try {
      const response = await this.get('/getSeasonState');
      console.log('[Backend] Season state loaded:', response);
      return response;
    } catch (error) {
      console.error('[Backend] Error fetching season state:', error);
      return { ok: true, season: 'active', phase: 'active', lockEndsAt: null };
    }
  }

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
