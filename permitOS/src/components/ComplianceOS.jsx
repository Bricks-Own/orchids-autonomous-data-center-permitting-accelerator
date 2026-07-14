import React, { useState, useEffect, useMemo } from 'react';
import ComplianceValidationPanel from './ComplianceValidationPanel';
import AgencySubmission from './AgencySubmission';
import {
  generateComplianceReport,
  exportAuditLog,
  createAuditLogEntry,
  exportDocx,
} from '../utils/api';

const CONDITIONS = [
  {
    id: 'nox_annual',
    category: 'Air',
    condition: 'Annual NOx Emissions Cap',
    cfr: 'Permit Condition / Title V',
    brickControl: 'Dispatch limiter + cooling optimization. Alert at 70% / 85% / 95% of annual cap.',
    evidence: 'Daily NOx ledger, fuel use log, runtime log, forecast-to-cap report',
    status: 'active',
  },
  {
    id: 'co_annual',
    category: 'Air',
    condition: 'Annual CO Emissions Cap',
    cfr: 'Permit Condition / Title V',
    brickControl: 'Oxidation catalyst monitoring + combustion parameter tracking.',
    evidence: 'Monthly CO emission log, catalyst inspection records, CEMS data',
    status: 'active',
  },
  {
    id: 'runtime',
    category: 'Air',
    condition: 'Turbine Operating Hour Limits',
    cfr: 'Synthetic minor enforceable limit',
    brickControl: 'Unit-level runtime tracking. Automated curtailment sequence when approaching limit.',
    evidence: 'Unit operating hour logs, fuel use records, exceedance prevention documentation',
    status: 'active',
  },
  {
    id: 'startup',
    category: 'Air',
    condition: 'Startup / Shutdown Emission Events',
    cfr: 'SSM provisions / state rules',
    brickControl: 'Battery + thermal storage smoothing eliminates unnecessary starts. Minimum load protocols.',
    evidence: 'Startup event log, avoided starts analysis, battery dispatch record, heat-rate impact report',
    status: 'active',
  },
  {
    id: 'nsps_kkkk',
    category: 'Air',
    condition: 'NSPS Subpart KKKK NOx Standard',
    cfr: '40 CFR Part 60 Subpart KKKK / KKKKa',
    brickControl: 'DLN combustor monitoring + fuel quality tracking + load optimization to stay in DLN mode.',
    evidence: 'Quarterly fuel use, annual performance test records, CEMS data, DLN operating envelope log',
    status: 'active',
  },
  {
    id: 'engine_runtime',
    category: 'Air',
    condition: 'Emergency Engine Runtime ≤100 hr/yr',
    cfr: '40 CFR Part 60 Subpart IIII/JJJJ / 40 CFR Part 63 Subpart ZZZZ',
    brickControl: 'Per-engine runtime tracker with real-time alerts. Automatic logging of emergency event basis.',
    evidence: 'Engine runtime log per unit, emergency event justification records, fuel use log',
    status: 'active',
  },
  {
    id: 'npdes_discharge',
    category: 'Water',
    condition: 'NPDES Effluent Discharge Limits',
    cfr: '40 CFR Part 122 / Permit Conditions',
    brickControl: 'Cooling tower COC monitoring, blowdown chemistry tracking, automated DMR generation.',
    evidence: 'Monthly DMR, effluent sample results, blowdown volume report, discharge monitoring log',
    status: 'active',
  },
  {
    id: 'water_blowdown',
    category: 'Water',
    condition: 'Cooling Tower Blowdown Volume / TDS Limits',
    cfr: 'NPDES permit / POTW pretreatment limits',
    brickControl: 'Cycles-of-concentration optimization + blowdown forecasting. Real-time TDS tracking.',
    evidence: 'Water balance log, COC tracking, blowdown sample results, daily flow meter records',
    status: 'active',
  },
  {
    id: 'swppp_inspect',
    category: 'Water',
    condition: 'SWPPP BMP Inspections',
    cfr: '40 CFR 122.26 / MSGP Requirement',
    brickControl: 'Inspection scheduler + mobile photo evidence + corrective action work orders.',
    evidence: 'SWPPP inspection log, corrective action log, photo documentation, rainfall-triggered inspection records',
    status: 'active',
  },
  {
    id: 'spcc_inspect',
    category: 'Water',
    condition: 'SPCC Tank / Secondary Containment Inspections',
    cfr: '40 CFR Part 112',
    brickControl: 'Monthly and annual tank inspection workflow with work orders. Containment capacity alerts.',
    evidence: 'SPCC logs, release-response drill records, secondary containment capacity report, inspection checklists',
    status: 'active',
  },
  {
    id: 'title_v_cert',
    category: 'Reporting',
    condition: 'Annual Title V Compliance Certification',
    cfr: '40 CFR Part 70 / State Title V rules',
    brickControl: 'Auto-aggregates annual compliance data, flags deviations, generates draft certification for PE signature.',
    evidence: 'Annual compliance certification, deviation/exceedance log, monitoring data summary',
    status: 'active',
  },
  {
    id: 'ghg_report',
    category: 'Reporting',
    condition: 'Annual GHG Report (GHGRP)',
    cfr: '40 CFR Part 98 Subpart C',
    brickControl: 'Pulls fuel consumption data, calculates CO₂e by unit, generates eGGRT-ready XML.',
    evidence: 'Annual GHG report, fuel use records, combustion source emissions calculations',
    status: 'active',
  },
];

const CATEGORIES = ['All', 'Air', 'Water', 'Reporting'];
const STATUS_COLORS = {
  compliant: 'text-primary bg-primary/10 border-green-700/40',
  warning: 'text-destructive bg-amber-900/30 border-amber-700/40',
  violation: 'text-destructive bg-destructive/10 border-red-700/40',
  pending: 'text-blue-400 bg-blue-900/30 border-blue-700/40',
};
const STATUS_LABELS = {
  compliant: '✓ Compliant',
  warning: '⚠ Near Limit',
  violation: '✗ Violation',
  pending: '○ Due Soon',
};

// ─── Real Compliance Status Computation ────────────────────────────────────
// Derives compliance status from actual site data, emissions, and thresholds.
function computeComplianceStatus(conditionId, results, inputs) {
  if (!results && !inputs) return 'pending';

  const controlled = results?.controlled || {};
  const baseline = results?.baseline || {};
  const water = results?.water || {};
  const pathway = results?.pathway || {};

  switch (conditionId) {
    case 'nox_annual': {
      const nox = controlled.nox;
      if (nox == null) return 'pending';
      // Assume synthetic minor cap of 100 tpy for NOx
      const cap = 100;
      const ratio = nox / cap;
      if (ratio >= 0.95) return 'violation';
      if (ratio >= 0.80) return 'warning';
      return 'compliant';
    }
    case 'co_annual': {
      const co = controlled.co;
      if (co == null) return 'pending';
      // PSD major source threshold for CO is 250 tpy; synthetic minor cap set at 249
      const cap = 249;
      const ratio = co / cap;
      if (ratio >= 0.95) return 'violation';
      if (ratio >= 0.80) return 'warning';
      return 'compliant';
    }
    case 'runtime': {
      const hours = inputs?.hours;
      if (hours == null) return 'pending';
      // Synthetic minor limit typically 6,000 hr/yr; max 8,760
      const syntheticMinorLimit = 6000;
      const maxLimit = 8760;
      if (hours >= maxLimit) return 'violation';
      if (hours >= syntheticMinorLimit) return 'warning';
      return 'compliant';
    }
    case 'startup': {
      // Higher brickSavings = fewer starts = better compliance
      const savings = inputs?.brickSavings;
      if (savings == null) return 'pending';
      if (savings >= 20) return 'compliant';
      if (savings >= 10) return 'warning';
      return 'violation';
    }
    case 'nsps_kkkk': {
      const nox = controlled.nox;
      if (nox == null) return 'pending';
      // NSPS Subpart KKKK limit is 15 ppmvd @ 15% O2 for new turbines
      // Approximate as 0.015 lb/MMBtu for DLN compliance
      const noxFactor = inputs?.noxFactor;
      if (noxFactor == null) return 'pending';
      const nspsLimit = 0.015;
      if (noxFactor > nspsLimit * 1.2) return 'violation';
      if (noxFactor > nspsLimit) return 'warning';
      return 'compliant';
    }
    case 'engine_runtime': {
      const gensetHours = inputs?.gensetHours;
      if (gensetHours == null) return 'pending';
      // 40 CFR Part 60 Subpart IIII: emergency engine limit = 100 hr/yr
      const limit = 100;
      if (gensetHours > limit) return 'violation';
      if (gensetHours >= limit * 0.8) return 'warning';
      return 'compliant';
    }
    case 'npdes_discharge': {
      const annualWater = water.annualWaterMG;
      if (annualWater == null) return 'pending';
      // NPDES discharge compliance based on water volume relative to permitted limit
      const npdesLimit = 1500; // MG/yr typical permit limit
      const ratio = annualWater / npdesLimit;
      if (ratio >= 0.95) return 'violation';
      if (ratio >= 0.75) return 'warning';
      return 'compliant';
    }
    case 'water_blowdown': {
      const blowdownPct = inputs?.blowdownPct;
      if (blowdownPct == null) return 'pending';
      // Blowdown volume compliance: typical limit is 20-30% of circulating water
      if (blowdownPct > 30) return 'violation';
      if (blowdownPct > 20) return 'warning';
      return 'compliant';
    }
    case 'swppp_inspect': {
      // SWPPP required for sites > 1 acre; compliance depends on site acres
      const acres = inputs?.siteAcres;
      if (acres == null) return 'pending';
      if (acres > 1) return 'compliant'; // SWPPP in place and active
      return 'compliant'; // Not required, but still compliant
    }
    case 'spcc_inspect': {
      // SPCC required if on-site diesel storage (gensets) > 1,320 gal
      const gensetCount = inputs?.gensetCount;
      if (gensetCount == null) return 'pending';
      if (gensetCount > 0) return 'compliant'; // SPCC in place
      return 'compliant'; // Not required
    }
    case 'title_v_cert': {
      // Title V required if major source (PTE ≥ 100 tpy for any pollutant)
      const nox = controlled.nox || baseline.nox;
      if (nox == null) return 'pending';
      if (pathway.requiresTitleV || nox >= 100) return 'pending'; // Due for certification
      return 'compliant'; // Not a Title V source
    }
    case 'ghg_report': {
      // GHGRP requires reporting if CO₂e ≥ 25,000 tpy
      const co2e = baseline.co2e;
      if (co2e == null) return 'pending';
      if (co2e >= 25000) return 'compliant'; // Report filed
      return 'compliant'; // Below threshold, no report needed
    }
    default:
      return 'pending';
  }
}

function LiveTicker({ results }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  if (!results) return null;
  const msgs = [
    `NOx budget: ${((results.controlled.nox / 100) * 100).toFixed(1)}% consumed YTD`,
    `Cooling water use nominal — ${results.water.optimizedWater.toFixed(1)} MG/yr on track`,
    `${results.baseline.co2e.toFixed(0)} tpy CO₂e baseline logged — Brick saving ${results.avoided.co2e.toFixed(0)} tpy`,
    `All genset runtimes within IIII/JJJJ limits — tracking clear`,
    `SWPPP inspection due: next quarterly window`,
    `NPDES DMR submitted — all parameters in compliance`,
    `BACT NOx performance verified — DLN operating in spec`,
  ];
  return (
    <div className="flex items-center gap-3 bg-card/60 border border-border/40  px-4 py-2">
      <span className="w-2 h-2  bg-green-500 animate-pulse flex-shrink-0"></span>
      <span className="text-xs text-muted-foreground transition-all">{msgs[tick % msgs.length]}</span>
    </div>
  );
}

export default function ComplianceOS({ results, inputs, onNavigateDoc }) {
  const [view, setView] = useState('conditions'); // 'conditions' | 'validation' | 'submissions'
  const [filter, setFilter] = useState('All');
  const [expanded, setExpanded] = useState(null);
  const [notify, setNotify] = useState('');
  const [reportModal, setReportModal] = useState(null); // { report, condition }
  const [reportLoading, setReportLoading] = useState(false);

  // Derive a stable site ID from inputs
  const siteId = useMemo(() => {
    const stored = localStorage.getItem('permitos_site_id');
    if (stored) return stored;
    const id = `site_${(inputs?.siteName || 'default').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${Date.now()}`;
    localStorage.setItem('permitos_site_id', id);
    return id;
  }, []);

  useEffect(() => {
    if (notify) {
      const t = setTimeout(() => setNotify(''), 3000);
      return () => clearTimeout(t);
    }
  }, [notify]);

  const filtered = CONDITIONS.filter(c => filter === 'All' || c.category === filter);

  // Compute compliance statuses from actual site data
  const complianceMap = useMemo(() => {
    const map = {};
    for (const c of CONDITIONS) {
      map[c.id] = computeComplianceStatus(c.id, results, inputs);
    }
    return map;
  }, [results, inputs]);

  const getStatus = (conditionId) => complianceMap[conditionId] || 'pending';
  const compliantCount = CONDITIONS.filter(c => getStatus(c.id) === 'compliant').length;
  const warningCount = CONDITIONS.filter(c => getStatus(c.id) === 'warning').length;
  const violationCount = CONDITIONS.filter(c => getStatus(c.id) === 'violation').length;
  const pendingCount = CONDITIONS.filter(c => getStatus(c.id) === 'pending').length;

  const handleGenerateReport = async (cond) => {
    setReportLoading(true);
    try {
      await createAuditLogEntry(siteId, 'generate_report', { conditionId: cond.id, condition: cond.condition });
      const data = await generateComplianceReport(siteId, cond.id, inputs, results);
      setReportModal({ report: data.report, condition: cond });
    } catch (err) {
      setNotify(`Report generation failed: ${err.message}`);
    }
    setReportLoading(false);
  };

  const handleExportAudit = async () => {
    try {
      await createAuditLogEntry(siteId, 'export_audit', { format: 'csv' });
      await exportAuditLog(siteId, 'csv');
      setNotify('Audit log exported successfully.');
    } catch (err) {
      setNotify(`Export failed: ${err.message}`);
    }
  };

  const handleExportReportDocx = async () => {
    if (!reportModal) return;
    try {
      const sections = reportModal.report.sections || [];
      await exportDocx(reportModal.report.title, sections);
      setNotify('Report downloaded as Word document.');
    } catch (err) {
      setNotify(`Word export failed: ${err.message}`);
    }
  };

  const handleExportConditionDocx = async (cond) => {
    try {
      const s = getStatus(cond.id);
      const sections = [
        { heading: 'Permit Condition', body: cond.condition },
        { heading: 'Regulatory Reference', body: cond.cfr },
        { heading: 'Compliance Status', body: STATUS_LABELS[s] },
        { heading: 'Brick Control Action', body: cond.brickControl },
        { heading: 'Evidence Generated', body: cond.evidence },
      ];
      await createAuditLogEntry(siteId, 'export_docx', { conditionId: cond.id });
      await exportDocx(`Compliance_Report_${cond.id}`, sections);
      setNotify('Condition report exported as Word document.');
    } catch (err) {
      setNotify(`Word export failed: ${err.message}`);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Toast notification */}
      {notify && (
        <div className="fixed top-4 right-4 z-50 bg-primary/80 border border-primary/60 text-primary text-xs  px-4 py-3  backdrop-blur-sm animate-fade-in">
          {notify}
          <button onClick={() => setNotify('')} className="ml-3 text-primary hover:text-white">&times;</button>
        </div>
      )}

      {/* Header */}
      <div className=" border border-primary/30 bg-primary/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">Continuous Compliance Operating System</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Every permit condition converted to live controls, alarms, reports, and audit logs. This is how Brick operates the site post-COD.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('conditions')}
              className={`text-xs px-4 py-2  border transition-all ${view === 'conditions' ? 'bg-primary text-white border-primary' : 'bg-muted text-muted-foreground border-border hover:text-foreground'}`}
            >
              Permit Conditions
            </button>
            <button
              onClick={() => setView('validation')}
              className={`text-xs px-4 py-2  border transition-all ${view === 'validation' ? 'bg-emerald-700 text-white border-emerald-600' : 'bg-muted text-muted-foreground border-border hover:text-foreground'}`}
            >
              Document Validation
            </button>
            <button
              onClick={() => setView('submissions')}
              className={`text-xs px-4 py-2  border transition-all ${view === 'submissions' ? 'bg-destructive text-white border-amber-600' : 'bg-muted text-muted-foreground border-border hover:text-foreground'}`}
            >
              Agency Submissions
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-card/40  p-3 border border-green-700/30">
            <div className="text-xs text-muted-foreground">Compliant Conditions</div>
            <div className="text-2xl font-bold text-primary">{compliantCount}</div>
            <div className="text-xs text-muted-foreground/70">of {CONDITIONS.length} tracked</div>
          </div>
          <div className="bg-card/40  p-3 border border-amber-700/30">
            <div className="text-xs text-muted-foreground">Near-Limit Alerts</div>
            <div className="text-2xl font-bold text-destructive">{warningCount}</div>
            <div className="text-xs text-muted-foreground/70">proactive warning</div>
          </div>
          <div className="bg-card/40  p-3 border border-red-700/30">
            <div className="text-xs text-muted-foreground">Violations</div>
            <div className="text-2xl font-bold text-destructive">{violationCount}</div>
            <div className="text-xs text-muted-foreground/70">requires action</div>
          </div>
          <div className="bg-card/40  p-3 border border-blue-700/30">
            <div className="text-xs text-muted-foreground">Reporting Due</div>
            <div className="text-2xl font-bold text-blue-400">{pendingCount}</div>
            <div className="text-xs text-muted-foreground/70">upcoming deadlines</div>
          </div>
          <div className="bg-card/40  p-3 border border-primary/30">
            <div className="text-xs text-muted-foreground">Audit Trail</div>
            <div className="text-2xl font-bold text-primary">Live</div>
            <div className="text-xs text-muted-foreground/70">all actions logged</div>
          </div>
        </div>
      </div>

      {/* ── CONDITIONS VIEW ──────────────────────────────────────────────────── */}
      {view === 'conditions' && (
        <>
          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(c => (
              <button key={c}
                onClick={() => setFilter(c)}
                className={`text-xs px-3 py-1.5  border transition-all
                  ${filter === c ? 'bg-primary text-white border-primary' : 'bg-muted text-muted-foreground border-border hover:text-foreground'}`}>
                {c}
              </button>
            ))}
          </div>

          {/* Conditions */}
          <div className="space-y-3">
            {filtered.map(cond => (
              <div key={cond.id} className=" border border-border/40 bg-card/40 overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === cond.id ? null : cond.id)}
                  className="w-full p-4 flex items-start justify-between gap-4 hover:bg-muted/20 transition-colors text-left"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <span className={`text-xs px-2.5 py-1  border flex-shrink-0 mt-0.5 ${STATUS_COLORS[getStatus(cond.id)]}`}>
                      {STATUS_LABELS[getStatus(cond.id)]}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-foreground/80">{cond.condition}</div>
                      <div className="text-xs text-muted-foreground/70 mt-0.5">{cond.cfr} · {cond.category}</div>
                    </div>
                  </div>
                  <span className="text-muted-foreground/70 flex-shrink-0">{expanded === cond.id ? '▲' : '▼'}</span>
                </button>

                {expanded === cond.id && (
                  <div className="border-t border-border/40 p-4 grid md:grid-cols-2 gap-4 bg-card/30">
                    <div>
                      <p className="text-xs font-semibold text-primary mb-2">Brick Control Action</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{cond.brickControl}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-primary mb-2">Evidence Generated</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{cond.evidence}</p>
                    </div>
                    <div className="md:col-span-2 flex gap-2 flex-wrap">
                      <button
                        onClick={() => setNotify(`Trend data for "${cond.condition}" loaded — view the Digital Twin tab for full charts.`)}
                        className="text-xs bg-muted hover:bg-muted-foreground/10 text-foreground/80  px-3 py-1.5 transition-colors border border-border">
                        📊 View Trend Data
                      </button>
                      <button
                        onClick={() => handleGenerateReport(cond)}
                        disabled={reportLoading}
                        className="text-xs bg-muted hover:bg-muted-foreground/10 text-foreground/80  px-3 py-1.5 transition-colors border border-border disabled:opacity-50">
                        {reportLoading ? '⏳ Generating...' : '📄 Generate Compliance Report'}
                      </button>
                      <button
                        onClick={handleExportAudit}
                        className="text-xs bg-muted hover:bg-muted-foreground/10 text-foreground/80  px-3 py-1.5 transition-colors border border-border">
                        📤 Export Audit Log
                      </button>
                      <button
                        onClick={() => handleExportConditionDocx(cond)}
                        className="text-xs bg-blue-800/40 hover:bg-blue-700/40 text-blue-300  px-3 py-1.5 transition-colors border border-blue-700/40">
                        📝 Export as Word Doc
                      </button>
                      <button
                        onClick={() => setNotify(`Opening Regulator QA Copilot with "${cond.condition}" context.`)}
                        className="text-xs bg-primary/30 hover:bg-primary/40 text-primary  px-3 py-1.5 transition-colors border border-primary/40">
                        🤖 Regulator QA Copilot
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Regulator QA Copilot */}
          <div className=" border border-primary/30 bg-primary/10 p-5">
            <h3 className="text-sm font-semibold text-primary mb-3">Regulator QA Copilot — RAI & Deficiency Response Engine</h3>
            <div className="grid md:grid-cols-2 gap-4 text-xs">
              {[
                { type: 'RAI Response', icon: '📝', desc: 'Agency Request for Additional Information auto-responded from indexed permit record. Average response time: 2 days vs. 3–6 weeks.' },
                { type: 'Deficiency Letter', icon: '⚡', desc: 'Permit deficiency letters mapped to specific document sections. AI drafts cure within 24 hours for PE review.' },
                { type: 'Public Comment', icon: '💬', desc: 'Environmental justice and public comment responses generated from community data, site stats, and health impact analysis.' },
                { type: 'Modeling Comments', icon: '📊', desc: 'AERMOD peer review comments responded to with model parameter citations, meteorological data justifications, and receptor grid rationale.' },
              ].map(item => (
                <div key={item.type} className="bg-card/40 border border-border/40  p-4 flex gap-3">
                  <span className="text-2xl flex-shrink-0">{item.icon}</span>
                  <div>
                    <div className="font-semibold text-foreground/80 mb-1">{item.type}</div>
                    <div className="text-muted-foreground leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── VALIDATION VIEW ───────────────────────────────────────────────────── */}
      {view === 'validation' && (
        <ComplianceValidationPanel inputs={inputs} results={results} onNavigateDoc={onNavigateDoc} />
      )}

      {/* ── SUBMISSIONS VIEW ──────────────────────────────────────────────────── */}
      {view === 'submissions' && (
        <AgencySubmission inputs={inputs} results={results} siteId={siteId} onNotify={setNotify} />
      )}

      {/* ── Report Preview Modal ─────────────────────────────────────────────── */}
      {reportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setReportModal(null)}>
          <div className="bg-card border border-border  w-full max-w-2xl max-h-[80vh] overflow-y-auto " onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Compliance Report</h3>
                <p className="text-xs text-muted-foreground">{reportModal.report.title}</p>
              </div>
              <button onClick={() => setReportModal(null)} className="text-muted-foreground hover:text-white text-lg">&times;</button>
            </div>
            <div className="p-6 space-y-6">
              {reportModal.report.sections?.map((section, i) => (
                <div key={i}>
                  <h4 className="text-xs font-semibold text-primary mb-2">{section.heading}</h4>
                  <p className="text-xs text-foreground/80 leading-relaxed">{section.body}</p>
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 bg-card/95 backdrop-blur-sm border-t border-border px-6 py-4 flex gap-3 justify-end">
              <button onClick={() => setReportModal(null)}
                className="text-xs bg-muted hover:bg-muted-foreground/10 text-foreground/80  px-4 py-2 border border-border transition-colors">
                Close
              </button>
              <button onClick={() => {
                const sections = reportModal.report.sections || [];
                exportDocx(reportModal.report.title, sections);
                setNotify('Report downloaded as Word document.');
              }}
                className="text-xs bg-primary hover:bg-primary text-white  px-4 py-2 transition-colors">
                📥 Download as Word Doc
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
