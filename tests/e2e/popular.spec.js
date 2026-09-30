/**
 * popular.spec.js — <popular-commands> on the homepage: the build-time list
 * until a live one is ready, the live one from /api/popular and the command
 * index, and the build-time list again whenever something fails.
 *
 * `vite preview` has neither API, so page.route stands in for both.
 */
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { SCHEMES, openPage } from './helpers.js';

const POPULAR = '**/api/popular';
const INDEX_URL = '**/api/v2/command-index';

// Playwright runs from the repo root (where its config is).
const DATA = JSON.parse(readFileSync('data.json', 'utf8'));
const INDEX = Object.fromEntries(Object.entries(DATA)
  .map(([name, entry]) => [name, { slug: entry.slug, description: entry.description }]));

// The build-time links: light-DOM children, shown through the slot.
const buildTime = page => page.locator('popular-commands > a');
// The live links, read straight from the element's shadow root. (The
// build-time links have class="example" too, and Playwright's CSS reaches
// into shadow roots, so a selector can't tell the two lists apart.)
const liveLinks = page => page.evaluate(() =>
  [...document.querySelector('popular-commands').shadowRoot.querySelectorAll('a')]
    .map(a => ({ text: a.textContent, href: a.getAttribute('href') })));
const liveTexts = async page => (await liveLinks(page)).map(link => link.text);

async function serveIndex(page) {
  await page.route(INDEX_URL, route => route.fulfill({ json: INDEX }));
}

function countRequests(page, pathname) {
  const counter = { count: 0 };
  page.on('request', request => {
    if (new URL(request.url()).pathname === pathname) counter.count += 1;
  });
  return counter;
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
});

test('the live list replaces the build-time one, in order', async ({ page }) => {
  await serveIndex(page);
  await page.route(POPULAR, route => route.fulfill({ json: ['join', 'with-cte', 'merge'] }));
  await openPage(page, '/');

  await expect.poll(() => liveTexts(page)).toEqual(['JOIN', 'WITH (COMMON TABLE EXPRESSIONS)', 'MERGE']);
  expect((await liveLinks(page))[0].href).toBe('/f/join/');
  await expect(buildTime(page).first()).toBeHidden();
});

test('unknown slugs are dropped', async ({ page }) => {
  await serveIndex(page);
  await page.route(POPULAR, route => route.fulfill({ json: ['no-such-command', 'join', '<b>x</b>'] }));
  await openPage(page, '/');

  await expect.poll(() => liveTexts(page)).toEqual(['JOIN']);
});

for (const [why, respond] of [
  ['fails', route => route.fulfill({ status: 500, json: [] })],
  ['returns an empty list', route => route.fulfill({ json: [] })],
  ['returns something other than a list', route => route.fulfill({ json: { result: ['join'] } })],
]) {
  test(`the build-time list stays when /api/popular ${why}`, async ({ page }) => {
    await serveIndex(page);
    await page.route(POPULAR, respond);
    await openPage(page, '/');

    await expect(buildTime(page).first()).toBeVisible();
    await expect(buildTime(page).last()).toBeVisible();
    // openPage waited for the network to go idle, so both loads are done.
    expect(await liveTexts(page)).toEqual([]);
  });
}

test('search and popular list share one index request', async ({ page }) => {
  await serveIndex(page);
  await page.route(POPULAR, route => route.fulfill({ json: ['join'] }));
  const index = countRequests(page, '/api/v2/command-index');
  const dataJson = countRequests(page, '/data.json');
  await openPage(page, '/');

  await expect.poll(() => liveTexts(page)).toEqual(['JOIN']);
  expect(index.count).toBe(1);
  expect(dataJson.count).toBe(0);
});

test('when the index API fails, both fall back to one data.json request', async ({ page }) => {
  await page.route(INDEX_URL, route => route.fulfill({ status: 500, json: {} }));
  await page.route(POPULAR, route => route.fulfill({ json: ['join'] }));
  const dataJson = countRequests(page, '/data.json');
  await openPage(page, '/');

  await expect.poll(() => liveTexts(page)).toEqual(['JOIN']);
  expect(dataJson.count).toBe(1);
});

for (const colorScheme of SCHEMES) {
  test(`live list, ${colorScheme}: no WCAG AA violations`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await serveIndex(page);
    await page.route(POPULAR, route => route.fulfill({ json: ['join', 'merge', 'pivot'] }));
    await openPage(page, '/');
    await expect.poll(async () => (await liveTexts(page)).length).toBe(3);

    const results = await new AxeBuilder({ page })
      .include('popular-commands')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map(v => v.id)).toEqual([]);
  });
}
