/**
 * /api/popular — returns the top N most-visited command slugs.
 *
 * Called client-side by the homepage to dynamically populate the
 * "Popular Commands" section without a full site rebuild.
 *
 * Security:
 *   - Only GET accepted.
 *   - Returns only slug strings from a trusted Redis sorted set.
 *   - No user input involved in the query.
 *   - Short cache: stale-while-revalidate so the list feels live
 *     without hammering Redis on every page load.
 */

export const config = { runtime: 'edge' };

const TOP_N = 6;

export default async function handler(req) {
  if (req.method !== 'GET') {
    return new Response(null, { status: 405 });
  }

  const redisUrl   = process.env.KV_REST_API_URL;
  const redisToken = process.env.KV_REST_API_TOKEN;

  if (!redisUrl || !redisToken) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const res = await fetch(
      `${redisUrl}/zrevrange/popular_commands/0/${TOP_N - 1}`,
      { headers: { Authorization: `Bearer ${redisToken}` } }
    );

    if (!res.ok) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const json  = await res.json();
    const slugs = Array.isArray(json && json.result) ? json.result : [];

    return new Response(JSON.stringify(slugs), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        // Fresh for 5 minutes, then serve stale while revalidating up to 1 hour.
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      },
    });
  } catch (_) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
