import React from 'react';

export default function PhaseTimeline({ phases, accentColor = 'var(--primary)' }) {
  return (
    <div className="flex flex-col w-full">
      {phases.map((phase, i) => (
        <div key={phase.label} className="flex gap-3">
          <div className="flex flex-col items-center flex-shrink-0">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
              style={{ background: i === 0 ? accentColor : 'var(--muted-foreground)' }}
            />
            {i < phases.length - 1 && (
              <div className="w-px flex-1" style={{ background: 'var(--border)', minHeight: '28px' }} />
            )}
          </div>
          <div className="pb-4 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground">{phase.label}</span>
              <span className="text-xs text-muted-foreground">{phase.weeks}wk (W{phase.startWeek}–{phase.endWeek})</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{phase.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}