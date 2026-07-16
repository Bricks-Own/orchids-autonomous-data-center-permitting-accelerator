import React from 'react';
import { BUILDING_MODULES } from '../data/permitData';
import { computeBuildingMetrics } from '../utils/buildPowerCalc';
import { Buildings, Check } from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import PermitBanner, { PERMIT_COLORS } from './permit-detail/PermitBanner';
import MetricCard from './permit-detail/MetricCard';
import PathwayDeterminationCard from './permit-detail/PathwayDeterminationCard';
import PermitModuleAccordion from './permit-detail/PermitModuleAccordion';

export default function BuildingPermitAI({ inputs, results, setActiveTab }) {
  const c = PERMIT_COLORS.building;

  if (!inputs) {
    return (
      <div className="p-6 text-center py-20">
        <Buildings weight="duotone" size={48} className="mx-auto text-muted-foreground mb-4" />
        <h3 className="text-muted-foreground font-medium mb-2">No Site Data Yet</h3>
        <p className="text-muted-foreground/70 text-sm mb-4">Go to Site Intake and run permit screening first.</p>
        <Button variant="default" onClick={() => setActiveTab && setActiveTab('intake')}>
          Open Site Intake
        </Button>
      </div>
    );
  }

  const buildingData = results?.building || {};
  const m = computeBuildingMetrics(inputs, buildingData);

  const buildingMetrics = [
    { label: 'Estimated Building Area', value: `${m.buildingSqFt.toLocaleString()} sqft`, sub: `${m.stories} stories · ${m.ibcClass}`, accent: 'text-primary' },
    { label: 'Fire Suppression', value: m.suppression, sub: `Type ${m.suppression.includes('Pre-action') ? 'I' : 'II'} System`, accent: 'text-destructive' },
    { label: 'Emergency Power Config', value: `${m.emergencyConf} configuration`, sub: `${(inputs.gensetCount || 0)} gensets · ${m.totalGensetMW.toFixed(1)} MW total`, accent: 'text-destructive' },
    { label: 'Fire-Rating Required', value: m.fireRating, sub: `Occupancy: ${m.occupancy}`, accent: 'text-orange-400' },
    { label: 'Zoning Noise Concern', value: m.noiseConcern, sub: `Assumes ${m.totalMW} MW generation on site`, accent: m.noiseConcern.includes('High') ? 'text-destructive' : 'text-primary' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Banner */}
      <PermitBanner
        type="building"
        title="Building Permitting Requirements"
        subtitle="IBC 2021 · NFPA 110/75/76 · Local Building Codes · Zoning Compliance"
        badges={m.totalMW > 0 ? [
          <span key="gen" className={`text-xs px-3 py-1.5 border font-medium ${c.border} ${c.bg} ${c.accent}`}>
            {m.totalMW} MW Generation · {m.ibcClass}
          </span>
        ] : []}
      />

      {/* Building Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {buildingMetrics.map(m => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      {/* Building Code Pathway */}
      <Card>
        <CardHeader>
          <CardTitle className={`${c.accent} text-xs font-semibold uppercase tracking-wider`}>
            Building Code Pathway Determination
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'IBC Occupancy', status: inputs.occupancyType || 'B (Business)', detail: `Turbine enclosure: F-1; Fuel: H-2/H-3 (if >500gal)` },
              { label: 'Height/Area Limits', status: m.stories <= 4 ? 'Compliant (IBC Table 504.3)' : 'Variance required (sprinkler increase allowed)', detail: `Type ${m.totalMW > 400 ? 'IB' : 'IIB'} allow ${m.stories} stories` },
              { label: 'Fire Suppression', status: m.suppression.includes('Clean agent') || m.suppression.includes('Pre-action') ? 'Compliant (IBC Chapter 9)' : 'Pre-action recommended for IT spaces', detail: `${m.suppression} for white space; sprinkler for support spaces` },
              { label: 'Emergency Power (NFPA 110)', status: m.emergencyConf.includes('N+1') || m.emergencyConf.includes('2N') ? 'Compliant (Level 1/2)' : 'N+1 recommended for Tier III+', detail: `${inputs.gensetCount || 0} gensets · ${m.emergencyConf} configured` },
            ].map(item => (
              <div key={item.label} className="bg-muted/40 p-3">
                <div className="text-xs font-medium text-foreground/80 mb-1">{item.label}</div>
                <div className="text-xs text-primary font-medium">{item.status}</div>
                <div className="text-xs text-muted-foreground/70 mt-0.5">{item.detail}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Building Modules */}
      <Card>
        <CardHeader>
          <CardTitle className={`${c.accent} text-xs font-semibold uppercase tracking-wider`}>
            Building Code Compliance Modules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            {BUILDING_MODULES.map(mod => (
              <BuildingModuleCard key={mod.id} mod={mod} setActiveTab={setActiveTab} accentColor={c.accent} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BuildingModuleCard({ mod, setActiveTab, accentColor }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="border border-border/40 bg-card/40 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 hover:bg-muted/40 transition-colors flex items-start justify-between gap-3"
      >
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
            <p className="text-xs font-medium text-foreground/80 mb-2">Agency: <span className="text-muted-foreground font-normal">{mod.agency}</span></p>
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
            <p className="text-xs text-muted-foreground italic mb-2">
              Cross-reference: AIR-015 (Monitoring/Recordkeeping), AIR-007 (BACT noise analysis), Water-001 (Cooling tower structural loads), Milestones tab (building permit timeline)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['intake','air','water','milestones'].map(tab => (
                <button key={tab}
                  onClick={() => setActiveTab && setActiveTab(tab)}
                  className="text-xs bg-primary/20 hover:bg-primary/30 text-primary px-2 py-0.5 border border-primary/30 transition-colors"
                >
                  <span className="inline-flex items-center gap-1">
                    {tab === 'intake' ? 'Site Intake' : tab === 'air' ? 'Air' : tab === 'water' ? 'Water' : 'Milestones'}
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