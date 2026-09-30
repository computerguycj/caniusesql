/**
 * command-index.test.mjs — unit tests for loadCommandIndex in
 * src/elements/commandIndex.js: API first, static data.json on any failure.
 * fetch is a fake; each test says what each URL returns.
 */
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadCommandIndex, loadCommandIndexShared, clearSharedCommandIndex, isCommandIndex,
} from '../src/elements/commandIndex.js';

const API = '/api/v2/command-index';
const FALLBACK = '/data.json?v=2';
const INDEX = { join: { slug: 'join', description: 'Combine rows' } };
const FULL = { join: { slug: 'join', description: 'Combine rows', syntax: 'SELECT …' } };

const json = body => ({ ok: true, status: 200, json: async () => body });
const status = code => ({ ok: false, status: code, json: async () => ({}) });

// routes: url -> response, or a function (options) => Promise<response>.
function fakeFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push(url);
    const route = routes[url];
    if (!route) throw new TypeError('Failed to fetch');
    return typeof route === 'function' ? route(options) : route;
  };
  return { fetchImpl, calls };
}

// The fallback path logs a warning by design; keep test output clean.
let warn;
beforeEach(() => { warn = console.warn; console.warn = () => {}; clearSharedCommandIndex(); });
afterEach(() => { console.warn = warn; });

const load = (fetchImpl, timeoutMs) =>
  loadCommandIndex({ src: API, fallbackSrc: FALLBACK, fetchImpl, timeoutMs });

test('uses the API when it answers with an index', async () => {
  const { fetchImpl, calls } = fakeFetch({ [API]: json(INDEX), [FALLBACK]: json(FULL) });
  const result = await load(fetchImpl);
  assert.deepEqual(result, { commands: INDEX, source: 'api' });
  assert.deepEqual(calls, [API]);  // no fallback request
});

for (const [why, apiRoute] of [
  ['a network error', undefined],
  ['a 500', status(500)],
  ['a 404', status(404)],
  ['a body that is not JSON', { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } }],
  ['JSON that is not an index', json({ status: 'ok' })],
  ['an empty object', json({})],
]) {
  test(`falls back to data.json on ${why}`, async () => {
    const { fetchImpl, calls } = fakeFetch({ [API]: apiRoute, [FALLBACK]: json(FULL) });
    const result = await load(fetchImpl);
    assert.deepEqual(result, { commands: FULL, source: 'fallback' });
    assert.deepEqual(calls, [API, FALLBACK]);
  });
}

test('falls back when the API takes longer than the timeout', async () => {
  // Never answers on its own; rejects when the timeout's signal aborts.
  // AbortSignal.timeout's timer doesn't keep Node's event loop alive (a real
  // pending request would), so hold it open until the abort.
  const hang = options => new Promise((_, reject) => {
    const keepAlive = setTimeout(() => {}, 10_000);
    options.signal.addEventListener('abort', () => {
      clearTimeout(keepAlive);
      reject(options.signal.reason);
    });
  });
  const { fetchImpl } = fakeFetch({ [API]: hang, [FALLBACK]: json(FULL) });
  const started = Date.now();
  const result = await load(fetchImpl, 50);
  assert.equal(result.source, 'fallback');
  assert.ok(Date.now() - started < 2000);
});

test('rejects when the fallback fails too', async () => {
  const { fetchImpl } = fakeFetch({ [API]: status(503), [FALLBACK]: status(404) });
  await assert.rejects(load(fetchImpl), /data\.json.*404/);
});

test('isCommandIndex accepts the index and data.json, nothing else', () => {
  assert.ok(isCommandIndex(INDEX));
  assert.ok(isCommandIndex(FULL));
  for (const bad of [null, [], 'x', {}, { a: 1 }, { a: { slug: 1 } }, { a: {}, b: { slug: 'b' } }]) {
    assert.equal(isCommandIndex(bad), false, JSON.stringify(bad));
  }
});

test('shared: callers with the same URLs share one request', async () => {
  const { fetchImpl, calls } = fakeFetch({ [API]: json(INDEX) });
  const options = { src: API, fallbackSrc: FALLBACK, fetchImpl };
  const [a, b] = await Promise.all([loadCommandIndexShared(options), loadCommandIndexShared(options)]);
  assert.equal(a, b);
  assert.deepEqual(calls, [API]);
});

test('shared: different URLs load separately', async () => {
  const { fetchImpl, calls } = fakeFetch({ [API]: json(INDEX), '/other': json(INDEX) });
  await loadCommandIndexShared({ src: API, fallbackSrc: FALLBACK, fetchImpl });
  await loadCommandIndexShared({ src: '/other', fallbackSrc: FALLBACK, fetchImpl });
  assert.deepEqual(calls, [API, '/other']);
});

test('shared: a failed load is retried by the next caller', async () => {
  const failing = fakeFetch({ [API]: status(503), [FALLBACK]: status(503) });
  await assert.rejects(loadCommandIndexShared({ src: API, fallbackSrc: FALLBACK, fetchImpl: failing.fetchImpl }));
  const working = fakeFetch({ [API]: json(INDEX) });
  const result = await loadCommandIndexShared({ src: API, fallbackSrc: FALLBACK, fetchImpl: working.fetchImpl });
  assert.equal(result.source, 'api');
});
