import React, { useState } from 'react';
import { WATER_MODULES } from '../data/permitData';

export default function WaterPermitAI({ results, inputs }) {
  const [expanded, setExpanded] = useState(null);

  if (!results) {
    return (
      <div className="p-6 text-center py-20">
        <div className="text-4xl mb-4">💧</div>
        <h3 className="text-gray-400 font-medium mb-2">No Site Data Yet</h3>
        <p className="text-gray-600 text-sm">Go to Site Intake and run the permit screening first.</p>
      </div>
    );
  }

  const { water } = results;

  const waterMetrics = [
    { label: 'Cooling Water Use', value: `${water.annualWaterMG.toFixed(1)} MG/yr`, sub: `${inputs.coolingMGD} MGD`, color: 'text-blue-400' },
    { label: 'Blowdown Volume', value: `${water.blowdownMG.toFixed(1)} MG/yr`, sub: 'NPDES / pretreatment', color: 'text-amber-400' },
    { label: 'Optimized Water (Brick)', value: `${water.optimizedWater.toFixed(1)} MG/yr`, sub: `-${(water.annualWaterMG - water.optimizedWater).toFixed(1)} MG avoided`, color: 'text-green-400' },
    { label: 'Makeup Water Required', value: `${water.makeupMG.toFixed(1)} MG/yr`, sub: 'Utility supply', color: 'text-violet-400' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Banner */}
      <div className="rounded-xl border border-blue-700/30 bg-blue-950/20 p-4 flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">{inputs.siteName} — Water Permit Analysis</h2>
          <p className="text-xs text-gray-500 mt-0.5">{inputs.state} · Cooling: {inputs.coolingMGD} MGD · Process water: {inputs.waterMGD} MGD</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="bg-blue-900/30 border border-blue-700/40 text-blue-400 px-2.5 py-1 rounded-full">NPDES Required</span>
          <span className="bg-amber-900/30 border border-amber-700/40 text-amber-400 px-2.5 py-1 rounded-full">SPCC Applicable</span>
          <span className="bg-violet-900/30 border border-violet-700/40 text-violet-400 px-2.5 py-1 rounded-full">SWPPP Required</span>
        </div>
      </div>

      {/* Water metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {waterMetrics.map(m => (
          <div key={m.label} className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-4">
            <div className="text-xs text-gray-500 mb-1">{m.label}</div>
            <div className={`text-xl font-bold ${m.color}`}>{m.value}</div>
            <div className="text-xs text-gray-600 mt-0.5">{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Permit pathway */}
        <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Water Permit Pathway Determination</h3>
          <div className="space-y-3 text-xs">
            {[
              {
                label: 'NPDES Individual or General Permit',
                trigger: 'Any wastewater or process water discharge to waters of the US',
                citations: '40 CFR Parts 122/124/125',
                status: 'Required',
                detail: 'Cooling tower blowdown, sanitary, and any process effluent. Individual permit typically needed for cooling tower discharge at large data centers.',
                ok: false,
              },
              {
                label: 'Industrial Stormwater — MSGP',
                trigger: 'SIC code 7374 (Data Processing) — confirm with state',
                citations: '40 CFR 122.26 / EPA MSGP',
                status: 'Evaluate',
                detail: 'Some data centers fall under MSGP Sector X or Y. State-specific general permits may provide alternative pathway.',
                ok: null,
              },
              {
                label: 'Construction Stormwater — CGP',
                trigger: 'Site disturbance ≥ 1 acre (this site: high probability)',
                citations: 'EPA CGP / State equivalent',
                status: 'Required',
                detail: 'Notice of Intent (NOI) + SWPPP required before earth disturbance. State permit often substitutes for federal CGP.',
                ok: false,
              },
              {
                label: 'SPCC — Fuel and Oil Storage',
                trigger: `${inputs.gensetCount} gensets with diesel fuel tanks; aggregate > 1,320 gal above-ground`,
                citations: '40 CFR Part 112',
                status: 'Required',
                detail: 'SPCC Plan required if above-ground storage > 1,320 gal or underground > 42,000 gal. PE-certified plan if > 10,000 gal.',
                ok: false,
              },
              {
                label: 'CWA 316(b) — Cooling Water Intake',
                trigger: `Cooling water intake flow: ${inputs.coolingMGD} MGD — evaluate Phase II applicability`,
                citations: 'CWA § 316(b) / 40 CFR Part 125 Subpart J',
                status: inputs.coolingMGD >= 2 ? 'Evaluate' : 'Likely Below Threshold',
                detail: 'Phase II applies to existing facilities with ≥2 MGD intake. New facilities evaluated under state requirements.',
                ok: inputs.coolingMGD < 2,
              },
              {
                label: 'Pretreatment / POTW Discharge',
                trigger: 'Cooling tower blowdown to municipal sewer',
                citations: '40 CFR Part 403 / Local pretreatment ordinance',
                status: 'Evaluate with Utility',
                detail: 'Cooling tower blowdown may require industrial user permit. Thermal discharge limits often apply.',
                ok: null,
              },
              {
                label: 'Wetlands / Waters of the US',
                trigger: 'Site disturbance, grading, drainage improvements',
                citations: 'CWA § 404/401 / Sackett v. EPA (2023)',
                status: 'Screening Required',
                detail: 'NWI and soils screening required. If jurisdictional waters present, Section 404 permit from USACE required.',
                ok: null,
              },
              {
                label: 'Water Conservation / Reuse Plan',
                trigger: 'Regulatory trend and utility requirements',
                citations: 'State water conservation rules / utility agreements',
                status: 'Recommend',
                detail: 'Brick controls can achieve water efficiency via cycles-of-concentration optimization, ZLD, and reuse strategies.',
                ok: true,
              },
            ].map(item => (
              <div key={item.label} className="border border-gray-800/60 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-gray-300">{item.label}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ml-2 flex-shrink-0
                    ${item.ok === false ? 'bg-amber-900/30 text-amber-400' :
                      item.ok === true ? 'bg-green-900/30 text-green-400' :
                      'bg-blue-900/30 text-blue-400'}`}>
                    {item.status}
                  </span>
                </div>
                <div className="text-gray-600 mt-1">{item.trigger}</div>
                <div className="text-indigo-400/70 mt-0.5">{item.citations}</div>
                <div className="text-gray-600 mt-1">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Water Modules */}
        <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Water Permit Modules — Deliverables</h3>
          <div className="space-y-3">
            {WATER_MODULES.map(mod => (
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
                    <div className="flex flex-wrap gap-1">
                      {mod.citations.map(c => (
                        <span key={c} className="text-xs bg-blue-900/30 text-blue-300 border border-blue-800/40 rounded px-2 py-0.5">{c}</span>
                      ))}
                    </div>
                    <ul className="space-y-1">
                      {mod.deliverables.map(d => (
                        <li key={d} className="text-xs text-gray-400 flex gap-2">
                          <span className="text-green-500 mt-0.5">✓</span>{d}
                        </li>
                      ))}
                    </ul>
                    <div className="bg-blue-950/30 border border-blue-800/30 rounded-lg p-2.5">
                      <p className="text-xs text-blue-300"><span className="font-semibold">AI Acceleration:</span> {mod.aiAcceleration}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cooling Tower Water Balance */}
      <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Cooling Tower Water Balance — AI-Modeled</h3>
        <div className="grid md:grid-cols-4 gap-4 text-sm">
          {[
            { label: 'Makeup Water', value: `${water.makeupMG.toFixed(1)} MG/yr`, formula: 'Evaporation + Blowdown + Drift', color: 'text-blue-400' },
            { label: 'Evaporation Loss', value: `${(water.annualWaterMG * 0.78).toFixed(1)} MG/yr`, formula: '~1.5–2% of circulating flow', color: 'text-orange-400' },
            { label: 'Blowdown', value: `${water.blowdownMG.toFixed(1)} MG/yr`, formula: `${inputs.blowdownPct}% of cooling flow`, color: 'text-amber-400' },
            { label: 'Drift Loss', value: `${(water.annualWaterMG * 0.0002).toFixed(2)} MG/yr`, formula: '0.0005–0.002% with eliminators', color: 'text-gray-400' },
            { label: 'Cycles of Concentration', value: '3.5x (target 5–6x)', formula: 'Makeup / Blowdown ratio', color: 'text-violet-400' },
            { label: 'Blowdown TDS', value: '~2,800 mg/L', formula: 'COC × makeup TDS', color: 'text-yellow-400' },
            { label: 'POTW Discharge Volume', value: `${(water.blowdownMG * 0.85).toFixed(1)} MG/yr`, formula: 'Blowdown to sewer (estimated)', color: 'text-red-400' },
            { label: 'Water Saved (Brick)', value: `${(water.annualWaterMG - water.optimizedWater).toFixed(1)} MG/yr`, formula: 'COC optimization + load reduction', color: 'text-green-400' },
          ].map(m => (
            <div key={m.label} className="bg-gray-800/40 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1">{m.label}</div>
              <div className={`text-lg font-bold ${m.color}`}>{m.value}</div>
              <div className="text-xs text-gray-600 mt-0.5">{m.formula}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
