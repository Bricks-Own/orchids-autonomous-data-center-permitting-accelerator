import React, { useState, useRef, useEffect } from 'react';
import METRIC_DEFINITIONS from './MetricRegistry';

// ─── Formula Popover ────────────────────────────────────────────────────────
// Shows a three-row computation breakdown when a user clicks/hovers the fx icon
// on any KPI card. Driven entirely by METRIC_DEFINITIONS so formulas never
// drift from the actual computation.
export default function FormulaPopover({ metricKey, data, children }) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);
  const btnRef = useRef(null);

  const def = METRIC_DEFINITIONS[metricKey];
  if (!def) return children || null;

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target) &&
          btnRef.current && !btnRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Compute the actual value and input values
  const computedValue = def.compute(data);
  const thresholds = def.thresholds;

  // Get traffic light color
  const getStatusColor = (val) => {
    if (val === undefined || val === null) return 'gray';
    const isLowerBetter = ['trir', 'ltir', 'reworkPct', 'rfiResponseDays', 'scheduleSlipDays', 'milestoneVarianceDays', 'contingencyUtilization', 'contingencyBurnRatio'].includes(metricKey);
    if (isLowerBetter) {
      if (val <= thresholds.green) return 'text-green-400';
      if (val <= thresholds.amber) return 'text-amber-400';
      return 'text-red-400';
    }
    if (val >= thresholds.green) return 'text-green-400';
    if (val >= thresholds.amber) return 'text-amber-400';
    return 'text-red-400';
  };

  const getStatusLabel = (val) => {
    if (val === undefined || val === null) return 'N/A';
    const isLowerBetter = ['trir', 'ltir', 'reworkPct', 'rfiResponseDays', 'scheduleSlipDays', 'milestoneVarianceDays', 'contingencyUtilization', 'contingencyBurnRatio'].includes(metricKey);
    if (isLowerBetter) {
      if (val <= thresholds.green) return 'GREEN';
      if (val <= thresholds.amber) return 'AMBER';
      return 'RED';
    }
    if (val >= thresholds.green) return 'GREEN';
    if (val >= thresholds.amber) return 'AMBER';
    return 'RED';
  };

  const statusColor = getStatusColor(computedValue);
  const statusLabel = getStatusLabel(computedValue);

  // Format helpers
  const fmtVal = (v) => {
    if (typeof v !== 'number') return String(v || '—');
    if (metricKey === 'trir' || metricKey === 'ltir') return v.toFixed(2);
    if (metricKey === 'contingencyUtilization' || metricKey === 'reworkPct' || metricKey === 'vacPct') return v.toFixed(1) + '%';
    if (metricKey === 'cpi' || metricKey === 'spi' || metricKey === 'tcpi') return v.toFixed(3);
    if (metricKey === 'forecastMargin') return (v * 100).toFixed(1) + '%';
    if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (Math.abs(v) >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
    if (metricKey === 'netCashPosition' || metricKey === 'eac' || metricKey === 'eac2' || metricKey === 'vac') return '$' + Math.round(v).toLocaleString();
    return v.toFixed(1);
  };

  // Resolve input values from data paths
  const resolveInput = (path) => {
    const parts = path.split('.');
    let val = data;
    for (const p of parts) {
      if (val === null || val === undefined) return '—';
      val = val[p];
    }
    return fmtVal(val);
  };

  return (
    <span className="inline-flex items-center">
      {children}
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="ml-1.5 text-[10px] text-gray-600 hover:text-indigo-400 transition-colors px-1 py-0.5 rounded hover:bg-gray-800/50 font-mono"
        title={`How ${def.label} is computed`}
      >
        ƒx
      </button>
      {open && (
        <div
          ref={popoverRef}
          className="absolute z-50 mt-1 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 min-w-[320px] max-w-[400px]"
          style={{ top: '100%', left: '0' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-gray-200">{def.label}</h4>
            <p className="text-[10px] text-gray-500 mt-0.5">{def.detail || ''}</p>
          </div>

          {/* Row 1: Formula in named terms */}
          <div className="mb-2">
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Formula</div>
            <div className="text-xs text-indigo-300 font-mono bg-indigo-950/30 rounded-lg px-3 py-2 border border-indigo-800/30">
              {def.formulaText}
            </div>
          </div>

          {/* Row 2: Formula with live substituted values */}
          <div className="mb-2">
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">With Current Values</div>
            <div className="text-xs text-gray-300 font-mono bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-700/30">
              {def.formulaText.replace(/[A-Za-z\s%()]+/g, (match) => {
                // Try to substitute known values
                for (const inp of def.inputs) {
                  const shortLabel = inp.label.split('=')[0].trim() || inp.label;
                  if (match.includes(shortLabel.split('(')[0].trim())) {
                    const val = resolveInput(inp.key);
                    return val;
                  }
                }
                return match;
              })}
              {' = '}
              <span className={`font-bold ${statusColor}`}>{fmtVal(computedValue)}</span>
            </div>
          </div>

          {/* Row 3: Result with threshold */}
          <div>
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Result</div>
            <div className="flex items-center justify-between bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-700/30">
              <span className="text-xs font-bold text-gray-200">{fmtVal(computedValue)}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColor} bg-opacity-20 ${
                statusLabel === 'GREEN' ? 'bg-green-900/30 text-green-400' :
                statusLabel === 'AMBER' ? 'bg-amber-900/30 text-amber-400' :
                'bg-red-900/30 text-red-400'
              }`}>
                {statusLabel} {statusLabel === 'GREEN' ? '(≥ ' + thresholds.green + ')' : statusLabel === 'AMBER' ? '(≥ ' + thresholds.amber + ')' : '(< ' + thresholds.amber + ')'}
              </span>
            </div>
          </div>

          {/* Input values */}
          {def.inputs.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-800">
              <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Input Values</div>
              <div className="space-y-1">
                {def.inputs.map((inp, i) => (
                  <div key={i} className="flex justify-between text-[11px]">
                    <span className="text-gray-500">{inp.label}</span>
                    <span className="text-gray-300 font-mono">{resolveInput(inp.key)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </span>
  );
}