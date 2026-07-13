import React, { useState, useCallback, useEffect, useRef } from 'react';
import { searchKnowledge, getKnowledgeStats, askKnowledgeAI, webFetch } from '../utils/api';

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

// ─── Knowledge Article Modal ─────────────────────────────────────────────
function KnowledgeArticleModal({ item, onClose }) {
  const [fetchedContent, setFetchedContent] = useState(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const backdropRef = useRef(null);

  // Fetch article content on mount
  useEffect(() => {
    if (!item?.url) return;
    setFetchLoading(true);
    setFetchError(null);
    webFetch(item.url, null)
      .then(res => {
        if (res?.content && typeof res.content === 'string' && res.content.length > 0) {
          // Extract readable text — strip HTML tags
          const text = res.content
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
            .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
            .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (text.length > 50) {
            setFetchedContent(text.substring(0, 8000));
          } else {
            setFetchError('Insufficient content extracted from page');
          }
        } else {
          setFetchError('Could not fetch article content');
        }
      })
      .catch(err => {
        setFetchError(err.message || 'Fetch failed');
      })
      .finally(() => setFetchLoading(false));
  }, [item]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Extract domain from URL for external link
  let domain = '';
  try { if (item?.url) domain = new URL(item.url).hostname; } catch {}

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col mx-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-800 shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2">
              <SourceBadge category={item.category} />
              {item.confidence === 'high' && (
                <span className="text-xs text-green-400 bg-green-900/30 rounded-full px-2 py-0.5">High Confidence</span>
              )}
            </div>
            <h2 className="text-base font-semibold text-white leading-snug">{item.title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1.5 rounded-lg hover:bg-gray-800 transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Full summary */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Summary</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{item.summary}</p>
          </div>

          {/* Source info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Source</h3>
              <p className="text-sm text-indigo-400">{item.source}</p>
            </div>
            {item.citation && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Citation</h3>
                <p className="text-sm text-amber-400 font-mono">{item.citation}</p>
              </div>
            )}
          </div>

          {/* Category & Last Updated */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Category</h3>
              <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-800 border-gray-700 text-gray-400">
                {CATEGORIES.find(c => c.value === item.category)?.label || item.category}
              </span>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Last Updated</h3>
              <p className="text-sm text-gray-300">{item.lastUpdated || 'N/A'}</p>
            </div>
          </div>

          {/* Applicability tags */}
          {item.applicability && item.applicability.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Applicability</h3>
              <div className="flex flex-wrap gap-1.5">
                {item.applicability.map((a, i) => (
                  <span key={i} className="text-xs bg-gray-800 text-gray-400 rounded px-2 py-0.5 border border-gray-700/50">{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Source Article — fetched content */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Source Article</h3>
            {fetchLoading ? (
              <div className="flex items-center gap-3 text-gray-500 py-6">
                <svg className="animate-spin h-4 w-4 text-indigo-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span className="text-xs">Fetching article from {domain}...</span>
              </div>
            ) : fetchError ? (
              <div className="bg-gray-800/50 border border-gray-700/30 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-2">Could not retrieve full article content from source.</p>
                <p className="text-xs text-gray-600 mb-3">The full local summary is displayed above. Open the original at the link below for the complete article.</p>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-900/20 border border-indigo-700/30 rounded-lg px-3 py-1.5 transition-colors"
                >
                  Open original at {domain}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
              </div>
            ) : fetchedContent ? (
              <div className="bg-gray-950/50 border border-gray-700/30 rounded-xl p-4 max-h-[300px] overflow-y-auto">
                <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{fetchedContent}</p>
              </div>
            ) : (
              <div className="bg-gray-800/50 border border-gray-700/30 rounded-xl p-4">
                <p className="text-xs text-gray-500">No article URL available for this entry.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer — external link always present */}
        <div className="border-t border-gray-800 px-5 py-3 flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-600">Source verified — Brick PermitOS Knowledge Hub</span>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Open original at {domain}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main KnowledgeHub Component ─────────────────────────────────────────
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
  const [articleModal, setArticleModal] = useState(null);

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

  const handleOpenArticle = (item, e) => {
    e.stopPropagation();
    setArticleModal(item);
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
              Standard search uses keyword matching; toggle AI for AI-assisted analysis (requires API key).
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
              title="Toggle AI-assisted analysis (requires API key)"
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
                Sorted by relevance — keyword-based (use AI toggle for semantic analysis)
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
                  className="rounded-xl border border-gray-700/40 bg-gray-900/40 overflow-hidden transition-all hover:border-gray-600/40"
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
                          <span className="text-xs font-bold text-indigo-400">{item.relevance}%</span>
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
                        {/* View Source button */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={(e) => handleOpenArticle(item, e)}
                            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-900/20 border border-indigo-700/30 rounded-lg px-2.5 py-1 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            View source
                          </button>
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                            >
                              Open original ↗
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Click to expand/contract */}
                    {!expandedIdx === !(expandedIdx === idx) && (
                      <button
                        onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                        className="text-xs text-gray-600 hover:text-gray-400 mt-1 transition-colors"
                      >
                        {expandedIdx === idx ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </div>
                  {/* Always show "View source" affordance on the card */}
                  {expandedIdx !== idx && (
                    <div className="px-4 pb-3 flex items-center gap-2">
                      <button
                        onClick={(e) => handleOpenArticle(item, e)}
                        className="inline-flex items-center gap-1 text-xs text-indigo-400/70 hover:text-indigo-300 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        View source
                      </button>
                    </div>
                  )}
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
              <span className="text-gray-400">{stats.categories?.length || 0} categories</span>
              <span className="text-gray-600">Cache TTL: 1hr</span>
            </div>
          </div>
        </div>
      )}

      {/* Article Modal */}
      {articleModal && (
        <KnowledgeArticleModal item={articleModal} onClose={() => setArticleModal(null)} />
      )}
    </div>
  );
}