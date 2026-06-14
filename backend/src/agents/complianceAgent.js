import { cfrSearchTool } from '../tools/cfrSearch.js';
import { pteCalcTool } from '../tools/pteCalc.js';
import { stateLookupTool } from '../tools/stateLookup.js';
import { docGenTool } from '../tools/docGen.js';
import { getDb } from '../db/database.js';
import { searchRegulations, searchStateRules } from '../rag/vectorStore.js';
import { STATES_ATTAINMENT } from '../../../permitOS/src/data/permitData.js';

// ─── Tool Registry ────────────────────────────────────────────────────────────
const TOOLS = [cfrSearchTool, pteCalcTool, stateLookupTool, docGenTool];

const TOOL_DESCRIPTIONS = TOOLS.map(t =>
  `- ${t.name}: ${t.description}`
).join('\n');

// ─── Compliance Context Builder ──────────────────────────────────────────────
function buildComplianceContext(inputs) {
  const lines = [];
  if (!inputs) return 'No site information available.';

  lines.push(`Site: ${inputs.siteName || 'N/A'}`);
  lines.push(`Client: ${inputs.client || 'N/A'}`);
  lines.push(`State: ${inputs.state || 'N/A'}, County: ${inputs.county || 'N/A'}`);
  lines.push(`Turbines: ${inputs.turbines || 0} × ${inputs.mwPerTurbine || 0} MW`);
  lines.push(`Annual Runtime: ${inputs.hours || 0} hours`);
  lines.push(`Heat Rate: ${inputs.heatRate || 0} MMBtu/MWh`);
  lines.push(`NOx Factor: ${inputs.noxFactor || 0} lb/MMBtu`);
  lines.push(`Brick Savings: ${inputs.brickSavings || 0}%`);
  lines.push(`Gensets: ${inputs.gensetCount || 0} × ${inputs.gensetHP || 0} HP`);
  lines.push(`Cooling: ${inputs.coolingMGD || 0} MGD, Blowdown: ${inputs.blowdownPct || 0}%`);
  lines.push(`Attainment Status: ${STATES_ATTAINMENT[inputs.state] || 'Unknown'}`);
  return lines.join('\n');
}

// ─── Tool Execution ──────────────────────────────────────────────────────────
function executeTool(name, args) {
  const tool = TOOLS.find(t => t.name === name);
  if (!tool) return { error: `Unknown tool: ${name}` };

  try {
    return tool.handler(args);
  } catch (err) {
    return { error: `Tool ${name} failed: ${err.message}` };
  }
}

// ─── Response Templates (when RAG gives content) ────────────────────────────
function formatRAGResponse(query, ragResults, siteContext, pteResults) {
  const lines = [];

  // Analyze the query intent
  const q = query.toLowerCase();

  if (q.includes('psd') || q.includes('major source') || q.includes('threshold')) {
    lines.push('### PSD / Major Source Applicability');
    lines.push('');
    lines.push(`Based on the site configuration and applicable regulations:`);
    if (pteResults) {
      const { pathway, baseline } = pteResults;
      lines.push(`- Uncontrolled NOx PTE: ${baseline.nox.toFixed(1)} tpy`);
      lines.push(`- Uncontrolled CO PTE: ${baseline.co.toFixed(1)} tpy`);
      lines.push(`- PSD Required: ${pathway.requiresPSD ? 'YES' : 'No'}`);
      lines.push(`- Title V Required: ${pathway.requiresTitleV ? 'YES' : 'No'}`);
      lines.push(`- Synthetic Minor Viable: ${pathway.syntheticMinorViable ? 'YES' : 'Yes'}`);
    }
    lines.push('');
    lines.push('**Relevant regulatory context from CFR database:**');
    for (const r of ragResults.slice(0, 3)) {
      lines.push('');
      lines.push(`> *${r.cfr} — ${r.subcategory || r.category} (${r.relevance}% match)*`);
      lines.push(`> ${r.text.split('\n')[0].substring(0, 200)}`);
    }
  } else if (q.includes('bact') || q.includes('laer') || q.includes('control technology')) {
    lines.push('### BACT / LAER Technology Analysis');
    lines.push('');
    lines.push('BACT (Best Available Control Technology) is determined through a top-down analysis:');
    lines.push('1. Identify all available control technologies');
    lines.push('2. Eliminate technically infeasible options');
    lines.push('3. Rank remaining options by control effectiveness');
    lines.push('4. Evaluate economic feasibility');
    lines.push('5. Select BACT');
    lines.push('');
    lines.push('For gas turbines at data centers, typical BACT determinations include:');
    lines.push('- **DLN Combustion**: 9-15 ppmvd NOx at 15% O₂ (baseline technology)');
    lines.push('- **SCR**: 2-5 ppmvd NOx at 15% O₂ (if required for nonattainment or stringent limits)');
    lines.push('- **Oxidation Catalyst**: 90%+ CO reduction');
    lines.push('');
    for (const r of ragResults.slice(0, 2)) {
      lines.push(`> *${r.cfr}*`);
      lines.push(`> ${r.text.split('\n')[0].substring(0, 200)}`);
    }
  } else if (q.includes('npdes') || q.includes('water') || q.includes('blowdown') || q.includes('cooling')) {
    lines.push('### NPDES / Water Permitting Analysis');
    lines.push('');
    if (pteResults) {
      const { water } = pteResults;
      lines.push(`- Annual Water Use: ${water.annualWaterMG.toFixed(1)} MG/yr`);
      lines.push(`- Blowdown Volume: ${water.blowdownMG.toFixed(1)} MG/yr`);
      lines.push(`- Makeup Water: ${water.makeupMG.toFixed(1)} MG/yr`);
      lines.push(`- Brick-Optimized Water: ${water.optimizedWater.toFixed(1)} MG/yr`);
    }
    lines.push('');
    for (const r of ragResults.slice(0, 3)) {
      lines.push(`> *${r.cfr} — ${r.subcategory || r.category}*`);
      lines.push(`> ${r.text.split('\n')[0].substring(0, 250)}`);
    }
  } else if (q.includes('ghg') || q.includes('co2') || q.includes('greenhouse')) {
    lines.push('### GHG / CO₂e Analysis');
    lines.push('');
    if (pteResults) {
      lines.push(`- Baseline CO₂e: ${pteResults.baseline.co2e.toFixed(0)} tpy`);
      lines.push(`- Controlled CO₂e: ${pteResults.controlled.co2e.toFixed(0)} tpy`);
      lines.push(`- GHGRP Threshold: 25,000 mt CO₂e/yr`);
      lines.push(`- GHGRP Required: ${pteResults.baseline.co2e > 27500 ? 'YES' : 'Evaluate'}`);
    }
    lines.push('');
    for (const r of ragResults.slice(0, 3)) {
      lines.push(`> *${r.cfr}*`);
      lines.push(`> ${r.text.split('\n')[0].substring(0, 250)}`);
    }
  } else if (q.includes('timeline') || q.includes('schedule') || q.includes('how long') || q.includes('permit duration')) {
    lines.push('### Permit Timeline Estimate');
    lines.push('');
    const isPSD = pteResults?.pathway?.requiresPSD;
    const isNonAttain = siteContext?.includes('Nonattainment');
    lines.push('| Permit/Step | Estimated Duration |');
    lines.push('|-------------|--------------------|');
    const baseTimeline = [
      ['PTE & Applicability', isPSD ? '4-6 weeks' : '2-4 weeks'],
      ['BACT Analysis', isPSD ? '6-12 weeks' : 'N/A'],
      ['AERMOD Modeling', isPSD ? '8-16 weeks' : '4-8 weeks (if needed)'],
      ['Application Preparation', '8-12 weeks'],
      ['Agency Review (Air)', isNonAttain ? '9-24 months' : '6-18 months'],
      ['Agency Review (Water)', '4-12 months'],
      ['Public Comment Period', '30-45 days'],
      ['Permit Issuance', isPSD ? '12-24 months total' : '6-12 months total'],
    ];
    for (const [step, duration] of baseTimeline) {
      lines.push(`| ${step} | ${duration} |`);
    }
  } else {
    // Generic response
    lines.push('### Compliance Analysis');
    lines.push('');
    if (ragResults.length > 0) {
      lines.push(`Based on the regulatory database, the most relevant findings for your query are:`);
      lines.push('');
      for (const r of ragResults.slice(0, 4)) {
        lines.push(`**${r.cfr} — ${r.subcategory || r.category}** *(${r.relevance}% relevance)*`);
        lines.push(r.text.split('\n')[0].substring(0, 300));
        lines.push('');
      }
    }
    if (pteResults) {
      lines.push('**Calculated Emissions for this Site:**');
      lines.push(`- NOx: ${pteResults.baseline.nox.toFixed(1)} tpy (uncontrolled) → ${pteResults.controlled.nox.toFixed(1)} tpy (controlled)`);
      lines.push(`- CO: ${pteResults.baseline.co.toFixed(1)} tpy → ${pteResults.controlled.co.toFixed(1)} tpy`);
      lines.push(`- CO₂e: ${pteResults.baseline.co2e.toFixed(0)} tpy → ${pteResults.controlled.co2e.toFixed(0)} tpy`);
    }
  }

  return lines.join('\n');
}

// ─── Main Agent Query Handler ────────────────────────────────────────────────
export function queryComplianceAgent(query, options = {}) {
  const {
    inputs = null,
    results = null,
    conversationHistory = [],
    temperature = 0.3,
  } = options;

  const response = { answer: '', tools_used: [], sources: [] };

  // 1. Build context
  const siteContext = buildComplianceContext(inputs);

  // 2. Determine query type and search
  const q = query.toLowerCase();

  // Determine which tools to use based on query intent
  const category = (q.includes('water') || q.includes('npdes') || q.includes('spcc') ||
    q.includes('blowdown') || q.includes('cooling') || q.includes('316')) ? 'water' : null;

  const needsStateLookup = !!inputs?.state;
  const needsPTE = !results && inputs;

  // 3. Execute RAG search
  const ragResults = searchRegulations(query, { category, limit: 10 }).map(r => ({
    cfr: `${r.cfr_title} CFR Part ${r.cfr_part}${r.cfr_section ? ' ' + r.cfr_section : ''}`,
    category: r.category,
    subcategory: r.subcategory,
    relevance: Math.round(r.score * 100),
    text: r.chunk_text.substring(0, 500),
  }));
  response.sources.push(...ragResults.map(r => r.cfr));

  // 4. Execute state lookup if applicable
  if (needsStateLookup) {
    const stateRules = searchStateRules(inputs.state, query, 3);
    for (const rule of stateRules) {
      response.sources.push(`${rule.state}: ${rule.rule_name}`);
    }
  }

  // 5. Format response using template system
  const answer = formatRAGResponse(query, ragResults, siteContext, results);
  response.answer = answer;
  response.tools_used = ['cfr_search'];
  if (needsStateLookup) response.tools_used.push('state_lookup');
  if (needsPTE) response.tools_used.push('pte_calculator');

  // 6. Add state-specific context
  if (needsStateLookup) {
    const attainment = STATES_ATTAINMENT[inputs.state];
    response.answer += `\n\n---\n**${inputs.state} Context:** ${attainment}`;
  }

  response.answer += `\n\n*This analysis is based on ${response.sources.length} regulatory sources in the Brick PermitOS compliance database. Full citations available on request.*`;

  return response;
}

// ─── Tool-Mode Agent (explicit tool execution) ──────────────────────────────
export function executeToolQuery(query, tools, options = {}) {
  const toolNames = (tools || '').split(',').map(t => t.trim()).filter(Boolean);
  const results = {};

  for (const name of toolNames) {
    const tool = TOOLS.find(t => t.name === name);
    if (!tool) {
      results[name] = { error: `Unknown tool: ${name}` };
      continue;
    }
    results[name] = tool.handler({ query, ...options });
  }

  return results;
}

export function getAgentTools() {
  return TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}