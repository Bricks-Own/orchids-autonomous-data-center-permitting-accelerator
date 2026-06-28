import React, { useState, useRef, useEffect, useMemo } from 'react';
import { queryAgent, analyzeScenario, searchKnowledge, askKnowledgeAI, searchRegulations } from '../utils/api';

const QUICK_TEMPLATES = [
  { id: 'pathway', label: 'Permit pathway' },
  { id: 'ptes', label: 'PTE summary' },
  { id: 'scenario', label: 'Compare scenarios' },
  { id: 'water', label: 'Water permits' },
  { id: 'cfr', label: 'CFR by state' },
  { id: 'bact', label: 'BACT requirements' },
];

const SCENARIO_TYPES = ['greenfield', 'expansion', 'upsized', 'colocated'];

function makeQuickPrompt(templateId, inputs) {
  const site = inputs?.siteName || 'this site';
  const state = inputs?.state || 'the selected state';
  switch (templateId) {
    case 'pathway': return `What is the full permit pathway for ${site} in ${state}? Cover air (PSD/NSR/Title V) and water (NPDES/SPCC) requirements.`;
    case 'ptes': return `Summarize the PTE results for ${site} — baseline vs. controlled emissions per pollutant, major source thresholds, and Brick reduction strategy.`;
    case 'scenario': return `Compare greenfield, expansion, upsized, and colocated scenarios for a ${inputs?.turbines || ''} turbine data center in ${state}. Which is fastest and why?`;
    case 'water': return `What water permits are needed for ${site}? Include NPDES, SPCC, 316(b), SWPPP, and wetlands.`;
    case 'cfr': return `What are the key CFR regulatory requirements for data center gas turbines in ${state}? Cite specific 40 CFR parts.`;
    case 'bact': return `Explain the BACT top-down analysis for gas turbines at ${site}. What control technologies are evaluated and what is the recommended determination?`;
    default: return '';
  }
}

export default function SiteAssistant({ inputs, results, setActiveTab }) {
  const [open, setOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [chatHistory, setChatHistory] = useState(() => {
    const saved = typeof window !== 'undefined' && localStorage.getItem('permitos_assistant_chat');
    return saved ? JSON.parse(saved) : [
      {
        role: 'assistant',
        content: `I'm your PermitOS Site Assistant. I have full access to your site data, regulatory knowledge base (38 CFR documents across all 50 states), scenario analysis engine, and permit calculation results. Ask me anything about permitting, compliance, regulations, or site strategy.`,
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

  const sendChat = async () => {
    const msg = chatMsg.trim();
    if (!msg) return;
    setChatMsg('');
    setChatHistory(prev => [...prev, { role: 'user', content: msg }]);
    setThinking(true);
    setScenarioMode(null);
    setScenarioResult(null);

    // Check for scenario command pattern
    const lower = msg.toLowerCase();
    const scenarioMatch = lower.match(/run\s+(greenfield|expansion|upsized|colocated)\s+scenario/i);
    const stateCFRMatch = lower.match(/(?:cfr|regulation|requirement|rule)\s+(?:for|in|of)\s+([A-Za-z\s]+?)(?:\s*$|\s+(?:data center|turbine|permit|state))/i);

    try {
      if (scenarioMatch) {
        const scenarioType = scenarioMatch[1].toLowerCase();
        setScenarioMode(scenarioType);
        const data = await analyzeScenario(scenarioType, inputs || {});
        const analysis = data?.analysis;
        if (analysis) {
          setScenarioResult(analysis);
          const timeline = analysis.timelineMonths;
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: `## ${analysis.label} Scenario Analysis\n\n**Complexity:** ${analysis.complexity}  \n**Timeline:** ${timeline?.min || '?'}–${timeline?.max || '?'} months  \n**Permit Types:** ${analysis.permitTypes?.join(', ') || 'N/A'}\n\n${analysis.description}\n\n**Risks:**\n${analysis.keyRisks?.map(r => `- ${r}`).join('\n') || 'N/A'}\n\n**Opportunities:**\n${analysis.keyOpportunities?.map(o => `- ${o}`).join('\n') || 'N/A'}\n\n${analysis.specialConsiderations?.length > 0 ? `**Special Considerations:**\n${analysis.specialConsiderations.map(s => `- ${s}`).join('\n')}` : ''}\n\n*Scenario analysis complete. You can view the full milestone timeline in the Milestone Timeline tab.*`
          }]);
        }
      } else if (stateCFRMatch && !lower.includes('scenario')) {
        // State-specific CFR query — search both RAG and Knowledge Hub
        const stateName = stateCFRMatch[1].trim();
        const combinedQuery = `CFR regulatory requirements for data center gas turbines in ${stateName}`;
        const [ragData, kbData] = await Promise.allSettled([
          searchRegulations(combinedQuery, { limit: 5 }),
          searchKnowledge(combinedQuery, { limit: 5 }),
        ]);
        const ragResults = ragData.value?.results || [];
        const kbResults = kbData.value?.results || [];
        const allSources = [...ragResults, ...kbResults].slice(0, 8);

        if (allSources.length > 0) {
          const response = await queryAgent(combinedQuery, {
            inputs: inputs || {},
            results: results || {},
            conversationHistory: chatHistory.slice(-4),
          });
          const answerText = response?.content || response?.answer || response?.response || '';
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: answerText || `Found ${allSources.length} relevant regulatory sources for ${stateName}. The regulatory database covers applicable CFR requirements including air permits (PSD/NSR/Title V), water permits (NPDES/SPCC/316(b)), and state-specific rules. Check the Knowledge Hub tab for a full list of sources.`
          }]);
        } else {
          setChatHistory(prev => [...prev, {
            role: 'assistant',
            content: `I searched the regulatory knowledge base for ${stateName}. While specific results were limited for this exact query, the database covers 38 regulatory documents across air (PSD, NSPS, NESHAP, Title V, GHGRP), water (NPDES, SPCC, 316(b), wetlands), and state-specific rules. Try a more specific query or visit the Knowledge Hub tab to browse by category.`
          }]);
        }
      } else {
        // General query — full LLM + RAG
        const response = await queryAgent(msg, {
          inputs: inputs || {},
          results: results || {},
          conversationHistory: chatHistory.slice(-6),
        });
        const answerText = response?.content || response?.answer || response?.response || '';
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: answerText || `I processed your question through the permit database. For a more detailed analysis, try visiting the relevant tab: Air Permit AI, Water Permit AI, or Knowledge Hub.`
        }]);
      }
    } catch {
      // Fallback
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `I encountered a connection issue. Here's what I can tell you about "${msg}" for ${siteName}:

**Key Permits Required:**
- **Air:** PSD/NSR applicability determined by ${inputs?.state || 'your state'} attainment status and total PTE. ${results?.pathway?.requiresPSD ? 'PSD major source BACT review required.' : 'Below PSD thresholds — synthetic minor pathway viable.'}
- **Water:** NPDES for cooling tower blowdown, SPCC for diesel storage, SWPPP for construction.
- **State:** ${inputs?.state || 'N/A'} rules may impose additional requirements.

The connection will be restored automatically. In the meantime, you can navigate to the relevant tab for detailed analysis.`
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
    setChatHistory(prev => [...prev, { role: 'user', content: msg }]);
    setThinking(true);
    setScenarioMode(null);
    setScenarioResult(null);
    try {
      const response = await queryAgent(msg, {
        inputs: inputs || {},
        results: results || {},
        conversationHistory: chatHistory.slice(-6),
      });
      const answerText = response?.content || response?.answer || response?.response || '';
      setChatHistory(prev => [...prev, { role: 'assistant', content: answerText }]);
    } catch {
      setChatHistory(prev => [...prev, { role: 'assistant', content: `I'm processing your question about "${msg.substring(0, 60)}..." for ${siteName}. The LLM connection will be restored automatically. Check the relevant tabs for detailed analysis.` }]);
    }
    setThinking(false);
  };

  const handleTabNav = (tab) => {
    if (setActiveTab) setActiveTab(tab);
    setOpen(false);
  };

  const clearChat = () => {
    setChatHistory([
      { role: 'assistant', content: `Chat cleared. I'm still connected to ${siteName} — ask me anything about permitting, compliance, or regulations.` }
    ]);
    localStorage.removeItem('permitos_assistant_chat');
  };

  return (
    <>
      {/* Chat bubble button */}
      <button
        onClick={() => setOpen(!open)}
        className={`fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full shadow-xl transition-all duration-300 flex items-center justify-center
          ${open ? 'bg-gray-800 scale-90' : 'bg-indigo-600 hover:bg-indigo-500 hover:scale-105'}`}
        title="Site Assistant"
      >
        {open ? (
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
        <div className="fixed bottom-20 right-5 z-40 w-[400px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-10rem)] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900/95 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-900/40 flex-shrink-0">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-200 truncate">PermitOS Assistant</div>
              <div className="text-xs text-green-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                {hasResults ? `${siteName} loaded` : 'Site ready'}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="text-xs text-gray-600 hover:text-gray-400 bg-gray-800 rounded-lg px-2 py-1 transition-colors"
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
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5
                  ${msg.role === 'user' ? 'bg-indigo-700 text-white' : 'bg-violet-700 text-white'}`}>
                  {msg.role === 'user' ? 'U' : 'AI'}
                </div>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap
                  ${msg.role === 'user'
                    ? 'bg-indigo-700/30 border border-indigo-700/40 text-indigo-100'
                    : 'bg-gray-800/60 border border-gray-700/40 text-gray-300'}`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Scenario analysis result card */}
            {scenarioResult && (
              <div className="bg-gray-800/60 border border-indigo-700/40 rounded-xl p-3 text-xs">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-indigo-400 font-semibold">Scenario: {scenarioResult.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    scenarioResult.complexity === 'high' ? 'bg-red-900/30 text-red-400' :
                    scenarioResult.complexity === 'moderate' ? 'bg-amber-900/30 text-amber-400' :
                    'bg-green-900/30 text-green-400'
                  }`}>{scenarioResult.complexity}</span>
                </div>
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="text-gray-500">Timeline:</span>
                  <span className="text-gray-200 font-semibold">
                    {scenarioResult.timelineMonths?.min}–{scenarioResult.timelineMonths?.max} months
                  </span>
                </div>
                {scenarioResult.permitTypes?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {scenarioResult.permitTypes.slice(0, 4).map((p, i) => (
                      <span key={i} className="bg-gray-800 text-gray-400 rounded px-1.5 py-0.5">{p}</span>
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5 mt-2 pt-1.5 border-t border-gray-700/40">
                  <button
                    onClick={() => handleTabNav('milestones')}
                    className="text-xs bg-indigo-700/30 hover:bg-indigo-700/50 text-indigo-300 rounded px-2 py-0.5 transition-colors"
                  >
                    View Timeline
                  </button>
                  <button
                    onClick={() => handleTabNav('intake')}
                    className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded px-2 py-0.5 transition-colors"
                  >
                    Adjust Parameters
                  </button>
                </div>
              </div>
            )}

            {thinking && (
              <div className="flex gap-2">
                <div className="w-5 h-5 rounded-full bg-violet-700 flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0">AI</div>
                <div className="bg-gray-800/60 border border-gray-700/40 rounded-xl px-3 py-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick prompts */}
          <div className="px-4 py-2 border-t border-gray-800/40 flex-shrink-0">
            <div className="flex flex-wrap gap-1">
              {QUICK_TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleQuickPrompt(t.id)}
                  disabled={thinking}
                  className="text-[10px] text-gray-600 hover:text-gray-400 bg-gray-800/40 rounded-full px-2 py-0.5 border border-gray-700/40 transition-colors disabled:opacity-40"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-gray-800/40 flex-shrink-0 bg-gray-900/95">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={chatMsg}
                onChange={e => setChatMsg(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                placeholder="Ask about permits, CFR, scenarios..."
                className="flex-1 bg-gray-950 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                disabled={thinking}
              />
              <button
                onClick={sendChat}
                disabled={!chatMsg.trim() || thinking}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-600 text-white px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex-shrink-0"
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