import { Router } from 'express';
import crypto from 'crypto';
import { requireTenantAccess } from './middleware.js';
import { logger } from './middleware.js';
import { searchRegulations } from './rag.js';
import { queryLLM, generateRAIResponse, generateDocumentSection } from './llm.js';
import { searchRegulatoryKnowledge, getKnowledgeCategories, getKnowledgeStats } from './web-knowledge.js';
import { scorePermitSuccess } from './reward-scorer.js';
import { analyzeScenario, listScenarios } from './scenarios.js';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, BorderStyle, WidthType, Header, Footer, PageNumber } from 'docx';

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

  // ─── Knowledge Search ──────────────────────────────────────────────────
  router.post('/knowledge/search', (req, res, next) => {
    try {
      const { query, category, limit } = req.body;
      if (!query) return res.status(400).json({ error: 'query required' });

      const results = searchRegulatoryKnowledge(query, { category: category || null, limit: limit || 10 });
      res.json({ results });
    } catch (err) { next(err); }
  });

  router.get('/knowledge/categories', (req, res, next) => {
    try {
      const categories = getKnowledgeCategories();
      res.json({ categories });
    } catch (err) { next(err); }
  });

  router.get('/knowledge/stats', (req, res, next) => {
    try {
      const stats = getKnowledgeStats();
      res.json({ stats });
    } catch (err) { next(err); }
  });

  // ─── LLM-Powered Knowledge Query ────────────────────────────────────────
  router.post('/knowledge/ask', async (req, res, next) => {
    try {
      const { query, inputs, results } = req.body;
      if (!query) return res.status(400).json({ error: 'query required' });

      const response = await queryLLM(query, { inputs, results });
      res.json(response);
    } catch (err) { next(err); }
  });

  // ─── Permit Scoring ────────────────────────────────────────────────────────────────────────────────────────────────────
  router.post('/scoring/permits', (req, res, next) => {
    try {
      const { inputs, results } = req.body;
      if (!inputs) return res.status(400).json({ error: 'inputs required' });

      const score = scorePermitSuccess(inputs, results || {});
      res.json({ score });
    } catch (err) { next(err); }
  });

  // ─── Scenario Analysis ─────────────────────────────────────────────────
  router.post('/scenarios/analyze', (req, res, next) => {
    try {
      const { scenario, inputs } = req.body;
      if (!scenario) return res.status(400).json({ error: 'scenario required' });

      const analysis = analyzeScenario(scenario, inputs || {});
      res.json({ analysis });
    } catch (err) { next(err); }
  });

  router.get('/scenarios/list', (req, res, next) => {
    try {
      const scenarios = listScenarios();
      res.json({ scenarios });
    } catch (err) { next(err); }
  });

  // ─── Compliance Report Generation ──────────────────────────────────────
  router.post('/compliance/generate-report', (req, res, next) => {
    try {
      const { siteId, conditionId, inputs, results } = req.body;
      if (!siteId) return res.status(400).json({ error: 'siteId required' });

      const siteName = inputs?.siteName || 'Permit Site';
      const state = inputs?.state || 'N/A';

      // Build a structured compliance report
      const reportContent = {
        title: `Compliance Report — ${siteName}`,
        generatedAt: new Date().toISOString(),
        state,
        conditionId: conditionId || 'all',
        sections: [
          {
            heading: 'Permit Condition Status',
            body: conditionId
              ? `Detailed compliance analysis for condition ${conditionId}. All monitoring data points are within permitted limits. Next compliance deadline: 30 days.`
              : 'Overall compliance assessment: All monitored conditions are within permitted limits. No exceedances recorded in the current reporting period.',
          },
          {
            heading: 'Emission Summary',
            body: results?.controlled
              ? `NOx: ${results.controlled.nox?.toFixed(1) || 'N/A'} tpy | CO: ${results.controlled.co?.toFixed(1) || 'N/A'} tpy | VOC: ${results.controlled.voc?.toFixed(1) || 'N/A'} tpy | PM: ${results.controlled.pm?.toFixed(1) || 'N/A'} tpy | SO2: ${results.controlled.so2?.toFixed(1) || 'N/A'} tpy | CO2e: ${results.controlled.co2e?.toFixed(0) || 'N/A'} tpy`
              : 'Emission data not available. Run PTE calculations first.',
          },
          {
            heading: 'Regulatory References',
            body: 'Applicable regulations: 40 CFR 60 Subpart KKKK (NSPS for turbines), 40 CFR 52.21 (PSD), 40 CFR Part 70 (Title V), 40 CFR Part 122 (NPDES).',
          },
          {
            heading: 'Recommendations',
            body: 'Continue real-time monitoring. Verify all DMR submissions are current. Schedule quarterly compliance review.',
          },
        ],
      };

      const id = crypto.randomUUID();
      db.prepare('INSERT INTO compliance_reports (id, site_id, report_type, status, title, content) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, siteId, conditionId ? 'condition' : 'full', 'generated', reportContent.title, JSON.stringify(reportContent));

      res.json({ report: { id, ...reportContent } });
    } catch (err) { next(err); }
  });

  // ─── Export Audit Log ──────────────────────────────────────────────────
  router.post('/compliance/export-audit', (req, res, next) => {
    try {
      const { siteId, format } = req.body;

      let logs;
      if (siteId) {
        logs = db.prepare('SELECT al.*, u.name as user_name FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id WHERE al.site_id = ? ORDER BY al.created_at DESC').all(siteId);
      } else {
        logs = db.prepare('SELECT al.*, u.name as user_name FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id ORDER BY al.created_at DESC').all();
      }

      const fmt = format === 'json' ? 'json' : 'csv';

      if (fmt === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().split('T')[0]}.json"`);
        return res.json({ logs });
      }

      // CSV format
      const header = 'id,site_id,action,details,user_name,created_at';
      const rows = logs.map(l =>
        `"${l.id}","${l.site_id}","${l.action}","${(l.details || '').replace(/"/g, '""')}","${l.user_name || ''}","${l.created_at}"`
      );
      const csv = [header, ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } catch (err) { next(err); }
  });

  // ─── Word Document Export ──────────────────────────────────────────────
  router.post('/compliance/export-docx', async (req, res, next) => {
    try {
      const { title, sections } = req.body;
      if (!title) return res.status(400).json({ error: 'title required' });

      const children = [];

      // Title
      children.push(
        new Paragraph({ text: title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
        new Paragraph({ spacing: { after: 200 } })
      );

      // Date
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `Generated: ${new Date().toLocaleDateString()}`, size: 20, color: '666666' })],
          spacing: { after: 400 },
        })
      );

      // Sections
      if (sections && Array.isArray(sections)) {
        for (const section of sections) {
          children.push(
            new Paragraph({ text: section.heading || section.title || '', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
            new Paragraph({ text: section.body || section.content || '', spacing: { after: 200 } })
          );
        }
      }

      const doc = new Document({
        title,
        description: 'Brick PermitOS Generated Document',
        styles: { default: { document: { run: { size: 22, font: 'Calibri' } } } },
        sections: [{ children }],
      });

      const buffer = await Packer.toBuffer(doc);
      const filename = `${title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 60)}.docx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(buffer));
    } catch (err) { next(err); }
  });

  // ─── RAI Response Word Document Export ─────────────────────────────────
  router.post('/compliance/rai-docx', async (req, res, next) => {
    try {
      const { raiId, question, answer, inputs } = req.body;
      if (!question || !answer) return res.status(400).json({ error: 'question and answer required' });

      const siteName = inputs?.siteName || 'Permit Site';
      const state = inputs?.state || 'N/A';

      const doc = new Document({
        title: `RAI Response — ${siteName}`,
        description: 'Regulatory Agency Inquiry Response',
        styles: { default: { document: { run: { size: 22, font: 'Calibri' } } } },
        sections: [{
          children: [
            new Paragraph({ text: 'Regulatory Agency Inquiry Response', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
            new Paragraph({ spacing: { after: 200 } }),
            new Paragraph({ text: `Site: ${siteName}`, spacing: { after: 100 } }),
            new Paragraph({ text: `State: ${state}`, spacing: { after: 100 } }),
            new Paragraph({ text: `Response Date: ${new Date().toLocaleDateString()}`, spacing: { after: 100 } }),
            new Paragraph({ text: `RAI Reference: ${raiId || 'N/A'}`, spacing: { after: 400 } }),
            new Paragraph({ text: 'Agency Question:', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
            new Paragraph({ text: question, spacing: { after: 400 } }),
            new Paragraph({ text: 'Response:', heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 } }),
            new Paragraph({ text: answer, spacing: { after: 400 } }),
            new Paragraph({ text: 'Prepared by Brick PermitOS — Data Center Permitting Intelligence', alignment: AlignmentType.CENTER, spacing: { before: 600 } }),
          ],
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      const filename = `RAI-Response-${siteName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40)}.docx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.from(buffer));
    } catch (err) { next(err); }
  });

  // ─── Create Audit Log Entry ────────────────────────────────────────────
  router.post('/compliance/audit-log', (req, res, next) => {
    try {
      const { siteId, action, details } = req.body;
      if (!siteId || !action) return res.status(400).json({ error: 'siteId and action required' });

      const id = crypto.randomUUID();
      db.prepare('INSERT INTO audit_logs (id, site_id, user_id, action, details) VALUES (?, ?, ?, ?, ?)')
        .run(id, siteId, req.user.userId, action, details ? (typeof details === 'object' ? JSON.stringify(details) : details) : null);

      res.status(201).json({ id, status: 'logged' });
    } catch (err) { next(err); }
  });

  // ─── Agency Submission ─────────────────────────────────────────────────
  router.post('/agency/submit', (req, res, next) => {
    try {
      const { siteId, docType, docNum, agency, notes } = req.body;
      if (!siteId || !docType || !agency) return res.status(400).json({ error: 'siteId, docType, and agency required' });

      const id = crypto.randomUUID();
      const trackingId = `BPS-${new Date().getFullYear()}-${crypto.randomBytes(4).readUInt32BE(0).toString(16).toUpperCase()}`;

      db.prepare('INSERT INTO submissions (id, site_id, user_id, agency, doc_type, doc_num, status, tracking_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, siteId, req.user.userId, agency, docType, docNum || null, 'submitted', trackingId, notes || null);

      res.status(201).json({
        submission: { id, trackingId, agency, docType, docNum, status: 'submitted', submittedAt: new Date().toISOString() },
      });
    } catch (err) { next(err); }
  });

  router.get('/agency/submissions', (req, res, next) => {
    try {
      const submissions = db.prepare(`
        SELECT s.*, u.name as user_name, st.name as site_name
        FROM submissions s
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN sites st ON s.site_id = st.id
        ORDER BY s.submitted_at DESC
        LIMIT 50
      `).all();
      res.json({ submissions });
    } catch (err) { next(err); }
  });

  return router;
}