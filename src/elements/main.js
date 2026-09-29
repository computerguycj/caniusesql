/**
 * main.js — entry for the custom elements bundle (dist/assets/elements.js).
 *
 * Registers every Vue custom element the site uses, so the Vue runtime
 * ships once no matter how many elements a page contains.
 */

import { defineCustomElement } from 'vue';
import DbFilter from './DbFilter.ce.vue';

customElements.define('db-filter', defineCustomElement(DbFilter));
