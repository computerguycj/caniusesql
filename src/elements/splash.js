/**
 * splash.js — when to show the intro splash (<intro-splash>).
 *
 * Shown once: on a visit with no `caniusesql_splash` cookie, which it then
 * sets for a year. Skipped entirely when cookies don't work (private
 * browsing, strict settings), or it would show on every page.
 *
 * `doc` is anything with a `cookie` property that behaves like
 * document.cookie, so these are unit tested with a fake
 * (tests/splash.test.mjs).
 */

// Same name the old templates/splash.js used, so returning visitors who
// already saw it don't see it again.
export const SPLASH_COOKIE = 'caniusesql_splash';

const PROBE = '_ck';
const PAST = 'Thu, 01 Jan 1970 00:00:00 GMT';

/** Value of one cookie from a `document.cookie` string, or null. */
export function readCookie(cookieString, name) {
  for (const pair of (cookieString || '').split(';')) {
    const trimmed = pair.trim();
    if (trimmed.startsWith(name + '=')) return trimmed.slice(name.length + 1);
  }
  return null;
}

/** True if a cookie written now can be read back. */
export function cookiesAvailable(doc) {
  try {
    doc.cookie = PROBE + '=1; SameSite=Lax';
    const ok = readCookie(doc.cookie, PROBE) !== null;
    doc.cookie = PROBE + '=; expires=' + PAST + '; SameSite=Lax';
    return ok;
  } catch (error) {
    return false;
  }
}

export function shouldShowSplash(doc) {
  return cookiesAvailable(doc) && readCookie(doc.cookie, SPLASH_COOKIE) === null;
}

/** Remembers the splash for a year. Fixed value: nothing user-provided. */
export function markSplashSeen(doc, now = new Date()) {
  const expires = new Date(now);
  expires.setDate(expires.getDate() + 365);
  doc.cookie = SPLASH_COOKIE + '=1; expires=' + expires.toUTCString() + '; path=/; SameSite=Lax';
}
