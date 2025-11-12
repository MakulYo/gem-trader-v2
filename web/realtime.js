// Realtime listeners central hub (singleton)
(() => {
  // --- 1) Import Firestore bits (modular SDK) ---
  const firebasePromise = import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js")
    .then(module => ({
      onSnapshot: module.onSnapshot,
      doc: module.doc,
      collection: module.collection
    }))
    .catch((e) => {
      console.error('[Realtime] Failed to import Firestore module', e);
      return {};
    });

  // --- 2) Wait for firebase-config.js to init window.firebaseApp/window.firestoreDb ---
  const waitForFirebase = () => {
    return new Promise((resolve) => {
      if (window.firestoreDb) {
        resolve(window.firestoreDb);
        return;
      }

      const startedAt = Date.now();

      const checkFirebase = () => {
        if (window.firestoreDb) {
          resolve(window.firestoreDb);
        } else {
          // give it up to 10 seconds, then bail with an error
          if (Date.now() - startedAt > 10000) {
            console.error('[Realtime] Gave up waiting for Firestore init (10s timeout)');
            resolve(null);
            return;
          }
          setTimeout(checkFirebase, 50);
        }
      };
      checkFirebase();
    });
  };

  // --- 3) Initialize realtime system once Firebase is ready ---
  Promise.all([waitForFirebase(), firebasePromise]).then(([db, firebaseFuncs]) => {
    if (!db) {
      console.error('[Realtime] Firestore not initialized after waiting');
      return;
    }
    if (!firebaseFuncs.onSnapshot || !firebaseFuncs.doc || !firebaseFuncs.collection) {
      console.error('[Realtime] Firestore module functions missing');
      return;
    }

    const { onSnapshot, doc, collection } = firebaseFuncs;

    // Try to log which project we’re actually talking to (for sanity)
    const projectId =
      (window.firebaseConfig && window.firebaseConfig.projectId) ||
      db._databaseId?.projectId ||
      'unknown-project';
    console.log('[Realtime] Connected to Firestore project:', projectId);

    // Safe event emitter
    const emit = (name, detail) =>
      window.dispatchEvent(new CustomEvent(name, { detail }));

    const Realtime = {
      _actor: null,
      _unsubs: [],
      _last: {
        player: null,
        basePrice: null,
        boosts: null,
        cities: null,
        gems: null,
        inventorySummary: null,
        speedboost: null,
        live: null, // full live aggregate
      },

      start(actor) {
        if (!actor) return;
        if (this._actor === actor) return; // already running for this actor
        this.stop();
        this._actor = actor;

        console.log('[Realtime] starting for', actor);

        // --- 🔥 LIVE DATA AGGREGATE ---
        // /players/{actor}/runtime/live
        this._listenDoc(['players', actor, 'runtime', 'live'], (snap) => {
          if (!snap.exists()) {
            console.warn('[Realtime] live doc missing for actor', actor);
            return; // IMPORTANT: don’t overwrite UI with null
          }

          const liveData = snap.data() || {};
          // If it’s totally empty, also bail – backend probably not writing it yet
          if (!liveData || Object.keys(liveData).length === 0) {
            console.warn('[Realtime] live doc is empty object for actor', actor);
            return;
          }

          this._last.live = liveData;

          console.log('[Realtime] 🔄 Live data update received:', {
            hasProfile: !!liveData.profile,
            hasGems: !!liveData.gems,
            hasMiningSlots: !!liveData.miningSlots,
            miningSlotsCount: liveData.miningSlots?.length || 0,
            hasStaking: !!liveData.miningSlots?.some(
              slot => Array.isArray(slot.staked) && slot.staked.length > 0
            ),
          });

          // Global “full snapshot”
          emit('realtime:live', { actor, live: liveData });

          // Granular events for existing UI modules
          if (liveData.profile) {
            emit('realtime:profile', { actor, profile: liveData.profile });
          }
          if (liveData.gems) {
            emit('realtime:inventory-gems', { actor, gems: liveData.gems });
          }
          if (liveData.inventorySummary) {
            emit('realtime:inventory-summary', {
              actor,
              summary: liveData.inventorySummary,
            });
          }
          if (liveData.speedboost) {
            emit('realtime:inventory-speedboost', {
              actor,
              speedboost: liveData.speedboost,
            });
          }
          if (liveData.miningSlots) {
            emit('realtime:mining-slots', {
              actor,
              slots: liveData.miningSlots,
            });
          }
          if (liveData.polishingSlots) {
            emit('realtime:polishing-slots', {
              actor,
              slots: liveData.polishingSlots,
            });
          }
          if (liveData.pricing) {
            emit('realtime:base-price', { basePrice: liveData.pricing });
          }
          if (liveData.boosts) {
            emit('realtime:city-boosts', { boosts: liveData.boosts });
          }
        });

        // --- Legacy / fallback listeners (safe-guarded against empty docs) ---

        // Player doc (ownership, balances, staked, etc.)
        this._listenDoc(['players', actor], (snap) => {
          if (!snap.exists()) {
            console.warn('[Realtime] player doc missing for', actor);
            return; // don’t nuke UI with null player
          }
          const data = snap.data() || {};
          this._last.player = data;
          emit('realtime:player', { actor, player: data });

          // Ownership set for quick checks
          const owned = new Set(
            Object.values(data.assets || {}).map(a => String(a.asset_id))
          );
          emit('realtime:owned-assets', { actor, owned });
        });

        // Global runtime pricing
        this._listenDoc(['runtime', 'pricing'], (snap) => {
          if (!snap.exists()) {
            console.warn('[Realtime] runtime/pricing doc missing');
            return;
          }
          const data = snap.data() || {};
          this._last.basePrice = data;
          emit('realtime:base-price', { basePrice: data });
        });

        // Cities config
        this._listenDoc(['game_config', 'cities'], (snap) => {
          if (!snap.exists()) {
            console.warn('[Realtime] game_config/cities doc missing');
            return;
          }
          const data = snap.data() || {};
          this._last.cities = data.list || [];
          emit('realtime:cities', { cities: this._last.cities });
        });

        // City boosts collection
        this._listenCol(['city_boosts'], (col) => {
          const boosts = col.docs.map(d => ({ id: d.id, ...d.data() }));
          this._last.boosts = boosts;
          emit('realtime:city-boosts', { boosts });
        });

        // Inventory: gems (this one is safe to treat missing as empty)
        this._listenDoc(['players', actor, 'inventory', 'gems'], (snap) => {
          const data = snap.exists() ? snap.data() : {};
          this._last.gems = data;
          emit('realtime:inventory-gems', { actor, gems: data });
        });

        // Inventory summary
        this._listenDoc(['players', actor, 'meta', 'inventory_summary'], (snap) => {
          if (!snap.exists()) {
            console.warn('[Realtime] inventory_summary doc missing for', actor);
            return;
          }
          const data = snap.data() || {};
          this._last.inventorySummary = data;
          emit('realtime:inventory-summary', { actor, summary: data });
        });

        // Speedboost items
        this._listenDoc(['players', actor, 'inventory', 'speedboost'], (snap) => {
          const data = snap.exists() ? snap.data() : {};
          this._last.speedboost = data;
          emit('realtime:inventory-speedboost', { actor, speedboost: data });
        });
      },

      stop() {
        this._unsubs.forEach(u => {
          try { u(); } catch {}
        });
        this._unsubs = [];
        this._actor = null;
        console.log('[Realtime] stopped');
      },

      // --- Internal helpers ---
      _listenDoc(pathArr, cb) {
        const ref = doc(db, ...pathArr);
        const unsub = onSnapshot(
          ref,
          cb,
          (e) => console.error('[Realtime] doc error', pathArr.join('/'), e)
        );
        this._unsubs.push(unsub);
      },

      _listenCol(pathArr, cb) {
        const ref = collection(db, ...pathArr);
        const unsub = onSnapshot(
          ref,
          cb,
          (e) => console.error('[Realtime] col error', pathArr.join('/'), e)
        );
        this._unsubs.push(unsub);
      },
    };

    // Expose globally
    window.TSDRealtime = Realtime;

    // Auto-stop on unload
    window.addEventListener('beforeunload', () => Realtime.stop());

    console.log('[Realtime] ready');
  });
})();
