import { Router } from 'express';
import crypto from 'crypto';
import { requireTenantAccess } from './middleware.js';
import { logger } from './middleware.js';
import { searchRegulations } from './rag.js';
import { queryLLM, generateRAIResponse, generateDocumentSection } from './llm.js';

export function createApiRouter(db) {
  const router = Router();

  // ─── Sites ──────────────────────────────────────────────────────────────
  router.get('/sites', (req, res, next) => {
    try {
      const sites = db.prepare('SELECT id, name, county, state, status, created_at, updated_at FROM sites WHERE tenant_id = ? ORDER BY updated_at DESC')
        .all(req.user.tenantId);
      res.json({ sites });
    } catch (err) { next(err); }
  });

  router.post('/sites', (req, res, next) => {
    try {
      const { name, address, county, state, lat, lon, siteAcres, inputData } = req.body;
      if (!name) return res.status(400).json({ error: 'name required' });

      const id = crypto.randomUUID();
      db.prepare('INSERT INTO sites (id, tenant_id, name, address, county, state, lat, lon, site_acres, input_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, req.user.tenantId, name, address || null, county || null, state || 'Virginia',
          lat || null, lon || null, siteAcres || null, inputData ? JSON.stringify(inputData) : null);

      res.status(201).json({ site: { id, name, status: 'draft' } });
    } catch (err) { next(err); }
  });

  router.get('/sites/:id', (req, res, next) => {
    try {
      const site = db.prepare('SELECT * FROM sites WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenantId);
      if (!site) return res.status(404).json({ error: 'Site not found' });

      res.json({
        site: {
          ...site,
          inputData: site.input_data ? JSON.parse(site.input_data) : null,
          resultsData: site.results_data ? JSON.parse(site.results_data) : null,
        },
      });
    } catch (err) { next(err); }
  });

  router.put('/sites/:id', (req, res, next) => {
    try {
      const existing = db.prepare('SELECT id FROM sites WHERE id = ? AND tenant_id = ?').get(req.params.id, req.user.tenantId);
      if (!existing) return res.status(404).json({ error: 'Site not found' });

      const { name, address, county, state, lat, lon, siteAcres, inputData, status } = req.body;
      db.prepare('UPDATE sites SET name = COALESCE(?, name), address = COALESCE(?, address), county = COALESCE(?, county), state = COALESCE(?, state), lat = COALESCE(?, lat), lon = COALESCE(?, lon), site_acres = COALESCE(?, site_acres), input_data = COALESCE(?, input_data), status = COALESCE(?, status), updated_at = datetime(\'now\') WHERE id = ?')
        .run(name || null, address || null, county || null, state || null, lat || null, lon || null,
          siteAcres || null, inputData ? JSON.stringify(inputData) : null, status || null, req.params.id);

      res.json({ status: 'updated' });
    } catch (err) { next(err); }
  });

  router.delete('/sites/:id', (req, res, next) => {
    try {
      const result = db.prepare('DELETE FROM sites WHERE id = ? AND tenant_id = ?').run(req.params.id, req.user.tenantId);
      if (result.changes === 0) return res.status(404).json({ error: 'Site not found' });
      res.json({ status: 'deleted' });
    } catch (err) { next(err); }
  });

  // ─── Calculations ─────────────────────────────────────────────────────
  router.post('/calculate', (req, res, next) => {
    try {
      const { inputData } = req.body;
      if (!inputData) return res.status(400).json({ error: 'inputData required' });

      import('../src/utils/calculations.js').then(({ calcPTE }) => {
        const results = calcPTE(inputData);
        res.json({ results });
      }).catch(() => {
        res.status(500).json({ error: 'Calculation engine unavailable' });
      });
    } catch (err) { next(err); }
  });

  // ─── Documents ─────────────────────────────────────────────────────────
  router.post('/documents/generate', (req, res, next) => {
    try {
      const { siteId, docType, docNum, inputs, results } = req.body;
      if (!docType || !docNum) return res.status(400).json({ error: 'docType and docNum required' });

      import('../src/utils/documentGenerator.js').then(({ generateDocument }) => {
        import('../src/utils/formConverter.js').then(() => {
          const doc = generateDocument(docType, docNum, inputs || {}, results || {});

          if (siteId) {
            const docId = crypto.randomUUID();
            db.prepare('INSERT INTO documents (id, site_id, doc_type, doc_num, title, content, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
              .run(docId, siteId, docType, docNum, doc?.title || null, doc ? JSON.stringify(doc) : null, 'generated');
            doc.id = docId;
          }

          res.json({ document: doc });
        });
      }).catch((err) => {
        logger.error('Document generation failed', err);
        res.status(500).json({ error: 'Document generation engine unavailable' });
      });
    } catch (err) { next(err); }
  });

  router.get('/sites/:id/documents', (req, res, next) => {
    try {
      const docs = db.prepare('SELECT id, doc_type, doc_num, title, status, created_at FROM documents WHERE site_id = ? ORDER BY created_at')
        .all(req.params.id);
      res.json({ documents: docs });
    } catch (err) { next(err); }
  });

  // ─── Compliance Checks ────────────────────────────────────────────────
  router.post('/compliance/check', (req, res, next) => {
    try {
      const { siteId, module, details } = req.body;
      const id = crypto.randomUUID();
      db.prepare('INSERT INTO compliance_checks (id, site_id, module, status, details) VALUES (?, ?, ?, ?, ?)')
        .run(id, siteId, module || 'general', 'completed', details ? JSON.stringify(details) : null);
      res.json({ id, status: 'completed' });
    } catch (err) { next(err); }
  });

  router.get('/sites/:id/compliance', (req, res, next) => {
    try {
      const checks = db.prepare('SELECT * FROM compliance_checks WHERE site_id = ? ORDER BY checked_at DESC')
        .all(req.params.id);
      res.json({ complianceChecks: checks });
    } catch (err) { next(err); }
  });

  // ─── Chat ──────────────────────────────────────────────────────────────
  router.get('/sites/:id/chat', (req, res, next) => {
    try {
      const messages = db.prepare('SELECT id, role, content, created_at FROM chat_history WHERE site_id = ? ORDER BY created_at')
        .all(req.params.id);
      res.json({ messages });
    } catch (err) { next(err); }
  });

  router.post('/sites/:id/chat', (req, res, next) => {
    try {
      const { content, role } = req.body;
      if (!content) return res.status(400).json({ error: 'content required' });

      const msgId = crypto.randomUUID();
      db.prepare('INSERT INTO chat_history (id, site_id, user_id, role, content) VALUES (?, ?, ?, ?, ?)')
        .run(msgId, req.params.id, req.user.userId, role || 'user', content);

      res.status(201).json({ message: { id: msgId, role: role || 'user', content } });
    } catch (err) { next(err); }
  });

  // ─── User Profile ──────────────────────────────────────────────────────
  router.get('/me', (req, res, next) => {
    try {
      const user = db.prepare('SELECT id, email, name, role, tenant_id FROM users WHERE id = ?').get(req.user.userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ user });
    } catch (err) { next(err); }
  });

  // ─── Health ────────────────────────────────────────────────────────────
  router.get('/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
  });

  // ─── State Attainment ──────────────────────────────────────────────────
  router.get('/attainment/:state', (req, res, next) => {
    try {
      import('../src/data/permitData.js').then(({ STATES_ATTAINMENT }) => {
        const attainment = STATES_ATTAINMENT[req.params.state.toUpperCase()] || 'Attainment';
        res.json({ state: req.params.state, attainment });
      }).catch(() => {
        res.json({ state: req.params.state, attainment: 'Attainment' });
      });
    } catch (err) { next(err); }
  });

  // ─── RAG Regulation Search ─────────────────────────────────────────────
  router.post('/rag/search', (req, res, next) => {
    try {
      const { query, category, limit } = req.body;
      if (!query) return res.status(400).json({ error: 'query required' });

      const results = searchRegulations(query, { category: category || null, limit: limit || 10 });
      res.json({ results });
    } catch (err) { next(err); }
  });

  // ─── LLM Agent Query ──────────────────────────────────────────────────
  router.post('/agent/query', async (req, res, next) => {
    try {
      const { query, inputs, results, conversationHistory } = req.body;
      if (!query) return res.status(400).json({ error: 'query required' });

      const response = await queryLLM(query, { inputs, results, conversationHistory });
      res.json(response);
    } catch (err) { next(err); }
  });

  // ─── Document Section via LLM ──────────────────────────────────────────
  router.post('/document/section', async (req, res, next) => {
    try {
      const { sectionName, inputs, results } = req.body;
      if (!sectionName) return res.status(400).json({ error: 'sectionName required' });

      const content = await generateDocumentSection(sectionName, inputs, results);
      res.json({ section: sectionName, content });
    } catch (err) { next(err); }
  });

  // ─── RAI Response ─────────────────────────────────────────────────────
  router.post('/rai/respond', async (req, res, next) => {
    try {
      const { question, siteData } = req.body;
      if (!question) return res.status(400).json({ error: 'question required' });

      const response = await generateRAIResponse(question, siteData);
      res.json({ response });
    } catch (err) { next(err); }
  });

  // ─── Tools ─────────────────────────────────────────────────────────────
  router.get('/tools', (req, res) => {
    res.json({
      tools: [
        { name: 'Regulatory Applicability Agent', available: true },
        { name: 'PTE + Controlled PTE Engine', available: true },
        { name: 'CFR Document Factory', available: true },
        { name: 'Digital Twin Simulator', available: true },
        { name: 'Regulator QA Copilot', available: !!process.env.ANTHROPIC_API_KEY },
        { name: 'Continuous Compliance OS', available: true },
      ],
    });
  });

  return router;
}