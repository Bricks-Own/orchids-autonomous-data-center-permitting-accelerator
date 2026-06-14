// ─── State-Specific Rules for Data Center Permitting ─────────────────────────
// Rules relevant to top data center states

export const STATE_RULES = [
  // ── Virginia ──
  {
    state: 'Virginia',
    category: 'air_permitting',
    rule_name: 'Virginia Air Pollution Control Law',
    rule_text: 'Virginia administers the State Air Pollution Control Board regulations under 9 VAC 5. The Virginia Department of Environmental Quality (DEQ) issues state preconstruction permits for stationary sources. Virginia is SIP-approved and has delegated authority for Title V, NSPS, and NESHAP programs. New minor sources must obtain a state permit if PTE exceeds 50 tpy of any regulated pollutant. Virginia DEQ requires BACT review for all major sources. The state has adopted NSPS and NESHAP by reference. Synthetic minor permits are available with federally enforceable limits. Permit processing timelines: minor permits 60-90 days, major permits 6-12 months, PSD permits 9-18 months.',
    citation: '9 VAC 5 / Va. Code § 10.1-1300 et seq.',
  },
  {
    state: 'Virginia',
    category: 'water_permitting',
    rule_name: 'Virginia NPDES & Water Permitting',
    rule_text: 'Virginia DEQ administers the NPDES program under the Virginia Pollutant Discharge Elimination System (VPDES) permit program per 9 VAC 25. Cooling tower blowdown discharges require a VPDES individual permit if exceeding 1 MGD. Virginia DEQ also administers the Virginia Stormwater Management Program (VSMP) for construction and industrial stormwater. Construction activities disturbing 1 acre or more require VSMP coverage. Virginia has specific water quality standards for the Chesapeake Bay watershed that may impose additional nutrient limits on cooling tower blowdown containing phosphorus or nitrogen.',
    citation: '9 VAC 25 / Va. Code § 62.1-44.15',
  },
  {
    state: 'Virginia',
    category: 'water_withdrawal',
    rule_name: 'Virginia Water Withdrawal Regulations',
    rule_text: 'Virginia requires a surface water withdrawal permit for withdrawals exceeding 1 MGD per month from any surface water source per Va. Code § 62.1-256. Groundwater withdrawals exceeding 300,000 gallons per month require a groundwater withdrawal permit. Data center cooling tower makeup water withdrawals commonly exceed these thresholds. Withdrawal permits require a Water Conservation Plan and may include minimum instream flow protection requirements. The permit term is typically 15 years with 5-year review cycles. Drought contingency plans may trigger mandatory reductions in withdrawal rates.',
    citation: 'Va. Code § 62.1-250 et seq.',
  },
  // ── Tennessee ──
  {
    state: 'Tennessee',
    category: 'air_permitting',
    rule_name: 'Tennessee Air Quality Act',
    rule_text: 'Tennessee Department of Environment and Conservation (TDEC) Division of Air Pollution Control administers air permitting under Tenn. Comp. R. & Regs. 1200-03-09. Tennessee is in attainment for all NAAQS for most counties. Preconstruction permits are required for any source with PTE exceeding 5 tpy of any regulated pollutant. Synthetic minor permits available with enforceable limits. PSD applies at 100 tpy for 28 listed source categories and 250 tpy for all others. Tennessee has delegated authority for NSPS and NESHAP programs. Permit processing: 90 days for minor permits, 12-18 months for PSD permits.',
    citation: 'Tenn. Code Ann. § 68-201-101 et seq.',
  },
  {
    state: 'Tennessee',
    category: 'water_permitting',
    rule_name: 'Tennessee Water Quality Control Act',
    rule_text: 'TDEC Division of Water Resources administers NPDES permitting under Tenn. Comp. R. & Regs. 1200-04-05. Cooling tower blowdown requires NPDES permit coverage. Construction stormwater permits required for disturbance over 1 acre. Tennessee has specific antidegradation rules that apply to Tier 2 and Tier 3 streams. New discharges to Tier 2 streams require an antidegradation review demonstrating necessary economic or social development. Tennessee also requires a Section 401 Water Quality Certification for any federal permit (404, NPDES). The state has authority to certify or deny certification based on water quality impacts.',
    citation: 'Tenn. Code Ann. § 69-3-101 et seq.',
  },
  // ── Georgia ──
  {
    state: 'Georgia',
    category: 'air_permitting',
    rule_name: 'Georgia Air Quality Act',
    rule_text: 'Georgia Environmental Protection Division (EPD) administers air permitting under Ga. Comp. R. & Regs. 391-3-1. Georgia is largely attainment except the Atlanta area. Synthetic minor permits are available with federally enforceable limits on hours of operation or fuel use. Georgia EPD requires BACT for major PSD sources. Title V permits required for sources with PTE over 100 tpy. Georgia has adopted all NSPS and NESHAP standards by reference. Permit processing: 90-180 days for synthetic minor, 12-18 months for PSD. Georgia requires a Prevention of Significant Deterioration permit for any source emitting over 100 tpy in the Atlanta ozone nonattainment area.',
    citation: 'Ga. Code Ann. § 12-9-1 et seq.',
  },
  {
    state: 'Georgia',
    category: 'water_permitting',
    rule_name: 'Georgia Water Quality Control Act',
    rule_text: 'Georgia EPD Watershed Protection Branch administers NPDES permits. Cooling tower blowdown requires NPDES permitting. Georgia has stringent water quality standards for the Savannah River and Chattahoochee River basins. Section 401 Water Quality Certification is required for federal permits. Georgia requires groundwater withdrawal permits for withdrawals exceeding 100,000 gallons per day. The Georgia Water Stewardship Act requires commercial and industrial facilities using over 1 MGD to submit water conservation plans and implement reasonable water conservation measures. Industrial stormwater permits are administered under the Georgia NPDES General Permit for Industrial Stormwater (GAR050000).',
    citation: 'Ga. Code Ann. § 12-5-20 et seq.',
  },
  // ── Texas ──
  {
    state: 'Texas',
    category: 'air_permitting',
    rule_name: 'Texas Clean Air Act',
    rule_text: 'Texas Commission on Environmental Quality (TCEQ) administers air permitting under 30 TAC Chapters 101-122. Texas has a flexible New Source Review (NSR) permit program with both PSD permits (federal) and state permits. Texas offers Standard Permits for certain source categories including stationary gas turbines, which provide streamlined permitting. Texas is in the Dallas-Fort Worth and Houston-Galveston ozone nonattainment areas, requiring Nonattainment NSR with LAER and offsets. Texas follows the federal PSD program for attainment areas. Permit by Rule (PBR) is available for smaller sources. Texas has adopted federal NSPS and NESHAP. Title V permits required for major sources. TCEQ processing: Standard permits 45-90 days, PSD 6-18 months.',
    citation: 'Tex. Health & Safety Code § 382.001 et seq. / 30 TAC 101-122',
  },
  {
    state: 'Texas',
    category: 'water_permitting',
    rule_name: 'Texas Water Code — NPDES & Water Rights',
    rule_text: 'TCEQ administers Texas Pollutant Discharge Elimination System (TPDES) under Tex. Water Code Chapters 26. Cooling tower blowdown requires TPDES permit coverage. Texas has separate water rights permitting through the prior appropriation system — data centers must obtain a water right permit from TCEQ for surface water withdrawals. Groundwater in Texas is governed by the rule of capture but local Groundwater Conservation Districts (GCDs) may regulate withdrawals. Construction stormwater permits required for 1+ acre disturbance. Texas has specific cooling water intake structure requirements under TPDES chapter 318 for facilities withdrawing over 100,000 GPD. SPCC plans follow 40 CFR Part 112 with TCEQ concurrent jurisdiction.',
    citation: 'Tex. Water Code § 26.001 et seq.',
  },
  // ── Ohio ──
  {
    state: 'Ohio',
    category: 'air_permitting',
    rule_name: 'Ohio Air Pollution Control Act',
    rule_text: 'Ohio EPA Division of Air Pollution Control administers permitting under OAC Chapter 3745. Ohio has delegated authority for NSPS and NESHAP. PSD permits required for major sources over 100 tpy (28 listed categories) or 250 tpy (others). Ohio offers synthetic minor permits with enforceable operating limits. Title V permits required for sources with PTE over 100 tpy. Nonattainment NSR applies in areas designated nonattainment for ozone (Cleveland-Akron-Lorain area). BACT required for PSD sources. LAER required in nonattainment areas. Permit processing: 60-90 days for minor modifications, 6-12 months for new major permits. Ohio has specific rules for NOx emissions from stationary gas turbines under OAC 3745-110.',
    citation: 'Ohio Rev. Code § 3704.01 et seq. / OAC 3745',
  },
  {
    state: 'Ohio',
    category: 'water_permitting',
    rule_name: 'Ohio Water Pollution Control Act',
    rule_text: 'Ohio EPA Division of Surface Water administers NPDES and water quality programs. Ohio NPDES permits required for cooling tower blowdown discharges. Ohio has specific water quality standards for Lake Erie tributaries including phosphorus limits that may affect cooling tower blowdown. Construction stormwater permits (OHC000005) required for 1+ acre disturbance. Ohio EPA requires a Section 401 Water Quality Certification for federal permits. Ohio also requires dam safety permits for any cooling water impoundment structures. The state has antidegradation rules that require enhanced review for discharges to Outstanding State Waters and High Quality Waters.',
    citation: 'Ohio Rev. Code § 6111.01 et seq.',
  },
  // ── Arizona ──
  {
    state: 'Arizona',
    category: 'air_permitting',
    rule_name: 'Arizona Revised Statutes Title 49 — Air Quality',
    rule_text: 'Arizona Department of Environmental Quality (ADEQ) and county air agencies (Maricopa County, Pima County) administer air permitting. Maricopa County has its own air quality department due to serious PM-10 and ozone nonattainment. Synthetic minor permits available with enforceable limits on hours and emissions. PSD permits required for major sources. Nonattainment NSR with LAER and offsets applies in Maricopa County for ozone and PM-10. Arizona has specific dust control requirements (Fugitive Dust Rule) for construction activities. Title V permits for major sources (>100 tpy). Arizona has adopted NSPS and NESHAP by reference. Permit processing: 60-120 days for minor permits, 6-18 months for major permits.',
    citation: 'Ariz. Rev. Stat. § 49-401 et seq.',
  },
  {
    state: 'Arizona',
    category: 'water_permitting',
    rule_name: 'Arizona Water Quality Regulations',
    rule_text: 'ADEQ Water Quality Division administers NPDES and aquifer protection permits. Cooling tower blowdown requires NPDES or Aquifer Protection Permit (APP) coverage. Arizona has stringent groundwater protection rules due to limited water resources. The Arizona Groundwater Management Act requires that new facilities demonstrate "assured water supply" for 100 years. The Active Management Areas (AMAs) in Phoenix, Tucson, and Prescott regulate groundwater withdrawals. Data centers in AMAs must pay groundwater withdrawal fees. Industrial stormwater permits are required under the Arizona Multi-Sector General Permit. Construction stormwater permits required for 1+ acre disturbance. Arizona has specific Total Dissolved Solids (TDS) limits for cooling tower blowdown disposed to land application.',
    citation: 'Ariz. Rev. Stat. § 49-201 et seq.',
  },
  // ── Washington ──
  {
    state: 'Washington',
    category: 'air_permitting',
    rule_name: 'Washington Clean Air Act',
    rule_text: `Washington State Department of Ecology and local clean air agencies administer air permitting under WAC Chapter 173-400. Washington follows the federal PSD program and has delegated NSPS/NESHAP authority. The state has specific greenhouse gas (GHG) regulations requiring Best Available Control Technology for GHGs for major sources under the Clean Air Act. Washington\u2019s Climate Commitment Act (Chapter 70A.65 RCW) imposes a cap-and-invest program affecting data centers through GHG allowance requirements. New major sources must obtain GHG emissions allowances or purchase offsets. Washington also has a Clean Energy Transformation Act (CETA) affecting electricity consumption. Synthetic minor permits available with enforceable limits. WA Ecology processing: 90 days for minor, 9-18 months for PSD.`,
    citation: 'RCW 70A.15 / WAC 173-400',
  },
  {
    state: 'Washington',
    category: 'water_permitting',
    rule_name: 'Washington Water Pollution Control Act',
    rule_text: 'Washington Department of Ecology administers NPDES permits under Chapter 90.48 RCW and WAC 173-220. Cooling tower blowdown requires NPDES individual permit coverage. Washington has specific water quality standards for Puget Sound and Columbia River including temperature, dissolved oxygen, and toxics criteria. Section 401 WQC required for federal permits. Washington has strict antidegradation rules implementing Tier I, II, and III protections. Construction stormwater permits (Construction Stormwater General Permit) required for 1+ acre disturbance. Washington requires compliance with the State Waste Discharge Permit program for any discharge not covered by NPDES. The state has specific cooling water intake structure requirements mirroring 316(b). Water rights permits required for withdrawal of surface or groundwater under the prior appropriation doctrine.',
    citation: 'RCW 90.48 / WAC 173-220',
  },
  // ── General federal ──
  {
    state: 'General',
    category: 'air_ghg',
    rule_name: 'EPA GHGRP Subpart C — Stationary Combustion Sources',
    rule_text: '40 CFR Part 98 Subpart C requires annual reporting of GHG emissions from stationary fuel combustion sources emitting 25,000 metric tons CO2e or more per year. Affected sources report CO2, CH4, and N2O emissions calculated using Tier 1 (default emission factors), Tier 2 (HHV-based), Tier 3 (CEMS), or Tier 4 (mass balance) calculation methodologies. Reports are submitted through EPA\'s eGGRT system by March 31 of each year for the preceding calendar year. Subpart C applies to gas turbines, boilers, heaters, engines, and any other stationary combustion device. CO2 emissions are calculated based on fuel consumption and carbon content. Data centers with on-site gas turbine or engine generation exceeding 25,000 mt CO2e must register with EPA GHGRP. Third-party verification is not required but records must be retained for 3 years. Noncompliance penalties under CAA Section 113 apply.',
    citation: '40 CFR Part 98 Subpart C',
  },
];