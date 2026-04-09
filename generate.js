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
// Template assembly
// ---------------------------------------------------------------------------

/**
 * applyTemplate — substitutes {{KEY}} placeholders in the header template.
 *
 * Only the pre-escaped values produced by generate.js are inserted here.
 * Raw user/data strings must be passed through esc() before reaching this
 * function so that no unescaped content ever lands in an HTML attribute or
 * text position.
 *
 * @param {string} headerTpl  - contents of templates/header.html
 * @param {string} footerTpl  - contents of templates/footer.html
 * @param {string} headHtml   - page-specific <head> content (already safe)
 * @param {string} bodyContent - main body content between header and footer
 * @param {Object} vars       - { COMMAND_HEADING: string } — pre-escaped values
 * @returns {string} complete HTML document
 */
function applyTemplate(headerTpl, footerTpl, headHtml, bodyContent, vars) {
  var header = headerTpl.replace(/\{\{(\w+)\}\}/g, function (match, key) {
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

${header}
${bodyContent}
${footerTpl}
  <script src="/search.js" defer></script>
  <script src="/splash.js" defer></script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Command page builder
// ---------------------------------------------------------------------------

function buildPage(commandName, entry, headerTpl, footerTpl) {
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
    const statusText  = supported ? '✓ Supported' : '✗ Not Supported';
    const since       = info.since || '—';
    tableRows += `
          <tr>
            <td>${esc(label)}</td>
            <td class="${statusClass}">${statusText}</td>
            <td>${esc(since)}</td>
            <td class="notes">${esc(info.notes || '')}</td>
          </tr>`;
  }

  // ── Version badges ──────────────────────────────────────────────────────
  let badges = '';
  for (const [db, info] of Object.entries(compatibility)) {
    const label      = DB_LABELS[db] || db;
    const badgeClass = info.supported ? 'version-supported' : 'version-not-supported';
    const text       = info.supported
      ? `${label}: Since ${info.since ?? '?'}`
      : `${label}: Not supported`;
    badges += `<span class="version-badge ${badgeClass}">${esc(text)}</span>\n    `;
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
        <h4>${esc(label)}</h4>
        ${note}
        <div class="syntax">${esc(info.syntax)}</div>`;
  }

  // ── Category badge ──────────────────────────────────────────────────────
  const categoryBadge = category
    ? `<span class="category-badge">${esc(category)}</span>`
    : '';

  // ── Command heading (goes into {{COMMAND_HEADING}} placeholder) ─────────
  // Both displayName and categoryBadge are already escaped above.
  const commandHeading = `<h1>${esc(displayName)}${categoryBadge}</h1>`;

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
  <table>
    <thead>
      <tr>
        <th>Database System</th>
        <th>Support Status</th>
        <th>Since Version</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>${tableRows}
    </tbody>
  </table>

  <h2>Details</h2>
  <div class="detail-block">
    <p style="margin:0">${esc(details)}</p>
  </div>

  <h2>Standard Syntax</h2>
  <div class="syntax">${esc(syntax)}</div>

  <h2>Version Support</h2>
  <div style="margin-top: 8px;">
    ${badges}
  </div>

  <h2>Per-Database Syntax &amp; Notes</h2>
  <div class="per-db-section">${syntaxBlocks}
  </div>`;

  return applyTemplate(headerTpl, footerTpl, headHtml, bodyContent, {
    COMMAND_HEADING: commandHeading,
  });
}

// ---------------------------------------------------------------------------
// Homepage builder
// ---------------------------------------------------------------------------

function buildHomepage(headerTpl, footerTpl) {
  const content  = fs.readFileSync(path.join(SRC_DIR, 'index.html'), 'utf8');
  const title    = 'Can I Use SQL? | SQL Compatibility Checker';
  const desc     = 'Check SQL command compatibility across MySQL, PostgreSQL, SQL Server, Oracle, and SQLite. Find out which databases support SELECT, MERGE, PIVOT, CTEs, window functions, and more.';
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

  return applyTemplate(headerTpl, footerTpl, headHtml, content, {
    COMMAND_HEADING: '',
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

function main() {
  // Load data
  const data     = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const commands = Object.entries(data);

  // Load shared templates
  const headerTpl = readTemplate('header.html');
  const footerTpl = readTemplate('footer.html');

  mkdir(OUT_DIR);

  // Assemble and write homepage
  const homepageHtml = buildHomepage(headerTpl, footerTpl);
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

    const html = buildPage(commandName, entry, headerTpl, footerTpl);
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

main();
