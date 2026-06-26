import React, { useState } from 'react';
import { AIR_MODULES, STATES_ATTAINMENT } from '../data/permitData';
import { THRESHOLDS } from '../utils/calculations';

// ── Clickable Status Badge (shows popover with details on click) ──
function ClickableStatus({ label, value, threshold, pct, unit, pollutant }) {
  const [show, setShow] = useState(false);
  const color = pct >= 100 ? 'text-red-400 bg-red-900/20 border-red-700/40' :
    pct >= 80 ? 'text-amber-400 bg-amber-900/20 border-amber-700/40' :
    pct >= 50 ? 'text-yellow-400 bg-yellow-900/20 border-yellow-700/40' :
    'text-green-400 bg-green-900/20 border-green-700/40';
  const labelText = pct >= 100 ? 'Major Source' : pct >= 80 ? 'Near Threshold' : pct >= 50 ? 'Synthetic Minor Viable' : 'Below Minor';

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShow(!show)}
        onBlur={() => setTimeout(() => setShow(false), 200)}
        className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80 transition-all ${color}`}
      >
        {labelText}
      </button>
      {show && (
        <div className="absolute z-30 top-full mt-1.5 left-1/2 -translate-x-1/2 w-56 bg-gray-800 border border-gray-700 rounded-xl p-3 shadow-xl shadow-black/50">
          <div className="text-xs font-semibold text-gray-300 mb-2">{label || pollutant} — Status Details</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-gray-500">Value:</span><span className="text-gray-300 font-mono">{value?.toFixed(1)} {unit || 'tpy'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Threshold:</span><span className="text-gray-300 font-mono">{threshold?.toLocaleString()} {unit || 'tpy'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">% of Threshold:</span><span className={`font-mono ${pct >= 100 ? 'text-red-400' : pct >= 80 ? 'text-amber-400' : 'text-green-400'}`}>{pct.toFixed(0)}%</span></div>
            <div className="bg-gray-800/80 rounded-full h-1.5 mt-1">
              <div className={`h-1.5 rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          </div>
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-800 border-t border-l border-gray-700 rotate-45" />
        </div>
      )}
    </div>
  );
}

// ── Clickable Pathway Card ──
function PathwayCard({ label, status, detail, ok, breach, regText, children }) {
  const [exp, setExp] = useState(false);
  return (
    <div className={`border border-gray-800/60 rounded-lg overflow-hidden ${breach ? 'border-red-800/40 bg-red-950/10' : ''}`}>
      <button
        onClick={() => setExp(!exp)}
        className="w-full flex items-start justify-between gap-2 p-3 text-left hover:bg-black/10 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-300 text-xs">{label}</div>
          <div className={`mt-0.5 text-xs ${ok ? 'text-green-400' : 'text-amber-400'}`}>{ok ? 'V' : '~'} {status}</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {breach && <span className="text-xs text-red-400">Related breach</span>}
          <svg className={`w-3.5 h-3.5 text-gray-600 transition-transform ${exp ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {exp && (
        <div className="px-3 pb-3 space-y-2 border-t border-gray-800/40 pt-2">
          <div className="text-xs text-gray-400 leading-relaxed">{detail}</div>
          {regText && <div className="text-xs text-gray-600 font-mono">{regText}</div>}
          {children}
        </div>
      )}
    </div>
  );
}

function PathwayBadge({ label, status, detail }) {
  const [showTip, setShowTip] = useState(false);
  const colorMap = {
    warning: 'bg-red-900/30 border-red-700/40 text-red-400',
    ok: 'bg-green-900/30 border-green-700/40 text-green-400',
    neutral: 'bg-gray-800 border-gray-700 text-gray-500',
  };
  return (
    <div className="relative">
      <button
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        onClick={() => setShowTip(!showTip)}
        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${colorMap[status] || colorMap.neutral} cursor-pointer hover:opacity-80`}
      >
        {status === 'warning' ? '⚠ ' : '✓ '}{label}
      </button>
      {showTip && (
        <div className="absolute z-20 top-full mt-1.5 right-0 w-64 bg-gray-800 border border-gray-700 rounded-xl p-3 shadow-xl shadow-black/40">
          <div className="text-xs text-gray-300 leading-relaxed">{detail}</div>
          <div className="absolute -top-1.5 right-4 w-3 h-3 bg-gray-800 border-t border-l border-gray-700 rotate-45" />
        </div>
      )}
    </div>
  );
}

const SEVERITY_COLORS = {
  critical: { border: 'border-red-700/40', bg: 'bg-red-950/20', badge: 'bg-red-900/40 text-red-400', text: 'text-red-300' },
  high: { border: 'border-red-700/30', bg: 'bg-red-950/15', badge: 'bg-red-900/30 text-red-400', text: 'text-red-300' },
  medium: { border: 'border-amber-700/30', bg: 'bg-amber-950/15', badge: 'bg-amber-900/30 text-amber-400', text: 'text-amber-300' },
  low: { border: 'border-yellow-700/30', bg: 'bg-yellow-950/15', badge: 'bg-yellow-900/30 text-yellow-400', text: 'text-yellow-300' },
  info: { border: 'border-indigo-700/30', bg: 'bg-indigo-950/15', badge: 'bg-indigo-900/30 text-indigo-400', text: 'text-indigo-300' },
  positive: { border: 'border-green-700/30', bg: 'bg-green-950/15', badge: 'bg-green-900/30 text-green-400', text: 'text-green-300' },
};

function BreachCard({ breach, setActiveTab }) {
  const [open, setOpen] = useState(false);
  const colors = SEVERITY_COLORS[breach.severity] || SEVERITY_COLORS.info;
  const statusIcon = breach.status === 'BREACHED' ? 'X' : breach.status === 'MITIGATED' ? '~' : breach.status === 'NOTICE' ? 'i' : 'V';
  const statusColor = breach.status === 'BREACHED' ? 'text-red-400' : breach.status === 'MITIGATED' ? 'text-amber-400' : 'text-indigo-400';

  return (
    <div className={`border rounded-xl ${colors.border} ${colors.bg} overflow-hidden`}>
      {/* ── Clickable Summary Header ── */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-black/10 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${statusColor} bg-gray-900/60 flex-shrink-0`}>
            {statusIcon}
          </span>
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-x-2">
              <span className="text-sm font-semibold text-white">{breach.pollutant}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${colors.badge}`}>{breach.thresholdType}</span>
              <span className={`text-xs font-semibold ${
                breach.status === 'BREACHED' ? 'text-red-400' :
                breach.status === 'MITIGATED' ? 'text-amber-400' : 'text-indigo-400'
              }`}>{breach.status}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{breach.description}</p>
          </div>
        </div>
        <div className="flex-shrink-0 mt-1">
          <svg className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Expanded Details ── */}
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-700/30 pt-3">
          {/* Why this matters */}
          <div className="bg-gray-900/60 rounded-lg p-3">
            <div className="text-xs font-semibold text-gray-400 mb-1">Why This Matters</div>
            <p className="text-xs text-gray-300 leading-relaxed">{breach.description}</p>
          </div>

          {/* Comparison bar */}
          {(breach.baseline > 0 || breach.controlled > 0) && breach.threshold > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 mb-2">Emissions vs. Threshold</div>
              <div className="space-y-1.5">
                {[
                  { label: 'Baseline PTE', value: breach.baseline, color: 'bg-red-500' },
                  { label: 'Brick-Controlled', value: breach.controlled, color: 'bg-indigo-500' },
                  { label: 'Threshold', value: breach.threshold, color: 'bg-gray-600', dashed: true },
                ].map(item => {
                  const pct = Math.min(100, (item.value / breach.threshold) * 100);
                  return (
                    <div key={item.label} className="flex items-center gap-2 text-xs">
                      <span className="text-gray-500 w-28 flex-shrink-0">{item.label}</span>
                      <div className="flex-1 bg-gray-800/60 rounded-full h-2">
                        <div className={`h-2 rounded-full ${item.color} ${item.dashed ? 'opacity-50' : ''}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-gray-400 w-20 text-right font-mono">{item.value.toFixed(1)} {breach.unit}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Margin to threshold */}
          {breach.margin !== undefined && (
            <div className={`text-xs font-medium ${breach.margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {breach.margin >= 0
                ? `+${breach.margin.toFixed(1)} ${breach.unit} margin below threshold — within compliance`
                : `${Math.abs(breach.margin).toFixed(1)} ${breach.unit} over threshold — corrective action needed`}
            </div>
          )}

          {/* ── STRUCTURED REMEDIATION PLAN ── */}
          {breach.remediationSteps && breach.remediationSteps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-gradient-to-r from-indigo-700/40 to-transparent" />
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Remediation Plan</span>
                <div className="h-px flex-1 bg-gradient-to-l from-indigo-700/40 to-transparent" />
              </div>
              <div className="space-y-3">
                {breach.remediationSteps.map((step) => (
                  <div key={step.stepNumber} className="bg-gray-900/60 border border-gray-700/30 rounded-xl overflow-hidden">
                    {/* Step Header */}
                    <div className="bg-gray-800/60 px-3 py-2 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-900/50 text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {step.stepNumber}
                      </span>
                      <span className="text-sm font-semibold text-gray-200">{step.title}</span>
                    </div>

                    {/* Step Body */}
                    <div className="p-3 space-y-2">
                      <p className="text-xs text-gray-400 leading-relaxed">{step.description}</p>

                      {/* Tech Options */}
                      {step.techOptions && step.techOptions.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse mt-1">
                            <thead>
                              <tr className="bg-gray-800/40">
                                <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Technology</th>
                                <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Reduction</th>
                                <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Timeline</th>
                                <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Cost</th>
                                <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Complexity</th>
                              </tr>
                            </thead>
                            <tbody>
                              {step.techOptions.map((opt, oi) => (
                                <tr key={oi} className="border-t border-gray-800/30">
                                  <td className="px-2 py-1.5 text-gray-300 font-medium">{opt.name}</td>
                                  <td className="px-2 py-1.5 text-green-400">{opt.reduction}</td>
                                  <td className="px-2 py-1.5 text-gray-400">{opt.timeline}</td>
                                  <td className="px-2 py-1.5 text-gray-400">{opt.cost}</td>
                                  <td className="px-2 py-1.5">
                                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                                      opt.complexity === 'low' ? 'bg-green-900/30 text-green-400' :
                                      opt.complexity === 'medium' ? 'bg-amber-900/30 text-amber-400' :
                                      'bg-red-900/30 text-red-400'
                                    }`}>{opt.complexity}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Step-specific tab links */}
                      {step.tabLinks && step.tabLinks.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          <span className="text-xs text-gray-600 mr-1 self-center">Execute in:</span>
                          {step.tabLinks.map(link => (
                            <button
                              key={link.tab}
                              onClick={(e) => { e.stopPropagation(); setActiveTab && setActiveTab(link.tab); }}
                              className="text-xs bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-400 border border-indigo-800/40 px-2 py-0.5 rounded-lg transition-colors"
                            >
                              {link.tab}: {link.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Brick Control Summary */}
          {breach.brickControl && !breach.remediationSteps && (
            <div className="bg-indigo-950/20 border border-indigo-800/30 rounded-lg p-3">
              <div className="text-xs font-semibold text-indigo-400 mb-1">Brick Control Applied</div>
              <p className="text-xs text-gray-300 leading-relaxed">{breach.brickControl}</p>
            </div>
          )}

          {/* Additional Controls (for BREACHED items) — fallback if no remediationSteps */}
          {breach.additionalControls && !breach.remediationSteps && (
            <div className="bg-amber-950/20 border border-amber-800/30 rounded-lg p-3">
              <div className="text-xs font-semibold text-amber-400 mb-1">Additional Controls Required</div>
              <p className="text-xs text-gray-300 leading-relaxed">{breach.additionalControls}</p>
            </div>
          )}

          {/* Regulation citation */}
          <div className="text-xs text-gray-600">
            Regulation: <span className="text-gray-500 font-mono">{breach.regulation}</span>
          </div>

          {/* Cross-tab navigation */}
          {breach.tabLinks && breach.tabLinks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-xs text-gray-500 mr-1 self-center">All related tabs:</span>
              {breach.tabLinks.map(link => (
                <button
                  key={link.tab}
                  onClick={(e) => { e.stopPropagation(); setActiveTab && setActiveTab(link.tab); }}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-200 px-2.5 py-1 rounded-lg transition-colors border border-gray-700/40"
                >
                  → {link.tab}: {link.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AirPermitAI({ results, inputs, setActiveTab }) {
  const [expanded, setExpanded] = useState(null);

  if (!results) {
    return (
      <div className="p-6 text-center py-20">
        <div className="text-4xl mb-4">💨</div>
        <h3 className="text-gray-400 font-medium mb-2">No Site Data Yet</h3>
        <p className="text-gray-600 text-sm">Go to Site Intake and run the permit screening first.</p>
      </div>
    );
  }

  const { baseline, controlled, avoided, pathway, totalMW, annualMMBtu, thresholdAnalysis, breaches } = results;
  const attainment = STATES_ATTAINMENT[inputs.state] || '';
  const isNonAttain = attainment.includes('Nonattainment') || inputs.nonAttainment;

  const pollutants = [
    { key: 'nox', label: 'NOx', threshold: THRESHOLDS.nox.psd, color: 'text-red-400' },
    { key: 'co', label: 'CO', threshold: THRESHOLDS.co.psd, color: 'text-orange-400' },
    { key: 'so2', label: 'SO₂', threshold: THRESHOLDS.so2.psd, color: 'text-yellow-400' },
    { key: 'pm25', label: 'PM₂.₅', threshold: THRESHOLDS.pm25.psd, color: 'text-blue-400' },
    { key: 'voc', label: 'VOC', threshold: THRESHOLDS.voc.psd, color: 'text-violet-400' },
    { key: 'hap', label: 'HAP', threshold: THRESHOLDS.hap.combined, color: 'text-pink-400' },
    { key: 'co2e', label: 'CO₂e', threshold: THRESHOLDS.co2e.ghgrp, color: 'text-green-400' },
  ];

  // Count breaches by status
  const breachedItems = breaches?.filter(b => b.status === 'BREACHED') || [];
  const mitigatedItems = breaches?.filter(b => b.status === 'MITIGATED') || [];
  const noticeItems = breaches?.filter(b => b.status === 'NOTICE') || [];

  return (
    <div className="p-6 space-y-6">
      {/* Banner */}
      <div className="rounded-xl border border-indigo-700/30 bg-indigo-950/20 p-4 flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">{inputs.siteName} — Air Permit Analysis</h2>
          <p className="text-xs text-gray-500 mt-0.5">{inputs.state} · {totalMW} MW installed · {inputs.turbines} turbines · {inputs.hours.toLocaleString()} hr/yr</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PathwayBadge
            label={pathway.requiresPSD ? 'PSD Major Source' : 'Below PSD Threshold'}
            status={pathway.requiresPSD ? 'warning' : 'ok'}
            detail={pathway.requiresPSD
              ? `One or more criteria pollutants ≥100 tpy: ${breachedItems.filter(b => b.thresholdType === 'PSD Major Source').map(b => b.pollutant).join(', ') || 'see breach analysis'}`
              : `All criteria pollutants below 100 tpy PSD threshold`}
          />
          <PathwayBadge
            label={pathway.requiresTitleV ? 'Title V Required' : 'Below Title V'}
            status={pathway.requiresTitleV ? 'warning' : 'ok'}
            detail={pathway.requiresTitleV
              ? `Controlled emissions ≥100 tpy triggers Title V operating permit`
              : `All controlled emissions below 100 tpy Title V threshold`}
          />
          <PathwayBadge
            label={pathway.syntheticMinorViable ? 'Synthetic Minor Viable' : 'Synthetic Minor Not Viable'}
            status={pathway.syntheticMinorViable ? 'ok' : 'warning'}
            detail={pathway.syntheticMinorViable
              ? `Brick controls reduce all pollutants below 100 tpy — enforceable limits can avoid PSD`
              : `At least one pollutant cannot be reduced below major source thresholds`}
          />
        </div>
      </div>

      {/* ─── BREACH ANALYSIS PANEL ─── */}
      {breaches && breaches.length > 0 && (
        <div className="rounded-xl border border-red-700/30 bg-gray-900/40 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-300">Threshold Breach Analysis & Remediation</h3>
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-red-900/30 text-red-400">{breachedItems.length} Breached</span>
              <span className="px-2 py-0.5 rounded bg-amber-900/30 text-amber-400">{mitigatedItems.length} Mitigated</span>
              <span className="px-2 py-0.5 rounded bg-indigo-900/30 text-indigo-400">{noticeItems.length} Notices</span>
            </div>
          </div>
          <div className="space-y-3">
            {breaches.map(b => (
              <BreachCard key={b.id} breach={b} setActiveTab={setActiveTab} />
            ))}
          </div>
        </div>
      )}

      {/* If no breaches but threshold analysis exists */}
      {(!breaches || breaches.length === 0) && thresholdAnalysis && (
        <div className="rounded-xl border border-green-700/30 bg-green-950/20 p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-green-900/40 text-green-400 flex items-center justify-center text-xs font-bold">V</span>
            <h3 className="text-sm font-semibold text-green-300">All Thresholds Clear</h3>
          </div>
          <p className="text-xs text-gray-400">All pollutant emissions are below applicable PSD, Title V, and regulatory thresholds. No breaches detected.</p>
        </div>
      )}

      {/* ─── PER-POLLUTANT MAJOR SOURCE DETERMINATION ─── */}
      {thresholdAnalysis && (
        <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Per-Pollutant Major Source Determination</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-800/60">
                  <th className="text-left px-3 py-2.5 text-gray-400 font-semibold">Pollutant</th>
                  <th className="text-right px-3 py-2.5 text-gray-400 font-semibold">Baseline (tpy)</th>
                  <th className="text-right px-3 py-2.5 text-gray-400 font-semibold">Controlled (tpy)</th>
                  <th className="text-right px-3 py-2.5 text-gray-400 font-semibold">PSD Threshold</th>
                  <th className="text-center px-3 py-2.5 text-gray-400 font-semibold">PSD Major?</th>
                  {isNonAttain && <th className="text-center px-3 py-2.5 text-gray-400 font-semibold">Nonattain?</th>}
                  <th className="text-center px-3 py-2.5 text-gray-400 font-semibold">Title V?</th>
                  <th className="text-right px-3 py-2.5 text-gray-400 font-semibold">Margin</th>
                </tr>
              </thead>
              <tbody>
                {['nox', 'co', 'so2', 'pm25', 'voc', 'hap', 'co2e'].map((key, i) => {
                  const t = thresholdAnalysis[key];
                  if (!t) return null;
                  return (
                    <tr key={key} className={`border-t border-gray-800/40 ${i % 2 === 0 ? 'bg-gray-900/20' : ''}`}>
                      <td className="px-3 py-2.5 font-semibold text-gray-300">{THRESHOLDS[key]?.label || key}</td>
                      <td className="px-3 py-2.5 text-right text-gray-400 font-mono">{t.baseline?.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right text-white font-mono font-semibold">{t.controlled?.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-500 font-mono">{t.controllingThreshold || t.psdThreshold || t.ghgrpThreshold || '-'}</td>
                      <td className="px-3 py-2.5 text-center">
                        {t.majorSourceStatus === 'BREACHED' ? <span className="text-red-400 font-bold">X</span> :
                         t.majorSourceStatus === 'MITIGATED' ? <span className="text-amber-400">~</span> :
                         <span className="text-green-400">V</span>}
                      </td>
                      {isNonAttain && (
                        <td className="px-3 py-2.5 text-center">
                          {t.nonattainStatus === 'BREACHED' ? <span className="text-red-400 font-bold">X</span> :
                           t.nonattainStatus === 'MITIGATED' ? <span className="text-amber-400">~</span> :
                           <span className="text-green-400">V</span>}
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-center">
                        {t.isTitleV ? <span className="text-amber-400">X</span> : <span className="text-green-400">V</span>}
                      </td>
                      <td className={`px-3 py-2.5 text-right font-mono ${(t.margin || t.margin === 0) && t.margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {t.margin !== undefined ? `${t.margin >= 0 ? '+' : ''}${t.margin.toFixed(1)}` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex gap-4 mt-3 text-xs text-gray-600">
            <span><span className="text-red-400">X</span> = Breached — requires action</span>
            <span><span className="text-amber-400">~</span> = Mitigated by Brick controls</span>
            <span><span className="text-green-400">V</span> = Clear — within threshold</span>
          </div>
        </div>
      )}

      {/* ─── REMEDIATION MATRIX ─── */}
      {breaches && breachedItems.length > 0 && (
        <div className="rounded-xl border border-amber-700/30 bg-gray-900/40 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Remediation Action Matrix</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-800/60">
                  <th className="text-left px-3 py-2.5 text-gray-400 font-semibold">Breach</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-semibold">Applied Brick Control</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-semibold">Additional Measures Needed</th>
                  <th className="text-center px-3 py-2.5 text-gray-400 font-semibold">Severity</th>
                  <th className="text-center px-3 py-2.5 text-gray-400 font-semibold">Link</th>
                </tr>
              </thead>
              <tbody>
                {breaches.map((b, i) => (
                  <tr key={b.id} className={`border-t border-gray-800/40 ${i % 2 === 0 ? 'bg-gray-900/20' : ''}`}>
                    <td className="px-3 py-2.5">
                      <span className="font-semibold text-gray-300">{b.pollutant}</span>
                      <div className="text-gray-600">{b.thresholdType}</div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 max-w-[200px]">{b.brickControl}</td>
                    <td className="px-3 py-2.5 text-amber-300 max-w-[200px]">{b.additionalControls || 'N/A — mitigated by Brick controls'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        b.severity === 'critical' ? 'bg-red-900/40 text-red-400' :
                        b.severity === 'high' ? 'bg-red-900/30 text-red-400' :
                        b.severity === 'medium' ? 'bg-amber-900/30 text-amber-400' :
                        'bg-indigo-900/30 text-indigo-400'
                      }`}>{b.severity}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {b.tabLinks && b.tabLinks.length > 0 && (
                        <button
                          onClick={() => setActiveTab && setActiveTab(b.tabLinks[0].tab)}
                          className="text-indigo-400 hover:text-indigo-300 underline text-xs"
                        >
                          {b.tabLinks[0].label}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PTE comparison grid */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Potential to Emit (PTE) — Baseline vs. Brick-Controlled</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-800/60">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 rounded-tl-lg">Pollutant</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">Baseline PTE (tpy)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">Brick-Controlled (tpy)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">Avoided (tpy)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">Regulatory Threshold</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 rounded-tr-lg">Status</th>
              </tr>
            </thead>
            <tbody>
              {pollutants.map((p, i) => {
                const base = baseline[p.key];
                const ctrl = controlled[p.key];
                const avd = base - ctrl;
                const threshold = (p.key === 'co2e') ? THRESHOLDS.co2e.ghgrp : p.threshold;
                const pct = threshold ? (ctrl / threshold * 100) : 0;
                const status = pct >= 100 ? { label: 'Breached', cls: 'text-red-400 bg-red-900/20' } :
                  pct >= 80 ? { label: 'Near Threshold', cls: 'text-amber-400 bg-amber-900/20' } :
                  pct >= 50 ? { label: 'Synthetic Minor Viable', cls: 'text-yellow-400 bg-yellow-900/20' } :
                  { label: 'Below Minor', cls: 'text-green-400 bg-green-900/20' };
                return (
                  <tr key={p.key} className={`border-t border-gray-800/40 ${i % 2 === 0 ? 'bg-gray-900/20' : ''}`}>
                    <td className={`px-4 py-3 font-semibold text-sm ${p.color}`}>{p.label}</td>
                    <td className="px-4 py-3 text-right text-gray-400 font-mono text-sm">{base?.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-white font-mono text-sm font-semibold">{ctrl?.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-green-400 font-mono text-sm">-{avd?.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 font-mono text-sm">{threshold?.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <ClickableStatus label={p.label} value={ctrl} threshold={threshold} pct={pct} unit="tpy" pollutant={p.key} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-600 mt-2">* CO2e threshold shown is GHGRP reporting threshold (25,000 tpy). PSD GHG threshold is 75,000 tpy.</p>
      </div>

      {/* Permit Pathway */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Permit Pathway Determination</h3>
          <div className="space-y-3 text-xs">
            {[
              {
                label: 'NSR/PSD Applicability',
                status: pathway.requiresPSD ? 'PSD Required (>=100 tpy any criteria pollutant)' : 'Below PSD threshold',
                ok: !pathway.requiresPSD,
                detail: 'CAA ss 165 / 40 CFR Parts 51/52. PSD applies to new major sources in attainment areas. If PSD applies, full BACT analysis, air quality modeling (AERMOD), Class I area review, and public participation are required.',
                breach: breachedItems.find(b => b.thresholdType === 'PSD Major Source'),
                regText: '40 CFR ss 52.21 / CAA ss 165',
              },
              {
                label: 'Nonattainment NSR',
                status: isNonAttain ? 'Nonattainment NSR may apply - see breach analysis' : 'Not triggered (attainment area)',
                ok: !isNonAttain,
                detail: 'CAA ss 173. If county is nonattainment, NSR/LAER offsets required at 25 tpy threshold. Offsets ratio of at least 1.3:1 required for severe nonattainment areas.',
                breach: breachedItems.find(b => b.thresholdType === 'Nonattainment NSR'),
                regText: '40 CFR ss 51.165 / CAA ss 173',
              },
              {
                label: 'Title V Operating Permit',
                status: pathway.requiresTitleV ? 'Title V Required (aggregate major source)' : 'Below Title V thresholds',
                ok: !pathway.requiresTitleV,
                detail: '40 CFR Part 70/71. Required if PTE >= 100 tpy for any regulated air pollutant. Title V permit includes compliance certification, monitoring schedules, and annual fee program.',
                regText: '40 CFR Part 70/71',
              },
              {
                label: 'Synthetic Minor Pathway',
                status: pathway.syntheticMinorViable ? ('Viable - Brick controls reduce PTE to ' + controlled.nox?.toFixed(1) + ' tpy NOx') : 'Not viable - see breaches above',
                ok: pathway.syntheticMinorViable,
                detail: 'Enforceable operational limits (runtime caps, fuel use limits, dispatch optimization) can reduce PTE below major source thresholds, avoiding PSD. Requires state-issued synthetic minor permit with federally enforceable conditions.',
                breach: breachedItems.find(b => b.id === 'synthetic_minor_viability'),
              },
              {
                label: 'NSPS - 40 CFR Part 60 Subpart KKKK/KKKKa',
                status: 'Applicable - Stationary combustion turbines',
                ok: false,
                detail: 'New/modified turbines >=1 MW: NOx limit ' + THRESHOLDS.nox.nspsLimit + ' ppmvd, CO limit ' + THRESHOLDS.co.nspsLimit + ' ppmvd @ 15% O2. Initial performance stack test within 180 days of startup + ongoing compliance.',
                regText: '40 CFR Part 60 Subparts KKKK/KKKKa',
              },
              {
                label: 'NESHAP - 40 CFR Part 63 Subpart YYYY',
                status: baseline.hap >= THRESHOLDS.hap.combined ? 'Major HAP source - Subpart YYYY applies' :
                        baseline.hap >= THRESHOLDS.hap.single ? 'Near major HAP - confirm applicability' : 'Area source - confirm',
                ok: baseline.hap < THRESHOLDS.hap.single,
                detail: 'Applies at major HAP sources (>=10 tpy single HAP or >=25 tpy combined HAP). MACT standards for gas turbines. If area source, still subject to GCP standards.',
                regText: '40 CFR Part 63 Subparts YYYY/ZZZZ',
              },
              {
                label: 'Engine NSPS/NESHAP (Subparts IIII/JJJJ/ZZZZ)',
                status: inputs.gensetCount + ' backup gensets at ' + inputs.gensetHours + ' hr/yr - ' + (inputs.gensetHours <= 100 ? 'within emergency limit' : 'EXCEEDS 100 hr/yr limit'),
                ok: inputs.gensetHours <= 100,
                detail: '40 CFR Parts 60 IIII/JJJJ and 63 ZZZZ. Emergency engines limited to 100 hr/yr maintenance + emergency. Non-resettable hour meters required. Tier 4 compliant engines for new installations.',
                regText: '40 CFR 60 IIII/JJJJ, 63 ZZZZ',
              },
              {
                label: 'GHG / GHGRP (40 CFR Part 98)',
                status: baseline.co2e >= THRESHOLDS.co2e.ghgrp ? 'GHGRP Required (>=25,000 tpy CO2e)' : 'Below GHGRP threshold (25,000 tpy)',
                ok: baseline.co2e < THRESHOLDS.co2e.ghgrp,
                detail: 'Annual GHG report to EPA eGGRT required if >=25,000 tpy CO2e. Subpart C (stationary combustion) + Subpart W (fugitives). Third-party verification required for >25,000 tpy.',
                regText: '40 CFR Part 98 Subparts C/W',
              },
            ].map(item => (
              <PathwayCard key={item.label} {...item} />
            ))}
          </div>
        </div>

        {/* CFR Modules */}
        <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Air Permit Modules — Deliverables</h3>
          <div className="space-y-3">
            {AIR_MODULES.map(mod => (
              <div key={mod.id} className="border border-gray-800/40 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === mod.id ? null : mod.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-800/30 transition-colors text-left"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-300">{mod.name}</div>
                    <div className="text-xs text-gray-600">{mod.citations[0]}</div>
                  </div>
                  <span className="text-gray-600">{expanded === mod.id ? '▲' : '▼'}</span>
                </button>
                {expanded === mod.id && (
                  <div className="border-t border-gray-800/40 p-3 bg-gray-900/40 space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-1">Regulatory Citations</p>
                      <div className="flex flex-wrap gap-1">
                        {mod.citations.map(c => (
                          <span key={c} className="text-xs bg-indigo-900/40 text-indigo-300 border border-indigo-800/40 rounded px-2 py-0.5">{c}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-1">Auto-Generated Deliverables</p>
                      <ul className="space-y-1">
                        {mod.deliverables.map(d => (
                          <li key={d} className="text-xs text-gray-400 flex gap-2">
                            <span className="text-green-500 mt-0.5">✓</span>{d}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-indigo-950/30 border border-indigo-800/30 rounded-lg p-2.5">
                      <p className="text-xs text-indigo-300"><span className="font-semibold">AI Acceleration:</span> {mod.aiAcceleration}</p>
                    </div>
                    <div className="text-xs text-gray-600">
                      Timeline: Weeks {mod.weeks[0]}–{mod.weeks[1]}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BACT Strategies */}
      <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">BACT Strategy — AI Recommendation (Top-Down Analysis)</h3>
        <div className="grid md:grid-cols-3 gap-4 text-xs">
          {[
            {
              tech: 'Dry Low NOx (DLN) Combustion',
              type: 'Combustion Controls',
              nox: '≤9–15 ppmvd @ 15% O₂',
              status: 'Step 1 — Available',
              color: 'border-green-700/40 bg-green-950/20',
            },
            {
              tech: 'Selective Catalytic Reduction (SCR)',
              type: 'Post-Combustion',
              nox: '≤2–5 ppmvd @ 15% O₂',
              status: 'Step 2 — Evaluate for breaches',
              color: 'border-amber-700/40 bg-amber-950/20',
            },
            {
              tech: 'Oxidation Catalyst (CO/VOC)',
              type: 'Post-Combustion',
              nox: 'CO reduction 90%+',
              status: 'Step 2 — Often Required',
              color: 'border-blue-700/40 bg-blue-950/20',
            },
            {
              tech: 'Operational Limits (Brick Controls)',
              type: 'Dispatch Optimization',
              nox: 'Runtime cap + load optimization',
              status: 'Step 3 — Enforceable Limit',
              color: 'border-violet-700/40 bg-violet-950/20',
            },
            {
              tech: 'Fuel Switching / Natural Gas Only',
              type: 'Fuel Control',
              nox: 'Pipeline-quality gas eliminates SO₂/PM',
              status: 'Typically Required',
              color: 'border-indigo-700/40 bg-indigo-950/20',
            },
            {
              tech: 'Good Combustion Practices (GCP)',
              type: 'O&M Controls',
              nox: 'Air/fuel ratio, maintenance tuning',
              status: 'Standard Requirement',
              color: 'border-gray-700/40 bg-gray-900/40',
            },
          ].map(t => (
            <div key={t.tech} className={`border rounded-xl p-4 ${t.color}`}>
              <div className="font-semibold text-gray-300 mb-1">{t.tech}</div>
              <div className="text-gray-500">{t.type}</div>
              <div className="text-gray-400 mt-2">{t.nox}</div>
              <div className="mt-2 text-indigo-400 font-medium">{t.status}</div>
            </div>
          ))}
        </div>
        {breachedItems.length > 0 && (
          <div className="mt-4 p-3 bg-red-950/20 border border-red-800/30 rounded-lg">
            <p className="text-xs text-red-300">
              <span className="font-semibold">Breach-driven recommendation:</span>{' '}
              {breachedItems.some(b => b.pollutant === 'NOx')
                ? 'SCR installation (≥90% reduction) recommended for NOx breach — Step 2 BACT evaluation required. DLN currently in place; post-combustion control needed for compliance margin.'
                : breachedItems.some(b => b.pollutant === 'CO')
                  ? 'Oxidation catalyst recommended for CO breach.'
                  : 'Review breaches above for pollutant-specific BACT recommendations.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}