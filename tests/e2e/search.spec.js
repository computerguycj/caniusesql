/**
 * search.spec.js — the header search collapses to a button on narrow
 * headers and expands over the header's first row.
 */
import { test, expect } from '@playwright/test';
import { openPage } from './helpers.js';

// The element that really has focus, looking through shadow roots.
const focused = page => page.evaluate(() => {
  let el = document.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
  return el.className;
});

const mainTop = page => page.evaluate(() => Math.round(document.querySelector('main').getBoundingClientRect().top));

test.describe('narrow header (375px)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await openPage(page, '/f/merge/');
  });

  test('shows a search button and the full title', async ({ page }) => {
    await expect(page.locator('command-search .search-toggle')).toBeVisible();
    await expect(page.locator('command-search input')).toBeHidden();
    await expect(page.locator('command-search .search-toggle')).toHaveAttribute('aria-expanded', 'false');
    const cut = await page.evaluate(() => { const h = document.querySelector('.command-heading h1'); return h.scrollWidth > h.clientWidth + 1; });
    expect(cut).toBe(false);
  });

  test('the button opens the input over the header row without moving the page', async ({ page }) => {
    const before = await mainTop(page);
    await page.locator('command-search .search-toggle').click();
    await expect(page.locator('command-search input')).toBeVisible();
    await expect(page.locator('command-search .search-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(await focused(page)).toBe('site-search');
    expect(await mainTop(page)).toBe(before);
    await page.keyboard.type('sel');
    await expect(page).toHaveScreenshot('search-open-375.png', { clip: { x: 0, y: 0, width: 375, height: 420 } });
  });

  test('Escape collapses and returns focus to the button', async ({ page }) => {
    await page.locator('command-search .search-toggle').focus();
    await page.keyboard.press('Enter');
    expect(await focused(page)).toBe('site-search');
    await page.keyboard.type('sel');
    await page.keyboard.press('Escape');
    await expect(page.locator('command-search input')).toBeHidden();
    expect(await focused(page)).toBe('search-toggle');
  });

  test('"/" opens it; clicking outside or tabbing away collapses and keeps the text', async ({ page }) => {
    await page.keyboard.press('/');
    expect(await focused(page)).toBe('site-search');
    await page.keyboard.type('join');
    await page.locator('main h2').first().click();  // below the results list, so it's really outside
    await expect(page.locator('command-search input')).toBeHidden();

    await page.keyboard.press('/');
    await expect(page.locator('command-search input')).toHaveValue('join');
    await page.keyboard.press('Tab');
    await expect(page.locator('command-search input')).toBeHidden();
    expect(await focused(page)).toBe('select');  // focus went on to the theme picker
  });
});

test('wide header (1280px): no button, the input is always there', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await openPage(page, '/f/merge/');
  await expect(page.locator('command-search .search-toggle')).toBeHidden();
  await expect(page.locator('command-search input')).toBeVisible();
  await page.keyboard.press('/');
  expect(await focused(page)).toBe('site-search');
});
