// ─── Scenario Analyzer — Greenfield, Expansion, Upsized, Co-Located ──
// Analyzes different data center development scenarios and provides
// scenario-specific permit pathways, timelines, and considerations.

// ─── Scenario Definitions ────────────────────────────────────────────────────
const SCENARIO_DEFS = {
  greenfield: {
    id: 'greenfield',
    label: 'Greenfield Development',
    description: 'New data center campus on undeveloped land. Requires full permitting suite: air construction permits, water permits, wetlands, stormwater, and land use approvals.',
    icon: '🌱',
    complexity: 'high',
    typicalTimelineMonths: { min: 18, max: 36 },
    permitTypes: ['PSD/Synthetic Minor Air Permit', 'NPDES Individual Permit', 'CWA 404 Wetlands Permit', 'Construction SWPPP', 'SPCC Plan', 'State Air Construction Permit', 'Title V (if major source)', 'Groundwater Withdrawal Permit'],
    keyRisks: ['Wetlands delineation and 404 permitting timeline', 'Air PSD applicability determination', 'Community opposition and EJ concerns', 'Utility interconnection delays'],
    keyOpportunities: ['Optimize site layout to avoid wetland impacts', 'Synthetic minor pathway if < 250 tpy', 'Community benefit agreements for EJ support'],
  },
  expansion: {
    id: 'expansion',
    label: 'Campus Expansion',
    description: 'Adding capacity to an existing data center campus. May benefit from existing permits and environmental documentation.',
    icon: '📈',
    complexity: 'moderate',
    typicalTimelineMonths: { min: 12, max: 24 },
    permitTypes: ['Air Permit Modification', 'NPDES Permit Modification', 'SPCC Plan Amendment', 'SWPPP Update', 'Title V Modification (if applicable)'],
    keyRisks: ['Cumulative emissions may trigger PSD applicability', 'Existing permit limits may restrict new capacity', 'Neighborhood fatigue from ongoing construction', 'Utility capacity constraints'],
    keyOpportunities: ['Existing environmental documentation reduces NEPA burden', 'Potential for net emission reductions through modernization', 'Shared infrastructure reduces per-MW cost', 'Streamlined agency review for known operators'],
  },
  upsized: {
    id: 'upsized',
    label: 'Permit Upsizing / Modification',
    description: 'Modifying an existing permit to increase capacity or change operational parameters. Typically involves permit modification rather than new permit.',
    icon: '🔧',
    complexity: 'moderate',
    typicalTimelineMonths: { min: 8, max: 18 },
    permitTypes: ['Air Permit Amendment', 'Title V Significant Modification', 'NPDES Permit Modification', 'SPCC Plan Update'],
    keyRisks: ['PSD netting analysis may trigger full PSD review', 'Existing monitoring infrastructure may need upgrade', 'Community may oppose expanded operations'],
    keyOpportunities: ['Faster than greenfield (8-18 months vs 18-36)', 'Leverage existing monitoring and compliance systems', 'Operational track record supports agency confidence', 'Brick dispatch controls demonstrate continuous improvement'],
  },
  colocated: {
    id: 'colocated',
    label: 'Co-Located / Powered Site',
    description: 'Data center located at an existing power generation site or industrial facility. May share permits and environmental controls with host facility.',
    icon: '🏭',
    complexity: 'low',
    typicalTimelineMonths: { min: 6, max: 14 },
    permitTypes: ['Air Permit Revision (host)', 'NPDES Authorization (host)', 'Shared SPCC Plan', 'Interconnection Agreement'],
    keyRisks: ['Host facility permit condition constraints', 'Shared environmental liability', 'Coordination complexity between operators', 'Cumulative emission impacts'],
    keyOpportunities: ['Fastest pathway (6-14 months)', 'Shared infrastructure and EPC costs', 'Existing environmental baseline data', 'Potential PTE aggregation savings', 'Preferred by regulators (brownfield development)'],
  },
};

// ─── State-Specific Scenario Factors ─────────────────────────────────────────
const STATE_FACTORS = {
  'Virginia': { greenfield: { timelineBoost: 0.9, notes: 'DEQ has dedicated data center unit' }, expansion: { timelineBoost: 0.85, notes: 'Expedited review for existing operators' } },
  'Tennessee': { greenfield: { timelineBoost: 0.8, notes: '45-day Class I permits for minor sources' }, expansion: { timelineBoost: 0.75, notes: 'Fastest expansion pathway' } },
  'Texas': { greenfield: { timelineBoost: 0.85, notes: 'Standard Permit pathway for gas turbines < 115 MW' }, expansion: { timelineBoost: 0.8, notes: 'Flexible Permit allows facility-wide caps' } },
  'Ohio': { greenfield: { timelineBoost: 0.85, notes: 'Dedicated data center permitting unit at Ohio EPA' }, expansion: { timelineBoost: 0.8, notes: 'Established data center precedent' } },
  'Georgia': { greenfield: { timelineBoost: 0.9, notes: 'Streamlined synthetic minor program' }, expansion: { timelineBoost: 0.85, notes: 'EPD has data center experience' } },
  'California': { greenfield: { timelineBoost: 1.5, notes: 'CEQA review adds 12-24 months; extreme nonattainment in some areas' }, expansion: { timelineBoost: 1.3, notes: 'Existing facility CEQA may streamline, but air district still rigorous' } },
};

// ─── Analyze Scenario ────────────────────────────────────────────────────────
export function analyzeScenario(scenario, inputs) {
  if (!scenario || !SCENARIO_DEFS[scenario]) {
    return { error: 'Invalid scenario. Valid options: greenfield, expansion, upsized, colocated' };
  }

  const def = SCENARIO_DEFS[scenario];
  const state = inputs?.state || 'Unknown';
  const totalMW = (inputs?.turbines || 0) * (inputs?.mwPerTurbine || 0);
  const isNonAttain = inputs?.nonAttainment || false;
  const stateFactors = STATE_FACTORS[state];

  // Calculate adjusted timeline
  let timelineMin = def.typicalTimelineMonths.min;
  let timelineMax = def.typicalTimelineMonths.max;

  if (stateFactors) {
    const factor = stateFactors[scenario];
    if (factor) {
      timelineMin = Math.round(timelineMin * factor.timelineBoost);
      timelineMax = Math.round(timelineMax * factor.timelineBoost);
    }
  }

  // Nonattainment adds time
  if (isNonAttain) {
    timelineMin = Math.round(timelineMin * 1.3);
    timelineMax = Math.round(timelineMax * 1.3);
  }

  // Large projects add time
  if (totalMW > 500) {
    timelineMin = Math.round(timelineMin * 1.2);
    timelineMax = Math.round(timelineMax * 1.2);
  }

  // Generate milestones
  const milestones = generateMilestones(scenario, timelineMin, timelineMax, state, isNonAttain);

  // Determine complexity
  let complexity = def.complexity;
  if (isNonAttain && complexity !== 'high') complexity = 'moderate';
  if (scenario === 'greenfield') complexity = 'high';

  // Generate special considerations
  const specialConsiderations = [];
  if (stateFactors && stateFactors[scenario]) {
    specialConsiderations.push(stateFactors[scenario].notes);
  }
  if (isNonAttain) {
    specialConsiderations.push(`Nonattainment area — LAER and emission offsets required (adds 3-6 months)`);
  }
  if (totalMW > 500) {
    specialConsiderations.push(`Large project (${totalMW} MW) — may require phased permitting approach`);
  }
  if (inputs?.brickSavings > 15) {
    specialConsiderations.push(`Brick dispatch optimization (${inputs.brickSavings}% savings) provides regulatory differentiation`);
  }

  return {
    scenario: def.id,
    label: def.label,
    description: def.description,
    complexity,
    timelineMonths: { min: timelineMin, max: timelineMax },
    permitTypes: def.permitTypes,
    milestones,
    keyRisks: def.keyRisks,
    keyOpportunities: def.keyOpportunities,
    specialConsiderations,
    stateSpecific: stateFactors ? {
      state,
      timelineAdjustment: stateFactors[scenario]?.timelineBoost || 1.0,
      notes: stateFactors[scenario]?.notes || null,
    } : { state, timelineAdjustment: 1.0, notes: null },
  };
}

// ─── Generate Milestones ─────────────────────────────────────────────────────
function generateMilestones(scenario, timelineMin, timelineMax, state, isNonAttain) {
  const base = [
    { phase: 'Pre-Application', activities: ['Site selection and environmental screening', 'Pre-application meeting with agency', 'Consultant procurement'], durationWeeks: [4, 8] },
    { phase: 'Environmental Assessment', activities: ['Wetlands delineation (if applicable)', 'Endangered species survey', 'Cultural resource survey', 'EJ screening analysis'], durationWeeks: [8, 16] },
    { phase: 'Air Permit Application', activities: ['PTE calculation and applicability determination', 'BACT analysis (if PSD)', 'AERMOD modeling protocol and run', 'Draft permit application preparation'], durationWeeks: [12, 24] },
    { phase: 'Water Permit Application', activities: ['NPDES permit application', 'SPCC Plan preparation', 'Groundwater withdrawal permit (if applicable)'], durationWeeks: [8, 16] },
    { phase: 'Agency Review', activities: ['Application completeness review', 'Technical review by agency staff', 'Public comment period (if PSD)', 'Response to comments'], durationWeeks: [12, 36] },
    { phase: 'Permit Issuance', activities: ['Final permit conditions negotiation', 'Permit issuance and appeal period', 'Post-permit compliance planning'], durationWeeks: [4, 8] },
  ];

  // Scenario-specific adjustments
  if (scenario === 'expansion') {
    base[0].activities.push('Review existing permit conditions for modification feasibility');
    base[1].activities = ['Update existing environmental documentation', 'Cumulative impact assessment'];
    base[4].durationWeeks = [8, 20];
  } else if (scenario === 'upsized') {
    base[0].activities.push('Review existing permit for modification pathway');
    base[1].activities = ['Limited environmental review (existing facility)'];
    base[4].durationWeeks = [6, 16];
  } else if (scenario === 'colocated') {
    base[0].activities.push('Host facility permit audit', 'Interconnection agreement negotiation');
    base[1].activities = ['Host facility environmental documentation review'];
    base[4].durationWeeks = [4, 12];
  }

  if (isNonAttain) {
    base[2].activities.push('LAER analysis', 'Emission offset procurement');
  }

  return base;
}

// ─── List Available Scenarios ────────────────────────────────────────────────
export function listScenarios() {
  return Object.values(SCENARIO_DEFS).map(def => ({
    id: def.id,
    label: def.label,
    description: def.description,
    icon: def.icon,
    complexity: def.complexity,
    typicalTimelineMonths: def.typicalTimelineMonths,
  }));
}