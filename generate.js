#!/usr/bin/env node
/**
 * generate.js — static page generator for caniusesql.com
 *
 * Reads data.json and writes one HTML file per command to dist/f/{slug}/index.html.
 * Also assembles dist/index.html from src/index.html + shared templates,
 * copies shared assets, and regenerates sitemap.xml into dist/.
 *
 * Usage:  node generate.js
 * Vercel: set buildCommand to "node generate.js", outputDirectory to "dist"
 */

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL      = 'https://www.caniusesql.com';
const DATA_FILE     = path.join(__dirname, 'data.json');
const OUT_DIR       = path.join(__dirname, 'dist');
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const SRC_DIR       = path.join(__dirname, 'src');

const DB_LABELS = {
  mysql:      'MySQL',
  postgresql: 'PostgreSQL',
  sqlserver:  'SQL Server',
  oracle:     'Oracle',
  sqlite:     'SQLite',
};

const DB_COUNT = Object.keys(DB_LABELS).length;

// Slugs used when Redis has no data yet (first deploy, local dev without .env).
const DEFAULT_POPULAR_SLUGS = [
  'select',
  'merge',
  'pivot',
  'string-agg',
  'with-common-table-expressions',
  'window-functions',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mkdir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readTemplate(filename) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, filename), 'utf8');
}

// ---------------------------------------------------------------------------
// Popular commands (Redis-backed, falls back to defaults)
// ---------------------------------------------------------------------------

/**
 * fetchPopularSlugs — queries Upstash Redis for the top N most-visited slugs.
 *
 * Uses the Upstash REST API directly (no SDK) to keep generate.js dependency-free.
 * Returns null when Redis env vars are absent (local dev) or the request fails,
 * so callers can fall back to DEFAULT_POPULAR_SLUGS.
 *
 * @param {number} topN
 * @returns {Promise<string[]|null>}
 */
async function fetchPopularSlugs(topN) {
  const redisUrl   = process.env.KV_REST_API_URL;
  const redisToken = process.env.KV_REST_API_TOKEN;

  if (!redisUrl || !redisToken) {
    return null;
  }

  try {
    // ZREVRANGE popular_commands 0 (topN-1) — returns members highest-score first.
    const res = await fetch(
      `${redisUrl}/zrevrange/popular_commands/0/${topN - 1}`,
      { headers: { Authorization: `Bearer ${redisToken}` } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const slugs = json && json.result;
    return Array.isArray(slugs) && slugs.length > 0 ? slugs : null;
  } catch (_) {
    return null;
  }
}

/**
 * buildPopularCommands — generates the Popular Commands link HTML.
 *
 * Resolves each slug to its display name via data; skips any slug not found.
 * All values are escaped via esc() before injection.
 *
 * @param {string[]} slugs
 * @param {Object}   data   - parsed data.json, keyed by command name
 * @returns {string} HTML fragment
 */
function buildPopularCommands(slugs, data) {
  // Build a reverse lookup: slug → command name
  const slugToName = {};
  for (const [name, entry] of Object.entries(data)) {
    if (entry.slug) slugToName[entry.slug] = name;
  }

  return slugs
    .filter(slug => slugToName[slug])
    .map(slug => {
      const name = slugToName[slug];
      return `<a class="example" href="/f/${esc(slug)}">${esc(name.toUpperCase())}</a>`;
    })
    .join('\n  ');
}

function supportClass(count) {
  if (count === DB_COUNT) return 'support-5';
  if (count >= 3)         return 'support-mid';
  if (count >= 1)         return 'support-low';
  return 'support-none';
}

// ---------------------------------------------------------------------------
// Template assembly
// ---------------------------------------------------------------------------

/**
 * applyTemplate — substitutes {{KEY}} placeholders in the header template,
 * then assembles the full HTML document.
 *
 * Security: all values in `vars` must be pre-escaped via esc() before being
 * passed here. Raw data strings must never be inserted directly.
 *
 * @param {string} headerTpl   - contents of templates/header.html
 * @param {string} headHtml    - page-specific <head> content (already safe)
 * @param {string} bodyContent - main body content (already safe)
 * @param {Object} vars        - placeholder values, all pre-escaped
 * @returns {string} complete HTML document
 */
function applyTemplate(headerTpl, headHtml, bodyContent, vars) {
  const header = headerTpl.replace(/\{\{(\w+)\}\}/g, function (match, key) {
    return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : '';
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="stylesheet" href="/styles.css">
${headHtml}
</head>
<body>

<a href="#main-content" class="skip-link">Skip to main content</a>
${header}
<main id="main-content">
${bodyContent}
</main>
<footer class="site-footer">
  <p>&copy; 2024 Can I Use SQL. All rights reserved.</p>
</footer>
  <script src="/search.js" defer></script>
  <script src="/splash.js" defer></script>
  <script src="/track.js" defer></script>
  <script src="/compare.js" defer></script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Command page builder
// ---------------------------------------------------------------------------

function buildPage(commandName, entry, headerTpl) {
  const { slug, description, overview, details, syntax, compatibility, category } = entry;

  const displayName = commandName.toUpperCase();
  const title       = `${displayName} SQL Compatibility | MySQL, PostgreSQL, SQL Server, Oracle, SQLite`;
  const metaDesc    = `${displayName}: ${description} Check support across MySQL, PostgreSQL, SQL Server, Oracle, and SQLite.`;
  const canonical   = `${BASE_URL}/f/${slug}`;

  // ── Compatibility table ─────────────────────────────────────────────────
  let tableRows = '';
  for (const [db, info] of Object.entries(compatibility)) {
    const label       = DB_LABELS[db] || db;
    const supported   = info.supported;
    const statusClass = supported ? 'supported' : 'not-supported';
    const symbol      = supported ? '✓' : '✗';
    const statusText  = supported ? 'Supported' : 'Not Supported';
    const since       = info.since || '—';
    tableRows += `
          <tr data-db="${esc(db)}">
            <td>${esc(label)}</td>
            <td class="${statusClass}"><span aria-hidden="true">${symbol}</span> <span class="status-text">${statusText}</span></td>
            <td>${esc(since)}</td>
            <td class="notes">${esc(info.notes || '')}</td>
          </tr>`;
  }

  // ── Version badges ──────────────────────────────────────────────────────
  let badges = '';
  for (const [db, info] of Object.entries(compatibility)) {
    const label      = DB_LABELS[db] || db;
    const badgeClass = info.supported ? 'version-supported' : 'version-not-supported';
    const symbol     = info.supported ? '✓' : '✗';
    const text       = info.supported
      ? `${label}: Since ${info.since ?? '?'}`
      : `${label}: Not supported`;
    badges += `<span class="version-badge ${badgeClass}"><span aria-hidden="true">${symbol}</span> ${esc(text)}</span>\n    `;
  }

  // ── Per-DB syntax blocks ────────────────────────────────────────────────
  let syntaxBlocks = '';
  for (const [db, info] of Object.entries(compatibility)) {
    if (!info.syntax) continue;
    const label = DB_LABELS[db] || db;
    const note  = info.notes
      ? `<p class="notes">${esc(info.notes)}</p>`
      : '';
    syntaxBlocks += `
      <div class="per-db-entry" data-db="${esc(db)}">
        <h4>${esc(label)}</h4>
        ${note}
        <div class="syntax">${esc(info.syntax)}</div>
      </div>`;
  }

  // ── Category badge ──────────────────────────────────────────────────────
  const categoryBadge = category
    ? `<span class="category-badge">${esc(category)}</span>`
    : '';

  // ── Command heading (goes into {{COMMAND_HEADING}} placeholder) ─────────
  const commandHeading = `<h1>${esc(displayName)}</h1>${categoryBadge}`;

  // ── Page-specific <head> ────────────────────────────────────────────────
  const headHtml = `  <title>${esc(title)}</title>
  <meta name="description" content="${esc(metaDesc)}">
  <meta property="og:site_name" content="Can I Use SQL?">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(metaDesc)}">
  <meta property="og:image" content="${BASE_URL}/og-image.png?v=5">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(metaDesc)}">
  <meta name="twitter:image" content="${BASE_URL}/og-image.png?v=5">
  <link rel="sitemap" type="application/xml" href="/sitemap.xml">
  <link rel="canonical" href="${esc(canonical)}">`;

  // ── Body content ────────────────────────────────────────────────────────
  const bodyContent = `
  <p class="command-desc">${esc(description)}</p>
  ${overview ? `<p class="command-overview">${esc(overview)}</p>` : ''}

  <h2>Compatibility</h2>
  <fieldset class="compare-bar">
    <legend>Filter by Database</legend>
    <label><input type="checkbox" value="mysql" checked> MySQL</label>
    <label><input type="checkbox" value="postgresql" checked> PostgreSQL</label>
    <label><input type="checkbox" value="sqlserver" checked> SQL Server</label>
    <label><input type="checkbox" value="oracle" checked> Oracle</label>
    <label><input type="checkbox" value="sqlite" checked> SQLite</label>
  </fieldset>
  <table>
    <caption>SQL ${esc(displayName)} Compatibility Across Databases</caption>
    <thead>
      <tr>
        <th scope="col">Database System</th>
        <th scope="col">Support Status</th>
        <th scope="col">Since Version</th>
        <th scope="col">Notes</th>
      </tr>
    </thead>
    <tbody>${tableRows}
    </tbody>
  </table>

  <h2>Details</h2>
  <div class="detail-block">
    <p>${esc(details)}</p>
  </div>

  <h2>Standard Syntax</h2>
  <div class="syntax">${esc(syntax)}</div>

  <h2>Version Support</h2>
  <div class="version-list">
    ${badges}
  </div>

  <h2>Per-Database Syntax &amp; Notes</h2>
  <div class="per-db-section">${syntaxBlocks}
  </div>`;

  return applyTemplate(headerTpl, headHtml, bodyContent, {
    COMMAND_HEADING: commandHeading,
  });
}

// ---------------------------------------------------------------------------
// Command list builder (homepage)
// ---------------------------------------------------------------------------

/**
 * buildCommandList — generates category-grouped command cards for the homepage.
 *
 * All data values are passed through esc() before injection into HTML.
 * Categories are ordered by first appearance in data; commands within each
 * category are sorted alphabetically.
 *
 * @param {Object} data - parsed data.json
 * @returns {string} HTML for the full command list section
 */
function buildCommandList(data) {
  // Group commands by category, preserving first-seen category order
  const categoryOrder = [];
  const groups = {};

  for (const [name, entry] of Object.entries(data)) {
    const cat = entry.category || 'Other';
    if (!groups[cat]) {
      groups[cat] = [];
      categoryOrder.push(cat);
    }
    groups[cat].push({ name, entry });
  }

  // Sort commands alphabetically within each category
  for (const cat of categoryOrder) {
    groups[cat].sort((a, b) => a.name.localeCompare(b.name));
  }

  let html = '';

  for (const cat of categoryOrder) {
    let cards = '';

    for (const { name, entry } of groups[cat]) {
      const count       = Object.values(entry.compatibility).filter(d => d.supported).length;
      const cls         = supportClass(count);
      const badge       = `${count}/${DB_COUNT}`;
      const desc        = entry.description || '';
      const supportedBy = Object.entries(entry.compatibility)
        .filter(([, info]) => info.supported)
        .map(([db]) => db)
        .join(' ');

      cards += `
      <a href="/f/${esc(entry.slug)}/" class="command-card ${cls}" data-dbs="${esc(supportedBy)}">
        <span class="card-name">${esc(name.toUpperCase())}</span>
        <span class="card-desc">${esc(desc)}</span>
        <span class="card-support-badge">${esc(badge)}</span>
      </a>`;
    }

    html += `
  <section class="category-group">
    <h2 class="category-heading">${esc(cat)}</h2>
    <div class="command-cards">${cards}
    </div>
  </section>`;
  }

  return html;
}

// ---------------------------------------------------------------------------
// Homepage builder
// ---------------------------------------------------------------------------

function buildHomepage(data, headerTpl, popularCommands) {
  const templateContent = fs.readFileSync(path.join(SRC_DIR, 'index.html'), 'utf8');
  const commandList     = buildCommandList(data);

  // Both substituted values are built entirely from esc()-escaped data.
  // popular.js is homepage-only, appended to body content so it loads after the list.
  const content = templateContent
    .replace('{{COMMAND_LIST}}', commandList)
    .replace('{{POPULAR_COMMANDS}}', popularCommands)
    + '\n<script src="/popular.js" defer></script>';

  const title     = 'Can I Use SQL? | SQL Compatibility Checker';
  const desc      = 'Check SQL command compatibility across MySQL, PostgreSQL, SQL Server, Oracle, and SQLite. Find out which databases support SELECT, MERGE, PIVOT, CTEs, window functions, and more.';
  const canonical = 'https://caniusesql.com/';

  const headHtml = `  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta property="og:site_name" content="Can I Use SQL?">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="https://caniusesql.com/og-image.png?v=5">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="https://caniusesql.com/og-image.png?v=5">
  <link rel="sitemap" type="application/xml" href="/sitemap.xml">
  <link rel="canonical" href="${esc(canonical)}">`;

  return applyTemplate(headerTpl, headHtml, content, {
    COMMAND_HEADING: '<span class="site-title">Can I Use SQL?</span>',
  });
}

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------

function buildSitemap(slugs) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    `  <url>\n    <loc>${BASE_URL}/</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
    ...slugs.map(slug =>
      `  <url>\n    <loc>${BASE_URL}/f/${slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`
    ),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // Load data
  const data     = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const commands = Object.entries(data);

  // Load shared templates
  const headerTpl = readTemplate('header.html');

  mkdir(OUT_DIR);

  // Resolve popular commands (Redis → fallback to defaults)
  const popularSlugs    = await fetchPopularSlugs(6) || DEFAULT_POPULAR_SLUGS;
  const popularCommands = buildPopularCommands(popularSlugs, data);
  console.log(`✔  Popular commands: ${popularSlugs.slice(0, 6).join(', ')}`);

  // Assemble and write homepage
  const homepageHtml = buildHomepage(data, headerTpl, popularCommands);
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), homepageHtml, 'utf8');
  console.log('✔  Built index.html');

  // Copy shared static assets
  fs.copyFileSync(DATA_FILE, path.join(OUT_DIR, 'data.json'));
  console.log('✔  Copied data.json');

  fs.copyFileSync(path.join(TEMPLATES_DIR, 'styles.css'), path.join(OUT_DIR, 'styles.css'));
  console.log('✔  Copied styles.css');

  fs.copyFileSync(path.join(TEMPLATES_DIR, 'search.js'), path.join(OUT_DIR, 'search.js'));
  console.log('✔  Copied search.js');

  fs.copyFileSync(path.join(TEMPLATES_DIR, 'favicon.svg'), path.join(OUT_DIR, 'favicon.svg'));
  console.log('✔  Copied favicon.svg');

  fs.copyFileSync(path.join(TEMPLATES_DIR, 'splash.js'), path.join(OUT_DIR, 'splash.js'));
  console.log('✔  Copied splash.js');

  fs.copyFileSync(path.join(TEMPLATES_DIR, 'track.js'), path.join(OUT_DIR, 'track.js'));
  console.log('✔  Copied track.js');

  fs.copyFileSync(path.join(TEMPLATES_DIR, 'compare.js'), path.join(OUT_DIR, 'compare.js'));
  console.log('✔  Copied compare.js');

  fs.copyFileSync(path.join(TEMPLATES_DIR, 'popular.js'), path.join(OUT_DIR, 'popular.js'));
  console.log('✔  Copied popular.js');

  const staticAssets = ['og-image.png', 'robots.txt', 'favicon.ico', 'favicon.png'];
  for (const asset of staticAssets) {
    const src = path.join(__dirname, asset);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(OUT_DIR, asset));
      console.log(`✔  Copied ${asset}`);
    }
  }

  // Generate one page per command
  const slugs = [];
  let generated = 0;
  let skipped   = 0;

  for (const [commandName, entry] of commands) {
    if (!entry.slug) {
      console.warn(`⚠  Skipping "${commandName}" — no slug defined`);
      skipped++;
      continue;
    }

    const pageDir = path.join(OUT_DIR, 'f', entry.slug);
    mkdir(pageDir);

    const html = buildPage(commandName, entry, headerTpl);
    fs.writeFileSync(path.join(pageDir, 'index.html'), html, 'utf8');

    slugs.push(entry.slug);
    generated++;
  }

  // Write sitemap
  const sitemap = buildSitemap(slugs);
  fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), sitemap, 'utf8');
  console.log('✔  Generated sitemap.xml');

  console.log(`\n✅  Done — ${generated} pages generated, ${skipped} skipped (missing slug)`);
  console.log(`    Output: ${OUT_DIR}`);
}

main().catch(err => { console.error(err); process.exit(1); });
