// ─── State Form Registry ──────────────────────────────────────────────────────
// Master mapping of state-specific form requirements, document overrides,
// and per-state formatting rules for the Brick PermitOS Document Factory.
// Used by formConverter.js at generation time.

// Form format keys — defines which template structure to use per document
export const FORM_FORMATS = {
  generic_state: 'Generic state air permit application format',
  tceq_state: 'Texas TCEQ Form OP-UA / OP-NA — state-specific air permit forms',
  va_state: 'Virginia DEQ Air Permit Application — Form AP-1',
  ca_state: 'California CARB/Local District — District-specific application forms',
  ohio_state: 'Ohio EPA DAPC — Permit-to-Install (PTI) Application',
  georgia_state: 'Georgia EPD — Air Quality Permit Application Form',
  arizona_state: 'ADEQ Air Quality Permit Application',
  ny_state: 'NYSDEC Air Title V / State Facility Permit Application',
  florida_state: 'FDEP Air Construction Permit Application (Form 62-210)',
};

// State-specific section overrides — content that replaces or augments
// standard document sections for specific state regulatory requirements.
// Indexed by state > docKey > heading to match and override.
export const STATE_SECTION_OVERRIDES = {
  'Texas': {
    // Texas-specific certifications to append to applicable documents
    _certifications: {
      air: `TCEQ Certification: This application is submitted pursuant to 30 TAC Chapter 116 and constitutes an application for a Preconstruction Permit (Permit by Rule / Standard Permit / PSD Permit). Permittee acknowledges the continuing duty to comply with all applicable TCEQ rules.

Texas-specific requirements: (a) All emissions calculations use TCEQ-approved emission factors or site-specific stack test data; (b) A public notice mailing list of all property owners within 1/4 mile of the site boundary shall be maintained; (c) Permit application fee schedule per 30 TAC § 116.21 applies; (d) HGB (Houston-Galveston-Brazoria) area requirements evaluated if applicable.`,
      water: `Texas NPDES: This application is submitted to TCEQ under the Texas Pollutant Discharge Elimination System (TPDES) pursuant to Texas Water Code § 26. TPDES General Permit TXR050000 applies to stormwater discharges associated with industrial activity unless otherwise specified.`,
    },
  },
  'California': {
    _certifications: {
      air: `California Certification: This application acknowledges the requirements of the California Environmental Quality Act (CEQA). A CEQA lead agency determination is required before permit action. This project is subject to the applicable local air district's New Source Review (NSR) rules, which may be more stringent than federal PSD requirements.

California-specific requirements: (a) Best Available Control Technology (BACT) determination per California NSR; (b) Air Quality Impact Analysis (AQIA) demonstrating compliance with California ambient air quality standards; (c) Health Risk Assessment (HRA) if toxic air contaminants exceed significance thresholds; (d) GHG analysis per CARB Scoping Plan and local district rules; (e) Public notice and hearing per district rules.`,
      water: `California Water: This application is submitted to the State Water Resources Control Board (SWRCB) or applicable Regional Water Quality Control Board (RWQCB). The facility is subject to the California Ocean Plan / Inland Surface Waters Plan (as applicable) and Regional Board Basin Plan. Waste Discharge Requirements (WDRs) may apply in addition to NPDES permit conditions.`,
    },
  },
  'Virginia': {
    _certifications: {
      air: `Virginia Certification: This application is submitted to the Virginia Department of Environmental Quality (DEQ) pursuant to the Virginia Air Pollution Control Law and Regulations (9 VAC 5). Northern Virginia Regional Office will review if the facility is located in Northern VA.

Virginia-specific requirements: (a) Virginia Environmental Excellence Program (VEEP) participation available for qualifying facilities; (b) Permittee shall comply with the Virginia State Implementation Plan (SIP); (c) Virtual Case File (VCF) system used for electronic submission; (d) NESHAP compliance verified independently through VA DEQ.`,
      water: `Virginia Water: This application is submitted to VA DEQ under the Virginia Pollutant Discharge Elimination System (VPDES) Program (Code of Virginia § 62.1-44.15). VPDES is the Virginia equivalent of NPDES program.`,
    },
  },
};

// State-specific document replacement mappings
// Some states require different document structures for specific permit types.
// Key: state -> docKey -> { format: string, description: string }
export const STATE_DOC_REPLACEMENTS = {
  'Texas': {
    'air_6': { format: 'tceq_psd_applicability', description: 'TCEQ PSD Applicability Determination (30 TAC 116)' },
    'air_5': { format: 'tceq_synthetic_minor', description: 'TCEQ Synthetic Minor Permit by Rule Analysis' },
  },
  'California': {
    'air_16': { format: 'ca_ej_ceqa', description: 'CEQA Environmental Justice Analysis (Public Resources Code § 21000 et seq.)' },
    'air_14': { format: 'ca_ghg_carb', description: 'CARB GHG Reporting (MRR Regulation) — more stringent than federal GHGRP' },
  },
};

// State-specific submission requirements
export const STATE_SUBMISSION_REQUIREMENTS = {
  'Texas': {
    requiredForms: ['TCEQ Form OP-UA (Air Permit Application)', 'TCEQ Fee Calculation Sheet', 'TCEQ Emissions Inventory Form'],
    electronicSubmission: 'STEERS portal — all documents uploaded as PDF with XML metadata file',
    feeSchedule: 'Based on PTE emission rates per 30 TAC § 116.21',
    timeline: 'Standard permit 90–180 days; PSD permit 12–18 months',
  },
  'California': {
    requiredForms: ['District-specific application form (SCAQMD/BAAQMD/SDAPCD etc.)', 'CEQA Environmental Checklist or EIR'],
    electronicSubmission: 'CalEPA Portal or district-specific e-filing system',
    feeSchedule: 'Per local air district fee schedule; CARB annual fees apply',
    timeline: '12–24 months including CEQA review (EIR path)',
  },
  'Virginia': {
    requiredForms: ['VA DEQ AP-1 (Air Permit Application Form)', 'VA DEQ Emissions Inventory Form', 'Minor NSR / Major NSR / Title V per applicability'],
    electronicSubmission: 'VA DEQ Virtual Case File (VCF) — electronic submission mandatory',
    feeSchedule: 'Per 9 VAC 5-80-250 (application fee + annual emission fee)',
    timeline: 'Minor NSR: 60–120 days; PSD: 12–18 months',
  },
  'Ohio': {
    requiredForms: ['Ohio EPA Permit-to-Install (PTI) Application', 'Ohio EPA Emission Fee Statement'],
    electronicSubmission: 'Ohio EPA eBusiness Center — online submission',
    feeSchedule: 'OAC 3745-79-02 (application fee schedule based on potential emissions)',
    timeline: 'PTI: 90–180 days; PSD: 12–18 months',
  },
  'Georgia': {
    requiredForms: ['GA EPD Air Quality Permit Application', 'GA EPD Annual Emission Statement'],
    electronicSubmission: 'Georgia EPD Online System (GEOS)',
    feeSchedule: 'Per GA Rules 391-3-1-.04',
    timeline: 'Standard permit: 60–120 days; PSD: 12–18 months',
  },
};

export function getStateOverrides(state) {
  return STATE_SECTION_OVERRIDES[state] || null;
}

export function getStateDocReplacement(state, docKey) {
  const stateRepl = STATE_DOC_REPLACEMENTS[state];
  if (!stateRepl) return null;
  return stateRepl[docKey] || null;
}

export function getStateSubmissionRequirements(state) {
  return STATE_SUBMISSION_REQUIREMENTS[state] || null;
}