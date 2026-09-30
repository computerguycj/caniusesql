/**
 * popular.test.mjs — unit tests for src/elements/popular.js.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPopularSlugs, resolvePopular } from '../src/elements/popular.js';

const INDEX = {
  join: { slug: 'join', description: 'd' },
  merge: { slug: 'merge', description: 'd' },
  'with (common table expressions)': { slug: 'with-cte', description: 'd' },
};

const respond = (ok, body) => async () => ({ ok, status: ok ? 200 : 500, json: async () => body });

test('resolvePopular keeps the order of the slugs', () => {
  assert.deepEqual(resolvePopular(['with-cte', 'join'], INDEX), [
    { name: 'with (common table expressions)', slug: 'with-cte' },
    { name: 'join', slug: 'join' },
  ]);
});

test('resolvePopular drops unknown, non-string and repeated slugs', () => {
  assert.deepEqual(
    resolvePopular(['nope', 42, null, { slug: 'join' }, 'merge', 'merge', '<b>'], INDEX),
    [{ name: 'merge', slug: 'merge' }],
  );
});

test('resolvePopular without slugs or an index is empty', () => {
  assert.deepEqual(resolvePopular('join', INDEX), []);
  assert.deepEqual(resolvePopular(['join'], null), []);
});

test('loadPopularSlugs returns the array', async () => {
  assert.deepEqual(await loadPopularSlugs('/p', respond(true, ['join', 'merge'])), ['join', 'merge']);
});

for (const [why, fetchImpl] of [
  ['a failed status', respond(false, ['join'])],
  ['a body that is not an array', respond(true, { result: ['join'] })],
  ['a body that is not JSON', async () => ({ ok: true, json: async () => { throw new SyntaxError('x'); } })],
  ['a network error', async () => { throw new TypeError('Failed to fetch'); }],
]) {
  test(`loadPopularSlugs is empty on ${why}`, async () => {
    assert.deepEqual(await loadPopularSlugs('/p', fetchImpl), []);
  });
}
