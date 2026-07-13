// ─── Brick PermitOS Metric Definition Registry ──────────────────────────────
// Single source of truth for every KPI formula displayed in the construction
// dashboard. Every formula here matches the actual computation in
// server/constructionData.js. The registry drives the formula popovers,
// chart tooltips, and any "how was this computed?" affordance in the UI.
//
// Conventions:
//   formulaText  — human-readable formula with named terms
//   inputs       — array of { key, label, path } resolving to actual data values
//   thresholds   — { green, amber } values matching getTrafficLight() in constructionData.js
//   compute      — function(data) that returns the numeric value (mirrors server calc)

const METRIC_DEFINITIONS = {
  // ─── Earned Value Management ───────────────────────────────────────────
  cpi: {
    label: 'Cost Performance Index (CPI)',
    formulaText: 'CPI = Earned Value (EV) ÷ Actual Cost (ACWP)',
    detail: 'CPI > 1.0 means under budget; CPI < 1.0 means over budget.',
    inputs: [
      { key: 'evm.EV', label: 'Earned Value (EV) = BAC × % Complete' },
      { key: 'evm.ACWP', label: 'Actual Cost (ACWP)' },
    ],
    thresholds: { green: 1.0, amber: 0.9 },
    compute: (d) => {
      const ev = (d.evm?.BAC || 0) * ((d.evm?.percentComplete || 0) / 100);
      const ac = d.evm?.ACWP || 0;
      return ac > 0 ? ev / ac : 0;
    },
    thresholdDirection: 'higher',
  },
  spi: {
    label: 'Schedule Performance Index (SPI)',
    formulaText: 'SPI = Earned Value (EV) ÷ Planned Value (PV)',
    detail: 'SPI > 1.0 means ahead of schedule; SPI < 1.0 means behind schedule.',
    inputs: [
      { key: 'evm.EV', label: 'Earned Value (EV) = BAC × % Complete' },
      { key: 'evm.PV', label: 'Planned Value (PV) = BAC × Planned % Complete' },
    ],
    thresholds: { green: 0.95, amber: 0.85 },
    compute: (d) => {
      const ev = (d.evm?.BAC || 0) * ((d.evm?.percentComplete || 0) / 100);
      const pv = (d.evm?.BAC || 0) * ((d.evm?.plannedPctComplete || 0) / 100);
      return pv > 0 ? ev / pv : 0;
    },
    thresholdDirection: 'higher',
  },
  vac: {
    label: 'Variance at Completion (VAC)',
    formulaText: 'VAC = Budget at Completion (BAC) − Estimate at Completion (EAC)',
    detail: 'Positive VAC means under budget; negative VAC means over budget.',
    inputs: [
      { key: 'evm.BAC', label: 'Budget at Completion (BAC)' },
      { key: 'evm.EAC', label: 'Estimate at Completion (EAC) = BAC ÷ CPI' },
    ],
    thresholds: { green: -5, amber: -10 },
    compute: (d) => (d.evm?.BAC || 0) - (d.evm?.EAC || 0),
    thresholdDirection: 'higher',
  },
  vacPct: {
    label: 'Variance at Completion (%)',
    formulaText: 'VAC% = (BAC − EAC) ÷ BAC × 100',
    detail: 'Percentage of budget variance. Negative means over budget.',
    inputs: [
      { key: 'evm.BAC', label: 'Budget at Completion (BAC)' },
      { key: 'evm.EAC', label: 'Estimate at Completion (EAC)' },
    ],
    thresholds: { green: -5, amber: -10 },
    compute: (d) => d.evm?.BAC > 0 ? ((d.evm.BAC - (d.evm.EAC || 0)) / d.evm.BAC) * 100 : 0,
    thresholdDirection: 'higher',
  },
  eac: {
    label: 'Estimate at Completion (EAC)',
    formulaText: 'EAC = Budget at Completion (BAC) ÷ Cost Performance Index (CPI)',
    detail: 'Forecast of total project cost based on current performance.',
    inputs: [
      { key: 'evm.BAC', label: 'Budget at Completion (BAC)' },
      { key: 'evm.CPI', label: 'Cost Performance Index (CPI)' },
    ],
    thresholds: { green: 1.0, amber: 0.9 },
    compute: (d) => {
      const bac = d.evm?.BAC || 0;
      const cpi = d.evm?.CPI || 1;
      return cpi > 0 ? bac / cpi : bac;
    },
    thresholdDirection: 'lower',
  },
  eac2: {
    label: 'EAC (Alternate Method)',
    formulaText: 'EAC(alt) = Actual Cost (ACWP) + (BAC − Earned Value (EV))',
    detail: 'Alternate EAC calculation using actual cost to date plus remaining budget.',
    inputs: [
      { key: 'evm.ACWP', label: 'Actual Cost (ACWP)' },
      { key: 'evm.BAC', label: 'Budget at Completion (BAC)' },
      { key: 'evm.EV', label: 'Earned Value (EV)' },
    ],
    thresholds: { green: 1.0, amber: 0.9 },
    compute: (d) => (d.evm?.ACWP || 0) + ((d.evm?.BAC || 0) - (d.evm?.EV || 0)),
    thresholdDirection: 'lower',
  },
  tcpi: {
    label: 'To-Complete Performance Index (TCPI)',
    formulaText: 'TCPI = (BAC − EV) ÷ (BAC − ACWP)',
    detail: 'CPI needed to complete the remaining work within budget. TCPI > 1 means aggressive targets.',
    inputs: [
      { key: 'evm.BAC', label: 'Budget at Completion (BAC)' },
      { key: 'evm.EV', label: 'Earned Value (EV)' },
      { key: 'evm.ACWP', label: 'Actual Cost (ACWP)' },
    ],
    thresholds: { green: 1.0, amber: 1.1 },
    compute: (d) => {
      const bac = d.evm?.BAC || 0;
      const ev = d.evm?.EV || 0;
      const ac = d.evm?.ACWP || 0;
      const denom = bac - ac;
      return denom > 0 ? (bac - ev) / denom : 0;
    },
    thresholdDirection: 'higher',
  },

  // ─── Contingency ───────────────────────────────────────────────────────
  contingencyUtilization: {
    label: 'Contingency Utilization',
    formulaText: 'Utilization % = Contingency Used ÷ Contingency Budget × 100',
    detail: 'Percentage of contingency budget that has been consumed.',
    inputs: [
      { key: 'contingency.used', label: 'Contingency Used ($)' },
      { key: 'contingency.budget', label: 'Contingency Budget ($)' },
    ],
    thresholds: { green: 80, amber: 100 },
    compute: (d) => d.contingency?.budget > 0 ? (d.contingency.used / d.contingency.budget) * 100 : 0,
    thresholdDirection: 'lower',
  },
  contingencyBurnRatio: {
    label: 'Contingency Burn Rate Ratio',
    formulaText: 'Burn Ratio = (Contingency Used ÷ Contingency Budget) ÷ (% Complete ÷ 100)',
    detail: 'Ratio of contingency consumption rate to physical progress rate. < 1.0 means consuming slower than progress.',
    inputs: [
      { key: 'contingency.utilizationPct', label: 'Contingency Utilization %' },
      { key: 'evm.percentComplete', label: 'Physical % Complete' },
    ],
    thresholds: { green: 0.8, amber: 1.0 },
    compute: (d) => {
      const pct = (d.evm?.percentComplete || 0) / 100;
      const util = d.contingency?.budget > 0 ? (d.contingency.used / d.contingency.budget) * 100 : 0;
      return pct > 0 ? util / (pct * 100) : 0;
    },
    thresholdDirection: 'lower',
  },

  // ─── Safety ────────────────────────────────────────────────────────────
  trir: {
    label: 'Total Recordable Incident Rate (TRIR)',
    formulaText: 'TRIR = (Recordable Incidents × 200,000) ÷ Total Work Hours',
    detail: 'Industry standard safety metric. Data center construction average: 1.5-2.5.',
    inputs: [
      { key: 'safety.recordableIncidents', label: 'Recordable Incidents' },
      { key: 'safety.totalWorkHours', label: 'Total Work Hours' },
    ],
    thresholds: { green: 1.5, amber: 2.5 },
    compute: (d) => {
      const h = d.safety?.totalWorkHours || 0;
      return h > 0 ? ((d.safety?.recordableIncidents || 0) * 200000) / h : 0;
    },
    thresholdDirection: 'lower',
  },
  ltir: {
    label: 'Lost Time Incident Rate (LTIR)',
    formulaText: 'LTIR = (Lost Time Incidents × 200,000) ÷ Total Work Hours',
    detail: 'Rate of incidents causing lost work time. Lower is better.',
    inputs: [
      { key: 'safety.lostTimeIncidents', label: 'Lost Time Incidents' },
      { key: 'safety.totalWorkHours', label: 'Total Work Hours' },
    ],
    thresholds: { green: 0.5, amber: 1.0 },
    compute: (d) => {
      const h = d.safety?.totalWorkHours || 0;
      return h > 0 ? ((d.safety?.lostTimeIncidents || 0) * 200000) / h : 0;
    },
    thresholdDirection: 'lower',
  },

  // ─── Quality ───────────────────────────────────────────────────────────
  reworkPct: {
    label: 'Rework Cost (% of Total)',
    formulaText: 'Rework % = Rework Cost ÷ Total Construction Cost × 100',
    detail: 'Percentage of total construction cost spent on rework.',
    inputs: [
      { key: 'quality.reworkCost', label: 'Rework Cost ($)' },
      { key: 'evm.BAC', label: 'Total Construction Cost ($)' },
    ],
    thresholds: { green: 3, amber: 7 },
    compute: (d) => {
      const total = d.evm?.BAC || 0;
      return total > 0 ? ((d.quality?.reworkCost || 0) / total) * 100 : 0;
    },
    thresholdDirection: 'lower',
  },
  rfiResponseDays: {
    label: 'Average RFI Response Time',
    formulaText: 'Avg Response = Σ(RFI Response Days) ÷ Total RFIs',
    detail: 'Average number of days to respond to Requests for Information.',
    inputs: [
      { key: 'quality.rfiAvgResponseDays', label: 'Avg RFI Response Days — from input data' },
    ],
    thresholds: { green: 3, amber: 7 },
    compute: (d) => d.quality?.rfiAvgResponseDays || 0,
    thresholdDirection: 'lower',
  },
  inspectionPassRate: {
    label: 'AHJ Inspection Pass Rate',
    formulaText: 'Pass Rate = Passed Inspections ÷ Total Inspections × 100',
    detail: 'Percentage of inspections passed on first attempt.',
    inputs: [
      { key: 'data.inspectionPassRate', label: 'Inspection Pass Rate' },
    ],
    thresholds: { green: 90, amber: 80 },
    compute: (d) => d.inspectionPassRate || 0,
    thresholdDirection: 'higher',
  },

  // ─── Schedule ──────────────────────────────────────────────────────────
  scheduleSlipDays: {
    label: 'Schedule Slip (Days)',
    formulaText: 'Slip = Forecast Finish Date − Baseline Finish Date',
    detail: 'Number of days the project is behind (or ahead of) the baseline schedule.',
    inputs: [
      { key: 'schedule.forecastFinish', label: 'Forecast Finish Date' },
      { key: 'schedule.plannedFinish', label: 'Baseline Finish Date' },
    ],
    thresholds: { green: 5, amber: 15 },
    compute: (d) => {
      const f = d.schedule?.forecastFinish ? new Date(d.schedule.forecastFinish) : new Date();
      const p = d.schedule?.plannedFinish ? new Date(d.schedule.plannedFinish) : new Date();
      return Math.round((f - p) / (1000 * 60 * 60 * 24));
    },
    thresholdDirection: 'lower',
  },
  milestoneVarianceDays: {
    label: 'Milestone Variance (Days)',
    formulaText: 'Variance = Forecast Milestone Date − Baseline Milestone Date',
    detail: 'Average variance across all project milestones.',
    inputs: [
      { key: 'schedule.milestoneVarianceDays', label: 'Milestone Variance Days' },
    ],
    thresholds: { green: 5, amber: 15 },
    compute: (d) => d.schedule?.milestoneVarianceDays || 0,
    thresholdDirection: 'lower',
  },

  // ─── Financial ─────────────────────────────────────────────────────────
  netCashPosition: {
    label: 'Net Cash Position',
    formulaText: 'Net Cash = Cash Received to Date − Actual Cost to Date',
    detail: 'Current cash position. Negative means expenses exceed receipts.',
    inputs: [
      { key: 'data.cashReceivedToDate', label: 'Cash Received to Date ($)' },
      { key: 'evm.ACWP', label: 'Actual Cost to Date ($)' },
    ],
    thresholds: { green: 0, amber: -1000000 },
    compute: (d) => (d.cashReceivedToDate || 0) - (d.evm?.ACWP || 0),
    thresholdDirection: 'higher',
  },
  forecastMargin: {
    label: 'Forecast Margin',
    formulaText: 'Forecast Margin % = (Revenue − EAC) ÷ Revenue × 100',
    detail: 'Projected profit margin based on current EAC.',
    inputs: [
      { key: 'data.revenue', label: 'Revenue ($)' },
      { key: 'evm.EAC', label: 'Estimate at Completion ($)' },
    ],
    thresholds: { green: 0.08, amber: 0.04 },
    compute: (d) => {
      const rev = d.revenue || 0;
      return rev > 0 ? (rev - (d.evm?.EAC || 0)) / rev : 0;
    },
    thresholdDirection: 'higher',
  },
};

export default METRIC_DEFINITIONS;