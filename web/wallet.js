// web/wallet.js  — standalone, no api.js / bridge.js required

import { SessionKit } from 'https://esm.sh/@wharfkit/session@1'
import { WebRenderer } from 'https://esm.sh/@wharfkit/web-renderer@1'
import { WalletPluginAnchor } from 'https://esm.sh/@wharfkit/wallet-plugin-anchor@1'
import { WalletPluginCloudWallet } from 'https://esm.sh/@wharfkit/wallet-plugin-cloudwallet@1'
import { WalletPluginWombat } from 'https://esm.sh/@wharfkit/wallet-plugin-wombat@1'

// --- Backend (Firebase Functions) - used only to init player & read dashboard ---
const API_BASE = 'https://us-central1-tsdgems-trading.cloudfunctions.net'

async function initPlayer(actor) {
  const r = await fetch(`${API_BASE}/initPlayer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor }),
  })
  if (!r.ok) throw new Error(`initPlayer ${r.status}`)
  return r.json()
}

async function getDashboard(actor) {
  const u = new URL(`${API_BASE}/getDashboard`)
  u.searchParams.set('actor', actor)
  const r = await fetch(u)
  if (!r.ok) throw new Error(`getDashboard ${r.status}`)
  return r.json()
}

// --- WAX mainnet chain ---
const CHAIN = {
  id: '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4',
  url: 'https://wax.greymass.com',
}
const APP_NAME = 'TSDGEMS'

// --- Local state / small helpers ---
let sessionKit
let session

const $ = (s) => document.querySelector(s)
const connectBtn = $('#connectWalletBtn') // optional
const logoutBtn  = $('#logoutBtn')        // optional
const statusEl   = $('#walletStatus')     // optional

function setStatus(t) { if (statusEl) statusEl.textContent = t || '' }

async function updateUI() {
  if (!connectBtn) return
  if (session) {
    const actor = session.actor?.toString?.() ?? ''
    connectBtn.textContent = `Connected: ${actor}`
    connectBtn.disabled = true
    logoutBtn?.classList.remove('hidden')
  } else {
    connectBtn.textContent = 'Connect Wallet'
    connectBtn.disabled = false
    logoutBtn?.classList.add('hidden')
    setStatus('')
  }
}

function initSessionKit() {
  if (sessionKit) return sessionKit
  const ui = new WebRenderer()
  sessionKit = new SessionKit({
    appName: APP_NAME,
    chains: [CHAIN],
    ui,
    walletPlugins: [
      new WalletPluginCloudWallet(),
      new WalletPluginAnchor(),
      new WalletPluginWombat(),
    ],
  })
  return sessionKit
}

// --- Public helper for Toxic/script.js ---
window.walletConnect = async function walletConnect() {
  initSessionKit()
  const { session: s } = await sessionKit.login()   // opens WharfKit modal
  session = s
  await updateUI()

  const actor = session?.actor?.toString?.()
  if (!actor) throw new Error('No actor returned from session')

  // Optional: create/refresh player & show Game $ in navbar
  try {
    await initPlayer(actor)
    const dash = await getDashboard(actor)
    const el = document.getElementById('header-game-dollars') // optional badge
    const val = dash?.profile?.ingameCurrency
    if (el && typeof val === 'number') el.textContent = `Game $: ${val.toLocaleString()}`
  } catch (e) {
    console.warn('[wallet] hydrate skipped:', e)
  }

  return actor
}

async function login() {
  try {
    const actor = await window.walletConnect()
    setStatus(`Logged in as ${actor}`)
  } catch (err) {
    console.error('[login] error:', err)
    setStatus(err?.message || 'Wallet login cancelled/failed.')
  }
}

async function logout() {
  try { if (sessionKit && session) await sessionKit.logout(session) }
  catch (err) { console.warn('[logout] error:', err) }
  finally { session = undefined; await updateUI() }
}

// --- Wire up once DOM is ready ---
document.addEventListener('DOMContentLoaded', async () => {
  initSessionKit()
  try { session = await sessionKit.restore() } catch {}
  connectBtn?.addEventListener('click', login)
  logoutBtn?.addEventListener('click', logout)
  await updateUI()
})
