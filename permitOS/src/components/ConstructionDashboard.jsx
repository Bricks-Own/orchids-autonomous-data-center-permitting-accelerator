import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { fetchConstructionData, saveConstructionData } from '../utils/api';
import SiteView3D from './SiteView3D';

// ─── Color / Style Constants ──────────────────────────────────────────────
const TL = {
  green: { bg: 'bg-green-900/20 border-green-800/30', dot: 'bg-green-500', text: 'text-green-400', label: 'On Track' },
  amber: { bg: 'bg-amber-900/20 border-amber-800/30', dot: 'bg-amber-500', text: 'text-amber-400', label: 'At Risk' },
  red:   { bg: 'bg-red-900/20 border-red-800/30', dot: 'bg-red-500', text: 'text-red-400', label: 'Critical' },
  gray:  { bg: 'bg-gray-800/30 border-gray-700/30', dot: 'bg-gray-500', text: 'text-gray-400', label: 'N/A' },
};

function TrafficDot({ status = 'gray', label }) {
  const s = TL[status] || TL.gray;
  return (
    <span className="inline-flex items-center gap-1.5" title={label || s.label}>
      <span className={`w-2 h-2 rounded-full ${s.dot}`}></span>
      <span className={`text-xs ${s.text}`}>{label || s.label}</span>
    </span>
  );
}

function KpiCard({ title, value, status, subtitle, onClick, children }) {
  const s = TL[status] || TL.gray;
  return (
    <div
      className={`rounded-xl border ${s.bg} p-4 cursor-pointer transition-all hover:scale-[1.02] ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 font-medium">{title}</span>
        <TrafficDot status={status} />
      </div>
      <div className={`text-xl font-bold ${s.text}`}>{value}</div>
      {subtitle && <div className="text-xs text-gray-600 mt-0.5">{subtitle}</div>}
      {children}
    </div>
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
      <div className="text-xs text-gray-600">{label}</div>
    </div>
  );
}

// ─── Top 5 Risk Register ──────────────────────────────────────────────────
function RiskRegister({ risks }) {
  if (!risks || risks.length === 0) return <div className="text-xs text-gray-600 text-center py-8">No risks registered</div>;
  const impactColors = { Critical: 'text-red-400', Major: 'text-amber-400', Moderate: 'text-yellow-400', Minor: 'text-green-400' };
  return (
    <div className="space-y-1.5">
      {risks.map((r, i) => (
        <div key={i} className="bg-gray-800/40 border border-gray-700/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-300">#{r.rank || i + 1}</span>
            <span className={`text-xs font-medium ${impactColors[r.impact] || 'text-gray-400'}`}>{r.impact || 'Moderate'}</span>
          </div>
          <p className="text-sm text-gray-400 mb-2">{r.description}</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-600">Probability:</span>
            <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(r.probability || 0.5) * 100}%` }}></div>
            </div>
            <span className="text-gray-500">{Math.round((r.probability || 0.5) * 100)}%</span>
          </div>
          {r.mitigation && <p className="text-xs text-gray-600 mt-1 italic">Mitigation: {r.mitigation}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Cost Categories Bar Chart ───────────────────────────────────────────
function CostCategoryBreakdown({ categories }) {
  if (!categories || categories.length === 0) return <div className="text-xs text-gray-600 text-center py-8">No cost categories</div>;
  const data = categories.map(c => ({
    name: c.name.length > 15 ? c.name.substring(0, 15) + '…' : c.name,
    budget: c.budget / 1e6,
    actual: c.actual / 1e6,
    pct: c.pctComplete || 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis dataKey="name" type="category" tick={{ fill: '#9ca3af', fontSize: 11 }} width={90} />
        <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb', fontSize: '12px' }} />
        <Bar dataKey="budget" fill="#6366f1" name="Budget ($M)" radius={[0, 3, 3, 0]} />
        <Bar dataKey="actual" fill="#22c55e" name="Actual ($M)" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Trend Line Chart ─────────────────────────────────────────────────────
function TrendChart({ data, lines, yLabel }) {
  if (!data || data.length === 0) return <div className="text-xs text-gray-600 text-center py-8">No trend data</div>;
  const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis dataKey="period" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={[0, 'auto']} />
        <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb', fontSize: '12px' }} />
        <Legend wrapperStyle={{ fontSize: '11px', color: '#9ca3af' }} />
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
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <span>📋</span> Update Construction Metrics
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 p-1">✕</button>
        </div>
        <div className="p-4 space-y-4">
          {sections.map(sec => (
            <div key={sec.title}>
              <h3 className="text-xs font-semibold text-gray-400 mb-2 uppercase">{sec.title}</h3>
              <div className="grid grid-cols-2 gap-3">
                {sec.fields.map(f => (
                  <div key={f.key}>
                    <label className="block text-xs text-gray-500 mb-0.5">{f.label}</label>
                    <input
                      type={f.type || 'text'}
                      step={f.step}
                      value={form[f.key] ?? ''}
                      onChange={e => update(f.key, parseFloat(e.target.value) || 0)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
            <button onClick={onClose} className="px-4 py-2 text-xs text-gray-400 bg-gray-800 rounded-lg hover:bg-gray-700">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 text-xs text-white bg-indigo-600 rounded-lg hover:bg-indigo-500">Save Metrics</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main ConstructionDashboard Component ─────────────────────────────────
export default function ConstructionDashboard({ inputs, results }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState('leadership');
  const [showEntry, setShowEntry] = useState(false);

  const fetchData = () => {
    setLoading(true);
    fetchConstructionData('BIGWATT-SITEA-001', inputs, results).then(res => {
      if (res?.data) setData(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [inputs, results]);

  const handleSaveData = async (formData) => {
    const payload = {
      projectName: data?.projectName || 'BigWatt AI Campus — Site A',
      asOfDate: new Date().toISOString().split('T')[0],
      originalBudget: formData.originalBudget || data?.evm?.BAC,
      actualCost: formData.actualCost || data?.evm?.ACWP,
      percentComplete: formData.percentComplete || data?.evm?.percentComplete,
      plannedPctComplete: formData.plannedPctComplete || data?.evm?.plannedPctComplete,
      totalWorkHours: formData.totalWorkHours || data?.safety?.totalWorkHours,
      recordableIncidents: formData.recordableIncidents || data?.safety?.recordableIncidents,
      lostTimeIncidents: formData.lostTimeIncidents || data?.safety?.lostTimeIncidents,
      safetyDaysSinceLast: formData.safetyDaysSinceLast || data?.safetyDaysSinceLast,
      rfiTotal: formData.rfiTotal || data?.quality?.rfiTotal,
      rfiAvgResponseDays: formData.rfiAvgResponseDays || data?.quality?.rfiAvgResponseDays,
      punchlistItems: formData.punchlistItems || data?.quality?.punchlistItems,
      reworkCost: formData.reworkCost || data?.quality?.reworkCost,
      contingencyBudget: formData.contingencyBudget || data?.contingency?.budget,
      contingencyUsed: formData.contingencyUsed || data?.contingency?.used,
      cashPosition: formData.cashPosition || data?.cashPosition,
      billingToDate: formData.billingToDate || data?.billingToDate,
    };
    try {
      await saveConstructionData('BIGWATT-SITEA-001', payload);
      fetchData(); // Refresh
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  // Derived KPIs
  const kpis = useMemo(() => {
    if (!data) return {};
    const evm = data.evm || {};
    const safety = data.safety || {};
    const quality = data.quality || {};
    const schedule = data.schedule || {};
    const contingency = data.contingency || {};
    return { evm, safety, quality, schedule, contingency };
  }, [data]);

  const subTabs = [
    { id: 'csuite', label: 'C-Suite Dashboard', icon: '🏛️' },
    { id: 'leadership', label: 'Leadership Summary', icon: '📊' },
    { id: 'hse', label: 'HSE', icon: '🛡️' },
    { id: 'quality', label: 'Quality', icon: '✅' },
    { id: 'financials', label: 'Financials', icon: '💰' },
    { id: 'schedule', label: 'Schedule', icon: '📅' },
    { id: 'costcat', label: 'Cost Categories', icon: '📁' },
    { id: 'trackers', label: 'Other Trackers', icon: '📋' },
    { id: 'risks', label: 'Risk Register', icon: '⚠️' },
    { id: 'pcos', label: 'PCO Tracker', icon: '📝' },
    { id: '3dview', label: '3D Site View', icon: '🏗️' },
  ];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm">Loading construction dashboard...</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-gray-500 text-sm">
        Could not load construction data. Ensure backend is running.
        <button onClick={fetchData} className="ml-2 text-indigo-400 hover:underline">Retry</button>
      </div>
    );
  }

  const evm = data.evm || {};
  const safety = data.safety || {};
  const quality = data.quality || {};
  const schedule = data.schedule || {};
  const cont = data.contingency || {};
  const chg = data.changeOrders || {};
  const health = data.healthSummary || {};
  const flags = data.flags || [];

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Construction Project Controls</h1>
          <p className="text-xs text-gray-500 mt-0.5">{data.projectName} | As of {data.asOfDate}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowEntry(true)} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
            <span>✏️</span> Update Metrics
          </button>
          <button onClick={fetchData} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors">
            Refresh
          </button>
        </div>
      </div>

      {/* ── Overall Health Banner ── */}
      <div className="flex items-center gap-3 bg-gray-900/50 border border-gray-800/50 rounded-xl px-4 py-2.5">
        <span className="text-xs text-gray-500">Project Health:</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500"></span><span className="text-xs text-green-400">{health.green}</span></span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span><span className="text-xs text-amber-400">{health.amber}</span></span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span><span className="text-xs text-red-400">{health.red}</span></span>
          <span className="text-xs text-gray-600">|</span>
          <span className="text-xs text-gray-500">Overall Score:</span>
          <span className={`text-sm font-bold ${health.overallScore >= 80 ? 'text-green-400' : health.overallScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {health.overallScore}%
          </span>
        </div>
        {flags.length > 0 && (
          <span className="text-xs text-red-400 ml-auto flex items-center gap-1">
            <span>🔴</span> {flags.length} flag{flags.length > 1 ? 's' : ''} active
          </span>
        )}
      </div>

      {/* ── Flags / Alerts ── */}
      {flags.length > 0 && (
        <div className="bg-red-900/10 border border-red-800/20 rounded-xl p-3">
          <div className="text-xs font-semibold text-red-400 mb-2">⚠ Active Alerts</div>
          <div className="space-y-1">
            {flags.map((f, i) => <div key={i} className="text-xs text-red-300 flex items-center gap-2"><span>•</span>{f}</div>)}
          </div>
        </div>
      )}

      {/* ── C-Suite KPI Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="CPI (Cost Perf Index)" value={evm?.CPI?.toFixed(3) || '—'} status={evm?.statusCPI || 'gray'}
          subtitle={`EAC: $${(evm?.EAC / 1e6).toFixed(1)}M`} onClick={() => setSubTab('financials')} />
        <KpiCard title="SPI (Schedule Perf Index)" value={evm?.SPI?.toFixed(3) || '—'} status={evm?.statusSPI || 'gray'}
          subtitle={`VAC: $${(evm?.VAC / 1e6).toFixed(1)}M`} onClick={() => setSubTab('schedule')} />
        <KpiCard title="Contingency Burn" value={`${cont?.utilizationPct?.toFixed(0) || 0}%`} status={cont?.status || 'gray'}
          subtitle={`Used: $${(cont?.used / 1e6).toFixed(1)}M / $${(cont?.budget / 1e6).toFixed(1)}M`} onClick={() => setSubTab('financials')} />
        <KpiCard title="TRIR (Safety)" value={safety?.trir?.toFixed(2) || '—'} status={safety?.statusTRIR || 'gray'}
          subtitle={`LTIR: ${safety?.ltir?.toFixed(2) || '—'}`} onClick={() => setSubTab('hse')} />
      </div>

      {/* ── Trend Charts Row ── */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-400 mb-3">CPI / SPI Trend (6 months)</h3>
          <TrendChart data={data.trendData || []} lines={[
            { key: 'cpi', label: 'CPI' }, { key: 'spi', label: 'SPI' },
          ]} />
        </div>
        <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-400 mb-3">TRIR & Contingency Trend</h3>
          <TrendChart data={data.trendData || []} lines={[
            { key: 'trir', label: 'TRIR' }, { key: 'contingencyPct', label: 'Contingency %' },
          ]} />
        </div>
      </div>

      {/* ── Sub-tab Navigation ── */}
      <div className="flex flex-wrap gap-1 border-b border-gray-800 pb-2">
        {subTabs.map(st => (
          <button key={st.id} onClick={() => setSubTab(st.id)}
            className={`text-xs px-3 py-1.5 rounded-t-lg transition-all ${subTab === st.id ? 'bg-gray-800/60 text-indigo-300 border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-300'}`}>
            <span className="mr-1">{st.icon}</span>{st.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="min-h-[300px]">
        {/* Leadership Summary */}
        {subTab === 'csuite' && (
          <div className="space-y-4">
            {/* C-Suite Dashboard - High Level Rollup */}
            <div className="rounded-xl border border-indigo-700/30 bg-indigo-950/20 p-5">
              <h3 className="text-sm font-semibold text-indigo-300 mb-4 flex items-center gap-2">
                <span>🏛️</span> C-Suite Dashboard — Total Development Cost (TDC)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
                <KpiCard title="Baseline Budget" value={`$${(evm?.BAC / 1e6).toFixed(1)}M`} status="green" subtitle="Approved TDC" />
                <KpiCard title="Forecast EAC" value={`$${(evm?.EAC / 1e6).toFixed(1)}M`} status={evm?.EAC > evm?.BAC ? 'red' : 'green'} subtitle={evm?.EAC > evm?.BAC ? `$${((evm?.EAC - evm?.BAC) / 1e6).toFixed(1)}M over budget` : 'Within budget'} />
                <KpiCard title="Revenue" value={`$${(data.revenue / 1e6).toFixed(1)}M`} status="green" subtitle={`Margin: ${(data.forecastMargin * 100).toFixed(1)}% actual vs ${(data.plannedMargin * 100).toFixed(1)}% planned`} />
                <KpiCard title="Net Cash Position" value={`$${(data.netCashPosition / 1e6).toFixed(1)}M`} status={data.netCashPosition < 0 ? 'red' : 'green'} subtitle={data.netCashPosition < 0 ? 'Negative — review AR aging' : 'Positive'} />
              </div>
            </div>

            {/* Milestone Volatility + Contingency Burn */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-amber-700/30 bg-amber-950/20 p-4">
                <h4 className="text-xs font-semibold text-amber-300 mb-3">Milestone Volatility — Variance Days</h4>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl font-bold text-white">{Math.abs(schedule?.scheduleSlipDays || 0)}</span>
                  <span className="text-sm text-amber-400">days behind schedule</span>
                </div>
                <div className="bg-gray-700/40 rounded-full h-2">
                  <div className="h-2 rounded-full bg-amber-500" style={{ width: `\${Math.min(100, Math.abs(schedule?.scheduleSlipDays || 0))}%` }}></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>On track</span>
                  <span>Critical ({Math.abs(schedule?.scheduleSlipDays || 0)}d slip)</span>
                </div>
              </div>
              <div className="rounded-xl border border-blue-700/30 bg-blue-950/20 p-4">
                <h4 className="text-xs font-semibold text-blue-300 mb-3">Contingency Burn Rate vs Physical Progress</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500">Contingency Used</div>
                    <div className="text-2xl font-bold text-white">{data.contingencyBurnPct || 0}%</div>
                    <div className="text-xs text-gray-600">of ${(contingency?.budget / 1e6).toFixed(1)}M budget</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Physical Progress</div>
                    <div className="text-2xl font-bold text-white">{schedule?.percentCompletePhysical || 0}%</div>
                    <div className="text-xs text-gray-600">complete</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Unapproved Claims + Safety */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-red-700/30 bg-red-950/10 p-4">
                <h4 className="text-xs font-semibold text-red-300 mb-3">Unapproved Claims & Change Order Exposure</h4>
                <div className="text-2xl font-bold text-red-400">${((chg?.pendingValue || 0) / 1e6).toFixed(1)}M</div>
                <div className="text-xs text-gray-500 mt-1">{chg?.pendingCount || 0} pending PCOs · Avg {(chg?.avgAgingDays || 0)}d aging</div>
              </div>
              <div className="rounded-xl border border-green-700/30 bg-green-950/10 p-4">
                <h4 className="text-xs font-semibold text-green-300 mb-3">Safety & Health Compliance — TRIR</h4>
                <div className="text-2xl font-bold text-green-400">{safety?.trir || 0}</div>
                <div className="text-xs text-gray-500 mt-1">TRIR · {safety?.safetyDaysSinceLast || 0} days since last incident · {safety?.recordableIncidents || 0} recordable</div>
              </div>
            </div>

            {/* Top 5 Risk Register */}
            <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-4">
              <h4 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <span>⚠️</span> Top 5 Risk Register (RED/YELLOW)
              </h4>
              <RiskRegister risks={data.topRisks} />
            </div>
          </div>
        )}

        {subTab === 'leadership' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
                  <span>📊</span> Key Performance Indicators
                </h3>
                <div className="space-y-2 text-xs">
                  {[
                    { label: 'Revenue', value: `$${(data.revenue / 1e6).toFixed(1)}M`, status: 'green' },
                    { label: 'Planned Margin', value: `${(data.plannedMargin * 100).toFixed(1)}%`, status: 'green' },
                    { label: 'Forecast Margin', value: `${(data.forecastMargin * 100).toFixed(1)}%`, status: data.forecastMargin >= data.plannedMargin ? 'green' : 'red' },
                    { label: 'CPI', value: evm?.CPI?.toFixed(3), status: evm?.statusCPI },
                    { label: 'SPI', value: evm?.SPI?.toFixed(3), status: evm?.statusSPI },
                    { label: '% Complete', value: `${evm?.percentComplete}%`, status: 'green' },
                    { label: 'Net Cash Position', value: `$${(data.netCashPosition / 1e6).toFixed(1)}M`, status: data.netCashPosition >= 0 ? 'green' : 'red' },
                    { label: 'Cashflow Position', value: `$${(data.cashPosition / 1e6).toFixed(1)}M`, status: 'green' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-800/30 rounded-lg px-3 py-2">
                      <span className="text-gray-400">{item.label}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-semibold text-gray-200">{item.value}</span>
                        <TrafficDot status={item.status} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-4 mb-4">
                  <h3 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
                    <span>⚠️</span> Top 5 Risk Register
                  </h3>
                  <RiskRegister risks={data.topRisks} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
                  <span>📈</span> EAC / BAC Trend
                </h3>
                {renderEVMBars(evm)}
              </div>
              <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
                  <span>🚦</span> Traffic Light Dashboard
                </h3>
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[
                    { label: 'Cost Performance', status: evm?.statusCPI },
                    { label: 'Schedule Performance', status: evm?.statusSPI },
                    { label: 'VAC', status: evm?.statusVAC },
                    { label: 'Contingency Burn', status: cont?.status },
                    { label: 'Safety (TRIR)', status: safety?.statusTRIR },
                    { label: 'Safety (LTIR)', status: safety?.statusLTIR },
                    { label: 'Rework %', status: quality?.statusRework },
                    { label: 'RFI Response', status: quality?.statusRFI },
                    { label: 'Schedule Slip', status: schedule?.statusMS },
                    { label: 'Inspection Pass', status: data.statusInspection },
                    { label: 'PCO Aging', status: chg?.status },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-800/30 rounded-lg px-2.5 py-1.5">
                      <span className="text-gray-500">{item.label}</span>
                      <TrafficDot status={item.status} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HSE */}
        {subTab === 'hse' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <KpiCard title="TRIR" value={safety?.trir?.toFixed(2) || '—'} status={safety?.statusTRIR} subtitle="Recordable Incident Rate" />
              <KpiCard title="LTIR" value={safety?.ltir?.toFixed(2) || '—'} status={safety?.statusLTIR} subtitle="Lost Time Incident Rate" />
              <KpiCard title="Days Since Last Incident" value={data.safetyDaysSinceLast || 0} status={data.safetyDaysSinceLast > 30 ? 'green' : data.safetyDaysSinceLast > 7 ? 'amber' : 'red'} />
              <KpiCard title="Total Work Hours" value={(safety?.totalWorkHours || 0).toLocaleString()} status="green" />
            </div>
            <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-gray-400 mb-3">Safety Details</h3>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                {[
                  { label: 'Total Hours', value: safeFormat(safety?.totalWorkHours || 0) },
                  { label: 'Recordable Incidents', value: safety?.recordableIncidents || 0 },
                  { label: 'Lost Time Incidents', value: safety?.lostTimeIncidents || 0 },
                  { label: 'First Aid Cases', value: safety?.firstAidCases || 0 },
                  { label: 'Fatalities', value: safety?.fatalities || 0 },
                  { label: 'Days Since Last', value: data.safetyDaysSinceLast || 0 },
                ].map((item, i) => (
                  <div key={i} className="bg-gray-800/40 rounded-lg p-3 text-center">
                    <div className="text-gray-400 mb-1">{item.label}</div>
                    <div className="text-lg font-bold text-gray-200">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Quality */}
        {subTab === 'quality' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <KpiCard title="Total RFIs" value={quality?.rfiTotal || 0} status="green" />
              <KpiCard title="Avg RFI Response" value={`${quality?.rfiAvgResponseDays?.toFixed(1) || '—'}d`} status={quality?.statusRFI || 'gray'} />
              <KpiCard title="Punchlist Open" value={quality?.punchlistOpen || 0} status={quality?.punchlistOpen < 20 ? 'green' : quality?.punchlistOpen < 40 ? 'amber' : 'red'} subtitle={`of ${quality?.punchlistItems || 0} total`} />
              <KpiCard title="Rework Cost" value={`$${((quality?.reworkCost || 0) / 1e6).toFixed(1)}M`} status={quality?.statusRework || 'gray'} subtitle={`${quality?.reworkPct || 0}% of total`} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-gray-400 mb-3">Quality Metrics Details</h3>
                <div className="space-y-2 text-xs">
                  {[
                    { label: 'Total RFIs Submitted', value: quality?.rfiTotal || 0 },
                    { label: 'Avg Response Time', value: `${quality?.rfiAvgResponseDays?.toFixed(1) || '—'} days` },
                    { label: 'Punchlist Items', value: quality?.punchlistItems || 0 },
                    { label: 'Punchlist Closed', value: quality?.punchlistClosed || 0 },
                    { label: 'Punchlist Close Rate', value: `${quality?.punchlistCloseRate?.toFixed(1) || 0}%` },
                    { label: 'Rework Cost', value: `$${((quality?.reworkCost || 0) / 1e6).toFixed(1)}M` },
                    { label: 'Rework % of Cost', value: `${quality?.reworkPct || 0}%` },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between bg-gray-800/30 rounded-lg px-3 py-2">
                      <span className="text-gray-400">{item.label}</span>
                      <span className="font-semibold text-gray-200">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-gray-400 mb-3">AHJ & Commissioning</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Inspection Pass Rate</span>
                      <span>{(data.inspectionPassRate || 0).toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${data.inspectionPassRate >= 90 ? 'bg-green-500' : data.inspectionPassRate >= 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${data.inspectionPassRate || 0}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-600 mt-0.5">
                      <span>Pass</span>
                      <span>{data.inspectionPassRate >= 90 ? 'On Track' : data.inspectionPassRate >= 80 ? 'At Risk' : 'Critical'}</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Commissioning Prerequisites</span>
                      <span>{data.commissioningPrerequisites || 0}%</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${data.commissioningPrerequisites || 0}%` }}></div>
                    </div>
                  </div>
                  <div className="bg-gray-800/40 rounded-lg p-3 text-xs">
                    <div className="text-gray-400">AHJ Permit Status</div>
                    <div className="text-gray-200 font-semibold mt-1">{data.ahjPermitStatus || 'Not Started'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Financials */}
        {subTab === 'financials' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <KpiCard title="CPI" value={evm?.CPI?.toFixed(3) || '—'} status={evm?.statusCPI} subtitle={`EV: $${(evm?.EV / 1e6).toFixed(1)}M`} />
              <KpiCard title="EAC" value={`$${(evm?.EAC / 1e6).toFixed(1)}M`} status={evm?.statusVAC} subtitle={`BAC: $${(evm?.BAC / 1e6).toFixed(1)}M`} />
              <KpiCard title="VAC" value={`$${(evm?.VAC / 1e6).toFixed(1)}M`} status={evm?.statusVAC} subtitle={`${evm?.VACPct?.toFixed(1) || 0}%`} />
              <KpiCard title="Contingency" value={`${cont?.utilizationPct?.toFixed(0) || 0}%`} status={cont?.status} subtitle={`Used: $${(cont?.used / 1e6).toFixed(1)}M`} />
              <KpiCard title="Cash Position" value={`$${(data.cashPosition / 1e6).toFixed(1)}M`} status={data.cashPosition > 0 ? 'green' : 'red'} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-gray-400 mb-3">EVM Summary</h3>
                <div className="space-y-2 text-xs">
                  {[
                    { label: 'Budget at Completion (BAC)', value: `$${(evm?.BAC / 1e6).toFixed(1)}M` },
                    { label: 'Actual Cost (ACWP)', value: `$${(evm?.ACWP / 1e6).toFixed(1)}M` },
                    { label: 'Earned Value (EV)', value: `$${(evm?.EV / 1e6).toFixed(1)}M` },
                    { label: 'Planned Value (PV)', value: `$${(evm?.PV / 1e6).toFixed(1)}M` },
                    { label: 'Cost Variance (CV)', value: `$${(evm?.CV / 1e6).toFixed(1)}M` },
                    { label: 'Schedule Variance (SV)', value: `$${(evm?.SV / 1e6).toFixed(1)}M` },
                    { label: 'TCPI', value: evm?.TCPI?.toFixed(3) || '—' },
                    { label: '% Complete', value: `${evm?.percentComplete}%` },
                    { label: 'Planned % Complete', value: `${evm?.plannedPctComplete}%` },
                    { label: 'Billing to Date', value: `$${(data.billingToDate / 1e6).toFixed(1)}M` },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between bg-gray-800/30 rounded-lg px-3 py-1.5">
                      <span className="text-gray-400">{item.label}</span>
                      <span className="font-semibold text-gray-200">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-4 mb-4">
                  <h3 className="text-xs font-semibold text-gray-400 mb-3">Change Order (PCO) Summary</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-800/40 rounded-lg p-3">
                      <div className="text-gray-500">Total PCOs</div>
                      <div className="text-lg font-bold text-gray-200">{chg?.totalPCO || 0}</div>
                    </div>
                    <div className="bg-gray-800/40 rounded-lg p-3">
                      <div className="text-gray-500">Total Value</div>
                      <div className="text-lg font-bold text-amber-400">${((chg?.totalPCOValue || 0) / 1e6).toFixed(1)}M</div>
                    </div>
                    <div className="bg-gray-800/40 rounded-lg p-3">
                      <div className="text-gray-500">Pending</div>
                      <div className="text-lg font-bold text-amber-400">{chg?.pendingCount || 0}</div>
                    </div>
                    <div className="bg-gray-800/40 rounded-lg p-3">
                      <div className="text-gray-500">Avg Aging</div>
                      <div className="text-lg font-bold text-gray-200">{chg?.avgAgingDays || 0}d</div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-gray-400 mb-3">Financial Trackers</h3>
                  <div className="space-y-2 text-xs">
                    {[
                      { label: 'Retainage', value: `$${(data.retainage / 1e6).toFixed(1)}M` },
                      { label: 'Owner Contingency Used', value: `$${(data.ownerContingencyUsed / 1e6).toFixed(1)}M` },
                      { label: 'GC Contingency Used', value: `$${(data.gcContingencyUsed / 1e6).toFixed(1)}M` },
                      { label: 'Stored Materials', value: `$${(data.storedMaterialsValue / 1e6).toFixed(1)}M` },
                      { label: 'GC Buyout Complete', value: `${data.gcBuyoutComplete || 0}%` },
                      { label: 'Lien Waivers Received', value: data.lienWaiversReceived || 0 },
                    ].map((item, i) => (
                      <div key={i} className="flex justify-between bg-gray-800/30 rounded-lg px-3 py-1.5">
                        <span className="text-gray-400">{item.label}</span>
                        <span className="font-semibold text-gray-200">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Schedule */}
        {subTab === 'schedule' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <KpiCard title="SPI" value={evm?.SPI?.toFixed(3) || '—'} status={evm?.statusSPI} subtitle="Schedule Performance" />
              <KpiCard title="Schedule Slip" value={`${schedule?.scheduleSlipDays || 0}d`} status={schedule?.statusMS || 'gray'} />
              <KpiCard title="Critical Path" value={`${schedule?.criticalPathLength || 0}d`} status={schedule?.criticalPathLength > 60 ? 'red' : schedule?.criticalPathLength > 30 ? 'amber' : 'green'} />
              <KpiCard title="Float Consumed" value={`${schedule?.floatConsumed || 0}d`} status={schedule?.floatConsumed > 30 ? 'red' : schedule?.floatConsumed > 15 ? 'amber' : 'green'} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-gray-400 mb-3">Schedule Details</h3>
                <div className="space-y-2 text-xs">
                  {[
                    { label: 'Planned Finish', value: schedule?.plannedFinish || '—' },
                    { label: 'Forecast Finish', value: schedule?.forecastFinish || '—' },
                    { label: 'Schedule Slip', value: `${schedule?.scheduleSlipDays || 0} days` },
                    { label: 'Slip %', value: `${schedule?.scheduleSlipPct || 0}%` },
                    { label: 'Milestone Variance', value: `${schedule?.milestoneVarianceDays || 0} days` },
                    { label: 'Critical Path Length', value: `${schedule?.criticalPathLength || 0} days` },
                    { label: 'Float Consumed', value: `${schedule?.floatConsumed || 0} days` },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between bg-gray-800/30 rounded-lg px-3 py-1.5">
                      <span className="text-gray-400">{item.label}</span>
                      <span className="font-semibold text-gray-200">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-gray-400 mb-3">CPI / SPI Trend</h3>
                <TrendChart data={data.trendData || []} lines={[
                  { key: 'cpi', label: 'CPI' }, { key: 'spi', label: 'SPI' },
                ]} />
              </div>
            </div>
          </div>
        )}

        {/* Cost Categories */}
        {subTab === 'costcat' && (
          <div className="space-y-4">
            <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-gray-400 mb-3">Cost Category Breakdown (Budget vs Actual)</h3>
              <CostCategoryBreakdown categories={data.costCategories} />
            </div>
            <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-gray-400 mb-3">Detailed Cost Categories</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left py-2 px-2">Category</th>
                      <th className="text-right py-2 px-2">Budget</th>
                      <th className="text-right py-2 px-2">Actual</th>
                      <th className="text-right py-2 px-2">Remaining</th>
                      <th className="text-right py-2 px-2">% Complete</th>
                      <th className="text-right py-2 px-2">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.costCategories || []).map((cat, i) => {
                      const remaining = cat.budget - cat.actual;
                      const variance = cat.budget > 0 ? ((cat.budget - cat.actual) / cat.budget * 100).toFixed(1) : 0;
                      return (
                        <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                          <td className="py-2 px-2 text-gray-300">{cat.name}</td>
                          <td className="py-2 px-2 text-right text-gray-400">${(cat.budget / 1e6).toFixed(1)}M</td>
                          <td className="py-2 px-2 text-right text-gray-400">${(cat.actual / 1e6).toFixed(1)}M</td>
                          <td className="py-2 px-2 text-right text-gray-400">${(remaining / 1e6).toFixed(1)}M</td>
                          <td className="py-2 px-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${cat.pctComplete}%` }}></div>
                              </div>
                              <span className="text-gray-400">{cat.pctComplete}%</span>
                            </div>
                          </td>
                          <td className={`py-2 px-2 text-right font-semibold ${variance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {variance >= 0 ? '+' : ''}{variance}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Risk Register */}
        {subTab === 'trackers' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <KpiCard title="GC Buyout Status" value={`${data.gcBuyoutComplete || 0}%`} status={data.gcBuyoutComplete >= 90 ? 'green' : data.gcBuyoutComplete >= 70 ? 'amber' : 'red'} subtitle="Percent complete" />
              <KpiCard title="Stored Materials (Offsite)" value={`$${((data.storedMaterialsValue || 0) / 1e6).toFixed(1)}M`} status="amber" subtitle="Value stored offsite" />
              <KpiCard title="Lien Waiver Compliance" value={data.lienWaiverCompliance || 'N'} status={data.lienWaiverCompliance === 'Y' ? 'green' : 'red'} subtitle={`${data.lienWaiversReceived || 0} received`} />
              <KpiCard title="Headcount" value={data.headcount || 0} status={data.actualVsPlannedHeadcountPct >= 90 ? 'green' : 'amber'} subtitle={data.actualVsPlannedHeadcountPct ? `${data.actualVsPlannedHeadcountPct}% of planned` : ''} />
            </div>
            <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <span>📋</span> Other Construction Trackers
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {[
                  { label: 'AHJ Permit Status', value: data.ahjPermitStatus || '—' },
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
                  <div key={i} className="bg-gray-800/30 rounded-lg px-3 py-2">
                    <div className="text-gray-500 mb-0.5">{item.label}</div>
                    <div className="font-semibold text-gray-200">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <KpiCard title="Owner Contingency" value={`$${((data.ownerContingencyBudget || 0) / 1e6).toFixed(1)}M`} status={(data.ownerContingencyUsed || 0) > (data.ownerContingencyBudget || 0) * 0.8 ? 'red' : 'green'} subtitle={`$${((data.ownerContingencyUsed || 0) / 1e6).toFixed(1)}M used`} />
              <KpiCard title="GC Contingency" value={`$${((data.gcContingencyBudget || 0) / 1e6).toFixed(1)}M`} status={(data.gcContingencyUsed || 0) > (data.gcContingencyBudget || 0) * 0.8 ? 'red' : 'amber'} subtitle={`$${((data.gcContingencyUsed || 0) / 1e6).toFixed(1)}M used`} />
            </div>
          </div>
        )}

        {subTab === 'risks' && (
          <div className="space-y-4">
            <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <span>⚠️</span> Top 5 Risk Register
              </h3>
              <RiskRegister risks={data.topRisks} />
            </div>
          </div>
        )}

        {/* PCO Tracker */}
        {subTab === '3dview' && (
          <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">3D Site View — Construction Progress Model</h3>
            <p className="text-xs text-gray-500 mb-4">
              Interactive 3D model of the site. Structures are color-coded: green = complete, amber = in progress, gray = not started.
              Use the slider to scrub through the project timeline. Hover or click structures for phase details.
            </p>
            <SiteView3D data={data} />
          </div>
        )}
        {subTab === 'pcos' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <KpiCard title="Total PCOs" value={chg?.totalPCO || 0} status="green" subtitle={`${chg?.approvedCount || 0} approved`} />
              <KpiCard title="Total PCO Value" value={`$${((chg?.totalPCOValue || 0) / 1e6).toFixed(1)}M`} status={chg?.pendingCount > 3 ? 'amber' : 'green'} />
              <KpiCard title="Pending PCOs" value={chg?.pendingCount || 0} status={chg?.pendingCount > 5 ? 'red' : chg?.pendingCount > 2 ? 'amber' : 'green'} subtitle={`$${((chg?.pendingValue || 0) / 1e6).toFixed(1)}M pending`} />
              <KpiCard title="Avg Aging" value={`${chg?.avgAgingDays || 0}d`} status={chg?.status || 'gray'} subtitle={`Max: ${chg?.maxAgingDays || 0}d`} />
            </div>
            <div className="bg-gray-900/40 border border-gray-800/40 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-gray-400 mb-3">PCO Details</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-800">
                      <th className="text-left py-2 px-2">PCO #</th>
                      <th className="text-left py-2 px-2">Description</th>
                      <th className="text-right py-2 px-2">Value</th>
                      <th className="text-right py-2 px-2">Status</th>
                      <th className="text-right py-2 px-2">Aging</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.changeOrders?.pcoList || []).map((pco, i) => (
                      <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                        <td className="py-2 px-2 text-gray-300 font-mono">{pco.id}</td>
                        <td className="py-2 px-2 text-gray-400">{pco.description}</td>
                        <td className="py-2 px-2 text-right text-gray-300">${(pco.value / 1e6).toFixed(2)}M</td>
                        <td className="py-2 px-2 text-right">
                          <span className={`px-1.5 py-0.5 rounded ${pco.status === 'Approved' ? 'bg-green-900/30 text-green-400' : 'bg-amber-900/30 text-amber-400'}`}>{pco.status}</span>
                        </td>
                        <td className="py-2 px-2 text-right text-gray-400">{pco.agingDays}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Data Entry Modal ── */}
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

// ─── Helper Components ────────────────────────────────────────────────────
function renderEVMBars(evm) {
  if (!evm) return <div className="text-xs text-gray-600">No EVM data</div>;
  const data = [
    { name: 'BAC', value: evm.BAC / 1e6 },
    { name: 'EAC', value: evm.EAC / 1e6 },
    { name: 'PV', value: evm.PV / 1e6 },
    { name: 'EV', value: evm.EV / 1e6 },
    { name: 'ACWP', value: evm.ACWP / 1e6 },
  ];
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
        <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#e5e7eb', fontSize: '12px' }} />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.name === 'EAC' ? '#f59e0b' : entry.name === 'ACWP' ? '#ef4444' : '#6366f1'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function safeFormat(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
