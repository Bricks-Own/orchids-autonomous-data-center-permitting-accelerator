import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import METRIC_DEFINITIONS from './MetricRegistry';

// ─── Formula Popover ────────────────────────────────────────────────────────
// Shows a three-row computation breakdown when a user clicks the ƒx badge
// on any KPI card. The popover panel is rendered via a portal to document.body
// with fixed positioning so it breaks out of any CSS stacking context created
// by a parent transform (e.g. hover:scale-[1.02] on KpiCard).
export default function FormulaPopover({ metricKey, data, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const panelRef = useRef(null);
  const dataKeyRef = useRef(null);

  const def = METRIC_DEFINITIONS[metricKey];
  if (!def) return children || null;

  // Close on data change (handles tab switch without unmounting the top KPI row)
  useEffect(() => {
    const key = data?.projectId + '|' + data?.asOfDate + '|' + metricKey;
    if (dataKeyRef.current !== null && dataKeyRef.current !== key) {
      setOpen(false);
    }
    dataKeyRef.current = key;
  });

  // Position the portal panel after it's rendered — useLayoutEffect avoids flash
  useLayoutEffect(() => {
    if (!open || !btnRef.current || !panelRef.current) return;
    const btnRect = btnRef.current.getBoundingClientRect();
    const panelRect = panelRef.current.getBoundingClientRect();
    const gap = 6;

    let top = btnRect.bottom + gap;
    let left = btnRect.left;

    // Flip above if no room below
    if (top + panelRect.height > window.innerHeight - 8) {
      top = Math.max(8, btnRect.top - gap - panelRect.height);
    }

    // Clamp horizontally
    if (left + panelRect.width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - panelRect.width - 8);
    }
    left = Math.max(8, left);

    setPos({ top, left });
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target) &&
          btnRef.current && !btnRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const escHandler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', escHandler);
    return () => document.removeEventListener('keydown', escHandler);
  }, [open]);

  // Close on scroll (simpler than repositioning)
  useEffect(() => {
    if (!open) return;
    const scrollHandler = () => setOpen(false);
    window.addEventListener('scroll', scrollHandler, true);
    return () => window.removeEventListener('scroll', scrollHandler, true);
  }, [open]);

  // Compute the actual value and input values
  const computedValue = def.compute(data);
  const thresholds = def.thresholds;

  // Get traffic light color
  const getStatusColor = (val) => {
    if (val === undefined || val === null) return 'gray';
    const isLowerBetter = ['trir', 'ltir', 'reworkPct', 'rfiResponseDays', 'scheduleSlipDays', 'milestoneVarianceDays', 'contingencyUtilization', 'contingencyBurnRatio'].includes(metricKey);
    if (isLowerBetter) {
      if (val <= thresholds.green) return 'text-primary';
      if (val <= thresholds.amber) return 'text-destructive';
      return 'text-destructive';
    }
    if (val >= thresholds.green) return 'text-primary';
    if (val >= thresholds.amber) return 'text-destructive';
    return 'text-destructive';
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

  // Format helpers — separate formatters for result vs input values
  const fmtResult = (v) => {
    if (typeof v !== 'number') return String(v || '—');
    if (metricKey === 'trir' || metricKey === 'ltir') return v.toFixed(2);
    if (metricKey === 'contingencyUtilization' || metricKey === 'reworkPct' || metricKey === 'vacPct') return v.toFixed(1) + '%';
    if (metricKey === 'cpi' || metricKey === 'spi' || metricKey === 'tcpi') return v.toFixed(3);
    if (metricKey === 'forecastMargin') return (v * 100).toFixed(1) + '%';
    if (metricKey === 'netCashPosition' || metricKey === 'eac' || metricKey === 'eac2' || metricKey === 'vac') return '$' + (v / 1e6).toFixed(1) + 'M';
    if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (Math.abs(v) >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
    return v.toFixed(1);
  };

  const fmtInput = (v) => {
    if (typeof v !== 'number') return String(v || '—');
    if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (Math.abs(v) >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
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
    return fmtInput(val);
  };

  return (
    <span className="inline-flex items-center">
      {children}
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="ml-1.5 text-[10px] font-mono text-primary bg-primary/20 border border-primary/40 rounded px-1 py-0.5 hover:bg-primary/30 transition-colors cursor-pointer"
        title="See how this is computed"
      >
        ƒx
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          className="fixed z-50 bg-background border border-border   p-4 min-w-[320px] max-w-[400px]"
          style={{ top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-3">
            <h4 className="text-xs font-semibold text-foreground">{def.label}</h4>
            <p className="text-[10px] text-muted-foreground mt-0.5">{def.detail || ''}</p>
          </div>

          {/* Row 1: Formula in named terms */}
          <div className="mb-2">
            <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1">Formula</div>
            <div className="text-xs text-primary font-mono bg-primary/10  px-3 py-2 border border-primary/30">
              {def.formulaText}
            </div>
          </div>

          {/* Row 2: Formula with live substituted values */}
          <div className="mb-2">
            <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1">With Current Values</div>
            <div className="text-xs text-foreground/80 font-mono bg-muted/50  px-3 py-2 border border-border/30">
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
              <span className={`font-bold ${statusColor}`}>{fmtResult(computedValue)}</span>
            </div>
          </div>

          {/* Row 3: Result with threshold */}
          <div>
            <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1">Result</div>
            <div className="flex items-center justify-between bg-muted/50  px-3 py-2 border border-border/30">
              <span className="text-xs font-bold text-foreground">{fmtResult(computedValue)}</span>
              <span className={`text-xs font-bold px-2 py-0.5  ${statusColor} bg-opacity-20 ${
                statusLabel === 'GREEN' ? 'bg-primary/10 text-primary' :
                statusLabel === 'AMBER' ? 'bg-amber-900/30 text-destructive' :
                'bg-destructive/10 text-destructive'
              }`}>
                {statusLabel} {statusLabel === 'GREEN' ? '(≥ ' + thresholds.green + ')' : statusLabel === 'AMBER' ? '(≥ ' + thresholds.amber + ')' : '(< ' + thresholds.amber + ')'}
              </span>
            </div>
          </div>

          {/* Input values */}
          {def.inputs.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1">Input Values</div>
              <div className="space-y-1">
                {def.inputs.map((inp, i) => (
                  <div key={i} className="flex justify-between text-[11px]">
                    <span className="text-muted-foreground">{inp.label}</span>
                    <span className="text-foreground/80 font-mono">{resolveInput(inp.key)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </span>
  );
}