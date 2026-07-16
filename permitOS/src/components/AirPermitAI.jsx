import React, { useState } from 'react';
import { AIR_MODULES, STATES_ATTAINMENT } from '../data/permitData';
import { THRESHOLDS } from '../utils/calculations';
import { CheckCircle, XCircle, WarningCircle, Wind, Check, ArrowRight } from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell
} from './ui/table';
import PermitBanner, { PERMIT_COLORS } from './permit-detail/PermitBanner';
import PathwayDeterminationCard from './permit-detail/PathwayDeterminationCard';
import PermitModuleAccordion from './permit-detail/PermitModuleAccordion';

// ── Clickable Status Badge (shows popover with details on click) ──
function ClickableStatus({ label, value, threshold, pct, unit, pollutant }) {
  const [show, setShow] = useState(false);
  const color = pct >= 100 ? 'text-destructive bg-red-900/20 border-red-700/40' :
    pct >= 80 ? 'text-destructive bg-amber-900/20 border-amber-700/40' :
    pct >= 50 ? 'text-yellow-400 bg-yellow-900/20 border-yellow-700/40' :
    'text-primary bg-green-900/20 border-green-700/40';
  const labelText = pct >= 100 ? 'Major Source' : pct >= 80 ? 'Near Threshold' : pct >= 50 ? 'Synthetic Minor Viable' : 'Below Minor';

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShow(!show)}
        onBlur={() => setTimeout(() => setShow(false), 200)}
        className={`text-xs px-2 py-0.5 border cursor-pointer hover:opacity-80 transition-all ${color}`}
      >
        {labelText}
      </button>
      {show && (
        <div className="absolute z-30 top-full mt-1.5 left-1/2 -translate-x-1/2 w-56 bg-muted border border-border p-3 shadow-black/50">
          <div className="text-xs font-semibold text-foreground/80 mb-2">{label || pollutant} — Status Details</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Value:</span><span className="text-foreground/80 font-mono">{value?.toFixed(1)} {unit || 'tpy'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Threshold:</span><span className="text-foreground/80 font-mono">{threshold?.toLocaleString()} {unit || 'tpy'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">% of Threshold:</span><span className={`font-mono ${pct >= 100 ? 'text-destructive' : pct >= 80 ? 'text-destructive' : 'text-primary'}`}>{pct.toFixed(0)}%</span></div>
            <div className="bg-muted/80 h-1.5 mt-1">
              <div className={`h-1.5 ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          </div>
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-muted border-t border-l border-border rotate-45" />
        </div>
      )}
    </div>
  );
}

// ── Clickable Pathway Badge ──
function PathwayBadge({ label, status, detail }) {
  const [showTip, setShowTip] = useState(false);
  const colorMap = {
    warning: 'bg-destructive/10 border-red-700/40 text-destructive',
    ok: 'bg-primary/10 border-green-700/40 text-primary',
    neutral: 'bg-muted border-border text-muted-foreground',
  };
  const IconMap = {
    warning: XCircle,
    ok: CheckCircle,
    neutral: WarningCircle,
  };
  const Icon = IconMap[status] || WarningCircle;
  return (
    <div className="relative">
      <button
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        onClick={() => setShowTip(!showTip)}
        className={`text-xs px-2.5 py-1 border transition-colors ${colorMap[status] || colorMap.neutral} cursor-pointer hover:opacity-80 inline-flex items-center gap-1.5`}
      >
        <Icon weight="fill" size={12} />
        {label}
      </button>
      {showTip && (
        <div className="absolute z-20 top-full mt-1.5 right-0 w-64 bg-muted border border-border p-3 shadow-black/40">
          <div className="text-xs text-foreground/80 leading-relaxed">{detail}</div>
          <div className="absolute -top-1.5 right-4 w-3 h-3 bg-muted border-t border-l border-border rotate-45" />
        </div>
      )}
    </div>
  );
}

const SEVERITY_COLORS = {
  critical: { border: 'border-red-700/40', bg: 'bg-red-950/20', badge: 'bg-red-900/40 text-destructive', text: 'text-destructive' },
  high: { border: 'border-red-700/30', bg: 'bg-red-950/15', badge: 'bg-destructive/10 text-destructive', text: 'text-destructive' },
  medium: { border: 'border-amber-700/30', bg: 'bg-amber-950/15', badge: 'bg-amber-900/30 text-destructive', text: 'text-amber-300' },
  low: { border: 'border-yellow-700/30', bg: 'bg-yellow-950/15', badge: 'bg-yellow-900/30 text-yellow-400', text: 'text-yellow-300' },
  info: { border: 'border-primary/30', bg: 'bg-primary/8', badge: 'bg-primary/20 text-primary', text: 'text-primary' },
  positive: { border: 'border-green-700/30', bg: 'bg-green-950/15', badge: 'bg-primary/10 text-primary', text: 'text-primary' },
};

function BreachCard({ breach, setActiveTab }) {
  const [open, setOpen] = useState(false);
  const colors = SEVERITY_COLORS[breach.severity] || SEVERITY_COLORS.info;
  const isBreached = breach.status === 'BREACHED';
  const isMitigated = breach.status === 'MITIGATED';
  const StatusIcon = isBreached ? XCircle : isMitigated ? WarningCircle : CheckCircle;

  return (
    <div className={`border ${colors.border} ${colors.bg} overflow-hidden`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-black/10 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <StatusIcon
            weight="fill"
            size={20}
            className={`flex-shrink-0 ${isBreached ? 'text-destructive' : isMitigated ? 'text-destructive' : 'text-primary'}`}
          />
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-x-2">
              <span className="text-sm font-semibold text-white">{breach.pollutant}</span>
              <span className={`text-xs px-1.5 py-0.5 ${colors.badge}`}>{breach.thresholdType}</span>
              <span className={`text-xs font-semibold ${
                isBreached ? 'text-destructive' : isMitigated ? 'text-destructive' : 'text-primary'
              }`}>{breach.status}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{breach.description}</p>
          </div>
        </div>
        <div className="flex-shrink-0 mt-1">
          <svg className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-3">
          <div className="bg-card/60 p-3">
            <div className="text-xs font-semibold text-muted-foreground mb-1">Why This Matters</div>
            <p className="text-xs text-foreground/80 leading-relaxed">{breach.description}</p>
          </div>

          {(breach.baseline > 0 || breach.controlled > 0) && breach.threshold > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">Emissions vs. Threshold</div>
              <div className="space-y-1.5">
                {[
                  { label: 'Baseline PTE', value: breach.baseline, color: 'bg-red-500' },
                  { label: 'Brick-Controlled', value: breach.controlled, color: 'bg-primary' },
                  { label: 'Threshold', value: breach.threshold, color: 'bg-muted-foreground/20', dashed: true },
                ].map(item => {
                  const pct = Math.min(100, (item.value / breach.threshold) * 100);
                  return (
                    <div key={item.label} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground w-28 flex-shrink-0">{item.label}</span>
                      <div className="flex-1 bg-muted/60 h-2">
                        <div className={`h-2 ${item.color} ${item.dashed ? 'opacity-50' : ''}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-muted-foreground w-20 text-right font-mono">{item.value.toFixed(1)} {breach.unit}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {breach.margin !== undefined && (
            <div className={`text-xs font-medium ${breach.margin >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {breach.margin >= 0
                ? `+${breach.margin.toFixed(1)} ${breach.unit} margin below threshold — within compliance`
                : `${Math.abs(breach.margin).toFixed(1)} ${breach.unit} over threshold — corrective action needed`}
            </div>
          )}

          {breach.remediationSteps && breach.remediationSteps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1 bg-gradient-to-r from-primary/40 to-transparent" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Remediation Plan</span>
                <div className="h-px flex-1 bg-gradient-to-l from-primary/40 to-transparent" />
              </div>
              <div className="space-y-3">
                {breach.remediationSteps.map((step) => (
                  <div key={step.stepNumber} className="bg-card/60 border border-border/30 overflow-hidden">
                    <div className="bg-muted/60 px-3 py-2 flex items-center gap-2">
                      <span className="w-5 h-5 bg-primary/40 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {step.stepNumber}
                      </span>
                      <span className="text-sm font-semibold text-foreground">{step.title}</span>
                    </div>
                    <div className="p-3 space-y-2">
                      <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>

                      {step.techOptions && step.techOptions.length > 0 && (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Technology</TableHead>
                                <TableHead>Reduction</TableHead>
                                <TableHead>Timeline</TableHead>
                                <TableHead>Cost</TableHead>
                                <TableHead>Complexity</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {step.techOptions.map((opt, oi) => (
                                <TableRow key={oi}>
                                  <TableCell className="font-medium text-foreground/80">{opt.name}</TableCell>
                                  <TableCell className="text-primary">{opt.reduction}</TableCell>
                                  <TableCell className="text-muted-foreground">{opt.timeline}</TableCell>
                                  <TableCell className="text-muted-foreground">{opt.cost}</TableCell>
                                  <TableCell>
                                    <span className={`text-xs px-1.5 py-0.5 ${
                                      opt.complexity === 'low' ? 'bg-primary/10 text-primary' :
                                      opt.complexity === 'medium' ? 'bg-amber-900/30 text-destructive' :
                                      'bg-destructive/10 text-destructive'
                                    }`}>{opt.complexity}</span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {step.tabLinks && step.tabLinks.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          <span className="text-xs text-muted-foreground/70 mr-1 self-center">Execute in:</span>
                          {step.tabLinks.map(link => (
                            <button
                              key={link.tab}
                              onClick={(e) => { e.stopPropagation(); setActiveTab && setActiveTab(link.tab); }}
                              className="text-xs bg-primary/20 hover:bg-primary/40 text-primary border border-primary/40 px-2 py-0.5 transition-colors"
                            >
                              {link.tab}: {link.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {breach.brickControl && !breach.remediationSteps && (
            <div className="bg-primary/10 border border-primary/30 p-3">
              <div className="text-xs font-semibold text-primary mb-1">Brick Control Applied</div>
              <p className="text-xs text-foreground/80 leading-relaxed">{breach.brickControl}</p>
            </div>
          )}

          {breach.additionalControls && !breach.remediationSteps && (
            <div className="bg-amber-950/20 border border-amber-800/30 p-3">
              <div className="text-xs font-semibold text-destructive mb-1">Additional Controls Required</div>
              <p className="text-xs text-foreground/80 leading-relaxed">{breach.additionalControls}</p>
            </div>
          )}

          <div className="text-xs text-muted-foreground/70">
            Regulation: <span className="text-muted-foreground font-mono">{breach.regulation}</span>
          </div>

          {breach.tabLinks && breach.tabLinks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-xs text-muted-foreground mr-1 self-center">All related tabs:</span>
              {breach.tabLinks.map(link => (
                <button
                  key={link.tab}
                  onClick={(e) => { e.stopPropagation(); setActiveTab && setActiveTab(link.tab); }}
                  className="text-xs bg-muted hover:bg-muted-foreground/10 text-muted-foreground hover:text-foreground px-2.5 py-1 transition-colors border border-border/40"
                >
                  <ArrowRight weight="bold" size={10} className="inline mr-0.5" />
                  {link.tab}: {link.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AirPermitAI({ results, inputs, setActiveTab }) {
  const c = PERMIT_COLORS.air;

  if (!results) {
    return (
      <div className="p-6 text-center py-20">
        <Wind weight="duotone" size={48} className="mx-auto text-muted-foreground mb-4" />
        <h3 className="text-muted-foreground font-medium mb-2">No Site Data Yet</h3>
        <p className="text-muted-foreground/70 text-sm mb-4">Go to Site Intake and run the permit screening first.</p>
        <Button variant="default" onClick={() => setActiveTab && setActiveTab('intake')}>
          Open Site Intake
        </Button>
      </div>
    );
  }

  const { baseline, controlled, avoided, pathway, totalMW, annualMMBtu, thresholdAnalysis, breaches } = results;
  const attainment = STATES_ATTAINMENT[inputs.state] || '';
  const isNonAttain = attainment.includes('Nonattainment') || inputs.nonAttainment;

  const pollutants = [
    { key: 'nox', label: 'NOx', threshold: THRESHOLDS.nox.psd },
    { key: 'co', label: 'CO', threshold: THRESHOLDS.co.psd },
    { key: 'so2', label: 'SO₂', threshold: THRESHOLDS.so2.psd },
    { key: 'pm25', label: 'PM₂.₅', threshold: THRESHOLDS.pm25.psd },
    { key: 'voc', label: 'VOC', threshold: THRESHOLDS.voc.psd },
    { key: 'hap', label: 'HAP', threshold: THRESHOLDS.hap.combined },
    { key: 'co2e', label: 'CO₂e', threshold: THRESHOLDS.co2e.ghgrp },
  ];

  const breachedItems = breaches?.filter(b => b.status === 'BREACHED') || [];
  const mitigatedItems = breaches?.filter(b => b.status === 'MITIGATED') || [];
  const noticeItems = breaches?.filter(b => b.status === 'NOTICE') || [];

  const bannerBadges = [
    { label: pathway.requiresPSD ? 'PSD Major Source' : 'Below PSD Threshold', status: pathway.requiresPSD ? 'warning' : 'ok', detail: pathway.requiresPSD ? `One or more criteria pollutants ≥100 tpy` : 'All criteria pollutants below 100 tpy PSD threshold' },
    { label: pathway.requiresTitleV ? 'Title V Required' : 'Below Title V', status: pathway.requiresTitleV ? 'warning' : 'ok', detail: pathway.requiresTitleV ? `Controlled emissions ≥100 tpy triggers Title V` : 'All controlled emissions below 100 tpy Title V threshold' },
    { label: pathway.syntheticMinorViable ? 'Synthetic Minor Viable' : 'Synthetic Minor Not Viable', status: pathway.syntheticMinorViable ? 'ok' : 'warning', detail: pathway.syntheticMinorViable ? 'Brick controls reduce all pollutants below 100 tpy' : 'At least one pollutant cannot be reduced below major source thresholds' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Banner */}
      <PermitBanner
        type="air"
        title={`${inputs.siteName} — Air Permit Analysis`}
        subtitle={`${inputs.state} · ${totalMW} MW installed · ${inputs.turbines} turbines · ${inputs.hours.toLocaleString()} hr/yr`}
        badges={bannerBadges.map(b => (
          <PathwayBadge key={b.label} {...b} />
        ))}
      />

      {/* ─── BREACH ANALYSIS PANEL ─── */}
      {breaches && breaches.length > 0 && (
        <Card className={`${c.border} ${c.bg}`}>
          <CardContent className="pt-6 pb-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground/80">Threshold Breach Analysis & Remediation</h3>
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-0.5 bg-destructive/10 text-destructive">{breachedItems.length} Breached</span>
                <span className="px-2 py-0.5 bg-amber-900/30 text-destructive">{mitigatedItems.length} Mitigated</span>
                <span className="px-2 py-0.5 bg-primary/20 text-primary">{noticeItems.length} Notices</span>
              </div>
            </div>
            <div className="space-y-3">
              {breaches.map(b => (
                <BreachCard key={b.id} breach={b} setActiveTab={setActiveTab} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(!breaches || breaches.length === 0) && thresholdAnalysis && (
        <Card className="border-green-700/30 bg-green-950/20">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle weight="fill" size={20} className="text-primary" />
              <h3 className="text-base font-semibold text-primary">All Thresholds Clear</h3>
            </div>
            <p className="text-xs text-muted-foreground">All pollutant emissions are below applicable PSD, Title V, and regulatory thresholds. No breaches detected.</p>
          </CardContent>
        </Card>
      )}

      {/* ─── PER-POLLUTANT MAJOR SOURCE DETERMINATION ─── */}
      {thresholdAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Per-Pollutant Major Source Determination
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pollutant</TableHead>
                  <TableHead className="text-right">Baseline (tpy)</TableHead>
                  <TableHead className="text-right">Controlled (tpy)</TableHead>
                  <TableHead className="text-right">PSD Threshold</TableHead>
                  <TableHead className="text-center">PSD Major?</TableHead>
                  {isNonAttain && <TableHead className="text-center">Nonattain?</TableHead>}
                  <TableHead className="text-center">Title V?</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {['nox', 'co', 'so2', 'pm25', 'voc', 'hap', 'co2e'].map((key, i) => {
                  const t = thresholdAnalysis[key];
                  if (!t) return null;
                  return (
                    <TableRow key={key}>
                      <TableCell className="font-semibold text-foreground/80">{THRESHOLDS[key]?.label || key}</TableCell>
                      <TableCell className="text-right text-muted-foreground font-mono">{t.baseline?.toFixed(1)}</TableCell>
                      <TableCell className="text-right text-white font-mono font-semibold">{t.controlled?.toFixed(1)}</TableCell>
                      <TableCell className="text-right text-muted-foreground font-mono">{t.controllingThreshold || t.psdThreshold || t.ghgrpThreshold || '-'}</TableCell>
                      <TableCell className="text-center">
                        {t.majorSourceStatus === 'BREACHED' ? <XCircle weight="fill" size={16} className="inline text-destructive" /> :
                         t.majorSourceStatus === 'MITIGATED' ? <WarningCircle weight="fill" size={16} className="inline text-destructive" /> :
                         <CheckCircle weight="fill" size={16} className="inline text-primary" />}
                      </TableCell>
                      {isNonAttain && (
                        <TableCell className="text-center">
                          {t.nonattainStatus === 'BREACHED' ? <XCircle weight="fill" size={16} className="inline text-destructive" /> :
                           t.nonattainStatus === 'MITIGATED' ? <WarningCircle weight="fill" size={16} className="inline text-destructive" /> :
                           <CheckCircle weight="fill" size={16} className="inline text-primary" />}
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        {t.isTitleV ? <XCircle weight="fill" size={16} className="inline text-destructive" /> : <CheckCircle weight="fill" size={16} className="inline text-primary" />}
                      </TableCell>
                      <TableCell className={`text-right font-mono ${(t.margin || t.margin === 0) && t.margin >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {t.margin !== undefined ? `${t.margin >= 0 ? '+' : ''}${t.margin.toFixed(1)}` : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground/70">
              <span><XCircle weight="fill" size={12} className="inline text-destructive mr-0.5" /> = Breached — requires action</span>
              <span><WarningCircle weight="fill" size={12} className="inline text-destructive mr-0.5" /> = Mitigated by Brick controls</span>
              <span><CheckCircle weight="fill" size={12} className="inline text-primary mr-0.5" /> = Clear — within threshold</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── REMEDIATION MATRIX ─── */}
      {breaches && breachedItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Remediation Action Matrix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Breach</TableHead>
                  <TableHead>Applied Brick Control</TableHead>
                  <TableHead>Additional Measures Needed</TableHead>
                  <TableHead className="text-center">Severity</TableHead>
                  <TableHead className="text-center">Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {breaches.map((b, i) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <span className="font-semibold text-foreground/80">{b.pollutant}</span>
                      <div className="text-muted-foreground/70 text-xs">{b.thresholdType}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px]">{b.brickControl}</TableCell>
                    <TableCell className="text-amber-300 max-w-[200px]">{b.additionalControls || 'N/A — mitigated by Brick controls'}</TableCell>
                    <TableCell className="text-center">
                      <span className={`px-2 py-0.5 text-xs ${
                        b.severity === 'critical' ? 'bg-red-900/40 text-destructive' :
                        b.severity === 'high' ? 'bg-destructive/10 text-destructive' :
                        b.severity === 'medium' ? 'bg-amber-900/30 text-destructive' :
                        'bg-primary/20 text-primary'
                      }`}>{b.severity}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {b.tabLinks && b.tabLinks.length > 0 && (
                        <button
                          onClick={() => setActiveTab && setActiveTab(b.tabLinks[0].tab)}
                          className="text-primary hover:text-primary underline text-xs"
                        >
                          {b.tabLinks[0].label}
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* PTE comparison grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Potential to Emit (PTE) — Baseline vs. Brick-Controlled
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pollutant</TableHead>
                <TableHead className="text-right">Baseline PTE (tpy)</TableHead>
                <TableHead className="text-right">Brick-Controlled (tpy)</TableHead>
                <TableHead className="text-right">Avoided (tpy)</TableHead>
                <TableHead className="text-right">Regulatory Threshold</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pollutants.map((p, i) => {
                const base = baseline[p.key];
                const ctrl = controlled[p.key];
                const avd = base - ctrl;
                const threshold = (p.key === 'co2e') ? THRESHOLDS.co2e.ghgrp : p.threshold;
                const pct = threshold ? (ctrl / threshold * 100) : 0;
                const status = pct >= 100 ? { label: 'Breached', cls: 'text-destructive bg-red-900/20' } :
                  pct >= 80 ? { label: 'Near Threshold', cls: 'text-destructive bg-amber-900/20' } :
                  pct >= 50 ? { label: 'Synthetic Minor Viable', cls: 'text-yellow-400 bg-yellow-900/20' } :
                  { label: 'Below Minor', cls: 'text-primary bg-green-900/20' };
                return (
                  <TableRow key={p.key}>
                    <TableCell className="font-semibold text-foreground/80">{p.label}</TableCell>
                    <TableCell className="text-right text-muted-foreground font-mono">{base?.toFixed(1)}</TableCell>
                    <TableCell className="text-right text-white font-mono font-semibold">{ctrl?.toFixed(1)}</TableCell>
                    <TableCell className="text-right text-primary font-mono">-{avd?.toFixed(1)}</TableCell>
                    <TableCell className="text-right text-muted-foreground/70 font-mono">{threshold?.toLocaleString()}</TableCell>
                    <TableCell>
                      <ClickableStatus label={p.label} value={ctrl} threshold={threshold} pct={pct} unit="tpy" pollutant={p.key} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground/70 mt-2">* CO2e threshold shown is GHGRP reporting threshold (25,000 tpy). PSD GHG threshold is 75,000 tpy.</p>
        </CardContent>
      </Card>

      {/* Permit Pathway + Modules */}
      <div className="grid md:grid-cols-2 gap-4">
        <PathwayDeterminationCard
          type="air"
          accentColor={c.accent}
          title="Permit Pathway Determination"
          items={[
            {
              label: 'NSR/PSD Applicability',
              status: pathway.requiresPSD ? 'PSD Required (>=100 tpy any criteria pollutant)' : 'Below PSD threshold',
              ok: !pathway.requiresPSD,
              detail: 'CAA ss 165 / 40 CFR Parts 51/52. PSD applies to new major sources in attainment areas. If PSD applies, full BACT analysis, air quality modeling (AERMOD), Class I area review, and public participation are required.',
              breach: breachedItems.find(b => b.thresholdType === 'PSD Major Source'),
              regText: '40 CFR ss 52.21 / CAA ss 165',
            },
            {
              label: 'Nonattainment NSR',
              status: isNonAttain ? 'Nonattainment NSR may apply - see breach analysis' : 'Not triggered (attainment area)',
              ok: !isNonAttain,
              detail: 'CAA ss 173. If county is nonattainment, NSR/LAER offsets required at 25 tpy threshold. Offsets ratio of at least 1.3:1 required for severe nonattainment areas.',
              breach: breachedItems.find(b => b.thresholdType === 'Nonattainment NSR'),
              regText: '40 CFR ss 51.165 / CAA ss 173',
            },
            {
              label: 'Title V Operating Permit',
              status: pathway.requiresTitleV ? 'Title V Required (aggregate major source)' : 'Below Title V thresholds',
              ok: !pathway.requiresTitleV,
              detail: '40 CFR Part 70/71. Required if PTE >= 100 tpy for any regulated air pollutant. Title V permit includes compliance certification, monitoring schedules, and annual fee program.',
              regText: '40 CFR Part 70/71',
            },
            {
              label: 'Synthetic Minor Pathway',
              status: pathway.syntheticMinorViable ? ('Viable - Brick controls reduce PTE to ' + controlled.nox?.toFixed(1) + ' tpy NOx') : 'Not viable - see breaches above',
              ok: pathway.syntheticMinorViable,
              detail: 'Enforceable operational limits (runtime caps, fuel use limits, dispatch optimization) can reduce PTE below major source thresholds, avoiding PSD. Requires state-issued synthetic minor permit with federally enforceable conditions.',
              breach: breachedItems.find(b => b.id === 'synthetic_minor_viability'),
            },
            {
              label: 'NSPS - 40 CFR Part 60 Subpart KKKK/KKKKa',
              status: 'Applicable - Stationary combustion turbines',
              ok: false,
              detail: 'New/modified turbines >=1 MW: NOx limit ' + THRESHOLDS.nox.nspsLimit + ' ppmvd, CO limit ' + THRESHOLDS.co.nspsLimit + ' ppmvd @ 15% O2. Initial performance stack test within 180 days of startup + ongoing compliance.',
              regText: '40 CFR Part 60 Subparts KKKK/KKKKa',
            },
            {
              label: 'NESHAP - 40 CFR Part 63 Subpart YYYY',
              status: baseline.hap >= THRESHOLDS.hap.combined ? 'Major HAP source - Subpart YYYY applies' :
                      baseline.hap >= THRESHOLDS.hap.single ? 'Near major HAP - confirm applicability' : 'Area source - confirm',
              ok: baseline.hap < THRESHOLDS.hap.single,
              detail: 'Applies at major HAP sources (>=10 tpy single HAP or >=25 tpy combined HAP). MACT standards for gas turbines. If area source, still subject to GCP standards.',
              regText: '40 CFR Part 63 Subparts YYYY/ZZZZ',
            },
            {
              label: 'Engine NSPS/NESHAP (Subparts IIII/JJJJ/ZZZZ)',
              status: inputs.gensetCount + ' backup gensets at ' + inputs.gensetHours + ' hr/yr - ' + (inputs.gensetHours <= 100 ? 'within emergency limit' : 'EXCEEDS 100 hr/yr limit'),
              ok: inputs.gensetHours <= 100,
              detail: '40 CFR Parts 60 IIII/JJJJ and 63 ZZZZ. Emergency engines limited to 100 hr/yr maintenance + emergency. Non-resettable hour meters required. Tier 4 compliant engines for new installations.',
              regText: '40 CFR 60 IIII/JJJJ, 63 ZZZZ',
            },
            {
              label: 'GHG / GHGRP (40 CFR Part 98)',
              status: baseline.co2e >= THRESHOLDS.co2e.ghgrp ? 'GHGRP Required (>=25,000 tpy CO2e)' : 'Below GHGRP threshold (25,000 tpy)',
              ok: baseline.co2e < THRESHOLDS.co2e.ghgrp,
              detail: 'Annual GHG report to EPA eGGRT required if >=25,000 tpy CO2e. Subpart C (stationary combustion) + Subpart W (fugitives). Third-party verification required for >25,000 tpy.',
              regText: '40 CFR Part 98 Subparts C/W',
            },
          ]}
        />

        <PermitModuleAccordion
          type="air"
          title="Air Permit Modules — Deliverables"
          modules={AIR_MODULES}
          accentColor={c.accent}
        />
      </div>

      {/* BACT Strategies */}
      <Card>
        <CardHeader>
          <CardTitle className={`${c.accent} text-xs font-semibold uppercase tracking-wider`}>
            BACT Strategy — AI Recommendation (Top-Down Analysis)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 text-xs">
            {[
              {
                tech: 'Dry Low NOx (DLN) Combustion',
                type: 'Combustion Controls',
                nox: '≤9–15 ppmvd @ 15% O₂',
                status: 'Step 1 — Available',
                color: 'border-green-700/40 bg-green-950/20',
              },
              {
                tech: 'Selective Catalytic Reduction (SCR)',
                type: 'Post-Combustion',
                nox: '≤2–5 ppmvd @ 15% O₂',
                status: 'Step 2 — Evaluate for breaches',
                color: 'border-amber-700/40 bg-amber-950/20',
              },
              {
                tech: 'Oxidation Catalyst (CO/VOC)',
                type: 'Post-Combustion',
                nox: 'CO reduction 90%+',
                status: 'Step 2 — Often Required',
                color: 'border-blue-700/40 bg-blue-950/20',
              },
              {
                tech: 'Operational Limits (Brick Controls)',
                type: 'Dispatch Optimization',
                nox: 'Runtime cap + load optimization',
                status: 'Step 3 — Enforceable Limit',
                color: 'border-primary/40 bg-primary/10',
              },
              {
                tech: 'Fuel Switching / Natural Gas Only',
                type: 'Fuel Control',
                nox: 'Pipeline-quality gas eliminates SO₂/PM',
                status: 'Typically Required',
                color: 'border-primary/40 bg-primary/10',
              },
              {
                tech: 'Good Combustion Practices (GCP)',
                type: 'O&M Controls',
                nox: 'Air/fuel ratio, maintenance tuning',
                status: 'Standard Requirement',
                color: 'border-border/40 bg-card/40',
              },
            ].map(t => (
              <div key={t.tech} className={`border p-4 ${t.color}`}>
                <div className="font-semibold text-foreground/80 mb-1">{t.tech}</div>
                <div className="text-muted-foreground">{t.type}</div>
                <div className="text-muted-foreground mt-2">{t.nox}</div>
                <div className="mt-2 text-primary font-medium">{t.status}</div>
              </div>
            ))}
          </div>
          {breachedItems.length > 0 && (
            <div className="mt-4 p-3 bg-red-950/20 border border-red-800/30">
              <p className="text-xs text-destructive">
                <span className="font-semibold">Breach-driven recommendation:</span>{' '}
                {breachedItems.some(b => b.pollutant === 'NOx')
                  ? 'SCR installation (≥90% reduction) recommended for NOx breach — Step 2 BACT evaluation required. DLN currently in place; post-combustion control needed for compliance margin.'
                  : breachedItems.some(b => b.pollutant === 'CO')
                    ? 'Oxidation catalyst recommended for CO breach.'
                    : 'Review breaches above for pollutant-specific BACT recommendations.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}