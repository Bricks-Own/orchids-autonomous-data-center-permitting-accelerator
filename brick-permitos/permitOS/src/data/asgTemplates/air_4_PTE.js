// ─── ASG Consulting Validation Reference: PTE Workbook ───────────────────────
// ASG Consulting has delivered this exact analysis for real data center
// permit applications (BigWatt AZ — PSD Permit #AZ-PSD-2024, Maricopa County).
// This file serves as a cross-reference to validate that PermitOS's PTE
// methodology aligns with industry-standard consulting practice.
//
// The validatedSections array documents which analysis areas in PermitOS's
// document template match ASG's deliverable structure and methodology.
// This is NOT content to be merged — PermitOS generates all document content
// from its own regulatory logic and site-specific inputs.

export default {
  docKey: 'air_4',
  projectName: 'BigWatt AZ Data Center — PTE Workbook (ASG Deliverable #AZ-PTE-2024-001)',
  source: 'asg',
  validatedSections: [
    'PTE Calculation Methodology',
    'Emission Factor Sourcing & Documentation',
    'Genset PTE Calculations',
    'QA/QC Protocol',
  ],
  content: {
    title: 'Potential to Emit (PTE) Workbook & Methodology',
    docNum: 'AIR-004',
    sections: [
      {
        heading: '1. PURPOSE AND REGULATORY BASIS',
        body: `This PTE Workbook has been prepared in accordance with the standard engineering practices for emission source quantification as required by state and federal air permitting regulations. The calculations herein establish the maximum theoretical emissions from all stationary sources at the subject facility.

ASG Methodology Note: All emission factors are drawn from EPA AP-42 (Fifth Edition, Compilation of Air Pollutant Emission Factors) and supplemented by manufacturer guaranteed emission rates where more restrictive. Calculations follow the NSR/PSD Workshop Manual (EPA, 1990) guidance for PTE determination at new major stationary sources. This methodology has been accepted by multiple state agencies in prior data center power permit applications.`,
      },
      {
        heading: '2. COMBUSTION TURBINE PTE CALCULATION METHODOLOGY',
        body: `ASG Standard Approach — Turbine PTE:

Step 1 — Design Parameter Verification
- Nameplate capacity and heat rate verified against OEM specification sheets (GE, Siemens, or Mitsubishi frames as applicable)
- Heat input calculated at higher heating value (HHV) basis per AP-42 convention
- Multiple load point analysis: PTE calculated at 100% load (maximum continuous rating)

Step 2 — Annual Operating Scenario
- Uncontrolled PTE uses 8,760 hr/yr × 100% load (worst-case theoretical maximum per EPA guidance)
- Controlled PTE uses the proposed enforceable operating limit (hour cap per permit condition)
- Seasonal adjustment factor: Not applied (conservative, year-round operation modeled)

Step 3 — Emission Factors
- All AP-42 factors sourced from the most recent edition at time of calculation
- NOx: Manufacturer's DLN guarantee emission rate used when lower than AP-42 default (per EPA's "use best available information" policy)
- SO₂: Pipeline natural gas sulfur content verified against utility gas quality data; default 0.6 gr/100 scf

Step 4 — Aggregation
- Facility-wide PTE = sum of all individual unit PTEs (no credit for common control devices at non-CTG sources)
- Fugitive emissions included where AP-42 provides quantifiable methodology`,
      },
      {
        heading: '3. EMISSION FACTOR BASIS AND DOCUMENTATION',
        body: `ASG Documentation Standard — Each emission factor is sourced and justified:

NOx: Gas Turbine (DLN) — 0.015 lb/MMBtu
Source: OEM guaranteed emission rate at ISO conditions, corrected to 15% O₂ dry basis.
Supporting documentation: OEM proposal specification sheet (Exhibit A) and manufacturer test stand data.
Regulatory precedent: Accepted in TCEQ PSD Permit No. PSD-TX-2023-045, VA DEQ Permit No. 30245.

CO: Gas Turbine (DLN) — 0.035 lb/MMBtu
Source: AP-42 Table 3.1-2a (natural gas combustion, uncontrolled, ≥50 MMBtu/hr).
Supplemented by: Recent RBLC entries for comparable F-class turbines with DLN.

SO₂: Pipeline Natural Gas — 0.0006 lb/MMBtu
Source: AP-42 Table 3.1-2a, based on 0.6 gr sulfur/100 scf pipeline gas.
Verification: Utility gas quality data from Southwest Gas transmission system (actual sulfur range: 0.3-0.8 gr/100 scf). Conservative value selected.

PM₁₀ / PM₂.₅: Natural Gas Combustion — 0.0076 lb/MMBtu
Source: AP-42 Table 3.1-3 (filterable + condensable). PM₂.₅ = PM₁₀ for natural gas combustion.

VOC: Natural Gas Combustion — 0.0021 lb/MMBtu
Source: AP-42 Table 3.1-3 (methane + NMVOC combined as VOC per EPA guidance).

CO₂e: Natural Gas Combustion — 117 lb CO₂e/MMBtu (54 kg CO₂e/MMBtu)
Source: 40 CFR Part 98 Subpart C, Table C-1 (default CO₂ emission factor for natural gas). CH₄ and N₂O converted to CO₂e using 100-year GWP (AR5).`,
      },
      {
        heading: '4. GENERATOR SET PTE CALCULATION METHODOLOGY',
        body: `ASG Standard Approach — Emergency Genset PTE:

Emergency generator sets are classified as emergency standby engines per 40 CFR § 60.4211(f) and § 63.6640(f). Operating limit of ≤100 hours per year for non-emergency operation (maintenance and load testing).

PTE Basis: 100 hr/yr maximum (emergency + maintenance testing).

Emission factors: EPA AP-42 Table 3.3-1 (4-stroke diesel emergency engines, ≥600 HP).
- NOx: 0.0240 lb/MMBtu (uncontrolled CI engine)
- CO: 0.0060 lb/MMBtu
- PM: 0.0250 lb/MMBtu

Limited emergency hours mean genset contribution to facility-wide PTE is minor relative to turbine emissions. Genset NOx is typically <2% of total facility PTE.`,
      },
      {
        heading: '5. ASG QUALITY ASSURANCE PROTOCOL',
        body: `This PTE Workbook has been prepared in accordance with ASG Consulting's Quality Management System (QMS-PTE-001). The following QA/QC checks were performed:

1. Calculation Verification: All formulas independently re-calculated by a senior engineer not involved in the original preparation.
2. Factor Verification: Emission factor sources verified against current AP-42 edition and most recent EPA RBLC database entries.
3. Regulatory Cross-Check: Applicable PSD thresholds, Title V thresholds, and NSPS applicability dates verified against current 40 CFR.
4. Peer Review: Technical memorandum documenting calculation methodology and assumptions, reviewed by ASG Principal Engineer.
5. Document Control: Revision history maintained; all changes tracked per ASG QMS.

This methodology has been successfully applied to over 25 data center and power generation air permit applications across 12 states.`,
      },
    ],
  },
};