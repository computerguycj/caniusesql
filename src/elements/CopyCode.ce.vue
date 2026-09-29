<!--
  CopyCode.ce.vue — <copy-code> custom element: a "Copy" button on a code block.

  In:  its children. The page wraps a block, e.g.
       <copy-code><div class="syntax">SELECT …</div></copy-code>, and the
       button copies the host's text. The block stays in the page's DOM
       (light DOM), shown through <slot>, so it stays in the static HTML for
       crawlers and page CSS keeps styling it.
  Out: nothing.
-->
<script setup>
import { ref, onUnmounted, useHost } from 'vue';

const COPIED_MS = 1500;

const host = useHost();  // the <copy-code> element itself
const copied = ref(false);
let timer = null;

function copy() {
  // textContent of the host is the slotted block only; the shadow root's
  // button isn't part of it.
  const text = host.textContent || '';
  if (!navigator.clipboard) return;  // non-HTTPS or old browser: silent fail
  navigator.clipboard.writeText(text).then(() => {
    copied.value = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      copied.value = false;
      timer = null;
    }, COPIED_MS);
  }).catch(() => {
    // Clipboard write failed: silent fail.
  });
}

// A pending timer would set state on an unmounted component.
onUnmounted(() => clearTimeout(timer));
</script>

<template>
  <slot></slot>
  <button
    class="copy-btn"
    :class="{ copied }"
    type="button"
    aria-label="Copy to clipboard"
    @click="copy"
  >{{ copied ? 'Copied!' : 'Copy' }}</button>
</template>

<style>
/* Moved from .syntax-wrapper and .copy-btn in templates/styles.css. The
   slotted block keeps its page styles; only the button lives here. */
:host {
  display: block;
  position: relative;
}

.copy-btn {
  position: absolute;
  top: 14px;
  right: 8px;
  min-height: 24px;  /* WCAG 2.2 target size */
  padding: 3px 8px;
  font-size: 11px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 3px;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: color 0.15s, border-color 0.15s;
  font-family: inherit;
  line-height: 1.4;
}

/* Always visible: a control that only appears on hover is invisible to
   anyone who doesn't happen to hover there. */

.copy-btn.copied {
  color: var(--color-success);
  border-color: var(--color-success);
}
</style>
