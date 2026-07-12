// ─── Brick PermitOS Backend API Client ───────────────────────────────────────
// Authenticated client for all backend endpoints.

// Uses relative /api path — in dev, Vite proxy forwards to the backend.
// In production, VITE_API_URL should be set to the deployed backend URL.
const API_BASE = import.meta.env.VITE_API_URL || '/api';

// ─── Auth Token Management ─────────────────────────────────────────────────
let authToken = null;

export function setAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('permitos_token', token);
  } else {
    localStorage.removeItem('permitos_token');
  }
}

export function getAuthToken() {
  if (!authToken) {
    authToken = localStorage.getItem('permitos_token');
  }
  return authToken;
}

export function isAuthenticated() {
  return !!getAuthToken();
}

export function clearAuth() {
  authToken = null;
  localStorage.removeItem('permitos_token');
  window.dispatchEvent(new Event('permitos:session-expired'));
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };

  // Determine if this is a public auth endpoint — never send token to auth endpoints
  const isPublicEndpoint = endpoint.startsWith('/auth/') || endpoint === '/health';
  if (!isPublicEndpoint) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const config = {
    headers,
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const res = await fetch(url, config);

  // On 401, clear expired/invalid token and redirect to login
  if (res.status === 401 && !isPublicEndpoint) {
    clearAuth();
    // If not a public endpoint, throw a specific error the UI can handle
    throw new Error('Session expired. Please sign in again.');
  }

  if (!res.ok) {
    let errMsg;
    try {
      const err = await res.json();
      errMsg = err.error || err.detail || `HTTP ${res.status}`;
    } catch {
      errMsg = res.statusText || `HTTP ${res.status}`;
    }
    throw new Error(errMsg);
  }
  return res.json();
}

// ─── Auth ──────────────────────────────────────────────────────────────────
export async function register(email, password, name) {
  const data = await request('/auth/register', {
    method: 'POST',
    body: { email, password, name },
  });
  if (data.token) setAuthToken(data.token);
  return data;
}

export async function login(email, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (data.token) setAuthToken(data.token);
  return data;
}

export async function getProfile() {
  return request('/me');
}

export function logout() {
  clearAuth();
}

// ─── Health ────────────────────────────────────────────────────────────────
export async function checkHealth() {
  return request('/health');
}

// ─── PTE Calculation ─────────────────────────────────────────────────────────
export async function calculatePTE(inputs) {
  return request('/calculate', {
    method: 'POST',
    body: { inputData: inputs },
  });
}

// ─── Compliance Agent Query (LLM-powered) ──────────────────────────────────
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

// ─── RAI Response Generation (LLM-powered) ─────────────────────────────────
export async function generateRAIResponse(question, siteData) {
  return request('/rai/respond', {
    method: 'POST',
    body: { question, siteData },
  });
}

// ─── LLM Document Section ──────────────────────────────────────────────────
export async function generateDocumentSection(sectionName, inputs, results) {
  return request('/document/section', {
    method: 'POST',
    body: { sectionName, inputs, results },
  });
}

// ─── State Attainment Status ─────────────────────────────────────────────────
export async function getAttainment(state) {
  return request(`/attainment/${encodeURIComponent(state)}`);
}

// ─── Tools ───────────────────────────────────────────────────────────────────
export async function getTools() {
  return request('/tools');
}

// ─── Sites ──────────────────────────────────────────────────────────────────
export async function listSites() {
  return request('/sites');
}

export async function createSite(data) {
  return request('/sites', {
    method: 'POST',
    body: data,
  });
}

export async function getSite(id) {
  return request(`/sites/${id}`);
}

export async function updateSite(id, data) {
  return request(`/sites/${id}`, {
    method: 'PUT',
    body: data,
  });
}

export async function deleteSite(id) {
  return request(`/sites/${id}`, {
    method: 'DELETE',
  });
}

// ─── Documents ──────────────────────────────────────────────────────────────
export async function generateDocument(type, num, inputs, results, siteId = null) {
  return request('/documents/generate', {
    method: 'POST',
    body: { docType: type, docNum: num, inputs, results, siteId },
  });
}

export async function listDocuments(siteId) {
  return request(`/sites/${siteId}/documents`);
}

// ─── Compliance ────────────────────────────────────────────────────────────
export async function createComplianceCheck(siteId, mod, details) {
  return request('/compliance/check', {
    method: 'POST',
    body: { siteId, module: mod, details },
  });
}

export async function listComplianceChecks(siteId) {
  return request(`/sites/${siteId}/compliance`);
}

// ─── Chat ──────────────────────────────────────────────────────────────────
export async function getChatHistory(siteId) {
  return request(`/sites/${siteId}/chat`);
}

export async function sendChatMessage(siteId, content) {
  return request(`/sites/${siteId}/chat`, {
    method: 'POST',
    body: { content, role: 'user' },
  });
}

// ─── Knowledge Search ──────────────────────────────────────────────────
export async function searchKnowledge(query, { category = null, limit = 10 } = {}) {
  return request('/knowledge/search', {
    method: 'POST',
    body: { query, category, limit },
  });
}

export async function askKnowledgeAI(query, inputs = null) {
  return request('/knowledge/ask', {
    method: 'POST',
    body: { query, inputs },
  });
}

export async function getKnowledgeCategories() {
  return request('/knowledge/categories');
}

export async function getKnowledgeStats() {
  return request('/knowledge/stats');
}

// ─── Permit Scoring ────────────────────────────────────────────────────
export async function getPermitScore(inputs, results = {}) {
  return request('/scoring/permits', {
    method: 'POST',
    body: { inputs, results },
  });
}

// ─── Scenario Analysis ─────────────────────────────────────────────────
export async function analyzeScenario(scenario, inputs = {}) {
  return request('/scenarios/analyze', {
    method: 'POST',
    body: { scenario, inputs },
  });
}

export async function listScenarios() {
  return request('/scenarios/list');
}

// ─── Internet Data Pull for Chatbot ───────────────────────────────────────
export async function webFetch(url, query) {
  return request('/agent/web-fetch', {
    method: 'POST',
    body: { url, query },
  });
}

// ─── AI Query with Internet Data ─────────────────────────────────────────
export async function queryAgentWithWeb(query, { inputs = null, results = null, conversationHistory = [] } = {}) {
  return request('/agent/ask-with-web', {
    method: 'POST',
    body: { query, inputs, results, conversationHistory },
  });
}

// ─── Download Helper ─────────────────────────────────────────────────────────
export async function downloadBlob(endpoint, filename, body) {
  const url = `${API_BASE}${endpoint}`;
  const token = getAuthToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let errMsg;
    try { const err = await res.json(); errMsg = err.error || `HTTP ${res.status}`; }
    catch { errMsg = `HTTP ${res.status}`; }
    throw new Error(errMsg);
  }

  // Check if response is JSON or binary
  const contentType = res.headers.get('Content-Type') || '';
  if (contentType.includes('json')) {
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename || 'export.json';
    link.click();
    URL.revokeObjectURL(link.href);
    return data;
  }

  const blob = await res.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename || 'export';
  link.click();
  URL.revokeObjectURL(link.href);
  return { status: 'downloaded' };
}

// ─── Compliance Report ───────────────────────────────────────────────────────
export async function generateComplianceReport(siteId, conditionId, inputs, results) {
  return request('/compliance/generate-report', {
    method: 'POST',
    body: { siteId, conditionId, inputs, results },
  });
}

// ─── Export Audit Log ────────────────────────────────────────────────────────
export async function exportAuditLog(siteId, format = 'csv') {
  return downloadBlob('/compliance/export-audit', `audit-log-${new Date().toISOString().split('T')[0]}.${format}`, { siteId, format });
}

// ─── Export Word Doc ─────────────────────────────────────────────────────────
export async function exportDocx(title, sections) {
  return downloadBlob('/compliance/export-docx', `${title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 60)}.docx`, { title, sections });
}

// ─── Export RAI as Word Doc ──────────────────────────────────────────────────
export async function exportRAIDocx(raiId, question, answer, inputs) {
  return downloadBlob('/compliance/rai-docx', `RAI-Response-${raiId || 'draft'}.docx`, { raiId, question, answer, inputs });
}

// ─── Audit Log Entry ─────────────────────────────────────────────────────────
export async function createAuditLogEntry(siteId, action, details) {
  return request('/compliance/audit-log', {
    method: 'POST',
    body: { siteId, action, details },
  });
}

// ─── Agency Submission ───────────────────────────────────────────────────────
export async function agencySubmit(siteId, docType, docNum, agency, notes) {
  return request('/agency/submit', {
    method: 'POST',
    body: { siteId, docType, docNum, agency, notes },
  });
}

export async function listAgencySubmissions() {
  return request('/agency/submissions');
}
// ─── Construction Platform ──────────────────────────────────────────────
export async function fetchConstructionData(siteId, inputs = {}, results = {}) {
  return request(`/construction/${encodeURIComponent(siteId)}`, {
    method: "POST",
    body: { inputs, results },
  });
}

export async function saveConstructionData(siteId, data) {
  return request(`/construction/${encodeURIComponent(siteId)}`, {
    method: 'PUT',
    body: data,
  });
}
