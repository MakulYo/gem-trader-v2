import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const cfg = {
  apiKey: "AIzaSyDAOym-rAkyMfIbACOg3J4xwcctnNEWMrk",
  authDomain: "tsdm-6896d.firebaseapp.com",
  projectId: "tsdm-6896d",
  storageBucket: "tsdm-6896d.firebasestorage.app",
  messagingSenderId: "868590873301",
  appId: "1:868590873301:web:9bff63e34e67472cbd105c",
  measurementId: "G-LJWGJBLBZG",
};

const app = getApps().length ? getApps()[0] : initializeApp(cfg);
const db = getFirestore(app);

window.firebaseApp = app;
window.db = db;
console.log("[Firebase] DEV loaded:", cfg.projectId);
