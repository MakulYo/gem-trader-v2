// functions/modules/trading.js
// Gem selling and trading module

const { onRequest } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const corsLib = require('cors')

try { admin.app() } catch { admin.initializeApp() }
const db = getFirestore()

const RAW_ALLOW = process.env.CORS_ALLOW || ''
const ALLOWLIST = RAW_ALLOW.split(',').map(s => s.trim()).filter(Boolean)
const cors = corsLib({ origin: ALLOWLIST.length ? ALLOWLIST : true, credentials: false })

// Import staking module for gem boost calculations
const { getGemsBoostForType } = require('./staking')
// Import live aggregator to keep runtime/live in sync after trades
const { buildPlayerLiveData } = require('./live-aggregator')

// Rate limiting configuration
const RATE_LIMITS = {
  sellGems: { requests: 5, windowMs: 30000 }, // 5 requests per 30 seconds (trading is less critical than claiming)
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
      console.log(
        `[RateLimit] BLOCKED: ${rateKey} exceeded ${RATE_LIMITS[action].requests} requests in ${RATE_LIMITS[action].windowMs}ms`
      )
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

// --- season lock guard (same as mining/polishing) ---
async function ensureSeasonActiveOrThrow() {
  const s = await db.doc('runtime/season_state').get()
  const phase = s.exists ? (s.data()?.phase || 'active') : 'active'
  if (phase !== 'active') {
    const err = new Error('season-locked')
    err.status = 403
    throw err
  }
}

// Gem type mapping for inventory keys (lowercase)
const GEM_TYPE_INVENTORY_MAP = {
  Diamond: 'diamond',
  Ruby: 'ruby',
  Sapphire: 'sapphire',
  Emerald: 'emerald',
  Jade: 'jade',
  Tanzanite: 'tanzanite',
  Opal: 'opal',
  Aquamarine: 'aquamarine',
  Topaz: 'topaz',
  Amethyst: 'amethyst'
}

function requireActor(req, res) {
  const actor = (req.method === 'GET' ? req.query.actor : req.body?.actor) || ''
  if (!actor || typeof actor !== 'string') {
    res.status(400).json({ error: 'actor required' })
    return null
  }
  return actor
}

function refs(actor) {
  const root = db.collection('players').doc(actor)
  return {
    root,
    gems: root.collection('inventory').doc('gems'),
    salesHistory: root.collection('sales_history')
  }
}

/**
 * Sell gems with city boost and gem staking boost
 * POST /sellGems { actor, gemType, amount, cityId, expected? }
 */
const sellGems = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
    const actor = requireActor(req, res)
    if (!actor) return

    // Rate limiting check
    const rateLimitAllowed = await checkRateLimit(actor, 'sellGems', req)
    if (!rateLimitAllowed) {
      return res.status(429).json({
        error: 'Too many trading requests. Please wait a moment before selling gems again.',
        retryAfter: Math.ceil(RATE_LIMITS.sellGems.windowMs / 1000)
      })
    }

    let { gemType, amount, cityId } = req.body || {}

    // Validate input presence
    if (!gemType || amount == null || !cityId) {
      return res.status(400).json({ error: 'gemType, amount, and cityId required' })
    }

    // Coerce amount to number before integer check
    amount = Number(amount)
    if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive integer' })
    }

    let cleanGemType = String(gemType)
      .replace('polished_', '')
      .replace('rough_', '')
    cleanGemType = cleanGemType.charAt(0).toUpperCase() + cleanGemType.slice(1).toLowerCase()

    if (!GEM_TYPE_INVENTORY_MAP[cleanGemType]) {
      return res.status(400).json({ error: `Invalid gem type: ${gemType}` })
    }

    try {
      await ensureSeasonActiveOrThrow()

      console.log(
        `[Trading] Selling ${amount}x ${gemType} (${cleanGemType}) in ${cityId} for ${actor}`
      )

      const { gems, salesHistory, root } = refs(actor)
      const inventoryKey = 'polished_' + GEM_TYPE_INVENTORY_MAP[cleanGemType]

      // Get player's gem inventory
      const gemsSnap = await gems.get()
      if (!gemsSnap.exists) {
        return res.status(400).json({ error: 'No gems inventory found' })
      }

      const gemsData = gemsSnap.data()
      const availableGems = Number(gemsData[inventoryKey] || 0)
      if (availableGems < amount) {
        return res.status(400).json({
          error: `Insufficient gems. Available: ${availableGems}, Requested: ${amount}`
        })
      }

      // Get city boost
      const cityBoostRef = db.doc(`city_boosts/${cityId}`)
      const cityBoostSnap = await cityBoostRef.get()
      const cityBoostData = cityBoostSnap.exists ? cityBoostSnap.data() : {}
      const cityBoostDecimal = cityBoostData.bonuses?.[inventoryKey] || 0

      // Gem staking boost
      const gemBoost = await getGemsBoostForType(actor, cleanGemType)

      // Base price
      const basePriceRef = db.doc('runtime/pricing')
      const basePriceSnap = await basePriceRef.get()
      if (!basePriceSnap.exists) throw new Error('Base price not available')

      const basePriceData = basePriceSnap.data()
      const basePrice = Number(basePriceData.basePrice || 0)
      if (!basePrice || basePrice <= 0) throw new Error('Invalid base price data')

      console.log(
        `[Trading] Using dynamic base price: ${basePrice} (BTC: ${basePriceData.btcUsd})`
      )

      const cityMultiplier = 1 + cityBoostDecimal
      const gemMultiplier = 1 + gemBoost
      const totalPayout = Math.floor(
        basePrice * amount * cityMultiplier * gemMultiplier
      )

      console.log(
        `[Trading] Calculation: ${basePrice} * ${amount} * ${cityMultiplier} * ${gemMultiplier} = ${totalPayout}`
      )
      console.log(
        `[Trading] City boost: ${(cityBoostDecimal * 100).toFixed(
          1
        )}%, Gem boost: ${(gemBoost * 100).toFixed(0)}%`
      )

      // Optional client expectation check to prevent race-condition sells
      const expected = req.body?.expected
      if (expected) {
        const expBase = Number(expected.basePrice ?? expected.base ?? 0)
        const expCity = Number(expected.cityBoost ?? expected.cityBoostDecimal ?? 0)
        const expGem = Number(expected.gemBoost ?? 0)
        const expTotal =
          typeof expected.totalPayout === 'number'
            ? Math.floor(expected.totalPayout)
            : Math.floor(expBase * amount * (1 + expCity) * (1 + expGem))

        const mismatch = expTotal !== totalPayout
        if (mismatch) {
          return res.status(409).json({
            error: 'price_changed',
            message: 'Quote changed before execution',
            server: { basePrice, cityBoostDecimal, gemBoost, totalPayout },
            client: {
              basePrice: expBase,
              cityBoostDecimal: expCity,
              gemBoost: expGem,
              totalPayout: expTotal
            }
          })
        }
      }

      // Execute transaction
      await db.runTransaction(async tx => {
        const playerSnap = await tx.get(root)
        const currentCurrency = Number(playerSnap.data()?.ingameCurrency || 0)

        tx.update(gems, { [inventoryKey]: availableGems - amount })
        tx.update(root, { ingameCurrency: currentCurrency + totalPayout })

        const saleId = `sale_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
        tx.set(salesHistory.doc(saleId), {
          saleId,
          actor,
          gemType: cleanGemType,
          inventoryKey,
          amount,
          cityId,
          basePrice,
          cityBoostDecimal,
          gemBoost,
          totalPayout,
          soldAt: FieldValue.serverTimestamp()
        })
      })

      // Refresh live runtime doc in the background (do not block response)
      buildPlayerLiveData(actor, 'sellGems').catch(err =>
        console.error('[Trading] Failed to rebuild live data after sellGems:', err)
      )

      res.json({
        success: true,
        gemType: cleanGemType,
        inventoryKey,
        amount,
        cityId,
        cityBoost: cityBoostDecimal,
        gemBoost,
        totalPayout,
        remainingGems: availableGems - amount
      })
    } catch (error) {
      if (error.status === 403)
        return res.status(403).json({ error: 'season-locked' })
      console.error('[Trading] sellGems error:', error)
      res.status(500).json({ error: error.message })
    }
  })
)

/**
 * Get sales history for a player
 * GET /getSalesHistory?actor=...
 */
const getSalesHistory = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
    const actor = requireActor(req, res)
    if (!actor) return

    try {
      const { salesHistory } = refs(actor)
      const snap = await salesHistory.orderBy('soldAt', 'desc').limit(50).get()
      const sales = snap.docs.map(doc => doc.data())
      res.json({ success: true, sales })
    } catch (error) {
      console.error('[Trading] getSalesHistory error:', error)
      res.status(500).json({ error: error.message })
    }
  })
)

module.exports = { sellGems, getSalesHistory }