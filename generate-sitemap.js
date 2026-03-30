const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://caniusesql.com';
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));

// Use current date as lastmod for all entries (YYYY-MM-DD format)
const lastMod = new Date().toISOString().split('T')[0];

// Filter valid entries with slug
const validEntries = Object.values(data).filter(entry => entry.slug && typeof entry.slug === 'string');
const invalidEntries = Object.values(data).filter(entry => !entry.slug || typeof entry.slug !== 'string');

const urls = [
  // Homepage
  `  <url>\n    <loc>${BASE_URL}/</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
  // One URL per command, keyed by slug
  ...validEntries.map(entry => {
    return `  <url>\n    <loc>${BASE_URL}/f/${encodeURIComponent(entry.slug)}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
  })
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemap);
console.log(`sitemap.xml written with ${validEntries.length + 1} URLs`);
if (invalidEntries.length > 0) {
  console.log(`Skipped ${invalidEntries.length} entries without valid slug:`, invalidEntries.map(entry => Object.keys(data).find(key => data[key] === entry)).filter(Boolean));
}
