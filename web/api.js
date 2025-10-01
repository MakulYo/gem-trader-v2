// web/api.js
export const API_BASE = 'https://us-central1-tsdm-trading.cloudfunctions.net'; // exact projectId

export async function apiInitPlayer(actor) {
  const r = await fetch(`${API_BASE}/initPlayer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor })
  });
  return r.json();
}

export async function apiGetDashboard(actor) {
  const u = new URL(`${API_BASE}/getDashboard`);
  u.searchParams.set('actor', actor);
  const r = await fetch(u);
  return r.json();
}
