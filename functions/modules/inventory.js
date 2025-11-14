// functions/modules/inventory.js
// Pull player NFTs from AtomicAssets (WAX), count polished vs rough gems,
// cache summary in Firestore, and expose endpoints.
//
// Node 20+, Functions v2, CommonJS.

const { onRequest }   = require('firebase-functions/v2/https')
const admin           = require('firebase-admin')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')
const corsLib         = require('cors')

// Node 20+ has native fetch
const fetch = globalThis.fetch || require('node-fetch')

const db = getFirestore();

// --- CORS allowlist (optional; otherwise true = allow all same-origin hosting) ---
const RAW_ALLOW  = process.env.CORS_ALLOW || ''
const ALLOWLIST  = RAW_ALLOW.split(',').map(s => s.trim()).filter(Boolean)
const cors       = corsLib({ origin: ALLOWLIST.length ? ALLOWLIST : true, credentials: false })

// --- AtomicAssets (public API) with fallbacks ---
const ATOMIC_APIS = [
  'https://wax.api.atomicassets.io/atomicassets/v1',
  'https://aa-api-wax.eosauthority.com/atomicassets/v1',
  'https://atomic-wax-mainnet.wecan.dev/atomicassets/v1',
  'https://atomic.eosn.io/atomicassets/v1',
  'https://atomic.waxsweden.org/atomicassets/v1',
]
const AA_BASE = process.env.ATOMIC_API || ATOMIC_APIS[0]

// --- Collection & templates mapping ---
const COLLECTION = 'tsdmediagems'

// Polished gem templates
const TEMPLATES_POLISHED = new Set([
  894387, 894388, 894389, 894390, 894391,
  894392, 894393, 894394, 894395, 894396,
])

// Rough gem templates
const TEMPLATES_ROUGH = new Set([
  894397, 894398, 894399, 894400, 894401,
  894402, 894403, 894404, 894405, 894406,
])

// Equipment categories (for counts/slots)
const WORKER_IDS = new Set([ 894928, 894929, 894930, 894931, 894932 ]) // Pickaxe..Dump Truck
const MINE_IDS   = new Set([ 894933, 894934, 894935 ])                  // Small/Medium/Large Mine
const TABLE_ID   = 896279                                               // Polishing Table

// Template details with images for polished gems
const TEMPLATES_POLISHED_DETAILS = new Map([
  [894387, { name: 'Diamond',     image: '(1).png',  imagePath: 'assets/gallery_images/(1).png' }],
  [894388, { name: 'Ruby',        image: '(2).png',  imagePath: 'assets/gallery_images/(2).png' }],
  [894389, { name: 'Sapphire',    image: '(3).png',  imagePath: 'assets/gallery_images/(3).png' }],
  [894390, { name: 'Emerald',     image: '(4).png',  imagePath: 'assets/gallery_images/(4).png' }],
  [894391, { name: 'Jade',        image: '(5).png',  imagePath: 'assets/gallery_images/(5).png' }],
  [894392, { name: 'Tanzanite',   image: '(6).png',  imagePath: 'assets/gallery_images/(6).png' }],
  [894393, { name: 'Opal',        image: '(7).png',  imagePath: 'assets/gallery_images/(7).png' }],
  [894394, { name: 'Aquamarine',  image: '(8).png',  imagePath: 'assets/gallery_images/(8).png' }],
  [894395, { name: 'Topaz',       image: '(9).png',  imagePath: 'assets/gallery_images/(9).png' }],
  [894396, { name: 'Amethyst',    image: '(10).png', imagePath: 'assets/gallery_images/(10).png' }],
])

// Template details with images for rough gems
const TEMPLATES_ROUGH_DETAILS = new Map([
  [894397, { name: 'Unpolished Diamond',     image: '(11).png', imagePath: 'assets/gallery_images/(11).png' }],
  [894398, { name: 'Unpolished Ruby',        image: '(12).png', imagePath: 'assets/gallery_images/(12).png' }],
  [894399, { name: 'Unpolished Sapphire',    image: '(13).png', imagePath: 'assets/gallery_images/(13).png' }],
  [894400, { name: 'Unpolished Emerald',     image: '(14).png', imagePath: 'assets/gallery_images/(14).png' }],
  [894401, { name: 'Unpolished Jade',        image: '(15).png', imagePath: 'assets/gallery_images/(15).png' }],
  [894402, { name: 'Unpolished Tanzanite',   image: '(16).png', imagePath: 'assets/gallery_images/(16).png' }],
  [894403, { name: 'Unpolished Opal',        image: '(17).png', imagePath: 'assets/gallery_images/(17).png' }],
  [894404, { name: 'Unpolished Aquamarine',  image: '(18).png', imagePath: 'assets/gallery_images/(18).png' }],
  [894405, { name: 'Unpolished Topaz',       image: '(19).png', imagePath: 'assets/gallery_images/(19).png' }],
  [894406, { name: 'Unpolished Amethyst',    image: '(20).png', imagePath: 'assets/gallery_images/(20).png' }],
])

// Equipment templates with Mining Power (MP) and images
const TEMPLATES_EQUIPMENT = new Map([
  [894928, { name: 'Pickaxe Worker',        mp: 50,    image: '41.png', imagePath: 'assets/gallery_images/41.png' }],
  [894929, { name: 'Hammer Drill Worker',   mp: 110,   image: '42.png', imagePath: 'assets/gallery_images/42.png' }],
  [894930, { name: 'Mini Excavator Worker', mp: 245,   image: '43.jpg', imagePath: 'assets/gallery_images/43.jpg' }],
  [894931, { name: 'Excavator',             mp: 540,   image: '44.png', imagePath: 'assets/gallery_images/44.png' }],
  [894932, { name: 'Dump Truck',            mp: 1190,  image: '45.png', imagePath: 'assets/gallery_images/45.png' }],
  [894933, { name: 'Small Mine',            mp: 2620,  image: '46.png', imagePath: 'assets/gallery_images/46.png' }],
  [894934, { name: 'Medium Mine',           mp: 5765,  image: '47.png', imagePath: 'assets/gallery_images/47.png' }],
  [894935, { name: 'Large Mine',            mp: 12685, image: '48.png', imagePath: 'assets/gallery_images/48.png' }],
  [896279, { name: 'Polishing Table',       mp: 0,     image: 'polishingtable.jpg', imagePath: 'assets/gallery_images/polishingtable.jpg' }],
])

const TEMPLATES_SPEEDBOOST = new Map([
  [901514, { name: 'Rusty Minecart',   boost: 0.0625, image: 'Rusty_Minecart.png',   imagePath: 'assets/images/Rusty_Minecart.png' }],
  [901513, { name: 'Greased Minecart', boost: 0.125,  image: 'Greased_Minecart.png', imagePath: 'assets/images/Greased_Minecart.png' }],
  [901512, { name: 'Refined Minecart', boost: 0.25,   image: 'Refined_Minecart.png', imagePath: 'assets/images/Refined_Minecart.png' }],
  [901510, { name: 'Arcane Minecart',  boost: 0.5,    image: 'Arcane_Minecart.png',  imagePath: 'assets/images/Arcane_Minecart.png' }],
  [901511, { name: 'Golden Express',   boost: 1.0,    image: 'Golden_Express.png',   imagePath: 'assets/images/Golden_Express.png' }],
])

// --- Helpers ---
function requireActor(req, res) {
  const actor = (req.method === 'GET' ? req.query.actor : req.body?.actor) || ''
  if (!actor || typeof actor !== 'string') {
    res.status(400).json({ error: 'actor required' })
    return null
  }
  return actor
}

// Fetch with fallback APIs
async function fetchWithFallback(url, options) {
  const errors = []
  for (let i = 0; i < ATOMIC_APIS.length; i++) {
    const apiBase = ATOMIC_APIS[i]
    const fullUrl = url.replace(ATOMIC_APIS[0], apiBase)
    try {
      console.log(`[Inventory] Trying API ${i + 1}/${ATOMIC_APIS.length}: ${apiBase}`)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000) // 30s
      const response = await fetch(fullUrl, { ...options, signal: controller.signal })
      clearTimeout(timeout)
      if (response.ok) {
        console.log(`[Inventory] ✅ Success with API: ${apiBase}`)
        return response
      }
      const statusText = await response.text().catch(() => response.statusText)
      console.warn(`[Inventory] API ${i + 1} returned ${response.status}: ${statusText}`)
      errors.push(`${apiBase}: ${response.status}`)
    } catch (error) {
      console.warn(`[Inventory] API ${i + 1} failed:`, error.message)
      errors.push(`${apiBase}: ${error.message}`)
    }
  }
  console.error(`[Inventory] ❌ All ${ATOMIC_APIS.length} APIs failed:`, errors)
  throw new Error(`All AtomicAssets APIs failed: ${errors.join('; ')}`)
}

// Fetch ALL assets for owner (paginate); optionally filtered by collection.
async function fetchAllAssetsForOwner(owner, collection = COLLECTION) {
  const limit = 100
  let page = 1
  let all = []

  console.log(`[Inventory] Fetching assets for owner: ${owner}, collection: ${collection}`)

  while (true) {
    const url = new URL(`${ATOMIC_APIS[0]}/assets`)
    url.searchParams.set('owner', owner)
    if (collection) url.searchParams.set('collection_name', collection)
    url.searchParams.set('page', String(page))
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('order', 'asc')
    url.searchParams.set('sort', 'asset_id')

    console.log(`[Inventory] Fetching page ${page}...`)

    try {
      const r = await fetchWithFallback(url.toString(), {
        headers: { accept: 'application/json', 'User-Agent': 'TSDGEMS/1.0' }
      })
      const j = await r.json()
      const data = Array.isArray(j?.data) ? j.data : []
      console.log(`[Inventory] Page ${page}: Found ${data.length} assets`)
      all = all.concat(data)
      if (data.length < limit) break
      page++
      if (page > 50) break // safety cap (5k assets)
    } catch (error) {
      console.error(`[Inventory] Fetch error on page ${page}:`, error.message)
      throw error
    }
  }

  console.log(`[Inventory] Total assets fetched: ${all.length}`)
  return all
}

// --- Classification ---
function classifyAssets(assets) {
  let polished = 0
  let rough = 0
  let equipment = 0
  let totalMiningPower = 0
  let speedboosts = 0
  const byTemplate = {}
  const polishedDetails = {}
  const roughDetails = {}
  const equipmentDetails = {}
  const speedboostDetails = {}
  const assetsList = [] // Store individual assets with their IDs

  for (const a of assets) {
    const tid = Number(a.template?.template_id || a.template_id || a.template_id_num || 0)
    if (!tid) continue

    // Skip packs, raffle, and voucher schemas completely
    const schemaName = a.schema?.schema_name || a.schema_name || ''
    if (['packs', 'raffle', 'voucher'].includes(schemaName.toLowerCase())) {
      console.log(`[Inventory] Completely excluding ${schemaName} schema for template ${tid}`)
      continue
    }

    // Extract asset_id and other metadata
    const assetId = a.asset_id || a.id || null
    const assetName = a.name || a.data?.name || ''
    const templateMint = a.template_mint || 'unknown'

    // Count per-template
    byTemplate[tid] = (byTemplate[tid] || 0) + 1

    if (TEMPLATES_POLISHED.has(tid)) {
      polished++

      const info = TEMPLATES_POLISHED_DETAILS.get(tid)
      if (info) {
        if (!polishedDetails[tid]) {
          polishedDetails[tid] = {
            name: info.name,
            image: info.image,
            imagePath: info.imagePath,
            count: 0,
            assets: []
          }
        }
        polishedDetails[tid].count += 1
        if (assetId) polishedDetails[tid].assets.push(assetId)
      }

      assetsList.push({
        asset_id: assetId,
        template_id: tid,
        template_mint: templateMint,
        name: info?.name || assetName,
        schema: 'gems',
        image: info?.image || null,
        imagePath: info?.imagePath || null,
        category: 'polished'
      })

    } else if (TEMPLATES_ROUGH.has(tid)) {
      rough++

      const info = TEMPLATES_ROUGH_DETAILS.get(tid)
      if (info) {
        if (!roughDetails[tid]) {
          roughDetails[tid] = {
            name: info.name,
            image: info.image,
            imagePath: info.imagePath,
            count: 0,
            assets: []
          }
        }
        roughDetails[tid].count += 1
        if (assetId) roughDetails[tid].assets.push(assetId)
      }

      assetsList.push({
        asset_id: assetId,
        template_id: tid,
        template_mint: templateMint,
        name: info?.name || assetName,
        schema: 'gems',
        image: info?.image || null,
        imagePath: info?.imagePath || null,
        category: 'rough'
      })

    } else if (TEMPLATES_EQUIPMENT.has(tid)) {
      equipment++

      const info = TEMPLATES_EQUIPMENT.get(tid)

      // add MP per asset
      totalMiningPower += info.mp

      if (!equipmentDetails[tid]) {
        equipmentDetails[tid] = {
          name: info.name,
          mp: info.mp,
          image: info.image,
          imagePath: info.imagePath,
          count: 0,
          assets: []
        }
      }
      equipmentDetails[tid].count += 1
      if (assetId) equipmentDetails[tid].assets.push(assetId)

      // 🔧 Polishing tables are treated as equipment for compatibility
      const isTable = Number(tid) === TABLE_ID
      const schema = 'equipment'
      const category = isTable ? 'equipment' : 'equipment' // keep simple and compatible

      assetsList.push({
        asset_id: assetId,
        template_id: tid,
        template_mint: templateMint,
        name: info?.name || assetName,
        schema,                // always 'equipment' for workers, mines, tables
        image: info?.image || null,
        imagePath: info?.imagePath || null,
        mp: info.mp,
        category,              // 'equipment'
        type: isTable ? 'table' : 'equipment',
        isPolishingTable: isTable
      })

    } else if (TEMPLATES_SPEEDBOOST.has(tid)) {
      // Count speedboosts per asset
      speedboosts++

      const info = TEMPLATES_SPEEDBOOST.get(tid)
      if (!speedboostDetails[tid]) {
        speedboostDetails[tid] = {
          name: info.name,
          boost: info.boost,
          image: info.image,
          imagePath: info.imagePath,
          count: 0,
          assets: []
        }
      }
      speedboostDetails[tid].count += 1
      if (assetId) speedboostDetails[tid].assets.push(assetId)

      assetsList.push({
        asset_id: assetId,
        template_id: tid,
        template_mint: templateMint,
        name: info?.name || assetName,
        schema: 'speedboost',
        image: info?.image || null,
        imagePath: info?.imagePath || null,
        boost: info?.boost || 0,
        category: 'speedboost'
      })
    }
    // else ignore other templates
  }

  // Create templateCounts structure for compatibility with existing API
  const templateCounts = {}
  let total = 0
  let uniqueTemplates = 0

  // polished -> templateCounts
  for (const [tid, details] of Object.entries(polishedDetails)) {
    const key = `${tid}_${details.name}`
    templateCounts[key] = {
      template_id: Number(tid),
      name: details.name,
      schema: 'gems',
      count: details.count,
      total_mining_power: 0,
      image: details.image,
      imagePath: details.imagePath
    }
    total += details.count
    uniqueTemplates++
  }

  // rough -> templateCounts
  for (const [tid, details] of Object.entries(roughDetails)) {
    const key = `${tid}_${details.name}`
    templateCounts[key] = {
      template_id: Number(tid),
      name: details.name,
      schema: 'gems',
      count: details.count,
      total_mining_power: 0,
      image: details.image,
      imagePath: details.imagePath
    }
    total += details.count
    uniqueTemplates++
  }

  // equipment (workers / mines / tables) -> templateCounts
  for (const [tid, details] of Object.entries(equipmentDetails)) {
    const key = `${tid}_${details.name}`
    const totalMp = details.mp * details.count
    const isTable = Number(tid) === TABLE_ID
    const schema = 'equipment' // ✅ always equipment for compatibility

    templateCounts[key] = {
      template_id: Number(tid),
      name: details.name,
      schema,
      count: details.count,
      total_mining_power: totalMp,
      image: details.image,
      imagePath: details.imagePath,
      mp: details.mp,
      type: isTable ? 'table' : 'equipment',
      isPolishingTable: isTable
    }
    total += details.count
    uniqueTemplates++
  }

  // speedboosts -> templateCounts
  for (const [tid, details] of Object.entries(speedboostDetails)) {
    const key = `${tid}_${details.name}`
    templateCounts[key] = {
      template_id: Number(tid),
      name: details.name,
      schema: 'speedboost',
      count: details.count,
      total_mining_power: 0,
      image: details.image,
      imagePath: details.imagePath,
      boost: details.boost
    }
    total += details.count
    uniqueTemplates++
  }

  // --- workers/mines/tables counts and derived slots ---
  let workersCount = 0
  let minesCount = 0
  const tablesCount = byTemplate[TABLE_ID] || 0

  for (const [tidStr, details] of Object.entries(equipmentDetails)) {
    const tid = Number(tidStr)
    const cnt = Number(details.count || 0)
    if (WORKER_IDS.has(tid)) workersCount += cnt
    else if (MINE_IDS.has(tid)) minesCount += cnt
  }

  const minersCount = workersCount + minesCount
  const miningSlots = Math.min(minersCount, 10)
  const polishingTableCount = tablesCount
  const polishingSlots = Math.min(tablesCount, 10)

  console.log(
    `[Inventory] Workers:${workersCount} Mines:${minesCount} Tables:${tablesCount} -> ` +
    `miningSlots:${miningSlots} polishingSlots:${polishingSlots}`
  )
  console.log(`[Inventory] Total individual assets with IDs: ${assetsList.length}`)

  return {
    polished,
    rough,
    equipment,
    speedboosts,
    totalMiningPower,
    total,
    uniqueTemplates,
    byTemplate,
    templateCounts,
    polishedDetails,
    roughDetails,
    equipmentDetails,
    speedboostDetails,
    assets: assetsList,

    // NEW fields / slots
    workersCount,
    minesCount,
    tablesCount,
    minersCount,
    miningSlots,
    polishingTableCount,
    polishingSlots
  }
}

// Persist summary under players/{actor}/inventory_summary
async function writeInventorySummary(actor, summary) {
  const now = Timestamp.now()
  const ref = db.collection('players').doc(actor).collection('meta').doc('inventory_summary')
  await ref.set({
    ...summary,
    updatedAt: now,
    collection: COLLECTION,
    version: 2,
  }, { merge: true })
  return { ok: true, updatedAt: now }
}

// GET /getInventory?actor=xxx   (reads cached if exists; refresh=1 to force refetch)
const getInventory = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
    const actor = requireActor(req, res); if (!actor) return

    console.log(`[getInventory] Request for actor: ${actor}`)

    const force = String(req.query.refresh || '') === '1'
    const ref = db.collection('players').doc(actor).collection('meta').doc('inventory_summary')
    const snap = await ref.get()

    // Load gems from inventory/gems subcollection
    const gemsRef = db.collection('players').doc(actor).collection('inventory').doc('gems');
    const gemsSnap = await gemsRef.get();
    const gemsData = gemsSnap.exists ? gemsSnap.data() : {};

    // Check TTL (2 minutes = 120 seconds) - automatically refresh if cache is stale
    const CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutes
    const now = Date.now()

    if (!force && snap.exists) {
      const cachedData = snap.data();
      const updatedAt = cachedData.updatedAt
      if (updatedAt && typeof updatedAt.toMillis === 'function') {
        const ageMs = now - updatedAt.toMillis()
        if (ageMs < CACHE_TTL_MS) {
          console.log(`[getInventory] Returning fresh cached data for ${actor} (age: ${Math.floor(ageMs / 1000)}s)`)
          // Merge gems data
          return res.json({ ok: true, cached: true, actor, ...cachedData, ...gemsData })
        } else {
          console.log(
            `[getInventory] Cache stale for ${actor} (age: ${Math.floor(ageMs / 1000)}s > ` +
            `${CACHE_TTL_MS / 1000}s), refreshing...`
          )
        }
      } else {
        console.log(`[getInventory] Cache exists but no valid updatedAt for ${actor}, refreshing...`)
      }
    }

    // If force or cache miss → refresh then return
    console.log(`[getInventory] Cache miss or force refresh for ${actor}, fetching from AtomicAssets...`)
    try {
      const assets = await fetchAllAssetsForOwner(actor, COLLECTION)
      const summary = classifyAssets(assets)
      await writeInventorySummary(actor, summary)
      const fresh = await ref.get()
      console.log(`[getInventory] Successfully fetched and cached inventory for ${actor}`)
      // Merge gems data with inventory summary
      return res.json({ ok: true, cached: false, actor, ...fresh.data(), ...gemsData })
    } catch (e) {
      console.error('[getInventory] Refresh failed:', e.message, e.stack)
      if (snap.exists) {
        // fallback to stale cache
        console.log(`[getInventory] Returning stale cache for ${actor}`)
        const staleData = snap.data();
        return res.json({ ok: true, cached: true, stale: true, actor, ...staleData, ...gemsData })
      }
      return res.status(502).json({ error: e.message || 'atomicassets unavailable' })
    }
  })
)

// POST /refreshInventory   { actor }  → pull live + persist
const refreshInventory = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
    const actor = requireActor(req, res); if (!actor) return

    console.log(`[refreshInventory] Request for actor: ${actor}`)

    try {
      const assets = await fetchAllAssetsForOwner(actor, COLLECTION)
      const summary = classifyAssets(assets)
      const result = await writeInventorySummary(actor, summary)
      console.log(`[refreshInventory] Successfully refreshed inventory for ${actor}`)
      console.log(
        `[refreshInventory] Polishing Table count: ${summary.polishingTableCount}, ` +
        `slots: ${summary.polishingSlots}`
      )
      console.log(`[refreshInventory] Summary keys:`, Object.keys(summary))
      res.json({ ok: true, actor, ...summary, updatedAt: result.updatedAt })
    } catch (e) {
      console.error('[refreshInventory] Failed:', e.message, e.stack)
      res.status(502).json({ error: e.message || 'atomicassets error' })
    }
  })
)

module.exports = { getInventory, refreshInventory }