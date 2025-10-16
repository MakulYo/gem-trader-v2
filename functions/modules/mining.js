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

const MINING_DURATION_MS = 3 * 60 * 60 * 1000   // 3 hours
const MINING_COST_TSDM   = 50                   // recorded only (no debit yet)
const MAX_SLOTS          = 10

const WEIGHTS = {
  diamond: 0.03,
  ruby: 0.05,
  sapphire: 0.10,
  emerald: 0.10,
  jade: 0.1166,
  tanzanite: 0.1166,
  opal: 0.1166,
  aquamarine: 0.1166,
  topaz: 0.1166,
  amethyst: 0.1166,
}
const ROUGH_KEY = {
  diamond:'rough_diamond', ruby:'rough_ruby', sapphire:'rough_sapphire', emerald:'rough_emerald',
  jade:'rough_jade', tanzanite:'rough_tanzanite', opal:'rough_opal', aquamarine:'rough_aquamarine',
  topaz:'rough_topaz', amethyst:'rough_amethyst'
}

function refs(actor) {
  const root = db.collection('players').doc(actor)
  return {
    root,
    invSummary: root.collection('meta').doc('inventory_summary'),
    gems: root.collection('inventory').doc('gems'),
    active: root.collection('mining_active'),
    history: root.collection('mining_history'),
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

function pickType() {
  const r = Math.random()
  let a = 0
  for (const [k, w] of Object.entries(WEIGHTS)) { a += w; if (r <= a) return k }
  return 'amethyst'
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
      const [slots, activeCount] = await Promise.all([
        getEffectiveMiningSlots(actor),
        getActiveCount(actor)
      ])
      if (activeCount >= slots) return res.status(400).json({ error: 'no available mining slots' })

      const now = Date.now()
      const jobId = `job_${now}_${Math.floor(Math.random()*1e6)}`
      const finishAt = now + MINING_DURATION_MS
      const { active } = refs(actor)

      await active.doc(jobId).set({
        jobId, actor, startedAt: now, finishAt, status: 'active',
        costTsdm: MINING_COST_TSDM
      })
      res.json({ ok: true, jobId, finishAt })
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

      const invSnap = await invSummary.get()
      const totalMP = Number(invSnap.exists ? (invSnap.data()?.totalMiningPower || 0) : 0)

      const type  = pickType()
      const key   = ROUGH_KEY[type]
      const amt   = computeYield(totalMP)

      await db.runTransaction(async (tx) => {
        const gSnap = await tx.get(gems)
        const cur = gSnap.exists ? (gSnap.data() || {}) : {}
        const have = Number(cur[key] || 0)
        tx.set(gems, { ...cur, [key]: have + amt }, { merge: true })
        tx.set(history.doc(jobId), { ...job, status: 'done', completedAt: now, roughType: type, roughKey: key, yieldAmt: amt })
        tx.delete(jobRef)
      })

      res.json({ ok: true, result: { roughType: type, roughKey: key, yieldAmt: amt, completedAt: now } })
    } catch (e) {
      console.error('[completeMining]', e)
      res.status(500).json({ error: e.message })
    }
  })
)

// POST /unlockMiningSlot { actor }
const unlockMiningSlot = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
    const actor = requireActor(req, res); if (!actor) return

    try {
      const { root } = refs(actor)
      const snap = await root.get()
      if (!snap.exists) return res.status(404).json({ error: 'player not found' })

      const profile = snap.data()
      const currentSlots = Number(profile.miningSlotsUnlocked || 0)
      
      if (currentSlots >= MAX_SLOTS) {
        return res.status(400).json({ error: 'maximum slots already unlocked' })
      }

      // Cost: 100 TSDM per slot (adjust as needed)
      const UNLOCK_COST_TSDM = 100
      const currentTSDM = Number(profile.balances?.TSDM || 0)

      if (currentTSDM < UNLOCK_COST_TSDM) {
        return res.status(400).json({ error: 'insufficient TSDM balance' })
      }

      // Deduct TSDM and unlock slot
      const newTSDM = currentTSDM - UNLOCK_COST_TSDM
      const newSlots = currentSlots + 1

      await root.update({
        'balances.TSDM': newTSDM,
        miningSlotsUnlocked: newSlots
      })

      res.json({ 
        ok: true, 
        slotsUnlocked: newSlots,
        tsdmRemaining: newTSDM,
        costPaid: UNLOCK_COST_TSDM
      })
    } catch (e) {
      console.error('[unlockMiningSlot]', e)
      res.status(500).json({ error: e.message })
    }
  })
)

module.exports = { startMining, getActiveMining, completeMining, unlockMiningSlot }
