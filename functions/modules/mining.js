// functions/modules/mining.js

const { onRequest }  = require('firebase-functions/v2/https')
const admin          = require('firebase-admin')
const { getFirestore } = require('firebase-admin/firestore')
const corsLib        = require('cors')

// Node 20+ has native fetch
const fetch = globalThis.fetch || require('node-fetch')

const db = getFirestore();

// --- AtomicAssets (public API) with fallbacks ---
const ATOMIC_APIS = [
  'https://wax.api.atomicassets.io/atomicassets/v1',
  'https://aa-api-wax.eosauthority.com/atomicassets/v1',
  'https://atomic-wax-mainnet.wecan.dev/atomicassets/v1',
  'https://atomic.eosn.io/atomicassets/v1',
  'https://atomic.waxsweden.org/atomicassets/v1',
]
const COLLECTION_NAME = 'tsdmediagems'

const RAW_ALLOW  = process.env.CORS_ALLOW || ''
const ALLOWLIST  = RAW_ALLOW.split(',').map(s => s.trim()).filter(Boolean)
const cors       = corsLib({ origin: ALLOWLIST.length ? ALLOWLIST : true, credentials: false })

// --- Helper functions for asset ownership validation ---

/**
 * Fetch asset details by asset IDs from AtomicAssets API with fallbacks
 * @param {string[]} assetIds - Array of asset IDs to fetch
 * @returns {Promise<any[]>} Array of asset objects with template_mint, etc.
 */
async function fetchAssetsByIds(assetIds) {
  if (!assetIds || assetIds.length === 0) return []

  const idsParam = assetIds.join(',')
  console.log(`[Mining] Fetching ${assetIds.length} assets by IDs:`, assetIds)

  const errors = []
  for (let i = 0; i < ATOMIC_APIS.length; i++) {
    const apiBase = ATOMIC_APIS[i]
    const url = `${apiBase}/assets?collection_name=${COLLECTION_NAME}&ids=${idsParam}`

    try {
      console.log(`[Mining] Trying API ${i + 1}/${ATOMIC_APIS.length}: ${apiBase}`)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      })
      clearTimeout(timeout)

      if (response.ok) {
        const data = await response.json()
        const assets = data.data || []
        console.log(`[Mining] ✅ Success with API: ${apiBase} (${assets.length} assets found)`)
        return assets
      }
      const statusText = await response.text().catch(() => response.statusText)
      console.warn(`[Mining] API ${i + 1} returned ${response.status}: ${statusText}`)
      errors.push(`${apiBase}: ${response.status}`)
    } catch (error) {
      console.warn(`[Mining] API ${i + 1} failed:`, error.message)
      errors.push(`${apiBase}: ${error.message}`)
    }
  }

  console.error(`[Mining] ❌ All ${ATOMIC_APIS.length} APIs failed:`, errors)
  throw new Error(`All AtomicAssets APIs failed: ${errors.join('; ')}`)
}

/**
 * Validate asset ownership for an actor
 * @param {string} actor - WAX account name
 * @param {string[]} assetIds - Array of asset IDs to validate
 * @returns {Promise<{valid: boolean, ownedAssets: any[], missingAssets: any[]}>}
 */
async function validateOwnership(actor, assetIds) {
  if (!assetIds || assetIds.length === 0) {
    return { valid: true, ownedAssets: [], missingAssets: [] }
  }

  try {
    const assets = await fetchAssetsByIds(assetIds)

    // Filter assets that are actually owned by the actor
    const ownedAssets = assets.filter(asset => asset.owner === actor)
    const ownedAssetIds = new Set(ownedAssets.map(a => a.asset_id))

    // Find missing assets (not owned by actor or not found)
    const missingIds = assetIds.filter(id => !ownedAssetIds.has(id))
    const missingAssets = missingIds.map(id => {
      // Try to find asset data even if not owned (for error reporting)
      const assetData = assets.find(a => a.asset_id === id) || {}
      return {
        asset_id: id,
        template_id: assetData.template?.template_id || assetData.template_id,
        template_mint: assetData.template_mint,
        owner: assetData.owner,
        name: assetData.name
      }
    })

    const valid = missingIds.length === 0
    console.log(`[Mining] Ownership validation: ${valid ? 'VALID' : 'INVALID'} (${ownedAssets.length}/${assetIds.length} owned, ${missingIds.length} missing)`)

    return { valid, ownedAssets, missingAssets }
  } catch (error) {
    console.warn(`[Mining] Ownership validation failed (API error):`, error.message)
    // In case of API failure, assume ownership is valid (graceful degradation)
    return { valid: true, ownedAssets: [], missingAssets: [], apiError: true }
  }
}

/**
 * Get staked assets for a mining slot with full details
 * @param {string} actor - WAX account name
 * @param {number} slotNum - Slot number
 * @returns {Promise<{assets: any[], totalMP: number}>}
 */
async function getStakedAssetsForSlot(actor, slotNum) {
  const stakingRef = db.collection('staking').doc(actor)
  const stakingSnap = await stakingRef.get()

  const assets = []
  let totalMP = 0
  let speedboost = null

  if (stakingSnap.exists) {
    const stakingData = stakingSnap.data()
    const slotKey = `slot${slotNum}`

    if (stakingData.mining && stakingData.mining[slotKey]) {
      const slotData = stakingData.mining[slotKey]

      // Add mine if staked
      if (slotData.mine) {
        const mine = slotData.mine
        assets.push({
          asset_id: mine.asset_id,
          template_id: mine.template_id,
          name: mine.name,
          mp: mine.mp || 0,
          type: 'mine'
        })
        totalMP += Number(mine.mp) || 0
      }

      // Add workers if staked
      if (slotData.workers && Array.isArray(slotData.workers)) {
        slotData.workers.forEach(worker => {
          assets.push({
            asset_id: worker.asset_id,
            template_id: worker.template_id,
            name: worker.name,
            mp: worker.mp || 0,
            type: 'worker'
          })
          totalMP += Number(worker.mp) || 0
        })
      }

      const slotSpeedboost =
        slotData.speedboost ||
        (Array.isArray(slotData.speedboosts) && slotData.speedboosts.length > 0
          ? slotData.speedboosts[0]
          : null)

      if (slotSpeedboost && slotSpeedboost.asset_id) {
        const boost = Number(slotSpeedboost.boost ?? (slotSpeedboost.multiplier ? slotSpeedboost.multiplier - 1 : 0)) || 0
        const multiplier = Number(slotSpeedboost.multiplier ?? (1 + boost)) || (1 + boost)

        speedboost = {
          asset_id: slotSpeedboost.asset_id,
          template_id: slotSpeedboost.template_id,
          name: slotSpeedboost.name || `Speedboost ${slotSpeedboost.asset_id}`,
          boost,
          multiplier,
          type: 'speedboost',
          mp: 0
        }

        if (slotSpeedboost.rarity) speedboost.rarity = slotSpeedboost.rarity
        if (slotSpeedboost.template_mint) speedboost.template_mint = slotSpeedboost.template_mint
        if (slotSpeedboost.imagePath) speedboost.imagePath = slotSpeedboost.imagePath

        assets.push({ ...speedboost })
      }
    }
  }

  console.log(`[Mining] Slot ${slotNum} staked assets: ${assets.length} assets, total MP: ${totalMP}, speedboost: ${speedboost ? speedboost.asset_id : 'none'}`)
  return { assets, totalMP, speedboost }
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

// Detect dev environment by project ID
const isDevProject = admin.app().options.projectId === 'tsdm-6896d';
const MINING_DURATION_MS = isDevProject ? 1 * 60 * 1000 : 3 * 60 * 60 * 1000; // 1 min on dev, 3 hours on prod
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

// ---------- Speedboost integration ----------
// Inventory doc path: players/{actor}/inventory/speedboost
// Expected shape per slot:
//   slot1: { rarity: 'Rare', boost: 0.25, template_id: <TBD> }
// One cart per slot; highest rarity logic should be handled by the UI/assignment flow.

// Rarity table kept for reference / validation (template_ids are placeholders)
const SPEEDBOOST_RARITIES = {
  Common:    { boost: 0.0625, template_ids: ['TBD_COMMON'] },
  Uncommon:  { boost: 0.125,  template_ids: ['TBD_UNCOMMON'] },
  Rare:      { boost: 0.25,   template_ids: ['TBD_RARE'] },
  Epic:      { boost: 0.50,   template_ids: ['TBD_EPIC'] },
  Legendary: { boost: 1.00,   template_ids: ['TBD_LEGENDARY'] }, // blend-only
}

// Read the assigned speedboost for a specific slot; return {boost, rarity, template_id}
async function getSpeedboostForSlot(actor, slotNum) {
  try {
    const doc = await db.collection('players').doc(actor)
      .collection('inventory').doc('speedboost').get()
    if (!doc.exists) return { boost: 0, rarity: null, template_id: null }

    const data = doc.data() || {}
    const slotKey = `slot${slotNum}`
    const sb = data[slotKey]

    if (!sb || typeof sb.boost !== 'number') return { boost: 0, rarity: null, template_id: null }

    // optional sanity clamp (e.g., avoid crazy numbers)
    const safeBoost = Math.max(0, Math.min(2, Number(sb.boost) || 0)) // cap 200% just in case
    const rarity = typeof sb.rarity === 'string' ? sb.rarity : null
    const template_id = sb.template_id ?? null
    return { boost: safeBoost, rarity, template_id }
  } catch (e) {
    console.error('[Speedboost] read error', actor, slotNum, e)
    return { boost: 0, rarity: null, template_id: null }
  }
}

// Mining produces one unified rough_gems type
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

// POST /startMining { actor, slotNum? }
const startMining = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
    const actor = requireActor(req, res); if (!actor) return

    try {
      await ensureSeasonActiveOrThrow()

      const { active } = refs(actor)
      const requestedSlotNum = req.body?.slotNum

      // Existing jobs → decide slots
      const snap = await active.get()
      const existingJobs = snap.docs.map(d => d.data())

      const slots = await getEffectiveMiningSlots(actor)
      const activeCount = existingJobs.length
      if (activeCount >= slots) return res.status(400).json({ error: 'no available mining slots' })

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

      // Get staked assets (including current speedboost) and validate ownership
      const {
        assets: stakedAssets,
        totalMP: slotMiningPower,
        speedboost: slotSpeedboost
      } = await getStakedAssetsForSlot(actor, slotNum)

      // Check if mine is staked (required for mining)
      const hasMine = stakedAssets.some(a => a.type === 'mine')
      if (!hasMine) {
        return res.status(400).json({ error: 'No mine staked in this slot. Please stake a mine first.' })
      }

      // Check if any workers are staked (required for mining)
      const workerCount = stakedAssets.filter(a => a.type === 'worker').length
      if (workerCount === 0) {
        return res.status(400).json({ error: 'No workers staked in this slot. Please stake at least one worker.' })
      }

      // Validate ownership of all staked assets
      // Error format: { error: "ownership_missing: AssetName (template 123, mint #456); ...", details: [{asset_id, template_id, template_mint, type, name}] }
      const assetIds = stakedAssets.map(a => a.asset_id)
      const ownershipValidation = await validateOwnership(actor, assetIds)

      if (!ownershipValidation.valid && !ownershipValidation.apiError) {
        // Get full asset details including template_mint for missing assets
        const missingDetails = []
        for (const missing of ownershipValidation.missingAssets) {
          const stakedAsset = stakedAssets.find(a => a.asset_id === missing.asset_id)
          if (stakedAsset) {
            missingDetails.push({
              asset_id: stakedAsset.asset_id,
              template_id: stakedAsset.template_id,
              template_mint: 'unknown', // Will be filled from AtomicAssets data if available
              type: stakedAsset.type,
              name: stakedAsset.name
            })
          }
        }

        // Try to get template_mint from owned assets that match template_id
        for (const detail of missingDetails) {
          const ownedAsset = ownershipValidation.ownedAssets.find(a =>
            a.template?.template_id === detail.template_id ||
            a.template_id === detail.template_id
          )
          if (ownedAsset && ownedAsset.template_mint) {
            detail.template_mint = ownedAsset.template_mint
          }
        }

        const missingList = missingDetails.map(d =>
          `${d.name} (template ${d.template_id}, mint #${d.template_mint})`
        ).join('; ')

        return res.status(400).json({
          error: `ownership_missing: ${missingList}`,
          details: missingDetails
        })
      }

      if (ownershipValidation.apiError) {
        console.warn(`[startMining] ⚠️ Starting mining without ownership validation (API error) for slot ${slotNum}`)
      }

      const now = Date.now()
      const jobId = `job_${now}_${Math.floor(Math.random()*1e6)}`
      const slotId = `slot_${slotNum}`
      const boostPct = slotSpeedboost ? Number(slotSpeedboost.boost || 0) : 0
      const speedMultiplier = boostPct > 0 ? (slotSpeedboost?.multiplier || (1 + boostPct)) : 1
      const effectiveDurationMs = Math.max(1, Math.round(MINING_DURATION_MS / speedMultiplier))
      const finishAt = now + effectiveDurationMs
      console.log(`[startMining] Slot ${slotNum} speedboost ${boostPct * 100}% -> effective duration ${effectiveDurationMs}ms (base ${MINING_DURATION_MS}ms)`)

      // Create assets snapshot for ownership validation at completion
      // assetsSnapshot: [{asset_id, template_id, template_mint, name, mp, type}] - used in completeMining to verify continued ownership
      const assetsSnapshot = stakedAssets.map(asset => ({
        asset_id: asset.asset_id,
        template_id: asset.template_id,
        template_mint: 'unknown', // Will be filled from AtomicAssets data
        name: asset.name,
        mp: asset.mp,
        type: asset.type
      }))

      // Try to fill template_mint from owned assets data
      for (const snapshotAsset of assetsSnapshot) {
        const ownedAsset = ownershipValidation.ownedAssets.find(a =>
          a.asset_id === snapshotAsset.asset_id
        )
        if (ownedAsset && ownedAsset.template_mint) {
          snapshotAsset.template_mint = ownedAsset.template_mint
        }
      }

      await active.doc(jobId).set({
        jobId,
        slotId,
        slotNum,
        actor,
        startedAt: now,
        finishAt,
        status: 'active',
        costTsdm: MINING_COST_TSDM,
        slotMiningPower,
        assetsSnapshot, // Snapshot for ownership validation at completion
        baseDurationMs: MINING_DURATION_MS,
        effectiveDurationMs,
        slotSpeedBoostPct: boostPct,
        slotSpeedBoostMultiplier: speedMultiplier,
        slotSpeedBoostAssetId: slotSpeedboost?.asset_id || null,
        speedboostPreview: slotSpeedboost
          ? {
              asset_id: slotSpeedboost.asset_id,
              template_id: slotSpeedboost.template_id ?? null,
              template_mint: slotSpeedboost.template_mint ?? null,
              boost: boostPct,
              multiplier: speedMultiplier,
              rarity: slotSpeedboost.rarity ?? null
            }
          : null
      })
      res.json({
        ok: true,
        jobId,
        slotId,
        slotNum,
        finishAt,
        slotMiningPower,
        baseDurationMs: MINING_DURATION_MS,
        effectiveDurationMs,
        slotSpeedBoostPct: boostPct,
        slotSpeedBoostMultiplier: speedMultiplier,
        slotSpeedBoostAssetId: slotSpeedboost?.asset_id || null,
        speedboostPreview: slotSpeedboost
      })
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: 'season-locked' })
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
      await ensureSeasonActiveOrThrow()

      const { active, history, gems } = refs(actor)
      const jobRef = active.doc(jobId)
      const snap = await jobRef.get()
      if (!snap.exists) return res.status(404).json({ error: 'job not found' })
      const job = snap.data()
      const now = Date.now()
      if (now < job.finishAt) return res.status(400).json({ error: 'job still in progress' })

      // Validate ownership of assets that were staked at start time
      // If assets are no longer owned, deduct their MP from rewards
      let effectiveMP = Number(job.slotMiningPower) || 0
      let deductedMP = 0
      const missingAssets = []
      const ownedAssets = []

      if (job.assetsSnapshot && Array.isArray(job.assetsSnapshot)) {
        const assetIds = job.assetsSnapshot.map(a => a.asset_id)
        const ownershipValidation = await validateOwnership(actor, assetIds)

        if (!ownershipValidation.valid && !ownershipValidation.apiError) {
          // Calculate effective MP by subtracting MP from missing assets
          const ownedAssetIds = new Set(ownershipValidation.ownedAssets.map(a => a.asset_id))

          for (const snapshotAsset of job.assetsSnapshot) {
            if (!ownedAssetIds.has(snapshotAsset.asset_id)) {
              // Asset is no longer owned - deduct its MP
              const mpToDeduct = Number(snapshotAsset.mp) || 0
              deductedMP += mpToDeduct
              missingAssets.push({
                asset_id: snapshotAsset.asset_id,
                template_id: snapshotAsset.template_id,
                template_mint: snapshotAsset.template_mint,
                type: snapshotAsset.type,
                name: snapshotAsset.name,
                mp: mpToDeduct
              })
            } else {
              ownedAssets.push(snapshotAsset)
            }
          }

          effectiveMP = Math.max(0, effectiveMP - deductedMP)
          console.log(`[completeMining] Ownership validation: deducted ${deductedMP} MP from ${missingAssets.length} missing assets, effective MP: ${effectiveMP}`)
        } else if (ownershipValidation.apiError) {
          console.warn(`[completeMining] ⚠️ Completing mining without ownership validation (API error) for job ${jobId}`)
        }
      }

      // base reward: effective MP / 20, minimum 1
      const baseYield = Math.max(1, Math.floor(effectiveMP / 20))

      // Determine speedboost effect captured at job start, fallback to current slot assignment
      let boostPct = typeof job.slotSpeedBoostPct === 'number' ? job.slotSpeedBoostPct : null
      let boostMultiplier = typeof job.slotSpeedBoostMultiplier === 'number' ? job.slotSpeedBoostMultiplier : null
      let boostMeta = job.speedboostPreview || null

      if (boostPct === null || boostMultiplier === null) {
        const sbSnapshot = await getSpeedboostForSlot(actor, job.slotNum)
        boostPct = typeof sbSnapshot.boost === 'number' ? sbSnapshot.boost : 0
        boostMultiplier = 1 + (boostPct || 0)
        boostMeta = {
          boost: boostPct,
          multiplier: boostMultiplier,
          rarity: sbSnapshot.rarity || null,
          template_id: sbSnapshot.template_id || null
        }
      }

      // Ensure sane defaults
      boostPct = Number.isFinite(boostPct) ? boostPct : 0
      boostMultiplier = Number.isFinite(boostMultiplier) && boostMultiplier > 0 ? boostMultiplier : (1 + boostPct)

      const amt = Math.max(1, Math.floor(baseYield * boostMultiplier))

      const key = 'rough_gems'

      await db.runTransaction(async (tx) => {
        const gSnap = await tx.get(gems)
        const cur = gSnap.exists ? (gSnap.data() || {}) : {}
        const have = Number(cur[key] || 0)
        tx.set(gems, { ...cur, [key]: have + amt }, { merge: true })
        // Save completion data to history
        // New fields: effectiveMiningPower, ownershipAtCompletion: {missingAssets[], ownedAssets[], deductedMp, effectiveMp}
        tx.set(history.doc(jobId), {
          ...job,
          status: 'done',
          completedAt: now,
          roughKey: key,
          baseYield,
          yieldAmt: amt,
          slotMiningPower: job.slotMiningPower || 0,
          effectiveMiningPower: effectiveMP,
          ownershipAtCompletion: {
            missingAssets,  // Assets no longer owned at completion
            ownedAssets,    // Assets still owned at completion
            deductedMp: deductedMP,    // Total MP deducted from missing assets
            effectiveMp: effectiveMP   // MP used for reward calculation
          },
          speedboostApplied: {
            boost: boostPct,
            multiplier: boostMultiplier,
            rarity: boostMeta?.rarity ?? null,
            template_id: boostMeta?.template_id ?? null,
            asset_id: boostMeta?.asset_id ?? job.slotSpeedBoostAssetId ?? null
          }
        })
        tx.delete(jobRef)
      })

      // Response format includes new ownership validation fields
      res.json({
        ok: true,
        result: {
          roughKey: key,
          baseYield,
          yieldAmt: amt,
          multiplier: boostMultiplier,
          completedAt: now,
          slotMiningPower: job.slotMiningPower || 0,          // Original MP from staking
          effectiveMiningPower: effectiveMP, // MP after ownership validation
          ownershipAtCompletion: {          // Ownership check results
            missingAssets,  // [{asset_id, template_id, template_mint, type, name, mp}]
            ownedAssets,    // [{asset_id, template_id, template_mint, type, name, mp}]
            deductedMp: deductedMP,    // Total MP removed due to missing assets
            effectiveMp: effectiveMP   // Final MP used for rewards
          },
          speedboost: {
            boost: boostPct,
            multiplier: boostMultiplier,
            rarity: boostMeta?.rarity ?? null,
            template_id: boostMeta?.template_id ?? null,
            asset_id: boostMeta?.asset_id ?? job.slotSpeedBoostAssetId ?? null
          }
        }
      })
    } catch (e) {
      if (e.status === 403) return res.status(403).json({ error: 'season-locked' })
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
      const { root, pendingPayments } = refs(actor)
      const snap = await root.get()
      if (!snap.exists) return res.status(404).json({ error: 'player not found' })

      const profile = snap.data() || {}
      const currentSlots = Number(profile.miningSlotsUnlocked || 0)
      if (currentSlots >= MAX_SLOTS) return res.status(400).json({ error: 'maximum slots already unlocked' })

      const nextSlotToUnlock = currentSlots + 1
      if (targetSlot !== nextSlotToUnlock) {
        return res.status(400).json({ error: `Please unlock slots in order. Next available slot is ${nextSlotToUnlock}` })
      }

      const unlockCost = SLOT_UNLOCK_COSTS[targetSlot - 1] || 0
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

      res.json({ ok: true, paymentId, unlockCost, slotNumber: targetSlot, message: 'Payment request created. Please complete payment to unlock slot.' })
    } catch (e) {
      console.error('[unlockMiningSlot]', e)
      res.status(500).json({ error: e.message })
    }
  })
)

// POST /validateOwnership { actor, assetIds: string[] }
// Returns { valid: boolean, ownedAssets: Asset[], apiError?: boolean }
const validateOwnershipEndpoint = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
    const actor = requireActor(req, res); if (!actor) return
    const assetIds = req.body?.assetIds
    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return res.status(400).json({ error: 'assetIds array required' })
    }

    try {
      const validation = await validateOwnership(actor, assetIds)
      res.json(validation)
    } catch (error) {
      console.error('[validateOwnership]', error)
      res.status(500).json({ error: error.message, apiError: true })
    }
  })
)

// (Optional) Helper for UI: GET /getSpeedboost?actor=...
const getSpeedboost = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
    const actor = requireActor(req, res); if (!actor) return
    try {
      const doc = await db.collection('players').doc(actor)
        .collection('inventory').doc('speedboost').get()
      res.json({ ok: true, data: doc.exists ? (doc.data() || {}) : {} })
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  })
)

module.exports = {
  startMining,
  getActiveMining,
  completeMining,
  unlockMiningSlot,
  validateOwnershipEndpoint,
  getSpeedboost,          // optional UI helper
  // exported for possible external reference
  SPEEDBOOST_RARITIES,
  getSpeedboostForSlot
}

