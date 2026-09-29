/**
 * a11y.spec.js — axe accessibility scans (WCAG 2.2 A and AA rules).
 *
 * What axe can't catch, so it still needs a manual keyboard pass: focus
 * order that makes sense, focus never getting trapped or lost (e.g. the
 * search list closing), visible focus on every control in every theme, and
 * whether screen reader announcements are actually useful.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PAGES, SCHEMES, openPage } from './helpers.js';

const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

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
    test(`${name} ${colorScheme}: no WCAG AA violations`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await openPage(page, path);
      await openSearch(page);
      expect(summary(await scan(page))).toEqual([]);
    });
  }
}
