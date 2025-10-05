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


// --- add at the very bottom of api.js ---
window.hydrateBackend = async function hydrateBackend(actor) {
  try {
    await apiInitPlayer(actor);
    const dash = await apiGetDashboard(actor);

    const el = document.getElementById('header-game-dollars');
    if (el && dash?.profile?.ingameCurrency != null) {
      el.textContent = `Game $: ${dash.profile.ingameCurrency.toLocaleString()}`;
    }
  } catch (e) {
    console.warn('hydrateBackend failed:', e);
  }
};

