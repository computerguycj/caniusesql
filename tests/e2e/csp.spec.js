/**
 * csp.spec.js — the site must not break its own Content Security Policy, and
 * the policy must actually block what it doesn't allow.
 *
 * vite preview sends the same CSP header as vercel.json (see
 * vite.config.mjs). The policy is enforced: the browser blocks anything it
 * doesn't allow and fires a `securitypolicyviolation` event for each breach;
 * the page tests collect those events and expect none.
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
  expect(response.headers()['content-security-policy-report-only']).toBeUndefined();
  const csp = response.headers()['content-security-policy'];
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
  await page.waitForSelector('intro-splash dialog[open]');
  await page.click('intro-splash dialog');
  await page.waitForTimeout(600);
  expect(await violations(page)).toEqual([]);
});

test('the policy blocks an injected inline script, style, and third-party script', async ({ page }) => {
  await trackViolations(page);
  await openPage(page, '/f/merge/');
  const result = await page.evaluate(async () => {
    // What an attacker would try if they found an injection point.
    const script = document.createElement('script');
    script.textContent = 'window.__injected = true;';
    document.body.append(script);

    const style = document.createElement('style');
    style.textContent = 'body { outline: 9px solid; }';
    document.head.append(style);

    const remote = document.createElement('script');
    remote.src = 'https://evil.example/x.js';
    document.body.append(remote);

    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      scriptRan: window.__injected === true,
      styleApplied: getComputedStyle(document.body).outlineWidth === '9px',
    };
  });
  expect(result).toEqual({ scriptRan: false, styleApplied: false });
  const blocked = await violations(page);
  expect(blocked.some(v => v.startsWith('script-src-elem blocked inline'))).toBe(true);
  expect(blocked.some(v => v.startsWith('style-src-elem blocked inline'))).toBe(true);
  expect(blocked.some(v => v.includes('evil.example'))).toBe(true);
});
