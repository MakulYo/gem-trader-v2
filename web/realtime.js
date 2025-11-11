// Realtime listeners central hub (singleton)
(() => {
  // Import Firebase functions we need
  const firebasePromise = import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js")
    .then(module => ({
      onSnapshot: module.onSnapshot,
      doc: module.doc,
      collection: module.collection
    }));

  // Wait for Firebase to be initialized
  const waitForFirebase = () => {
    return new Promise((resolve) => {
      if (window.firestoreDb) {
        resolve(window.firestoreDb);
        return;
      }

      const checkFirebase = () => {
        if (window.firestoreDb) {
          resolve(window.firestoreDb);
        } else {
          setTimeout(checkFirebase, 10);
        }
      };
      checkFirebase();
    });
  };

  // Initialize realtime system once Firebase is ready
  Promise.all([waitForFirebase(), firebasePromise]).then(([db, firebaseFuncs]) => {
    if (!db) {
      console.error('[Realtime] Firestore not initialized after waiting');
      return;
    }

    const { onSnapshot, doc, collection } = firebaseFuncs;

    // Safe event emitter
    const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

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
          live: null, // New: full live data aggregate
        },

        start(actor) {
          if (!actor) return;
          if (this._actor === actor) return; // already running for this actor
          this.stop();
          this._actor = actor;

          console.log('[Realtime] starting for', actor);

          // --- 🔥 LIVE DATA AGGREGATE - The main listener that replaces most individual ones ---
          this._listenDoc(['players', actor, 'runtime', 'live'], (snap) => {
            const liveData = snap.exists() ? snap.data() : null;
            this._last.live = liveData;

            if (liveData) {
              console.log('[Realtime] 🔄 Live data update received:', {
                hasProfile: !!liveData.profile,
                hasGems: !!liveData.gems,
                hasMiningSlots: !!liveData.miningSlots,
                miningSlotsCount: liveData.miningSlots?.length || 0,
                hasStaking: !!liveData.miningSlots?.some(slot => slot.staked && slot.staked.length > 0),
                miningSlots: liveData.miningSlots?.map(slot => ({
                  id: slot.id,
                  state: slot.state,
                  stakedCount: slot.staked?.length || 0,
                  stakedTypes: slot.staked?.map(s => s.type) || []
                }))
              });

              // Emit the full live data event
              emit('realtime:live', { actor, live: liveData });

              // Emit granular events for backward compatibility and specific listeners
              if (liveData.profile) {
                emit('realtime:profile', { actor, profile: liveData.profile });
              }
              if (liveData.gems) {
                emit('realtime:inventory-gems', { actor, gems: liveData.gems });
              }
              if (liveData.inventorySummary) {
                emit('realtime:inventory-summary', { actor, summary: liveData.inventorySummary });
              }
              if (liveData.speedboost) {
                emit('realtime:inventory-speedboost', { actor, speedboost: liveData.speedboost });
              }
              if (liveData.miningSlots) {
                emit('realtime:mining-slots', { actor, slots: liveData.miningSlots });
              }
              if (liveData.polishingSlots) {
                emit('realtime:polishing-slots', { actor, slots: liveData.polishingSlots });
              }
              if (liveData.pricing) {
                emit('realtime:base-price', { basePrice: liveData.pricing });
              }
              if (liveData.boosts) {
                emit('realtime:city-boosts', { boosts: liveData.boosts });
              }
            } else {
              console.log('[Realtime] ⚠️ Live data document not found or empty');
            }
          });

          // --- Legacy individual listeners (will be phased out as pages migrate to live data) ---
          // --- Player doc (ownership, balances, staked, etc.)
          this._listenDoc(['players', actor], (snap) => {
            const data = snap.exists() ? snap.data() : null;
            this._last.player = data;
            emit('realtime:player', { actor, player: data });
            // ownership guard: broadcast a simple set of owned asset_ids for quick checks
            const owned = new Set(Object.values(data?.assets || {}).map(a => String(a.asset_id)));
            emit('realtime:owned-assets', { actor, owned });
          });

          // --- Global runtime data used by multiple pages
          this._listenDoc(['runtime', 'pricing'], (snap) => {
            const data = snap.exists() ? snap.data() : null;
            this._last.basePrice = data;
            emit('realtime:base-price', { basePrice: data });
          });

          // optional: cities config if you render matrix locally
          this._listenDoc(['game_config', 'cities'], (snap) => {
            const data = snap.exists() ? snap.data() : null;
            this._last.cities = data?.list || [];
            emit('realtime:cities', { cities: this._last.cities });
          });

          // optional: city boosts as a collection (if used client-side)
          this._listenCol(['city_boosts'], (col) => {
            const boosts = col.docs.map(d => ({ id: d.id, ...d.data() }));
            this._last.boosts = boosts;
            emit('realtime:city-boosts', { boosts });
          });

          // --- Inventory realtime sync ---
          // Gems inventory
          this._listenDoc(['players', actor, 'inventory', 'gems'], (snap) => {
            const data = snap.exists() ? snap.data() : {};
            this._last.gems = data;
            emit('realtime:inventory-gems', { actor, gems: data });
          });

          // Inventory summary
          this._listenDoc(['players', actor, 'meta', 'inventory_summary'], (snap) => {
            const data = snap.exists() ? snap.data() : null;
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
          this._unsubs.forEach(u => { try { u(); } catch {} });
          this._unsubs = [];
          this._actor = null;
        },

        // Utilities
        _listenDoc(pathArr, cb) {
          const ref = doc(db, ...pathArr);
          const unsub = onSnapshot(ref, cb, (e) => console.error('[Realtime] doc error', pathArr.join('/'), e));
          this._unsubs.push(unsub);
        },

        _listenCol(pathArr, cb) {
          const ref = collection(db, ...pathArr);
          const unsub = onSnapshot(ref, cb, (e) => console.error('[Realtime] col error', pathArr.join('/'), e));
          this._unsubs.push(unsub);
        },
      };

      // Expose
      window.TSDRealtime = Realtime;

      // Auto-stop on unload
      window.addEventListener('beforeunload', () => Realtime.stop());

      console.log('[Realtime] ready');
    });
})();
