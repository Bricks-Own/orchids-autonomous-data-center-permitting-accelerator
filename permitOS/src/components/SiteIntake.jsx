import React, { useState, useEffect, useRef } from 'react';
import { US_STATES, STATES_ATTAINMENT, NOX_EMISSION_FACTORS, CO_EMISSION_FACTORS } from '../data/permitData';
import { STATE_ADDRESS_DEFAULTS } from '../utils/locationUtils';
import { calcPTE } from '../utils/calculations';
import { calculatePTE as apiPTE, analyzeScenario, listScenarios } from '../utils/api';

const turbineTypes = Object.keys(NOX_EMISSION_FACTORS);



function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-600 mt-0.5">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, type = 'text', step }) {
  return (
    <input
      type={type}
      step={step}
      value={value}
      onChange={e => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 transition-colors"
    />
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500 transition-colors"
    >
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
      ))}
    </select>
  );
}

export default function SiteIntake({ inputs, setInputs, setResults, setActiveTab, results }) {
  const [running, setRunning] = useState(false);
  const done = results !== null;
  const [scenario, setScenario] = useState('greenfield');
  const [scenarioAnalysis, setScenarioAnalysis] = useState(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioDefs, setScenarioDefs] = useState([]);
  const addressFieldsTouched = useRef(false);
  const markAddressTouched = () => { if (!addressFieldsTouched.current) addressFieldsTouched.current = true; };

  const update = (key, val) => setInputs(prev => ({ ...prev, [key]: val }));

  const handleTurbineType = (type) => {
    update('turbineType', type);
    update('noxFactor', NOX_EMISSION_FACTORS[type]);
    update('coFactor', CO_EMISSION_FACTORS[type]);
  };

  // Load scenario definitions on mount
  useEffect(() => {
    listScenarios().then(data => {
      if (data?.scenarios) setScenarioDefs(data.scenarios);
    }).catch(() => {});
  }, []);

  // Run scenario analysis when scenario type or inputs change (debounced 500ms)
  useEffect(() => {
    if (!inputs) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setScenarioLoading(true);
      analyzeScenario(scenario, inputs).then(data => {
        if (!cancelled && data?.analysis) setScenarioAnalysis(data.analysis);
        if (!cancelled) setScenarioLoading(false);
      }).catch(() => { if (!cancelled) setScenarioLoading(false); });
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [scenario, inputs]);

  const runScreening = async () => {
    setRunning(true);
    try {
      // Try backend API first
      const apiResponse = await apiPTE(inputs);
      const calcResults = apiResponse.results || apiResponse;
      setResults({
        totalMW: calcResults.totalMW,
        annualMWh: calcResults.annualMWh,
        annualMMBtu: calcResults.annualMMBtu,
        baseline: calcResults.baseline,
        controlled: calcResults.controlled,
        avoided: calcResults.avoided,
        pathway: calcResults.pathway,
        water: calcResults.water,
        genset: calcResults.genset,
        thresholdAnalysis: calcResults.thresholdAnalysis,
        breaches: calcResults.breaches,
        // Compute building pathway from inputs
        building: {
          ibcClass: (inputs.turbines * inputs.mwPerTurbine) > 400 ? 'Type IB' : 'Type IIB',
          stories: inputs.stories || 2,
          fireSuppression: inputs.fireSuppression || 'Pre-action sprinkler',
          emergencyConfig: inputs.emergencyPowerConfig || 'N+1',
          buildingSqFt: inputs.buildingSqFt || Math.round((inputs.datacenterMW || 133) * 800),
          occupancy: inputs.occupancyType || 'Business (B)',
        },
        // Compute power/interconnection pathway from inputs
        power: {
          totalMW: inputs.turbines * inputs.mwPerTurbine,
          interconnectionVoltage: inputs.interconnectionVoltage || ((inputs.turbines * inputs.mwPerTurbine) > 500 ? 345 : (inputs.turbines * inputs.mwPerTurbine) >= 200 ? 138 : 69),
          transformerCapacity: inputs.transformerCapacity || Math.round((inputs.turbines * inputs.mwPerTurbine) * 1.15),
          powerSource: inputs.powerSourceType || 'Hybrid (Grid + On-site Generation)',
          gensetTotalMW: ((inputs.gensetCount || 0) * (inputs.gensetHP || 0) * 0.746) / 1000,
        },
      });
    } catch {
      // Fallback to local calculation if API unavailable
      await new Promise(r => setTimeout(r, 800));
      const localResults = calcPTE(inputs);
      setResults(localResults);
    }
    setRunning(false);
  };

  const attainmentStatus = STATES_ATTAINMENT[inputs.state] || 'Unknown';

  return (
    <div className="p-6 space-y-6">
      {/* Intro */}
      <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Site Intake & Data Collection</h2>
            <p className="text-xs text-gray-500">Enter site, equipment, and operational parameters. PermitOS runs full applicability screening and generates the complete permit pathway in seconds.</p>
          </div>
          <div className="text-xs text-gray-600 bg-gray-800 rounded-lg px-3 py-2 text-right">
            <div className="text-gray-400 font-medium">Automated acceleration</div>
            <div className="text-green-400 font-bold text-sm">Phase 1 → instant</div>
            <div>(vs. 2–3 weeks manual)</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Site Info */}
        <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5 space-y-4">
          <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Site Information</h3>
          <Field label="Site Name"><Input value={inputs.siteName} onChange={v => update('siteName', v)} /></Field>
          <Field label="Client / Owner"><Input value={inputs.client} onChange={v => update('client', v)} /></Field>
          <Field label="State">
            <Select value={inputs.state} onChange={v => {
              update('state', v);
              const status = STATES_ATTAINMENT[v] || '';
              const isNon = status.includes('Nonattainment');
              update('nonAttainment', isNon);
              if (isNon) {
                update('nonAttainNOx', true);
                update('nonAttainPM25', true);
                update('nonAttainOzone', true);
              }
              // Auto-fill address fields from state defaults if user hasn't manually edited them
              if (!addressFieldsTouched.current) {
                const defaults = STATE_ADDRESS_DEFAULTS[v];
                if (defaults) {
                  update('address', defaults.address);
                  update('county', defaults.county);
                  update('lat', defaults.lat);
                  update('lon', defaults.lon);
                }
              }
            }} options={US_STATES} />
          </Field>
          <Field label="County / Jurisdiction"><Input value={inputs.county} onChange={v => { update('county', v); markAddressTouched(); }} /></Field>
          <Field label="Site Address"><Input value={inputs.address} onChange={v => { update('address', v); markAddressTouched(); }} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude"><Input value={inputs.lat} onChange={v => { update('lat', v); markAddressTouched(); }} /></Field>
            <Field label="Longitude"><Input value={inputs.lon} onChange={v => { update('lon', v); markAddressTouched(); }} /></Field>
          </div>
          <Field label="Site Acreage"><Input value={inputs.siteAcres} onChange={v => update('siteAcres', v)} type="number" /></Field>
          <Field label="Target COD"><Input value={inputs.codTarget} onChange={v => update('codTarget', v)} /></Field>
          {/* Attainment status auto-lookup */}
          <div className="bg-gray-800/60 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Air Quality Area Status</div>
            <div className={`text-sm font-medium ${attainmentStatus.includes('Nonattainment') ? 'text-amber-400' : attainmentStatus.includes('Mixed') ? 'text-yellow-400' : 'text-green-400'}`}>
              {attainmentStatus}
            </div>
            <div className="text-xs text-gray-600 mt-1">Determines PSD vs. NSR pathway</div>
            {/* Per-pollutant nonattainment overrides */}
            {attainmentStatus.includes('Nonattainment') && (
              <div className="mt-3 pt-3 border-t border-gray-700/40 space-y-1.5">
                <div className="text-xs text-gray-500 mb-1 font-medium">Per-Pollutant Nonattainment (override for county-specific SIP)</div>
                {[
                  { key: 'nonAttainNOx', label: 'NOx (Ozone Precursor)' },
                  { key: 'nonAttainOzone', label: 'Ozone (VOC)' },
                  { key: 'nonAttainPM25', label: 'PM2.5 (Direct)' },
                ].map(p => (
                  <label key={p.key} className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                    <input
                      type="checkbox"
                      checked={inputs[p.key]}
                      onChange={e => update(p.key, e.target.checked)}
                      className="accent-amber-500 rounded"
                    />
                    {p.label}
                  </label>
                ))}
                <p className="text-xs text-gray-600 mt-1 italic">Checking these applies Severe nonattainment thresholds (25 tpy NOx/VOC, 30 tpy PM2.5)</p>
              </div>
            )}
          </div>
        </div>

        {/* Turbine / Generation */}
        <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5 space-y-4">
          <h3 className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Generation Equipment</h3>
          <Field label="Turbine / Engine Type">
            <Select value={inputs.turbineType} onChange={handleTurbineType} options={turbineTypes} />
          </Field>
          <Field label="Number of Gas Turbines"><Input value={inputs.turbines} onChange={v => update('turbines', v)} type="number" /></Field>
          <Field label="MW per Turbine"><Input value={inputs.mwPerTurbine} onChange={v => update('mwPerTurbine', v)} type="number" /></Field>
          <Field label="Operating Hours / Year" hint="Max 8,760 for continuous; <500 for limited-use threshold"><Input value={inputs.hours} onChange={v => update('hours', v)} type="number" /></Field>
          <Field label="Heat Rate (MMBtu/MWh)"><Input value={inputs.heatRate} onChange={v => update('heatRate', v)} type="number" step="0.1" /></Field>
          <Field label="NOx Emission Factor (lb/MMBtu)"><Input value={inputs.noxFactor} onChange={v => update('noxFactor', v)} type="number" step="0.001" /></Field>
          <Field label="CO Emission Factor (lb/MMBtu)"><Input value={inputs.coFactor} onChange={v => update('coFactor', v)} type="number" step="0.001" /></Field>
          <div className="border-t border-gray-700/40 pt-3">
            <p className="text-xs text-gray-500 mb-3 font-medium">Backup / Emergency Generators</p>
            <div className="grid grid-cols-3 gap-2">
              <Field label="# Gensets"><Input value={inputs.gensetCount} onChange={v => update('gensetCount', v)} type="number" /></Field>
              <Field label="HP Each"><Input value={inputs.gensetHP} onChange={v => update('gensetHP', v)} type="number" /></Field>
              <Field label="Hrs/yr" hint="≤100 = emergency"><Input value={inputs.gensetHours} onChange={v => update('gensetHours', v)} type="number" /></Field>
            </div>
          </div>
          <Field label="Stack Height (ft)"><Input value={inputs.stackHeight} onChange={v => update('stackHeight', v)} type="number" /></Field>
          <Field label="Nearest Receptor (ft)" hint="For AERMOD modeling scope"><Input value={inputs.nearestReceptorFt} onChange={v => update('nearestReceptorFt', v)} type="number" /></Field>
        </div>

        {/* Building Permitting Parameters */}
        <div className="rounded-xl border border-indigo-700/30 bg-indigo-950/10 p-5 space-y-4">
          <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Building Permitting Parameters</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Building Footprint (sqft)"><Input value={inputs.buildingSqFt} onChange={v => update('buildingSqFt', v)} type="number" /></Field>
            <Field label="Stories"><Input value={inputs.stories} onChange={v => update('stories', v)} type="number" min="1" max="12" /></Field>
            <Field label="Occupancy Type">
              <select value={inputs.occupancyType} onChange={e => update('occupancyType', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200">
                {['Business (B)','Industrial (F-1)','Storage (S-1)','Mixed (B/S-1)'].map(o =>
                  <option key={o} value={o}>{o}</option>
                )}
              </select>
            </Field>
            <Field label="Fire Suppression">
              <select value={inputs.fireSuppression} onChange={e => update('fireSuppression', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200">
                {['Pre-action sprinkler','Wet pipe sprinkler','Dry pipe sprinkler','Clean agent (FM-200/Novec)','Hybrid (pre-action + clean agent)'].map(o =>
                  <option key={o} value={o}>{o}</option>
                )}
              </select>
            </Field>
            <Field label="Emergency Power Config">
              <select value={inputs.emergencyPowerConfig} onChange={e => update('emergencyPowerConfig', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200">
                {['N','N+1','2N','2N+1'].map(o =>
                  <option key={o} value={o}>{o}</option>
                )}
              </select>
            </Field>
          </div>
        </div>

        {/* Power Permitting Parameters */}
        <div className="rounded-xl border border-yellow-700/30 bg-yellow-950/10 p-5 space-y-4">
          <h3 className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">Power Permitting Parameters</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Power Source Type">
              <select value={inputs.powerSourceType} onChange={e => update('powerSourceType', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200">
                {['Grid-only','On-site Generation','Hybrid (Grid + On-site)','Microgrid'].map(o =>
                  <option key={o} value={o}>{o}</option>
                )}
              </select>
            </Field>
            <Field label="Interconnection Voltage (kV)"><Input value={inputs.interconnectionVoltage} onChange={v => update('interconnectionVoltage', v)} type="number" /></Field>
            <Field label="Transformer Capacity (MVA)"><Input value={inputs.transformerCapacity} onChange={v => update('transformerCapacity', v)} type="number" /></Field>
          </div>
        </div>

        {/* Data Center + Water */}
        <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5 space-y-4">
          <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Data Center & Water Systems</h3>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label="Data Center IT Load (MW)"><Input value={inputs.datacenterMW} onChange={v => update('datacenterMW', v)} type="number" /></Field>
            </div>
            <button
              onClick={() => {
                const totalMW = (inputs.turbines || 0) * (inputs.mwPerTurbine || 0);
                const pue = inputs.pueTarget || 1.35;
                const derived = Math.round(totalMW / (pue + 0.15));
                update('datacenterMW', derived);
              }}
              className="text-[10px] bg-indigo-700 hover:bg-indigo-600 text-indigo-200 px-2 py-1.5 rounded-lg mb-1 transition-colors whitespace-nowrap"
              title="Derive IT load from installed capacity and PUE: datacenterMW = totalMW / (PUE + 0.15)"
            >
              Auto-derive ⚡
            </button>
          </div>
          <Field label="Target PUE"><Input value={inputs.pueTarget} onChange={v => update('pueTarget', v)} type="number" step="0.01" /></Field>
          <Field label="Number of Build Phases"><Input value={inputs.phases} onChange={v => update('phases', v)} type="number" /></Field>
          <Field label="Brick Load Reduction (%)" hint="Efficiency gains from Brick controls vs. baseline">
            <input
              type="range" min={0} max={30} step={1}
              value={inputs.brickSavings}
              onChange={e => update('brickSavings', parseFloat(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="text-right text-indigo-400 font-semibold text-sm">{inputs.brickSavings}%</div>
          </Field>
          <div className="border-t border-gray-700/40 pt-3">
            <p className="text-xs text-gray-500 mb-3 font-medium">Water Systems</p>
            <div className="space-y-3">
              <Field label="Cooling Water Use (MGD)" hint="Evaporation rate only (blowdown added separately below)"><Input value={inputs.coolingMGD} onChange={v => update('coolingMGD', v)} type="number" step="0.1" /></Field>
              <Field label="Blowdown Fraction (%)" hint="% of circulating water discharged"><Input value={inputs.blowdownPct} onChange={v => update('blowdownPct', v)} type="number" /></Field>
              <Field label="Process Water Use (MGD)"><Input value={inputs.waterMGD} onChange={v => update('waterMGD', v)} type="number" step="0.1" /></Field>
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={runScreening}
            disabled={running}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
              ${running ? 'bg-indigo-800/50 text-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40'}`}
          >
            {running ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Running Permit Screening…
              </>
            ) : '⚡ Run Full Permit Screening'}
          </button>

          {done && (
            <div className="bg-green-900/20 border border-green-700/40 rounded-xl p-4 space-y-2">
              <p className="text-green-400 font-semibold text-sm">✓ Screening Complete</p>
              <p className="text-xs text-gray-400">Permit pathways, PTE, and document packages generated. Navigate to Air Permit AI, Water Permit AI, and Milestone Timeline tabs to view results.</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[
                  { label: 'Air Permit AI', tab: 'air' },
                  { label: 'Water Permit AI', tab: 'water' },
                  { label: 'Milestone Timeline', tab: 'milestones' },
                  { label: 'Document Factory', tab: 'docs' },
                ].map(b => (
                  <button key={b.tab} onClick={() => setActiveTab(b.tab)}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg py-2 px-3 transition-colors">
                    → {b.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scenario Analyzer */}
      <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-300">Scenario Analyzer</h3>
          <div className="flex gap-1">
            {['greenfield', 'expansion', 'upsized', 'colocated'].map(s => (
              <button
                key={s}
                onClick={() => setScenario(s)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all capitalize
                  ${scenario === s
                    ? 'bg-indigo-900/40 border-indigo-700/40 text-indigo-300'
                    : 'bg-gray-800/40 border-gray-700/40 text-gray-500 hover:text-gray-300'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {scenarioLoading ? (
          <div className="text-center py-6 text-xs text-gray-500">Analyzing scenario...</div>
        ) : scenarioAnalysis ? (
          <div className="grid md:grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-gray-400 mb-3">{scenarioAnalysis.description}</p>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-500">Complexity:</span>
                <span className={`font-semibold ${scenarioAnalysis.complexity === 'high' ? 'text-red-400' : scenarioAnalysis.complexity === 'moderate' ? 'text-amber-400' : 'text-green-400'}`}>
                  {scenarioAnalysis.complexity}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-500">Timeline:</span>
                <span className="font-semibold text-white">{scenarioAnalysis.timelineMonths?.min}–{scenarioAnalysis.timelineMonths?.max} months</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-gray-500">Permit types ({scenarioAnalysis.permitTypes?.length || 0}):</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {scenarioAnalysis.permitTypes?.map((p, i) => (
                  <span key={i} className="bg-gray-800 text-gray-400 rounded px-1.5 py-0.5">{p}</span>
                ))}
              </div>
              {scenarioAnalysis.specialConsiderations?.length > 0 && (
                <div className="space-y-1">
                  <span className="text-gray-500">Special considerations:</span>
                  {scenarioAnalysis.specialConsiderations.map((c, i) => (
                    <div key={i} className="text-amber-300 bg-amber-950/20 rounded px-2 py-1">{c}</div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <span className="text-gray-500 block mb-2">Milestones</span>
              <div className="space-y-2">
                {scenarioAnalysis.milestones?.map((m, i) => (
                  <div key={i} className="bg-gray-800/40 rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-gray-200">{m.phase}</span>
                      <span className="text-gray-500 text-xs">{m.durationWeeks?.join('–')} wks</span>
                    </div>
                    <div className="text-gray-600">
                      {m.activities?.slice(0, 2).map((a, j) => (
                        <div key={j}>• {a}</div>
                      ))}
                      {m.activities?.length > 2 && <div className="text-gray-700">+{m.activities.length - 2} more</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-gray-600">Enter site data above to see scenario analysis</div>
        )}
      </div>
    </div>
  );
}
