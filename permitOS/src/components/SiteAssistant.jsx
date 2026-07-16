import React, { useState, useRef, useEffect } from 'react';
import { queryAgent, queryAgentWithWeb, analyzeScenario, searchKnowledge, searchRegulations } from '../utils/api';
import { usePermitData } from '../context/PermitDataContext';

const QUICK_TEMPLATES = [
  { id: 'pathway', label: 'Permit pathway' },
  { id: 'ptes', label: 'PTE summary' },
  { id: 'scenario', label: 'Compare scenarios' },
  { id: 'water', label: 'Water permits' },
  { id: 'cfr', label: 'CFR by state' },
  { id: 'bact', label: 'BACT requirements' },
];

function makeQuickPrompt(templateId, inputs) {
  const site = inputs?.siteName || 'this site';
  const state = inputs?.state || 'the selected state';
  switch (templateId) {
    case 'pathway': return `What is the full permit pathway for ${site} in ${state}? Cover air (PSD/NSR/Title V) and water (NPDES/SPCC) requirements. Cite specific 40 CFR parts and state regulations.`;
    case 'ptes': return `Summarize the PTE results for ${site} — baseline vs. controlled emissions per pollutant, major source thresholds (100 tpy PSD, 250 tpy for GHGs), and Brick battery dispatch reduction strategy. Use site-specific data.`;
    case 'scenario': return `Compare greenfield, expansion, upsized, and colocated scenarios for a ${inputs?.turbines || ''} turbine data center in ${state}. Which permit pathway is fastest? Include timeline comparisons and risk analysis.`;
    case 'water': return `What water permits are needed for ${site} in ${state}? Include NPDES for cooling tower blowdown (40 CFR 122), SPCC for diesel storage (40 CFR 112), 316(b) for cooling water intake, SWPPP for construction, and wetlands permitting.`;
    case 'cfr': return `What are the key CFR regulatory requirements for data center gas turbines in ${state}? Cite specific 40 CFR Parts (50-140 for air, 122-140 for water) and include state-specific rules, attainment status, and major source thresholds.`;
    case 'bact': return `Explain the BACT top-down analysis (40 CFR 52.21) for gas turbines at ${site}. What control technologies are evaluated? Include DLN, SCR, oxidation catalyst, and what is the recommended BACT determination with cost-effectiveness analysis.`;
    default: return '';
  }
}

const MAX_RAG_DISPLAY_LENGTH = 1500;

export default function SiteAssistant({ setActiveTab }) {
  const { inputs, results } = usePermitData();
  const [open, setOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [chatHistory, setChatHistory] = useState(() => {
    const saved = typeof window !== 'undefined' && localStorage.getItem('permitos_assistant_chat');
    return saved ? JSON.parse(saved) : [
      {
        role: 'assistant',
        content: `I'm your PermitOS Site Assistant. I have full access to your site data, regulatory knowledge base (38+ regulatory documents across all 50 states), scenario analysis engine, permit calculation results, and can pull live data from EPA/eCFR sources. Ask me anything about permitting, compliance, regulations, or site strategy.`,
        sourceType: 'system',
      }
    ];
  });
  const [thinking, setThinking] = useState(false);
  const [scenarioMode, setScenarioMode] = useState(null);
  const [scenarioResult, setScenarioResult] = useState(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Persist chat history
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('permitos_assistant_chat', JSON.stringify(chatHistory.slice(-50)));
    }
  }, [chatHistory]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, thinking, scenarioResult]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const siteName = inputs?.siteName || 'current site';
  const hasResults = !!results;

  // Format response with source badge
  const formatResponse = (response) => {
    if (!response) return null;
    const answerText = response?.content || response?.answer || response?.response || '';
    const sourceType = response?.limited ? 'rag' : (response?.type === 'rag' ? 'rag' : (response?.webSource ? 'web' : 'llm'));
    const sourceCount = response?.sources?.length || 0;
    const ragSourceCount = response?.ragSourceCount || 0;
    const webSource = response?.webSource || null;

    let formatted = answerText;

    // If it's a RAG-only response (no LLM), append source context
    if (sourceType === 'rag' && response?.sources?.length > 0) {
      formatted += '\n\n---\n**Knowledge Base Sources Used:**\n';
      response.sources.slice(0, 4).forEach(s => {
        formatted += `- ${s.title} (${s.relevance}% match)\n`;
      });
    }

    return { content: formatted, sourceType, sourceCount, ragSourceCount, webSource };
  };

  // Fallback: search RAG and display results directly in chat
  const fallbackWithRAG = async (msg) => {
    try {
      const ragData = await searchRegulations(msg, { limit: 5 });
      const ragResults = ragData?.results || [];
      if (ragResults.length > 0) {
        let ragContent = `**Regulatory Knowledge Base Results (AI connection unavailable):**\n\n`;
        ragResults.slice(0, 4).forEach((r, i) => {
          ragContent += `**${i + 1}. ${r.title}** (${r.relevance}% match)\n`;
          const summary = r.text?.length > MAX_RAG_DISPLAY_LENGTH
            ? r.text.substring(0, MAX_RAG_DISPLAY_LENGTH) + '...'
            : r.text;
          ragContent += `${summary}\n\n`;
        });
        ragContent += `---\n*Full AI-powered analysis requires ANTHROPIC_API_KEY. ${ragResults.length} regulatory sources displayed from the local knowledge base. Visit the Knowledge Hub tab to search all 38+ regulatory documents.*`;
        return { content: ragContent, sourceType: 'rag', sourceCount: ragResults.length };
      }
    } catch { /* fall through to generic fallback */ }

    return {
      content: `I encountered a connection issue while processing your question about "${msg}" for ${siteName}.

**Here's what I can tell you from platform data:**

**Site Configuration:**
- **Location:** ${inputs?.state || 'N/A'} · ${inputs?.county || 'N/A'}
- **Turbines:** ${inputs?.turbines || 'N/A'} x ${inputs?.mwPerTurbine || 'N/A'} MW (${(inputs?.turbines || 0) * (inputs?.mwPerTurbine || 0)} MW total)
- **Annual Hours:** ${(inputs?.hours || 0).toLocaleString()} hr/yr
- **Brick Savings:** ${inputs?.brickSavings || 0}% dispatch optimization
- **Gensets:** ${inputs?.gensetCount || 0} units

**Key Permits Required:**
- **Air:** ${results?.pathway?.requiresPSD ? 'PSD major source — BACT review required for NOx/CO/SO2' : 'Below PSD thresholds — synthetic minor pathway viable with Brick controls'}
- **Water:** NPDES for cooling tower blowdown, SPCC for diesel storage, SWPPP for construction
- **Title V:** ${results?.pathway?.requiresTitleV ? 'Title V operating permit required' : 'Synthetic minor avoids Title V'}
- **State Rules:** ${inputs?.state || 'N/A'} specific requirements may apply

Navigate to the relevant tab for detailed analysis: Air Permit AI, Water Permit AI, or Knowledge Hub.`,
      sourceType: 'fallback',
    };
  };

  const sendChat = async () => {
    const msg = chatMsg.trim();
    if (!msg) return;
    setChatMsg('');
    setChatHistory(prev => [...prev, { role: 'user', content: msg, sourceType: 'user' }]);
    setThinking(true);
    setScenarioMode(null);
    setScenarioResult(null);

    const lower = msg.toLowerCase();
    const scenarioMatch = lower.match(/run\s+(greenfield|expansion|upsized|colocated)\s+scenario/i);

    try {
      if (scenarioMatch) {
        // Scenario command
        const scenarioType = scenarioMatch[1].toLowerCase();
        setScenarioMode(scenarioType);
        const data = await analyzeScenario(scenarioType, inputs || {});
        const analysis = data?.analysis;
        if (analysis) {
          setScenarioResult(analysis);
          const timeline = analysis.timelineMonths;
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            sourceType: 'scenario',
            content: `## ${analysis.label} Scenario Analysis\n\n**Complexity:** ${analysis.complexity}  \n**Timeline:** ${timeline?.min || '?'}–${timeline?.max || '?'} months  \n**Permit Types:** ${analysis.permitTypes?.join(', ') || 'N/A'}\n\n${analysis.description}\n\n**Risks:**\n${analysis.keyRisks?.map(r => `- ${r}`).join('\n') || 'N/A'}\n\n**Opportunities:**\n${analysis.keyOpportunities?.map(o => `- ${o}`).join('\n') || 'N/A'}\n\n${analysis.specialConsiderations?.length > 0 ? `**Special Considerations:**\n${analysis.specialConsiderations.map(s => `- ${s}`).join('\n')}` : ''}\n\n*Scenario analysis complete. You can view the full milestone timeline in the Milestone Timeline tab.*`
          }]);
        }
      } else {
        // General query — use enhanced endpoint with internet data + RAG + LLM
        const response = await queryAgentWithWeb(msg, {
          inputs: inputs || {},
          results: results || {},
          conversationHistory: chatHistory.slice(-4),
        });

        const formatted = formatResponse(response);
        if (formatted) {
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: formatted.content,
            sourceType: formatted.sourceType,
            sourceCount: formatted.sourceCount,
            ragSourceCount: formatted.ragSourceCount,
            webSource: formatted.webSource,
          }]);
        }
      }
    } catch (err) {
      // Fallback with RAG search results
      const fallback = await fallbackWithRAG(msg);
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: fallback.content,
        sourceType: fallback.sourceType,
        sourceCount: fallback.sourceCount || 0,
      }]);
    }
    setThinking(false);
  };

  const handleQuickPrompt = (templateId) => {
    const prompt = makeQuickPrompt(templateId, inputs);
    if (prompt) {
      setChatMsg(prompt);
      setTimeout(() => sendChatWith(prompt), 50);
    }
  };

  const sendChatWith = async (msg) => {
    setChatHistory(prev => [...prev, { role: 'user', content: msg, sourceType: 'user' }]);
    setThinking(true);
    setScenarioMode(null);
    setScenarioResult(null);
    try {
      const response = await queryAgentWithWeb(msg, {
        inputs: inputs || {},
        results: results || {},
        conversationHistory: chatHistory.slice(-4),
      });
      const formatted = formatResponse(response);
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: formatted?.content || msg,
        sourceType: formatted?.sourceType || 'llm',
        sourceCount: formatted?.sourceCount || 0,
        ragSourceCount: formatted?.ragSourceCount || 0,
        webSource: formatted?.webSource || null,
      }]);
    } catch {
      const fallback = await fallbackWithRAG(msg);
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: fallback.content,
        sourceType: fallback.sourceType,
        sourceCount: fallback.sourceCount || 0,
      }]);
    }
    setThinking(false);
  };

  const handleTabNav = (tab) => {
    if (setActiveTab) setActiveTab(tab);
    setOpen(false);
  };

  const clearChat = () => {
    setChatHistory([
      { role: 'assistant', sourceType: 'system', content: `Chat cleared. I'm still connected to ${siteName} with full RAG knowledge base, internet data pulling, and site analysis. Ask me anything about permitting, compliance, or regulations.` }
    ]);
    localStorage.removeItem('permitos_assistant_chat');
  };

  return (
    <>
      {/* Chat bubble button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-5 right-5 z-40 w-12 h-12   transition-all duration-300 flex items-center justify-center
          ${open ? 'bg-muted scale-90' : 'bg-primary hover:bg-primary hover:scale-105'}`}
        title="Site Assistant"
      >
        {open ? (
          <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-40 w-[420px] max-w-[calc(100vw-2rem)] h-[580px] max-h-[calc(100vh-10rem)] bg-card border border-border   shadow-black/50 flex flex-col overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card/95 flex-shrink-0">
            <div className="w-8 h-8  bg-gradient-to-br bg-primary  flex items-center justify-center   flex-shrink-0">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground truncate">PermitOS Assistant</div>
              <div className="text-xs text-primary flex items-center gap-1.5">
                <span className="w-1.5 h-1.5  bg-primary animate-pulse"></span>
                {hasResults ? `${siteName} loaded` : 'Site ready'}
                <span className="text-muted-foreground/70 ml-1">· RAG + Web</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="text-xs text-muted-foreground/70 hover:text-muted-foreground bg-muted  px-2 py-1 transition-colors"
                title="Clear chat"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-5 h-5  flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5
                  ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-violet-700 text-white'}`}>
                  {msg.role === 'user' ? 'U' : 'AI'}
                </div>
                <div className={`max-w-[85%]  px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap
                  ${msg.role === 'user'
                    ? 'bg-primary/30 border border-primary/40 text-indigo-100'
                    : 'bg-muted/60 border border-border/40 text-foreground/80'}`}>
                  {/* Source type badge */}
                  {msg.role === 'assistant' && msg.sourceType && msg.sourceType !== 'system' && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5 pb-1.5 border-b border-border/30">
                      {msg.sourceType === 'llm' && (
                        <span className="text-xs bg-green-900/40 text-primary rounded px-1.5 py-0.5 border border-green-800/30">
                          Claude AI
                        </span>
                      )}
                      {msg.sourceType === 'rag' && (
                        <span className="text-xs bg-amber-900/60 text-amber-300 rounded px-1.5 py-0.5 border border-amber-700/50 font-semibold">
                          Limited mode — AI not connected
                        </span>
                      )}
                      {msg.sourceType === 'web' && (
                        <span className="text-xs bg-blue-900/40 text-blue-300 rounded px-1.5 py-0.5 border border-blue-800/30">
                          Internet + AI
                        </span>
                      )}
                      {msg.sourceType === 'scenario' && (
                        <span className="text-xs bg-primary/30 text-primary rounded px-1.5 py-0.5 border border-primary/30">
                          Scenario Engine
                        </span>
                      )}
                      {msg.sourceType === 'fallback' && (
                        <span className="text-xs bg-red-900/60 text-destructive rounded px-1.5 py-0.5 border border-red-700/50 font-semibold">
                          AI unavailable — limited results
                        </span>
                      )}
                      {(msg.sourceCount > 0) && (
                        <span className="text-xs text-muted-foreground">
                          {msg.sourceCount} source{msg.sourceCount > 1 ? 's' : ''}
                        </span>
                      )}
                      {msg.webSource && (
                        <span className="text-xs text-muted-foreground max-w-[120px] truncate" title={msg.webSource}>
                          EPA data
                        </span>
                      )}
                    </div>
                  )}
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Scenario analysis result card */}
            {scenarioResult && (
              <div className="bg-muted/60 border border-primary/40  p-3 text-xs">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-primary font-semibold">Scenario: {scenarioResult.label}</span>
                  <span className={`text-xs px-1.5 py-0.5  ${
                    scenarioResult.complexity === 'high' ? 'bg-destructive/10 text-destructive' :
                    scenarioResult.complexity === 'moderate' ? 'bg-amber-900/30 text-destructive' :
                    'bg-primary/10 text-primary'
                  }`}>{scenarioResult.complexity}</span>
                </div>
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="text-muted-foreground">Timeline:</span>
                  <span className="text-foreground font-semibold">
                    {scenarioResult.timelineMonths?.min}–{scenarioResult.timelineMonths?.max} months
                  </span>
                </div>
                {scenarioResult.permitTypes?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {scenarioResult.permitTypes.slice(0, 4).map((p, i) => (
                      <span key={i} className="bg-muted text-muted-foreground rounded px-1.5 py-0.5">{p}</span>
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5 mt-2 pt-1.5 border-t border-border/40">
                  <button
                    onClick={() => handleTabNav('milestones')}
                    className="text-xs bg-primary/30 hover:bg-primary/50 text-primary rounded px-2 py-0.5 transition-colors"
                  >
                    View Timeline
                  </button>
                  <button
                    onClick={() => handleTabNav('intake')}
                    className="text-xs bg-muted hover:bg-muted-foreground/20 text-foreground/80 rounded px-2 py-0.5 transition-colors"
                  >
                    Adjust Parameters
                  </button>
                </div>
              </div>
            )}

            {thinking && (
              <div className="flex gap-2">
                <div className="w-5 h-5  bg-violet-700 flex items-center justify-center text-xs text-white font-bold flex-shrink-0">AI</div>
                <div className="bg-muted/60 border border-border/40  px-3 py-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5  bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5  bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5  bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick prompts */}
          <div className="px-4 py-2 border-t border-border/40 flex-shrink-0">
            <div className="flex flex-wrap gap-1">
              {QUICK_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleQuickPrompt(t.id)}
                  disabled={thinking}
                  className="text-xs text-muted-foreground/70 hover:text-muted-foreground bg-muted/40  px-2 py-0.5 border border-border/40 transition-colors disabled:opacity-40"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-border/40 flex-shrink-0 bg-card/95">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={chatMsg}
                onChange={e => setChatMsg(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                placeholder="Ask about permits, CFR, regulations..."
                className="flex-1 bg-background border border-border  px-3 py-2 text-xs text-foreground placeholder-gray-600 focus:outline-none focus:border-primary transition-colors"
                disabled={thinking}
              />
              <button
                onClick={sendChat}
                disabled={!chatMsg.trim() || thinking}
                className="bg-primary hover:bg-primary disabled:bg-muted disabled:text-muted-foreground/70 text-white px-3 py-2  text-xs font-semibold transition-colors flex-shrink-0"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}