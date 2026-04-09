/**
 * /api/track — fire-and-forget hit counter for command pages.
 *
 * Called client-side by templates/track.js on each /f/{slug}/ page visit.
 * Increments a Redis sorted set so the most-visited commands rise to the top.
 *
 * Security:
 *   - Only POST accepted; all other methods get 405.
 *   - Slug validated against a strict allowlist pattern before any Redis call.
 *   - No data returned to caller — responses are intentionally content-free.
 *   - Redis errors are silently swallowed; tracking is best-effort and must
 *     never affect page load.
 */

export const config = { runtime: 'edge' };

// Matches the slug format used throughout the site: lowercase alphanumeric + hyphens.
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,98}[a-z0-9]$|^[a-z0-9]$/;

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(null, { status: 405 });
  }

  const redisUrl   = process.env.KV_REST_API_URL;
  const redisToken = process.env.KV_REST_API_TOKEN;

  if (!redisUrl || !redisToken) {
    // Redis not configured (local dev without .env) — silently no-op.
    return new Response(null, { status: 200 });
  }

  let slug;
  try {
    const body = await req.json();
    slug = body && body.slug;
  } catch (_) {
    return new Response(null, { status: 400 });
  }

  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
    return new Response(null, { status: 400 });
  }

  try {
    // ZINCRBY popular_commands 1 {slug}
    // Uses Upstash REST API — no SDK dependency needed.
    await fetch(
      `${redisUrl}/zincrby/popular_commands/1/${encodeURIComponent(slug)}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${redisToken}` },
      }
    );
  } catch (_) {
    // Best-effort — never surface Redis errors to the caller.
  }

  return new Response(null, { status: 200 });
}
