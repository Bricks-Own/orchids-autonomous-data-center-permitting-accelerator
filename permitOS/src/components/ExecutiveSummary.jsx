import React, { useState, useEffect } from 'react';
import { calcRiskScore, calcTimelineAcceleration, THRESHOLDS } from '../utils/calculations';
import { STATES_ATTAINMENT } from '../data/permitData';
import { getPermitScore, analyzeScenario } from '../utils/api';

function AnimatedCounter({ target, duration = 1200, suffix = '', prefix = '' }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      setVal(Math.round(target * progress));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return <span>{prefix}{val.toLocaleString()}{suffix}</span>;
}

function RiskMeter({ score }) {
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  const label = score >= 75 ? 'Low Risk' : score >= 50 ? 'Moderate Risk' : 'High Risk';
  const angle = -135 + (score / 100) * 270;
  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="90" viewBox="0 0 140 90">
        {/* Background arc */}
        <path d="M 15 80 A 55 55 0 0 1 125 80" stroke="#1f2937" strokeWidth="12" fill="none" strokeLinecap="round" />
        {/* Colored arc */}
        <path d="M 15 80 A 55 55 0 0 1 125 80"
          stroke={color} strokeWidth="12" fill="none" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 173} 173`} />
        {/* Needle */}
        <g transform={`rotate(${angle}, 70, 80)`}>
          <line x1="70" y1="80" x2="70" y2="34" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="70" cy="80" r="5" fill={color} />
        </g>
        <text x="70" y="75" textAnchor="middle" fill="white" fontSize="20" fontWeight="bold">{score}</text>
      </svg>
      <div className="text-sm font-semibold" style={{ color }}>{label}</div>
    </div>
  );
}

export default function ExecutiveSummary({ results, inputs, setActiveTab }) {
  if (!results) {
    return (
      <div className="p-6 text-center py-20">
        <div className="text-5xl mb-4">📊</div>
        <h3 className="text-muted-foreground font-semibold text-lg mb-2">No Analysis Yet</h3>
        <p className="text-muted-foreground/70 text-sm mb-6">Run Site Intake Permit Screening to generate your Executive Summary.</p>
        <button
          onClick={() => setActiveTab('intake')}
          className="bg-primary hover:bg-primary text-white px-6 py-3  text-sm font-semibold transition-colors">
          → Go to Site Intake
        </button>
      </div>
    );
  }

  const { baseline, controlled, avoided, pathway, totalMW, water, genset } = results;
  const riskResult = calcRiskScore(results, inputs);
  const timeline = calcTimelineAcceleration();
  const attainment = STATES_ATTAINMENT[inputs.state] || 'Attainment';

  // --- Permit Scorecard state ---
  const [permitScore, setPermitScore] = useState(null);
  const [scenarioAnalysis, setScenarioAnalysis] = useState(null);
  const [scenarioType, setScenarioType] = useState('greenfield');
  const [scoreLoading, setScoreLoading] = useState(false);

  useEffect(() => {
    if (!results || !inputs) return;
    let cancelled = false;
    setScoreLoading(true);
    Promise.all([
      getPermitScore(inputs, results).catch(() => null),
      analyzeScenario(scenarioType, inputs).catch(() => null),
    ]).then(([scoreData, scenarioData]) => {
      if (!cancelled) {
        if (scoreData?.score) setPermitScore(scoreData.score);
        if (scenarioData?.analysis) setScenarioAnalysis(scenarioData.analysis);
        setScoreLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [results, inputs, scenarioType]);
  const isNonAttain = attainment.includes('Nonattainment');

  const permitPathwayLabel = pathway.requiresPSD
    ? (isNonAttain ? 'Nonattainment NSR (LAER + Offsets)' : 'PSD Major Source — BACT Required')
    : pathway.syntheticMinorViable
      ? 'Synthetic Minor — Below Major Thresholds'
      : 'State Minor Permit';

  const winPoints = [
    {
      icon: '⚡',
      title: 'Speed: 60–70% faster than traditional consulting',
      detail: `Brick PermitOS compresses ${timeline.totalBaseline}-week manual process to ~${timeline.totalBrick} weeks. PermitOS prepares applicability memos, PTE workbooks, BACT drafts, and document packages in hours — not weeks.`,
      color: 'border-green-700/40 bg-green-950/20',
    },
    {
      icon: '🎯',
      title: 'Lower PTE = Easier Permit = Lower BACT Burden',
      detail: `Brick's operational controls reduce NOx PTE from ${baseline.nox.toFixed(1)} → ${controlled.nox.toFixed(1)} tpy (${((1 - controlled.nox / baseline.nox) * 100).toFixed(0)}% reduction). ${pathway.syntheticMinorViable ? 'This keeps the site below the 100 tpy PSD major source threshold — potentially avoiding full BACT review entirely.' : 'This reduces BACT burden and strengthens the permit record.'}`,
      color: 'border-blue-700/40 bg-blue-950/20',
    },
    {
      icon: '📄',
      title: 'Draft Document Package',
      detail: `26 permit documents (16 air + 10 water) auto-generated from site data. PE-ready drafts, not boilerplate. Filable via single submission portal. Reduces counsel + consultant review cycles from months to weeks.`,
      color: 'border-primary/40 bg-primary/10',
    },
    {
      icon: '🛡',
      title: 'Post-Permit Compliance OS — Brick Stays In',
      detail: `Traditional consultants exit at permit issuance. Brick operationalizes every permit condition into live controls, automated logs, and regulator-ready reports. This is the enforcement defense BigWatt needs at scale.`,
      color: 'border-primary/40 bg-primary/10',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Hero Banner */}
      <div className=" bg-gradient-to-br from-primary/20 via-gray-900 to-background border border-primary/40 p-6">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 bg-primary/30 border border-primary/40  px-3 py-1 text-xs text-primary mb-3">
              <span className="w-1.5 h-1.5  bg-primary animate-pulse"></span>
              Executive Summary — {inputs.siteName}
            </div>
            <h1 className="text-4xl font-bold text-white mb-2 leading-tight">
              Permit Pathway for {inputs.client}
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
              {inputs.state} · {inputs.county} · {totalMW} MW installed generation ·
              {inputs.turbines} gas turbines · {inputs.gensetCount} backup gensets ·
              COD target {inputs.codTarget}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className={`text-xs px-3 py-1  border font-medium ${pathway.requiresPSD ? 'bg-destructive/10 border-red-700/40 text-destructive' : 'bg-primary/10 border-green-700/40 text-primary'}`}>
                {pathway.requiresPSD ? '⚠ PSD Major' : '✓ Below PSD'}
              </span>
              <span className={`text-xs px-3 py-1  border font-medium ${isNonAttain ? 'bg-amber-900/30 border-amber-700/40 text-destructive' : 'bg-primary/10 border-green-700/40 text-primary'}`}>
                {isNonAttain ? '⚠ Nonattainment' : '✓ Attainment Area'}
              </span>
              <span className={`text-xs px-3 py-1  border font-medium ${pathway.syntheticMinorViable ? 'bg-primary/10 border-green-700/40 text-primary' : 'bg-muted border-border text-muted-foreground'}`}>
                {pathway.syntheticMinorViable ? '✓ Synthetic Minor Viable' : 'Major Permit Required'}
              </span>
            </div>
          </div>

          {/* Risk Meter */}
          <div className="bg-card/60 border border-border/40  p-5 text-center min-w-[180px]">
            <div className="text-xs text-muted-foreground mb-3 font-medium">Permit Risk Score</div>
            <RiskMeter score={riskResult.score} />
            <div className="text-xs text-muted-foreground/70 mt-2">Brick-controlled basis</div>
          </div>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: 'Installed Generation',
            value: totalMW,
            suffix: ' MW',
            sub: `${inputs.turbines} turbines × ${inputs.mwPerTurbine} MW`,
            color: 'text-primary',
          },
          {
            label: 'Brick NOx Reduction',
            value: Math.round((1 - controlled.nox / baseline.nox) * 100),
            suffix: '%',
            sub: `${baseline.nox.toFixed(0)} → ${controlled.nox.toFixed(0)} tpy`,
            color: 'text-primary',
          },
          {
            label: 'Water Saved (Brick)',
            value: Math.round(avoided.water),
            suffix: ' MG/yr',
            sub: `${water.annualWaterMG.toFixed(0)} → ${water.optimizedWater.toFixed(0)} MG/yr`,
            color: 'text-blue-400',
          },
          {
            label: 'Timeline Acceleration',
            value: timeline.pctSaved,
            suffix: '%',
            sub: `${timeline.totalBrick} wks vs. ${timeline.totalBaseline} wks traditional`,
            color: 'text-destructive',
          },
        ].map(m => (
          <div key={m.label} className=" border border-border/40 bg-card/40 p-4">
            <div className="text-xs text-muted-foreground mb-1">{m.label}</div>
            <div className={`text-2xl font-bold ${m.color}`}>
              <AnimatedCounter target={m.value} suffix={m.suffix} />
            </div>
            <div className="text-xs text-muted-foreground/70 mt-0.5">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Permit Pathway + Timeline */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Permit Pathway */}
        <div className=" border border-border/40 bg-card/40 p-5">
          <h3 className="text-base font-semibold text-foreground/80 mb-4">Permit Pathway Summary</h3>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between bg-muted/40  p-3">
              <span className="text-muted-foreground">Permit Type Required</span>
              <span className={`font-semibold ${pathway.requiresPSD ? 'text-destructive' : 'text-primary'}`}>{permitPathwayLabel}</span>
            </div>
            {[
              { label: 'Title V Operating Permit', value: pathway.requiresTitleV ? 'Required' : 'Not Required', ok: !pathway.requiresTitleV },
              { label: 'NSPS Subpart KKKK/KKKKa', value: 'Applicable (all gas turbines)', ok: false },
              { label: 'NESHAP Subpart YYYY', value: baseline.hap >= THRESHOLDS.hap.combined ? 'Major HAP Source' : baseline.hap >= THRESHOLDS.hap.single ? 'Near Major — Confirm' : 'Area Source — Confirm', ok: baseline.hap < THRESHOLDS.hap.single },
              { label: 'Backup Engine (IIII/JJJJ/ZZZZ)', value: `${inputs.gensetCount} units at ≤${inputs.gensetHours} hr/yr`, ok: inputs.gensetHours <= THRESHOLDS.genset.runtimeLimit },
              { label: 'GHG / GHGRP Reporting', value: baseline.co2e >= THRESHOLDS.co2e.ghgrp ? `Required (≥${(THRESHOLDS.co2e.ghgrp/1000).toFixed(0)}K tpy CO₂e)` : 'Below GHGRP threshold', ok: baseline.co2e < THRESHOLDS.co2e.ghgrp },
              { label: 'NPDES Discharge Permit', value: 'Required', ok: false },
              { label: 'SPCC Plan', value: 'Required (diesel fuel tanks)', ok: false },
              { label: 'Construction SWPPP / CGP', value: 'Required (≥1 acre)', ok: false },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-muted-foreground">{item.label}</span>
                <span className={`font-medium ${item.ok ? 'text-primary' : 'text-destructive'}`}>
                  {item.ok ? '✓' : '⚠'} {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline Acceleration */}
        <div className=" border border-border/40 bg-card/40 p-5">
          <h3 className="text-base font-semibold text-foreground/80 mb-4">Timeline Acceleration — Brick vs. Traditional</h3>
          <div className="space-y-2">
            {Object.entries(timeline.breakdown).map(([key, item]) => {
              const saved = item.base - item.brick;
              const savedPct = Math.round((saved / item.base) * 100);
              return (
                <div key={key} className="text-xs">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-muted-foreground truncate w-44">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-destructive text-xs w-14 text-right">{item.base}w trad.</span>
                      <span className="text-primary text-xs w-14 text-right font-semibold">{item.brick}w Brick</span>
                      <span className="text-primary text-xs w-12 text-right">-{savedPct}%</span>
                    </div>
                  </div>
                  <div className="flex gap-1 h-2">
                    <div className="bg-red-900/40 rounded-sm" style={{ width: `${(item.base / 26) * 100}%`, maxWidth: '100%' }}></div>
                    <div className="bg-green-500 rounded-sm opacity-70 -mt-2" style={{ width: `${(item.brick / 26) * 100}%`, maxWidth: '100%', height: '8px', position: 'relative', top: '-8px' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total timeline (all phases incl. agency review)</span>
            <div className="flex items-center gap-3">
              <span className="text-destructive text-sm font-semibold line-through">{timeline.totalBaseline}w</span>
              <span className="text-primary text-lg font-bold">{timeline.totalBrick}w</span>
              <span className="text-primary text-xs bg-primary/20 border border-primary/40  px-2 py-0.5">
                -{timeline.pctSaved}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Emissions Summary */}
      <div className=" border border-border/40 bg-card/40 p-5">
        <h3 className="text-base font-semibold text-foreground/80 mb-4">Emission Summary — Baseline vs. Brick-Controlled</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/60">
                {['Pollutant', 'Baseline PTE (tpy)', 'Brick-Controlled (tpy)', 'Avoided (tpy)', 'Avoided (%)', 'PSD Threshold', 'Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-muted-foreground font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { key: 'nox', label: 'NOx', threshold: 100 },
                { key: 'co', label: 'CO', threshold: 100 },
                { key: 'so2', label: 'SO₂', threshold: 100 },
                { key: 'pm25', label: 'PM₂.₅', threshold: 100 },
                { key: 'voc', label: 'VOC', threshold: 100 },
                { key: 'hap', label: 'HAP (total)', threshold: 25 },
                { key: 'co2e', label: 'CO₂e (GHG)', threshold: THRESHOLDS.co2e.ghgrp },
              ].map((p, i) => {
                const b = baseline[p.key];
                const c = controlled[p.key];
                const av = b - c;
                const avPct = ((av / b) * 100).toFixed(0);
                const pct = c / p.threshold * 100;
                const statusCls = pct >= 100 ? 'text-destructive bg-red-900/20' : pct >= 80 ? 'text-destructive bg-amber-900/20' : 'text-primary bg-green-900/20';
                const statusLabel = pct >= 100 ? '⚠ Major' : pct >= 80 ? '⚠ Near' : '✓ Below';
                return (
                  <tr key={p.key} className={`border-t border-border/40 ${i % 2 === 0 ? 'bg-card/20' : ''}`}>
                    <td className="px-4 py-2.5 font-semibold text-foreground/80">{p.label}</td>
                    <td className="px-4 py-2.5 text-muted-foreground font-mono">{b.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-white font-mono font-semibold">{c.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-primary font-mono">-{av.toFixed(1)}</td>
                    <td className="px-4 py-2.5 text-primary font-mono">-{avPct}%</td>
                    <td className="px-4 py-2.5 text-muted-foreground/70 font-mono">{p.threshold.toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5  ${statusCls}`}>{statusLabel}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Win Deck Points */}
      <div>
        <h3 className="text-base font-semibold text-foreground/80 mb-4">Why Brick Wins This Deal</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {winPoints.map(w => (
            <div key={w.title} className={` border p-5 ${w.color}`}>
              <div className="flex items-start gap-3 mb-2">
                <span className="text-2xl flex-shrink-0">{w.icon}</span>
                <h4 className="text-sm font-semibold text-white leading-snug">{w.title}</h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{w.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Permit Success Scorecard */}
      {permitScore && (
        <div className=" border border-primary/30 bg-primary/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-primary">Permit Success Scorecard</h3>
            {scoreLoading && <span className="text-xs text-muted-foreground">Updating...</span>}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Score gauge */}
            <div className="flex flex-col items-center justify-center bg-card/40  p-4">
              <svg width="160" height="100" viewBox="0 0 160 100">
                <path d="M 15 85 A 65 65 0 0 1 145 85" stroke="#1f2937" strokeWidth="14" fill="none" strokeLinecap="round" />
                <path d="M 15 85 A 65 65 0 0 1 145 85"
                  stroke={permitScore.totalScore >= 75 ? '#22c55e' : permitScore.totalScore >= 50 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="14" fill="none" strokeLinecap="round"
                  strokeDasharray={`${(permitScore.totalScore / 100) * 204} 204`} />
                <text x="80" y="75" textAnchor="middle" fill="white" fontSize="28" fontWeight="bold">
                  {permitScore.totalScore}
                </text>
              </svg>
              <div className={`text-sm font-bold ${permitScore.totalScore >= 75 ? 'text-primary' : permitScore.totalScore >= 50 ? 'text-destructive' : 'text-destructive'}`}>
                {permitScore.category || (permitScore.totalScore >= 75 ? 'High Success Probability' : permitScore.totalScore >= 50 ? 'Moderate Success Probability' : 'Challenging')}
              </div>
              <div className="text-xs text-muted-foreground/70 mt-1">{permitScore.summary || 'Scored across 8 weighted factors'}</div>
            </div>
            {/* Score breakdown */}
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground font-medium mb-2">Score Breakdown</div>
              {permitScore.breakdown && permitScore.breakdown.slice(0, 6).map((f, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-muted/40  px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5  ${f.score >= 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-muted-foreground">{f.label}</span>
                  </div>
                  <span className={`font-semibold ${f.score >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {f.score > 0 ? '+' : ''}{f.score}pts
                  </span>
                </div>
              ))}
              {/* Risk factors */}
              {permitScore.riskFactors && permitScore.riskFactors.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground font-medium mb-1">Risk Factors</div>
                  {permitScore.riskFactors.slice(0, 3).map((r, i) => (
                    <div key={i} className="text-xs text-amber-300 bg-amber-950/20 border border-amber-800/30  px-3 py-1.5 mb-1">
                      {r.factor}
                    </div>
                  ))}
                </div>
              )}
              {/* Recommendations */}
              {permitScore.recommendations && permitScore.recommendations.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground font-medium mb-1">Recommendations</div>
                  {permitScore.recommendations.slice(0, 2).map((r, i) => (
                    <div key={i} className="text-xs text-primary bg-green-950/20 border border-green-800/30  px-3 py-1.5 mb-1">
                      {r.action}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Scenario Selector + Analysis */}
      <div className=" border border-border/40 bg-card/40 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground/80">Scenario Pathway Analysis</h3>
          <div className="flex gap-1">
            {['greenfield', 'expansion', 'upsized', 'colocated'].map(s => (
              <button
                key={s}
                onClick={() => setScenarioType(s)}
                className={`text-xs px-2.5 py-1  border transition-all capitalize
                  ${scenarioType === s
                    ? 'bg-primary/30 border-primary/40 text-primary'
                    : 'bg-muted/40 border-border/40 text-muted-foreground hover:text-foreground/80'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {scenarioAnalysis ? (
          <div className="space-y-3">
            <div className="grid md:grid-cols-2 gap-4 text-xs">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-muted-foreground">Complexity:</span>
                  <span className={`font-semibold ${scenarioAnalysis.complexity === 'high' ? 'text-destructive' : scenarioAnalysis.complexity === 'moderate' ? 'text-destructive' : 'text-primary'}`}>
                    {scenarioAnalysis.complexity}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-muted-foreground">Timeline:</span>
                  <span className="font-semibold text-white">
                    {scenarioAnalysis.timelineMonths?.min}–{scenarioAnalysis.timelineMonths?.max} months
                  </span>
                </div>
                <div className="mb-2">
                  <span className="text-muted-foreground block mb-1">Permit Types ({scenarioAnalysis.permitTypes?.length}):</span>
                  <div className="flex flex-wrap gap-1">
                    {scenarioAnalysis.permitTypes?.slice(0, 5).map((p, i) => (
                      <span key={i} className="bg-muted text-muted-foreground rounded px-1.5 py-0.5">{p}</span>
                    ))}
                  </div>
                </div>
                {scenarioAnalysis.specialConsiderations?.length > 0 && (
                  <div className="mt-2">
                    <span className="text-muted-foreground block mb-1">Key Considerations:</span>
                    {scenarioAnalysis.specialConsiderations.map((c, i) => (
                      <div key={i} className="text-amber-300 bg-amber-950/20 rounded px-2 py-1 mb-1">{c}</div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <span className="text-muted-foreground block mb-2">Milestones & Key Phases</span>
                {scenarioAnalysis.milestones?.map((m, i) => (
                  <div key={i} className="bg-muted/40  p-2 mb-1.5">
                    <div className="font-semibold text-foreground">{m.phase}</div>
                    <div className="text-muted-foreground mt-0.5">{m.durationWeeks?.join('–')} weeks</div>
                    {m.activities?.slice(0, 2).map((a, j) => (
                      <div key={j} className="text-muted-foreground/70 text-xs">• {a}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            {/* Scenario Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/40">
              <button
                onClick={() => setActiveTab('docs')}
                className="text-xs bg-primary hover:bg-primary text-white px-4 py-2  font-semibold transition-all"
              >
                Generate Documents for {scenarioAnalysis.label}
              </button>
              <button
                onClick={() => { setActiveTab('intake'); }}
                className="text-xs bg-muted hover:bg-muted-foreground/20 text-foreground px-4 py-2  font-semibold transition-all"
              >
                Adjust Site Parameters
              </button>
              <button
                onClick={() => { setActiveTab('milestones'); }}
                className="text-xs bg-muted hover:bg-muted-foreground/20 text-foreground px-4 py-2  font-semibold transition-all"
              >
                View Scenario Timeline
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground/70 text-center py-4">
            {scoreLoading ? 'Loading scenario analysis...' : 'Run the permit screening above to see scenario-specific pathways'}
          </div>
        )}
      </div>

      {/* Risk Factors */}
      <div className=" border border-border/40 bg-card/40 p-5">
        <h3 className="text-base font-semibold text-foreground/80 mb-4">Permit Risk Register</h3>
        <div className="space-y-2">
          {riskResult.factors.map((f, i) => (
            <div key={i} className={`flex items-center justify-between  px-3 py-2.5 text-xs
              ${f.severity === 'high' ? 'bg-red-950/20 border border-red-800/30' :
                f.severity === 'medium' ? 'bg-amber-950/20 border border-amber-800/30' :
                'bg-green-950/20 border border-green-800/30'}`}>
              <span className={
                f.severity === 'high' ? 'text-destructive' :
                f.severity === 'medium' ? 'text-amber-300' :
                'text-primary'
              }>{f.label}</span>
              <span className={`font-bold ${f.impact < 0 ? 'text-destructive' : 'text-primary'}`}>
                {f.impact > 0 ? '+' : ''}{f.impact} pts
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Net permit risk score (Brick-controlled)</span>
          <div className="flex items-center gap-2">
            <div className="w-24 bg-muted  h-2">
              <div className={`h-2  ${riskResult.color === 'green' ? 'bg-green-500' : riskResult.color === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${riskResult.score}%` }} />
            </div>
            <span className={`text-sm font-bold ${riskResult.color === 'green' ? 'text-primary' : riskResult.color === 'amber' ? 'text-destructive' : 'text-destructive'}`}>
              {riskResult.score}/100 — {riskResult.label}
            </span>
          </div>
        </div>
      </div>

      {/* Breach Awareness + Remediation Summary */}
      {results.breaches && results.breaches.length > 0 && (
        <div className=" border border-red-700/30 bg-red-950/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold text-foreground/80">Threshold Breach & Remediation Summary</h3>
              <span className="text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive">{results.breaches.filter(b => b.status === 'BREACHED').length} Active</span>
              <span className="text-xs px-2 py-0.5 rounded bg-amber-900/30 text-destructive">{results.breaches.filter(b => b.status === 'MITIGATED').length} Mitigated</span>
            </div>
            <button
              onClick={() => setActiveTab('air')}
              className="text-xs bg-primary hover:bg-primary text-white px-3 py-1.5  font-semibold transition-all"
            >
              View Full Remediation Plans
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {results.breaches.filter(b => b.status !== 'NOTICE').slice(0, 4).map(b => (
              <div key={b.id} className="bg-card/40 border border-border/30  p-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${b.status === 'BREACHED' ? 'text-destructive' : 'text-destructive'}`}>
                      {b.status === 'BREACHED' ? 'X' : '~'}
                    </span>
                    <span className="text-sm font-semibold text-white">{b.pollutant}</span>
                    <span className="text-xs text-muted-foreground">{b.thresholdType}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{b.description.substring(0, 120)}...</p>
                {b.remediationSteps && b.remediationSteps.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {b.remediationSteps.map(s => (
                      <span key={s.stepNumber} className="text-xs bg-primary/20 text-primary border border-primary/40 rounded px-1.5 py-0.5">
                        Step {s.stepNumber}: {s.title.substring(0, 30)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5 mt-2 pt-1 border-t border-border/40">
                  {b.tabLinks && b.tabLinks.slice(0, 3).map(link => (
                    <button key={link.tab}
                      onClick={() => setActiveTab(link.tab)}
                      className="text-xs bg-muted hover:bg-muted-foreground/10 text-muted-foreground hover:text-foreground/80 px-2 py-0.5 rounded transition-colors"
                    >{link.tab}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA buttons */}
      <div className=" border border-primary/30 bg-primary/10 p-5">
        <h3 className="text-base font-semibold text-primary mb-3">Next Steps — What BigWatt Gets on Day 1</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { label: 'Air Permit Deep-Dive', icon: '💨', tab: 'air', desc: 'Full PTE, BACT, AERMOD, and CFR compliance analysis' },
            { label: 'Milestone Timeline', icon: '📅', tab: 'milestones', desc: 'Gantt view of fastest-path permit schedule' },
            { label: 'Generate All Documents', icon: '📄', tab: 'docs', desc: '26 draft permit documents for PE review' },
            { label: 'Run Digital Twin', icon: '⚡', tab: 'simulation', desc: 'Hour-by-hour permit compliance simulation' },
            { label: 'Water Permit Analysis', icon: '💧', tab: 'water', desc: 'NPDES, SPCC, 316(b), SWPPP analysis' },
            { label: 'Regulator QA Copilot', icon: '🤖', tab: 'copilot', desc: 'Draft RAI responses and deficiency cures' },
          ].map(btn => (
            <button key={btn.tab} onClick={() => setActiveTab(btn.tab)}
              className="bg-muted/40 hover:bg-muted-foreground/10/40 border border-border/40 hover:border-primary/40  p-4 text-left transition-all group">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{btn.icon}</span>
                <span className="text-sm font-medium text-foreground/80 group-hover:text-primary transition-colors">{btn.label}</span>
              </div>
              <div className="text-xs text-muted-foreground/70">{btn.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
