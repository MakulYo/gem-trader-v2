// functions/modules/staking.js
// Staking persistence module for tracking staked NFTs across mining and polishing pages
// Canonical staking state lives in: staking/{actor}
// Other systems (mining, live-aggregator, triggers) already use this collection.

const { onRequest } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const corsLib = require('cors')

// Node 20+ has native fetch
const fetch = globalThis.fetch || require('node-fetch')

const db = getFirestore()

const RAW_ALLOW = process.env.CORS_ALLOW || ''
const ALLOWLIST = RAW_ALLOW.split(',').map(s => s.trim()).filter(Boolean)
const cors = corsLib({ origin: ALLOWLIST.length ? ALLOWLIST : true, credentials: false })

// --- AtomicAssets (public API) with fallbacks ---
const ATOMIC_APIS = [
  'https://wax.api.atomicassets.io/atomicassets/v1',
  'https://aa-api-wax.eosauthority.com/atomicassets/v1',
  'https://atomic-wax-mainnet.wecan.dev/atomicassets/v1',
  'https://atomic.eosn.io/atomicassets/v1',
  'https://atomic.waxsweden.org/atomicassets/v1',
]

const COLLECTION_NAME = 'tsdmediagems'

// Gem Type Mappings and Bonus Values
const TEMPLATES_POLISHED = new Set([
  894387, 894388, 894389, 894390, 894391, 894392, 894393, 894394, 894395, 894396,
])
const TEMPLATES_ROUGH = new Set([
  894397, 894398, 894399, 894400, 894401, 894402, 894403, 894404, 894405, 894406,
])

// Template ID to Gem Type mapping
const GEM_TYPE_MAP = {
  // Polished
  894387: 'Diamond',
  894388: 'Ruby',
  894389: 'Sapphire',
  894390: 'Emerald',
  894391: 'Jade',
  894392: 'Tanzanite',
  894393: 'Opal',
  894394: 'Aquamarine',
  894395: 'Topaz',
  894396: 'Amethyst',
  // Rough
  894397: 'Diamond',
  894398: 'Ruby',
  894399: 'Sapphire',
  894400: 'Emerald',
  894401: 'Jade',
  894402: 'Tanzanite',
  894403: 'Opal',
  894404: 'Aquamarine',
  894405: 'Topaz',
  894406: 'Amethyst',
}

// Gem Bonus Multipliers from reference.js
const GEM_BONUS_MULTIPLIERS = {
  Amethyst:   { polished: 0.05,  unpolished: 0.025 },
  Topaz:      { polished: 0.10,  unpolished: 0.05 },
  Aquamarine: { polished: 0.15,  unpolished: 0.075 },
  Opal:       { polished: 0.20,  unpolished: 0.10 },
  Tanzanite:  { polished: 0.25,  unpolished: 0.125 },
  Jade:       { polished: 0.30,  unpolished: 0.15 },
  Emerald:    { polished: 0.35,  unpolished: 0.175 },
  Sapphire:   { polished: 0.40,  unpolished: 0.20 },
  Ruby:       { polished: 0.50,  unpolished: 0.25 },
  Diamond:    { polished: 1.00,  unpolished: 0.50 },
}

/**
 * Canonical staking state lives under:
 *   staking/{actor}
 * Structure:
 *   { mining: {...}, polishing: {...}, gems: {...}, updatedAt: ... }
 */
function refs(actor) {
  const stakingDoc = db.collection('staking').doc(actor)
  return { stakingDoc }
}

/**
 * Validate asset ownership via AtomicAssets API with fallbacks
 * Tests all APIs in parallel and uses the fastest response
 * @param {string} actor - WAX account name
 * @param {string[]} assetIds - Array of asset IDs to validate
 * @returns {Promise<{valid: boolean, ownedAssets: any[], apiError?: boolean}>}
 */
async function validateAssetOwnership(actor, assetIds) {
  if (!assetIds || assetIds.length === 0) {
    return { valid: true, ownedAssets: [] }
  }

  const idsParam = assetIds.join(',')
  console.log(`[Staking] Validating ownership for ${actor}:`, assetIds)

  const apiPromises = ATOMIC_APIS.map(async (apiBase, index) => {
    const url = `${apiBase}/assets?owner=${actor}&collection_name=${COLLECTION_NAME}&ids=${idsParam}`

    try {
      const startTime = Date.now()
      console.log(`[Staking] Testing API ${index + 1}/${ATOMIC_APIS.length}: ${apiBase}`)

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      })

      const duration = Date.now() - startTime

      if (!response.ok) {
        console.warn(`[Staking] API ${index + 1} returned ${response.status} (${duration}ms)`)
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const ownedAssets = data.data || []

      const ownedAssetIds = new Set(ownedAssets.map(asset => asset.asset_id))
      const allOwned = assetIds.every(id => ownedAssetIds.has(id))

      console.log(`[Staking] ✅ Fastest response from API ${index + 1}: ${apiBase} (${duration}ms)`)
      console.log(
        `[Staking] Validation result: ${allOwned ? 'VALID' : 'INVALID'} (${ownedAssets.length}/${assetIds.length} owned)`
      )

      return {
        valid: allOwned,
        ownedAssets,
        duration,
        apiIndex: index,
      }
    } catch (error) {
      console.warn(`[Staking] API ${index + 1} error:`, error.message)
      return {
        valid: false,
        ownedAssets: [],
        error: error.message,
        apiIndex: index,
      }
    }
  })

  const results = await Promise.all(apiPromises)
  const successfulResult = results.find(r => r.valid !== undefined && !r.error)

  if (successfulResult) {
    return {
      valid: successfulResult.valid,
      ownedAssets: successfulResult.ownedAssets,
    }
  }

  console.warn('[Staking] ⚠️ All AtomicAssets APIs failed - Skipping validation (dev mode)')
  return { valid: true, ownedAssets: [], apiError: true }
}

/**
 * Normalize a raw speedboost entry into the canonical single-slot structure.
 */
function normalizeSpeedboostEntry(entry) {
  if (!entry || typeof entry !== 'object') return null

  const assetId = entry.asset_id || entry.assetId
  if (!assetId) return null

  const templateId = entry.template_id ?? entry.templateId ?? null
  const templateMint = entry.template_mint ?? entry.templateMint ?? null
  const rarity = entry.rarity ?? null
  const name = entry.name || entry.display_name || `Speedboost ${assetId}`
  const imagePath = entry.imagePath || entry.image_url || null

  const rawBoost = entry.boost !== undefined ? Number(entry.boost) : null
  let boost = Number.isFinite(rawBoost) ? rawBoost : null

  const rawMultiplier = entry.multiplier !== undefined ? Number(entry.multiplier) : null
  let multiplier = Number.isFinite(rawMultiplier) ? rawMultiplier : null

  if (boost === null && multiplier !== null) {
    boost = multiplier - 1
  }

  if (multiplier === null && boost !== null) {
    multiplier = 1 + boost
  }

  if (!Number.isFinite(boost) || boost < 0) {
    boost = Math.max(0, boost || 0)
  }

  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    multiplier = 1 + boost
  }

  const normalized = {
    asset_id: assetId,
    type: 'speedboost',
    boost,
    multiplier,
  }

  if (templateId) normalized.template_id = templateId
  if (templateMint) normalized.template_mint = templateMint
  if (rarity) normalized.rarity = rarity
  if (name) normalized.name = name
  if (imagePath) normalized.imagePath = imagePath

  return normalized
}

/**
 * Normalize legacy speedboost arrays into a single speedboost entry per slot.
 */
function normalizeSlotSpeedboost(slotData) {
  if (!slotData || typeof slotData !== 'object') return

  let normalized = null

  if (Array.isArray(slotData.speedboosts) && slotData.speedboosts.length > 0) {
    const normalizedEntries = slotData.speedboosts
      .map(entry => normalizeSpeedboostEntry(entry))
      .filter(Boolean)

    if (normalizedEntries.length > 0) {
      normalized = normalizedEntries.reduce((best, current) => {
        if (!best) return current
        return current.boost > best.boost ? current : best
      }, null)
    }
  } else if (slotData.speedboost) {
    normalized = normalizeSpeedboostEntry(slotData.speedboost)
  }

  if (normalized) {
    slotData.speedboost = normalized
  } else {
    delete slotData.speedboost
  }

  if (slotData.speedboosts) {
    delete slotData.speedboosts
  }
}

/**
 * Normalize staking data structure for backward compatibility.
 */
function normalizeStakingData(stakingData) {
  if (!stakingData || typeof stakingData !== 'object') {
    return {
      mining: {},
      polishing: {},
      gems: {},
    }
  }

  if (!stakingData.mining) stakingData.mining = {}
  if (!stakingData.polishing) stakingData.polishing = {}
  if (!stakingData.gems) stakingData.gems = {}

  if (stakingData.mining && typeof stakingData.mining === 'object') {
    Object.values(stakingData.mining).forEach(slotData => normalizeSlotSpeedboost(slotData))
  }

  return stakingData
}

/**
 * Get current staking data for an actor from staking/{actor}
 */
async function getStakingData(actor) {
  const { stakingDoc } = refs(actor)
  const snap = await stakingDoc.get()

  if (!snap.exists) {
    const empty = normalizeStakingData({
      mining: {},
      polishing: {},
      gems: {},
    })
    console.log(`[Staking] No staking doc for ${actor}, returning empty staking`)
    return empty
  }

  const data = snap.data() || {}
  const normalized = normalizeStakingData(data)
  return normalized
}

/**
 * Update staking data in staking/{actor}
 */
async function updateStakingData(actor, stakingData) {
  const { stakingDoc } = refs(actor)

  const normalized = normalizeStakingData(stakingData)
  normalized.updatedAt = FieldValue.serverTimestamp()

  await stakingDoc.set(normalized, { merge: true })

  console.log(`[Staking] Updated staking data for ${actor}`)
}

/**
 * Get all staked asset IDs for an actor (across all pages and slots)
 */
async function getAllStakedAssetIds(actor) {
  const stakingData = await getStakingData(actor)
  const allStakedAssetIds = new Set()

  if (stakingData.mining) {
    Object.values(stakingData.mining).forEach(slotData => {
      if (slotData.mine?.asset_id) {
        allStakedAssetIds.add(slotData.mine.asset_id)
      }
      if (slotData.workers) {
        slotData.workers.forEach(w => {
          if (w.asset_id) allStakedAssetIds.add(w.asset_id)
        })
      }
      if (slotData.speedboost?.asset_id) {
        allStakedAssetIds.add(slotData.speedboost.asset_id)
      }
      if (Array.isArray(slotData.speedboosts)) {
        slotData.speedboosts.forEach(sb => {
          if (sb?.asset_id) allStakedAssetIds.add(sb.asset_id)
        })
      }
    })
  }

  if (stakingData.polishing) {
    Object.values(stakingData.polishing).forEach(slotData => {
      if (slotData.table?.asset_id) {
        allStakedAssetIds.add(slotData.table.asset_id)
      }
    })
  }

  if (stakingData.gems) {
    Object.values(stakingData.gems).forEach(slotData => {
      if (slotData.gem?.asset_id) {
        allStakedAssetIds.add(slotData.gem.asset_id)
      }
    })
  }

  console.log(`[Staking] Found ${allStakedAssetIds.size} staked assets for ${actor}`)
  return allStakedAssetIds
}

/**
 * Stake an asset to a specific slot
 */
async function stakeAssetToSlot(actor, page, slotNum, assetType, assetData) {
  console.log(`[Staking] Staking ${assetType} to ${page} slot ${slotNum} for ${actor}`)

  const validation = await validateAssetOwnership(actor, [assetData.asset_id])
  if (!validation.valid && !validation.apiError) {
    throw new Error(`Asset ${assetData.asset_id} is not owned by ${actor}`)
  }
  if (validation.apiError) {
    console.warn(`[Staking] ⚠️ Staking without validation (API error) - asset ${assetData.asset_id}`)
  }

  const stakingData = await getStakingData(actor)

  // prevent duplicates across all slots/pages
  const allStakedAssetIds = await getAllStakedAssetIds(actor)
  if (allStakedAssetIds.has(assetData.asset_id)) {
    throw new Error(`Asset ${assetData.asset_id} is already staked. Each asset can only be staked once.`)
  }

  if (!stakingData[page]) stakingData[page] = {}
  const slotKey = `slot${slotNum}`
  if (!stakingData[page][slotKey]) stakingData[page][slotKey] = {}

  const slot = stakingData[page][slotKey]
  normalizeSlotSpeedboost(slot)

  if (assetType === 'mine' || assetType === 'table') {
    if (slot[assetType]) {
      throw new Error(`${assetType} already staked in slot ${slotNum}`)
    }
    slot[assetType] = {
      asset_id: assetData.asset_id,
      template_id: assetData.template_id,
      name: assetData.name,
      mp: assetData.mp || 0,
    }
  } else if (assetType === 'worker') {
    if (!slot.workers) slot.workers = []
    if (slot.workers.some(w => w.asset_id === assetData.asset_id)) {
      throw new Error(`Worker ${assetData.asset_id} already staked in slot ${slotNum}`)
    }
    slot.workers.push({
      asset_id: assetData.asset_id,
      template_id: assetData.template_id,
      name: assetData.name,
      mp: assetData.mp || 0,
    })
  } else if (assetType === 'gem') {
    if (slot.gem) {
      throw new Error(`Gem already staked in slot ${slotNum}`)
    }

    const templateId = assetData.template_id
    if (!TEMPLATES_POLISHED.has(templateId) && !TEMPLATES_ROUGH.has(templateId)) {
      throw new Error(`Invalid gem template ID: ${templateId}`)
    }

    const gemType = GEM_TYPE_MAP[templateId]
    const isPolished = TEMPLATES_POLISHED.has(templateId)
    if (!gemType) throw new Error(`Unknown gem type for template ID: ${templateId}`)

    const bonusMultipliers = GEM_BONUS_MULTIPLIERS[gemType]
    if (!bonusMultipliers) throw new Error(`No bonus multipliers found for gem type: ${gemType}`)

    const bonus = isPolished ? bonusMultipliers.polished : bonusMultipliers.unpolished

    slot.gem = {
      asset_id: assetData.asset_id,
      template_id: templateId,
      name: assetData.name,
      gemType,
      isPolished,
      bonus,
      imagePath: assetData.imagePath || '',
    }

    console.log(
      `[Staking] Staked ${gemType} gem (${isPolished ? 'polished' : 'rough'}) with ${(bonus * 100).toFixed(
        2
      )}% bonus`
    )
  } else if (assetType === 'speedboost') {
    const boost = assetData.boost !== undefined ? Number(assetData.boost) : null
    const multiplier = assetData.multiplier !== undefined ? Number(assetData.multiplier) : null

    const normalizedSpeedboost = normalizeSpeedboostEntry({
      asset_id: assetData.asset_id,
      template_id: assetData.template_id,
      template_mint: assetData.template_mint,
      name: assetData.name,
      boost,
      multiplier,
      rarity: assetData.rarity,
      imagePath: assetData.imagePath,
    })

    if (!normalizedSpeedboost) {
      throw new Error(`Invalid speedboost payload for asset ${assetData.asset_id}`)
    }

    if (slot.speedboost && slot.speedboost.asset_id === normalizedSpeedboost.asset_id) {
      slot.speedboost = { ...slot.speedboost, ...normalizedSpeedboost }
      console.log(`[Staking] Refreshed speedboost ${assetData.asset_id} in slot ${slotNum}`)
    } else {
      if (slot.speedboost?.asset_id) {
        console.log(
          `[Staking] Replacing speedboost ${slot.speedboost.asset_id} with ${assetData.asset_id} in slot ${slotNum}`
        )
      }
      slot.speedboost = normalizedSpeedboost
      console.log(`[Staking] Staked speedboost ${assetData.asset_id} to slot ${slotNum}`)
    }

    const boostPct = Number(normalizedSpeedboost.boost || 0)
    const multiplierVal = Number(normalizedSpeedboost.multiplier || 1)
    console.log(
      `[Staking] Speedboost ${assetData.asset_id} provides ${(boostPct * 100).toFixed(
        2
      )}% speed (×${multiplierVal.toFixed(3)})`
    )

    delete slot.speedboosts
  } else {
    throw new Error(`Invalid asset type: ${assetType}`)
  }

  await updateStakingData(actor, stakingData)
  return stakingData
}

/**
 * Batch stake multiple workers to a slot
 */
async function stakeWorkersBatch(actor, page, slotNum, workers) {
  console.log(`[Staking] Batch staking ${workers.length} workers to ${page} slot ${slotNum} for ${actor}`)

  const assetIds = workers.map(w => w.asset_id)
  const validation = await validateAssetOwnership(actor, assetIds)

  if (!validation.valid && !validation.apiError) {
    throw new Error(`Some assets are not owned by ${actor}`)
  }
  if (validation.apiError) {
    console.warn('[Staking] ⚠️ Staking without validation (API error) - batch workers')
  }

  const stakingData = await getStakingData(actor)
  const allStakedAssetIds = await getAllStakedAssetIds(actor)
  const alreadyStaked = assetIds.filter(id => allStakedAssetIds.has(id))
  if (alreadyStaked.length > 0) {
    throw new Error(`Assets already staked: ${alreadyStaked.join(', ')}`)
  }

  if (!stakingData[page]) stakingData[page] = {}
  const slotKey = `slot${slotNum}`
  if (!stakingData[page][slotKey]) stakingData[page][slotKey] = {}

  const slot = stakingData[page][slotKey]
  if (!slot.workers) slot.workers = []

  workers.forEach(worker => {
    if (slot.workers.some(w => w.asset_id === worker.asset_id)) {
      console.warn(`[Staking] Worker ${worker.asset_id} already in slot ${slotNum}, skipping`)
      return
    }

    slot.workers.push({
      asset_id: worker.asset_id,
      template_id: worker.template_id,
      name: worker.name,
      mp: worker.mp || 0,
    })
  })

  await updateStakingData(actor, stakingData)
  return stakingData
}

/**
 * Unstake an asset from a specific slot
 * Uses a transaction on staking/{actor} to keep consistency.
 */
async function unstakeAssetFromSlot(actor, page, slotNum, assetType, assetId) {
  console.log(`[Staking] Unstaking ${assetType} ${assetId} from ${page} slot ${slotNum} for ${actor}`)

  const { stakingDoc } = refs(actor)

  return await db.runTransaction(async transaction => {
    const snap = await transaction.get(stakingDoc)

    if (!snap.exists) {
      throw new Error(`No staking data found for ${actor}`)
    }

    const data = snap.data() || {}
    const stakingData = normalizeStakingData(data)

    if (!stakingData[page]) {
      throw new Error(`No ${page} staking data found`)
    }

    const slotKey = `slot${slotNum}`
    if (!stakingData[page][slotKey]) {
      throw new Error(`No assets staked in ${page} slot ${slotNum}`)
    }

    const slot = stakingData[page][slotKey]
    normalizeSlotSpeedboost(slot)

    if (assetType === 'mine' || assetType === 'table') {
      if (!slot[assetType] || slot[assetType].asset_id !== assetId) {
        throw new Error(`${assetType} ${assetId} not found in slot ${slotNum}`)
      }
      delete slot[assetType]
    } else if (assetType === 'worker') {
      if (!slot.workers || slot.workers.length === 0) {
        throw new Error(`No workers staked in slot ${slotNum}`)
      }

      const initialLength = slot.workers.length
      slot.workers = slot.workers.filter(w => w.asset_id !== assetId)

      if (slot.workers.length === initialLength) {
        throw new Error(`Worker ${assetId} not found in slot ${slotNum}`)
      }

      if (slot.workers.length === 0) {
        delete slot.workers
      }
    } else if (assetType === 'gem') {
      if (!slot.gem || slot.gem.asset_id !== assetId) {
        throw new Error(`Gem ${assetId} not found in slot ${slotNum}`)
      }
      delete slot.gem
    } else if (assetType === 'speedboost') {
      if (slot.speedboost?.asset_id === assetId) {
        delete slot.speedboost
      } else if (Array.isArray(slot.speedboosts) && slot.speedboosts.length > 0) {
        const initialLength = slot.speedboosts.length
        slot.speedboosts = slot.speedboosts.filter(sb => sb.asset_id !== assetId)
        if (slot.speedboosts.length === initialLength) {
          throw new Error(`Speedboost ${assetId} not found in slot ${slotNum}`)
        }
        if (slot.speedboosts.length === 0) delete slot.speedboosts
      } else {
        throw new Error(`No speedboost staked in slot ${slotNum}`)
      }
    } else {
      throw new Error(`Invalid asset type: ${assetType}`)
    }

    if (Object.keys(slot).length === 0) {
      delete stakingData[page][slotKey]
    }
    if (Object.keys(stakingData[page]).length === 0) {
      delete stakingData[page]
    }

    stakingData.updatedAt = FieldValue.serverTimestamp()

    transaction.set(stakingDoc, stakingData, { merge: true })

    return stakingData
  })
}

/**
 * Auto-unstake assets that are no longer owned
 */
async function autoUnstakeMissingAssets(actor, page, slotNum, missingAssets) {
  if (!missingAssets || missingAssets.length === 0) {
    return { unstaked: [], errors: [] }
  }

  console.log(`[Staking] Auto-unstaking ${missingAssets.length} missing assets from ${page} slot ${slotNum} for ${actor}`)

  const unstaked = []
  const errors = []

  for (const missingAsset of missingAssets) {
    const { asset_id, type } = missingAsset

    try {
      let assetType = type || 'worker'

      if (type === 'mine') assetType = 'mine'
      else if (type === 'worker') assetType = 'worker'
      else if (type === 'table') assetType = 'table'
      else if (type === 'gem') assetType = 'gem'
      else if (type === 'speedboost') assetType = 'speedboost'
      else {
        console.warn(`[Staking] Unknown asset type: ${type}, skipping auto-unstake for ${asset_id}`)
        errors.push({ asset_id, error: `Unknown type: ${type}` })
        continue
      }

      await unstakeAssetFromSlot(actor, page, slotNum, assetType, asset_id)
      unstaked.push({
        asset_id,
        type: assetType,
        name: missingAsset.name || `${assetType} ${asset_id}`,
      })
      console.log(`[Staking] ✅ Auto-unstaked ${assetType} ${asset_id} from ${page} slot ${slotNum}`)
    } catch (error) {
      console.error(`[Staking] ❌ Failed to auto-unstake ${asset_id}:`, error.message)
      errors.push({
        asset_id,
        type: missingAsset.type,
        error: error.message,
      })
    }
  }

  return { unstaked, errors }
}

// ========================================
// CLOUD FUNCTIONS
// ========================================

function requireActor(req, res) {
  const actor =
    (req.method === 'GET' ? req.query.actor : req.body?.actor) ||
    ''
  if (!actor || typeof actor !== 'string') {
    res.status(400).json({ error: 'actor required' })
    return null
  }
  return actor
}

/**
 * POST /stakeAsset
 */
exports.stakeAsset = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'POST only' })
    }

    const actor = requireActor(req, res)
    if (!actor) return

    const { page, slotNum, assetType, assetData } = req.body

    if (!page || !slotNum || !assetType || !assetData || !assetData.asset_id) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    try {
      const stakingData = await stakeAssetToSlot(actor, page, slotNum, assetType, assetData)
      return res.status(200).json({
        success: true,
        stakingData,
      })
    } catch (error) {
      console.error('[Staking] stakeAsset error:', error)
      return res.status(400).json({ error: error.message })
    }
  })
)

/**
 * POST /stakeWorkersBatch
 */
exports.stakeWorkersBatch = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'POST only' })
    }

    const actor = requireActor(req, res)
    if (!actor) return

    const { page, slotNum, workers } = req.body

    if (!page || !slotNum || !workers || !Array.isArray(workers) || workers.length === 0) {
      return res.status(400).json({ error: 'Missing required fields or empty workers array' })
    }

    try {
      const stakingData = await stakeWorkersBatch(actor, page, slotNum, workers)
      return res.status(200).json({
        success: true,
        stakingData,
      })
    } catch (error) {
      console.error('[Staking] stakeWorkersBatch error:', error)
      return res.status(400).json({ error: error.message })
    }
  })
)

/**
 * POST /unstakeAsset
 */
exports.unstakeAsset = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'POST only' })
    }

    const actor = requireActor(req, res)
    if (!actor) return

    const { page, slotNum, assetType, assetId } = req.body

    if (!page || !slotNum || !assetType || !assetId) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    try {
      const stakingData = await unstakeAssetFromSlot(actor, page, slotNum, assetType, assetId)
      return res.status(200).json({
        success: true,
        stakingData,
      })
    } catch (error) {
      console.error('[Staking] unstakeAsset error:', error)
      return res.status(400).json({ error: error.message })
    }
  })
)

/**
 * GET /getStakedAssets?actor={actor}
 * Returns the staking/{actor} data
 */
exports.getStakedAssets = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'GET only' })
    }

    const actor = requireActor(req, res)
    if (!actor) return

    try {
      const stakingData = await getStakingData(actor)
      return res.status(200).json({
        success: true,
        stakingData,
      })
    } catch (error) {
      console.error('[Staking] getStakedAssets error:', error)
      return res.status(500).json({ error: error.message })
    }
  })
)

/**
 * Gem boost helper for other modules
 */
async function getGemsBoostForType(actor, gemType) {
  console.log(`[Staking] Getting gem boost for ${gemType} for ${actor}`)

  const stakingData = await getStakingData(actor)
  if (!stakingData.gems) return 0

  for (const [slotKey, slotData] of Object.entries(stakingData.gems)) {
    if (slotData.gem && slotData.gem.gemType === gemType) {
      const bonus = slotData.gem.bonus || 0
      console.log(`[Staking] Found staked ${gemType} gem with ${(bonus * 100).toFixed(2)}% boost`)
      return bonus
    }
  }

  console.log(`[Staking] No staked ${gemType} gem found`)
  return 0
}

module.exports.getGemsBoostForType = getGemsBoostForType