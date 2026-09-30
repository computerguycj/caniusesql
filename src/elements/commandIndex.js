/**
 * commandIndex.js — the search box's data: name -> { slug, description, … }.
 *
 * loadCommandIndex() is plain async code with fetch passed in, so it's unit
 * tested without a browser (tests/command-index.test.mjs).
 * useCommandIndex() is the Vue composable around it: reactive refs, loaded
 * when the component mounts.
 *
 * Source order: the API's slim index first (/api/v2/command-index, ~27 KB).
 * If that fails for any reason (network error, non-2xx, not JSON, not the
 * expected shape, or no answer in time), the full static /data.json, which
 * has the same fields and more. So search works without the API: before it's
 * deployed, during an outage, and under `vite preview`, which has no API.
 */
import { ref, onMounted } from 'vue';

// A cold start after the API has scaled to zero takes a few seconds (an
// estimate); past this, the static file is the faster answer.
export const API_TIMEOUT_MS = 5000;

// Every value must look like a command with a string slug. Guards against a
// 200 that isn't the index (an HTML page from a misrouted request, a proxy's
// error page served as JSON).
export function isCommandIndex(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const entries = Object.values(data);
  return entries.length > 0 && entries.every(e =>
    e && typeof e === 'object' && typeof e.slug === 'string');
}

async function fetchIndex(url, fetchImpl, signal) {
  const response = await fetchImpl(url, signal ? { signal } : undefined);
  if (!response.ok) {
    throw new Error('Failed to load ' + url + ': ' + response.status);
  }
  const data = await response.json();
  if (!isCommandIndex(data)) {
    throw new Error('Unexpected data from ' + url);
  }
  return data;
}

/**
 * @returns {Promise<{ commands: Object, source: 'api' | 'fallback' }>}
 *          Rejects only if the fallback fails too.
 */
export async function loadCommandIndex({
  src,
  fallbackSrc,
  fetchImpl = globalThis.fetch,
  timeoutMs = API_TIMEOUT_MS,
}) {
  try {
    const commands = await fetchIndex(src, fetchImpl, AbortSignal.timeout(timeoutMs));
    return { commands, source: 'api' };
  } catch (error) {
    console.warn('Search: using ' + fallbackSrc + ' (' + error.message + ')');
  }
  const commands = await fetchIndex(fallbackSrc, fetchImpl);
  return { commands, source: 'fallback' };
}

/**
 * Composable: call from a component's setup. `commands` stays null until a
 * source loads; `source` says which one did.
 */
export function useCommandIndex(src, fallbackSrc) {
  const commands = ref(null);
  const source = ref(null);

  onMounted(() => {
    loadCommandIndex({ src, fallbackSrc })
      .then(result => {
        commands.value = result.commands;
        source.value = result.source;
      })
      .catch(error => {
        // Both failed: search stays inert, as it did before a load finished.
        console.error(error);
      });
  });

  return { commands, source };
}
