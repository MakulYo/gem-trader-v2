// wallet.js  — pure ESM in the browser

// ***** Imports (served as ESM bundles) *****
import WaxJS from 'https://esm.sh/@waxio/waxjs@1.7.1?bundle';
import AnchorLink from 'https://esm.sh/anchor-link@3.6.3?bundle';
import AnchorLinkBrowserTransport from 'https://esm.sh/anchor-link-browser-transport@3.3.0?bundle';

// (Optional) If you later want Wombat via eos-transit, we’ll add it separately.

// ***** Project config *****
const CHAIN_ENDPOINT = 'https://wax.greymass.com';   // public WAX RPC
const CHAIN_ID      = '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1a159d5b7c3f7e0a';

const TSDM = { contract: 'lucas3333555', symbol: 'TSDM', precision: 4 };

// ***** DOM helpers *****
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];

const navWallet       = $('#nav-wallet');
const connectBtn      = $('#connect-wallet');
const disconnectBtn   = $('#disconnect-wallet');
const walletAddrEl    = $('#wallet-address');
const walletBalEl     = $('#wallet-balance');
const walletModal     = $('#wallet-modal');
const walletError     = $('#wallet-error');
const tsdHeaderNum    = document.querySelector('#tsd-balance'); // your dashboard number

// Hide fake balance by default
if (walletBalEl) walletBalEl.classList.add('hidden');
if (tsdHeaderNum) tsdHeaderNum.textContent = '—';

// ***** Runtime singletons *****
let wax = null;            // WAX Cloud Wallet
let anchor = null;         // Anchor Link
let anchorSession = null;  // persisted Anchor session
let activeAccount = null;  // { name, type: 'cloud'|'anchor' }

// Small logger
const log = (...a) => console.log('[wallet]', ...a);

// =======================  WAX CLOUD WALLET  =======================
async function connectCloud() {
  try {
    if (!wax) {
      wax = new WaxJS({ rpcEndpoint: CHAIN_ENDPOINT, tryAutoLogin: true });
    }

    // autoLogin first
    const already = await wax.isAutoLoginAvailable();
    log('cloud autoLoginAvailable?', already);

    const userAccount = already ? wax.userAccount : await wax.login(); // opens popup if needed
    activeAccount = { name: userAccount, type: 'cloud' };
    log('cloud connected', activeAccount);

    await refreshBalance();
    updateUIConnected(userAccount);
    return activeAccount;
  } catch (err) {
    showError('Cloud Wallet: ' + (err?.message || err));
    throw err;
  }
}

async function signAndPushCloud(actions) {
  if (!wax) throw new Error('Cloud wallet not ready');
  return wax.api.transact({ actions }, { blocksBehind: 3, expireSeconds: 120 });
}

// ===========================  ANCHOR  =============================
function makeAnchorLink() {
  const transport = new AnchorLinkBrowserTransport();
  return new AnchorLink({
    transport,
    chains: [{ chainId: CHAIN_ID, nodeUrl: CHAIN_ENDPOINT }],
  });
}

async function connectAnchor() {
  try {
    if (!anchor) anchor = makeAnchorLink();

    // restore session if possible
    anchorSession = await anchor.restoreSession('tsdgems') // app identifier
      .catch(() => null);

    if (!anchorSession) {
      const { session } = await anchor.login('tsdgems');
      anchorSession = session;
    }

    activeAccount = { name: anchorSession.auth.actor.toString(), type: 'anchor' };
    log('anchor connected', activeAccount);

    await refreshBalance();
    updateUIConnected(activeAccount.name);
    return activeAccount;
  } catch (err) {
    showError('Anchor: ' + (err?.message || err));
    throw err;
  }
}

async function signAndPushAnchor(actions) {
  if (!anchorSession) throw new Error('Anchor session missing');
  return anchorSession.transact({ action: actions, actions }, { broadcast: true });
}

// ===========================  Wombat  =============================
// We’ll add when needed via eos-transit. (Left out now to keep this stable.)

// =========================  BALANCE READ  =========================
// Reads token balance via RPC (no signature). Works for both wallets.
import { JsonRpc } from 'https://esm.sh/eosjs@22.1.0?bundle';
const rpc = new JsonRpc(CHAIN_ENDPOINT, { fetch });

async function getTsdmBalance(account) {
  // eosio.token-like contract standard: get currency balance
  const rows = await rpc.get_table_rows({
    code: TSDM.contract,
    scope: account,
    table: 'accounts',
    json: true,
    limit: 50
  });

  // Find the “TSDM” balance (asset string like "12.3456 TSDM")
  const match = rows.rows?.find(r => String(r.balance).endsWith(` ${TSDM.symbol}`));
  if (!match) return 0;
  const amt = Number(String(match.balance).split(' ')[0]);
  return isFinite(amt) ? amt : 0;
}

async function refreshBalance() {
  try {
    if (!activeAccount) return;
    const bal = await getTsdmBalance(activeAccount.name);
    const display = bal.toFixed(TSDM.precision);

    if (walletBalEl) {
      walletBalEl.textContent = `${display} ${TSDM.symbol}`;
      walletBalEl.classList.remove('hidden');
    }
    if (tsdHeaderNum) tsdHeaderNum.textContent = display;
  } catch (e) {
    // Don’t hard-fail the UI if balance fails
    log('balance read failed', e);
  }
}

// ==========================  UI WIRING  ===========================
function updateUIConnected(account) {
  if (connectBtn) connectBtn.classList.add('hidden');
  if (disconnectBtn) disconnectBtn.classList.remove('hidden');

  if (walletAddrEl) {
    walletAddrEl.textContent = account;
    walletAddrEl.classList.remove('hidden');
  }
  if (walletModal) {
    walletModal.classList.add('hidden');
    walletModal.setAttribute('aria-hidden','true');
  }
}

function updateUIDisconnected() {
  activeAccount = null;
  anchorSession = null;

  if (walletAddrEl) {
    walletAddrEl.textContent = '';
    walletAddrEl.classList.add('hidden');
  }
  if (walletBalEl) {
    walletBalEl.textContent = '0.0000 TSDM';
    walletBalEl.classList.add('hidden');
  }
  if (connectBtn) connectBtn.classList.remove('hidden');
  if (disconnectBtn) disconnectBtn.classList.add('hidden');
  if (tsdHeaderNum) tsdHeaderNum.textContent = '—';
}

function showError(msg) {
  console.error(msg);
  if (walletError) {
    walletError.textContent = msg;
    walletError.classList.remove('hidden');
  }
}

// Hook up the modal buttons you already have in HTML
window.addEventListener('tsd:wallet:connect', async (ev) => {
  const provider = ev.detail?.provider; // 'cloud' | 'anchor' | 'wombat'
  try {
    if (provider === 'cloud')      await connectCloud();
    else if (provider === 'anchor') await connectAnchor();
    else                            showError('Wombat not wired yet');
  } catch (_) { /* handled in connect */ }
});

window.addEventListener('tsd:wallet:disconnect', async () => {
  try {
    if (activeAccount?.type === 'anchor' && anchorSession) {
      await anchor?.logout?.(anchorSession);
    }
    // WAX Cloud Wallet has no explicit “logout”; just drop local state.
  } finally {
    updateUIDisconnected();
  }
});

// Try auto-restore on load (Anchor restore, Wax autoLogin)
(async function boot() {
  log('libs:', {
    hasWax: !!WaxJS,
    hasAnchor: !!AnchorLink && !!AnchorLinkBrowserTransport
  });

  // Try WAX autologin first (non-blocking if not available)
  try {
    await connectCloud();  // if auto-login available, this resolves without popup
  } catch (_) {
    // Ignore; user can choose provider
  }

  // Then try to restore Anchor session (if any)
  try {
    if (!activeAccount) await connectAnchor(); // will restore if session exists, otherwise shows Anchor UI
  } catch (_) {
    // Ignore; user can manually pick Anchor later
  }
})();
