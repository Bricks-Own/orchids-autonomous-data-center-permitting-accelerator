const DAY_MS = 24 * 60 * 60 * 1000;

export const SOURCE_AUTHORITY = {
  binding: 5,
  officialGuidance: 4,
  agencyData: 4,
  projectEvidence: 3,
  expertPractice: 2,
  illustrative: 1,
};

export const CURATED_SOURCES = [
  {
    id: 'epa-nsr',
    title: 'EPA New Source Review Permitting',
    authority: 'officialGuidance',
    domains: ['air', 'greenfield', 'upsized'],
    url: 'https://www.epa.gov/nsr',
    publisher: 'US EPA',
    lastVerified: '2026-06-20',
  },
  {
    id: 'epa-nsr-policy',
    title: 'EPA NSR Policy and Guidance Database',
    authority: 'officialGuidance',
    domains: ['air', 'greenfield', 'upsized'],
    url: 'https://www.epa.gov/nsr/new-source-review-policy-and-guidance-document-index',
    publisher: 'US EPA',
    lastVerified: '2026-06-20',
  },
  {
    id: 'epa-aermod',
    title: 'EPA Preferred and Recommended Dispersion Models',
    authority: 'officialGuidance',
    domains: ['air', 'modeling'],
    url: 'https://www.epa.gov/scram/air-quality-dispersion-modeling-preferred-and-recommended-models',
    publisher: 'US EPA',
    lastVerified: '2026-06-20',
  },
  {
    id: 'epa-npdes-manual',
    title: "EPA NPDES Permit Writers' Manual",
    authority: 'officialGuidance',
    domains: ['water', 'greenfield', 'upsized'],
    url: 'https://www.epa.gov/npdes/npdes-permit-writers-manual',
    publisher: 'US EPA',
    lastVerified: '2026-06-20',
  },
  {
    id: 'epa-rblc',
    title: 'EPA RACT/BACT/LAER Clearinghouse',
    authority: 'agencyData',
    domains: ['air', 'bact', 'laer'],
    url: 'https://cfpub.epa.gov/rblc/index.cfm?action=Home.Home',
    publisher: 'US EPA',
    lastVerified: '2026-06-20',
  },
  {
    id: 'ecfr-title-40',
    title: 'Electronic Code of Federal Regulations — Title 40',
    authority: 'binding',
    domains: ['air', 'water', 'waste', 'all'],
    url: 'https://www.ecfr.gov/current/title-40',
    publisher: 'US Government Publishing Office',
    lastVerified: '2026-06-20',
  },
];

export function selectSources(domains = [], suppliedSources = []) {
  const requested = new Set(['all', ...domains]);
  const curated = CURATED_SOURCES.filter(source =>
    source.domains.some(domain => requested.has(domain))
  );
  const supplied = suppliedSources.map((source, index) => ({
    id: source.id || `supplied-${index + 1}`,
    title: source.title || 'User-supplied source',
    authority: source.authority || 'projectEvidence',
    domains: source.domains || ['all'],
    url: source.url || null,
    publisher: source.publisher || 'Project team',
    lastVerified: source.lastVerified || null,
  }));

  return [...curated, ...supplied]
    .map(source => ({
      ...source,
      authorityScore: SOURCE_AUTHORITY[source.authority] || 0,
      stale: isStale(source),
    }))
    .sort((a, b) => b.authorityScore - a.authorityScore);
}

export function isStale(source, maxAgeDays = 180) {
  if (!source.lastVerified) return true;
  const checked = new Date(`${source.lastVerified}T00:00:00Z`).getTime();
  return !Number.isFinite(checked) || Date.now() - checked > maxAgeDays * DAY_MS;
}

export function sourcePolicy() {
  return {
    precedence: ['binding', 'officialGuidance', 'agencyData', 'projectEvidence', 'expertPractice', 'illustrative'],
    rules: [
      'Never allow consultant examples to override binding law or current agency guidance.',
      'Never describe an illustrative source as verified project evidence.',
      'Require an effective date or retrieval date for material regulatory conclusions.',
      'Escalate conflicts between authoritative sources to a qualified reviewer.',
    ],
  };
}
