import React, { useState, useCallback } from 'react';
import { searchKnowledge, getKnowledgeStats, askKnowledgeAI } from '../utils/api';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'epa_guidance', label: 'EPA Guidance' },
  { value: 'consultant_best_practice', label: 'Consultant Best Practice' },
  { value: 'rblc_precedent', label: 'RBLC / Precedent' },
  { value: 'state_specific', label: 'State-Specific' },
  { value: 'compliance_tool', label: 'Compliance Tools' },
];

function SourceBadge({ category }) {
  const colors = {
    epa_guidance: 'bg-blue-900/40 border-blue-700/40 text-blue-300',
    consultant_best_practice: 'bg-violet-900/40 border-violet-700/40 text-violet-300',
    rblc_precedent: 'bg-amber-900/40 border-amber-700/40 text-amber-300',
    state_specific: 'bg-green-900/40 border-green-700/40 text-green-300',
    compliance_tool: 'bg-indigo-900/40 border-indigo-700/40 text-indigo-300',
  };
  const labels = {
    epa_guidance: 'EPA Guidance',
    consultant_best_practice: 'Consultant Practice',
    rblc_precedent: 'RBLC Precedent',
    state_specific: 'State-Specific',
    compliance_tool: 'Compliance Tool',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${colors[category] || 'bg-gray-800 border-gray-700 text-gray-400'}`}>
      {labels[category] || category}
    </span>
  );
}

export default function KnowledgeHub({ inputs, results }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [resultsList, setResultsList] = useState([]);
  const [stats, setStats] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(null);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [aiResponse, setAiResponse] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAi, setShowAi] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    setSearched(true);
    setShowAi(false);
    setAiResponse(null);
    try {
      const data = await searchKnowledge(query.trim(), { category: category || null, limit: 15 });
      setResultsList(data.results || []);
      if (!stats) {
        try {
          const s = await getKnowledgeStats();
          setStats(s.stats);
        } catch {}
      }
    } catch (err) {
      setError(err.message || 'Search failed');
      setResultsList([]);
    }
    setSearching(false);
  }, [query, category, stats]);

  const handleAskAI = useCallback(async () => {
    if (!query.trim()) return;
    setAiLoading(true);
    setError(null);
    setShowAi(true);
    setAiResponse(null);
    setSearched(false);
    try {
      const data = await askKnowledgeAI(query.trim(), inputs || {});
      setAiResponse(data);
    } catch (err) {
      setError(err.message || 'AI query failed');
      setAiResponse(null);
    }
    setAiLoading(false);
  }, [query, inputs]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (showAi) handleAskAI();
      else handleSearch();
    }
  };

  // Quick-reference suggestions using current site inputs
  const suggestions = [];
  if (inputs?.state) suggestions.push(`${inputs.state} data center permitting requirements`);
  if (inputs?.turbines) suggestions.push(`gas turbine PTE calculation BACT analysis`);
  if (inputs?.nonAttainment) suggestions.push(`nonattainment NSR LAER offsets`);
  suggestions.push('synthetic minor permitting pathway');
  suggestions.push('NPDES cooling water data center');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Regulatory Knowledge Hub</h2>
            <p className="text-xs text-gray-500">
              Search EPA guidance, consultant best practices, RBLC precedents, and state-specific regulatory intelligence.
              Cite authoritative sources in permit applications and RAI responses.
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search regulations, guidance, best practices..."
              className="w-full bg-gray-950 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-gray-600"
            />
          </div>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500 transition-colors min-w-[160px]"
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <div className="flex gap-1">
            <button
              onClick={showAi ? handleAskAI : handleSearch}
              disabled={searching || aiLoading || !query.trim()}
              className={`px-4 py-2.5 rounded-lg font-semibold text-sm transition-all whitespace-nowrap
                ${searching || aiLoading || !query.trim()
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  : showAi
                    ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/40'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40'}`}
            >
              {searching || aiLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  {showAi ? 'Asking AI...' : 'Searching...'}
                </span>
              ) : showAi ? 'Ask AI' : 'Search'}
            </button>
            <button
              onClick={() => { setShowAi(!showAi); setSearched(false); setAiResponse(null); }}
              className={`px-3 py-2.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap
                ${showAi
                  ? 'bg-violet-900/30 border-violet-700/40 text-violet-300'
                  : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'}`}
              title="Toggle AI-powered search"
            >
              AI
            </button>
          </div>
        </div>

        {/* Quick suggestions */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="text-xs text-gray-600 mr-1 py-1">Quick:</span>
          {suggestions.slice(0, 4).map((s, i) => (
            <button
              key={i}
              onClick={() => { setQuery(s); setTimeout(() => handleSearch(), 50); }}
              className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 rounded-full px-2.5 py-1 transition-colors border border-gray-700/60"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-800/40 bg-red-950/20 p-4">
          <div className="flex items-center gap-2">
            <span className="text-red-400 text-sm">{(showAi ? 'AI query' : 'Search') + ' failed:'}</span>
            <span className="text-red-300 text-xs">{error}</span>
          </div>
        </div>
      )}

      {/* AI Response */}
      {showAi && aiResponse && !aiLoading && (
        <div className="rounded-xl border border-violet-700/30 bg-violet-950/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-5 h-5 rounded bg-violet-600 flex items-center justify-center text-xs text-white font-bold">AI</span>
            <h3 className="text-sm font-semibold text-violet-300">AI-Powered Analysis</h3>
            {aiResponse.type === 'llm' && (
              <span className="text-xs bg-green-900/40 text-green-300 rounded-full px-2 py-0.5 ml-auto">Claude</span>
            )}
            {aiResponse.type === 'rag' && (
              <span className="text-xs bg-amber-900/40 text-amber-300 rounded-full px-2 py-0.5 ml-auto">Knowledge Base (RAG)</span>
            )}
          </div>
          <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto">
            {aiResponse.content}
          </div>
          {aiResponse.sources && aiResponse.sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-violet-800/30">
              <div className="text-xs text-gray-500 mb-1">Sources:</div>
              <div className="flex flex-wrap gap-1.5">
                {aiResponse.sources.map((s, i) => (
                  <span key={i} className="text-xs bg-gray-800 text-gray-400 rounded px-1.5 py-0.5">{s.title} ({s.relevance}%)</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {!showAi && searched && !searching && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300">
              {resultsList.length > 0
                ? `Found ${resultsList.length} result${resultsList.length > 1 ? 's' : ''}`
                : 'No results found'}
            </h3>
            {resultsList.length > 0 && (
              <span className="text-xs text-gray-600">
                Sorted by relevance
              </span>
            )}
          </div>

          {resultsList.length === 0 ? (
            <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-8 text-center">
              <div className="text-gray-600 text-sm mb-2">No knowledge results match your query</div>
              <p className="text-gray-700 text-xs">Try broadening your search terms or selecting a different category</p>
            </div>
          ) : (
            <div className="space-y-3">
              {resultsList.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-gray-700/40 bg-gray-900/40 overflow-hidden transition-all hover:border-gray-600/40 cursor-pointer"
                  onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <SourceBadge category={item.category} />
                          {item.confidence > 0.8 && (
                            <span className="text-xs text-green-400">High relevance</span>
                          )}
                        </div>
                        <h4 className="text-sm font-semibold text-white leading-snug">{item.title}</h4>
                      </div>
                      {item.confidence && (
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                          <span className="text-xs font-bold text-indigo-400">{Math.round(item.confidence * 100)}%</span>
                        </div>
                      )}
                    </div>
                    <p className={`text-xs text-gray-400 leading-relaxed ${expandedIdx !== idx ? 'line-clamp-2' : ''}`}>
                      {item.content}
                    </p>
                    {expandedIdx === idx && (
                      <div className="mt-3 pt-3 border-t border-gray-800/60 space-y-2">
                        {item.source && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-600">Source:</span>
                            <span className="text-indigo-400">{item.source}</span>
                          </div>
                        )}
                        {item.citation && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-600">Citation:</span>
                            <span className="text-amber-400 font-mono">{item.citation}</span>
                          </div>
                        )}
                        {item.applicability && item.applicability.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs text-gray-600">Applies to:</span>
                            {item.applicability.map((a, i) => (
                              <span key={i} className="text-xs bg-gray-800 text-gray-400 rounded px-1.5 py-0.5">{a}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats footer */}
      {stats && (
        <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Knowledge Base</span>
            <div className="flex items-center gap-4">
              <span className="text-gray-400">{stats.totalEntries || 0} entries</span>
              <span className="text-gray-400">{stats.categories || 0} categories</span>
              <span className="text-gray-600">Cache TTL: 1hr</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}