// functions/modules/payments.js

const { onRequest }  = require('firebase-functions/v2/https')
const admin          = require('firebase-admin')
const { getFirestore } = require('firebase-admin/firestore')
const corsLib        = require('cors')

// Ensure app is initialized safely (in case index.js didn't do it yet)
try { admin.app() } catch { admin.initializeApp() }

const db = getFirestore();

const RAW_ALLOW  = process.env.CORS_ALLOW || ''
const ALLOWLIST  = RAW_ALLOW.split(',').map(s => s.trim()).filter(Boolean)
const cors       = corsLib({ origin: ALLOWLIST.length ? ALLOWLIST : true, credentials: false })

const PAYMENT_DESTINATION = process.env.PAYMENT_DESTINATION_ADDRESS || 'tillo1212121'
const TSDM_CONTRACT = process.env.TSDM_CONTRACT || 'lucas3333555'

const { verifyTsdmTransfer } = require('./chain')

function requireActor(req, res) {
  const actor = (req.method === 'GET' ? req.query.actor : req.body?.actor) || ''
  if (!actor || typeof actor !== 'string') {
    res.status(400).json({ error: 'actor required' }); return null
  }
  return actor
}

function refs(actor) {
  const root = db.collection('players').doc(actor)
  return {
    root,
    pendingPayments: root.collection('pending_payments'),
  }
}

// Payment types and their meanings
const PAYMENT_TYPES = {
  mining_slot_unlock: {
    name: 'Mining Slot Unlock',
    description: 'Unlock additional mining slot'
  },
  polishing_slot_unlock: {
    name: 'Polishing Slot Unlock',
    description: 'Unlock additional polishing slot'
  },
  mining_start: {
    name: 'Mining Start',
    description: 'Start mining operation'
  }
}

// POST /createPaymentRequest { actor, type, amount, metadata }
const createPaymentRequest = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
    const actor = requireActor(req, res); if (!actor) return

    const { type, amount, metadata = {} } = req.body || {}
    
    if (!type || !PAYMENT_TYPES[type]) {
      return res.status(400).json({ error: 'invalid payment type' })
    }
    
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'invalid amount' })
    }

    try {
      const { pendingPayments } = refs(actor)
      const now = Date.now()
      const paymentId = `payment_${now}_${Math.floor(Math.random()*1e6)}`
      
      const paymentData = {
        paymentId,
        actor,
        type,
        amount,                           // numeric amount (e.g. 50.0000)
        destination: PAYMENT_DESTINATION,
        status: 'pending',
        metadata,
        createdAt: now,
        memo: `payment:${paymentId}`      // this is what must go into the TSDM transfer memo
      }

      await pendingPayments.doc(paymentId).set(paymentData)
      
      res.json({ 
        ok: true, 
        paymentId,
        payment: paymentData
      })
    } catch (e) {
      console.error('[createPaymentRequest]', e)
      res.status(500).json({ error: e.message })
    }
  })
)

// GET /getPendingPayments?actor=...
const getPendingPayments = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
    const actor = requireActor(req, res); if (!actor) return

    try {
      const { pendingPayments } = refs(actor)
      const snap = await pendingPayments
        .where('status', 'in', ['pending', 'verifying'])
        .get()
      
      const payments = snap.docs.map(d => d.data())
      res.json({ ok: true, payments })
    } catch (e) {
      console.error('[getPendingPayments]', e)
      res.status(500).json({ error: e.message })
    }
  })
)

// POST /verifyPayment { actor, paymentId }
const verifyPayment = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
    const actor = requireActor(req, res); if (!actor) return

    const { paymentId } = req.body || {}
    if (!paymentId) return res.status(400).json({ error: 'paymentId required' })

    try {
      const { pendingPayments } = refs(actor)
      const paymentRef = pendingPayments.doc(paymentId)
      const paymentSnap = await paymentRef.get()
      
      if (!paymentSnap.exists) {
        return res.status(404).json({ error: 'payment not found' })
      }
      
      const payment = paymentSnap.data()
      if (payment.status !== 'pending') {
        return res.status(400).json({ error: 'payment already processed' })
      }

      // Update status to verifying
      await paymentRef.update({ status: 'verifying' })

      // Verify payment on blockchain
      const verification = await verifyTsdmTransfer(
        actor,
        PAYMENT_DESTINATION,
        Number(payment.amount),
        payment.memo,
        10 * 60 * 1000 // 10 minutes window
      )

      // Emulator / dev shortcut
      const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development'
      
      if (isEmulator) {
        console.log('[verifyPayment] Emulator detected - using mock verification')

        const mockTxId = 'mock-tx-' + Date.now()
        const mockTime = new Date().toISOString()

        await paymentRef.update({
          status: 'completed',
          completedAt: Date.now(),
          txId: mockTxId,
          blockTime: mockTime,
          mock: true
        })

        await unlockFeature(actor, payment.type, payment.metadata)

        return res.json({ 
          ok: true, 
          verified: true,
          txId: mockTxId,
          blockTime: mockTime,
          mock: true
        })
      }

      if (verification.verified) {
        // Payment verified - unlock feature
        await paymentRef.update({
          status: 'completed',
          completedAt: Date.now(),
          txId: verification.txId,
          blockTime: verification.blockTime
        })

        await unlockFeature(actor, payment.type, payment.metadata)

        return res.json({ 
          ok: true, 
          verified: true,
          txId: verification.txId,
          blockTime: verification.blockTime
        })
      } else {
        // Payment not found - check if timeout
        const now = Date.now()
        const timeoutMs = 10 * 60 * 1000 // 10 minutes
        if (now - payment.createdAt > timeoutMs) {
          await paymentRef.update({ status: 'failed' })
          return res.json({ ok: true, verified: false, status: 'timeout' })
        } else {
          // Still within timeout window
          await paymentRef.update({ status: 'pending' })
          return res.json({ ok: true, verified: false, status: 'pending' })
        }
      }
    } catch (e) {
      console.error('[verifyPayment]', e)
      res.status(500).json({ error: e.message })
    }
  })
)

// POST /cancelPayment { actor, paymentId }
const cancelPayment = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
    const actor = requireActor(req, res); if (!actor) return

    const { paymentId } = req.body || {}
    if (!paymentId) return res.status(400).json({ error: 'paymentId required' })

    try {
      const { pendingPayments } = refs(actor)
      const paymentRef = pendingPayments.doc(paymentId)
      const paymentSnap = await paymentRef.get()
      
      if (!paymentSnap.exists) {
        return res.status(404).json({ error: 'payment not found' })
      }
      
      const payment = paymentSnap.data()
      if (payment.status !== 'pending') {
        return res.status(400).json({ error: 'payment already processed' })
      }

      await paymentRef.update({ status: 'cancelled' })
      res.json({ ok: true, cancelled: true })
    } catch (e) {
      console.error('[cancelPayment]', e)
      res.status(500).json({ error: e.message })
    }
  })
)

// Helper: unlock features after successful payment
async function unlockFeature(actor, type, metadata) {
  const { root } = refs(actor)
  
  switch (type) {
    case 'mining_slot_unlock': {
      const currentSlots = await getCurrentMiningSlots(actor)
      const newSlots = Math.min(currentSlots + 1, 10)
      await root.update({ miningSlotsUnlocked: newSlots })
      console.log(`[unlockFeature] Unlocked mining slot ${newSlots} for ${actor}`)
      break
    }
      
    case 'polishing_slot_unlock': {
      const currentPolishingSlots = await getCurrentPolishingSlots(actor)
      const newPolishingSlots = Math.min(currentPolishingSlots + 1, 10)
      await root.update({ polishingSlotsUnlocked: newPolishingSlots })
      console.log(`[unlockFeature] Unlocked polishing slot ${newPolishingSlots} for ${actor}`)
      break
    }
      
    case 'mining_start':
      // Mining start payment - no unlock needed, just record
      console.log(`[unlockFeature] Mining start payment completed for ${actor}`)
      break
      
    default:
      console.warn(`[unlockFeature] Unknown payment type: ${type}`)
  }
}

// Helper: current mining slots (mirror live-aggregator + mining.js semantics)
// - if field is missing/0, treat as 1 (slot 1 is free baseline)
async function getCurrentMiningSlots(actor) {
  const { root } = refs(actor)
  const snap = await root.get()
  const profile = snap.exists ? (snap.data() || {}) : {}

  const raw =
    Number(profile.miningSlotsUnlocked ??
           profile.mining_slots_unlocked ??
           0) || 0

  const effective = raw > 0 ? raw : 1
  console.log(`[payments/getCurrentMiningSlots] actor=${actor} raw=${raw} effective=${effective}`)
  return effective
}

// Helper: current polishing slots (same semantics: default 1)
async function getCurrentPolishingSlots(actor) {
  const { root } = refs(actor)
  const snap = await root.get()
  const profile = snap.exists ? (snap.data() || {}) : {}

  const raw =
    Number(profile.polishingSlotsUnlocked ??
           profile.polishing_slots_unlocked ??
           0) || 0

  const effective = raw > 0 ? raw : 1
  console.log(`[payments/getCurrentPolishingSlots] actor=${actor} raw=${raw} effective=${effective}`)
  return effective
}

module.exports = { 
  createPaymentRequest, 
  getPendingPayments, 
  verifyPayment, 
  cancelPayment,
  PAYMENT_TYPES 
}