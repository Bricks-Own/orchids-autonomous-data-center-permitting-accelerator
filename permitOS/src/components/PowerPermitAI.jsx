import React from 'react';
import { POWER_MODULES } from '../data/permitData';
import { computePowerMetrics } from '../utils/buildPowerCalc';
import { Lightning, Check } from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import PermitBanner, { PERMIT_COLORS } from './permit-detail/PermitBanner';
import MetricCard from './permit-detail/MetricCard';
import PathwayDeterminationCard from './permit-detail/PathwayDeterminationCard';
import PermitModuleAccordion from './permit-detail/PermitModuleAccordion';

export default function PowerPermitAI({ inputs, results, setActiveTab }) {
  const c = PERMIT_COLORS.power;

  if (!inputs) {
    return (
      <div className="p-6 text-center py-20">
        <Lightning weight="duotone" size={48} className="mx-auto text-muted-foreground mb-4" />
        <h3 className="text-muted-foreground font-medium mb-2">No Site Data Yet</h3>
        <p className="text-muted-foreground/70 text-sm mb-4">Go to Site Intake and run permit screening first.</p>
        <Button variant="default" onClick={() => setActiveTab && setActiveTab('intake')}>
          Open Site Intake
        </Button>
      </div>
    );
  }

  const m = computePowerMetrics(inputs, results?.power || {});

  const metrics = [
    { label: 'On-Site Generation', value: `${m.totalMW} MW`, sub: `${m.powerSrc} · ${m.interconnectionKV} kV`, accent: c.accent },
    { label: 'Transformer', value: `${m.transformerMVA} MVA`, sub: `~${Math.round(m.transformerMVA / Math.max(m.totalMW, 1) * 100)}% of load`, accent: 'text-destructive' },
    { label: 'ISO/RTO', value: m.iso, sub: inputs.state || '—', accent: 'text-emerald-400' },
    { label: 'FERC', value: m.ferc, sub: m.totalMW > 20 ? 'LGIA required' : 'SGIP applicable', accent: 'text-blue-400' },
    { label: 'NERC', value: m.nerc, sub: `BES threshold: 20 MVA`, accent: 'text-primary' },
  ];

  const pathway = [
    { label: 'Interconnection', status: m.ferc, detail: `LGIA/SGIP through ${m.iso} — Feasibility (45d) → SIS (90d) → FS (180d)` },
    { label: 'NERC', status: m.nerc, detail: `GO/GOP registration via SERC/TRE/WECC; CIP if >20 MVA` },
    { label: 'PUC', status: m.cpc, detail: `Self-generation exemption; CPCN filing if >50 MW` },
    { label: 'Gas Supply', status: m.totalMW > 0 ? `${Math.round(m.totalMW * 0.16)} MMBtu/hr peak` : 'N/A', detail: 'Firm transport for hyperscale; interruptible OK for edge' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Banner */}
      <PermitBanner
        type="power"
        title="Power Permitting & Grid Interconnection"
        subtitle="FERC · NERC · ISO/RTO · PUC · Utility Interconnection"
        badges={m.totalMW > 0 ? [
          <span key="gen" className={`text-xs px-3 py-1.5 border font-medium ${c.border} ${c.bg} ${c.accent}`}>
            {m.totalMW} MW · {m.interconnectionKV} kV · {m.iso}
          </span>
        ] : []}
      />

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {metrics.map(m => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {/* Interconnection Pathway */}
      <Card>
        <CardHeader>
          <CardTitle className={`${c.accent} text-xs font-semibold uppercase tracking-wider`}>
            Interconnection Pathway
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {pathway.map(item => (
              <div key={item.label} className="bg-muted/40 p-3">
                <div className="text-xs font-medium text-foreground/80 mb-1">{item.label}</div>
                <div className="text-xs text-primary font-medium">{item.status}</div>
                <div className="text-xs text-muted-foreground/70 mt-0.5">{item.detail}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Power & Interconnection Modules */}
      <Card>
        <CardHeader>
          <CardTitle className={`${c.accent} text-xs font-semibold uppercase tracking-wider`}>
            Power & Interconnection Modules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            {POWER_MODULES.map(mod => (
              <PowerModuleCard key={mod.id} mod={mod} setActiveTab={setActiveTab} iso={m.iso} accentColor={c.accent} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PowerModuleCard({ mod, setActiveTab, iso, accentColor }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="border border-border/40 bg-card/40 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 hover:bg-muted/40 transition-colors flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-1.5 py-0.5 border ${accentColor ? `bg-[${accentColor}]/20 border-[${accentColor}]/30` : 'bg-primary/20 text-primary border-primary/30'} text-primary`}>
              {mod.category}
            </span>
            <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5">{mod.id.toUpperCase()}</span>
          </div>
          <h4 className="text-sm font-semibold text-foreground">{mod.title}</h4>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{mod.description}</p>
        </div>
        <svg className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 mt-1 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
          <div className="bg-amber-950/20 border border-amber-800/30 p-3">
            <p className="text-xs text-amber-300 font-medium mb-1">Regulatory Reference</p>
            <p className="text-xs text-muted-foreground">{mod.regulation}</p>
            <p className="text-xs text-muted-foreground mt-2">{mod.guidance}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-foreground/80 mb-2">Agency: <span className="text-muted-foreground font-normal">{mod.agency}</span> · ISO: <span className="text-muted-foreground">{iso}</span></p>
            <ul className="space-y-1">
              {mod.deliverables.map((d, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Check weight="bold" size={12} className="text-primary mt-0.5 flex-shrink-0" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-muted/40 p-2.5">
            <p className="text-xs text-muted-foreground italic mb-2">Cross-ref: AIR-001 (Gen details), AIR-008 (Turbine compliance), Milestones (interconnection ~52w), Building (NFPA 110)</p>
            <div className="flex flex-wrap gap-1.5">
              {['intake','air','milestones','building'].map(tab => (
                <button key={tab} onClick={() => setActiveTab && setActiveTab(tab)}
                  className="text-xs bg-primary/20 hover:bg-primary/30 text-primary px-2 py-0.5 border border-primary/30 transition-colors">
                  <span className="inline-flex items-center gap-1">
                    {tab === 'intake' ? 'Intake' : tab === 'air' ? 'Air' : tab === 'milestones' ? 'Milestones' : 'Building'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}