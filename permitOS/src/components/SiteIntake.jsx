import React, { useState } from 'react';
import { US_STATES, STATES_ATTAINMENT, NOX_EMISSION_FACTORS, CO_EMISSION_FACTORS } from '../data/permitData';
import { calcPTE } from '../utils/calculations';

const turbineTypes = Object.keys(NOX_EMISSION_FACTORS);

const defaultInputs = {
  siteName: 'BigWatt AI Campus — Site A',
  client: 'BigWatt Digital',
  state: 'Tennessee',
  county: 'Davidson County',
  address: '1200 Industrial Blvd, Nashville, TN 37201',
  lat: '36.1627',
  lon: '-86.7816',
  turbineType: 'Gas Turbine (DLN, modern)',
  turbines: 8,
  mwPerTurbine: 25,
  hours: 6000,
  heatRate: 8.5,
  noxFactor: 0.015,
  coFactor: 0.035,
  brickSavings: 14,
  gensetCount: 12,
  gensetHP: 2000,
  gensetHours: 200,
  coolingMGD: 2.8,
  blowdownPct: 20,
  waterMGD: 1.2,
  datacenterMW: 160,
  pueTarget: 1.35,
  phases: 3,
  codTarget: '2026-Q3',
  siteAcres: 45,
  stackHeight: 65,
  nearestReceptorFt: 1200,
  nonAttainment: false,
};

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

export default function SiteIntake({ inputs, setInputs, setResults, setActiveTab }) {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const update = (key, val) => setInputs(prev => ({ ...prev, [key]: val }));

  const handleTurbineType = (type) => {
    update('turbineType', type);
    update('noxFactor', NOX_EMISSION_FACTORS[type]);
    update('coFactor', CO_EMISSION_FACTORS[type]);
  };

  const runScreening = () => {
    setRunning(true);
    setDone(false);
    setTimeout(() => {
      const results = calcPTE(inputs);
      setResults(results);
      setRunning(false);
      setDone(true);
    }, 1200);
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
            <Select value={inputs.state} onChange={v => update('state', v)} options={US_STATES} />
          </Field>
          <Field label="County / Jurisdiction"><Input value={inputs.county} onChange={v => update('county', v)} /></Field>
          <Field label="Site Address"><Input value={inputs.address} onChange={v => update('address', v)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude"><Input value={inputs.lat} onChange={v => update('lat', v)} /></Field>
            <Field label="Longitude"><Input value={inputs.lon} onChange={v => update('lon', v)} /></Field>
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

        {/* Data Center + Water */}
        <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5 space-y-4">
          <h3 className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Data Center & Water Systems</h3>
          <Field label="Data Center IT Load (MW)"><Input value={inputs.datacenterMW} onChange={v => update('datacenterMW', v)} type="number" /></Field>
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
              <Field label="Cooling Water Use (MGD)" hint="Cooling tower makeup + blowdown"><Input value={inputs.coolingMGD} onChange={v => update('coolingMGD', v)} type="number" step="0.1" /></Field>
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
    </div>
  );
}
