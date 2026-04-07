#!/usr/bin/env node
/**
 * generate.js — static page generator for caniusesql.com
 *
 * Reads data.json and writes one HTML file per command to dist/f/{slug}/index.html.
 * Also copies index.html, data.json, and regenerates sitemap.xml into dist/.
 *
 * Usage:  node generate.js
 * Vercel: set buildCommand to "node generate.js", outputDirectory to "dist"
 */

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL    = 'https://www.caniusesql.com';
const DATA_FILE   = path.join(__dirname, 'data.json');
const INDEX_FILE  = path.join(__dirname, 'index.html');
const OUT_DIR     = path.join(__dirname, 'dist');

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

// ---------------------------------------------------------------------------
// Page template
// ---------------------------------------------------------------------------

function buildPage(commandName, entry) {
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
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
  <link rel="canonical" href="${esc(canonical)}">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
                   Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f7fa;
    }
    a { color: #3498db; }
    .site-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    .home-link {
      text-decoration: none;
      color: #3498db;
      font-size: 15px;
      white-space: nowrap;
    }
    .home-link:hover { text-decoration: underline; }
    h1 {
      color: #2c3e50;
      margin: 0;
      font-size: 1.8rem;
    }
    h2 { color: #2c3e50; margin-top: 32px; }
    h4 { color: #2c3e50; margin: 16px 0 4px; }
    .category-badge {
      display: inline-block;
      padding: 3px 10px;
      background: #eaf3fb;
      color: #2980b9;
      border: 1px solid #aed6f1;
      border-radius: 12px;
      font-size: 13px;
      margin-left: 8px;
      vertical-align: middle;
    }
    .command-desc {
      font-size: 1.05rem;
      color: #555;
      margin-bottom: 8px;
    }
    .command-overview {
      font-size: 0.95rem;
      color: #666;
      margin-bottom: 24px;
      line-height: 1.6;
      border-left: 3px solid #b0c4de;
      padding-left: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background-color: white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    th, td {
      text-align: left;
      padding: 12px 15px;
      border-bottom: 1px solid #ddd;
    }
    th { background-color: #3498db; color: white; }
    tr:last-child td { border-bottom: none; }
    tr:hover { background-color: #f5f5f5; }
    .supported     { color: #27ae60; font-weight: bold; }
    .not-supported { color: #e74c3c; }
    .notes         { font-size: 14px; color: #7f8c8d; }
    .syntax {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 4px;
      border-left: 4px solid #3498db;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 14px;
      white-space: pre-wrap;
      margin: 8px 0 16px;
      overflow-x: auto;
    }
    .version-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 14px;
      margin: 0 4px 6px 0;
    }
    .version-supported {
      background-color: #e6f7ee;
      color: #27ae60;
      border: 1px solid #27ae60;
    }
    .version-not-supported {
      background-color: #fde8e8;
      color: #e74c3c;
      border: 1px solid #e74c3c;
    }
    .search-cta {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      padding: 20px 24px;
      margin-top: 40px;
      text-align: center;
      font-size: 1rem;
    }
    .search-cta a {
      font-weight: 600;
      text-decoration: none;
    }
    .search-cta a:hover { text-decoration: underline; }
    .per-db-section {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      padding: 20px 24px;
      margin-top: 8px;
    }
    .detail-block {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      padding: 20px 24px;
      margin-top: 8px;
    }
  </style>
</head>
<body>

  <header class="site-header">
    <a href="/" class="home-link">← Can I Use SQL?</a>
    <h1>${esc(displayName)}${categoryBadge}</h1>
  </header>

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
  </div>

  <div class="search-cta">
    <p style="margin:0">Looking for another SQL command?
      <a href="/">Search all ${Object.keys(compatibility).length > 0 ? '' : ''}SQL commands →</a>
    </p>
  </div>

</body>
</html>`;
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
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const commands = Object.entries(data);

  mkdir(OUT_DIR);

  // Copy homepage SPA
  fs.copyFileSync(INDEX_FILE, path.join(OUT_DIR, 'index.html'));
  console.log('✔  Copied index.html');

  // Copy data.json so the SPA can still fetch it
  fs.copyFileSync(DATA_FILE, path.join(OUT_DIR, 'data.json'));
  console.log('✔  Copied data.json');

  // Copy any other static assets that exist alongside index.html
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

    const html = buildPage(commandName, entry);
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
