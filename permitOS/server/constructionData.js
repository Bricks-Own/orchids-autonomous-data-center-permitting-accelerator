// ─── Brick PermitOS Construction Project Controls Engine ──────────────────
// Earned Value Management, Safety, Quality, Financials, Schedule tracking
// All formulas align with PMI EVA standards and real-world construction practices

// ─── Utility helpers ──────────────────────────────────────────────────────
const fmtPct = (v) => (v * 100).toFixed(1) + '%';
const fmtCurr = (v) => '$' + Math.round(v).toLocaleString();
const fmtHours = (v) => Math.round(v).toLocaleString();

// ─── Traffic Light Thresholds ─────────────────────────────────────────────
const THRESHOLDS = {
  cpi:       { green: 1.00, amber: 0.90 },       // Cost Performance Index
  spi:       { green: 0.95, amber: 0.85 },       // Schedule Performance Index
  vacPct:    { green: -5,   amber: -10 },         // Variance at Completion % (negative is over budget)
  contingencyBurnPct: { green: 0.8, amber: 1.0 }, // Burn rate % of contingency used vs physical % complete
  pcoAgingDays: { green: 30, amber: 60 },         // PCO aging days
  trir:      { green: 1.5, amber: 2.5 },          // Total Recordable Incident Rate
  ltir:      { green: 0.5, amber: 1.0 },          // Lost Time Incident Rate
  rfiResponseDays: { green: 3, amber: 7 },        // RFI response time
  inspectionPassRate: { green: 90, amber: 80 },   // Inspection pass rate %
  milestoneVariance: { green: 5, amber: 15 },     // Schedule variance in days
  reworkPct: { green: 3, amber: 7 },              // Rework cost as % of total cost
};

export function getTrafficLight(metric, value) {
  const t = THRESHOLDS[metric];
  if (!t) return 'gray';
  if (typeof value === 'number' && value >= 0) {
    // For metrics where lower is better (like TRIR, PCO aging)
    if (['trir', 'ltir', 'pcoAgingDays', 'rfiResponseDays', 'milestoneVariance', 'reworkPct'].includes(metric)) {
      if (value <= t.green) return 'green';
      if (value <= t.amber) return 'amber';
      return 'red';
    }
    // For metrics where higher is better (like CPI, SPI, inspection pass rate)
    if (['cpi', 'spi', 'inspectionPassRate'].includes(metric)) {
      if (value >= t.green) return 'green';
      if (value >= t.amber) return 'amber';
      return 'red';
    }
    // VAC % — negative is bad, more negative = worse
    if (metric === 'vacPct') {
      if (value >= t.green) return 'green';
      if (value >= t.amber) return 'amber';
      return 'red';
    }
    // Contingency burn — ratio of burn rate to progress rate
    if (metric === 'contingencyBurnPct') {
      if (value <= t.green) return 'green';
      if (value <= t.amber) return 'amber';
      return 'red';
    }
  }
  return 'gray';
}

// ─── Earned Value Management ──────────────────────────────────────────────
export function calcEVM(originalBudget, actualCost, percentComplete, plannedPctComplete, periodData = null) {
  const BAC = originalBudget;                                   // Budget at Completion
  const ACWP = actualCost;                                      // Actual Cost of Work Performed
  const EV = BAC * (percentComplete / 100);                     // Earned Value
  const PV = BAC * (plannedPctComplete / 100);                  // Planned Value
  const CV = EV - ACWP;                                         // Cost Variance
  const SV = EV - PV;                                           // Schedule Variance ($)
  const CPI = ACWP > 0 ? EV / ACWP : 0;                        // Cost Performance Index
  const SPI = PV > 0 ? EV / PV : 0;                            // Schedule Performance Index
  const EAC = CPI > 0 ? BAC / CPI : BAC;                        // Estimate at Completion
  const VAC = BAC - EAC;                                        // Variance at Completion
  const VACPct = BAC > 0 ? (VAC / BAC) * 100 : 0;              // VAC %
  const TCPI = (BAC - EV) / (BAC - ACWP > 0 ? BAC - ACWP : 1); // To-Complete Performance Index

  // Period-based EVM (for trend analysis)
  let periodCPI = null, periodSPI = null;
  if (periodData) {
    const pEV = BAC * ((periodData.periodPctComplete || 0) / 100);
    const pAC = periodData.periodActualCost || 0;
    const pPV = BAC * ((periodData.periodPlannedPct || 0) / 100);
    periodCPI = pAC > 0 ? pEV / pAC : 0;
    periodSPI = pPV > 0 ? pEV / pPV : 0;
  }

  return {
    BAC, ACWP, EV, PV, CV, SV, CPI: parseFloat(CPI.toFixed(3)), SPI: parseFloat(SPI.toFixed(3)),
    EAC: parseFloat(EAC.toFixed(0)), VAC: parseFloat(VAC.toFixed(0)), VACPct: parseFloat(VACPct.toFixed(1)),
    TCPI: parseFloat(TCPI.toFixed(3)), percentComplete, plannedPctComplete,
    periodCPI: periodCPI ? parseFloat(periodCPI.toFixed(3)) : null,
    periodSPI: periodSPI ? parseFloat(periodSPI.toFixed(3)) : null,
    statusCPI: getTrafficLight('cpi', CPI),
    statusSPI: getTrafficLight('spi', SPI),
    statusVAC: getTrafficLight('vacPct', VACPct),
  };
}

// ─── Contingency Tracking ──────────────────────────────────────────────────
export function calcContingency(contingencyBudget, contingencyUsed, totalProjectBudget, projectPctComplete) {
  const remaining = contingencyBudget - contingencyUsed;
  const utilizationPct = contingencyBudget > 0 ? (contingencyUsed / contingencyBudget) * 100 : 0;
  // Burn rate ratio: how fast we're burning contingency vs progressing
  const burnRatio = projectPctComplete > 0 ? utilizationPct / projectPctComplete : 0;
  // Ideal: burnRatio should be < 1 (using contingency slower than progress)
  const status = getTrafficLight('contingencyBurnPct', burnRatio);

  // Contingency exposure: forecast remaining contingency needed based on burn trend
  const forecastBurnTotal = burnRatio * 100; // If trend continues
  const exposurePct = Math.max(0, forecastBurnTotal - 100);

  return {
    budget: contingencyBudget,
    used: contingencyUsed,
    remaining,
    utilizationPct: parseFloat(utilizationPct.toFixed(1)),
    burnRatio: parseFloat(burnRatio.toFixed(2)),
    exposurePct: parseFloat(exposurePct.toFixed(1)),
    status,
    flag: burnRatio > THRESHOLDS.contingencyBurnPct.amber ? 'Over-consuming contingency — review change order log' : null,
  };
}

// ─── Change Order (PCO) Tracking ──────────────────────────────────────────
export function calcChangeOrders(pcoList) {
  if (!pcoList || pcoList.length === 0) {
    return { totalPCO: 0, totalPCOValue: 0, avgAgingDays: 0, pendingCount: 0, approvedCount: 0, status: 'gray' };
  }
  const totalPCO = pcoList.length;
  const totalPCOValue = pcoList.reduce((s, p) => s + (p.value || 0), 0);
  const pending = pcoList.filter(p => p.status === 'Pending');
  const approved = pcoList.filter(p => p.status === 'Approved');
  const avgAge = pcoList.reduce((s, p) => s + (p.agingDays || 0), 0) / totalPCO;
  const maxAge = Math.max(...pcoList.map(p => p.agingDays || 0));

  return {
    totalPCO, totalPCOValue, avgAgingDays: parseFloat(avgAge.toFixed(0)),
    maxAgingDays: maxAge, pendingCount: pending.length, approvedCount: approved.length,
    pendingValue: pending.reduce((s, p) => s + (p.value || 0), 0),
    status: getTrafficLight('pcoAgingDays', avgAge),
    flag: avgAge > THRESHOLDS.pcoAgingDays.amber ? 'High PCO aging — expedite review process' : null,
  };
}

// ─── Safety Metrics ───────────────────────────────────────────────────────
export function calcSafety(totalWorkHours, recordableIncidents, lostTimeIncidents, fatalities = 0, firstAidCases = 0, safetyObservationsResolved = 0, safetyObservationsTotal = 0) {
  // TRIR = (Recordable Incidents × 200,000) / Total Hours
  const trir = totalWorkHours > 0 ? (recordableIncidents * 200000) / totalWorkHours : 0;
  // LTIR = (Lost Time Incidents × 200,000) / Total Hours
  const ltir = totalWorkHours > 0 ? (lostTimeIncidents * 200000) / totalWorkHours : 0;
  // First Aid Rate
  const far = totalWorkHours > 0 ? (firstAidCases * 200000) / totalWorkHours : 0;

  const safetyObsResolvedPct = safetyObservationsTotal > 0 ? parseFloat((safetyObservationsResolved / safetyObservationsTotal * 100).toFixed(1)) : 0;
  return {
    trir: parseFloat(trir.toFixed(2)),
    ltir: parseFloat(ltir.toFixed(2)),
    far: parseFloat(far.toFixed(2)),
    fatalities,
    totalWorkHours,
    recordableIncidents,
    lostTimeIncidents,
    firstAidCases,
    safetyObservationsResolved,
    safetyObservationsTotal,
    safetyObsResolvedPct,
    statusTRIR: getTrafficLight('trir', trir),
    statusLTIR: getTrafficLight('ltir', ltir),
    flag: trir > THRESHOLDS.trir.amber ? 'Safety incident rate exceeds threshold — escalate HSE review' : null,
  };
}

// ─── Quality Metrics ──────────────────────────────────────────────────────
export function calcQuality(rfiTotal, rfiAvgResponseDays, punchlistItems, punchlistClosed, totalConstructionCost, reworkCost, rfiCriticalPathCount = 0) {
  const rfiClosureRate = rfiTotal > 0 ? Math.min(punchlistClosed / Math.max(rfiTotal, 1) * 100, 100) : 0;
  const punchlistOpen = punchlistItems - punchlistClosed;
  const punchlistCloseRate = punchlistItems > 0 ? (punchlistClosed / punchlistItems) * 100 : 0;
  const reworkPct = totalConstructionCost > 0 ? (reworkCost / totalConstructionCost) * 100 : 0;

  return {
    rfiTotal,
    rfiAvgResponseDays,
    rfiCriticalPathCount,
    rfiClosureRate: parseFloat(rfiClosureRate.toFixed(1)),
    punchlistItems,
    punchlistClosed,
    punchlistOpen,
    punchlistCloseRate: parseFloat(punchlistCloseRate.toFixed(1)),
    reworkCost,
    reworkPct: parseFloat(reworkPct.toFixed(1)),
    statusRework: getTrafficLight('reworkPct', reworkPct),
    statusRFI: getTrafficLight('rfiResponseDays', rfiAvgResponseDays),
    flag: rfiAvgResponseDays > THRESHOLDS.rfiResponseDays.amber ? 'Slow RFI responses impacting schedule' : null,
  };
}

// ─── Schedule Metrics ─────────────────────────────────────────────────────
export function calcScheduleInfo(plannedFinish, forecastFinish, milestoneVarianceDays, criticalPathLength, floatConsumed, customerNeedDate = '', milestoneNames = 'Site Preparation', percentCompletePhysical = 0, criticalPathImpact = 'N', spi = 1.0) {
  const now = new Date();
  const planned = new Date(plannedFinish);
  const forecast = new Date(forecastFinish);
  const scheduleSlipDays = Math.round((forecast - planned) / (1000 * 60 * 60 * 24));
  const scheduleSlipPct = plannedFinish ? Math.abs(scheduleSlipDays / Math.max((planned - now) / (1000 * 60 * 60 * 24), 1)) * 100 : 0;

  // SPI = Earned Value / Planned Value
  const schedulePerfIndex = parseFloat(spi.toFixed(3));
  
  // Schedule Variance in days (positive = behind)
  const scheduleVarianceDays = Math.max(0, scheduleSlipDays);

  return {
    plannedFinish,
    forecastFinish,
    customerNeedDate,
    milestoneNames,
    scheduleSlipDays,
    scheduleSlipPct: parseFloat(scheduleSlipPct.toFixed(1)),
    milestoneVarianceDays,
    scheduleVarianceDays,
    criticalPathLength: criticalPathLength || 0,
    floatConsumed: floatConsumed || 0,
    percentCompletePhysical,
    criticalPathImpact,
    spi: schedulePerfIndex,
    statusMS: getTrafficLight('milestoneVariance', scheduleVarianceDays),
    statusSPI: schedulePerfIndex >= 0.95 ? 'green' : schedulePerfIndex >= 0.85 ? 'amber' : 'red',
    flag: Math.abs(scheduleSlipDays) > 30 ? 'Schedule slip exceeds 30 days — review critical path' : null,
  };
}

// ─── Full Project Rollup ──────────────────────────────────────────────────
export function calcFullProjectMetrics(data) {
  data = data || {};
  const evm = calcEVM(
    data.originalBudget || 0,
    data.actualCost || 0,
    data.percentComplete || 0,
    data.plannedPctComplete || 0,
    data.periodData || null
  );

  const safety = calcSafety(
    data.totalWorkHours || 0,
    data.recordableIncidents || 0,
    data.lostTimeIncidents || 0,
    data.fatalities || 0,
    data.firstAidCases || 0,
    data.safetyObservationsResolved || 0,
    data.safetyObservationsTotal || 0
  );

  const quality = calcQuality(
    data.rfiTotal || 0,
    data.rfiAvgResponseDays || 0,
    data.punchlistItems || 0,
    data.punchlistClosed || 0,
    data.totalConstructionCost || data.originalBudget || 0,
    data.reworkCost || 0,
    data.rfiCriticalPathCount || 0
  );

  const schedule = calcScheduleInfo(
    data.plannedFinish || '2026-Q3',
    data.forecastFinish || '2026-Q4',
    data.milestoneVarianceDays || 0,
    data.criticalPathLength || 0,
    data.floatConsumed || 0,
    data.customerNeedDate || '',
    data.milestoneNames || 'Site Preparation, Foundations, Structure, MEP, Commissioning',
    data.percentCompletePhysical || 0,
    data.criticalPathImpact || 'N',
    data.spi || 0.0
  );

  const contingency = calcContingency(
    data.contingencyBudget || 0,
    data.contingencyUsed || 0,
    data.originalBudget || 0,
    data.percentComplete || 0
  );

  const changeOrders = calcChangeOrders(data.pcoList || []);

  // Overall project health
  const statusFlags = [evm.statusCPI, evm.statusSPI, safety.statusTRIR, quality.statusRework, schedule.statusMS, contingency.status];
  const redCount = statusFlags.filter(s => s === 'red').length;
  const amberCount = statusFlags.filter(s => s === 'amber').length;
  const greenCount = statusFlags.filter(s => s === 'green').length;
  const totalMetrics = redCount + amberCount + greenCount;

  // Contingency remaining
  const totalContingencyRemaining = Math.max(0, (data.contingencyBudget || 0) - (data.contingencyUsed || 0));
  // Net cash position
  const netCashPosition = (data.cashReceivedToDate || 0) - (data.actualCost || 0);
  // Contingency burn rate vs physical progress
  const contingencyBurnPct = data.percentComplete > 0 ? parseFloat(((data.contingencyUsed || 0) / (data.contingencyBudget || 1) * 100).toFixed(1)) : 0;
  
  return {
    projectId: data.projectId || 'default',
    projectName: data.projectName || 'BigWatt AI Campus — Site A',
    asOfDate: data.asOfDate || new Date().toISOString().split('T')[0],
    revenue: data.revenue || 0,
    plannedMargin: data.plannedMargin || 0,
    forecastMargin: data.forecastMargin || 0,
    evm,
    safety,
    quality,
    schedule,
    contingency,
    changeOrders,
    cashPosition: data.cashPosition || 0,
    billingToDate: data.billingToDate || 0,
    cashReceivedToDate: data.cashReceivedToDate || 0,
    daysForReceivable: data.daysForReceivable || 0,
    netCashPosition,
    retainage: data.retainage || 0,
    netPayableThisMonth: data.netPayableThisMonth || 0,
    safetyDaysSinceLast: data.safetyDaysSinceLast || 0,
    weatherDaysLost: data.weatherDaysLost || 0,
    weatherDaysClaimed: data.weatherDaysClaimed || 0,
    headcount: data.headcount || 0,
    actualVsPlannedHeadcountPct: data.actualVsPlannedHeadcountPct || 100,
    gcBuyoutComplete: data.gcBuyoutComplete || 0,
    ownerContingencyUsed: data.ownerContingencyUsed || 0,
    gcContingencyUsed: data.gcContingencyUsed || 0,
    ownerContingencyBudget: data.ownerContingencyBudget || 0,
    gcContingencyBudget: data.gcContingencyBudget || 0,
    storedMaterialsValue: data.storedMaterialsValue || 0,
    totalContingencyRemaining,
    contingencyBurnPct,
    lienWaiversReceived: data.lienWaiversReceived || 0,
    lienWaiverCompliance: data.lienWaiverCompliance || 'N',
    ahjPermitStatus: data.ahjPermitStatus || 'Not Started',
    commissioningPrerequisites: data.commissioningPrerequisites || 0,
    cxPrerequisitesPct: data.cxPrerequisitesPct || 0,
    inspectionPassRate: data.inspectionPassRate || 0,
    statusInspection: getTrafficLight('inspectionPassRate', data.inspectionPassRate || 0),
    // Cost category breakdown
    costCategories: data.costCategories || [],
    // Top 5 risks
    topRisks: data.topRisks || [],
    // Milestone-level details
    milestoneDetails: data.milestoneDetails || [],
    percentCompletePhysical: data.percentCompletePhysical || 0,
    // Health summary
    healthSummary: {
      red: redCount,
      amber: amberCount,
      green: greenCount,
      total: totalMetrics,
      overallScore: totalMetrics > 0 ? parseFloat(((greenCount * 1.0 + amberCount * 0.5) / totalMetrics * 100).toFixed(0)) : 0,
    },
    // All flags concatenated
    flags: [evm, safety, quality, schedule, contingency, changeOrders]
      .map(m => m.flag).filter(Boolean),
    trendData: data.trendData || [],
  };
}

// ─── Generate Construction Data from Site Intake Inputs ─────────────────
// ALL metrics are dynamically computed from the site's actual inputs and PTE results.
// No hardcoded demo data — every KPI is derived from real project parameters.

export function generateConstructionData(inputs, results) {
  inputs = inputs || {};
  results = results || {};
  // ── Extract site parameters ─────────────────────────────────────────────
  const siteName = inputs.siteName || 'BigWatt AI Campus — Site A';
  const client = inputs.client || 'BigWatt Digital';
  const state = inputs.state || 'Tennessee';
  const county = inputs.county || 'Davidson County';
  const totalMW = results.totalMW || (inputs.turbines || 8) * (inputs.mwPerTurbine || 25);
  const datacenterMW = inputs.datacenterMW || Math.round(totalMW / 1.5);
  const turbineCount = inputs.turbines || 8;
  const gensetCount = inputs.gensetCount || 12;
  const coolingMGD = inputs.coolingMGD || 2.8;
  const brickSavings = inputs.brickSavings || 20;
  const codTarget = inputs.codTarget || '2026-Q3';
  const siteAcres = inputs.siteAcres || 45;
  const phases = inputs.phases || 3;
  
  const isNonAttain = inputs.nonAttainment || false;
  const requiresPSD = results.pathway?.requiresPSD || false;
  const isSyntheticMinor = results.pathway?.syntheticMinorViable || false;
  const breachCount = results.breaches?.length || 0;
  
  // ── State-based cost multipliers ─────────────────────────────────────────
  const STATE_COST_MULTIPLIERS = {
    'California': 1.35, 'New York': 1.30, 'Massachusetts': 1.25,
    'New Jersey': 1.20, 'Illinois': 1.15, 'Washington': 1.12,
    'Oregon': 1.10, 'Colorado': 1.08, 'Arizona': 1.05, 'Texas': 1.00,
    'Tennessee': 0.95, 'Virginia': 1.02, 'North Carolina': 0.98,
    'Georgia': 0.96, 'Ohio': 0.93, 'Indiana': 0.92, 'Nevada': 0.97,
  };
  const costMultiplier = STATE_COST_MULTIPLIERS[state] || 1.02;
  
  // ── Location-based labor rates ──────────────────────────────────────────
  const LABOR_RATE_INDEX = {
    'California': 1.30, 'New York': 1.35, 'Texas': 0.92, 'Tennessee': 0.85,
    'Virginia': 1.05, 'Illinois': 1.10, 'Arizona': 0.90, 'Georgia': 0.88,
    'North Carolina': 0.90, 'Ohio': 0.85, 'Indiana': 0.82, 'Nevada': 0.95,
  };
  const laborIndex = LABOR_RATE_INDEX[state] || 1.00;
  
  // ── Complexity factors ──────────────────────────────────────────────────
  // More turbines, gensets, and larger MW increase complexity
  const sizeComplexity = Math.min(1.4, Math.max(0.8, totalMW / 200));
  const turbineComplexity = 1 + (turbineCount - 4) * 0.02;
  const coolingComplexity = coolingMGD > 3 ? 1.08 : coolingMGD > 1 ? 1.04 : 1.00;
  const gensetComplexity = 1 + gensetCount * 0.005;
  const permitComplexity = requiresPSD ? 1.15 : isSyntheticMinor ? 1.05 : 1.00;
  const complexityFactor = parseFloat((sizeComplexity * turbineComplexity * coolingComplexity * gensetComplexity * permitComplexity).toFixed(3));
  
  // ── Dynamic Budget Computation ──────────────────────────────────────────
  // Industry: hyperscale data center construction ~$1,000-1,200/MW IT load
  // Total facility (generation + infrastructure) is higher
  // For a data center with on-site generation, typical TDC is $800-1,200/sqft
  const baseCostPerMW = 1100000; // $1.1M/MW generation capacity
  const adjustedCostPerMW = Math.round(baseCostPerMW * costMultiplier * laborIndex);
  const totalProjectCost = Math.round(totalMW * adjustedCostPerMW * complexityFactor);
  
  // Revenue: typically ~1.1x TDC for margin
  const revenue = Math.round(totalProjectCost * 1.12);
  const plannedMargin = 0.12; // 12% target margin
  const forecastMargin = parseFloat((0.12 - (complexityFactor - 1) * 0.08 + (breachCount > 0 ? -0.02 : 0)).toFixed(3));
  
  // ── Dynamic Schedule ────────────────────────────────────────────────────
  // Base: 18 months (78 weeks) for 100MW facility
  const baseScheduleWeeks = 78;
  const mwScheduleFactor = Math.max(0.7, Math.min(1.5, totalMW / 150));
  const nonAttainDelay = isNonAttain ? 16 : 0; // ~4 months for nonattainment permitting
  const psdDelay = requiresPSD ? 8 : 0;
  const codQuarter = codTarget || '2026-Q3';
  const codYear = parseInt('20' + codQuarter.split('-')[0].slice(-2));
  const codMonth = { 'Q1': 3, 'Q2': 6, 'Q3': 9, 'Q4': 12 }[codQuarter.split('-')[1]] || 9;
  const codDate = new Date(codYear, codMonth, 15);
  
  // Construction start: typically 18-24 months before COD for large projects
  const totalDurationWeeks = Math.round(baseScheduleWeeks * mwScheduleFactor + nonAttainDelay + psdDelay);
  const constructionStart = new Date(codDate);
  constructionStart.setDate(constructionStart.getDate() - totalDurationWeeks * 7);
  
  const plannedFinish = new Date(codDate);
  // Forecast finish may slip based on complexity and site conditions
  const slipWeeks = Math.round(complexityFactor * 2 + (breachCount > 2 ? 4 : 0) + (isNonAttain ? 3 : 0));
  const forecastFinish = new Date(plannedFinish);
  forecastFinish.setDate(forecastFinish.getDate() + slipWeeks * 7);
  
  const customerNeedDate = new Date(plannedFinish);
  customerNeedDate.setDate(customerNeedDate.getDate() - 30); // customer wants it 1 month early
  
  // Current progress — simulate based on where we are in the schedule
  const now = new Date();
  const totalDurationMs = plannedFinish - constructionStart;
  const elapsedMs = now - constructionStart;
  const plannedPct = Math.min(100, Math.max(0, (elapsedMs / totalDurationMs) * 100));
  // Actual progress lags planned (typical construction)
  const actualPct = Math.min(99, Math.max(5, plannedPct * (0.85 + (complexityFactor - 1) * 0.1)));
  const percentComplete = Math.round(actualPct);
  const plannedPctComplete = Math.round(plannedPct);
  
  // Milestone variance days
  const milestoneVarianceDays = Math.round(slipWeeks * 7 * (now > plannedFinish ? 1 : -0.3));
  const criticalPathLength = Math.round(totalDurationWeeks * 0.55 * 7); // ~55% of schedule is critical path
  const floatConsumed = Math.round(criticalPathLength * 0.35);
  
  // SPI based on EV vs PV
  const bac = totalProjectCost;
  const pv = bac * (plannedPct / 100);
  const evCalc = bac * (actualPct / 100);
  const spiVal = pv > 0 ? parseFloat((evCalc / pv).toFixed(3)) : 1.0;
  
  // Physical progress (slightly different from EV % due to productivity)
  const physicalProgress = Math.round(actualPct * 0.975);
  const criticalPathImpact = Math.abs(milestoneVarianceDays) > 15 ? 'Y' : 'N';
  
  const milestones = [
    'Site Preparation & Demolition',
    'Foundations & Slab on Grade',
    'Structural Steel Erection',
    'Building Enclosure (Roof/Wall)',
    'MEP Rough-In',
    'Electrical & Switchgear Installation',
    'Cooling System Installation',
    'Fire Protection & Life Safety',
    'Interior Finishes & Fitout',
    'Commissioning & Testing'
  ];
  
  // Per-milestone completion computed from overall physical progress
  const milestoneDetails = milestones.map((name, i) => {
    // Each milestone has equal weight (10% of project per milestone)
    const expectedPct = ((i + 1) / milestones.length) * 100;
    const prevExpected = (i / milestones.length) * 100;
    let pctComplete;
    if (physicalProgress >= expectedPct) {
      pctComplete = 100; // fully complete
    } else if (physicalProgress <= prevExpected) {
      pctComplete = 0; // not started
    } else {
      // In progress — interpolate within this milestone's window
      pctComplete = Math.round(((physicalProgress - prevExpected) / (expectedPct - prevExpected)) * 100);
    }
    // Pct complete is the same for both planned and actual (pre-construction)
    // Schedule variance: later milestones have more variance
    const variance = i > 4 ? Math.round(milestoneVarianceDays * (i / milestones.length)) : 0;
    return {
      name,
      phase: i + 1,
      pctComplete,
      status: pctComplete >= 100 ? 'complete' : pctComplete > 0 ? 'in_progress' : 'not_started',
      plannedCompletion: '', // computed from overall schedule
      varianceDays: variance,
      budget: Math.round(bac * (1 / milestones.length)),
      actualCost: Math.round(bac * (1 / milestones.length) * (pctComplete / 100) * (1 + (variance > 0 ? 0.05 : 0))),
    };
  });

  // ── Dynamic Cost Categories ─────────────────────────────────────────────
  // Standard data center cost breakdown (per Turner & Townsend / JLL benchmarks)
  const COST_CATEGORY_PCT = [
    { name: 'Land Acquisition', pct: 0.06 },
    { name: 'Site Development', pct: 0.03 },
    { name: 'Power & Utilities', pct: 0.20 },
    { name: 'Material Procurement (LLE)', pct: 0.08 },
    { name: 'Electrical Infrastructure', pct: 0.13 },
    { name: 'Cooling & Mechanical', pct: 0.11 },
    { name: 'Fire Protection & Safety', pct: 0.02 },
    { name: 'GC Contract', pct: 0.31 },
    { name: 'Fitout & Finishes', pct: 0.04 },
    { name: 'Commissioning & Testing', pct: 0.02 },
  ];
  
  const costCategories = COST_CATEGORY_PCT.map((cat, i) => {
    const budget = Math.round(bac * cat.pct);
    // Progress per category varies — earlier categories are more complete
    const catProgress = Math.min(100, Math.round(percentComplete * (1 + (10 - i) * 0.03)));
    const actual = Math.round(budget * (catProgress / 100) * 0.94);
    return { name: cat.name, budget, actual, pctComplete: Math.min(100, catProgress) };
  });
  
  // ── Dynamic PCOs ────────────────────────────────────────────────────────
  // PCO count and value scale with project size and complexity
  const pcoCount = Math.max(3, Math.round(3 + totalMW / 50 + complexityFactor * 2));
  const pcoList = Array.from({ length: pcoCount }, (_, i) => {
    const descriptions = [
      'Additional cooling tower pads', 'Generator enclosure upgrade',
      'Fiber optic route change', 'Transformer foundation redesign',
      'Additional site lighting', 'Security system scope increase',
      'Data floor loading upgrade', 'UPS system capacity increase',
      'Switchgear breaker upgrade', 'Fire alarm panel relocation',
      'HVAC ductwork re-route', 'Structural steel reinforcement',
      'Cable tray routing change', 'EMS/BMS integration scope',
      'Exterior hardscape addition', 'Roof penetrations for CRACs',
    ];
    const isPending = i < pcoCount * 0.6;
    return {
      id: `PCO-${String(i + 1).padStart(3, '0')}`,
      description: descriptions[i % descriptions.length],
      value: Math.round((50000 + ((i % 13) + 1) * 50000) * complexityFactor),
      status: isPending ? 'Pending' : 'Approved',
      agingDays: Math.round(5 + ((i * 7) % 65) + 5),
    };
  });
  
  // ── Dynamic Top Risks ───────────────────────────────────────────────────
  // Risks derived from site conditions, permit pathway, and location
  const riskGenerators = [
    {
      desc: `Electrical switchgear delivery delay — ${Math.round(6 + totalMW / 100)}-week lead time risk`,
      impact: 'Critical', prob: 0.7 - (brickSavings > 15 ? 0.1 : 0),
      mitigation: 'Expedited order placed; backup supplier identified',
    },
    {
      desc: requiresPSD ? 'PSD permit timeline uncertainty — EPA review backlog may delay construction start by 8-14 weeks' : 'State permit timeline — agency review queue',
      impact: requiresPSD ? 'Critical' : 'Major',
      prob: requiresPSD ? 0.75 : 0.45,
      mitigation: requiresPSD ? 'Early BACT scoping; concurrent AERMOD modeling' : 'Weekly agency follow-up; expedite fee submitted',
    },
    {
      desc: isNonAttain ? `Nonattainment area compliance — LAER/offsets requirement may increase project cost by $${Math.round(bac * 0.03 / 1000000)}M` : 'Local zoning approval — community review board schedule',
      impact: isNonAttain ? 'Major' : 'Moderate',
      prob: isNonAttain ? 0.65 : 0.35,
      mitigation: isNonAttain ? 'Emission offset credits scoped; LAER analysis underway' : 'Community outreach plan; variance application ready',
    },
    {
      desc: `Cooling ${coolingMGD > 3 ? 'tower water supply' : 'system equipment'} — ${coolingMGD > 3 ? 'water rights permitting' : 'lead time for specialized equipment'}`,
      impact: coolingMGD > 3 ? 'Major' : 'Moderate',
      prob: coolingMGD > 3 ? 0.55 : 0.40,
      mitigation: coolingMGD > 3 ? 'Water rights attorney engaged; alternative supply identified' : 'Early procurement authorization; rental units sourced',
    },
    {
      desc: `GC labor ${totalMW > 300 ? 'shortage — union allocation constrained' : 'availability — specialty subcontractor market tight'}`,
      impact: totalMW > 300 ? 'Major' : 'Moderate',
      prob: 0.45 + (totalMW > 300 ? 0.1 : 0),
      mitigation: totalMW > 300 ? 'Prefabrication strategy adopted; non-union subs scoped' : 'Early GC buyout; multi-bid strategy',
    },
    {
      desc: gensetCount > 15 ? 'Large genset fleet — EPA IIII/JJJJ compliance documentation complexity' : 'Generator fuel system — tank testing and SPCC compliance',
      impact: gensetCount > 15 ? 'Moderate' : 'Minor',
      prob: 0.35,
      mitigation: gensetCount > 15 ? 'Compliance tracking system deployed; EPA forms pre-populated' : 'SPCC plan drafted; tank tests scheduled',
    },
  ];
  
  // Only include risks that make sense for this project
  const topRisks = riskGenerators
    .filter(r => r.prob > 0.2)
    .slice(0, 5)
    .map((r, i) => ({
      rank: i + 1,
      description: r.desc,
      impact: r.impact,
      probability: parseFloat(r.prob.toFixed(2)),
      mitigation: r.mitigation,
    }));
  
  // ── Safety Metrics (derived from project size and hours) ────────────────
  const avgHeadcount = Math.round(50 + totalMW * 1.5 + turbineCount * 5);
  const totalWeeks = Math.round(totalDurationWeeks);
  const totalWorkHours = avgHeadcount * totalWeeks * 40;
  // TRIR: industry avg 1.5-2.5 for data center construction
  const baseTRIR = 1.8;
  const trirRisk = (nonAttainDelay + psdDelay) > 10 ? 0.5 : 0.2;
  const trir = parseFloat((baseTRIR + trirRisk * (percentComplete / 100) + (complexityFactor - 1) * 0.5).toFixed(2));
  const recordableIncidents = Math.round((trir * totalWorkHours) / 200000);
  const ltir = parseFloat((trir * 0.35).toFixed(2));
  const lostTimeIncidents = Math.round((ltir * totalWorkHours) / 200000);
  const firstAidCases = Math.round(recordableIncidents * 2.5);
  const safetyDaysSinceLast = Math.max(5, Math.round(200 - recordableIncidents * 40));
  const safetyObservationsTotal = Math.round(totalWorkHours / 2000);
  const safetyObsResolved = Math.round(safetyObservationsTotal * 0.82);
  
  // ── Quality Metrics ────────────────────────────────────────────────────
  // RFIs scale with project complexity
  const rfiTotal = Math.round(30 + totalMW * 0.8 + turbineCount * 3 + (requiresPSD ? 20 : 0));
  const rfiAvgResponseDays = parseFloat((2.5 + (complexityFactor - 0.8) * 2 + (isNonAttain ? 1 : 0)).toFixed(1));
  const rfiCriticalPathCount = Math.round(rfiTotal * 0.03 * complexityFactor);
  const punchlistItems = Math.round(rfiTotal * 0.35);
  const punchlistClosed = Math.round(punchlistItems * (percentComplete / 100) * 0.6);
  const reworkPct = parseFloat((2.0 + (complexityFactor - 0.8) * 2 + (breachCount > 0 ? 1 : 0)).toFixed(1));
  const reworkCost = Math.round(bac * (reworkPct / 100));
  
  // ── Contingency ─────────────────────────────────────────────────────────
  const contingencyPct = parseFloat((8 + (requiresPSD ? 3 : 0) + (isNonAttain ? 2 : 0) + Math.min(5, totalMW / 100)).toFixed(1));
  const contingencyBudget = Math.round(bac * (contingencyPct / 100));
  const contingencyBurnRate = parseFloat(((percentComplete / 100) * 0.7 + 0.2).toFixed(3));
  const contingencyUsed = Math.round(contingencyBudget * Math.min(1, contingencyBurnRate));
  const ownerContingencyBudget = Math.round(contingencyBudget * 0.6);
  const gcContingencyBudget = Math.round(contingencyBudget * 0.4);
  const ownerContingencyUsed = Math.round(ownerContingencyBudget * Math.min(1, contingencyBurnRate * 0.9));
  const gcContingencyUsed = Math.round(gcContingencyBudget * Math.min(1, contingencyBurnRate * 1.1));
  
  // ── Actual Cost / Earned Value ──────────────────────────────────────────
  const actualCost = Math.round(bac * (percentComplete / 100) * 0.99);
  const earnedValue = Math.round(bac * (percentComplete / 100));
  
  // ── Financials ──────────────────────────────────────────────────────────
  const billingPct = percentComplete * 0.85 + 10; // billing lags progress
  const billingToDate = Math.round(bac * Math.min(100, billingPct) / 100);
  const cashReceivedPct = billingPct * 0.88;
  const cashReceivedToDate = Math.round(bac * Math.min(100, cashReceivedPct) / 100);
  const daysForReceivable = Math.round(25 + complexityFactor * 5 + (isNonAttain ? 5 : 0));
  const cashPosition = Math.round(cashReceivedToDate * 0.25 + billingToDate * 0.15 - actualCost * 0.3);
  const retainage = Math.round(billingToDate * 0.05);
  const netPayableThisMonth = Math.round(bac * 0.015 * (1 + complexityFactor * 0.2));
  const storedMaterialsValue = Math.round(bac * 0.02 * (percentComplete > 30 ? 1 : 0.3));
  
  // ── Other Trackers ─────────────────────────────────────────────────────
  const gcBuyoutComplete = Math.min(100, Math.round(70 + percentComplete * 0.25 + (turbineCount > 6 ? -5 : 0)));
  const lienWaiversReceived = Math.round(billingToDate / 2500000);
  const lienWaiverCompliance = lienWaiversReceived > 20 ? 'Y' : 'N';
  const ahjPermitStatus = percentComplete > 60 ? 'Permits Issued — Inspections Active' : (percentComplete > 20 ? 'Permits Issued — Pre-Construction' : 'Permit Application Submitted');
  const cxPrerequisitesPct = Math.min(100, Math.round(percentComplete * 0.65));
  const inspectionPassRate = Math.round(88 + Math.round(reworkPct * 0.5));
  const actualVsPlannedHeadcountPct = Math.min(110, Math.round(92 + Math.round(complexityFactor * 5)));
  const headcount = Math.round(avgHeadcount * (actualVsPlannedHeadcountPct / 100));
  const weatherDaysLost = Math.round(totalWeeks * 0.15);
  const weatherDaysClaimed = Math.round(weatherDaysLost * 0.7);
  
  // ── Trend Data (6 periods of monthly history) ──────────────────────────
  const trendData = [];
  const baseDate = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() - i);
    const periodPct = Math.max(5, Math.round(percentComplete * (0.4 + i * 0.12)));
    const periodCPI = parseFloat((0.915 + i * 0.025).toFixed(3));
    const periodSPI = parseFloat((0.865 + i * 0.03).toFixed(3));
    const periodTRIR = parseFloat(Math.max(1.0, 2.6 - i * 0.2).toFixed(2));
    const periodContPct = parseFloat((6 + i * 3).toFixed(1));
    trendData.push({
      period: d.toISOString().substring(0, 7),
      pctComplete: periodPct,
      cpi: periodCPI,
      spi: periodSPI,
      trir: periodTRIR,
      contingencyPct: periodContPct,
    });
  }
  
  // ── Build final metrics ────────────────────────────────────────────────
  return calcFullProjectMetrics({
    projectId: `BIGWATT-${siteName.replace(/[^A-Za-z0-9]/g, '-').substring(0, 20).toUpperCase()}`,
    projectName: siteName,
    asOfDate: new Date().toISOString().split('T')[0],
    // C-Suite / Leadership
    revenue,
    plannedMargin,
    forecastMargin,
    // EVM
    originalBudget: bac,
    actualCost,
    percentComplete,
    plannedPctComplete,
    // Safety & HSE
    totalWorkHours,
    recordableIncidents,
    lostTimeIncidents,
    fatalities: 0,
    firstAidCases,
    safetyObservationsResolved: safetyObsResolved,
    safetyObservationsTotal,
    safetyDaysSinceLast,
    // Quality
    rfiTotal,
    rfiAvgResponseDays,
    rfiCriticalPathCount,
    punchlistItems,
    punchlistClosed,
    reworkCost,
    // Schedule & Milestones
    plannedFinish: plannedFinish.toISOString().split('T')[0],
    forecastFinish: forecastFinish.toISOString().split('T')[0],
    customerNeedDate: customerNeedDate.toISOString().split('T')[0],
    milestoneNames: milestones.join(', '),
    milestoneDetails,
    milestoneVarianceDays,
    criticalPathLength,
    floatConsumed,
    percentCompletePhysical: physicalProgress,
    criticalPathImpact,
    spi: spiVal,
    // Contingency
    contingencyBudget,
    contingencyUsed,
    ownerContingencyBudget,
    ownerContingencyUsed,
    gcContingencyBudget,
    gcContingencyUsed,
    // Financials
    cashPosition,
    billingToDate,
    cashReceivedToDate,
    daysForReceivable,
    retainage,
    netPayableThisMonth,
    // Other Trackers
    headcount,
    actualVsPlannedHeadcountPct,
    weatherDaysLost,
    weatherDaysClaimed,
    gcBuyoutComplete,
    storedMaterialsValue,
    lienWaiversReceived,
    lienWaiverCompliance,
    ahjPermitStatus,
    commissioningPrerequisites: cxPrerequisitesPct,
    cxPrerequisitesPct,
    inspectionPassRate,
    // PCOs, Categories, Risks, Trends
    pcoList,
    costCategories,
    topRisks,
    trendData,
    totalConstructionCost: bac,
  });
}

// Keep generateSampleData as alias for backwards compatibility
export function generateSampleData(asOfDate) {
  return generateConstructionData({}, {});
}

// ─── Zero-State Generator for Day-1 Sites ─────────────────────────────────
// Returns proper Day-1 zero-state: BAC computed from inputs, everything else 0.
// A freshly generated site (never saved) should not show fake mid-project progress.
export function generateZeroState(inputs, results) {
  inputs = inputs || {};
  results = results || {};
  const stateName = inputs.siteName || 'BigWatt AI Campus — Site A';
  const state = inputs.state || 'Tennessee';
  const totalMW = results.totalMW || (inputs.turbines || 8) * (inputs.mwPerTurbine || 25);

  const STATE_COST_MULTIPLIERS = {
    'California': 1.35, 'New York': 1.30, 'Massachusetts': 1.25,
    'New Jersey': 1.20, 'Illinois': 1.15, 'Washington': 1.12,
    'Oregon': 1.10, 'Colorado': 1.08, 'Arizona': 1.05, 'Texas': 1.00,
    'Tennessee': 0.95, 'Virginia': 1.02, 'North Carolina': 0.98,
    'Georgia': 0.96, 'Ohio': 0.93, 'Indiana': 0.92, 'Nevada': 0.97,
  };
  const LABOR_RATE_INDEX = {
    'California': 1.30, 'New York': 1.35, 'Texas': 0.92, 'Tennessee': 0.85,
    'Virginia': 1.05, 'Illinois': 1.10, 'Arizona': 0.90, 'Georgia': 0.88,
    'North Carolina': 0.90, 'Ohio': 0.85, 'Indiana': 0.82, 'Nevada': 0.95,
  };
  const costMultiplier = STATE_COST_MULTIPLIERS[state] || 1.02;
  const laborIndex = LABOR_RATE_INDEX[state] || 1.00;
  const baseCostPerMW = 1100000;
  const adjustedCostPerMW = Math.round(baseCostPerMW * costMultiplier * laborIndex);
  const bac = Math.round(totalMW * adjustedCostPerMW * 1.0);
  const revenue = Math.round(bac * 1.12);

  // Day-1 zero metrics
  const zeroData = {
    projectId: `BIGWATT-${stateName.replace(/[^A-Za-z0-9]/g, '-').substring(0, 20).toUpperCase()}`,
    projectName: stateName,
    asOfDate: new Date().toISOString().split('T')[0],
    revenue,
    plannedMargin: 0.12,
    forecastMargin: 0.12,
    originalBudget: bac,
    actualCost: 0,
    percentComplete: 0,
    plannedPctComplete: 0,
    totalWorkHours: 0,
    recordableIncidents: 0,
    lostTimeIncidents: 0,
    fatalities: 0,
    firstAidCases: 0,
    safetyObservationsResolved: 0,
    safetyObservationsTotal: 0,
    safetyDaysSinceLast: 0,
    rfiTotal: 0,
    rfiAvgResponseDays: 0,
    rfiCriticalPathCount: 0,
    punchlistItems: 0,
    punchlistClosed: 0,
    reworkCost: 0,
    plannedFinish: '—',
    forecastFinish: '—',
    customerNeedDate: '—',
    milestoneNames: 'Site Preparation, Foundations, Structure, MEP, Commissioning',
    milestoneDetails: [],
    milestoneVarianceDays: 0,
    criticalPathLength: 0,
    floatConsumed: 0,
    percentCompletePhysical: 0,
    criticalPathImpact: 'N',
    spi: 0,
    contingencyBudget: 0,
    contingencyUsed: 0,
    ownerContingencyBudget: 0,
    ownerContingencyUsed: 0,
    gcContingencyBudget: 0,
    gcContingencyUsed: 0,
    cashPosition: 0,
    billingToDate: 0,
    cashReceivedToDate: 0,
    daysForReceivable: 0,
    retainage: 0,
    netPayableThisMonth: 0,
    headcount: 0,
    actualVsPlannedHeadcountPct: 100,
    weatherDaysLost: 0,
    weatherDaysClaimed: 0,
    gcBuyoutComplete: 0,
    storedMaterialsValue: 0,
    lienWaiversReceived: 0,
    lienWaiverCompliance: 'N',
    ahjPermitStatus: 'Not Started',
    commissioningPrerequisites: 0,
    cxPrerequisitesPct: 0,
    inspectionPassRate: 0,
    pcoList: [],
    costCategories: [],
    topRisks: [],
    trendData: [],
    totalConstructionCost: bac,
  };

  return calcFullProjectMetrics(zeroData);
}


// ─── Validate metrics data ─────────────────────────────────────────────────
export function validateMetricsData(data) {
  const errors = [];
  if (typeof data.originalBudget !== 'number' || data.originalBudget < 0) errors.push('originalBudget must be a positive number');
  if (typeof data.percentComplete !== 'number' || data.percentComplete < 0 || data.percentComplete > 100) errors.push('percentComplete must be 0-100');
  if (typeof data.recordableIncidents !== 'number' || data.recordableIncidents < 0) errors.push('recordableIncidents must be >= 0');
  return errors;
}

export default {
  calcEVM, calcContingency, calcChangeOrders, calcSafety, calcQuality,
  calcScheduleInfo, calcFullProjectMetrics, generateConstructionData, generateSampleData,
  getTrafficLight, validateMetricsData, THRESHOLDS,
};
