import React, { useState } from 'react';
import { OTHER_PERMITS, STATES_ATTAINMENT } from '../data/permitData';
import { usePermitData } from '../context/PermitDataContext';
import { computeTimelineComparison, computePathwayDuration, getPhaseBreakdown } from '../utils/timelineCalc';
import { Card, CardContent } from './ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from './ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';
import PhaseTimeline from './PhaseTimeline';

// ─── Theme Chart Colors ─────────────────────────────────────────────────────
// All using the lime/emerald chart palette from index.css
const TC = {
  air: 'var(--color-chart-1)',
  water: 'var(--color-chart-2)',
  other: 'var(--color-chart-3)',
  brick: 'var(--color-chart-4)',
  airDark: 'color-mix(in srgb, var(--color-chart-1), black 20%)',
  airDarker: 'color-mix(in srgb, var(--color-chart-1), black 40%)',
  waterDark: 'color-mix(in srgb, var(--color-chart-2), black 20%)',
};

// ─── Gantt Chart Helpers ────────────────────────────────────────────────────

function getGanttTracks({ totalMW = 200, isNonAttain = false, pathway = {}, pathwayMul = 1.0, totalWeeks = 60 }) {
  const mwFactor = Math.max(0.7, Math.min(1.5, totalMW / 200));
  const attainmentMul = isNonAttain ? 1.5 : 1.0;
  const airReviewMul = Math.min(1.8, mwFactor * attainmentMul * pathwayMul);

  const isTrueMinor = !pathway.requiresPSD;
  const isSyntheticMinor = pathway.requiresPSD && pathway.syntheticMinorViable;

  let airReviewStart = 12;
  let airReviewEnd, airIssuanceStart, airIssuanceEnd;

  if (isTrueMinor) {
    airReviewEnd = Math.round(12 + 10 * airReviewMul);
    airIssuanceStart = Math.round(airReviewEnd - 2);
    airIssuanceEnd = Math.round(airIssuanceStart + 8 * Math.min(mwFactor * attainmentMul, 1.5));
  } else if (isSyntheticMinor) {
    airReviewEnd = Math.round(12 + 16 * airReviewMul);
    airIssuanceStart = Math.round(airReviewEnd - 4);
    airIssuanceEnd = Math.round(airIssuanceStart + 12 * Math.min(mwFactor * attainmentMul, 1.5));
  } else {
    airReviewEnd = Math.round(12 + 28 * airReviewMul);
    airIssuanceStart = Math.round(airReviewEnd - 4);
    airIssuanceEnd = Math.round(airIssuanceStart + 16 * Math.min(mwFactor * attainmentMul, 1.5));
  }

  airReviewEnd = Math.min(airReviewEnd, totalWeeks - 2);
  airIssuanceEnd = Math.min(airIssuanceEnd, totalWeeks);
  const ganttWeeks = Math.max(totalWeeks, 60);

  const s = (start, end) => ({
    start: Math.max(1, Math.round(start * mwFactor)),
    end: Math.max(2, Math.round(end * mwFactor)),
  });

  return {
    tracks: [
      { label: 'Site Intake & Data Collection', ...s(1, 3), color: TC.air, cat: 'Air / Multi' },
      { label: 'Air Applicability & PTE', ...s(2, 5), color: TC.air, cat: 'Air' },
      { label: 'BACT/LAER Top-Down Analysis', ...s(3, 7), color: TC.air, cat: 'Air' },
      { label: 'AERMOD Dispersion Modeling', ...s(4, 10), color: TC.air, cat: 'Air' },
      { label: 'Air Application Assembly', ...s(7, 11), color: TC.air, cat: 'Air' },
      { label: 'Air Agency Review', start: airReviewStart, end: airReviewEnd, color: TC.airDark, cat: 'Air' },
      { label: 'Air Permit Issuance (est.)', start: airIssuanceStart, end: airIssuanceEnd, color: TC.airDarker, cat: 'Air' },
      { label: 'Wetlands / WOTUS Screening', ...s(1, 4), color: TC.water, cat: 'Water' },
      { label: 'Construction SW CGP NOI', ...s(1, 4), color: TC.water, cat: 'Water' },
      { label: 'NPDES / SPCC / 316(b)', ...s(2, 7), color: TC.water, cat: 'Water' },
      { label: 'Water Applications', ...s(6, 10), color: TC.water, cat: 'Water' },
      { label: 'NPDES Permit Review', ...s(10, 28), color: TC.waterDark, cat: 'Water' },
      { label: 'Zoning / Land Use', ...s(1, 20), color: TC.other, cat: 'Other' },
      { label: 'Building / Fire / Electrical', ...s(4, 18), color: TC.other, cat: 'Other' },
      { label: 'Utility Interconnect', ...s(4, Math.min(52, ganttWeeks)), color: 'var(--muted-foreground)', cat: 'Other' },
      { label: 'Brick AI Applicability Engine', ...s(1, 2), color: TC.brick, cat: 'Brick PermitOS' },
      { label: 'Brick PTE + Water Balance', ...s(2, 4), color: TC.brick, cat: 'Brick PermitOS' },
      { label: 'Brick CFR Document Factory', ...s(3, 8), color: TC.brick, cat: 'Brick PermitOS' },
      { label: 'Brick Digital Twin Setup', ...s(6, 10), color: TC.brick, cat: 'Brick PermitOS' },
      { label: 'Brick Compliance OS (post-COD)', ...s(36, ganttWeeks), color: TC.brick, cat: 'Brick PermitOS' },
    ],
    ganttWeeks,
  };
}

function GanttBar({ startWk, endWk, color, ganttWeeks }) {
  const left = (startWk / ganttWeeks) * 100;
  const width = ((endWk - startWk) / ganttWeeks) * 100;
  return (
    <div className="relative h-6 my-0.5">
      <div
        className="absolute h-5 top-0.5 rounded-sm opacity-90"
        style={{ left: `${left}%`, width: `${Math.max(width, 2)}%`, background: color }}
      />
    </div>
  );
}

// ─── Phase Chart ────────────────────────────────────────────────────────────

function PhaseBreakdownChart({ phases, label, totalMonths, color }) {
  const chartData = phases.map((p, i) => ({
    phase: p.label,
    start: p.startWeek,
    duration: p.weeks,
    fill: `var(--color-chart-${(i % 5) + 1})`,
  }));
  const chartConfig = {
    start: { label: 'Start' },
    duration: { label: 'Duration' },
  };
  const maxWeek = Math.max(...phases.map(p => p.endWeek), 1);

  return (
    <div className="bg-card border border-border p-0">
      <div className="px-5 pt-5 pb-2">
        <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
        <div className="text-2xl font-bold tracking-[-0.02em]" style={{ color }}>
          ~{totalMonths} <span className="text-sm font-medium text-muted-foreground">months</span>
        </div>
      </div>
      <div className="h-[220px] px-2">
        <ChartContainer config={chartConfig} className="!aspect-auto w-full h-full">
          <BarChart data={chartData} layout="vertical" margin={{ left: 150, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" domain={[0, Math.ceil(maxWeek * 1.1)]} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
            <YAxis type="category" dataKey="phase" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} width={140} />
            <ChartTooltip
              content={<ChartTooltipContent
                formatter={(value, name, item) => {
                  if (name === 'start') return null;
                  const p = item.payload;
                  return (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      Weeks {p.start}–{p.start + p.duration - 1} ({p.duration} wk{p.duration !== 1 ? 's' : ''})
                    </div>
                  );
                }}
              />}
            />
            <Bar dataKey="start" stackId="stack" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="duration" stackId="stack" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function MilestoneTimeline({ setActiveTab }) {
  const { inputs, results } = usePermitData();
  const [filter, setFilter] = useState('All');

  if (!results) {
    return (
      <div className="px-10 py-8 max-w-[1180px] mx-auto">
        <div className="border border-border/40 bg-card/40 p-10 text-center">
          <p className="text-lg font-semibold text-foreground mb-2">No timeline generated yet</p>
          <p className="text-sm text-muted-foreground mb-6">Run Site Intake to generate a milestone timeline for your project.</p>
          <button
            onClick={() => setActiveTab?.('intake')}
            className="text-sm text-primary hover:text-primary/80 underline underline-offset-4 transition-colors"
          >
            Go to Site Intake &rarr;
          </button>
        </div>
      </div>
    );
  }

  const comparison = computeTimelineComparison(inputs, results);
  const traditionalPhases = getPhaseBreakdown(comparison.traditional.totalWeeks);
  const brickPhases = getPhaseBreakdown(comparison.brickAccel.totalWeeks);

  const CATEGORIES = [
    'All',
    ...(inputs?.hasOnSiteGeneration !== false ? ['Air'] : []),
    ...(inputs?.hasWaterUse !== false ? ['Water'] : []),
    'Other',
    'Brick PermitOS',
  ];

  const attainment = STATES_ATTAINMENT[inputs?.state || 'Tennessee'] || 'Attainment';
  const isNonAttain = attainment.includes('Nonattainment');
  const siteMW = results?.totalMW || 200;
  const pathway = results?.pathway || {};

  // Compute pathwayMul from shared function for Gantt chart
  const totalMW = siteMW;
  const projectScenario = inputs?.projectScenario || 'greenfield';
  const baselineNox = results?.baseline?.nox || 0;
  const controlledNox = results?.controlled?.nox || 0;
  const emissionsReductionPct = baselineNox > 0 ? Math.max(0, (baselineNox - controlledNox) / baselineNox) : 0;

  const pathwayDuration = computePathwayDuration({
    totalMW,
    isNonAttain,
    requiresPSD: pathway.requiresPSD,
    syntheticMinorViable: pathway.syntheticMinorViable,
    projectScenario,
    emissionsReductionPct,
  });

  const { tracks: GANTT_TRACKS, ganttWeeks } = getGanttTracks({
    totalMW: siteMW,
    isNonAttain,
    pathway,
    pathwayMul: pathwayDuration.pathwayMul,
    totalWeeks: comparison.brickAccel.totalWeeks,
  });

  const filteredTracks = GANTT_TRACKS.filter(t => filter === 'All' || t.cat === filter);
  const airIssuanceTrack = GANTT_TRACKS.find(t => t.label === 'Air Permit Issuance (est.)');
  const codWeek = airIssuanceTrack ? airIssuanceTrack.start : 36;
  const weekMarkers = [];
  for (let w = 0; w <= ganttWeeks; w += Math.max(4, Math.ceil(ganttWeeks / 12))) {
    weekMarkers.push(w);
  }
  if (weekMarkers[weekMarkers.length - 1] !== ganttWeeks) weekMarkers.push(ganttWeeks);

  // Label column width — shrunk slightly to avoid scroll at narrow widths
  const labelWidth = 'w-32';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <Card>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-white mb-1">Milestone-Based Permit Timeline</h2>
              <p className="text-xs text-muted-foreground">
                {inputs?.siteName || 'BigWatt Campus'} · {inputs?.state || 'TN'} · {siteMW} MW ·
                {isNonAttain ? ' ⚠ Nonattainment — Extended Review Timeline' : ' Attainment Area'}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(c => (
                <button key={c}
                  onClick={() => setFilter(c)}
                  className={`text-xs px-3 py-1.5 border transition-all
                    ${filter === c ? 'bg-primary text-white border-primary' : 'bg-muted text-muted-foreground border-border hover:text-foreground'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phase Breakdown Comparison — Traditional vs Brick-Accelerated */}
      <div>
        <h3 className="text-base font-semibold text-foreground/80 mb-4">Permit Phases — What Gets Done and When</h3>

        {/* Sequential Phase Timelines — side by side */}
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <div className="text-sm font-semibold text-foreground">Traditional Pathway</div>
              <div className="text-xs text-muted-foreground mb-4">~{comparison.traditional.totalMonths} months total</div>
              <PhaseTimeline phases={traditionalPhases} accentColor="var(--muted-foreground)" />
            </div>
            <div>
              <div className="text-sm font-semibold text-primary">Brick-Accelerated</div>
              <div className="text-xs text-primary mb-4">~{comparison.brickAccel.totalMonths} months total</div>
              <PhaseTimeline phases={brickPhases} accentColor="var(--color-primary)" />
            </div>
          </div>
        </div>

        {/* Bar chart comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 grid-flow-dense">
          <PhaseBreakdownChart
            phases={traditionalPhases}
            label="Traditional Pathway"
            totalMonths={comparison.traditional.totalMonths}
            color="var(--muted-foreground)"
          />
          <PhaseBreakdownChart
            phases={brickPhases}
            label="Brick-Accelerated"
            totalMonths={comparison.brickAccel.totalMonths}
            color="var(--color-primary)"
          />
        </div>
        {comparison.monthsSaved > 0 && (
          <div className="mt-3 text-center">
            <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 border border-primary/20">
              Brick saves ~{comparison.monthsSaved} months ({comparison.pctFaster}% faster) across all phases
            </span>
          </div>
        )}
      </div>

      {/* Gantt Chart */}
      <Card>
        <CardContent>
          <h3 className="text-base font-semibold text-foreground/80 mb-4">Gantt View — Permit Track Timeline</h3>

          {/* Week markers */}
          <div className="relative mb-1">
            <div className="flex text-xs text-muted-foreground/70" style={{ marginLeft: '128px' }}>
              {weekMarkers.map(w => (
                <div key={w} className="absolute text-xs text-muted-foreground/70" style={{ left: `calc(128px + ${(w / ganttWeeks) * 100}%)` }}>
                  W{w}
                </div>
              ))}
            </div>
          </div>

          {/* No overflow-x-auto wrapper — let the chart flow naturally */}
          {/* Grid lines */}
          <div className="relative" style={{ marginLeft: '128px' }}>
            {weekMarkers.map(w => (
              <div key={w} className="absolute top-0 bottom-0 border-l border-border/50"
                style={{ left: `${(w / ganttWeeks) * 100}%`, height: `${filteredTracks.length * 28}px` }} />
            ))}
          </div>

          {filteredTracks.map((track, i) => (
            <div key={i} className="flex items-center min-h-[28px]">
              <div className={`text-xs text-muted-foreground ${labelWidth} flex-shrink-0 pr-2 truncate`} title={track.label}>{track.label}</div>
              <div className="flex-1 relative">
                <GanttBar startWk={track.start} endWk={track.end} color={track.color} ganttWeeks={ganttWeeks} />
              </div>
            </div>
          ))}

          {/* COD marker */}
          <div className="relative" style={{ marginLeft: '128px', height: '24px' }}>
            <div className="absolute flex items-center" style={{ left: `${(codWeek / ganttWeeks) * 100}%` }}>
              <div className="border-l-2 border-dashed border-primary" style={{ height: `${(filteredTracks.length + 2) * 28}px`, marginTop: `-${(filteredTracks.length + 1) * 28}px` }}></div>
              <div className="text-primary text-xs ml-1 font-medium whitespace-nowrap">Earliest COD</div>
            </div>
          </div>

          {/* Legend — using theme chart colors */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-border/40">
            {[
              { color: TC.air, label: 'Air Permits' },
              { color: TC.water, label: 'Water Permits' },
              { color: TC.other, label: 'Other Permits' },
              { color: TC.brick, label: 'Brick PermitOS Actions' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ background: l.color }}></div>
                <span className="text-xs text-muted-foreground">{l.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Additional Permit Requirements (static reference data) */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-foreground/80">Additional Permit Requirements</h3>
            <span className="text-xs text-muted-foreground/60 italic">Reference data — not site-specific</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/60">
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-semibold">Permit / Requirement</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-semibold">Lead Agency</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-semibold">Trigger</th>
                  <th className="text-left px-4 py-2.5 text-muted-foreground font-semibold">Est. Timeline</th>
                </tr>
              </thead>
              <tbody>
                {OTHER_PERMITS.map((p, i) => (
                  <tr key={p.name} className={`border-t border-border/40 ${i % 2 === 0 ? 'bg-card/20' : ''}`}>
                    <td className="px-4 py-2.5 text-foreground/80 font-medium">{p.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.agency}</td>
                    <td className="px-4 py-2.5 text-muted-foreground/70">{p.trigger}</td>
                    <td className="px-4 py-2.5 text-primary">W{p.weeks[0]}–W{p.weeks[1]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}