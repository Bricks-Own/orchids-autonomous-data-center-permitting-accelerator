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
    hapMajorSource: totalBaseline.hap >= 25,
    hapSinglePollutantReviewRequired: totalBaseline.hap >= 10,
    significantEmissionRatesExceeded: {
      nox: totalBaseline.nox >= 40,
      co: totalBaseline.co >= 100,
      so2: totalBaseline.so2 >= 40,
      pm25: totalBaseline.pm25 >= 10,
      voc: totalBaseline.voc >= 40,
    },
    note: 'Significant emission rates are screening flags for PSD applicability analysis and do not independently determine new-source major status.',
  };

  // Water calcs
  const annualWaterMG = coolingMGD * 365;
  const blowdownMG = annualWaterMG * (blowdownPct / 100);
  const makeupMG = annualWaterMG + blowdownMG;
  // Brick's 20% energy savings translates to proportional water savings
  // via reduced cooling load and optimized cycles of concentration
  const optimizedWater = annualWaterMG * savingsFactor;

  return {
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

// ─── Risk Scoring Engine ─────────────────────────────────────────────────────
export function calcRiskScore(pteResults, inputs) {
  const { baseline, controlled, pathway, water } = pteResults;
  let score = 100;
  const factors = [];

  if (pathway.requiresPSD) {
    score -= 25;
    factors.push({ label: 'PSD Major Source — BACT Required', impact: -25, severity: 'high' });
  }
  if (baseline.nox > 250) {
    score -= 15;
    factors.push({ label: 'NOx exceeds 250 tpy — Full AERMOD modeling burden', impact: -15, severity: 'high' });
  } else if (baseline.nox > 100) {
    score -= 10;
    factors.push({ label: 'NOx 100–250 tpy — PSD Major, BACT analysis needed', impact: -10, severity: 'medium' });
  }
  if (inputs.nonAttainment) {
    score -= 20;
    factors.push({ label: 'Nonattainment NSR — LAER + offsets required', impact: -20, severity: 'high' });
  }
  if (baseline.hap >= 25) {
    score -= 15;
    factors.push({ label: 'HAP Major Source — Subpart YYYY full applicability', impact: -15, severity: 'high' });
  } else if (baseline.hap >= 10) {
    score -= 8;
    factors.push({ label: 'HAP near major threshold — confirm applicability', impact: -8, severity: 'medium' });
  }
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
  if (controlled.nox < 50) {
    score += 5;
    factors.push({ label: 'Brick controls keep NOx well below 100 tpy PSD threshold', impact: +5, severity: 'positive' });
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    factors,
    label: score >= 75 ? 'Low Risk' : score >= 50 ? 'Moderate Risk' : 'High Risk',
    color: score >= 75 ? 'green' : score >= 50 ? 'amber' : 'red',
  };
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
