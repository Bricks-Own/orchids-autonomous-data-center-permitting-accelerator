// ─── E2E Pipeline Test ──────────────────────────────────────────────────
// Tests the full flow: health → register → auth → RAG search → agent query → PTE calc
// Uses Node 22's built-in fetch (no external dependencies needed)

const PORT = process.env.PORT || 5173;
const BASE = `http://localhost:${PORT}/api`;
let passed = 0;
let failed = 0;
let token = '';

async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  \u2713 ' + name);
  } catch (e) {
    failed++;
    console.log('  \u2717 ' + name + ': ' + e.message);
  }
}

async function jsonResponse(res) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.substring(0, 200)}`);
  }
  return res.json();
}

async function main() {
  console.log('\u2550\u2550 E2E Pipeline Test \u2550\u2550\n');

  // 1. Health
  await check('Health endpoint', async () => {
    const r = await fetch(BASE + '/health');
    const d = await jsonResponse(r);
    if (d.status !== 'ok') throw new Error('Expected ok, got ' + d.status);
  });

  // 2. Register
  const testEmail = 'e2e-' + Date.now() + '@permitos-test.com';
  await check('Register', async () => {
    const r = await fetch(BASE + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'Test123!', name: 'E2E Test' }),
    });
    const d = await jsonResponse(r);
    if (!d.token) throw new Error('No token returned');
    token = d.token;
  });

  // 3. Authenticated RAG Search
  await check('RAG Search (authenticated)', async () => {
    const r = await fetch(BASE + '/rag/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ query: 'PSD major source threshold data center', limit: 3 }),
    });
    const d = await jsonResponse(r);
    if (!d.results || d.results.length === 0) throw new Error('No results');
    if (d.results[0].relevance < 10) throw new Error('Low relevance: ' + d.results[0].relevance);
    console.log('    Top: "' + d.results[0].title + '" (' + d.results[0].relevance + '%)');
  });

  // 4. Agent Query with LLM
  await check('Agent Query (LLM)', async () => {
    const r = await fetch(BASE + '/agent/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        query: 'What are the BACT requirements for gas turbines at a data center in Virginia?',
        inputs: { siteName: 'BigWatt AI Campus', state: 'Virginia', county: 'Loudoun' },
      }),
    });
    const d = await jsonResponse(r);
    if (!d.content) throw new Error('No content in response');
    console.log('    Type: ' + d.type + ' | Preview: ' + d.content.substring(0, 200) + '...');
  });

  // 5. RAI Response Generation
  await check('RAI Response (LLM)', async () => {
    const r = await fetch(BASE + '/rai/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        question: 'Please justify your selection of meteorological data station and explain temporal representativeness.',
        siteData: { siteName: 'BigWatt AI Campus', state: 'Virginia', county: 'Loudoun', turbines: 8 },
      }),
    });
    const d = await jsonResponse(r);
    if (!d.response) throw new Error('No content in RAI response');
    console.log('    Preview: ' + d.response.substring(0, 200) + '...');
  });

  // 6. State-Specific RAG
  await check('State-Specific RAG', async () => {
    const r = await fetch(BASE + '/rag/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ query: 'Tennessee TDEC air permit data center', limit: 3 }),
    });
    const d = await jsonResponse(r);
    if (!d.results || d.results.length === 0) throw new Error('No results');
    console.log('    Top: "' + d.results[0].title + '" (' + d.results[0].relevance + '%)');
  });

  // 7. PTE Calculation
  await check('PTE Calculation', async () => {
    const r = await fetch(BASE + '/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        inputData: {
          turbines: 8, mwPerTurbine: 25, hours: 6000, heatRate: 8.5,
          noxFactor: 0.015, coFactor: 0.035, brickSavings: 20,
          gensetCount: 12, gensetHP: 2000, gensetHours: 100,
          coolingMGD: 2.8, blowdownPct: 20, waterMGD: 1.2,
          state: 'Virginia', county: 'Loudoun',
        },
      }),
    });
    const d = await jsonResponse(r);
    if (!d.results || d.results.totalMW !== 200) throw new Error('Expected 200 MW, got ' + (d.results?.totalMW));
    if (!d.results.pathway || typeof d.results.pathway.requiresPSD !== 'boolean') throw new Error('Missing pathway');
    console.log('    MW=' + d.results.totalMW + ' NOx=' + d.results.baseline.nox.toFixed(1) + '/' + d.results.controlled.nox.toFixed(1) + ' PSD=' + d.results.pathway.requiresPSD + ' TitleV=' + d.results.pathway.requiresTitleV);
  });

  const total = passed + failed;
  console.log('\n' + '\u2550'.repeat(50));
  console.log('  Total: ' + total + '  |  Passed: ' + passed + '  |  Failed: ' + failed);
  console.log('\u2550'.repeat(50));

  if (failed > 0) {
    console.log('\n\u26A0 Some tests failed. See details above.');
    process.exit(1);
  } else {
    console.log('\n\u2714 All E2E tests passed!');
    process.exit(0);
  }
}

main();