import React, { useState } from 'react';

const tools = [
  {
    icon: '🔍',
    name: 'Regulatory Applicability Agent',
    desc: 'Reads state, county, fuel type, turbine type, water source, discharge pathway, and tank inventory — generates full air + water permit pathways across PSD, NSR, Title V, NPDES, SPCC, 316(b), and NEPA in minutes.',
    vs: 'Static consultant memo takes 3–5 weeks; AI delivers in under 1 hour.',
    color: 'border-blue-700/40 bg-blue-950/20',
  },
  {
    icon: '⚗️',
    name: 'PTE + Controlled PTE Engine',
    desc: 'Calculates baseline PTE by pollutant, controlled PTE with Brick dispatch limits, synthetic-minor strategies, runtime caps, and emissions impact of cooling and battery optimizations.',
    vs: 'Manual spreadsheets are static and disconnected from actual dispatch and cooling controls.',
    color: 'border-violet-700/40 bg-violet-950/20',
  },
  {
    icon: '📄',
    name: 'CFR Document Factory',
    desc: 'Generates site-specific draft packages for Subpart KKKK/KKKKa, YYYY, IIII/JJJJ/ZZZZ, NPDES, SWPPP, SPCC, and 316(b) — fully populated from site equipment and telemetry, not from precedent templates.',
    vs: 'Consultant drafts from boilerplate; this builds from actual equipment specs.',
    color: 'border-green-700/40 bg-green-950/20',
  },
  {
    icon: '🌐',
    name: 'Digital Twin Simulator',
    desc: 'Runs hourly power load, cooling load, chiller/tower/pump setpoints, turbine dispatch, battery dispatch, water use, blowdown, and emissions — all linked to permit compliance envelopes.',
    vs: 'Most permit packages are static and conservative — this is live and defensible.',
    color: 'border-amber-700/40 bg-amber-950/20',
  },
  {
    icon: '🤖',
    name: 'Regulator QA Copilot',
    desc: 'Builds responses to agency deficiency letters, RAI questions, public comments, environmental justice questions, and AERMOD modeling comments — from a structured, indexed permit record.',
    vs: 'Traditional response is ad hoc and slow; this is structured and query-driven.',
    color: 'border-orange-700/40 bg-orange-950/20',
  },
  {
    icon: '🛡',
    name: 'Continuous Compliance OS',
    desc: 'Converts every permit condition into live controls, alarms, reports, and audit logs. Turbine runtime trackers, NOx budget forecasts, cooling blowdown limits, stormwater BMP inspection workflows.',
    vs: 'Traditional consultants stop at permit issuance; Brick operates the site post-COD.',
    color: 'border-red-700/40 bg-red-950/20',
  },
  {
    icon: '📚',
    name: 'Regulatory Knowledge Hub',
    desc: 'Search EPA guidance, consultant best practices, RBLC precedents, and state-specific regulatory intelligence across 5 knowledge categories. Cite authoritative sources directly in permit applications.',
    vs: 'Static regulatory databases with no intelligence or relevance scoring.',
    color: 'border-teal-700/40 bg-teal-950/20',
  },
];

const metrics = [
  { label: 'Permit Types Covered', value: '20+', sub: 'Air, Water, Env.' },
  { label: 'CFR Sections Mapped', value: '40+', sub: 'Federal citations' },
  { label: 'AI Time Reduction', value: '70%', sub: 'vs. manual baseline' },
  { label: 'Document Generation', value: '100%', sub: 'Draft packages for PE review' },
  { label: 'States Supported', value: '50', sub: 'All US markets' },
  { label: 'Post-Permit Control', value: 'Live', sub: 'Digital twin OS' },
];

const COMPETITOR_COMPARE = [
  {
    feature: 'Air permit applicability screening',
    brick: { value: '< 1 hour', color: 'text-primary' },
    traditional: { value: '3–5 weeks', color: 'text-destructive' },
    scout: { value: 'Days–weeks', color: 'text-destructive' },
  },
  {
    feature: 'PTE workbook generation',
    brick: { value: 'Instant (AI)', color: 'text-primary' },
    traditional: { value: '2–4 weeks', color: 'text-destructive' },
    scout: { value: 'Semi-automated', color: 'text-destructive' },
  },
  {
    feature: 'BACT analysis draft',
    brick: { value: '1–2 days (AI)', color: 'text-primary' },
    traditional: { value: '4–8 weeks', color: 'text-destructive' },
    scout: { value: 'Not included', color: 'text-muted-foreground/70' },
  },
  {
    feature: 'AERMOD input file builder',
    brick: { value: 'Auto-generated', color: 'text-primary' },
    traditional: { value: '4–6 weeks', color: 'text-destructive' },
    scout: { value: 'Not included', color: 'text-muted-foreground/70' },
  },
  {
    feature: 'Water permits (NPDES/SPCC/316b)',
    brick: { value: 'Full AI package', color: 'text-primary' },
    traditional: { value: '6–10 weeks', color: 'text-destructive' },
    scout: { value: 'Partial', color: 'text-destructive' },
  },
  {
    feature: 'Assisted document generation',
    brick: { value: '26 documents ready', color: 'text-primary' },
    traditional: { value: 'Manual assembly', color: 'text-destructive' },
    scout: { value: 'Partial', color: 'text-destructive' },
  },
  {
    feature: 'Post-permit compliance OS',
    brick: { value: 'Live controls + logs', color: 'text-primary' },
    traditional: { value: 'Not included', color: 'text-muted-foreground/70' },
    scout: { value: 'Dashboard only', color: 'text-destructive' },
  },
  {
    feature: 'Permit-linked digital twin',
    brick: { value: 'Hour-by-hour sim', color: 'text-primary' },
    traditional: { value: 'Not included', color: 'text-muted-foreground/70' },
    scout: { value: 'Not included', color: 'text-muted-foreground/70' },
  },
  {
    feature: 'RAI / deficiency response',
    brick: { value: '< 24 hrs (AI)', color: 'text-primary' },
    traditional: { value: '3–6 weeks', color: 'text-destructive' },
    scout: { value: 'Not included', color: 'text-muted-foreground/70' },
  },
  {
    feature: 'Reduces permit risk via controls',
    brick: { value: 'Yes — lowers PTE', color: 'text-primary' },
    traditional: { value: 'No', color: 'text-muted-foreground/70' },
    scout: { value: 'No', color: 'text-muted-foreground/70' },
  },
];

const WORKFLOW_STEPS = [
  { step: '01', icon: '📋', label: 'Site Intake', desc: 'Enter equipment, location, and operational parameters. PermitOS auto-populates regulatory context.', time: '< 10 min', color: 'border-blue-700/40 bg-blue-950/20' },
  { step: '02', icon: '🔍', label: 'Permit Screening', desc: 'Instant applicability matrix: PSD/NSR, Title V, Subpart KKKK, NPDES, SPCC, and 316(b) pathways generated.', time: '< 60 sec', color: 'border-violet-700/40 bg-violet-950/20' },
  { step: '03', icon: '⚗️', label: 'PTE Engine', desc: 'Baseline and Brick-controlled PTE by pollutant. Synthetic minor viability. Permit strategy recommendation.', time: '< 5 min', color: 'border-primary/40 bg-primary/10' },
  { step: '04', icon: '📄', label: 'Document Factory', desc: '26 permit documents prepared from site data. BACT, AERMOD, SWPPP, SPCC — all ready for PE review.', time: '< 1 hr', color: 'border-green-700/40 bg-green-950/20' },
  { step: '05', icon: '⚡', label: 'Digital Twin', desc: 'Hour-by-hour permit compliance simulation. Turbine, cooling, water, emissions all linked to permit limits.', time: 'Real-time', color: 'border-amber-700/40 bg-amber-950/20' },
  { step: '06', icon: '📤', label: 'Package Assembly', desc: 'Submission package indexed, PE-ready, and filable. Agency portal integration ready.', time: '< 1 day', color: 'border-orange-700/40 bg-orange-950/20' },
];

export default function Overview({ setActiveTab }) {
  const [showCompare, setShowCompare] = useState(false);

  return (
    <div className="p-6 space-y-6">
      {/* Hero */}
      <div className=" bg-gradient-to-br from-indigo-950 via-gray-900 to-background border border-primary/40 p-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-primary/30 border border-primary/40  px-3 py-1 text-xs text-primary mb-4">
              <span className="w-1.5 h-1.5  bg-indigo-400 animate-pulse"></span>
              Brick PermitOS — Permitting Intelligence Platform
            </div>
            <h1 className="text-3xl font-bold text-white mb-3 leading-tight">
              Autonomous Data Center<br/>Permitting & Compliance Platform
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The only platform that replaces an entire permitting consulting workflow — from first site data intake to permit issuance and live operational compliance —
              for hyperscale and edge data centers, regardless of region, permit complexity, or site size.
              Fully compliant with all EPA, federal, and state-level requirements.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 min-w-[320px]">
            {metrics.map(m => (
              <div key={m.label} className="bg-card/60 border border-border/40  p-3 text-center">
                <div className="text-2xl font-bold text-primary">{m.value}</div>
                <div className="text-xs text-foreground/80 mt-0.5 font-medium">{m.label}</div>
                <div className="text-xs text-muted-foreground/70">{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Positioning vs Scout */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className=" border border-border/40 bg-card/40 p-5">
          <h3 className="text-sm font-semibold text-foreground/80 mb-3">Why BigWatt Needs This Now</h3>
          <ul className="space-y-2">
            {[
              'Upsized gas AI campuses trigger PSD major source thresholds (≥100 tpy NOx) — full BACT review required',
              'Dispersion modeling (AERMOD) needed to demonstrate NAAQS and PSD increment compliance',
              'Backup gensets (CI/SI engines) trigger separate Subpart IIII/JJJJ and ZZZZ reviews',
              'Water systems require NPDES, SPCC, 316(b), SWPPP, and POTW discharge analysis',
              'Post-permit compliance must be continuously demonstrated — not just at permit issuance',
              'Environmental justice scrutiny is increasing on gas-fired data center sites',
            ].map((item, i) => (
              <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                <span className="text-destructive mt-0.5">⚠</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className=" border border-primary/30 bg-primary/10 p-5">
          <h3 className="text-sm font-semibold text-primary mb-3">Brick's Unfair Advantage Over Consultants</h3>
          <ul className="space-y-2">
            {[
              'Permit packages prepared in hours, not weeks — and linked to actual site telemetry',
              'Controls the site post-permit: turbine dispatch, cooling, battery, and water use all optimized within permit limits',
              'PTE is dynamically reduced by Brick\'s operational controls — creating more defensible, lower-impact filings',
              'One-click submission package ready for filing — reviewable by counsel but not dependent on consultant labor',
              'Regulator QA Copilot responds to agency questions from an indexed permit record, not from scratch',
              'Digital twin proves permit compliance in real-time — the strongest possible enforcement defense',
            ].map((item, i) => (
              <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                <span className="text-primary mt-0.5">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Tool Suite */}
      <div>
        <h2 className="text-sm font-semibold text-foreground/80 mb-4">Full Tool Suite</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map(t => (
            <div key={t.name} className={` border p-5 ${t.color}`}>
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl">{t.icon}</span>
                <h3 className="text-sm font-semibold text-white leading-snug">{t.name}</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">{t.desc}</p>
              <div className="bg-black/20  p-2.5 text-xs text-muted-foreground italic">
                <span className="text-primary not-italic font-medium">vs. traditional: </span>
                {t.vs}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Regulatory Foundation */}
      <div className=" border border-border/40 bg-card/40 p-5">
        <h3 className="text-sm font-semibold text-foreground/80 mb-4">Regulatory Foundation — Federal Citations</h3>
        <div className="grid md:grid-cols-3 gap-4 text-xs">
          <div>
            <p className="text-primary font-semibold mb-2">Clean Air Act / Air Rules</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• CAA § 165 — PSD / NSR Preconstruction</li>
              <li>• 40 CFR Parts 51/52 — PSD Implementation</li>
              <li>• 40 CFR Part 60 Subpart KKKK/KKKKa — Gas Turbines NSPS</li>
              <li>• 40 CFR Part 63 Subpart YYYY — Gas Turbines NESHAP</li>
              <li>• 40 CFR Part 60 Subpart IIII — CI Engines NSPS</li>
              <li>• 40 CFR Part 60 Subpart JJJJ — SI Engines NSPS</li>
              <li>• 40 CFR Part 63 Subpart ZZZZ — RICE NESHAP</li>
              <li>• 40 CFR Part 70 / 71 — Title V Operating Permits</li>
              <li>• 40 CFR Part 98 — GHGRP Subpart C</li>
              <li>• 40 CFR Part 51 App W — AERMOD/Dispersion</li>
            </ul>
          </div>
          <div>
            <p className="text-blue-400 font-semibold mb-2">Clean Water Act / Water Rules</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• CWA § 402 — NPDES Permit Program</li>
              <li>• 40 CFR Parts 122/124/125 — NPDES Rules</li>
              <li>• 40 CFR 122.26 — Stormwater (MSGP/CGP)</li>
              <li>• CWA § 316(b) / 40 CFR Part 125 Subpart J</li>
              <li>• 40 CFR Part 112 — SPCC Rule</li>
              <li>• 40 CFR Part 403 — General Pretreatment</li>
              <li>• CWA § 404/401 — Wetlands / WOTUS</li>
              <li>• Sackett v. EPA (2023) — WOTUS definition</li>
              <li>• CWA § 311 — Oil Spill Prevention</li>
            </ul>
          </div>
          <div>
            <p className="text-primary font-semibold mb-2">Other Regulatory Requirements</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• NEPA (if federal nexus applies)</li>
              <li>• State SEPA/CEQA equivalents</li>
              <li>• 40 CFR Part 261 — RCRA / Hazardous Waste</li>
              <li>• FAA 14 CFR Part 77 — Obstruction Evaluation</li>
              <li>• NFPA 70/72/110 — Electrical / Fire</li>
              <li>• Local zoning / land use approvals</li>
              <li>• Noise ordinances (local / county)</li>
              <li>• Utility interconnection (FERC/ISO/RTO)</li>
              <li>• EJ Executive Orders (EO 14096)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Workflow Steps */}
      <div>
        <h2 className="text-sm font-semibold text-foreground/80 mb-4">How It Works — 6-Step AI Workflow</h2>
        <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3">
          {WORKFLOW_STEPS.map((s, i) => (
            <div key={s.step} className={` border p-4 relative ${s.color}`}>
              {i < WORKFLOW_STEPS.length - 1 && (
                <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-muted-foreground/50 text-lg">→</div>
              )}
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className="text-xs text-muted-foreground font-mono mb-1">STEP {s.step}</div>
              <div className="text-sm font-semibold text-white mb-1">{s.label}</div>
              <div className="text-xs text-muted-foreground leading-relaxed mb-2">{s.desc}</div>
              <div className="text-xs bg-black/20  px-2 py-0.5 inline-block text-primary font-medium">{s.time}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison Table */}
      <div className=" border border-border/40 bg-card/40 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <h3 className="text-sm font-semibold text-foreground/80">Brick PermitOS vs. Traditional Consulting vs. Scout AI</h3>
          <button onClick={() => setShowCompare(!showCompare)}
            className="text-xs text-primary hover:text-primary transition-colors">
            {showCompare ? 'Collapse ▲' : 'Expand ▼'}
          </button>
        </div>
        {showCompare && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/60">
                  <th className="px-4 py-3 text-left text-muted-foreground font-semibold">Feature</th>
                  <th className="px-4 py-3 text-left text-primary font-semibold">Brick PermitOS</th>
                  <th className="px-4 py-3 text-left text-destructive font-semibold">Traditional Consulting (ASG-style)</th>
                  <th className="px-4 py-3 text-left text-destructive font-semibold">Scout AI (Sitetracker)</th>
                </tr>
              </thead>
              <tbody>
                {COMPETITOR_COMPARE.map((row, i) => (
                  <tr key={row.feature} className={`border-t border-border/40 ${i % 2 === 0 ? 'bg-card/20' : ''}`}>
                    <td className="px-4 py-2.5 text-muted-foreground font-medium">{row.feature}</td>
                    <td className={`px-4 py-2.5 font-semibold ${row.brick.color}`}>{row.brick.value}</td>
                    <td className={`px-4 py-2.5 ${row.traditional.color}`}>{row.traditional.value}</td>
                    <td className={`px-4 py-2.5 ${row.scout.color}`}>{row.scout.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!showCompare && (
          <div className="px-5 py-3 flex items-center gap-6 text-xs">
            <span className="text-primary font-semibold">Brick: All 10 capabilities</span>
            <span className="text-destructive">Scout: ~4 of 10</span>
            <span className="text-destructive">Traditional: 0 of 10 (speed/automation)</span>
          </div>
        )}
      </div>

      {/* Start CTA */}
      <div className=" border border-primary/30 bg-gradient-to-r from-indigo-950/60 to-violet-950/40 p-6 text-center">
        <h3 className="text-base font-semibold text-white mb-2">Ready to see it live for your site?</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-lg mx-auto">
          Enter your site parameters and run the full permit screening — air + water permit pathway, PTE, BACT strategy, and 26-document package prepared in under 5 minutes.
        </p>
        {setActiveTab && (
          <button onClick={() => setActiveTab('intake')}
            className="bg-primary hover:bg-primary text-white px-8 py-3  text-sm font-semibold transition-all  ">
            ⚡ Start Permit Screening →
          </button>
        )}
        <div className="flex gap-3 justify-center mt-3">
          {setActiveTab && (
            <button onClick={() => setActiveTab('knowledge')}
              className="bg-teal-700/40 hover:bg-teal-700/60 text-teal-300 px-6 py-2.5  text-xs font-semibold transition-all border border-teal-700/40">
              📚 Explore Knowledge Hub
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

