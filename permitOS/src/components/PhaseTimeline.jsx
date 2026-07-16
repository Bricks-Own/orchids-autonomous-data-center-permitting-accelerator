import React from 'react';

export default function PhaseTimeline({ phases, totalWeeks, accentColor = 'var(--primary)' }) {
  return (
    <div className="w-full overflow-hidden">
      <div className="flex items-stretch w-full">
        {phases.map((phase, i) => {
          const widthPct = (phase.weeks / totalWeeks) * 100;
          return (
            <div
              key={phase.label}
              className="flex flex-col items-center min-w-0"
              style={{ width: `${widthPct}%` }}
            >
              <div className="flex items-center w-full">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: i === 0 ? accentColor : 'var(--muted-foreground)' }}
                />
                {i < phases.length - 1 && (
                  <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
                )}
              </div>
              <div className="mt-2 text-center px-1">
                <div className="text-xs font-medium text-foreground truncate w-full" title={phase.label}>
                  {phase.label}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{phase.weeks}wk</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}