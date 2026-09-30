/**
 * helpers.js — shared setup for the browser tests.
 */

// Pages the tests cover: the homepage and one command page with every
// kind of block (table, syntax blocks, version badges).
export const PAGES = [
  { name: 'home', path: '/' },
  { name: 'merge', path: '/f/merge/' },
];

export const SCHEMES = ['light', 'dark'];

export const WIDTHS = [1280, 375];

/**
 * Opens a page ready for comparison: no intro splash (it covers the page
 * on a first visit), no third-party image, and the custom elements
 * rendered.
 */
export async function openPage(page, path) {
  await page.context().addCookies([
    { name: 'caniusesql_splash', value: '1', domain: 'localhost', path: '/' },
  ]);
  await page.route('**/cdn.buymeacoffee.com/**', route => route.abort());
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => customElements.get('command-search') !== undefined);
}

// Runs in the page: describes the element that really has focus, looking
// through shadow roots.
export function describeFocus() {
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

/**
 * Tabs forward through up to maxTabs stops, then back again (going
 * backwards scrolls each element in from the top, where the sticky header
 * can cover it), and returns every focus problem found.
 */
export async function focusProblems(page, maxTabs) {
  const problems = new Set();
  const check = f => {
    if (f.outlineStyle === 'none' || (f.outlineStyle !== 'auto' && f.outlineWidth < 2)) problems.add(`no visible focus: ${f.label}`);
    if (f.contrast !== null && f.contrast < 3) problems.add(`focus ${f.contrast.toFixed(2)}:1: ${f.label}`);
    if (f.obscured) problems.add(`covered or off screen: ${f.label}`);
  };
  let stops = 0;
  for (; stops < maxTabs; stops++) {
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
  return [...problems];
}

/**
 * Every visible control smaller than 24x24px (WCAG 2.2 target size), looking
 * through shadow roots. Links inside text are exempt, as WCAG allows.
 */
export function smallControls(page) {
  return page.evaluate(() => {
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
}
