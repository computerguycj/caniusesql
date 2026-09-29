/**
 * splash.js — one-time intro splash for caniusesql.com
 *
 * Shows a fun SQL-terminal animation on the first visit.
 * Uses a cookie to remember it has been shown; silently skips if:
 *   - the cookie has already been set, OR
 *   - cookies are unavailable (private browsing, strict settings, etc.)
 *
 * Security notes:
 *   - All visible text is set via textContent — no innerHTML.
 *   - The cookie value is fixed ('1') — no user input is stored.
 *   - No external resources loaded.
 */

(function () {
  'use strict';

  var COOKIE_NAME = 'caniusesql_splash';
  var DISMISS_DELAY_MS = 3000;  // auto-dismiss after 3 s
  var FADE_DURATION_MS = 400;   // must match the #caniusesql-splash transition in styles.css

  /* ------------------------------------------------------------------
     Cookie helpers
     ------------------------------------------------------------------ */

  function cookiesAvailable() {
    try {
      document.cookie = '_ck=1; SameSite=Lax';
      var ok = document.cookie.indexOf('_ck=') !== -1;
      document.cookie = '_ck=; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
      return ok;
    } catch (e) {
      return false;
    }
  }

  function getSplashCookie() {
    var pairs = document.cookie.split(';');
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i].trim();
      if (pair.indexOf(COOKIE_NAME + '=') === 0) {
        return pair.slice(COOKIE_NAME.length + 1);
      }
    }
    return null;
  }

  function setSplashCookie() {
    var exp = new Date();
    exp.setDate(exp.getDate() + 365);
    document.cookie = COOKIE_NAME + '=1; expires=' + exp.toUTCString()
      + '; path=/; SameSite=Lax';
  }

  /* ------------------------------------------------------------------
     Splash DOM builder — all text via textContent, no innerHTML
     ------------------------------------------------------------------ */

  function buildSplash() {
    // Styles live in styles.css (.splash rules): an injected <style> would
    // need its own CSP allowance.

    var overlay = document.createElement('div');
    overlay.id = 'caniusesql-splash';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Welcome splash');

    var card = document.createElement('div');
    card.id = 'caniusesql-splash-card';

    var prompt = document.createElement('div');
    prompt.className = 'splash-prompt';
    prompt.textContent = '> caniusesql.com $';

    var query = document.createElement('div');
    query.className = 'splash-query';
    query.textContent = 'SELECT * FROM sql_support';

    var cursor = document.createElement('span');
    cursor.className = 'splash-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    query.appendChild(cursor);

    var result = document.createElement('div');
    result.className = 'splash-result';
    var checkmark = document.createElement('em');
    checkmark.textContent = '✓ ';
    result.appendChild(checkmark);
    result.appendChild(document.createTextNode('148 commands across 5 databases'));

    var tagline = document.createElement('div');
    tagline.className = 'splash-tagline';
    tagline.textContent = 'Can I Use SQL? — SQL compatibility at a glance.';

    var dismiss = document.createElement('div');
    dismiss.className = 'splash-dismiss';
    dismiss.textContent = 'Click anywhere to dismiss';

    card.appendChild(prompt);
    card.appendChild(query);
    card.appendChild(result);
    card.appendChild(tagline);
    card.appendChild(dismiss);
    overlay.appendChild(card);

    return overlay;
  }

  /* ------------------------------------------------------------------
     Show / dismiss logic
     ------------------------------------------------------------------ */

  function dismissSplash(overlay) {
    overlay.classList.add('fade-out');
    setTimeout(function () {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, FADE_DURATION_MS + 50);
  }

  function showSplash() {
    var overlay = buildSplash();
    document.body.appendChild(overlay);

    // Dismiss on click anywhere
    overlay.addEventListener('click', function () {
      dismissSplash(overlay);
    });

    // Dismiss on Escape key
    function onKeydown(e) {
      if (e.key === 'Escape') {
        dismissSplash(overlay);
        document.removeEventListener('keydown', onKeydown);
      }
    }
    document.addEventListener('keydown', onKeydown);

    // Auto-dismiss after DISMISS_DELAY_MS
    setTimeout(function () {
      dismissSplash(overlay);
    }, DISMISS_DELAY_MS);
  }

  /* ------------------------------------------------------------------
     Entry point
     ------------------------------------------------------------------ */

  document.addEventListener('DOMContentLoaded', function () {
    if (!cookiesAvailable()) {
      return;   // cookies disabled — skip splash entirely
    }
    if (getSplashCookie()) {
      return;   // already seen — skip splash
    }
    setSplashCookie();
    showSplash();
  });

}());
