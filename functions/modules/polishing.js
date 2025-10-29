// functions/modules/polishing.js

const { onRequest }  = require('firebase-functions/v2/https')
const admin          = require('firebase-admin')
const { getFirestore } = require('firebase-admin/firestore')
const corsLib        = require('cors')

const db = getFirestore(undefined, 'tsdgems')

const RAW_ALLOW  = process.env.CORS_ALLOW || ''
const ALLOWLIST  = RAW_ALLOW.split(',').map(s => s.trim()).filter(Boolean)
const cors       = corsLib({ origin: ALLOWLIST.length ? ALLOWLIST : true, credentials: false })

// Rate limiting configuration
const RATE_LIMITS = {
  completeMining: { requests: 10, windowMs: 10000 }, // 10 requests per 10 seconds (one per slot)
  completePolishing: { requests: 10, windowMs: 10000 }, // 10 requests per 10 seconds (one per slot)
  // Add other rate limits as needed
}

// Rate limiting function
async function checkRateLimit(actor, action, req) {
  const now = Date.now()
  const windowStart = now - RATE_LIMITS[action].windowMs

  // Use actor + IP for rate limiting key
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown'
  const rateKey = `${actor}_${clientIP}_${action}`

  const rateDocRef = db.doc(`rate_limits/${rateKey}`)

  try {
    const rateDoc = await rateDocRef.get()
    let requests = []

    if (rateDoc.exists) {
      requests = rateDoc.data().requests || []
      // Filter out old requests outside the window
      requests = requests.filter(timestamp => timestamp > windowStart)
    }

    // Check if under limit
    if (requests.length >= RATE_LIMITS[action].requests) {
      console.log(`[RateLimit] BLOCKED: ${rateKey} exceeded ${RATE_LIMITS[action].requests} requests in ${RATE_LIMITS[action].windowMs}ms`)
      return false
    }

    // Add current request timestamp
    requests.push(now)

    // Save updated rate limit data
    await rateDocRef.set({
      requests: requests,
      lastRequest: now,
      action: action,
      actor: actor,
      ip: clientIP
    })

    console.log(`[RateLimit] ALLOWED: ${rateKey} (${requests.length}/${RATE_LIMITS[action].requests})`)
    return true

  } catch (error) {
    console.error('[RateLimit] Error checking rate limit:', error)
    // Allow request on error to avoid blocking legitimate users
    return true
  }
}

function requireActor(req, res) {
  const actor = (req.method === 'GET' ? req.query.actor : req.body?.actor) || ''
  if (!actor || typeof actor !== 'string') {
    res.status(400).json({ error: 'actor required' }); return null
  }
  return actor
}

// --- season lock guard (central switch) ---
async function ensureSeasonActiveOrThrow() {
  const s = await db.doc('runtime/season_state').get()
  const phase = s.exists ? (s.data()?.phase || 'active') : 'active'
  if (phase !== 'active') {
    const err = new Error('season-locked')
    err.status = 403
    throw err
  }
}

const POLISHING_DURATION_MS = 30 * 1000  // 30 seconds (for testing)
const MAX_SLOTS = 10
const MAX_AMOUNT_PER_SLOT = 500

// Slot unlock costs (slot 1 is free, already unlocked)
const POLISHING_SLOT_UNLOCK_COSTS = [
  0,      // Slot 1
  100,    // Slot 2
  250,    // Slot 3
  500,    // Slot 4
  1000,   // Slot 5
  2000,   // Slot 6
  4000,   // Slot 7
  8000,   // Slot 8
  12000,  // Slot 9
  15000   // Slot 10
]

// single rough type (input)
const ROUGH_GEM_KEY = 'rough_gems'

// 10 polished types (output) + weights
const POLISHED_TYPES = [
  'polished_diamond','polished_ruby','polished_sapphire','polished_emerald',
  'polished_jade','polished_tanzanite','polished_opal','polished_aquamarine',
  'polished_topaz','polished_amethyst'
]
const WEIGHTS = {
  polished_diamond: 0.03,
  polished_ruby: 0.05,
  polished_sapphire: 0.10,
  polished_emerald: 0.10,
  polished_jade: 0.1166,
  polished_tanzanite: 0.1166,
  polished_opal: 0.1166,
  polished_aquamarine: 0.1166,
  polished_topaz: 0.1166,
  polished_amethyst: 0.1166
}

function pickPolishedType() {
  const r = Math.random()
  let a = 0
  for (const [k, w] of Object.entries(WEIGHTS)) { 
    a += w
    if (r <= a) return k
  }
  return 'polished_amethyst'
}

function refs(actor) {
  const root = db.collection('players').doc(actor)
  return {
    root,
    invSummary: root.collection('meta').doc('inventory_summary'),
    gems: root.collection('inventory').doc('gems'),
    active: root.collection('polishing_active'),
    history: root.collection('polishing_history'),
    pendingPayments: root.collection('pending_payments'),
  }
}

async function getEffectivePolishingSlots(actor) {
  const { root, invSummary } = refs(actor)
  const [invSnap, profSnap] = await Promise.all([invSummary.get(), root.get()])

  const inv = invSnap.exists ? (invSnap.data() || {}) : {}
  const nftSlots = Math.min(Number(inv.polishingSlots || 0) || 0, MAX_SLOTS)

  const prof = profSnap.exists ? (profSnap.data() || {}) : {}
  const unlockedSlots = Number(prof.polishingSlotsUnlocked || 0)

  return Math.min(Math.max(nftSlots, unlockedSlots), MAX_SLOTS)
}

async function getActiveCount(actor) {
  const { active } = refs(actor)
  const snap = await active.get()
  return snap.size || 0
}

function getNextAvailableSlot(existingJobs, maxSlots) {
  const usedSlots = new Set(existingJobs.map(j => j.slotNum).filter(Boolean))
  for (let i = 1; i <= maxSlots; i++) {
    if (!usedSlots.has(i)) return i
  }
  return null
}

// POST /startPolishing { actor, amount, slotNum? }
const startPolishing = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
    const actor = requireActor(req, res); if (!actor) return

    const amount = Math.max(1, Number(req.body?.amount || 0) | 0)
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'invalid amount' })
    if (amount > MAX_AMOUNT_PER_SLOT) return res.status(400).json({ error: `maximum ${MAX_AMOUNT_PER_SLOT} gems per slot` })

    try {
      await ensureSeasonActiveOrThrow()

      const { gems, active } = refs(actor)
      const requestedSlotNum = req.body?.slotNum

      const snap = await active.get()
      const existingJobs = snap.docs.map(d => d.data())

      const slots = await getEffectivePolishingSlots(actor)
      const activeCount = existingJobs.length
      if (activeCount >= slots) return res.status(400).json({ error: 'no available polishing slots' })

      let slotNum
      if (requestedSlotNum !== undefined && requestedSlotNum !== null) {
        slotNum = Number(requestedSlotNum)
        const isSlotInUse = existingJobs.some(job => job.slotNum === slotNum)
        if (isSlotInUse) return res.status(400).json({ error: `slot ${slotNum} is already in use` })
        if (slotNum < 1 || slotNum > slots) return res.status(400).json({ error: `slot ${slotNum} is out of range (1-${slots})` })
      } else {
        slotNum = getNextAvailableSlot(existingJobs, slots)
        if (!slotNum) return res.status(400).json({ error: 'no available slot number' })
      }

      const now = Date.now()
      const jobId = `job_${now}_${Math.floor(Math.random()*1e6)}`
      const slotId = `slot_${slotNum}`
      const finishAt = now + POLISHING_DURATION_MS

      await db.runTransaction(async (tx) => {
        const gSnap = await tx.get(gems)
        const cur = gSnap.exists ? (gSnap.data() || {}) : {}
        const have = Number(cur[ROUGH_GEM_KEY] || 0)
        if (have < amount) throw new Error(`insufficient rough gems: have ${have}, need ${amount}`)
        tx.set(gems, { ...cur, [ROUGH_GEM_KEY]: have - amount }, { merge: true })

        tx.set(active.doc(jobId), {
          jobId, slotId, slotNum, actor, amountIn: amount,
          startedAt: now, finishAt, status: 'active'
        })
      })

      res.json({ ok: true, jobId, slotId, slotNum, finishAt })
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: 'season-locked' })
      console.error('[startPolishing]', e)
      res.status(400).json({ error: e.message })
    }
  })
)

// GET /getActivePolishing?actor=...
const getActivePolishing = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
    const actor = requireActor(req, res); if (!actor) return
    try {
      const { active } = refs(actor)
      const snap = await active.get()
      res.json({ ok: true, jobs: snap.docs.map(d => d.data()) })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })
)

// POST /completePolishing { actor, jobId }
const completePolishing = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
    const actor = requireActor(req, res); if (!actor) return

    // Rate limiting check
    const rateLimitAllowed = await checkRateLimit(actor, 'completePolishing', req)
    if (!rateLimitAllowed) {
      return res.status(429).json({
        error: 'Too many requests. Please wait a moment before claiming rewards again.',
        retryAfter: Math.ceil(RATE_LIMITS.completePolishing.windowMs / 1000)
      })
    }

    const jobId = String(req.body?.jobId || '')
    if (!jobId) return res.status(400).json({ error: 'jobId required' })

    try {
      await ensureSeasonActiveOrThrow()

      const { active, history, gems } = refs(actor)
      const jobRef = active.doc(jobId)
      const now = Date.now()

      // variables to be set in transaction
      let jobData, results, amountIn

      await db.runTransaction(async (tx) => {
        // Check job existence and status within transaction to prevent race conditions
        const jobSnap = await tx.get(jobRef)
        if (!jobSnap.exists) {
          throw new Error('job not found or already completed')
        }

        jobData = jobSnap.data()
        if (now < jobData.finishAt) {
          throw new Error('job still in progress')
        }

        if (jobData.status !== 'active') {
          throw new Error('job already completed')
        }

        amountIn = jobData.amountIn
        results = {}

        // Generate polishing results
        for (let i = 0; i < amountIn; i++) {
          const t = pickPolishedType()
          results[t] = (results[t] || 0) + 1
        }

        // Update inventory
        const gSnap = await tx.get(gems)
        const cur = gSnap.exists ? (gSnap.data() || {}) : {}
        const updated = { ...cur }
        Object.entries(results).forEach(([gemType, count]) => {
          const have = Number(updated[gemType] || 0)
          updated[gemType] = have + count
        })

        tx.set(gems, updated, { merge: true })
        tx.set(history.doc(jobId), {
          ...jobData,
          status: 'done',
          results,            // per-type counts
          totalOut: amountIn, // sum of polished
          completedAt: now
        })
        tx.delete(jobRef)
      })

      res.json({ ok: true, result: { results, totalOut: amountIn, completedAt: now } })
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: 'season-locked' })
      console.error('[completePolishing]', e)
      res.status(500).json({ error: e.message })
    }
  })
)

// POST /unlockPolishingSlot { actor, targetSlot }
const unlockPolishingSlot = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
    const actor = requireActor(req, res); if (!actor) return
    const targetSlot = Number(req.body?.targetSlot || 0)

    try {
      const { root, pendingPayments } = refs(actor)
      const snap = await root.get()
      if (!snap.exists) return res.status(404).json({ error: 'player not found' })

      const profile = snap.data() || {}
      const currentSlots = Number(profile.polishingSlotsUnlocked || 0)
      if (currentSlots >= MAX_SLOTS) return res.status(400).json({ error: 'maximum slots already unlocked' })

      const nextSlotToUnlock = currentSlots + 1
      if (targetSlot !== nextSlotToUnlock) {
        return res.status(400).json({ error: `Please unlock slots in order. Next available slot is ${nextSlotToUnlock}` })
      }

      const unlockCost = POLISHING_SLOT_UNLOCK_COSTS[targetSlot - 1] || 0
      const now = Date.now()
      const paymentId = `payment_${now}_${Math.floor(Math.random()*1e6)}`
      const paymentData = {
        paymentId,
        actor,
        type: 'polishing_slot_unlock',
        amount: unlockCost,
        destination: process.env.PAYMENT_DESTINATION_ADDRESS || 'tillo1212121',
        status: 'pending',
        metadata: { slotNum: targetSlot },
        createdAt: now,
        memo: `payment:${paymentId}`
      }

      await pendingPayments.doc(paymentId).set(paymentData)

      res.json({ ok: true, paymentId, unlockCost, slotNumber: targetSlot, message: 'Payment request created. Please complete payment to unlock slot.' })
    } catch (e) {
      console.error('[unlockPolishingSlot]', e)
      res.status(500).json({ error: e.message })
    }
  })
)

module.exports = { startPolishing, getActivePolishing, completePolishing, unlockPolishingSlot }
