// TSDGEMS - Firebase Realtime Listeners
// Echtzeitverbindung zu Firestore für sofortige Updates

// Import Firebase modules (laden über CDN in HTML)
// <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>

class FirebaseRealtimeService {
    constructor() {
        this.db = null;
        this.listeners = [];
        this.initialized = false;
    }

    /**
     * Initialize Firebase connection
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // Firebase config - adjust to your project
            const firebaseConfig = {
                projectId: 'tsdgems-trading',
                databaseURL: 'https://tsdgems-trading.firebaseio.com'
            };

            // Initialize Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }

            this.db = firebase.firestore();
            
            // Use 'tsdgems' database
            this.db = firebase.app().firestore('tsdgems');
            
            this.initialized = true;
            console.log('[Firebase Realtime] Initialized successfully');
        } catch (error) {
            console.error('[Firebase Realtime] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Listen to Base Price changes in real-time
     * @param {Function} callback - Called when base price updates
     * @returns {Function} Unsubscribe function
     */
    listenToBasePrice(callback) {
        if (!this.initialized) {
            console.error('[Firebase Realtime] Not initialized');
            return () => {};
        }

        console.log('[Firebase Realtime] Setting up base price listener...');

        const unsubscribe = this.db.doc('game_config/base_price')
            .onSnapshot((snapshot) => {
                if (snapshot.exists) {
                    const data = snapshot.data();
                    console.log('[Firebase Realtime] Base price updated:', data);
                    callback(data);
                } else {
                    console.warn('[Firebase Realtime] Base price document not found');
                }
            }, (error) => {
                console.error('[Firebase Realtime] Base price listener error:', error);
            });

        this.listeners.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Listen to City Boosts changes in real-time
     * @param {Function} callback - Called when boosts update
     * @returns {Function} Unsubscribe function
     */
    listenToCityBoosts(callback) {
        if (!this.initialized) {
            console.error('[Firebase Realtime] Not initialized');
            return () => {};
        }

        console.log('[Firebase Realtime] Setting up city boosts listener...');

        // Listen to all city_boosts documents
        const unsubscribe = this.db.collection('city_boosts')
            .onSnapshot((snapshot) => {
                const boosts = [];
                snapshot.forEach((doc) => {
                    boosts.push({
                        id: doc.id,
                        bonuses: doc.data().bonuses || {}
                    });
                });
                
                console.log('[Firebase Realtime] City boosts updated:', boosts.length, 'cities');
                callback(boosts);
            }, (error) => {
                console.error('[Firebase Realtime] City boosts listener error:', error);
            });

        this.listeners.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Listen to Cities configuration
     * @param {Function} callback - Called when cities config updates
     * @returns {Function} Unsubscribe function
     */
    listenToCities(callback) {
        if (!this.initialized) {
            console.error('[Firebase Realtime] Not initialized');
            return () => {};
        }

        console.log('[Firebase Realtime] Setting up cities listener...');

        const unsubscribe = this.db.doc('game_config/cities')
            .onSnapshot((snapshot) => {
                if (snapshot.exists) {
                    const data = snapshot.data();
                    const cities = data.list || [];
                    console.log('[Firebase Realtime] Cities updated:', cities.length);
                    callback(cities);
                } else {
                    console.warn('[Firebase Realtime] Cities document not found');
                    callback([]);
                }
            }, (error) => {
                console.error('[Firebase Realtime] Cities listener error:', error);
            });

        this.listeners.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Listen to complete city matrix (cities + boosts)
     * @param {Function} callback - Called when matrix updates
     * @returns {Array} Unsubscribe functions
     */
    listenToCityMatrix(callback) {
        let citiesData = [];
        let boostsData = [];
        let updateCount = 0;

        const triggerCallback = () => {
            // Only call callback when both have data
            if (citiesData.length > 0 || boostsData.length > 0) {
                callback({
                    cities: citiesData,
                    boosts: boostsData
                });
            }
        };

        const citiesUnsubscribe = this.listenToCities((cities) => {
            citiesData = cities;
            updateCount++;
            console.log(`[Firebase Realtime] City matrix update ${updateCount}: cities received`);
            triggerCallback();
        });

        const boostsUnsubscribe = this.listenToCityBoosts((boosts) => {
            boostsData = boosts;
            updateCount++;
            console.log(`[Firebase Realtime] City matrix update ${updateCount}: boosts received`);
            triggerCallback();
        });

        return [citiesUnsubscribe, boostsUnsubscribe];
    }

    /**
     * Listen to Player data changes in real-time
     * @param {string} actor - Player account name
     * @param {Function} callback - Called when player data updates
     * @returns {Function} Unsubscribe function
     */
    listenToPlayer(actor, callback) {
        if (!this.initialized) {
            console.error('[Firebase Realtime] Not initialized');
            return () => {};
        }

        if (!actor) {
            console.error('[Firebase Realtime] No actor provided');
            return () => {};
        }

        console.log('[Firebase Realtime] Setting up player listener for:', actor);

        const unsubscribe = this.db.doc(`players/${actor}`)
            .onSnapshot((snapshot) => {
                if (snapshot.exists) {
                    const data = snapshot.data();
                    console.log('[Firebase Realtime] Player data updated:', actor);
                    callback(data);
                } else {
                    console.warn('[Firebase Realtime] Player document not found:', actor);
                    callback(null);
                }
            }, (error) => {
                console.error('[Firebase Realtime] Player listener error:', error);
            });

        this.listeners.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Listen to complete Dashboard data (player + global data)
     * @param {string} actor - Player account name
     * @param {Function} callback - Called when dashboard data updates
     * @returns {Array} Unsubscribe functions
     */
    listenToDashboard(actor, callback) {
        if (!actor) {
            console.error('[Firebase Realtime] No actor provided for dashboard');
            return [];
        }

        console.log('[Firebase Realtime] Setting up dashboard listeners for:', actor);

        let playerData = null;
        let basePriceData = null;
        let updateCount = 0;

        const triggerCallback = () => {
            if (playerData) {
                callback({
                    player: playerData,
                    basePrice: basePriceData
                });
            }
        };

        // Listen to player data
        const playerUnsubscribe = this.listenToPlayer(actor, (data) => {
            playerData = data;
            updateCount++;
            console.log(`[Firebase Realtime] Dashboard update ${updateCount}: player data received`);
            triggerCallback();
        });

        // Listen to base price
        const basePriceUnsubscribe = this.listenToBasePrice((data) => {
            basePriceData = data;
            updateCount++;
            console.log(`[Firebase Realtime] Dashboard update ${updateCount}: base price received`);
            triggerCallback();
        });

        return [playerUnsubscribe, basePriceUnsubscribe];
    }

    /**
     * Clean up all listeners
     */
    cleanup() {
        console.log('[Firebase Realtime] Cleaning up listeners...');
        this.listeners.forEach(unsubscribe => unsubscribe());
        this.listeners = [];
    }
}

// Create global instance
window.firebaseRealtimeService = new FirebaseRealtimeService();
console.log('[Firebase Realtime] Service created');

