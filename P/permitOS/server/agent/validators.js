const REQUIRED_FIELDS = [
  'siteName', 'state', 'county', 'turbines', 'mwPerTurbine', 'hours',
  'heatRate', 'noxFactor', 'coFactor', 'gensetCount', 'gensetHP',
  'gensetHours', 'coolingMGD', 'siteAcres',
];

const NUMERIC_RANGES = {
  turbines: [0, 500],
  mwPerTurbine: [0, 1000],
  hours: [0, 8760],
  heatRate: [1, 30],
  noxFactor: [0, 10],
  coFactor: [0, 10],
  gensetCount: [0, 10000],
  gensetHP: [0, 100000],
  gensetHours: [0, 8760],
  coolingMGD: [0, 1000],
  siteAcres: [0, 100000],
};

export function validateInputs(inputs = {}) {
  const findings = [];
  for (const field of REQUIRED_FIELDS) {
    if (inputs[field] === undefined || inputs[field] === null || inputs[field] === '') {
      findings.push(finding('error', 'missing-input', `${field} is required`, field));
    }
  }
  for (const [field, [min, max]] of Object.entries(NUMERIC_RANGES)) {
    if (inputs[field] === undefined) continue;
    const value = Number(inputs[field]);
    if (!Number.isFinite(value) || value < min || value > max) {
      findings.push(finding('error', 'invalid-range', `${field} must be between ${min} and ${max}`, field));
    }
  }
  if (Number(inputs.hours) < Number(inputs.gensetHours) && Number(inputs.turbines) > 0) {
    findings.push(finding('warning', 'hours-review', 'Turbine hours are lower than genset hours; confirm the operating scenario.', 'hours'));
  }
  return findings;
}

export function validateEvidence(evidence = []) {
  const findings = [];
  const categories = new Set(evidence.map(item => item.category));
  for (const category of ['equipment', 'site', 'operations']) {
    if (!categories.has(category)) {
      findings.push(finding('warning', 'missing-evidence', `No ${category} evidence is attached.`, category));
    }
  }
  for (const item of evidence) {
    if (!item.source || !item.asOf) {
      findings.push(finding('warning', 'weak-provenance', `${item.title || 'Evidence item'} lacks source or as-of date.`, item.id));
    }
  }
  return findings;
}

export function validateResults(results) {
  const findings = [];
  const pollutants = ['nox', 'co', 'so2', 'pm25', 'voc', 'co2e', 'hap'];
  for (const pollutant of pollutants) {
    for (const bucket of ['baseline', 'controlled']) {
      const value = results?.[bucket]?.[pollutant];
      if (!Number.isFinite(value) || value < 0) {
        findings.push(finding('error', 'invalid-calculation', `${bucket}.${pollutant} is not a valid non-negative number.`, `${bucket}.${pollutant}`));
      }
    }
    if (results?.controlled?.[pollutant] > results?.baseline?.[pollutant] + 1e-9) {
      findings.push(finding('error', 'calculation-inconsistency', `Controlled ${pollutant} exceeds baseline ${pollutant}.`, pollutant));
    }
  }
  return findings;
}

export function validateSources(sources = []) {
  const findings = [];
  if (!sources.some(source => source.authority === 'binding' || source.authority === 'officialGuidance')) {
    findings.push(finding('error', 'no-authoritative-source', 'No binding or official guidance source supports the analysis.'));
  }
  for (const source of sources.filter(item => item.stale)) {
    findings.push(finding('warning', 'stale-source', `${source.title} needs a fresh verification date.`, source.id));
  }
  return findings;
}

export function summarizeFindings(findings) {
  return {
    errors: findings.filter(item => item.severity === 'error').length,
    warnings: findings.filter(item => item.severity === 'warning').length,
    passed: findings.every(item => item.severity !== 'error'),
  };
}

function finding(severity, code, message, field = null) {
  return { severity, code, message, field };
}
