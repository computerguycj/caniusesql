/**
 * splash.spec.js — <intro-splash>: a native modal <dialog> on a first visit.
 *
 * These tests open pages without the splash cookie (openPage sets it, so
 * it isn't used here). page.clock replaces the page's timers, so the 3 s
 * auto-close and the 0.4 s fade only happen when a test moves the clock.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { smallControls } from './helpers.js';

const dialog = page => page.locator('intro-splash dialog');

// The element that really has focus, looking through shadow roots.
const focused = page => page.evaluate(() => {
  let el = document.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
  return el === document.body ? 'body' : `${el.tagName.toLowerCase()}.${el.className}`;
});

async function firstVisit(page, path = '/f/merge/') {
  await page.clock.install();
  await page.route('**/cdn.buymeacoffee.com/**', route => route.abort());
  await page.goto(path);
  await expect(dialog(page)).toHaveAttribute('open', '');
}

// Past the 0.4 s fade.
const finishFade = page => page.clock.runFor(500);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
});

test('shows on a first visit, with focus on the Close button', async ({ page }) => {
  await firstVisit(page);

  await expect(dialog(page)).toBeVisible();
  expect(await focused(page)).toBe('button.close');
  await expect(dialog(page)).toContainText('148 commands across 5 databases');
});

test('passes axe, its targets are 24px, and Tab never reaches the page behind', async ({ page }) => {
  await firstVisit(page);

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map(v => v.id)).toEqual([]);
  expect(await smallControls(page)).toEqual([]);

  // Past the last control, focus may go to the browser's own UI
  // (document.body here), which the spec allows; never to the page.
  const outside = [];
  for (let i = 0; i < 6; i++) {
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

for (const [how, act] of [
  ['Escape', page => page.keyboard.press('Escape')],
  ['the Close button', page => page.locator('intro-splash button.close').click()],
  ['a click on the backdrop', page => page.mouse.click(5, 5)],
  ['a click on the card', page => page.locator('intro-splash .query').click()],
]) {
  test(`${how} closes it, with a fade, and focus goes back to the page`, async ({ page }) => {
    await firstVisit(page);

    await act(page);
    await expect(dialog(page)).toHaveClass(/fade-out/);
    await expect(dialog(page)).toHaveAttribute('open', '');  // still fading
    await finishFade(page);

    await expect(dialog(page)).not.toHaveAttribute('open', '');
    expect(await focused(page)).toBe('body');
  });
}

test('closes on its own after 3 seconds', async ({ page }) => {
  await firstVisit(page);

  await page.clock.runFor(2900);
  await expect(dialog(page)).toHaveAttribute('open', '');
  await page.clock.runFor(200);
  await finishFade(page);
  await expect(dialog(page)).not.toHaveAttribute('open', '');
});

test('is not shown again on the next page view', async ({ page }) => {
  await firstVisit(page);
  await page.keyboard.press('Escape');
  await finishFade(page);

  await page.goto('/f/join/');
  await page.waitForFunction(() => customElements.get('intro-splash') !== undefined);
  await expect(dialog(page)).not.toHaveAttribute('open', '');
});

test('reduced motion: no blinking cursor, and it closes without fading', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await firstVisit(page);

  const animation = await page.locator('intro-splash .cursor')
    .evaluate(el => getComputedStyle(el).animationName);
  expect(animation).toBe('none');

  await page.keyboard.press('Escape');
  await expect(dialog(page)).not.toHaveAttribute('open', '');  // no clock needed
});
