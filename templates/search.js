/**
 * search.js — copy-to-clipboard buttons for caniusesql.com
 *
 * Wraps every .syntax block and adds a "Copy" button.
 *
 * The live search that gave this file its name is now <command-search>
 * (src/elements/CommandSearch.ce.vue), including the "/" shortcut.
 *
 * Security notes:
 *   - All DOM text is set via textContent — no innerHTML.
 *   - No external dependencies.
 */

(function () {
  'use strict';

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
     Init
     ------------------------------------------------------------------ */

  document.addEventListener('DOMContentLoaded', function () {
    initCopyButtons();
  });

}());
