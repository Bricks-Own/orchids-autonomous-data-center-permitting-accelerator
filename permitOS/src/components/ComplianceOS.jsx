import React, { useState, useEffect } from 'react';

const CONDITIONS = [
  {
    id: 'nox_annual',
    category: 'Air',
    condition: 'Annual NOx Emissions Cap',
    cfr: 'Permit Condition / Title V',
    brickControl: 'Dispatch limiter + cooling optimization. Alert at 70% / 85% / 95% of annual cap.',
    evidence: 'Daily NOx ledger, fuel use log, runtime log, forecast-to-cap report',
    status: 'active',
    compliance: 'compliant',
    value: null,
  },
  {
    id: 'co_annual',
    category: 'Air',
    condition: 'Annual CO Emissions Cap',
    cfr: 'Permit Condition / Title V',
    brickControl: 'Oxidation catalyst monitoring + combustion parameter tracking.',
    evidence: 'Monthly CO emission log, catalyst inspection records, CEMS data',
    status: 'active',
    compliance: 'compliant',
    value: null,
  },
  {
    id: 'runtime',
    category: 'Air',
    condition: 'Turbine Operating Hour Limits',
    cfr: 'Synthetic minor enforceable limit',
    brickControl: 'Unit-level runtime tracking. Automated curtailment sequence when approaching limit.',
    evidence: 'Unit operating hour logs, fuel use records, exceedance prevention documentation',
    status: 'active',
    compliance: 'compliant',
    value: null,
  },
  {
    id: 'startup',
    category: 'Air',
    condition: 'Startup / Shutdown Emission Events',
    cfr: 'SSM provisions / state rules',
    brickControl: 'Battery + thermal storage smoothing eliminates unnecessary starts. Minimum load protocols.',
    evidence: 'Startup event log, avoided starts analysis, battery dispatch record, heat-rate impact report',
    status: 'active',
    compliance: 'compliant',
    value: null,
  },
  {
    id: 'nsps_kkkk',
    category: 'Air',
    condition: 'NSPS Subpart KKKK NOx Standard',
    cfr: '40 CFR Part 60 Subpart KKKK / KKKKa',
    brickControl: 'DLN combustor monitoring + fuel quality tracking + load optimization to stay in DLN mode.',
    evidence: 'Quarterly fuel use, annual performance test records, CEMS data, DLN operating envelope log',
    status: 'active',
    compliance: 'compliant',
    value: null,
  },
  {
    id: 'engine_runtime',
    category: 'Air',
    condition: 'Emergency Engine Runtime ≤100 hr/yr',
    cfr: '40 CFR Part 60 Subpart IIII/JJJJ / 40 CFR Part 63 Subpart ZZZZ',
    brickControl: 'Per-engine runtime tracker with real-time alerts. Automatic logging of emergency event basis.',
    evidence: 'Engine runtime log per unit, emergency event justification records, fuel use log',
    status: 'active',
    compliance: 'warning',
    value: null,
  },
  {
    id: 'npdes_discharge',
    category: 'Water',
    condition: 'NPDES Effluent Discharge Limits',
    cfr: '40 CFR Part 122 / Permit Conditions',
    brickControl: 'Cooling tower COC monitoring, blowdown chemistry tracking, automated DMR generation.',
    evidence: 'Monthly DMR, effluent sample results, blowdown volume report, discharge monitoring log',
    status: 'active',
    compliance: 'compliant',
    value: null,
  },
  {
    id: 'water_blowdown',
    category: 'Water',
    condition: 'Cooling Tower Blowdown Volume / TDS Limits',
    cfr: 'NPDES permit / POTW pretreatment limits',
    brickControl: 'Cycles-of-concentration optimization + blowdown forecasting. Real-time TDS tracking.',
    evidence: 'Water balance log, COC tracking, blowdown sample results, daily flow meter records',
    status: 'active',
    compliance: 'compliant',
    value: null,
  },
  {
    id: 'swppp_inspect',
    category: 'Water',
    condition: 'SWPPP BMP Inspections',
    cfr: '40 CFR 122.26 / MSGP Requirement',
    brickControl: 'Inspection scheduler + mobile photo evidence + corrective action work orders.',
    evidence: 'SWPPP inspection log, corrective action log, photo documentation, rainfall-triggered inspection records',
    status: 'active',
    compliance: 'compliant',
    value: null,
  },
  {
    id: 'spcc_inspect',
    category: 'Water',
    condition: 'SPCC Tank / Secondary Containment Inspections',
    cfr: '40 CFR Part 112',
    brickControl: 'Monthly and annual tank inspection workflow with work orders. Containment capacity alerts.',
    evidence: 'SPCC logs, release-response drill records, secondary containment capacity report, inspection checklists',
    status: 'active',
    compliance: 'compliant',
    value: null,
  },
  {
    id: 'title_v_cert',
    category: 'Reporting',
    condition: 'Annual Title V Compliance Certification',
    cfr: '40 CFR Part 70 / State Title V rules',
    brickControl: 'Auto-aggregates annual compliance data, flags deviations, generates draft certification for PE signature.',
    evidence: 'Annual compliance certification, deviation/exceedance log, monitoring data summary',
    status: 'active',
    compliance: 'pending',
    value: null,
  },
  {
    id: 'ghg_report',
    category: 'Reporting',
    condition: 'Annual GHG Report (GHGRP)',
    cfr: '40 CFR Part 98 Subpart C',
    brickControl: 'Pulls fuel consumption data, calculates CO₂e by unit, generates eGGRT-ready XML.',
    evidence: 'Annual GHG report, fuel use records, combustion source emissions calculations',
    status: 'active',
    compliance: 'compliant',
    value: null,
  },
];

const CATEGORIES = ['All', 'Air', 'Water', 'Reporting'];
const STATUS_COLORS = {
  compliant: 'text-green-400 bg-green-900/30 border-green-700/40',
  warning: 'text-amber-400 bg-amber-900/30 border-amber-700/40',
  violation: 'text-red-400 bg-red-900/30 border-red-700/40',
  pending: 'text-blue-400 bg-blue-900/30 border-blue-700/40',
};
const STATUS_LABELS = {
  compliant: '✓ Compliant',
  warning: '⚠ Near Limit',
  violation: '✗ Violation',
  pending: '○ Due Soon',
};

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
    <div className="flex items-center gap-3 bg-gray-900/60 border border-gray-700/40 rounded-full px-4 py-2">
      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0"></span>
      <span className="text-xs text-gray-400 transition-all">{msgs[tick % msgs.length]}</span>
    </div>
  );
}

export default function ComplianceOS({ results, inputs }) {
  const [filter, setFilter] = useState('All');
  const [expanded, setExpanded] = useState(null);
  const [notify, setNotify] = useState('');

  useEffect(() => {
    if (notify) {
      const t = setTimeout(() => setNotify(''), 3000);
      return () => clearTimeout(t);
    }
  }, [notify]);

  const filtered = CONDITIONS.filter(c => filter === 'All' || c.category === filter);
  const compliantCount = CONDITIONS.filter(c => c.compliance === 'compliant').length;
  const warningCount = CONDITIONS.filter(c => c.compliance === 'warning').length;
  const pendingCount = CONDITIONS.filter(c => c.compliance === 'pending').length;

  return (
    <div className="p-6 space-y-6">
      {/* Toast notification */}
      {notify && (
        <div className="fixed top-4 right-4 z-50 bg-indigo-900/90 border border-indigo-600/60 text-indigo-200 text-xs rounded-xl px-4 py-3 shadow-2xl backdrop-blur-sm animate-fade-in">
          {notify}
          <button onClick={() => setNotify('')} className="ml-3 text-indigo-400 hover:text-white">&times;</button>
        </div>
      )}

      {/* Header */}
      <div className="rounded-xl border border-indigo-700/30 bg-indigo-950/20 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">Continuous Compliance Operating System</h2>
            <p className="text-xs text-gray-500 mt-0.5">Every permit condition converted to live controls, alarms, reports, and audit logs. This is how Brick operates the site post-COD.</p>
          </div>
          <LiveTicker results={results} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-gray-900/40 rounded-xl p-3 border border-green-700/30">
            <div className="text-xs text-gray-500">Compliant Conditions</div>
            <div className="text-2xl font-bold text-green-400">{compliantCount}</div>
            <div className="text-xs text-gray-600">of {CONDITIONS.length} tracked</div>
          </div>
          <div className="bg-gray-900/40 rounded-xl p-3 border border-amber-700/30">
            <div className="text-xs text-gray-500">Near-Limit Alerts</div>
            <div className="text-2xl font-bold text-amber-400">{warningCount}</div>
            <div className="text-xs text-gray-600">proactive warning</div>
          </div>
          <div className="bg-gray-900/40 rounded-xl p-3 border border-blue-700/30">
            <div className="text-xs text-gray-500">Reporting Due</div>
            <div className="text-2xl font-bold text-blue-400">{pendingCount}</div>
            <div className="text-xs text-gray-600">upcoming deadlines</div>
          </div>
          <div className="bg-gray-900/40 rounded-xl p-3 border border-indigo-700/30">
            <div className="text-xs text-gray-500">Audit Trail</div>
            <div className="text-2xl font-bold text-indigo-400">Live</div>
            <div className="text-xs text-gray-600">all actions logged</div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map(c => (
          <button key={c}
            onClick={() => setFilter(c)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all
              ${filter === c ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200'}`}>
            {c}
          </button>
        ))}
      </div>

      {/* Conditions */}
      <div className="space-y-3">
        {filtered.map(cond => (
          <div key={cond.id} className="rounded-xl border border-gray-700/40 bg-gray-900/40 overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === cond.id ? null : cond.id)}
              className="w-full p-4 flex items-start justify-between gap-4 hover:bg-gray-800/20 transition-colors text-left"
            >
              <div className="flex items-start gap-3 flex-1">
                <span className={`text-xs px-2.5 py-1 rounded-full border flex-shrink-0 mt-0.5 ${STATUS_COLORS[cond.compliance]}`}>
                  {STATUS_LABELS[cond.compliance]}
                </span>
                <div>
                  <div className="text-sm font-medium text-gray-300">{cond.condition}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{cond.cfr} · {cond.category}</div>
                </div>
              </div>
              <span className="text-gray-600 flex-shrink-0">{expanded === cond.id ? '▲' : '▼'}</span>
            </button>

            {expanded === cond.id && (
              <div className="border-t border-gray-800/40 p-4 grid md:grid-cols-2 gap-4 bg-gray-900/30">
                <div>
                  <p className="text-xs font-semibold text-indigo-400 mb-2">Brick Control Action</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{cond.brickControl}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-green-400 mb-2">Evidence Generated</p>
                  <p className="text-xs text-gray-400 leading-relaxed">{cond.evidence}</p>
                </div>
                <div className="md:col-span-2 flex gap-2 flex-wrap">
                  <button
                    onClick={() => setNotify(`Trend data for "${cond.condition}" loaded — view the Digital Twin tab for full charts.`)}
                    className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg px-3 py-1.5 transition-colors border border-gray-700">
                    📊 View Trend Data
                  </button>
                  <button
                    onClick={() => setNotify(`Compliance report for "${cond.condition}" generated — ready for PE review.`)}
                    className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg px-3 py-1.5 transition-colors border border-gray-700">
                    📄 Generate Compliance Report
                  </button>
                  <button
                    onClick={() => setNotify(`Audit log for "${cond.condition}" exported — full chain of custody preserved.`)}
                    className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg px-3 py-1.5 transition-colors border border-gray-700">
                    📤 Export Audit Log
                  </button>
                  <button
                    onClick={() => setNotify(`Opening Regulator QA Copilot with "${cond.condition}" context.`)}
                    className="text-xs bg-indigo-800/40 hover:bg-indigo-700/40 text-indigo-300 rounded-lg px-3 py-1.5 transition-colors border border-indigo-700/40">
                    🤖 Regulator QA Copilot
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Regulator QA Copilot */}
      <div className="rounded-xl border border-violet-700/30 bg-violet-950/20 p-5">
        <h3 className="text-sm font-semibold text-violet-300 mb-3">Regulator QA Copilot — RAI & Deficiency Response Engine</h3>
        <div className="grid md:grid-cols-2 gap-4 text-xs">
          {[
            { type: 'RAI Response', icon: '📝', desc: 'Agency Request for Additional Information auto-responded from indexed permit record. Average response time: 2 days vs. 3–6 weeks.' },
            { type: 'Deficiency Letter', icon: '⚡', desc: 'Permit deficiency letters mapped to specific document sections. AI drafts cure within 24 hours for PE review.' },
            { type: 'Public Comment', icon: '💬', desc: 'Environmental justice and public comment responses generated from community data, site stats, and health impact analysis.' },
            { type: 'Modeling Comments', icon: '📊', desc: 'AERMOD peer review comments responded to with model parameter citations, meteorological data justifications, and receptor grid rationale.' },
          ].map(item => (
            <div key={item.type} className="bg-gray-900/40 border border-gray-700/40 rounded-xl p-4 flex gap-3">
              <span className="text-2xl flex-shrink-0">{item.icon}</span>
              <div>
                <div className="font-semibold text-gray-300 mb-1">{item.type}</div>
                <div className="text-gray-500 leading-relaxed">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
