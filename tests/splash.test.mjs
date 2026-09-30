/**
 * splash.test.mjs — unit tests for src/elements/splash.js.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SPLASH_COOKIE, readCookie, cookiesAvailable, shouldShowSplash, markSplashSeen,
} from '../src/elements/splash.js';

// A stand-in for document.cookie: setting "name=value; attrs" stores it (or
// deletes it if it expires in the past); reading gives "a=1; b=2".
function cookieJar({ blocked = false, throws = false } = {}) {
  const jar = new Map();
  const writes = [];
  return {
    writes,
    get cookie() {
      if (throws) throw new Error('SecurityError');
      return [...jar].map(([k, v]) => k + '=' + v).join('; ');
    },
    set cookie(text) {
      if (throws) throw new Error('SecurityError');
      writes.push(text);
      if (blocked) return;
      const [pair, ...attrs] = text.split(';').map(s => s.trim());
      const [name, value] = [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)];
      const expires = attrs.find(a => a.toLowerCase().startsWith('expires='));
      if (expires && new Date(expires.slice(8)) < new Date()) jar.delete(name);
      else jar.set(name, value);
    },
  };
}

test('readCookie finds one cookie among several', () => {
  assert.equal(readCookie('a=1; caniusesql_splash=1; b=2', SPLASH_COOKIE), '1');
  assert.equal(readCookie('a=1; b=2', SPLASH_COOKIE), null);
  assert.equal(readCookie('', SPLASH_COOKIE), null);
  // A cookie whose name only ends with ours doesn't count.
  assert.equal(readCookie('x_caniusesql_splash=1', SPLASH_COOKIE), null);
});

test('shown on a first visit, then not after it is marked seen', () => {
  const doc = cookieJar();
  assert.equal(shouldShowSplash(doc), true);
  markSplashSeen(doc);
  assert.equal(shouldShowSplash(doc), false);
});

test('the probe cookie is cleaned up', () => {
  const doc = cookieJar();
  assert.equal(cookiesAvailable(doc), true);
  assert.equal(doc.cookie, '');
});

test('never shown when cookies are blocked or throw', () => {
  assert.equal(shouldShowSplash(cookieJar({ blocked: true })), false);
  assert.equal(shouldShowSplash(cookieJar({ throws: true })), false);
});

test('marked seen for a year, site-wide, SameSite=Lax', () => {
  const doc = cookieJar();
  markSplashSeen(doc, new Date('2026-09-30T12:00:00Z'));
  const written = doc.writes.at(-1);
  assert.match(written, /^caniusesql_splash=1; /);
  assert.match(written, /expires=Thu, 30 Sep 2027/);
  assert.match(written, /path=\//);
  assert.match(written, /SameSite=Lax/);
});
