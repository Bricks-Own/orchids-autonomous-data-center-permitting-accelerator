// ─── Building and Power Permitting Calculation Helpers ──────────────────────
// Pure functions, no React dependencies — testable on both FE and BE.

// ─── Building Calculations ─────────────────────────────────────────────────

export function calcIbcClass(totalMW) {
  return totalMW > 400 ? 'Type IB (Fire Resistive) — required for hyperscale' : 'Type IIB (Non-combustible) — typical';
}

export function calcFireRating(stories) {
  if (!stories || stories < 1) return '1-hour minimum (default)';
  return stories >= 4 ? '2-hour minimum' : '1-hour minimum';
}

export function calcNoiseConcern(totalMW) {
  if (!totalMW || totalMW <= 0) return 'Low — no significant generation on site';
  return totalMW > 200 ? 'High — dedicated noise study needed' : 'Moderate — standard sound barrier required';
}

export function calcBuildingArea(datacenterMW, buildingSqFt) {
  if (buildingSqFt && buildingSqFt > 0) return Math.round(buildingSqFt);
  const mw = datacenterMW || 100;
  return Math.round(mw * 125);
}

// ─── Power Calculations ────────────────────────────────────────────────────

// ISO/RTO mapping for all 50 states + DC
const ISO_MAPPING = [
  { iso: 'ERCOT', states: ['Texas'] },
  { iso: 'PJM', states: ['Delaware','Illinois','Indiana','Kentucky','Maryland','Michigan','New Jersey','North Carolina','Ohio','Pennsylvania','Tennessee','Virginia','West Virginia','Washington DC'] },
  { iso: 'MISO', states: ['Arkansas','Illinois','Indiana','Iowa','Kentucky','Louisiana','Michigan','Minnesota','Mississippi','Missouri','Montana','North Dakota','South Dakota','Wisconsin'] },
  { iso: 'CAISO', states: ['California'] },
  { iso: 'NYISO', states: ['New York'] },
  { iso: 'ISO-NE', states: ['Connecticut','Maine','Massachusetts','New Hampshire','Rhode Island','Vermont'] },
  { iso: 'SPP', states: ['Arkansas','Kansas','Louisiana','Mississippi','Missouri','Nebraska','New Mexico','North Dakota','Oklahoma','South Dakota','Texas','Wyoming'] },
];

export function detectISO(state) {
  if (!state) return '—';
  for (const entry of ISO_MAPPING) {
    if (entry.states.includes(state)) return entry.iso;
  }
  return 'Non-ISO (Vertically Integrated Utility)';
}

export function calcFercJurisdiction(totalMW) {
  if (!totalMW || totalMW <= 0) return 'Non-jurisdictional (Order 2006)';
  return totalMW > 20 ? 'FERC-jurisdictional (Order 2003)' : 'Non-jurisdictional (Order 2006)';
}

export function calcNercApplicability(onSiteMW) {
  if (!onSiteMW || onSiteMW <= 0) return 'Below BES threshold';
  return onSiteMW > 20 ? 'NERC GO/GOP registration required' : 'Below BES threshold';
}

export function calcCpcnRequirement(totalMW, powerSrc) {
  if (!totalMW || totalMW <= 0) return 'Self-generation exemption';
  return totalMW > 50 && (powerSrc || '').includes('On-site') ? 'PUC CPCN likely required' : 'Self-generation exemption';
}

export function calcInterconnectionVoltage(totalMW, overrideKV) {
  if (overrideKV && overrideKV > 0) return overrideKV;
  if (!totalMW || totalMW <= 0) return 69;
  if (totalMW >= 500) return 345;
  if (totalMW >= 200) return 138;
  return 69;
}

export function calcTransformerMVA(totalMW, overrideMVA) {
  if (overrideMVA && overrideMVA > 0) return overrideMVA;
  if (!totalMW || totalMW <= 0) return 0;
  return Math.round(totalMW * 1.15);
}

// ─── Building Metrics (for display) ───────────────────────────────────────

export function computeBuildingMetrics(inputs, buildingData = {}) {
  const totalMW = (inputs.turbines || 0) * (inputs.mwPerTurbine || 0);
  const stories = buildingData.stories || inputs.stories || 2;
  const occupancy = buildingData.occupancy || inputs.occupancyType || 'Business (B)';
  const suppression = buildingData.fireSuppression || inputs.fireSuppression || 'Pre-action sprinkler';
  const emergencyConf = buildingData.emergencyConfig || inputs.emergencyPowerConfig || 'N+1';
  const buildingSqFt = calcBuildingArea(inputs.datacenterMW, buildingData.buildingSqFt || inputs.buildingSqFt);
  const totalGensetKW = (inputs.gensetCount || 0) * (inputs.gensetHP || 0) * 0.746;

  return {
    totalMW,
    buildingSqFt,
    stories,
    occupancy,
    suppression,
    emergencyConf,
    fireRating: calcFireRating(stories),
    noiseConcern: calcNoiseConcern(totalMW),
    ibcClass: calcIbcClass(totalMW),
    totalGensetKW,
    totalGensetMW: totalGensetKW / 1000,
  };
}

// ─── Power Metrics (for display) ──────────────────────────────────────────

export function computePowerMetrics(inputs, powerData = {}) {
  const totalMW = powerData.totalMW || (inputs.turbines || 0) * (inputs.mwPerTurbine || 0);
  const interconnectionKV = calcInterconnectionVoltage(totalMW, powerData.interconnectionVoltage || inputs.interconnectionVoltage);
  const transformerMVA = calcTransformerMVA(totalMW, powerData.transformerCapacity || inputs.transformerCapacity);
  const gensetMW = powerData.gensetTotalMW || ((inputs.gensetCount || 0) * (inputs.gensetHP || 0) * 0.746) / 1000;
  const onSiteMW = totalMW + gensetMW;
  const powerSrc = powerData.powerSource || inputs.powerSourceType || 'Hybrid (Grid + On-site Generation)';
  const state = inputs.state || '';

  return {
    totalMW,
    interconnectionKV,
    transformerMVA,
    gensetMW,
    onSiteMW,
    powerSrc,
    iso: detectISO(state),
    ferc: calcFercJurisdiction(totalMW),
    nerc: calcNercApplicability(onSiteMW),
    cpc: calcCpcnRequirement(totalMW, powerSrc),
  };
}
