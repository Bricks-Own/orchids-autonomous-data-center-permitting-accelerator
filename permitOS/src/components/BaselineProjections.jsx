import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, Legend,
} from 'recharts';

// ─── Baseline & Projections Panel ──────────────────────────────────────────
// "Excel-ish" core: user edits baseline inputs, projections update instantly.
// EAC shown via two methods, S-curve, contingency runway, cash flow projection.
export default function BaselineProjections({ data, onSave, initialBaseline }) {
  // ─── Baseline state ─────────────────────────────────────────────────────
  const [baseline, setBaseline] = useState({
    originalBudget: initialBaseline?.originalBudget || data?.evm?.BAC || 0,
    contingencyBudget: initialBaseline?.contingencyBudget || data?.contingency?.budget || 0,
    baselineStartDate: initialBaseline?.baselineStartDate || '2024-06-01',
    baselineFinishDate: initialBaseline?.baselineFinishDate || '2026-09-15',
    customerNeedDate: initialBaseline?.customerNeedDate || '2026-08-15',
    plannedHeadcount: initialBaseline?.plannedHeadcount || data?.headcount || 200,
    plannedMargin: initialBaseline?.plannedMargin || (data?.plannedMargin || 0.12),
  });

  const [actuals, setActuals] = useState({
    actualCost: initialBaseline?.actualCost || data?.evm?.ACWP || 0,
    percentComplete: initialBaseline?.percentComplete || data?.evm?.percentComplete || 0,
    plannedPctComplete: initialBaseline?.plannedPctComplete || data?.evm?.plannedPctComplete || 0,
    cashReceived: initialBaseline?.cashReceived || data?.cashReceivedToDate || 0,
    billedToDate: initialBaseline?.billedToDate || data?.billingToDate || 0,
    contingencyUsed: initialBaseline?.contingencyUsed || data?.contingency?.used || 0,
    recordableIncidents: initialBaseline?.recordableIncidents || data?.safety?.recordableIncidents || 0,
    totalWorkHours: initialBaseline?.totalWorkHours || data?.safety?.totalWorkHours || 0,
    rfiTotal: initialBaseline?.rfiTotal || data?.quality?.rfiTotal || 0,
    rfiAvgResponseDays: initialBaseline?.rfiAvgResponseDays || data?.quality?.rfiAvgResponseDays || 0,
    lostTimeIncidents: initialBaseline?.lostTimeIncidents || data?.safety?.lostTimeIncidents || 0,
    punchlistItems: initialBaseline?.punchlistItems || data?.quality?.punchlistItems || 0,
    reworkCost: initialBaseline?.reworkCost || data?.quality?.reworkCost || 0,
    safetyDaysSinceLast: initialBaseline?.safetyDaysSinceLast || data?.safetyDaysSinceLast || 0,
    cashPosition: initialBaseline?.cashPosition || data?.cashPosition || 0,
  });

  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  // ─── Live projections ───────────────────────────────────────────────────
  const projections = useMemo(() => {
    const BAC = baseline.originalBudget || 1;
    const AC = actuals.actualCost || 0;
    const pct = (actuals.percentComplete || 0) / 100;
    const plannedPct = (actuals.plannedPctComplete || 0) / 100;

    const EV = BAC * pct;
    const PV = BAC * plannedPct;
    const CPI = AC > 0 ? EV / AC : 1;
    const SPI = PV > 0 ? EV / PV : 1;

    // EAC two methods
    const EAC_BAC_CPI = CPI > 0 ? BAC / CPI : BAC;
    const EAC_AC_EV = AC + (BAC - EV);
    const VAC = BAC - EAC_BAC_CPI;

    // Forecast finish
    const baselineStart = new Date(baseline.baselineStartDate);
    const baselineFinish = new Date(baseline.baselineFinishDate);
    const customerNeed = new Date(baseline.customerNeedDate);
    const plannedDuration = Math.max(1, (baselineFinish - baselineStart) / (1000 * 60 * 60 * 24));
    const scheduleSlipDays = SPI > 0 ? Math.round(plannedDuration / SPI - plannedDuration) : 0;
    const forecastFinish = new Date(baselineFinish);
    forecastFinish.setDate(forecastFinish.getDate() + scheduleSlipDays);
    const varianceDays = Math.round((forecastFinish - customerNeed) / (1000 * 60 * 60 * 24));

    // Contingency runway
    const contBudget = baseline.contingencyBudget || 0;
    const contUsed = actuals.contingencyUsed || 0;
    const contUtilPct = contBudget > 0 ? (contUsed / contBudget) * 100 : 0;
    const burnRatio = pct > 0 ? contUtilPct / (pct * 100) : 0;
    // Projected % complete at which contingency hits zero
    const contZeroPct = burnRatio > 0 ? Math.min(100, (100 / burnRatio)) : 100;

    // Cash flow projection
    const billingRate = BAC / (plannedDuration / 30);
    const cashReceived = actuals.cashReceived || 0;
    const billedToDate = actuals.billedToDate || 0;
    const cashFlowProjection = [];
    const monthsRemaining = Math.max(1, Math.ceil((forecastFinish - new Date()) / (1000 * 60 * 60 * 24 * 30)));
    for (let i = 0; i <= monthsRemaining; i++) {
      const monthPct = Math.min(1, (pct * 100 + (i * (100 / monthsRemaining))) / 100);
      // S-curve: logistic function for cumulative cost
      const mid = 0.5;
      const steepness = 8;
      const sCurveFactor = 1 / (1 + Math.exp(-steepness * (monthPct - mid)));
      const projectedCost = BAC * sCurveFactor;
      const projectedBilled = BAC * Math.min(1, sCurveFactor * 1.05);
      const projectedReceived = projectedBilled * 0.88;
      const monthLabel = new Date();
      monthLabel.setMonth(monthLabel.getMonth() + i);
      cashFlowProjection.push({
        period: monthLabel.toISOString().substring(0, 7),
        projectedCost: Math.round(projectedCost / 1e6 * 10) / 10,
        projectedBilled: Math.round(projectedBilled / 1e6 * 10) / 10,
        projectedReceived: Math.round(projectedReceived / 1e6 * 10) / 10,
      });
    }

    // S-curve data: planned vs actual vs projected
    const sCurveData = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      // S-curve logistic
      const mid = 0.5;
      const steepness = 7;
      const planned = 1 / (1 + Math.exp(-steepness * (t - mid)));
      const actual = pct > 0 ? Math.min(1, pct + (t * (1 - pct))) : t * 0.8;
      // Projected: from current pct, continue with CPI-adjusted slope
      const projected = Math.min(1, pct + (t * (1 / (CPI > 0.1 ? CPI : 0.1)) * (1 - pct)));
      sCurveData.push({
        period: `${(t * 100).toFixed(0)}%`,
        planned: parseFloat((planned * 100).toFixed(1)),
        actual: parseFloat((actual * 100).toFixed(1)),
        projected: parseFloat((projected * 100).toFixed(1)),
      });
    }

    // Contingency drawdown projection
    const contDrawdown = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const progressAt = pct + (t * (1 - pct));
      const contAt = Math.max(0, contUtilPct - (t * (contUtilPct / (contZeroPct / 100))));
      const physicalProgress = Math.min(100, progressAt * 100);
      contDrawdown.push({
        period: `${(t * 100).toFixed(0)}%`,
        contingency: parseFloat(Math.max(0, contUtilPct - (contUtilPct * t * (1 / (contZeroPct / 100 > 0.01 ? contZeroPct / 100 : 0.01)))).toFixed(1)),
        physicalProgress: parseFloat(physicalProgress.toFixed(1)),
      });
    }

    // Milestone variance bars
    const milestoneVariance = (data?.milestoneDetails || []).map(m => ({
      name: m.name?.substring(0, 18) || 'Milestone',
      baseline: 0,
      variance: m.varianceDays || 0,
    }));

    // Revenue projection
    const revenue = BAC * (1 + (baseline.plannedMargin || 0.12));
    const forecastMargin = revenue > 0 ? (revenue - EAC_BAC_CPI) / revenue : 0;

    return {
      EV, PV, CPI, SPI,
      EAC_BAC_CPI: Math.round(EAC_BAC_CPI),
      EAC_AC_EV: Math.round(EAC_AC_EV),
      VAC: Math.round(VAC),
      forecastFinish: forecastFinish.toISOString().split('T')[0],
      scheduleSlipDays,
      varianceDays,
      contUtilPct: parseFloat(contUtilPct.toFixed(1)),
      burnRatio: parseFloat(burnRatio.toFixed(2)),
      contZeroPct: parseFloat(contZeroPct.toFixed(1)),
      revenue: Math.round(revenue),
      forecastMargin: parseFloat((forecastMargin * 100).toFixed(1)),
      cashFlowProjection,
      sCurveData,
      contDrawdown,
      milestoneVariance,
    };
  }, [baseline, actuals, data]);

  // ─── Update handlers ────────────────────────────────────────────────────
  const updateBaseline = (key, val) => {
    setBaseline(prev => ({ ...prev, [key]: val }));
    setDirty(true);
    setSaved(false);
  };

  const updateActuals = (key, val) => {
    setActuals(prev => ({ ...prev, [key]: val }));
    setDirty(true);
    setSaved(false);
  };

  const handleSave = () => {
    const payload = {
      originalBudget: baseline.originalBudget,
      contingencyBudget: baseline.contingencyBudget,
      actualCost: actuals.actualCost,
      percentComplete: actuals.percentComplete,
      plannedPctComplete: actuals.plannedPctComplete,
      cashReceivedToDate: actuals.cashReceived,
      billingToDate: actuals.billedToDate,
      contingencyUsed: actuals.contingencyUsed,
      totalWorkHours: actuals.totalWorkHours,
      recordableIncidents: actuals.recordableIncidents,
      lostTimeIncidents: actuals.lostTimeIncidents,
      rfiTotal: actuals.rfiTotal,
      rfiAvgResponseDays: actuals.rfiAvgResponseDays,
      punchlistItems: actuals.punchlistItems,
      reworkCost: actuals.reworkCost,
      cashPosition: actuals.cashPosition,
      safetyDaysSinceLast: actuals.safetyDaysSinceLast,
    };
    if (onSave) onSave(payload);
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const fmtCurr = (v) => {
    if (typeof v !== 'number') return '—';
    if (Math.abs(v) >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
    if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    return '$' + Math.round(v).toLocaleString();
  };

  const inputStyle = "w-full bg-background border border-border  px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors";

  return (
    <div className="space-y-4">
      {/* ── Input Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Baseline Inputs */}
        <div className=" border border-border/40 bg-card/40 p-4">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <span className="text-primary">B</span> Project Baseline
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Original Budget / BAC ($)</label>
              <input type="number" value={baseline.originalBudget} onChange={e => updateBaseline('originalBudget', parseFloat(e.target.value) || 0)} className={inputStyle} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Contingency Budget ($)</label>
              <input type="number" value={baseline.contingencyBudget} onChange={e => updateBaseline('contingencyBudget', parseFloat(e.target.value) || 0)} className={inputStyle} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Baseline Start Date</label>
              <input type="date" value={baseline.baselineStartDate} onChange={e => updateBaseline('baselineStartDate', e.target.value)} className={inputStyle} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Baseline Finish Date</label>
              <input type="date" value={baseline.baselineFinishDate} onChange={e => updateBaseline('baselineFinishDate', e.target.value)} className={inputStyle} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Customer Need Date</label>
              <input type="date" value={baseline.customerNeedDate} onChange={e => updateBaseline('customerNeedDate', e.target.value)} className={inputStyle} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Planned Headcount</label>
              <input type="number" value={baseline.plannedHeadcount} onChange={e => updateBaseline('plannedHeadcount', parseInt(e.target.value) || 0)} className={inputStyle} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Planned Margin (%)</label>
              <input type="number" step="0.1" value={baseline.plannedMargin * 100} onChange={e => updateBaseline('plannedMargin', (parseFloat(e.target.value) || 0) / 100)} className={inputStyle} />
            </div>
          </div>
        </div>

        {/* Current Actuals */}
        <div className=" border border-border/40 bg-card/40 p-4">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <span className="text-destructive">A</span> Current Actuals
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">Actual Cost ($)</label>
              <input type="number" value={actuals.actualCost} onChange={e => updateActuals('actualCost', parseFloat(e.target.value) || 0)} className={inputStyle} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">% Complete</label>
              <input type="number" step="0.1" min="0" max="100" value={actuals.percentComplete} onChange={e => updateActuals('percentComplete', parseFloat(e.target.value) || 0)} className={inputStyle} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Planned %</label>
              <input type="number" step="0.1" min="0" max="100" value={actuals.plannedPctComplete} onChange={e => updateActuals('plannedPctComplete', parseFloat(e.target.value) || 0)} className={inputStyle} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Cash Received ($)</label>
              <input type="number" value={actuals.cashReceived} onChange={e => updateActuals('cashReceived', parseFloat(e.target.value) || 0)} className={inputStyle} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Billed to Date ($)</label>
              <input type="number" value={actuals.billedToDate} onChange={e => updateActuals('billedToDate', parseFloat(e.target.value) || 0)} className={inputStyle} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Contingency Used ($)</label>
              <input type="number" value={actuals.contingencyUsed} onChange={e => updateActuals('contingencyUsed', parseFloat(e.target.value) || 0)} className={inputStyle} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Work Hours</label>
              <input type="number" value={actuals.totalWorkHours} onChange={e => updateActuals('totalWorkHours', parseFloat(e.target.value) || 0)} className={inputStyle} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Recordable Incidents</label>
              <input type="number" value={actuals.recordableIncidents} onChange={e => updateActuals('recordableIncidents', parseFloat(e.target.value) || 0)} className={inputStyle} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Lost Time Incidents</label>
              <input type="number" value={actuals.lostTimeIncidents} onChange={e => updateActuals('lostTimeIncidents', parseFloat(e.target.value) || 0)} className={inputStyle} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Total RFIs</label>
              <input type="number" value={actuals.rfiTotal} onChange={e => updateActuals('rfiTotal', parseFloat(e.target.value) || 0)} className={inputStyle} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Rework Cost ($)</label>
              <input type="number" value={actuals.reworkCost} onChange={e => updateActuals('reworkCost', parseFloat(e.target.value) || 0)} className={inputStyle} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Cash Position ($)</label>
              <input type="number" value={actuals.cashPosition} onChange={e => updateActuals('cashPosition', parseFloat(e.target.value) || 0)} className={inputStyle} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Save Button ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className={`text-xs px-4 py-2  transition-colors font-semibold ${
            dirty ? 'bg-primary hover:bg-primary text-white' : 'bg-muted text-muted-foreground cursor-default'
          }`}
        >
          {saved ? 'Saved!' : dirty ? 'Save & Persist' : 'No changes'}
        </button>
        {dirty && !saved && (
          <span className="text-xs text-destructive">Projections update live — save to persist</span>
        )}
      </div>

      {/* ── Projections Output ── */}
      <div className=" border border-primary/30 bg-primary/10 p-4">
        <h3 className="text-xs font-semibold text-primary mb-3 flex items-center gap-2">
          <span className="text-primary">P</span> Projected Outcomes
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-card/60  p-3 border border-border/30">
            <div className="text-xs text-muted-foreground">EAC (BAC/CPI Method)</div>
            <div className="text-sm font-bold text-primary">{fmtCurr(projections.EAC_BAC_CPI)}</div>
            <div className="text-xs text-muted-foreground/70">Projected — EAC method: BAC / CPI</div>
          </div>
          <div className="bg-card/60  p-3 border border-border/30">
            <div className="text-xs text-muted-foreground">EAC (AC + Remaining Method)</div>
            <div className="text-sm font-bold text-cyan-300">{fmtCurr(projections.EAC_AC_EV)}</div>
            <div className="text-xs text-muted-foreground/70">Projected — EAC method: AC + (BAC − EV)</div>
          </div>
          <div className="bg-card/60  p-3 border border-border/30">
            <div className="text-xs text-muted-foreground">VAC vs Baseline</div>
            <div className={`text-sm font-bold ${projections.VAC >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {fmtCurr(projections.VAC)}
            </div>
            <div className="text-xs text-muted-foreground/70">Variance at Completion</div>
          </div>
          <div className="bg-card/60  p-3 border border-border/30">
            <div className="text-xs text-muted-foreground">Forecast Margin</div>
            <div className={`text-sm font-bold ${projections.forecastMargin >= (baseline.plannedMargin * 100) ? 'text-primary' : 'text-destructive'}`}>
              {projections.forecastMargin}%
            </div>
            <div className="text-xs text-muted-foreground/70">Planned: {(baseline.plannedMargin * 100).toFixed(1)}%</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-card/60  p-3 border border-border/30">
            <div className="text-xs text-muted-foreground">Forecast Finish</div>
            <div className="text-sm font-bold text-foreground">{projections.forecastFinish}</div>
            <div className={`text-xs ${projections.varianceDays > 0 ? 'text-destructive' : 'text-primary'}`}>
              {projections.varianceDays > 0 ? `${projections.varianceDays}d past customer need` : `${Math.abs(projections.varianceDays)}d ahead of customer need`}
            </div>
          </div>
          <div className="bg-card/60  p-3 border border-border/30">
            <div className="text-xs text-muted-foreground">Schedule Slip (SPI-based)</div>
            <div className="text-sm font-bold text-foreground">{projections.scheduleSlipDays}d</div>
            <div className="text-xs text-muted-foreground/70">SPI = {projections.SPI.toFixed(3)}</div>
          </div>
          <div className="bg-card/60  p-3 border border-border/30">
            <div className="text-xs text-muted-foreground">Contingency Runway</div>
            <div className="text-sm font-bold text-amber-300">{projections.contZeroPct}%</div>
            <div className="text-xs text-muted-foreground/70">Projected % complete at zero contingency</div>
          </div>
          <div className="bg-card/60  p-3 border border-border/30">
            <div className="text-xs text-muted-foreground">Contingency Burn Ratio</div>
            <div className={`text-sm font-bold ${projections.burnRatio <= 0.8 ? 'text-primary' : projections.burnRatio <= 1.0 ? 'text-destructive' : 'text-destructive'}`}>
              {projections.burnRatio.toFixed(2)}x
            </div>
            <div className="text-xs text-muted-foreground/70">{projections.contUtilPct}% used vs {actuals.percentComplete}% complete</div>
          </div>
        </div>
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* S-Curve */}
        <div className=" border border-border/40 bg-card/40 p-4">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3">Cost S-Curve — Planned vs Actual vs Projected</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={projections.sCurveData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb', fontSize: '12px' }} labelStyle={{ color: '#e5e7eb' }} itemStyle={{ color: '#e5e7eb' }} />
              <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
              <Line type="monotone" dataKey="planned" stroke="#6366f1" strokeWidth={2} dot={false} name="Planned" />
              <Line type="monotone" dataKey="actual" stroke="#22c55e" strokeWidth={2} dot={false} name="Actual" />
              <Line type="monotone" dataKey="projected" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Projected" />
            </LineChart>
          </ResponsiveContainer>
          <div className="text-xs text-muted-foreground/70 mt-1">Projected series shown dashed — based on current CPI/SPI trend</div>
        </div>

        {/* Contingency Drawdown */}
        <div className=" border border-border/40 bg-card/40 p-4">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3">Contingency Drawdown vs Physical Progress</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={projections.contDrawdown}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb', fontSize: '12px' }} labelStyle={{ color: '#e5e7eb' }} itemStyle={{ color: '#e5e7eb' }} />
              <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
              <Line type="monotone" dataKey="contingency" stroke="#f59e0b" strokeWidth={2} dot={false} name="Contingency %" />
              <Line type="monotone" dataKey="physicalProgress" stroke="#22c55e" strokeWidth={2} dot={false} name="Physical Progress %" />
            </LineChart>
          </ResponsiveContainer>
          <div className="text-xs text-muted-foreground/70 mt-1">Contingency reaches zero at ~{projections.contZeroPct}% physical progress (current burn rate)</div>
        </div>

        {/* Cash Flow Projection */}
        <div className=" border border-border/40 bg-card/40 p-4">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3">Cash Flow Projection</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={projections.cashFlowProjection}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => '$' + v.toFixed(0) + 'M'} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb', fontSize: '12px' }} labelStyle={{ color: '#e5e7eb' }} itemStyle={{ color: '#e5e7eb' }} formatter={(val) => '$' + val.toFixed(1) + 'M'} />
              <Legend wrapperStyle={{ fontSize: '10px', color: '#9ca3af' }} />
              <Area type="monotone" dataKey="projectedCost" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={2} name="Projected Cost" />
              <Area type="monotone" dataKey="projectedBilled" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} strokeWidth={2} name="Projected Billed" />
              <Area type="monotone" dataKey="projectedReceived" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} strokeWidth={2} name="Projected Received" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="text-xs text-muted-foreground/70 mt-1">Projected — based on current billing and collection rates</div>
        </div>

        {/* Milestone Variance */}
        <div className=" border border-border/40 bg-card/40 p-4">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3">Milestone Variance — Baseline vs Forecast</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={projections.milestoneVariance} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#9ca3af', fontSize: 10 }} width={95} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb', fontSize: '12px' }} labelStyle={{ color: '#e5e7eb' }} itemStyle={{ color: '#e5e7eb' }} formatter={(val) => val + ' days'} />
              <Bar dataKey="variance" name="Variance Days" radius={[0, 3, 3, 0]}>
                {projections.milestoneVariance.map((entry, idx) => (
                  <rect key={idx} fill={entry.variance > 0 ? '#ef4444' : '#22c55e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="text-xs text-muted-foreground/70 mt-1">Red bars = critical path delay; green = ahead of schedule</div>
        </div>
      </div>
    </div>
  );
}