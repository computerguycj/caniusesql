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
import { PAGES, SCHEMES, WIDTHS, openPage } from './helpers.js';

// Enough to reach past the table and syntax blocks on /f/merge/ and well
// into the cards on the homepage.
const MAX_TABS = 60;

// Runs in the page: describes the element that really has focus, looking
// through shadow roots.
function describeFocus() {
  let el = document.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
  if (!el || el === document.body) return null;

  const hex = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parse = c => {
    if (c.startsWith('#')) return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    return c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
  };
  const lum = rgb => {
    const [r, g, b] = rgb.map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(parse(a)), lum(parse(b))];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  // Obscured means something else is drawn on top of it (the sticky header,
  // most likely) or it's off screen. The skip link sits over the header on
  // purpose, so "above the header's bottom edge" alone isn't a failure.
  const host = el.getRootNode().host;
  const x = Math.min(Math.max(rect.left + rect.width / 2, 0), innerWidth - 1);
  const y = rect.top + Math.min(rect.height / 2, 10);
  const top = y >= 0 && y < innerHeight ? document.elementFromPoint(x, y) : null;
  const onTop = top !== null && (top === el || top === host || el.contains(top) || (host && host.contains(top)));
  const outlineColor = style.outlineColor;
  return {
    label: `${el.tagName.toLowerCase()}${el.className ? '.' + el.className : ''} ${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}`,
    outlineStyle: style.outlineStyle,
    outlineWidth: parseFloat(style.outlineWidth),
    contrast: style.outlineStyle === 'auto' ? null : Math.min(ratio(outlineColor, hex('--color-bg')), ratio(outlineColor, hex('--color-surface'))),
    obscured: !onTop || rect.bottom > innerHeight + 0.5,
  };
}

for (const { name, path } of PAGES) {
  for (const colorScheme of SCHEMES) {
    for (const width of WIDTHS) {
      test(`${name} ${colorScheme} ${width}px: focus visible, 3:1, never under the header`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await page.setViewportSize({ width, height: 700 });
        await openPage(page, path);
        const problems = new Set();
        const check = f => {
          if (f.outlineStyle === 'none' || (f.outlineStyle !== 'auto' && f.outlineWidth < 2)) problems.add(`no visible focus: ${f.label}`);
          if (f.contrast !== null && f.contrast < 3) problems.add(`focus ${f.contrast.toFixed(2)}:1: ${f.label}`);
          if (f.obscured) problems.add(`covered or off screen: ${f.label}`);
        };
        // Forward, then back again: going backwards scrolls each element in
        // from the top, which is where the sticky header can cover it.
        let stops = 0;
        for (; stops < MAX_TABS; stops++) {
          await page.keyboard.press('Tab');
          const f = await page.evaluate(describeFocus);
          if (!f) break;
          check(f);
        }
        for (let i = 1; i < stops; i++) {
          await page.keyboard.press('Shift+Tab');
          const f = await page.evaluate(describeFocus);
          if (!f) break;
          check(f);
        }
        expect([...problems]).toEqual([]);
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
    const small = await page.evaluate(() => {
      const out = [];
      const walk = root => {
        for (const el of root.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (el.tagName === 'A' && getComputedStyle(el).display === 'inline') continue;  // link in text
          if (r.width < 24 || r.height < 24) out.push(`${el.tagName.toLowerCase()}.${el.className} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
        for (const host of root.querySelectorAll('*')) if (host.shadowRoot) walk(host.shadowRoot);
      };
      walk(document);
      return out;
    });
    expect(small).toEqual([]);
  });
}
