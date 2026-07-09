import React, { useState } from 'react';
import { BUILDING_MODULES } from '../data/permitData';
import { computeBuildingMetrics } from '../utils/buildPowerCalc';

export default function BuildingPermitAI({ inputs, results, setActiveTab }) {
  const [expanded, setExpanded] = useState(null);

  if (!inputs) {
    return (
      <div className="p-6 text-center py-20">
        <div className="text-4xl mb-4">🏗️</div>
        <h3 className="text-gray-400 font-medium mb-2">No Site Data Yet</h3>
        <p className="text-gray-600 text-sm mb-4">Go to Site Intake and run permit screening first.</p>
        <button onClick={() => setActiveTab && setActiveTab('intake')}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-lg font-semibold">
          → Open Site Intake
        </button>
      </div>
    );
  }

  // Read from results if available (post-screening), otherwise compute from inputs
  const buildingData = results?.building || {};
  const m = computeBuildingMetrics(inputs, buildingData);

  const buildingMetrics = [
    { label: 'Estimated Building Area', value: `${m.buildingSqFt.toLocaleString()} sqft`, sub: `${m.stories} stories · ${m.ibcClass}`, color: 'text-indigo-400' },
    { label: 'Fire Suppression', value: m.suppression, sub: `Type ${m.suppression.includes('Pre-action') ? 'I' : 'II'} System`, color: 'text-red-400' },
    { label: 'Emergency Power Config', value: `${m.emergencyConf} configuration`, sub: `${(inputs.gensetCount || 0)} gensets · ${m.totalGensetMW.toFixed(1)} MW total`, color: 'text-amber-400' },
    { label: 'Fire-Rating Required', value: m.fireRating, sub: `Occupancy: ${m.occupancy}`, color: 'text-orange-400' },
    { label: 'Zoning Noise Concern', value: m.noiseConcern, sub: `Assumes ${m.totalMW} MW generation on site`, color: m.noiseConcern.includes('High') ? 'text-red-400' : 'text-green-400' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Banner */}
      <div className="rounded-xl border border-indigo-700/30 bg-indigo-950/20 p-4 flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white mb-1">Building Permitting Requirements</h2>
          <p className="text-xs text-gray-500">IBC 2021 · NFPA 110/75/76 · Local Building Codes · Zoning Compliance</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {totalMW > 0 && (
            <span className="bg-indigo-900/40 border border-indigo-800/40 text-indigo-300 px-3 py-1.5 rounded-lg font-medium">
              {totalMW} MW Generation · {ibcClass}
            </span>
          )}
        </div>
      </div>

      {/* Building Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {buildingMetrics.map(m => (
          <div key={m.label} className="bg-gray-900/40 border border-gray-700/40 rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">{m.label}</div>
            <div className={`text-sm font-bold ${m.color}`}>{m.value}</div>
            <div className="text-[10px] text-gray-600 mt-0.5">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Building Code Pathway */}
      <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
        <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3">Building Code Pathway Determination</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'IBC Occupancy', status: inputs.occupancyType || 'B (Business)', detail: `Turbine enclosure: F-1; Fuel: H-2/H-3 (if >500gal)` },
            { label: 'Height/Area Limits', status: stories <= 4 ? 'Compliant (IBC Table 504.3)' : 'Variance required (sprinkler increase allowed)', detail: `Type ${totalMW > 400 ? 'IB' : 'IIB'} allow ${stories} stories` },
            { label: 'Fire Suppression', status: suppression.includes('Clean agent') || suppression.includes('Pre-action') ? 'Compliant (IBC Chapter 9)' : 'Pre-action recommended for IT spaces', detail: `${suppression} for white space; sprinkler for support spaces` },
            { label: 'Emergency Power (NFPA 110)', status: emergencyConf.includes('N+1') || emergencyConf.includes('2N') ? 'Compliant (Level 1/2)' : 'N+1 recommended for Tier III+', detail: `${inputs.gensetCount || 0} gensets · ${emergencyConf} configured` },
          ].map(item => (
            <div key={item.label} className="bg-gray-800/40 rounded-lg p-3">
              <div className="text-xs font-medium text-gray-300 mb-1">{item.label}</div>
              <div className="text-xs text-green-400 font-medium">{item.status}</div>
              <div className="text-[10px] text-gray-600 mt-0.5">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Building Modules */}
      <div>
        <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3">Building Code Compliance Modules</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          {BUILDING_MODULES.map(mod => (
            <div key={mod.id} className="border border-gray-700/40 rounded-xl bg-gray-900/40 overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === mod.id ? null : mod.id)}
                className="w-full text-left p-4 hover:bg-gray-800/40 transition-colors flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] bg-indigo-900/30 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-800/30">{mod.category}</span>
                    <span className="text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">{mod.id.toUpperCase()}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-gray-200">{mod.title}</h4>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{mod.description}</p>
                </div>
                <div className={`text-gray-500 transition-transform ${expanded === mod.id ? 'rotate-180' : ''}`}>▼</div>
              </button>
              {expanded === mod.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-700/30 pt-3">
                  <div className="bg-amber-950/20 border border-amber-800/30 rounded-lg p-3">
                    <p className="text-xs text-amber-300 font-medium mb-1">Regulatory Reference</p>
                    <p className="text-xs text-gray-400">{mod.regulation}</p>
                    <p className="text-xs text-gray-500 mt-2">{mod.guidance}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-300 mb-2">Agency: <span className="text-gray-500 font-normal">{mod.agency}</span></p>
                    <ul className="space-y-1">
                      {mod.deliverables.map((d, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
                          <span className="text-green-500 mt-0.5">✓</span>
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-gray-800/40 rounded-lg p-2.5">
                    <p className="text-[10px] text-gray-500 italic mb-2">
                      Cross-reference: AIR-015 (Monitoring/Recordkeeping), AIR-007 (BACT noise analysis), Water-001 (Cooling tower structural loads), Milestones tab (building permit timeline)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {['intake','air','water','milestones'].map(tab => (
                        <button key={tab}
                          onClick={() => setActiveTab && setActiveTab(tab)}
                          className="text-[10px] bg-indigo-900/30 hover:bg-indigo-800/40 text-indigo-400 px-2 py-0.5 rounded border border-indigo-800/30 transition-colors"
                        >
                          {tab === 'intake' ? '📋 Site Intake' : tab === 'air' ? '💨 Air' : tab === 'water' ? '💧 Water' : '📅 Milestones'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
