// functions/modules/polishing.js

const { onRequest }  = require('firebase-functions/v2/https')
const admin          = require('firebase-admin')
const { getFirestore } = require('firebase-admin/firestore')
const corsLib        = require('cors')

const db = getFirestore(undefined, 'tsdgems')

const RAW_ALLOW  = process.env.CORS_ALLOW || ''
const ALLOWLIST  = RAW_ALLOW.split(',').map(s => s.trim()).filter(Boolean)
const cors       = corsLib({ origin: ALLOWLIST.length ? ALLOWLIST : true, credentials: false })

function requireActor(req, res) {
  const actor = (req.method === 'GET' ? req.query.actor : req.body?.actor) || ''
  if (!actor || typeof actor !== 'string') {
    res.status(400).json({ error: 'actor required' }); return null
  }
  return actor
}

const POLISHING_DURATION_MS = 30 * 1000  // 30 seconds (for testing)
const MAX_SLOTS = 10
const MAX_AMOUNT_PER_SLOT = 500

// Slot unlock costs (slot 1 is free, already unlocked)
const POLISHING_SLOT_UNLOCK_COSTS = [
  0,      // Slot 1 - Free/Already unlocked
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

// Only one general rough gem type (input)
const ROUGH_GEM_KEY = 'rough_gems'

// 10 specific polished gem types (output)
const POLISHED_TYPES = [
  'polished_diamond',
  'polished_ruby',
  'polished_sapphire',
  'polished_emerald',
  'polished_jade',
  'polished_tanzanite',
  'polished_opal',
  'polished_aquamarine',
  'polished_topaz',
  'polished_amethyst'
]

// Weights for random polished gem type selection
const WEIGHTS = {
  polished_diamond: 0.03,      // 3%
  polished_ruby: 0.05,          // 5%
  polished_sapphire: 0.10,      // 10%
  polished_emerald: 0.10,       // 10%
  polished_jade: 0.1166,        // 11.66%
  polished_tanzanite: 0.1166,   // 11.66%
  polished_opal: 0.1166,        // 11.66%
  polished_aquamarine: 0.1166,  // 11.66%
  polished_topaz: 0.1166,       // 11.66%
  polished_amethyst: 0.1166     // 11.66%
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

  // Use the maximum of NFT-based slots and manually unlocked slots
  // This allows players to unlock slots either by buying NFTs OR by spending TSDM
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

// POST /startPolishing { actor, amount }
const startPolishing = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
    const actor = requireActor(req, res); if (!actor) return

    const amount = Math.max(1, Number(req.body?.amount || 0) | 0)
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'invalid amount' })
    if (amount > MAX_AMOUNT_PER_SLOT) return res.status(400).json({ error: `maximum ${MAX_AMOUNT_PER_SLOT} gems per slot` })

    try {
      const { gems, active } = refs(actor)
      
      // Get existing jobs to determine available slot
      const snap = await active.get()
      const existingJobs = snap.docs.map(d => d.data())
      
      const slots = await getEffectivePolishingSlots(actor)
      const activeCount = existingJobs.length
      
      if (activeCount >= slots) return res.status(400).json({ error: 'no available polishing slots' })

      // Find next available slot number
      const slotNum = getNextAvailableSlot(existingJobs, slots)
      if (!slotNum) return res.status(400).json({ error: 'no available slot number' })

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
    const jobId = String(req.body?.jobId || '')
    if (!jobId) return res.status(400).json({ error: 'jobId required' })

    try {
      const { active, history, gems } = refs(actor)
      const jobRef = active.doc(jobId)
      const snap = await jobRef.get()
      if (!snap.exists) return res.status(404).json({ error: 'job not found' })
      const job = snap.data()
      const now = Date.now()
      if (now < job.finishAt) return res.status(400).json({ error: 'job still in progress' })

      // Roll for each gem individually
      const amountIn = job.amountIn
      const results = {}
      
      // Roll drop chance for each individual gem
      for (let i = 0; i < amountIn; i++) {
        const polishedType = pickPolishedType()
        results[polishedType] = (results[polishedType] || 0) + 1
      }
      
      console.log(`[completePolishing] Rolled ${amountIn} gems:`, results)

      await db.runTransaction(async (tx) => {
        const gSnap = await tx.get(gems)
        const cur = gSnap.exists ? (gSnap.data() || {}) : {}
        
        // Add each polished gem type to inventory
        const updated = { ...cur }
        Object.entries(results).forEach(([gemType, count]) => {
          const have = Number(updated[gemType] || 0)
          updated[gemType] = have + count
        })
        
        tx.set(gems, updated, { merge: true })
        tx.set(history.doc(jobId), { 
          ...job, 
          status: 'done', 
          results: results,  // Store all results
          totalOut: amountIn,
          completedAt: now 
        })
        tx.delete(jobRef)
      })

      res.json({ ok: true, result: { results, totalOut: amountIn, completedAt: now } })
    } catch (e) {
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
      const { root } = refs(actor)
      const snap = await root.get()
      if (!snap.exists) return res.status(404).json({ error: 'player not found' })

      const profile = snap.data()
      const currentSlots = Number(profile.polishingSlotsUnlocked || 0)
      
      // Target slot must be the next one in sequence
      const nextSlotToUnlock = currentSlots + 1
      if (targetSlot !== nextSlotToUnlock) {
        return res.status(400).json({ 
          error: `Please unlock slots in order. Next available slot is ${nextSlotToUnlock}` 
        })
      }
      
      if (currentSlots >= MAX_SLOTS) {
        return res.status(400).json({ error: 'maximum slots already unlocked' })
      }

      // Get cost for this specific slot (0-indexed array)
      const unlockCost = POLISHING_SLOT_UNLOCK_COSTS[targetSlot - 1] || 0

      // Create payment request directly in Firestore
      const { pendingPayments } = refs(actor)
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

      res.json({ 
        ok: true, 
        paymentId,
        unlockCost,
        slotNumber: targetSlot,
        message: 'Payment request created. Please complete payment to unlock slot.'
      })
    } catch (e) {
      console.error('[unlockPolishingSlot]', e)
      res.status(500).json({ error: e.message })
    }
  })
)

module.exports = { startPolishing, getActivePolishing, completePolishing, unlockPolishingSlot }
