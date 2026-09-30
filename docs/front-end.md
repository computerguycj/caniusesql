# Front end: what's Vue and what isn't

The site is static HTML built by `generate.js` from `data.json`, with Vue 3
custom elements for the interactive parts (built by Vite from
`src/elements/`). This page lists every front-end part and why it is or isn't
Vue. Decisions behind it are in DECISIONS.md.

## Vue custom elements

| Element | File | Does |
|---|---|---|
| `<db-filter>` | `DbFilter.ce.vue` | Database checkboxes; saves the choice; emits `filter-change` |
| `<command-search>` | `CommandSearch.ce.vue` | Header search: combobox, "/" shortcut, collapses on narrow headers; data from `useCommandIndex` (API index, falling back to `data.json`) |
| `<copy-code>` | `CopyCode.ce.vue` | Copy button on a slotted code block |
| `<theme-picker>` | `ThemePicker.ce.vue` | System / Light / Dark / Custom, with the Custom dialog |
| `<popular-commands>` | `PopularCommands.ce.vue` | Homepage's most-visited commands: live from `/api/popular` plus the command index (shared with the search box), the build-time list slotted as the fallback. Replaced `templates/popular.js`. |
| `<intro-splash>` | `IntroSplash.ce.vue` | One-time intro splash: a native `<dialog>` (`showModal()`: focus moves in, the page is inert, Escape closes), a Close button, closes itself after 3 s, respects reduced motion. Cookie logic in `splash.js`. Replaced `templates/splash.js`. |

## Staying non-Vue

| Part | Why it stays |
|---|---|
| Page content from `generate.js` (compatibility tables, syntax blocks, overviews, homepage cards) | Must be in the static HTML: for crawlers, for readers without JavaScript, and for first paint. Vue custom elements render only in the browser; there's no server-side rendering for them. Moving this content means a Vue static-site generator (VitePress, Nuxt), a different architecture. |
| `THEME_SCRIPT` (inline, first in `<head>`, in `generate.js`) | Applies the saved theme before first paint. It has to run before any module loads, so it can't be Vue. Allowed by the CSP by hash. |
| `templates/compare.js` | Shows and hides the server-rendered rows and cards when `<db-filter>` changes. Those elements stay static (above), so Vue would only wrap the same loop; moving the loop into `DbFilter` would tie a reusable element to one page's selectors. |
| `templates/track.js` | A background page-view ping: no UI, no state, and it should run even if the Vue bundle fails to load. |
| `templates/header.html` | Static markup (logo, Buy Me a Coffee link). Its interactive parts are already the elements above. |
| `api/track.js`, `api/popular.js`, `api/csp-report.js` | Server code (Vercel edge functions), not front end. Replacing `track` and `popular` needs storage and is its own story. |
