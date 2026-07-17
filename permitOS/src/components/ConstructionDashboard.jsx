import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { fetchConstructionData, saveConstructionData } from '../utils/api';
import SiteView3D from './SiteView3D';
import FormulaPopover from './FormulaPopover';
import BaselineProjections from './BaselineProjections';
import VendorLedger from './VendorLedger';
import { usePermitData } from '../context/PermitDataContext';
import { BudgetWaterfall, SCurveChart, ContingencyDrawdown, MilestoneVarianceChart, CPISPITrend } from './AdvancedCharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from './ui/table';
import {
  Gauge, ChartBar, ShieldCheck, SealCheck, CurrencyDollar, CalendarCheck,
  Folder, Clipboard, Warning, NotePencil, TrendUp, ChartLine, Cube,
  PencilSimple, ArrowsClockwise, WarningCircle, X,
} from '@phosphor-icons/react';

// ─── Traffic Light Status ─────────────────────────────────────────────────
const TL = {
  green: { dot: 'bg-green-500', text: 'text-primary', label: 'On Track' },
  amber: { dot: 'bg-amber-500', text: 'text-amber-400', label: 'At Risk' },
  red:   { dot: 'bg-red-500', text: 'text-destructive', label: 'Critical' },
  gray:  { dot: 'bg-card0', text: 'text-muted-foreground', label: 'N/A' },
};

function TrafficBadge({ status = 'gray', label }) {
  const s = TL[status] || TL.gray;
  return (
    <Badge variant={status === 'red' ? 'destructive' : status === 'amber' ? 'outline' : 'default'} className="gap-1.5 px-2 py-0.5 text-[0.625rem]">
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {label || s.label}
    </Badge>
  );
}

// ─── KPI Card (shadcn Card + Badge) ───────────────────────────────────────
function KpiCard({ title, value, status, subtitle, onClick, children, metricKey, data }) {
  return (
    <Card className={`transition-all hover:scale-[1.02] ${onClick ? 'cursor-pointer' : ''}`} size="sm">
      <CardContent className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[0.625rem] font-semibold tracking-widest uppercase text-muted-foreground">{title}</span>
          <TrafficBadge status={status} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-lg font-bold ${TL[status]?.text || 'text-foreground'}`}>{value}</span>
          {metricKey && data && (
            <FormulaPopover metricKey={metricKey} data={data}>
              <span />
            </FormulaPopover>
          )}
        </div>
        {subtitle && <span className="text-[0.625rem] text-muted-foreground/70">{subtitle}</span>}
        {children}
      </CardContent>
    </Card>
  );
}

// ─── Gauge Chart Component ────────────────────────────────────────────────
function GaugeChart({ value, min = 0, max = 2, thresholds = [1, 0.9], label, invert = false }) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const color = invert
    ? (value <= thresholds[1] ? '#ef4444' : value <= thresholds[0] ? '#f59e0b' : '#22c55e')
    : (value >= thresholds[0] ? '#22c55e' : value >= thresholds[1] ? '#f59e0b' : '#ef4444');

  const data = [{ name: label, value: pct }];
  const fillColor = color;

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width={120} height={70}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="85%"
            startAngle={180}
            endAngle={0}
            innerRadius={30}
            outerRadius={45}
            dataKey="value"
          >
            <Cell fill={fillColor} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="text-lg font-bold -mt-6" style={{ color: fillColor }}>{value.toFixed(2)}</div>
      <div className="text-xs text-muted-foreground/70">{label}</div>
    </div>
  );
}

// ─── Top 5 Risk Register ──────────────────────────────────────────────────
function RiskRegister({ risks }) {
  if (!risks || risks.length === 0) return <div className="text-xs text-muted-foreground/70 text-center py-8">No risks registered</div>;
  const impactColors = { Critical: 'text-destructive', Major: 'text-destructive', Moderate: 'text-amber-400', Minor: 'text-primary' };
  return (
    <div className="space-y-1.5">
      {risks.map((r, i) => (
        <div key={i} className="bg-muted/40 border border-border/30 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-foreground/80">#{r.rank || i + 1}</span>
            <span className={`text-xs font-medium ${impactColors[r.impact] || 'text-muted-foreground'}`}>{r.impact || 'Moderate'}</span>
          </div>
          <p className="text-sm text-muted-foreground mb-2">{r.description}</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground/70">Probability:</span>
            <div className="w-20 h-1.5 bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${(r.probability || 0.5) * 100}%` }}></div>
            </div>
            <span className="text-muted-foreground">{Math.round((r.probability || 0.5) * 100)}%</span>
          </div>
          {r.mitigation && <p className="text-xs text-muted-foreground/70 mt-1 italic">Mitigation: {r.mitigation}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Cost Categories Bar Chart ───────────────────────────────────────────
function CostCategoryBreakdown({ categories }) {
  if (!categories || categories.length === 0) return <div className="text-xs text-muted-foreground/70 text-center py-8">No cost categories</div>;
  const data = categories.map(c => ({
    name: c.name.length > 15 ? c.name.substring(0, 15) + '\u2026' : c.name,
    budget: c.budget / 1e6,
    actual: c.actual / 1e6,
    pct: c.pctComplete || 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis type="number" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
        <YAxis dataKey="name" type="category" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} width={90} />
        <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--color-foreground)', fontSize: '12px' }} labelStyle={{ color: 'var(--color-foreground)' }} itemStyle={{ color: 'var(--color-foreground)' }} formatter={(val) => '$' + val.toFixed(1) + 'M'} />
        <Bar dataKey="budget" fill="var(--color-chart-1)" name="Budget ($M)" radius={[0, 3, 3, 0]} />
        <Bar dataKey="actual" fill="var(--color-chart-2)" name="Actual ($M)" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Trend Line Chart ─────────────────────────────────────────────────────
function TrendChart({ data, lines, yLabel }) {
  if (!data || data.length === 0) return <div className="text-xs text-muted-foreground/70 text-center py-8">No trend data</div>;
  const colors = ['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)', 'var(--color-chart-4)', 'var(--color-chart-5)'];
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="period" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
        <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} domain={[0, 'auto']} />
        <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--color-foreground)', fontSize: '12px' }} labelStyle={{ color: 'var(--color-foreground)' }} itemStyle={{ color: 'var(--color-foreground)' }} />
        <Legend wrapperStyle={{ fontSize: '11px', color: 'var(--muted-foreground)' }} />
        {lines.map((l, i) => (
          <Line key={l.key} type="monotone" dataKey={l.key} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 3 }} name={l.label || l.key} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Data Entry Modal ─────────────────────────────────────────────────────
function DataEntryModal({ open, onClose, onSave, initialData }) {
  const [form, setForm] = useState({});
  useEffect(() => {
    if (initialData) setForm(initialData);
  }, [initialData]);

  if (!open) return null;
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const handleSave = () => { onSave(form); onClose(); };

  const sections = [
    { title: 'Earned Value', fields: [
      { key: 'originalBudget', label: 'Original Budget ($)', type: 'number' },
      { key: 'actualCost', label: 'Actual Cost ($)', type: 'number' },
      { key: 'percentComplete', label: '% Complete', type: 'number', step: 0.1 },
      { key: 'plannedPctComplete', label: 'Planned % Complete', type: 'number', step: 0.1 },
    ]},
    { title: 'Financial & Contingency', fields: [
      { key: 'contingencyBudget', label: 'Contingency Budget ($)', type: 'number' },
      { key: 'contingencyUsed', label: 'Contingency Used ($)', type: 'number' },
      { key: 'cashPosition', label: 'Cash Position ($)', type: 'number' },
      { key: 'billingToDate', label: 'Billing to Date ($)', type: 'number' },
    ]},
    { title: 'Safety', fields: [
      { key: 'totalWorkHours', label: 'Total Work Hours', type: 'number' },
      { key: 'recordableIncidents', label: 'Recordable Incidents', type: 'number' },
      { key: 'lostTimeIncidents', label: 'Lost Time Incidents', type: 'number' },
      { key: 'safetyDaysSinceLast', label: 'Days Since Last Incident', type: 'number' },
    ]},
    { title: 'Quality', fields: [
      { key: 'rfiTotal', label: 'Total RFIs', type: 'number' },
      { key: 'rfiAvgResponseDays', label: 'Avg RFI Response (days)', type: 'number', step: 0.1 },
      { key: 'punchlistItems', label: 'Punchlist Items', type: 'number' },
      { key: 'reworkCost', label: 'Rework Cost ($)', type: 'number' },
    ]},
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <PencilSimple weight="duotone" size={16} className="text-muted-foreground" />
            Update Construction Metrics
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground/80 p-1">
            <X weight="duotone" size={14} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {sections.map(sec => (
            <div key={sec.title}>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">{sec.title}</h3>
              <div className="grid grid-cols-2 gap-3">
                {sec.fields.map(f => (
                  <div key={f.key}>
                    <label className="block text-xs text-muted-foreground mb-0.5">{f.label}</label>
                    <input
                      type={f.type || 'text'}
                      step={f.step}
                      value={form[f.key] ?? ''}
                      onChange={e => update(f.key, parseFloat(e.target.value) || 0)}
                      className="w-full bg-muted border border-border px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave}>Save Metrics</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function ConstructionDashboard({ setActiveTab }) {
  const { inputs, results } = usePermitData();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEntry, setShowEntry] = useState(false);

  const fetchData = () => {
    if (!results) return;
    setLoading(true);
    fetchConstructionData(inputs?.siteName || 'default', inputs, results).then(res => {
      if (res?.data) setData(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    if (results) fetchData();
    else setLoading(false);
  }, [inputs, results]);

  const handleSaveData = async (formData) => {
    const payload = {
      projectName: data?.projectName || 'BigWatt AI Campus \u2014 Site A',
      asOfDate: new Date().toISOString().split('T')[0],
      originalBudget: formData.originalBudget ?? data?.evm?.BAC,
      actualCost: formData.actualCost ?? data?.evm?.ACWP,
      percentComplete: formData.percentComplete ?? data?.evm?.percentComplete,
      plannedPctComplete: formData.plannedPctComplete ?? data?.evm?.plannedPctComplete,
      totalWorkHours: formData.totalWorkHours ?? data?.safety?.totalWorkHours,
      recordableIncidents: formData.recordableIncidents ?? data?.safety?.recordableIncidents,
      lostTimeIncidents: formData.lostTimeIncidents ?? data?.safety?.lostTimeIncidents,
      safetyDaysSinceLast: formData.safetyDaysSinceLast ?? data?.safetyDaysSinceLast,
      rfiTotal: formData.rfiTotal ?? data?.quality?.rfiTotal,
      rfiAvgResponseDays: formData.rfiAvgResponseDays ?? data?.quality?.rfiAvgResponseDays,
      punchlistItems: formData.punchlistItems ?? data?.quality?.punchlistItems,
      reworkCost: formData.reworkCost ?? data?.quality?.reworkCost,
      contingencyBudget: formData.contingencyBudget ?? data?.contingency?.budget,
      contingencyUsed: formData.contingencyUsed ?? data?.contingency?.used,
      cashPosition: formData.cashPosition ?? data?.cashPosition,
      billingToDate: formData.billingToDate ?? data?.billingToDate,
      cashReceivedToDate: formData.cashReceivedToDate ?? data?.cashReceivedToDate,
      firstAidCases: formData.firstAidCases ?? data?.safety?.firstAidCases,
      fatalities: formData.fatalities ?? data?.safety?.fatalities,
      safetyObservationsResolved: formData.safetyObservationsResolved ?? data?.safety?.safetyObservationsResolved,
      safetyObservationsTotal: formData.safetyObservationsTotal ?? data?.safety?.safetyObservationsTotal,
      rfiCriticalPathCount: formData.rfiCriticalPathCount ?? data?.quality?.rfiCriticalPathCount,
      punchlistClosed: formData.punchlistClosed ?? data?.quality?.punchlistClosed,
      milestoneVarianceDays: formData.milestoneVarianceDays ?? data?.schedule?.milestoneVarianceDays,
      criticalPathLength: formData.criticalPathLength ?? data?.schedule?.criticalPathLength,
      floatConsumed: formData.floatConsumed ?? data?.schedule?.floatConsumed,
      ownerContingencyBudget: formData.ownerContingencyBudget ?? data?.ownerContingencyBudget,
      gcContingencyBudget: formData.gcContingencyBudget ?? data?.gcContingencyBudget,
      ownerContingencyUsed: formData.ownerContingencyUsed ?? data?.ownerContingencyUsed,
      gcContingencyUsed: formData.gcContingencyUsed ?? data?.gcContingencyUsed,
      headcount: formData.headcount ?? data?.headcount,
      weatherDaysLost: formData.weatherDaysLost ?? data?.weatherDaysLost,
      weatherDaysClaimed: formData.weatherDaysClaimed ?? data?.weatherDaysClaimed,
      gcBuyoutComplete: formData.gcBuyoutComplete ?? data?.gcBuyoutComplete,
      storedMaterialsValue: formData.storedMaterialsValue ?? data?.storedMaterialsValue,
      lienWaiversReceived: formData.lienWaiversReceived ?? data?.lienWaiversReceived,
      inspectionPassRate: formData.inspectionPassRate ?? data?.inspectionPassRate,
      commissioningPrerequisites: formData.commissioningPrerequisites ?? data?.commissioningPrerequisites,
      plannedFinish: formData.plannedFinish ?? data?.schedule?.plannedFinish,
      forecastFinish: formData.forecastFinish ?? data?.schedule?.forecastFinish,
      customerNeedDate: formData.customerNeedDate ?? data?.schedule?.customerNeedDate,
      plannedMargin: formData.plannedMargin ?? data?.plannedMargin,
    };
    if (formData.vendors) payload.vendors = formData.vendors;
    try {
      const res = await saveConstructionData(inputs?.siteName || 'default', payload);
      if (res?.data) setData(res.data);
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  // ─── Empty State (no Site Intake results) ───────────────────────────────
  if (!results) {
    return (
      <div className="px-10 py-8 max-w-[1180px] mx-auto">
        <Card>
          <CardContent className="text-center py-16">
            <p className="text-lg font-semibold text-foreground mb-2">No construction data generated yet</p>
            <p className="text-sm text-muted-foreground mb-6">
              Run Site Intake to generate construction project controls, EVM metrics, and the full C-Suite dashboard for your site.
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => setActiveTab?.('intake')}>Generate via Site Intake</Button>
              <Button variant="outline" onClick={() => setActiveTab?.('siteplanner')}>Plan via Site Planner</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-muted-foreground">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent animate-spin"></div>
          <span className="text-sm">Loading construction dashboard...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-muted-foreground text-sm">
        Could not load construction data. Ensure backend is running.
        <button onClick={fetchData} className="ml-2 text-primary hover:underline">Retry</button>
      </div>
    );
  }

  // ─── Derived Data ────────────────────────────────────────────────────────
  const evm = data.evm || {};
  const safety = data.safety || {};
  const quality = data.quality || {};
  const schedule = data.schedule || {};
  const cont = data.contingency || {};
  const chg = data.changeOrders || {};
  const health = data.healthSummary || {};
  const flags = data.flags || [];

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Construction Project Controls</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{data.projectName} | As of {data.asOfDate}</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            Click <span className="text-primary font-mono bg-primary/20 border border-primary/40 rounded px-1 text-xs">fx</span> on any metric to see its formula
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowEntry(true)}>
            <PencilSimple weight="duotone" size={14} className="mr-1" />
            Update Metrics
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <ArrowsClockwise weight="duotone" size={14} className="mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Overall Health Banner ── */}
      <Card className="py-0" size="sm">
        <CardContent className="flex items-center gap-3 py-2.5">
          <span className="text-xs text-muted-foreground">Project Health:</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-primary">{health.green}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs text-amber-400">{health.amber}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs text-destructive">{health.red}</span>
            </span>
            <span className="text-xs text-muted-foreground/70">|</span>
            <span className="text-xs text-muted-foreground">Overall Score:</span>
            <span className={`text-sm font-bold ${health.overallScore >= 80 ? 'text-primary' : 'text-destructive'}`}>
              {health.overallScore}%
            </span>
          </div>
          {flags.length > 0 && (
            <span className="text-xs text-destructive ml-auto flex items-center gap-1">
              <WarningCircle weight="duotone" size={12} />
              {flags.length} flag{flags.length > 1 ? 's' : ''} active
            </span>
          )}
        </CardContent>
      </Card>

      {/* ── Flags / Alerts ── */}
      {flags.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5 py-0" size="sm">
          <CardContent className="py-3">
            <div className="text-xs font-semibold text-destructive mb-2 flex items-center gap-1.5">
              <WarningCircle weight="duotone" size={12} />
              Active Alerts
            </div>
            <div className="space-y-1">
              {flags.map((f, i) => (
                <div key={i} className="text-xs text-destructive flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-destructive" />
                  {f}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Tabbed Interface ── */}
      <Tabs defaultValue="csuite" className="w-full">
        <TabsList variant="line" className="w-full flex-wrap gap-0">
          <TabsTrigger value="csuite">
            <Gauge weight="duotone" size={14} />
            C-Suite Dashboard
          </TabsTrigger>
          <TabsTrigger value="leadership">
            <ChartBar weight="duotone" size={14} />
            Leadership Reporting
          </TabsTrigger>
          <TabsTrigger value="hse">
            <ShieldCheck weight="duotone" size={14} />
            HSE
          </TabsTrigger>
          <TabsTrigger value="quality">
            <SealCheck weight="duotone" size={14} />
            Quality
          </TabsTrigger>
          <TabsTrigger value="financials">
            <CurrencyDollar weight="duotone" size={14} />
            Financials
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <CalendarCheck weight="duotone" size={14} />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="costcat">
            <Folder weight="duotone" size={14} />
            Cost Categories
          </TabsTrigger>
          <TabsTrigger value="trackers">
            <Clipboard weight="duotone" size={14} />
            Other Trackers
          </TabsTrigger>
          <TabsTrigger value="risks">
            <Warning weight="duotone" size={14} />
            Risk Register
          </TabsTrigger>
          <TabsTrigger value="pcos">
            <NotePencil weight="duotone" size={14} />
            PCO Tracker
          </TabsTrigger>
          <TabsTrigger value="baseline">
            <TrendUp weight="duotone" size={14} />
            Baseline & Projections
          </TabsTrigger>
          <TabsTrigger value="vendor">
            <Clipboard weight="duotone" size={14} />
            Vendor Ledger
          </TabsTrigger>
          <TabsTrigger value="charts">
            <ChartLine weight="duotone" size={14} />
            Advanced Charts
          </TabsTrigger>
          <TabsTrigger value="3dview">
            <Cube weight="duotone" size={14} />
            3D Site View
          </TabsTrigger>
        </TabsList>

        {/* ════════════════ C-Suite Dashboard ════════════════ */}
        <TabsContent value="csuite" className="mt-4 space-y-4">
          {/* C-Suite Dashboard - High Level Rollup */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Gauge weight="duotone" size={16} className="text-primary -mt-0.5" />
                C-Suite Dashboard — Total Development Cost (TDC)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <KpiCard title="Baseline Budget" value={`$${(evm?.BAC / 1e6).toFixed(1)}M`} status="green" subtitle="Approved TDC" metricKey="eac" data={data} />
                <KpiCard title="Forecast EAC" value={`$${(evm?.EAC / 1e6).toFixed(1)}M`} status={evm?.EAC > evm?.BAC ? 'red' : 'green'} subtitle={evm?.EAC > evm?.BAC ? `$${((evm?.EAC - evm?.BAC) / 1e6).toFixed(1)}M over budget` : 'Within budget'} metricKey="eac" data={data} />
                <KpiCard title="Revenue" value={`$${(data.revenue / 1e6).toFixed(1)}M`} status="green" subtitle={`Margin: ${(data.forecastMargin * 100).toFixed(1)}% actual vs ${(data.plannedMargin * 100).toFixed(1)}% planned`} metricKey="forecastMargin" data={data} />
                <KpiCard title="Net Cash Position" value={`$${(data.netCashPosition / 1e6).toFixed(1)}M`} status={data.netCashPosition < 0 ? 'red' : 'green'} subtitle={data.netCashPosition < 0 ? 'Negative \u2014 review AR aging' : 'Positive'} metricKey="netCashPosition" data={data} />
              </div>

              {/* Milestone Volatility + Contingency Burn */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-amber-400">Milestone Volatility</CardTitle>
                    <CardDescription>Variance Days</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-3xl font-bold text-foreground">{Math.abs(schedule?.scheduleSlipDays || 0)}</span>
                      <span className="text-sm text-destructive">days behind schedule</span>
                    </div>
                    <div className="bg-muted/40 h-2">
                      <div className="h-2 bg-amber-500" style={{ width: `${Math.min(100, Math.abs(schedule?.scheduleSlipDays || 0))}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>On track</span>
                      <span>Critical ({Math.abs(schedule?.scheduleSlipDays || 0)}d slip)</span>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-blue-400">Contingency Burn Rate vs Physical Progress</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-muted-foreground">Contingency Used</div>
                        <div className="text-2xl font-bold text-foreground">{data.contingencyBurnPct || 0}%</div>
                        <div className="text-xs text-muted-foreground/70">of ${(cont?.budget / 1e6).toFixed(1)}M budget</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Physical Progress</div>
                        <div className="text-2xl font-bold text-foreground">{schedule?.percentCompletePhysical || 0}%</div>
                        <div className="text-xs text-muted-foreground/70">complete</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Unapproved Claims + Safety */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-destructive">Unapproved Claims & Change Order Exposure</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">${((chg?.pendingValue || 0) / 1e6).toFixed(1)}M</div>
                    <div className="text-xs text-muted-foreground mt-1">{chg?.pendingCount || 0} pending PCOs · Avg {(chg?.avgAgingDays || 0)}d aging</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-primary">Safety & Health Compliance — TRIR</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">{safety?.trir || 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">TRIR · {safety?.safetyDaysSinceLast || 0} days since last incident · {safety?.recordableIncidents || 0} recordable</div>
                  </CardContent>
                </Card>
              </div>

              {/* Top 5 Risk Register */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    <Warning weight="duotone" size={16} className="text-destructive -mt-0.5" />
                    Top 5 Risk Register (RED/YELLOW)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RiskRegister risks={data.topRisks} />
                </CardContent>
              </Card>

              {/* Advanced Visuals */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <BudgetWaterfall data={data} />
                <MilestoneVarianceChart data={data} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════ Leadership Reporting ════════════════ */}
        <TabsContent value="leadership" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <ChartBar weight="duotone" size={16} className="text-primary -mt-0.5" />
                Leadership Reporting
              </CardTitle>
              <CardDescription>Portfolio project grid with traffic-light performance indicators</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project ID</TableHead>
                    <TableHead>Project Name</TableHead>
                    <TableHead>As of Date</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Planned Margin</TableHead>
                    <TableHead>Forecast Margin</TableHead>
                    <TableHead>CPI</TableHead>
                    <TableHead>SPI</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Safety</TableHead>
                    <TableHead>Quality</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs text-muted-foreground">{data.projectId || 'BIGW-001'}</TableCell>
                    <TableCell className="font-medium text-foreground">{data.projectName || 'BigWatt AI Campus'}</TableCell>
                    <TableCell className="text-muted-foreground">{data.asOfDate}</TableCell>
                    <TableCell className="text-foreground">${(data.revenue / 1e6).toFixed(1)}M</TableCell>
                    <TableCell className="text-foreground">{(data.plannedMargin * 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-foreground">{(data.forecastMargin * 100).toFixed(1)}%</TableCell>
                    <TableCell><TrafficBadge status={evm?.statusCPI || 'gray'} /></TableCell>
                    <TableCell><TrafficBadge status={evm?.statusSPI || 'gray'} /></TableCell>
                    <TableCell><TrafficBadge status={schedule?.statusMS || 'gray'} /></TableCell>
                    <TableCell><TrafficBadge status={safety?.statusTRIR || 'gray'} /></TableCell>
                    <TableCell><TrafficBadge status={quality?.statusRework || 'gray'} /></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════ HSE ════════════════ */}
        <TabsContent value="hse" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <KpiCard title="TRIR" value={safety?.trir?.toFixed(2) || '\u2014'} status={safety?.statusTRIR} subtitle="Recordable Incident Rate" metricKey="trir" data={data} />
            <KpiCard title="LTIR" value={safety?.ltir?.toFixed(2) || '\u2014'} status={safety?.statusLTIR} subtitle="Lost Time Incident Rate" metricKey="ltir" data={data} />
            <KpiCard title="Days Since Last Incident" value={data.safetyDaysSinceLast || 0} status={data.safetyDaysSinceLast > 30 ? 'green' : data.safetyDaysSinceLast > 7 ? 'amber' : 'red'} />
            <KpiCard title="Total Work Hours" value={(safety?.totalWorkHours || 0).toLocaleString()} status="green" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Safety Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                {[
                  { label: 'Total Hours', value: safeFormat(safety?.totalWorkHours || 0) },
                  { label: 'Recordable Incidents', value: safety?.recordableIncidents || 0 },
                  { label: 'Lost Time Incidents', value: safety?.lostTimeIncidents || 0 },
                  { label: 'First Aid Cases', value: safety?.firstAidCases || 0 },
                  { label: 'Fatalities', value: safety?.fatalities || 0 },
                  { label: 'Days Since Last', value: data.safetyDaysSinceLast || 0 },
                ].map((item, i) => (
                  <div key={i} className="bg-muted/40 p-3 text-center">
                    <div className="text-muted-foreground mb-1">{item.label}</div>
                    <div className="text-lg font-bold text-foreground">{item.value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════ Quality ════════════════ */}
        <TabsContent value="quality" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <KpiCard title="Total RFIs" value={quality?.rfiTotal || 0} status="green" />
            <KpiCard title="Avg RFI Response" value={`${quality?.rfiAvgResponseDays?.toFixed(1) || '\u2014'}d`} status={quality?.statusRFI || 'gray'} metricKey="rfiResponseDays" data={data} />
            <KpiCard title="Punchlist Open" value={quality?.punchlistOpen || 0} status={quality?.punchlistOpen < 20 ? 'green' : quality?.punchlistOpen < 40 ? 'amber' : 'red'} subtitle={`of ${quality?.punchlistItems || 0} total`} />
            <KpiCard title="Rework Cost" value={`$${((quality?.reworkCost || 0) / 1e6).toFixed(1)}M`} status={quality?.statusRework || 'gray'} subtitle={`${quality?.reworkPct || 0}% of total`} metricKey="reworkPct" data={data} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Quality Metrics Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs">
                  {[
                    { label: 'Total RFIs Submitted', value: quality?.rfiTotal || 0 },
                    { label: 'Avg Response Time', value: `${quality?.rfiAvgResponseDays?.toFixed(1) || '\u2014'} days` },
                    { label: 'Punchlist Items', value: quality?.punchlistItems || 0 },
                    { label: 'Punchlist Closed', value: quality?.punchlistClosed || 0 },
                    { label: 'Punchlist Close Rate', value: `${quality?.punchlistCloseRate?.toFixed(1) || 0}%` },
                    { label: 'Rework Cost', value: `$${((quality?.reworkCost || 0) / 1e6).toFixed(1)}M` },
                    { label: 'Rework % of Cost', value: `${quality?.reworkPct || 0}%` },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between bg-muted/30 px-3 py-2">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-semibold text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>AHJ & Commissioning</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Inspection Pass Rate</span>
                      <span>{(data.inspectionPassRate || 0).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-muted overflow-hidden">
                      <div className={`h-full ${data.inspectionPassRate >= 90 ? 'bg-green-500' : data.inspectionPassRate >= 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${data.inspectionPassRate || 0}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground/70 mt-0.5">
                      <span>Pass</span>
                      <span>{data.inspectionPassRate >= 90 ? 'On Track' : data.inspectionPassRate >= 80 ? 'At Risk' : 'Critical'}</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Commissioning Prerequisites</span>
                      <span>{data.commissioningPrerequisites || 0}%</span>
                    </div>
                    <div className="h-2 bg-muted overflow-hidden">
                      <div className="h-full bg-purple-500" style={{ width: `${data.commissioningPrerequisites || 0}%` }}></div>
                    </div>
                  </div>
                  <div className="bg-muted/40 p-3 text-xs">
                    <div className="text-muted-foreground">AHJ Permit Status</div>
                    <div className="text-foreground font-semibold mt-1">{data.ahjPermitStatus || 'Not Started'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ════════════════ Financials ════════════════ */}
        <TabsContent value="financials" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <KpiCard title="CPI" value={evm?.CPI?.toFixed(3) || '\u2014'} status={evm?.statusCPI} subtitle={`EV: $${(evm?.EV / 1e6).toFixed(1)}M`} metricKey="cpi" data={data} />
            <KpiCard title="EAC" value={`$${(evm?.EAC / 1e6).toFixed(1)}M`} status={evm?.statusVAC} subtitle={`BAC: $${(evm?.BAC / 1e6).toFixed(1)}M`} metricKey="eac" data={data} />
            <KpiCard title="VAC" value={`$${(evm?.VAC / 1e6).toFixed(1)}M`} status={evm?.statusVAC} subtitle={`${evm?.VACPct?.toFixed(1) || 0}%`} metricKey="vac" data={data} />
            <KpiCard title="Contingency" value={`${cont?.utilizationPct?.toFixed(0) || 0}%`} status={cont?.status} subtitle={`Used: $${(cont?.used / 1e6).toFixed(1)}M`} metricKey="contingencyUtilization" data={data} />
            <KpiCard title="Cash Position" value={`$${(data.cashPosition / 1e6).toFixed(1)}M`} status={data.cashPosition > 0 ? 'green' : 'red'} metricKey="netCashPosition" data={data} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>EVM Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs">
                  {[
                    { label: 'Budget at Completion (BAC)', value: `$${(evm?.BAC / 1e6).toFixed(1)}M` },
                    { label: 'Actual Cost (ACWP)', value: `$${(evm?.ACWP / 1e6).toFixed(1)}M` },
                    { label: 'Earned Value (EV)', value: `$${(evm?.EV / 1e6).toFixed(1)}M` },
                    { label: 'Planned Value (PV)', value: `$${(evm?.PV / 1e6).toFixed(1)}M` },
                    { label: 'Cost Variance (CV)', value: `$${(evm?.CV / 1e6).toFixed(1)}M` },
                    { label: 'Schedule Variance (SV)', value: `$${(evm?.SV / 1e6).toFixed(1)}M` },
                    { label: 'TCPI', value: evm?.TCPI?.toFixed(3) || '\u2014' },
                    { label: '% Complete', value: `${evm?.percentComplete}%` },
                    { label: 'Planned % Complete', value: `${evm?.plannedPctComplete}%` },
                    { label: 'Billing to Date', value: `$${(data.billingToDate / 1e6).toFixed(1)}M` },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between bg-muted/30 px-3 py-1.5">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-semibold text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Change Order (PCO) Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted/40 p-3">
                      <div className="text-muted-foreground">Total PCOs</div>
                      <div className="text-lg font-bold text-foreground">{chg?.totalPCO || 0}</div>
                    </div>
                    <div className="bg-muted/40 p-3">
                      <div className="text-muted-foreground">Total Value</div>
                      <div className="text-lg font-bold text-destructive">${((chg?.totalPCOValue || 0) / 1e6).toFixed(1)}M</div>
                    </div>
                    <div className="bg-muted/40 p-3">
                      <div className="text-muted-foreground">Pending</div>
                      <div className="text-lg font-bold text-destructive">{chg?.pendingCount || 0}</div>
                    </div>
                    <div className="bg-muted/40 p-3">
                      <div className="text-muted-foreground">Avg Aging</div>
                      <div className="text-lg font-bold text-foreground">{chg?.avgAgingDays || 0}d</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Financial Trackers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-xs">
                    {[
                      { label: 'Retainage', value: `$${(data.retainage / 1e6).toFixed(1)}M` },
                      { label: 'Owner Contingency Used', value: `$${(data.ownerContingencyUsed / 1e6).toFixed(1)}M` },
                      { label: 'GC Contingency Used', value: `$${(data.gcContingencyUsed / 1e6).toFixed(1)}M` },
                      { label: 'Stored Materials', value: `$${(data.storedMaterialsValue / 1e6).toFixed(1)}M` },
                      { label: 'GC Buyout Complete', value: `${data.gcBuyoutComplete || 0}%` },
                      { label: 'Lien Waivers Received', value: data.lienWaiversReceived || 0 },
                    ].map((item, i) => (
                      <div key={i} className="flex justify-between bg-muted/30 px-3 py-1.5">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-semibold text-foreground">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ════════════════ Schedule ════════════════ */}
        <TabsContent value="schedule" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <KpiCard title="SPI" value={evm?.SPI?.toFixed(3) || '\u2014'} status={evm?.statusSPI} subtitle="Schedule Performance" metricKey="spi" data={data} />
            <KpiCard title="Schedule Slip" value={`${schedule?.scheduleSlipDays || 0}d`} status={schedule?.statusMS || 'gray'} metricKey="scheduleSlipDays" data={data} />
            <KpiCard title="Critical Path" value={`${schedule?.criticalPathLength || 0}d`} status={schedule?.criticalPathLength > 60 ? 'red' : schedule?.criticalPathLength > 30 ? 'amber' : 'green'} />
            <KpiCard title="Float Consumed" value={`${schedule?.floatConsumed || 0}d`} status={schedule?.floatConsumed > 30 ? 'red' : schedule?.floatConsumed > 15 ? 'amber' : 'green'} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Schedule Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs">
                  {[
                    { label: 'Planned Finish', value: schedule?.plannedFinish || '\u2014' },
                    { label: 'Forecast Finish', value: schedule?.forecastFinish || '\u2014' },
                    { label: 'Schedule Slip', value: `${schedule?.scheduleSlipDays || 0} days` },
                    { label: 'Slip %', value: `${schedule?.scheduleSlipPct || 0}%` },
                    { label: 'Milestone Variance', value: `${schedule?.milestoneVarianceDays || 0} days` },
                    { label: 'Critical Path Length', value: `${schedule?.criticalPathLength || 0} days` },
                    { label: 'Float Consumed', value: `${schedule?.floatConsumed || 0} days` },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between bg-muted/30 px-3 py-1.5">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-semibold text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>CPI / SPI Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart data={data.trendData || []} lines={[
                  { key: 'cpi', label: 'CPI' }, { key: 'spi', label: 'SPI' },
                ]} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ════════════════ Cost Categories ════════════════ */}
        <TabsContent value="costcat" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost Category Breakdown (Budget vs Actual)</CardTitle>
            </CardHeader>
            <CardContent>
              <CostCategoryBreakdown categories={data.costCategories} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Detailed Cost Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right">% Complete</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data.costCategories || []).map((cat, i) => {
                    const remaining = cat.budget - cat.actual;
                    const variance = cat.budget > 0 ? ((cat.budget - cat.actual) / cat.budget * 100).toFixed(1) : 0;
                    return (
                      <TableRow key={i}>
                        <TableCell className="text-foreground/80">{cat.name}</TableCell>
                        <TableCell className="text-right text-muted-foreground">${(cat.budget / 1e6).toFixed(1)}M</TableCell>
                        <TableCell className="text-right text-muted-foreground">${(cat.actual / 1e6).toFixed(1)}M</TableCell>
                        <TableCell className="text-right text-muted-foreground">${(remaining / 1e6).toFixed(1)}M</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-12 h-1.5 bg-muted overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${cat.pctComplete}%` }}></div>
                            </div>
                            <span className="text-muted-foreground">{cat.pctComplete}%</span>
                          </div>
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${variance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                          {variance >= 0 ? '+' : ''}{variance}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════ Other Trackers ════════════════ */}
        <TabsContent value="trackers" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <KpiCard title="GC Buyout Status" value={`${data.gcBuyoutComplete || 0}%`} status={data.gcBuyoutComplete >= 90 ? 'green' : data.gcBuyoutComplete >= 70 ? 'amber' : 'red'} subtitle="Percent complete" />
            <KpiCard title="Stored Materials (Offsite)" value={`$${((data.storedMaterialsValue || 0) / 1e6).toFixed(1)}M`} status="amber" subtitle="Value stored offsite" />
            <KpiCard title="Lien Waiver Compliance" value={data.lienWaiverCompliance || 'N'} status={data.lienWaiverCompliance === 'Y' ? 'green' : 'red'} subtitle={`${data.lienWaiversReceived || 0} received`} />
            <KpiCard title="Headcount" value={data.headcount || 0} status={data.actualVsPlannedHeadcountPct >= 90 ? 'green' : 'amber'} subtitle={data.actualVsPlannedHeadcountPct ? `${data.actualVsPlannedHeadcountPct}% of planned` : ''} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>
                <Clipboard weight="duotone" size={16} className="text-muted-foreground -mt-0.5" />
                Other Construction Trackers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {[
                  { label: 'AHJ Permit Status', value: data.ahjPermitStatus || '\u2014' },
                  { label: 'AHJ Inspection Pass Rate', value: `${data.inspectionPassRate || 0}%` },
                  { label: 'Commissioning Prerequisites', value: `${data.cxPrerequisitesPct || 0}%` },
                  { label: 'Weather Days Lost (Total)', value: `${data.weatherDaysLost || 0}d` },
                  { label: 'Weather Days Claimed', value: `${data.weatherDaysClaimed || 0}d` },
                  { label: 'RFIs on Critical Path', value: data.quality?.rfiCriticalPathCount || 0 },
                  { label: 'Stored Materials Value', value: `$${((data.storedMaterialsValue || 0) / 1e6).toFixed(1)}M` },
                  { label: 'Lien Waivers Received', value: data.lienWaiversReceived || 0 },
                  { label: 'Retainage Withheld', value: `$${((data.retainage || 0) / 1e6).toFixed(1)}M` },
                  { label: 'Net Payable This Month', value: `$${((data.netPayableThisMonth || 0) / 1e6).toFixed(1)}M` },
                  { label: 'Weather Days Lost', value: `${data.weatherDaysLost || 0} days` },
                  { label: 'Pending PCO Aging (Avg)', value: `${chg?.avgAgingDays || 0}d` },
                ].map((item, i) => (
                  <div key={i} className="bg-muted/30 px-3 py-2">
                    <div className="text-muted-foreground mb-0.5">{item.label}</div>
                    <div className="font-semibold text-foreground">{item.value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KpiCard title="Owner Contingency" value={`$${((data.ownerContingencyBudget || 0) / 1e6).toFixed(1)}M`} status={(data.ownerContingencyUsed || 0) > (data.ownerContingencyBudget || 0) * 0.8 ? 'red' : 'green'} subtitle={`$${((data.ownerContingencyUsed || 0) / 1e6).toFixed(1)}M used`} />
            <KpiCard title="GC Contingency" value={`$${((data.gcContingencyBudget || 0) / 1e6).toFixed(1)}M`} status={(data.gcContingencyUsed || 0) > (data.gcContingencyBudget || 0) * 0.8 ? 'red' : 'amber'} subtitle={`$${((data.gcContingencyUsed || 0) / 1e6).toFixed(1)}M used`} />
          </div>
        </TabsContent>

        {/* ════════════════ Risk Register ════════════════ */}
        <TabsContent value="risks" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <Warning weight="duotone" size={16} className="text-destructive -mt-0.5" />
                Top 5 Risk Register
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RiskRegister risks={data.topRisks} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════ PCO Tracker ════════════════ */}
        <TabsContent value="pcos" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <KpiCard title="Total PCOs" value={chg?.totalPCO || 0} status="green" subtitle={`${chg?.approvedCount || 0} approved`} />
            <KpiCard title="Total PCO Value" value={`$${((chg?.totalPCOValue || 0) / 1e6).toFixed(1)}M`} status={chg?.pendingCount > 3 ? 'amber' : 'green'} />
            <KpiCard title="Pending PCOs" value={chg?.pendingCount || 0} status={chg?.pendingCount > 5 ? 'red' : chg?.pendingCount > 2 ? 'amber' : 'green'} subtitle={`$${((chg?.pendingValue || 0) / 1e6).toFixed(1)}M pending`} />
            <KpiCard title="Avg Aging" value={`${chg?.avgAgingDays || 0}d`} status={chg?.status || 'gray'} subtitle={`Max: ${chg?.maxAgingDays || 0}d`} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>PCO Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PCO #</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead className="text-right">Aging</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data.changeOrders?.pcoList || []).map((pco, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-foreground/80">{pco.id}</TableCell>
                      <TableCell className="text-muted-foreground">{pco.description}</TableCell>
                      <TableCell className="text-right text-foreground/80">${(pco.value / 1e6).toFixed(2)}M</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={pco.status === 'Approved' ? 'default' : 'destructive'} className="px-2 py-0.5">
                          {pco.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{pco.agingDays}d</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════ Baseline & Projections ════════════════ */}
        <TabsContent value="baseline" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Project Baseline & Projections</CardTitle>
              <CardDescription>Edit baseline inputs and current actuals below. Projections update instantly — save to persist.</CardDescription>
            </CardHeader>
            <CardContent>
              <BaselineProjections
                data={data}
                onSave={(payload) => { handleSaveData(payload); }}
                initialBaseline={{
                  originalBudget: evm?.BAC,
                  contingencyBudget: cont?.budget,
                  baselineStartDate: '2024-06-01',
                  baselineFinishDate: data?.schedule?.plannedFinish || '2026-09-15',
                  customerNeedDate: data?.schedule?.customerNeedDate || '2026-08-15',
                  plannedHeadcount: data?.headcount,
                  plannedMargin: data?.plannedMargin,
                  actualCost: evm?.ACWP,
                  percentComplete: evm?.percentComplete,
                  plannedPctComplete: evm?.plannedPctComplete,
                  cashReceived: data?.cashReceivedToDate,
                  billedToDate: data?.billingToDate,
                  contingencyUsed: cont?.used,
                  totalWorkHours: safety?.totalWorkHours,
                  recordableIncidents: safety?.recordableIncidents,
                  lostTimeIncidents: safety?.lostTimeIncidents,
                  rfiTotal: quality?.rfiTotal,
                  rfiAvgResponseDays: quality?.rfiAvgResponseDays,
                  punchlistItems: quality?.punchlistItems,
                  reworkCost: quality?.reworkCost,
                  cashPosition: data?.cashPosition,
                  safetyDaysSinceLast: data?.safetyDaysSinceLast,
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════ Vendor Ledger ════════════════ */}
        <TabsContent value="vendor" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vendor / Commitment Ledger</CardTitle>
              <CardDescription>Editable cost ledger with per-vendor commitment tracking and reconciliation against project EAC.</CardDescription>
            </CardHeader>
            <CardContent>
              <VendorLedger
                data={data}
                onSave={(payload) => {
                  handleSaveData({ vendors: payload.vendors, ...(data ? {
                    originalBudget: data.evm?.BAC,
                    actualCost: data.evm?.ACWP,
                    percentComplete: data.evm?.percentComplete,
                    plannedPctComplete: data.evm?.plannedPctComplete,
                    totalWorkHours: data.safety?.totalWorkHours,
                    recordableIncidents: data.safety?.recordableIncidents,
                    lostTimeIncidents: data.safety?.lostTimeIncidents,
                  } : {}) });
                }}
                savedVendors={data?.vendors || null}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════ Advanced Charts ════════════════ */}
        <TabsContent value="charts" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Visualizations</CardTitle>
              <CardDescription>PowerBI-beating charts: waterfall bridge, milestone variance, CPI/SPI trend, and cost category breakdown.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <BudgetWaterfall data={data} />
                <MilestoneVarianceChart data={data} />
                <CPISPITrend data={data} />
                <Card>
                  <CardHeader>
                    <CardTitle>Cost Category Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CostCategoryBreakdown categories={data.costCategories} />
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════ 3D Site View ════════════════ */}
        <TabsContent value="3dview" className="mt-4 space-y-4">
          <SiteView3DWrapper key="3dview-stable" data={data} />
        </TabsContent>
      </Tabs>

      <DataEntryModal
        open={showEntry}
        onClose={() => setShowEntry(false)}
        onSave={handleSaveData}
        initialData={{
          originalBudget: evm?.BAC,
          actualCost: evm?.ACWP,
          percentComplete: evm?.percentComplete,
          plannedPctComplete: evm?.plannedPctComplete,
          contingencyBudget: cont?.budget,
          contingencyUsed: cont?.used,
          cashPosition: data.cashPosition,
          billingToDate: data.billingToDate,
          totalWorkHours: safety?.totalWorkHours,
          recordableIncidents: safety?.recordableIncidents,
          lostTimeIncidents: safety?.lostTimeIncidents,
          safetyDaysSinceLast: data.safetyDaysSinceLast,
          rfiTotal: quality?.rfiTotal,
          rfiAvgResponseDays: quality?.rfiAvgResponseDays,
          punchlistItems: quality?.punchlistItems,
          reworkCost: quality?.reworkCost,
        }}
      />
    </div>
  );
}

function safeFormat(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

// ─── Stable 3D View Wrapper ───────────────────────────────────────────────
const SiteView3DWrapper = React.memo(function SiteView3DWrapper({ data }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>3D Site View — Construction Progress Model</CardTitle>
        <CardDescription>
          Interactive 3D model of the site. Structures are color-coded: green = complete, amber = in progress, gray = not started.
          Use the slider to scrub through the project timeline. Hover or click structures for phase details.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SiteView3D data={data} />
      </CardContent>
    </Card>
  );
});