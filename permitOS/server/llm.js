// ─── Real LLM Integration — Claude API via Anthropic SDK ────────────────────
// Provides regulatory analysis, document drafting, and compliance QA
// using Anthropic Claude with RAG-context from regulatory corpus.
//
// Supports direct Anthropic API key (ANTHROPIC_API_KEY) or
// proxy endpoint via ANTHROPIC_BASE_URL + custom auth header (ANTHROPIC_CUSTOM_HEADERS).

import { searchRegulations } from './rag.js';
import { logger } from './middleware.js';

// ─── Configuration ──────────────────────────────────────────────────────────
// Supports multiple auth patterns:
//   1. Direct: ANTHROPIC_API_KEY
//   2. Proxy: ANTHROPIC_AUTH_TOKEN + ANTHROPIC_BASE_URL
//   3. Proxy with custom header: ANTHROPIC_BASE_URL + ANTHROPIC_CUSTOM_HEADERS (from Orchestrator)
// The API key is taken from ANTHROPIC_API_KEY first, then ANTHROPIC_AUTH_TOKEN.
// Custom headers from ANTHROPIC_CUSTOM_HEADERS are parsed (supports newline or comma separators).
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '';
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const IS_PROXY = !!process.env.ANTHROPIC_BASE_URL;

// Debug log at module load time
console.error('[LLM DEBUG] Loaded at', new Date().toISOString());
console.error('[LLM DEBUG] ANTHROPIC_BASE_URL:', IS_PROXY ? process.env.ANTHROPIC_BASE_URL?.substring(0, 60) : 'NOT SET');
console.error('[LLM DEBUG] ANTHROPIC_API_KEY length:', ANTHROPIC_API_KEY.length);
console.error('[LLM DEBUG] IS_PROXY:', IS_PROXY);
console.error('[LLM DEBUG] CUSTOM_HEADERS length:', (process.env.ANTHROPIC_CUSTOM_HEADERS || '').length);

// When using a proxy, the auth may be via custom headers (not x-api-key).
// Parse custom headers from ANTHROPIC_CUSTOM_HEADERS env var.
// Supports both newline-separated and comma-separated formats.
function parseCustomHeaders() {
  const raw = (process.env.ANTHROPIC_CUSTOM_HEADERS || '').trim();
  if (!raw) return {};
  const headers = {};

  // Try splitting by newline first, then fall back to comma
  const lines = raw.includes('\n') ? raw.split('\n') : raw.split(',');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx > 0) {
      const key = trimmed.substring(0, colonIdx).trim();
      const val = trimmed.substring(colonIdx + 1).trim();
      if (key && val) headers[key] = val;
    }
  }
  return headers;
}

// ─── General-Purpose System Prompt ─────────────────────────────────────────
// Used for ALL query types: permit pathways, scenario analysis, CFR lookup,
// compliance Q&A, document drafting, and strategic advisory.
const SYSTEM_PROMPT = `You are Brick PermitOS Site Assistant, a comprehensive data center permitting
and compliance AI. You have full access to the site's permit analysis data, scenario
engineering engine, and a regulatory knowledge base covering 38 documents across
all 50 states (air, water, state-specific, and general regulations).

CAPABILITIES — handle ANY of these query types:

1. PERMIT PATHWAY: Full air (PSD/NSR/Title V) + water (NPDES/SPCC/316(b)/SWPPP/wetlands)
   pathway. Cite 40 CFR parts per state attainment status.

2. PTE & EMISSIONS: Baseline vs. controlled PTE per pollutant. Major source thresholds.
   Synthetic minor strategies. Brick dispatch savings. AP-42 factors.

3. SCENARIO ANALYSIS: Compare greenfield/expansion/upsized/colocated — timelines,
   complexity, permit types, risks, and opportunities per state.

4. CFR LOOKUP BY STATE: Retrieve applicable 40 CFR Parts 50-140 for any state.
   Include attainment status, state-specific rules, and key citations.

5. BACT/LAER: Top-down analysis, DLN/SCR/oxidation catalyst, cost-effectiveness, RBLC.

6. WATER: NPDES individual permit, SPCC, 316(b), SWPPP, wetlands, POTW pretreatment.

7. COMPLIANCE: Title V certification, NSPS KKKK, NESHAP YYYY/ZZZZ, CEMS, GHGRP.

8. DOCUMENTS: Application language, BACT drafts, PTE workbooks, compliance matrices.

9. EJ: EJScreen, EO 14096, community engagement, health impact analysis.

10. STRATEGY: Timeline acceleration, risk mitigation, agency engagement, synthetic minor.

Always cite specific regulatory references (CFR, CAA/CWA, EPA guidance). If uncertain,
say so. Do not fabricate requirements. Use the provided regulatory context.`;

// ─── Claude API Call ────────────────────────────────────────────────────────
async function callClaude(messages, options = {}) {
  const {
    model = IS_PROXY ? 'claude-sonnet-4-6' : 'claude-sonnet-4-20250514',
    maxTokens = 4096,
    temperature = 0.3,
  } = options;

  // Build headers for the API request
  const extraHeaders = parseCustomHeaders();
  let headers = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    ...extraHeaders,
  };

  // Only send x-api-key in direct mode (not proxy mode)
  if (!IS_PROXY && ANTHROPIC_API_KEY) {
    headers['x-api-key'] = ANTHROPIC_API_KEY;
  }

  // Build the request body
  // Proxy mode (DeepSeek/OpenRouter via Orchids) does NOT support the `system` field
  // at top level or in messages array — it returns 401.
  // Instead, inline the system prompt into the first user message.
  let body;
  if (IS_PROXY) {
    // Clone messages and inline system prompt into first user message
    const proxyMessages = messages.map(m => ({ ...m }));
    if (proxyMessages.length > 0 && proxyMessages[0].role === 'user') {
      proxyMessages[0] = {
        role: 'user',
        content: `${SYSTEM_PROMPT}\n\n${proxyMessages[0].content}`,
      };
    } else {
      proxyMessages.unshift({ role: 'user', content: SYSTEM_PROMPT });
    }
    body = { model, max_tokens: maxTokens, temperature, messages: proxyMessages };
  } else {
    body = { model, max_tokens: maxTokens, temperature, system: SYSTEM_PROMPT, messages };
  }

  console.error('[LLM CALL] Sending to:', ANTHROPIC_BASE_URL + '/v1/messages');
  console.error('[LLM CALL] Model:', model);
  console.error('[LLM CALL] IS_PROXY:', IS_PROXY);

  const response = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    console.error('[LLM CALL] Response status:', response.status);
    console.error('[LLM CALL] Response body:', errorBody);
    throw new Error(`Claude API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  // Proxy (DeepSeek/OpenRouter) may return extended thinking blocks.
  // Find the text content block instead of assuming content[0].
  const textBlock = data.content.find(c => c.type === 'text');
  return textBlock ? textBlock.text : '';
}

// ─── Structured Query Handler ──────────────────────────────────────────────

/**
 * Answer a regulatory query with RAG context augmentation.
 * Falls back to RAG-only response if Claude is unavailable.
 */
export async function queryLLM(query, context = {}) {
  const { inputs, results, conversationHistory = [], webContent, webSource, ragResults } = context;

  // Search regulations for relevant context (skip if pre-searched)
  const regulatoryResults = ragResults && ragResults.length > 0
    ? ragResults
    : searchRegulations(query, { limit: 5 });

  // Build RAG context string
  let ragContextText = '';
  if (regulatoryResults && regulatoryResults.length > 0) {
    ragContextText = regulatoryResults.map(r =>
      `[${r.title} (${r.category}, relevance: ${r.relevance}%)]\n${r.text}`
    ).join('\n\n');
  } else {
    ragContextText = 'No specific regulatory text matched your query. Provide a general regulatory response based on standard environmental permitting knowledge.';
  }

  // Add internet data if available
  let internetDataSection = '';
  if (webContent) {
    internetDataSection = `\n\nInternet data from authoritative source (${webSource || 'EPA/eCFR'}):\n${typeof webContent === 'string' ? webContent.substring(0, 10000) : JSON.stringify(webContent).substring(0, 10000)}`;
  }

  // Build site context if available
  let siteContext = '';
  if (inputs) {
    siteContext = `\nSite context:\n- Location: ${inputs.state || 'N/A'}, ${inputs.county || 'N/A'}\n`
      + `- Site name: ${inputs.siteName || 'N/A'}\n`
      + `- Turbines: ${inputs.turbines || 'N/A'} units at ${inputs.mwPerTurbine || 'N/A'} MW each (${(inputs.turbines * inputs.mwPerTurbine) || 'N/A'} MW total)\n`
      + `- Operating hours: ${inputs.hours || 'N/A'} hr/yr\n`
      + `- Turbine type: ${inputs.turbineType || 'N/A'}\n`
      + `- Backup gensets: ${inputs.gensetCount || 'N/A'} units at ${inputs.gensetHP || 'N/A'} HP, ${inputs.gensetHours || 'N/A'} hr/yr\n`
      + `- Cooling: ${inputs.coolingMGD || 'N/A'} MGD, ${inputs.blowdownPct || 'N/A'}% blowdown\n`
      + `- Water source: ${inputs.waterSource || 'N/A'}\n`
      + `- Discharge pathway: ${inputs.dischargePathway || 'N/A'}\n`
      + `- Water consumption: ${inputs.waterMGD || 'N/A'} MGD\n`
      + `- Site acreage: ${inputs.siteAcres || 'N/A'} acres\n`
      + `- Data center capacity: ${inputs.datacenterMW || 'N/A'} MW IT load\n`
      + `- Construction phases: ${inputs.phases || 'N/A'}\n`
      + `- COD target: ${inputs.codTarget || 'N/A'}\n`
      + `- Stack height: ${inputs.stackHeight || 'N/A'} ft\n`
      + `- Nearest receptor: ${inputs.nearestReceptorFt || 'N/A'} ft\n`
      + `- Nonattainment area: ${inputs.nonAttainment ? 'Yes' : 'No'}\n`
      + `- Brick dispatch savings: ${inputs.brickSavings || 'N/A'}%\n`
      + `- Heat rate: ${inputs.heatRate || 'N/A'} MMBtu/MWh`;
  }

  if (results) {
    siteContext += '\n\nPermit analysis results:';
    if (results.baseline) {
      siteContext += `\n- Baseline PTE (tpy): NOx=${results.baseline.nox?.toFixed(1)}, CO=${results.baseline.co?.toFixed(1)}, SO2=${results.baseline.so2?.toFixed(2)}, PM25=${results.baseline.pm25?.toFixed(2)}, VOC=${results.baseline.voc?.toFixed(2)}, CO2e=${results.baseline.co2e?.toFixed(0)}`;
    }
    if (results.controlled) {
      siteContext += `\n- Controlled PTE (tpy): NOx=${results.controlled.nox?.toFixed(1)}, CO=${results.controlled.co?.toFixed(1)}, CO2e=${results.controlled.co2e?.toFixed(0)}`;
    }
    if (results.pathway) {
      siteContext += `\n- Pathway: PSD=${results.pathway.requiresPSD}, SyntheticMinor=${results.pathway.requiresMinor}, TitleV=${results.pathway.requiresTitleV}, NPDES=${results.pathway.requiresNPDES}, SPCC=${results.pathway.requiresSPCC}`;
    }
    if (results.thresholds) {
      siteContext += `\n- Threshold breaches: ${results.thresholds.length} issue(s) identified`;
    }
    if (results.scenarioComparison) {
      siteContext += `\n- Scenario comparison available (${Object.keys(results.scenarioComparison).length} scenarios)`;
    }
  }

  // Build messages
  const messages = [];

  // Add up to 10 recent conversation messages for context
  if (conversationHistory && conversationHistory.length > 0) {
    const recent = conversationHistory.slice(-10);
    for (const msg of recent) {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      });
    }
  }

  // Build the user message with RAG context and internet data
  const userMessage = `Regulatory context from permit database:\n\n${ragContextText}${internetDataSection}\n\n${siteContext}\n\nUser question: ${query}`;
  messages.push({ role: 'user', content: userMessage });

  try {
    if (!ANTHROPIC_API_KEY) {
      logger.warn('No ANTHROPIC_API_KEY set, using RAG fallback');
      return buildFallbackResponse(query, regulatoryResults, inputs, results);
    }

    const response = await callClaude(messages);
    return {
      type: 'llm',
      content: response,
      sources: regulatoryResults.map(r => ({ title: r.title, relevance: r.relevance })),
    };
  } catch (err) {
    logger.error('LLM query failed, falling back to RAG-only response', err);
    return buildFallbackResponse(query, regulatoryResults, inputs, results, err.message);
  }
}

/**
 * Generate a document section using LLM with RAG context.
 */
export async function generateDocumentSection(sectionName, inputs, results) {
  const query = `Generate the "${sectionName}" section of a data center permit application document for a site in ${inputs.state || 'N/A'}, ${inputs.county || 'N/A'}. Include regulatory citations and site-specific analysis.`;

  const regulatoryResults = searchRegulations(query, { limit: 3 });
  const ragContext = regulatoryResults.map(r =>
    `[${r.title}]\n${r.text}`
  ).join('\n\n');

  const messages = [
    {
      role: 'user',
      content: `Using the following regulatory context:\n\n${ragContext}\n\nGenerate a professional, regulatory-grade "${sectionName}" section for a data center permit application. Use specific CFR citations and technical detail.`,
    },
  ];

  try {
    if (!ANTHROPIC_API_KEY) {
      return `[${sectionName} — LLM generation requires ANTHROPIC_API_KEY to be set. Using template-based content.]`;
    }

    const response = await callClaude(messages, { temperature: 0.2 });
    return response;
  } catch (err) {
    logger.error(`LLM document section generation failed for ${sectionName}`, err);
    return `[${sectionName} — LLM unavailable, using template content]`;
  }
}

// ─── Fallback Response ─────────────────────────────────────────────────────

function buildFallbackResponse(query, regulatoryResults, inputs, results, errMsg) {
  // Build a structured fallback from RAG results
  let content = '';

  if (regulatoryResults.length > 0) {
    content = `Based on the regulatory database, here is the relevant information for your query:\n\n`;
    for (const result of regulatoryResults) {
      content += `## ${result.title} (relevance: ${result.relevance}%)\n\n`;

      // Provide a concise summary (first 500 chars of full text)
      const summary = result.text.length > 500
        ? result.text.substring(0, 500) + '...'
        : result.text;

      content += `${summary}\n\n`;
    }

    const reason = errMsg ? ` (${errMsg.includes('401') ? 'auth token expired' : errMsg.includes('402') ? 'payment required' : errMsg.substring(0, 80)})` : '';
    content += `\n*Note: Claude AI integration unavailable${reason}. RAG-only regulatory results displayed above. For full LLM-powered analysis, ensure a valid ANTHROPIC_API_KEY is configured.*`;
  } else {
    content = `I could not find specific regulatory information matching your query in the permit database. Please try rephrasing or consult with a permitting specialist for guidance on: "${query}"`;
  }

  return {
    type: 'rag',
    limited: true,
    content,
    sources: regulatoryResults.map(r => ({ title: r.title, relevance: r.relevance })),
  };
}

// ─── RAI Response Generation ───────────────────────────────────────────────

/**
 * Generate response to a Regulatory Agency Inquiry / Deficiency Letter.
 */
export async function generateRAIResponse(question, siteData) {
  const query = `Respond to the following regulatory agency inquiry for a data center permit application: ${question}`;
  const regulatoryResults = searchRegulations(query, { limit: 4 });

  const messages = [
    {
      role: 'user',
      content: `Site: ${siteData?.siteName || 'N/A'}, State: ${siteData?.state || 'N/A'}\n\nRegulatory context:\n${regulatoryResults.map(r => r.text).join('\n\n')}\n\nRespond to this agency inquiry professionally and thoroughly:\n\n${question}`,
    },
  ];

  try {
    if (!ANTHROPIC_API_KEY) {
      return {
        type: 'rag',
        limited: true,
        content: `[RAI Response — ANTHROPIC_API_KEY required]\n\nBased on the regulatory database, the inquiry relates to:\n${regulatoryResults.map(r => `- ${r.title}`).join('\n')}\n\nPlease configure a valid ANTHROPIC_API_KEY to enable full AI-powered response generation with regulatory citations.`,
        sources: regulatoryResults.map(r => ({ title: r.title, relevance: r.relevance })),
      };
    }

    const response = await callClaude(messages, { temperature: 0.2 });
    return response;
  } catch (err) {
    const note = err.message.includes('401') ? 'Auth token expired or invalid.' : err.message.includes('403') ? 'Access denied.' : err.message;
    logger.error('RAI response generation failed', err);
    return `[RAI Response — LLM unavailable: ${note}]\n\nBased on the regulatory database, the inquiry relates to:\n${regulatoryResults.map(r => `- ${r.title}`).join('\n')}\n\nRAG-only information displayed. Restore API connectivity to enable full response generation.`;
  }
}