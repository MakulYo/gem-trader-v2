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
// Track if user manually logged out (check localStorage on init)
let manualLogout = localStorage.getItem('tsdgems_manual_logout') === 'true'

const $ = (s) => document.querySelector(s)

function setStatus(t) { 
  const statusEl = $('#walletStatus')
  if (statusEl) statusEl.textContent = t || '' 
}

async function updateUI(preserveStatus = false) {
  // Re-query buttons each time to handle page navigation
  const connectBtn = $('#connectWalletBtn')
  const logoutBtn = $('#logoutBtn')
  
  if (!connectBtn) {
    console.log('[Wallet] updateUI: Connect button not found')
    return
  }
  
  if (session) {
    const actor = session.actor?.toString?.() ?? ''
    const walletName = session.walletPlugin?.metadata?.name || session.walletPlugin?.id || 'Unknown'
    console.log('[Wallet] updateUI: Setting connected state for', actor, 'via', walletName)
    
    // Show actor address (shortened if too long)
    const shortActor = actor.length > 12 ? `${actor.substring(0, 9)}...` : actor
    connectBtn.innerHTML = `<i class="fas fa-check-circle"></i> ${shortActor}`
    connectBtn.disabled = true
    
    // Remove hidden class if it exists
    connectBtn.classList.remove('hidden')
    connectBtn.style.display = '' // Reset to default
    
    if (logoutBtn) {
      logoutBtn.classList.remove('hidden')
      logoutBtn.style.display = '' // Reset to default
    }
    
    // Only update status if not preserving (e.g., during loading)
    if (!preserveStatus) {
      setStatus(`${walletName}`)
    }
  } else {
    console.log('[Wallet] updateUI: Setting disconnected state')
    connectBtn.innerHTML = '<i class="fas fa-wallet"></i> Connect Wallet'
    connectBtn.disabled = false
    
    // Remove hidden class if it exists (important for visibility)
    connectBtn.classList.remove('hidden')
    connectBtn.style.display = '' // Reset to default (not 'block')
    
    console.log('[Wallet] Connect button should now be visible:', {
      classes: connectBtn.className,
      display: connectBtn.style.display,
      disabled: connectBtn.disabled,
      innerHTML: connectBtn.innerHTML
    })
    
    if (logoutBtn) {
      logoutBtn.classList.add('hidden')
    }
    if (!preserveStatus) {
      setStatus('')
    }
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
      new WalletPluginAnchor({
        // Enable QR code for mobile Anchor
        disableGreymassFuel: false
      }),
      new WalletPluginWombat(),
    ],
  })
  // Make sessionKit globally available for payment service
  window.walletSessionKit = sessionKit
  return sessionKit
}

// --- Public helper for Toxic/script.js ---
window.walletConnect = async function walletConnect() {
  initSessionKit()
  
  // If there's already an active session, log it out first
  if (session) {
    console.log('[Wallet] Existing session detected, logging out first...')
    try {
      await sessionKit.logout(session)
    } catch (e) {
      console.warn('[Wallet] Failed to logout old session:', e)
    }
    session = undefined
  }
  
  // Login with new wallet
  const { session: s } = await sessionKit.login()   // opens WharfKit modal
  
  if (!s) {
    throw new Error('No session returned from login')
  }
  
  session = s
  
  // Reset manual logout flag on successful login
  manualLogout = false
  localStorage.removeItem('tsdgems_manual_logout')
  
  const actor = session?.actor?.toString?.()
  if (!actor) throw new Error('No actor returned from session')

  console.log('[Wallet] New session established for actor:', actor)

  // Update global session info
  window.walletSessionInfo.actor = actor
  window.walletSessionInfo.isRestored = false
  
  // Show loading indicator while fetching backend data
  setStatus('Loading data...')
  
  // Update UI but preserve the loading status
  await updateUI(true)

  // Optional: create/refresh player & show Game $ in navbar
  try {
    await initPlayer(actor)
    const dash = await getDashboard(actor)
    const el = document.getElementById('header-game-dollars') // optional badge
    const val = dash?.profile?.ingameCurrency
    if (el && typeof val === 'number') el.textContent = `Game $: ${val.toLocaleString()}`
    
    // Update status to show wallet name only after loading is complete
    setStatus(session.walletPlugin?.metadata?.name || session.walletPlugin?.id || '')
  } catch (e) {
    console.warn('[wallet] hydrate skipped:', e)
    // Still show wallet name even if data loading failed
    setStatus(session.walletPlugin?.metadata?.name || session.walletPlugin?.id || '')
  }

  // Dispatch custom event for dashboard integration
  console.log('[Wallet] Dispatching wallet-connected event for actor:', actor)
  window.dispatchEvent(new CustomEvent('wallet-connected', { 
    detail: { actor, session } 
  }))

  return actor
}

async function login() {
  try {
    // Show loading indicator
    setStatus('Loading...')
    const connectBtn = $('#connectWalletBtn')
    if (connectBtn) {
      connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...'
      connectBtn.disabled = true
    }
    
    const actor = await window.walletConnect()
    // Status will be updated by updateUI() in walletConnect
  } catch (err) {
    console.error('[login] error:', err)
    setStatus(err?.message || 'Login cancelled')
    // Make sure UI is in correct state after failed login
    await updateUI()
  }
}

async function logout() {
  console.log('[Wallet] Logout requested...')
  
  // Set manual logout flag to prevent auto-restore and persist it
  manualLogout = true
  localStorage.setItem('tsdgems_manual_logout', 'true')
  
  try { 
    if (sessionKit && session) {
      console.log('[Wallet] Logging out session for:', session.actor?.toString())
      await sessionKit.logout(session)
      console.log('[Wallet] SessionKit logout complete')
    } else {
      console.log('[Wallet] No active session to logout')
    }
    
    // IMPORTANT: Clear ALL sessions from SessionKit storage
    // This prevents auto-restore on next page load
    try {
      const sessions = await sessionKit.getSessions()
      console.log('[Wallet] Found', sessions.length, 'sessions in storage, removing all...')
      for (const s of sessions) {
        await sessionKit.logout(s)
        console.log('[Wallet] Logged out session:', s.actor?.toString())
      }
      
      // Additional: Force clear WharfKit storage keys from localStorage
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith('wharf-') || key.includes('session')) && key !== 'tsdgems_manual_logout') {
          keysToRemove.push(key)
        }
      }
      if (keysToRemove.length > 0) {
        console.log('[Wallet] Force removing', keysToRemove.length, 'WharfKit storage keys')
        keysToRemove.forEach(key => {
          console.log('[Wallet] - Removing key:', key)
          localStorage.removeItem(key)
        })
      }
    } catch (e) {
      console.warn('[Wallet] Error clearing all sessions:', e)
    }
  }
  catch (err) { 
    console.warn('[Wallet] logout error:', err) 
  }
  finally { 
    session = undefined
    
    // Update global session info
    window.walletSessionInfo.actor = null
    window.walletSessionInfo.isRestored = false
    
    console.log('[Wallet] Session cleared, updating UI...')
    
    // Clear status immediately
    setStatus('')
    
    // Update UI to show connect button
    await updateUI(false)
    
    // Dispatch disconnect event
    console.log('[Wallet] Dispatching wallet-disconnected event')
    window.dispatchEvent(new CustomEvent('wallet-disconnected'))
    
    console.log('[Wallet] Logout complete - all sessions cleared')
  }
}

// Store session info globally so dashboard can check it
window.walletSessionInfo = {
  actor: null,
  isRestored: false,
  isReady: false
}

// Setup event listeners (call this on page load and navigation)
function setupEventListeners() {
  const connectBtn = $('#connectWalletBtn')
  const logoutBtn = $('#logoutBtn')
  
  if (connectBtn) {
    // IMPORTANT: Don't clone the button - just add event listener
    // Cloning would reset the visual state we just set in updateUI()
    
    // Remove old event listeners by storing a flag
    if (!connectBtn.dataset.listenerAttached) {
      connectBtn.addEventListener('click', login)
      connectBtn.dataset.listenerAttached = 'true'
      console.log('[Wallet] Connect button listener attached (first time)')
    } else {
      console.log('[Wallet] Connect button listener already attached, skipping')
    }
  }
  
  if (logoutBtn) {
    // Same for logout button
    if (!logoutBtn.dataset.listenerAttached) {
      logoutBtn.addEventListener('click', logout)
      logoutBtn.dataset.listenerAttached = 'true'
      console.log('[Wallet] Logout button listener attached (first time)')
    } else {
      console.log('[Wallet] Logout button listener already attached, skipping')
    }
  }
}

// Call setupEventListeners whenever needed (navigation, etc.)
window.walletSetupListeners = setupEventListeners

// --- Wire up once DOM is ready ---
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Wallet] DOMContentLoaded - initializing...')
  console.log('[Wallet] manualLogout flag:', manualLogout)
  
  initSessionKit()
  
  // Try to restore existing session (unless user manually logged out)
  if (!manualLogout) {
    try { 
      console.log('[Wallet] Attempting to restore session...')
      const restored = await sessionKit.restore()
      
      if (restored) {
        // Double-check manualLogout flag (in case it changed)
        const stillLoggedOut = localStorage.getItem('tsdgems_manual_logout') === 'true'
        if (stillLoggedOut) {
          console.log('[Wallet] User logged out during restore, aborting...')
          await sessionKit.logout(restored)
          session = undefined
          window.walletSessionInfo.actor = null
          window.walletSessionInfo.isRestored = false
        } else {
        
        // Clear any existing session first to prevent conflicts
        if (session && session !== restored) {
          console.log('[Wallet] Clearing old session before restore')
          try {
            await sessionKit.logout(session)
          } catch (e) {
            console.warn('[Wallet] Failed to clear old session:', e)
          }
        }
        
        session = restored
        const actor = String(session.actor)
        const walletName = session.walletPlugin?.metadata?.name || session.walletPlugin?.id || 'Unknown'
        console.log('[Wallet] ✅ Session restored for actor:', actor, '(Wallet:', walletName, ')')
        
        // Store in global object
        window.walletSessionInfo.actor = actor
        window.walletSessionInfo.isRestored = true
        
        // Show wallet name immediately (no loading needed for restore)
        setStatus(walletName)
        
        // Update UI immediately after restore
        await updateUI(true)
        
        // Dispatch event for restored session with delay to ensure listeners are ready
        setTimeout(async () => {
          console.log('[Wallet] Dispatching wallet-session-restored event')
          window.dispatchEvent(new CustomEvent('wallet-session-restored', { 
            detail: { actor, session } 
          }))
          
          // Wait a bit longer for backendService to be fully ready
          setTimeout(async () => {
            if (window.backendService) {
              try {
                console.log('[Wallet] Loading dashboard for Game $ update...')
                await window.backendService.getDashboard(actor)
                console.log('[Wallet] Dashboard loaded, Game $ should be updated')
              } catch (error) {
                console.error('[Wallet] Failed to load dashboard:', error)
              }
            } else {
              console.warn('[Wallet] backendService not available yet')
            }
          }, 500)
        }, 100)
        }
      } else {
        console.log('[Wallet] ℹ️ No existing session found to restore')
      }
    } catch (e) {
      console.log('[Wallet] ❌ Session restore failed:', e)
      // If restore fails, make sure we don't have a stale session
      session = undefined
      window.walletSessionInfo.actor = null
      window.walletSessionInfo.isRestored = false
    }
  } else {
    console.log('[Wallet] ⛔ Skipping session restore (user manually logged out)')
    // Make sure session is cleared and no sessions exist in storage
    session = undefined
    window.walletSessionInfo.actor = null
    window.walletSessionInfo.isRestored = false
    
    // CRITICAL: Clear ALL sessions and SessionKit storage
    try {
      // First, try to get and logout all sessions
      const sessions = await sessionKit.getSessions()
      console.log('[Wallet] Found', sessions.length, 'sessions in SessionKit storage')
      if (sessions.length > 0) {
        console.log('[Wallet] Cleaning up all sessions...')
        for (const s of sessions) {
          console.log('[Wallet] - Logging out:', s.actor?.toString())
          await sessionKit.logout(s)
        }
        console.log('[Wallet] All sessions cleared from SessionKit')
      }
      
      // Additional: Clear any WharfKit storage keys from localStorage
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.startsWith('wharf-') || key.includes('session'))) {
          keysToRemove.push(key)
        }
      }
      if (keysToRemove.length > 0) {
        console.log('[Wallet] Removing', keysToRemove.length, 'WharfKit keys from localStorage')
        keysToRemove.forEach(key => localStorage.removeItem(key))
      }
    } catch (e) {
      console.warn('[Wallet] Error during storage cleanup:', e)
    }
  }
  
  // Setup event listeners
  setupEventListeners()
  
  // Update UI again to ensure buttons are correct
  await updateUI(false)
  
  window.walletSessionInfo.isReady = true
  console.log('[Wallet] Initialization complete, walletSessionInfo:', window.walletSessionInfo)
})

// Also listen for page visibility changes to re-setup listeners
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    console.log('[Wallet] Page became visible, refreshing UI...')
    
    // Check if user manually logged out
    const storedLogout = localStorage.getItem('tsdgems_manual_logout') === 'true'
    if (storedLogout) {
      console.log('[Wallet] User is logged out, keeping UI in disconnected state')
      manualLogout = true
      session = undefined
      window.walletSessionInfo.actor = null
      window.walletSessionInfo.isRestored = false
    }
    
    setupEventListeners()
    updateUI(false)
  }
})
