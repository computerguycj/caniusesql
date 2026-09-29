/**
 * a11y.spec.js — axe accessibility scans (WCAG 2.1 A and AA rules).
 *
 * What axe can't catch, so it still needs a manual keyboard pass: focus
 * order that makes sense, focus never getting trapped or lost (e.g. the
 * search list closing), visible focus on every control in every theme, and
 * whether screen reader announcements are actually useful.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PAGES, SCHEMES, openPage } from './helpers.js';

const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function scan(page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  return results.violations;
}

function summary(violations) {
  return violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`);
}

// Opens the header search with results showing and the first one
// highlighted, so its colors get scanned too.
async function openSearch(page) {
  await page.keyboard.press('/');
  await page.keyboard.type('sel');
  await page.keyboard.press('ArrowDown');
}

for (const { name, path } of PAGES) {
  for (const colorScheme of SCHEMES) {
    test(`${name} ${colorScheme}: no violations except color contrast`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await openPage(page, path);
      await openSearch(page);
      const other = (await scan(page)).filter(v => v.id !== 'color-contrast');
      expect(summary(other)).toEqual([]);
    });

    // Known failure: the Light and Dark palettes fail AA contrast today.
    // Light: accent #3498db (white on it 3.15, as text 2.92-3.83), muted
    // #7f8c8d (3.22-3.47), status green #27ae60 (2.58-2.87) and amber
    // #d97706 (3.18). Dark: white on accent #58a6ff (2.52), status red
    // #c1272d (2.96) and gray #666666 (3.01), green on its badge (2.58).
    // test.fail() passes while the violations exist and fails once they're
    // gone, so the palette fix has to remove this marker.
    test(`${name} ${colorScheme}: no color contrast violations`, async ({ page }) => {
      test.fail(true, 'Palettes fail WCAG AA contrast until the palette fix');
      await page.emulateMedia({ colorScheme });
      await openPage(page, path);
      await openSearch(page);
      const contrast = (await scan(page)).filter(v => v.id === 'color-contrast');
      expect(summary(contrast)).toEqual([]);
    });
  }
}
