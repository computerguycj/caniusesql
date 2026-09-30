/**
 * focus.spec.js — keyboard focus checks axe doesn't make (WCAG 2.2 AA).
 *
 * Tabs through each page and, for every stop, checks that:
 *   - the focus indicator is visible: an outline at least 2px wide, or the
 *     browser's own ring (outline-style: auto);
 *   - an author-set outline has at least 3:1 contrast against the page
 *     background and the surface color;
 *   - the focused element isn't covered (by the sticky header, say) or off
 *     screen.
 * Also checks every control is at least 24x24px, except links inside text
 * (WCAG 2.5.8 exempts those).
 */
import { test, expect } from '@playwright/test';
import { PAGES, SCHEMES, WIDTHS, openPage, focusProblems, smallControls } from './helpers.js';

// Enough to reach past the table and syntax blocks on /f/merge/ and well
// into the cards on the homepage.
const MAX_TABS = 60;

for (const { name, path } of PAGES) {
  for (const colorScheme of SCHEMES) {
    for (const width of WIDTHS) {
      test(`${name} ${colorScheme} ${width}px: focus visible, 3:1, never under the header`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await page.setViewportSize({ width, height: 700 });
        await openPage(page, path);
        const problems = await focusProblems(page, MAX_TABS);
        expect(problems).toEqual([]);
      });
    }
  }
}

for (const { name, path } of PAGES) {
  test(`${name}: every control is at least 24x24px`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await openPage(page, path);
    await page.keyboard.press('/');
    await page.keyboard.type('sel');  // open the search results too
    const small = await smallControls(page);
    expect(small).toEqual([]);
  });
}
