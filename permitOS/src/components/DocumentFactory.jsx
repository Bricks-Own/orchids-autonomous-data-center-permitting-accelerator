import React, { useState } from 'react';
import DocumentPreviewModal from './DocumentPreviewModal';
import { generateDocument } from '../utils/documentGenerator';

const AIR_DOCS = [
  { id: 1,  key: 'air_1',  name: 'Project Description & Site Process Flow',          cfr: 'NSR/PSD application requirement',       pages: '15–25' },
  { id: 2,  key: 'air_2',  name: 'Emission Unit Inventory',                           cfr: 'State air permit forms',                pages: '8–12'  },
  { id: 3,  key: 'air_3',  name: 'Fuel System & Tank Inventory',                      cfr: '40 CFR Part 68 / state forms',          pages: '5–8'   },
  { id: 4,  key: 'air_4',  name: 'Potential to Emit (PTE) Workbook & Methodology',   cfr: 'NSR/PSD — PTE calculation basis',       pages: '20–40' },
  { id: 5,  key: 'air_5',  name: 'Controlled PTE & Enforceable Operating Limit Memo',cfr: 'Synthetic minor / SIP-enforceable',     pages: '10–18' },
  { id: 6,  key: 'air_6',  name: 'PSD / Nonattainment NSR Applicability Determination',cfr:'40 CFR Parts 51/52',                   pages: '12–20' },
  { id: 7,  key: 'air_7',  name: 'BACT / LAER Technology Review',                    cfr: 'CAA § 165 / § 173',                     pages: '30–60' },
  { id: 8,  key: 'air_8',  name: 'NSPS Subpart KKKK / KKKKa Compliance Matrix',      cfr: '40 CFR Part 60 Subpart KKKK',           pages: '8–15'  },
  { id: 9,  key: 'air_9',  name: 'NESHAP Subpart YYYY — Combustion Turbine',         cfr: '40 CFR Part 63 Subpart YYYY',           pages: '6–12'  },
  { id: 10, key: 'air_10', name: 'Engine Rule Matrix — Subparts IIII / JJJJ / ZZZZ', cfr: '40 CFR Parts 60/63',                  pages: '10–20' },
  { id: 11, key: 'air_11', name: 'Startup, Shutdown & Malfunction Emissions Plan',   cfr: 'State SSM rule requirements',           pages: '8–14'  },
  { id: 12, key: 'air_12', name: 'AERMOD Dispersion Modeling Protocol',               cfr: '40 CFR Part 51 App W',                  pages: '20–35' },
  { id: 13, key: 'air_13', name: 'NAAQS / PSD Increment / Receptor Impact Report',   cfr: 'AERMOD results report',                 pages: '40–80' },
  { id: 14, key: 'air_14', name: 'GHG and Decarbonization Analysis',                  cfr: '40 CFR Part 98 Subpart C',             pages: '10–18' },
  { id: 15, key: 'air_15', name: 'Monitoring, Recordkeeping, Reporting & Compliance Plan', cfr: '40 CFR Part 64 / Title V',       pages: '20–40' },
  { id: 16, key: 'air_16', name: 'Public / Community / Environmental Justice Package', cfr: 'EO 14096 / state EJ rules',           pages: '15–25' },
];

const WATER_DOCS = [
  { id: 1,  key: 'water_1',  name: 'Water Balance & Site Utility Flow Diagram',          cfr: 'NPDES permit application basis',     pages: '8–12'  },
  { id: 2,  key: 'water_2',  name: 'NPDES Applicability Determination',                   cfr: '40 CFR Part 122',                   pages: '6–10'  },
  { id: 3,  key: 'water_3',  name: 'Cooling Tower Blowdown Characterization',             cfr: 'NPDES permit — effluent data',      pages: '10–18' },
  { id: 4,  key: 'water_4',  name: 'Industrial Stormwater NOI + SWPPP',                   cfr: '40 CFR 122.26 / MSGP',             pages: '25–50' },
  { id: 5,  key: 'water_5',  name: 'Construction Stormwater NOI + E&S Control Plan',      cfr: 'EPA CGP / State CGP',              pages: '20–35' },
  { id: 6,  key: 'water_6',  name: 'Cooling Water Intake 316(b) Applicability Screen',    cfr: 'CWA § 316(b)',                     pages: '8–15'  },
  { id: 7,  key: 'water_7',  name: 'SPCC Plan — Fuel & Oil Storage',                      cfr: '40 CFR Part 112',                  pages: '30–60' },
  { id: 8,  key: 'water_8',  name: 'Pretreatment / POTW Discharge Support Package',       cfr: '40 CFR Part 403',                  pages: '10–18' },
  { id: 9,  key: 'water_9',  name: 'Wetlands / Waters of the US Screening Package',       cfr: 'CWA § 404 / § 401',               pages: '12–20' },
  { id: 10, key: 'water_10', name: 'Water Conservation & ZLD Feasibility Memo',           cfr: 'NPDES BMP / state water regs',    pages: '10–18' },
];

// ─── All Permits Required — BigWatt Upsized Site ──────────────────────────────
const UPSIZED_PERMITS = [
  {
    category: 'Federal Air Permits & Regulations',
    color: 'indigo',
    permits: [
      { name: 'Preconstruction Air Permit (State Minor or PSD)', trigger: 'Upsizing to full MW generation capacity triggers PSD major source thresholds (>100 tpy NOx/CO uncontrolled)', urgency: 'Critical', timeline: '9–18 months' },
      { name: 'Title V Major Operating Permit', trigger: 'If PTE exceeds 100 tpy any criteria pollutant post-construction — triggered by upsized turbine fleet', urgency: 'Critical', timeline: '12–24 months' },
      { name: 'NSPS Subpart KKKK (40 CFR Part 60)', trigger: 'All combustion turbines ≥10 MMBtu/hr constructed after 2005 — every turbine in upsized config', urgency: 'Required', timeline: 'At startup' },
      { name: 'NSPS Subpart IIII — Emergency CI Engines (40 CFR Part 60)', trigger: 'Each diesel emergency generator added for larger IT load footprint', urgency: 'Required', timeline: 'At startup' },
      { name: 'NESHAP Subpart YYYY — Combustion Turbines (40 CFR Part 63)', trigger: 'If HAP PTE ≥10 tpy (major HAP source) — upsized generation increases HAP proportionally', urgency: 'Evaluate', timeline: '6–12 months' },
      { name: 'NESHAP Subpart ZZZZ — Stationary RICE (40 CFR Part 63)', trigger: 'All emergency gensets ≥500 HP at major/area HAP source — multiplied by upsized genset fleet', urgency: 'Required', timeline: 'At startup' },
      { name: 'GHG Mandatory Reporting (40 CFR Part 98)', trigger: 'Annual CO₂e >25,000 tpy — easily triggered by upsized gas turbine fleet operating at scale', urgency: 'Required', timeline: 'Annual' },
      { name: 'EPA GHGRP eGGRT Registration', trigger: 'Prerequisite to Part 98 annual reporting — new stationary combustion source', urgency: 'Required', timeline: '90 days before startup' },
    ],
  },
  {
    category: 'Federal Water Permits & Regulations',
    color: 'blue',
    permits: [
      { name: 'NPDES Individual Permit — Cooling Tower Blowdown', trigger: 'Upsized cooling demand increases blowdown volume above general permit thresholds; biocide treatment requires individual characterization', urgency: 'Critical', timeline: '6–12 months' },
      { name: 'EPA Multi-Sector General Permit (MSGP) — Industrial Stormwater', trigger: 'Industrial activity on site (diesel storage, outdoor electrical equipment yards)', urgency: 'Required', timeline: '72 hours pre-discharge' },
      { name: 'EPA Construction General Permit (CGP)', trigger: 'Land disturbance >1 acre — upsized site footprint increases grading area significantly', urgency: 'Required', timeline: '14 days pre-disturbance' },
      { name: 'SPCC Plan (40 CFR Part 112)', trigger: 'Aggregate diesel AST >1,320 gal — upsized genset fleet multiplies diesel storage well above threshold', urgency: 'Required', timeline: 'Before first oil transfer' },
      { name: 'CWA § 404 Permit (USACE) — if wetlands impacted', trigger: 'Larger site footprint increases probability of WOTUS impacts; Sackett (2023) narrows but does not eliminate jurisdiction', urgency: 'Evaluate', timeline: '6–18 months' },
      { name: 'CWA § 316(b) — Cooling Water Intake BTA Demonstration', trigger: 'Cooling water intake ≥2 MGD — upsized IT load increases cooling water demand above threshold', urgency: 'Evaluate', timeline: 'With NPDES application' },
      { name: 'POTW Industrial User Permit (pretreatment)', trigger: 'Blowdown flow ≥25,000 GPD → Significant Industrial User — upsized cooling towers directly trigger SIU classification', urgency: 'Required', timeline: '4–8 weeks from application' },
    ],
  },
  {
    category: 'State Air Permits (State-Specific)',
    color: 'violet',
    permits: [
      { name: 'State Preconstruction Air Permit (synthetic minor)', trigger: 'Foundational state-level permit — must be issued before construction begins; upsizing triggers reapplication if prior permit existed', urgency: 'Critical', timeline: '6–12 months' },
      { name: 'State Title V Operating Permit (if applicable)', trigger: 'State-issued under delegated authority after construction permit; upsized facility almost certainly triggers Title V applicability', urgency: 'Critical', timeline: '12 months post-startup' },
      { name: 'Nonattainment NSR / State NSR (if nonattainment area)', trigger: 'If county is nonattainment for ozone (VOC/NOx) or PM₂.₅ — confirm via EPA Green Book; upsizing triggers LAER + offsets requirement', urgency: 'Evaluate', timeline: '12–24 months' },
      { name: 'State Air Toxics Permit / Risk Screen', trigger: 'Many states require independent TURA/SERC risk screening for major combustion sources — upsized stack height and MW changes risk profile', urgency: 'Evaluate', timeline: 'Per state schedule' },
    ],
  },
  {
    category: 'State Water Permits (State-Specific)',
    color: 'cyan',
    permits: [
      { name: 'State NPDES Permit (state-delegated authority)', trigger: 'State issues NPDES permit for cooling tower blowdown — required before any discharge; upsized cooling system needs new or amended permit', urgency: 'Critical', timeline: '6–12 months' },
      { name: 'State Water Withdrawal / Allocation Permit', trigger: 'Many states (GA, TX, NC, VA, etc.) require permits for large water withdrawals; upsized facility cooling demand may exceed threshold', urgency: 'Evaluate', timeline: '3–9 months' },
      { name: 'State Stormwater General Permit (construction)', trigger: 'State CGP equivalent — required for earth disturbance; upsized site acreage requires Phase I NOI at start of each construction phase', urgency: 'Required', timeline: '14 days pre-disturbance' },
      { name: 'CWA § 401 State Water Quality Certification', trigger: 'Required for any federal permit (§ 404, NPDES for major sources); state can impose additional conditions', urgency: 'Conditional', timeline: '60–365 days' },
      { name: 'State Underground Injection Control (UIC) — if any injection wells', trigger: 'If dewatering or cooling condensate injection proposed; evaluate for upsized site groundwater management', urgency: 'Evaluate', timeline: '3–6 months' },
    ],
  },
  {
    category: 'Land Use, Zoning & Utility Permits',
    color: 'amber',
    permits: [
      { name: 'Conditional Use Permit (CUP) / Special Use Permit', trigger: 'Upsized MW capacity may change zoning classification or exceed originally approved use; local zoning board approval required', urgency: 'Critical', timeline: '3–9 months' },
      { name: 'Building Permits — Primary Structure & Turbine Pads', trigger: 'State/local building code; upsized turbine quantity and MW requires new structural plans, fire suppression design', urgency: 'Required', timeline: '4–8 weeks per phase' },
      { name: 'Electrical Interconnection Agreement (ISO/RTO or Utility)', trigger: 'Upsized on-site generation requires interconnection study and agreement; larger MW triggers full interconnection study process (FERC queue)', urgency: 'Critical', timeline: '12–36 months' },
      { name: 'Utility Easements & Right-of-Way Permits', trigger: 'Gas supply pipeline, electric transmission upgrades, fiber — upsized site requires larger pipeline and transmission infrastructure', urgency: 'Required', timeline: '6–18 months' },
      { name: 'Site Plan Approval / Development Review', trigger: 'Updated site plan required for upsized footprint, increased impervious area, revised stormwater management design', urgency: 'Required', timeline: '2–6 months' },
      { name: 'Grading, Excavation & Earthwork Permits', trigger: 'Upsized site footprint increases graded area; local permit required before ground disturbance for turbine pads and data hall foundations', urgency: 'Required', timeline: '2–4 weeks' },
    ],
  },
  {
    category: 'Fire, Safety & Environmental Compliance',
    color: 'red',
    permits: [
      { name: 'Fire Suppression & Hazmat Storage Permit (local fire marshal)', trigger: 'Diesel storage for upsized genset fleet; fire suppression system design for data halls and generator rooms', urgency: 'Required', timeline: '4–8 weeks' },
      { name: '40 CFR Part 68 Risk Management Program (RMP) Screening', trigger: 'Diesel at ambient conditions does not trigger RMP; confirm natural gas below 40 CFR Part 68 threshold quantities', urgency: 'Evaluate', timeline: 'Pre-application' },
      { name: 'OSHA Process Safety Management (PSM) — 29 CFR 1910.119', trigger: 'Natural gas in pipeline quantities; evaluate highly hazardous chemical threshold — upsized gas supply piping', urgency: 'Evaluate', timeline: 'Pre-operation' },
      { name: 'Hazardous Materials Business Plan (HMBP) / TIER II Report', trigger: 'EPCRA § 312 annual reporting if diesel storage >10,000 lb (~1,430 gal) — triggered by upsized genset fleet diesel storage', urgency: 'Required', timeline: 'Annual (March 1)' },
      { name: 'EPCRA TIER II Reporting (40 CFR Part 370)', trigger: 'Diesel fuel >10,000 lb threshold — reporting to LEPC, SERC, local fire department annually', urgency: 'Required', timeline: 'Annual' },
      { name: 'Hazardous Waste Generator Registration (RCRA)', trigger: 'Spent lube oils, batteries from UPS, transformer oil, cooling water treatment chemicals may trigger SQG/LQG status', urgency: 'Evaluate', timeline: 'Before first waste generation' },
      { name: 'Noise Ordinance / Variance (local jurisdiction)', trigger: 'Upsized turbine count increases cumulative noise; HVAC cooling fans for expanded data halls; transformer noise; check local dB limits', urgency: 'Evaluate', timeline: '2–4 months' },
    ],
  },
];

const URGENCY_COLOR = {
  Critical:    'text-red-400 bg-red-900/20 border-red-700/40',
  Required:    'text-amber-400 bg-amber-900/20 border-amber-700/40',
  Evaluate:    'text-blue-400 bg-blue-900/20 border-blue-700/40',
  Conditional: 'text-violet-400 bg-violet-900/20 border-violet-700/40',
};

const CAT_COLOR = {
  indigo: 'border-indigo-600 text-indigo-400 bg-indigo-900/10',
  blue:   'border-blue-600 text-blue-400 bg-blue-900/10',
  violet: 'border-violet-600 text-violet-400 bg-violet-900/10',
  cyan:   'border-cyan-600 text-cyan-400 bg-cyan-900/10',
  amber:  'border-amber-600 text-amber-400 bg-amber-900/10',
  red:    'border-red-600 text-red-400 bg-red-900/10',
};

function DocRow({ doc, docType, generated, onPreview, onGenerate }) {
  const isGenerated = generated.has(doc.key);
  return (
    <tr className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors">
      <td className="py-2.5 px-3">
        <span className="font-mono text-xs text-gray-600">{docType === 'air' ? 'AIR' : 'WAT'}-{String(doc.id).padStart(3,'0')}</span>
      </td>
      <td className="py-2.5 px-3">
        <span className="text-xs text-gray-300">{doc.name}</span>
        <div className="text-xs text-gray-600 mt-0.5 font-mono">{doc.cfr}</div>
      </td>
      <td className="py-2.5 px-3 text-center">
        <span className="text-xs text-gray-500">{doc.pages} pp</span>
      </td>
      <td className="py-2.5 px-3 text-center">
        {isGenerated ? (
          <span className="text-xs text-green-400 bg-green-900/20 border border-green-700/40 rounded-full px-2.5 py-0.5">Ready</span>
        ) : (
          <span className="text-xs text-gray-600 bg-gray-800/40 border border-gray-700/40 rounded-full px-2.5 py-0.5">Pending</span>
        )}
      </td>
      <td className="py-2.5 px-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {isGenerated ? (
            <button
              onClick={() => onPreview(doc.key, docType, doc.id - 1)}
              className="text-xs bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg px-3 py-1.5 transition-colors border border-indigo-600"
            >
              Preview
            </button>
          ) : (
            <button
              onClick={() => onGenerate(doc.key)}
              className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg px-3 py-1.5 transition-colors border border-gray-600"
            >
              Generate
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function DocumentFactory({ results, inputs }) {
  const [generated, setGenerated] = useState(new Set());
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewDocIdx, setPreviewDocIdx] = useState(0);
  const [previewDocList, setPreviewDocList] = useState([]);
  const [activeView, setActiveView] = useState('docs'); // 'docs' | 'permits'

  const allDocs = [
    ...AIR_DOCS.map(d => ({ ...d, docType: 'air' })),
    ...WATER_DOCS.map(d => ({ ...d, docType: 'water' })),
  ];

  const safeInputs = inputs || {
    siteName: 'BigWatt Quantum Campus — Phase I', client: 'BigWatt Digital', state: 'Virginia', county: 'Prince William',
    address: '15000 Innovation Blvd, Gainesville, VA 20156', lat: '38.79', lon: '77.62',
    turbines: 8, mwPerTurbine: 50, heatRate: 7.5, noxFactor: 0.028, coFactor: 0.015,
    hours: 6000, brickSavings: 22, gensetCount: 24, gensetHP: 2000, gensetHours: 100,
    coolingMGD: 2.8, blowdownPct: 20, waterMGD: 0.15, datacenterMW: 300, pueTarget: 1.35,
    phases: 2, codTarget: 'Q3 2027', siteAcres: 85, stackHeight: 120, nearestReceptorFt: 1800,
    turbineType: 'GE 7F.05 / Siemens SGT6-5000F', nonAttainment: false,
  };

  const safeResults = results || {
      totalMW: 400, annualMWh: 2400000, annualMMBtu: 18000000,
      baseline: { nox: 142.3, co: 76.2, so2: 5.4, pm25: 68.4, voc: 18.9, co2e: 1053000, hap: 12.5 },
      controlled: { nox: 111.0, co: 59.4, so2: 4.2, pm25: 53.4, voc: 14.7, co2e: 821340, hap: 9.8 },
      avoided: { nox: 31.3, co: 16.8, co2e: 231660, water: 184 },
      pathway: { requiresPSD: true, syntheticMinorViable: false, requiresTitleV: true, controlledBelowMajor: false },
      water: { annualWaterMG: 1022, blowdownMG: 204.4, makeupMG: 1226, optimizedWater: 797 },
      genset: { gensetNox: 8.1, gensetCO: 2.0, gensetPM: 8.5 },
  };

  const generateSingle = (key) => {
    setGenerated(prev => new Set([...prev, key]));
  };

  const generateAll = () => {
    setGenerating(true);
    setGenerateProgress(0);
    const keys = allDocs.map(d => d.key);
    // Generate all documents atomically — eliminates any risk of skipped keys
    setGenerated(prev => new Set([...prev, ...keys]));
    // Animate progress bar separately for visual effect
    let progress = 0;
    const step = Math.round(100 / keys.length);
    const interval = setInterval(() => {
      progress += step;
      if (progress >= 100) {
        setGenerateProgress(100);
        clearInterval(interval);
        setGenerating(false);
      } else {
        setGenerateProgress(progress);
      }
    }, 40);
  };

  const openPreview = (key, docType, listIdx) => {
    const [type, num] = key.split('_');
    const doc = generateDocument(type, num, safeInputs, safeResults);
    if (!doc) return;

    // Build list of generated docs in order for prev/next navigation
    const genList = allDocs.filter(d => generated.has(d.key));
    const posInList = genList.findIndex(d => d.key === key);
    setPreviewDocList(genList);
    setPreviewDocIdx(posInList >= 0 ? posInList : 0);
    setPreviewDoc(doc);
  };

  const navigatePreview = (delta) => {
    const newIdx = previewDocIdx + delta;
    if (newIdx < 0 || newIdx >= previewDocList.length) return;
    const next = previewDocList[newIdx];
    const [type, num] = next.key.split('_');
    const doc = generateDocument(type, num, safeInputs, safeResults);
    if (!doc) return;
    setPreviewDocIdx(newIdx);
    setPreviewDoc(doc);
  };

  const handleDownloadAll = () => {
    const genDocs = allDocs.filter(d => generated.has(d.key));
    if (genDocs.length === 0) return;
    const lines = [];
    lines.push('BRICK PERMITOS™ — COMPLETE PERMIT PACKAGE');
    lines.push('═'.repeat(80));
    lines.push(`Facility: ${safeInputs.siteName}`);
    lines.push(`Client: ${safeInputs.client} | State: ${safeInputs.state} | County: ${safeInputs.county}`);
    lines.push(`Generated: ${new Date().toLocaleDateString()}`);
    lines.push(`Documents: ${genDocs.length} of 26`);
    lines.push('');
    lines.push('⚠ DRAFT — ALL DOCUMENTS REQUIRE PROFESSIONAL ENGINEER REVIEW BEFORE SUBMISSION');
    lines.push('═'.repeat(80));
    lines.push('');

    genDocs.forEach(d => {
      const [type, num] = d.key.split('_');
      const doc = generateDocument(type, num, safeInputs, safeResults);
      if (!doc) return;
      lines.push('');
      lines.push('╔' + '═'.repeat(78) + '╗');
      lines.push('║  ' + doc.title.padEnd(76) + '║');
      lines.push('║  ' + `Document No.: ${doc.docNum}`.padEnd(76) + '║');
      lines.push('╚' + '═'.repeat(78) + '╝');
      lines.push('');
      doc.sections.forEach(sec => {
        lines.push('─── ' + sec.heading + ' ' + '─'.repeat(Math.max(0, 76 - sec.heading.length)));
        lines.push('');
        lines.push(sec.body);
        lines.push('');
      });
      lines.push('─── [END OF ' + doc.docNum + '] ' + '─'.repeat(60));
      lines.push('');
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BrickPermitOS_${safeInputs.siteName.replace(/[^a-z0-9]/gi,'_').toLowerCase()}_permit_package.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalGenerated = generated.size;
  const airGenerated = AIR_DOCS.filter(d => generated.has(d.key)).length;
  const waterGenerated = WATER_DOCS.filter(d => generated.has(d.key)).length;
  const totalPermits = UPSIZED_PERMITS.reduce((s, c) => s + c.permits.length, 0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Document Factory</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Site-specific, submission-ready permit documents — real regulatory content, real citations, real calculated values.
            </p>
            <p className="text-xs text-amber-400 mt-1 font-semibold">
              ⚠ BigWatt upsizing to {safeInputs.turbines}×{safeInputs.mwPerTurbine} MW triggers {UPSIZED_PERMITS.reduce((s,c) => s+c.permits.length,0)} permit actions across {UPSIZED_PERMITS.length} regulatory domains.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveView('docs')}
              className={`text-xs px-4 py-2 rounded-lg border transition-all ${activeView === 'docs' ? 'bg-indigo-700 text-white border-indigo-600' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200'}`}
            >
              Documents (26)
            </button>
            <button
              onClick={() => setActiveView('permits')}
              className={`text-xs px-4 py-2 rounded-lg border transition-all ${activeView === 'permits' ? 'bg-amber-700 text-white border-amber-600' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200'}`}
            >
              All Permits Required ({totalPermits})
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Documents', value: `${totalGenerated} / 26`, color: 'text-indigo-400' },
            { label: 'Air Permits', value: `${airGenerated} / 16`, color: 'text-orange-400' },
            { label: 'Water Permits', value: `${waterGenerated} / 10`, color: 'text-blue-400' },
            { label: 'Permit Actions', value: totalPermits, color: 'text-amber-400' },
          ].map(s => (
            <div key={s.label} className="bg-gray-950/40 border border-gray-700/40 rounded-xl p-3">
              <div className="text-xs text-gray-500">{s.label}</div>
              <div className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── DOCUMENTS VIEW ─────────────────────────────────────────────────────── */}
      {activeView === 'docs' && (
        <>
          {/* Action bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-900/40 border border-gray-700/40 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              {generating ? (
                <div className="flex items-center gap-3">
                  <div className="w-36 bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-indigo-500 h-2 rounded-full transition-all duration-150"
                      style={{ width: `${generateProgress}%` }}
                    />
                  </div>
                  <span className="text-xs text-indigo-400">{generateProgress}% — Generating documents…</span>
                </div>
              ) : (
                <button
                  onClick={generateAll}
                  className="bg-indigo-700 hover:bg-indigo-600 text-white text-xs rounded-xl px-5 py-2.5 font-semibold transition-colors border border-indigo-600 flex items-center gap-2"
                >
                  ⚡ Generate All 26 Documents
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {totalGenerated > 0 && (
                <button
                  onClick={handleDownloadAll}
                  className="bg-green-700 hover:bg-green-600 text-white text-xs rounded-xl px-4 py-2 transition-colors border border-green-600 flex items-center gap-1.5"
                >
                  ⬇ Download Full Package ({totalGenerated} docs)
                </button>
              )}
              <span className="text-xs text-gray-500">{totalGenerated} of 26 generated</span>
            </div>
          </div>

          {/* AIR Documents Table */}
          <div className="rounded-xl border border-orange-900/30 bg-gray-900/20 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-orange-900/30 bg-orange-950/10">
              <div className="flex items-center gap-2">
                <span className="text-orange-400 text-sm">💨</span>
                <span className="text-sm font-semibold text-white">Air Permit Documents</span>
                <span className="text-xs text-gray-500 ml-1">(16 documents)</span>
              </div>
              <span className="text-xs text-orange-400">{airGenerated}/16 generated</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800/60">
                    <th className="py-2 px-3 text-left text-xs text-gray-600 font-medium">Doc No.</th>
                    <th className="py-2 px-3 text-left text-xs text-gray-600 font-medium">Document</th>
                    <th className="py-2 px-3 text-center text-xs text-gray-600 font-medium">Pages</th>
                    <th className="py-2 px-3 text-center text-xs text-gray-600 font-medium">Status</th>
                    <th className="py-2 px-3 text-right text-xs text-gray-600 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {AIR_DOCS.map(doc => (
                    <DocRow
                      key={doc.key}
                      doc={doc}
                      docType="air"
                      generated={generated}
                      onPreview={openPreview}
                      onGenerate={generateSingle}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* WATER Documents Table */}
          <div className="rounded-xl border border-blue-900/30 bg-gray-900/20 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-blue-900/30 bg-blue-950/10">
              <div className="flex items-center gap-2">
                <span className="text-blue-400 text-sm">💧</span>
                <span className="text-sm font-semibold text-white">Water Permit Documents</span>
                <span className="text-xs text-gray-500 ml-1">(10 documents)</span>
              </div>
              <span className="text-xs text-blue-400">{waterGenerated}/10 generated</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800/60">
                    <th className="py-2 px-3 text-left text-xs text-gray-600 font-medium">Doc No.</th>
                    <th className="py-2 px-3 text-left text-xs text-gray-600 font-medium">Document</th>
                    <th className="py-2 px-3 text-center text-xs text-gray-600 font-medium">Pages</th>
                    <th className="py-2 px-3 text-center text-xs text-gray-600 font-medium">Status</th>
                    <th className="py-2 px-3 text-right text-xs text-gray-600 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {WATER_DOCS.map(doc => (
                    <DocRow
                      key={doc.key}
                      doc={doc}
                      docType="water"
                      generated={generated}
                      onPreview={openPreview}
                      onGenerate={generateSingle}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="rounded-xl border border-amber-800/40 bg-amber-950/10 p-4">
            <p className="text-xs text-amber-400 font-semibold mb-1">DRAFT DOCUMENTS — PE REVIEW REQUIRED BEFORE AGENCY SUBMISSION</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              All documents are generated from site-specific inputs and live emission calculations. Regulatory citations, emission factors, and calculated values reflect current EPA and state requirements as of the document date.
              A licensed Professional Engineer (PE) must review and certify each document before submission to any regulatory agency.
              Brick PermitOS accelerates document preparation — it does not replace PE judgment.
            </p>
          </div>
        </>
      )}

      {/* ── ALL PERMITS REQUIRED VIEW ───────────────────────────────────────────── */}
      {activeView === 'permits' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-amber-700/30 bg-amber-950/10 p-4">
            <p className="text-xs text-amber-400 font-semibold mb-1">BigWatt Upsized Site — Complete Permit Universe</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              BigWatt Digital's decision to upsize the campus to <strong className="text-white">{safeInputs.turbines}×{safeInputs.mwPerTurbine} MW = {safeInputs.turbines * safeInputs.mwPerTurbine} MW total generation</strong> triggers a substantially larger permit footprint than a smaller site would require.
              The following <strong className="text-white">{totalPermits} permit actions</strong> across <strong className="text-white">{UPSIZED_PERMITS.length} regulatory domains</strong> are required or warrant evaluation.
              Each row identifies the specific upsizing trigger — the reason this permit is required because of the larger site scope.
            </p>
          </div>

          {UPSIZED_PERMITS.map(cat => (
            <div key={cat.category} className={`rounded-xl border overflow-hidden ${CAT_COLOR[cat.color]}`}>
              <div className={`px-4 py-3 border-b flex items-center justify-between ${CAT_COLOR[cat.color]}`}>
                <span className="text-sm font-semibold">{cat.category}</span>
                <span className="text-xs opacity-70">{cat.permits.length} items</span>
              </div>
              <div className="overflow-x-auto bg-gray-900/30">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800/40">
                      <th className="py-2 px-3 text-left text-xs text-gray-600 font-medium">Permit / Requirement</th>
                      <th className="py-2 px-3 text-left text-xs text-gray-600 font-medium">BigWatt Upsizing Trigger</th>
                      <th className="py-2 px-3 text-center text-xs text-gray-600 font-medium">Priority</th>
                      <th className="py-2 px-3 text-right text-xs text-gray-600 font-medium">Timeline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cat.permits.map((p, i) => (
                      <tr key={i} className="border-b border-gray-800/30 hover:bg-gray-800/20 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="text-xs text-gray-300 font-medium">{p.name}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-xs text-gray-500 leading-relaxed">{p.trigger}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`text-xs rounded-full px-2.5 py-0.5 border font-medium ${URGENCY_COLOR[p.urgency]}`}>
                            {p.urgency}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="text-xs text-gray-500 font-mono">{p.timeline}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Critical Actions', value: UPSIZED_PERMITS.flatMap(c=>c.permits).filter(p=>p.urgency==='Critical').length, color: 'text-red-400' },
              { label: 'Required Actions', value: UPSIZED_PERMITS.flatMap(c=>c.permits).filter(p=>p.urgency==='Required').length, color: 'text-amber-400' },
              { label: 'Evaluate / Screen', value: UPSIZED_PERMITS.flatMap(c=>c.permits).filter(p=>p.urgency==='Evaluate').length, color: 'text-blue-400' },
              { label: 'Total Permit Actions', value: totalPermits, color: 'text-indigo-400' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          doc={previewDoc}
          inputs={safeInputs}
          docIndex={previewDocIdx}
          docTotal={previewDocList.length}
          onClose={() => setPreviewDoc(null)}
          onPrev={previewDocIdx > 0 ? () => navigatePreview(-1) : null}
          onNext={previewDocIdx < previewDocList.length - 1 ? () => navigatePreview(1) : null}
        />
      )}
    </div>
  );
}
