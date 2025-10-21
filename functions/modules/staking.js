// functions/modules/staking.js
// Staking persistence module for tracking staked NFTs across mining and polishing pages

const { onRequest } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const corsLib = require('cors')

// Node 20+ has native fetch
const fetch = globalThis.fetch || require('node-fetch')

const db = getFirestore(undefined, 'tsdgems')

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
  'Amethyst': { polished: 0.05, unpolished: 0.025 },
  'Topaz': { polished: 0.10, unpolished: 0.05 },
  'Aquamarine': { polished: 0.15, unpolished: 0.075 },
  'Opal': { polished: 0.20, unpolished: 0.10 },
  'Tanzanite': { polished: 0.25, unpolished: 0.125 },
  'Jade': { polished: 0.30, unpolished: 0.15 },
  'Emerald': { polished: 0.35, unpolished: 0.175 },
  'Sapphire': { polished: 0.40, unpolished: 0.20 },
  'Ruby': { polished: 0.50, unpolished: 0.25 },
  'Diamond': { polished: 1.00, unpolished: 0.50 }
}

function refs(actor) {
  return {
    staking: db.collection('staking').doc(actor)
  }
}

/**
 * Validate asset ownership via AtomicAssets API with fallbacks
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
  
  // Try each API in sequence
  for (let i = 0; i < ATOMIC_APIS.length; i++) {
    const apiBase = ATOMIC_APIS[i]
    const url = `${apiBase}/assets?owner=${actor}&collection_name=${COLLECTION_NAME}&ids=${idsParam}`
    
    try {
      console.log(`[Staking] Trying API ${i + 1}/${ATOMIC_APIS.length}: ${apiBase}`)
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      })
      
      if (!response.ok) {
        console.warn(`[Staking] API ${i + 1} returned ${response.status}`)
        continue // Try next API
      }

      const data = await response.json()
      const ownedAssets = data.data || []
      
      // Check if all requested assets are owned
      const ownedAssetIds = new Set(ownedAssets.map(asset => asset.asset_id))
      const allOwned = assetIds.every(id => ownedAssetIds.has(id))
      
      console.log(`[Staking] ✅ Success with API: ${apiBase}`)
      console.log(`[Staking] Validation result: ${allOwned ? 'VALID' : 'INVALID'} (${ownedAssets.length}/${assetIds.length} owned)`)
      
      return {
        valid: allOwned,
        ownedAssets: ownedAssets
      }
    } catch (error) {
      console.warn(`[Staking] API ${i + 1} error:`, error.message)
      // Continue to next API
    }
  }
  
  // All APIs failed
  console.warn('[Staking] ⚠️ All AtomicAssets APIs failed - Skipping validation (dev mode)')
  // In development, allow staking even if all APIs are down
  // TODO: Make this stricter in production
  return { valid: true, ownedAssets: [], apiError: true }
}

/**
 * Get current staking data for an actor
 * @param {string} actor - WAX account name
 * @returns {Promise<any>}
 */
async function getStakingData(actor) {
  const { staking } = refs(actor)
  const snap = await staking.get()
  
  if (!snap.exists) {
    return {
      mining: {},
      polishing: {},
      updatedAt: FieldValue.serverTimestamp()
    }
  }
  
  return snap.data() || { mining: {}, polishing: {} }
}

/**
 * Get all staked asset IDs for an actor (across all pages and slots)
 * @param {string} actor - WAX account name
 * @returns {Promise<Set<string>>}
 */
async function getAllStakedAssetIds(actor) {
  const stakingData = await getStakingData(actor)
  const allStakedAssetIds = new Set()
  
  // Check mining page
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
    })
  }
  
  // Check polishing page
  if (stakingData.polishing) {
    Object.values(stakingData.polishing).forEach(slotData => {
      if (slotData.table?.asset_id) {
        allStakedAssetIds.add(slotData.table.asset_id)
      }
    })
  }
  
  // Check gems page
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
 * Update staking data in Firestore
 * @param {string} actor - WAX account name
 * @param {any} stakingData - Staking data object
 * @returns {Promise<void>}
 */
async function updateStakingData(actor, stakingData) {
  const { staking } = refs(actor)
  
  stakingData.updatedAt = FieldValue.serverTimestamp()
  
  await staking.set(stakingData, { merge: true })
  console.log(`[Staking] Updated staking data for ${actor}`)
}

/**
 * Stake an asset to a specific slot
 * @param {string} actor - WAX account name
 * @param {string} page - Page type ('mining' or 'polishing')
 * @param {number} slotNum - Slot number
 * @param {string} assetType - Asset type ('mine', 'worker', 'table')
 * @param {any} assetData - Asset data including asset_id
 * @returns {Promise<any>}
 */
async function stakeAssetToSlot(actor, page, slotNum, assetType, assetData) {
  console.log(`[Staking] Staking ${assetType} to ${page} slot ${slotNum} for ${actor}`)
  
  // Validate asset ownership
  const validation = await validateAssetOwnership(actor, [assetData.asset_id])
  if (!validation.valid && !validation.apiError) {
    throw new Error(`Asset ${assetData.asset_id} is not owned by ${actor}`)
  }
  
  if (validation.apiError) {
    console.warn(`[Staking] ⚠️ Staking without validation (API error) - asset ${assetData.asset_id}`)
  }
  
  // Get current staking data
  const stakingData = await getStakingData(actor)
  
  // Check if this asset_id is already staked anywhere (prevent duplicate staking)
  const allStakedAssetIds = new Set()
  
  // Check mining page
  if (stakingData.mining) {
    Object.entries(stakingData.mining).forEach(([slotKey, slotData]) => {
      if (slotData.mine?.asset_id) {
        allStakedAssetIds.add(slotData.mine.asset_id)
      }
      if (slotData.workers) {
        slotData.workers.forEach(w => {
          if (w.asset_id) allStakedAssetIds.add(w.asset_id)
        })
      }
    })
  }
  
  // Check polishing page
  if (stakingData.polishing) {
    Object.entries(stakingData.polishing).forEach(([slotKey, slotData]) => {
      if (slotData.table?.asset_id) {
        allStakedAssetIds.add(slotData.table.asset_id)
      }
    })
  }
  
  // Verify this asset is not already staked
  if (allStakedAssetIds.has(assetData.asset_id)) {
    throw new Error(`Asset ${assetData.asset_id} is already staked. Each asset can only be staked once.`)
  }
  
  console.log(`[Staking] ✅ Asset ${assetData.asset_id} validation passed - not currently staked`)
  
  // Initialize page data if needed
  if (!stakingData[page]) {
    stakingData[page] = {}
  }
  
  // Initialize slot data if needed
  if (!stakingData[page][`slot${slotNum}`]) {
    stakingData[page][`slot${slotNum}`] = {}
  }
  
  const slot = stakingData[page][`slot${slotNum}`]
  
  // Handle different asset types
  if (assetType === 'mine' || assetType === 'table') {
    // Single asset per slot
    if (slot[assetType]) {
      throw new Error(`${assetType} already staked in slot ${slotNum}`)
    }
    slot[assetType] = {
      asset_id: assetData.asset_id,
      template_id: assetData.template_id,
      name: assetData.name,
      mp: assetData.mp || 0
    }
  } else if (assetType === 'worker') {
    // Multiple workers per slot
    if (!slot.workers) {
      slot.workers = []
    }
    
    // Check if this worker is already staked in this slot
    if (slot.workers.some(w => w.asset_id === assetData.asset_id)) {
      throw new Error(`Worker ${assetData.asset_id} already staked in slot ${slotNum}`)
    }
    
    slot.workers.push({
      asset_id: assetData.asset_id,
      template_id: assetData.template_id,
      name: assetData.name,
      mp: assetData.mp || 0
    })
  } else if (assetType === 'gem') {
    // Gem staking - single gem per slot
    if (slot.gem) {
      throw new Error(`Gem already staked in slot ${slotNum}`)
    }
    
    // Validate gem template ID
    const templateId = assetData.template_id
    if (!TEMPLATES_POLISHED.has(templateId) && !TEMPLATES_ROUGH.has(templateId)) {
      throw new Error(`Invalid gem template ID: ${templateId}`)
    }
    
    // Extract gem type and determine if polished
    const gemType = GEM_TYPE_MAP[templateId]
    const isPolished = TEMPLATES_POLISHED.has(templateId)
    
    if (!gemType) {
      throw new Error(`Unknown gem type for template ID: ${templateId}`)
    }
    
    // Get bonus multiplier
    const bonusMultipliers = GEM_BONUS_MULTIPLIERS[gemType]
    if (!bonusMultipliers) {
      throw new Error(`No bonus multipliers found for gem type: ${gemType}`)
    }
    
    const bonus = isPolished ? bonusMultipliers.polished : bonusMultipliers.unpolished
    
    slot.gem = {
      asset_id: assetData.asset_id,
      template_id: templateId,
      name: assetData.name,
      gemType: gemType,
      isPolished: isPolished,
      bonus: bonus,
      imagePath: assetData.imagePath || ''
    }
    
    console.log(`[Staking] Staked ${gemType} gem (${isPolished ? 'polished' : 'rough'}) with ${bonus * 100}% bonus`)
  } else {
    throw new Error(`Invalid asset type: ${assetType}`)
  }
  
  // Save updated staking data
  await updateStakingData(actor, stakingData)
  
  return stakingData
}

/**
 * Unstake an asset from a specific slot
 * @param {string} actor - WAX account name
 * @param {string} page - Page type ('mining' or 'polishing')
 * @param {number} slotNum - Slot number
 * @param {string} assetType - Asset type ('mine', 'worker', 'table')
 * @param {string} assetId - Asset ID to unstake
 * @returns {Promise<any>}
 */
async function unstakeAssetFromSlot(actor, page, slotNum, assetType, assetId) {
  console.log(`[Staking] Unstaking ${assetType} ${assetId} from ${page} slot ${slotNum} for ${actor}`)
  
  // Get current staking data
  const stakingData = await getStakingData(actor)
  
  // Check if page exists
  if (!stakingData[page]) {
    throw new Error(`No ${page} staking data found`)
  }
  
  // Check if slot exists
  const slotKey = `slot${slotNum}`
  if (!stakingData[page][slotKey]) {
    throw new Error(`No assets staked in ${page} slot ${slotNum}`)
  }
  
  const slot = stakingData[page][slotKey]
  
  // Handle different asset types
  if (assetType === 'mine' || assetType === 'table') {
    // Single asset per slot
    if (!slot[assetType] || slot[assetType].asset_id !== assetId) {
      throw new Error(`${assetType} ${assetId} not found in slot ${slotNum}`)
    }
    delete slot[assetType]
  } else if (assetType === 'worker') {
    // Multiple workers per slot
    if (!slot.workers || slot.workers.length === 0) {
      throw new Error(`No workers staked in slot ${slotNum}`)
    }
    
    const initialLength = slot.workers.length
    slot.workers = slot.workers.filter(w => w.asset_id !== assetId)
    
    if (slot.workers.length === initialLength) {
      throw new Error(`Worker ${assetId} not found in slot ${slotNum}`)
    }
    
    // Clean up empty workers array
    if (slot.workers.length === 0) {
      delete slot.workers
    }
  } else if (assetType === 'gem') {
    // Remove gem from slot
    if (!slot.gem || slot.gem.asset_id !== assetId) {
      throw new Error(`Gem ${assetId} not found in slot ${slotNum}`)
    }
    
    console.log(`[Staking] Unstaking ${slot.gem.gemType} gem from slot ${slotNum}`)
    delete slot.gem
  } else {
    throw new Error(`Invalid asset type: ${assetType}`)
  }
  
  // Clean up empty slot
  if (Object.keys(slot).length === 0) {
    delete stakingData[page][slotKey]
  }
  
  // Clean up empty page
  if (Object.keys(stakingData[page]).length === 0) {
    delete stakingData[page]
  }
  
  // Save updated staking data
  await updateStakingData(actor, stakingData)
  
  return stakingData
}

// ========================================
// CLOUD FUNCTIONS
// ========================================

function requireActor(req, res) {
  const actor = (req.method === 'GET' ? req.query.actor : req.body?.actor) || ''
  if (!actor || typeof actor !== 'string') {
    res.status(400).json({ error: 'actor required' })
    return null
  }
  return actor
}

/**
 * Stake an asset to a slot
 * POST /stakeAsset
 * Body: { actor, page, slotNum, assetType, assetData }
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
        stakingData: stakingData
      })
    } catch (error) {
      console.error('[Staking] stakeAsset error:', error)
      return res.status(400).json({ error: error.message })
    }
  })
)

/**
 * Unstake an asset from a slot
 * POST /unstakeAsset
 * Body: { actor, page, slotNum, assetType, assetId }
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
        stakingData: stakingData
      })
    } catch (error) {
      console.error('[Staking] unstakeAsset error:', error)
      return res.status(400).json({ error: error.message })
    }
  })
)

/**
 * Get all staked assets for an actor
 * GET /getStakedAssets?actor={actor}
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
        stakingData: stakingData
      })
    } catch (error) {
      console.error('[Staking] getStakedAssets error:', error)
      return res.status(500).json({ error: error.message })
    }
  })
)

/**
 * Get gem boost bonus for a specific gem type from staked gems
 * @param {string} actor - WAX account name
 * @param {string} gemType - Gem type (e.g., 'Diamond', 'Ruby')
 * @returns {Promise<number>} Bonus multiplier (e.g., 1.00 = 100% boost)
 */
async function getGemsBoostForType(actor, gemType) {
  console.log(`[Staking] Getting gem boost for ${gemType} for ${actor}`)
  
  const stakingData = await getStakingData(actor)
  if (!stakingData.gems) {
    return 0
  }
  
  // Search through all gem slots for the requested gem type
  for (const [slotKey, slotData] of Object.entries(stakingData.gems)) {
    if (slotData.gem && slotData.gem.gemType === gemType) {
      const bonus = slotData.gem.bonus || 0
      console.log(`[Staking] Found staked ${gemType} gem with ${bonus * 100}% boost`)
      return bonus
    }
  }
  
  console.log(`[Staking] No staked ${gemType} gem found`)
  return 0
}

// Export helper function for use by other modules (Cloud Functions are auto-exported via exports.xxx)
module.exports.getGemsBoostForType = getGemsBoostForType;

