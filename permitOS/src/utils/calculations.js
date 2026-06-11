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
  const baseline = {
    nox: annualMMBtu * noxFactor / 2000,
    co: annualMMBtu * coFactor / 2000,
    so2: annualMMBtu * 0.0006 / 2000,
    pm25: annualMMBtu * 0.0076 / 2000,
    voc: annualMMBtu * 0.0021 / 2000,
    co2e: annualMMBtu * 117 / 2000,
    hap: annualMMBtu * 0.00014 / 2000,
  };

  // Genset contributions (IIII/JJJJ)
  const gensetMMBtu = gensetCount * gensetHP * 0.00354 * gensetHours; // ~0.00354 MMBtu/hp-hr
  const gensetNox = gensetMMBtu * 0.024 / 2000;
  const gensetCO = gensetMMBtu * 0.006 / 2000;
  const gensetPM = gensetMMBtu * 0.025 / 2000;

  // Add genset emissions
  const totalBaseline = {
    nox: baseline.nox + gensetNox,
    co: baseline.co + gensetCO,
    so2: baseline.so2,
    pm25: baseline.pm25 + gensetPM,
    voc: baseline.voc,
    co2e: baseline.co2e,
    hap: baseline.hap,
  };

  const savingsFactor = 1 - (brickSavings / 100);

  const controlled = {
    nox: totalBaseline.nox * savingsFactor,
    co: totalBaseline.co * savingsFactor,
    so2: totalBaseline.so2 * savingsFactor,
    pm25: totalBaseline.pm25 * savingsFactor,
    voc: totalBaseline.voc * savingsFactor,
    co2e: totalBaseline.co2e * savingsFactor,
    hap: totalBaseline.hap * savingsFactor,
  };

  // PSD Major Source Thresholds (tpy) - attainment area defaults
  const psdThresholds = { nox: 100, co: 100, so2: 100, pm25: 100, voc: 100, co2e: 100000, hap: 10 };
  const majorThreshold = 250; // general major source (some industries 100)

  // Permit pathway determination
  const baselineTotal = totalBaseline.nox + totalBaseline.co + totalBaseline.so2 + totalBaseline.pm25 + totalBaseline.voc;
  const controlledTotal = controlled.nox + controlled.co + controlled.so2 + controlled.pm25 + controlled.voc;

  const pathway = {
    requiresPSD: totalBaseline.nox >= 100 || totalBaseline.co >= 100,
    requiresNSR: false, // determined by area status
    requiresTitleV: baselineTotal >= 100,
    syntheticMinorViable: controlledTotal < 100 && controlled.nox < 100 && controlled.co < 100,
    controlledBelowMajor: controlled.nox < 100 && controlled.co < 100,
  };

  // Water calcs
  const annualWaterMG = coolingMGD * 365;
  const blowdownMG = annualWaterMG * (blowdownPct / 100);
  const makeupMG = annualWaterMG + blowdownMG;
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
    genset: { gensetNox, gensetCO, gensetPM },
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
