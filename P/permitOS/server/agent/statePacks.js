export const STATE_PACKS = {
  Tennessee: {
    code: 'TN',
    airAgency: 'Tennessee Department of Environment and Conservation, Division of Air Pollution Control',
    waterAgency: 'Tennessee Department of Environment and Conservation, Division of Water Resources',
    sources: [
      { title: 'Tennessee Air Permitting', url: 'https://www.tn.gov/environment/permit-permits/air-permits.html', authority: 'officialGuidance' },
      { title: 'Tennessee Water Permits', url: 'https://www.tn.gov/environment/permit-permits/water-permits.html', authority: 'officialGuidance' },
    ],
    reviewQuestions: ['Confirm local air program delegation.', 'Confirm receiving-water and POTW jurisdiction.', 'Confirm current state forms and public notice requirements.'],
  },
  Virginia: {
    code: 'VA',
    airAgency: 'Virginia Department of Environmental Quality, Air Division',
    waterAgency: 'Virginia Department of Environmental Quality, Water Permitting',
    sources: [
      { title: 'Virginia Air Permitting', url: 'https://www.deq.virginia.gov/permits/air', authority: 'officialGuidance' },
      { title: 'Virginia Water Permitting', url: 'https://www.deq.virginia.gov/permits/water', authority: 'officialGuidance' },
    ],
    reviewQuestions: ['Confirm regional DEQ office.', 'Check county-specific attainment designation.', 'Confirm VPDES and construction stormwater pathways.'],
  },
  Texas: {
    code: 'TX',
    airAgency: 'Texas Commission on Environmental Quality, Air Permits Division',
    waterAgency: 'Texas Commission on Environmental Quality, Water Quality Division',
    sources: [
      { title: 'TCEQ Air Permits', url: 'https://www.tceq.texas.gov/permitting/air', authority: 'officialGuidance' },
      { title: 'TCEQ Wastewater Permits', url: 'https://www.tceq.texas.gov/permitting/wastewater', authority: 'officialGuidance' },
    ],
    reviewQuestions: ['Evaluate permit-by-rule, standard permit, and case-by-case NSR.', 'Confirm ozone nonattainment classification.', 'Confirm TPDES and groundwater district jurisdiction.'],
  },
  Arizona: {
    code: 'AZ',
    airAgency: 'Arizona Department of Environmental Quality, Air Quality Division',
    waterAgency: 'Arizona Department of Environmental Quality, Water Quality Division',
    sources: [
      { title: 'ADEQ Air Quality Permits', url: 'https://azdeq.gov/air-permits', authority: 'officialGuidance' },
      { title: 'ADEQ Water Quality Permits', url: 'https://azdeq.gov/wqd', authority: 'officialGuidance' },
    ],
    reviewQuestions: ['Confirm county air-program jurisdiction.', 'Evaluate assured water supply and groundwater constraints.', 'Confirm AZPDES and aquifer-protection permit pathways.'],
  },
  California: {
    code: 'CA',
    airAgency: 'California Air Resources Board and local air districts',
    waterAgency: 'State Water Resources Control Board and Regional Water Quality Control Boards',
    sources: [
      { title: 'California Air Districts', url: 'https://ww2.arb.ca.gov/california-air-districts', authority: 'officialGuidance' },
      { title: 'California Water Boards Permits', url: 'https://www.waterboards.ca.gov/water_issues/programs/npdes/', authority: 'officialGuidance' },
    ],
    reviewQuestions: ['Identify local air district and district-specific BACT/offset rules.', 'Evaluate CEQA lead-agency process.', 'Confirm regional water board, water supply, and discharge pathway.'],
  },
  Georgia: {
    code: 'GA',
    airAgency: 'Georgia Environmental Protection Division, Air Protection Branch',
    waterAgency: 'Georgia Environmental Protection Division, Watershed Protection Branch',
    sources: [
      { title: 'Georgia Air Protection Branch', url: 'https://epd.georgia.gov/air-protection-branch', authority: 'officialGuidance' },
      { title: 'Georgia Watershed Protection Branch', url: 'https://epd.georgia.gov/watershed-protection-branch', authority: 'officialGuidance' },
    ],
    reviewQuestions: ['Confirm PSD/Title V applicability with EPD.', 'Confirm groundwater withdrawal and NPDES needs.', 'Evaluate local land-disturbance permits.'],
  },
  Nevada: {
    code: 'NV',
    airAgency: 'Nevada Division of Environmental Protection, Bureau of Air Pollution Control',
    waterAgency: 'Nevada Division of Environmental Protection, Bureau of Water Pollution Control',
    sources: [
      { title: 'Nevada Air Quality', url: 'https://ndep.nv.gov/air', authority: 'officialGuidance' },
      { title: 'Nevada Water Pollution Control', url: 'https://ndep.nv.gov/water/water-pollution-control', authority: 'officialGuidance' },
    ],
    reviewQuestions: ['Confirm Clark or Washoe local air jurisdiction.', 'Evaluate water-right and conservation requirements.', 'Confirm industrial and construction discharge permits.'],
  },
  Ohio: {
    code: 'OH',
    airAgency: 'Ohio Environmental Protection Agency, Division of Air Pollution Control',
    waterAgency: 'Ohio Environmental Protection Agency, Division of Surface Water',
    sources: [
      { title: 'Ohio EPA Air Permits', url: 'https://epa.ohio.gov/divisions-and-offices/air-pollution-control/permitting', authority: 'officialGuidance' },
      { title: 'Ohio EPA NPDES Permits', url: 'https://epa.ohio.gov/divisions-and-offices/surface-water/permitting', authority: 'officialGuidance' },
    ],
    reviewQuestions: ['Confirm PTI/PTIO sequence.', 'Check county ozone and PM status.', 'Confirm NPDES and indirect-discharge approvals.'],
  },
  Oregon: {
    code: 'OR',
    airAgency: 'Oregon Department of Environmental Quality, Air Quality',
    waterAgency: 'Oregon Department of Environmental Quality, Water Quality',
    sources: [
      { title: 'Oregon DEQ Air Quality Permits', url: 'https://www.oregon.gov/deq/aq/aqpermits/pages/default.aspx', authority: 'officialGuidance' },
      { title: 'Oregon DEQ Water Quality Permits', url: 'https://www.oregon.gov/deq/wq/wqpermits/pages/default.aspx', authority: 'officialGuidance' },
    ],
    reviewQuestions: ['Evaluate Cleaner Air Oregon applicability.', 'Confirm land-use compatibility statement.', 'Confirm water-right, NPDES, and construction stormwater requirements.'],
  },
  'North Carolina': {
    code: 'NC',
    airAgency: 'North Carolina Division of Air Quality',
    waterAgency: 'North Carolina Division of Water Resources',
    sources: [
      { title: 'NC Air Quality Permitting', url: 'https://www.deq.nc.gov/about/divisions/air-quality/air-quality-permitting', authority: 'officialGuidance' },
      { title: 'NC Water Resources Permitting', url: 'https://www.deq.nc.gov/about/divisions/water-resources/permitting', authority: 'officialGuidance' },
    ],
    reviewQuestions: ['Confirm regional office and local program.', 'Evaluate basin and water-supply constraints.', 'Confirm NPDES, 401, and erosion-control pathways.'],
  },
  'South Carolina': {
    code: 'SC',
    airAgency: 'South Carolina Department of Environmental Services, Bureau of Air Quality',
    waterAgency: 'South Carolina Department of Environmental Services, Bureau of Water',
    sources: [
      { title: 'South Carolina Air Quality', url: 'https://des.sc.gov/programs/bureau-air-quality', authority: 'officialGuidance' },
      { title: 'South Carolina Water', url: 'https://des.sc.gov/programs/bureau-water', authority: 'officialGuidance' },
    ],
    reviewQuestions: ['Confirm construction and operating permit sequencing.', 'Evaluate coastal-zone review where applicable.', 'Confirm NPDES and water-withdrawal requirements.'],
  },
};

export function getStatePack(state) {
  return STATE_PACKS[state] || null;
}

export function listStatePacks() {
  return Object.entries(STATE_PACKS).map(([state, pack]) => ({ state, code: pack.code }));
}
