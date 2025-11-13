// web/realtime.js
// Realtime listeners central hub (singleton)
(() => {
  console.log('[Realtime] realtime.js script loading...');
  
  // --- 1) Load Firestore helpers (doc, collection, onSnapshot, getFirestore) ---
  const firebasePromise = import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')
    .then(mod => {
      // merge into global helper bag (used by other code too)
      window.firebaseFirestoreExports = {
        ...(window.firebaseFirestoreExports || {}),
        onSnapshot: mod.onSnapshot,
        doc:        mod.doc,
        collection: mod.collection,
        getFirestore: mod.getFirestore,
      }
      console.log('[Realtime] Firestore module loaded, exports attached to window.firebaseFirestoreExports');
      return window.firebaseFirestoreExports
    })
    .catch(e => {
      console.error('[Realtime] Failed to import Firestore module:', e);
      return null;
    })

  // --- 2) Wait for Firebase / Firestore to exist ---
  const waitForFirebase = () => {
    return new Promise((resolve) => {
      const start   = Date.now()
      const timeout = 10000   // 10s instead of 1s, to be safe

      const tick = () => {
        // Case A: firebase-config already created db (check both window.db and window.firestoreDb)
        if (window.firestoreDb) {
          console.log('[Realtime] using existing window.firestoreDb')
          return resolve(window.firestoreDb)
        }
        if (window.db) {
          console.log('[Realtime] found window.db, assigning to window.firestoreDb')
          window.firestoreDb = window.db
          return resolve(window.firestoreDb)
        }

        // Case B: we have firebaseApp + getFirestore but db not created yet
        const app = window.firebaseApp
        const { getFirestore } = window.firebaseFirestoreExports || {}
        if (app && typeof getFirestore === 'function') {
          try {
            const db = getFirestore(app)
            window.firestoreDb = db
            // Also set window.db for backward compatibility
            if (!window.db) {
              window.db = db
            }
            console.log('[Realtime] created Firestore DB from firebaseApp using getFirestore()')
            return resolve(db)
          } catch (e) {
            console.error('[Realtime] getFirestore failed:', e)
          }
        }

        // Timeout guard
        if (Date.now() - start > timeout) {
          console.error('[Realtime] Gave up waiting for Firestore init (timeout)')
          console.error('[Realtime] Debug info:', {
            hasFirebaseApp: !!window.firebaseApp,
            hasFirestoreDb: !!window.firestoreDb,
            hasDb: !!window.db,
            hasFirestoreExports: !!window.firebaseFirestoreExports,
            hasGetFirestore: !!(window.firebaseFirestoreExports?.getFirestore)
          })
          return resolve(null)
        }

        // Try again
        setTimeout(tick, 50)
      }

      tick()
    })
  }

  // --- 3) Initialise Realtime once Firestore + helpers are ready ---
  Promise.all([firebasePromise, waitForFirebase()]).then(([ffx, db]) => {
    if (!ffx) {
      console.error('[Realtime] Firestore module exports not available')
      return
    }
    
    if (!db) {
      console.error('[Realtime] Firestore not initialized after waiting')
      return
    }

    const { onSnapshot, doc, collection } = ffx
    console.log('[Realtime] ✅ Ready! Firestore instance acquired, setting window.TSDRealtime')

    // Safe event emitter
    const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }))

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
        live: null,
      },

      start(actor) {
        if (!actor) return
        if (this._actor === actor) return // already running
        this.stop()
        this._actor = actor

        console.log('[Realtime] starting for', actor)

        // --- LIVE AGGREGATE DOC ---
        this._listenDoc(['players', actor, 'runtime', 'live'], (snap) => {
          const liveData = snap.exists() ? snap.data() : null
          this._last.live = liveData

          if (!liveData) {
            console.log('[Realtime] ⚠️ Live data document not found or empty')
            return
          }

          console.log('[Realtime] 🔄 Live data update received:', {
            hasProfile: !!liveData.profile,
            hasGems: !!liveData.gems,
            hasMiningSlots: !!liveData.miningSlots,
            miningSlotsCount: liveData.miningSlots?.length || 0,
            hasStaking: !!liveData.miningSlots?.some(slot => slot.staked && slot.staked.length > 0),
          })

          // Full event
          emit('realtime:live', { actor, live: liveData })

          // Granular events
          if (liveData.profile) {
            emit('realtime:profile', { actor, profile: liveData.profile })
          }
          if (liveData.gems) {
            emit('realtime:inventory-gems', { actor, gems: liveData.gems })
          }
          if (liveData.inventorySummary) {
            emit('realtime:inventory-summary', { actor, summary: liveData.inventorySummary })
          }
          if (liveData.speedboost) {
            emit('realtime:inventory-speedboost', { actor, speedboost: liveData.speedboost })
          }
          if (liveData.miningSlots) {
            emit('realtime:mining-slots', { actor, slots: liveData.miningSlots })
          }
          if (liveData.polishingSlots) {
            emit('realtime:polishing-slots', { actor, slots: liveData.polishingSlots })
          }
          if (liveData.pricing) {
            emit('realtime:base-price', { basePrice: liveData.pricing })
          }
          if (liveData.boosts) {
            emit('realtime:city-boosts', { boosts: liveData.boosts })
          }
        })

        // --- Legacy single-doc listeners (still used in a few spots) ---

        // Players root doc
        this._listenDoc(['players', actor], (snap) => {
          const data = snap.exists() ? snap.data() : null
          this._last.player = data
          emit('realtime:player', { actor, player: data })

          const owned = new Set(Object.values(data?.assets || {}).map(a => String(a.asset_id)))
          emit('realtime:owned-assets', { actor, owned })
        })

        // Pricing
        this._listenDoc(['runtime', 'pricing'], (snap) => {
          const data = snap.exists() ? snap.data() : null
          this._last.basePrice = data
          emit('realtime:base-price', { basePrice: data })
        })

        // Cities config
        this._listenDoc(['game_config', 'cities'], (snap) => {
          const data = snap.exists() ? snap.data() : null
          this._last.cities = data?.list || []
          emit('realtime:cities', { cities: this._last.cities })
        })

        // City boosts collection
        this._listenCol(['city_boosts'], (col) => {
          const boosts = col.docs.map(d => ({ id: d.id, ...d.data() }))
          this._last.boosts = boosts
          emit('realtime:city-boosts', { boosts })
        })

        // Inventory docs (gems, summary, speedboost)
        this._listenDoc(['players', actor, 'inventory', 'gems'], (snap) => {
          const data = snap.exists() ? snap.data() : {}
          this._last.gems = data
          emit('realtime:inventory-gems', { actor, gems: data })
        })

        this._listenDoc(['players', actor, 'meta', 'inventory_summary'], (snap) => {
          const data = snap.exists() ? snap.data() : null
          this._last.inventorySummary = data
          emit('realtime:inventory-summary', { actor, summary: data })
        })

        this._listenDoc(['players', actor, 'inventory', 'speedboost'], (snap) => {
          const data = snap.exists() ? snap.data() : {}
          this._last.speedboost = data
          emit('realtime:inventory-speedboost', { actor, speedboost: data })
        })
      },

      stop() {
        this._unsubs.forEach(u => { try { u() } catch {} })
        this._unsubs = []
        this._actor = null
      },

      _listenDoc(pathArr, cb) {
        const ref = doc(db, ...pathArr)
        const unsub = onSnapshot(
          ref,
          cb,
          (e) => console.error('[Realtime] doc error', pathArr.join('/'), e)
        )
        this._unsubs.push(unsub)
      },

      _listenCol(pathArr, cb) {
        const ref = collection(db, ...pathArr)
        const unsub = onSnapshot(
          ref,
          cb,
          (e) => console.error('[Realtime] col error', pathArr.join('/'), e)
        )
        this._unsubs.push(unsub)
      },
    }

    // Expose globally
    window.TSDRealtime = Realtime
    console.log('[Realtime] ✅ window.TSDRealtime is now available')

    // Auto-stop on unload
    window.addEventListener('beforeunload', () => Realtime.stop())
  }).catch(e => {
    console.error('[Realtime] Failed to initialize:', e)
  })
})()
