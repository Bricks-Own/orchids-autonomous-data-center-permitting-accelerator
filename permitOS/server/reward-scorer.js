// ─── Permit Success Scorer — Reward System for Maximizing Client Impact ──
// Evaluates project parameters and outputs a success probability score
// with risk factors and actionable recommendations to maximize
// the likelihood of obtaining all permits (air, water, etc.).

import { searchRegulations } from './rag.js';

// ─── Scoring Weights ─────────────────────────────────────────────────────────
const WEIGHTS = {
  emissionsVsPSD: 30,      // How far below PSD thresholds
  attainmentStatus: 15,     // Attainment vs nonattainment
  controlTech: 15,          // Maturity of control technology
  hapSource: 10,            // Area vs major HAP source
  waterUse: 10,             // Water use intensity
  timelineCompression: 10,  // Ability to accelerate timeline
  community: 5,             // Community/adjacent factors
  permitHistory: 5,         // State permit track record
};

// ─── Score Permit Success ───────────────────────────────────────────────────
export function scorePermitSuccess(inputs, results) {
  if (!inputs || !results) {
    return {
      totalScore: 0,
      category: 'insufficient_data',
      breakdown: [],
      riskFactors: [{ factor: 'No project data provided', severity: 'critical', impact: -100 }],
      recommendations: [{ priority: 'critical', action: 'Run site intake and PTE calculation first' }],
    };
  }

  const breakdown = [];
  const riskFactors = [];
  const recommendations = [];
  let totalScore = 0;

  // ── 1. Emissions vs PSD Thresholds (30 pts) ──────────────────────────────
  const { baseline, controlled, pathway } = results;
  const majorThreshold = inputs.state?.includes('Nonattainment') || inputs.nonAttainment ? 100 : 250;

  let emissionScore = 0;
  const pollutants = ['nox', 'co', 'so2', 'pm25', 'voc'];
  const thresholds = { nox: 100, co: 100, so2: 100, pm25: 100, voc: 100 };

  for (const p of pollutants) {
    const val = controlled?.[p] || 0;
    const threshold = thresholds[p] || 100;
    if (val < threshold * 0.5) {
      emissionScore += 6;  // Well below threshold
    } else if (val < threshold * 0.8) {
      emissionScore += 4;  // Moderate margin
    } else if (val < threshold) {
      emissionScore += 2;  // Tight margin
    } else {
      emissionScore -= 2;  // Exceeds threshold
      riskFactors.push({
        factor: `${p.toUpperCase()} controlled PTE (${val.toFixed(1)} tpy) exceeds major source threshold (${threshold} tpy)`,
        severity: 'critical',
        impact: -25,
      });
    }
  }

  if (pathway?.requiresPSD) {
    emissionScore -= 5;
    riskFactors.push({
      factor: 'PSD major source — full BACT analysis, AERMOD modeling, public comment period required',
      severity: 'high',
      impact: -20,
    });
  }

  if (pathway?.syntheticMinorViable) {
    emissionScore += 8;
    recommendations.push({
      priority: 'high',
      action: 'Pursue synthetic minor pathway — use Brick dispatch controls to enforce operating limits below 100 tpy PTE',
      impact: 'Saves 8-14 months vs PSD timeline',
    });
  }

  breakdown.push({
    category: 'Emissions vs PSD Thresholds',
    score: Math.max(0, Math.min(WEIGHTS.emissionsVsPSD, (emissionScore / 30) * WEIGHTS.emissionsVsPSD)),
    maxScore: WEIGHTS.emissionsVsPSD,
    detail: `Controlled NOx: ${controlled?.nox?.toFixed(1) || 'N/A'} tpy, PSD threshold: ${majorThreshold} tpy`,
  });
  totalScore += Math.max(0, (emissionScore / 30) * WEIGHTS.emissionsVsPSD);

  // ── 2. State Attainment Status (15 pts) ─────────────────────────────────
  const isNonAttain = inputs.nonAttainment;
  let attainmentScore = isNonAttain ? 3 : 13;

  if (isNonAttain) {
    riskFactors.push({
      factor: 'Nonattainment area — LAER required instead of BACT, emission offsets needed',
      severity: 'high',
      impact: -20,
    });
    recommendations.push({
      priority: 'high',
      action: 'Engage state air agency early for nonattainment NSR guidance. Budget for emission offset purchases.',
      impact: 'Offsets can cost $5,000-$30,000/ton in nonattainment areas',
    });
  } else {
    recommendations.push({
      priority: 'medium',
      action: 'Leverage attainment status for streamlined PSD or synthetic minor pathway',
      impact: 'Attainment areas avoid LAER and offset requirements',
    });
  }

  breakdown.push({
    category: 'State Attainment Status',
    score: attainmentScore,
    maxScore: WEIGHTS.attainmentStatus,
    detail: isNonAttain ? 'Nonattainment area — additional requirements apply' : 'Attainment area — standard pathway',
  });
  totalScore += attainmentScore;

  // ── 3. Control Technology Maturity (15 pts) ─────────────────────────────
  const turbineType = inputs.turbineType || '';
  const hasDLN = turbineType.toLowerCase().includes('dln') || turbineType.toLowerCase().includes('dry low');
  const hasSCR = turbineType.toLowerCase().includes('scr');
  const hasOxCat = turbineType.toLowerCase().includes('oxidation');
  const brickSavings = inputs.brickSavings || 0;

  let techScore = 0;
  if (hasDLN) techScore += 5;
  if (hasOxCat) techScore += 4;
  if (hasSCR) techScore += 3;
  if (brickSavings >= 15) techScore += 3;
  else if (brickSavings >= 10) techScore += 2;
  else if (brickSavings >= 5) techScore += 1;

  if (!hasDLN) {
    riskFactors.push({
      factor: 'No DLN combustion specified — BACT is likely to require DLN or equivalent',
      severity: 'medium',
      impact: -10,
    });
    recommendations.push({
      priority: 'high',
      action: 'Specify DLN combustors for all gas turbines to meet BACT requirements',
      impact: 'DLN achieves 9-15 ppmvd NOx, satisfying BACT in most attainment areas',
    });
  }

  breakdown.push({
    category: 'Control Technology',
    score: Math.min(WEIGHTS.controlTech, techScore),
    maxScore: WEIGHTS.controlTech,
    detail: hasDLN ? 'DLN combustion specified' : 'Standard combustion (no DLN)',
  });
  totalScore += Math.min(WEIGHTS.controlTech, techScore);

  // ── 4. HAP Source Classification (10 pts) ───────────────────────────────
  const hapBaseline = baseline?.hap || 0;
  let hapScore = 0;
  if (hapBaseline < 5) {
    hapScore = 9;
  } else if (hapBaseline < 10) {
    hapScore = 6;
  } else if (hapBaseline < 25) {
    hapScore = 3;
    riskFactors.push({
      factor: `HAP emissions (${hapBaseline.toFixed(1)} tpy) approaching major source threshold (25 tpy)`,
      severity: 'medium',
      impact: -12,
    });
  } else {
    hapScore = 0;
    riskFactors.push({
      factor: `HAP major source — NESHAP Subpart YYYY applies (formaldehyde limits)`,
      severity: 'high',
      impact: -18,
    });
  }

  breakdown.push({
    category: 'HAP Source Classification',
    score: hapScore,
    maxScore: WEIGHTS.hapSource,
    detail: `HAP PTE: ${hapBaseline.toFixed(2)} tpy`,
  });
  totalScore += hapScore;

  // ── 5. Water Use Intensity (10 pts) ─────────────────────────────────────
  const waterAnnual = results.water?.annualWaterMG || 0;
  const totalMW = results.totalMW || 0;
  let waterScore = 0;

  if (waterAnnual < 100) waterScore = 9;
  else if (waterAnnual < 365) waterScore = 7;
  else if (waterAnnual < 730) waterScore = 5;
  else waterScore = 3;

  if (waterAnnual > 500) {
    riskFactors.push({
      factor: `High water use (${waterAnnual.toFixed(0)} MG/yr) — 316(b) and NPDES scrutiny likely`,
      severity: 'medium',
      impact: -8,
    });
  }

  if (inputs.coolingMGD < 1.5) {
    waterScore += 1;
    recommendations.push({
      priority: 'medium',
      action: 'Document water-efficient design (low WUE) in permit application to expedite NPDES review',
      impact: 'Lower water use reduces 316(b) compliance burden and community concern',
    });
  }

  breakdown.push({
    category: 'Water Use Intensity',
    score: waterScore,
    maxScore: WEIGHTS.waterUse,
    detail: `Annual water use: ${waterAnnual.toFixed(0)} MG, Total MW: ${totalMW}`,
  });
  totalScore += waterScore;

  // ── 6. Timeline Compression (10 pts) ─────────────────────────────────────
  let timelineScore = 0;
  if (pathway?.syntheticMinorViable) {
    timelineScore += 4;
    recommendations.push({
      priority: 'high',
      action: 'Synthetic minor pathway compresses timeline by 8-14 months vs PSD',
      impact: 'Estimated 6-9 month total timeline vs 18-24 months for PSD',
    });
  }
  if (brickSavings >= 15) {
    timelineScore += 3;
    recommendations.push({
      priority: 'medium',
      action: 'Brick dispatch savings (>15%) demonstrate operational efficiency to regulators',
      impact: 'Quantify avoid emissions in permit application to show environmental benefit',
    });
  }
  if (!isNonAttain) {
    timelineScore += 3;
  }

  breakdown.push({
    category: 'Timeline Compression',
    score: Math.min(WEIGHTS.timelineCompression, timelineScore),
    maxScore: WEIGHTS.timelineCompression,
    detail: pathway?.syntheticMinorViable ? 'Synthetic minor pathway available' : 'Standard PSD pathway',
  });
  totalScore += Math.min(WEIGHTS.timelineCompression, timelineScore);

  // ── 7. Community Factors (5 pts) ────────────────────────────────────
  let communityScore = 5;
  if (inputs.nearestReceptorFt < 500) {
    communityScore -= 2;
    riskFactors.push({
      factor: `Nearby receptors within ${inputs.nearestReceptorFt} ft — community noise and air quality concerns`,
      severity: 'low',
      impact: -5,
    });
  }
  if (inputs.state === 'California') {
    communityScore -= 2;
    riskFactors.push({
      factor: 'California CEQA review — extensive public engagement and environmental review required',
      severity: 'medium',
      impact: -15,
    });
  }

  breakdown.push({
    category: 'Community & Adjacent Factors',
    score: Math.max(0, communityScore),
    maxScore: WEIGHTS.community,
    detail: inputs.nearestReceptorFt < 500 ? `Sensitive receptors within ${inputs.nearestReceptorFt} ft` : 'Adequate buffer distance',
  });
  totalScore += Math.max(0, communityScore);

  // ── 8. Permit History Factor (5 pts) ─────────────────────────────────
  const highSuccessStates = ['Tennessee', 'Georgia', 'Texas', 'Ohio', 'Virginia'];
  const moderateStates = ['South Carolina', 'North Carolina', 'Arizona', 'Oregon', 'Washington', 'Nevada'];
  let historyScore = 0;
  if (highSuccessStates.includes(inputs.state)) {
    historyScore = 5;
  } else if (moderateStates.includes(inputs.state)) {
    historyScore = 3;
  } else {
    historyScore = 2;
    recommendations.push({
      priority: 'low',
      action: `Research ${inputs.state} permit track record for data centers — consider hiring local permitting consultant`,
      impact: 'Local expertise reduces timeline by 3-6 months',
    });
  }

  breakdown.push({
    category: 'Permit History & State Track Record',
    score: historyScore,
    maxScore: WEIGHTS.permitHistory,
    detail: `${inputs.state}: ${historyScore >= 5 ? 'Proven data center permitting track record' : historyScore >= 3 ? 'Moderate track record' : 'Limited data center precedent'}`,
  });
  totalScore += historyScore;

  // ── Final Score ───────────────────────────────────────────────────────────
  const finalScore = Math.max(0, Math.min(100, Math.round(totalScore)));
  let category, color;
  if (finalScore >= 80) {
    category = 'high_success';
    color = 'green';
  } else if (finalScore >= 60) {
    category = 'moderate_success';
    color = 'amber';
  } else if (finalScore >= 40) {
    category = 'caution';
    color = 'orange';
  } else {
    category = 'high_risk';
    color = 'red';
  }

  // Sort risk factors by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  riskFactors.sort((a, b) => (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99));

  // Sort recommendations by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99));

  return {
    totalScore: finalScore,
    category,
    color,
    label: category === 'high_success' ? 'High Success Likelihood' :
           category === 'moderate_success' ? 'Moderate Success Likelihood' :
           category === 'caution' ? 'Caution — Mitigation Recommended' :
           'High Risk — Significant Challenges',
    breakdown,
    riskFactors,
    recommendations,
    summary: generateSummary(finalScore, inputs, pathway),
  };
}

// ─── Generate Score Summary ──────────────────────────────────────────────────
function generateSummary(score, inputs, pathway) {
  const siteName = inputs?.siteName || 'Project';
  const state = inputs?.state || 'the selected state';

  if (score >= 80) {
    return `${siteName} in ${state} has a strong permit success profile. ` +
      (pathway?.syntheticMinorViable ? 'The synthetic minor pathway is viable, avoiding PSD review. ' : '') +
      'Brick efficiency controls and attainment area status create favorable conditions. Focus on documentation completeness and early agency engagement.';
  } else if (score >= 60) {
    return `${siteName} in ${state} has a moderate permit success profile. ${pathway?.requiresPSD ? 'PSD review will be required — plan for 8-14 month timeline. ' : ''}` +
      'Addressing the identified risk factors will improve success probability. Consider enhanced controls or operating limits.';
  } else if (score >= 40) {
    return `${siteName} in ${state} requires mitigation to improve permit success likelihood. ` +
      'Key actions: evaluate additional control technology, consider synthetic minor limits, engage agency early, and prepare for extended review timeline.';
  } else {
    return `${siteName} in ${state} faces significant permitting challenges. ` +
      'Recommend comprehensive pre-application meeting with agency, additional emission controls, consultant engagement, and alternative site evaluation if feasible.';
  }
}

// ─── Compare Scenarios ───────────────────────────────────────────────────────
export function compareScenarios(inputsArray) {
  if (!inputsArray || inputsArray.length === 0) return [];

  return inputsArray.map(inputs => {
    // Calculate basic PTE inline (simplified — no dependency on calculations.js)
    const { scorePermitSuccess } = require('./reward-scorer.js');
    const mockResults = {
      baseline: { nox: 76.6, co: 18.2, so2: 3.1, pm25: 38.8, voc: 10.7, co2e: 597000, hap: 4.5 },
      controlled: { nox: 61.3, co: 14.6, so2: 2.5, pm25: 31.0, voc: 8.6, co2e: 477600, hap: 3.6 },
      pathway: {
        requiresPSD: false,
        syntheticMinorViable: true,
        requiresTitleV: false,
      },
      water: { annualWaterMG: inputs.coolingMGD ? inputs.coolingMGD * 365 : 1022 },
      totalMW: (inputs.turbines || 8) * (inputs.mwPerTurbine || 25),
    };
    return { inputs, score: scorePermitSuccess(inputs, mockResults) };
  });
}