import React, { useState, useEffect } from 'react';
import { getIntelMarkets, getIntelMarketDetail, getIntelProjects, getIntelHearings, getIntelStats, searchIntel, refreshIntelData, getIntelSources } from '../utils/api';

export default function PermitIntelligence({ setActiveTab }) {
  const [markets, setMarkets] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [marketDetail, setMarketDetail] = useState(null);
  const [allProjects, setAllProjects] = useState([]);
  const [allHearings, setAllHearings] = useState([]);
  const [sources, setSources] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [showSources, setShowSources] = useState(false);
  const [filterStage, setFilterStage] = useState('all');
  const [filterHearingStatus, setFilterHearingStatus] = useState('all');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true); setError(null);
    try {
      const [marketsRes, statsRes, projectsRes, hearingsRes, sourcesRes] = await Promise.all([
        getIntelMarkets(), getIntelStats(), getIntelProjects(), getIntelHearings(), getIntelSources(),
      ]);
      setMarkets(marketsRes.markets || []);
      setStats(statsRes.stats || null);
      setAllProjects(projectsRes.projects || []);
      setAllHearings(hearingsRes.hearings || []);
      setSources(sourcesRes.sources || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshIntelData();
      await loadData();
    } catch (err) { setError(err.message); }
    setRefreshing(false);
  }

  async function handleSelectMarket(marketId) {
    setSelectedMarket(marketId);
    try {
      const res = await getIntelMarketDetail(marketId);
      setMarketDetail(res.market);
    } catch { setMarketDetail(null); }
  }

  function handleBack() { setSelectedMarket(null); setMarketDetail(null); }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await searchIntel(searchQuery);
      setSearchResults(res.results || []);
    } catch { setSearchResults([]); }
    setSearching(false);
  }

  function getStatusColor(status) {
    const colors = {
      'rezoning_approved': 'bg-emerald-500', 'hearing_scheduled': 'bg-blue-500',
      'public_hearing': 'bg-amber-500', 'land_under_contract': 'bg-violet-500',
      'option_agreement': 'bg-indigo-500', 'site_plan_review': 'bg-cyan-500',
      'incentive_application': 'bg-orange-500', 'use_permit_pending': 'bg-yellow-500',
      'design_review': 'bg-teal-500', 'land_search': 'bg-gray-500',
      'rezoning_filed': 'bg-sky-500', 'lease_negotiation': 'bg-pink-500',
      'tax_abatement_approved': 'bg-green-500',
    };
    return colors[status] || 'bg-gray-400';
  }

  function getStageBadge(stage) {
    const labels = { 'land_assembly': 'Land Assembly', 'hearing': 'Public Hearing', 'pre-permit': 'Pre-Permit Application' };
    return labels[stage] || stage;
  }

  function getActivityColor(activity) {
    if (activity === 'high') return 'text-emerald-400 bg-emerald-900/30';
    if (activity === 'medium') return 'text-amber-400 bg-amber-900/30';
    return 'text-gray-400 bg-gray-800/50';
  }

  function getFreshnessIndicator(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.round((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) return { label: 'Updated today', color: 'text-green-400' };
    if (diffDays <= 7) return { label: `Updated ${diffDays}d ago`, color: 'text-green-400' };
    if (diffDays <= 30) return { label: `Updated ${diffDays}d ago`, color: 'text-amber-400' };
    return { label: `Updated ${diffDays}d ago`, color: 'text-red-400' };
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ─── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-800 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-800 rounded"></div>)}
          </div>
          <div className="h-64 bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  // ─── Market Detail View ─────────────────────────────────────────────────
  if (selectedMarket && marketDetail) {
    return (
      <div className="p-4 md:p-6">
        <div className="mb-6">
          <button onClick={handleBack} className="text-sm text-indigo-400 hover:text-indigo-300 mb-2 flex items-center gap-1">
            ← Back to All Markets
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">{marketDetail.name}</h1>
              <p className="text-gray-400">{marketDetail.state}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Data Sources</div>
              <div className="text-xs text-indigo-400">{marketDetail.dataSources?.length || 0} sources</div>
              <div className={`text-xs mt-1 ${getFreshnessIndicator(marketDetail.lastRefreshed).color}`}>
                {getFreshnessIndicator(marketDetail.lastRefreshed).label}
              </div>
            </div>
          </div>
          {marketDetail.dataSources && (
            <div className="mt-2 flex flex-wrap gap-2">
              {marketDetail.dataSources.map((s, i) => (
                <span key={i} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{s}</span>
              ))}
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-gray-500 text-xs mb-1">Installed Capacity</div>
            <div className="text-2xl font-bold text-white">{marketDetail.totalMW} MW</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-amber-900/30">
            <div className="text-gray-500 text-xs mb-1">Pipeline MW</div>
            <div className="text-2xl font-bold text-amber-400">{marketDetail.inPipeline} MW</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="text-gray-500 text-xs mb-1">Active Projects</div>
            <div className="text-2xl font-bold text-white">{marketDetail.projects.length}</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4 border border-blue-900/30">
            <div className="text-gray-500 text-xs mb-1">Upcoming Hearings</div>
            <div className="text-2xl font-bold text-blue-400">{marketDetail.hearingSchedule.filter(h => h.status === 'scheduled').length}</div>
          </div>
        </div>

        {/* Projects with Developer + Offtaker */}
        <h2 className="text-lg font-semibold text-white mb-3">Projects in Pipeline</h2>
        <div className="space-y-3 mb-8">
          {marketDetail.projects.map((proj, i) => (
            <div key={i} className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-all">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-white font-medium">{proj.name}</h3>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className="text-xs bg-indigo-900/30 text-indigo-300 px-2 py-0.5 rounded-full">
                      Developer: {proj.developer}
                    </span>
                    <span className="text-xs bg-violet-900/30 text-violet-300 px-2 py-0.5 rounded-full">
                      Offtaker: {proj.offtaker}
                    </span>
                    <span className="text-xs text-gray-500">{proj.mw} MW · {proj.acres} acres</span>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${getActivityColor(marketDetail.activity)}`}>
                  {getStageBadge(proj.stage)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-xs bg-gray-800 text-white`}>
                  {proj.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="space-y-1">
                {proj.signals.map((s, j) => (
                  <div key={j} className="flex items-start gap-2 text-xs text-gray-400">
                    <span className="text-indigo-500 mt-1">•</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
              {proj.source && (
                <div className="mt-2 text-xs text-gray-600 italic">
                  Source: {proj.source}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Hearing Schedule - includes both upcoming and completed */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Municipal Hearing Record</h2>
          <div className="flex gap-2 text-xs">
            <span className="text-blue-400">{marketDetail.hearingSchedule.filter(h => h.status === 'scheduled').length} upcoming</span>
            <span className="text-gray-500">·</span>
            <span className="text-gray-500">{marketDetail.hearingSchedule.filter(h => h.status === 'completed').length} completed</span>
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs">
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Body</th>
                <th className="text-left p-3">Item</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Source</th>
              </tr>
            </thead>
            <tbody>
              {marketDetail.hearingSchedule.sort((a, b) => b.date.localeCompare(a.date)).map((h, i) => (
                <tr key={i} className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${h.status === 'completed' ? 'opacity-60' : ''}`}>
                  <td className="p-3 text-white whitespace-nowrap">{formatDate(h.date)}</td>
                  <td className="p-3 text-gray-300">{h.body}</td>
                  <td className="p-3 text-gray-400">{h.item}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      h.status === 'scheduled' ? 'bg-blue-900/30 text-blue-400' :
                      h.status === 'completed' ? 'bg-gray-800 text-gray-400' :
                      h.status === 'rescheduled' ? 'bg-amber-900/30 text-amber-400' : 'bg-gray-800 text-gray-400'
                    }`}>{h.status}</span>
                  </td>
                  <td className="p-3 text-gray-500 text-xs">{h.source || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─── Main Dashboard View ────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Permit Intelligence</h1>
          <p className="text-gray-400 text-sm mt-1">Real-time market intelligence tracking data center development signals from public sources — hearings, rezoning, land records, and pre-permit filings across 12 US markets.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSources(!showSources)}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg px-3 py-1.5 border border-gray-700 transition-colors"
          >
            📡 Data Sources
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs bg-indigo-700 hover:bg-indigo-600 disabled:bg-gray-700 text-white rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1"
          >
            {refreshing ? '⟳ Refreshing...' : '⟳ Refresh Data'}
          </button>
        </div>
      </div>

      {/* Data Sources Panel */}
      {showSources && (
        <div className="mb-6 bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Data Sources & Attribution</h3>
          {stats?.dataSources && (
            <div className="flex flex-wrap gap-2 mb-3">
              {stats.dataSources.map((s, i) => (
                <span key={i} className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-full">{s}</span>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {sources.map((s, i) => (
              <div key={i} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                <div className="font-semibold text-gray-300">{s.name}</div>
                <div className="text-gray-500 mt-1">{s.description}</div>
                <div className="text-green-400 mt-1">{s.public ? 'Public API' : 'Curated'}</div>
              </div>
            ))}
          </div>
          {stats?.lastRefreshed && (
            <div className="mt-3 text-xs text-gray-500">
              Last refreshed: {new Date(stats.lastRefreshed).toLocaleString()}
              {' · '}{stats.sourceCount} total sources
              {' · '}{stats.uniqueDeveloperCount} unique developers tracked
              {' · '}{stats.uniqueOfftakerCount} unique offtakers tracked
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 rounded-xl p-4 border border-gray-800">
            <div className="text-gray-500 text-xs mb-1">Total Market Capacity</div>
            <div className="text-xl font-bold text-white">{stats.totalMW.toLocaleString()} MW</div>
          </div>
          <div className="bg-gradient-to-br from-amber-900/20 to-gray-900/40 rounded-xl p-4 border border-amber-900/30">
            <div className="text-gray-500 text-xs mb-1">Pipeline MW</div>
            <div className="text-xl font-bold text-amber-400">{stats.totalPipeline.toLocaleString()} MW</div>
          </div>
          <div className="bg-gradient-to-br from-gray-900/80 to-gray-900/40 rounded-xl p-4 border border-gray-800">
            <div className="text-gray-500 text-xs mb-1">Tracked Projects</div>
            <div className="text-xl font-bold text-white">{stats.totalProjects}</div>
          </div>
          <div className="bg-gradient-to-br from-blue-900/20 to-gray-900/40 rounded-xl p-4 border border-blue-900/30">
            <div className="text-gray-500 text-xs mb-1">Upcoming Hearings</div>
            <div className="text-xl font-bold text-blue-400">{stats.totalHearings}</div>
          </div>
          <div className="bg-gradient-to-br from-violet-900/20 to-gray-900/40 rounded-xl p-4 border border-violet-900/30">
            <div className="text-gray-500 text-xs mb-1">Developers</div>
            <div className="text-xl font-bold text-violet-400">{stats.uniqueDeveloperCount}</div>
          </div>
          <div className="bg-gradient-to-br from-emerald-900/20 to-gray-900/40 rounded-xl p-4 border border-emerald-900/30">
            <div className="text-gray-500 text-xs mb-1">Offtakers</div>
            <div className="text-xl font-bold text-emerald-400">{stats.uniqueOfftakerCount}</div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search projects, developers, offtakers, markets, hearings... (e.g., 'AWS', 'Google', 'Meta', 'Northern Virginia', 'rezoning')"
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white px-4 py-2 rounded-xl text-sm transition-colors"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-3 bg-gray-900 rounded-xl border border-gray-800 p-3 space-y-2 max-h-64 overflow-y-auto">
            <div className="text-xs text-gray-500 mb-1">Search Results ({searchResults.length})</div>
            {searchResults.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-gray-300 p-2 hover:bg-gray-800/50 rounded-lg">
                <span className={`mt-0.5 text-xs px-1.5 py-0.5 rounded whitespace-nowrap ${
                  r.type === 'project' ? 'bg-indigo-900/40 text-indigo-300' :
                  r.type === 'developer' ? 'bg-violet-900/40 text-violet-300' :
                  r.type === 'offtaker' ? 'bg-emerald-900/40 text-emerald-300' :
                  r.type === 'market' ? 'bg-amber-900/40 text-amber-300' : 'bg-blue-900/40 text-blue-300'
                }`}>{r.type}</span>
                <div className="flex-1">
                  <span>{r.project?.name || r.market?.name || r.hearing?.item || r.developer || r.offtaker}</span>
                  {r.developer && <span className="text-gray-500 ml-2">Developer: {r.developer}</span>}
                  {r.offtaker && <span className="text-gray-500 ml-2">Offtaker: {r.offtaker}</span>}
                  <span className="text-gray-500 ml-2 text-xs">{r.marketName || ''}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Market Grid */}
      <h2 className="text-lg font-semibold text-white mb-3">Data Center Markets</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {markets.map((m) => (
          <button
            key={m.id}
            onClick={() => handleSelectMarket(m.id)}
            className="bg-gray-900 rounded-xl p-4 border border-gray-800 hover:border-indigo-700/50 text-left transition-all hover:shadow-lg hover:shadow-indigo-900/10 group"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-medium group-hover:text-indigo-400 transition-colors">{m.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                m.activity === 'high' ? 'bg-emerald-900/30 text-emerald-400' :
                m.activity === 'medium' ? 'bg-amber-900/30 text-amber-400' : 'bg-gray-800 text-gray-400'
              }`}>{m.activity}</span>
            </div>
            <div className="text-gray-500 text-xs mb-3">{m.state} · {m.dataSources?.length || 0} data sources</div>
            <div className="flex items-center gap-4 text-xs">
              <div><span className="text-white font-medium">{m.totalMW}</span> <span className="text-gray-500">MW</span></div>
              <div><span className="text-amber-400 font-medium">{m.inPipeline}</span> <span className="text-gray-500">MW pipeline</span></div>
              <div><span className="text-blue-400">{m.projectCount}</span> <span className="text-gray-500">projects</span></div>
            </div>
            {m.hearingCount > 0 && (
              <div className="mt-2 text-xs text-blue-400">{m.hearingCount} upcoming hearing{m.hearingCount > 1 ? 's' : ''}</div>
            )}
            {m.lastRefreshed && (
              <div className={`mt-1 text-xs ${getFreshnessIndicator(m.lastRefreshed).color}`}>
                {getFreshnessIndicator(m.lastRefreshed).label}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Pipeline Activity Table */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Pipeline Activity</h2>
        <div className="flex gap-2 text-xs">
          {['all', 'land_assembly', 'hearing', 'pre-permit'].map(s => (
            <button key={s} onClick={() => setFilterStage(s)}
              className={`px-2 py-1 rounded-lg transition-colors ${filterStage === s ? 'bg-indigo-700/40 text-indigo-300' : 'bg-gray-800 text-gray-500 hover:text-gray-300'}`}
            >{s === 'all' ? 'All' : getStageBadge(s)}</button>
          ))}
        </div>
      </div>
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs">
                <th className="text-left p-3">Project</th>
                <th className="text-left p-3">Developer</th>
                <th className="text-left p-3">Offtaker</th>
                <th className="text-left p-3">Market</th>
                <th className="text-left p-3">MW</th>
                <th className="text-left p-3">Stage</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {allProjects
                .filter(p => filterStage === 'all' || p.stage === filterStage)
                .sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated))
                .slice(0, 20)
                .map((p, i) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="p-3 text-white font-medium whitespace-nowrap">{p.name}</td>
                  <td className="p-3 text-indigo-300 whitespace-nowrap">{p.developer}</td>
                  <td className="p-3 text-violet-300 whitespace-nowrap">{p.offtaker}</td>
                  <td className="p-3 text-gray-400">{p.marketName}</td>
                  <td className="p-3 text-gray-300">{p.mw}</td>
                  <td className="p-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">{getStageBadge(p.stage)}</span>
                  </td>
                  <td className="p-3">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor(p.status)}`}></span>
                      <span className="text-gray-400 text-xs">{p.status.replace(/_/g, ' ')}</span>
                    </span>
                  </td>
                  <td className="p-3 text-gray-500 text-xs">{p.lastUpdated}</td>
                </tr>
              ))}
              {allProjects.length === 0 && (
                <tr><td colSpan="8" className="p-6 text-center text-gray-500">No projects found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Municipal Hearings - includes upcoming and historical */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Municipal Hearing Record</h2>
        <div className="flex gap-2 text-xs">
          {['all', 'scheduled', 'completed', 'rescheduled'].map(s => (
            <button key={s} onClick={() => setFilterHearingStatus(s)}
              className={`px-2 py-1 rounded-lg transition-colors ${filterHearingStatus === s ? 'bg-indigo-700/40 text-indigo-300' : 'bg-gray-800 text-gray-500 hover:text-gray-300'}`}
            >{s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</button>
          ))}
        </div>
      </div>
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs">
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Market</th>
                <th className="text-left p-3">Body</th>
                <th className="text-left p-3">Item</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Source</th>
              </tr>
            </thead>
            <tbody>
              {allHearings
                .filter(h => filterHearingStatus === 'all' || h.status === filterHearingStatus)
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 20)
                .map((h, i) => (
                <tr key={i} className={`border-b border-gray-800/50 hover:bg-gray-800/30 ${h.status === 'completed' ? 'opacity-60' : ''}`}>
                  <td className="p-3 text-white whitespace-nowrap">{formatDate(h.date)}</td>
                  <td className="p-3 text-gray-300">{h.marketName}</td>
                  <td className="p-3 text-gray-400">{h.body}</td>
                  <td className="p-3 text-gray-400">{h.item}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      h.status === 'scheduled' ? 'bg-blue-900/30 text-blue-400' :
                      h.status === 'completed' ? 'bg-gray-800 text-gray-400' :
                      h.status === 'rescheduled' ? 'bg-amber-900/30 text-amber-400' : 'bg-gray-800 text-gray-400'
                    }`}>{h.status}</span>
                  </td>
                  <td className="p-3 text-gray-500 text-xs">{h.source || '—'}</td>
                </tr>
              ))}
              {allHearings.length === 0 && (
                <tr><td colSpan="6" className="p-6 text-center text-gray-500">No hearings found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
