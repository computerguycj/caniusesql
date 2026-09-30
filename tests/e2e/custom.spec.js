/**
 * custom.spec.js — Custom mode end to end: three extreme themes (darkest,
 * palest, most saturated accent that still pass), the dialog itself, a
 * tampered localStorage, and no flash for a saved Custom theme.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openPage, focusProblems, smallControls, framePixels } from './helpers.js';

const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const EXTREMES = [
  { name: 'darkest', base: 'light', accent: '#000000' },
  { name: 'palest', base: 'dark', accent: '#ffffff' },
  { name: 'saturated', base: 'dark', accent: '#ff00ff' },
];

// Sets a Custom theme the way a visitor does: through the dialog.
async function applyCustom(page, base, accent) {
  await page.locator('theme-picker select').selectOption('custom');
  await page.locator(`theme-picker dialog input[type=radio][value=${base}]`).check();
  await page.locator('theme-picker dialog input[type=color]').fill(accent);
  await expect(page.locator('theme-picker dialog button', { hasText: 'Apply' })).toBeEnabled();
  await page.locator('theme-picker dialog button', { hasText: 'Apply' }).click();
  await expect(page.locator('theme-picker dialog')).toBeHidden();
}

const axeViolations = async page =>
  (await new AxeBuilder({ page }).withTags(WCAG_AA).analyze()).violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`);

for (const { name, base, accent } of EXTREMES) {
  test.describe(`${name} Custom theme (${accent} on ${base})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await openPage(page, '/f/merge/');
      await applyCustom(page, base, accent);
      await page.reload();
      await openPage(page, '/f/merge/');
    });

    test('screenshot', async ({ page }) => {
      await expect(page).toHaveScreenshot(`custom-${name}.png`, { fullPage: true });
    });

    test('axe WCAG 2.2 AA, focus, and target size pass', async ({ page }) => {
      await page.keyboard.press('/');
      await page.keyboard.type('sel');
      await page.keyboard.press('ArrowDown');
      expect(await axeViolations(page)).toEqual([]);
      await page.keyboard.press('Escape');
      expect(await focusProblems(page, 40)).toEqual([]);
      expect(await smallControls(page)).toEqual([]);
    });
  });
}

test.describe('the dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openPage(page, '/f/merge/');
    await page.locator('theme-picker select').focus();  // as a visitor's would be
    await page.locator('theme-picker select').selectOption('custom');
    await expect(page.locator('theme-picker dialog')).toBeVisible();
  });

  test('passes axe, and every control is focusable, visible and 24px', async ({ page }) => {
    expect(await axeViolations(page)).toEqual([]);
    expect(await smallControls(page)).toEqual([]);
    // Tab never reaches the page behind the modal dialog. Past the last
    // control, focus may go to the browser's own UI (document.body here),
    // which the spec allows.
    const outside = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const where = await page.evaluate(() => {
        let el = document.activeElement;
        while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
        if (el === document.body || el.closest('dialog')) return null;
        return `${el.tagName.toLowerCase()}.${el.className}`;
      });
      if (where) outside.push(where);
    }
    expect(outside).toEqual([]);
  });

  test('a failing pick blocks Apply, lists the pairs, and the suggestion fixes it', async ({ page }) => {
    await page.locator('theme-picker dialog input[type=color]').fill('#3498db');
    await expect(page.locator('theme-picker dialog button', { hasText: 'Apply' })).toBeDisabled();
    await expect(page.locator('theme-picker dialog .failures li').first()).toContainText('accent text on background: 2.94:1');
    await page.locator('theme-picker dialog button', { hasText: 'Use #' }).click();
    await expect(page.locator('theme-picker dialog button', { hasText: 'Apply' })).toBeEnabled();
  });

  test('Escape closes without changes and returns focus to the select', async ({ page }) => {
    await page.locator('theme-picker dialog input[type=color]').fill('#c400c4');
    await page.keyboard.press('Escape');
    await expect(page.locator('theme-picker dialog')).toBeHidden();
    await expect(page.locator('theme-picker select')).toHaveValue('system');
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--color-primary'))).toBe('');
    expect(await page.evaluate(() => document.querySelector('theme-picker').shadowRoot.activeElement?.tagName)).toBe('SELECT');
  });
});

test.describe('tampered localStorage', () => {
  const store = (theme, custom) => ({ theme, custom: JSON.stringify(custom) });
  const cases = [
    ['a CSS injection in a token value', store('custom', { base: 'light', accent: '#c400c4', tokens: { '--color-primary': '#c400c4; background: url(https://evil.example/x)' } })],
    ['a non --color-* property name', store('custom', { base: 'light', accent: '#c400c4', tokens: { 'background-image': '#c400c4' } })],
    ['a base that isn\'t light or dark', store('custom', { base: 'x', accent: '#c400c4', tokens: { '--color-primary': '#c400c4' } })],
  ];

  for (const [label, saved] of cases) {
    test(`the head script ignores ${label}`, async ({ page }) => {
      await page.addInitScript(s => { localStorage.setItem('caniusesql_theme', s.theme); localStorage.setItem('caniusesql_custom', s.custom); }, saved);
      await page.route('**/assets/elements.js', route => route.abort());  // head script only, no Vue
      await page.goto('/f/merge/');
      const state = await page.evaluate(() => ({ style: document.documentElement.getAttribute('style'), custom: 'custom' in document.documentElement.dataset }));
      expect(state).toEqual({ style: null, custom: false });
    });
  }

  test('the picker recomputes tokens from base + accent, ignoring stored ones', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('caniusesql_theme', 'custom');
      localStorage.setItem('caniusesql_custom', JSON.stringify({ base: 'light', accent: '#c400c4', tokens: { '--color-primary': '#123456' } }));
    });
    await openPage(page, '/f/merge/');
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--color-primary'))).toBe('#c400c4');
  });

  test('a saved accent that fails contrast falls back to System', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('caniusesql_theme', 'custom');
      localStorage.setItem('caniusesql_custom', JSON.stringify({ base: 'light', accent: '#3498db', tokens: { '--color-primary': '#3498db' } }));
    });
    await openPage(page, '/f/merge/');
    await expect(page.locator('theme-picker select')).toHaveValue('system');
    expect(await page.evaluate(() => [document.documentElement.getAttribute('style') || '', 'custom' in document.documentElement.dataset])).toEqual(['', false]);
  });
});

test('no flash: a saved Custom theme on Dark paints dark from the first frame', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openPage(page, '/');
  await applyCustom(page, 'dark', '#ff00ff');
  await page.waitForTimeout(300);
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  let navigating = false;
  cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
    if (navigating) frames.push(data);
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
  await page.waitForTimeout(300);
  navigating = true;
  await page.goto('/f/merge/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
  await cdp.send('Page.stopScreencast');
  const pixels = await framePixels(page.context(), frames);
  const painted = pixels.filter(p => p.join() !== '255,255,255');
  expect(painted.length).toBeGreaterThan(0);
  for (const p of painted) expect(p).toEqual([13, 17, 23]);
});
