/**
 * main.js — entry for the custom elements bundle (dist/assets/elements.js).
 *
 * Registers every Vue custom element the site uses, so the Vue runtime
 * ships once no matter how many elements a page contains.
 */

import { defineCustomElement } from 'vue';
import DbFilter from './DbFilter.ce.vue';
import CommandSearch from './CommandSearch.ce.vue';
import CopyCode from './CopyCode.ce.vue';
import ThemePicker from './ThemePicker.ce.vue';
import PopularCommands from './PopularCommands.ce.vue';

customElements.define('db-filter', defineCustomElement(DbFilter));
customElements.define('command-search', defineCustomElement(CommandSearch));
customElements.define('copy-code', defineCustomElement(CopyCode));
customElements.define('theme-picker', defineCustomElement(ThemePicker));
customElements.define('popular-commands', defineCustomElement(PopularCommands));
