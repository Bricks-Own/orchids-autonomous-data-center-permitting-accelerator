import crypto from 'crypto';
import { buildScenarioPlan } from './scenarioPlanner.js';
import { selectSources, sourcePolicy } from './sourceRegistry.js';
import { validateEvidence, validateInputs, validateResults, validateSources, summarizeFindings } from './validators.js';
import { scorePermitReadiness } from './rewardEngine.js';

export async function runPermittingAgent({ scenarioType, inputs, evidence = [], suppliedSources = [] }) {
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const plan = buildScenarioPlan(scenarioType);
  const domains = [...new Set(plan.tasks.map(task => task.domain))];
  const sources = selectSources(domains, suppliedSources);

  const inputFindings = validateInputs(inputs);
  let results = null;
  let calculationFindings = [];

  if (!inputFindings.some(item => item.severity === 'error')) {
    const { calcPTE } = await import('../../src/utils/calculations.js');
    results = calcPTE(inputs);
    calculationFindings = validateResults(results);
    plan.tasks = plan.tasks.map(task =>
      task.id === 'air-screen' ? { ...task, status: calculationFindings.length ? 'needs-review' : 'completed' } : task
    );
  }

  const findings = [
    ...inputFindings,
    ...validateEvidence(evidence),
    ...validateSources(sources),
    ...calculationFindings,
  ];
  const validation = summarizeFindings(findings);
  const reward = scorePermitReadiness({ inputs, evidence, sources, findings, plan, results });

  return {
    runId,
    startedAt,
    completedAt: new Date().toISOString(),
    scenarioType: plan.scenarioType,
    status: validation.passed ? 'completed-with-review-gates' : 'blocked',
    plan,
    results,
    findings,
    validation,
    reward,
    sources,
    sourcePolicy: sourcePolicy(),
    nextActions: deriveNextActions(findings, plan),
    humanReviewGates: [
      'Confirm current federal, state, local, and delegated-agency requirements.',
      'Review applicability and calculations with qualified air and water permitting professionals.',
      'Use licensed engineering/modeling review where required.',
      'Approve final evidence, assumptions, modeling, and documents before filing.',
    ],
  };
}

function deriveNextActions(findings, plan) {
  const actions = findings.slice(0, 8).map(item => ({
    priority: item.severity === 'error' ? 'critical' : 'high',
    action: item.message,
    source: item.code,
  }));
  if (actions.length === 0) {
    return plan.tasks
      .filter(task => task.status === 'pending')
      .slice(0, 5)
      .map(task => ({ priority: task.gate === 'human' ? 'high' : 'normal', action: task.label, source: task.id }));
  }
  return actions;
}
