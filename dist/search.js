/**
 * search.js — shared live-search widget for caniusesql.com
 *
 * Attaches to every .site-search input on the page. On each keystroke it
 * filters command names from data.json and shows a dropdown; selecting an
 * entry (click or Enter) navigates to /f/{slug}/.
 *
 * Security notes:
 *   - All DOM text is set via textContent — no innerHTML for user input.
 *   - data.json is fetched once and cached; never re-fetched per keystroke.
 *   - No external dependencies.
 */

(function () {
  'use strict';

  var commandData = null;   // keyed by command name, value = { slug, description, … }
  var MAX_RESULTS = 10;

  /* ------------------------------------------------------------------
     Data loading
     ------------------------------------------------------------------ */

  function loadData() {
    return fetch('/data.json?v=2')
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Failed to load data.json: ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        commandData = data;
      });
  }

  /* ------------------------------------------------------------------
     Filtering
     ------------------------------------------------------------------ */

  function filterCommands(query) {
    if (!commandData || !query) {
      return [];
    }
    var q = query.toLowerCase();
    var results = [];
    var keys = Object.keys(commandData);
    for (var i = 0; i < keys.length && results.length < MAX_RESULTS; i++) {
      if (keys[i].toLowerCase().indexOf(q) !== -1) {
        results.push({ name: keys[i], entry: commandData[keys[i]] });
      }
    }
    return results;
  }

  /* ------------------------------------------------------------------
     DOM helpers — all text set via textContent (no innerHTML for data)
     ------------------------------------------------------------------ */

  function buildResultItem(name, entry) {
    var li = document.createElement('li');
    li.setAttribute('role', 'option');

    var a = document.createElement('a');
    a.href = '/f/' + entry.slug + '/';

    var nameNode = document.createTextNode(name.toUpperCase());
    a.appendChild(nameNode);

    if (entry.description) {
      var sep = document.createTextNode(' — ');
      var small = document.createElement('small');
      small.textContent = entry.description;
      a.appendChild(sep);
      a.appendChild(small);
    }

    li.appendChild(a);
    return li;
  }

  function getResultsList(input) {
    return input.parentElement
      ? input.parentElement.querySelector('.search-results')
      : null;
  }

  function showResults(input, results) {
    var list = getResultsList(input);
    if (!list) {
      return;
    }

    // Clear existing children without innerHTML
    while (list.firstChild) {
      list.removeChild(list.firstChild);
    }

    for (var i = 0; i < results.length; i++) {
      list.appendChild(buildResultItem(results[i].name, results[i].entry));
    }

    list.hidden = results.length === 0;
  }

  function hideResults(input) {
    var list = getResultsList(input);
    if (list) {
      list.hidden = true;
    }
  }

  /* ------------------------------------------------------------------
     Event handlers
     ------------------------------------------------------------------ */

  function handleInput(event) {
    var input = event.target;
    var query = input.value.trim();
    if (!query) {
      hideResults(input);
      return;
    }
    showResults(input, filterCommands(query));
  }

  function handleKeydown(event) {
    var input = event.target;

    if (event.key === 'Escape') {
      hideResults(input);
      input.value = '';
      return;
    }

    if (event.key === 'Enter') {
      var query = input.value.trim();
      if (!query || !commandData) {
        return;
      }
      var q = query.toLowerCase();
      var keys = Object.keys(commandData);
      // Prefer exact match; fall back to first prefix match
      var exactKey = null;
      var prefixKey = null;
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i].toLowerCase();
        if (k === q) {
          exactKey = keys[i];
          break;
        }
        if (!prefixKey && k.indexOf(q) !== -1) {
          prefixKey = keys[i];
        }
      }
      var chosen = exactKey || prefixKey;
      if (chosen && commandData[chosen].slug) {
        window.location.href = '/f/' + commandData[chosen].slug + '/';
      }
    }
  }

  /* ------------------------------------------------------------------
     Attachment
     ------------------------------------------------------------------ */

  function attachToInput(input) {
    input.addEventListener('input', handleInput);
    input.addEventListener('keydown', handleKeydown);

    // Close dropdown when clicking outside this widget
    document.addEventListener('click', function (event) {
      var widget = input.parentElement;
      if (widget && !widget.contains(event.target)) {
        hideResults(input);
      }
    });
  }

  /* ------------------------------------------------------------------
     Copy-to-clipboard buttons
     ------------------------------------------------------------------ */

  function initCopyButtons() {
    var blocks = document.querySelectorAll('.syntax');
    for (var i = 0; i < blocks.length; i++) {
      wrapSyntaxBlock(blocks[i]);
    }

    document.addEventListener('click', function (event) {
      var btn = event.target;
      if (!btn || btn.className.indexOf('copy-btn') === -1) return;
      var wrapper = btn.parentElement;
      if (!wrapper) return;
      var block = wrapper.querySelector('.syntax');
      if (!block) return;
      var text = block.textContent || '';
      if (!navigator.clipboard) return;  // non-HTTPS or old browser — silent fail
      navigator.clipboard.writeText(text).then(function () {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(function () {
          btn.textContent = 'Copy';
          btn.classList.remove('copied');
        }, 1500);
      }).catch(function () {
        // Clipboard write failed — silent fail.
      });
    });
  }

  function wrapSyntaxBlock(block) {
    var wrapper = document.createElement('div');
    wrapper.className = 'syntax-wrapper';
    block.parentNode.insertBefore(wrapper, block);
    wrapper.appendChild(block);

    var btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Copy to clipboard');
    btn.textContent = 'Copy';
    wrapper.appendChild(btn);
  }

  /* ------------------------------------------------------------------
     "/" keyboard shortcut — focus search
     ------------------------------------------------------------------ */

  function initSlashShortcut() {
    document.addEventListener('keydown', function (event) {
      if (event.key !== '/') return;
      var active = document.activeElement;
      if (active) {
        var tag = active.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        var ce = active.getAttribute('contenteditable');
        if (ce !== null && ce !== 'false') return;
      }
      var input = document.querySelector('.site-search');
      if (!input) return;
      event.preventDefault();
      input.focus();
      input.select();
    });
  }

  /* ------------------------------------------------------------------
     Init
     ------------------------------------------------------------------ */

  document.addEventListener('DOMContentLoaded', function () {
    loadData().then(function () {
      var inputs = document.querySelectorAll('.site-search');
      for (var i = 0; i < inputs.length; i++) {
        attachToInput(inputs[i]);
      }
    });
    initCopyButtons();
    initSlashShortcut();
  });

}());
