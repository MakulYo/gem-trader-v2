// functions/modules/mining.js

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

const MINING_DURATION_MS = 30 * 1000   // 30 seconds (for testing)
const MINING_COST_TSDM   = 50          // recorded only (no debit yet)
const MAX_SLOTS          = 10

// Slot unlock costs (slot 1 is free, already unlocked)
const SLOT_UNLOCK_COSTS = [
  0,      // Slot 1 - Free/Already unlocked
  250,    // Slot 2
  500,    // Slot 3
  1000,   // Slot 4
  2000,   // Slot 5
  4000,   // Slot 6
  8000,   // Slot 7
  16000,  // Slot 8
  20000,  // Slot 9
  25000   // Slot 10
]

// Mining now produces only one unified rough_gems type
// (Previously used different types: rough_diamond, rough_ruby, etc.)

function refs(actor) {
  const root = db.collection('players').doc(actor)
  return {
    root,
    invSummary: root.collection('meta').doc('inventory_summary'),
    gems: root.collection('inventory').doc('gems'),
    active: root.collection('mining_active'),
    history: root.collection('mining_history'),
    pendingPayments: root.collection('pending_payments'),
  }
}

async function getEffectiveMiningSlots(actor) {
  const { root, invSummary } = refs(actor)
  const [invSnap, profSnap] = await Promise.all([invSummary.get(), root.get()])

  const inv = invSnap.exists ? (invSnap.data() || {}) : {}
  const nftSlots = Math.min(Number(inv.miningSlots || 0) || 0, MAX_SLOTS)

  const prof = profSnap.exists ? (profSnap.data() || {}) : {}
  const unlockedSlots = Number(prof.miningSlotsUnlocked || 0)

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
  // Get all used slot numbers
  const usedSlots = new Set(existingJobs.map(j => j.slotNum).filter(Boolean))
  // Find first available slot
  for (let i = 1; i <= maxSlots; i++) {
    if (!usedSlots.has(i)) return i
  }
  return null
}

function computeYield(totalMiningPower = 0) {
  const base = 1 + Math.floor((Number(totalMiningPower) || 0) / 1000)
  const noise = Math.floor(Math.random() * 3) // 0..2
  return Math.max(1, Math.min(25, base + noise))
}

// POST /startMining { actor }
const startMining = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
    const actor = requireActor(req, res); if (!actor) return

    try {
      const { active } = refs(actor)
      
      // Get the requested slot number from the request body
      const requestedSlotNum = req.body?.slotNum
      
      // Get existing jobs to determine available slots
      const snap = await active.get()
      const existingJobs = snap.docs.map(d => d.data())
      
      const slots = await getEffectiveMiningSlots(actor)
      const activeCount = existingJobs.length
      
      if (activeCount >= slots) return res.status(400).json({ error: 'no available mining slots' })

      // Use requested slot number if provided, otherwise find next available
      let slotNum
      if (requestedSlotNum !== undefined && requestedSlotNum !== null) {
        slotNum = Number(requestedSlotNum)
        
        // Validate that the requested slot is not already in use
        const isSlotInUse = existingJobs.some(job => job.slotNum === slotNum)
        if (isSlotInUse) {
          return res.status(400).json({ error: `slot ${slotNum} is already in use` })
        }
        
        // Validate that the requested slot number is within range
        if (slotNum < 1 || slotNum > slots) {
          return res.status(400).json({ error: `slot ${slotNum} is out of range (1-${slots})` })
        }
      } else {
        // Find next available slot number (fallback behavior)
        slotNum = getNextAvailableSlot(existingJobs, slots)
        if (!slotNum) return res.status(400).json({ error: 'no available slot number' })
      }

      // Calculate slot-specific mining power from staked assets
      const stakingRef = db.collection('staking').doc(actor)
      const stakingSnap = await stakingRef.get()
      let slotMiningPower = 0

      if (stakingSnap.exists) {
        const stakingData = stakingSnap.data()
        const slotKey = `slot${slotNum}`
        
        if (stakingData.mining && stakingData.mining[slotKey]) {
          const slotData = stakingData.mining[slotKey]
          
          // Add mine MP
          if (slotData.mine && slotData.mine.mp) {
            slotMiningPower += Number(slotData.mine.mp) || 0
            console.log(`[startMining] Slot ${slotNum} mine MP:`, slotData.mine.mp)
          }
          
          // Add all worker MPs
          if (slotData.workers && Array.isArray(slotData.workers)) {
            slotData.workers.forEach(worker => {
              const workerMP = Number(worker.mp) || 0
              slotMiningPower += workerMP
              console.log(`[startMining] Slot ${slotNum} worker MP:`, workerMP)
            })
          }
        }
      }

      console.log(`[startMining] Slot ${slotNum} total mining power:`, slotMiningPower)

      const now = Date.now()
      const jobId = `job_${now}_${Math.floor(Math.random()*1e6)}`
      const slotId = `slot_${slotNum}`
      const finishAt = now + MINING_DURATION_MS

      await active.doc(jobId).set({
        jobId, slotId, slotNum, actor, startedAt: now, finishAt, status: 'active',
        costTsdm: MINING_COST_TSDM,
        slotMiningPower  // NEW: Store slot-specific mining power
      })
      res.json({ ok: true, jobId, slotId, slotNum, finishAt, slotMiningPower })
    } catch (e) {
      console.error('[startMining]', e)
      res.status(500).json({ error: e.message })
    }
  })
)

// GET /getActiveMining?actor=...
const getActiveMining = onRequest((req, res) =>
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

// POST /completeMining { actor, jobId }
const completeMining = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
    const actor = requireActor(req, res); if (!actor) return
    const jobId = String(req.body?.jobId || '')
    if (!jobId) return res.status(400).json({ error: 'jobId required' })

    try {
      const { active, history, invSummary, gems } = refs(actor)
      const jobRef = active.doc(jobId)
      const snap = await jobRef.get()
      if (!snap.exists) return res.status(404).json({ error: 'job not found' })
      const job = snap.data()
      const now = Date.now()
      if (now < job.finishAt) return res.status(400).json({ error: 'job still in progress' })

      // Use slot-specific mining power for rewards calculation
      // Formula: Mining Power / 20 = Rough Gems (minimum 1)
      const slotMP = Number(job.slotMiningPower) || 0
      const amt = Math.max(1, Math.floor(slotMP / 20))
      
      console.log(`[completeMining] Slot ${job.slotNum}: ${slotMP} MP ÷ 20 = ${amt} rough gems`)

      // Mining now produces only one type: rough_gems
      const key = 'rough_gems'

      await db.runTransaction(async (tx) => {
        const gSnap = await tx.get(gems)
        const cur = gSnap.exists ? (gSnap.data() || {}) : {}
        const have = Number(cur[key] || 0)
        tx.set(gems, { ...cur, [key]: have + amt }, { merge: true })
        tx.set(history.doc(jobId), { 
          ...job, 
          status: 'done', 
          completedAt: now, 
          roughKey: key, 
          yieldAmt: amt,
          slotMiningPower: slotMP  // Store MP for history tracking
        })
        tx.delete(jobRef)
      })

      res.json({ ok: true, result: { roughKey: key, yieldAmt: amt, completedAt: now, slotMiningPower: slotMP } })
    } catch (e) {
      console.error('[completeMining]', e)
      res.status(500).json({ error: e.message })
    }
  })
)

// POST /unlockMiningSlot { actor, targetSlot }
const unlockMiningSlot = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
    const actor = requireActor(req, res); if (!actor) return
    const targetSlot = Number(req.body?.targetSlot || 0)

    try {
      const { root } = refs(actor)
      const snap = await root.get()
      if (!snap.exists) return res.status(404).json({ error: 'player not found' })

      const profile = snap.data()
      const currentSlots = Number(profile.miningSlotsUnlocked || 0)
      
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
      const unlockCost = SLOT_UNLOCK_COSTS[targetSlot - 1] || 0

      // Create payment request directly in Firestore
      const { pendingPayments } = refs(actor)
      const now = Date.now()
      const paymentId = `payment_${now}_${Math.floor(Math.random()*1e6)}`
      
      const paymentData = {
        paymentId,
        actor,
        type: 'mining_slot_unlock',
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
      console.error('[unlockMiningSlot]', e)
      res.status(500).json({ error: e.message })
    }
  })
)

module.exports = { startMining, getActiveMining, completeMining, unlockMiningSlot }
