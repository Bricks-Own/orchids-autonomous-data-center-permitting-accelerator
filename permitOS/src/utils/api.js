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
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };

  // Attach auth token if available (public endpoints like health/auth skip this)
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    headers,
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const res = await fetch(url, config);
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