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

// ─── Structured Breach Detection ─────────────────────────────────────────────
export function generateBreachAnalysis(inputs, results, thresholds) {
  const breaches = [];
  const state = inputs.state || '';

  // Helper to build remediation plan
  const buildPlan = (pollutantKey, isBreached, severity) => {
    const plans = REMEDIATION_PLANS[pollutantKey];
    if (!plans) return [];
    return plans.map((step, i) => ({
      ...step,
      stepNumber: i + 1,
      applicable: step.minSeverity ? severity >= step.minSeverity : true,
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

// ─── Structured Remediation Plans ─────────────────────────────────────────────
// Each plan has steps with tech options, tab links, and implementation guidance
const REMEDIATION_PLANS = {
  nox: [
    {
      title: 'Optimize Brick Dispatch Controls',
      description: 'Configure Brick AI dispatch optimization to reduce turbine operating hours during peak NOx-forming conditions. Set NOx emission limit as a dispatch constraint target. Implement load-shedding algorithms that prioritize low-NOx operating regimes.',
      techOptions: [
        { name: 'Brick Dispatch Optimizer', reduction: '15-25% NOx reduction', timeline: '1-2 weeks', cost: 'Included in Brick platform', complexity: 'low' },
        { name: 'Load Limiting Schedule', reduction: '10-20% NOx reduction', timeline: '1 week', cost: 'Software configuration', complexity: 'low' },
      ],
      tabLinks: [
        { tab: 'simulation', label: 'Run Dispatch Optimization' },
        { tab: 'intake', label: 'Adjust Brick Savings %' },
      ],
    },
    {
      title: 'Tune DLN Combustion System',
      description: 'Optimize Dry Low NOx (DLN) combustion tuning parameters. Adjust fuel/air ratio, pilot fuel staging, and combustion reference temperature to minimize NOx formation while maintaining CO compliance. Target: 9 ppmvd NOx @ 15% O2.',
      techOptions: [
        { name: 'DLN Tuning Optimization', reduction: '30-50% from baseline', timeline: '2-4 weeks', cost: '$50-80K (tuning service)', complexity: 'medium' },
        { name: 'DLN Advanced Fuel Staging', reduction: '40-60% from baseline', timeline: '4-8 weeks', cost: '$100-200K (hardware mod)', complexity: 'high' },
      ],
      tabLinks: [
        { tab: 'air', label: 'View BACT Analysis' },
        { tab: 'simulation', label: 'Verify NOx Performance' },
      ],
    },
    {
      title: 'Install SCR Post-Combustion Control',
      description: 'Selective Catalytic Reduction (SCR) system with aqueous ammonia or urea injection. Achieves 85-95% NOx reduction. Required for PSD BACT and essential if nonattainment LAER applies. Includes continuous emissions monitoring (CEMS) for NH3 slip.',
      techOptions: [
        { name: 'SCR with Aqueous Ammonia', reduction: '85-90% NOx removal', timeline: '6-9 months', cost: '$500-800K per turbine', complexity: 'high' },
        { name: 'SCR with Urea', reduction: '80-90% NOx removal', timeline: '6-9 months', cost: '$600-900K per turbine', complexity: 'high' },
        { name: 'Hybrid SCR + Oxidation Catalyst', reduction: '90-95% NOx + 90% CO', timeline: '7-10 months', cost: '$800K-1.2M per turbine', complexity: 'high' },
      ],
      tabLinks: [
        { tab: 'air', label: 'BACT Analysis for SCR' },
        { tab: 'compliance', label: 'Add CEMS Condition' },
        { tab: 'docs', label: 'Generate Permit Application' },
      ],
    },
    {
      title: 'Continuous NOx Monitoring & Compliance',
      description: 'Install EPA-compliant continuous emissions monitoring system (CEMS) for NOx. Implement data management for Title V periodic monitoring. Set up compliance reports for state air agency. Configure alarm thresholds for exceedance prevention.',
      techOptions: [
        { name: 'CEMS (Extractive)', reduction: 'Monitoring only', timeline: '3-4 months', cost: '$150-250K installed', complexity: 'medium' },
        { name: 'Predictive Emissions Monitoring', reduction: 'Monitoring only', timeline: '2-3 months', cost: '$80-120K', complexity: 'medium' },
      ],
      tabLinks: [
        { tab: 'compliance', label: 'Add NOx Monitoring Condition' },
        { tab: 'simulation', label: 'Track NOx in Real-Time' },
      ],
    },
    {
      title: 'PSD Permit Application with BACT',
      description: 'Prepare and submit PSD permit application including BACT top-down analysis, air quality impact analysis (AERMOD), Class I area review, and public participation documentation. Coordinate with state air agency and EPA Region.',
      techOptions: [
        { name: 'Full PSD Application', reduction: 'N/A - permitting', timeline: '9-18 months', cost: '$200-500K (consultant)', complexity: 'high' },
        { name: 'Brick PermitOS Auto-Generated', reduction: 'N/A - permitting', timeline: '4-8 months', cost: 'Included in platform', complexity: 'medium' },
      ],
      tabLinks: [
        { tab: 'docs', label: 'Generate PSD Documents' },
        { tab: 'milestones', label: 'PSD Timeline' },
        { tab: 'copilot', label: 'RAI Response Prep' },
      ],
    },
  ],
  nox_nonattain: [
    {
      title: 'LAER Technology Review',
      description: 'Perform Lowest Achievable Emission Rate (LAER) analysis as required by CAA §173 for nonattainment NSR. LAER is more stringent than BACT — must be the most stringent emission limit achieved in practice. SCR with 90%+ reduction is typically LAER for gas turbines.',
      techOptions: [
        { name: 'SCR + Oxidation Catalyst', reduction: '90-95% NOx', timeline: '7-10 months', cost: '$800K-1.2M per turbine', complexity: 'high' },
        { name: 'Advanced DLN + SCR', reduction: '95%+ NOx', timeline: '8-12 months', cost: '$1-1.5M per turbine', complexity: 'high' },
      ],
      tabLinks: [
        { tab: 'air', label: 'LAER Analysis' },
        { tab: 'docs', label: 'NNSR Application' },
      ],
    },
    {
      title: 'Secure Emissions Offsets',
      description: 'Procure emissions offsets at ratio ≥1.3:1 (severe nonattainment). Each ton of NOx increase requires 1.3 tons of offset reductions from existing sources in the same nonattainment area. Offsets can be purchased from EPA-approved offset registries or negotiated with local sources.',
      techOptions: [
        { name: 'EPA Offset Registry Purchase', reduction: 'N/A - offsets', timeline: '3-6 months', cost: '$50-200K per ton', complexity: 'high' },
        { name: 'Bilateral Offset Agreement', reduction: 'N/A - offsets', timeline: '4-8 months', cost: 'Negotiable', complexity: 'high' },
      ],
      tabLinks: [
        { tab: 'compliance', label: 'Offsets Tracking' },
        { tab: 'milestones', label: 'NNSR Timeline' },
      ],
    },
    {
      title: 'NNSR Permit Application',
      description: 'Prepare nonattainment NSR permit application demonstrating LAER compliance, offsets procurement, alternative sites analysis, and public benefit. Coordinate with state/local air agency. Public hearing likely required.',
      tabLinks: [
        { tab: 'docs', label: 'Generate NNSR Package' },
        { tab: 'copilot', label: 'Draft Public Notice' },
      ],
    },
  ],
  co: [
    {
      title: 'Oxidation Catalyst Installation',
      description: 'Install oxidation catalyst for CO control. CO oxidation catalysts achieve 90%+ reduction at gas turbine exhaust temperatures. Combined with VOC/HAP oxidation for multi-pollutant control. Typical catalyst: precious metal (Pt/Pd) on ceramic monolith.',
      techOptions: [
        { name: 'CO Oxidation Catalyst', reduction: '90-95% CO reduction', timeline: '4-6 months', cost: '$200-400K per turbine', complexity: 'medium' },
        { name: 'Combined Oxidation + SCR', reduction: '90% CO + 90% NOx', timeline: '7-10 months', cost: '$800K-1.2M per turbine', complexity: 'high' },
      ],
      tabLinks: [
        { tab: 'air', label: 'View CO Controls' },
        { tab: 'simulation', label: 'Optimize CO Performance' },
      ],
    },
    {
      title: 'Combustion Tuning for CO',
      description: 'Tune combustion system to balance NOx/CO trade-off. CO increases at low loads and during DLN mode transitions. Optimize load ramp rates and minimum load setpoints to maintain CO compliance.',
      techOptions: [
        { name: 'Combustion Tuning', reduction: '20-40% CO reduction', timeline: '2-3 weeks', cost: '$30-50K', complexity: 'medium' },
        { name: 'Advanced Combustion Control', reduction: '30-50% CO reduction', timeline: '4-8 weeks', cost: '$80-150K', complexity: 'high' },
      ],
      tabLinks: [
        { tab: 'air', label: 'CO Reduction Analysis' },
        { tab: 'intake', label: 'Adjust Operating Parameters' },
      ],
    },
  ],
  pm25: [
    {
      title: 'PM2.5 Emission Verification',
      description: 'Verify PM2.5 emissions through stack testing. Natural gas combustion produces primarily condensable PM2.5. EPA Method 202 for condensable PM. Confirm actual emission factor vs. AP-42 default.',
      techOptions: [
        { name: 'EPA Method 202 Stack Test', reduction: 'Verification only', timeline: '4-6 weeks', cost: '$30-50K', complexity: 'medium' },
        { name: 'Continuous PM Monitor', reduction: 'Monitoring only', timeline: '3-4 months', cost: '$100-150K', complexity: 'medium' },
      ],
      tabLinks: [
        { tab: 'air', label: 'PM Analysis' },
        { tab: 'compliance', label: 'Test Schedule' },
      ],
    },
    {
      title: 'Fuel Purity Assurance',
      description: 'Ensure pipeline natural gas quality per tariff specifications. Request gas composition analysis from supplier. Maintain fuel gas filtering to remove particulates and liquids.',
      tabLinks: [
        { tab: 'intake', label: 'Fuel Specs' },
        { tab: 'compliance', label: 'Fuel Quality Log' },
      ],
    },
  ],
  voc: [
    {
      title: 'Oxidation Catalyst for VOC',
      description: 'Oxidation catalyst reduces VOC emissions by 90%+. Combined with CO catalyst. Essential for ozone nonattainment areas where VOC is regulated as precursor.',
      techOptions: [
        { name: 'VOC Oxidation Catalyst', reduction: '85-95% VOC', timeline: '4-6 months', cost: '$200-400K', complexity: 'medium' },
        { name: 'Combined CO/VOC Catalyst', reduction: '90% VOC + 90% CO', timeline: '4-6 months', cost: '$250-450K', complexity: 'medium' },
      ],
      tabLinks: [
        { tab: 'air', label: 'VOC Control Analysis' },
        { tab: 'simulation', label: 'VOC Optimization' },
      ],
    },
  ],
  hap: [
    {
      title: 'HAP Emission Inventory',
      description: 'Complete HAP emission inventory using EPA AP-42 factors or stack test data. Identify individual HAP compounds (formaldehyde, acrolein, benzene from combustion; diesel HAP from gensets). Determine if any single HAP exceeds 10 tpy. Maintain area source status if possible.',
      tabLinks: [
        { tab: 'air', label: 'HAP Analysis' },
        { tab: 'compliance', label: 'HAP Inventory' },
      ],
    },
    {
      title: 'NESHAP Subpart YYYY Compliance Plan',
      description: 'If major HAP source, develop NESHAP Subpart YYYY compliance plan. MACT standards for gas turbines: formaldehyde, benzene, and other HAP limits. Title V permit amendment to include HAP conditions. Annual compliance certification.',
      techOptions: [
        { name: 'MACT Compliance Plan', reduction: 'Regulatory compliance', timeline: '3-6 months', cost: '$50-100K', complexity: 'high' },
        { name: 'Oxidation Catalyst', reduction: '50-70% HAP reduction', timeline: '4-6 months', cost: '$200-400K', complexity: 'medium' },
      ],
      tabLinks: [
        { tab: 'docs', label: 'NESHAP Application' },
        { tab: 'compliance', label: 'MACT Compliance' },
      ],
    },
  ],
  co2e: [
    {
      title: 'Register for EPA eGGRT',
      description: 'Register facility in EPA\'s electronic Greenhouse Gas Reporting Tool (eGGRT). Required for facilities with >25,000 tpy CO2e. Set up Subpart C (stationary combustion) reporting. Annual report due March 31.',
      tabLinks: [
        { tab: 'compliance', label: 'Add GHGRP Condition' },
        { tab: 'docs', label: 'GHG Report Template' },
      ],
    },
    {
      title: 'Implement Carbon Management',
      description: 'Develop GHG management program. Track CO2e from all sources (turbines, gensets, fugitives). Evaluate carbon offsets or renewable energy credits. Prepare for potential future carbon pricing.',
      techOptions: [
        { name: 'Carbon Offsets (VER/VCS)', reduction: '10-50% offset', timeline: '3-6 months', cost: '$10-50/ton', complexity: 'low' },
        { name: 'CCS Feasibility Study', reduction: '85-95% capture', timeline: '12-18 months', cost: '$1-5M study phase', complexity: 'high' },
      ],
      tabLinks: [
        { tab: 'simulation', label: 'Carbon Optimization' },
        { tab: 'compliance', label: 'GHG Tracking' },
      ],
    },
    {
      title: 'Energy Efficiency Optimization',
      description: 'Improve heat rate through combined cycle conversion or turbine inlet chilling. Each 1% efficiency improvement reduces CO2e proportionally. Brick dispatch optimization already achieves 15-20% fuel savings from peak shaving.',
      techOptions: [
        { name: 'Brick Dispatch Smart Charging', reduction: '15-25% CO2e', timeline: '1-2 weeks', cost: 'Software configuration', complexity: 'low' },
        { name: 'Turbine Inlet Cooling', reduction: '3-5% CO2e', timeline: '6-9 months', cost: '$3-5M', complexity: 'high' },
      ],
      tabLinks: [
        { tab: 'simulation', label: 'Energy Optimization' },
        { tab: 'intake', label: 'Efficiency Parameters' },
      ],
    },
  ],
  co2e_psd: [
    {
      title: 'GHG BACT Analysis',
      description: 'Perform BACT for GHG as part of PSD permit. EPA\'s "BSER" (Best System of Emission Reduction) for stationary turbines includes efficiency improvements. Current guidance: combined cycle efficiency >50% or CCS readiness.',
      tabLinks: [
        { tab: 'air', label: 'GHG BACT Analysis' },
        { tab: 'docs', label: 'PSD GHG Application' },
      ],
    },
    {
      title: 'Combined Cycle Conversion Study',
      description: 'Evaluate combined cycle conversion to recover exhaust heat. Increases net efficiency from ~35% to >55%, proportionally reducing CO2e per MWh. Significant capital investment but improves overall permit positioning.',
      techOptions: [
        { name: 'Combined Cycle Add-On', reduction: '30-40% CO2e/MWh', timeline: '18-24 months', cost: '$50-100M', complexity: 'high' },
        { name: 'Heat Recovery for District Heating', reduction: '15-25% CO2e offset', timeline: '12-18 months', cost: '$10-30M', complexity: 'high' },
      ],
      tabLinks: [
        { tab: 'air', label: 'Efficiency Analysis' },
        { tab: 'milestones', label: 'Construction Timeline' },
      ],
    },
  ],
  genset: [
    {
      title: 'Reduce Emergency Runtime to ≤100 hr/yr',
      description: 'Implement strict runtime management for emergency gensets. NSPS IIII/JJJJ limits emergency operation to 100 hr/yr total (maintenance + emergency demand response). Brick optimization reduces need for genset dispatch during peak events.',
      tabLinks: [
        { tab: 'intake', label: 'Set Genset Hours to 100' },
        { tab: 'simulation', label: 'Verify Genset Dispatch Reduction' },
      ],
    },
    {
      title: 'Install Non-Resettable Hour Meters',
      description: 'Per 40 CFR 60 Subpart IIII, install non-resettable hour meters on all emergency gensets. Log all operation with reason code (emergency vs. maintenance). Maintain records for agency inspection.',
      tabLinks: [
        { tab: 'compliance', label: 'Engine Compliance Log' },
        { tab: 'docs', label: 'Generate Compliance Records' },
      ],
    },
    {
      title: 'Apply for Non-Emergency Permit (if needed)',
      description: 'If >100 hr/yr operation is necessary for demand response or grid services, apply for non-emergency stationary engine permit. This triggers additional Title V and MACT requirements. Consider Tier 4 final engine upgrade.',
      techOptions: [
        { name: 'Non-Emergency Title V Permit', reduction: 'Regulatory compliance', timeline: '6-12 months', cost: '$50-150K', complexity: 'high' },
        { name: 'Tier 4 Final Engine Retrofit', reduction: '90%+ NOx/PM reduction', timeline: '4-8 months', cost: '$200-500K per engine', complexity: 'high' },
      ],
      tabLinks: [
        { tab: 'air', label: 'Engine Requirements' },
        { tab: 'docs', label: 'Permit Application' },
      ],
    },
    {
      title: 'NESHAP ZZZZ Compliance',
      description: 'For CI engines >500 hp, comply with NESHAP Subpart ZZZZ. Includes maintenance practices, recordkeeping, and reporting. Emergency engines must log all operation hours.',
      tabLinks: [
        { tab: 'compliance', label: 'Engine Compliance' },
        { tab: 'docs', label: 'Compliance Records' },
      ],
    },
  ],
  nsps: [
    {
      title: 'Initial Performance Stack Test',
      description: 'Schedule and perform initial NSPS performance stack test within 180 days of turbine startup. Test for NOx, CO, and O2 at full load. Demonstrate compliance with 15 ppmvd NOx and 20 ppmvd CO @ 15% O2.',
      tabLinks: [
        { tab: 'compliance', label: 'Testing Schedule' },
        { tab: 'docs', label: 'Stack Test Protocol' },
      ],
    },
    {
      title: 'Annual Compliance Testing Program',
      description: 'Establish annual NOx compliance testing program per NSPS KKKK requirements. Maintain continuous parametric monitoring (CPMS) for combustion temperature, fuel flow, and load. Submit semiannual compliance reports.',
      tabLinks: [
        { tab: 'compliance', label: 'Compliance Schedule' },
        { tab: 'simulation', label: 'Continuous Monitoring' },
      ],
    },
    {
      title: 'DLN Tuning for NSPS Compliance',
      description: 'Ensure DLN combustion system consistently meets 15 ppmvd NOx. Tune combustion parameters seasonally. Maintain combustion dynamics monitoring to prevent flashback or blowout.',
      tabLinks: [
        { tab: 'air', label: 'DLN Optimization' },
        { tab: 'simulation', label: 'Combustion Monitoring' },
      ],
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
  const loadProfile = hours.map(h => {
    const base = 0.65 + 0.2 * Math.sin((h - 6) / 24 * 2 * Math.PI) + 0.05 * Math.sin(h / 12 * Math.PI);
    return Math.min(1, Math.max(0.3, base));
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