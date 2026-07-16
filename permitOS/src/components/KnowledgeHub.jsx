import React, { useState, useCallback, useEffect, useRef } from 'react';
import { searchKnowledge, getKnowledgeStats, askKnowledgeAI, webFetch } from '../utils/api';
import { usePermitData } from '../context/PermitDataContext';

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
    consultant_best_practice: 'bg-primary/30 border-primary/40 text-primary',
    rblc_precedent: 'bg-amber-900/40 border-amber-700/40 text-amber-300',
    state_specific: 'bg-green-900/40 border-green-700/40 text-primary',
    compliance_tool: 'bg-primary/30 border-primary/40 text-primary',
  };
  const labels = {
    epa_guidance: 'EPA Guidance',
    consultant_best_practice: 'Consultant Practice',
    rblc_precedent: 'RBLC Precedent',
    state_specific: 'State-Specific',
    compliance_tool: 'Compliance Tool',
  };
  return (
    <span className={`text-xs px-2 py-0.5  border ${colors[category] || 'bg-muted border-border text-muted-foreground'}`}>
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
      <div className="bg-card border border-border   w-full max-w-4xl max-h-[85vh] flex flex-col mx-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2">
              <SourceBadge category={item.category} />
              {item.confidence === 'high' && (
                <span className="text-xs text-primary bg-primary/10  px-2 py-0.5">High Confidence</span>
              )}
            </div>
            <h2 className="text-base font-semibold text-white leading-snug">{item.title}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground/80 p-1.5  hover:bg-muted transition-colors shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Full summary */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Summary</h3>
            <p className="text-sm text-foreground/80 leading-relaxed">{item.summary}</p>
          </div>

          {/* Source info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Source</h3>
              <p className="text-sm text-primary">{item.source}</p>
            </div>
            {item.citation && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Citation</h3>
                <p className="text-sm text-destructive font-mono">{item.citation}</p>
              </div>
            )}
          </div>

          {/* Category & Last Updated */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Category</h3>
              <span className="text-xs px-2 py-0.5  border bg-muted border-border text-muted-foreground">
                {CATEGORIES.find(c => c.value === item.category)?.label || item.category}
              </span>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Last Updated</h3>
              <p className="text-sm text-foreground/80">{item.lastUpdated || 'N/A'}</p>
            </div>
          </div>

          {/* Applicability tags */}
          {item.applicability && item.applicability.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Applicability</h3>
              <div className="flex flex-wrap gap-1.5">
                {item.applicability.map((a, i) => (
                  <span key={i} className="text-xs bg-muted text-muted-foreground rounded px-2 py-0.5 border border-border/50">{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Source Article — fetched content */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Source Article</h3>
            {fetchLoading ? (
              <div className="flex items-center gap-3 text-muted-foreground py-6">
                <svg className="animate-spin h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span className="text-xs">Fetching article from {domain}...</span>
              </div>
            ) : fetchError ? (
              <div className="bg-muted/50 border border-border/30  p-4">
                <p className="text-xs text-muted-foreground mb-2">Could not retrieve full article content from source.</p>
                <p className="text-xs text-muted-foreground/70 mb-3">The full local summary is displayed above. Open the original at the link below for the complete article.</p>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary bg-primary/15 border border-primary/30  px-3 py-1.5 transition-colors"
                >
                  Open original at {domain}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
              </div>
            ) : fetchedContent ? (
              <div className="bg-background/50 border border-border/30  p-4 max-h-[300px] overflow-y-auto">
                <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{fetchedContent}</p>
              </div>
            ) : (
              <div className="bg-muted/50 border border-border/30  p-4">
                <p className="text-xs text-muted-foreground">No article URL available for this entry.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer — external link always present */}
        <div className="border-t border-border px-5 py-3 flex items-center justify-between shrink-0">
          <span className="text-xs text-muted-foreground/70">Source verified — Brick PermitOS Knowledge Hub</span>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary transition-colors"
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
export default function KnowledgeHub() {
  const { inputs, results } = usePermitData();
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
      <div className=" border border-border/40 bg-card/40 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Regulatory Knowledge Hub</h2>
            <p className="text-xs text-muted-foreground">
              Search EPA guidance, consultant best practices, RBLC precedents, and state-specific regulatory intelligence.
              Standard search uses keyword matching; toggle AI for AI-assisted analysis (requires API key).
            </p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className=" border border-border/40 bg-card/40 p-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search regulations, guidance, best practices..."
              className="w-full bg-background border border-border  px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/70"
            />
          </div>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="bg-background border border-border  px-3 py-2.5 text-sm text-foreground/80 focus:outline-none focus:border-primary transition-colors min-w-[160px]"
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <div className="flex gap-1">
            <button
              onClick={showAi ? handleAskAI : handleSearch}
              disabled={searching || aiLoading || !query.trim()}
              className={`px-4 py-2.5  font-semibold text-sm transition-all whitespace-nowrap
                ${searching || aiLoading || !query.trim()
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : showAi
                    ? 'bg-primary hover:bg-primary/80 text-white  shadow-primary/40'
                    : 'bg-primary hover:bg-primary text-white  '}`}
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
              className={`px-3 py-2.5  text-xs font-medium border transition-all whitespace-nowrap
                ${showAi
                  ? 'bg-primary/20 border-primary/40 text-primary'
                  : 'bg-muted border-border text-muted-foreground hover:text-foreground/80 hover:border-border'}`}
              title="Toggle AI-assisted analysis (requires API key)"
            >
              AI
            </button>
          </div>
        </div>

        {/* Quick suggestions */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground/70 mr-1 py-1">Quick:</span>
          {suggestions.slice(0, 4).map((s, i) => (
            <button
              key={i}
              onClick={() => { setQuery(s); setTimeout(() => handleSearch(), 50); }}
              className="text-xs bg-muted hover:bg-muted-foreground/10 text-muted-foreground hover:text-foreground  px-2.5 py-1 transition-colors border border-border/60"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className=" border border-destructive/40 bg-red-950/20 p-4">
          <div className="flex items-center gap-2">
            <span className="text-destructive text-sm">{(showAi ? 'AI query' : 'Search') + ' failed:'}</span>
            <span className="text-destructive text-xs">{error}</span>
          </div>
        </div>
      )}

      {/* AI Response */}
      {showAi && aiResponse && !aiLoading && (
        <div className=" border border-primary/30 bg-primary/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-5 h-5 rounded bg-primary flex items-center justify-center text-xs text-white font-bold">AI</span>
            <h3 className="text-base font-semibold text-primary">AI-Powered Analysis</h3>
            {aiResponse.type === 'llm' && (
              <span className="text-xs bg-green-900/40 text-primary  px-2 py-0.5 ml-auto">Claude</span>
            )}
            {aiResponse.type === 'rag' && (
              <span className="text-xs bg-amber-900/40 text-amber-300  px-2 py-0.5 ml-auto">Knowledge Base (RAG)</span>
            )}
          </div>
          <div className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto">
            {aiResponse.content}
          </div>
          {aiResponse.sources && aiResponse.sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-primary/30">
              <div className="text-xs text-muted-foreground mb-1">Sources:</div>
              <div className="flex flex-wrap gap-1.5">
                {aiResponse.sources.map((s, i) => (
                  <span key={i} className="text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">{s.title} ({s.relevance}%)</span>
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
            <h3 className="text-base font-semibold text-foreground/80">
              {resultsList.length > 0
                ? `Found ${resultsList.length} result${resultsList.length > 1 ? 's' : ''}`
                : 'No results found'}
            </h3>
            {resultsList.length > 0 && (
              <span className="text-xs text-muted-foreground/70">
                Sorted by relevance — keyword-based (use AI toggle for semantic analysis)
              </span>
            )}
          </div>

          {resultsList.length === 0 ? (
            <div className=" border border-border/40 bg-card/40 p-8 text-center">
              <div className="text-muted-foreground/70 text-sm mb-2">No knowledge results match your query</div>
              <p className="text-muted-foreground/50 text-xs">Try broadening your search terms or selecting a different category</p>
            </div>
          ) : (
            <div className="space-y-3">
              {resultsList.map((item, idx) => (
                <div
                  key={idx}
                  className=" border border-border/40 bg-card/40 overflow-hidden transition-all cursor-pointer hover:border-indigo-700/50"
                  onClick={(e) => {
                    if (window.getSelection()?.toString()) return;
                    setArticleModal(item);
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <SourceBadge category={item.category} />
                          {item.confidence > 0.8 && (
                            <span className="text-xs text-primary">High relevance</span>
                          )}
                        </div>
                        <h4 className="text-sm font-semibold text-white leading-snug">{item.title}</h4>
                      </div>
                      {item.confidence && (
                        <div className="flex-shrink-0 w-10 h-10  bg-muted border border-border flex items-center justify-center">
                          <span className="text-xs font-bold text-primary">{item.relevance}%</span>
                        </div>
                      )}
                    </div>
                    <p className={`text-xs text-muted-foreground leading-relaxed ${expandedIdx !== idx ? 'line-clamp-2' : ''}`}>
                      {item.content}
                    </p>
                    {expandedIdx === idx && (
                      <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                        {item.source && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground/70">Source:</span>
                            <span className="text-primary">{item.source}</span>
                          </div>
                        )}
                        {item.citation && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground/70">Citation:</span>
                            <span className="text-destructive font-mono">{item.citation}</span>
                          </div>
                        )}
                        {item.applicability && item.applicability.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs text-muted-foreground/70">Applies to:</span>
                            {item.applicability.map((a, i) => (
                              <span key={i} className="text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">{a}</span>
                            ))}
                          </div>
                        )}
                        {/* View Source button */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={(e) => handleOpenArticle(item, e)}
                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary bg-primary/15 border border-primary/30  px-2.5 py-1 transition-colors"
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
                              className="text-xs text-muted-foreground hover:text-foreground/80 transition-colors"
                            >
                              Open original ↗
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Click to expand/contract */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedIdx(expandedIdx === idx ? null : idx); }}
                      className="text-xs text-muted-foreground/70 hover:text-muted-foreground mt-1 transition-colors"
                    >
                      {expandedIdx === idx ? 'Show less' : 'Show more'}
                    </button>
                  </div>
                  {/* Always show "View source" affordance on the card */}
                  {expandedIdx !== idx && (
                    <div className="px-4 pb-3 flex items-center gap-2">
                      <button
                        onClick={(e) => handleOpenArticle(item, e)}
                        className="inline-flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors"
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
        <div className=" border border-border/40 bg-card/40 p-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Knowledge Base</span>
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">{stats.totalEntries || 0} entries</span>
              <span className="text-muted-foreground">{stats.categories?.length || 0} categories</span>
              <span className="text-muted-foreground/70">Cache TTL: 1hr</span>
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