// web/wallet.js
// WharfKit SessionKit + WebRenderer + Cloud/Anchor/Wombat (CDN ESM, no bundler)
import { SessionKit } from 'https://esm.sh/@wharfkit/session@1';
import { WebRenderer } from 'https://esm.sh/@wharfkit/web-renderer@1';
import { WalletPluginAnchor } from 'https://esm.sh/@wharfkit/wallet-plugin-anchor@1';
import { WalletPluginCloudWallet } from 'https://esm.sh/@wharfkit/wallet-plugin-cloudwallet@1';
import { WalletPluginWombat } from 'https://esm.sh/@wharfkit/wallet-plugin-wombat@1';

// ---- Config (WAX mainnet) ----
const CHAIN = {
  id: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
  url: 'https://wax.greymass.com',
};
const APP_NAME = 'TSDGEMS';

// ---- State ----
let sessionKit;
let session;

// ---- Tiny helpers ----
const $ = (s) => document.querySelector(s);
const connectBtn = $('#connectWalletBtn');
const logoutBtn  = $('#logoutBtn');
const statusEl   = $('#walletStatus');

function setStatus(text) {
  if (statusEl) statusEl.textContent = text || '';
}

async function updateUI() {
  if (!connectBtn) return;
  if (session) {
    const actor = session.actor?.toString?.() ?? '';
    connectBtn.textContent = `Connected: ${actor}`;
    connectBtn.disabled = true;
    if (logoutBtn) logoutBtn.classList.remove('hidden');
  } else {
    connectBtn.textContent = 'Connect Wallet';
    connectBtn.disabled = false;
    if (logoutBtn) logoutBtn.classList.add('hidden');;
    setStatus('');
  }
}

// ---- Init once ----
function initSessionKit() {
  if (sessionKit) return sessionKit;

  const ui = new WebRenderer();
  sessionKit = new SessionKit({
    appName: APP_NAME,
    chains: [CHAIN],
    ui,
    walletPlugins: [
      new WalletPluginCloudWallet(), // WAX Cloud Wallet
      new WalletPluginAnchor(),      // Anchor
      new WalletPluginWombat(),      // Wombat
    ],
  });

  return sessionKit;
}

// ---- Flows ----
async function login() {
  try {
    initSessionKit();
    const { session: s } = await sessionKit.login(); // opens WharfKit UI/modal
    session = s;
    // after: session = s;
try {
  const actor = session.actor?.toString?.();
  if (actor) {
    await apiInitPlayer(actor);
    const dash = await apiGetDashboard(actor);
    const el = document.getElementById('header-game-dollars');
    if (el && dash?.profile?.ingameCurrency != null) {
      el.textContent = `Game $: ${dash.profile.ingameCurrency.toLocaleString()}`;
    }
  }
} catch (e) {
  console.warn('dashboard hydrate failed', e);
}

  } catch (err) {
    console.error('[login] error:', err);
    setStatus(err?.message || 'Wallet login cancelled/failed.');
  } finally {
    await updateUI();
  }
  if (actor) {
  await apiInitPlayer(actor);
  await hydrateBackend(actor);  // <-- fetch dashboard + cities
}
}

async function logout() {
  try {
    if (sessionKit && session) {
      await sessionKit.logout(session);
    }
  } catch (err) {
    console.warn('[logout] error:', err);
  } finally {
    session = undefined;
    await updateUI();
  }
}

// ---- Wire up DOM once it exists ----
document.addEventListener('DOMContentLoaded', async () => {
  initSessionKit();
  try { session = await sessionKit.restore(); } catch {}
  if (connectBtn) connectBtn.addEventListener('click', login);
  if (logoutBtn)  logoutBtn.addEventListener('click', logout);
  await updateUI();
});

// --- add at the very bottom of wallet.js ---
window.walletConnect = async function walletConnect() {
  try {
    // ensure SessionKit is ready
    initSessionKit();
    const { session: s } = await sessionKit.login(); // opens the WharfKit modal
    session = s;

    const actor = session?.actor?.toString?.();
    if (!actor) throw new Error('No actor returned from session');

    // (optional) also keep the button state in wallet.js in sync
    await updateUI?.();

    return actor;
  } catch (e) {
    console.error('[walletConnect] failed:', e);
    throw e;
  }
};
