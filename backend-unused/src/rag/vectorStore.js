import { getDb } from '../db/database.js';

// ─── Simple TF-IDF Vector Store ──────────────────────────────────────────────
// No external dependencies. Uses term frequency for retrieval.

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function buildTermFreq(tokens) {
  const freq = {};
  for (const t of tokens) freq[t] = (freq[t] || 0) + 1;
  return freq;
}

// Pre-compute IDF across all documents
let idfCache = null;
let docCount = 0;

function computeIDF() {
  if (idfCache) return idfCache;
  const db = getDb();
  const rows = db.prepare('SELECT chunk_text FROM regulation_chunks').all();
  docCount = rows.length;
  const df = {};
  for (const row of rows) {
    const terms = new Set(tokenize(row.chunk_text));
    for (const t of terms) df[t] = (df[t] || 0) + 1;
  }
  idfCache = {};
  for (const [term, count] of Object.entries(df)) {
    idfCache[term] = Math.log((docCount + 1) / (count + 1)) + 1;
  }
  return idfCache;
}

function computeTFIDF(tf, idf) {
  const vec = {};
  for (const [term, freq] of Object.entries(tf)) {
    vec[term] = freq * (idf[term] || 1);
  }
  return vec;
}

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  const allTerms = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const t of allTerms) {
    const va = a[t] || 0;
    const vb = b[t] || 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export function searchRegulations(query, options = {}) {
  const {
    category = null,
    limit = 10,
    minScore = 0.05,
  } = options;

  const db = getDb();
  const idf = computeIDF();
  const queryTokens = tokenize(query);
  const queryTF = buildTermFreq(queryTokens);
  const queryVec = computeTFIDF(queryTF, idf);

  let rows;
  if (category) {
    rows = db.prepare('SELECT id, cfr_title, cfr_part, cfr_section, category, subcategory, chunk_index, chunk_text FROM regulation_chunks WHERE category = ?').all(category);
  } else {
    rows = db.prepare('SELECT id, cfr_title, cfr_part, cfr_section, category, subcategory, chunk_index, chunk_text FROM regulation_chunks').all();
  }

  const scored = rows.map(row => {
    const docTokens = tokenize(row.chunk_text);
    const docTF = buildTermFreq(docTokens);
    const docVec = computeTFIDF(docTF, idf);
    const score = cosineSimilarity(queryVec, docVec);
    return { ...row, score };
  });

  return scored
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function searchStateRules(state, query, limit = 5) {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM state_rules WHERE state = ?').all(state);
  if (!query) return rows.slice(0, limit);

  const idf = computeIDF();
  const queryTokens = tokenize(query);
  const queryTF = buildTermFreq(queryTokens);
  const queryVec = computeTFIDF(queryTF, idf);

  const scored = rows.map(row => {
    const docTokens = tokenize(row.rule_text);
    const docTF = buildTermFreq(docTokens);
    const docVec = computeTFIDF(docTF, idf);
    const score = cosineSimilarity(queryVec, docVec);
    return { ...row, score };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function clearIDFCache() {
  idfCache = null;
}