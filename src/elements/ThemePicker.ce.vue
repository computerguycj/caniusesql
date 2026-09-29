<!--
  ThemePicker.ce.vue — <theme-picker> custom element: System / Light / Dark.

  In:  nothing. Reads the saved choice from localStorage.
  Out: `theme-change` event with the new choice in event.detail[0]
       ("system", "light" or "dark"). Nothing listens today.

  Side effect, on purpose: it owns the site theme. It sets or removes
  data-theme on <html> (tokens.css turns that into color-scheme) and saves
  the choice. The inline script in <head> applies the saved choice before
  first paint; this element only keeps it in sync afterwards.
-->
<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const STORAGE_KEY = 'caniusesql_theme';
const CHOICES = ['system', 'light', 'dark'];

const emit = defineEmits(['theme-change']);

function readSaved() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return CHOICES.includes(saved) ? saved : 'system';
  } catch (_) {
    return 'system';  // storage blocked (private mode, strict settings)
  }
}

const choice = ref(readSaved());

// System removes data-theme, so :root's `color-scheme: light dark` follows
// the OS.
function applyToPage(value) {
  const root = document.documentElement;
  if (value === 'system') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = value;
  }
}

function save(value) {
  try {
    if (value === 'system') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, value);
    }
  } catch (_) {}
}

function onChange() {
  applyToPage(choice.value);
  save(choice.value);
  emit('theme-change', choice.value);
}

// Another tab changed the theme: follow it.
function onStorage(event) {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  choice.value = readSaved();
  applyToPage(choice.value);
}

onMounted(() => {
  applyToPage(choice.value);  // idempotent; covers a page without the head script
  window.addEventListener('storage', onStorage);
});

onUnmounted(() => {
  window.removeEventListener('storage', onStorage);
});
</script>

<template>
  <label class="picker">
    <span class="label">Theme</span>
    <select v-model="choice" class="select" @change="onChange">
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>
</template>

<style>
/* Mobile-first: the base styles are the phone layout, where the visible
   "Theme" text doesn't fit, so it's screen-reader-only. A container query
   shows it when the element's container (the page header) has room. */
:host {
  display: block;
}

.picker {
  display: flex;
  align-items: center;
  gap: 6px;
}

.label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.select {
  min-height: 32px;  /* above the 24px minimum target size */
  padding: 4px 8px;
  font: inherit;
  font-size: 14px;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-control-border);
  border-radius: 4px;
  cursor: pointer;
}

.select:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

@container (min-width: 720px) {
  .label {
    position: static;
    width: auto;
    height: auto;
    overflow: visible;
    clip-path: none;
    font-size: 14px;
    color: var(--color-text-muted);
  }
}
</style>
