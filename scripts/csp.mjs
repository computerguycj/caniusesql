/**
 * csp.mjs — builds the Content Security Policy and writes it into vercel.json.
 *
 * The policy lives here, in POLICY. The one part that can't be written by
 * hand is the list of inline-style hashes: each Vue custom element injects
 * its component CSS as a <style> in its shadow root, and a strict CSP only
 * allows an inline <style> whose SHA-256 hash is listed. This script serves
 * the built site, opens pages in Chromium, hashes every inline <style> and
 * inline <script> it finds (shadow roots included), and writes the header.
 *
 * Usage: npm run csp:update   (builds first; commit the vercel.json change)
 *
 * Any change to a component's <style> block changes its hash. The CSP test
 * (tests/e2e/csp.spec.js) fails until this is re-run.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

// Pages that, between them, render every custom element.
const PAGES = ['/', '/f/merge/'];

const MODE = 'Content-Security-Policy-Report-Only';

const POLICY = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],             // + hashes of inline scripts (none yet)
  'style-src': ["'self'"],              // + hashes of inline styles (Vue components)
  'img-src': ["'self'", 'https://cdn.buymeacoffee.com'],  // Buy Me a Coffee button image
  'connect-src': ["'self'"],            // /data.json, /api/track, /api/popular
  'font-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'none'"],            // the site has no forms
  'frame-ancestors': ["'none'"],        // never framed
  'report-uri': ['/api/csp-report'],    // older browsers
  'report-to': ['csp'],                 // newer browsers, via Reporting-Endpoints
};

const sha256 = text => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

async function collectInline() {
  const server = await preview({ preview: { port: 4181, strictPort: true }, build: { outDir: 'dist' }, logLevel: 'silent' });
  const browser = await chromium.launch();
  const styles = new Set();
  const scripts = new Set();
  try {
    const page = await browser.newPage();
    for (const path of PAGES) {
      await page.goto(`http://localhost:4181${path}`);
      await page.waitForLoadState('networkidle');
      const found = await page.evaluate(() => {
        const out = { styles: [], scripts: [] };
        const walk = root => {
          for (const s of root.querySelectorAll('style')) out.styles.push(s.textContent);
          for (const s of root.querySelectorAll('script:not([src])')) out.scripts.push(s.textContent);
          for (const el of root.querySelectorAll('*')) if (el.shadowRoot) walk(el.shadowRoot);
        };
        walk(document);
        return out;
      });
      found.styles.forEach(t => styles.add(sha256(t)));
      found.scripts.forEach(t => scripts.add(sha256(t)));
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.httpServer.close(resolve));
  }
  return { styles: [...styles].sort(), scripts: [...scripts].sort() };
}

function header({ styles, scripts }) {
  const directives = { ...POLICY };
  directives['script-src'] = [...POLICY['script-src'], ...scripts];
  directives['style-src'] = [...POLICY['style-src'], ...styles];
  return Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`).join('; ');
}

const inline = await collectInline();
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
vercel.headers = vercel.headers.filter(rule => rule.source !== '/(.*)');
vercel.headers.push({
  source: '/(.*)',
  headers: [
    { key: MODE, value: header(inline) },
    { key: 'Reporting-Endpoints', value: 'csp="/api/csp-report"' },
  ],
});
writeFileSync('vercel.json', JSON.stringify(vercel, null, 2) + '\n');
console.log(`vercel.json: ${MODE} with ${inline.styles.length} style hash(es), ${inline.scripts.length} script hash(es)`);
