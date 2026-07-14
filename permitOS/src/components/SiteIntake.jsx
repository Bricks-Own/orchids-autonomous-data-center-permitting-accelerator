import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin, Gear, HardDrives, Wind, Drop, Buildings, Lightning,
  Check, ArrowRight, CircleNotch, PencilSimple, MapTrifold
} from '@phosphor-icons/react';
import { US_STATES, STATES_ATTAINMENT, NOX_EMISSION_FACTORS, CO_EMISSION_FACTORS } from '../data/permitData';
import { STATE_ADDRESS_DEFAULTS } from '../utils/locationUtils';
import { calcPTE } from '../utils/calculations';
import { calculatePTE as apiPTE, analyzeScenario, listScenarios } from '../utils/api';
import PermitSelectionModal from './PermitSelectionModal';

const turbineTypes = ['Gas Turbine (DLN, modern)', 'Gas Turbine (standard combustion)', 'Gas Turbine (older frame, uncontrolled)'];

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-500 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-zinc-600 mt-0.5">{hint}</p>}
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
      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/50 transition-colors"
    />
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/50 transition-colors"
    >
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
      ))}
    </select>
  );
}

const PERMIT_DEFS = {
  air: { label: 'Air Permit', icon: Wind, accent: 'text-violet-400' },
  water: { label: 'Water Permit', icon: Drop, accent: 'text-sky-400' },
  building: { label: 'Building Permit', icon: Buildings, accent: 'text-indigo-400' },
  power: { label: 'Power / Interconnection', icon: Lightning, accent: 'text-amber-400' },
};

const SECTION_ICONS = {
  site: { icon: MapPin, accent: 'text-zinc-400' },
  generation: { icon: Gear, accent: 'text-zinc-400' },
  datacenter: { icon: HardDrives, accent: 'text-zinc-400' },
  air: { icon: Wind, accent: 'text-violet-400' },
  water: { icon: Drop, accent: 'text-sky-400' },
  building: { icon: Buildings, accent: 'text-indigo-400' },
  power: { icon: Lightning, accent: 'text-amber-400' },
};

function SectionHeading({ icon: Icon, accent, label }) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
      <Icon weight="duotone" size={18} className={accent} />
      {label}
    </h3>
  );
}

export default function SiteIntake({ inputs, setInputs, setResults, setActiveTab, results }) {
  const [running, setRunning] = useState(false);
  const done = results !== null;
  const [scenario, setScenario] = useState('greenfield');
  const [scenarioAnalysis, setScenarioAnalysis] = useState(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioDefs, setScenarioDefs] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const addressFieldsTouched = useRef(false);
  const markAddressTouched = () => { if (!addressFieldsTouched.current) addressFieldsTouched.current = true; };

  const update = (key, val) => setInputs(prev => ({ ...prev, [key]: val }));

  const permitTypes = inputs.permitTypesNeeded || ['air', 'water', 'building', 'power'];

  // Open modal on mount if permitTypesNeeded has never been set (first visit)
  useEffect(() => {
    if (inputs.permitTypesNeeded === null) {
      setModalOpen(true);
    }
  }, []); // only on mount

  const handleModalConfirm = (selected, navigateTo) => {
    if (navigateTo) {
      // "Site Planner" option
      setActiveTab(navigateTo);
      setModalOpen(false);
      return;
    }
    update('permitTypesNeeded', selected);
    setModalOpen(false);
  };

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

  const resultsNavItems = [];
  if (permitTypes.includes('air')) resultsNavItems.push({ label: 'Air Permit AI', tab: 'air' });
  if (permitTypes.includes('water')) resultsNavItems.push({ label: 'Water Permit AI', tab: 'water' });
  if (permitTypes.includes('building')) resultsNavItems.push({ label: 'Building Permitting', tab: 'building' });
  if (permitTypes.includes('power')) resultsNavItems.push({ label: 'Power Permitting', tab: 'power' });
  resultsNavItems.push({ label: 'Milestone Timeline', tab: 'milestones' });
  resultsNavItems.push({ label: 'Document Factory', tab: 'docs' });

  return (
    <div className="p-6 space-y-6">
      {/* Permit Selection Modal */}
      <PermitSelectionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleModalConfirm}
        initialSelection={inputs.permitTypesNeeded || ['air', 'water', 'building', 'power']}
        dismissable={inputs.permitTypesNeeded !== null}
      />

      {/* Intro */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-zinc-100 mb-1">Site Intake & Data Collection</h2>
            <p className="text-xs text-zinc-500">Enter site, equipment, and operational parameters. PermitOS runs full applicability screening and generates the complete permit pathway in seconds.</p>
          </div>
          <div className="flex-shrink-0 text-xs text-zinc-600 bg-zinc-800/50 rounded-lg px-3 py-2 text-right">
            <div className="text-zinc-400 font-medium">Automated acceleration</div>
            <div className="text-emerald-400 font-bold text-sm">Phase 1 {'\u2192'} instant</div>
            <div>(vs. 2{'\u2013'}3 weeks manual)</div>
          </div>
        </div>
      </div>

      {/* Permit Type Selection Summary / Change */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <span className="text-xs font-medium text-zinc-500 whitespace-nowrap">Permits selected:</span>
            {permitTypes.map(key => {
              const def = PERMIT_DEFS[key];
              if (!def) return null;
              const Icon = def.icon;
              return (
                <span key={key} className="inline-flex items-center gap-1.5 text-xs text-zinc-300 bg-zinc-800/60 rounded-lg px-2.5 py-1.5">
                  <Icon weight="duotone" size={14} className={def.accent} />
                  {def.label}
                </span>
              );
            })}
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800/60 hover:bg-zinc-800 rounded-lg px-3 py-1.5 transition-colors flex-shrink-0"
          >
            <PencilSimple weight="duotone" size={14} />
            Change
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Site Information — always visible */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
          <SectionHeading icon={SECTION_ICONS.site.icon} accent={SECTION_ICONS.site.accent} label="Site Information" />
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
          <div className="bg-zinc-800/40 rounded-lg p-3">
            <div className="text-xs text-zinc-500 mb-1">Air Quality Area Status</div>
            <div className={`text-sm font-medium ${attainmentStatus.includes('Nonattainment') ? 'text-amber-400' : attainmentStatus.includes('Mixed') ? 'text-yellow-400' : 'text-emerald-400'}`}>
              {attainmentStatus}
            </div>
            <div className="text-xs text-zinc-600 mt-1">Determines PSD vs. NSR pathway</div>
            {/* Per-pollutant nonattainment overrides — air-specific */}
            {permitTypes.includes('air') && attainmentStatus.includes('Nonattainment') && (
              <div className="mt-3 pt-3 border-t border-zinc-700/40 space-y-1.5">
                <div className="text-xs text-zinc-500 mb-1 font-medium">Per-Pollutant Nonattainment (override for county-specific SIP)</div>
                {[
                  { key: 'nonAttainNOx', label: 'NO\u2093 (Ozone Precursor)' },
                  { key: 'nonAttainOzone', label: 'Ozone (VOC)' },
                  { key: 'nonAttainPM25', label: 'PM\u2082.\u2085 (Direct)' },
                ].map(p => (
                  <label key={p.key} className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer hover:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={inputs[p.key]}
                      onChange={e => update(p.key, e.target.checked)}
                      className="accent-amber-500 rounded"
                    />
                    {p.label}
                  </label>
                ))}
                <p className="text-xs text-zinc-600 mt-1 italic">Checking these applies Severe nonattainment thresholds (25 tpy NO\u2093/VOC, 30 tpy PM\u2082.\u2085)</p>
              </div>
            )}
          </div>
        </div>

        {/* Universal Generation Fields — always visible */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
          <SectionHeading icon={SECTION_ICONS.generation.icon} accent={SECTION_ICONS.generation.accent} label="Generation Overview" />
          <Field label="Number of Gas Turbines"><Input value={inputs.turbines} onChange={v => update('turbines', v)} type="number" /></Field>
          <Field label="MW per Turbine"><Input value={inputs.mwPerTurbine} onChange={v => update('mwPerTurbine', v)} type="number" /></Field>
          <Field label="Operating Hours / Year" hint="Max 8,760 for continuous; <500 for limited-use threshold"><Input value={inputs.hours} onChange={v => update('hours', v)} type="number" /></Field>
          <Field label="Brick Load Reduction (%)" hint="Efficiency gains from Brick controls vs. baseline">
            <input
              type="range" min={0} max={30} step={1}
              value={inputs.brickSavings}
              onChange={e => update('brickSavings', parseFloat(e.target.value))}
              className="w-full accent-zinc-500"
            />
            <div className="text-right text-zinc-400 font-semibold text-sm">{inputs.brickSavings}%</div>
          </Field>
        </div>

        {/* Data Center Systems — always visible */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
          <SectionHeading icon={SECTION_ICONS.datacenter.icon} accent={SECTION_ICONS.datacenter.accent} label="Data Center Systems" />
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
              className="flex items-center gap-1 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 px-2 py-1.5 rounded-lg mb-1 transition-colors whitespace-nowrap"
              title="Derive IT load from installed capacity and PUE: datacenterMW = totalMW / (PUE + 0.15)"
            >
              Auto-derive {'\u26A1'}
            </button>
          </div>
          <Field label="Target PUE"><Input value={inputs.pueTarget} onChange={v => update('pueTarget', v)} type="number" step="0.01" /></Field>
          <Field label="Number of Build Phases"><Input value={inputs.phases} onChange={v => update('phases', v)} type="number" /></Field>
        </div>

        {/* Air-Specific Parameters — only when 'air' selected */}
        {permitTypes.includes('air') && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
            <SectionHeading icon={SECTION_ICONS.air.icon} accent={SECTION_ICONS.air.accent} label="Air Permit Parameters" />
            <Field label="Turbine / Engine Type">
              <Select value={inputs.turbineType} onChange={handleTurbineType} options={turbineTypes} />
            </Field>
            <Field label="Heat Rate (MMBtu/MWh)"><Input value={inputs.heatRate} onChange={v => update('heatRate', v)} type="number" step="0.1" /></Field>
            <Field label="NO\u2093 Emission Factor (lb/MMBtu)"><Input value={inputs.noxFactor} onChange={v => update('noxFactor', v)} type="number" step="0.001" /></Field>
            <Field label="CO Emission Factor (lb/MMBtu)"><Input value={inputs.coFactor} onChange={v => update('coFactor', v)} type="number" step="0.001" /></Field>
            <Field label="Stack Height (ft)"><Input value={inputs.stackHeight} onChange={v => update('stackHeight', v)} type="number" /></Field>
            <Field label="Nearest Receptor (ft)" hint="For AERMOD modeling scope"><Input value={inputs.nearestReceptorFt} onChange={v => update('nearestReceptorFt', v)} type="number" /></Field>
          </div>
        )}

        {/* Water-Specific Parameters — only when 'water' selected */}
        {permitTypes.includes('water') && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
            <SectionHeading icon={SECTION_ICONS.water.icon} accent={SECTION_ICONS.water.accent} label="Water Permit Parameters" />
            <Field label="Cooling Water Use (MGD)" hint="Evaporation rate only (blowdown added separately below)"><Input value={inputs.coolingMGD} onChange={v => update('coolingMGD', v)} type="number" step="0.1" /></Field>
            <Field label="Blowdown Fraction (%)" hint="% of circulating water discharged"><Input value={inputs.blowdownPct} onChange={v => update('blowdownPct', v)} type="number" /></Field>
            <Field label="Process Water Use (MGD)"><Input value={inputs.waterMGD} onChange={v => update('waterMGD', v)} type="number" step="0.1" /></Field>
            <Field label="Discharge Pathway">
              <Select
                value={inputs.dischargePathway || ''}
                onChange={v => update('dischargePathway', v)}
                options={[
                  { value: '', label: 'Select discharge pathway...' },
                  { value: 'Surface Water Discharge', label: 'Surface Water Discharge' },
                  { value: 'POTW-Sanitary Sewer Connection', label: 'POTW-Sanitary Sewer Connection' },
                ]}
              />
            </Field>
          </div>
        )}

        {/* Building-Specific Parameters — only when 'building' selected */}
        {permitTypes.includes('building') && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
            <SectionHeading icon={SECTION_ICONS.building.icon} accent={SECTION_ICONS.building.accent} label="Building Permitting Parameters" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Building Footprint (sqft)"><Input value={inputs.buildingSqFt} onChange={v => update('buildingSqFt', v)} type="number" /></Field>
              <Field label="Stories"><Input value={inputs.stories} onChange={v => update('stories', v)} type="number" min="1" max="12" /></Field>
              <Field label="Occupancy Type">
                <select value={inputs.occupancyType} onChange={e => update('occupancyType', e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/50">
                  {['Business (B)','Industrial (F-1)','Storage (S-1)','Mixed (B/S-1)'].map(o =>
                    <option key={o} value={o}>{o}</option>
                  )}
                </select>
              </Field>
              <Field label="Fire Suppression">
                <select value={inputs.fireSuppression} onChange={e => update('fireSuppression', e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/50">
                  {['Pre-action sprinkler','Wet pipe sprinkler','Dry pipe sprinkler','Clean agent (FM-200/Novec)','Hybrid (pre-action + clean agent)'].map(o =>
                    <option key={o} value={o}>{o}</option>
                  )}
                </select>
              </Field>
              <Field label="Emergency Power Config">
                <select value={inputs.emergencyPowerConfig} onChange={e => update('emergencyPowerConfig', e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/50">
                  {['N','N+1','2N','2N+1'].map(o =>
                    <option key={o} value={o}>{o}</option>
                  )}
                </select>
              </Field>
            </div>
          </div>
        )}

        {/* Power/Interconnection Parameters — only when 'power' selected */}
        {permitTypes.includes('power') && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
            <SectionHeading icon={SECTION_ICONS.power.icon} accent={SECTION_ICONS.power.accent} label="Power / Interconnection Parameters" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Power Source Type">
                <select value={inputs.powerSourceType} onChange={e => update('powerSourceType', e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/50">
                  {['Grid-only','On-site Generation','Hybrid (Grid + On-site)','Microgrid'].map(o =>
                    <option key={o} value={o}>{o}</option>
                  )}
                </select>
              </Field>
              <Field label="Interconnection Voltage (kV)"><Input value={inputs.interconnectionVoltage} onChange={v => update('interconnectionVoltage', v)} type="number" /></Field>
              <Field label="Transformer Capacity (MVA)"><Input value={inputs.transformerCapacity} onChange={v => update('transformerCapacity', v)} type="number" /></Field>
            </div>
            <div className="border-t border-zinc-700/40 pt-4">
              <p className="text-xs text-zinc-500 mb-3 font-medium">Backup / Emergency Generators</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Genset Fuel Type">
                  <Select
                    value={inputs.gensetFuelType || 'Diesel'}
                    onChange={v => update('gensetFuelType', v)}
                    options={['Diesel', 'Natural Gas']}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <Field label="# Gensets"><Input value={inputs.gensetCount} onChange={v => update('gensetCount', v)} type="number" /></Field>
                <Field label="HP Each"><Input value={inputs.gensetHP} onChange={v => update('gensetHP', v)} type="number" /></Field>
                <Field label="Hrs/yr" hint={'\u2264100 = emergency'}><Input value={inputs.gensetHours} onChange={v => update('gensetHours', v)} type="number" /></Field>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Generate My Permits button */}
      <button
        onClick={runScreening}
        disabled={running}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
          ${running ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-zinc-100 text-zinc-900 hover:bg-white'}`}
      >
        {running ? (
          <>
            <CircleNotch weight="duotone" size={18} className="animate-spin" />
            Generating Permits...
          </>
        ) : (
          <>
            <Lightning weight="duotone" size={18} />
            Generate My Permits
          </>
        )}
      </button>

      {done && (
        <div className="rounded-2xl border border-emerald-900/50 bg-emerald-950/10 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Check weight="duotone" size={18} className="text-emerald-400" />
            <p className="text-emerald-400 font-semibold text-sm">Screening Complete</p>
          </div>
          <p className="text-xs text-zinc-500">Permit pathways, PTE, and document packages generated. Navigate to the relevant tabs to view results.</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {resultsNavItems.map(b => (
              <button key={b.tab} onClick={() => setActiveTab(b.tab)}
                className="inline-flex items-center gap-1.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg py-2 px-3 transition-colors whitespace-nowrap">
                <ArrowRight weight="duotone" size={12} className="text-zinc-500" />
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scenario Analyzer */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h3 className="text-sm font-semibold text-zinc-300">Scenario Analyzer</h3>
          <div className="flex gap-1 flex-wrap">
            {['greenfield', 'expansion', 'upsized', 'colocated'].map(s => (
              <button
                key={s}
                onClick={() => setScenario(s)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all capitalize
                  ${scenario === s
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-200'
                    : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {scenarioLoading ? (
          <div className="text-center py-6 text-xs text-zinc-500">Analyzing scenario...</div>
        ) : scenarioAnalysis ? (
          <div className="grid md:grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-zinc-400 mb-3">{scenarioAnalysis.description}</p>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-zinc-500">Complexity:</span>
                <span className={`font-semibold ${scenarioAnalysis.complexity === 'high' ? 'text-red-400' : scenarioAnalysis.complexity === 'moderate' ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {scenarioAnalysis.complexity}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-zinc-500">Timeline:</span>
                <span className="font-semibold text-zinc-200">{scenarioAnalysis.timelineMonths?.min}{'\u2013'}{scenarioAnalysis.timelineMonths?.max} months</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-zinc-500">Permit types ({scenarioAnalysis.permitTypes?.length || 0}):</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {scenarioAnalysis.permitTypes?.map((p, i) => (
                  <span key={i} className="bg-zinc-800 text-zinc-400 rounded px-1.5 py-0.5">{p}</span>
                ))}
              </div>
              {scenarioAnalysis.specialConsiderations?.length > 0 && (
                <div className="space-y-1">
                  <span className="text-zinc-500">Special considerations:</span>
                  {scenarioAnalysis.specialConsiderations.map((c, i) => (
                    <div key={i} className="text-amber-300 bg-amber-950/20 rounded px-2 py-1">{c}</div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <span className="text-zinc-500 block mb-2">Milestones</span>
              <div className="space-y-2">
                {scenarioAnalysis.milestones?.map((m, i) => (
                  <div key={i} className="bg-zinc-800/40 rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-zinc-200">{m.phase}</span>
                      <span className="text-zinc-500 text-xs">{m.durationWeeks?.join('\u2013')} wks</span>
                    </div>
                    <div className="text-zinc-600">
                      {m.activities?.slice(0, 2).map((a, j) => (
                        <div key={j}>{'\u2022'} {a}</div>
                      ))}
                      {m.activities?.length > 2 && <div className="text-zinc-700">+{m.activities.length - 2} more</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-zinc-600">Enter site data above to see scenario analysis</div>
        )}
      </div>
    </div>
  );
}