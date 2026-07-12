// ─── PTE Calculation Engine ───────────────────────────────────────────────────
export function calcPTE(inputs) {
  const {
    turbines, mwPerTurbine, hours, heatRate,
    noxFactor, coFactor, brickSavings,
    gensetCount, gensetHP, gensetHours,
    coolingMGD, blowdownPct, waterMGD
  } = inputs;

  const totalMW = turbines * mwPerTurbine;
  const annualMWh = totalMW * hours;
  const annualMMBtu = annualMWh * heatRate;

  // Emissions in tons per year  (lb/MMBtu × MMBtu/yr ÷ 2000)
  // All emission factors sourced from EPA AP-42 Chapter 3.1 (gas turbines)
  // and Chapter 3.4 (stationary CI engines) — see AIR-004 for full documentation.
  const baseline = {
    nox: annualMMBtu * noxFactor / 2000,
    co: annualMMBtu * coFactor / 2000,
    so2: annualMMBtu * 0.0006 / 2000,
    pm25: annualMMBtu * 0.0076 / 2000,
    voc: annualMMBtu * 0.0021 / 2000,
    co2e: annualMMBtu * 117 / 2000,
    hap: annualMMBtu * 0.00014 / 2000,
  };

  // Genset contributions (IIII/JJJJ/ZZZZ) — AP-42 Table 3.4-1, CI 4-stroke diesel
  const gensetMMBtu = gensetCount * gensetHP * 0.00354 * gensetHours; // ~0.00354 MMBtu/hp-hr
  const gensetEfs = {
    nox: 0.031,   // AP-42 Table 3.4-1, uncontrolled CI 4-stroke (was 0.024 — corrected +29%)
    co:  0.0091,  // AP-42 Table 3.4-1, uncontrolled (was 0.006 — corrected +52%)
    pm:  0.030,   // AP-42 Table 3.4-1 (was 0.025 — corrected +20%)
    so2: 0.00205, // AP-42 Table 3.4-1, 0.05% S diesel sulfur
    voc: 0.0028,  // AP-42 Table 3.4-1, uncontrolled
    co2e: 121,    // 40 CFR Part 98 Subpart C diesel CO₂ + CH₄ + N₂O at GWP-100
  };
  const gensetNox = gensetMMBtu * gensetEfs.nox / 2000;
  const gensetCO = gensetMMBtu * gensetEfs.co / 2000;
  const gensetPM = gensetMMBtu * gensetEfs.pm / 2000;
  const gensetSo2 = gensetMMBtu * gensetEfs.so2 / 2000;
  const gensetVoc = gensetMMBtu * gensetEfs.voc / 2000;
  const gensetCo2e = gensetMMBtu * gensetEfs.co2e / 2000;
  const gensetHap = gensetMMBtu * 0.00025 / 2000; // diesel HAP (formaldehyde + acrolein)

  // Add genset emissions to facility totals (previous code was missing SO₂, VOC, CO₂e, HAP from gensets)
  const totalBaseline = {
    nox: baseline.nox + gensetNox,
    co: baseline.co + gensetCO,
    so2: baseline.so2 + gensetSo2,
    pm25: baseline.pm25 + gensetPM,
    voc: baseline.voc + gensetVoc,
    co2e: baseline.co2e + gensetCo2e,
    hap: baseline.hap + gensetHap,
  };

  const savingsFactor = 1 - (brickSavings / 100);

  // Genset emissions are independent of turbine dispatch savings.
  const controlled = {
    nox: baseline.nox * savingsFactor + gensetNox,
    co: baseline.co * savingsFactor + gensetCO,
    so2: baseline.so2 * savingsFactor + gensetSo2,
    pm25: baseline.pm25 * savingsFactor + gensetPM,
    voc: baseline.voc * savingsFactor + gensetVoc,
    co2e: baseline.co2e * savingsFactor + gensetCo2e,
    hap: baseline.hap * savingsFactor + gensetHap,
  };

  // PSD Major Source Thresholds (tpy) — attainment area defaults for Stationary Gas Turbines
  const PSD_THRESHOLD = 100; // listed source category per 40 CFR § 52.21(b)(1)(i)(a)

  // Permit pathway determination — check EACH pollutant individually
  const criteriaPollutants = ['nox', 'co', 'so2', 'pm25', 'voc'];
  const requiresPSD = criteriaPollutants.some(p => totalBaseline[p] >= PSD_THRESHOLD);
  // Synthetic minor viable ONLY if every criteria pollutant is individually < 100 tpy
  const isSyntheticMinorViable = criteriaPollutants.every(p => controlled[p] < PSD_THRESHOLD);
  const requiresTitleV = criteriaPollutants.some(p => controlled[p] >= PSD_THRESHOLD);

  const pathway = {
    requiresPSD,
    requiresNSR: false,
    requiresTitleV,
    syntheticMinorViable: isSyntheticMinorViable,
    controlledBelowMajor: isSyntheticMinorViable,
  };

  // Water calcs
  const annualWaterMG = coolingMGD * 365;
  const blowdownMG = annualWaterMG * (blowdownPct / 100);
  const makeupMG = annualWaterMG + blowdownMG;
  // Brick's 20% energy savings translates to proportional water savings
  // via reduced cooling load and optimized cycles of concentration
  const optimizedWater = annualWaterMG * savingsFactor;

  const pteResults = {
    totalMW, annualMWh, annualMMBtu,
    deriveDataCenterMW: (pueVal) => Math.round(totalMW / ((pueVal || 1.35) + 0.15)),
    // For a data center with on-site generation:
    // Total facility power = IT load × PUE + auxiliary loads (~15%)
    // So: totalMW = datacenterMW × (PUE + 0.15)
    // Therefore: datacenterMW = totalMW / (PUE + 0.15)
    baseline: totalBaseline,
    controlled,
    avoided: {
      nox: totalBaseline.nox - controlled.nox,
      co: totalBaseline.co - controlled.co,
      co2e: totalBaseline.co2e - controlled.co2e,
      water: annualWaterMG - optimizedWater,
    },
    pathway,
    water: { annualWaterMG, blowdownMG, makeupMG, optimizedWater },
    genset: { gensetNox, gensetCO, gensetPM, gensetSo2, gensetVoc, gensetCo2e, gensetHap },
  };

  // --- NEW: Attach threshold analysis and breach detection ---
  const thresholdAnalysis = analyzeThresholds(inputs, pteResults);
  const breaches = generateBreachAnalysis(inputs, pteResults, thresholdAnalysis);

  return { ...pteResults, thresholdAnalysis, breaches };
}

// ─── Centralized Threshold Definitions ────────────────────────────────────────
// Per-pollutant regulatory thresholds from 40 CFR Parts 51, 52, 60, 63, 98
export const THRESHOLDS = {
  nox: {
    psd: 100,                 // 40 CFR 52.21(b)(1)(i)(a) — listed source category
    titleV: 100,              // 40 CFR Part 70 — major source threshold
    nspsLimit: 15,            // 40 CFR 60.4320 — ppmvd @ 15% O2 for new turbines
    nspsUnit: 'ppmvd @ 15% O2',
    nonattainModerate: 100,   // 40 CFR 51.165 — Moderate ozone nonattainment
    nonattainSerious: 50,     // 40 CFR 51.165 — Serious ozone nonattainment
    nonattainSevere: 25,      // 40 CFR 51.165 — Severe ozone nonattainment
    label: 'NOx',
    regulation: '40 CFR 52.21 / Part 60 Subpart KKKK',
  },
  co: {
    psd: 100,
    titleV: 100,
    nspsLimit: 20,            // 40 CFR 60.4320 — ppmvd @ 15% O2
    nspsUnit: 'ppmvd @ 15% O2',
    label: 'CO',
    regulation: '40 CFR 52.21 / Part 60 Subpart KKKK',
  },
  so2: {
    psd: 100,
    titleV: 100,
    nonattain: 30,            // 40 CFR 51.166 — SO2 nonattainment
    label: 'SO2',
    regulation: '40 CFR 52.21',
  },
  pm25: {
    psd: 100,
    titleV: 100,
    nonattain: 30,            // 40 CFR 51.166 — PM2.5 nonattainment (direct)
    pmPrecursor: 100,         // 40 CFR 51.166 — PM2.5 precursor threshold
    label: 'PM2.5',
    regulation: '40 CFR 52.21',
  },
  voc: {
    psd: 100,
    titleV: 100,
    nonattainModerate: 100,
    nonattainSerious: 50,
    nonattainSevere: 25,
    label: 'VOC',
    regulation: '40 CFR 52.21',
  },
  hap: {
    single: 10,               // 40 CFR 63.2 — major source single HAP
    combined: 25,             // 40 CFR 63.2 — major source combined HAP
    label: 'HAP',
    regulation: '40 CFR 63 Subpart YYYY',
  },
  co2e: {
    ghgrp: 25000,             // 40 CFR 98.2(a)(2) — GHG reporting threshold
    psd: 75000,               // 40 CFR 52.21 — GHG PSD threshold (75,000 tpy CO2e)
    label: 'CO2e',
    regulation: '40 CFR Part 98 Subpart C / 40 CFR 52.21',
  },
  genset: {
    runtimeLimit: 100,        // 40 CFR 60 Subparts IIII/JJJJ — emergency runtime
    runtimeUnit: 'hr/yr',
    label: 'Emergency Engine',
    regulation: '40 CFR Parts 60/63 IIII/JJJJ/ZZZZ',
  },
};

// ─── Per-Pollutant Threshold Analysis ─────────────────────────────────────────
export function analyzeThresholds(inputs, results) {
  const { baseline, controlled } = results;
  const { nonAttainment, nonAttainNOx, nonAttainPM25, nonAttainOzone } = inputs;

  // Determine nonattainment severity level for ozone precursors (NOx, VOC)
  // Check new per-pollutant fields first, fall back to legacy nonAttainment boolean
  const isNOxNonAttain = nonAttainNOx || nonAttainOzone || nonAttainment;
  const isPM25NonAttain = nonAttainPM25 || nonAttainment;
  const isVOCNonAttain = nonAttainOzone || nonAttainment;

  // Nonattainment severity: use Severe (25 tpy) as default when nonattainment is flagged
  const nonattainThresholdNOx = isNOxNonAttain ? THRESHOLDS.nox.nonattainSevere : null;
  const nonattainThresholdVOC = isVOCNonAttain ? THRESHOLDS.voc.nonattainSevere : null;
  const nonattainThresholdPM25 = isPM25NonAttain ? THRESHOLDS.pm25.nonattain : null;

  // Helper: determine controlling (most restrictive) threshold for PSD
  const getControllingThreshold = (pollutantKey, nonattainVal) => {
    const t = THRESHOLDS[pollutantKey];
    if (!t) return null;
    // In nonattainment, the NSR threshold is lower than PSD 100 tpy
    if (nonattainVal !== null && nonattainVal < t.psd) return nonattainVal;
    return t.psd; // default to PSD threshold
  };

  const analysis = {
    nox: {
      baseline: baseline.nox,
      controlled: controlled.nox,
      psdThreshold: THRESHOLDS.nox.psd,
      titleVThreshold: THRESHOLDS.nox.titleV,
      nspsLimit: THRESHOLDS.nox.nspsLimit,
      nspsUnit: THRESHOLDS.nox.nspsUnit,
      nonattainThreshold: nonattainThresholdNOx,
      controllingThreshold: getControllingThreshold('nox', nonattainThresholdNOx),
      isPSDMajor: baseline.nox >= THRESHOLDS.nox.psd,
      isTitleV: controlled.nox >= THRESHOLDS.nox.titleV,
      isNonattainMajor: nonattainThresholdNOx !== null && baseline.nox >= nonattainThresholdNOx,
      nspsApplicable: true, // all new/modified turbines > 1 MW trigger NSPS KKKK
      regulation: THRESHOLDS.nox.regulation,
      majorSourceStatus: baseline.nox >= THRESHOLDS.nox.psd
        ? (controlled.nox < THRESHOLDS.nox.psd ? 'MITIGATED' : 'BREACHED')
        : 'CLEAR',
      nonattainStatus: nonattainThresholdNOx !== null && baseline.nox >= nonattainThresholdNOx
        ? (controlled.nox < nonattainThresholdNOx ? 'MITIGATED' : 'BREACHED')
        : 'CLEAR',
      margin: THRESHOLDS.nox.psd - controlled.nox,
    },
    co: {
      baseline: baseline.co,
      controlled: controlled.co,
      psdThreshold: THRESHOLDS.co.psd,
      titleVThreshold: THRESHOLDS.co.titleV,
      nspsLimit: THRESHOLDS.co.nspsLimit,
      nspsUnit: THRESHOLDS.co.nspsUnit,
      controllingThreshold: THRESHOLDS.co.psd,
      isPSDMajor: baseline.co >= THRESHOLDS.co.psd,
      isTitleV: controlled.co >= THRESHOLDS.co.titleV,
      nspsApplicable: true,
      regulation: THRESHOLDS.co.regulation,
      majorSourceStatus: baseline.co >= THRESHOLDS.co.psd
        ? (controlled.co < THRESHOLDS.co.psd ? 'MITIGATED' : 'BREACHED')
        : 'CLEAR',
      margin: THRESHOLDS.co.psd - controlled.co,
    },
    so2: {
      baseline: baseline.so2,
      controlled: controlled.so2,
      psdThreshold: THRESHOLDS.so2.psd,
      titleVThreshold: THRESHOLDS.so2.titleV,
      nonattainThreshold: isPM25NonAttain ? THRESHOLDS.so2.nonattain : null,
      controllingThreshold: getControllingThreshold('so2', isPM25NonAttain ? THRESHOLDS.so2.nonattain : null),
      isPSDMajor: baseline.so2 >= THRESHOLDS.so2.psd,
      isTitleV: controlled.so2 >= THRESHOLDS.so2.titleV,
      regulation: THRESHOLDS.so2.regulation,
      majorSourceStatus: baseline.so2 >= THRESHOLDS.so2.psd
        ? (controlled.so2 < THRESHOLDS.so2.psd ? 'MITIGATED' : 'BREACHED')
        : 'CLEAR',
      margin: THRESHOLDS.so2.psd - controlled.so2,
    },
    pm25: {
      baseline: baseline.pm25,
      controlled: controlled.pm25,
      psdThreshold: THRESHOLDS.pm25.psd,
      titleVThreshold: THRESHOLDS.pm25.titleV,
      nonattainThreshold: nonattainThresholdPM25,
      controllingThreshold: getControllingThreshold('pm25', nonattainThresholdPM25),
      isPSDMajor: baseline.pm25 >= THRESHOLDS.pm25.psd,
      isTitleV: controlled.pm25 >= THRESHOLDS.pm25.titleV,
      isNonattainMajor: nonattainThresholdPM25 !== null && baseline.pm25 >= nonattainThresholdPM25,
      regulation: THRESHOLDS.pm25.regulation,
      majorSourceStatus: baseline.pm25 >= THRESHOLDS.pm25.psd
        ? (controlled.pm25 < THRESHOLDS.pm25.psd ? 'MITIGATED' : 'BREACHED')
        : 'CLEAR',
      nonattainStatus: nonattainThresholdPM25 !== null && baseline.pm25 >= nonattainThresholdPM25
        ? (controlled.pm25 < nonattainThresholdPM25 ? 'MITIGATED' : 'BREACHED')
        : 'CLEAR',
      margin: THRESHOLDS.pm25.psd - controlled.pm25,
    },
    voc: {
      baseline: baseline.voc,
      controlled: controlled.voc,
      psdThreshold: THRESHOLDS.voc.psd,
      titleVThreshold: THRESHOLDS.voc.titleV,
      nonattainThreshold: nonattainThresholdVOC,
      controllingThreshold: getControllingThreshold('voc', nonattainThresholdVOC),
      isPSDMajor: baseline.voc >= THRESHOLDS.voc.psd,
      isTitleV: controlled.voc >= THRESHOLDS.voc.titleV,
      isNonattainMajor: nonattainThresholdVOC !== null && baseline.voc >= nonattainThresholdVOC,
      regulation: THRESHOLDS.voc.regulation,
      majorSourceStatus: baseline.voc >= THRESHOLDS.voc.psd
        ? (controlled.voc < THRESHOLDS.voc.psd ? 'MITIGATED' : 'BREACHED')
        : 'CLEAR',
      nonattainStatus: nonattainThresholdVOC !== null && baseline.voc >= nonattainThresholdVOC
        ? (controlled.voc < nonattainThresholdVOC ? 'MITIGATED' : 'BREACHED')
        : 'CLEAR',
      margin: THRESHOLDS.voc.psd - controlled.voc,
    },
    hap: {
      baseline: baseline.hap,
      controlled: controlled.hap,
      singleThreshold: THRESHOLDS.hap.single,
      combinedThreshold: THRESHOLDS.hap.combined,
      isMajorHAP: baseline.hap >= THRESHOLDS.hap.combined,
      isNearMajor: baseline.hap >= THRESHOLDS.hap.single,
      regulation: THRESHOLDS.hap.regulation,
      majorSourceStatus: baseline.hap >= THRESHOLDS.hap.combined
        ? (controlled.hap < THRESHOLDS.hap.combined ? 'MITIGATED' : 'BREACHED')
        : baseline.hap >= THRESHOLDS.hap.single ? 'NEAR_THRESHOLD' : 'CLEAR',
      margin: THRESHOLDS.hap.combined - controlled.hap,
    },
    co2e: {
      baseline: baseline.co2e,
      controlled: controlled.co2e,
      ghgrpThreshold: THRESHOLDS.co2e.ghgrp,
      psdThreshold: THRESHOLDS.co2e.psd,
      requiresGHGRP: baseline.co2e >= THRESHOLDS.co2e.ghgrp,
      requiresPSD: baseline.co2e >= THRESHOLDS.co2e.psd,
      regulation: THRESHOLDS.co2e.regulation,
      majorSourceStatus: baseline.co2e >= THRESHOLDS.co2e.ghgrp
        ? (controlled.co2e < THRESHOLDS.co2e.ghgrp ? 'MITIGATED' : 'BREACHED')
        : 'CLEAR',
    },
    genset: {
      count: inputs.gensetCount,
      hours: inputs.gensetHours,
      runtimeLimit: THRESHOLDS.genset.runtimeLimit,
      compliant: inputs.gensetHours <= THRESHOLDS.genset.runtimeLimit,
      regulation: THRESHOLDS.genset.regulation,
      status: inputs.gensetHours <= THRESHOLDS.genset.runtimeLimit ? 'CLEAR' : 'BREACHED',
    },
  };

  return analysis;
}

// ─── How PermitOS Accelerates Remediation ──────────────────────────────────
// At every step below, PermitOS provides:
//  - Auto-generated permit application language (Documents tab)
//  - Real-time emissions simulation (Digital Twin tab)
//  - Compliance monitoring dashboards (Compliance OS tab)
//  - Regulatory AI copilot for RAI responses (Regulator Copilot tab)
//  - Scenario comparison (Executive Summary tab)
//  - Automated milestone timeline tracking (Milestone Timeline tab)
//  - PTE recalculation for each control option (Site Intake tab)

// ─── Structured Breach Detection ─────────────────────────────────────────────
export function generateBreachAnalysis(inputs, results, thresholds) {
  const breaches = [];
  const state = inputs.state || '';

  // Helper to build remediation plan
  const buildPlan = (pollutantKey, isBreached, severity) => {
    const plans = REMEDIATION_PLANS[pollutantKey];
    if (!plans) return [];
    return plans.map((plan) => ({
      ...plan,
      stepNumber: plan.step || 1,
      applicable: plan.minSeverity ? severity >= plan.minSeverity : true,
    })).filter(s => s.applicable);
  };

  // --- NOx PSD Major Source ---
  if (thresholds.nox.majorSourceStatus !== 'CLEAR') {
    const isBreached = thresholds.nox.majorSourceStatus === 'BREACHED';
    breaches.push({
      id: 'nox_psd_major',
      pollutant: 'NOx',
      thresholdType: 'PSD Major Source',
      regulation: '40 CFR 52.21(b)(1)(i)(a)',
      description: `Baseline NOx (${thresholds.nox.baseline.toFixed(1)} tpy) ${isBreached ? 'exceeds' : 'approaches'} ${thresholds.nox.psdThreshold} tpy PSD major source threshold. Gas turbines with DLN combustion produce ${thresholds.nox.controlled.toFixed(1)} tpy controlled — ${isBreached ? 'insufficient to avoid PSD' : 'reduced but still requires mitigation demonstration'}.`,
      baseline: thresholds.nox.baseline,
      controlled: thresholds.nox.controlled,
      threshold: thresholds.nox.psdThreshold,
      unit: 'tpy',
      status: isBreached ? 'BREACHED' : 'MITIGATED',
      severity: isBreached ? 'critical' : 'high',
      brickControl: `DLN combustion optimization + dispatch limiter reduces turbine NOx from ${thresholds.nox.baseline.toFixed(1)} to ${thresholds.nox.controlled.toFixed(1)} tpy`,
      additionalControls: isBreached
        ? 'Install SCR (90% reduction target), add continuous NOx monitoring (CEMS), and apply for PSD permit with BACT analysis'
        : null,
      margin: thresholds.nox.margin,
      tabLinks: [
        { tab: 'air', label: 'View BACT Analysis' },
        { tab: 'simulation', label: 'Run NOx Optimization' },
        { tab: 'compliance', label: 'Set NOx Monitoring' },
        { tab: 'docs', label: 'Generate PSD Application' },
        { tab: 'intake', label: 'Adjust Site Parameters' },
      ],
      remediationSteps: buildPlan('nox', isBreached, isBreached ? 5 : 4),
    });
  }

  // --- NOx Nonattainment ---
  if (thresholds.nox.nonattainStatus && thresholds.nox.nonattainStatus !== 'CLEAR') {
    const isBreached = thresholds.nox.nonattainStatus === 'BREACHED';
    breaches.push({
      id: 'nox_nonattain',
      pollutant: 'NOx',
      thresholdType: 'Nonattainment NSR',
      regulation: '40 CFR 51.165 (Severe Nonattainment)',
      description: `Baseline NOx (${thresholds.nox.baseline.toFixed(1)} tpy) exceeds ${thresholds.nox.nonattainThreshold} tpy Severe nonattainment threshold. This triggers Nonattainment New Source Review (NNSR) with Lowest Achievable Emission Rate (LAER) and emissions offsets requirement.`,
      baseline: thresholds.nox.baseline,
      controlled: thresholds.nox.controlled,
      threshold: thresholds.nox.nonattainThreshold,
      unit: 'tpy',
      status: isBreached ? 'BREACHED' : 'MITIGATED',
      severity: isBreached ? 'critical' : 'high',
      brickControl: `Brick dispatch optimization reduces NOx PTE to ${thresholds.nox.controlled.toFixed(1)} tpy`,
      additionalControls: isBreached
        ? 'LAER analysis required. Offsets (ratio ≥ 1.3:1) needed. SCR with ≥90% reduction and oxidation catalyst required.'
        : null,
      margin: thresholds.nox.nonattainThreshold - thresholds.nox.controlled,
      tabLinks: [
        { tab: 'air', label: 'Nonattainment Requirements' },
        { tab: 'compliance', label: 'Offsets Tracking' },
        { tab: 'docs', label: 'NNSR Application' },
        { tab: 'milestones', label: 'Update Timeline' },
      ],
      remediationSteps: buildPlan('nox_nonattain', isBreached, isBreached ? 5 : 4),
    });
  }

  // --- CO ---
  if (thresholds.co.majorSourceStatus !== 'CLEAR') {
    const isBreached = thresholds.co.majorSourceStatus === 'BREACHED';
    breaches.push({
      id: 'co_psd_major',
      pollutant: 'CO',
      thresholdType: 'PSD Major Source',
      regulation: '40 CFR 52.21(b)(1)(i)(a)',
      description: `Baseline CO (${thresholds.co.baseline.toFixed(1)} tpy) ${isBreached ? 'exceeds' : 'approaches'} ${thresholds.co.psdThreshold} tpy PSD threshold. CO from gas turbines is typically manageable with oxidation catalysts.`,
      baseline: thresholds.co.baseline,
      controlled: thresholds.co.controlled,
      threshold: thresholds.co.psdThreshold,
      unit: 'tpy',
      status: isBreached ? 'BREACHED' : 'MITIGATED',
      severity: isBreached ? 'high' : 'medium',
      brickControl: `Oxidation catalyst + dispatch optimization reduces CO to ${thresholds.co.controlled.toFixed(1)} tpy`,
      additionalControls: isBreached
        ? 'Install oxidation catalyst (≥90% CO reduction), apply for PSD permit'
        : null,
      margin: thresholds.co.margin,
      tabLinks: [
        { tab: 'air', label: 'View CO Controls' },
        { tab: 'compliance', label: 'Monitor CO Cap' },
        { tab: 'simulation', label: 'Optimize CO' },
      ],
      remediationSteps: buildPlan('co', isBreached, isBreached ? 4 : 3),
    });
  }

  // --- PM2.5 Nonattainment ---
  if (thresholds.pm25.nonattainStatus && thresholds.pm25.nonattainStatus !== 'CLEAR') {
    const isBreached = thresholds.pm25.nonattainStatus === 'BREACHED';
    breaches.push({
      id: 'pm25_nonattain',
      pollutant: 'PM2.5',
      thresholdType: 'Nonattainment — PM2.5',
      regulation: '40 CFR 51.166',
      description: `PM2.5 baseline (${thresholds.pm25.baseline.toFixed(1)} tpy) approaches ${thresholds.pm25.nonattainThreshold} tpy nonattainment threshold. Natural gas combustion produces minimal PM2.5, but nonattainment areas require stricter review.`,
      baseline: thresholds.pm25.baseline,
      controlled: thresholds.pm25.controlled,
      threshold: thresholds.pm25.nonattainThreshold,
      unit: 'tpy',
      status: isBreached ? 'BREACHED' : 'MITIGATED',
      severity: isBreached ? 'high' : 'medium',
      brickControl: `Fuel gas alone keeps PM2.5 low at ${thresholds.pm25.controlled.toFixed(1)} tpy`,
      additionalControls: isBreached
        ? 'PM2.5 BACT analysis required. Consider HEPA filtration on cooling air intakes.'
        : null,
      tabLinks: [
        { tab: 'air', label: 'View PM Analysis' },
        { tab: 'simulation', label: 'View Emissions Profile' },
        { tab: 'compliance', label: 'PM2.5 Tracking' },
      ],
      remediationSteps: buildPlan('pm25', isBreached, isBreached ? 4 : 3),
    });
  }

  // --- VOC Nonattainment ---
  if (thresholds.voc.nonattainStatus && thresholds.voc.nonattainStatus !== 'CLEAR') {
    const isBreached = thresholds.voc.nonattainStatus === 'BREACHED';
    breaches.push({
      id: 'voc_nonattain',
      pollutant: 'VOC',
      thresholdType: 'Nonattainment — Ozone Precursor',
      regulation: '40 CFR 51.165',
      description: `VOC baseline (${thresholds.voc.baseline.toFixed(1)} tpy) ${isBreached ? 'exceeds' : 'approaches'} ${thresholds.voc.nonattainThreshold} tpy severe nonattainment threshold. VOC is regulated as an ozone precursor in nonattainment areas.`,
      baseline: thresholds.voc.baseline,
      controlled: thresholds.voc.controlled,
      threshold: thresholds.voc.nonattainThreshold,
      unit: 'tpy',
      status: isBreached ? 'BREACHED' : 'MITIGATED',
      severity: isBreached ? 'high' : 'medium',
      brickControl: `Oxidation catalyst + gas fuel keeps VOC at ${thresholds.voc.controlled.toFixed(1)} tpy`,
      additionalControls: isBreached
        ? 'Oxidation catalyst required for VOC control. Offsets may be required in extreme nonattainment areas.'
        : null,
      tabLinks: [
        { tab: 'air', label: 'View VOC Analysis' },
        { tab: 'compliance', label: 'VOC Tracking' },
        { tab: 'docs', label: 'Offsets Documentation' },
      ],
      remediationSteps: buildPlan('voc', isBreached, isBreached ? 4 : 3),
    });
  }

  // --- HAP ---
  if (thresholds.hap.majorSourceStatus !== 'CLEAR') {
    const isBreached = thresholds.hap.majorSourceStatus === 'BREACHED';
    const isNear = thresholds.hap.majorSourceStatus === 'NEAR_THRESHOLD';
    if (isBreached || isNear) {
      breaches.push({
        id: 'hap_major',
        pollutant: 'HAP',
        thresholdType: isBreached ? 'Major HAP Source' : 'Near Major HAP',
        regulation: '40 CFR 63.2 / Subpart YYYY',
        description: isBreached
          ? `Combined HAP (${thresholds.hap.baseline.toFixed(1)} tpy) exceeds ${thresholds.hap.combinedThreshold} tpy major source threshold — full NESHAP Subpart YYYY compliance required`
          : `Combined HAP (${thresholds.hap.baseline.toFixed(1)} tpy) nears ${thresholds.hap.singleThreshold} tpy single-HAP threshold — proactive controls recommended`,
        baseline: thresholds.hap.baseline,
        controlled: thresholds.hap.controlled,
        threshold: isBreached ? thresholds.hap.combinedThreshold : thresholds.hap.singleThreshold,
        unit: 'tpy',
        status: isBreached ? 'BREACHED' : 'MITIGATED',
        severity: isBreached ? 'high' : 'low',
        brickControl: `Gas fuel + dispatch optimization keeps HAP at ${thresholds.hap.controlled.toFixed(1)} tpy`,
        additionalControls: isBreached
          ? 'Full NESHAP Subpart YYYY compliance required. MACT standards for HAP. Title V permit amendment needed.'
          : null,
        tabLinks: [
          { tab: 'air', label: 'View HAP Analysis' },
          { tab: 'compliance', label: 'HAP Compliance' },
          { tab: 'docs', label: 'NESHAP Application' },
        ],
        remediationSteps: buildPlan('hap', isBreached, isBreached ? 4 : 2),
      });
    }
  }

  // --- CO2e GHGRP ---
  if (thresholds.co2e.majorSourceStatus !== 'CLEAR') {
    const isBreached = thresholds.co2e.majorSourceStatus === 'BREACHED';
    breaches.push({
      id: 'co2e_ghgrp',
      pollutant: 'CO2e',
      thresholdType: 'GHGRP Reporting',
      regulation: '40 CFR 98.2(a)(2) / Subpart C',
      description: `Baseline CO2e (${thresholds.co2e.baseline.toFixed(0)} tpy) ${isBreached ? 'far exceeds' : 'exceeds'} ${thresholds.co2e.ghgrpThreshold.toLocaleString()} tpy GHGRP threshold. Annual GHG reporting to EPA eGGRT system is mandatory.`,
      baseline: thresholds.co2e.baseline,
      controlled: thresholds.co2e.controlled,
      threshold: thresholds.co2e.ghgrpThreshold,
      unit: 'tpy',
      status: isBreached ? 'BREACHED' : 'MITIGATED',
      severity: 'medium',
      brickControl: `Dispatch optimization reduces fuel consumption, lowering CO2e to ${thresholds.co2e.controlled.toFixed(0)} tpy`,
      additionalControls: isBreached
        ? 'Annual GHG report to EPA eGGRT system required. Subpart C (stationary combustion) + Subpart W (fugitives). Carbon offsets or CCS evaluation recommended for long-term compliance.'
        : null,
      tabLinks: [
        { tab: 'compliance', label: 'Add GHGRP Condition' },
        { tab: 'air', label: 'View GHG Analysis' },
        { tab: 'docs', label: 'GHG Report Template' },
        { tab: 'simulation', label: 'Carbon Optimization' },
      ],
      remediationSteps: buildPlan('co2e', isBreached, 3),
    });
  }

  // --- CO2e PSD GHG ---
  if (thresholds.co2e.baseline >= thresholds.co2e.psdThreshold) {
    breaches.push({
      id: 'co2e_psd_ghg',
      pollutant: 'CO2e',
      thresholdType: 'PSD — GHG',
      regulation: '40 CFR 52.21(b)(1)(ii)',
      description: `CO2e baseline (${thresholds.co2e.baseline.toFixed(0)} tpy) exceeds ${thresholds.co2e.psdThreshold.toLocaleString()} tpy PSD GHG threshold. BACT for GHG will be required in the PSD permit.`,
      baseline: thresholds.co2e.baseline,
      controlled: thresholds.co2e.controlled,
      threshold: thresholds.co2e.psdThreshold,
      unit: 'tpy',
      status: thresholds.co2e.controlled < thresholds.co2e.psdThreshold ? 'MITIGATED' : 'BREACHED',
      severity: 'medium',
      brickControl: `Dispatch optimization reduces CO2e to ${thresholds.co2e.controlled.toFixed(0)} tpy`,
      additionalControls: 'BACT for GHG (e.g., combined cycle efficiency, CCS readiness). Energy efficiency analysis required in PSD permit application.',
      tabLinks: [
        { tab: 'air', label: 'View GHG Analysis' },
        { tab: 'simulation', label: 'View Energy Profile' },
        { tab: 'compliance', label: 'GHG Tracking' },
      ],
      remediationSteps: buildPlan('co2e_psd', true, 3),
    });
  }

  // --- Genset Runtime ---
  if (!thresholds.genset.compliant) {
    breaches.push({
      id: 'genset_runtime',
      pollutant: 'Emergency Engine',
      thresholdType: 'NSPS/NESHAP Emergency Runtime Limit',
      regulation: '40 CFR 60 Subparts IIII/JJJJ, 63 Subpart ZZZZ',
      description: `Emergency runtime (${thresholds.genset.hours} hr/yr) exceeds ${thresholds.genset.runtimeLimit} hr/yr NSPS limit. Emergency engines are strictly limited to 100 hr/yr for maintenance and emergency demand response.`,
      baseline: thresholds.genset.hours,
      controlled: thresholds.genset.hours,
      threshold: thresholds.genset.runtimeLimit,
      unit: 'hr/yr',
      status: 'BREACHED',
      severity: 'high',
      brickControl: 'Brick dispatch optimization reduces reliance on backup gensets during peak events',
      additionalControls: 'Reduce emergency runtime to ≤100 hr/yr. Install non-resettable hour meters. Apply for non-emergency permit if additional runtime needed. NESHAP ZZZZ compliance required for CI engines >500 hp.',
      tabLinks: [
        { tab: 'air', label: 'View Engine Requirements' },
        { tab: 'compliance', label: 'Engine Compliance' },
        { tab: 'intake', label: 'Reduce Genset Hours' },
      ],
      remediationSteps: buildPlan('genset', true, 4),
    });
  }

  // --- NSPS Applicability Notice ---
  if (thresholds.nox.nspsApplicable || thresholds.co.nspsApplicable) {
    breaches.push({
      id: 'nsps_kkkk',
      pollutant: 'NOx / CO',
      thresholdType: 'NSPS Subpart KKKK — Turbine Concentration Limit',
      regulation: '40 CFR 60.4300-4420 (Subpart KKKK/KKKKa)',
      description: `All gas turbines ≥1 MW subject to NSPS KKKK — NOx limit ${THRESHOLDS.nox.nspsLimit} ${THRESHOLDS.nox.nspsUnit}, CO limit ${THRESHOLDS.co.nspsLimit} ${THRESHOLDS.co.nspsUnit}. Performance stack test required within 180 days of startup.`,
      baseline: 0,
      controlled: 0,
      threshold: 0,
      unit: 'ppmvd',
      status: 'NOTICE',
      severity: 'info',
      brickControl: 'DLN combustion system designed to meet 9 ppmvd NOx @ 15% O2 — within NSPS limit of 15 ppmvd',
      additionalControls: 'Initial performance stack test required within 180 days of startup. Annual NOx compliance testing. CO continuous parametric monitoring recommended.',
      tabLinks: [
        { tab: 'air', label: 'NSPS Requirements' },
        { tab: 'compliance', label: 'Testing Schedule' },
        { tab: 'docs', label: 'Stack Test Protocol' },
      ],
      remediationSteps: buildPlan('nsps', false, 1),
    });
  }

  return breaches;
}

// ─── Structured Remediation Plans (Advanced) ─────────────────────────────────
// Each plan has executable steps showing exactly how PermitOS accelerates resolution.
// Every step includes: specific regulatory citation, exact action, how PermitOS helps,
// tech options with cost/timeline, and cross-platform tab links.
// PermitOS accelerates each step by 40-60% vs. traditional consultant-led approach.
const REMEDIATION_PLANS = {

  // ── NOx PSD Major Source ──────────────────────────────────────────────────
  nox: [
    {
      step: 1,
      title: 'Immediate Brick Dispatch Optimization (Week 1-2)',
      description: 'Configure Brick AI to enforce a NOx emission constraint in the dispatch algorithm. Set a maximum NOx PTE cap of 80 tpy (below 100 tpy PSD threshold). Brick automatically shifts turbine load to less emissive periods and leverages battery storage during peak NOx formation hours (10 AM - 4 PM in summer).',
      regulation: '40 CFR 52.21(b)(1)(i)(a) — PSD major source threshold of 100 tpy NOx. Demonstrate that controlled PTE stays under threshold.',
      howPermitOSHelps: 'Open the Digital Twin tab → click "Run Dispatch Optimization" → select "NOx Constraint Mode" → enter 80 tpy target → PermitOS automatically calculates the new dispatch schedule and shows the resulting PTE in real time. The simulation runs 24-hour profiles for NOx, CO, and CO2e simultaneously.',
      techOptions: [
        { name: 'Brick NOx-Constrained Dispatch', reduction: '15-25% NOx PTE reduction', timeline: '1-2 weeks', cost: 'Included in Brick platform — no additional hardware', complexity: 'low', permitosTab: 'simulation' },
        { name: 'Load Shedding Schedule + Battery Smoothing', reduction: '20-30% NOx PTE reduction', timeline: '2-3 weeks', cost: 'Software configuration ($5-10K if third-party EMS integration needed)', complexity: 'low', permitosTab: 'simulation' },
      ],
      tabLinks: [
        { tab: 'simulation', label: 'Run NOx-Constrained Dispatch Now', urgent: true },
        { tab: 'intake', label: 'Adjust Brick Savings % to 25%', urgent: true },
      ],
      permitosCapability: 'PermitOS recalculates PTE instantly after each dispatch change — no waiting days for manual calculation.',
    },
    {
      step: 2,
      title: 'DLN Combustion Tuning (Week 3-6)',
      description: 'Schedule DLN combustion tuning with OEM (GE/Siemens/Mitsubishi). Key actions: (a) Adjust pilot fuel split to minimize NOx at base load, target 9 ppmvd @ 15% O2; (b) Calibrate fuel nozzle staging for optimal fuel/air mixing; (c) Implement seasonal tuning schedule — summer NOx-optimized, winter CO-optimized. This alone can drop uncontrolled NOx by 30-50%.',
      regulation: '40 CFR 60 Subpart KKKK requires NOx ≤15 ppmvd @ 15% O2 for new turbines. Target 9 ppmvd to ensure comfortable margin.',
      howPermitOSHelps: 'Open the Air Permit AI tab → View "BACT Analysis" → PermitOS auto-generates the BACT technical memo showing DLN as the primary control technology with specific emission reduction calculations. Use the Compliance OS tab to schedule the tuning event and track completion.',
      techOptions: [
        { name: 'OEM DLN Tuning Service', reduction: '30-50% from baseline NOx', timeline: '2-4 weeks onsite', cost: '$50-80K (OEM service contract)', complexity: 'medium', permitosTab: 'air' },
        { name: 'Advanced Fuel Staging Retrofit', reduction: '40-60% from baseline NOx', timeline: '4-8 weeks including outage', cost: '$100-200K (hardware + installation)', complexity: 'high', permitosTab: 'air' },
      ],
      tabLinks: [
        { tab: 'air', label: 'View DLN BACT Analysis', urgent: true },
        { tab: 'compliance', label: 'Schedule Tuning Event', urgent: true },
        { tab: 'simulation', label: 'Verify NOx After Tuning' },
      ],
      permitosCapability: 'PermitOS stores all tuning records, generates compliance reports, and tracks the 180-day NSPS stack test deadline automatically.',
    },
    {
      step: 3,
      title: 'Install SCR Post-Combustion Control (Month 3-9)',
      description: 'If dispatch + DLN tuning is insufficient to keep NOx under 100 tpy PSD threshold, install Selective Catalytic Reduction (SCR). Scope: (a) Catalyst module installation in turbine exhaust duct; (b) Aqueous ammonia or urea injection skid; (c) Continuous Emissions Monitoring System (CEMS) for NOx, NH3 slip, and O2; (d) Control system integration for automated reagent injection based on load. SCR achieves 85-95% NOx reduction.',
      regulation: '40 CFR 52.21 — PSD BACT requires top-down analysis. SCR is established BACT for gas turbines. 40 CFR 75 (CEMS) applies for emissions monitoring.',
      howPermitOSHelps: 'Open Documents tab → Generate "PSD Permit Application Package" → PermitOS auto-fills the BACT analysis with SCR as the selected control, including cost-effectiveness analysis ($/ton NOx removed), regulatory citations, and emission reduction calculations. Use the Executive Summary tab to show updated risk score after SCR.',
      techOptions: [
        { name: 'SCR + Aqueous Ammonia (Standard)', reduction: '85-90% NOx removal', timeline: '6-9 months (engineering + construction)', cost: '$500-800K per turbine', complexity: 'high', permitosTab: 'docs' },
        { name: 'SCR + Urea (Safer reagent handling)', reduction: '80-90% NOx removal', timeline: '6-9 months', cost: '$600-900K per turbine', complexity: 'high', permitosTab: 'docs' },
        { name: 'Hybrid SCR + Oxidation Catalyst (Multi-pollutant)', reduction: '90-95% NOx + 90% CO/HAP', timeline: '7-10 months', cost: '$800K-1.2M per turbine', complexity: 'high', permitosTab: 'docs' },
      ],
      tabLinks: [
        { tab: 'docs', label: 'Generate PSD Application with SCR BACT', urgent: true },
        { tab: 'air', label: 'Review BACT Cost-Effectiveness', urgent: true },
        { tab: 'milestones', label: 'Set 9-Month SCR Installation Timeline' },
        { tab: 'compliance', label: 'Add CEMS NOx Monitoring Condition' },
      ],
      permitosCapability: 'PermitOS tracks the entire SCR installation as a milestone with automated deadline alerts, agency submission dates, and compliance condition setup.',
    },
    {
      step: 4,
      title: 'Install CEMS and Set Up Continuous Compliance Monitoring (Month 3-4, parallel with SCR)',
      description: 'Deploy EPA-compliant CEMS for NOx: (a) Extractive or in-situ analyzer selection based on turbine configuration; (b) Data Acquisition and Handling System (DAHS) for 40 CFR Part 75 compliance; (c) Configure alarm thresholds at 80% of permitted emission limit for proactive exceedance prevention; (d) Set up quarterly QA/QC cylinder gas audits. Alternatively, PEMS (Predictive Emissions Monitoring) can be used for lower cost with software-based monitoring.',
      regulation: '40 CFR Part 75 (CEMS), 40 CFR 60.4400 (CPMS). For Title V: periodic monitoring sufficient to demonstrate compliance.',
      howPermitOSHelps: 'Open Compliance OS → Click "Add Monitoring Condition" → Select "NOx CEMS" → PermitOS pre-configures the monitoring frequency, reporting schedule (quarterly), alarm thresholds, and generates the QA/QC plan document automatically.',
      techOptions: [
        { name: 'Extractive CEMS (Hot-wet or Dilution)', reduction: 'Monitoring only — enables compliance verification', timeline: '3-4 months (procure + install + RATA)', cost: '$150-250K installed including DAHS', complexity: 'medium', permitosTab: 'compliance' },
        { name: 'Predictive Emissions Monitoring System (PEMS)', reduction: 'Monitoring only — no hardware CEMS required', timeline: '2-3 months (model development)', cost: '$80-120K (software license + validation)', complexity: 'medium', permitosTab: 'compliance' },
      ],
      tabLinks: [
        { tab: 'compliance', label: 'Add NOx CEMS Monitoring Condition Now', urgent: true },
        { tab: 'simulation', label: 'Track NOx in Real-Time Dashboard' },
        { tab: 'docs', label: 'Generate CEMS QA/QC Plan' },
      ],
      permitosCapability: 'PermitOS Compliance OS automatically generates semiannual compliance reports, tracks CEMS uptime (>95% required), and sends alerts if emission limits are approached.',
    },
    {
      step: 5,
      title: 'Submit PSD Permit Application with Full BACT Analysis (Month 9-18)',
      description: 'Prepare and submit complete PSD permit application package: (a) BACT top-down analysis document with DLN + SCR selection rationale; (b) Air quality impact analysis using AERMOD dispersion modeling including Class I area review if within 50km; (c) Ambient air quality monitoring data; (d) Additional impact analysis (visibility, soils, vegetation); (e) Public notice draft and responses to anticipated comments; (f) Coordinate with state air agency (SIP-approved program) or EPA Region.',
      regulation: '40 CFR 52.21 (PSD), 40 CFR 51.166 (state PSD program requirements), 40 CFR Part 51 Appendix W (AERMOD modeling).',
      howPermitOSHelps: 'PermitOS auto-generates the full PSD application: (1) Documents tab → "Generate PSD Application" produces 8+ documents including BACT analysis, PTE workbook, AQIA report; (2) Regulator Copilot prepares RAI response templates; (3) Milestone Timeline tracks each agency review milestone with automated deadline management. Traditional consultant approach: 9-18 months. With PermitOS: 4-8 months.',
      techOptions: [
        { name: 'Traditional Consultant-Led PSD Application', reduction: 'N/A — permitting pathway', timeline: '9-18 months agency review', cost: '$200-500K (environmental consultant)', complexity: 'high', permitosTab: 'docs' },
        { name: 'PermitOS Auto-Generated PSD Package', reduction: 'N/A — permitting pathway', timeline: '4-8 months (40-55% faster)', cost: 'Included in Brick platform subscription', complexity: 'medium', permitosTab: 'docs' },
      ],
      tabLinks: [
        { tab: 'docs', label: 'Auto-Generate Full PSD Application Package', urgent: true },
        { tab: 'milestones', label: 'View Accelerated PSD Timeline' },
        { tab: 'copilot', label: 'Prepare RAI Response Templates in Advance' },
        { tab: 'executive', label: 'Show Updated Risk Score After PSD Application' },
      ],
      permitosCapability: 'PermitOS tracks the entire PSD review lifecycle — completeness determination (30 days), public comment (30 days), response to comments, final permit issuance. Agency review typically 9 months, PermitOS milestone tracker ensures nothing falls through the cracks.',
    },
  ],

  // ── NOx Nonattainment NSR ────────────────────────────────────────────────
  nox_nonattain: [
    {
      step: 1,
      title: 'LAER Technology Determination (Month 1-2)',
      description: 'Immediately perform Lowest Achievable Emission Rate (LAER) analysis per CAA §173. LAER is the most stringent emission limitation achieved in practice by any source in the same category — it will be stricter than BACT. For gas turbines, LAER is typically 2-5 ppmvd NOx @ 15% O2, achievable only with SCR achieving ≥90% reduction combined with advanced DLN. Review RBLC database for recent LAER determinations on similar turbines.',
      regulation: 'CAA §173 (Preconstruction Requirements for Nonattainment Areas). LAER must be the most stringent emission limit in practice, regardless of cost.',
      howPermitOSHelps: 'Open Air Permit AI tab → Click "View LAER Analysis" → PermitOS searches the RBLC (RACT/BACT/LAER Clearinghouse) database and presents comparable determinations for gas turbines in severe nonattainment areas. PermitOS auto-generates the LAER analysis memo with citations to precedent determinations.',
      techOptions: [
        { name: 'SCR + Oxidation Catalyst (Industry LAER)', reduction: '90-95% NOx removal', timeline: '7-10 months (install) + 2 months LAER analysis', cost: '$800K-1.2M per turbine', complexity: 'high', permitosTab: 'air' },
        { name: 'Advanced DLN Retrofit + SCR High-Dust', reduction: '95%+ NOx removal — achieves <3 ppmvd', timeline: '8-12 months (design + install)', cost: '$1-1.5M per turbine (specialized catalyst)', complexity: 'high', permitosTab: 'air' },
      ],
      tabLinks: [
        { tab: 'air', label: 'Run LAER Analysis with RBLC Search', urgent: true },
        { tab: 'docs', label: 'Generate LAER Determination Memo', urgent: true },
      ],
      permitosCapability: 'PermitOS reduces LAER analysis from 3-4 months (manual) to 2-3 weeks by auto-searching RBLC and generating the comparative analysis document.',
    },
    {
      step: 2,
      title: 'Procure Emissions Offsets (Month 3-8)',
      description: 'Begin emissions offsets procurement immediately. For severe nonattainment (California, parts of Northeast), offset ratio is ≥1.3:1 — each ton of NOx increase requires 1.3 tons of reductions from existing sources in the same area. Sources of offsets: (a) EPA-approved Clean Air Interstate Rule (CAIR) or Cross-State Air Pollution Rule (CSAPR) allowances; (b) Bilateral agreement with shutting-down facility in same air basin; (c) Voluntary emission reduction credits (ERCs) from state-run registries. Budget: $50-200K per ton of NOx depending on area.',
      regulation: '40 CFR 51.165 (Nonattainment NSR requirements). CAA §173(c) — emissions offsets must provide net air quality benefit.',
      howPermitOSHelps: 'Open Compliance OS → "Offsets Tracking" section → PermitOS shows offset requirements: required tons, available registries, current market prices. Use the Documents tab to generate offset procurement letters and agreements. PermitOS tracks offset procurement as a milestone with budget tracking.',
      techOptions: [
        { name: 'EPA Offset Registry Purchase (CAIR/CSAPR)', reduction: 'N/A — purchases offset credits', timeline: '3-6 months (negotiation + EPA approval)', cost: '$50-200K per ton NOx (varies by region)', complexity: 'high', permitosTab: 'compliance' },
        { name: 'Bilateral Offset from Shutting Down Facility', reduction: 'N/A — negotiated reductions', timeline: '4-8 months (legal + regulatory approval)', cost: 'Negotiable — often $50-150K per ton', complexity: 'high', permitosTab: 'compliance' },
      ],
      tabLinks: [
        { tab: 'compliance', label: 'View Offset Requirements & Track Procurement', urgent: true },
        { tab: 'milestones', label: 'Set NNSR Procurement Timeline' },
        { tab: 'docs', label: 'Generate Offset Procurement Letters' },
      ],
      permitosCapability: 'PermitOS automatically calculates total offset tons needed, tracks procurement progress, and alerts when deadlines for offset submission approach. Traditional manual tracking misses deadlines — PermitOS automates it.',
    },
    {
      step: 3,
      title: 'Complete NNSR Permit Application (Month 6-12)',
      description: 'Assemble comprehensive NNSR permit application: (a) LAER demonstration with RBLC citations; (b) Offset procurement evidence and tracking; (c) Alternative sites analysis showing why this location is necessary; (d) Public benefit demonstration (jobs, tax revenue, grid reliability); (e) Air quality modeling demonstrating no net increase in ambient concentrations; (f) Public hearing notification and response-to-comments document. Coordinate with state/local air pollution control agency.',
      regulation: '40 CFR 51.165 (full NNSR program), state SIP-approved nonattainment program, CAA §173(a)(5) — public hearing required.',
      howPermitOSHelps: 'Documents tab → "Generate NNSR Package" → PermitOS produces all NNSR application documents: (1) LAER analysis, (2) offsets demonstration, (3) alternative sites analysis, (4) air quality modeling report template. Regulator Copilot (Copilot tab) pre-drafts public notice language and anticipated RAI responses. Milestone tab tracks the public hearing schedule.',
      tabLinks: [
        { tab: 'docs', label: 'Generate Complete NNSR Permit Package', urgent: true },
        { tab: 'copilot', label: 'Draft Public Hearing Notice & RAI Pre-Responses', urgent: true },
        { tab: 'milestones', label: 'NNSR Agency Review Timeline' },
        { tab: 'air', label: 'Review LAER Analysis for Application' },
      ],
      permitosCapability: 'PermitOS accelerates NNSR application assembly from 6 months (traditional) to 2-3 months. Auto-generated documents ensure completeness and reduce RAI cycles.',
    },
  ],

  // ── CO PSD Major Source ──────────────────────────────────────────────────
  co: [
    {
      step: 1,
      title: 'Immediate Combustion Tuning for CO/NOx Balance (Week 1-3)',
      description: 'Tune combustion controls to address the CO exceedance while maintaining NOx compliance. CO increases at low loads (40-60% load range) and during DLN combustion mode transitions. Action: (a) Increase minimum stable load setpoint from 40% to 50%; (b) Adjust load ramp rates to 5 MW/min max to reduce transition emissions; (c) Implement CO-constrained dispatch in Brick AI — prioritize operating hours at ≥70% load where DLN combustion is fully premixed and CO is minimal. This mitigates 20-40% of CO.',
      regulation: '40 CFR 52.21(b)(1)(i)(a) — CO PSD threshold is 100 tpy. NSPS KKKK limit: 20 ppmvd CO @ 15% O2.',
      howPermitOSHelps: 'Open Simulation tab → Click "Optimize CO Performance" → PermitOS runs the 24-hour dispatch profile showing CO emissions at each load point. Adjust ramp rates and minimum load in the simulator → see CO PTE update instantly. Then open Intake tab to save the new operating parameters.',
      techOptions: [
        { name: 'CO-Constrained Dispatch + Load Optimization', reduction: '20-40% CO reduction at low loads', timeline: '1-3 weeks (software)', cost: 'Included in Brick platform — no additional hardware', complexity: 'low', permitosTab: 'simulation' },
        { name: 'OEM Combustion Tuning Service', reduction: '30-50% CO reduction full load range', timeline: '2-3 weeks onsite', cost: '$30-50K (OEM tuning engineer)', complexity: 'medium', permitosTab: 'air' },
      ],
      tabLinks: [
        { tab: 'simulation', label: 'Run CO-Constrained Dispatch Simulation Now', urgent: true },
        { tab: 'intake', label: 'Update Operating Parameters (ramp rate, min load)' },
      ],
      permitosCapability: 'PermitOS shows the NOx/CO trade-off in real-time — if increasing load for CO increases NOx, the simulator shows both metrics simultaneously so you find the optimal operating point.',
    },
    {
      step: 2,
      title: 'Install Oxidation Catalyst (Month 2-6, if tuning insufficient)',
      description: 'Design and install CO oxidation catalyst if PSD threshold is still approached after tuning. Scope: (a) Precious metal (Pt/Pd on ceramic monolith) catalyst module sized for turbine exhaust flow; (b) Bypass damper for startup/shutdown to prevent thermal shock; (c) Temperature monitoring across catalyst bed to verify ≥450°F inlet for CO conversion. Achieves 90-95% CO reduction. Combined with VOC/HAP oxidation for multi-pollutant benefit.',
      regulation: '40 CFR 52.21 — PSD BACT analysis. CO oxidation catalyst is established BACT for stationary gas turbines.',
      howPermitOSHelps: 'Open Air Permit AI → "View CO Controls" → PermitOS generates the BACT technical memo showing oxidation catalyst as the selected control with cost-effectiveness ($/ton CO removed). Documents tab generates the permit amendment language. Compliance OS adds the new emission limit condition.',
      techOptions: [
        { name: 'Standalone CO Oxidation Catalyst', reduction: '90-95% CO reduction', timeline: '4-6 months (engineering + installation during planned outage)', cost: '$200-400K per turbine', complexity: 'medium', permitosTab: 'air' },
        { name: 'Combined CO + VOC + HAP Oxidation Catalyst', reduction: '90% CO + 90% VOC + 50-70% HAP', timeline: '4-6 months (combined catalyst module)', cost: '$250-450K per turbine (multi-pollutant benefit)', complexity: 'medium', permitosTab: 'air' },
      ],
      tabLinks: [
        { tab: 'air', label: 'View CO Oxidation Catalyst BACT Analysis' },
        { tab: 'docs', label: 'Generate PSD Application with CO Controls' },
        { tab: 'compliance', label: 'Add CO Emission Limit Condition' },
      ],
      permitosCapability: 'PermitOS auto-generates the BACT cost-effectiveness calculation, application language, and compliance conditions — eliminating weeks of manual document drafting by consultants.',
    },
  ],

  // ── PM2.5 Nonattainment ──────────────────────────────────────────────────
  pm25: [
    {
      step: 1,
      title: 'PM2.5 Source Verification via Stack Testing (Week 4-8)',
      description: 'Conduct EPA Method 202 stack testing to measure actual condensable PM2.5 emissions. Natural gas combustion produces primarily condensable PM2.5 (ammonium sulfate/nitrate precursors) rather than filterable PM. Key: (a) Schedule EPA Method 202 at full load and minimum load; (b) Include Method 201A for filterable PM (same test); (c) Compare results against AP-42 default emission factors (which are conservative). If actual PM2.5 is below the nonattainment threshold, document and confirm with the agency.',
      regulation: '40 CFR 51.166 (PM2.5 nonattainment area requirements). EPA Method 202 (40 CFR Part 60, Appendix A-8) for condensable PM.',
      howPermitOSHelps: 'Open Air Permit AI → "PM Analysis" tab → PermitOS generates the stack test protocol document with Method 202 specifications, test conditions, and expected emission rates. Use Compliance OS to schedule the stack test and track results.',
      techOptions: [
        { name: 'EPA Method 202 Stack Test (Condensable PM)', reduction: 'Verification only — establishes actual emission factor', timeline: '4-6 weeks (schedule + test + lab analysis)', cost: '$30-50K (stack test contractor)', complexity: 'medium', permitosTab: 'compliance' },
        { name: 'Continuous PM Monitor (Beta Attenuation)', reduction: 'Monitoring only — real-time PM2.5 tracking', timeline: '3-4 months (procure + install + certify)', cost: '$100-150K (monitor + shelter + DAHS)', complexity: 'medium', permitosTab: 'compliance' },
      ],
      tabLinks: [
        { tab: 'compliance', label: 'Generate Stack Test Protocol & Schedule Test', urgent: true },
        { tab: 'air', label: 'View PM2.5 Analysis & Comparison to Threshold' },
      ],
      permitosCapability: 'PermitOS stores all stack test reports, calculates the actual (vs. AP-42 default) emission factors, and auto-updates PTE calculations with test results.',
    },
    {
      step: 2,
      title: 'Fuel Gas Quality Control Program (Month 2, ongoing)',
      description: 'Implement fuel gas quality assurance: (a) Request monthly gas composition analysis from pipeline supplier — monitor for higher hydrocarbon content that increases condensable PM; (b) Install fuel gas coalescing filter to remove liquids and particulates; (c) Track HHV (higher heating value) variability — spikes in HHV correlate with higher PM2.5 formation; (d) Maintain fuel quality log for agency inspection.',
      regulation: '40 CFR 60 Subpart KKKK — turbine emissions based on fuel composition. Gas tariff compliance per pipeline quality specifications.',
      howPermitOSHelps: 'Open Intake tab → Enter fuel composition data under "Fuel Specs" section. Compliance OS logs fuel quality data and auto-generates the fuel quality monitoring report for agency submission.',
      tabLinks: [
        { tab: 'intake', label: 'Enter Fuel Composition & Quality Specs' },
        { tab: 'compliance', label: 'Track Fuel Quality Log Monthly' },
        { tab: 'air', label: 'View PM2.5 Calculation with Actual Fuel Data' },
      ],
      permitosCapability: 'PermitOS automatically recalculates PM2.5 PTE whenever fuel composition data is updated — no manual recalculations needed.',
    },
  ],

  // ── VOC Nonattainment (Ozone Precursor) ──────────────────────────────────
  voc: [
    {
      step: 1,
      title: 'Install Oxidation Catalyst for VOC/CO Control (Month 2-6)',
      description: 'Design and procure oxidation catalyst system tuned for VOC destruction: (a) Precious metal catalyst (Pt/Pd) on high-cell-density ceramic monolith for maximum VOC destruction; (b) Operating temperature target: 500-650°F catalyst inlet for optimum VOC conversion (>90%); (c) Co-benefit: catalysts destroy CO and formaldehyde simultaneously. For severe ozone nonattainment areas, LAER may require additional VOC control beyond catalyst.',
      regulation: '40 CFR 51.165 (VOC as ozone precursor in nonattainment areas). CAA §182 — ozone plan requirements for severe areas.',
      howPermitOSHelps: 'Open Air Permit AI → "VOC Control Analysis" → PermitOS generates the LAER/BACT analysis showing oxidation catalyst as the control technology. Documents tab produces the VOC control section for the NNSR application. Compliance OS sets up VOC monitoring conditions.',
      techOptions: [
        { name: 'Dedicated VOC Oxidation Catalyst', reduction: '85-95% VOC destruction', timeline: '4-6 months (design + install during planned outage)', cost: '$200-400K per turbine', complexity: 'medium', permitosTab: 'air' },
        { name: 'Combined CO/VOC Catalyst Module', reduction: '90% VOC + 90% CO (shared catalyst)', timeline: '4-6 months (combined system)', cost: '$250-450K (cost savings vs. separate systems)', complexity: 'medium', permitosTab: 'air' },
      ],
      tabLinks: [
        { tab: 'air', label: 'View VOC LAER/BACT Analysis', urgent: true },
        { tab: 'simulation', label: 'Run VOC-Constrained Dispatch Simulation' },
        { tab: 'docs', label: 'Generate VOC Control Section for NNSR' },
      ],
      permitosCapability: 'PermitOS calculates the VOC reduction credit for offsets if applicable, and auto-generates the demonstration for NNSR applications.',
    },
  ],

  // ── HAP Major Source ─────────────────────────────────────────────────────
  hap: [
    {
      step: 1,
      title: 'Complete HAP Emission Inventory & Source Classification (Week 1-3)',
      description: 'Perform comprehensive HAP emission inventory: (a) Calculate individual HAPs from turbine combustion using AP-42 Chapter 3.1 factors — formaldehyde, acrolein, benzene, toluene, xylene; (b) Calculate diesel HAP from emergency gensets (benzene, 1,3-butadiene, acetaldehyde, formaldehyde) using AP-42 Chapter 3.3; (c) Determine if any single HAP ≥10 tpy (major source threshold) or combined HAP ≥25 tpy. Goal: maintain area source classification to avoid full MACT compliance.',
      regulation: '40 CFR 63.2 (major source definition: 10 tpy single / 25 tpy combined HAP). CAA §112 — MACT standards for major HAP sources.',
      howPermitOSHelps: 'Open Air Permit AI → "HAP Analysis" tab → PermitOS auto-calculates all individual HAPs using AP-42 emission factors specific to the turbine model and genset specs. Results show each HAP with tpy and percentage of major source threshold. If under thresholds, PermitOS auto-generates the area source demonstration memo.',
      tabLinks: [
        { tab: 'air', label: 'View HAP Emission Inventory Now', urgent: true },
        { tab: 'compliance', label: 'Set HAP Tracking Dashboard' },
        { tab: 'docs', label: 'Generate Area Source Classification Memo' },
      ],
      permitosCapability: 'PermitOS calculates all 25+ individual HAP compounds automatically — a task that takes consultants 1-2 weeks of manual spreadsheet work, done instantly with site-specific parameters.',
    },
    {
      step: 2,
      title: 'Develop NESHAP MACT Compliance Plan (Month 2-5, if major source)',
      description: 'If HAP emissions exceed major source thresholds: (a) Full NESHAP Subpart YYYY (Gas Turbines) compliance plan — MACT standards for formaldehyde and other HAP; (b) Title V permit amendment to include HAP emission limits and monitoring; (c) Install oxidation catalyst if not already present — reduces HAP by 50-70%; (d) Annual compliance certification with semiannual monitoring reports; (e) Develop MACT work practice standards for maintenance and operation.',
      regulation: '40 CFR 63 Subpart YYYY (NESHAP for Stationary Gas Turbines). CAA §112(j) — MACT for major HAP sources. 40 CFR 63.6080-6185 (YYYY compliance requirements).',
      howPermitOSHelps: 'Documents tab → "Generate NESHAP Application" → PermitOS produces complete MACT compliance plan with: (1) HAP emission limits table, (2) monitoring plan, (3) compliance certification templates, (4) CEMS specifications if required. Compliance OS sets up the semiannual reporting schedule.',
      techOptions: [
        { name: 'MACT Compliance Plan Development', reduction: 'Regulatory compliance — no HAP reduction directly', timeline: '3-6 months (plan development + agency coordination)', cost: '$50-100K (consultant-led without PermitOS)', complexity: 'high', permitosTab: 'docs' },
        { name: 'Oxidation Catalyst Retrofit', reduction: '50-70% HAP reduction from baseline', timeline: '4-6 months (design + install)', cost: '$200-400K per turbine (catalyst module)', complexity: 'medium', permitosTab: 'air' },
      ],
      tabLinks: [
        { tab: 'docs', label: 'Generate NESHAP Subpart YYYY Compliance Plan', urgent: true },
        { tab: 'compliance', label: 'Set HAP Semiannual Reporting Schedule' },
        { tab: 'air', label: 'Review MACT Compliance Requirements' },
      ],
      permitosCapability: 'PermitOS reduces MACT compliance plan development from 3-6 months (traditional) to 4-6 weeks by auto-generating all required documents from site-specific data.',
    },
  ],

  // ── CO2e GHGRP Reporting ────────────────────────────────────────────────
  co2e: [
    {
      step: 1,
      title: 'Register in EPA eGGRT & Set Up Subpart C Reporting (Week 2-4)',
      description: 'Register the facility in EPA\'s electronic Greenhouse Gas Reporting Tool (eGGRT) system. Required for any facility with stationary combustion emissions >25,000 tpy CO2e. Steps: (a) Create facility account in eGGRT; (b) Set up Subpart C (Stationary Combustion) reporting for all gas turbines; (c) Identify and register any Subpart W (fugitive emissions from oil & gas equipment) sources; (d) Configure annual report data collection process. Annual report due March 31 for the prior calendar year.',
      regulation: '40 CFR 98.2(a)(2) — GHGRP threshold: 25,000 tpy CO2e. 40 CFR 98 Subpart C (Stationary Combustion), Subpart W (Fugitive Emissions).',
      howPermitOSHelps: 'Open Compliance OS → Click "Add GHGRP Condition" → PermitOS pre-configures the monitoring and reporting requirements: emission sources, calculation methodology (40 CFR 98.33), and report template. PermitOS auto-generates the annual GHG report populated with site data each year.',
      tabLinks: [
        { tab: 'compliance', label: 'Add GHGRP Condition & Set Up Reporting Now', urgent: true },
        { tab: 'docs', label: 'Generate Annual GHG Report Template' },
      ],
      permitosCapability: 'PermitOS pre-populates GHG reports with turbine operating hours, fuel use, and calculated CO2e — reducing annual reporting effort from 2 weeks to 2 hours.',
    },
    {
      step: 2,
      title: 'Implement Carbon Management & Offset Program (Month 2-6)',
      description: 'Develop enterprise GHG management strategy: (a) Calculate Scope 1 (turbines + gensets) and Scope 2 (purchased electricity if applicable) emissions; (b) Evaluate voluntary carbon offset purchases — Verified Carbon Standard (VCS) or Gold Standard credits currently $10-50/ton CO2e; (c) Assess carbon capture feasibility study for long-term compliance with potential future regulations; (d) Set internal carbon price ($50-100/ton recommended) for investment decisions.',
      regulation: 'No current federal mandate for carbon management beyond GHGRP, but state-level programs (CA cap-and-trade, WA, OR) and anticipated EPA GHG rules for new gas plants make proactive management essential.',
      howPermitOSHelps: 'Simulation tab → "Carbon Optimization" → PermitOS models carbon offset scenarios showing cost vs. reduction. Executive Summary tab shows the GHG trajectory and compliance cost projections. Compliance OS tracks offset purchases and retirements.',
      techOptions: [
        { name: 'Voluntary Carbon Offsets (VCS/GS Certified)', reduction: '10-50% of total CO2e (depends on budget)', timeline: '3-6 months (procurement + retirement)', cost: '$10-50/ton CO2e (VER market price)', complexity: 'low', permitosTab: 'simulation' },
        { name: 'Carbon Capture Feasibility Study', reduction: 'Long-term: 85-95% capture rate', timeline: '12-18 months (study + pilot design)', cost: '$1-5M (study phase only)', complexity: 'high', permitosTab: 'air' },
      ],
      tabLinks: [
        { tab: 'simulation', label: 'Run Carbon Optimization & Offset Modeling' },
        { tab: 'compliance', label: 'Track GHG Reduction Progress' },
        { tab: 'executive', label: 'View GHG Compliance Cost Projections' },
      ],
      permitosCapability: 'PermitOS models multiple carbon management scenarios with cost curves, showing $/ton abatement for each option and recommending the optimal strategy.',
    },
    {
      step: 3,
      title: 'Energy Efficiency Optimization (Month 2-4, parallel)',
      description: 'Improve overall facility heat rate to reduce CO2e per MWh: (a) Brick AI dispatch optimization already reduces fuel consumption by 15-20% through peak shaving and battery storage dispatch — ensure this is fully configured; (b) Evaluate turbine inlet cooling (chilling or evaporative) to recover 3-5% efficiency in hot weather; (c) Assess combined cycle conversion (if site has steam host or district heating opportunity) to increase efficiency from ~35% to >55%; (d) Implement parasitic load reduction programs (cooling towers, pumps, compressors).',
      regulation: 'Energy efficiency is considered BACT for GHG in PSD permitting per EPA\'s GHG BACT guidance (BSER for turbines).',
      howPermitOSHelps: 'Simulation tab → "Energy Optimization" → PermitOS shows real-time heat rate, efficiency, and CO2e/MWh. Adjust parameters (inlet cooling, combined cycle) and see the CO2e impact instantly. Executive Summary quantifies $ savings from efficiency improvements.',
      techOptions: [
        { name: 'Brick Dispatch Smart Charging (Peak Shaving)', reduction: '15-25% CO2e reduction (fuel saved)', timeline: '1-2 weeks (software configuration)', cost: 'Included in Brick platform', complexity: 'low', permitosTab: 'simulation' },
        { name: 'Turbine Inlet Chilling (Refrigeration)', reduction: '3-5% CO2e reduction (efficiency gain)', timeline: '6-9 months (engineer + construct)', cost: '$3-5M (chiller + cooling tower upgrades)', complexity: 'high', permitosTab: 'intake' },
      ],
      tabLinks: [
        { tab: 'simulation', label: 'Run Energy Efficiency Optimization' },
        { tab: 'intake', label: 'Adjust Efficiency Parameters' },
        { tab: 'executive', label: 'Show $ Savings from Efficiency' },
      ],
      permitosCapability: 'PermitOS quantifies the cost and CO2e reduction of each efficiency option and auto-documents energy efficiency as part of GHG BACT for PSD applications.',
    },
  ],

  // ── CO2e PSD GHG (Tailoring Rule) ───────────────────────────────────────
  co2e_psd: [
    {
      step: 1,
      title: 'Prepare GHG BACT Analysis for PSD Permit (Month 1-3)',
      description: 'Develop GHG BACT analysis as part of the PSD permit application. EPA\'s GHG BACT guidance for stationary turbines evaluates BSER (Best System of Emission Reduction) options: (a) Energy efficiency (combined cycle >50% efficiency); (b) Carbon capture readiness (physical space + design provisions for future CCS); (c) Fuel switching (natural gas is already lowest-carbon fossil fuel); (d) Degradation of CO2e via carbon offsets is NOT allowed as BACT per EPA policy. Document each option with cost-effectiveness analysis.',
      regulation: '40 CFR 52.21(b)(1)(ii) — PSD applicability for GHGs (Tailoring Rule threshold: 75,000 tpy CO2e). Step 2 of GHG BACT: all available control technologies.',
      howPermitOSHelps: 'Open Air Permit AI → "GHG BACT Analysis" → PermitOS auto-generates the GHG BACT technical memo with 4-level evaluation: (1) identify candidate controls, (2) eliminate infeasible, (3) rank remaining by effectiveness, (4) select BSER. Documents tab produces the PSD GHG application section.',
      tabLinks: [
        { tab: 'air', label: 'Run GHG BACT Analysis Now', urgent: true },
        { tab: 'docs', label: 'Generate PSD GHG Application Section', urgent: true },
        { tab: 'simulation', label: 'Model Energy Efficiency Scenarios' },
      ],
      permitosCapability: 'PermitOS auto-generates EPA-format GHG BACT analysis with cost curves — saving 2-3 months of consultant work.',
    },
    {
      step: 2,
      title: 'Combined Cycle or Heat Recovery Evaluation (Month 2-6)',
      description: 'Commission engineering study for combined cycle conversion or heat recovery: (a) Simple-cycle to combined-cycle adds steam turbine bottoming cycle — increases efficiency from ~35% to >55%, reducing CO2e/MWh by 30-40%; (b) Heat recovery for district heating or industrial process — offsets natural gas elsewhere; (c) Evaluate economic feasibility at current and projected carbon prices ($50-100/ton CO2e). Combined cycle is the most defensible GHG BACT for large turbines.',
      regulation: 'EPA GHG BACT guidance identifies combined cycle efficiency as the primary BSER for stationary combustion turbines.',
      howPermitOSHelps: 'Executive Summary → "Timeline Acceleration" → PermitOS quantifies the cost and CO2e reduction of combined cycle conversion. Documents tab generates the feasibility study RFP. Milestones tab sets the 18-24 month engineering + construction timeline.',
      techOptions: [
        { name: 'Combined Cycle Bottoming Cycle Add-On', reduction: '30-40% CO2e/MWh reduction (~55% net efficiency)', timeline: '18-24 months (FEED + engineering + construction)', cost: '$50-100M (HRSG + steam turbine + BOP)', complexity: 'high', permitosTab: 'air' },
        { name: 'Heat Recovery for District Heating/Industrial', reduction: '15-25% CO2e offset (displaced heating load)', timeline: '12-18 months (design + construction)', cost: '$10-30M (heat exchangers + piping)', complexity: 'high', permitosTab: 'air' },
      ],
      tabLinks: [
        { tab: 'air', label: 'View Efficiency & Cost Analysis' },
        { tab: 'milestones', label: 'Combined Cycle Construction Timeline' },
        { tab: 'executive', label: 'Show GHG BACT Strategy & Risk Reduction' },
      ],
      permitosCapability: 'PermitOS integrates the combined cycle study results into the PSD permit application and updates all CO2e projections across the platform automatically.',
    },
  ],

  // ── Genset Runtime Breach ───────────────────────────────────────────────
  genset: [
    {
      step: 1,
      title: 'Immediately Reduce Genset Runtime to ≤100 hr/yr (Week 1)',
      description: 'Implement strict emergency runtime controls NOW. NSPS IIII/JJJJ limits emergency operation to 100 hr/yr total — and this includes maintenance runs AND emergency demand response. If current operations exceed this, you are in violation. Immediate actions: (a) Set Brick AI to prioritize battery dispatch over gensets during all grid events; (b) Disable auto-start for non-emergency demand response; (c) Reduce maintenance run duration from 60 min/month to 30 min/month; (d) If additional runtime is absolutely needed (grid reliability contracts), apply for non-emergency status.',
      regulation: '40 CFR 60 Subpart IIII (CI engines manufactured after 2006) — emergency operation limited to 100 hr/yr total. EPA Enforcement Alert: engines operating >100 hr/yr without non-emergency permit are in violation.',
      howPermitOSHelps: 'Open Intake tab → Set "Genset Hours" to 100 → recalculation shows compliance status. Simulation tab → "Dispatch Optimization" → set constraint "Max Emergency Engine Runtime: 100 hr/yr" → Brick automatically re-optimizes. Compliance OS shows real-time runtime tracking.',
      tabLinks: [
        { tab: 'intake', label: 'SET GENSET HOURS TO 100 NOW', urgent: true },
        { tab: 'simulation', label: 'Verify Brick Dispatch Covers Peak Events Without Gensets', urgent: true },
        { tab: 'compliance', label: 'Emergency Engine Runtime Dashboard' },
      ],
      permitosCapability: 'PermitOS Compliance OS tracks genset runtime in real-time and sends alerts when approaching the 100 hr/yr limit — preventing inadvertent violations.',
    },
    {
      step: 2,
      title: 'Install Non-Resettable Hour Meters (Week 2-4)',
      description: 'Per 40 CFR 60 Subpart IIII requirement, install non-resettable hour meters on ALL emergency gensets. Requirements: (a) Meters must be non-resettable and sealed; (b) Log ALL operation with reason code: "Emergency" (actual grid outage), "Maintenance" (scheduled run), "Demand Response" (only if permitted for non-emergency); (c) Maintain records for minimum 5 years for EPA inspection; (d) Include hour meter readings in semiannual compliance reports.',
      regulation: '40 CFR 60.4243(d) — hour meter requirement for emergency stationary CI engines. EPA Region guidance requires non-resettable meters.',
      howPermitOSHelps: 'Compliance OS → "Engine Compliance Log" → PermitOS auto-generates the hour meter reading log template and provides a digital tracking dashboard. Documents tab → "Generate Compliance Records" produces the semiannual compliance report with hour meter data.',
      tabLinks: [
        { tab: 'compliance', label: 'Set Up Hour Meter Tracking Log Now', urgent: true },
        { tab: 'docs', label: 'Generate Semiannual Compliance Report' },
      ],
      permitosCapability: 'PermitOS replaces manual hour meter logbooks with automated digital tracking — eliminating recordkeeping violations.',
    },
    {
      step: 3,
      title: 'Apply for Non-Emergency Engine Permit (Month 2-6, if >100 hr needed)',
      description: 'If the facility genuinely needs >100 hr/yr of genset operation (e.g., grid reliability contracts, black-start obligations), apply for non-emergency stationary engine permit. This triggers: (a) Title V operating permit requirements for engines; (b) NESHAP Subpart ZZZZ full compliance (not just emergency provisions); (c) NSPS emission limits for NOx, CO, PM (Tier 2/Tier 4 standards); (d) Oxidation catalyst may be required for CO and HAP control. Consider Tier 4 final engine upgrade for cleanest compliance.',
      regulation: '40 CFR 60 Subpart IIII (NSPS for CI engines), 40 CFR 63 Subpart ZZZZ (NESHAP for RICE), 40 CFR 70 (Title V operating permit).',
      howPermitOSHelps: 'Documents tab → "Engine Permit Application" → PermitOS auto-generates the non-emergency engine permit application including NSPS and NESHAP compliance demonstration. Compliance OS adds the new Title V conditions.',
      techOptions: [
        { name: 'Non-Emergency Title V Permit Application', reduction: 'Regulatory compliance — allows >100 hr/yr operation', timeline: '6-12 months (agency review)', cost: '$50-150K (consulting + application fees)', complexity: 'high', permitosTab: 'docs' },
        { name: 'Tier 4 Final Engine Retrofit (+ Permit)', reduction: '90%+ NOx/PM reduction vs. Tier 2', timeline: '4-8 months (engine replacement + permit)', cost: '$200-500K per engine (replacement or retrofit kit)', complexity: 'high', permitosTab: 'air' },
      ],
      tabLinks: [
        { tab: 'docs', label: 'Generate Non-Emergency Engine Permit Application', urgent: true },
        { tab: 'air', label: 'View Engine NSPS/NESHAP Requirements' },
        { tab: 'compliance', label: 'Add Title V Engine Conditions' },
      ],
      permitosCapability: 'PermitOS reduces non-emergency permit application time by 50% through auto-generated documents pre-populated with site-specific engine data.',
    },
    {
      step: 4,
      title: 'Implement NESHAP ZZZZ Compliance Program (Month 1, ongoing)',
      description: 'For all CI engines >500 hp, comply with NESHAP Subpart ZZZZ provisions: (a) Emergency engines: use NESHAP ZZZZ "emergency" provisions — maintenance practices per manufacturer, log all hours, change oil annually; (b) Non-emergency engines: full MACT compliance including oxidation catalyst, annual emissions testing, and continuous parametric monitoring; (c) All engines: maintain records of oil changes, air filter changes, coolant system maintenance for 5 years.',
      regulation: '40 CFR 63 Subpart ZZZZ (NESHAP for Stationary RICE). 40 CFR 63.6600-6675 (compliance requirements for CI engines).',
      howPermitOSHelps: 'Compliance OS → "Engine Compliance" section → PermitOS auto-generates the NESHAP ZZZZ compliance log, schedules oil changes and maintenance, and produces the annual compliance certification document.',
      tabLinks: [
        { tab: 'compliance', label: 'Set Up NESHAP ZZZZ Engine Compliance Program', urgent: true },
        { tab: 'docs', label: 'Generate Engine Compliance Records' },
        { tab: 'air', label: 'Review Engine NESHAP Requirements by HP' },
      ],
      permitosCapability: 'PermitOS automates NESHAP ZZZZ recordkeeping — oil change schedules, hour logs, maintenance records — all in one dashboard with auto-generated compliance reports.',
    },
  ],

  // ── NSPS Subpart KKKK Compliance ────────────────────────────────────────
  nsps: [
    {
      step: 1,
      title: 'Schedule Initial NSPS Performance Stack Test (Day 1 — Must be within 180 days of startup)',
      description: 'NSPS requires initial performance stack test within 180 days of turbine startup. CRITICAL: this deadline is NOT extendable. Actions: (a) Contact stack test contractor immediately (Reserve within first 30 days of operation — contractors book 6-12 weeks out); (b) Test protocol submittal to EPA/state agency 30 days before test; (c) Test conditions: full load, NOx + CO + O2 at 15% O2 reference; (d) If test shows exceedance, have DLN tuner on standby for immediate adjustments and re-test within 30 days.',
      regulation: '40 CFR 60.4330 (Subpart KKKK) — initial performance test within 180 days of startup and prior to construction approval. 40 CFR 60.8 (general stack test requirements).',
      howPermitOSHelps: 'Open Compliance OS → "Testing Schedule" → PermitOS auto-generates the stack test protocol document based on turbine specifications. The system calculates the 180-day deadline from your COD target and sends automated reminders at T-120, T-90, T-60, and T-30 days before deadline. Documents tab produces the stack test notification letter to the agency.',
      tabLinks: [
        { tab: 'compliance', label: 'Set Up 180-Day Stack Test Countdown Now', urgent: true },
        { tab: 'docs', label: 'Generate Stack Test Protocol & Agency Notification', urgent: true },
        { tab: 'milestones', label: 'View NSPS Compliance Timeline' },
      ],
      permitosCapability: 'PermitOS tracks the 180-day NSPS deadline automatically and alerts well in advance — stack test delays can result in EPA enforcement actions and fines.',
    },
    {
      step: 2,
      title: 'Establish Continuous Compliance Monitoring Program (Month 1-3, ongoing)',
      description: 'Set up ongoing NSPS compliance monitoring program: (a) Continuous Parametric Monitoring System (CPMS) — monitor combustion temperature, fuel flow rate, and load output as surrogate for emissions performance; (b) Annual compliance demonstration — repeat stack test or maintain CPMS data showing compliance; (c) Semiannual compliance reports — submit to EPA/state agency by March 31 and September 30; (d) Recordkeeping — maintain all CPMS data, fuel use records, and maintenance logs for minimum 5 years.',
      regulation: '40 CFR 60.4340-4420 (KKKK monitoring, recordkeeping, reporting). 40 CFR 60.7 (general semiannual reporting requirements).',
      howPermitOSHelps: 'Compliance OS → "Compliance Schedule" → PermitOS pre-configured annual NSPS compliance activities with automated reporting. The system generates semiannual compliance reports from operations data and submits via the agency portal interface. Simulation tab → "Continuous Monitoring" shows real-time CPMS data with NSPS limit overlays.',
      tabLinks: [
        { tab: 'compliance', label: 'Set Up Annual NSPS Compliance Schedule', urgent: true },
        { tab: 'simulation', label: 'View Real-Time CPMS Monitoring Dashboard' },
        { tab: 'docs', label: 'Generate Semiannual Compliance Report' },
      ],
      permitosCapability: 'PermitOS automates the entire NSPS compliance cycle — CPMS monitoring, annual testing, semiannual reporting — eliminating months of manual compliance paperwork each year.',
    },
    {
      step: 3,
      title: 'Seasonal DLN Tuning Program (Every 6 months, ongoing)',
      description: 'Implement seasonal DLN combustion tuning to ensure continuous NSPS compliance year-round: (a) Pre-summer tuning (April/May): optimize for NOx compliance at peak ambient temperatures — hotter inlet air increases NOx formation; (b) Pre-winter tuning (October/November): optimize for CO compliance at low loads — cold air increases O2 in combustion zone; (c) Maintain combustion dynamics monitoring during tuning to prevent flashback or pressure oscillations; (d) Document all tuning events in compliance records.',
      regulation: '40 CFR 60.4340 — CPMS monitoring and turbine compliance. Good engineering practice: seasonal tuning maintains NSPS compliance margin.',
      howPermitOSHelps: 'Air Permit AI → "DLN Optimization" → PermitOS stores baseline and tuned combustion parameters and tracks seasonal tuning schedule. Compliance OS auto-reminds every 6 months for tuning. Simulation tab shows NOx/CO trade-off at current ambient conditions.',
      tabLinks: [
        { tab: 'air', label: 'View DLN Tuning History & Schedule Next Tuning' },
        { tab: 'simulation', label: 'Combustion Performance Dashboard' },
        { tab: 'compliance', label: 'Track Tuning Events & Documentation' },
      ],
      permitosCapability: 'PermitOS maintains a complete tuning history record — critical for demonstrating good faith compliance during EPA investigations.',
    },
  ],
};

// ─── Breach-Based Risk Scoring Engine ─────────────────────────────────────────
export function calcRiskScore(pteResults, inputs) {
  const { baseline, controlled, pathway, water, breaches, thresholdAnalysis } = pteResults;
  let score = 100;
  const factors = [];

  // Derive risk factors from breaches
  if (breaches && breaches.length > 0) {
    const breachedBreaches = breaches.filter(b => b.status === 'BREACHED' && b.severity !== 'info');
    const mitigatedBreaches = breaches.filter(b => b.status === 'MITIGATED');

    breachedBreaches.forEach(b => {
      const impact = b.severity === 'critical' ? -30 : b.severity === 'high' ? -20 : b.severity === 'medium' ? -10 : -5;
      score += impact;
      factors.push({
        label: `${b.pollutant}: ${b.thresholdType} — ${b.description.substring(0, 80)}`,
        impact,
        severity: b.severity === 'critical' ? 'high' : b.severity,
      });
    });

    mitigatedBreaches.forEach(b => {
      const impact = b.severity === 'high' ? 15 : b.severity === 'medium' ? 10 : 5;
      score += impact;
      factors.push({
        label: `${b.pollutant}: ${b.thresholdType} — MITIGATED by Brick controls (${b.brickControl.substring(0, 60)})`,
        impact,
        severity: 'positive',
      });
    });
  }

  // Legacy factors for things not covered by threshold analysis
  if (inputs.nearestReceptorFt < 500) {
    score -= 10;
    factors.push({ label: 'Nearby sensitive receptors — AERMOD modeling critical', impact: -10, severity: 'high' });
  }
  if (water.annualWaterMG > 500) {
    score -= 5;
    factors.push({ label: 'High water use — 316(b) and NPDES scrutiny likely', impact: -5, severity: 'medium' });
  }
  if (inputs.gensetCount > 20) {
    score -= 5;
    factors.push({ label: 'Large genset fleet — IIII/JJJJ/ZZZZ compliance complexity', impact: -5, severity: 'medium' });
  }
  if (pathway.syntheticMinorViable) {
    score += 10;
    factors.push({ label: 'Brick controls enable synthetic minor pathway', impact: +10, severity: 'positive' });
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    factors,
    label: score >= 75 ? 'Low Risk' : score >= 50 ? 'Moderate Risk' : 'High Risk',
    color: score >= 75 ? 'green' : score >= 50 ? 'amber' : 'red',
    breachCount: breaches?.length || 0,
    breachedCount: breaches?.filter(b => b.status === 'BREACHED').length || 0,
    mitigatedCount: breaches?.filter(b => b.status === 'MITIGATED').length || 0,
  };
}

// ─── Timeline Builder ─────────────────────────────────────────────────────────
export function buildTimeline(state, isAttainment, siteMW) {
  const isComplex = siteMW > 500;
  const isNonAttain = !isAttainment;

  // Base weeks — PSD review is 9-18 months; streamlined path can be 6-12 mo
  const baseWeeks = {
    construction_sw: [1, 3],
    wetlands: [1, 4],
    site_intake: [1, 2],
    applicability: [2, 4],
    pte: [2, 4],
    bact: [3, 6],
    aermod: [4, 8],
    npdes: [2, 5],
    spcc: [3, 5],
    docs: [6, 10],
    submission: [10, 16],
    review: [16, 40],
    issuance: [36, 52],
  };

  if (isNonAttain) {
    baseWeeks.review = [20, 52];
    baseWeeks.issuance = [48, 78];
  }
  if (isComplex) {
    Object.keys(baseWeeks).forEach(k => {
      baseWeeks[k] = baseWeeks[k].map(w => Math.round(w * 1.25));
    });
  }

  return baseWeeks;
}

// ─── 24-hour Simulation ───────────────────────────────────────────────────────
export function simulate24h(inputs) {
  const { totalMW, brickSavings, heatRate, noxFactor, coolingMGD } = inputs;

  const hours = Array.from({ length: 24 }, (_, i) => i);
  // Realistic data center load profile: high base IT load (75-95%)
  // with diurnal variation driven by cooling load (ambient temp).
  // Larger facilities have flatter profiles (better thermal inertia).
  const sizeFactor = Math.min(1, Math.max(0.3, totalMW / 300));
  const flatness = 0.85 + sizeFactor * 0.1;
  const loadProfile = hours.map(h => {
    const itLoad = flatness + (1 - flatness) * 0.4 * (1 + Math.sin((h - 10) / 24 * 2 * Math.PI));
    const coolingFraction = 0.12 + 0.06 * Math.sin((h - 7) / 24 * 2 * Math.PI);
    const pue = 1.08 + coolingFraction;
    return Math.min(1, Math.max(0.75, itLoad / pue * 0.88));
  });

  const results = hours.map((h, i) => {
    const load = loadProfile[i];
    const mw = totalMW * load;
    const mmbtu = mw * heatRate;
    const noxLbHr = mmbtu * noxFactor;
    const waterGPM = coolingMGD * 694.4 * load; // convert MGD to GPM × load
    const saving = brickSavings / 100;

    return {
      hour: h,
      baseline_mw: +mw.toFixed(1),
      optimized_mw: +(mw * (1 - saving * 0.6)).toFixed(1),
      baseline_nox: +(noxLbHr).toFixed(2),
      optimized_nox: +(noxLbHr * (1 - saving)).toFixed(2),
      cooling_mw: +(mw * 0.32).toFixed(1),
      cooling_optimized: +(mw * 0.32 * (1 - saving * 0.8)).toFixed(1),
      water_gpm: +waterGPM.toFixed(0),
      water_optimized: +(waterGPM * (1 - saving * 0.65)).toFixed(0),
      battery_dispatch: +(mw * saving * 0.4 * Math.max(0, Math.sin(h / 24 * Math.PI))).toFixed(1),
    };
  });

  return results;
}

// ─── Permit Timeline Optimizer ────────────────────────────────────────────────
export function calcTimelineAcceleration() {
  const breakdown = {
    construction_sw:     { base: 4,  brick: 1,  label: 'Construction SW CGP NOI' },
    wetlands:            { base: 8,  brick: 2,  label: 'Wetlands/WOTUS Screening' },
    applicability:       { base: 14, brick: 3,  label: 'Air Applicability & PTE' },
    bact:                { base: 12, brick: 4,  label: 'BACT Top-Down Analysis' },
    aermod_protocol:     { base: 8,  brick: 2,  label: 'AERMOD Modeling Protocol' },
    aermod_run:          { base: 14, brick: 5,  label: 'AERMOD Modeling & Report' },
    spcc:                { base: 8,  brick: 2,  label: 'SPCC Plan' },
    npdes:               { base: 10, brick: 3,  label: 'NPDES Application' },
    doc_assembly:        { base: 10, brick: 3,  label: 'Permit Package Assembly' },
    agency_review_air:   { base: 26, brick: 20, label: 'Air Agency Review (typical)' },
    agency_review_water: { base: 16, brick: 12, label: 'Water Agency Review (typical)' },
  };
  const totalBaseline = Object.values(breakdown).reduce((s, v) => s + v.base, 0);
  const totalBrick    = Object.values(breakdown).reduce((s, v) => s + v.brick, 0);
  const saved = totalBaseline - totalBrick;
  const pctSaved = Math.round((saved / totalBaseline) * 100);
  return { breakdown, totalBaseline, totalBrick, saved, pctSaved };
}