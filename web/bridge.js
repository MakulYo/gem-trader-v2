// bridge.js
import { apiGetDashboard, apiGetCityMatrix } from './api.js';

window.GT_BACKEND = { ready: false, source: 'local' };
window.CITY_LIST = [];
window.CITY_BOOSTS = {};
window.PLAYER_PROFILE = null;

window.getCityBoost = function(cityId, gemKey, fallback = 0) {
  const byCity = window.CITY_BOOSTS[cityId];
  if (!byCity) return fallback;
  const v = byCity[gemKey];
  return typeof v === 'number' ? v : fallback;
};

export async function hydrateBackend(actor) {
  try {
    const [dash, matrix] = await Promise.all([
      apiGetDashboard(actor),
      apiGetCityMatrix()
    ]);

    window.PLAYER_PROFILE = dash.profile || {};
    window.CITY_LIST = matrix.cities || [];
    window.CITY_BOOSTS = {};
    for (const b of (matrix.boosts || [])) window.CITY_BOOSTS[b.id] = b.bonuses || {};

    window.GT_BACKEND = { ready: true, source: 'remote', at: Date.now() };
    window.dispatchEvent(new CustomEvent('backend:ready', {
      detail: { player: window.PLAYER_PROFILE, cities: window.CITY_LIST }
    }));
    console.log('[Bridge] Backend data loaded.');
  } catch (e) {
    console.warn('[Bridge] Backend unavailable, using local fallbacks', e);
  }
}
// Make it callable from non-module script.js:
window.hydrateBackend = hydrateBackend;
// (Optional, handy for debugging from console)
window.apiGetDashboard = apiGetDashboard;