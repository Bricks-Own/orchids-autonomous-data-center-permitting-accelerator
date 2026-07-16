import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, LineChart, Line, Legend, AreaChart, Area,
} from 'recharts';

// ─── Waterfall Chart: BAC → EAC Bridge ────────────────────────────────────
export function BudgetWaterfall({ data }) {
  const evm = data?.evm || {};
  const changeOrders = data?.changeOrders || {};
  const BAC = evm.BAC || 0;
  const approvedCOs = changeOrders.totalPCOValue || 0;
  const pendingExposure = changeOrders.pendingValue || 0;
  const EAC = evm.EAC || BAC;
  const perfVariance = EAC - (BAC + approvedCOs + pendingExposure);
  const total = BAC + approvedCOs + pendingExposure + (perfVariance > 0 ? perfVariance : 0);

  const waterfall = [
    { name: 'BAC', value: BAC / 1e6, fill: 'var(--color-chart-1)', isTotal: false },
    { name: '+ Approved COs', value: approvedCOs / 1e6, fill: 'var(--color-chart-2)', isTotal: false },
    { name: '+ Pending Exposure', value: pendingExposure / 1e6, fill: 'var(--color-chart-3)', isTotal: false },
    { name: '± Performance', value: parseFloat((perfVariance / 1e6).toFixed(1)), fill: perfVariance >= 0 ? 'var(--color-chart-4)' : 'var(--color-chart-2)', isTotal: false },
    { name: 'EAC', value: EAC / 1e6, fill: 'var(--color-chart-5)', isTotal: true },
  ];

  let running = 0;
  const waterfallData = waterfall.map((item, i) => {
    if (item.isTotal) {
      return { ...item, base: 0 };
    }
    const base = running;
    running += item.value;
    return { ...item, base };
  });
  waterfallData[waterfallData.length - 1] = { ...waterfallData[waterfallData.length - 1], base: 0, value: EAC / 1e6 };

  const CustomBar = (props) => {
    const { x, y, width, height, fill } = props;
    const item = waterfallData[props.index];
    if (!item) return null;
    if (item.isTotal) {
      return <rect x={x} y={y} width={width} height={height} fill={fill} rx={4} />;
    }
    const barY = item.value >= 0 ? y : y + height;
    const barH = Math.abs(height);
    return <rect x={x} y={barY} width={width} height={Math.max(barH, 1)} fill={fill} rx={2} />;
  };

  return (
    <div className="border border-border/40 bg-card/40 p-4">
      <h3 className="text-xs font-semibold text-muted-foreground mb-3">Budget → EAC Waterfall Bridge</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={waterfallData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="name" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} />
          <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} tickFormatter={(v) => '$' + v.toFixed(0) + 'M'} />
          <Tooltip
            contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--color-foreground)', fontSize: '12px' }}
            labelStyle={{ color: 'var(--color-foreground)' }}
            itemStyle={{ color: 'var(--color-foreground)' }}
            formatter={(val) => '$' + val.toFixed(1) + 'M'}
          />
          <Bar dataKey="value" name="Amount" shape={<CustomBar />}>
            {waterfallData.map((entry, idx) => (
              <Cell key={idx} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="text-xs text-muted-foreground/70 mt-1">BAC → Approved COs → Pending Exposure → Performance Variance → EAC</div>
    </div>
  );
}

// ─── S-Curve: Planned vs Actual vs Projected ──────────────────────────────
export function SCurveChart({ projections }) {
  const data = projections?.sCurveData || [];
  if (data.length === 0) return null;

  return (
    <div className="border border-border/40 bg-card/40 p-4">
      <h3 className="text-xs font-semibold text-muted-foreground mb-3">Cost S-Curve</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="period" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} />
          <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} domain={[0, 100]} />
          <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--color-foreground)', fontSize: '12px' }} labelStyle={{ color: 'var(--color-foreground)' }} itemStyle={{ color: 'var(--color-foreground)' }} />
          <Legend wrapperStyle={{ fontSize: '10px', color: 'var(--muted-foreground)' }} />
          <Line type="monotone" dataKey="planned" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} name="Planned" />
          <Line type="monotone" dataKey="actual" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} name="Actual" />
          <Line type="monotone" dataKey="projected" stroke="var(--color-chart-3)" strokeWidth={2} strokeDasharray="6 3" dot={false} name="Projected" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Contingency Drawdown vs Physical Progress ────────────────────────────
export function ContingencyDrawdown({ projections }) {
  const data = projections?.contDrawdown || [];
  if (data.length === 0) return null;

  const zeroCrossIdx = data.findIndex(d => d.contingency <= 0);
  const zeroCrossPct = projections?.contZeroPct || '—';

  return (
    <div className="border border-border/40 bg-card/40 p-4">
      <h3 className="text-xs font-semibold text-muted-foreground mb-3">Contingency Drawdown vs Physical Progress</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="period" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} />
          <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} domain={[0, 100]} />
          <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--color-foreground)', fontSize: '12px' }} labelStyle={{ color: 'var(--color-foreground)' }} itemStyle={{ color: 'var(--color-foreground)' }} />
          <Legend wrapperStyle={{ fontSize: '10px', color: 'var(--muted-foreground)' }} />
          <Line type="monotone" dataKey="contingency" stroke="var(--color-chart-3)" strokeWidth={2} dot={false} name="Contingency %" />
          <Line type="monotone" dataKey="physicalProgress" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} name="Physical Progress %" />
        </LineChart>
      </ResponsiveContainer>
      <div className="text-xs text-muted-foreground/70 mt-1">
        Contingency zero-crossing projected at ~{zeroCrossPct}% physical progress
        {zeroCrossIdx > 0 && zeroCrossIdx < data.length ? ` (between ${data[Math.max(0, zeroCrossIdx - 1)]?.period} and ${data[zeroCrossIdx]?.period})` : ''}
      </div>
    </div>
  );
}

// ─── Milestone Variance Bars ──────────────────────────────────────────────
export function MilestoneVarianceChart({ data }) {
  const milestoneDetails = data?.milestoneDetails || [];
  if (milestoneDetails.length === 0) return null;

  const chartData = milestoneDetails.map(m => ({
    name: m.name?.substring(0, 16) || 'Milestone',
    variance: m.varianceDays || 0,
    isCritical: (m.varianceDays || 0) > 15,
  }));

  return (
    <div className="border border-border/40 bg-card/40 p-4">
      <h3 className="text-xs font-semibold text-muted-foreground mb-3">Milestone Variance — Baseline vs Forecast</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis type="number" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} />
          <YAxis dataKey="name" type="category" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} width={95} />
          <Tooltip
            contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--color-foreground)', fontSize: '12px' }}
            labelStyle={{ color: 'var(--color-foreground)' }}
            itemStyle={{ color: 'var(--color-foreground)' }}
            formatter={(val) => val + ' days'}
          />
          <Bar dataKey="variance" name="Variance (Days)" radius={[0, 3, 3, 0]}>
            {chartData.map((entry, idx) => (
              <Cell key={idx} fill={entry.variance > 0 ? (entry.isCritical ? 'var(--color-chart-4)' : 'var(--color-chart-3)') : 'var(--color-chart-2)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="text-xs text-muted-foreground/70 mt-1">Red = critical path delay (&gt;15d); amber = at risk; green = ahead of schedule</div>
    </div>
  );
}

// ─── CPI/SPI Trend (extended) ─────────────────────────────────────────────
export function CPISPITrend({ data }) {
  const trendData = data?.trendData || [];
  if (trendData.length === 0) return null;

  return (
    <div className="border border-border/40 bg-card/40 p-4">
      <h3 className="text-xs font-semibold text-muted-foreground mb-3">CPI / SPI Trend (6 months)</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="period" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} />
          <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} domain={[0.5, 1.1]} />
          <Tooltip contentStyle={{ background: 'var(--color-card)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--color-foreground)', fontSize: '12px' }} labelStyle={{ color: 'var(--color-foreground)' }} itemStyle={{ color: 'var(--color-foreground)' }} />
          <Legend wrapperStyle={{ fontSize: '10px', color: 'var(--muted-foreground)' }} />
          <Line type="monotone" dataKey="cpi" stroke="var(--color-chart-1)" strokeWidth={2} dot={{ r: 3 }} name="CPI" />
          <Line type="monotone" dataKey="spi" stroke="var(--color-chart-2)" strokeWidth={2} dot={{ r: 3 }} name="SPI" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}