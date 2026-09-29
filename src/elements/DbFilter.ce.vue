<!--
  DbFilter.ce.vue — <db-filter> custom element: the "Filter by Database" bar.

  In:  `databases` attribute, a JSON object of id -> label, e.g.
       '{"mysql":"MySQL","postgresql":"PostgreSQL"}'. Order = display order.
  Out: `filter-change` event on mount and on every toggle. The page reads
       event.detail[0], e.g. { mysql: true, postgresql: false }.

  Owns the checkbox state and its persistence in localStorage (same key and
  format as the old compare.js, so saved choices carry over). Hiding rows
  and cards stays with the page.
-->
<script setup>
import { ref, computed, onMounted } from 'vue';

const STORAGE_KEY = 'caniusesql_db_filter';

const props = defineProps({
  databases: { type: String, default: '{}' },
});

const emit = defineEmits(['filter-change']);

// Attributes are strings; Vue only casts Number and Boolean props, so parse here.
const dbList = computed(() => {
  try {
    return JSON.parse(props.databases);
  } catch (_) {
    return {};
  }
});

function loadSaved() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (_) {
    return {};
  }
}

// Every database starts checked unless a saved choice says otherwise.
function initialState() {
  const saved = loadSaved();
  const state = {};
  for (const id of Object.keys(dbList.value)) {
    state[id] = Object.prototype.hasOwnProperty.call(saved, id) ? saved[id] : true;
  }
  return state;
}

const shown = ref(initialState());

function notify() {
  // Emit a plain copy, not the reactive proxy.
  emit('filter-change', { ...shown.value });
}

function toggle(id, checked) {
  shown.value[id] = checked;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shown.value));
  } catch (_) {}
  notify();
}

onMounted(notify);
</script>

<template>
  <fieldset class="compare-bar">
    <legend>Filter by Database</legend>
    <label v-for="(label, id) in dbList" :key="id">
      <input
        type="checkbox"
        :value="id"
        :checked="shown[id]"
        @change="toggle(id, $event.target.checked)"
      >
      {{ label }}
    </label>
  </fieldset>
</template>

<style>
/* Moved from .compare-bar in templates/styles.css. Page CSS can't reach
   into the shadow root, but custom properties (var(--color-*)) and inherited
   properties (font, line-height) do. */
:host {
  display: block;
}

.compare-bar {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  padding: 12px;
  background: var(--color-surface);
  border-radius: 6px;
  border: 1px solid var(--color-border);
  font-size: 13px;
}

.compare-bar legend {
  font-weight: 600;
  color: var(--color-text-heading);
  white-space: nowrap;
  margin-bottom: 8px;
  width: 100%;
  padding: 0;
}

.compare-bar label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: var(--color-text);
  white-space: nowrap;
}

.compare-bar input[type="checkbox"] {
  width: 24px;
  height: 24px;
  min-width: 24px;
  min-height: 24px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.compare-bar input[type="checkbox"]:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
