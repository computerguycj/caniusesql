/**
 * csp.spec.js — the site must not break its own Content Security Policy.
 *
 * vite preview sends the same CSP header as vercel.json (see
 * vite.config.mjs). The policy is report-only for now, so the browser
 * allows everything but still fires a `securitypolicyviolation` event for
 * each breach; this test collects those events and expects none.
 *
 * If this fails with a style-src or script-src violation after you changed a
 * component's <style> or an inline script, run `npm run csp:update` and
 * commit the new hashes in vercel.json.
 */
import { test, expect } from '@playwright/test';
import { PAGES, SCHEMES, openPage } from './helpers.js';

async function trackViolations(page) {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', e => {
      window.__cspViolations.push(`${e.effectiveDirective} blocked ${e.blockedURI || 'inline'} ${e.sample || ''}`.trim());
    });
  });
}

const violations = page => page.evaluate(() => window.__cspViolations);

test('the CSP header is sent', async ({ page }) => {
  const response = await page.goto('/');
  const csp = response.headers()['content-security-policy-report-only'];
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("style-src 'self' 'sha256-");
  expect(csp).not.toContain('unsafe-inline');
  expect(csp).not.toContain('unsafe-eval');
});

for (const { name, path } of PAGES) {
  for (const colorScheme of SCHEMES) {
    test(`${name} ${colorScheme}: no CSP violations while using the page`, async ({ page }) => {
      await trackViolations(page);
      await page.emulateMedia({ colorScheme });
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await openPage(page, path);
      // Exercise every element: search, filter, copy.
      await page.keyboard.press('/');
      await page.keyboard.type('sel');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Escape');
      await page.evaluate(() => document.querySelector('db-filter').shadowRoot.querySelector('input').click());
      if (await page.locator('copy-code').count()) {
        await page.evaluate(() => document.querySelector('copy-code').shadowRoot.querySelector('button').click());
      }
      await page.waitForTimeout(200);
      expect(await violations(page)).toEqual([]);
    });
  }
}

test('splash: no CSP violations', async ({ page }) => {
  await trackViolations(page);
  await page.route('**/cdn.buymeacoffee.com/**', route => route.abort());
  await page.goto('/');  // no splash cookie, so the splash shows
  await page.waitForSelector('#caniusesql-splash');
  await page.click('#caniusesql-splash');
  await page.waitForTimeout(600);
  expect(await violations(page)).toEqual([]);
});
