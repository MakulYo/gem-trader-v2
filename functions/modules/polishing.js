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

const POLISHING_DURATION_MS = 1 * 60 * 60 * 1000
const MAX_SLOTS = 10

const GEM_MAP = {
  diamond:     { rough:'rough_diamond',    polished:'polished_diamond' },
  ruby:        { rough:'rough_ruby',       polished:'polished_ruby' },
  sapphire:    { rough:'rough_sapphire',   polished:'polished_sapphire' },
  emerald:     { rough:'rough_emerald',    polished:'polished_emerald' },
  jade:        { rough:'rough_jade',       polished:'polished_jade' },
  tanzanite:   { rough:'rough_tanzanite',  polished:'polished_tanzanite' },
  opal:        { rough:'rough_opal',       polished:'polished_opal' },
  aquamarine:  { rough:'rough_aquamarine', polished:'polished_aquamarine' },
  topaz:       { rough:'rough_topaz',      polished:'polished_topaz' },
  amethyst:    { rough:'rough_amethyst',   polished:'polished_amethyst' },
}

function refs(actor) {
  const root = db.collection('players').doc(actor)
  return {
    root,
    invSummary: root.collection('meta').doc('inventory_summary'),
    gems: root.collection('inventory').doc('gems'),
    active: root.collection('polishing_active'),
    history: root.collection('polishing_history'),
  }
}

async function getEffectivePolishingSlots(actor) {
  const { root, invSummary } = refs(actor)
  const [invSnap, profSnap] = await Promise.all([invSummary.get(), root.get()])

  const inv = invSnap.exists ? (invSnap.data() || {}) : {}
  const capacity = Math.min(Number(inv.polishingSlots || 0) || 0, MAX_SLOTS)

  const prof = profSnap.exists ? (profSnap.data() || {}) : {}
  const unlocked = Number(prof.polishingSlotsUnlocked || 0)

  const gate = unlocked > 0 ? unlocked : capacity
  return Math.min(capacity, gate, MAX_SLOTS)
}

async function getActiveCount(actor) {
  const { active } = refs(actor)
  const snap = await active.get()
  return snap.size || 0
}

function polishingYield(n) {
  const noise = Math.round(n * ((Math.random()*0.2) - 0.1)) // ±10%
  return Math.max(0, n + noise)
}

// POST /startPolishing { actor, gem, amount }
const startPolishing = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
    const actor = requireActor(req, res); if (!actor) return

    const gem = String(req.body?.gem || '').toLowerCase()
    const amount = Math.max(1, Number(req.body?.amount || 0) | 0)
    if (!GEM_MAP[gem]) return res.status(400).json({ error: 'invalid gem' })
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'invalid amount' })

    try {
      const [slots, activeCount] = await Promise.all([ getEffectivePolishingSlots(actor), getActiveCount(actor) ])
      if (activeCount >= slots) return res.status(400).json({ error: 'no available polishing slots' })

      const { gems, active } = refs(actor)
      const now = Date.now()
      const jobId = `job_${now}_${Math.floor(Math.random()*1e6)}`
      const finishAt = now + POLISHING_DURATION_MS
      const roughKey = GEM_MAP[gem].rough

      await db.runTransaction(async (tx) => {
        const gSnap = await tx.get(gems)
        const cur = gSnap.exists ? (gSnap.data() || {}) : {}
        const have = Number(cur[roughKey] || 0)
        if (have < amount) throw new Error(`insufficient ${roughKey}: have ${have}, need ${amount}`)
        tx.set(gems, { ...cur, [roughKey]: have - amount }, { merge: true })

        tx.set(active.doc(jobId), {
          jobId, actor, gem, roughKey, amountIn: amount,
          startedAt: now, finishAt, status: 'active'
        })
      })

      res.json({ ok: true, jobId, finishAt })
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

      const polishedKey = GEM_MAP[job.gem]?.polished
      if (!polishedKey) return res.status(400).json({ error: 'invalid job gem' })

      const out = polishingYield(job.amountIn)

      await db.runTransaction(async (tx) => {
        const gSnap = await tx.get(gems)
        const cur = gSnap.exists ? (gSnap.data() || {}) : {}
        const have = Number(cur[polishedKey] || 0)
        tx.set(gems, { ...cur, [polishedKey]: have + out }, { merge: true })
        tx.set(history.doc(jobId), { ...job, status:'done', polishedKey, outAmount: out, completedAt: now })
        tx.delete(jobRef)
      })

      res.json({ ok: true, result: { gem: job.gem, polishedKey, outAmount: out, completedAt: now } })
    } catch (e) {
      console.error('[completePolishing]', e)
      res.status(500).json({ error: e.message })
    }
  })
)

module.exports = { startPolishing, getActivePolishing, completePolishing }
