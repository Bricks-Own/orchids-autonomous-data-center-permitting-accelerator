import { Router } from 'express';
import { getDb } from '../db/database.js';
import { queryComplianceAgent, getAgentTools } from '../agents/complianceAgent.js';
import { calcPTE } from '../../../permitOS/src/utils/calculations.js';
import { generateDocument } from '../../../permitOS/src/utils/documentGenerator.js';
import { searchRegulations } from '../rag/vectorStore.js';
import { STATES_ATTAINMENT } from '../../../permitOS/src/data/permitData.js';
import { validateDocument, validateAllDocuments } from '../validation/complianceValidator.js';
import { generateEnhancedDocument } from '../tools/enhancedDocGen.js';

const api = Router();

// ─── Health Check ─────────────────────────────────────────────────────────────
api.get('/health', (req, res) => {
  const db = getDb();
  const chunkCount = db.prepare('SELECT COUNT(*) as count FROM regulation_chunks').get();
  const stateCount = db.prepare('SELECT COUNT(*) as count FROM state_rules').get();
  res.json({
    status: 'ok',
    database: {
      regulation_chunks: chunkCount.count,
      state_rules: stateCount.count,
    },
    tools: getAgentTools().map(t => t.name),
  });
});

// ─── PTE Calculation ─────────────────────────────────────────────────────────
api.post('/calculate/pte', (req, res) => {
  try {
    const inputs = req.body;
    if (!inputs) return res.status(400).json({ error: 'Inputs required' });

    const results = calcPTE(inputs);

    // Save to DB
    const db = getDb();
    const stmt = db.prepare(
      'INSERT INTO site_screenings (site_name, state, county, inputs_json, results_json) VALUES (?, ?, ?, ?, ?)'
    );
    const info = stmt.run(
      inputs.siteName || 'Unnamed Site',
      inputs.state || '',
      inputs.county || '',
      JSON.stringify(inputs),
      JSON.stringify(results)
    );

    res.json({
      id: info.lastInsertRowid,
      ...results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Compliance Agent Query ──────────────────────────────────────────────────
api.post('/agent/query', (req, res) => {
  try {
    const { query, inputs, results, conversationHistory } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    const agentResponse = queryComplianceAgent(query, {
      inputs: inputs || null,
      results: results || null,
      conversationHistory: conversationHistory || [],
    });

    res.json(agentResponse);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RAG Regulation Search ──────────────────────────────────────────────────
api.post('/rag/search', (req, res) => {
  try {
    const { query, category, limit = 10 } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    const results = searchRegulations(query, { category, limit });
    res.json({
      found: results.length,
      results: results.map(r => ({
        id: r.id,
        cfr: `${r.cfr_title} CFR Part ${r.cfr_part}${r.cfr_section ? ' ' + r.cfr_section : ''}`,
        category: r.category,
        subcategory: r.subcategory,
        relevance: Math.round(r.score * 100),
        text: r.chunk_text.substring(0, 600),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── State Attainment Status ─────────────────────────────────────────────────
api.get('/attainment/:state', (req, res) => {
  const state = req.params.state;
  const status = STATES_ATTAINMENT[state];
  if (!status) return res.status(404).json({ error: `State "${state}" not found` });
  res.json({ state, attainment_status: status });
});

// ─── Document Generation ─────────────────────────────────────────────────────
api.post('/document/generate', (req, res) => {
  try {
    const { type, num, inputs, results } = req.body;
    if (!type || num === undefined) return res.status(400).json({ error: 'type and num required' });

    const doc = generateDocument(type, parseInt(num), inputs || {}, results || {});

    if (!doc) return res.status(404).json({
      error: `Document ${type.toUpperCase()}-${String(parseInt(num)).padStart(3, '0')} not found`,
      available: type === 'air' ? '1-16' : '1-10',
    });

    // Save to DB if we have a screening ID
    let docId = null;
    if (req.body.screening_id) {
      const db = getDb();
      const stmt = db.prepare(
        'INSERT INTO generated_documents (screening_id, doc_key, doc_type, title, content, citations) VALUES (?, ?, ?, ?, ?, ?)'
      );
      const info = stmt.run(
        req.body.screening_id,
        `${type}_${num}`,
        type,
        doc.title,
        doc.sections.map(s => `${s.heading}\n\n${s.body}`).join('\n\n'),
        JSON.stringify(doc.citations || [])
      );
      docId = info.lastInsertRowid;
    }

    const fullContent = doc.sections.map(s => ({
      heading: s.heading,
      body: s.body,
    }));

    res.json({
      id: docId,
      docNum: doc.docNum,
      title: doc.title,
      sections: fullContent,
      wordCount: fullContent.reduce((s, sec) => s + sec.body.split(/\s+/).length, 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Batch Document Generation ───────────────────────────────────────────────
api.post('/document/generate-all', (req, res) => {
  try {
    const { inputs, results, screening_id } = req.body;
    if (!inputs) return res.status(400).json({ error: 'inputs required' });

    const types = [
      { type: 'air', count: 16 },
      { type: 'water', count: 10 },
    ];

    const documents = [];
    const db = getDb();
    const insertDoc = db.prepare(
      'INSERT INTO generated_documents (screening_id, doc_key, doc_type, title, content, citations) VALUES (?, ?, ?, ?, ?, ?)'
    );

    for (const { type, count } of types) {
      for (let num = 1; num <= count; num++) {
        try {
          const doc = generateDocument(type, num, inputs, results || {});
          if (doc) {
            const content = doc.sections.map(s => `${s.heading}\n\n${s.body}`).join('\n\n');
            let docId = null;
            if (screening_id) {
              const info = insertDoc.run(screening_id, `${type}_${num}`, type, doc.title, content, JSON.stringify(doc.citations || []));
              docId = info.lastInsertRowid;
            }
            documents.push({
              id: docId,
              docNum: doc.docNum,
              title: doc.title,
              type: type,
              num: num,
              wordCount: content.split(/\s+/).length,
            });
          }
        } catch (err) {
          documents.push({
            docNum: `${type.toUpperCase()}-${String(num).padStart(3, '0')}`,
            title: `Error: ${err.message}`,
            type, num,
            error: true,
          });
        }
      }
    }

    res.json({
      total: documents.length,
      generated: documents.filter(d => !d.error).length,
      failed: documents.filter(d => d.error).length,
      documents,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Compliance Validation ──────────────────────────────────────────────────
api.post('/document/validate', (req, res) => {
  try {
    const { docKey, inputs, results } = req.body;
    if (!docKey) return res.status(400).json({ error: 'docKey (e.g. air_1) required' });

    const validation = validateDocument(docKey, inputs || {}, results || {});
    res.json(validation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

api.post('/document/validate-all', (req, res) => {
  try {
    const { inputs, results } = req.body;
    const validation = validateAllDocuments(inputs || {}, results || {});
    res.json(validation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Enhanced Document Generation with RAG ──────────────────────────────────
api.post('/document/generate-enhanced', (req, res) => {
  try {
    const { type, num, inputs, results } = req.body;
    if (!type || num === undefined) return res.status(400).json({ error: 'type and num required' });

    const doc = generateEnhancedDocument(type, parseInt(num), inputs || {}, results || {});
    if (!doc) return res.status(404).json({ error: `Document ${type}_${num} not found` });

    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

api.post('/document/generate-all-enhanced', (req, res) => {
  try {
    const { inputs, results } = req.body;
    const documents = [];
    const types = [
      { type: 'air', count: 16 },
      { type: 'water', count: 10 },
    ];

    for (const { type, count } of types) {
      for (let num = 1; num <= count; num++) {
        const doc = generateEnhancedDocument(type, num, inputs || {}, results || {});
        if (doc) documents.push(doc);
      }
    }

    res.json({
      total: documents.length,
      documents,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Document Download (export as text) ──────────────────────────────────────
api.post('/document/download', (req, res) => {
  try {
    const { documents, siteName } = req.body;
    if (!documents || !documents.length) return res.status(400).json({ error: 'documents array required' });

    const lines = [];
    lines.push('BRICK PERMITOS™ — COMPLETE PERMIT PACKAGE');
    lines.push('═'.repeat(80));
    lines.push(`Facility: ${siteName || 'Unnamed Site'}`);
    lines.push(`Generated: ${new Date().toLocaleDateString()}`);
    lines.push(`Documents: ${documents.length}`);
    lines.push('');
    lines.push('⚠ DRAFT — ALL DOCUMENTS REQUIRE PROFESSIONAL ENGINEER REVIEW BEFORE SUBMISSION');
    lines.push('═'.repeat(80));
    lines.push('');

    for (const doc of documents) {
      if (doc.error) continue;
      lines.push('');
      lines.push('╔' + '═'.repeat(78) + '╗');
      lines.push('║  ' + doc.title.padEnd(76) + '║');
      lines.push('║  ' + `Document No.: ${doc.docNum}`.padEnd(76) + '║');
      lines.push('╚' + '═'.repeat(78) + '╝');
      lines.push('');
      for (const sec of doc.sections) {
        lines.push(`─── ${sec.heading} ${'─'.repeat(Math.max(0, 76 - sec.heading.length))}`);
        lines.push('');
        lines.push(sec.body);
        lines.push('');
      }
      lines.push(`─── [END OF ${doc.docNum}] ${'─'.repeat(60)}`);
      lines.push('');
    }

    const text = lines.join('\n');

    res.json({
      filename: `BrickPermitOS_${(siteName || 'site').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_permit_package.txt`,
      content: text,
      size: text.length,
      wordCount: text.split(/\s+/).length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Conversation History ────────────────────────────────────────────────────
api.get('/conversation/:screeningId', (req, res) => {
  try {
    const db = getDb();
    const messages = db.prepare(
      'SELECT id, role, content, agent_data, created_at FROM chat_history WHERE screening_id = ? ORDER BY id'
    ).all(req.params.screeningId);

    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

api.post('/conversation', (req, res) => {
  try {
    const { screening_id, role, content, agent_data } = req.body;
    if (!role || !content) return res.status(400).json({ error: 'role and content required' });

    const db = getDb();
    const stmt = db.prepare(
      'INSERT INTO chat_history (screening_id, role, content, agent_data) VALUES (?, ?, ?, ?)'
    );
    const info = stmt.run(screening_id || null, role, content, agent_data ? JSON.stringify(agent_data) : null);

    res.json({ id: info.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Tool Listing ────────────────────────────────────────────────────────────
api.get('/tools', (req, res) => {
  res.json({ tools: getAgentTools() });
});

export default api;