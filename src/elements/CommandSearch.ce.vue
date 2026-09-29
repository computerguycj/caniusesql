<!--
  CommandSearch.ce.vue — <command-search> custom element: the header search box.

  In:  `src` attribute, the URL of the command data (default /data.json?v=2).
       Fetched once on mount. Same shape as data.json: name -> { slug, description, … }.
  Out: nothing. Results are real links, so the browser does the navigating.

  Also owns the "/" shortcut that focuses the search box. One per page.

  Narrow headers: mobile-first, the element is just a search button
  (aria-expanded). Activating it (or "/") shows the input over the header's
  first row and focuses it; Escape collapses it and returns focus to the
  button; clicking outside or tabbing away collapses it and keeps the text.
  A container query on the header shows the full input, and hides the
  button, once the header is 720px wide.

  Keyboard: ARIA combobox pattern. Focus stays in the input; Up/Down move a
  highlight through the results, tracked by aria-activedescendant. That
  IDREF only resolves within one tree, which works because the input and
  the options share this shadow root.
-->
<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';

const MAX_RESULTS = 10;

const props = defineProps({
  src: { type: String, default: '/data.json?v=2' },
});

const commandData = ref(null);  // null until the fetch resolves
const query = ref('');
const open = ref(false);        // false after Escape or an outside click
const active = ref(-1);         // highlighted result index, -1 for none
const expanded = ref(false);    // narrow headers only: input shown over the header row
const root = ref(null);         // template refs, filled in on mount
const input = ref(null);
const toggle = ref(null);

// Case-insensitive substring match on command names, in data.json order.
const results = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!commandData.value || !q) {
    return [];
  }
  const matches = [];
  for (const [name, entry] of Object.entries(commandData.value)) {
    if (name.toLowerCase().includes(q)) {
      matches.push({ name, entry });
      if (matches.length === MAX_RESULTS) break;
    }
  }
  return matches;
});

const listShown = computed(() => open.value && results.value.length > 0);

function optionId(index) {
  return 'command-search-option-' + index;
}

function href(result) {
  return '/f/' + result.entry.slug + '/';
}

function onInput() {
  open.value = true;
  active.value = -1;
}

// Down: open the list if needed, then highlight the next result.
// Stops on the last one; no wrap-around.
function onDown(event) {
  if (results.value.length === 0) return;
  event.preventDefault();  // keep the caret where it is
  if (!open.value) {
    open.value = true;
  }
  active.value = Math.min(active.value + 1, results.value.length - 1);
}

// Up: highlight the previous result; from the first, back to none.
function onUp(event) {
  if (!listShown.value) return;
  event.preventDefault();
  active.value = Math.max(active.value - 1, -1);
}

// Enter: the highlighted result if there is one, else the old matching.
function onEnter() {
  if (listShown.value && active.value >= 0) {
    window.location.href = href(results.value[active.value]);
    return;
  }
  go();
}

// The list scrolls (max-height), so keep the highlight in view. Waits a tick
// because a Down that opens the list renders it in the same update.
watch(active, index => {
  if (index < 0) return;
  nextTick(() => {
    const option = root.value && root.value.querySelector('#' + optionId(index));
    if (option) option.scrollIntoView({ block: 'nearest' });
  });
});

// Enter: exact match first, then the first substring match.
function go() {
  const q = query.value.trim().toLowerCase();
  if (!commandData.value || !q) {
    return;
  }
  const names = Object.keys(commandData.value);
  const chosen = names.find(n => n.toLowerCase() === q)
    || names.find(n => n.toLowerCase().includes(q));
  if (chosen && commandData.value[chosen].slug) {
    window.location.href = '/f/' + commandData.value[chosen].slug + '/';
  }
}

function close() {
  open.value = false;
  active.value = -1;
}

function clear() {
  close();
  query.value = '';
}

// The button only shows on narrow headers (container query). On wide ones
// the input is always there and expanded/collapsed makes no difference.
function narrow() {
  return toggle.value && getComputedStyle(toggle.value).display !== 'none';
}

function expand() {
  expanded.value = true;
  // The input is display:none until the class change renders.
  nextTick(() => {
    input.value.focus();
    input.value.select();
  });
}

function onEscape() {
  clear();
  if (narrow()) {
    expanded.value = false;
    toggle.value.focus();  // don't strand keyboard focus on a hidden input
  }
}

// Focus left the component (Tab away): collapse, and let focus go where it
// was going. relatedTarget is the element receiving focus.
function onFocusOut(event) {
  if (!root.value.contains(event.relatedTarget)) {
    expanded.value = false;
  }
}

// A click inside the shadow root reaches document retargeted to the host,
// so check the composed path, not event.target.
function onDocumentClick(event) {
  if (!event.composedPath().includes(root.value)) {
    close();
    expanded.value = false;
  }
}

// composedPath()[0] is the element that really has focus, even inside a
// shadow root, where document.activeElement only shows the host.
function onDocumentKeydown(event) {
  if (event.key !== '/') return;
  const target = event.composedPath()[0];
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
    return;
  }
  event.preventDefault();
  expand();
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onDocumentKeydown);

  fetch(props.src)
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to load ' + props.src + ': ' + response.status);
      }
      return response.json();
    })
    .then(data => {
      commandData.value = data;
    })
    .catch(error => {
      // Search stays inert, as it did before the fetch finished.
      console.error(error);
    });
});

// Document listeners outlive the element unless removed here.
onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onDocumentKeydown);
});
</script>

<template>
  <div ref="root" class="search" :class="{ 'is-expanded': expanded }" @focusout="onFocusOut">
    <button
      ref="toggle"
      type="button"
      class="search-toggle"
      aria-label="Search SQL commands"
      :aria-expanded="expanded ? 'true' : 'false'"
      aria-controls="command-search-box"
      @click="expand"
    >
      <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <line x1="15.5" y1="15.5" x2="21" y2="21" />
      </svg>
    </button>
    <div id="command-search-box" class="search-widget">
    <input
      ref="input"
      v-model="query"
      class="site-search"
      type="search"
      placeholder="Search SQL commands…"
      autocomplete="off"
      aria-label="Search SQL commands"
      role="combobox"
      aria-autocomplete="list"
      aria-controls="command-search-results"
      :aria-expanded="listShown ? 'true' : 'false'"
      :aria-activedescendant="active >= 0 ? optionId(active) : undefined"
      @input="onInput"
      @keydown.down="onDown"
      @keydown.up="onUp"
      @keydown.enter="onEnter"
      @keydown.esc="onEscape"
    >
    <ul
      id="command-search-results"
      class="search-results"
      :hidden="!listShown"
      role="listbox"
      aria-label="Search suggestions"
    >
      <li v-for="(r, i) in results" :key="r.name" role="none">
        <a
          :id="optionId(i)"
          :href="href(r)"
          role="option"
          :aria-selected="i === active ? 'true' : 'false'"
        >
          {{ r.name.toUpperCase() }}<template v-if="r.entry.description"> — <small>{{ r.entry.description }}</small></template>
        </a>
      </li>
    </ul>
    </div>
  </div>
</template>

<style>
/* Moved from the search widget rules in templates/styles.css. Sizing of the
   element itself in the header stays with the page.

   Mobile-first: the base styles are the narrow header (button only); the
   container query at the end is the wide header (input always shown). */
:host {
  display: block;
}

.search-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-control-border);
  border-radius: 4px;
  cursor: pointer;
}

.search-toggle:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.search-icon {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentcolor;
  stroke-width: 2;
  stroke-linecap: round;
}

/* Hidden until expanded, then laid over the header's first row. It's
   positioned against .site-header (position: sticky); the offsets match
   the header's padding (12px 16px in styles.css). */
.search-widget {
  display: none;
  position: absolute;
  top: 12px;
  left: 16px;
  right: 16px;
  z-index: 60;
}

.is-expanded .search-widget {
  display: block;
}

.site-search {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-control-border);
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
  background: var(--color-surface);
  color: var(--color-text);
}

.site-search:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-focus-ring);
}

.site-search:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  box-shadow: none;
}

.search-results {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  box-shadow: var(--shadow-lg);
  list-style: none;
  margin: 0;
  padding: 0;
  z-index: 100;
  max-height: 300px;
  overflow-y: auto;
}

.search-results li {
  border-bottom: 1px solid var(--color-border-light);
}

.search-results li:last-child {
  border-bottom: none;
}

.search-results a {
  display: block;
  padding: 8px 12px;
  text-decoration: none;
  color: var(--color-text-heading);
  font-size: 14px;
}

.search-results a:hover,
.search-results a[aria-selected="true"] {
  background-color: var(--color-search-hover);
  color: var(--color-primary);
}

.search-results small {
  color: var(--color-text-muted);
  font-weight: normal;
  font-size: 12px;
}

/* Wide header: no button, the input is always in the row. */
@container (min-width: 720px) {
  .search-toggle {
    display: none;
  }

  .search-widget {
    display: block;
    position: relative;
    top: auto;
    left: auto;
    right: auto;
    z-index: auto;
  }
}
</style>
