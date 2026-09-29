/**
 * build.test.js — smoke test for the static build.
 *
 * Runs the full build (generate.js, then vite build), then checks the SEO
 * basics on every generated page: canonical tag, <h1>, compatibility table,
 * homepage cards, and sitemap. Also checks the custom elements bundle exists.
 *
 * Uses regex over the generated HTML instead of a DOM parser so the test
 * needs no dependencies. The markup comes from generate.js, which we control.
 *
 * Usage:  npm test
 */

const { test, before } = require('node:test');
const assert           = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs               = require('node:fs');
const path             = require('node:path');

const ROOT     = path.join(__dirname, '..');
const DIST     = path.join(ROOT, 'dist');
const BASE_URL = 'https://www.caniusesql.com';

const data     = JSON.parse(fs.readFileSync(path.join(ROOT, 'data.json'), 'utf8'));
const commands = Object.entries(data).filter(([, entry]) => entry.slug);

// Mirrors esc() in generate.js so expected text matches the escaped HTML.
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function count(html, re) {
  return (html.match(re) || []).length;
}

function canonicals(html) {
  return [...html.matchAll(/<link rel="canonical" href="([^"]*)">/g)].map(m => m[1]);
}

function readDist(...parts) {
  return fs.readFileSync(path.join(DIST, ...parts), 'utf8');
}

before(() => {
  // Same steps as `npm run build`. Throws (and fails every test) if either exits non-zero.
  execFileSync(process.execPath, [path.join(ROOT, 'generate.js')], { cwd: ROOT, stdio: 'pipe' });
  execFileSync(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'], { cwd: ROOT, stdio: 'pipe' });
});

test('one page per command with a slug, plus the homepage', () => {
  const pageDirs = fs.readdirSync(path.join(DIST, 'f'));
  assert.equal(pageDirs.length, commands.length);
  assert.ok(fs.existsSync(path.join(DIST, 'index.html')));
});

test('every command page has its canonical, h1, and compatibility table', () => {
  for (const [name, entry] of commands) {
    const html = readDist('f', entry.slug, 'index.html');
    const where = `/f/${entry.slug}`;

    assert.deepEqual(canonicals(html), [`${BASE_URL}/f/${entry.slug}`], `${where}: canonical`);

    const h1s = [...html.matchAll(/<h1>(.*?)<\/h1>/g)].map(m => m[1]);
    assert.deepEqual(h1s, [esc(name.toUpperCase())], `${where}: h1`);

    assert.match(html, /<table>\s*<caption>[^<]+<\/caption>/, `${where}: table with caption`);

    for (const db of Object.keys(entry.compatibility)) {
      assert.equal(count(html, new RegExp(`<tr data-db="${db}">`, 'g')), 1, `${where}: row for ${db}`);
    }
  }
});

test('homepage has its canonical, a card per command, and popular commands', () => {
  const html = readDist('index.html');

  assert.deepEqual(canonicals(html), ['https://caniusesql.com/']);
  assert.equal(count(html, /class="command-card /g), commands.length);

  const popular = html.match(/<div id="popular-commands-list">([\s\S]*?)<\/div>/);
  assert.ok(popular, 'popular commands list exists');
  assert.ok(count(popular[1], /<a class="example"/g) > 0, 'popular commands list is not empty');
});

test('sitemap lists the homepage and every command page', () => {
  const xml  = readDist('sitemap.xml');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

  assert.equal(locs.length, commands.length + 1);
  assert.ok(locs.includes(`${BASE_URL}/`));
  for (const [, entry] of commands) {
    assert.ok(locs.includes(`${BASE_URL}/f/${entry.slug}`), `sitemap: /f/${entry.slug}`);
  }
});

test('vite build writes the custom elements bundle', () => {
  assert.ok(fs.existsSync(path.join(DIST, 'assets', 'elements.js')));
});
