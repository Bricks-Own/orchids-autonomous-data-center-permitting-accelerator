import React from 'react';
import { Card, CardContent } from '../ui/card';

export default function MetricCard({ label, value, sub, accent, className }) {
  return (
    <Card className={className}>
      <CardContent className="py-4">
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className={`text-lg font-bold ${accent || 'text-foreground'}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground/70 mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}