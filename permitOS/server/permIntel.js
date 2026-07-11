// ─── Brick PermitOS — Permit Intelligence Module ─────────────────────────────
// Re-exports from the dataCollector engine for backward compatibility.
// The dataCollector is the authoritative source for all market intelligence data.
// Data is sourced from: CBRE market reports, datacenterHawk, Baer Faxt, JLL,
// EPA ECHO database, utility interconnection queues (PJM, ERCOT, CAISO),
// county public records, municipal hearing schedules, and state economic
// development agencies. All data is attributed with source citations.

export {
  getAllMarkets,
  getMarketDetail,
  getProjects,
  getHearings,
  getIntelStats,
  searchIntel,
  refreshAllData,
  getDataSourceStatus,
  fetchFromPublicSource,
} from './dataCollector.js';

export default {
  getAllMarkets: () => import('./dataCollector.js').then(m => m.getAllMarkets()),
  getMarketDetail: (id) => import('./dataCollector.js').then(m => m.getMarketDetail(id)),
  getProjects: (filters) => import('./dataCollector.js').then(m => m.getProjects(filters)),
  getHearings: (filters) => import('./dataCollector.js').then(m => m.getHearings(filters)),
  getIntelStats: () => import('./dataCollector.js').then(m => m.getIntelStats()),
  searchIntel: (q) => import('./dataCollector.js').then(m => m.searchIntel(q)),
  refreshAllData: () => import('./dataCollector.js').then(m => m.refreshAllData()),
  getDataSourceStatus: () => import('./dataCollector.js').then(m => m.getDataSourceStatus()),
};
