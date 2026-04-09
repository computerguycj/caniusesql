/**
 * compare.js — DB filter bar for command pages and the homepage.
 *
 * Command pages: toggles tr[data-db] rows and .per-db-entry[data-db] blocks.
 * Homepage: filters .command-card[data-dbs] cards (visible if any checked DB
 * supports the command); hides .category-group sections that become empty.
 *
 * Filter state is persisted to localStorage so the preference carries across
 * pages and visits.
 *
 * Security: reads only checkbox values from trusted static HTML — no user
 * string is inserted into the DOM.
 */

(function () {
  'use strict';

  var STORAGE_KEY = 'caniusesql_db_filter';

  var bar = document.querySelector('.compare-bar');
  if (!bar) return;

  /* ------------------------------------------------------------------
     localStorage persistence
     ------------------------------------------------------------------ */

  function loadState() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  }

  function saveState(shown) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shown));
    } catch (_) {}
  }

  /* ------------------------------------------------------------------
     Filter logic
     ------------------------------------------------------------------ */

  function applyFilter() {
    var checkboxes = bar.querySelectorAll('input[type="checkbox"]');
    var shown = {};
    var i, j;
    for (i = 0; i < checkboxes.length; i++) {
      shown[checkboxes[i].value] = checkboxes[i].checked;
    }
    saveState(shown);

    // Command pages: toggle compatibility table rows
    var rows = document.querySelectorAll('tr[data-db]');
    for (i = 0; i < rows.length; i++) {
      rows[i].hidden = !shown[rows[i].getAttribute('data-db')];
    }

    // Command pages: toggle per-db syntax blocks
    var entries = document.querySelectorAll('.per-db-entry[data-db]');
    for (i = 0; i < entries.length; i++) {
      entries[i].hidden = !shown[entries[i].getAttribute('data-db')];
    }

    // Homepage: show card if any checked DB supports the command
    var cards = document.querySelectorAll('.command-card[data-dbs]');
    for (i = 0; i < cards.length; i++) {
      var dbs = cards[i].getAttribute('data-dbs').split(' ');
      var visible = false;
      for (j = 0; j < dbs.length; j++) {
        if (dbs[j] && shown[dbs[j]]) { visible = true; break; }
      }
      cards[i].hidden = !visible;
    }

    // Homepage: hide category groups where all cards are hidden
    var groups = document.querySelectorAll('.category-group');
    for (i = 0; i < groups.length; i++) {
      var groupCards = groups[i].querySelectorAll('.command-card');
      var anyVisible = false;
      for (j = 0; j < groupCards.length; j++) {
        if (!groupCards[j].hidden) { anyVisible = true; break; }
      }
      groups[i].hidden = !anyVisible;
    }
  }

  /* ------------------------------------------------------------------
     Restore saved state into checkboxes, then apply
     ------------------------------------------------------------------ */

  function initFromState() {
    var saved = loadState();
    if (!saved) return;
    var checkboxes = bar.querySelectorAll('input[type="checkbox"]');
    for (var i = 0; i < checkboxes.length; i++) {
      var val = checkboxes[i].value;
      if (Object.prototype.hasOwnProperty.call(saved, val)) {
        checkboxes[i].checked = saved[val];
      }
    }
  }

  bar.addEventListener('change', function (event) {
    if (event.target.type !== 'checkbox') return;
    applyFilter();
  });

  initFromState();
  applyFilter();

}());
