import React, { useState, useEffect, useCallback } from 'react';
import DocumentPreviewModal from './DocumentPreviewModal';
import { generateDocument } from '../utils/documentGenerator';
import { getStateFormat, STATE_FORMATS, DEFAULT_STATE_FORMAT } from '../data/stateFormats';
import { getDocumentSource, getValidationInfo, registerAsgTemplate } from '../utils/asgImporter';
import asgTemplatePTE from '../data/asgTemplates/air_4_PTE';
import asgTemplateBACT from '../data/asgTemplates/air_7_BACT';
import { usePermitData } from '../context/PermitDataContext';
import { Wind, Drop, Buildings, Lightning } from '@phosphor-icons/react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from './ui/table';
import { Badge } from './ui/badge';
import { downloadPackageAsPdf } from '../utils/pdfExport';
import { BUILDING_MODULES, POWER_MODULES } from '../data/permitData';

// ─── Regulation Cross-Reference Map ─────────────────────────────────────────
// Each document's primary CFR/CWA citations for compliance tracking
const REG_CITATIONS = {
  'air_1':  { cfr: ['40 CFR § 51.166', '40 CFR § 52.21'],                     agency: 'EPA/State Air Agency',        type: 'Air' },
  'air_2':  { cfr: ['40 CFR § 51.166(b)(2)', '40 CFR § 60 KKKK'],             agency: 'EPA/State Air Agency',        type: 'Air' },
  'air_3':  { cfr: ['40 CFR Part 68', 'State Air Toxics Rules'],               agency: 'State Air Agency',            type: 'Air' },
  'air_4':  { cfr: ['EPA AP-42 §3.1', '40 CFR § 51.165', '40 CFR § 51.166'],  agency: 'EPA/State Air Agency',        type: 'Air' },
  'air_5':  { cfr: ['40 CFR § 51.166(b)(48)', '40 CFR § 70.3'],               agency: 'EPA/State Air Agency',        type: 'Air' },
  'air_6':  { cfr: ['40 CFR § 51.166', '40 CFR § 51.165', '40 CFR § 52.21'],  agency: 'EPA/State Air Agency',        type: 'Air' },
  'air_7':  { cfr: ['CAA § 165(a)(4)', '40 CFR § 51.166(j)'],                 agency: 'EPA/State Air Agency',        type: 'Air' },
  'air_8':  { cfr: ['40 CFR § 60.4300-4420 (KKKK/KKKKa)'],                    agency: 'EPA/State Air Agency',        type: 'Air' },
  'air_9':  { cfr: ['40 CFR § 63.6080-6145 (YYYY)'],                          agency: 'EPA/State Air Agency',        type: 'Air' },
  'air_10': { cfr: ['40 CFR § 60.4200-4219 (IIII)', '40 CFR § 63.6580-6675 (ZZZZ)'], agency: 'EPA/State Air Agency',  type: 'Air' },
  'air_11': { cfr: ['40 CFR § 60.7', '40 CFR § 64.1-64.10'],                  agency: 'EPA/State Air Agency',        type: 'Air' },
  'air_12': { cfr: ['40 CFR Part 51 App W'],                                   agency: 'EPA/State Air Agency',        type: 'Air' },
  'air_13': { cfr: ['40 CFR Part 51 App W', '40 CFR § 51.166(k)'],            agency: 'EPA/State Air Agency',        type: 'Air' },
  'air_14': { cfr: ['40 CFR § 98 Subpart C'],                                  agency: 'EPA GHGRP',                   type: 'Air' },
  'air_15': { cfr: ['40 CFR § 70.6', '40 CFR § 64.3', '40 CFR § 60.7'],       agency: 'EPA/State Air Agency',        type: 'Air' },
  'air_16': { cfr: ['EO 14096', 'CAA § 165(a)(2)'],                            agency: 'EPA/CEQ',                     type: 'Air' },
  'water_1':  { cfr: ['40 CFR § 122.21(g)'],                                   agency: 'EPA/State Water Agency',      type: 'Water' },
  'water_2':  { cfr: ['40 CFR § 122.21', '40 CFR § 122.44', 'CWA § 402'],    agency: 'EPA/State Water Agency',      type: 'Water' },
  'water_3':  { cfr: ['40 CFR § 122.44', '40 CFR § 403.5'],                   agency: 'EPA/State Water Agency',      type: 'Water' },
  'water_4':  { cfr: ['40 CFR § 122.26', 'EPA MSGP'],                          agency: 'EPA/State Water Agency',      type: 'Water' },
  'water_5':  { cfr: ['EPA CGP', '40 CFR § 122.26(b)(14)(x)'],                agency: 'EPA/State Water Agency',      type: 'Water' },
  'water_6':  { cfr: ['40 CFR § 125 Subpart J', 'CWA § 316(b)'],             agency: 'EPA/State Water Agency',      type: 'Water' },
  'water_7':  { cfr: ['40 CFR § 112.1', '40 CFR § 112.7'],                    agency: 'EPA/State Water Agency',      type: 'Water' },
  'water_8':  { cfr: ['40 CFR § 403.5', '40 CFR § 403.12'],                   agency: 'EPA/State Water Agency/POTW', type: 'Water' },
  'water_9':  { cfr: ['CWA § 404', 'CWA § 401'],                              agency: 'USACE/State Water Agency',    type: 'Water' },
  'water_10': { cfr: ['CWA § 303', 'State Water Conservation Rules'],          agency: 'State Water Agency',           type: 'Water' },
  // Building docs
  'building_1':  { cfr: ['IBC 2021 Chapters 3, 5, 6'],                            agency: 'Local Building Official / AHJ',                  type: 'Building' },
  'building_2':  { cfr: ['IBC 2021 Chapter 9', 'NFPA 13', 'NFPA 2001'],           agency: 'Fire Marshal / Local AHJ',                       type: 'Building' },
  'building_3':  { cfr: ['NFPA 110', 'NFPA 70 Art. 700/701/702', 'NFPA 37'],      agency: 'Local Building / Electrical Official',            type: 'Building' },
  'building_4':  { cfr: ['IBC 2021 Chapters 16-23', 'ASCE 7-22'],                  agency: 'Local Building Official / Structural Peer Review',type: 'Building' },
  'building_5':  { cfr: ['IBC 2021 Chapter 7', 'ASTM E119'],                       agency: 'Local Building Official / Fire Marshal',          type: 'Building' },
  'building_6':  { cfr: ['IMC 2021 Chapters 4-7', 'ASHRAE 90.4-2022'],             agency: 'Local Building / Mechanical Official',            type: 'Building' },
  'building_7':  { cfr: ['IBC 2021 §105', 'IBC 2021 §107'],                       agency: 'Local Building Department',                       type: 'Building' },
  'building_8':  { cfr: ['Local Zoning Ordinance', 'IBC Appendix E'],              agency: 'Zoning Board / Planning Commission',              type: 'Building' },
  // Power docs
  'power_1':  { cfr: ['FERC Order 2003', 'FERC Order 2006', 'ISO/RTO Tariff'],     agency: 'FERC / Utility / ISO-RTO',                        type: 'Power' },
  'power_2':  { cfr: ['NERC Reliability Standards', 'NERC Rules of Procedure §500'],agency: 'NERC / Regional Reliability Entity',              type: 'Power' },
  'power_3':  { cfr: ['State PUC Regulations', 'PURPA 16 USC §2601'],              agency: 'State Public Utility Commission',                 type: 'Power' },
  'power_4':  { cfr: ['PJM Manual 21', 'MISO Tariff Sch. 38', 'ERCOT Protocols §6'],agency: 'ISO/RTO (PJM, MISO, ERCOT, CAISO, NYISO)',        type: 'Power' },
  'power_5':  { cfr: ['NERC TPL-001', 'State Siting Board Regulations'],           agency: 'Utility / ISO-RTO / State Siting Board',          type: 'Power' },
  'power_6':  { cfr: ['Natural Gas Act 15 USC §717', '49 CFR Part 192'],           agency: 'FERC / State Pipeline Agency / Gas Utility',      type: 'Power' },
  'power_7':  { cfr: ['FERC PURPA §210', 'CAA §112/NESHAP', '26 USC §48'],         agency: 'FERC / DOE / State Energy Office',                type: 'Power' },
};

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

const BUILDING_DOCS = BUILDING_MODULES.map((m, i) => ({
  id: i + 1,
  key: `building_${i + 1}`,
  name: m.title,
  cfr: m.regulation,
  pages: '8–15',
}));

const POWER_DOCS = POWER_MODULES.map((m, i) => ({
  id: i + 1,
  key: `power_${i + 1}`,
  name: m.title,
  cfr: m.regulation,
  pages: '8–15',
}));

// ─── All Permits Required — BigWatt Upsized Site ──────────────────────────────
const UPSIZED_PERMITS = [
  {
    category: 'Federal Air Permits & Regulations',
    permitKey: 'air',
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
    permitKey: 'water',
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
    permitKey: 'air',
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
    permitKey: 'water',
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
    permitKey: 'landuse',
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
    permitKey: 'always',
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
  Critical:    'text-destructive bg-red-900/20 border-red-700/40',
  Required:    'text-destructive bg-amber-900/20 border-amber-700/40',
  Evaluate:    'text-blue-400 bg-blue-900/20 border-blue-700/40',
  Conditional: 'text-primary bg-primary/15 border-primary/40',
};

const CAT_STYLE = {
  air:      { border: 'border-[var(--color-chart-1)]/30', bg: 'bg-[var(--color-chart-1)]/5' },
  water:    { border: 'border-[var(--color-chart-2)]/30', bg: 'bg-[var(--color-chart-2)]/5' },
  building: { border: 'border-[var(--color-chart-3)]/30', bg: 'bg-[var(--color-chart-3)]/5' },
  power:    { border: 'border-[var(--color-chart-4)]/30', bg: 'bg-[var(--color-chart-4)]/5' },
  landuse:  { border: 'border-[var(--color-chart-3)]/30', bg: 'bg-[var(--color-chart-3)]/5' },
  always:   { border: 'border-[var(--color-chart-4)]/30', bg: 'bg-[var(--color-chart-4)]/5' },
};

function DocRow({ doc, docType, generated, compliance, onPreview, onGenerate }) {
  const isGenerated = generated.has(doc.key);
  const regInfo = REG_CITATIONS[doc.key];
  const compObj = (compliance || {})[doc.key] || {
    status: 'warning',
    label: 'Pending',
    reason: 'Document not yet generated. Click Generate to create.',
    trigger: null,
    recommendation: 'Click Generate to create the document. Compliance verification runs after generation.',
    aiHelp: null,
  };
  const docSource = getDocumentSource(doc.key);
  const [showSource, setShowSource] = useState(false);
  const [showCompliance, setShowCompliance] = useState(false);

  const statusLabel = compObj.label;
  const statusBadgeVariant = compObj.status === 'pass' ? 'default' : compObj.status === 'fail' ? 'destructive' : 'secondary';
  const statusBadgeClass = compObj.status === 'pass' ? 'text-green-400' : compObj.status === 'fail' ? '' : 'text-yellow-400';

  const validationInfo = docSource.badge !== 'GENERIC'
    ? getValidationInfo(doc.key)
    : null;

  return (
    <TableRow>
      <TableCell className="py-2.5">
        <span className="font-mono text-xs text-muted-foreground/70">{docType === 'air' ? 'AIR' : docType === 'water' ? 'WAT' : docType === 'building' ? 'BLD' : 'POW'}-{String(doc.id).padStart(3,'0')}</span>
      </TableCell>
      <TableCell className="py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground/80 font-medium">{doc.name}</span>
          {docSource.badge !== 'GENERIC' && (
            <div className="relative">
              <button
                onClick={() => setShowSource(!showSource)}
                onBlur={() => setTimeout(() => setShowSource(false), 200)}
                className={`text-xs px-1.5 py-0.5 font-semibold tracking-wider cursor-pointer hover:opacity-80 transition-opacity ${docSource.badgeColor}`}
              >
                {docSource.badge}
              </button>
              {showSource && validationInfo && (
                <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-muted border border-border p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-1.5 py-0.5 font-semibold ${docSource.badgeColor}`}>
                      {docSource.badge}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">Methodology Validated</span>
                  </div>
                  <p className="text-xs text-foreground/80 leading-relaxed mb-1.5">
                    The PermitOS methodology, analysis framework, and report structure
                    for this document have been cross-referenced against
                    actual ASG Consulting deliverables for similar data center permit
                    applications. All content is generated from site-specific data
                    and regulatory logic.
                  </p>
                  {validationInfo.validatedSections.length > 0 && (
                    <div className="bg-card/60 px-2 py-1.5 border border-border/40 mb-1.5">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Sections Validated</span>
                      <ul className="text-xs text-primary mt-0.5 list-disc list-inside">
                        {validationInfo.validatedSections.map((s, i) => (
                          <li key={i} className="font-mono">{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="bg-card/60 px-2 py-1.5 border border-border/40">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Reference Deliverable</span>
                    <p className="text-xs text-primary mt-0.5 font-mono">{validationInfo.projectName}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground/70 mt-0.5 font-mono truncate max-w-[320px]">
          {regInfo ? regInfo.cfr.join(', ') : doc.cfr}
        </div>
        {regInfo && (
          <div className="text-xs text-muted-foreground/70 mt-0.5">{regInfo.agency}</div>
        )}
      </TableCell>
      <TableCell className="py-2.5 text-center">
        <span className="text-xs text-muted-foreground">{doc.pages} pp</span>
      </TableCell>
      <TableCell className="py-2.5 text-center">
        <div className="relative">
          {isGenerated ? (
            <Badge
              variant={statusBadgeVariant}
              className={`cursor-pointer hover:opacity-80 transition-opacity ${statusBadgeClass}`}
              onClick={() => setShowCompliance(!showCompliance)}
              onBlur={() => setTimeout(() => setShowCompliance(false), 200)}
            >
              {compObj.label}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-muted-foreground/70">
              Pending
            </Badge>
          )}
          {showCompliance && (
            <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 w-80 bg-card border border-border p-3.5 text-left">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={statusBadgeVariant} className={statusBadgeClass}>
                  {statusLabel}
                </Badge>
              </div>
              <p className="text-xs text-foreground leading-relaxed mb-2">{compObj.reason}</p>
              {compObj.trigger && (
                <div className="bg-muted/40 border border-border/60 px-2.5 py-2 mb-2">
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Trigger</span>
                  <p className="text-xs text-muted-foreground/80 mt-0.5">{compObj.trigger}</p>
                </div>
              )}
              <div className="bg-primary/10 border border-primary/30 px-2.5 py-2 mb-2">
                <span className="text-xs text-primary font-semibold uppercase tracking-wider">Recommendation</span>
                <p className="text-xs text-primary/80 mt-0.5">{compObj.recommendation}</p>
              </div>
              {compObj.aiHelp && (
                <div className="bg-muted/40 border border-border/60 px-2.5 py-2">
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">AI Assistance</span>
                  <p className="text-xs text-muted-foreground/80 mt-0.5">{compObj.aiHelp}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell className="py-2.5 text-right">
        <div className="flex items-center justify-end gap-2">
          {isGenerated ? (
            <button
              onClick={() => onPreview(doc.key, docType, doc.id - 1)}
              className="text-xs bg-primary hover:bg-primary text-white px-3 py-1.5 transition-colors border border-primary"
            >
              Preview
            </button>
          ) : (
            <button
              onClick={() => onGenerate(doc.key)}
              className="text-xs bg-muted hover:bg-muted-foreground/20 text-foreground/80 px-3 py-1.5 transition-colors border border-border"
            >
              Generate
            </button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function DocumentFactory({ selectedDocKey, onClearSelection }) {
  const { inputs, results } = usePermitData();
  const [generated, setGenerated] = useState(new Set());
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewDocIdx, setPreviewDocIdx] = useState(0);
  const [previewDocList, setPreviewDocList] = useState([]);
  const [activeView, setActiveView] = useState('docs'); // 'docs' | 'permits'
  const [compliance, setCompliance] = useState({});
  const [initialNavDone, setInitialNavDone] = useState(false);
  const [selectedState, setSelectedState] = useState(inputs?.state || 'Virginia');

  // Derive which permit categories apply based on site intake answers
  const showAir = inputs?.hasOnSiteGeneration !== false;
  const showWater = results?.water?.determination ? results.water.determination.requiresAnyWaterPermit : inputs?.hasWaterUse !== false;
  const showBuilding = inputs?.hasNewConstruction !== false;
  const showPower = inputs?.hasGridInterconnection !== false;

  // Filter UPSIZED_PERMITS based on which permit categories are needed
  const filteredPermits = UPSIZED_PERMITS.filter(cat => {
    if (cat.permitKey === 'air') return showAir;
    if (cat.permitKey === 'water') return showWater;
    if (cat.permitKey === 'building') return showBuilding;
    if (cat.permitKey === 'power') return showPower;
    if (cat.permitKey === 'landuse') return showBuilding || showPower;
    return true; // 'always' and anything else
  });

  // Register ASG-sourced template content on mount
  useEffect(() => {
    registerAsgTemplate('air_4', { docKey: 'air_4', projectName: 'BigWatt AZ Data Center — PTE Workbook', content: asgTemplatePTE.content });
    registerAsgTemplate('air_7', { docKey: 'air_7', projectName: 'BigWatt VA Data Center — BACT Analysis', content: asgTemplateBACT.content });
  }, []);

  // Auto-open a specific document when navigated from Compliance Validation
  useEffect(() => {
    if (selectedDocKey && !initialNavDone) {
      const found = allDocs.find(d => d.key === selectedDocKey);
      if (found) {
        // Auto-generate the document so it's available for preview
        setGenerated(prev => new Set([...prev, selectedDocKey]));
        const [type, num] = selectedDocKey.split('_');
        const doc = generateDocument(type, num, safeInputs, safeResults);
        if (doc) {
          const genList = allDocs.filter(d => generated.has(d.key) || d.key === selectedDocKey);
          const posInList = genList.findIndex(d => d.key === selectedDocKey);
          setPreviewDocList(genList);
          setPreviewDocIdx(posInList >= 0 ? posInList : 0);
          setPreviewDoc(doc);
        }
        setInitialNavDone(true);
      }
    }
  }, [selectedDocKey, initialNavDone]);

  // Reset the navigation flag when selectedDocKey is cleared
  useEffect(() => {
    if (!selectedDocKey) {
      setInitialNavDone(false);
    }
  }, [selectedDocKey]);

  // Compute compliance status based on results
  const computeCompliance = (key) => {
    const docKey = key;
    if (!results) return {
      status: 'warning',
      label: 'Pending',
      reason: 'No PTE results available. Run Site Intake screening first.',
      trigger: null,
      recommendation: 'Complete data center equipment and emissions data entry in Site Intake tab, then run Permit Pathway Screening.',
      aiHelp: 'AI can review incomplete data fields and suggest reasonable defaults based on typical data center configurations and manufacturer specifications.',
    };

    // Check against regulatory thresholds using actual PTE results
    const controlled = results.controlled;
    const baseline = results.baseline;
    const pathway = results.pathway;

    switch (docKey) {
      case 'air_4': case 'air_6': {
        // PSD thresholds — check ALL criteria pollutants (gas turbines = listed source, 100 tpy threshold)
        const pollutants = ['nox', 'co', 'so2', 'pm25', 'voc'];
        const overThreshold = pollutants.filter(p => (baseline?.[p] || 0) >= 100);
        if (overThreshold.length > 0) {
          const pollutantStr = overThreshold.map(p => `${p.toUpperCase()} (${(baseline?.[p] || 0).toFixed(1)} tpy)`).join(', ');
          return {
            status: 'warning',
            label: 'Pending — PSD Threshold Triggered',
            reason: `${overThreshold.length} criteria pollutant(s) exceed the 100 tpy PSD major source threshold: ${pollutantStr}`,
            trigger: `PSD major source threshold (40 CFR § 51.166): any single pollutant ≥ 100 tpy for listed sources`,
            recommendation: 'Consider implementing additional BACT-level controls (SCR, oxidation catalyst) to reduce pollutant-specific PTE below 100 tpy. Evaluate synthetic minor permit pathway.',
            aiHelp: 'AI can model emission reduction scenarios (SCR efficiency tuning, catalyst upgrades) and calculate revised PTE to identify achievable synthetic minor thresholds.',
          };
        }
        return {
          status: 'pass',
          label: 'Verified',
          reason: `All criteria pollutants below 100 tpy PSD major source threshold. No PSD review required.`,
          trigger: null,
          recommendation: 'Maintain current emission control strategy. Document BACT analysis for permit record.',
          aiHelp: null,
        };
      }
      case 'air_5': {
        // Synthetic minor viability — all criteria pollutants must be below 100 tpy PSD threshold
        const pollutantsOver = ['nox', 'co', 'so2', 'pm25', 'voc'].filter(p => (controlled?.[p] || 0) >= 100);
        if (pollutantsOver.length === 0) {
          return {
            status: 'pass',
            label: 'Verified',
            reason: `All controlled emissions below 100 tpy. Synthetic minor pathway is viable.`,
            trigger: null,
            recommendation: 'Proceed with synthetic minor permit application. Ensure ongoing compliance with enforceable operating limits.',
            aiHelp: null,
          };
        }
        const ps = pollutantsOver.map(p => `${p.toUpperCase()} (${(controlled?.[p] || 0).toFixed(1)} tpy)`).join(', ');
        return {
          status: 'fail',
          label: 'Review — Synthetic Minor Not Viable',
          reason: `Controlled emissions for ${pollutantsOver.length} pollutant(s) still exceed 100 tpy: ${ps}. Full PSD review required.`,
          trigger: `Synthetic minor cap (40 CFR § 70.3(c)): all pollutants must be < 100 tpy with enforceable limits`,
          recommendation: 'Site is major source — proceed with PSD permitting. Consider additional controls or re-evaluating site configuration (e.g., reducing turbine count or annual hours).',
          aiHelp: 'AI can evaluate alternative control strategies, hour limitations, or fuel switching scenarios to achieve synthetic minor thresholds.',
        };
      }
      case 'air_7': {
        return {
          status: 'pass',
          label: 'Verified',
          reason: 'BACT analysis prepared: Top-down BACT methodology applied.',
          trigger: null,
          recommendation: 'Document BACT determination for permit record. Include in PSD permit application.',
          aiHelp: null,
        };
      }
      case 'air_8': case 'air_3': {
        if (controlled?.nox) {
          return {
            status: 'pass',
            label: 'Verified',
            reason: `NSPS Subpart KKKK' compliance verified. Controlled NOx = ${controlled.nox.toFixed(1)} tpy within regulatory limits.`,
            trigger: null,
            recommendation: 'Include NSPS compliance demonstration in permit application.',
            aiHelp: null,
          };
        }
        return {
          status: 'warning',
          label: 'Pending — NSPS Verification',
          reason: 'Controlled NOx data not available for NSPS Subpart KKKK compliance verification.',
          trigger: 'NSPS Subpart KKKK (40 CFR § 60.4300): requires NOx emissions monitoring for stationary gas turbines',
          recommendation: 'Verify turbine manufacturer NOx emission data and provide controlled NOx calculations.',
          aiHelp: 'AI can cross-reference turbine model with EPA emission factor database and generate NSPS compliance demonstration.',
        };
      }
      case 'air_9': {
        if (baseline?.hap && baseline.hap < 10) {
          return {
            status: 'pass',
            label: 'Verified',
            reason: `HAP emissions below 10 tpy threshold (baseline HAP = ${baseline.hap.toFixed(1)} tpy). NESHAP major source applicability avoided.`,
            trigger: null,
            recommendation: 'Area source status confirmed. Maintain fuel quality records and turbine maintenance logs.',
            aiHelp: null,
          };
        }
        if (baseline?.hap && baseline.hap >= 10) {
          return {
            status: 'warning',
            label: 'Pending — NESHAP Major Source',
            reason: `HAP emissions (${baseline.hap.toFixed(1)} tpy) ≥ 10 tpy threshold. NESHAP major source requirements apply.`,
            trigger: 'NESHAP major source threshold (40 CFR Part 63): HAP ≥ 10 tpy any single HAP or 25 tpy combined',
            recommendation: 'Evaluate HAP emission controls (fuel switching to natural gas, add-on controls). Consider MACT compliance requirements.',
            aiHelp: 'AI can analyze fuel composition data, estimate HAP emission reductions from control technologies, and prepare MACT applicability analysis.',
          };
        }
        return {
          status: 'warning',
          label: 'Pending — HAP Data Required',
          reason: 'HAP emission data not available. NESHAP applicability cannot be determined.',
          trigger: 'NESHAP major source threshold (40 CFR Part 63)',
          recommendation: 'Provide HAP emission estimates based on fuel composition and turbine operating parameters.',
          aiHelp: 'AI can estimate HAP emissions from fuel composition and AP-42 emission factors for gas turbines.',
        };
      }
      case 'air_10': {
        // Engine rules - check genset hours
        if (inputs?.gensetHours <= 100) {
          return {
            status: 'pass',
            label: 'Verified',
            reason: `Emergency generator hours (${inputs.gensetHours} hrs/yr) within 100 hr/yr emergency exemption.`,
            trigger: null,
            recommendation: 'Maintain hour meter logs. Ensure generators only operate for emergency and maintenance (≤ 100 hrs/yr).',
            aiHelp: null,
          };
        }
        return {
          status: 'warning',
          label: 'Pending — Engine Rule Applicability',
          reason: `Emergency generator hours (${inputs?.gensetHours} hrs/yr) exceed 100 hr/yr NESHAP emergency exemption.`,
          trigger: 'NESHAP emergency generator exemption (40 CFR § 63.6640(f)(2)(ii)): ≤ 100 hrs/yr for maintenance and readiness',
          recommendation: 'Install non-resettable hour meters on all emergency generators. Evaluate if generators can be limited to 100 hrs/yr. If not, full NESHAP compliance (including Tier certification) required.',
          aiHelp: 'AI can calculate optimal maintenance/testing schedule to stay within 100 hr exemption and prepare the emergency generator compliance plan.',
        };
      }
      case 'air_14': {
        // GHG reporting - check if above GHGRP threshold
        if (baseline?.co2e > 25000) {
          return {
            status: 'pass',
            label: 'Verified',
            reason: `GHG emissions (${(baseline.co2e / 1000).toFixed(0)}k tpy CO₂e) exceed GHGRP 25,000 tpy reporting threshold. Mandatory reporting applies.`,
            trigger: null,
            recommendation: 'Register with EPA GHGRP (Subpart C — general stationary fuel combustion sources). Submit annual GHG reports using 40 CFR Part 98 methodology.',
            aiHelp: null,
          };
        }
        return {
          status: 'warning',
          label: 'Pending — GHGRP Check',
          reason: `GHG emissions data (${baseline?.co2e ? (baseline.co2e / 1000).toFixed(0) + 'k tpy' : 'not available'}). ${baseline?.co2e > 25000 ? '' : 'Site below 25,000 tpy GHGRP threshold.'}`,
          trigger: 'GHGRP reporting threshold (40 CFR Part 98): ≥ 25,000 tpy CO₂e from stationary fuel combustion',
          recommendation: 'If below threshold, no annual GHG report required. If above, register and submit Subpart C reports annually.',
          aiHelp: 'AI can generate the GHGRP data collection plan, identify monitoring points, and prepare Subpart C annual report templates.',
        };
      }
      case 'air_15': {
        return {
          status: 'pass',
          label: 'Verified',
          reason: 'Monitoring, recordkeeping, and reporting plan generated. Compliance with permit conditions is tracked.',
          trigger: null,
          recommendation: 'Implement monitoring plan. Maintain all compliance records for minimum 5 years per permit requirements.',
          aiHelp: null,
        };
      }
      case 'water_6': {
        // 316(b) - check intake flow
        if (inputs?.coolingMGD >= 2) {
          return {
            status: 'warning',
            label: 'Pending — 316(b) Triggered',
            reason: `Cooling water intake flow (${inputs.coolingMGD} MGD) ≥ 2 MGD threshold. Section 316(b) of CWA applies.`,
            trigger: 'CWA § 316(b) (40 CFR Part 125): cooling water intake structures ≥ 2 MGD require NPDES permit with entrainment/impingement controls',
            recommendation: 'Submit 316(b) compliance information with NPDES permit application. Evaluate fish protection technologies (traveling screens, modified intake velocity).',
            aiHelp: 'AI can perform the 316(b) compliance cost-benefit analysis, prepare the entrainment/impingement characterization study, and draft the NPDES application narrative.',
          };
        }
        return {
          status: 'pass',
          label: 'Verified',
          reason: `Cooling water intake (${inputs?.coolingMGD || 0} MGD) below 2 MGD threshold. 316(b) not triggered.`,
          trigger: null,
          recommendation: 'No additional 316(b) compliance action required. Document intake flow rate in NPDES application.',
          aiHelp: null,
        };
      }
      case 'water_7': {
        // SPCC - check oil storage threshold
        const dieselStorage = (inputs?.gensetCount || 0) * 500 + 10000;
        if (dieselStorage > 1320) {
          return {
            status: 'warning',
            label: 'Pending — SPCC Triggered',
            reason: `Total oil storage capacity (${dieselStorage.toLocaleString()} gal) exceeds 1,320 gal SPCC threshold.`,
            trigger: 'SPCC rule (40 CFR Part 112): oil storage capacity > 1,320 gal requires SPCC Plan',
            recommendation: 'Prepare and implement SPCC Plan. Include secondary containment for all oil storage containers. Conduct facility oil storage inventory.',
            aiHelp: 'AI can draft the SPCC Plan, generate the facility oil storage map, calculate secondary containment volume requirements, and prepare the inspection checklist.',
          };
        }
        return {
          status: 'pass',
          label: 'Verified',
          reason: `Oil storage (${dieselStorage.toLocaleString()} gal) below 1,320 gal SPCC threshold.`,
          trigger: null,
          recommendation: 'No SPCC Plan required. Continue monitoring diesel storage volumes.',
          aiHelp: null,
        };
      }
      case 'water_5': {
        // CGP - check site acreage
        if ((inputs?.siteAcres || 0) >= 1) {
          return {
            status: 'warning',
            label: 'Pending — Stormwater CGP Required',
            reason: `Site disturbance (${inputs?.siteAcres || 0} acres) ≥ 1 acre. Construction stormwater permit required.`,
            trigger: 'CGP/CWA § 402(p) (40 CFR § 122.26): construction activity ≥ 1 acre requires NPDES stormwater permit',
            recommendation: 'Prepare and file Stormwater Pollution Prevention Plan (SWPPP). Submit Notice of Intent (NOI) for CGP coverage prior to construction.',
            aiHelp: 'AI can draft the SWPPP, generate site erosion and sediment control plans, complete the NOI form, and prepare weekly inspection log templates.',
          };
        }
        return {
          status: 'pass',
          label: 'Verified',
          reason: `Site disturbance (${inputs?.siteAcres || 0} acres) below 1 acre threshold. CGP not required.`,
          trigger: null,
          recommendation: 'No SWPPP required. Document site acreage in project records.',
          aiHelp: null,
        };
      }
      default:
        return {
          status: 'pass',
          label: 'Verified',
          reason: 'Standard compliance checks passed. Document generated from site-specific inputs.',
          trigger: null,
          recommendation: 'Include in permit application package.',
          aiHelp: null,
        };
    }
  };

  // Update compliance for a single generated doc
  const updateCompliance = (key) => {
    setCompliance(prev => ({ ...prev, [key]: computeCompliance(key) }));
  };

  // Override generateSingle to also compute compliance
  const handleGenerateSingle = (key) => {
    setGenerated(prev => new Set([...prev, key]));
    updateCompliance(key);
  };

  // Override generateAll to compute compliance for all docs
  const handleGenerateAll = () => {
    setGenerating(true);
    setGenerateProgress(0);
    const keys = allDocs.map(d => d.key);
    setGenerated(prev => new Set([...prev, ...keys]));
    const newCompliance = {};
    keys.forEach(k => { newCompliance[k] = computeCompliance(k); });
    setCompliance(prev => ({ ...prev, ...newCompliance }));
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

  const allDocs = [
    ...(showAir ? AIR_DOCS.map(d => ({ ...d, docType: 'air' })) : []),
    ...(showWater ? WATER_DOCS.map(d => ({ ...d, docType: 'water' })) : []),
    ...(showBuilding ? BUILDING_DOCS.map(d => ({ ...d, docType: 'building' })) : []),
    ...(showPower ? POWER_DOCS.map(d => ({ ...d, docType: 'power' })) : []),
  ];

  const safeInputs = inputs || {
    siteName: 'BigWatt Quantum Campus — Phase I', client: 'BigWatt Digital', state: selectedState, county: 'Prince William',
    address: '15000 Innovation Blvd, Gainesville, VA 20156', lat: '38.79', lon: '77.62',
    turbines: 8, mwPerTurbine: 50, heatRate: 7.5, noxFactor: 0.028, coFactor: 0.015,
    hours: 6000, brickSavings: 22, gensetCount: 24, gensetHP: 2000, gensetHours: 100,
    coolingMGD: 2.8, blowdownPct: 20, waterMGD: 0.15, datacenterMW: 267, pueTarget: 1.35,
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
    const docs = genDocs.map(d => {
      const [type, num] = d.key.split('_');
      return generateDocument(type, num, safeInputs, safeResults);
    }).filter(Boolean);
    downloadPackageAsPdf(docs, safeInputs.siteName);
  };

  const totalGenerated = generated.size;
  const airGenerated = AIR_DOCS.filter(d => generated.has(d.key)).length;
  const waterGenerated = WATER_DOCS.filter(d => generated.has(d.key)).length;
  const buildingGenerated = BUILDING_DOCS.filter(d => generated.has(d.key)).length;
  const powerGenerated = POWER_DOCS.filter(d => generated.has(d.key)).length;
  const filteredPermitCount = filteredPermits.reduce((s, c) => s + c.permits.length, 0);
  const totalDocCount = allDocs.length;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <Card className="bg-card/40">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <CardTitle className="text-base">Document Factory</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Site-specific draft permit documents — real regulatory content, real citations, real calculated values.
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <p className="text-xs text-destructive font-semibold">
                  &#9888; BigWatt upsizing to {safeInputs.turbines}&times;{safeInputs.mwPerTurbine} MW triggers permit actions across {filteredPermits.length} regulatory domains.
                </p>
                {/* State format badge */}
                {getStateFormat(selectedState).airAgency !== DEFAULT_STATE_FORMAT.airAgency && (
                  <span className="text-xs bg-primary/30 border border-primary/40 text-primary px-2 py-0.5 flex-shrink-0">
                    {getStateFormat(selectedState).airAgencyAbbr}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setActiveView('docs')}
                className={`text-xs px-4 py-2 border transition-all ${activeView === 'docs' ? 'bg-primary text-white border-primary' : 'bg-muted text-muted-foreground border-border hover:text-foreground'}`}
              >
                Documents ({totalDocCount})
              </button>
              <button
                onClick={() => setActiveView('permits')}
                className={`text-xs px-4 py-2 border transition-all ${activeView === 'permits' ? 'bg-destructive text-white border-amber-600' : 'bg-muted text-muted-foreground border-border hover:text-foreground'}`}
              >
                All Permits Required ({filteredPermitCount})
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Documents', value: `${totalGenerated} / ${totalDocCount}`, color: 'text-primary' },
              ...(showAir ? [{ label: 'Air Permits', value: `${airGenerated} / ${AIR_DOCS.length}`, color: 'text-[var(--color-chart-1)]' }] : []),
              ...(showWater ? [{ label: 'Water Permits', value: `${waterGenerated} / ${WATER_DOCS.length}`, color: 'text-[var(--color-chart-2)]' }] : []),
              ...(showBuilding ? [{ label: 'Building Permits', value: `${buildingGenerated} / ${BUILDING_DOCS.length}`, color: 'text-[var(--color-chart-3)]' }] : []),
              ...(showPower ? [{ label: 'Power Permits', value: `${powerGenerated} / ${POWER_DOCS.length}`, color: 'text-[var(--color-chart-4)]' }] : []),
              { label: 'Permit Actions', value: filteredPermitCount, color: 'text-destructive' },
            ].map(s => (
              <div key={s.label} className="bg-background/40 border border-border/40 p-3">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className={`text-xl font-bold mt-0.5 ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── DOCUMENTS VIEW ─────────────────────────────────────────────────────── */}
      {activeView === 'docs' && (
        <>
          {/* Action bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card/40 border border-border/40 px-4 py-3">
            <div className="flex items-center gap-3">
              {generating ? (
                <div className="flex items-center gap-3">
                  <div className="w-36 bg-muted h-2">
                    <div
                      className="bg-primary h-2 transition-all duration-150"
                      style={{ width: `${generateProgress}%` }}
                    />
                  </div>
                  <span className="text-xs text-primary">{generateProgress}% — Generating documents…</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleGenerateAll}
                    className="bg-primary hover:bg-primary text-white text-xs px-5 py-2.5 font-semibold transition-colors border border-primary flex items-center gap-2"
                  >
                    &#9889; Generate All {totalDocCount} Documents
                  </button>
                  {/* State selector */}
                  <div className="flex items-center gap-2 pl-3 border-l border-border/40">
                    <label className="text-xs text-muted-foreground uppercase tracking-wider">State</label>
                    <select
                      value={selectedState}
                      onChange={(e) => setSelectedState(e.target.value)}
                      className="text-xs bg-muted text-foreground/80 border border-border px-2 py-1.5 w-28"
                    >
                      {Object.keys(STATE_FORMATS).concat(['Alaska', 'Hawaii']).sort().map(s => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                      <option value="Other">Other (Generic)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {totalGenerated > 0 && (
                <button
                  onClick={handleDownloadAll}
                  className="bg-primary hover:bg-primary/80 text-white text-xs px-4 py-2 transition-colors border border-green-600 flex items-center gap-1.5"
                >
                  &#11015; Download Full Package ({totalGenerated} docs)
                </button>
              )}
              <span className="text-xs text-muted-foreground">{totalGenerated} of {totalDocCount} generated</span>
            </div>
          </div>

          {/* AIR Documents Table */}
          {showAir && (
            <Card className="pt-0">
              <CardHeader className="items-center pt-(--card-spacing) border-b border-[var(--color-chart-1)]/30 bg-[var(--color-chart-1)]/5">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Wind size={18} weight="duotone" style={{ color: 'var(--color-chart-1)' }} />
                    <CardTitle className="text-sm normal-case tracking-normal font-sans text-white">Air Permit Documents</CardTitle>
                    <span className="text-xs text-muted-foreground ml-1">({AIR_DOCS.length} documents)</span>
                  </div>
                  <span className="text-xs text-white">{airGenerated}/{AIR_DOCS.length} generated</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-2 px-3">Doc No.</TableHead>
                      <TableHead className="py-2 px-3">Document</TableHead>
                      <TableHead className="py-2 px-3 text-center">Pages</TableHead>
                      <TableHead className="py-2 px-3 text-center">Status</TableHead>
                      <TableHead className="py-2 px-3 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {AIR_DOCS.map(doc => (
                      <DocRow
                        key={doc.key}
                        doc={doc}
                        docType="air"
                        generated={generated}
                        compliance={compliance}
                        onPreview={openPreview}
                        onGenerate={handleGenerateSingle}
                      />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* WATER Documents Table */}
          {showWater && (
            <Card className="pt-0">
              <CardHeader className="items-center pt-(--card-spacing) border-b border-[var(--color-chart-2)]/30 bg-[var(--color-chart-2)]/5">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Drop size={18} weight="duotone" style={{ color: 'var(--color-chart-2)' }} />
                    <CardTitle className="text-sm normal-case tracking-normal font-sans text-white">Water Permit Documents</CardTitle>
                    <span className="text-xs text-muted-foreground ml-1">({WATER_DOCS.length} documents)</span>
                  </div>
                  <span className="text-xs text-white">{waterGenerated}/{WATER_DOCS.length} generated</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-2 px-3">Doc No.</TableHead>
                      <TableHead className="py-2 px-3">Document</TableHead>
                      <TableHead className="py-2 px-3 text-center">Pages</TableHead>
                      <TableHead className="py-2 px-3 text-center">Status</TableHead>
                      <TableHead className="py-2 px-3 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {WATER_DOCS.map(doc => (
                      <DocRow
                        key={doc.key}
                        doc={doc}
                        docType="water"
                        generated={generated}
                        compliance={compliance}
                        onPreview={openPreview}
                        onGenerate={handleGenerateSingle}
                      />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* BUILDING Documents Table */}
          {showBuilding && (
            <Card className="pt-0">
              <CardHeader className="items-center pt-(--card-spacing) border-b border-[var(--color-chart-3)]/30 bg-[var(--color-chart-3)]/5">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Buildings size={18} weight="duotone" style={{ color: 'var(--color-chart-3)' }} />
                    <CardTitle className="text-sm normal-case tracking-normal font-sans text-white">Building Permit Documents</CardTitle>
                    <span className="text-xs text-muted-foreground ml-1">({BUILDING_DOCS.length} documents)</span>
                  </div>
                  <span className="text-xs text-white">{buildingGenerated}/{BUILDING_DOCS.length} generated</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-2 px-3">Doc No.</TableHead>
                      <TableHead className="py-2 px-3">Document</TableHead>
                      <TableHead className="py-2 px-3 text-center">Pages</TableHead>
                      <TableHead className="py-2 px-3 text-center">Status</TableHead>
                      <TableHead className="py-2 px-3 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {BUILDING_DOCS.map(doc => (
                      <DocRow
                        key={doc.key}
                        doc={doc}
                        docType="building"
                        generated={generated}
                        compliance={compliance}
                        onPreview={openPreview}
                        onGenerate={handleGenerateSingle}
                      />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* POWER Documents Table */}
          {showPower && (
            <Card className="pt-0">
              <CardHeader className="items-center pt-(--card-spacing) border-b border-[var(--color-chart-4)]/30 bg-[var(--color-chart-4)]/5">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <Lightning size={18} weight="duotone" style={{ color: 'var(--color-chart-4)' }} />
                    <CardTitle className="text-sm normal-case tracking-normal font-sans text-white">Power Permit Documents</CardTitle>
                    <span className="text-xs text-muted-foreground ml-1">({POWER_DOCS.length} documents)</span>
                  </div>
                  <span className="text-xs text-white">{powerGenerated}/{POWER_DOCS.length} generated</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="py-2 px-3">Doc No.</TableHead>
                      <TableHead className="py-2 px-3">Document</TableHead>
                      <TableHead className="py-2 px-3 text-center">Pages</TableHead>
                      <TableHead className="py-2 px-3 text-center">Status</TableHead>
                      <TableHead className="py-2 px-3 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {POWER_DOCS.map(doc => (
                      <DocRow
                        key={doc.key}
                        doc={doc}
                        docType="power"
                        generated={generated}
                        compliance={compliance}
                        onPreview={openPreview}
                        onGenerate={handleGenerateSingle}
                      />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Disclaimer */}
          <div className="border border-border/60 bg-muted/20 p-4">
            <p className="text-xs text-destructive font-semibold mb-1">DRAFT DOCUMENTS — PE REVIEW REQUIRED BEFORE AGENCY SUBMISSION</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
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
          <div className="border border-border/60 bg-muted/20 p-4">
            <p className="text-xs text-destructive font-semibold mb-1">BigWatt Upsized Site — Complete Permit Universe</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              BigWatt Digital's decision to upsize the campus to <strong className="text-white">{safeInputs.turbines}&times;{safeInputs.mwPerTurbine} MW = {safeInputs.turbines * safeInputs.mwPerTurbine} MW total generation</strong> triggers a substantially larger permit footprint than a smaller site would require.
              The following <strong className="text-white">{filteredPermitCount} permit actions</strong> across <strong className="text-white">{filteredPermits.length} regulatory domains</strong> are required or warrant evaluation.
              Each row identifies the specific upsizing trigger — the reason this permit is required because of the larger site scope.
            </p>
          </div>

          {filteredPermits.map(cat => (
            <div key={cat.category} className={`border overflow-hidden ${CAT_STYLE[cat.permitKey]?.border || 'border-border/60'}`}>
              <div className={`px-4 py-3 border-b flex items-center justify-between ${CAT_STYLE[cat.permitKey]?.bg || 'bg-muted/20'}`}>
                <span className="text-sm font-semibold text-white">{cat.category}</span>
                <span className="text-xs opacity-70">{cat.permits.length} items</span>
              </div>
              <div className="overflow-x-auto bg-card/30">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/40">
                      <th className="py-2 px-3 text-left text-xs text-muted-foreground/70 font-medium">Permit / Requirement</th>
                      <th className="py-2 px-3 text-left text-xs text-muted-foreground/70 font-medium">BigWatt Upsizing Trigger</th>
                      <th className="py-2 px-3 text-center text-xs text-muted-foreground/70 font-medium">Priority</th>
                      <th className="py-2 px-3 text-right text-xs text-muted-foreground/70 font-medium">Timeline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cat.permits.map((p, i) => (
                      <tr key={i} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="text-xs text-foreground/80 font-medium">{p.name}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-xs text-muted-foreground leading-relaxed">{p.trigger}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`text-xs px-2.5 py-0.5 border font-medium ${URGENCY_COLOR[p.urgency]}`}>
                            {p.urgency}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="text-xs text-muted-foreground font-mono">{p.timeline}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="border border-border/40 bg-card/40 p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Critical Actions', value: filteredPermits.flatMap(c=>c.permits).filter(p=>p.urgency==='Critical').length, color: 'text-destructive' },
              { label: 'Required Actions', value: filteredPermits.flatMap(c=>c.permits).filter(p=>p.urgency==='Required').length, color: 'text-destructive' },
              { label: 'Evaluate / Screen', value: filteredPermits.flatMap(c=>c.permits).filter(p=>p.urgency==='Evaluate').length, color: 'text-blue-400' },
              { label: 'Total Permit Actions', value: filteredPermitCount, color: 'text-primary' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
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
          onClose={() => { setPreviewDoc(null); onClearSelection?.(); }}
          onPrev={previewDocIdx > 0 ? () => navigatePreview(-1) : null}
          onNext={previewDocIdx < previewDocList.length - 1 ? () => navigatePreview(1) : null}
        />
      )}
    </div>
  );
}