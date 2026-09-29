/**
 * theme.spec.js — the theme picker and the no-flash head script.
 */
import { test, expect } from '@playwright/test';
import { openPage } from './helpers.js';

const bodyBg = page => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const LIGHT_BG = 'rgb(245, 247, 250)';
const DARK_BG = 'rgb(13, 17, 23)';

test('System follows the OS', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openPage(page, '/');
  expect(await page.locator('theme-picker select').inputValue()).toBe('system');
  expect(await bodyBg(page)).toBe(DARK_BG);
  await page.emulateMedia({ colorScheme: 'light' });
  expect(await bodyBg(page)).toBe(LIGHT_BG);
});

test('a choice applies at once, survives a reload, and carries to other pages', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openPage(page, '/');
  await page.locator('theme-picker select').selectOption('dark');
  expect(await bodyBg(page)).toBe(DARK_BG);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('dark');

  await page.reload();
  expect(await bodyBg(page)).toBe(DARK_BG);
  await openPage(page, '/f/merge/');
  expect(await page.locator('theme-picker select').inputValue()).toBe('dark');
  expect(await bodyBg(page)).toBe(DARK_BG);

  await page.locator('theme-picker select').selectOption('system');
  expect(await bodyBg(page)).toBe(LIGHT_BG);
  expect(await page.evaluate(() => localStorage.getItem('caniusesql_theme'))).toBeNull();
});

// Records every frame Chromium paints while the page loads and checks the
// page background in each one. A saved theme that only applied after the
// stylesheets (or after the Vue bundle) would show up as frames in the
// OS theme first.
for (const [os, saved, expected] of [['light', 'dark', [13, 17, 23]], ['dark', 'light', [245, 247, 250]]]) {
  test(`no flash: saved ${saved} on a ${os} OS paints ${saved} from the first frame`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: os });
    await openPage(page, '/');
    await page.locator('theme-picker select').selectOption(saved);

    // Let the old page repaint in the saved theme, and ignore frames from
    // before the navigation: the screencast can hand over a stale frame of
    // the old page first.
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
    expect(frames.length).toBeGreaterThan(0);

    // Read the pixel at (4, 4), which is page background (body padding), in
    // every frame.
    const pixels = await page.evaluate(async list => {
      const out = [];
      for (const data of list) {
        const img = new Image();
        img.src = `data:image/png;base64,${data}`;
        await img.decode();
        const canvas = new OffscreenCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        out.push([...ctx.getImageData(4, 4, 1, 1).data.slice(0, 3)]);
      }
      return out;
    }, frames);
    // Blank frames before anything paints are pure white (#fff); ignore those.
    const painted = pixels.filter(p => p.join() !== '255,255,255');
    expect(painted.length).toBeGreaterThan(0);
    for (const p of painted) expect(p).toEqual(expected);
  });
}
