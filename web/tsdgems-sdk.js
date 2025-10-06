// /web/tsdgems-sdk.js
// Use Hosting rewrites so local/prod both work with the same relative paths.

async function jfetch(url, init) {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${init?.method || 'GET'} ${url} -> ${r.status}`);
  return r.json();
}

export async function initPlayer(actor) {
  return jfetch(`/initPlayer`, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ actor })
  });
}

export async function getDashboard(actor) {
  const u = new URL(`/getDashboard`, window.location.origin);
  u.searchParams.set('actor', actor);
  return jfetch(u);
}

export async function getCityMatrix() {
  return jfetch(`/getCityMatrix`);
}

// Emits backend:ready for Toxic to hook into
export async function hydrate(actor) {
  await initPlayer(actor);
  const dash   = await getDashboard(actor);
  const matrix = await getCityMatrix();
  window.dispatchEvent(new CustomEvent('backend:ready', {
    detail: { profile: dash?.profile || null, matrix }
  }));
  return { dash, matrix };
}

export async function getBasePrice() {
  const r = await fetch('/getBasePrice');
  if (!r.ok) throw new Error(`getBasePrice ${r.status}`);
  return r.json();
}

export async function getChart(days = 30) {
  const u = new URL('/getChart', window.location.origin);
  u.searchParams.set('days', String(days));
  const r = await fetch(u);
  if (!r.ok) throw new Error(`getChart ${r.status}`);
  return r.json(); // { days, points:[{t,btcUsd,basePrice}] }
}
