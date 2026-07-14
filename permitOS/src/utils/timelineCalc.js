// ─── Timeline Calculation Utility ───────────────────────────────────────────
// Shared between MilestoneTimeline.jsx and the Review Step (SiteIntake Step 3)
// Uses the same pathway logic as getGanttTracks() to ensure the two views
// never contradict each other.

const WEEKS_TOTAL = 60;

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
export function computePathwayDuration({ totalMW, isNonAttain, requiresPSD, syntheticMinorViable, projectScenario }) {
  const mwFactor = Math.max(0.7, Math.min(1.5, (totalMW || 200) / 200));
  const attainmentMul = isNonAttain ? 1.5 : 1.0;

  const isTrueMinor = !requiresPSD;
  const isSyntheticMinor = requiresPSD && syntheticMinorViable;

  let pathwayMul;
  if (isTrueMinor) pathwayMul = 0.4;
  else if (isSyntheticMinor) pathwayMul = 0.55;
  else pathwayMul = 1.0;

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
  const totalMonths = Math.round((totalWeeks / 4.33) * scenarioFactor);

  const pathwayLabel = isTrueMinor ? 'True Minor' : isSyntheticMinor ? 'Synthetic Minor' : 'PSD Major';

  return { totalWeeks, totalMonths, pathwayLabel, pathwayMul };
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

  // Actual pathway (Brick-accelerated): uses controlled emissions from results
  const actualPathway = results?.pathway || {};
  const brickAccel = computePathwayDuration({
    totalMW,
    isNonAttain,
    requiresPSD: actualPathway.requiresPSD,
    syntheticMinorViable: actualPathway.syntheticMinorViable,
    projectScenario,
  });

  // Traditional pathway (no Brick optimization):
  // If baseline exceeds PSD thresholds, it's full PSD review (no synthetic minor viable)
  const traditional = computePathwayDuration({
    totalMW,
    isNonAttain,
    requiresPSD: actualPathway.requiresPSD || false,
    syntheticMinorViable: false, // Without Brick controls, assume no synthetic minor pathway
    projectScenario,
  });

  const monthsSaved = traditional.totalMonths - brickAccel.totalMonths;
  const pctFaster = traditional.totalMonths > 0
    ? Math.round((monthsSaved / traditional.totalMonths) * 100)
    : 0;

  return {
    traditional,
    brickAccel,
    monthsSaved,
    pctFaster,
  };
}

// Re-export for use in getGanttTracks() — same exact MW/attainment math
export { PROJECT_SCENARIO_FACTORS };