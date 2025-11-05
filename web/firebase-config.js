// --- Firebase environment auto-switch (dev/prod) ---
// Detect domain and pick the right Firebase project.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";

const CONFIGS = {
  // 🧪 DEV (tsdm-6896d)
  "tsdgems-dev.web.app": {
    apiKey: "AIzaSyDAOym-rAkyMfIbACOg3J4xwcctnNEWMrk",
    authDomain: "tsdm-6896d.firebaseapp.com",
    projectId: "tsdm-6896d",
    storageBucket: "tsdm-6896d.firebasestorage.app",
    messagingSenderId: "868590873301",
    appId: "1:868590873301:web:9bff63e34e67472cbd105c",
    measurementId: "G-LJWGJBLBZG"
  },

  // 🚀 PROD (tsdgems-trading)
  "tsdgems.xyz": {
    apiKey: "AIzaSyB-jdj0AZqynKKcbCgmSbFeybtqE9Qky6Y",
    authDomain: "tsdgems-trading.firebaseapp.com",
    projectId: "tsdgems-trading",
    storageBucket: "tsdgems-trading.firebasestorage.app",
    messagingSenderId: "222703202647",
    appId: "1:222703202647:web:741dfb4f14a2553f034e12",
    measurementId: "G-LL792JGGLJ"
  }
};

// --- pick which config to use ---
const host = location.hostname;
const cfg =
  CONFIGS[host] ||
  CONFIGS["tsdgems-dev.web.app"]; // default to dev locally or previews

// --- initialize Firebase ---
const app = initializeApp(cfg);
const db = getFirestore(app, "tsdgems"); // note: named DB "tsdgems"
const analytics = getAnalytics(app);

// expose globally for other scripts
window.firebaseApp = app;
window.firestoreDb = db;

console.log(`[Firebase] Initialized for ${host}: ${cfg.projectId}`);
