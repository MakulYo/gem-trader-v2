// Realtime listeners central hub (singleton)
(() => {
  const { onSnapshot, doc, collection, getFirestore } =
    window.firebaseFirestoreExports || {}; // if you export them; else we’ll rely on window.firestoreDb

  // Use the db that firebase-config.js already initialized
  const db = window.firestoreDb || (typeof getFirestore === 'function' ? getFirestore(window.firebaseApp) : null);
  if (!db) {
    console.error('[Realtime] Firestore not initialized');
    return;
  }

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
    },

    start(actor) {
      if (!actor) return;
      if (this._actor === actor) return; // already running for this actor
      this.stop();
      this._actor = actor;

      console.log('[Realtime] starting for', actor);

      // --- Player doc (ownership, balances, staked, etc.)
      this._listenDoc(['players', actor], (snap) => {
        const data = snap.exists() ? snap.data() : null;
        this._last.player = data;
        emit('realtime:player', { actor, player: data });
        // ownership guard: broadcast a simple set of owned asset_ids for quick checks
        const owned = new Set(Object.values(data?.assets || {}).map(a => String(a.asset_id)));
        emit('realtime:owned-assets', { actor, owned });
      });

      // --- Global game config docs used by multiple pages
      this._listenDoc(['game_config', 'base_price'], (snap) => {
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
    },

    stop() {
      this._unsubs.forEach(u => { try { u(); } catch {} });
      this._unsubs = [];
      this._actor = null;
    },

    // Utilities
    _listenDoc(pathArr, cb) {
      const ref = doc(db, ...pathArr);
      const unsub = window.firebaseOnSnapshot
        ? window.firebaseOnSnapshot(ref, cb, (e) => console.error('[Realtime] doc error', pathArr.join('/'), e))
        : onSnapshot(ref, cb, (e) => console.error('[Realtime] doc error', pathArr.join('/'), e));
      this._unsubs.push(unsub);
    },

    _listenCol(pathArr, cb) {
      const ref = collection(db, ...pathArr);
      const unsub = window.firebaseOnSnapshot
        ? window.firebaseOnSnapshot(ref, cb, (e) => console.error('[Realtime] col error', pathArr.join('/'), e))
        : onSnapshot(ref, cb, (e) => console.error('[Realtime] col error', pathArr.join('/'), e));
      this._unsubs.push(unsub);
    },
  };

  // Expose
  window.TSDRealtime = Realtime;

  // Auto-stop on unload
  window.addEventListener('beforeunload', () => Realtime.stop());

  console.log('[Realtime] ready');
})();
