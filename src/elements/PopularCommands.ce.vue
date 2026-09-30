<!--
  PopularCommands.ce.vue — <popular-commands> custom element: the homepage's
  most-visited commands.

  In:  its children, the build-time list generate.js writes
       (<a class="example" href="/f/slug">NAME</a> …), shown through <slot>
       until a live list is ready and whenever there isn't one. So the static
       HTML keeps real links for crawlers and readers without JavaScript.
       `src`: most-visited slugs (default /api/popular).
       `index-src`, `fallback-src`: the command index, as in <command-search>;
       the defaults match it, so the two elements share one load.
  Out: nothing. Links are real links.

  The live links live in this shadow root, where page CSS can't reach, so
  the badge styles live here too: .example for the live links, ::slotted(a)
  for the build-time ones. One copy of the rules for both.
-->
<script setup>
import { ref, computed, onMounted } from 'vue';
import { useCommandIndex } from './commandIndex.js';
import { loadPopularSlugs, resolvePopular } from './popular.js';

const props = defineProps({
  src: { type: String, default: '/api/popular' },
  indexSrc: { type: String, default: '/api/v2/command-index' },
  fallbackSrc: { type: String, default: '/data.json?v=2' },
});

const { commands } = useCommandIndex(props.indexSrc, props.fallbackSrc);
const slugs = ref([]);

// Empty until both loads finish, and if either fails: the slot shows then.
const live = computed(() => resolvePopular(slugs.value, commands.value));

onMounted(() => {
  loadPopularSlugs(props.src).then(result => {
    slugs.value = result;
  });
});
</script>

<template>
  <template v-if="live.length">
    <a
      v-for="c in live"
      :key="c.slug"
      class="example"
      :href="'/f/' + c.slug + '/'"
    >{{ c.name.toUpperCase() }}</a>
  </template>
  <slot v-else></slot>
</template>

<style>
/* Moved from .example in templates/styles.css. */
:host {
  display: block;
}

.example,
::slotted(a) {
  display: inline-block;
  margin: 4px 6px 4px 0;
  padding: 4px 10px;
  background: var(--color-badge-bg);
  color: var(--color-badge-text);
  border: 1px solid var(--color-badge-border);
  border-radius: 4px;
  text-decoration: none;
  font-size: 13px;
  font-weight: 600;
}

/* For slotted elements, the page's own rules beat ::slotted() regardless of
   specificity (the cascade compares the page and the shadow root before
   specificity), so the page's `a { color }` would win. For !important the
   order reverses and this rule wins. Nothing else the page sets on links
   conflicts. */
::slotted(a) {
  color: var(--color-badge-text) !important;
}

.example:hover,
::slotted(a:hover) {
  background: var(--color-badge-bg-hover);
}

/* The page's a:focus-visible rule doesn't reach into the shadow root. */
.example:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
</style>
