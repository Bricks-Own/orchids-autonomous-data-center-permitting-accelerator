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
export function calcSafety(totalWorkHours, recordableIncidents, lostTimeIncidents, fatalities = 0, firstAidCases = 0) {
  // TRIR = (Recordable Incidents × 200,000) / Total Hours
  const trir = totalWorkHours > 0 ? (recordableIncidents * 200000) / totalWorkHours : 0;
  // LTIR = (Lost Time Incidents × 200,000) / Total Hours
  const ltir = totalWorkHours > 0 ? (lostTimeIncidents * 200000) / totalWorkHours : 0;
  // First Aid Rate
  const far = totalWorkHours > 0 ? (firstAidCases * 200000) / totalWorkHours : 0;

  return {
    trir: parseFloat(trir.toFixed(2)),
    ltir: parseFloat(ltir.toFixed(2)),
    far: parseFloat(far.toFixed(2)),
    fatalities,
    totalWorkHours,
    recordableIncidents,
    lostTimeIncidents,
    firstAidCases,
    statusTRIR: getTrafficLight('trir', trir),
    statusLTIR: getTrafficLight('ltir', ltir),
    flag: trir > THRESHOLDS.trir.amber ? 'Safety incident rate exceeds threshold — escalate HSE review' : null,
  };
}

// ─── Quality Metrics ──────────────────────────────────────────────────────
export function calcQuality(rfiTotal, rfiAvgResponseDays, punchlistItems, punchlistClosed, totalConstructionCost, reworkCost) {
  const rfiClosureRate = rfiTotal > 0 ? Math.min(punchlistClosed / Math.max(rfiTotal, 1) * 100, 100) : 0;
  const punchlistOpen = punchlistItems - punchlistClosed;
  const punchlistCloseRate = punchlistItems > 0 ? (punchlistClosed / punchlistItems) * 100 : 0;
  const reworkPct = totalConstructionCost > 0 ? (reworkCost / totalConstructionCost) * 100 : 0;

  return {
    rfiTotal,
    rfiAvgResponseDays,
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
export function calcScheduleInfo(plannedFinish, forecastFinish, milestoneVarianceDays, criticalPathLength, floatConsumed) {
  const now = new Date();
  const planned = new Date(plannedFinish);
  const forecast = new Date(forecastFinish);
  const scheduleSlipDays = Math.round((forecast - planned) / (1000 * 60 * 60 * 24));
  const scheduleSlipPct = plannedFinish ? Math.abs(scheduleSlipDays / Math.max((planned - now) / (1000 * 60 * 60 * 24), 1)) * 100 : 0;

  return {
    plannedFinish,
    forecastFinish,
    scheduleSlipDays,
    scheduleSlipPct: parseFloat(scheduleSlipPct.toFixed(1)),
    milestoneVarianceDays,
    criticalPathLength: criticalPathLength || 0,
    floatConsumed: floatConsumed || 0,
    statusMS: getTrafficLight('milestoneVariance', milestoneVarianceDays || 0),
    flag: Math.abs(scheduleSlipDays) > 30 ? 'Schedule slip exceeds 30 days — review critical path' : null,
  };
}

// ─── Full Project Rollup ──────────────────────────────────────────────────
export function calcFullProjectMetrics(data) {
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
    data.firstAidCases || 0
  );

  const quality = calcQuality(
    data.rfiTotal || 0,
    data.rfiAvgResponseDays || 0,
    data.punchlistItems || 0,
    data.punchlistClosed || 0,
    data.totalConstructionCost || data.originalBudget || 0,
    data.reworkCost || 0
  );

  const schedule = calcScheduleInfo(
    data.plannedFinish || '2026-Q3',
    data.forecastFinish || '2026-Q4',
    data.milestoneVarianceDays || 0,
    data.criticalPathLength || 0,
    data.floatConsumed || 0
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

  return {
    projectId: data.projectId || 'default',
    projectName: data.projectName || 'BigWatt AI Campus — Site A',
    asOfDate: data.asOfDate || new Date().toISOString().split('T')[0],
    evm,
    safety,
    quality,
    schedule,
    contingency,
    changeOrders,
    cashPosition: data.cashPosition || 0,
    billingToDate: data.billingToDate || 0,
    retainage: data.retainage || 0,
    safetyDaysSinceLast: data.safetyDaysSinceLast || 0,
    weatherDaysLost: data.weatherDaysLost || 0,
    headcount: data.headcount || 0,
    gcBuyoutComplete: data.gcBuyoutComplete || 0,
    ownerContingencyUsed: data.ownerContingencyUsed || 0,
    gcContingencyUsed: data.gcContingencyUsed || 0,
    storedMaterialsValue: data.storedMaterialsValue || 0,
    lienWaiversReceived: data.lienWaiversReceived || 0,
    ahjPermitStatus: data.ahjPermitStatus || 'Not Started',
    commissioningPrerequisites: data.commissioningPrerequisites || 0,
    inspectionPassRate: data.inspectionPassRate || 0,
    statusInspection: getTrafficLight('inspectionPassRate', data.inspectionPassRate || 0),
    // Cost category breakdown
    costCategories: data.costCategories || [],
    // Top 5 risks
    topRisks: data.topRisks || [],
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

// ─── Generate sample seeded data matching the Excel structure ──────────────
export function generateSampleData(asOfDate) {
  const date = asOfDate || new Date().toISOString().split('T')[0];
  // Build 6 periods of trend data
  const trendData = [];
  const baseDate = new Date(date);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() - i);
    const pct = Math.min(13 + i * 14, 95);
    const cpi = 0.92 + (i * 0.03) + Math.random() * 0.06;
    const spi = 0.88 + (i * 0.04) + Math.random() * 0.06;
    trendData.push({
      period: d.toISOString().substring(0, 7),
      pctComplete: pct,
      cpi: parseFloat(cpi.toFixed(3)),
      spi: parseFloat(spi.toFixed(3)),
      trir: parseFloat((2.5 - i * 0.3 + Math.random() * 0.2).toFixed(2)),
      contingencyPct: parseFloat((15 + i * 8 + Math.random() * 3).toFixed(1)),
    });
  }

  const samplePCOs = [
    { id: 'PCO-001', description: 'Additional cooling tower pads', value: 450000, status: 'Pending', agingDays: 45 },
    { id: 'PCO-002', description: 'Generator enclosure upgrade', value: 280000, status: 'Pending', agingDays: 38 },
    { id: 'PCO-003', description: 'Fiber optic route change', value: 125000, status: 'Approved', agingDays: 12 },
    { id: 'PCO-004', description: 'Transformer foundation redesign', value: 680000, status: 'Pending', agingDays: 72 },
    { id: 'PCO-005', description: 'Additional site lighting', value: 85000, status: 'Approved', agingDays: 5 },
    { id: 'PCO-006', description: 'Security system scope increase', value: 190000, status: 'Pending', agingDays: 28 },
    { id: 'PCO-007', description: 'Data floor loading upgrade', value: 520000, status: 'Pending', agingDays: 55 },
  ];

  const costCategories = [
    { name: 'Land Acquisition', budget: 8500000, actual: 8350000, pctComplete: 100 },
    { name: 'Site Development', budget: 4200000, actual: 3850000, pctComplete: 92 },
    { name: 'Power & Utilities', budget: 28500000, actual: 22100000, pctComplete: 78 },
    { name: 'Material Procurement (LLE)', budget: 12000000, actual: 9800000, pctComplete: 82 },
    { name: 'Electrical Infrastructure', budget: 18300000, actual: 14200000, pctComplete: 76 },
    { name: 'Cooling & Mechanical', budget: 15800000, actual: 11700000, pctComplete: 70 },
    { name: 'Fire Protection & Safety', budget: 3200000, actual: 1950000, pctComplete: 62 },
    { name: 'GC Contract', budget: 45000000, actual: 38200000, pctComplete: 85 },
    { name: 'Fitout & Finishes', budget: 5800000, actual: 2100000, pctComplete: 35 },
    { name: 'Commissioning & Testing', budget: 2500000, actual: 420000, pctComplete: 15 },
  ];

  const topRisks = [
    { rank: 1, description: 'Electrical switchgear delivery delay — 8-week lead time risk', impact: 'Critical', probability: 0.7, mitigation: 'Expedited order placed; backup supplier identified' },
    { rank: 2, description: 'Cooling tower concrete pour — weather window narrowing', impact: 'Major', probability: 0.5, mitigation: 'Temporary enclosure planned; heaters on standby' },
    { rank: 3, description: 'Fiber permit delay — county review backed up 3 weeks', impact: 'Moderate', probability: 0.6, mitigation: 'Expediting fee submitted; route alternatives scoped' },
    { rank: 4, description: 'Transformer lead time compressed — original spec obsolete', impact: 'Major', probability: 0.4, mitigation: 'Re-engineering submitted; rental units sourced as bridge' },
    { rank: 5, description: 'GC labor shortage — sheet metal workers union allocation thin', impact: 'Moderate', probability: 0.5, mitigation: 'Prefabrication strategy adopted; non-union subs scoped' },
  ];

  return calcFullProjectMetrics({
    projectId: 'BIGWATT-SITEA-001',
    projectName: 'BigWatt AI Campus — Site A',
    asOfDate: date,
    originalBudget: 145000000,
    actualCost: 113900000,
    percentComplete: 74,
    plannedPctComplete: 82,
    totalWorkHours: 587000,
    recordableIncidents: 4,
    lostTimeIncidents: 1,
    fatalities: 0,
    firstAidCases: 12,
    rfiTotal: 187,
    rfiAvgResponseDays: 4.2,
    punchlistItems: 64,
    punchlistClosed: 38,
    reworkCost: 1850000,
    plannedFinish: '2026-07-15',
    forecastFinish: '2026-09-30',
    milestoneVarianceDays: -18,
    criticalPathLength: 45,
    floatConsumed: 22,
    contingencyBudget: 8500000,
    contingencyUsed: 5100000,
    cashPosition: 23400000,
    billingToDate: 95600000,
    retainage: 4780000,
    safetyDaysSinceLast: 87,
    weatherDaysLost: 11,
    headcount: 342,
    gcBuyoutComplete: 92,
    ownerContingencyUsed: 5100000,
    gcContingencyUsed: 1850000,
    storedMaterialsValue: 3200000,
    lienWaiversReceived: 38,
    ahjPermitStatus: 'Permits Issued — Inspections Active',
    commissioningPrerequisites: 42,
    inspectionPassRate: 87,
    pcoList: samplePCOs,
    costCategories,
    topRisks,
    trendData,
    totalConstructionCost: 145000000,
  });
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
  calcScheduleInfo, calcFullProjectMetrics, generateSampleData,
  getTrafficLight, validateMetricsData, THRESHOLDS,
};
