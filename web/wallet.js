// web/wallet.js — standalone, no api.js / bridge.js required

import { SessionKit } from 'https://esm.sh/@wharfkit/session@1'
import { WebRenderer } from 'https://esm.sh/@wharfkit/web-renderer@1'
import { WalletPluginAnchor } from 'https://esm.sh/@wharfkit/wallet-plugin-anchor@1'
import { WalletPluginCloudWallet } from 'https://esm.sh/@wharfkit/wallet-plugin-cloudwallet@1'
import { WalletPluginWombat } from 'https://esm.sh/@wharfkit/wallet-plugin-wombat@1'

// --- Backend base URL (auto from firebase-config.js / hosting rewrites) ---
const IS_LOCALHOST = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
const API_BASE = window.firebaseApiBase || (IS_LOCALHOST ? '' : ''); // empty = use Hosting rewrites

// Helpers for calling functions whether API_BASE is absolute or '' (rewrites)
async function fxGet(path, params = {}) {
  let url
  if (API_BASE) {
    url = new URL(`${API_BASE}${path}`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    return fetch(url.toString())
  } else {
    const qs = new URLSearchParams(params).toString()
    return fetch(`${path}${qs ? `?${qs}` : ''}`)
  }
}
async function fxPost(path, body = {}) {
  const url = API_BASE ? `${API_BASE}${path}` : path
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// --- Functions used here: initPlayer + getDashboard ---
async function initPlayer(actor) {
  const r = await fxPost('/initPlayer', { actor })
  if (!r.ok) throw new Error(`initPlayer ${r.status}`)
  return r.json()
}
async function getDashboard(actor) {
  const r = await fxGet('/getDashboard', { actor })
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
let manualLogout = localStorage.getItem('tsdgems_manual_logout') === 'true'

const $ = (s) => document.querySelector(s)
function setStatus(t) { const el = $('#walletStatus'); if (el) el.textContent = t || '' }

async function updateUI(preserveStatus = false) {
  const connectBtn = $('#connectWalletBtn')
  const logoutBtn = $('#logoutBtn')
  if (!connectBtn) return

  if (session) {
    const actor = session.actor?.toString?.() ?? ''
    const walletName = session.walletPlugin?.metadata?.name || session.walletPlugin?.id || 'Unknown'
    const shortActor = actor.length > 12 ? `${actor.substring(0, 9)}...` : actor
    connectBtn.innerHTML = `<i class="fas fa-check-circle"></i> ${shortActor}`
    connectBtn.disabled = true
    connectBtn.classList.remove('hidden'); connectBtn.style.display = ''
    if (logoutBtn) { logoutBtn.classList.remove('hidden'); logoutBtn.style.display = '' }
    if (!preserveStatus) setStatus(walletName)
  } else {
    connectBtn.innerHTML = '<i class="fas fa-wallet"></i> Connect Wallet'
    connectBtn.disabled = false
    connectBtn.classList.remove('hidden'); connectBtn.style.display = ''
    if (logoutBtn) logoutBtn.classList.add('hidden')
    if (!preserveStatus) setStatus('')
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
      new WalletPluginAnchor({ disableGreymassFuel: false }),
      new WalletPluginWombat(),
    ],
  })
  window.walletSessionKit = sessionKit
  return sessionKit
}

// Public helper (also used internally)
window.walletConnect = async function walletConnect() {
  initSessionKit()

  if (session) {
    try { await sessionKit.logout(session) } catch {}
    session = undefined
  }

  const { session: s } = await sessionKit.login()
  if (!s) throw new Error('No session returned from login')
  session = s

  manualLogout = false
  localStorage.removeItem('tsdgems_manual_logout')

  const actor = session?.actor?.toString?.()
  if (!actor) throw new Error('No actor returned from session')

  window.walletSessionInfo.actor = actor
  window.walletSessionInfo.isRestored = false

  setStatus('Loading data...')
  await updateUI(true)

  try {
    await initPlayer(actor)
    const dash = await getDashboard(actor)
    const el = document.getElementById('header-game-dollars')
    const val = dash?.profile?.ingameCurrency
    if (el && typeof val === 'number') el.textContent = `Game $: ${val.toLocaleString()}`
    setStatus(session.walletPlugin?.metadata?.name || session.walletPlugin?.id || '')
  } catch (e) {
    console.warn('[wallet] hydrate skipped:', e)
    setStatus(session.walletPlugin?.metadata?.name || session.walletPlugin?.id || '')
  }

  // 🔴 Start realtime listeners for this actor
  try { window.TSDRealtime?.start(actor) } catch (e) { console.warn('[Wallet] Realtime start failed', e) }

  window.dispatchEvent(new CustomEvent('wallet-connected', { detail: { actor, session } }))
  return actor
}

async function login() {
  try {
    setStatus('Loading...')
    const btn = $('#connectWalletBtn')
    if (btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...'; btn.disabled = true }
    await window.walletConnect()
  } catch (err) {
    console.error('[login] error:', err)
    setStatus(err?.message || 'Login cancelled')
    await updateUI()
  }
}

async function logout() {
  manualLogout = true
  localStorage.setItem('tsdgems_manual_logout', 'true')
  try {
    if (sessionKit && session) await sessionKit.logout(session)
    try {
      const sessions = await sessionKit.getSessions()
      for (const s of sessions) await sessionKit.logout(s)
      // scrub localStorage keys
      const keys = []; for (let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(k && (k.startsWith('wharf-')||k.includes('session')) && k!=='tsdgems_manual_logout') keys.push(k)}
      keys.forEach(k => localStorage.removeItem(k))
    } catch (e) { console.warn('[Wallet] clear sessions err', e) }
  } catch (e) { console.warn('[Wallet] logout err', e) }
  finally {
    // 🔴 Stop realtime listeners
    try { window.TSDRealtime?.stop() } catch {}

    session = undefined
    window.walletSessionInfo.actor = null
    window.walletSessionInfo.isRestored = false
    setStatus('')
    await updateUI(false)
    window.dispatchEvent(new CustomEvent('wallet-disconnected'))
  }
}

window.walletSessionInfo = { actor: null, isRestored: false, isReady: false }

function setupEventListeners() {
  const connectBtn = $('#connectWalletBtn')
  const logoutBtn = $('#logoutBtn')
  if (connectBtn && !connectBtn.dataset.listenerAttached) {
    connectBtn.addEventListener('click', login)
    connectBtn.dataset.listenerAttached = 'true'
  }
  if (logoutBtn && !logoutBtn.dataset.listenerAttached) {
    logoutBtn.addEventListener('click', logout)
    logoutBtn.dataset.listenerAttached = 'true'
  }
}

window.walletSetupListeners = setupEventListeners

document.addEventListener('DOMContentLoaded', async () => {
  initSessionKit()

  if (!manualLogout) {
    try {
      const restored = await sessionKit.restore()
      if (restored) {
        const stillLoggedOut = localStorage.getItem('tsdgems_manual_logout') === 'true'
        if (stillLoggedOut) {
          await sessionKit.logout(restored)
          session = undefined
          window.walletSessionInfo.actor = null
          window.walletSessionInfo.isRestored = false
        } else {
          if (session && session !== restored) { try { await sessionKit.logout(session) } catch {} }
          session = restored
          const actor = String(session.actor)
          const walletName = session.walletPlugin?.metadata?.name || session.walletPlugin?.id || 'Unknown'
          window.walletSessionInfo.actor = actor
          window.walletSessionInfo.isRestored = true
          setStatus(walletName)
          await updateUI(true)

          // 🔴 Start realtime for restored session
          try { window.TSDRealtime?.start(actor) } catch (e) { console.warn('[Wallet] Realtime start failed', e) }

          setTimeout(async () => {
            window.dispatchEvent(new CustomEvent('wallet-session-restored', { detail: { actor, session } }))
            setTimeout(async () => {
              if (window.backendService) {
                try { await window.backendService.getDashboard(actor) } catch {}
              }
            }, 500)
          }, 100)
        }
      }
    } catch (e) {
      session = undefined
      window.walletSessionInfo.actor = null
      window.walletSessionInfo.isRestored = false
    }
  } else {
    session = undefined
    window.walletSessionInfo.actor = null
    window.walletSessionInfo.isRestored = false
    try {
      const sessions = await sessionKit.getSessions()
      for (const s of sessions) await sessionKit.logout(s)
      const keys = []; for (let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(k && (k.startsWith('wharf-')||k.includes('session'))) keys.push(k)}
      keys.forEach(k => localStorage.removeItem(k))
    } catch (e) { console.warn('[Wallet] cleanup err', e) }
  }

  setupEventListeners()
  await updateUI(false)
  window.walletSessionInfo.isReady = true
})

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    const storedLogout = localStorage.getItem('tsdgems_manual_logout') === 'true'
    if (storedLogout) {
      manualLogout = true
      session = undefined
      window.walletSessionInfo.actor = null
      window.walletSessionInfo.isRestored = false
      try { window.TSDRealtime?.stop() } catch {}
    }
    setupEventListeners()
    updateUI(false)
  }
})
