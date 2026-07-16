import React from 'react';
import { Card, CardContent } from '../ui/card';

const PERMIT_COLORS = {
  air:      { border: 'border-[var(--color-chart-1)]/30', bg: 'bg-[var(--color-chart-1)]/5',  accent: 'text-[var(--color-chart-1)]' },
  water:    { border: 'border-[var(--color-chart-2)]/30', bg: 'bg-[var(--color-chart-2)]/5',  accent: 'text-[var(--color-chart-2)]' },
  building: { border: 'border-[var(--color-chart-3)]/30', bg: 'bg-[var(--color-chart-3)]/5',  accent: 'text-[var(--color-chart-3)]' },
  power:    { border: 'border-[var(--color-chart-4)]/30', bg: 'bg-[var(--color-chart-4)]/5',  accent: 'text-[var(--color-chart-4)]' },
};

export default function PermitBanner({ type, title, subtitle, badges }) {
  const c = PERMIT_COLORS[type] || PERMIT_COLORS.air;
  return (
    <Card className={`${c.border} ${c.bg}`}>
      <CardContent className="flex flex-wrap gap-4 items-center justify-between py-4">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {badges && badges.length > 0 && (
          <div className="flex flex-wrap gap-2">{badges}</div>
        )}
      </CardContent>
    </Card>
  );
}

export { PERMIT_COLORS };