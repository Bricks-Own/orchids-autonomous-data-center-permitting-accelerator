import React, { useState } from 'react';
import { MILESTONE_PHASES, OTHER_PERMITS } from '../data/permitData';
import { STATES_ATTAINMENT } from '../data/permitData';

const TRACK_COLORS = {
  air: 'bg-red-500',
  water: 'bg-blue-500',
  other: 'bg-card0',
  brick: 'bg-primary',
};

const WEEKS_TOTAL = 60;

function getGanttTracks({ totalMW = 200, isNonAttain = false, pathway = {} }) {
  const { requiresPSD, syntheticMinorViable } = pathway;
  // True minor: below all PSD thresholds → shortest review
  // Synthetic minor: PSD-major but can accept permit limits to stay under → shorter review
  // PSD major: full PSD review → longest review
  const isTrueMinor = !requiresPSD;
  const isSyntheticMinor = requiresPSD && syntheticMinorViable;

  // MW scaling factor: 200MW = 1.0, caps at 0.7x–1.5x
  const mwFactor = Math.max(0.7, Math.min(1.5, totalMW / 200));

  // Air review multiplier: attainment + pathway combine
  // Nonattainment extends review ~50%, synthetic minor shortens ~40%
  const attainmentMul = isNonAttain ? 1.5 : 1.0;
  let pathwayMul;
  if (isTrueMinor) pathwayMul = 0.4;       // minor source — minimal agency review
  else if (isSyntheticMinor) pathwayMul = 0.55; // synthetic minor — shorter than full PSD
  else pathwayMul = 1.0;                   // PSD major — full review
  const airReviewMul = Math.min(1.8, mwFactor * attainmentMul * pathwayMul);

  // Compute dynamic air review weeks
  // Baseline: PSD major attainment = 12-40 (28wk duration)
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

  // Clamp to WEEKS_TOTAL
  airReviewEnd = Math.min(airReviewEnd, WEEKS_TOTAL - 2);
  airIssuanceEnd = Math.min(airIssuanceEnd, WEEKS_TOTAL);

  // Helper: scale a [start, end] range by mwFactor
  const s = (start, end) => ({
    start: Math.max(1, Math.round(start * mwFactor)),
    end: Math.max(2, Math.round(end * mwFactor)),
  });

  return [
    // Air tracks
    { label: 'Site Intake & Data Collection', ...s(1, 3), color: TRACK_COLORS.air, cat: 'Air / Multi' },
    { label: 'Air Applicability & PTE', ...s(2, 5), color: TRACK_COLORS.air, cat: 'Air' },
    { label: 'BACT/LAER Top-Down Analysis', ...s(3, 7), color: TRACK_COLORS.air, cat: 'Air' },
    { label: 'AERMOD Dispersion Modeling', ...s(4, 10), color: TRACK_COLORS.air, cat: 'Air' },
    { label: 'Air Application Assembly', ...s(7, 11), color: TRACK_COLORS.air, cat: 'Air' },
    { label: 'Air Agency Review', start: airReviewStart, end: airReviewEnd, color: 'bg-red-800', cat: 'Air' },
    { label: 'Air Permit Issuance (est.)', start: airIssuanceStart, end: airIssuanceEnd, color: 'bg-red-900', cat: 'Air' },
    // Water tracks
    { label: 'Wetlands / WOTUS Screening', ...s(1, 4), color: TRACK_COLORS.water, cat: 'Water' },
    { label: 'Construction SW CGP NOI', ...s(1, 4), color: TRACK_COLORS.water, cat: 'Water' },
    { label: 'NPDES / SPCC / 316(b)', ...s(2, 7), color: TRACK_COLORS.water, cat: 'Water' },
    { label: 'Water Applications', ...s(6, 10), color: TRACK_COLORS.water, cat: 'Water' },
    { label: 'NPDES Permit Review', ...s(10, 28), color: 'bg-blue-800', cat: 'Water' },
    // Other
    { label: 'Zoning / Land Use', ...s(1, 20), color: TRACK_COLORS.other, cat: 'Other' },
    { label: 'Building / Fire / Electrical', ...s(4, 18), color: TRACK_COLORS.other, cat: 'Other' },
    { label: 'Utility Interconnect', ...s(4, 52), color: 'bg-muted', cat: 'Other' },
    // Brick deliverables
    { label: 'Brick AI Applicability Engine', ...s(1, 2), color: TRACK_COLORS.brick, cat: 'Brick PermitOS' },
    { label: 'Brick PTE + Water Balance', ...s(2, 4), color: TRACK_COLORS.brick, cat: 'Brick PermitOS' },
    { label: 'Brick CFR Document Factory', ...s(3, 8), color: TRACK_COLORS.brick, cat: 'Brick PermitOS' },
    { label: 'Brick Digital Twin Setup', ...s(6, 10), color: TRACK_COLORS.brick, cat: 'Brick PermitOS' },
    { label: 'Brick Compliance OS (post-COD)', ...s(36, 60), color: TRACK_COLORS.brick, cat: 'Brick PermitOS' },
  ];
}

function GanttBar({ startWk, endWk, color, label }) {
  const left = (startWk / WEEKS_TOTAL) * 100;
  const width = ((endWk - startWk) / WEEKS_TOTAL) * 100;
  return (
    <div className="relative h-6 my-0.5">
      <div
        className={`absolute h-5 top-0.5  flex items-center px-2 text-white text-xs font-medium truncate ${color} opacity-90`}
        style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }}
      >
        {label}
      </div>
    </div>
  );
}

const CATEGORIES = ['All', 'Air', 'Water', 'Other', 'Brick PermitOS'];

export default function MilestoneTimeline({ results, inputs }) {
  const [filter, setFilter] = useState('All');
  const attainment = STATES_ATTAINMENT[inputs?.state || 'Tennessee'] || 'Attainment';
  const isNonAttain = attainment.includes('Nonattainment');
  const siteMW = results?.totalMW || 200;
  const pathway = results?.pathway || {};

  const GANTT_TRACKS = getGanttTracks({ totalMW: siteMW, isNonAttain, pathway });
  const filteredTracks = GANTT_TRACKS.filter(t => filter === 'All' || t.cat === filter);
  // Earliest COD = air issuance start week (when permit is expected to be issued)
  const airIssuanceTrack = GANTT_TRACKS.find(t => t.label === 'Air Permit Issuance (est.)');
  const codWeek = airIssuanceTrack ? airIssuanceTrack.start : 36;
  const weekMarkers = [0, 4, 8, 12, 16, 20, 26, 32, 40, 52, 60];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className=" border border-border/40 bg-card/40 p-5">
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
                className={`text-xs px-3 py-1.5  border transition-all
                  ${filter === c ? 'bg-primary text-white border-primary' : 'bg-muted text-muted-foreground border-border hover:text-foreground'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Air Permit (Attainment PSD)', value: '9–18 months', fast: '6–12 mo w/ Brick', color: 'text-destructive' },
            { label: 'Air Permit (Non-Attainment NSR)', value: '12–24 months', fast: '10–18 mo w/ Brick', color: 'text-destructive' },
            { label: 'NPDES Individual Permit', value: '6–12 months', fast: '4–8 mo w/ Brick', color: 'text-blue-400' },
            { label: 'Construction CGP / SPCC', value: '2–4 weeks', fast: 'Days w/ Brick', color: 'text-primary' },
          ].map(m => (
            <div key={m.label} className="bg-muted/40  p-3">
              <div className="text-xs text-muted-foreground mb-1">{m.label}</div>
              <div className={`text-sm font-bold ${m.color}`}>{m.value}</div>
              <div className="text-xs text-primary mt-0.5 font-medium">{m.fast}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Phase cards */}
      <div>
        <h3 className="text-sm font-semibold text-foreground/80 mb-4">Permit Phases — What Gets Done and When</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MILESTONE_PHASES.map(phase => (
            <div key={phase.phase} className=" border border-border/40 bg-card/40 overflow-hidden">
              <div className={`${phase.color} px-4 py-3`}>
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold text-sm">Phase {phase.phase}</span>
                  <span className="text-white/80 text-xs font-medium bg-black/20 px-2 py-0.5 ">Weeks {phase.weeks}</span>
                </div>
                <div className="text-white/90 text-sm font-medium mt-0.5">{phase.name}</div>
              </div>
              <div className="p-4">
                <ul className="space-y-1.5">
                  {phase.tasks.map(t => (
                    <li key={t} className="flex gap-2 text-xs text-muted-foreground">
                      <span className="text-primary mt-0.5 flex-shrink-0">→</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gantt Chart */}
      <div className=" border border-border/40 bg-card/40 p-5">
        <h3 className="text-sm font-semibold text-foreground/80 mb-4">Gantt View — Permit Track Timeline</h3>

        {/* Week markers */}
        <div className="relative mb-1">
          <div className="flex text-xs text-muted-foreground/70" style={{ marginLeft: '140px' }}>
            {weekMarkers.map(w => (
              <div key={w} className="absolute text-xs text-muted-foreground/70" style={{ left: `calc(140px + ${(w / WEEKS_TOTAL) * (100)}%)` }}>
                W{w}
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div style={{ minWidth: '900px' }}>
            {/* Grid lines */}
            <div className="relative" style={{ marginLeft: '140px' }}>
              {weekMarkers.map(w => (
                <div key={w} className="absolute top-0 bottom-0 border-l border-border/50"
                  style={{ left: `${(w / WEEKS_TOTAL) * 100}%`, height: `${filteredTracks.length * 28}px` }} />
              ))}
            </div>

            {filteredTracks.map((track, i) => (
              <div key={i} className="flex items-center min-h-[28px]">
                <div className="text-xs text-muted-foreground w-36 flex-shrink-0 pr-2 truncate" title={track.label}>{track.label}</div>
                <div className="flex-1 relative">
                  <GanttBar startWk={track.start} endWk={track.end} color={track.color} label={track.label} />
                </div>
              </div>
            ))}

            {/* COD marker */}
            <div className="relative" style={{ marginLeft: '140px', height: '24px' }}>
              {results && (
                <div className="absolute flex items-center" style={{ left: `${(codWeek / WEEKS_TOTAL) * 100}%` }}>
                  <div className="border-l-2 border-dashed border-green-500 h-full" style={{ height: `${(filteredTracks.length + 2) * 28}px`, marginTop: `-${(filteredTracks.length + 1) * 28}px` }}></div>
                  <div className="text-primary text-xs ml-1 font-medium whitespace-nowrap">Earliest COD</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-border/40">
          {[
            { color: 'bg-red-500', label: 'Air Permits' },
            { color: 'bg-blue-500', label: 'Water Permits' },
            { color: 'bg-card0', label: 'Other Permits' },
            { color: 'bg-primary', label: 'Brick PermitOS Actions' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-sm ${l.color}`}></div>
              <span className="text-xs text-muted-foreground">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Other permits table */}
      <div className=" border border-border/40 bg-card/40 p-5">
        <h3 className="text-sm font-semibold text-foreground/80 mb-3">Additional Permit Requirements</h3>
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
      </div>
    </div>
  );
}
