// ─── Brick PermitOS Backend API Client ───────────────────────────────────────

// In development, point to backend server directly (CORS enabled).
// In production, VITE_API_URL should be set to the deployed backend URL.
const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const res = await fetch(url, config);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── PTE Calculation ─────────────────────────────────────────────────────────
export async function calculatePTE(inputs) {
  return request('/calculate/pte', {
    method: 'POST',
    body: inputs,
  });
}

// ─── Compliance Agent Query ──────────────────────────────────────────────────
export async function queryAgent(query, { inputs = null, results = null, conversationHistory = [] } = {}) {
  return request('/agent/query', {
    method: 'POST',
    body: { query, inputs, results, conversationHistory },
  });
}

// ─── RAG Regulation Search ───────────────────────────────────────────────────
export async function searchRegulations(query, { category = null, limit = 10 } = {}) {
  return request('/rag/search', {
    method: 'POST',
    body: { query, category, limit },
  });
}

// ─── State Attainment Status ─────────────────────────────────────────────────
export async function getAttainment(state) {
  return request(`/attainment/${encodeURIComponent(state)}`);
}

// ─── Document Generation ─────────────────────────────────────────────────────
export async function generateDocument(type, num, inputs, results, screeningId = null) {
  return request('/document/generate', {
    method: 'POST',
    body: { type, num, inputs, results, screening_id: screeningId },
  });
}

export async function generateAllDocuments(inputs, results, screeningId = null) {
  return request('/document/generate-all', {
    method: 'POST',
    body: { inputs, results, screening_id: screeningId },
  });
}

export async function downloadDocuments(documents, siteName) {
  return request('/document/download', {
    method: 'POST',
    body: { documents, siteName },
  });
}

// ─── Conversation History ────────────────────────────────────────────────────
export async function getConversation(screeningId) {
  return request(`/conversation/${screeningId}`);
}

export async function saveConversationMessage(screeningId, role, content, agentData = null) {
  return request('/conversation', {
    method: 'POST',
    body: { screening_id: screeningId, role, content, agent_data: agentData },
  });
}

// ─── Tools ───────────────────────────────────────────────────────────────────
export async function getTools() {
  return request('/tools');
}

// ─── Health ──────────────────────────────────────────────────────────────────
export async function checkHealth() {
  return request('/health');
}