<!--
  ThemePicker.ce.vue — <theme-picker> custom element: System / Light / Dark /
  Custom.

  In:  nothing. Reads the saved choice from localStorage.
  Out: `theme-change` event with the new choice in event.detail[0]
       ("system", "light", "dark" or "custom"). Nothing listens today.

  Side effect, on purpose: it owns the site theme. It sets or removes
  data-theme on <html> (tokens.css turns that into color-scheme) and saves
  the choice. The inline script in <head> applies the saved choice before
  first paint; this element keeps it in sync afterwards.

  Custom: a native <dialog> (showModal) picks a Light or Dark base and an
  accent. customTheme.js derives the accent-driven tokens and checks their
  contrast; Apply stays disabled until every pair passes. The tokens are set
  on <html> with style.setProperty (CSSOM, which the CSP allows; only style
  written in markup is blocked). Inline properties beat every stylesheet and
  layer, so tokens.css needs no Custom rules.
-->
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { deriveTokens, checkTokens, nearestPassing, isHex, isSafeTokenMap, toHex } from './customTheme.js';

const STORAGE_KEY = 'caniusesql_theme';
const CUSTOM_KEY = 'caniusesql_custom';
const CHOICES = ['system', 'light', 'dark', 'custom'];
const BASES = ['light', 'dark'];

const emit = defineEmits(['theme-change']);

const choice = ref('system');
let previousChoice = 'system';  // restored if the Custom dialog is cancelled
const dialog = ref(null);
const probe = ref(null);
const draftBase = ref('light');
const draftAccent = ref('');
let applied = false;            // did this dialog session end in Apply?

/* ---------------------------------------------------------------- storage */

function readSaved() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return CHOICES.includes(saved) ? saved : 'system';
  } catch (_) {
    return 'system';  // storage blocked (private mode, strict settings)
  }
}

// Only a well-formed custom theme counts; anything else is ignored.
function readCustom() {
  try {
    const c = JSON.parse(localStorage.getItem(CUSTOM_KEY));
    if (c && BASES.includes(c.base) && isHex(c.accent)) return { base: c.base, accent: c.accent.toLowerCase() };
  } catch (_) {}
  return null;
}

function save(value, custom) {
  try {
    if (value === 'system') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, value);
    }
    if (custom) localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
  } catch (_) {}
}

/* ----------------------------------------------------- reading the tokens */

// Resolves a token for a given base by letting the browser compute it on a
// hidden element with that color-scheme, then reading the computed color.
function resolve(name, base) {
  const el = probe.value;
  el.style.colorScheme = base;
  el.style.color = `var(${name})`;
  const [r, g, b] = getComputedStyle(el).color.match(/\d+(\.\d+)?/g).map(Number);
  return toHex([r, g, b]);
}

function palette(base) {
  return {
    bg: resolve('--color-bg', base),
    surface: resolve('--color-surface', base),
    surfaceAlt: resolve('--color-surface-alt', base),
    text: resolve('--color-text', base),
    muted: resolve('--color-text-muted', base),
    lightInk: resolve('--ink-light', base),
    darkInk: resolve('--ink-dark', base),
  };
}

const palettes = ref(null);  // { light, dark }, filled on mount

/* ------------------------------------------------------- applying themes */

let customNames = [];  // the properties currently set on <html>

function clearCustom() {
  const root = document.documentElement;
  // Also clears what the head script set before this element mounted.
  for (const name of [...customNames, ...Object.keys(deriveTokens('#000000', palettes.value.light))]) {
    root.style.removeProperty(name);
  }
  customNames = [];
  delete root.dataset.custom;
}

function applyToPage(value, custom) {
  const root = document.documentElement;
  clearCustom();
  if (value === 'custom' && custom) {
    const tokens = deriveTokens(custom.accent, palettes.value[custom.base]);
    root.dataset.theme = custom.base;
    root.dataset.custom = '';
    for (const [name, v] of Object.entries(tokens)) root.style.setProperty(name, v);
    customNames = Object.keys(tokens);
  } else if (value === 'system') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = value;
  }
}

// A saved custom theme that no longer passes (tokens changed in a later
// release, or storage was edited) falls back to System.
function usable(custom) {
  return custom && checkTokens(deriveTokens(custom.accent, palettes.value[custom.base]), palettes.value[custom.base]).every(c => c.ok);
}

function loadAndApply() {
  let value = readSaved();
  const custom = readCustom();
  if (value === 'custom' && !usable(custom)) value = 'system';
  choice.value = value;
  previousChoice = value;
  applyToPage(value, custom);
}

/* ---------------------------------------------------------------- select */

function onChange() {
  if (choice.value === 'custom') {
    openDialog();
    return;
  }
  previousChoice = choice.value;
  applyToPage(choice.value);
  save(choice.value);
  emit('theme-change', choice.value);
}

/* ---------------------------------------------------------------- dialog */

const draftTokens = computed(() => (palettes.value && isHex(draftAccent.value)
  ? deriveTokens(draftAccent.value, palettes.value[draftBase.value]) : null));
const checks = computed(() => (draftTokens.value ? checkTokens(draftTokens.value, palettes.value[draftBase.value]) : []));
const failing = computed(() => checks.value.filter(c => !c.ok));
const draftOk = computed(() => checks.value.length > 0 && failing.value.length === 0);
const suggestion = computed(() => (draftOk.value || !palettes.value || !isHex(draftAccent.value)
  ? null : nearestPassing(draftAccent.value, palettes.value[draftBase.value])));

// The preview shows the candidate colors on the candidate base. Vue sets
// these with style.setProperty, so the CSP allows them.
const previewVars = computed(() => {
  if (!draftTokens.value) return {};
  const p = palettes.value[draftBase.value];
  return {
    '--p-bg': p.bg,
    '--p-surface': p.surface,
    '--p-text': p.text,
    '--p-accent': draftTokens.value['--color-primary'],
    '--p-on-accent': draftTokens.value['--color-text-on-accent'],
    '--p-badge-bg': draftTokens.value['--color-badge-bg'],
    '--p-badge-text': draftTokens.value['--color-badge-text'],
    '--p-badge-border': draftTokens.value['--color-badge-border'],
  };
});

function currentBase() {
  const scheme = getComputedStyle(document.documentElement).colorScheme;
  if (scheme === 'dark' || scheme === 'light') return scheme;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function openDialog() {
  const saved = readCustom();
  draftBase.value = saved ? saved.base : currentBase();
  draftAccent.value = saved ? saved.accent : resolve('--color-primary', draftBase.value);
  applied = false;
  // showModal() makes the rest of the page inert, traps Tab inside the
  // dialog, closes on Escape, and on close returns focus to whatever had it
  // before (the select or the Edit button).
  dialog.value.showModal();
}

function cancel() {
  dialog.value.close();
}

function apply() {
  if (!draftOk.value) return;
  const custom = { base: draftBase.value, accent: draftAccent.value.toLowerCase() };
  applied = true;
  choice.value = 'custom';
  previousChoice = 'custom';
  applyToPage('custom', custom);
  save('custom', { ...custom, tokens: draftTokens.value });
  emit('theme-change', 'custom');
  dialog.value.close();
}

// Runs for Apply, Cancel and Escape alike.
function onDialogClose() {
  if (!applied) choice.value = previousChoice;
}

/* ----------------------------------------------------------- other tabs */

function onStorage(event) {
  if (event.key !== STORAGE_KEY && event.key !== CUSTOM_KEY && event.key !== null) return;
  loadAndApply();
}

onMounted(() => {
  palettes.value = { light: palette('light'), dark: palette('dark') };
  loadAndApply();  // idempotent; covers a page without the head script
  window.addEventListener('storage', onStorage);
});

onUnmounted(() => {
  window.removeEventListener('storage', onStorage);
});
</script>

<template>
  <div class="row">
    <label class="picker">
      <span class="label">Theme</span>
      <select v-model="choice" class="select" @change="onChange">
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="custom">Custom…</option>
      </select>
    </label>
    <button v-if="choice === 'custom'" type="button" class="button" @click="openDialog">
      Edit<span class="label"> custom colors</span>
    </button>
  </div>

  <dialog ref="dialog" class="dialog" aria-labelledby="custom-title" @close="onDialogClose">
    <h2 id="custom-title" class="title">Custom colors</h2>

    <fieldset class="field">
      <legend class="legend">Base</legend>
      <label class="choice"><input v-model="draftBase" type="radio" value="light"> Light</label>
      <label class="choice"><input v-model="draftBase" type="radio" value="dark"> Dark</label>
    </fieldset>

    <label class="field accent">
      <span class="legend">Accent color</span>
      <input v-model="draftAccent" type="color" class="color" autofocus>
      <span class="hex">{{ draftAccent }}</span>
    </label>

    <div class="preview" :style="previewVars" aria-hidden="true">
      <span class="preview-link">A link</span>
      <span class="preview-header">Table header</span>
      <span class="preview-badge">Badge</span>
    </div>

    <div class="result" role="status">
      <p v-if="draftOk" class="ok">All colors pass WCAG AA contrast.</p>
      <template v-else>
        <p class="bad">These don't pass WCAG AA contrast:</p>
        <ul class="failures">
          <li v-for="c in failing" :key="c.name">{{ c.name }}: {{ c.ratio.toFixed(2) }}:1 (needs {{ c.min }}:1)</li>
        </ul>
      </template>
    </div>

    <button v-if="suggestion" type="button" class="button" @click="draftAccent = suggestion">
      Use {{ suggestion }} instead
    </button>

    <div class="actions">
      <button type="button" class="button" @click="cancel">Cancel</button>
      <button type="button" class="button primary" :disabled="!draftOk" @click="apply">Apply</button>
    </div>
  </dialog>

  <span ref="probe" class="probe" aria-hidden="true"></span>
</template>

<style>
/* Mobile-first: the base styles are the phone layout, where the visible
   "Theme" text doesn't fit, so it's screen-reader-only. A container query
   shows it when the element's container (the page header) has room. */
:host {
  display: block;
}

.row {
  display: flex;
  align-items: center;
  gap: 6px;
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

.select,
.button {
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

.select:focus-visible,
.button:focus-visible,
.color:focus-visible,
.choice input:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.button:disabled {
  cursor: not-allowed;
  color: var(--color-text-muted);
}

.primary:not(:disabled) {
  color: var(--color-text-on-accent);
  background: var(--color-primary);
  border-color: var(--color-primary);
}

/* The dialog lives in the top layer, above everything, so its width is
   capped by the viewport rather than the header. */
.dialog {
  width: min(420px, calc(100vw - 32px));
  padding: 20px;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  font-size: 14px;
}

.dialog::backdrop {
  background: var(--color-backdrop);
}

.title {
  margin: 0 0 12px;
  font-size: 18px;
  color: var(--color-text-heading);
}

.field {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 0 0 12px;
  padding: 0;
  border: 0;
}

.legend {
  font-weight: 600;
  padding: 0;
}

.choice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
  cursor: pointer;
}

.choice input {
  width: 24px;  /* WCAG 2.2 target size */
  height: 24px;
  margin: 0;
  accent-color: var(--color-primary);
}

.color {
  width: 48px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--color-control-border);
  border-radius: 4px;
  background: var(--color-surface);
  cursor: pointer;
}

.hex {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 0 0 12px;
  padding: 12px;
  background: var(--p-bg);
  border: 1px solid var(--color-border);
  border-radius: 6px;
}

.preview-link {
  color: var(--p-accent);
  text-decoration: underline;
}

.preview-header {
  padding: 4px 8px;
  color: var(--p-on-accent);
  background: var(--p-accent);
  font-weight: 600;
}

.preview-badge {
  padding: 2px 8px;
  color: var(--p-badge-text);
  background: var(--p-badge-bg);
  border: 1px solid var(--p-badge-border);
  border-radius: 12px;
  font-size: 13px;
}

.result p {
  margin: 0 0 6px;
}

.ok {
  color: var(--color-success);
  font-weight: 600;
}

.bad {
  color: var(--color-danger);
  font-weight: 600;
}

.failures {
  margin: 0 0 12px;
  padding-left: 20px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.probe {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

@container (min-width: 720px) {
  .picker .label {
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
