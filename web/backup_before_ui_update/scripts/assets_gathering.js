// =============================================================================
//                       NFT ASSETS GATHERING TOOL
//
// This script retrieves NFT assets from the "tsdmediagems" collection for a
// specified wallet address, processes the information, displays a summary
// with template counts, and saves all data to a JSON file.
//
// Features:
// - Fetches all NFTs from AtomicAssets API with fallback endpoints
// - Groups assets by template ID and counts occurrences
// - Displays formatted console output with template summary
// - Saves complete data to wallet-specific JSON file
// =============================================================================

// --- CONFIGURATION ---
const UPDATE_INTERVAL_MINUTES = 10; // Update interval in minutes (0 = run once)
const MAX_ASSETS_TO_DISPLAY = Infinity;   // Number of NFTs to display (Infinity = all)
const TARGET_WALLET = process.env.TSD_WALLET?.trim() || 'meltinthesun'; // Target wallet address
const TARGET_COLLECTION = 'tsdmediagems';
const ATOMIC_ENDPOINTS = [
  'https://aa-api-wax.eosauthority.com/atomicassets/v1',
  'https://wax.api.atomicassets.io/atomicassets/v1',
  'https://atomic-wax-mainnet.wecan.dev/atomicassets/v1',
  'https://atomic.eosn.io/atomicassets/v1',
  'https://atomic.waxsweden.org/atomicassets/v1',
];
const ATOMIC_LIMIT_OPTIONS = [1000, 500, 100];
// --- END CONFIGURATION ---

/**
 * Normalizes an asset object by extracting relevant data and cleaning schema names.
 * Removes numeric characters from schema names for cleaner display.
 * @param {Object} asset - Raw asset data from AtomicAssets API
 * @returns {Object} Normalized asset object with cleaned data
 */
function normalizeAsset(asset) {
  return {
    asset_id: asset.asset_id,
    name: asset.name || asset.data?.name || 'Unknown',
    schema: (asset.schema?.schema_name || 'n/a').replace(/\d+/g, ''),
    template_id: asset.template?.template_id || '-',
    owner: asset.owner,
    img: asset.data?.img || null,
  };
}

/**
 * Formats strings for aligned console table display.
 * Automatically adjusts column width to accommodate content without truncation.
 * @param {string|number} value - Value to format
 * @param {number} width - Minimum column width
 * @param {'left'|'right'} align - Text alignment
 * @returns {string} Formatted string with proper padding
 */
function pad(value, width, align = 'left') {
  const str = String(value ?? '');
  const targetWidth = Math.max(width, str.length);
  return align === 'right'
    ? str.padStart(targetWidth)
    : str.padEnd(targetWidth);
}

/**
 * Removes duplicate assets based on asset_id to prevent data inconsistencies.
 * Logs warnings when duplicates are found and merged.
 * @param {Array<Object>} assets - Array of asset objects
 * @param {string} label - Context label for logging
 * @returns {Array<Object>} Array of unique assets
 */
function uniqueAssetsById(assets, label) {
  const assetMap = new Map();
  let duplicates = 0;

  for (const asset of assets) {
    if (!asset || asset.asset_id === undefined || asset.asset_id === null) {
      continue;
    }

    const id = String(asset.asset_id);
    const existing = assetMap.get(id);

    if (existing) {
      duplicates += 1;
      // Merge properties, keeping the most complete data
      Object.assign(existing, asset);
    } else {
      assetMap.set(id, { ...asset });
    }
  }

  if (duplicates) {
    console.warn(`${label}: ${duplicates} duplicate asset_id(s) removed.`);
  }

  return Array.from(assetMap.values());
}

/**
 * Executes API requests with automatic fallback to different endpoints and limits.
 * Tries each endpoint with decreasing limit values until a request succeeds.
 * @param {Function} requestFn - Function that performs the actual API request
 * @param {string} contextLabel - Label for error logging context
 * @returns {Promise<any>} Result from the successful API request
 */
async function withAtomicFallback(requestFn, contextLabel) {
  for (const endpoint of ATOMIC_ENDPOINTS) {
    for (const limit of ATOMIC_LIMIT_OPTIONS) {
      try {
        return await requestFn(endpoint, limit);
      } catch (error) {
        console.warn(`${contextLabel}: Error with ${endpoint} (limit=${limit}) -> ${error.message}`);
      }
    }
  }
  throw new Error(`${contextLabel}: All AtomicAssets endpoints failed.`);
}

/**
 * Fetches all NFT assets owned by the specified wallet from the target collection.
 * Uses pagination to retrieve all assets across multiple API calls.
 * @param {string} wallet - Wallet address to fetch assets for
 * @returns {Promise<Array<Object>>} Array of normalized asset objects
 */
async function fetchInventoryAssets(wallet) {
  console.log(`Loading inventory assets for ${wallet}...`);

  return withAtomicFallback(async (endpoint, limit) => {
    let page = 1;
    const assets = [];

    while (true) {
      const params = new URLSearchParams({
        owner: wallet,
        collection_name: TARGET_COLLECTION,
        limit: limit.toString(),
        page: page.toString(),
        order: 'desc',
        sort: 'created'
      });

      const response = await fetch(`${endpoint}/assets?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`AtomicAssets API Error: ${response.status} ${response.statusText}`);
      }

      const payload = await response.json();
      const items = payload?.data || [];
      if (!items.length) {
        break;
      }

      for (const item of items) {
        assets.push(normalizeAsset(item));
      }

      if (items.length < limit) {
        break;
      }

      page += 1;
    }

    console.log(`Found inventory NFTs: ${assets.length}`);
    return uniqueAssetsById(assets, 'Inventory Query');
  }, 'Inventory Query');
}

/**
 * Processes assets and groups them by template ID for counting and analysis.
 * Creates template statistics and sorts assets by asset_id for consistent display.
 * @param {Array<Object>} assets - Array of asset objects to process
 * @returns {{ assets: Array<Object>, counts: { total: number }, templateCounts: Object }}
 */
function processAssets(assets) {
  const templateCounts = {};

  for (const asset of assets) {
    // Count template types
    const templateKey = `${asset.template_id}_${asset.name}`;
    if (!templateCounts[templateKey]) {
      templateCounts[templateKey] = {
        template_id: asset.template_id,
        name: asset.name,
        schema: asset.schema,
        count: 0
      };
    }
    templateCounts[templateKey].count += 1;
  }

  const sortedAssets = assets.sort((a, b) => {
    try {
      const aId = BigInt(a.asset_id);
      const bId = BigInt(b.asset_id);
      if (aId < bId) return -1;
      if (aId > bId) return 1;
      return 0;
    } catch {
      return String(a.asset_id).localeCompare(String(b.asset_id));
    }
  });

  return {
    assets: sortedAssets,
    counts: {
      total: assets.length,
    },
    templateCounts,
  };
}

/**
 * Formats asset data for console display in a table format.
 * Creates aligned columns with asset details for easy reading.
 * @param {Array<Object>} assets - Array of asset objects to display
 * @returns {string} Formatted table string for console output
 */
function formatAssetsForConsole(assets) {
  if (!assets.length) {
    return 'No NFTs found for the configured wallet.';
  }

  const colWidths = {
    index: 4,
    assetId: 20,
    name: 32,
    schema: 18,
    templateId: 12,
  };

  const header =
    pad('#', colWidths.index, 'right') +
    pad('Asset ID', colWidths.assetId) +
    pad('Name', colWidths.name) +
    pad('Schema', colWidths.schema) +
    pad('Template', colWidths.templateId);

  const rows = assets
    .map((asset, index) =>
      pad(index + 1, colWidths.index, 'right') +
      pad(asset.asset_id, colWidths.assetId) +
      pad(asset.name, colWidths.name) +
      pad(asset.schema, colWidths.schema) +
      pad(asset.template_id, colWidths.templateId)
    );

  const lines = [
    `NFT Overview for ${TARGET_COLLECTION} (${assets.length} of ${assets.length})`,
    '',
    header,
    ...rows,
  ];

  return lines.join('\n');
}

/**
 * Saves complete asset data to a JSON file named after the wallet address.
 * Creates structured data with summary statistics and template counts.
 * @param {Object} data - Data object containing assets, counts, and template statistics
 */
async function saveToJsonFile(data) {
  try {
    const fs = await import('fs/promises');
    const filename = `${TARGET_WALLET}.json`;
    
    const outputData = {
      timestamp: new Date().toISOString(),
      wallet: TARGET_WALLET,
      collection: TARGET_COLLECTION,
      summary: {
        total_nfts: data.counts.total,
        unique_templates: Object.keys(data.templateCounts).length
      },
      template_counts: data.templateCounts,
      all_assets: data.assets
    };
    
    await fs.writeFile(filename, JSON.stringify(outputData, null, 2));
    console.log(`\n📁 Data saved to: ${filename}`);
  } catch (error) {
    console.error('Error saving JSON file:', error);
  }
}

/**
 * Main execution function that orchestrates the entire asset gathering process.
 * Fetches assets, processes them, displays results, and saves to JSON file.
 */
async function runUpdate() {
  console.log(`\n--- Starting new scan (${new Date().toLocaleTimeString()}) ---`);
  console.log(`Target wallet: ${TARGET_WALLET}`);

  const inventoryAssets = await fetchInventoryAssets(TARGET_WALLET);

  const { assets, counts, templateCounts } = processAssets(inventoryAssets);

  console.log(`Total NFTs: ${counts.total}`);
  console.log(`Unique templates: ${Object.keys(templateCounts).length}`);

  if (!counts.total) {
    console.log('No data to display.');
    return;
  }

  // Display template summary
  console.log('\n📊 Template Summary:');
  console.log('Template-ID | Name | Schema | Count');
  console.log('-'.repeat(50));
  
  Object.values(templateCounts)
    .sort((a, b) => b.count - a.count)
    .forEach(template => {
      console.log(`${template.template_id.padEnd(12)} | ${template.name.padEnd(20)} | ${template.schema.padEnd(8)} | ${template.count}`);
    });

  console.log('\n' + '='.repeat(80));
  console.log(formatAssetsForConsole(assets));
  console.log('='.repeat(80));

  if (assets.length > MAX_ASSETS_TO_DISPLAY) {
    console.log(`Additional ${assets.length - MAX_ASSETS_TO_DISPLAY} NFTs not displayed (increase MAX_ASSETS_TO_DISPLAY if needed).`);
  }

  // Save complete data to JSON
  await saveToJsonFile({ assets, counts, templateCounts });
}

// --- SCRIPT START ---
console.log('NFT Assets Gathering Tool starting...');
console.log(`Update interval: ${UPDATE_INTERVAL_MINUTES} minutes`);
console.log(`Target wallet: ${TARGET_WALLET}`);
console.log(`Collection: ${TARGET_COLLECTION}`);
console.log('Press Ctrl+C to stop the tool\n');

runUpdate();

if (UPDATE_INTERVAL_MINUTES > 0) {
  setInterval(runUpdate, UPDATE_INTERVAL_MINUTES * 60 * 1000);
}
