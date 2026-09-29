/**
 * csp-report.test.mjs — unit tests for the /api/csp-report edge function.
 * Runs in Node (which has the same Request/Response globals as the edge
 * runtime) as part of `npm test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/csp-report.js';

function capture(fn) {
  const lines = [];
  const original = console.log;
  console.log = (...args) => lines.push(args.join(' '));
  return fn().finally(() => { console.log = original; }).then(res => ({ res, lines }));
}

const post = body => new Request('https://example.test/api/csp-report', { method: 'POST', body });

test('rejects anything but POST', async () => {
  const res = await handler(new Request('https://example.test/api/csp-report'));
  assert.equal(res.status, 405);
});

test('logs a report-uri style report', async () => {
  const body = JSON.stringify({ 'csp-report': {
    'document-uri': 'https://www.caniusesql.com/f/merge/',
    'effective-directive': 'style-src-elem',
    'blocked-uri': 'inline',
    disposition: 'report',
  } });
  const { res, lines } = await capture(() => handler(post(body)));
  assert.equal(res.status, 204);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^csp-violation .*"directive":"style-src-elem".*"page":"https:\/\/www.caniusesql.com\/f\/merge\/"/);
});

test('logs each report in a report-to style batch, capped at 20', async () => {
  const one = { type: 'csp-violation', body: { documentURL: 'https://x/', effectiveDirective: 'img-src', blockedURL: 'https://evil.example/a.png' } };
  const { res, lines } = await capture(() => handler(post(JSON.stringify(Array(25).fill(one)))));
  assert.equal(res.status, 204);
  assert.equal(lines.length, 20);
  assert.match(lines[0], /"blocked":"https:\/\/evil.example\/a.png"/);
});

test('truncates long fields and strips newlines', async () => {
  const body = JSON.stringify({ 'csp-report': { 'blocked-uri': 'a'.repeat(500) + '\nforged-line' } });
  const { lines } = await capture(() => handler(post(body)));
  assert.equal(lines.length, 1);
  assert.ok(!lines[0].includes('\n'));
  assert.ok(lines[0].length < 400);
});

test('ignores malformed bodies', async () => {
  const { res, lines } = await capture(() => handler(post('not json')));
  assert.equal(res.status, 204);
  assert.equal(lines.length, 0);
});
