import crypto from 'crypto';

const ALLOWED_HOSTS = new Set([
  'www.epa.gov',
  'www3.epa.gov',
  'cfpub.epa.gov',
  'echo.epa.gov',
  'echodata.epa.gov',
  'www.ecfr.gov',
  'www.tn.gov',
  'www.deq.virginia.gov',
  'www.tceq.texas.gov',
  'azdeq.gov',
  'ww2.arb.ca.gov',
  'www.waterboards.ca.gov',
  'epd.georgia.gov',
  'ndep.nv.gov',
  'epa.ohio.gov',
  'www.oregon.gov',
  'www.deq.nc.gov',
  'des.sc.gov',
]);

export async function fetchOfficialSource(url, { timeoutMs = 15000, maxBytes = 1_000_000 } = {}) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`Source host is not approved: ${parsed.hostname}`);
  }
  if (parsed.username || parsed.password || parsed.port) {
    throw new Error('Credentials and custom ports are not allowed in source URLs');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(parsed, {
      redirect: 'error',
      signal: controller.signal,
      headers: { 'User-Agent': 'Brick-PermitOS/1.0 evidence-retriever' },
    });
    if (!response.ok) throw new Error(`Official source returned HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/json') && !contentType.includes('text/plain')) {
      throw new Error(`Unsupported source content type: ${contentType}`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > maxBytes) throw new Error(`Source exceeds ${maxBytes} byte limit`);
    const raw = new TextDecoder().decode(bytes);
    const text = contentType.includes('text/html') ? htmlToText(raw) : raw;
    return {
      url: parsed.toString(),
      host: parsed.hostname,
      retrievedAt: new Date().toISOString(),
      contentType,
      byteLength: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      title: extractTitle(raw) || parsed.hostname,
      text: text.slice(0, 100_000),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function approvedSourceHosts() {
  return [...ALLOWED_HOSTS];
}

function htmlToText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? htmlToText(match[1]) : null;
}
