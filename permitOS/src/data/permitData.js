// ─── CFR / Regulatory Catalog ────────────────────────────────────────────────
export const AIR_MODULES = [
  {
    id: 'nsr_psd',
    name: 'NSR / PSD Applicability',
    citations: ['CAA § 165 NSR/PSD', '40 CFR Part 51 / 52 PSD Implementation'],
    deliverables: ['PSD/NSR Applicability Memo', 'Synthetic Minor / Enforceable Limit Memo', 'Preconstruction Permit Application'],
    threshold: { nox_tpy: 100, applicable: true },
    aiAcceleration: '75% faster than manual — auto-populates site data, classifies attainment status, and compiles memo in minutes.',
    weeks: [1, 3],
  },
  {
    id: 'subpart_kkkk',
    name: 'Stationary Combustion Turbines — NSPS',
    citations: ['40 CFR Part 60 Subpart KKKK', '40 CFR Part 60 Subpart KKKKa (post-2006 turbines)'],
    deliverables: ['NSPS Turbine Applicability Memo', 'NOx/CO/SO₂ Compliance Matrix', 'Monitoring & Recordkeeping Plan', 'Initial Performance Test Protocol'],
    aiAcceleration: 'Auto-maps turbine make/model to Subpart KKKK/KKKKa requirements and generates unit-specific compliance matrices.',
    weeks: [2, 4],
  },
  {
    id: 'subpart_yyyy',
    name: 'Stationary Combustion Turbines — NESHAP',
    citations: ['40 CFR Part 63 Subpart YYYY (major HAP sources)'],
    deliverables: ['NESHAP YYYY Applicability Memo', 'Initial/Continuous Compliance Plan', 'HAP Emissions Methodology', 'Semi-Annual Compliance Report Template'],
    aiAcceleration: 'Determines HAP major source threshold applicability in real time from fuel composition and turbine specs.',
    weeks: [2, 4],
  },
  {
    id: 'backup_engines',
    name: 'Backup Engines / Emergency Gensets',
    citations: ['40 CFR Part 60 Subpart IIII (CI engines)', '40 CFR Part 60 Subpart JJJJ (SI engines)', '40 CFR Part 63 Subpart ZZZZ (RICE NESHAP)'],
    deliverables: ['Engine Rule Applicability Matrix', 'Emergency / Non-Emergency Runtime Log Design', 'Maintenance & Fuel Records Plan', '100-hr/yr Limit Tracking System'],
    aiAcceleration: 'Classifies each genset by engine type, horsepower, and use classification. Generates runtime log templates automatically.',
    weeks: [2, 5],
  },
  {
    id: 'aermod',
    name: 'Air Dispersion Modeling (AERMOD)',
    citations: ['EPA Guideline on Air Quality Models (40 CFR Part 51 App W)', 'AERMOD Modeling System', 'NAAQS / PSD Increment Analysis'],
    deliverables: ['Modeling Protocol', 'AERMOD Input File Builder', 'Receptor / Grid Definition', 'NAAQS & PSD Increment Impact Report', 'Modeling Results Summary'],
    aiAcceleration: 'Retrieves NWS met data, builds receptor grids from site coordinates, and prepares AERMOD input files. Reduces 6-week manual effort to 5 days.',
    weeks: [4, 8],
  },
  {
    id: 'bact_laer',
    name: 'BACT / LAER Technology Review',
    citations: ['PSD BACT (CAA § 165)', 'Nonattainment NSR LAER (CAA § 173)', 'EPA RBLC Database'],
    deliverables: ['Top-Down BACT Analysis', 'LAER / Offsets Strategy', 'SCR / Oxidation Catalyst / DLN Evaluation', 'BACT/LAER Determination Memo'],
    aiAcceleration: 'Cross-references EPA RBLC database, benchmarks against recent permit decisions, and prepares top-down analysis with site-specific economics.',
    weeks: [3, 6],
  },
  {
    id: 'title_v',
    name: 'Title V / Ongoing Operating Permit',
    citations: ['40 CFR Part 70 (State programs)', '40 CFR Part 71 (Federal program)', '40 CFR Part 64 CAM (if applicable)'],
    deliverables: ['Title V Application Draft', 'Compliance Assurance Monitoring Plan', 'Deviation / Exceedance Reporting Workflow', 'Annual Compliance Certification Template'],
    aiAcceleration: 'Auto-populates Title V forms from air permit record. Builds compliance calendar and automated deviation detection logic.',
    weeks: [8, 12],
  },
  {
    id: 'ghg',
    name: 'GHG / Greenhouse Gas Reporting',
    citations: ['40 CFR Part 98 (GHGRP)', 'EPA eGGRT Reporting System', 'State GHG rules where applicable'],
    deliverables: ['GHG Applicability Determination', 'GHG PTE Analysis', 'Decarbonization Roadmap', 'GHGRP Annual Report Template'],
    aiAcceleration: 'Calculates CO₂e from fuel consumption data and compiles GHGRP Subpart C report inputs automatically.',
    weeks: [5, 8],
  },
];

export const WATER_MODULES = [
  {
    id: 'npdes',
    name: 'NPDES Industrial Wastewater',
    citations: ['Clean Water Act § 402', '40 CFR Part 122', '40 CFR Part 124', '40 CFR Part 125'],
    deliverables: ['NPDES Applicability Memo', 'Outfall Inventory', 'Effluent Characterization Plan', 'Discharge Monitoring Report Template', 'Monitoring Plan'],
    aiAcceleration: 'Maps all potential discharge pathways from site plan. Determines individual vs. general permit pathway.',
    weeks: [2, 5],
  },
  {
    id: 'industrial_sw',
    name: 'Industrial Stormwater',
    citations: ['40 CFR 122.26', 'EPA Multi-Sector General Permit (MSGP)', 'State equivalent general permits'],
    deliverables: ['NOI (Notice of Intent)', 'SWPPP (Stormwater Pollution Prevention Plan)', 'BMP Matrix', 'Benchmark Monitoring Calendar', 'Annual Report Template'],
    aiAcceleration: 'Auto-classifies SIC code, determines MSGP sector, and drafts SWPPP with facility-specific BMPs from site layout.',
    weeks: [2, 4],
  },
  {
    id: 'construction_sw',
    name: 'Construction Stormwater',
    citations: ['NPDES Construction General Permit (CGP)', 'State CGP equivalents', '40 CFR 122.26(b)(14)(x)'],
    deliverables: ['Construction NOI', 'Erosion & Sediment Control Plan', 'SWPPP (Construction Phase)', 'Inspection Log Template', 'Rainfall Threshold Monitoring Plan'],
    aiAcceleration: 'Generates site-specific SWPPP with erosion control measures based on acreage, soils, and topography data.',
    weeks: [1, 3],
  },
  {
    id: 'cooling_316b',
    name: 'Cooling Water Intake — CWA 316(b)',
    citations: ['CWA § 316(b)', '40 CFR Part 125 Subpart J', 'EPA Phase II / Phase III Rules'],
    deliverables: ['316(b) Applicability Screen', 'Intake Flow Model', 'BTA / Impingement & Entrainment Package', 'Best Technology Available Evaluation'],
    aiAcceleration: 'Screens applicable flow thresholds against cooling system design and determines BTA pathway automatically.',
    weeks: [3, 6],
  },
  {
    id: 'spcc',
    name: 'SPCC — Fuel & Oil Storage',
    citations: ['40 CFR Part 112 (SPCC Rule)', 'CWA § 311', 'EPA SPCC Guidance for Regional Inspectors'],
    deliverables: ['SPCC Applicability Memo', 'Tank Inventory', 'Secondary Containment Calculation', 'Facility Diagram', 'SPCC Plan (PE-certified where required)'],
    aiAcceleration: 'Builds tank inventory from site data. Calculates secondary containment volumes. Generates PE-ready SPCC plan draft.',
    weeks: [3, 5],
  },
  {
    id: 'pretreatment',
    name: 'Pretreatment / POTW Discharge',
    citations: ['40 CFR Part 403 (General Pretreatment)', 'Local sewer authority / pretreatment rules', 'Cooling tower blowdown limits'],
    deliverables: ['POTW Discharge Questionnaire', 'Cooling Blowdown Characterization', 'Discharge Minimization Plan', 'Industrial User Survey'],
    aiAcceleration: 'Characterizes cooling tower blowdown chemistry from system parameters and compares to local POTW limits.',
    weeks: [3, 6],
  },
  {
    id: 'wetlands',
    name: 'Wetlands / Waters of the US',
    citations: ['CWA § 404 (Dredge & Fill)', 'CWA § 401 (State Water Quality Certification)', 'Sackett v. EPA (2023) WOTUS definition'],
    deliverables: ['Wetlands Screening Checklist', 'Jurisdictional Determination Support Packet', 'Avoidance / Minimization Memo', 'Section 404 / 401 Application (if required)'],
    aiAcceleration: 'Screens NWI maps and NRCS soils data against site coordinates. Flags JD triggers before field investigation.',
    weeks: [1, 4],
  },
  {
    id: 'water_reuse',
    name: 'Water Conservation / Reuse / ZLD',
    citations: ['State water conservation requirements', 'EPA WaterSense guidance', 'Local utility water use agreements'],
    deliverables: ['Water Balance Diagram', 'Reuse Feasibility Memo', 'Zero Liquid Discharge Analysis', 'Water Conservation Plan'],
    aiAcceleration: 'Models water balance in real time. Identifies reuse opportunities (cooling tower makeup, irrigation, process reuse).',
    weeks: [4, 8],
  },
];

export const OTHER_PERMITS = [
  { name: 'FAA / FCC Tower & Site Permits', agency: 'FAA / FCC', trigger: 'Stacks > 200 ft or within airport approach zones', weeks: [1, 6] },
  { name: 'NEPA Environmental Review', agency: 'Federal (if federal nexus)', trigger: 'Federal land, federal financing, or federal permits', weeks: [4, 24] },
  { name: 'State SEPA / CEQA equivalent', agency: 'State', trigger: 'Varies by state — major new facilities often required', weeks: [2, 16] },
  { name: 'Hazardous Materials (RCRA)', agency: 'EPA / State', trigger: 'Generator status from refrigerants, batteries, oils', weeks: [2, 6] },
  { name: 'Fire / Building / Electrical', agency: 'Local AHJ', trigger: 'All facilities — varies by jurisdiction', weeks: [4, 16] },
  { name: 'Zoning / Land Use', agency: 'Local', trigger: 'All facilities — data center / industrial zoning required', weeks: [4, 20] },
  { name: 'Noise / Vibration Ordinances', agency: 'Local / County', trigger: 'Cooling tower fans, generators, turbines near sensitive receptors', weeks: [3, 8] },
  { name: 'Utility Interconnection (gas / electric)', agency: 'Utility / ISO/RTO', trigger: 'All facilities with on-site generation', weeks: [12, 52] },
];

export const STATES_ATTAINMENT = {
  'Alabama': 'Attainment', 'Alaska': 'Attainment', 'Arizona': 'Mixed — Nonattainment (Ozone/PM) in Maricopa/Pinal',
  'Arkansas': 'Attainment', 'California': 'Mixed — Multiple nonattainment areas', 'Colorado': 'Mixed — Denver Metro nonattainment (Ozone)',
  'Connecticut': 'Mixed — Ozone nonattainment', 'Delaware': 'Mixed — Ozone nonattainment',
  'Florida': 'Attainment', 'Georgia': 'Mixed — Atlanta area historical nonattainment',
  'Idaho': 'Attainment', 'Illinois': 'Mixed — Chicago nonattainment (Ozone)',
  'Indiana': 'Attainment', 'Iowa': 'Attainment', 'Kansas': 'Attainment',
  'Kentucky': 'Attainment', 'Louisiana': 'Mixed — Select nonattainment areas',
  'Maine': 'Attainment', 'Maryland': 'Mixed — Ozone nonattainment',
  'Massachusetts': 'Mixed — Ozone nonattainment', 'Michigan': 'Mixed — Detroit nonattainment',
  'Minnesota': 'Attainment', 'Mississippi': 'Attainment', 'Missouri': 'Mixed — St. Louis nonattainment',
  'Montana': 'Attainment', 'Nebraska': 'Attainment', 'Nevada': 'Mixed — Las Vegas PM nonattainment',
  'New Hampshire': 'Mixed — Ozone nonattainment', 'New Jersey': 'Mixed — Ozone nonattainment',
  'New Mexico': 'Attainment', 'New York': 'Mixed — NYC/Long Island nonattainment',
  'North Carolina': 'Mixed — Charlotte area nonattainment', 'North Dakota': 'Attainment',
  'Ohio': 'Mixed — Cleveland/Columbus historical nonattainment', 'Oklahoma': 'Attainment',
  'Oregon': 'Mixed — Portland Metro PM nonattainment', 'Pennsylvania': 'Mixed — Philadelphia/Pittsburgh nonattainment',
  'Rhode Island': 'Mixed — Ozone nonattainment', 'South Carolina': 'Attainment',
  'South Dakota': 'Attainment', 'Tennessee': 'Attainment', 'Texas': 'Mixed — Dallas/Houston nonattainment (Ozone)',
  'Utah': 'Mixed — Salt Lake City PM2.5 nonattainment', 'Vermont': 'Attainment',
  'Virginia': 'Mixed — Northern VA nonattainment', 'Washington': 'Mixed — Puget Sound PM nonattainment',
  'West Virginia': 'Attainment', 'Wisconsin': 'Mixed — Milwaukee nonattainment', 'Wyoming': 'Attainment',
};

export const MILESTONE_PHASES = [
  { phase: 1, name: 'Site Intake & Data Collection', weeks: '1–2', color: 'bg-blue-500', tasks: ['Turbine / genset equipment data', 'Site plan, stack parameters, plot plan', 'Water balance inputs', 'Regulatory jurisdiction confirmation', 'Prior agency correspondence review', 'Regulatory profile generation'] },
  { phase: 2, name: 'Applicability Screening & PTE', weeks: '2–4', color: 'bg-violet-500', tasks: ['Air applicability (PSD/NSR/Title V thresholds)', 'CFR Subpart mapping (KKKK, YYYY, IIII/JJJJ, ZZZZ)', 'PTE workbook (baseline + controlled)', 'Synthetic minor / enforceable limits strategy', 'Water permit pathway determination', 'NPDES, SPCC, 316(b), wetlands screening'] },
  { phase: 3, name: 'Technical Analysis & Modeling', weeks: '4–8', color: 'bg-amber-500', tasks: ['BACT/LAER top-down analysis', 'AERMOD dispersion modeling', 'NAAQS & PSD increment impact assessment', 'Water balance and blowdown characterization', 'GHG PTE and GHGRP determination', 'Digital twin simulation calibration'] },
  { phase: 4, name: 'Document Generation & Assembly', weeks: '6–10', color: 'bg-green-500', tasks: ['Air permit application package (16 documents)', 'Water permit package (10 documents)', 'CFR compliance matrices', 'Monitoring/recordkeeping/reporting plan', 'SWPPP, SPCC Plan, NOIs', 'Public/EJ support package'] },
  { phase: 5, name: 'Agency Submission & Review Support', weeks: '10–16', color: 'bg-orange-500', tasks: ['One-click agency submission package', 'RAI response automation', 'Public comment support', 'Modeling comment responses', 'Deficiency letter management', 'Permit condition negotiation'] },
  { phase: 6, name: 'Permit Issuance & Compliance Activation', weeks: '16+', color: 'bg-red-500', tasks: ['Permit conditions → live control logic', 'Turbine runtime limiter activation', 'Emissions digital twin go-live', 'Water use monitoring activation', 'Automated compliance reporting', 'Regulator audit log system'] },
];

export const NOX_EMISSION_FACTORS = {
  'Gas Turbine (DLN, modern)': 0.015,
  'Gas Turbine (standard combustion)': 0.036,
  'Gas Turbine (older frame, uncontrolled)': 0.060,
  'Emergency Diesel Genset': 0.0240,
  'Emergency Gas Genset': 0.0110,
};

export const CO_EMISSION_FACTORS = {
  'Gas Turbine (DLN, modern)': 0.035,
  'Gas Turbine (standard combustion)': 0.082,
  'Gas Turbine (older frame, uncontrolled)': 0.120,
  'Emergency Diesel Genset': 0.0060,
  'Emergency Gas Genset': 0.0200,
};

export const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
  'Florida','Georgia','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana',
  'Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana',
  'Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina',
  'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina',
  'South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington',
  'West Virginia','Wisconsin','Wyoming'
];
