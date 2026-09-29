/**
 * visual.spec.js — screenshot comparisons against committed baselines.
 *
 * Update baselines after an intended visual change:
 *   npm run test:e2e -- --update-snapshots
 *
 * The homepage is captured one screen tall (header, filter, popular
 * commands, first cards): its full length is 148 near-identical cards and
 * about 1.5 MB per PNG. Command pages are captured full length.
 */
import { test, expect } from '@playwright/test';
import { PAGES, SCHEMES, WIDTHS, openPage } from './helpers.js';

for (const { name, path } of PAGES) {
  for (const colorScheme of SCHEMES) {
    for (const width of WIDTHS) {
      test(`${name} ${colorScheme} ${width}px`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await page.setViewportSize({ width, height: 900 });
        await openPage(page, path);
        await expect(page).toHaveScreenshot(`${name}-${colorScheme}-${width}.png`, { fullPage: name !== 'home' });
      });
    }
  }
}
