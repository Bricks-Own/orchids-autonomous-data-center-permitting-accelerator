import { Router } from 'express';
import crypto from 'crypto';
import { logger } from './middleware.js';
import { searchRegulations } from './rag.js';
import { queryLLM, generateRAIResponse, generateDocumentSection } from './llm.js';
import { runPermittingAgent } from './agent/permittingAgent.js';
import { CURATED_SOURCES, sourcePolicy } from './agent/sourceRegistry.js';
import { supportedScenarios } from './agent/scenarioPlanner.js';
import { fetchOfficialSource, approvedSourceHosts } from './agent/liveSources.js';
import { getStatePack, listStatePacks } from './agent/statePacks.js';
import { buildRblcResearchPlan, rblcEquipmentClasses } from './agent/rblc.js';
import { assessAermodReadiness, buildAermodPackage, parseAermodOutput, runAermodJob } from './agent/aermod.js';
import { greenBookDatasetRegistry, parseGreenBookRows, queryEcho } from './agent/epaData.js';
import { importRblcRecord, scoreRblcComparability } from './agent/rblcImport.js';
import { assignReview, recordApproval, verifyApprovalChain } from './reviews.js';
import { listEvidence, signedEvidenceDownload, storeEvidence } from './evidence.js';

export function createApiRouter(db) {
  const router = Router();
  const getOwnedSite = (siteId, tenantId) =>
    db.prepare('SELECT id FROM sites WHERE id = ? AND tenant_id = ?').get(siteId, tenantId);

  const requireOwnedSite = (req, res, siteId) => {
    if (!siteId) {
      res.status(400).json({ error: 'siteId required' });
      return null;
    }
    const site = getOwnedSite(siteId, req.user.tenantId);
    if (!site) {
      res.status(404).json({ error: 'Site not found' });
      return null;
    }
    return site;
  };

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
      if (siteId && !requireOwnedSite(req, res, siteId)) return;

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
      if (!requireOwnedSite(req, res, req.params.id)) return;
      const docs = db.prepare('SELECT id, doc_type, doc_num, title, status, created_at FROM documents WHERE site_id = ? ORDER BY created_at')
        .all(req.params.id);
      res.json({ documents: docs });
    } catch (err) { next(err); }
  });

  // ─── Compliance Checks ────────────────────────────────────────────────
  router.post('/compliance/check', (req, res, next) => {
    try {
      const { siteId, module, details } = req.body;
      if (!requireOwnedSite(req, res, siteId)) return;
      const id = crypto.randomUUID();
      db.prepare('INSERT INTO compliance_checks (id, site_id, module, status, details) VALUES (?, ?, ?, ?, ?)')
        .run(id, siteId, module || 'general', 'completed', details ? JSON.stringify(details) : null);
      res.json({ id, status: 'completed' });
    } catch (err) { next(err); }
  });

  router.get('/sites/:id/compliance', (req, res, next) => {
    try {
      if (!requireOwnedSite(req, res, req.params.id)) return;
      const checks = db.prepare('SELECT * FROM compliance_checks WHERE site_id = ? ORDER BY checked_at DESC')
        .all(req.params.id);
      res.json({ complianceChecks: checks });
    } catch (err) { next(err); }
  });

  // ─── Chat ──────────────────────────────────────────────────────────────
  router.get('/sites/:id/chat', (req, res, next) => {
    try {
      if (!requireOwnedSite(req, res, req.params.id)) return;
      const messages = db.prepare('SELECT id, role, content, created_at FROM chat_history WHERE site_id = ? ORDER BY created_at')
        .all(req.params.id);
      res.json({ messages });
    } catch (err) { next(err); }
  });

  router.post('/sites/:id/chat', (req, res, next) => {
    try {
      if (!requireOwnedSite(req, res, req.params.id)) return;
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

  // Autonomous permitting orchestration. Deterministic calculations and
  // validators run before any optional AI-assisted drafting.
  router.post('/autonomy/run', async (req, res, next) => {
    try {
      const { siteId, scenarioType, inputs, evidence, suppliedSources } = req.body;
      if (siteId && !requireOwnedSite(req, res, siteId)) return;
      const storedEvidence = siteId ? listEvidence(db, siteId) : [];
      const storedSources = siteId
        ? db.prepare(`SELECT id, title, url, host as publisher, retrieved_at as lastVerified
            FROM source_snapshots WHERE site_id = ? ORDER BY created_at DESC`).all(siteId)
            .map(source => ({ ...source, authority: 'officialGuidance', domains: ['all'] }))
        : [];
      const run = await runPermittingAgent({
        scenarioType,
        inputs: inputs || {},
        evidence: [...storedEvidence, ...(evidence || [])],
        suppliedSources: [...storedSources, ...(suppliedSources || [])],
      });
      if (siteId) {
        db.prepare('INSERT INTO agent_runs (id, site_id, scenario_type, status, score, output) VALUES (?, ?, ?, ?, ?, ?)')
          .run(run.runId, siteId, run.scenarioType, run.status, run.reward.score, JSON.stringify(run));
      }
      res.status(run.status === 'blocked' ? 422 : 200).json({ run });
    } catch (err) { next(err); }
  });

  router.get('/sites/:id/autonomy/runs', (req, res, next) => {
    try {
      if (!requireOwnedSite(req, res, req.params.id)) return;
      const runs = db.prepare('SELECT id, scenario_type, status, score, created_at FROM agent_runs WHERE site_id = ? ORDER BY created_at DESC')
        .all(req.params.id);
      res.json({ runs });
    } catch (err) { next(err); }
  });

  router.get('/autonomy/config', (_req, res) => {
    res.json({
      scenarios: supportedScenarios(),
      sources: CURATED_SOURCES,
      sourcePolicy: sourcePolicy(),
      objective: 'Maximize defensible permit success likelihood while minimizing unsupported claims, omissions, rework, and review delays.',
    });
  });

  router.post('/sources/snapshot', async (req, res, next) => {
    try {
      const { siteId, url } = req.body;
      if (siteId && !requireOwnedSite(req, res, siteId)) return;
      const snapshot = await fetchOfficialSource(url);
      const id = crypto.randomUUID();
      db.prepare(`INSERT INTO source_snapshots
        (id, site_id, url, title, host, retrieved_at, sha256, content_type, text_content)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, siteId || null, snapshot.url, snapshot.title, snapshot.host, snapshot.retrievedAt,
          snapshot.sha256, snapshot.contentType, snapshot.text);
      res.status(201).json({ snapshot: { ...snapshot, id } });
    } catch (err) { next(err); }
  });

  router.get('/sources/approved-hosts', (_req, res) => {
    res.json({ hosts: approvedSourceHosts() });
  });

  router.post('/sites/:id/evidence', async (req, res, next) => {
    try {
      if (!requireOwnedSite(req, res, req.params.id)) return;
      const evidence = await storeEvidence(db, {
        tenantId: req.user.tenantId,
        siteId: req.params.id,
        userId: req.user.userId,
        ...req.body,
      });
      res.status(201).json({ evidence });
    } catch (err) { next(err); }
  });

  router.post('/sites/:id/evidence/:evidenceId/download-link', async (req, res, next) => {
    try {
      if (!requireOwnedSite(req, res, req.params.id)) return;
      const signed = await signedEvidenceDownload(db, req.params.id, req.params.evidenceId);
      if (signed.url) return res.json({ url: signed.url, expires: signed.expires, provider: signed.provider });
      const query = new URLSearchParams({
        key: signed.objectKey,
        expires: String(signed.expires),
        signature: signed.signature,
        fileName: signed.fileName,
      });
      res.json({ url: `/api/download?${query}`, expires: signed.expires, provider: signed.provider });
    } catch (err) { next(err); }
  });

  router.get('/sites/:id/evidence', (req, res, next) => {
    try {
      if (!requireOwnedSite(req, res, req.params.id)) return;
      res.json({ evidence: listEvidence(db, req.params.id) });
    } catch (err) { next(err); }
  });

  router.get('/state-packs', (_req, res) => res.json({ states: listStatePacks() }));
  router.get('/state-packs/:state', (req, res) => {
    const pack = getStatePack(req.params.state);
    if (!pack) return res.status(404).json({ error: 'State pack not available' });
    res.json({ state: req.params.state, pack });
  });

  router.post('/rblc/research-plan', (req, res) => {
    res.json({
      plan: buildRblcResearchPlan(req.body || {}),
      equipmentClasses: rblcEquipmentClasses(),
    });
  });

  router.post('/sites/:id/rblc/import', (req, res, next) => {
    try {
      if (!requireOwnedSite(req, res, req.params.id)) return;
      res.status(201).json({ record: importRblcRecord(db, { siteId: req.params.id, ...req.body }) });
    } catch (err) { next(err); }
  });

  router.post('/rblc/comparability', (req, res) => {
    res.json({ comparison: scoreRblcComparability(req.body?.project || {}, req.body?.candidate || {}) });
  });

  router.get('/sites/:id/rblc', (req, res, next) => {
    try {
      if (!requireOwnedSite(req, res, req.params.id)) return;
      const records = db.prepare(`SELECT id, rblc_id as rblcId, permit_date as permitDate,
        facility_name as facilityName, evidence_id as evidenceId, evidence_sha256 as evidenceSha256,
        criteria_json as criteria, comparison_json as comparison, created_at as createdAt
        FROM rblc_records WHERE site_id = ? ORDER BY created_at DESC`).all(req.params.id)
        .map(record => ({ ...record, criteria: JSON.parse(record.criteria), comparison: JSON.parse(record.comparison) }));
      res.json({ records });
    } catch (err) { next(err); }
  });

  router.post('/aermod/readiness', (req, res) => {
    res.json({ readiness: assessAermodReadiness(req.body?.manifest || {}) });
  });

  router.post('/aermod/package', (req, res, next) => {
    try { res.json({ package: buildAermodPackage(req.body || {}) }); } catch (err) { next(err); }
  });

  router.post('/aermod/parse-output', (req, res, next) => {
    try { res.json({ result: parseAermodOutput(req.body?.text || '') }); } catch (err) { next(err); }
  });

  router.post('/aermod/run', async (req, res, next) => {
    try {
      const { siteId, manifest, files } = req.body;
      if (!requireOwnedSite(req, res, siteId)) return;
      const job = await runAermodJob({ manifest: manifest || {}, files: files || {} });
      res.status(job.status === 'blocked' ? 422 : 200).json({ job });
    } catch (err) { next(err); }
  });

  router.get('/epa/green-book/registry', (_req, res) => {
    res.json(greenBookDatasetRegistry());
  });

  router.post('/epa/green-book/query-import', (req, res, next) => {
    try {
      const { rows, state, county } = req.body;
      res.json(parseGreenBookRows(rows, { state, county }));
    } catch (err) { next(err); }
  });

  router.post('/epa/echo/query', async (req, res, next) => {
    try {
      const { siteId, ...criteria } = req.body;
      if (siteId && !requireOwnedSite(req, res, siteId)) return;
      const snapshot = await queryEcho(criteria);
      res.json({ snapshot });
    } catch (err) { next(err); }
  });

  router.post('/sites/:id/reviews', (req, res, next) => {
    try {
      if (!requireOwnedSite(req, res, req.params.id)) return;
      if (!['admin', 'editor'].includes(req.user.role)) return res.status(403).json({ error: 'Review assignment requires editor or admin role' });
      const assignment = assignReview(db, {
        siteId: req.params.id,
        assignedBy: req.user.userId,
        ...req.body,
      });
      res.status(201).json({ assignment });
    } catch (err) { next(err); }
  });

  router.get('/sites/:id/reviews', (req, res, next) => {
    try {
      if (!requireOwnedSite(req, res, req.params.id)) return;
      const assignments = db.prepare(`SELECT id, artifact_type as artifactType, artifact_id as artifactId,
        discipline, reviewer_user_id as reviewerUserId, reviewer_name as reviewerName, due_at as dueAt,
        status, completed_at as completedAt, created_at as createdAt
        FROM review_assignments WHERE site_id = ? ORDER BY created_at DESC`).all(req.params.id);
      const approvals = db.prepare(`SELECT id, assignment_id as assignmentId, artifact_type as artifactType,
        artifact_id as artifactId, discipline, reviewer_name as reviewerName, reviewer_license as reviewerLicense,
        decision, statement, artifact_sha256 as artifactSha256, previous_approval_hash as previousApprovalHash,
        approval_hash as approvalHash, signed_at as signedAt
        FROM immutable_approvals WHERE site_id = ? ORDER BY created_at, id`).all(req.params.id);
      res.json({ assignments, approvals, chain: verifyApprovalChain(db, req.params.id) });
    } catch (err) { next(err); }
  });

  router.post('/sites/:id/reviews/:assignmentId/decision', (req, res, next) => {
    try {
      if (!requireOwnedSite(req, res, req.params.id)) return;
      const assignment = db.prepare('SELECT * FROM review_assignments WHERE id = ? AND site_id = ?')
        .get(req.params.assignmentId, req.params.id);
      if (!assignment) return res.status(404).json({ error: 'Review assignment not found' });
      if (assignment.reviewer_user_id && assignment.reviewer_user_id !== req.user.userId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only the assigned reviewer or an admin may record this decision' });
      }
      const approval = recordApproval(db, {
        assignmentId: req.params.assignmentId,
        siteId: req.params.id,
        artifactType: assignment.artifact_type,
        artifactId: assignment.artifact_id,
        discipline: assignment.discipline,
        reviewerUserId: req.user.userId,
        reviewerName: req.body.reviewerName || assignment.reviewer_name,
        reviewerLicense: req.body.reviewerLicense,
        decision: req.body.decision,
        statement: req.body.statement,
        artifactSha256: req.body.artifactSha256,
      });
      res.status(201).json({ approval, chain: verifyApprovalChain(db, req.params.id) });
    } catch (err) { next(err); }
  });

  // ─── Tools ─────────────────────────────────────────────────────────────
  router.get('/capabilities', (req, res) => {
    const llmAvailable = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
    res.json({
      aiMode: llmAvailable ? 'llm-with-regulatory-search' : 'regulatory-search-only',
      capabilities: [
        { name: 'Regulatory search assistant', available: true, mode: llmAvailable ? 'Claude + TF-IDF retrieval' : 'TF-IDF retrieval' },
        { name: 'PTE calculation engine', available: true, mode: 'deterministic' },
        { name: 'Draft document generator', available: true, mode: 'deterministic templates' },
        { name: 'Operational scenario simulator', available: true, mode: 'deterministic' },
        { name: 'Regulator response drafting', available: llmAvailable, mode: llmAvailable ? 'Claude + TF-IDF retrieval' : 'unavailable' },
      ],
    });
  });

  // Backward-compatible alias.
  router.get('/tools', (req, res) => {
    const llmAvailable = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
    res.json({
      aiMode: llmAvailable ? 'llm-with-regulatory-search' : 'regulatory-search-only',
      tools: [
        { name: 'Regulatory search assistant', available: true },
        { name: 'PTE calculation engine', available: true },
        { name: 'Draft document generator', available: true },
        { name: 'Operational scenario simulator', available: true },
        { name: 'Regulator response drafting', available: llmAvailable },
      ],
    });
  });

  return router;
}
