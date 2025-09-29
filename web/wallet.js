// wallet.js (module)

// ---- CDN versions that actually exist ----
const VERSIONS = {
  waxjs: '1.1.3',
  anchor: '3.3.0',
  transport: '3.3.0'
};

// Prefer jsDelivr; Skypack and esm.sh as fallbacks for Anchor
const urls = {
  waxjs: [
    `https://cdn.jsdelivr.net/npm/@waxio/waxjs@${VERSIONS.waxjs}/dist/waxjs.min.js`,
  ],
  anchor: [
    `https://cdn.jsdelivr.net/npm/anchor-link@${VERSIONS.anchor}/dist/anchor-link.min.js`,
    `https://cdn.skypack.dev/anchor-link@${VERSIONS.anchor}`
  ],
  transport: [
    `https://cdn.jsdelivr.net/npm/anchor-link-browser-transport@${VERSIONS.transport}/dist/anchor-link-browser-transport.min.js`,
    `https://cdn.skypack.dev/anchor-link-browser-transport@${VERSIONS.transport}`
  ]
};

// try each url until one loads
async function importWithFallback(list) {
  let lastErr;
  for (const u of list) {
    try {
      return await import(/* @vite-ignore */ u);
    } catch (e) {
      lastErr = e;
      console.warn('[wallet] failed', u, e?.message || e);
    }
  }
  throw lastErr;
}

// ---- Load once, to unique local names ----
const Wax = (await importWithFallback(urls.waxjs)).default;        // class
const Anchor = (await importWithFallback(urls.anchor)).default;    // class
const AnchorTransport = (await importWithFallback(urls.transport)).default;

// expose globally (optional)
window.WaxJS = Wax;
window.AnchorLink = Anchor;
window.AnchorLinkBrowserTransport = AnchorTransport;

console.log('[wallet] libs:', {
  hasWax: !!window.WaxJS,
  hasAnchor: !!window.AnchorLink,
  hasTransport: !!window.AnchorLinkBrowserTransport
});

// ---- (optional) simple connect handler you can call later ----
export async function connectWaxCloud(appName = 'TSDGEMS') {
  const wax = new Wax({ rpcEndpoint: 'https://wax.greymass.com', tryAutoLogin: true, appName });
  // try autologin; if fails, prompt login
  const logged = await wax.isAutoLoginAvailable() || await wax.login();
  return logged ? { account: wax.userAccount, api: wax.api, wax } : null;
}
