import React, { useState } from 'react';
import { POWER_MODULES } from '../data/permitData';

export default function PowerPermitAI({ inputs, results, setActiveTab }) {
  const [expanded, setExpanded] = useState(null);

  if (!inputs) {
    return (
      <div className="p-6 text-center py-20">
        <div className="text-4xl mb-4">⚡</div>
        <h3 className="text-gray-400 font-medium mb-2">No Site Data Yet</h3>
        <p className="text-gray-600 text-sm mb-4">Go to Site Intake and run permit screening first.</p>
        <button onClick={() => setActiveTab && setActiveTab('intake')}
          className="bg-yellow-600 hover:bg-yellow-500 text-white text-xs px-4 py-2 rounded-lg font-semibold">
          → Open Site Intake
        </button>
      </div>
    );
  }

  const totalMW = (inputs.turbines || 0) * (inputs.mwPerTurbine || 0);
  const interconnectionKV = powerData.interconnectionVoltage || inputs.interconnectionVoltage || (totalMW > 500 ? 345 : totalMW > 200 ? 138 : 69);
  const transformerMVA = powerData.transformerCapacity || inputs.transformerCapacity || Math.round(totalMW * 1.15);
  const gensetTotalMW = powerData.gensetTotalMW || ((inputs.gensetCount || 0) * (inputs.gensetHP || 0) * 0.746) / 1000;
  const onSiteMW = totalMW + gensetTotalMW;
  const powerSource = powerData.powerSource || inputs.powerSourceType || 'Hybrid (Grid + On-site Generation)';

  // ISO/RTO determination based on state
  const getISO = (state) => {
    const mapping = {
      'PJM': ['Delaware','Illinois','Indiana','Kentucky','Maryland','Michigan','New Jersey','North Carolina','Ohio','Pennsylvania','Tennessee','Virginia','West Virginia','Washington DC'],
      'MISO': ['Arkansas','Illinois','Indiana','Iowa','Kentucky','Louisiana','Michigan','Minnesota','Mississippi','Missouri','Montana','North Dakota','South Dakota','Texas','Wisconsin'],
      'ERCOT': ['Texas'],
      'CAISO': ['California'],
      'NYISO': ['New York'],
      'ISO-NE': ['Connecticut','Maine','Massachusetts','New Hampshire','Rhode Island','Vermont'],
      'SPP': ['Arkansas','Kansas','Louisiana','Mississippi','Missouri','Nebraska','New Mexico','North Dakota','Oklahoma','South Dakota','Texas','Wyoming'],
    };
    for (const [iso, states] of Object.entries(mapping)) {
      if (states.includes(inputs.state || '')) return iso;
    }
    return 'Non-ISO (Vertically Integrated Utility)';
  };

  const iso = getISO(inputs.state);

  // FERC jurisdiction: facilities >20 MW selling power to grid
  const fercJurisdiction = totalMW > 20 ? 'FERC-jurisdictional (Order 2003)' : 'Non-jurisdictional (Order 2006 small gen)';
  const needsCPCN = totalMW > 50 && powerSource.includes('On-site') ? 'PUC CPCN likely required' : 'Self-generation exemption likely applies';

  // NERC applicability: >20 MVA
  const needsNERC = onSiteMW > 20 ? 'NERC GO/GOP registration required' : 'Below BES threshold — voluntary registration';

  const powerMetrics = [
    { label: 'On-Site Generation', value: `${totalMW} MW`, sub: `${powerSource} · ${interconnectionKV} kV interconnection`, color: 'text-yellow-400' },
    { label: 'Transformer Capacity', value: `${transformerMVA} MVA`, sub: `~${Math.round(transformerMVA / totalMW * 100)}% of load`, color: 'text-amber-400' },
    { label: 'ISO/RTO', value: iso, sub: inputs.state || 'State not selected', color: 'text-emerald-400' },
    { label: 'FERC Jurisdiction', value: fercJurisdiction, sub: totalMW > 20 ? 'LGIA required' : 'SGIP applicable', color: 'text-blue-400' },
    { label: 'NERC Applicability', value: needsNERC, sub: `BES threshold: 20 MVA`, color: 'text-violet-400' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Banner */}
      <div className="rounded-xl border border-yellow-700/30 bg-yellow-950/20 p-4 flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white mb-1">Power Permitting & Grid Interconnection</h2>
          <p className="text-xs text-gray-500">FERC · NERC · ISO/RTO · PUC · Utility Interconnection · Pipeline</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {totalMW > 0 && (
            <span className="bg-yellow-900/40 border border-yellow-800/40 text-yellow-300 px-3 py-1.5 rounded-lg font-medium">
              {totalMW} MW · {interconnectionKV} kV · {iso}
            </span>
          )}
        </div>
      </div>

      {/* Power Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {powerMetrics.map(m => (
          <div key={m.label} className="bg-gray-900/40 border border-gray-700/40 rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">{m.label}</div>
            <div className={`text-sm font-bold ${m.color}`}>{m.value}</div>
            <div className="text-[10px] text-gray-600 mt-0.5">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Interconnection Pathway */}
      <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
        <h3 className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-3">Interconnection Pathway Determination</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Interconnection Type', status: fercJurisdiction, detail: `LGIA/SGIP through ${iso} — Feasibility (45d) → SIS (90d) → FS (180d)` },
            { label: 'NERC Compliance', status: needsNERC, detail: `GO/GOP registration with SERC/TRE/WECC — CIP compliance if >20 MVA` },
            { label: 'PUC Certification', status: needsCPCN, detail: `Data center self-generation exemption — CPCN filing if >50 MW` },
            { label: 'Gas Pipeline Capacity', status: totalMW > 0 ? `${Math.round(totalMW * 0.16)} MMBtu/hr peak demand` : 'N/A', detail: `Firm transportation recommended for hyperscale; interruptible OK for edge` },
          ].map(item => (
            <div key={item.label} className="bg-gray-800/40 rounded-lg p-3">
              <div className="text-xs font-medium text-gray-300 mb-1">{item.label}</div>
              <div className="text-xs text-green-400 font-medium">{item.status}</div>
              <div className="text-[10px] text-gray-600 mt-0.5">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Power Modules */}
      <div>
        <h3 className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-3">Power & Interconnection Modules</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          {POWER_MODULES.map(mod => (
            <div key={mod.id} className="border border-gray-700/40 rounded-xl bg-gray-900/40 overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === mod.id ? null : mod.id)}
                className="w-full text-left p-4 hover:bg-gray-800/40 transition-colors flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] bg-yellow-900/30 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-800/30">{mod.category}</span>
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
                    <p className="text-xs font-medium text-gray-300 mb-2">Agency: <span className="text-gray-500 font-normal">{mod.agency}</span> · ISO: <span className="text-gray-500">{iso}</span></p>
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
                      Cross-reference: AIR-001 (Generation details), AIR-008 (NSPS KKKK turbine compliance), Milestones (interconnection ~52 weeks), Building (NFPA 110 requirements)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {['intake','air','milestones','building'].map(tab => (
                        <button key={tab}
                          onClick={() => setActiveTab && setActiveTab(tab)}
                          className="text-[10px] bg-yellow-900/30 hover:bg-yellow-800/40 text-yellow-400 px-2 py-0.5 rounded border border-yellow-800/30 transition-colors"
                        >
                          {tab === 'intake' ? '📋 Site Intake' : tab === 'air' ? '💨 Air' : tab === 'milestones' ? '📅 Milestones' : '🏗️ Building'}
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
