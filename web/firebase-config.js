// web/firebase-config.js

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";

const CONFIGS = {
  dev: {
    apiKey: "AIzaSyDAOym-rAkyMfIbACOg3J4xwcctnNEWMrk",
    authDomain: "tsdm-6896d.firebaseapp.com",
    projectId: "tsdm-6896d",
    storageBucket: "tsdm-6896d.firebasestorage.app",
    messagingSenderId: "868590873301",
    appId: "1:868590873301:web:9bff63e34e67472cbd105c",
    measurementId: "G-LJWGJBLBZG"
  },
  prod: {
    apiKey: "AIzaSyB-jdj0AZqynKKcbCgmSbFeybtqE9Qky6Y",
    authDomain: "tsdgems-trading.firebaseapp.com",
    projectId: "tsdgems-trading",
    storageBucket: "tsdgems-trading.firebasestorage.app",
    messagingSenderId: "222703202647",
    appId: "1:222703202647:web:741dfb4f14a2553f034e12",
    measurementId: "G-LL792JGGLJ"
  }
};

const host = location.hostname.toLowerCase();
const isLocal = host === "localhost" || host === "127.0.0.1";
const isDevHost =
  isLocal ||
  host.includes("tsdgems-dev") ||
  host.includes("tsdm-6896d") ||
  host === "dev.tsdgems.app" ||
  host.endsWith(".dev.tsdgems.app");
const isProdHost =
  host === "tsdgems.xyz" ||
  host === "www.tsdgems.xyz" ||
  host.endsWith(".tsdgems.xyz") ||
  host.includes("tsdgems-trading");

const env = isDevHost ? "dev" : (isProdHost ? "prod" : "prod");
const cfg = CONFIGS[env];

// Check if we already have an app with the correct config
let app = null;
const existingApps = getApps();
for (const existingApp of existingApps) {
  // Check if this app has the correct project ID
  if (existingApp.options.projectId === cfg.projectId) {
    app = existingApp;
    break;
  }
}
// If no matching app found, create a new one
if (!app) {
  app = initializeApp(cfg);
}

// IMPORTANT: use **default** Firestore (no databaseId override)
const db = getFirestore(app);

try { getAnalytics(app); } catch {}

window.firebaseEnv = env;
window.firebaseProjectId = cfg.projectId;
window.firebaseApp = app;
window.firestoreDb = db;

if (!isLocal) {
  window.firebaseApiBase = env === "prod"
    ? "https://us-central1-tsdgems-trading.cloudfunctions.net"
    : "https://us-central1-tsdm-6896d.cloudfunctions.net";
} else {
  window.firebaseApiBase = "";
}

console.log(`[Firebase] Using project: ${cfg.projectId} (env: ${env}, host: ${host})`);

window.db = db;
console.log(`[Firebase] Firestore ready for ${env} (${cfg.projectId})`);
