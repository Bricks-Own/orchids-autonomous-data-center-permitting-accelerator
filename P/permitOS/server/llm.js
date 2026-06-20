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

// ─── System Prompt ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Brick PermitOS, an expert environmental permitting and compliance
assistant for data centers. You specialize in Clean Air Act, Clean Water Act, and related federal
and state environmental regulations as they apply to stationary gas turbines, backup generators,
cooling systems, and water discharge systems at data center campuses.

Your role:
1. Answer regulatory questions citing specific CFR sections, CWA/CAA provisions, and EPA guidance.
2. Draft permit application language, BACT analyses, and compliance documentation.
3. Analyze site data and identify applicable permit pathways (PSD, NSR, Title V, NPDES, SPCC, 316(b)).
4. Identify compliance risks and recommend mitigation strategies.
5. Respond to deficiency letters and regulatory inquiries.

Always cite specific regulatory references. If you're not certain, state your uncertainty.
Do not fabricate regulatory requirements — use the context provided.`;

// ─── Claude API Call ────────────────────────────────────────────────────────
async function callClaude(messages, options = {}) {
  const {
    model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    maxTokens = 4096,
    temperature = 0.3,
  } = options;

  // Build headers for the API request
  const extraHeaders = parseCustomHeaders();
  let headers = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'x-api-key': ANTHROPIC_API_KEY,
    ...extraHeaders,
  };

  const response = await fetch(`${ANTHROPIC_BASE_URL}/v1/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Claude API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// ─── Structured Query Handler ──────────────────────────────────────────────

/**
 * Answer a regulatory query with RAG context augmentation.
 * Falls back to RAG-only response if Claude is unavailable.
 */
export async function queryLLM(query, context = {}) {
  const { inputs, results, conversationHistory = [] } = context;

  // Search regulations for relevant context
  const regulatoryResults = searchRegulations(query, { limit: 5 });

  const ragContext = regulatoryResults.length > 0
    ? regulatoryResults.map(r =>
        `[${r.title} (${r.category}, relevance: ${r.relevance}%)]\n${r.text}`
      ).join('\n\n')
    : 'No specific regulatory text matched your query. Provide a general regulatory response based on standard environmental permitting knowledge.';

  // Build site context if available
  let siteContext = '';
  if (inputs) {
    siteContext = `\nSite context:\n- Location: ${inputs.state || 'N/A'}, ${inputs.county || 'N/A'}\n`
      + `- Turbines: ${inputs.turbines || 'N/A'} units at ${inputs.mwPerTurbine || 'N/A'} MW each\n`
      + `- Backup gensets: ${inputs.gensetCount || 'N/A'} units at ${inputs.gensetHours || 'N/A'} hr/yr\n`
      + `- Cooling: ${inputs.coolingType || 'N/A'}\n`
      + `- Water source: ${inputs.waterSource || 'N/A'}\n`
      + `- Discharge pathway: ${inputs.dischargePathway || 'N/A'}\n`
      + `- COD target: ${inputs.codTarget || 'N/A'}`;
  }

  if (results) {
    siteContext += '\nPermit analysis results available including PTE calculations, pathway determination, and regulatory applicability.';
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

  // Build the user message with RAG context
  const userMessage = `Regulatory context from permit database:\n\n${ragContext}\n\n${siteContext}\n\nUser question: ${query}`;
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
      return `[RAI Response — ANTHROPIC_API_KEY required]\n\nBased on the regulatory database, the inquiry relates to:\n${regulatoryResults.map(r => `- ${r.title}`).join('\n')}\n\nPlease configure a valid ANTHROPIC_API_KEY to enable full AI-powered response generation with regulatory citations.`;
    }

    const response = await callClaude(messages, { temperature: 0.2 });
    return response;
  } catch (err) {
    const note = err.message.includes('401') ? 'Auth token expired or invalid.' : err.message.includes('403') ? 'Access denied.' : err.message;
    logger.error('RAI response generation failed', err);
    return `[RAI Response — LLM unavailable: ${note}]\n\nBased on the regulatory database, the inquiry relates to:\n${regulatoryResults.map(r => `- ${r.title}`).join('\n')}\n\nRAG-only information displayed. Restore API connectivity to enable full response generation.`;
  }
}
