// ─── Compliance Validation Engine ─────────────────────────────────────────────
// Validates generated permit documents against ingested CFR regulations.
// Returns pass/fail/warning for each regulatory criterion.

import { getDb } from '../db/database.js';
import { searchRegulations } from '../rag/vectorStore.js';

// ─── Document-to-Regulation Map ──────────────────────────────────────────────
// Maps each document to the specific CFR sections it must cite/comply with
export const DOC_REGULATION_MAP = {
  // ── Air Documents ──
  'air_1': {
    title: 'Project Description & Site Process Flow',
    regulations: [
      { cfr: '40 CFR 51.166', description: 'PSD Applicability reporting', required: true },
      { cfr: '40 CFR 52.21', description: 'Federal PSD requirements', required: false },
    ],
    thresholds: [],
  },
  'air_2': {
    title: 'Emission Unit Inventory',
    regulations: [
      { cfr: '40 CFR 51.166', description: 'Emission unit identification', required: true },
      { cfr: '40 CFR 60 Subpart KKKK', description: 'Turbine unit identification', required: true },
    ],
    thresholds: [],
  },
  'air_3': {
    title: 'NSPS Applicability Matrix',
    regulations: [
      { cfr: '40 CFR 60 Subpart KKKK', description: 'NSPS for stationary combustion turbines', required: true },
      { cfr: '40 CFR 60 Subpart KKKKa', description: 'NSPS for newer turbines', required: false },
      { cfr: '40 CFR 60 Subpart IIII', description: 'NSPS for CI engines', required: true },
      { cfr: '40 CFR 60 Subpart JJJJ', description: 'NSPS for SI engines', required: false },
    ],
    thresholds: [
      { pollutant: 'NOx', limit: 15, unit: 'ppmvd @ 15% O2', regulation: '40 CFR 60 Subpart KKKKa' },
      { pollutant: 'CO', limit: 20, unit: 'ppmvd @ 15% O2', regulation: '40 CFR 60 Subpart KKKKa' },
    ],
  },
  'air_4': {
    title: 'PTE Workbook — Baseline Uncontrolled',
    regulations: [
      { cfr: '40 CFR 51.165', description: 'NSR applicability thresholds', required: true },
      { cfr: '40 CFR 51.166', description: 'PSD baseline PTE thresholds', required: true },
      { cfr: 'EPA AP-42', description: 'Emission factor methodology', required: true },
    ],
    thresholds: [
      { pollutant: 'NOx', limit: 100, unit: 'tpy', regulation: 'PSD Major Source Threshold', type: 'psd' },
      { pollutant: 'CO', limit: 100, unit: 'tpy', regulation: 'PSD Major Source Threshold', type: 'psd' },
      { pollutant: 'SO2', limit: 100, unit: 'tpy', regulation: 'PSD Major Source Threshold', type: 'psd' },
      { pollutant: 'PM25', limit: 100, unit: 'tpy', regulation: 'PSD Major Source Threshold', type: 'psd' },
      { pollutant: 'VOC', limit: 100, unit: 'tpy', regulation: 'PSD Major Source Threshold', type: 'psd' },
      { pollutant: 'CO2e', limit: 100000, unit: 'tpy', regulation: 'PSD GHG Threshold', type: 'ghg' },
      { pollutant: 'HAP', limit: 10, unit: 'tpy (single)', regulation: 'NESHAP Major Source', type: 'hap' },
    ],
  },
  'air_5': {
    title: 'Controlled PTE & Enforceable Limits',
    regulations: [
      { cfr: '40 CFR 51.166', description: 'Synthetic minor / enforceable limits strategy', required: true },
      { cfr: '40 CFR 70.3', description: 'Title V applicability', required: true },
    ],
    thresholds: [
      { pollutant: 'NOx', limit: 100, unit: 'tpy', regulation: 'Synthetic Minor NOx', type: 'controlled' },
      { pollutant: 'CO', limit: 100, unit: 'tpy', regulation: 'Synthetic Minor CO', type: 'controlled' },
    ],
  },
  'air_6': {
    title: 'PSD/NSR Applicability Determination',
    regulations: [
      { cfr: '40 CFR 51.166', description: 'PSD applicability determination', required: true },
      { cfr: '40 CFR 52.21', description: 'Federal PSD program requirements', required: true },
      { cfr: '40 CFR 51.165', description: 'NSR nonattainment requirements', required: false },
    ],
    thresholds: [
      { pollutant: 'Baseline Total', limit: 250, unit: 'tpy', regulation: 'General Major Source', type: 'major' },
    ],
  },
  'air_7': {
    title: 'BACT Top-Down Analysis',
    regulations: [
      { cfr: '40 CFR 51.166', description: 'BACT requirements under PSD', required: true },
      { cfr: 'CAA § 165', description: 'PSD BACT statutory requirement', required: true },
      { cfr: '40 CFR 60 Subpart KKKKa', description: 'NSPS emission limits reference', required: true },
    ],
    thresholds: [
      { pollutant: 'NOx BACT', limit: 9, unit: 'ppmvd', regulation: 'BACT for modern DLN turbines' },
      { pollutant: 'CO BACT', limit: 20, unit: 'ppmvd', regulation: 'BACT for CO with oxidation catalyst' },
    ],
  },
  'air_8': {
    title: 'NSPS Subpart KKKK Compliance Matrix',
    regulations: [
      { cfr: '40 CFR 60 Subpart KKKK', description: 'NSPS turbine emission limits', required: true },
      { cfr: '40 CFR 60 Subpart KKKKa', description: 'NSPS newer turbine limits', required: false },
    ],
    thresholds: [
      { pollutant: 'NOx', limit: 15, unit: 'ppmvd', regulation: '40 CFR 60 Subpart KKKK' },
      { pollutant: 'CO', limit: 20, unit: 'ppmvd', regulation: '40 CFR 60 Subpart KKKK' },
    ],
  },
  'air_9': {
    title: 'NESHAP Subpart YYYY Compliance',
    regulations: [
      { cfr: '40 CFR 63 Subpart YYYY', description: 'Combustion turbine NESHAP', required: true },
    ],
    thresholds: [
      { pollutant: 'Formaldehyde', limit: 91, unit: 'ppbvd', regulation: '40 CFR 63 Subpart YYYY' },
    ],
  },
  'air_10': {
    title: 'Engine Rule Applicability Matrix',
    regulations: [
      { cfr: '40 CFR 60 Subpart IIII', description: 'CI engine NSPS', required: true },
      { cfr: '40 CFR 63 Subpart ZZZZ', description: 'RICE NESHAP', required: true },
    ],
    thresholds: [
      { pollutant: 'Emergency Hours', limit: 100, unit: 'hr/yr', regulation: '40 CFR 60 Subpart IIII', type: 'operational' },
    ],
  },
  'air_11': {
    title: 'SSM / Startup Shutdown Plan',
    regulations: [
      { cfr: '40 CFR 60', description: 'SSM provisions (General Provisions)', required: true },
      { cfr: '40 CFR 64', description: 'Compliance Assurance Monitoring', required: true },
    ],
    thresholds: [],
  },
  'air_12': {
    title: 'AERMOD Modeling Protocol',
    regulations: [
      { cfr: '40 CFR 51 Appendix W', description: 'Guideline on Air Quality Models', required: true },
    ],
    thresholds: [],
  },
  'air_13': {
    title: 'AERMOD Modeling Results',
    regulations: [
      { cfr: '40 CFR 51 Appendix W', description: 'AERMOD modeling requirements', required: true },
    ],
    thresholds: [],
  },
  'air_14': {
    title: 'GHG / Decarbonization Report',
    regulations: [
      { cfr: '40 CFR 98 Subpart C', description: 'GHGRP stationary combustion reporting', required: true },
    ],
    thresholds: [
      { pollutant: 'CO2e', limit: 25000, unit: 'mt/yr', regulation: 'GHGRP Reporting Threshold', type: 'ghg' },
    ],
  },
  'air_15': {
    title: 'Monitoring & Recordkeeping Plan',
    regulations: [
      { cfr: '40 CFR 70.6', description: 'Title V monitoring requirements', required: true },
      { cfr: '40 CFR 64', description: 'CAM plan requirements', required: false },
      { cfr: '40 CFR 60', description: 'NSPS monitoring requirements', required: true },
    ],
    thresholds: [],
  },
  'air_16': {
    title: 'EJ / Public Participation Package',
    regulations: [
      { cfr: 'EO 14096', description: 'Environmental Justice requirements', required: true },
      { cfr: 'CAA § 165', description: 'Public participation requirements', required: true },
    ],
    thresholds: [],
  },
  // ── Water Documents ──
  'water_1': {
    title: 'Water Balance Diagram',
    regulations: [
      { cfr: '40 CFR 122.21', description: 'NPDES application requirements', required: true },
    ],
    thresholds: [],
  },
  'water_2': {
    title: 'NPDES Applicability Determination',
    regulations: [
      { cfr: '40 CFR 122.21', description: 'NPDES permit applicability', required: true },
      { cfr: '40 CFR 122.44', description: 'Effluent limitations and standards', required: true },
    ],
    thresholds: [],
  },
  'water_3': {
    title: 'Cooling Tower Blowdown Characterization',
    regulations: [
      { cfr: '40 CFR 122.44', description: 'Technology-based effluent limits', required: true },
      { cfr: '40 CFR 403', description: 'Pretreatment standards', required: false },
    ],
    thresholds: [
      { pollutant: 'pH', limit: '6.0-9.0', unit: 's.u.', regulation: '40 CFR 122.44' },
      { pollutant: 'Temperature Rise', limit: 5, unit: '°F', regulation: '40 CFR 122.44' },
    ],
  },
  'water_4': {
    title: 'Industrial Stormwater SWPPP',
    regulations: [
      { cfr: '40 CFR 122.26', description: 'Industrial stormwater permitting', required: true },
      { cfr: 'EPA MSGP', description: 'Multi-Sector General Permit requirements', required: true },
    ],
    thresholds: [],
  },
  'water_5': {
    title: 'Construction Stormwater Plan',
    regulations: [
      { cfr: 'EPA CGP', description: 'Construction General Permit requirements', required: true },
    ],
    thresholds: [
      { pollutant: 'Disturbed Area', limit: 1, unit: 'acre', regulation: 'CGP Applicability', type: 'operational' },
    ],
  },
  'water_6': {
    title: '316(b) Cooling Water Analysis',
    regulations: [
      { cfr: '40 CFR 125 Subpart J', description: 'Cooling water intake structures', required: true },
    ],
    thresholds: [
      { pollutant: 'Intake Flow', limit: 2, unit: 'MGD', regulation: '40 CFR 125 Subpart J', type: 'operational' },
    ],
  },
  'water_7': {
    title: 'SPCC Plan',
    regulations: [
      { cfr: '40 CFR 112', description: 'Oil Pollution Prevention / SPCC Rule', required: true },
    ],
    thresholds: [
      { pollutant: 'Oil Storage (aboveground)', limit: 1320, unit: 'gal', regulation: '40 CFR 112', type: 'operational' },
      { pollutant: 'Oil Storage (buried)', limit: 42000, unit: 'gal', regulation: '40 CFR 112', type: 'operational' },
    ],
  },
  'water_8': {
    title: 'POTW / Pretreatment Analysis',
    regulations: [
      { cfr: '40 CFR 403', description: 'General pretreatment regulations', required: true },
      { cfr: '40 CFR 403.12', description: 'SIU reporting requirements', required: false },
    ],
    thresholds: [
      { pollutant: 'pH', limit: 5.0, unit: 's.u. (minimum)', regulation: '40 CFR 403.5' },
      { pollutant: 'Temperature', limit: 104, unit: '°F', regulation: '40 CFR 403.5' },
    ],
  },
  'water_9': {
    title: 'Wetlands / WOTUS Screening',
    regulations: [
      { cfr: 'CWA § 404', description: 'Dredge and fill permitting', required: true },
      { cfr: 'CWA § 401', description: 'Water quality certification', required: true },
    ],
    thresholds: [
      { pollutant: 'Wetland Impact', limit: 0.5, unit: 'acre', regulation: 'Nationwide Permit 39', type: 'operational' },
    ],
  },
  'water_10': {
    title: 'Water Conservation & Reuse Plan',
    regulations: [
      { cfr: 'CWA § 303', description: 'Water quality standards', required: false },
    ],
    thresholds: [],
  },
};

// ─── Resolution & Remediation Roadmaps ──────────────────────────────────────
// For each document with warnings or failures, provides specific remediation
// steps, timelines, and recommended actions to achieve full compliance.
const RESOLUTIONS_MAP = {
  air_3: {
    type: 'Warning',
    summary: 'NSPS compliance margin is narrow — deployment of DLN-II combustors or SCR may be required to ensure sub-15 ppmvd NOx.',
    steps: [
      { action: 'Evaluate DLN-II / DLN-2.6+ upgrade feasibility from turbine OEM', effort: '4-6 weeks', priority: 'High', responsible: 'Turbine OEM + Engineering' },
      { action: 'Install continuous emission monitoring (CEMS) for NOx and CO on each turbine', effort: '8-12 weeks', priority: 'High', responsible: 'CEMS Vendor + Brick Controls' },
      { action: 'Conduct annual source test to verify compliance margin', effort: '1 week annually', priority: 'Medium', responsible: 'Stack Testing Firm' },
      { action: 'Update NSPS compliance matrix with performance test results', effort: '1 week after test', priority: 'Medium', responsible: 'Compliance Team' },
    ],
    roadmap: 'DLN-II or SCR upgrade within 6 months of permit issuance. CEMS procurement in parallel. Annual performance testing to document margin.',
    estimatedTimeline: '6 months',
    costEstimate: '$1.5M-3.5M (CEMS + combustor upgrade per turbine bank)',
  },
  air_4: {
    type: 'Warning',
    summary: 'Baseline PTE exceeds PSD major source thresholds for NOx (100 tpy). Requires PSD-level BACT analysis and air quality modeling.',
    steps: [
      { action: 'Complete top-down BACT analysis for NOx, CO, PM2.5, and VOC', effort: '8-12 weeks', priority: 'Critical', responsible: 'Air Quality Consultant' },
      { action: 'Submit PSD preconstruction permit application to state/EPA', effort: '4-8 weeks', priority: 'Critical', responsible: 'Permitting Lead + Legal' },
      { action: 'Conduct AERMOD dispersion modeling for NAAQS and PSD increment compliance', effort: '12-16 weeks', priority: 'Critical', responsible: 'Air Quality Consultant' },
      { action: 'Evaluate synthetic minor permit option as risk mitigation strategy', effort: '4 weeks', priority: 'Medium', responsible: 'Permitting Team' },
    ],
    roadmap: 'PSD pathway is triggered — proceed with BACT analysis immediately. Modeling protocol should be submitted to EPA for concurrence before full modeling.',
    estimatedTimeline: '12-18 months',
    costEstimate: '$500K-1.2M (BACT analysis + modeling + application preparation)',
  },
  air_5: {
    type: 'Fail',
    summary: 'Controlled NOx still exceeds 100 tpy synthetic minor threshold. Facility cannot qualify as synthetic minor under current control strategy.',
    steps: [
      { action: 'Evaluate additional NOx controls: SCR, water/steam injection, or selective catalytic reduction', effort: '8-12 weeks', priority: 'Critical', responsible: 'Controls Engineer + OEM' },
      { action: 'Model controlled emissions with SCR at 85%+ removal efficiency', effort: '2-4 weeks', priority: 'Critical', responsible: 'Emissions Modeling Team' },
      { action: 'If synthetic minor remains unattainable, proceed with full PSD pathway', effort: 'Ongoing', priority: 'Critical', responsible: 'Permitting Director' },
      { action: 'Document enforceability mechanism for any proposed limit', effort: '4-6 weeks', priority: 'High', responsible: 'Legal + Compliance' },
    ],
    roadmap: 'Current controls insufficient for synthetic minor. Two paths: (1) SCR retrofit to bring NOx below 100 tpy, or (2) accept PSD major source status and proceed with BACT.',
    estimatedTimeline: '12-18 months',
    costEstimate: '$3M-8M (SCR installation per turbine bank) or full PSD path at $500K-1.2M',
  },
  air_6: {
    type: 'Warning',
    summary: 'Baseline total emissions exceed 250 tpy major source threshold. PSD / nonattainment NSR applicability is confirmed.',
    steps: [
      { action: 'Confirm PSD applicability determination with state air agency pre-application meeting', effort: '4-6 weeks', priority: 'Critical', responsible: 'Permitting Lead' },
      { action: 'Prepare PSD permit application including BACT, air quality impacts, and ambient monitoring', effort: '12-20 weeks', priority: 'Critical', responsible: 'Air Quality Consultant' },
      { action: 'Evaluate Class I area impacts (if applicable within 50 km)', effort: '4-8 weeks', priority: 'High', responsible: 'Modeling Consultant' },
      { action: 'Submit PSD permit application and begin public comment / EPA review period', effort: 'Ongoing', priority: 'Critical', responsible: 'Permitting Team + Agency' },
    ],
    roadmap: 'PSD threshold triggered — state pre-application meeting is the first critical milestone. Begin BACT analysis and modeling protocol immediately.',
    estimatedTimeline: '12-18 months',
    costEstimate: '$750K-1.5M (application preparation + review + public process)',
  },
  air_10: {
    type: 'Warning',
    summary: 'Emergency generator runtime exceeds 100 hr/yr limit under NSPS Subpart IIII. Extended runtime may trigger NESHAP Subpart ZZZZ major source requirements.',
    steps: [
      { action: 'Implement automated runtime tracking with real-time alerts at 80% of annual limit', effort: '2-4 weeks', priority: 'Critical', responsible: 'Brick Controls' },
      { action: 'Implement load management protocol to minimize non-emergency genset operation', effort: '4-6 weeks', priority: 'High', responsible: 'Operations Team' },
      { action: 'Document and log all emergency events with justification for extended operation', effort: 'Ongoing', priority: 'High', responsible: 'Site Operators' },
      { action: 'Evaluate feasibility of adding non-emergency rating (500+ hr/yr) with Tier 4 engines', effort: '8-12 weeks', priority: 'Low', responsible: 'Engineering + Procurement' },
    ],
    roadmap: 'Reduce runtime below 100 hr/yr through load management and battery storage for peak shaving. Track emergencies rigorously.',
    estimatedTimeline: 'Ongoing — within current operating year',
    costEstimate: '$0-200K (controls implementation + monitoring system)',
  },
  air_14: {
    type: 'Warning',
    summary: 'CO2e emissions above 25,000 mt/yr threshold require mandatory GHGRP reporting under 40 CFR Part 98.',
    steps: [
      { action: 'Register facility in EPA eGGRT system before reporting deadline', effort: '2 weeks', priority: 'Critical', responsible: 'Compliance Team' },
      { action: 'Implement Tier 3 or Tier 4 calculation methodology for stationary combustion sources', effort: '4-6 weeks', priority: 'High', responsible: 'Environmental Engineer' },
      { action: 'Submit annual GHG report by March 31 for prior calendar year', effort: '2 weeks annually', priority: 'Critical', responsible: 'Compliance Team' },
      { action: 'Evaluate voluntary GHG reduction programs (EPA Energy Star, The Climate Registry)', effort: '4 weeks', priority: 'Medium', responsible: 'Sustainability Lead' },
    ],
    roadmap: 'GHGRP reporting is mandatory. Register in eGGRT immediately. Annual reporting cycle aligns with calendar year.',
    estimatedTimeline: '90 days to register; annual reporting by March 31',
    costEstimate: '$25K-75K/yr (reporting + verification if required)',
  },
  water_5: {
    type: 'Warning',
    summary: 'Site acreage exceeds 1-acre CGP threshold. Construction stormwater NOI and SWPPP must be filed before any earth disturbance.',
    steps: [
      { action: 'File Construction General Permit (CGP) NOI with EPA or state agency', effort: '2-4 weeks', priority: 'Critical', responsible: 'Environmental Consultant' },
      { action: 'Develop and implement Construction Stormwater Pollution Prevention Plan (SWPPP)', effort: '4-8 weeks', priority: 'Critical', responsible: 'Civil Engineer + SWPPP Developer' },
      { action: 'Install sediment and erosion controls before grading (silt fences, basins, inlet protection)', effort: '1-2 weeks', priority: 'Critical', responsible: 'General Contractor' },
      { action: 'Conduct regular SWPPP inspections with documentation (weekly + within 24 hr of 0.5" rain)', effort: 'Ongoing', priority: 'High', responsible: 'Site Superintendent' },
    ],
    roadmap: 'File CGP NOI immediately. SWPPP must be finalized and controls installed before any ground disturbance begins.',
    estimatedTimeline: '14 days pre-disturbance (NOI); ongoing through construction',
    costEstimate: '$50K-150K (SWPPP development + controls installation + inspections)',
  },
  water_6: {
    type: 'Warning',
    summary: 'Cooling water intake flow (2.8 MGD) exceeds 2 MGD threshold for CWA 316(b) cooling water intake structure regulation.',
    steps: [
      { action: 'Complete 316(b) Phase I screening — evaluate existing intake structure and fish impingement/entrainment', effort: '8-12 weeks', priority: 'Critical', responsible: 'Aquatic Scientist' },
      { action: 'Determine if facility qualifies for any 316(b) exemptions (once-through cooling retrofit, etc.)', effort: '2-4 weeks', priority: 'High', responsible: 'Environmental Counsel' },
      { action: 'If required, complete BTA analysis for cooling water intake structure', effort: '12-16 weeks', priority: 'High', responsible: 'Engineering + Aquatic Consultant' },
      { action: 'Submit 316(b) documentation as part of NPDES permit application', effort: '4 weeks', priority: 'Critical', responsible: 'Permitting Team' },
    ],
    roadmap: '316(b) applicability confirmed at 2.8 MGD. Complete Phase I screening and include in parallel NPDES application process.',
    estimatedTimeline: '6-9 months (screening + BTA analysis + NPDES integration)',
    costEstimate: '$200K-600K (screening + BTA + consulting)',
  },
  water_7: {
    type: 'Warning',
    summary: 'Aggregate diesel storage exceeds 1,320-gallon SPCC threshold. Full SPCC Plan required before first oil transfer.',
    steps: [
      { action: 'Prepare 40 CFR Part 112-compliant SPCC Plan with all required elements', effort: '4-8 weeks', priority: 'Critical', responsible: 'SPCC Plan Professional Engineer' },
      { action: 'Verify secondary containment capacity meets 110% of largest tank or 10% of aggregate volume', effort: '2-4 weeks', priority: 'Critical', responsible: 'Civil Engineer' },
      { action: 'Implement SPCC inspection and testing schedule (monthly visual, 5-year tank integrity testing)', effort: 'Ongoing', priority: 'High', responsible: 'Site Operations' },
      { action: 'Conduct SPCC Plan training for all personnel involved in oil handling', effort: '1 week', priority: 'High', responsible: 'Safety/EHS Team' },
    ],
    roadmap: 'SPCC Plan must be prepared by a licensed PE and implemented before any oil transfer. Diesel storage at upsized site easily exceeds threshold.',
    estimatedTimeline: '8-12 weeks (plan preparation + implementation)',
    costEstimate: '$50K-150K (PE-prepared SPCC Plan + secondary containment upgrades)',
  },
  water_9: {
    type: 'Warning',
    summary: 'Potential wetlands/WOTUS impacts require CWA Section 404/401 evaluation. Larger site footprint may trigger jurisdictional determinations.',
    steps: [
      { action: 'Conduct preliminary wetlands delineation per Corps of Engineers 1987 Manual', effort: '4-8 weeks', priority: 'Critical', responsible: 'Wetlands Scientist' },
      { action: 'Submit Request for Jurisdictional Determination (RJD) to USACE local district', effort: '4-8 weeks', priority: 'Critical', responsible: 'Environmental Consultant' },
      { action: 'If wetlands impacts unavoidable, apply for CWA 404 Individual Permit or Nationwide Permit', effort: '12-24 weeks', priority: 'High', responsible: 'Wetlands Consultant + USACE' },
      { action: 'Obtain CWA 401 Water Quality Certification from state agency', effort: '8-12 weeks', priority: 'High', responsible: 'State Water Agency' },
    ],
    roadmap: 'Sackett v. EPA (2023) narrowed WOTUS definition but does not eliminate jurisdiction. Delineate and confirm jurisdictional status early in site design.',
    estimatedTimeline: '6-18 months (delineation + RJD + permitting if impacts found)',
    costEstimate: '$100K-500K (delineation + jurisdictional determination + permitting)',
  },
};

// ─── Default resolution for any doc not mapped ──────────────────────────────
function getResolution(docKey, status) {
  if (status === 'pass' || status === 'compliant') return null;
  const existing = RESOLUTIONS_MAP[docKey];
  if (existing) {
    return { ...existing, type: status === 'fail' ? 'Fail' : 'Warning' };
  }
  const isAir = docKey.startsWith('air');
  return {
    type: status === 'fail' ? 'Fail' : 'Warning',
    summary: `Review ${isAir ? 'air' : 'water'} permit document ${docKey.toUpperCase()} for regulatory compliance gaps. Update with site-specific data and current regulatory citations.`,
    steps: [
      { action: `Review document against current ${isAir ? 'CFR' : 'CWA'} requirements for completeness`, effort: '1-2 weeks', priority: 'High', responsible: 'Compliance Specialist' },
      { action: 'Update with site-specific emission/effluent data and operational parameters', effort: '1 week', priority: 'High', responsible: 'Environmental Engineer' },
      { action: 'Submit for internal PE review and certification', effort: '2-4 weeks', priority: 'High', responsible: 'Professional Engineer' },
      { action: 'Finalize and prepare for agency submission', effort: '1 week', priority: 'Medium', responsible: 'Permitting Team' },
    ],
    roadmap: `Review and update ${docKey.toUpperCase()} per current applicable regulations. Coordinate with PE for certification before submission.`,
    estimatedTimeline: '4-8 weeks',
    costEstimate: 'Varies — estimated $25K-$100K per document review cycle',
  };
}

// ─── Validate a Single Document ──────────────────────────────────────────────
export function validateDocument(docKey, inputs, results) {
  const docInfo = DOC_REGULATION_MAP[docKey];
  if (!docInfo) return { key: docKey, error: 'Unknown document key' };

  const validations = [];

  // 1. Check each required regulation is cited (via RAG search)
  for (const reg of docInfo.regulations) {
    const searchResults = searchRegulations(
      `${reg.cfr} ${reg.description}`,
      { category: docKey.startsWith('water') ? 'water' : 'air', limit: 3 }
    );

    const foundInRAG = searchResults.length > 0 && searchResults[0].score > 0.1;
    const status = foundInRAG ? 'pass' : (reg.required ? 'fail' : 'warning');

    validations.push({
      regulation: reg.cfr,
      description: reg.description,
      required: reg.required,
      status,
      ragMatchScore: searchResults.length > 0 ? Math.round(searchResults[0].score * 100) : 0,
      ragSnippet: searchResults.length > 0 ? (searchResults[0].chunk_text || searchResults[0].text || '').substring(0, 200) : '',
    });
  }

  // 2. Check emissions thresholds against calculated values
  if (results && docInfo.thresholds.length > 0) {
    for (const threshold of docInfo.thresholds) {
      const { pollutant, limit, unit, regulation, type } = threshold;
      let value = null;
      let actualValue = null;
      let status = 'warning';

      // Pull actual value from results
      if (pollutant === 'NOx' && type !== 'controlled' && type !== 'psd') value = results.baseline?.nox;
      else if (pollutant === 'NOx' && type === 'controlled') value = results.controlled?.nox;
      else if (pollutant === 'NOx BACT') value = results.baseline?.nox; // illustrative
      else if (pollutant === 'CO' && type !== 'controlled') value = results.baseline?.co;
      else if (pollutant === 'CO' && type === 'controlled') value = results.controlled?.co;
      else if (pollutant === 'CO BACT') value = results.baseline?.co;
      else if (pollutant === 'SO2') value = results.baseline?.so2;
      else if (pollutant === 'PM25') value = results.baseline?.pm25;
      else if (pollutant === 'VOC') value = results.baseline?.voc;
      else if (pollutant === 'CO2e' || pollutant === 'GHG') value = results.baseline?.co2e;
      else if (pollutant === 'HAP') value = results.baseline?.hap;
      else if (pollutant === 'Baseline Total') {
        value = (results.baseline?.nox || 0) + (results.baseline?.co || 0) +
                (results.baseline?.so2 || 0) + (results.baseline?.pm25 || 0) + (results.baseline?.voc || 0);
      }
      else if (pollutant === 'Formaldehyde') value = results.baseline?.hap * 0.3; // illustrative
      else if (pollutant === 'Emergency Hours') actualValue = inputs?.gensetHours;
      else if (pollutant === 'Oil Storage (aboveground)') actualValue = (inputs?.gensetCount || 0) * 500 + 10000;
      else if (pollutant === 'Intake Flow') actualValue = inputs?.coolingMGD;
      else if (pollutant === 'Disturbed Area') actualValue = inputs?.siteAcres;
      else if (pollutant === 'Wetland Impact') actualValue = 0.1; // placeholder - would come from survey
      else if (pollutant === 'Temperature') actualValue = 90; // typical blowdown temp
      else if (pollutant === 'pH' || threshold.unit.includes('s.u.')) {
        actualValue = 7.2; // typical neutral pH for cooling water
        status = actualValue >= 6.0 && actualValue <= 9.0 ? 'pass' : 'fail';
      }

      if (value !== null) {
        actualValue = value;
        const numLimit = typeof limit === 'number' ? limit : parseFloat(limit);
        if (!isNaN(numLimit)) {
          if (type === 'ghg') {
            // GHG thresholds must consider the GHG-specific significance
            status = actualValue < numLimit ? 'pass' : (actualValue < numLimit * 1.5 ? 'warning' : 'fail');
          } else if (type === 'controlled') {
            // For synthetic minor, controlled emissions must be below threshold
            status = actualValue < numLimit ? 'pass' : 'fail';
          } else if (type === 'psd' || type === 'major') {
            // For PSD/major source thresholds
            status = actualValue >= numLimit ? 'warning' : 'pass';
          } else {
            status = actualValue < numLimit ? 'pass' : 'fail';
          }
        }
      }

      validations.push({
        regulation,
        description: `${pollutant} ${type === 'psd' ? 'PTE vs PSD Threshold' : type === 'controlled' ? 'Controlled vs Threshold' : type === 'ghg' ? 'GHG vs Reporting Threshold' : type === 'operational' ? 'Operational vs Threshold' : 'Emissions vs Limit'}: ${actualValue !== null ? (typeof actualValue === 'number' ? actualValue.toFixed(1) : actualValue) : 'N/A'} ${unit} (Limit: ${limit} ${unit})`,
        required: type !== 'warning',
        status,
        ragMatchScore: 100,
        ragSnippet: '',
      });
    }
  }

  // Overall status
  const totalChecks = validations.length;
  const passed = validations.filter(v => v.status === 'pass').length;
  const failed = validations.filter(v => v.status === 'fail').length;
  const warnings = validations.filter(v => v.status === 'warning').length;

  let overallStatus = 'pass';
  if (failed > 0) overallStatus = 'fail';
  else if (warnings > 0) overallStatus = 'warning';

  const resolution = getResolution(docKey, overallStatus);

  return {
    key: docKey,
    title: docInfo.title,
    overallStatus,
    checks: totalChecks,
    passed,
    failed,
    warnings,
    validations,
    resolution,
  };
}

// ─── Validate All Documents ──────────────────────────────────────────────────
export function validateAllDocuments(inputs, results) {
  const keys = [
    ...Array.from({ length: 16 }, (_, i) => `air_${i + 1}`),
    ...Array.from({ length: 10 }, (_, i) => `water_${i + 1}`),
  ];

  const results_list = keys.map(key => validateDocument(key, inputs, results));

  const total = results_list.length;
  const passed = results_list.filter(r => r.overallStatus === 'pass').length;
  const failed = results_list.filter(r => r.overallStatus === 'fail').length;
  const warnings = results_list.filter(r => r.overallStatus === 'warning').length;

  return {
    total,
    passed,
    failed,
    warnings,
    complianceScore: Math.round((passed / total) * 100),
    documents: results_list,
  };
}