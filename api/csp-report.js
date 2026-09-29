/**
 * /api/csp-report — receives Content Security Policy violation reports.
 *
 * Browsers POST here when the page breaks the policy in vercel.json
 * (report-uri for older browsers, report-to/Reporting-Endpoints for newer
 * ones). Each report is written as one log line, readable in the Vercel
 * dashboard's runtime logs. Nothing is stored.
 *
 * Security:
 *   - Only POST accepted; all other methods get 405.
 *   - Bodies over 16 KB are dropped unread past that limit.
 *   - Only a few known fields are logged, each truncated, so a hostile
 *     client can't flood or forge log output.
 *   - No data returned to caller.
 */

export const config = { runtime: 'edge' };

const MAX_BYTES = 16 * 1024;

const clip = v => String(v ?? '').slice(0, 200).replace(/[\r\n]/g, ' ');

// Both report formats carry the same facts under different names.
function summarize(report) {
  const r = report['csp-report'] || report.body || report;
  return {
    directive: clip(r['effective-directive'] || r.effectiveDirective || r['violated-directive']),
    blocked: clip(r['blocked-uri'] || r.blockedURL),
    page: clip(r['document-uri'] || r.documentURL),
    sample: clip(r['script-sample'] || r.sample),
    disposition: clip(r.disposition),
  };
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(null, { status: 405 });
  }
  try {
    const text = (await req.text()).slice(0, MAX_BYTES);
    const parsed = JSON.parse(text);
    const reports = Array.isArray(parsed) ? parsed : [parsed];
    for (const report of reports.slice(0, 20)) {
      console.log('csp-violation', JSON.stringify(summarize(report)));
    }
  } catch {
    // Malformed report: ignore.
  }
  return new Response(null, { status: 204 });
}
