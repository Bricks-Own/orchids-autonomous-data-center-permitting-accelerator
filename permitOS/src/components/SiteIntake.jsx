import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin, Gear, HardDrives, Wind, Drop, Buildings, Lightning,
  Check, ArrowRight, CircleNotch, Tree,
  ArrowsOut, Wrench, Factory, Timer, SealCheck, CaretRight,
  ChartBar, ArrowLeft, WarningCircle
} from '@phosphor-icons/react';
import { US_STATES, STATES_ATTAINMENT, NOX_EMISSION_FACTORS, CO_EMISSION_FACTORS } from '../data/permitData';
import { STATE_ADDRESS_DEFAULTS } from '../utils/locationUtils';
import { calcPTE } from '../utils/calculations';
import { calculatePTE as apiPTE, analyzeScenario, listScenarios } from '../utils/api';
import { usePermitData } from '../context/PermitDataContext';
import Stepper from './Stepper';
import { computeTimelineComparison, getPhaseBreakdown } from '../utils/timelineCalc';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from './ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Slider } from './ui/slider';
import { Checkbox } from './ui/checkbox';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from './ui/select';

const turbineTypes = ['Gas Turbine (DLN, modern)', 'Gas Turbine (standard combustion)', 'Gas Turbine (older frame, uncontrolled)'];

// ─── Local layout helpers ────────────────────────────────────────────────────

function Field({ label, children, hint }) {
  return (
    <div>
      <Label className="mb-[7px] block text-xs font-medium text-muted-foreground normal-case tracking-normal">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1.5">{hint}</p>}
    </div>
  );
}

function SectionHeading({ icon: Icon, label, count }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2.5">
        {Icon && <Icon weight="duotone" size={20} className="text-muted-foreground" />}
        <h3 className="text-lg font-bold text-foreground">{label}</h3>
      </div>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground bg-card px-[10px] py-[4px]">{count} fields</span>
      )}
    </div>
  );
}

// ─── Project Type Config ─────────────────────────────────────────────────────
const PROJECT_TYPE_CONFIG = {
  greenfield: { icon: Tree, label: 'Greenfield Development', desc: 'New data center campus on undeveloped land. Full permitting suite required.' },
  expansion: { icon: ArrowsOut, label: 'Campus Expansion', desc: 'Adding capacity to an existing campus. May benefit from existing permits.' },
  upsized: { icon: Wrench, label: 'Permit Upsizing / Modification', desc: 'Modifying an existing permit to increase capacity or change parameters.' },
  colocated: { icon: Factory, label: 'Co-Located / Powered Site', desc: 'Data center at an existing power generation site. Shared permits possible.' },
};

// ─── Permit Type Config ─────────────────────────────────────────────────────
const PERMIT_TYPE_CONFIG = [
  { key: 'air', label: 'Air Permit', icon: Wind, desc: 'Emissions, PSD/NSR, BACT, Title V, NSPS, NESHAP' },
  { key: 'water', label: 'Water Permit', icon: Drop, desc: 'NPDES, SPCC, 316(b), stormwater, wetlands, POTW' },
  { key: 'building', label: 'Building Permit', icon: Buildings, desc: 'IBC/IRC, fire suppression, occupancy, structural' },
  { key: 'power', label: 'Power / Interconnection', icon: Lightning, desc: 'Grid interconnection, transformers, gensets, FERC' },
];

// ─── Project Q&A (replaces manual permit type picking) ───────────────────────
const PROJECT_QUESTIONS = [
  { key: 'hasOnSiteGeneration', question: 'Will this site include on-site power generation — turbines, generators, or other combustion equipment?', helps: 'air' },
  { key: 'hasWaterUse', question: 'Will this site use or discharge water — cooling towers, process water, wastewater?', helps: 'water' },
  { key: 'hasNewConstruction', question: 'Is this new building construction, or a build-out inside an existing structure?', helps: 'building' },
  { key: 'hasGridInterconnection', question: 'Will this site need a new or upgraded grid interconnection?', helps: 'power' },
];

// ─── Main Component ─────────────────────────────────────────────────────────
export default function SiteIntake({ setActiveTab }) {
  const { inputs, setInputs, results, setResults } = usePermitData();
  const [step, setStep] = useState(() => (results !== null ? 3 : 1));
  const [running, setRunning] = useState(false);
  const done = results !== null;
  const [scenarioAnalysis, setScenarioAnalysis] = useState(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioDefs, setScenarioDefs] = useState([]);
  const [screeningError, setScreeningError] = useState(null);
  const addressFieldsTouched = useRef(false);
  const markAddressTouched = () => { if (!addressFieldsTouched.current) addressFieldsTouched.current = true; };

  const update = (key, val) => setInputs(prev => ({ ...prev, [key]: val }));

  const derivedPermitTypes = [
    inputs.hasOnSiteGeneration !== false && 'air',
    inputs.hasWaterUse !== false && 'water',
    inputs.hasNewConstruction !== false && 'building',
    inputs.hasGridInterconnection !== false && 'power',
  ].filter(Boolean);
  const permitTypes = derivedPermitTypes;
  const projectScenario = inputs.projectScenario || 'greenfield';

  // Load scenario definitions on mount
  useEffect(() => {
    listScenarios().then(data => {
      if (data?.scenarios) setScenarioDefs(data.scenarios);
    }).catch(() => {});
  }, []);

  // Run scenario analysis when project type or inputs change (debounced 500ms)
  useEffect(() => {
    if (!inputs) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setScenarioLoading(true);
      analyzeScenario(projectScenario, inputs).then(data => {
        if (!cancelled && data?.analysis) setScenarioAnalysis(data.analysis);
        if (!cancelled) setScenarioLoading(false);
      }).catch(() => { if (!cancelled) setScenarioLoading(false); });
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [projectScenario, inputs]);

  const runScreening = async () => {
    setRunning(true);
    setScreeningError(null);
    try {
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
        building: {
          ibcClass: (inputs.turbines * inputs.mwPerTurbine) > 400 ? 'Type IB' : 'Type IIB',
          stories: inputs.stories || 2,
          fireSuppression: inputs.fireSuppression || 'Pre-action sprinkler',
          emergencyConfig: inputs.emergencyPowerConfig || 'N+1',
          buildingSqFt: inputs.buildingSqFt || Math.round((inputs.datacenterMW || 133) * 800),
          occupancy: inputs.occupancyType || 'Business (B)',
        },
        power: {
          totalMW: inputs.turbines * inputs.mwPerTurbine,
          interconnectionVoltage: inputs.interconnectionVoltage || ((inputs.turbines * inputs.mwPerTurbine) > 500 ? 345 : (inputs.turbines * inputs.mwPerTurbine) >= 200 ? 138 : 69),
          transformerCapacity: inputs.transformerCapacity || Math.round((inputs.turbines * inputs.mwPerTurbine) * 1.15),
          powerSource: inputs.powerSourceType || 'Hybrid (Grid + On-site Generation)',
          gensetTotalMW: ((inputs.gensetCount || 0) * (inputs.gensetHP || 0) * 0.746) / 1000,
        },
      });
    } catch (err) {
      // API failed — try local calculation
      try {
        await new Promise(r => setTimeout(r, 800));
        const localResults = calcPTE(inputs);
        setResults(localResults);
      } catch (err2) {
        setScreeningError(err2.message || 'Screening failed. Please check your inputs and try again.');
      }
    } finally {
      setRunning(false);
    }
  };

  const handleTurbineType = (type) => {
    update('turbineType', type);
    update('noxFactor', NOX_EMISSION_FACTORS[type]);
    update('coFactor', CO_EMISSION_FACTORS[type]);
  };

  const attainmentStatus = STATES_ATTAINMENT[inputs.state] || 'Unknown';

  // ─── STEP 1: Project Setup ────────────────────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <SectionHeading icon={SealCheck} label="Project Scope" />
        <p className="text-sm text-muted-foreground mb-5">
          Tell us about your project so we can determine the permits you'll need. Answer a few quick questions below.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {PROJECT_QUESTIONS.map(q => {
            const val = inputs[q.key] !== false;
            return (
              <button
                key={q.key}
                onClick={() => update(q.key, !val)}
                className={`relative flex flex-col items-start gap-2 border p-4 text-left transition-all
                  ${val
                    ? 'border-border bg-card'
                    : 'border-border bg-transparent hover:bg-card'
                  }`}
              >
                {val && (
                  <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-foreground flex items-center justify-center">
                    <Check weight="bold" size={14} className="text-background" />
                  </span>
                )}
                <span className="text-sm font-semibold text-foreground">{q.question}</span>
                <span className="text-xs text-muted-foreground leading-tight">{val ? 'Yes' : 'No'}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
      </Card>

      <Card>
        <CardContent>
          <SectionHeading icon={MapPin} label="Project Type" />
        <p className="text-sm text-muted-foreground mb-5">
          What type of development is this? This affects permit pathway complexity and timeline.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(PROJECT_TYPE_CONFIG).map(([key, config]) => {
            const isSelected = projectScenario === key;
            const Icon = config.icon;
            return (
              <button
                key={key}
                onClick={() => update('projectScenario', key)}
                className={`relative flex flex-col items-start gap-2 border p-4 text-left transition-all
                  ${isSelected
                    ? 'border-border bg-card'
                    : 'border-border bg-transparent hover:bg-card'
                  }`}
              >
                {isSelected && (
                  <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-foreground flex items-center justify-center">
                    <Check weight="bold" size={14} className="text-background" />
                  </span>
                )}
                <Icon weight="duotone" size={24} className="text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">{config.label}</span>
                <span className="text-xs text-muted-foreground leading-tight">{config.desc}</span>
              </button>
            );
          })}
        </div>
        </CardContent>
      </Card>

      <div className="text-center pt-2">
        <button
          onClick={() => setActiveTab('siteplanner')}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
        >
          Not sure yet? Plan your data center first &rarr;
        </button>
      </div>
    </div>
  );

  // ─── STEP 2: Site Details ─────────────────────────────────────────────────
  const renderStep2 = () => (
    <div className="grid grid-cols-2 gap-5">
      {/* Site Information */}
      <Card className="col-span-2">
        <CardContent>
          <SectionHeading icon={MapPin} label="Site Information" count={9} />
        <div className="grid grid-cols-2 gap-x-[28px] gap-y-5">
          <Field label="Site Name"><Input value={inputs.siteName} onChange={e => update('siteName', e.target.value)} /></Field>
          <Field label="Client / Owner"><Input value={inputs.client} onChange={e => update('client', e.target.value)} /></Field>
          <Field label="State">
            <Select value={inputs.state} onValueChange={v => {
              update('state', v);
              const status = STATES_ATTAINMENT[v] || '';
              const isNon = status.includes('Nonattainment');
              update('nonAttainment', isNon);
              if (isNon) {
                update('nonAttainNOx', true);
                update('nonAttainPM25', true);
                update('nonAttainOzone', true);
              }
              if (!addressFieldsTouched.current) {
                const defaults = STATE_ADDRESS_DEFAULTS[v];
                if (defaults) {
                  update('address', defaults.address);
                  update('county', defaults.county);
                  update('lat', defaults.lat);
                  update('lon', defaults.lon);
                }
              }
            }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select state..." />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="County / Jurisdiction"><Input value={inputs.county} onChange={e => { update('county', e.target.value); markAddressTouched(); }} /></Field>
          <Field label="Site Address"><Input value={inputs.address} onChange={e => { update('address', e.target.value); markAddressTouched(); }} /></Field>
          <Field label="Target COD"><Input value={inputs.codTarget} onChange={e => update('codTarget', e.target.value)} /></Field>
          <Field label="Latitude"><Input className="font-mono-num" value={inputs.lat} onChange={e => { update('lat', e.target.value); markAddressTouched(); }} /></Field>
          <Field label="Longitude"><Input className="font-mono-num" value={inputs.lon} onChange={e => { update('lon', e.target.value); markAddressTouched(); }} /></Field>
          <Field label="Site Acreage"><Input value={inputs.siteAcres} onChange={e => update('siteAcres', parseFloat(e.target.value) || 0)} type="number" /></Field>

          <div className="bg-card p-4 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-muted-foreground mb-1">Air Quality Area Status</div>
              <div className={`text-sm font-semibold ${
                attainmentStatus.includes('Nonattainment') ? 'text-[#e0a95c]' :
                attainmentStatus.includes('Mixed') ? 'text-[#e0a95c]' : 'text-primary'
              }`}>
                {attainmentStatus}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Determines PSD vs. NSR pathway</div>
            </div>
          </div>
        </div>

        {permitTypes.includes('air') && attainmentStatus.includes('Nonattainment') && (
          <div className="mt-5 pt-5 border-t border-border">
            <div className="text-xs font-medium text-muted-foreground mb-3">Per-Pollutant Nonattainment Overrides</div>
            <div className="flex flex-wrap gap-4">
              {[
                { key: 'nonAttainNOx', label: 'NOx (Ozone Precursor)' },
                { key: 'nonAttainOzone', label: 'Ozone (VOC)' },
                { key: 'nonAttainPM25', label: 'PM2.5 (Direct)' },
              ].map(p => (
                <label key={p.key} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground/80">
                  <Checkbox checked={inputs[p.key]} onCheckedChange={v => update(p.key, v)} />
                  {p.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2 italic">Checking these applies Severe nonattainment thresholds (25 tpy NOx/VOC, 30 tpy PM2.5)</p>
          </div>
        )}
      </CardContent>
      </Card>

      {/* Generation Overview */}
      <Card>
        <CardContent>
          <SectionHeading icon={Gear} label="Generation Overview" count={3} />
        <div className="grid grid-cols-2 gap-x-[28px] gap-y-5">
          <Field label="Gas Turbines (count)"><Input value={inputs.turbines} onChange={e => update('turbines', parseFloat(e.target.value) || 0)} type="number" /></Field>
          <Field label="MW per Turbine"><Input value={inputs.mwPerTurbine} onChange={e => update('mwPerTurbine', parseFloat(e.target.value) || 0)} type="number" /></Field>
          <Field label="Operating Hours / Year" hint="Max 8,760 for continuous; <500 for limited-use"><Input value={inputs.hours} onChange={e => update('hours', parseFloat(e.target.value) || 0)} type="number" /></Field>
        </div>
      </CardContent>
      </Card>

      {/* Data Center Systems */}
      <Card>
        <CardContent>
          <SectionHeading icon={HardDrives} label="Data Center Systems" count={3} />
        <div className="grid grid-cols-2 gap-x-[28px] gap-y-5">
          <Field label="IT Load (MW)">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input value={inputs.datacenterMW} onChange={e => update('datacenterMW', parseFloat(e.target.value) || 0)} type="number" />
              </div>
              <button
                onClick={() => {
                  const totalMW = (inputs.turbines || 0) * (inputs.mwPerTurbine || 0);
                  const pue = inputs.pueTarget || 1.35;
                  update('datacenterMW', Math.round(totalMW / (pue + 0.15)));
                }}
                className="bg-card border border-border text-xs text-muted-foreground px-2.5 py-1.5 hover:bg-[#27272a] transition-colors whitespace-nowrap"
                title="Derive from generation capacity"
              >
                Auto
              </button>
            </div>
          </Field>
          <Field label="Target PUE"><Input value={inputs.pueTarget} onChange={e => update('pueTarget', parseFloat(e.target.value) || 0)} type="number" step="0.01" /></Field>
          <Field label="Build Phases"><Input value={inputs.phases} onChange={e => update('phases', parseFloat(e.target.value) || 0)} type="number" /></Field>
        </div>
      </CardContent>
      </Card>

      {/* Brick Load Reduction */}
      <Card className="col-span-2">
        <CardContent>
          <SectionHeading icon={Timer} label="Brick Dispatch Optimization" />
        <div className="max-w-md">
          <Field label="Brick Load Reduction (%)" hint="Dispatch efficiency gains from Brick controls vs. baseline">
            <div className="space-y-2 pt-2">
              <Slider
                value={[inputs.brickSavings || 0]}
                onValueChange={(v) => update('brickSavings', v)}
                min={0}
                max={30}
                step={1}
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">0%</span>
                <span className="text-sm font-semibold text-foreground">{inputs.brickSavings || 0}% reduction</span>
                <span className="text-xs text-muted-foreground">30%</span>
              </div>
            </div>
          </Field>
        </div>
      </CardContent>
      </Card>

      {/* Air-Specific Parameters */}
      {permitTypes.includes('air') && (
        <Card>
          <CardContent>
            <SectionHeading icon={Wind} label="Generation Equipment" count={6} />
          <div className="grid grid-cols-2 gap-x-[28px] gap-y-5">
            <Field label="Turbine / Engine Type" hint="Sets emission factors automatically">
              <Select value={inputs.turbineType} onValueChange={handleTurbineType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select turbine type..." />
                </SelectTrigger>
                <SelectContent>
                  {turbineTypes.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Heat Rate (MMBtu/MWh)"><Input className="font-mono-num" value={inputs.heatRate} onChange={e => update('heatRate', parseFloat(e.target.value) || 0)} type="number" step="0.1" /></Field>
            <Field label="NOx Factor (lb/MMBtu)"><Input className="font-mono-num" value={inputs.noxFactor} onChange={e => update('noxFactor', parseFloat(e.target.value) || 0)} type="number" step="0.001" /></Field>
            <Field label="CO Factor (lb/MMBtu)"><Input className="font-mono-num" value={inputs.coFactor} onChange={e => update('coFactor', parseFloat(e.target.value) || 0)} type="number" step="0.001" /></Field>
            <Field label="Stack Height (ft)"><Input className="font-mono-num" value={inputs.stackHeight} onChange={e => update('stackHeight', parseFloat(e.target.value) || 0)} type="number" /></Field>
            <Field label="Nearest Receptor (ft)" hint="For AERMOD modeling scope"><Input className="font-mono-num" value={inputs.nearestReceptorFt} onChange={e => update('nearestReceptorFt', parseFloat(e.target.value) || 0)} type="number" /></Field>
          </div>
        </CardContent>
        </Card>
      )}

      {/* Water-Specific Parameters */}
      {permitTypes.includes('water') && (
        <Card>
          <CardContent>
            <SectionHeading icon={Drop} label="Data Center & Water Systems" count={4} />
          <div className="grid grid-cols-2 gap-x-[28px] gap-y-5">
            <Field label="Cooling Water (MGD)" hint="Evaporation rate only"><Input className="font-mono-num" value={inputs.coolingMGD} onChange={e => update('coolingMGD', parseFloat(e.target.value) || 0)} type="number" step="0.1" /></Field>
            <Field label="Blowdown (%)" hint="% of circulating water discharged"><Input className="font-mono-num" value={inputs.blowdownPct} onChange={e => update('blowdownPct', parseFloat(e.target.value) || 0)} type="number" /></Field>
            <Field label="Process Water (MGD)"><Input className="font-mono-num" value={inputs.waterMGD} onChange={e => update('waterMGD', parseFloat(e.target.value) || 0)} type="number" step="0.1" /></Field>
            <Field label="Discharge Pathway">
              <Select
                value={inputs.dischargePathway || ''}
                onValueChange={v => update('dischargePathway', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select discharge pathway..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Select discharge pathway...</SelectItem>
                  <SelectItem value="Surface Water Discharge">Surface Water Discharge</SelectItem>
                  <SelectItem value="POTW-Sanitary Sewer Connection">POTW-Sanitary Sewer Connection</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardContent>
        </Card>
      )}

      {/* Building-Specific Parameters */}
      {permitTypes.includes('building') && (
        <Card>
          <CardContent>
            <SectionHeading icon={Buildings} label="Building Permitting Parameters" count={5} />
          <div className="grid grid-cols-2 gap-x-[28px] gap-y-5">
            <Field label="Building Footprint (sqft)"><Input value={inputs.buildingSqFt} onChange={e => update('buildingSqFt', parseFloat(e.target.value) || 0)} type="number" /></Field>
            <Field label="Stories"><Input value={inputs.stories} onChange={e => update('stories', parseFloat(e.target.value) || 0)} type="number" /></Field>
            <Field label="Occupancy Type">
              <Select value={inputs.occupancyType} onValueChange={v => update('occupancyType', v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select occupancy..." />
                      </SelectTrigger>
                      <SelectContent>
                        {['Business (B)', 'Industrial (F-1)', 'Storage (S-1)', 'Mixed (B/S-1)'].map(o => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
            </Field>
            <Field label="Fire Suppression">
              <Select value={inputs.fireSuppression} onValueChange={v => update('fireSuppression', v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select suppression..." />
                      </SelectTrigger>
                      <SelectContent>
                        {['Pre-action sprinkler', 'Wet pipe sprinkler', 'Dry pipe sprinkler', 'Clean agent (FM-200/Novec)', 'Hybrid (pre-action + clean agent)'].map(o => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
            </Field>
            <Field label="Emergency Power Config">
              <Select value={inputs.emergencyPowerConfig} onValueChange={v => update('emergencyPowerConfig', v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select config..." />
                      </SelectTrigger>
                      <SelectContent>
                        {['N', 'N+1', '2N', '2N+1'].map(o => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
            </Field>
          </div>
        </CardContent>
        </Card>
      )}

      {/* Power/Interconnection Parameters */}
      {permitTypes.includes('power') && (
        <Card>
          <CardContent>
            <SectionHeading icon={Lightning} label="Power Permitting Parameters" count={6} />
          <div className="grid grid-cols-2 gap-x-[28px] gap-y-5">
            <Field label="Power Source Type">
              <Select value={inputs.powerSourceType} onValueChange={v => update('powerSourceType', v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select source..." />
                    </SelectTrigger>
                    <SelectContent>
                      {['Grid-only', 'On-site Generation', 'Hybrid (Grid + On-site)', 'Microgrid'].map(o => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
            </Field>
            <Field label="Interconnection Voltage (kV)"><Input className="font-mono-num" value={inputs.interconnectionVoltage} onChange={e => update('interconnectionVoltage', parseFloat(e.target.value) || 0)} type="number" /></Field>
            <Field label="Transformer Capacity (MVA)"><Input className="font-mono-num" value={inputs.transformerCapacity} onChange={e => update('transformerCapacity', parseFloat(e.target.value) || 0)} type="number" /></Field>
          </div>

          <div className="mt-5 pt-5 border-t border-border">
            <div className="text-xs font-medium text-muted-foreground mb-4">Backup / Emergency Generators</div>
            <div className="grid grid-cols-2 gap-x-[28px] gap-y-5">
              <Field label="Genset Fuel Type">
                <Select value={inputs.gensetFuelType || 'Diesel'} onValueChange={v => update('gensetFuelType', v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select fuel..." />
                    </SelectTrigger>
                    <SelectContent>
                      {['Diesel', 'Natural Gas'].map(o => (
                        <SelectItem key={o} value={o}>{o}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
              </Field>
              <div />
              <Field label="Number of Gensets"><Input className="font-mono-num" value={inputs.gensetCount} onChange={e => update('gensetCount', parseFloat(e.target.value) || 0)} type="number" /></Field>
              <Field label="HP Each"><Input className="font-mono-num" value={inputs.gensetHP} onChange={e => update('gensetHP', parseFloat(e.target.value) || 0)} type="number" /></Field>
              <Field label="Operating Hours / Year" hint="<=100 = emergency"><Input className="font-mono-num" value={inputs.gensetHours} onChange={e => update('gensetHours', parseFloat(e.target.value) || 0)} type="number" /></Field>
            </div>
          </div>
        </CardContent>
        </Card>
      )}
    </div>
  );

  // ─── STEP 3: Review ───────────────────────────────────────────────────────
  const renderStep3 = () => {
    const totalMW = inputs.turbines * inputs.mwPerTurbine;
    const pathway = results?.pathway || {};
    const comparison = computeTimelineComparison(inputs, results);

    const breakdown = getPhaseBreakdown(comparison.brickAccel.totalWeeks);
    const timelinePhases = breakdown.map((p, i) => ({
      label: p.label,
      weeks: `${p.startWeek}-${p.endWeek}`,
      color: `var(--color-chart-${(i % 5) + 1})`,
      status: 'upcoming',
    }));

    return (
      <div className="space-y-5">
        {/* 1. Site Summary */}
        <Card>
          <CardContent>
          <div className="flex items-center flex-wrap gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin weight="duotone" size={20} className="text-muted-foreground flex-shrink-0" />
              <span className="text-base font-bold text-foreground truncate">{inputs.siteName || 'BigWatt AI Campus'}</span>
            </div>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground">{inputs.county || inputs.state}, {inputs.state}</span>
            <span className="text-sm text-muted-foreground">/</span>
            <Badge variant="secondary">{PROJECT_TYPE_CONFIG[projectScenario]?.label || 'Greenfield Development'}</Badge>
            {permitTypes.map(key => {
              const def = PERMIT_TYPE_CONFIG.find(p => p.key === key);
              if (!def) return null;
              const Icon = def.icon;
              return (
                <Badge variant="secondary" key={key}>
                  <Icon weight="duotone" size={14} className="text-muted-foreground" />
                  {def.label}
                </Badge>
              );
            })}
          </div>
          </CardContent>
        </Card>

        {/* 2. Headline Metric */}
        <Card>
          <CardContent>
          <SectionHeading icon={ChartBar} label="Permitting Timeline Comparison" />
          {results ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card p-6 border border-border">
                <div className="text-xs font-medium text-muted-foreground mb-2">Traditional Pathway</div>
                <div className="text-3xl font-bold text-muted-foreground tracking-[-0.02em]">
                  ~{comparison.traditional.totalMonths} <span className="text-base font-medium">months</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {comparison.traditional.pathwayLabel} — baseline emissions
                </div>
                {comparison.traditional.totalMonths > comparison.brickAccel.totalMonths && (
                  <div className="mt-3 text-xs text-muted-foreground bg-background px-3 py-2 border border-border">
                    Without Brick optimization, this project faces full PSD review duration
                  </div>
                )}
              </div>

              <div className="bg-card  p-6 border border-border relative overflow-hidden">
                <div className="text-xs font-medium text-muted-foreground mb-2">Brick-Accelerated</div>
                <div className="text-3xl font-bold text-primary tracking-[-0.02em]">
                  ~{comparison.brickAccel.totalMonths} <span className="text-base font-medium text-muted-foreground">months</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {comparison.brickAccel.pathwayLabel} — Brick-optimized
                </div>
                {comparison.monthsSaved > 0 && (
                  <div className="mt-3 inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 border border-primary/20">
                    <Timer weight="duotone" size={14} />
                    {comparison.monthsSaved} months saved ({comparison.pctFaster}% faster)
                  </div>
                )}
                <div className="absolute top-0 right-0 w-16 h-16">
                  <div className="absolute top-3 right-3 text-[#3b82f6]/20 text-xs font-bold tracking-wider uppercase" style={{ transform: 'rotate(45deg)' }}>Brick</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-4">
              Complete the screening to see the timeline comparison. Timeline data is computed from your actual site emissions and pathway determination.
            </div>
          )}
          </CardContent>
        </Card>

        {/* 3. Permit-by-Permit Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 grid-flow-dense">
          {permitTypes.includes('air') && (
            <Card>
              <CardContent>
              <div className="flex items-center gap-2.5 mb-4">
                <Wind weight="duotone" size={20} className="text-muted-foreground" />
                <h3 className="text-base font-bold text-foreground">Air Permit</h3>
              </div>
              {results ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-card p-3">
                      <div className="text-xs text-muted-foreground">Baseline NOx</div>
                      <div className="text-sm font-semibold text-foreground font-['IBM_Plex_Mono']">{results.baseline?.nox?.toFixed(1) || '—'} tpy</div>
                    </div>
                    <div className="bg-card p-3">
                      <div className="text-xs text-muted-foreground">Controlled NOx</div>
                      <div className="text-sm font-semibold text-primary font-['IBM_Plex_Mono']">{results.controlled?.nox?.toFixed(1) || '—'} tpy</div>
                    </div>
                    <div className="bg-card p-3">
                      <div className="text-xs text-muted-foreground">Baseline CO</div>
                      <div className="text-sm font-semibold text-foreground font-['IBM_Plex_Mono']">{results.baseline?.co?.toFixed(1) || '—'} tpy</div>
                    </div>
                    <div className="bg-card p-3">
                      <div className="text-xs text-muted-foreground">Controlled CO</div>
                      <div className="text-sm font-semibold text-primary font-['IBM_Plex_Mono']">{results.controlled?.co?.toFixed(1) || '—'} tpy</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Pathway:</span>
                    {pathway.requiresPSD ? (
                      pathway.syntheticMinorViable ? (
                        <Badge variant="secondary" className="text-primary"><Check weight="duotone" size={14} /> Synthetic Minor</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[#e0a95c]">PSD Major Source</Badge>
                      )
                    ) : (
                      <Badge variant="secondary" className="text-primary"><Check weight="duotone" size={14} /> True Minor Source</Badge>
                    )}
                    {pathway.requiresTitleV && <Badge variant="secondary" className="text-[#e0a95c]">Title V</Badge>}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Run screening to see air permit metrics</div>
              )}
              </CardContent>
            </Card>
          )}

          {permitTypes.includes('water') && (
            <Card>
              <CardContent>
              <div className="flex items-center gap-2.5 mb-4">
                <Drop weight="duotone" size={20} className="text-muted-foreground" />
                <h3 className="text-base font-bold text-foreground">Water Permit</h3>
              </div>
              {results ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-card p-3">
                      <div className="text-xs text-muted-foreground">Annual Water Use</div>
                      <div className="text-sm font-semibold text-foreground font-['IBM_Plex_Mono']">{results.water?.annualWaterMG?.toFixed(0) || '—'} MG/yr</div>
                    </div>
                    <div className="bg-card p-3">
                      <div className="text-xs text-muted-foreground">Brick-Optimized</div>
                      <div className="text-sm font-semibold text-primary font-['IBM_Plex_Mono']">{results.water?.optimizedWater?.toFixed(0) || '—'} MG/yr</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Discharge:</span>
                    <Badge variant="secondary">{inputs.dischargePathway || 'Not specified'}</Badge>
                    <span className="text-xs text-muted-foreground">NPDES:</span>
                    <Badge variant="secondary" className={inputs.dischargePathway === 'Surface Water Discharge' ? 'text-[#e0a95c]' : 'text-primary'}>
                      {inputs.dischargePathway === 'Surface Water Discharge' ? 'Individual Permit Likely' : 'General Permit / POTW'}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Run screening to see water permit metrics</div>
              )}
              </CardContent>
            </Card>
          )}

          {permitTypes.includes('building') && (
            <Card>
              <CardContent>
              <div className="flex items-center gap-2.5 mb-4">
                <Buildings weight="duotone" size={20} className="text-muted-foreground" />
                <h3 className="text-base font-bold text-foreground">Building Permit</h3>
              </div>
              {results ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-card p-3">
                      <div className="text-xs text-muted-foreground">IBC Class</div>
                      <div className="text-sm font-semibold text-foreground font-['IBM_Plex_Mono']">{results.building?.ibcClass || '—'}</div>
                    </div>
                    <div className="bg-card p-3">
                      <div className="text-xs text-muted-foreground">Occupancy</div>
                      <div className="text-sm font-semibold text-foreground">{results.building?.occupancy || '—'}</div>
                    </div>
                    <div className="bg-card p-3">
                      <div className="text-xs text-muted-foreground">Stories</div>
                      <div className="text-sm font-semibold text-foreground font-['IBM_Plex_Mono']">{results.building?.stories || '—'}</div>
                    </div>
                    <div className="bg-card p-3">
                      <div className="text-xs text-muted-foreground">Fire Suppression</div>
                      <div className="text-sm font-semibold text-foreground">{results.building?.fireSuppression || '—'}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Run screening to see building permit metrics</div>
              )}
              </CardContent>
            </Card>
          )}

          {permitTypes.includes('power') && (
            <Card>
              <CardContent>
              <div className="flex items-center gap-2.5 mb-4">
                <Lightning weight="duotone" size={20} className="text-muted-foreground" />
                <h3 className="text-base font-bold text-foreground">Power / Interconnection</h3>
              </div>
              {results ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-card p-3">
                      <div className="text-xs text-muted-foreground">Total Capacity</div>
                      <div className="text-sm font-semibold text-foreground font-['IBM_Plex_Mono']">{results.power?.totalMW?.toFixed(0) || totalMW} MW</div>
                    </div>
                    <div className="bg-card p-3">
                      <div className="text-xs text-muted-foreground">Interconnection</div>
                      <div className="text-sm font-semibold text-foreground font-['IBM_Plex_Mono']">{results.power?.interconnectionVoltage || '—'} kV</div>
                    </div>
                    <div className="bg-card p-3">
                      <div className="text-xs text-muted-foreground">Power Source</div>
                      <div className="text-sm font-semibold text-foreground">{results.power?.powerSource || '—'}</div>
                    </div>
                    <div className="bg-card p-3">
                      <div className="text-xs text-muted-foreground">Genset Total</div>
                      <div className="text-sm font-semibold text-foreground font-['IBM_Plex_Mono']">{results.power?.gensetTotalMW?.toFixed(1) || '—'} MW</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">FERC:</span>
                    <Badge variant="secondary" className={totalMW > 20 ? 'text-[#e0a95c]' : 'text-primary'}>
                      {totalMW > 20 ? 'LGIA Required' : 'SGIP Eligible'}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Run screening to see power/interconnection metrics</div>
              )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 4. Compact Milestone Timeline Preview */}
        <Card>
          <CardContent>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <Timer weight="duotone" size={20} className="text-muted-foreground" />
              <h3 className="text-base font-bold text-foreground">Permitting Phases Overview</h3>
            </div>
            <button
              onClick={() => setActiveTab('milestones')}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View full timeline
              <CaretRight weight="duotone" size={14} />
            </button>
          </div>
          <div className="h-[260px]">
            {(() => {
              const chartData = timelinePhases.map(p => {
                const [start, end] = p.weeks.split('-').map(Number);
                return { phase: p.label, start, duration: end - start, fill: p.color };
              });
              const chartConfig = {
                start: { label: 'Start' },
                duration: { label: 'Duration' },
              };
              return (
                <ChartContainer config={chartConfig} className="!aspect-auto w-full h-full">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 140, right: 20, top: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" domain={[0, 65]} tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                    <YAxis type="category" dataKey="phase" tick={{ fill: '#a1a1aa', fontSize: 11 }} width={130} />
                    <ChartTooltip
                      content={<ChartTooltipContent
                        formatter={(value, name, item) => {
                          if (name === 'start') return null;
                          const p = item.payload;
                          return (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              Weeks {p.start}–{p.start + p.duration}
                            </div>
                          );
                        }}
                      />}
                    />
                    <Bar dataKey="start" stackId="stack" fill="transparent" isAnimationActive={false} />
                    <Bar dataKey="duration" stackId="stack" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              );
            })()}
          </div>
          </CardContent>
        </Card>

        {/* 5. Generate Button */}
        <div className="pt-2 space-y-3">
          <div className="flex gap-3 items-center">
            <Button onClick={runScreening} disabled={running || done} size="sm">
              {running ? (
                <><CircleNotch weight="duotone" size={20} className="animate-spin" /> Generating Permits...</>
              ) : (
                <><Lightning weight="duotone" size={20} /> Generate My Permits</>
              )}
            </Button>
            {done && (
              <Button variant="outline" size="sm" onClick={() => setResults(null)}>
                Reset
              </Button>
            )}
          </div>
          {screeningError && (
            <div className="mt-4 bg-destructive/10 border border-destructive/30 px-4 py-3 text-xs text-destructive flex items-center gap-2">
              <WarningCircle weight="duotone" size={14} className="shrink-0" />
              {screeningError}
            </div>
          )}
          {done && (
            <div className="mt-4 bg-card border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Check weight="duotone" size={18} className="text-primary" />
                <span className="text-sm font-semibold text-primary">Screening Complete</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Permit pathways, PTE, and document packages generated. Navigate to the relevant tabs to view results.</p>
              <div className="flex flex-wrap gap-2">
                <ResultNavButton label="View Permits" tab="permits" setActiveTab={setActiveTab} />
                <ResultNavButton label="Milestone Timeline" tab="milestones" setActiveTab={setActiveTab} />
                <ResultNavButton label="Document Factory" tab="docs" setActiveTab={setActiveTab} />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  const stepValid = () => {
    if (step === 1) {
      return !!inputs.projectScenario;
    }
    if (step === 2) return true;
    return true;
  };

  return (
    <div className="px-10 py-8 max-w-[1180px] mx-auto space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-foreground tracking-[-0.02em]">Site Intake & Data Collection</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {step === 1 && 'Tell us about your project — we\'ll determine the permits you need based on your answers.'}
          {step === 2 && 'Enter site, equipment, and operational parameters.'}
          {step === 3 && 'Review your inputs, compare timelines, and generate permits.'}
        </p>
      </div>

      <Stepper currentStep={step} />

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}

      <div className="flex items-center justify-between pt-6">
        <div>
          {step > 1 && (
            <Button variant="ghost" onClick={() => setStep(s => s - 1)}>
              <ArrowLeft weight="duotone" size={20} /> Back
            </Button>
          )}
        </div>
        <div>
          {step < 3 && (
            <Button variant="secondary" onClick={() => setStep(s => s + 1)} disabled={!stepValid()}>
              Continue <ArrowRight weight="duotone" size={20} />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ResultNavButton({ label, tab, setActiveTab }) {
  return (
    <button
      onClick={() => setActiveTab(tab)}
      className="inline-flex items-center gap-1.5 bg-card hover:bg-[#27272a] text-muted-foreground text-xs py-2 px-3 border border-border transition-colors"
    >
      <ArrowRight weight="duotone" size={14} className="text-muted-foreground" />
      {label}
    </button>
  );
}