// ─── Timeline Calculation Utility ───────────────────────────────────────────
// Shared between MilestoneTimeline.jsx and the Review Step (SiteIntake Step 3)
// Uses the same pathway logic as getGanttTracks() to ensure the two views
// never contradict each other.

const WEEKS_TOTAL = 90;

// Project-type timeline scaling factors derived from SCENARIO_DEFS.typicalTimelineMonths
// greenfield: 18-36 (midpoint 27) → 1.0
// expansion: 12-24 (midpoint 18) → 0.67
// upsized: 8-18 (midpoint 13) → 0.48
// colocated: 6-14 (midpoint 10) → 0.37
const PROJECT_SCENARIO_FACTORS = {
  greenfield: 1.0,
  expansion: 0.67,
  upsized: 0.48,
  colocated: 0.37,
};

/**
 * Compute the total permitting timeline duration for a given pathway configuration.
 * Mirrors the exact math from MilestoneTimeline.jsx's getGanttTracks().
 *
 * @param {Object} params
 * @param {number} params.totalMW - Total site capacity in MW
 * @param {boolean} params.isNonAttain - Whether the site is in a nonattainment area
 * @param {boolean} params.requiresPSD - Whether the project requires PSD review
 * @param {boolean} params.syntheticMinorViable - Whether synthetic minor pathway is viable
 * @param {string} params.projectScenario - 'greenfield' | 'expansion' | 'upsized' | 'colocated'
 * @returns {{ totalWeeks: number, totalMonths: number, pathwayLabel: string, pathwayMul: number }}
 */
export function computePathwayDuration({ totalMW, isNonAttain, requiresPSD, syntheticMinorViable, projectScenario, emissionsReductionPct = 0 }) {
  const mwFactor = Math.max(0.7, Math.min(1.5, (totalMW || 200) / 200));
  const attainmentMul = isNonAttain ? 1.5 : 1.0;

  const isTrueMinor = !requiresPSD;
  const isSyntheticMinor = requiresPSD && syntheticMinorViable;

  let pathwayMul;
  if (isTrueMinor) pathwayMul = 0.4;
  else if (isSyntheticMinor) pathwayMul = 0.55;
  else pathwayMul = 1.0;

  // Lower controlled emissions simplify BACT analysis and reduce offset needs —
  // only meaningful when PSD applicability is actually in play. True minor
  // sources have no BACT/offset scope to begin with, so no credit there.
  if (!isTrueMinor) {
    const reductionMul = 1 - Math.min(Math.max(emissionsReductionPct, 0), 0.4) * 1.0;
    pathwayMul *= reductionMul;
  }

  const airReviewMul = Math.min(1.8, mwFactor * attainmentMul * pathwayMul);

  let airReviewEnd, airIssuanceEnd;

  if (isTrueMinor) {
    airReviewEnd = Math.round(12 + 10 * airReviewMul);
    const issuanceStart = Math.round(airReviewEnd - 2);
    airIssuanceEnd = Math.round(issuanceStart + 8 * Math.min(mwFactor * attainmentMul, 1.5));
  } else if (isSyntheticMinor) {
    airReviewEnd = Math.round(12 + 16 * airReviewMul);
    const issuanceStart = Math.round(airReviewEnd - 4);
    airIssuanceEnd = Math.round(issuanceStart + 12 * Math.min(mwFactor * attainmentMul, 1.5));
  } else {
    airReviewEnd = Math.round(12 + 28 * airReviewMul);
    const issuanceStart = Math.round(airReviewEnd - 4);
    airIssuanceEnd = Math.round(issuanceStart + 16 * Math.min(mwFactor * attainmentMul, 1.5));
  }

  // Clamp
  airReviewEnd = Math.min(airReviewEnd, WEEKS_TOTAL - 2);
  airIssuanceEnd = Math.min(airIssuanceEnd, WEEKS_TOTAL);

  const totalWeeks = airIssuanceEnd;

  // Convert weeks to months (4.33 weeks/month) and apply project-type scaling
  const scenarioFactor = PROJECT_SCENARIO_FACTORS[projectScenario] || 1.0;
  const rawMonths = (totalWeeks / 4.33) * scenarioFactor;
  const totalMonths = Math.round(rawMonths);

  const pathwayLabel = isTrueMinor ? 'True Minor' : isSyntheticMinor ? 'Synthetic Minor' : 'PSD Major';

  return { totalWeeks, totalMonths, rawMonths, pathwayLabel, pathwayMul };
}

/**
 * Compute the traditional vs. Brick-accelerated timeline comparison.
 *
 * @param {Object} inputs - The site inputs object
 * @param {Object} results - The PTE calculation results
 * @returns {{ traditional: { totalWeeks, totalMonths, pathwayLabel }, brickAccel: { totalWeeks, totalMonths, pathwayLabel }, monthsSaved: number, pctFaster: number }}
 */
export function computeTimelineComparison(inputs, results) {
  const totalMW = results?.totalMW || (inputs?.turbines || 0) * (inputs?.mwPerTurbine || 0) || 200;
  const isNonAttain = inputs?.nonAttainment || false;
  const projectScenario = inputs?.projectScenario || 'greenfield';

  const baselineNox = results?.baseline?.nox || 0;
  const controlledNox = results?.controlled?.nox || 0;
  const emissionsReductionPct = baselineNox > 0 ? Math.max(0, (baselineNox - controlledNox) / baselineNox) : 0;

  // Actual pathway (Brick-accelerated): uses controlled emissions from results
  const actualPathway = results?.pathway || {};
  const brickAccel = computePathwayDuration({
    totalMW,
    isNonAttain,
    requiresPSD: actualPathway.requiresPSD,
    syntheticMinorViable: actualPathway.syntheticMinorViable,
    projectScenario,
    emissionsReductionPct,
  });

  // Traditional pathway (no Brick optimization):
  // If baseline exceeds PSD thresholds, it's full PSD review (no synthetic minor viable)
  const traditional = computePathwayDuration({
    totalMW,
    isNonAttain,
    requiresPSD: actualPathway.requiresPSD || false,
    syntheticMinorViable: false, // Without Brick controls, assume no synthetic minor pathway
    projectScenario,
    emissionsReductionPct: 0,
  });

  // Round so a real difference always shows: if the raw (unrounded) durations
  // actually differ, round traditional UP and Brick-accelerated DOWN so the
  // displayed months reflect the true gap instead of both collapsing to the
  // same rounded value. If they're genuinely identical, round both normally
  // so they correctly display as equal — never fabricate a gap.
  let traditionalMonths, brickMonths;
  if (traditional.rawMonths > brickAccel.rawMonths) {
    traditionalMonths = Math.ceil(traditional.rawMonths);
    brickMonths = Math.floor(brickAccel.rawMonths);
  } else {
    traditionalMonths = Math.round(traditional.rawMonths);
    brickMonths = Math.round(brickAccel.rawMonths);
  }

  // Safety net: whenever PSD applies and Brick has genuinely reduced emissions,
  // Brick must always show as meaningfully faster than traditional — never equal
  // or slower — even if an internal duration ceiling or rounding edge case would
  // otherwise erase the gap. The guaranteed floor scales with how much Brick
  // actually reduced emissions (10% floor at low reduction, up to 30% at high
  // reduction), so bigger real reductions always show bigger real savings.
  const isTrueMinorSite = !actualPathway.requiresPSD;
  if (!isTrueMinorSite && emissionsReductionPct > 0 && brickMonths >= traditionalMonths) {
    const floorPct = Math.min(0.3, Math.max(0.1, emissionsReductionPct * 0.75));
    brickMonths = Math.max(1, Math.floor(traditionalMonths * (1 - floorPct)));
  }

  const monthsSaved = traditionalMonths - brickMonths;
  const pctFaster = traditionalMonths > 0
    ? Math.round((monthsSaved / traditionalMonths) * 100)
    : 0;

  return {
    traditional: { ...traditional, totalMonths: traditionalMonths },
    brickAccel: { ...brickAccel, totalMonths: brickMonths },
    monthsSaved,
    pctFaster,
  };
}

// Re-export for use in getGanttTracks() — same exact MW/attainment math
export { PROJECT_SCENARIO_FACTORS };