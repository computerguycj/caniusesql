/**
 * compare.js — applies the DB filter on command pages and the homepage.
 *
 * The filter bar itself is the <db-filter> Vue custom element
 * (src/elements/DbFilter.ce.vue), which owns the checkboxes and their
 * localStorage persistence. It emits `filter-change` on mount and on every
 * toggle, with the selection in event.detail[0], e.g. { mysql: true, ... }.
 *
 * Command pages: toggles tr[data-db] rows and .per-db-entry[data-db] blocks.
 * Homepage: filters .command-card[data-dbs] cards (visible if any checked DB
 * supports the command); hides .category-group sections that become empty.
 *
 * Listens on the element, not document: Vue custom element events don't bubble.
 *
 * Security: reads only boolean flags keyed by db id — no user string is
 * inserted into the DOM.
 */

(function () {
  'use strict';

  var filter = document.querySelector('db-filter');
  if (!filter) return;

  /* ------------------------------------------------------------------
     Filter logic
     ------------------------------------------------------------------ */

  function applyFilter(shown) {
    var i, j;

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

  filter.addEventListener('filter-change', function (event) {
    applyFilter(event.detail[0]);
  });

}());
