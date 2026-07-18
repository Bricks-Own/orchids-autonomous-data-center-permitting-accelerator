import React from 'react';
import { WATER_MODULES } from '../data/permitData';
import { Drop, CheckCircle, XCircle, WarningCircle, Check } from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import PermitBanner, { PERMIT_COLORS } from './permit-detail/PermitBanner';
import MetricCard from './permit-detail/MetricCard';
import PathwayDeterminationCard from './permit-detail/PathwayDeterminationCard';
import PermitModuleAccordion from './permit-detail/PermitModuleAccordion';

import { estimateDieselStorage } from '../utils/calculations';

export default function WaterPermitAI({ results, inputs }) {
  const c = PERMIT_COLORS.water;

  if (!results) {
    return (
      <div className="p-6 text-center py-20">
        <Drop weight="duotone" size={48} className="mx-auto text-muted-foreground mb-4" />
        <h3 className="text-muted-foreground font-medium mb-2">No Site Data Yet</h3>
        <p className="text-muted-foreground/70 text-sm">Go to Site Intake and run the permit screening first.</p>
      </div>
    );
  }

  const { water } = results;

  // ─── Data-driven pathway statuses ──────────────────────────────────────
  const siteAcres = inputs.siteAcres || 0;
  const hasNewConstruction = inputs.hasNewConstruction !== false;
  const cgpRequired = hasNewConstruction && siteAcres >= 1;
  const spccRequired = water.determination?.spccRequired ?? false;
  const potwPathway = water.determination?.pretreatmentRequired ?? false;
  // Display-only: aggregate diesel volume for the SPCC card trigger text
  const aggregateDieselGal = estimateDieselStorage(inputs.gensetCount, inputs.gensetHP);

  const waterMetrics = [
    { label: 'Cooling Water Use', value: `${water.annualWaterMG.toFixed(1)} MG/yr`, sub: `${inputs.coolingMGD} MGD`, accent: c.accent },
    { label: 'Blowdown Volume', value: `${water.blowdownMG.toFixed(1)} MG/yr`, sub: 'NPDES / pretreatment', accent: 'text-destructive' },
    { label: 'Optimized Water (Brick)', value: `${water.optimizedWater.toFixed(1)} MG/yr`, sub: `-${(water.annualWaterMG - water.optimizedWater).toFixed(1)} MG avoided`, accent: 'text-primary' },
    { label: 'Makeup Water Required', value: `${water.makeupMG.toFixed(1)} MG/yr`, sub: 'Utility supply', accent: 'text-primary' },
  ];

  const bannerBadgeText = (() => {
    const badges = [];
    badges.push({ label: 'NPDES Required', status: 'warning' });
    if (spccRequired) badges.push({ label: 'SPCC Applicable', status: 'warning' });
    else badges.push({ label: 'SPCC Not Triggered', status: 'ok' });
    if (cgpRequired) badges.push({ label: 'SWPPP Required', status: 'warning' });
    else badges.push({ label: 'CGP Not Triggered', status: 'ok' });
    return badges;
  })();

  return (
    <div className="p-6 space-y-6">
      {/* Banner */}
      <PermitBanner
        type="water"
        title={`${inputs.siteName} — Water Permit Analysis`}
        subtitle={`${inputs.state} · Cooling: ${inputs.coolingMGD} MGD · Process water: ${inputs.waterMGD} MGD`}
        badges={bannerBadgeText.map(b => {
          const Icon = b.status === 'warning' ? XCircle : CheckCircle;
          return (
            <span key={b.label} className={`text-xs px-2.5 py-1 border inline-flex items-center gap-1.5 ${
              b.status === 'warning' ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'bg-primary/10 border-primary/30 text-primary'
            }`}>
              <Icon weight="fill" size={10} />
              {b.label}
            </span>
          );
        })}
      />

      {/* Water metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {waterMetrics.map(m => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Permit pathway */}
        <PathwayDeterminationCard
          type="water"
          accentColor={c.accent}
          title="Water Permit Pathway Determination"
          items={[
            {
              label: 'NPDES Individual or General Permit',
              trigger: 'Any wastewater or process water discharge to waters of the US',
              citations: '40 CFR Parts 122/124/125',
              status: 'Required',
              detail: 'Cooling tower blowdown, sanitary, and any process effluent. Individual permit typically needed for cooling tower discharge at large data centers.',
              ok: false,
            },
            {
              label: 'Industrial Stormwater — MSGP',
              trigger: 'SIC code 7374 (Data Processing) — confirm with state',
              citations: '40 CFR 122.26 / EPA MSGP',
              status: 'Evaluate',
              detail: 'Some data centers fall under MSGP Sector X or Y. State-specific general permits may provide alternative pathway.',
              ok: null,
            },
            {
              label: 'Construction Stormwater — CGP',
              trigger: `Site disturbance: ${siteAcres >= 1 ? `${siteAcres} acres — threshold met` : `${siteAcres || 'N/A'} acres — below 1 acre threshold`}`,
              citations: 'EPA CGP / State equivalent',
              status: cgpRequired ? 'Required' : 'Not Required (below 1 acre)',
              detail: cgpRequired
                ? 'Notice of Intent (NOI) + SWPPP required before earth disturbance. State permit often substitutes for federal CGP.'
                : 'Site disturbance below 1 acre threshold. Check local/state requirements as some states have lower thresholds.',
              ok: !cgpRequired,
            },
            {
              label: 'SPCC — Fuel and Oil Storage',
              trigger: `${inputs.gensetCount || 0} gensets × ${inputs.gensetHP || 0} HP — estimated ${aggregateDieselGal.toFixed(0)} gal aggregate diesel storage`,
              citations: '40 CFR Part 112',
              status: spccRequired ? 'Required' : 'Below Threshold',
              detail: spccRequired
                ? 'SPCC Plan required if above-ground storage > 1,320 gal or underground > 42,000 gal. PE-certified plan if > 10,000 gal.'
                : `Estimated aggregate diesel storage (${aggregateDieselGal.toFixed(0)} gal) below 1,320 gal SPCC threshold. Verify actual tank capacities.`,
              ok: !spccRequired,
            },
            {
              label: 'CWA 316(b) — Cooling Water Intake',
              trigger: `Cooling water intake flow: ${inputs.coolingMGD} MGD`,
              citations: 'CWA § 316(b) / 40 CFR Part 125 Subpart J',
              status: inputs.coolingMGD >= 2 ? 'Evaluate' : 'Likely Below Threshold',
              detail: 'Phase II applies to existing facilities with ≥2 MGD intake. New facilities evaluated under state requirements.',
              ok: inputs.coolingMGD < 2,
            },
            {
              label: 'Pretreatment / POTW Discharge',
              trigger: potwPathway ? 'Discharge pathway: POTW-Sanitary Sewer Connection' : 'Discharge pathway: ' + (inputs.dischargePathway || 'Not specified'),
              citations: '40 CFR Part 403 / Local pretreatment ordinance',
              status: potwPathway ? 'Evaluate with Utility' : 'Not Applicable (no POTW discharge pathway)',
              detail: potwPathway
                ? 'Cooling tower blowdown may require industrial user permit. Thermal discharge limits often apply.'
                : 'No POTW-sanitary sewer connection indicated. This requirement does not apply based on current discharge pathway.',
              ok: potwPathway ? null : true,
            },
            {
              label: 'Wetlands / Waters of the US',
              trigger: 'Site disturbance, grading, drainage improvements',
              citations: 'CWA § 404/401 / Sackett v. EPA (2023)',
              status: 'Screening Recommended',
              detail: 'NWI and soils screening recommended as a standing regulatory requirement. If jurisdictional waters present, Section 404 permit from USACE required. This is a general recommendation — not yet evaluated against specific site conditions.',
              ok: null,
            },
            {
              label: 'Water Conservation / Reuse Plan',
              trigger: 'Regulatory trend and utility requirements',
              citations: 'State water conservation rules / utility agreements',
              status: 'Recommend',
              detail: 'Brick controls can achieve water efficiency via cycles-of-concentration optimization, ZLD, and reuse strategies.',
              ok: true,
            },
          ]}
        />

        {/* Water Modules */}
        <PermitModuleAccordion
          type="water"
          title="Water Permit Modules — Deliverables"
          modules={WATER_MODULES}
          accentColor={c.accent}
        />
      </div>

      {/* Cooling Tower Water Balance */}
      <Card>
        <CardHeader>
          <CardTitle className={`${c.accent} text-xs font-semibold uppercase tracking-wider`}>
            Cooling Tower Water Balance — AI-Modeled
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4 text-sm">
            {[
              { label: 'Makeup Water', value: `${water.makeupMG.toFixed(1)} MG/yr`, formula: 'Evaporation + Blowdown + Drift', accent: c.accent },
              { label: 'Evaporation Loss', value: `${(water.annualWaterMG * 0.995).toFixed(1)} MG/yr`, formula: '~99.5% of consumed water', accent: 'text-orange-400' },
              { label: 'Blowdown', value: `${water.blowdownMG.toFixed(1)} MG/yr`, formula: `${inputs.blowdownPct}% of consumed flow`, accent: 'text-destructive' },
              { label: 'Drift Loss', value: `${(water.annualWaterMG * 0.005).toFixed(2)} MG/yr`, formula: '~0.5% with modern eliminators', accent: 'text-muted-foreground' },
              { label: 'Cycles of Concentration', value: `${(water.makeupMG / (water.blowdownMG || 1)).toFixed(1)}x`, formula: 'Makeup / Blowdown ratio', accent: 'text-primary' },
              { label: 'Blowdown TDS', value: `~${Math.round((water.makeupMG / (water.blowdownMG || 1)) * 280)} mg/L`, formula: 'COC × makeup TDS (280 mg/L)', accent: 'text-yellow-400' },
              { label: 'POTW Discharge Volume', value: `${(water.blowdownMG * 0.85).toFixed(1)} MG/yr`, formula: 'Blowdown to sewer (estimated)', accent: 'text-destructive' },
              { label: 'Water Saved (Brick)', value: `${(water.annualWaterMG - water.optimizedWater).toFixed(1)} MG/yr`, formula: 'COC optimization + load reduction', accent: 'text-primary' },
            ].map(m => (
              <MetricCard key={m.label} {...m} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}