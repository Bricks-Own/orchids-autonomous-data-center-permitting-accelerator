import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { CaretDown } from '@phosphor-icons/react';

const STATUS_ICONS = {
  ok: 'CheckCircle',
  warning: 'WarningCircle',
  neutral: 'Info',
};

export default function PathwayDeterminationCard({ type, title, items, accentColor }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className={`text-xs font-semibold uppercase tracking-wider ${accentColor || 'text-primary'}`}>
          {title || 'Pathway Determination'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-xs">
          {items.map(item => (
            <PathwayItem key={item.label} item={item} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PathwayItem({ item }) {
  const [exp, setExp] = useState(false);
  const { label, status, detail, ok, breach, regText, trigger, citations, children } = item;

  const statusColor = ok === false
    ? 'text-destructive bg-destructive/10 border-destructive/30'
    : ok === true
      ? 'text-primary bg-primary/10 border-primary/30'
      : 'text-muted-foreground bg-muted border-border/60';

  return (
    <div className={`border border-border/60 overflow-hidden ${breach ? 'border-destructive/40 bg-red-950/10' : ''}`}>
      <button
        onClick={() => setExp(!exp)}
        className="w-full flex items-start justify-between gap-2 p-3 text-left hover:bg-black/10 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-foreground/80 text-xs mb-0.5">{label}</div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 border ${statusColor}`}>
              {status}
            </span>
            {trigger && <span className="text-muted-foreground/70 text-xs">{trigger}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {breach && <span className="text-xs text-destructive">Related breach</span>}
          <CaretDown weight="bold" size={14} className={`text-muted-foreground/70 transition-transform ${exp ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {exp && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/40 pt-2">
          {detail && <div className="text-xs text-muted-foreground leading-relaxed">{detail}</div>}
          {regText && <div className="text-xs text-muted-foreground/70 font-mono">{regText}</div>}
          {citations && <div className="text-xs text-primary/70">{citations}</div>}
          {children}
        </div>
      )}
    </div>
  );
}