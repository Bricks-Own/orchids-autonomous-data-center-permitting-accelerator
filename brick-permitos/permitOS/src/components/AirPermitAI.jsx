import React, { useState } from 'react';
import { AIR_MODULES, STATES_ATTAINMENT } from '../data/permitData';

function StatusBadge({ value, threshold, unit = 'tpy', label }) {
  const pct = threshold ? (value / threshold * 100) : 0;
  const status = pct >= 100 ? 'Major Source' : pct >= 80 ? 'Near Threshold' : pct >= 50 ? 'Synthetic Minor Viable' : 'Below Minor';
  const color = pct >= 100 ? 'text-red-400 bg-red-900/30 border-red-700/40' :
    pct >= 80 ? 'text-amber-400 bg-amber-900/30 border-amber-700/40' :
    pct >= 50 ? 'text-yellow-400 bg-yellow-900/30 border-yellow-700/40' :
    'text-green-400 bg-green-900/30 border-green-700/40';
  return (
    <div className={`border rounded-xl p-4 ${color}`}>
      <div className="text-xs font-medium text-gray-400 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value?.toFixed(1)} <span className="text-sm font-normal">{unit}</span></div>
      {threshold && (
        <>
          <div className="mt-2 bg-black/20 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <div className="text-xs mt-1">{status} — {pct.toFixed(0)}% of {threshold} tpy threshold</div>
        </>
      )}
    </div>
  );
}

export default function AirPermitAI({ results, inputs }) {
  const [expanded, setExpanded] = useState(null);

  if (!results) {
    return (
      <div className="p-6 text-center py-20">
        <div className="text-4xl mb-4">💨</div>
        <h3 className="text-gray-400 font-medium mb-2">No Site Data Yet</h3>
        <p className="text-gray-600 text-sm">Go to Site Intake and run the permit screening first.</p>
      </div>
    );
  }

  const { baseline, controlled, avoided, pathway, totalMW, annualMMBtu } = results;
  const attainment = STATES_ATTAINMENT[inputs.state] || '';
  const isNonAttain = attainment.includes('Nonattainment') || inputs.nonAttainment;

  const pollutants = [
    { key: 'nox', label: 'NOx', threshold: 100, color: 'text-red-400' },
    { key: 'co', label: 'CO', threshold: 100, color: 'text-orange-400' },
    { key: 'so2', label: 'SO₂', threshold: 100, color: 'text-yellow-400' },
    { key: 'pm25', label: 'PM₂.₅', threshold: 100, color: 'text-blue-400' },
    { key: 'voc', label: 'VOC', threshold: 100, color: 'text-violet-400' },
    { key: 'hap', label: 'HAP', threshold: 10, color: 'text-pink-400' },
    { key: 'co2e', label: 'CO₂e', threshold: 100000, color: 'text-green-400' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Banner */}
      <div className="rounded-xl border border-indigo-700/30 bg-indigo-950/20 p-4 flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">{inputs.siteName} — Air Permit Analysis</h2>
          <p className="text-xs text-gray-500 mt-0.5">{inputs.state} · {totalMW} MW installed · {inputs.turbines} turbines · {inputs.hours.toLocaleString()} hr/yr</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`text-xs px-2.5 py-1 rounded-full border ${pathway.requiresPSD ? 'bg-red-900/30 border-red-700/40 text-red-400' : 'bg-green-900/30 border-green-700/40 text-green-400'}`}>
            {pathway.requiresPSD ? '⚠ PSD Major Source' : '✓ Below PSD Threshold'}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-full border ${pathway.requiresTitleV ? 'bg-amber-900/30 border-amber-700/40 text-amber-400' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
            {pathway.requiresTitleV ? '⚠ Title V Required' : '✓ Below Title V'}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-full border ${pathway.syntheticMinorViable ? 'bg-green-900/30 border-green-700/40 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
            {pathway.syntheticMinorViable ? '✓ Synthetic Minor Viable' : '⚠ Synthetic Minor Not Viable'}
          </span>
        </div>
      </div>

      {/* PTE comparison grid */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Potential to Emit (PTE) — Baseline vs. Brick-Controlled</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-800/60">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 rounded-tl-lg">Pollutant</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">Baseline PTE (tpy)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">Brick-Controlled (tpy)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">Avoided (tpy)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">PSD Threshold</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 rounded-tr-lg">Status</th>
              </tr>
            </thead>
            <tbody>
              {pollutants.map((p, i) => {
                const base = baseline[p.key];
                const ctrl = controlled[p.key];
                const avd = base - ctrl;
                const pct = p.threshold ? (ctrl / p.threshold * 100) : 0;
                const status = pct >= 100 ? { label: 'Major Source', cls: 'text-red-400 bg-red-900/20' } :
                  pct >= 80 ? { label: 'Near Threshold', cls: 'text-amber-400 bg-amber-900/20' } :
                  pct >= 50 ? { label: 'Synthetic Minor', cls: 'text-yellow-400 bg-yellow-900/20' } :
                  { label: 'Below Minor', cls: 'text-green-400 bg-green-900/20' };
                return (
                  <tr key={p.key} className={`border-t border-gray-800/40 ${i % 2 === 0 ? 'bg-gray-900/20' : ''}`}>
                    <td className={`px-4 py-3 font-semibold text-sm ${p.color}`}>{p.label}</td>
                    <td className="px-4 py-3 text-right text-gray-400 font-mono text-sm">{base?.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-white font-mono text-sm font-semibold">{ctrl?.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-green-400 font-mono text-sm">-{avd?.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 font-mono text-sm">{p.threshold?.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permit Pathway */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Permit Pathway Determination</h3>
          <div className="space-y-3 text-xs">
            {[
              {
                label: 'NSR/PSD Applicability',
                status: pathway.requiresPSD ? 'PSD Required (≥100 tpy NOx or CO)' : 'Below PSD threshold',
                ok: !pathway.requiresPSD,
                detail: 'CAA § 165 / 40 CFR Parts 51/52. PSD applies to new major sources in attainment areas.'
              },
              {
                label: 'Nonattainment NSR',
                status: isNonAttain ? 'Nonattainment NSR may apply — verify county SIP' : 'Not triggered (attainment area)',
                ok: !isNonAttain,
                detail: 'CAA § 173. If county is nonattainment for NOx or PM, NSR/LAER offsets required.'
              },
              {
                label: 'Title V Operating Permit',
                status: pathway.requiresTitleV ? 'Title V Required (aggregate major source)' : 'Below Title V thresholds',
                ok: !pathway.requiresTitleV,
                detail: '40 CFR Part 70/71. Required if PTE ≥ 100 tpy for any regulated air pollutant.'
              },
              {
                label: 'Synthetic Minor Pathway',
                status: pathway.syntheticMinorViable ? `Viable — Brick controls reduce PTE to ${controlled.nox?.toFixed(1)} tpy NOx` : 'Not viable at current inputs',
                ok: pathway.syntheticMinorViable,
                detail: 'Enforceable operational limits (runtime caps, fuel use limits) can reduce PTE below major source thresholds.'
              },
              {
                label: 'NSPS — 40 CFR Part 60 Subpart KKKK/KKKKa',
                status: 'Applicable — Stationary combustion turbines',
                ok: false,
                detail: 'New and modified stationary combustion turbines. NOx, CO, SO₂ emission standards and initial performance testing required.'
              },
              {
                label: 'NESHAP — 40 CFR Part 63 Subpart YYYY',
                status: baseline.hap >= 10 ? 'Major HAP source — Subpart YYYY applies' : 'Area source — confirm applicability',
                ok: baseline.hap < 10,
                detail: 'Applies at major HAP sources (≥10 tpy single HAP or ≥25 tpy combined HAP).'
              },
              {
                label: 'Engine NSPS/NESHAP (Subparts IIII/JJJJ/ZZZZ)',
                status: `Applicable — ${inputs.gensetCount} backup gensets at ≤${inputs.gensetHours} hr/yr`,
                ok: inputs.gensetHours <= 100,
                detail: '40 CFR Parts 60 IIII/JJJJ and 63 ZZZZ. Emergency engines limited to 100 hr/yr maintenance + emergency use.'
              },
              {
                label: 'GHG / GHGRP',
                status: baseline.co2e >= 25000 ? 'GHGRP Reporting Required (≥25,000 tpy CO₂e)' : 'Below GHGRP threshold',
                ok: baseline.co2e < 25000,
                detail: '40 CFR Part 98 Subpart C. Annual GHG report to EPA eGGRT system required if ≥25,000 tpy CO₂e.'
              },
            ].map(item => (
              <div key={item.label} className="border border-gray-800/60 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-gray-300">{item.label}</div>
                    <div className={`mt-0.5 ${item.ok ? 'text-green-400' : 'text-amber-400'}`}>{item.ok ? '✓' : '⚠'} {item.status}</div>
                  </div>
                </div>
                <div className="text-gray-600 mt-1 text-xs">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CFR Modules */}
        <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Air Permit Modules — Deliverables</h3>
          <div className="space-y-3">
            {AIR_MODULES.map(mod => (
              <div key={mod.id} className="border border-gray-800/40 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === mod.id ? null : mod.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-800/30 transition-colors text-left"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-300">{mod.name}</div>
                    <div className="text-xs text-gray-600">{mod.citations[0]}</div>
                  </div>
                  <span className="text-gray-600">{expanded === mod.id ? '▲' : '▼'}</span>
                </button>
                {expanded === mod.id && (
                  <div className="border-t border-gray-800/40 p-3 bg-gray-900/40 space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-1">Regulatory Citations</p>
                      <div className="flex flex-wrap gap-1">
                        {mod.citations.map(c => (
                          <span key={c} className="text-xs bg-indigo-900/40 text-indigo-300 border border-indigo-800/40 rounded px-2 py-0.5">{c}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-1">Auto-Generated Deliverables</p>
                      <ul className="space-y-1">
                        {mod.deliverables.map(d => (
                          <li key={d} className="text-xs text-gray-400 flex gap-2">
                            <span className="text-green-500 mt-0.5">✓</span>{d}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-indigo-950/30 border border-indigo-800/30 rounded-lg p-2.5">
                      <p className="text-xs text-indigo-300"><span className="font-semibold">AI Acceleration:</span> {mod.aiAcceleration}</p>
                    </div>
                    <div className="text-xs text-gray-600">
                      Timeline: Weeks {mod.weeks[0]}–{mod.weeks[1]}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BACT Strategies */}
      <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">BACT Strategy — AI Recommendation (Top-Down Analysis)</h3>
        <div className="grid md:grid-cols-3 gap-4 text-xs">
          {[
            {
              tech: 'Dry Low NOx (DLN) Combustion',
              type: 'Combustion Controls',
              nox: '≤9–15 ppmvd @ 15% O₂',
              status: 'Step 1 — Available',
              color: 'border-green-700/40 bg-green-950/20',
            },
            {
              tech: 'Selective Catalytic Reduction (SCR)',
              type: 'Post-Combustion',
              nox: '≤2–5 ppmvd @ 15% O₂',
              status: 'Step 2 — Evaluate Economics',
              color: 'border-amber-700/40 bg-amber-950/20',
            },
            {
              tech: 'Oxidation Catalyst (CO/VOC)',
              type: 'Post-Combustion',
              nox: 'CO reduction 90%+',
              status: 'Step 2 — Often Required',
              color: 'border-blue-700/40 bg-blue-950/20',
            },
            {
              tech: 'Operational Limits (Brick Controls)',
              type: 'Dispatch Optimization',
              nox: 'Runtime cap + load optimization',
              status: 'Step 3 — Enforceable Limit',
              color: 'border-violet-700/40 bg-violet-950/20',
            },
            {
              tech: 'Fuel Switching / Natural Gas Only',
              type: 'Fuel Control',
              nox: 'Pipeline-quality gas eliminates SO₂/PM',
              status: 'Typically Required',
              color: 'border-indigo-700/40 bg-indigo-950/20',
            },
            {
              tech: 'Good Combustion Practices (GCP)',
              type: 'O&M Controls',
              nox: 'Air/fuel ratio, maintenance tuning',
              status: 'Standard Requirement',
              color: 'border-gray-700/40 bg-gray-900/40',
            },
          ].map(t => (
            <div key={t.tech} className={`border rounded-xl p-4 ${t.color}`}>
              <div className="font-semibold text-gray-300 mb-1">{t.tech}</div>
              <div className="text-gray-500">{t.type}</div>
              <div className="text-gray-400 mt-2">{t.nox}</div>
              <div className="mt-2 text-indigo-400 font-medium">{t.status}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
