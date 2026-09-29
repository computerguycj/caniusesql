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
