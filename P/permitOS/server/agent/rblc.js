const PROCESS_CODES = {
  'large-simple-cycle-natural-gas': '15.110',
  'large-combined-cycle-natural-gas': '15.210',
  'small-simple-cycle-natural-gas': '16.110',
  'large-diesel-engine': '17.110',
  'large-natural-gas-engine': '17.130',
};

export function buildRblcResearchPlan({ equipmentClass, pollutant = 'NOX', fromDate = null, state = null } = {}) {
  const processCode = PROCESS_CODES[equipmentClass] || null;
  return {
    system: 'EPA RACT/BACT/LAER Clearinghouse',
    officialSearchUrl: 'https://cfpub.epa.gov/rblc/index.cfm?action=Search.BasicSearch',
    processCode,
    pollutant: String(pollutant).toUpperCase(),
    fromDate,
    state,
    status: processCode ? 'ready-for-official-search' : 'needs-equipment-classification',
    instructions: [
      'Run the criteria in the official RBLC interface.',
      'Export or record each selected RBLC ID and permit date.',
      'Attach the underlying permit determination where available.',
      'Document why each facility is technically comparable.',
      'Have the BACT/LAER reviewer approve exclusions and final precedent set.',
    ],
    limitations: [
      'PermitOS does not treat a search-page match as verified precedent.',
      'Cost and emission limits must be checked against the underlying permit record.',
    ],
  };
}

export function rblcEquipmentClasses() {
  return PROCESS_CODES;
}
