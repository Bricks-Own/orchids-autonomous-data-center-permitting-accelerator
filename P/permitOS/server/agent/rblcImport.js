import crypto from 'crypto';

export function scoreRblcComparability(project, candidate) {
  const dimensions = {
    processCode: equal(project.processCode, candidate.processCode) ? 25 : 0,
    equipmentClass: equal(project.equipmentClass, candidate.equipmentClass) ? 20 : 0,
    fuel: equal(project.fuel, candidate.fuel) ? 15 : 0,
    pollutant: equal(project.pollutant, candidate.pollutant) ? 15 : 0,
    capacity: capacityScore(project.capacityMW, candidate.capacityMW),
    dutyCycle: equal(project.dutyCycle, candidate.dutyCycle) ? 10 : 0,
    recency: recencyScore(candidate.permitDate),
  };
  const score = Object.values(dimensions).reduce((sum, value) => sum + value, 0);
  return {
    score,
    grade: score >= 85 ? 'high' : score >= 65 ? 'moderate' : 'low',
    dimensions,
    limitations: [
      'Comparability scoring does not establish BACT or LAER.',
      'The underlying permit and determination must be reviewed.',
      'Control feasibility and cost must be evaluated for the current project.',
    ],
  };
}

export function importRblcRecord(db, { siteId, evidenceId, rblcId, permitDate, facilityName, criteria, projectCriteria }) {
  if (!evidenceId) throw httpError(400, 'Underlying permit evidence attachment is required');
  const evidence = db.prepare('SELECT id, sha256 FROM evidence_items WHERE id = ? AND site_id = ?').get(evidenceId, siteId);
  if (!evidence) throw httpError(404, 'Underlying permit evidence was not found');
  const comparison = scoreRblcComparability(projectCriteria || {}, criteria || {});
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO rblc_records
    (id, site_id, evidence_id, rblc_id, permit_date, facility_name, criteria_json, comparison_json, evidence_sha256)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, siteId, evidenceId, rblcId, permitDate, facilityName, JSON.stringify(criteria || {}),
      JSON.stringify(comparison), evidence.sha256);
  return { id, rblcId, facilityName, permitDate, evidenceId, evidenceSha256: evidence.sha256, comparison };
}

function equal(a, b) {
  return a && b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function capacityScore(project, candidate) {
  const p = Number(project);
  const c = Number(candidate);
  if (!Number.isFinite(p) || !Number.isFinite(c) || p <= 0) return 0;
  const ratio = Math.min(p, c) / Math.max(p, c);
  return ratio >= 0.8 ? 10 : ratio >= 0.5 ? 6 : ratio >= 0.25 ? 3 : 0;
}

function recencyScore(date) {
  const year = new Date(date).getUTCFullYear();
  if (!Number.isFinite(year)) return 0;
  const age = new Date().getUTCFullYear() - year;
  return age <= 5 ? 5 : age <= 10 ? 3 : age <= 20 ? 1 : 0;
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
