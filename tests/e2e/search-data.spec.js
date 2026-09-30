/**
 * search-data.spec.js — where <command-search> gets its data: the API's
 * command index first, the static data.json if the API fails.
 *
 * `vite preview` has no API (it answers /api/v2/* with its HTML page, which
 * the element rejects and falls back from), so these tests stand in for the
 * API with page.route. The command page is used because the homepage also
 * fetches data.json for its popular list.
 */
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { openPage } from './helpers.js';

const API = '**/api/v2/command-index';
const PAGE = '/f/merge/';

// Playwright runs from the repo root (where its config is).
const DATA = JSON.parse(readFileSync('data.json', 'utf8'));
const INDEX = Object.fromEntries(Object.entries(DATA)
  .map(([name, entry]) => [name, { slug: entry.slug, description: entry.description }]));

// The index with one description changed, so a result shows which source it came from.
function indexWith(name, description) {
  return { ...INDEX, [name]: { ...INDEX[name], description } };
}

// Counts the element's data.json requests (the fallback).
function countDataJson(page) {
  const counter = { count: 0 };
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/data.json') counter.count += 1;
  });
  return counter;
}

async function search(page, text) {
  await page.locator('command-search input').fill(text);
  return page.locator('command-search .search-results a');
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
});

test('uses the API when it answers, and never loads data.json', async ({ page }) => {
  await page.route(API, route => route.fulfill({ json: indexWith('merge', 'From the API') }));
  const dataJson = countDataJson(page);
  await openPage(page, PAGE);

  const results = await search(page, 'merge');

  await expect(results.first()).toContainText('From the API');
  await expect(results.first()).toHaveAttribute('href', '/f/merge/');
  expect(dataJson.count).toBe(0);
});

test('falls back to data.json when the API fails', async ({ page }) => {
  await page.route(API, route => route.fulfill({ status: 500, json: { status: 500 } }));
  const dataJson = countDataJson(page);
  await openPage(page, PAGE);

  const results = await search(page, 'merge');

  await expect(results.first()).toContainText(DATA.merge.description.slice(0, 40));
  expect(dataJson.count).toBe(1);
});

test('falls back to data.json when the API hangs past the timeout', async ({ page }) => {
  // Never answered: the element's own 5 s timeout has to give up on it.
  await page.route(API, () => {});
  const dataJson = countDataJson(page);
  await openPage(page, PAGE);

  const results = await search(page, 'merge');

  await expect(results.first()).toContainText(DATA.merge.description.slice(0, 40), { timeout: 10_000 });
  expect(dataJson.count).toBe(1);
});

test('renders API text as text, never as HTML', async ({ page }) => {
  const payload = '<img src=x onerror="window.__injected = true">Injected';
  await page.route(API, route => route.fulfill({ json: indexWith('merge', payload) }));
  await openPage(page, PAGE);

  const results = await search(page, 'merge');

  await expect(results.first()).toContainText(payload);
  await expect(page.locator('command-search .search-results img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__injected)).toBeUndefined();
});
