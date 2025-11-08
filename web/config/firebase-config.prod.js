import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const cfg = {
  apiKey: "AIzaSyB-jdj0AZqynKKcbCgmSbFeybtqE9Qky6Y",
  authDomain: "tsdgems-trading.firebaseapp.com",
  projectId: "tsdgems-trading",
  storageBucket: "tsdgems-trading.firebasestorage.app",
  messagingSenderId: "222703202647",
  appId: "1:222703202647:web:741dfb4f14a2553f034e12",
  measurementId: "G-LL792JGGLJ",
};

const app = getApps().length ? getApps()[0] : initializeApp(cfg);
const db = getFirestore(app);

window.firebaseApp = app;
window.db = db;
console.log("[Firebase] PROD loaded:", cfg.projectId);
