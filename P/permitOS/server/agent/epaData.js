import crypto from 'crypto';

const ECHO_BASE = 'https://echodata.epa.gov/echo';

export async function queryEcho({ program = 'air', state, county, latitude, longitude, radiusMiles = 25 }) {
  const service = program === 'water' ? 'cwa_rest_services.get_facilities' : 'air_rest_services.get_facilities';
  const url = new URL(`${ECHO_BASE}/${service}`);
  url.searchParams.set('output', 'JSON');
  if (state) url.searchParams.set('p_st', state);
  if (county) url.searchParams.set('p_co', county);
  if (latitude !== undefined && longitude !== undefined) {
    url.searchParams.set('p_lat', String(latitude));
    url.searchParams.set('p_long', String(longitude));
    url.searchParams.set('p_radius', String(radiusMiles));
  }
  return fetchStructured(url, 'ECHO');
}

export function greenBookDatasetRegistry() {
  return {
    sourcePage: 'https://www.epa.gov/green-book/green-book-data-download',
    lastPageVerification: '2026-03-27',
    datasets: {
      allPollutantsAreas: { code: 'ALLPOLLS_NAA', description: 'Current nonattainment areas grouped by common area name' },
      areaStatus: { code: 'AREADATA', description: 'Area-level nonattainment and maintenance status for all NAAQS' },
      countyStatus: { code: 'NAYRO', description: 'County-level nonattainment and maintenance status for each NAAQS' },
      history: { code: 'PHISTORY', description: 'County nonattainment history since 1992' },
    },
    formats: ['dbf', 'xls'],
    note: 'Import the official EPA export and retain its hash; spreadsheet parsing is performed by the ingestion worker.',
  };
}

export function parseGreenBookRows(rows, { state, county } = {}) {
  if (!Array.isArray(rows)) throw new Error('Green Book rows must be an array');
  const normalizedState = String(state || '').toUpperCase();
  const normalizedCounty = String(county || '').toUpperCase().replace(/\s+COUNTY$/, '');
  const matches = rows.filter(row => {
    const rowState = String(row.state || row.STATE || row.state_abbreviation || '').toUpperCase();
    const rowCounty = String(row.county || row.COUNTY || row.county_name || '').toUpperCase().replace(/\s+COUNTY$/, '');
    return (!normalizedState || rowState === normalizedState) && (!normalizedCounty || rowCounty === normalizedCounty);
  });
  return {
    query: { state, county },
    matches,
    retrievedFrom: 'EPA Green Book official export',
    warning: 'Confirm the export posting date and current designation with the permitting agency before reliance.',
  };
}

async function fetchStructured(url, provider) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Brick-PermitOS/1.0 structured-data-adapter' },
    });
    if (!response.ok) throw new Error(`${provider} returned HTTP ${response.status}`);
    const raw = await response.text();
    if (raw.length > 5_000_000) throw new Error(`${provider} response exceeded 5 MB`);
    const payload = JSON.parse(raw);
    return {
      provider,
      sourceUrl: url.toString(),
      retrievedAt: new Date().toISOString(),
      sha256: crypto.createHash('sha256').update(raw).digest('hex'),
      payload,
    };
  } finally {
    clearTimeout(timeout);
  }
}
