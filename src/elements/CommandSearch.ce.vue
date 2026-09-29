<!--
  CommandSearch.ce.vue — <command-search> custom element: the header search box.

  In:  `src` attribute, the URL of the command data (default /data.json?v=2).
       Fetched once on mount. Same shape as data.json: name -> { slug, description, … }.
  Out: nothing. Results are real links, so the browser does the navigating.

  Also owns the "/" shortcut that focuses the search box. One per page.
-->
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const MAX_RESULTS = 10;

const props = defineProps({
  src: { type: String, default: '/data.json?v=2' },
});

const commandData = ref(null);  // null until the fetch resolves
const query = ref('');
const open = ref(false);        // false after Escape or an outside click
const root = ref(null);         // template refs, filled in on mount
const input = ref(null);

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

function clear() {
  open.value = false;
  query.value = '';
}

// A click inside the shadow root reaches document retargeted to the host,
// so check the composed path, not event.target.
function onDocumentClick(event) {
  if (!event.composedPath().includes(root.value)) {
    open.value = false;
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
  input.value.focus();
  input.value.select();
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
  <div ref="root" class="search-widget">
    <input
      ref="input"
      v-model="query"
      class="site-search"
      type="search"
      placeholder="Search SQL commands…"
      autocomplete="off"
      aria-label="Search SQL commands"
      @input="open = true"
      @keydown.enter="go"
      @keydown.esc="clear"
    >
    <ul
      class="search-results"
      :hidden="!open || results.length === 0"
      role="listbox"
      aria-label="Search suggestions"
    >
      <li v-for="r in results" :key="r.name" role="option">
        <a :href="'/f/' + r.entry.slug + '/'">
          {{ r.name.toUpperCase() }}<template v-if="r.entry.description"> — <small>{{ r.entry.description }}</small></template>
        </a>
      </li>
    </ul>
  </div>
</template>

<style>
/* Moved from the search widget rules in templates/styles.css. Sizing of the
   element itself in the header stays with the page. */
:host {
  display: block;
}

.search-widget {
  position: relative;
}

.site-search {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
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

.search-results a:hover {
  background-color: var(--color-search-hover);
  color: var(--color-primary);
}

.search-results small {
  color: var(--color-text-muted);
  font-weight: normal;
  font-size: 12px;
}
</style>
