/**
 * track.js — client-side page view tracker for caniusesql.com
 *
 * Fires once per command page visit, posting the slug to /api/track.
 * Uses keepalive so the request completes even if the user navigates away.
 * All errors are silently swallowed — tracking must never affect page load.
 *
 * Only runs on /f/{slug}/ pages; exits immediately on all other paths.
 */

(function () {
  'use strict';

  var match = window.location.pathname.match(/^\/f\/([a-z0-9][a-z0-9-]{0,98}[a-z0-9]?)\/?$/);
  if (!match) {
    return;
  }

  var slug = match[1];

  try {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: slug }),
      keepalive: true,
    }).catch(function () {});
  } catch (_) {
    // fetch not available or blocked — silently ignore
  }
}());
