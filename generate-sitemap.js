const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://caniusesql.com';
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));

const urls = [
  // Homepage
  `  <url>\n    <loc>${BASE_URL}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
  // One URL per command
  ...Object.keys(data).map(key => {
    const encoded = encodeURIComponent(key);
    return `  <url>\n    <loc>${BASE_URL}/?q=${encoded}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
  })
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemap);
console.log(`sitemap.xml written with ${Object.keys(data).length + 1} URLs`);
