/**
 * compare.js — DB filter bar for command compatibility pages.
 *
 * Listens to the .compare-bar checkboxes and toggles visibility of
 * tr[data-db] rows in the compatibility table and
 * .per-db-entry[data-db] blocks in the per-database syntax section.
 *
 * Security: reads only checkbox values from trusted static HTML — no user
 * string is inserted into the DOM.
 */

(function () {
  'use strict';

  var bar = document.querySelector('.compare-bar');
  if (!bar) return;

  function applyFilter() {
    var checkboxes = bar.querySelectorAll('input[type="checkbox"]');
    var shown = {};
    var i;
    for (i = 0; i < checkboxes.length; i++) {
      shown[checkboxes[i].value] = checkboxes[i].checked;
    }

    var rows = document.querySelectorAll('tr[data-db]');
    for (i = 0; i < rows.length; i++) {
      rows[i].hidden = !shown[rows[i].getAttribute('data-db')];
    }

    var entries = document.querySelectorAll('.per-db-entry[data-db]');
    for (i = 0; i < entries.length; i++) {
      entries[i].hidden = !shown[entries[i].getAttribute('data-db')];
    }
  }

  bar.addEventListener('change', function (event) {
    if (event.target.type !== 'checkbox') return;
    applyFilter();
  });

}());
