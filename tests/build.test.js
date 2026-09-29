/**
 * build.test.js — smoke test for the static build.
 *
 * Runs the full build (generate.js, then vite build), then checks the SEO
 * basics on every generated page: canonical tag, <h1>, compatibility table,
 * homepage cards, and sitemap. Also checks the custom elements bundle exists
 * and every page loads it with one <db-filter> and one <command-search>,
 * every SQL block on a command page sits inside a <copy-code>, and every
 * page links tokens.css before styles.css.
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

    // The SQL stays in the static HTML, inside the <copy-code> that adds its button.
    assert.ok(html.includes(`<copy-code><div class="syntax">${esc(entry.syntax)}</div></copy-code>`), `${where}: standard syntax in <copy-code>`);
    assert.equal(
      count(html, /<copy-code><div class="syntax">/g),
      count(html, /class="syntax"/g),
      `${where}: every syntax block in <copy-code>`,
    );
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

test('every page has one <db-filter>, one <command-search>, and loads the elements bundle', () => {
  const pages = [
    ['/', readDist('index.html')],
    ...commands.map(([, entry]) => [`/f/${entry.slug}`, readDist('f', entry.slug, 'index.html')]),
  ];
  for (const [where, html] of pages) {
    assert.equal(count(html, /<db-filter databases="[^"]+"><\/db-filter>/g), 1, `${where}: <db-filter>`);
    assert.equal(count(html, /<script type="module" src="\/assets\/elements.js"><\/script>/g), 1, `${where}: bundle script`);
    assert.equal(count(html, /class="compare-bar"/g), 0, `${where}: old static filter bar removed`);
    assert.equal(count(html, /<command-search><\/command-search>/g), 1, `${where}: <command-search>`);
    assert.equal(count(html, /class="site-search"|class="search-results"/g), 0, `${where}: old static search box removed`);
    assert.equal(count(html, /search\.js/g), 0, `${where}: search.js no longer loaded`);
    assert.match(html, /<link rel="stylesheet" href="\/tokens\.css">\s*<link rel="stylesheet" href="\/styles\.css">/, `${where}: tokens.css linked before styles.css`);
  }
});

test('tokens.css fallback for browsers without light-dark() matches the light values', () => {
  const css = fs.readFileSync(path.join(ROOT, 'templates', 'tokens.css'), 'utf8');
  const [main, fallback] = css.split('@supports not (color: light-dark(#000, #fff))');
  const decls = text => Object.fromEntries([...text.matchAll(/^\s*(--[\w-]+):\s*(.+?);\s*$/gm)].map(m => [m[1], m[2]]));
  const themed = Object.entries(decls(main)).filter(([name]) => !/^--(splash|logo)-/.test(name));
  const fb = decls(fallback);
  assert.ok(themed.length > 0);
  for (const [name, value] of themed) {
    // Light value = the first argument of each light-dark(); tokens without light-dark() are the same in both.
    const light = value.replace(/light-dark\(((?:[^(),]|\([^()]*\))+),\s*(?:[^(),]|\([^()]*\))+\)/g, '$1');
    assert.equal(fb[name], light, `fallback ${name}`);
  }
  assert.deepEqual(Object.keys(fb).sort(), themed.map(([n]) => n).sort(), 'fallback has exactly the themed tokens');
});
