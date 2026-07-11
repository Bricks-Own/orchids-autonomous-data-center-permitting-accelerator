// ─── Brick PermitOS — Permit Tracker & Deduplication Engine ─────────────────
// Tracks previously submitted permits, their effective periods, and determines
// whether a permit needs resubmission based on:
//   1. Effective period remaining
//   2. Site parameter changes since last submission
//   3. Regulatory updates that may invalidate prior filings

const PERMIT_TYPES = {
  air: {
    'PSD Permit': { effectivePeriod: 60, unit: 'months', description: 'Prevention of Significant Deterioration — major source preconstruction review', agency: 'EPA / State Agency' },
    'Synthetic Minor Permit': { effectivePeriod: 60, unit: 'months', description: 'Synthetic minor source operating permit with enforceable limits', agency: 'State/Local Agency' },
    'Title V Operating Permit': { effectivePeriod: 60, unit: 'months', description: 'Federal operating permit for major sources', agency: 'EPA / State Agency' },
    'NSR Permit': { effectivePeriod: 60, unit: 'months', description: 'New Source Review — preconstruction for minor modifications', agency: 'State/Local Agency' },
    'BACT Analysis': { effectivePeriod: 36, unit: 'months', description: 'Best Available Control Technology assessment', agency: 'State Agency' },
    'Air Emissions Inventory': { effectivePeriod: 12, unit: 'months', description: 'Annual emissions inventory report', agency: 'State/Local Agency' },
    'Acid Rain Permit': { effectivePeriod: 60, unit: 'months', description: 'Title IV Acid Rain Program permit', agency: 'EPA' },
    'GHG Reporting': { effectivePeriod: 12, unit: 'months', description: 'Greenhouse Gas Reporting Program (40 CFR 98)', agency: 'EPA' },
    'NSPS Compliance': { effectivePeriod: 12, unit: 'months', description: 'NSPS Subpart KKKK/KkKKa compliance demonstration', agency: 'EPA / State Agency' },
    'Fugitive Dust Plan': { effectivePeriod: 24, unit: 'months', description: 'Fugitive dust control plan for construction/operations', agency: 'State/Local Agency' },
    'Odor Control Plan': { effectivePeriod: 24, unit: 'months', description: 'Odor management plan for diesel engines / cooling towers', agency: 'Local Agency' },
    'Emergency Engine Registration': { effectivePeriod: 12, unit: 'months', description: 'Emergency generator registration / compliance certification', agency: 'State/Local Agency' },
    'Air Toxics (NESHAP)': { effectivePeriod: 60, unit: 'months', description: 'NESHAP compliance for hazardous air pollutants', agency: 'EPA / State Agency' },
  },
  water: {
    'NPDES Permit': { effectivePeriod: 60, unit: 'months', description: 'National Pollutant Discharge Elimination System permit', agency: 'EPA / State Agency' },
    'SPCC Plan': { effectivePeriod: 12, unit: 'months', description: 'Spill Prevention Control and Countermeasure Plan (40 CFR 112)', agency: 'EPA' },
    'SWPPP': { effectivePeriod: 12, unit: 'months', description: 'Stormwater Pollution Prevention Plan', agency: 'State/Local Agency' },
    'Cooling Water Intake (316b)': { effectivePeriod: 60, unit: 'months', description: 'Cooling water intake structure regulations (316b)', agency: 'EPA / State Agency' },
    'POTW Pretreatment': { effectivePeriod: 60, unit: 'months', description: 'Publicly Owned Treatment Works pretreatment permit', agency: 'Local Agency / POTW' },
    'Industrial User Permit': { effectivePeriod: 60, unit: 'months', description: 'Significant industrial user permit for discharge to POTW', agency: 'Local Agency / POTW' },
    'Water Withdrawal Permit': { effectivePeriod: 36, unit: 'months', description: 'Groundwater/surface water withdrawal permit', agency: 'State Agency' },
    'Groundwater Monitoring Plan': { effectivePeriod: 24, unit: 'months', description: 'Groundwater monitoring and reporting plan', agency: 'State Agency' },
    'Section 401 Certification': { effectivePeriod: 60, unit: 'months', description: 'Clean Water Act Section 401 water quality certification', agency: 'State Agency' },
    'Section 404 Permit': { effectivePeriod: 60, unit: 'months', description: 'Clean Water Act Section 404 dredge/fill permit', agency: 'USACE' },
  },
  building: {
    'Building Permit': { effectivePeriod: 24, unit: 'months', description: 'Primary building construction permit', agency: 'Local Building Dept' },
    'Grading Permit': { effectivePeriod: 12, unit: 'months', description: 'Site grading and earthwork permit', agency: 'Local Building Dept' },
    'Foundation Permit': { effectivePeriod: 12, unit: 'months', description: 'Foundation and structural permit', agency: 'Local Building Dept' },
    'Structural Permit': { effectivePeriod: 12, unit: 'months', description: 'Structural steel and framework permit', agency: 'Local Building Dept' },
    'Electrical Permit': { effectivePeriod: 12, unit: 'months', description: 'Electrical system installation permit', agency: 'Local Building Dept' },
    'Mechanical Permit': { effectivePeriod: 12, unit: 'months', description: 'HVAC and mechanical systems permit', agency: 'Local Building Dept' },
    'Plumbing Permit': { effectivePeriod: 12, unit: 'months', description: 'Plumbing and piping systems permit', agency: 'Local Building Dept' },
    'Fire Protection Permit': { effectivePeriod: 12, unit: 'months', description: 'Fire suppression and alarm systems permit', agency: 'Local Fire Marshal' },
    'Occupancy Permit': { effectivePeriod: 12, unit: 'months', description: 'Certificate of occupancy', agency: 'Local Building Dept' },
    'Signage Permit': { effectivePeriod: 12, unit: 'months', description: 'Exterior signage and monument permit', agency: 'Local Planning Dept' },
    'Demolition Permit': { effectivePeriod: 12, unit: 'months', description: 'Demolition of existing structures permit', agency: 'Local Building Dept' },
    'Encroachment Permit': { effectivePeriod: 12, unit: 'months', description: 'Right-of-way encroachment permit for utilities', agency: 'Local Public Works' },
  },
  power: {
    'Generation Interconnection Agreement': { effectivePeriod: 36, unit: 'months', description: 'Interconnection agreement with utility/ISO for generation', agency: 'Utility / ISO / FERC' },
    'Electric Service Agreement': { effectivePeriod: 60, unit: 'months', description: 'Electric service agreement for retail power supply', agency: 'Utility' },
    'Transmission Service Request': { effectivePeriod: 36, unit: 'months', description: 'Transmission service reservation with RTO/ISO', agency: 'RTO / ISO / FERC' },
    'Standby Generator Permit': { effectivePeriod: 60, unit: 'months', description: 'Emergency/standby generator installation and operating permit', agency: 'State/Local Agency' },
    'Cogeneration Qualification': { effectivePeriod: 60, unit: 'months', description: 'PURPA qualifying facility certification', agency: 'FERC' },
    'Energy Storage Permit': { effectivePeriod: 24, unit: 'months', description: 'Battery energy storage system permit (fire/electrical)', agency: 'Local Fire / Building Dept' },
    'Fuel Supply Agreement': { effectivePeriod: 12, unit: 'months', description: 'Natural gas or diesel fuel supply contract and permit', agency: 'Gas Utility / State' },
    'Net Metering Agreement': { effectivePeriod: 60, unit: 'months', description: 'Net metering interconnection for on-site generation', agency: 'Utility' },
    'Transformer & Substation Permit': { effectivePeriod: 24, unit: 'months', description: 'Substation and main transformer installation permit', agency: 'Local Building Dept' },
    'Emergency Power System Permit': { effectivePeriod: 24, unit: 'months', description: 'Emergency power system (ATS, UPS, generators) permit', agency: 'Local Building / Fire Dept' },
    'Air Quality for Generators': { effectivePeriod: 60, unit: 'months', description: 'Air permit for emergency generators (RICE/NESHAP)', agency: 'EPA / State Agency' },
  },
};

// Sample previously submitted permits — simulates a client's prior submission history
const DEFAULT_PREVIOUS_SUBMISSIONS = [
  {
    id: 'prev-001',
    permitType: 'PSD Permit',
    category: 'air',
    submittedDate: '2024-12-15',
    status: 'approved',
    agency: 'EPA Region 4',
    siteName: 'BigWatt AI Campus - Phase 1',
    siteAddress: '1200 Industrial Blvd, Nashville, TN',
    trackingId: 'EPA-R4-OAR-2024-12345',
    paramsAtSubmission: { turbines: 6, mwPerTurbine: 25, heatRate: 8.5, siteAcres: 35 },
  },
  {
    id: 'prev-002',
    permitType: 'NPDES Permit',
    category: 'water',
    submittedDate: '2024-10-01',
    status: 'approved',
    agency: 'TDEC',
    siteName: 'BigWatt AI Campus - Phase 1',
    siteAddress: '1200 Industrial Blvd, Nashville, TN',
    trackingId: 'TN-NPDES-2024-00892',
    paramsAtSubmission: { coolingMGD: 2.8, blowdownPct: 20, siteAcres: 35 },
  },
  {
    id: 'prev-003',
    permitType: 'SPCC Plan',
    category: 'water',
    submittedDate: '2025-01-20',
    status: 'approved',
    agency: 'EPA Region 4',
    siteName: 'BigWatt AI Campus - Phase 1',
    siteAddress: '1200 Industrial Blvd, Nashville, TN',
    trackingId: 'SPCC-BW-2025-001',
    paramsAtSubmission: { gensetCount: 8, gensetHP: 2000 },
  },
  {
    id: 'prev-004',
    permitType: 'Building Permit',
    category: 'building',
    submittedDate: '2024-08-15',
    status: 'approved',
    agency: 'Davidson County Building Dept',
    siteName: 'BigWatt AI Campus - Phase 1',
    siteAddress: '1200 Industrial Blvd, Nashville, TN',
    trackingId: 'DC-BLD-2024-0456',
    paramsAtSubmission: { siteAcres: 35, datacenterMW: 100 },
  },
  {
    id: 'prev-005',
    permitType: 'Synthetic Minor Permit',
    category: 'air',
    submittedDate: '2024-11-01',
    status: 'approved',
    agency: 'TDEC Division of Air Pollution Control',
    siteName: 'BigWatt AI Campus - Phase 1',
    siteAddress: '1200 Industrial Blvd, Nashville, TN',
    trackingId: 'TN-AP-SMP-2024-0077',
    paramsAtSubmission: { turbines: 6, mwPerTurbine: 25, noxFactor: 0.015, coFactor: 0.035 },
  },
  {
    id: 'prev-006',
    permitType: 'Generation Interconnection Agreement',
    category: 'power',
    submittedDate: '2024-09-20',
    status: 'approved',
    agency: 'TVA',
    siteName: 'BigWatt AI Campus - Phase 1',
    siteAddress: '1200 Industrial Blvd, Nashville, TN',
    trackingId: 'TVA-IA-2024-00345',
    paramsAtSubmission: { datacenterMW: 100, turbines: 6 },
  },
  {
    id: 'prev-007',
    permitType: 'Air Emissions Inventory',
    category: 'air',
    submittedDate: '2025-03-31',
    status: 'submitted',
    agency: 'TDEC',
    siteName: 'BigWatt AI Campus - Phase 1',
    siteAddress: '1200 Industrial Blvd, Nashville, TN',
    trackingId: 'TN-EI-2025-001',
    paramsAtSubmission: { turbines: 6, hours: 6000 },
  },
  {
    id: 'prev-008',
    permitType: 'SWPPP',
    category: 'water',
    submittedDate: '2024-07-01',
    status: 'approved',
    agency: 'TDEC',
    siteName: 'BigWatt AI Campus - Phase 1',
    siteAddress: '1200 Industrial Blvd, Nashville, TN',
    trackingId: 'TN-SWPPP-2024-00234',
    paramsAtSubmission: { siteAcres: 35 },
  },
];

// Calculate if a permit needs resubmission based on effective period
function getEffectivePeriodEnd(submittedDate, effectivePeriod, unit) {
  const date = new Date(submittedDate);
  if (unit === 'months') date.setMonth(date.getMonth() + effectivePeriod);
  else if (unit === 'years') date.setFullYear(date.getFullYear() + effectivePeriod);
  return date;
}

// Check if key parameters changed enough to require resubmission
function paramsChanged(prevParams, currentParams) {
  if (!prevParams || !currentParams) return false;
  const sensitiveKeys = ['turbines', 'mwPerTurbine', 'siteAcres', 'datacenterMW', 'coolingMGD', 'gensetCount', 'gensetHP', 'heatRate', 'noxFactor', 'coFactor'];
  for (const key of sensitiveKeys) {
    if (prevParams[key] !== undefined && currentParams[key] !== undefined && prevParams[key] !== currentParams[key]) {
      return { changed: true, parameter: key, oldValue: prevParams[key], newValue: currentParams[key] };
    }
  }
  return { changed: false };
}

// Get the tracker status for all permits for a given site
export function getPermitTracker(inputs, previousSubmissions) {
  const subs = previousSubmissions || DEFAULT_PREVIOUS_SUBMISSIONS;
  const now = new Date();
  const results = { air: [], water: [], building: [], power: [] };

  for (const [category, permits] of Object.entries(PERMIT_TYPES)) {
    for (const [permitName, config] of Object.entries(permits)) {
      // Find previous submission for this permit type
      const prevSub = subs.find(s => s.permitType === permitName && s.category === category);

      let status, details, effectiveUntil, daysRemaining, paramChange;

      if (prevSub) {
        effectiveUntil = getEffectivePeriodEnd(prevSub.submittedDate, config.effectivePeriod, config.unit);
        daysRemaining = Math.round((effectiveUntil - now) / (1000 * 60 * 60 * 24));

        // Check if effective period is still valid
        if (daysRemaining > 0) {
          // Check for parameter changes
          const changeCheck = paramsChanged(prevSub.paramsAtSubmission, inputs);
          if (changeCheck.changed) {
            status = 'resubmit_required';
            details = `Previously submitted ${prevSub.submittedDate} (${daysRemaining}d remaining), but ${changeCheck.parameter} changed from ${changeCheck.oldValue} to ${changeCheck.newValue}. Resubmission needed.`;
            paramChange = changeCheck;
          } else {
            status = 'active';
            details = `Previously submitted ${prevSub.submittedDate}. Effective through ${effectiveUntil.toISOString().split('T')[0]} (${daysRemaining} days remaining). No resubmission needed.`;
          }
        } else {
          status = 'expired';
          details = `Previously submitted ${prevSub.submittedDate}. Expired ${effectiveUntil.toISOString().split('T')[0]} (${Math.abs(daysRemaining)} days ago). Resubmission required.`;
        }
      } else {
        status = 'new_required';
        details = 'No previous submission found. Initial application required.';
      }

      results[category].push({
        permitName,
        category,
        description: config.description,
        agency: config.agency,
        effectivePeriod: config.effectivePeriod,
        effectiveUnit: config.unit,
        previousSubmission: prevSub ? {
          id: prevSub.id,
          submittedDate: prevSub.submittedDate,
          trackingId: prevSub.trackingId,
          agency: prevSub.agency,
          siteName: prevSub.siteName,
          status: prevSub.status,
        } : null,
        effectiveUntil: effectiveUntil ? effectiveUntil.toISOString().split('T')[0] : null,
        daysRemaining: daysRemaining || null,
        paramChange: paramChange || null,
        status,
        details,
      });
    }
  }

  return results;
}

// Aggregate summary statistics for the tracker
export function getTrackerSummary(inputs, previousSubmissions) {
  const tracker = getPermitTracker(inputs, previousSubmissions);
  const allPermits = [...tracker.air, ...tracker.water, ...tracker.building, ...tracker.power];

  const summary = {
    total: allPermits.length,
    active: allPermits.filter(p => p.status === 'active').length,
    expired: allPermits.filter(p => p.status === 'expired').length,
    newRequired: allPermits.filter(p => p.status === 'new_required').length,
    resubmitRequired: allPermits.filter(p => p.status === 'resubmit_required').length,
    byCategory: {
      air: {
        total: tracker.air.length,
        active: tracker.air.filter(p => p.status === 'active').length,
        needsAction: tracker.air.filter(p => p.status !== 'active').length,
        expired: tracker.air.filter(p => p.status === 'expired').length,
        newRequired: tracker.air.filter(p => p.status === 'new_required').length,
        resubmitRequired: tracker.air.filter(p => p.status === 'resubmit_required').length,
      },
      water: {
        total: tracker.water.length,
        active: tracker.water.filter(p => p.status === 'active').length,
        needsAction: tracker.water.filter(p => p.status !== 'active').length,
        expired: tracker.water.filter(p => p.status === 'expired').length,
        newRequired: tracker.water.filter(p => p.status === 'new_required').length,
        resubmitRequired: tracker.water.filter(p => p.status === 'resubmit_required').length,
      },
      building: {
        total: tracker.building.length,
        active: tracker.building.filter(p => p.status === 'active').length,
        needsAction: tracker.building.filter(p => p.status !== 'active').length,
        expired: tracker.building.filter(p => p.status === 'expired').length,
        newRequired: tracker.building.filter(p => p.status === 'new_required').length,
        resubmitRequired: tracker.building.filter(p => p.status === 'resubmit_required').length,
      },
      power: {
        total: tracker.power.length,
        active: tracker.power.filter(p => p.status === 'active').length,
        needsAction: tracker.power.filter(p => p.status !== 'active').length,
        expired: tracker.power.filter(p => p.status === 'expired').length,
        newRequired: tracker.power.filter(p => p.status === 'new_required').length,
        resubmitRequired: tracker.power.filter(p => p.status === 'resubmit_required').length,
      },
    },
  };

  return summary;
}

export { PERMIT_TYPES, DEFAULT_PREVIOUS_SUBMISSIONS };
export default { getPermitTracker, getTrackerSummary, PERMIT_TYPES };
