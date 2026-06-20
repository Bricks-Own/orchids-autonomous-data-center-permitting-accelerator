export function scorePermitReadiness({ inputs, evidence, sources, findings, plan, results }) {
  const errors = findings.filter(item => item.severity === 'error').length;
  const warnings = findings.filter(item => item.severity === 'warning').length;
  const inputCompleteness = completeness(inputs);
  const evidenceCoverage = Math.min(1, new Set(evidence.map(item => item.category)).size / 5);
  const authoritativeCoverage = Math.min(1, sources.filter(source => source.authorityScore >= 4 && !source.stale).length / 4);
  const workflowCoverage = Math.min(1, plan.tasks.length / 10);
  const calculationIntegrity = errors === 0 && results ? 1 : 0;
  const humanGateCoverage = plan.tasks.some(task => task.gate === 'human') ? 1 : 0;

  const raw =
    inputCompleteness * 20 +
    evidenceCoverage * 20 +
    authoritativeCoverage * 20 +
    workflowCoverage * 10 +
    calculationIntegrity * 20 +
    humanGateCoverage * 10 -
    errors * 15 -
    warnings * 2;

  const score = Math.max(0, Math.min(100, Math.round(raw)));
  return {
    score,
    grade: score >= 85 ? 'review-ready' : score >= 65 ? 'developing' : score >= 40 ? 'early-screening' : 'blocked',
    objective: 'Maximize defensible permit success likelihood while minimizing unsupported claims, omissions, rework, and review delays.',
    dimensions: {
      inputCompleteness: Math.round(inputCompleteness * 100),
      evidenceCoverage: Math.round(evidenceCoverage * 100),
      authoritativeCoverage: Math.round(authoritativeCoverage * 100),
      workflowCoverage: Math.round(workflowCoverage * 100),
      calculationIntegrity: Math.round(calculationIntegrity * 100),
      humanGateCoverage: Math.round(humanGateCoverage * 100),
    },
    constraints: [
      'Never improve the score by hiding uncertainty or omitting adverse findings.',
      'A score is decision support, not a probability or agency prediction.',
      'No filing-ready status without required qualified professional review.',
    ],
  };
}

function completeness(inputs = {}) {
  const material = Object.values(inputs).filter(value => value !== null && value !== undefined && value !== '');
  return Math.min(1, material.length / 25);
}
