// web/api.js
export const API_BASE = 'https://us-central1-tsdgems-trading.cloudfunctions.net'; // exact projectId

export async function apiInitPlayer(actor) {
  const r = await fetch(`${API_BASE}/initPlayer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor })
  });
    if (!r.ok) throw new Error(`initPlayer ${r.status}`)
  return r.json();
}

export async function apiGetDashboard(actor) {
  const u = new URL(`${API_BASE}/getDashboard`);
  u.searchParams.set('actor', actor);
  const r = await fetch(u);
  return r.json();
}
export async function apiGetCityMatrix() {
  const r = await fetch(`${API_BASE}/getCityMatrix`);
  return r.ok ? r.json() : { cities: [], boosts: [] };
}


// --- at the very bottom of api.js ---

const fmt = (n, maxFrac = 6) =>
  Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: maxFrac });

window.hydrateBackend = async function hydrateBackend(actor) {
  try {
    // make sure the player doc exists/updated
    await apiInitPlayer(actor);

    // fetch latest profile snapshot
    const dash = await apiGetDashboard(actor);
    const profile = dash?.profile || {};
    const balances = profile.balances || {};

    // 1) Navbar "Game $: <amount>"
    const navEl = document.getElementById('header-game-dollars');
    if (navEl && profile.ingameCurrency != null) {
      navEl.textContent = `Game $: ${fmt(profile.ingameCurrency, 0)}`;
    }

    // 2) Dashboard tile "Ingame $" (#tsd-balance)
    const tsdTile = document.getElementById('tsd-balance');
    if (tsdTile && profile.ingameCurrency != null) {
      tsdTile.textContent = fmt(profile.ingameCurrency, 0);
    }

    // 3) Dashboard tile "TSDM Balance" (#tsdm-balance)
    //    (field is balances.TSDM in Firestore, but accept lower-case just in case)
    const tsdmVal = balances.TSDM ?? balances.tsdm ?? 0;
    const tsdmTile = document.getElementById('tsdm-balance');
    if (tsdmTile) {
      tsdmTile.textContent = fmt(tsdmVal, 6);
    }

    // keep a copy available for anything else
    window.PLAYER_PROFILE = profile;
  } catch (e) {
    console.warn('hydrateBackend failed:', e);
  }
};


