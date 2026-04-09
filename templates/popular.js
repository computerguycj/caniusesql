/**
 * popular.js — dynamically refreshes the Popular Commands list on the homepage.
 *
 * Fetches /api/popular (live Redis top-N) and /data.json, then replaces the
 * static build-time list if live results are available. Falls back silently
 * to the static list if the API is unreachable or returns nothing.
 *
 * Security: all DOM text is set via textContent — no innerHTML. The slug is
 * only used in an href via encodeURIComponent — never inserted as raw HTML.
 */

(function () {
  'use strict';

  Promise.all([
    fetch('/api/popular').then(function (r) { return r.ok ? r.json() : []; }),
    fetch('/data.json').then(function (r) { return r.ok ? r.json() : {}; }),
  ]).then(function (results) {
    var slugs = results[0];
    var data  = results[1];
    if (!Array.isArray(slugs) || slugs.length === 0) return;

    // Build slug → name lookup
    var slugToName = {};
    Object.keys(data).forEach(function (name) {
      var entry = data[name];
      if (entry && entry.slug) slugToName[entry.slug] = name;
    });

    var container = document.getElementById('popular-commands-list');
    if (!container) return;

    var fragment = document.createDocumentFragment();
    var rendered = 0;
    slugs.forEach(function (slug) {
      if (typeof slug !== 'string') return;
      var name = slugToName[slug];
      if (!name) return;
      var a = document.createElement('a');
      a.className   = 'example';
      a.href        = '/f/' + encodeURIComponent(slug) + '/';
      a.textContent = name.toUpperCase();
      fragment.appendChild(a);
      rendered++;
    });

    if (rendered > 0) {
      container.textContent = '';
      container.appendChild(fragment);
    }
  }).catch(function () {
    // Static fallback remains in place — nothing to do.
  });

}());
