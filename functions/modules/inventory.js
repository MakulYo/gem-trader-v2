// functions/modules/inventory.js
// Pull player NFTs from AtomicAssets (WAX), count polished vs rough gems,
// cache summary in Firestore, and expose endpoints.
//
// Node 20+, Functions v2, CommonJS.

const { onRequest }  = require('firebase-functions/v2/https')
const admin          = require('firebase-admin')
const { getFirestore } = require('firebase-admin/firestore')
const corsLib        = require('cors')

const db = getFirestore(undefined, 'tsdgems')

// --- CORS allowlist (optional; otherwise true = allow all same-origin hosting) ---
const RAW_ALLOW  = process.env.CORS_ALLOW || ''
const ALLOWLIST  = RAW_ALLOW.split(',').map(s => s.trim()).filter(Boolean)
const cors       = corsLib({ origin: ALLOWLIST.length ? ALLOWLIST : true, credentials: false })

// --- AtomicAssets (public API) ---
const AA_BASE = process.env.ATOMIC_API || 'https://wax.api.atomicassets.io'

// --- Collection & templates mapping ---
// Use your real collection (you’ve linked to NeftyBlocks under tsdmediagems).
const COLLECTION = 'tsdmediagems'

// IMPORTANT: put your real template IDs here so we can classify “polished” vs “rough” reliably.
// You can extend these arrays anytime without code changes elsewhere.
const TEMPLATES_POLISHED = new Set([
  // polished examples from your links:
  894387, 894388, 894389, 894390, 894391, 894392, 894393, 894394, 894395, 894396,
])
const TEMPLATES_ROUGH = new Set([
  // rough/unpolished examples from your links:
  894397, 894398, 894399, 894400, 894401, 894402, 894403, 894404, 894405, 894406,
])

// If there are more polished/rough templates, just add them above.
// If you prefer schema-based classification, we can switch to checking schema_name.

// --- Helpers ---
function requireActor(req, res) {
  const actor = (req.method === 'GET' ? req.query.actor : req.body?.actor) || ''
  if (!actor || typeof actor !== 'string') {
    res.status(400).json({ error: 'actor required' })
    return null
  }
  return actor
}

// Fetch ALL assets for owner (paginate); optionally filtered by collection.
async function fetchAllAssetsForOwner(owner, collection = COLLECTION) {
  const limit = 100
  let page = 1
  let all = []

  while (true) {
    const url = new URL(`${AA_BASE}/atomicassets/v1/assets`)
    url.searchParams.set('owner', owner)
    if (collection) url.searchParams.set('collection_name', collection)
    url.searchParams.set('page', String(page))
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('order', 'asc')
    url.searchParams.set('sort', 'asset_id')

    const r = await fetch(url, { headers: { accept: 'application/json' } })
    if (!r.ok) throw new Error(`atomicassets ${r.status}`)
    const j = await r.json()
    const data = Array.isArray(j?.data) ? j.data : []
    all = all.concat(data)
    if (data.length < limit) break
    page++
    if (page > 50) break // safety cap (5k assets); raise if needed
  }

  return all
}

function classifyAssets(assets) {
  let polished = 0
  let rough = 0
  const byTemplate = {}

  for (const a of assets) {
    const tid = Number(a.template?.template_id || a.template_id || a.template_id_num || 0)
    if (!tid) continue

    byTemplate[tid] = (byTemplate[tid] || 0) + 1
    if (TEMPLATES_POLISHED.has(tid)) polished++
    else if (TEMPLATES_ROUGH.has(tid)) rough++
    // else: ignore or count as "other" if you want: (byTemplate[-1]++)
  }

  return { polished, rough, byTemplate }
}

// Persist summary under players/{actor}/inventory_summary
async function writeInventorySummary(actor, summary) {
  const now = admin.firestore.Timestamp.now()
  const ref = db.collection('players').doc(actor).collection('meta').doc('inventory_summary')
  await ref.set({
    ...summary,
    updatedAt: now,
    collection: COLLECTION,
    version: 1,
  }, { merge: true })
  return { ok: true, updatedAt: now }
}

// GET /getInventory?actor=xxx   (reads cached if exists; refresh=1 to force refetch)
const getInventory = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })
    const actor = requireActor(req, res); if (!actor) return

    const force = String(req.query.refresh || '') === '1'
    const ref = db.collection('players').doc(actor).collection('meta').doc('inventory_summary')
    const snap = await ref.get()

    if (!force && snap.exists) {
      return res.json({ ok: true, cached: true, actor, ...snap.data() })
    }

    // If force or cache miss → refresh then return
    try {
      const assets = await fetchAllAssetsForOwner(actor, COLLECTION)
      const summary = classifyAssets(assets)
      await writeInventorySummary(actor, summary)
      const fresh = await ref.get()
      return res.json({ ok: true, cached: false, actor, ...fresh.data() })
    } catch (e) {
      console.error('getInventory refresh failed', e)
      if (snap.exists) {
        // fallback to stale cache
        return res.json({ ok: true, cached: true, stale: true, actor, ...snap.data() })
      }
      return res.status(502).json({ error: 'atomicassets unavailable' })
    }
  })
)

// POST /refreshInventory   { actor }  → pull live + persist
const refreshInventory = onRequest((req, res) =>
  cors(req, res, async () => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
    const actor = requireActor(req, res); if (!actor) return

    try {
      const assets = await fetchAllAssetsForOwner(actor, COLLECTION)
      const summary = classifyAssets(assets)
      const result = await writeInventorySummary(actor, summary)
      res.json({ ok: true, actor, ...summary, updatedAt: result.updatedAt })
    } catch (e) {
      console.error('refreshInventory failed', e)
      res.status(502).json({ error: e.message || 'atomicassets error' })
    }
  })
)

module.exports = { getInventory, refreshInventory }
