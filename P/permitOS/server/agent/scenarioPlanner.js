const COMMON_WORK = [
  { id: 'jurisdiction', label: 'Confirm permitting jurisdictions and delegated agencies', domain: 'all', gate: 'human' },
  { id: 'evidence', label: 'Build equipment, operations, site, and source-evidence register', domain: 'all', gate: 'evidence' },
  { id: 'air-screen', label: 'Run air applicability and PTE screening', domain: 'air', gate: 'calculation' },
  { id: 'water-screen', label: 'Map water sources, uses, discharges, and stormwater pathways', domain: 'water', gate: 'calculation' },
  { id: 'land-screen', label: 'Screen zoning, wetlands, species, cultural, noise, and federal nexus', domain: 'land', gate: 'human' },
  { id: 'schedule', label: 'Build critical-path permit schedule with agency dependencies', domain: 'all', gate: 'planning' },
  { id: 'review', label: 'Complete qualified professional review before reliance or filing', domain: 'all', gate: 'human' },
];

const SCENARIOS = {
  greenfield: [
    { id: 'site-control', label: 'Confirm site control and full greenfield disturbance footprint', domain: 'land', gate: 'evidence' },
    { id: 'construction-sw', label: 'Evaluate construction stormwater coverage and SWPPP timing', domain: 'water', gate: 'human' },
    { id: 'utility', label: 'Coordinate utility, interconnection, water, sewer, and access approvals', domain: 'all', gate: 'human' },
  ],
  upsized: [
    { id: 'project-change', label: 'Define the physical and operational change from the permitted baseline', domain: 'air', gate: 'evidence' },
    { id: 'netting', label: 'Evaluate modification, project emissions accounting, netting, and contemporaneous changes', domain: 'air', gate: 'human' },
    { id: 'permit-reopeners', label: 'Identify permits, applications, and studies requiring amendment or reopening', domain: 'all', gate: 'human' },
  ],
  brownfield: [
    { id: 'legacy', label: 'Inventory existing permits, compliance history, contamination, and legacy equipment', domain: 'all', gate: 'evidence' },
    { id: 'modification', label: 'Distinguish new source, modification, replacement, and routine maintenance issues', domain: 'air', gate: 'human' },
  ],
};

export function buildScenarioPlan(scenarioType = 'greenfield') {
  const normalized = SCENARIOS[scenarioType] ? scenarioType : 'greenfield';
  return {
    scenarioType: normalized,
    tasks: [...SCENARIOS[normalized], ...COMMON_WORK].map((task, index) => ({
      ...task,
      order: index + 1,
      status: 'pending',
    })),
  };
}

export function supportedScenarios() {
  return Object.keys(SCENARIOS);
}
