import React, { useState } from 'react';
import { MILESTONE_PHASES, OTHER_PERMITS } from '../data/permitData';
import { STATES_ATTAINMENT } from '../data/permitData';

const TRACK_COLORS = {
  air: 'bg-red-500',
  water: 'bg-blue-500',
  other: 'bg-gray-500',
  brick: 'bg-indigo-500',
};

const WEEKS_TOTAL = 60;

function GanttBar({ startWk, endWk, color, label }) {
  const left = (startWk / WEEKS_TOTAL) * 100;
  const width = ((endWk - startWk) / WEEKS_TOTAL) * 100;
  return (
    <div className="relative h-6 my-0.5">
      <div
        className={`absolute h-5 top-0.5 rounded-md flex items-center px-2 text-white text-xs font-medium truncate ${color} opacity-90`}
        style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }}
      >
        {label}
      </div>
    </div>
  );
}

const GANTT_TRACKS = [
  // Air tracks
  { label: 'Site Intake & Data Collection', start: 1, end: 3, color: TRACK_COLORS.air, cat: 'Air / Multi' },
  { label: 'Air Applicability & PTE', start: 2, end: 5, color: TRACK_COLORS.air, cat: 'Air' },
  { label: 'BACT/LAER Top-Down Analysis', start: 3, end: 7, color: TRACK_COLORS.air, cat: 'Air' },
  { label: 'AERMOD Dispersion Modeling', start: 4, end: 10, color: TRACK_COLORS.air, cat: 'Air' },
  { label: 'Air Application Assembly', start: 7, end: 11, color: TRACK_COLORS.air, cat: 'Air' },
  { label: 'Air Agency Review', start: 12, end: 40, color: 'bg-red-800', cat: 'Air' },
  { label: 'Air Permit Issuance (est.)', start: 36, end: 52, color: 'bg-red-900', cat: 'Air' },
  // Water tracks
  { label: 'Wetlands / WOTUS Screening', start: 1, end: 4, color: TRACK_COLORS.water, cat: 'Water' },
  { label: 'Construction SW CGP NOI', start: 1, end: 4, color: TRACK_COLORS.water, cat: 'Water' },
  { label: 'NPDES / SPCC / 316(b)', start: 2, end: 7, color: TRACK_COLORS.water, cat: 'Water' },
  { label: 'Water Applications', start: 6, end: 10, color: TRACK_COLORS.water, cat: 'Water' },
  { label: 'NPDES Permit Review', start: 10, end: 28, color: 'bg-blue-800', cat: 'Water' },
  // Other
  { label: 'Zoning / Land Use', start: 1, end: 20, color: TRACK_COLORS.other, cat: 'Other' },
  { label: 'Building / Fire / Electrical', start: 4, end: 18, color: TRACK_COLORS.other, cat: 'Other' },
  { label: 'Utility Interconnect', start: 4, end: 52, color: 'bg-gray-700', cat: 'Other' },
  // Brick deliverables
  { label: 'Brick AI Applicability Engine', start: 1, end: 2, color: TRACK_COLORS.brick, cat: 'Brick PermitOS' },
  { label: 'Brick PTE + Water Balance', start: 2, end: 4, color: TRACK_COLORS.brick, cat: 'Brick PermitOS' },
  { label: 'Brick CFR Document Factory', start: 3, end: 8, color: TRACK_COLORS.brick, cat: 'Brick PermitOS' },
  { label: 'Brick Digital Twin Setup', start: 6, end: 10, color: TRACK_COLORS.brick, cat: 'Brick PermitOS' },
  { label: 'Brick Compliance OS (post-COD)', start: 36, end: 60, color: TRACK_COLORS.brick, cat: 'Brick PermitOS' },
];

const CATEGORIES = ['All', 'Air', 'Water', 'Other', 'Brick PermitOS'];

export default function MilestoneTimeline({ results, inputs }) {
  const [filter, setFilter] = useState('All');
  const attainment = STATES_ATTAINMENT[inputs?.state || 'Tennessee'] || 'Attainment';
  const isNonAttain = attainment.includes('Nonattainment');
  const siteMW = results?.totalMW || 200;

  const filteredTracks = GANTT_TRACKS.filter(t => filter === 'All' || t.cat === filter);
  const weekMarkers = [0, 4, 8, 12, 16, 20, 26, 32, 40, 52, 60];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-white mb-1">Milestone-Based Permit Timeline</h2>
            <p className="text-xs text-gray-500">
              {inputs?.siteName || 'BigWatt Campus'} · {inputs?.state || 'TN'} · {siteMW} MW ·
              {isNonAttain ? ' ⚠ Nonattainment — Extended Review Timeline' : ' Attainment Area'}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(c => (
              <button key={c}
                onClick={() => setFilter(c)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all
                  ${filter === c ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Air Permit (Attainment PSD)', value: '9–18 months', fast: '6–12 mo w/ Brick', color: 'text-red-400' },
            { label: 'Air Permit (Non-Attainment NSR)', value: '12–24 months', fast: '10–18 mo w/ Brick', color: 'text-amber-400' },
            { label: 'NPDES Individual Permit', value: '6–12 months', fast: '4–8 mo w/ Brick', color: 'text-blue-400' },
            { label: 'Construction CGP / SPCC', value: '2–4 weeks', fast: 'Days w/ Brick', color: 'text-green-400' },
          ].map(m => (
            <div key={m.label} className="bg-gray-800/40 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1">{m.label}</div>
              <div className={`text-sm font-bold ${m.color}`}>{m.value}</div>
              <div className="text-xs text-green-400 mt-0.5 font-medium">{m.fast}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Phase cards */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Permit Phases — What Gets Done and When</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {MILESTONE_PHASES.map(phase => (
            <div key={phase.phase} className="rounded-xl border border-gray-700/40 bg-gray-900/40 overflow-hidden">
              <div className={`${phase.color} px-4 py-3`}>
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold text-sm">Phase {phase.phase}</span>
                  <span className="text-white/80 text-xs font-medium bg-black/20 px-2 py-0.5 rounded-full">Weeks {phase.weeks}</span>
                </div>
                <div className="text-white/90 text-sm font-medium mt-0.5">{phase.name}</div>
              </div>
              <div className="p-4">
                <ul className="space-y-1.5">
                  {phase.tasks.map(t => (
                    <li key={t} className="flex gap-2 text-xs text-gray-400">
                      <span className="text-indigo-400 mt-0.5 flex-shrink-0">→</span>
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
      <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-4">Gantt View — Permit Track Timeline</h3>

        {/* Week markers */}
        <div className="relative mb-1">
          <div className="flex text-xs text-gray-600" style={{ marginLeft: '140px' }}>
            {weekMarkers.map(w => (
              <div key={w} className="absolute text-xs text-gray-600" style={{ left: `calc(140px + ${(w / WEEKS_TOTAL) * (100)}%)` }}>
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
                <div key={w} className="absolute top-0 bottom-0 border-l border-gray-800/50"
                  style={{ left: `${(w / WEEKS_TOTAL) * 100}%`, height: `${filteredTracks.length * 28}px` }} />
              ))}
            </div>

            {filteredTracks.map((track, i) => (
              <div key={i} className="flex items-center min-h-[28px]">
                <div className="text-xs text-gray-500 w-36 flex-shrink-0 pr-2 truncate" title={track.label}>{track.label}</div>
                <div className="flex-1 relative">
                  <GanttBar startWk={track.start} endWk={track.end} color={track.color} label={track.label} />
                </div>
              </div>
            ))}

            {/* COD marker */}
            <div className="relative" style={{ marginLeft: '140px', height: '24px' }}>
              {results && (
                <div className="absolute flex items-center" style={{ left: `${(36 / WEEKS_TOTAL) * 100}%` }}>
                  <div className="border-l-2 border-dashed border-green-500 h-full" style={{ height: `${(filteredTracks.length + 2) * 28}px`, marginTop: `-${(filteredTracks.length + 1) * 28}px` }}></div>
                  <div className="text-green-400 text-xs ml-1 font-medium whitespace-nowrap">Earliest COD</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-800/40">
          {[
            { color: 'bg-red-500', label: 'Air Permits' },
            { color: 'bg-blue-500', label: 'Water Permits' },
            { color: 'bg-gray-500', label: 'Other Permits' },
            { color: 'bg-indigo-500', label: 'Brick PermitOS Actions' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-sm ${l.color}`}></div>
              <span className="text-xs text-gray-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Other permits table */}
      <div className="rounded-xl border border-gray-700/40 bg-gray-900/40 p-5">
        <h3 className="text-sm font-semibold text-gray-300 mb-3">Additional Permit Requirements</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-800/60">
                <th className="text-left px-4 py-2.5 text-gray-400 font-semibold">Permit / Requirement</th>
                <th className="text-left px-4 py-2.5 text-gray-400 font-semibold">Lead Agency</th>
                <th className="text-left px-4 py-2.5 text-gray-400 font-semibold">Trigger</th>
                <th className="text-left px-4 py-2.5 text-gray-400 font-semibold">Est. Timeline</th>
              </tr>
            </thead>
            <tbody>
              {OTHER_PERMITS.map((p, i) => (
                <tr key={p.name} className={`border-t border-gray-800/40 ${i % 2 === 0 ? 'bg-gray-900/20' : ''}`}>
                  <td className="px-4 py-2.5 text-gray-300 font-medium">{p.name}</td>
                  <td className="px-4 py-2.5 text-gray-500">{p.agency}</td>
                  <td className="px-4 py-2.5 text-gray-600">{p.trigger}</td>
                  <td className="px-4 py-2.5 text-indigo-400">W{p.weeks[0]}–W{p.weeks[1]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
