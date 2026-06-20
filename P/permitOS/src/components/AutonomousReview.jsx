import { useState } from 'react';
import { runAutonomousReview } from '../utils/api';
import { calcPTE } from '../utils/calculations';

const scenarios = {
  greenfield: 'New site with construction, land, air, water, and utility permitting scope.',
  upsized: 'Expansion requiring baseline, modification, and permit-amendment analysis.',
  brownfield: 'Existing site with legacy permits, equipment, and compliance history.',
};

export default function AutonomousReview({ inputs, results, setResults }) {
  const [scenarioType, setScenarioType] = useState('greenfield');
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState(null);
  const [mode, setMode] = useState('');
  const [evidence, setEvidence] = useState([]);

  const startReview = async () => {
    setRunning(true);
    try {
      const response = await runAutonomousReview({ scenarioType, inputs, evidence });
      setRun(response.run);
      setResults(response.run.results || results);
      setMode('Connected evidence-driven review');
    } catch {
      const localResults = results || calcPTE(inputs);
      setResults(localResults);
      setRun(buildLocalRun(scenarioType, inputs, localResults));
      setMode('Demo screening mode — server evidence registry unavailable');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="rounded-2xl border border-cyan-800/40 bg-gradient-to-br from-cyan-950/30 via-gray-900 to-gray-950 p-6">
        <div className="text-xs uppercase tracking-[0.2em] text-cyan-400 mb-2">Evidence-driven orchestration</div>
        <h2 className="text-2xl font-bold text-white">Autonomous Permit Review</h2>
        <p className="text-sm text-gray-400 mt-2 max-w-3xl">
          Plans work, runs deterministic screening, checks evidence and authoritative-source coverage,
          identifies blockers, and routes professional-review gates. It never certifies filing readiness.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {Object.entries(scenarios).map(([id, description]) => (
          <button key={id} onClick={() => setScenarioType(id)}
            className={`rounded-xl border p-4 text-left ${scenarioType === id ? 'border-cyan-600 bg-cyan-950/30' : 'border-gray-700/50 bg-gray-900/40'}`}>
            <div className="text-sm font-semibold text-white capitalize">{id}</div>
            <div className="text-xs text-gray-500 mt-1">{description}</div>
          </button>
        ))}
      </div>

      <button onClick={startReview} disabled={running}
        className="bg-cyan-700 hover:bg-cyan-600 disabled:bg-gray-700 text-white rounded-xl px-6 py-3 text-sm font-semibold">
        {running ? 'Running evidence and validation loop…' : 'Run autonomous review'}
      </button>

      <div className="rounded-xl border border-gray-700/50 bg-gray-900/40 p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Evidence register</h3>
            <p className="text-xs text-gray-500 mt-1">Add project files for screening metadata. Connected project workspaces also hash and retain uploads server-side.</p>
          </div>
          <label className="cursor-pointer bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg px-4 py-2 text-xs text-gray-300">
            Add evidence files
            <input type="file" multiple className="hidden" onChange={event => {
              const additions = [...event.target.files].map(file => ({
                id: `${file.name}-${file.lastModified}`,
                category: classifyEvidence(file.name),
                title: file.name,
                source: 'Project upload',
                asOf: new Date(file.lastModified || Date.now()).toISOString().slice(0, 10),
                byteLength: file.size,
              }));
              setEvidence(current => [...current, ...additions]);
            }} />
          </label>
        </div>
        <div className="grid md:grid-cols-3 gap-2 mt-4">
          {evidence.map(item => (
            <div key={item.id} className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
              <div className="text-xs text-gray-300 truncate">{item.title}</div>
              <div className="text-[10px] text-cyan-500 uppercase mt-1">{item.category}</div>
            </div>
          ))}
          {!evidence.length && <div className="text-xs text-gray-600">No evidence attached yet.</div>}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Capability title="Official source snapshots" text="Allowlisted EPA, eCFR, and initial state-agency retrieval with timestamps and SHA-256 hashes." />
        <Capability title="RBLC research" text="Builds official process-code searches and requires underlying permit verification before precedent use." />
        <Capability title="AERMOD adapter" text="Checks complete manifests and only reports runs produced by a configured EPA model executable." />
        <Capability title="Secure evidence" text="Private object storage, signed downloads, malware-scan status, text extraction, and immutable file hashes." />
        <Capability title="EPA structured data" text="Green Book dataset registry/import and ECHO live REST-style facility queries retain source URLs and hashes." />
        <Capability title="Professional approvals" text="Counsel, PE, modeler, and permitting-lead assignments produce immutable hash-chained decisions." />
      </div>

      {run && (
        <div className="space-y-5">
          <div className="grid md:grid-cols-4 gap-4">
            <Metric label="Readiness score" value={`${run.reward.score}/100`} />
            <Metric label="Grade" value={run.reward.grade} />
            <Metric label="Errors" value={run.validation.errors} />
            <Metric label="Warnings" value={run.validation.warnings} />
          </div>
          <div className="text-xs text-gray-500">{mode}</div>
          <div className="grid lg:grid-cols-2 gap-5">
            <Panel title="Next highest-impact actions">
              {run.nextActions.map((item, index) => (
                <div key={`${item.source}-${index}`} className="flex gap-3 border-b border-gray-800/60 py-2.5 last:border-0">
                  <span className="text-[10px] uppercase text-amber-400 mt-0.5">{item.priority}</span>
                  <span className="text-xs text-gray-300">{item.action}</span>
                </div>
              ))}
            </Panel>
            <Panel title="Human review gates">
              {run.humanReviewGates.map(item => <div key={item} className="py-2 text-xs text-gray-300">◆ {item}</div>)}
            </Panel>
          </div>
          <Panel title={`Scenario plan — ${run.scenarioType}`}>
            <div className="grid md:grid-cols-2 gap-2">
              {run.plan.tasks.map(task => (
                <div key={task.id} className="rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2.5">
                  <div className="flex justify-between gap-3">
                    <span className="text-xs text-gray-300">{task.order}. {task.label}</span>
                    <span className="text-[10px] text-gray-600 uppercase">{task.gate}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

function Capability({ title, text }) {
  return <div className="rounded-xl border border-gray-700/50 bg-gray-900/30 p-4">
    <div className="text-sm font-semibold text-gray-200">{title}</div>
    <div className="text-xs text-gray-500 mt-1 leading-relaxed">{text}</div>
  </div>;
}

function classifyEvidence(name) {
  const lower = name.toLowerCase();
  if (lower.includes('equipment') || lower.includes('spec') || lower.includes('turbine') || lower.includes('generator')) return 'equipment';
  if (lower.includes('survey') || lower.includes('site') || lower.includes('civil')) return 'site';
  if (lower.includes('operat') || lower.includes('dispatch') || lower.includes('load')) return 'operations';
  if (lower.includes('permit') || lower.includes('agency')) return 'permit';
  return 'supporting';
}

function Metric({ label, value }) {
  return <div className="rounded-xl border border-gray-700/50 bg-gray-900/40 p-4">
    <div className="text-xs text-gray-500">{label}</div>
    <div className="text-xl font-bold text-cyan-300 mt-1 capitalize">{value}</div>
  </div>;
}

function Panel({ title, children }) {
  return <div className="rounded-xl border border-gray-700/50 bg-gray-900/40 p-5">
    <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>{children}
  </div>;
}

function buildLocalRun(scenarioType, inputs, localResults) {
  const missing = ['siteName', 'state', 'county'].filter(key => !inputs[key]);
  const tasks = [
    'Confirm jurisdictions and delegated agencies',
    scenarioType === 'upsized' ? 'Define change from permitted baseline and evaluate modification rules' : 'Confirm site and construction footprint',
    'Build equipment and operations evidence register',
    'Run air applicability and PTE screening',
    'Map water, stormwater, and SPCC pathways',
    'Screen land, wetlands, species, cultural, noise, and federal nexus',
    'Complete qualified professional review before reliance or filing',
  ].map((label, index) => ({ id: `local-${index}`, order: index + 1, label, gate: index === 3 ? 'calculation' : 'human', status: 'pending' }));
  const score = Math.max(0, 58 - missing.length * 20);
  return {
    scenarioType, results: localResults, plan: { scenarioType, tasks },
    validation: { errors: missing.length, warnings: 3, passed: missing.length === 0 },
    reward: { score, grade: score >= 65 ? 'developing' : 'early-screening' },
    nextActions: tasks.slice(0, 5).map(task => ({ priority: 'high', action: task.label, source: task.id })),
    humanReviewGates: [
      'Confirm current federal, state, local, and delegated-agency requirements.',
      'Review applicability and calculations with qualified air and water professionals.',
      'Approve evidence, modeling, and documents before filing.',
    ],
  };
}
