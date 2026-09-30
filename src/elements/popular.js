/**
 * popular.js — data for <popular-commands>: the most-visited slugs from
 * /api/popular, turned into names with the command index.
 *
 * Plain functions with fetch passed in, unit tested in
 * tests/popular.test.mjs.
 */

/**
 * Most-visited slugs, best first. Any failure (network, status, not JSON,
 * not an array) is an empty list, which leaves the build-time list showing.
 */
export async function loadPopularSlugs(src, fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl(src);
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
}

/**
 * [{ name, slug }] in the order of `slugs`. Only slugs that are strings and
 * are in the index come through, so a bad value from the popularity store
 * can't become a link. Duplicates are dropped.
 */
export function resolvePopular(slugs, index) {
  if (!Array.isArray(slugs) || !index) return [];
  const nameBySlug = new Map();
  for (const [name, entry] of Object.entries(index)) {
    if (entry && typeof entry.slug === 'string') nameBySlug.set(entry.slug, name);
  }
  const seen = new Set();
  const result = [];
  for (const slug of slugs) {
    if (typeof slug !== 'string' || seen.has(slug) || !nameBySlug.has(slug)) continue;
    seen.add(slug);
    result.push({ name: nameBySlug.get(slug), slug });
  }
  return result;
}
