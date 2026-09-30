<!--
  IntroSplash.ce.vue — <intro-splash> custom element: the one-time intro
  splash, a fake terminal card over the page.

  In:  `command-count`, `database-count` attributes (generate.js writes them
       from data.json at build time).
  Out: nothing.

  Shown once per visitor (splash.js: the caniusesql_splash cookie), never
  when cookies don't work. A native <dialog> opened with showModal(): the
  browser moves focus to the Close button, makes the page behind it inert,
  and treats Escape as a request to close. It closes on the button, on
  Escape, on a click anywhere (as the old splash did), or on its own after
  3 s. Closing fades over 0.4 s unless the reader prefers reduced motion.
  Focus goes back where it was (the document, on page load): the browser
  does that when a modal dialog closes.
-->
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { shouldShowSplash, markSplashSeen } from './splash.js';

const AUTO_CLOSE_MS = 3000;
const FADE_MS = 400;  // matches the transition below

defineProps({
  commandCount: { type: Number, default: 0 },
  databaseCount: { type: Number, default: 0 },
});

const dialog = ref(null);
const fading = ref(false);
let autoClose = null;
let fadeTimer = null;

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function close() {
  if (!dialog.value.open || fading.value) return;
  clearTimeout(autoClose);
  if (reducedMotion()) {
    dialog.value.close();
    return;
  }
  fading.value = true;
  fadeTimer = setTimeout(() => {
    dialog.value.close();
    fading.value = false;
  }, FADE_MS);
}

// Escape fires `cancel`, and the browser would close at once. Take over so
// Escape fades like every other way out.
function onCancel(event) {
  event.preventDefault();
  close();
}

onMounted(() => {
  if (!shouldShowSplash(document)) return;
  markSplashSeen(document);
  dialog.value.showModal();
  autoClose = setTimeout(close, AUTO_CLOSE_MS);
});

onUnmounted(() => {
  clearTimeout(autoClose);
  clearTimeout(fadeTimer);
});
</script>

<template>
  <!-- A click anywhere closes it: on the card, the button or the backdrop
       (a backdrop click targets the dialog itself). -->
  <dialog
    ref="dialog"
    class="splash"
    :class="{ 'fade-out': fading }"
    aria-labelledby="splash-title"
    @cancel="onCancel"
    @click="close"
  >
    <div class="card">
      <div class="prompt">&gt; caniusesql.com $</div>
      <div class="query">SELECT * FROM sql_support<span class="cursor" aria-hidden="true"></span></div>
      <div v-if="commandCount && databaseCount" class="result">
        <em>✓ </em>{{ commandCount }} commands across {{ databaseCount }} databases
      </div>
      <p id="splash-title" class="tagline">Can I Use SQL? — SQL compatibility at a glance.</p>
      <div class="footer">
        <p class="hint">Press Escape or click anywhere to close</p>
        <button type="button" class="close" autofocus>Close</button>
      </div>
    </div>
  </dialog>
</template>

<style>
/* Moved from the #caniusesql-splash rules in templates/styles.css. The
   colors are the fixed --splash-* tokens: a dark terminal in every theme. */
.splash {
  /* Undo the browser's dialog box; the card is the visible box. */
  padding: 0;
  border: none;
  background: transparent;
  max-width: none;
  max-height: none;
  width: 90%;
  max-inline-size: 480px;
  cursor: pointer;
  transition: opacity 0.4s ease;
}

.splash::backdrop {
  background: var(--splash-backdrop);
  transition: opacity 0.4s ease;
}

.splash.fade-out,
.splash.fade-out::backdrop {
  opacity: 0;
}

.card {
  background: var(--splash-card-bg);
  border: 1px solid var(--color-primary);
  border-radius: 10px;
  padding: 32px 40px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  color: var(--splash-text);
  box-shadow: var(--splash-shadow);
}

.prompt { color: var(--splash-prompt); font-size: 13px; margin-bottom: 4px; }
.query  { color: var(--splash-query); font-size: 15px; font-weight: bold; margin: 8px 0; }
.result { color: var(--splash-text); font-size: 13px; margin-top: 12px; }
.result em { color: var(--splash-prompt); font-style: normal; }

.tagline {
  color: var(--splash-tagline);
  font-size: 12px;
  margin: 20px 0 0;
  border-top: 1px solid var(--splash-rule);
  padding-top: 14px;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
}

.hint { color: var(--splash-dismiss); font-size: 11px; margin: 0; }

.close {
  min-width: 24px;
  min-height: 24px;  /* WCAG 2.2 target size */
  padding: 4px 12px;
  font: inherit;
  font-size: 12px;
  color: var(--splash-text);
  background: transparent;
  border: 1px solid var(--splash-tagline);
  border-radius: 4px;
  cursor: pointer;
}

/* --splash-query (4.81:1 on the card), not --color-primary: that's 3.01:1
   on the light theme, and a darker Custom accent could fall below 3:1. */
.close:focus-visible {
  outline: 2px solid var(--splash-query);
  outline-offset: 2px;
}

@keyframes splash-cursor {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0; }
}

.cursor {
  display: inline-block;
  width: 8px;
  height: 14px;
  background: var(--color-primary);
  vertical-align: text-bottom;
  animation: splash-cursor 1s step-start infinite;
}

@media (prefers-reduced-motion: reduce) {
  .cursor { animation: none; }
  .splash,
  .splash::backdrop { transition: none; }
}
</style>
