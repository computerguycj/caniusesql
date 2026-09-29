# Decisions

Append-only log of non-obvious choices. Newest on top. One entry per decision.

Format:
## YYYY-MM-DD — Short title
Chose: <what>
Rejected: <what and why>
Context: <optional — link to commit, file, or issue>

---

## 2026-09-29 - <copy-code>: wrap the static block, copy the host's text
Chose: `<copy-code>` wraps the generated `<div class="syntax">`, shows it through a `<slot>`, and copies `useHost().textContent` (the light DOM only, not the shadow root's button). One element per block.
Rejected: passing the SQL as an attribute (every example twice in the HTML); one page-level element that finds all blocks (brings back DOM querying, not the custom element model); moving the block into the shadow root (page CSS couldn't style it, and it leaves the static HTML crawlers read).
Context: src/elements/CopyCode.ce.vue. Each element is its own Vue app instance, up to 6 per command page; the runtime is already loaded, so there's no extra download.

## 2026-09-29 - Arrow keys in <command-search>: ARIA combobox with aria-activedescendant
Chose: focus stays in the input; Up/Down move a highlight tracked by aria-activedescendant; Up from the first result returns to none, Down stops on the last (no wrap); each result link carries role="option" inside an `<li role="none">`.
Rejected: moving real focus into the list (loses the typing position, worse screen reader support); wrap-around; role="option" on the `<li>` with a link inside (an option can't contain an interactive element).
Context: src/elements/CommandSearch.ce.vue. aria-activedescendant only resolves IDs in the same tree, so the input and options must stay in one shadow root. The highlight reuses the hover colors, which fail WCAG AA contrast (2.92:1 blue on light blue) in main already; that is stage 2 theming work.

## 2026-09-29 - Show copy buttons on touch screens with (hover: none)
Chose: `@media (hover: none) { .copy-btn { opacity: 1; } }`; hover-capable devices keep the reveal-on-hover button.
Rejected: a width breakpoint (a narrow desktop window has hover, a large tablet doesn't); always visible everywhere (changes the desktop look, out of scope).
Context: templates/styles.css. Chromium phone emulation matches (hover: none); a laptop with a touch screen and a mouse reports hover, so it keeps hover-to-reveal.

## 2026-09-29 - <command-search> switch-over: page keeps sizing, search.js keeps its name
Chose: page CSS sizes the element in the header (flex 1, 180-360px) and reserves 34px height via `command-search:not(:defined)`, the input height measured in Chromium; search.js keeps its filename with only the copy buttons left in it.
Rejected: sizing via `:host` (header layout is the page's concern, as with db-filter); renaming search.js to copy.js in this commit (touches generate.js and the script tag, and makes the one-commit revert noisier; do it as its own change).
Context: 34px holds at every width because the input never wraps. Re-measure if the input's padding, border, or font size changes.

## 2026-09-29 - <command-search>: data via `src`, no events out
Chose: `src` attribute (default /data.json?v=2), fetched once on mount; results are real `<a href>` links, so the element emits nothing.
Rejected: passing command data as an attribute (inlines all of data.json into every page); a `command-select` event (no page code would listen).
Context: `src` is the seam for stage 3, when the element switches to the API.

## 2026-09-29 - Document listeners from inside a shadow root: use composedPath()
Chose: outside-click and "/" shortcut read `event.composedPath()` (includes(root), and [0] for the real focused element).
Rejected: `event.target` / `contains()` and `document.activeElement` (both see only the host element, so clicks inside look outside and "/" typed in the box gets swallowed).
Context: src/elements/CommandSearch.ce.vue. The old shortcut in search.js has this exact bug once the input is in a shadow root, so it must be removed in the same commit that puts <command-search> on the page.

## 2026-09-29 - Reserve <db-filter> space with measured min-heights
Chose: `db-filter:not(:defined)` min-height 84px / 126px (<=572px) / 168px (<=356px), measured in Chromium at the label wrap points.
Rejected: static fallback checkboxes inside the element (duplicate markup; old checkboxes did nothing without JS anyway).
Context: heights depend on fonts. On an OS whose default font wraps the labels at a different width, expect up to one row (42px) of shift near the breakpoints. Re-measure if the filter's styles or labels change.

## 2026-09-29 - Vue custom element events: listen on the element
Chose: page code listens for `filter-change` on the <db-filter> element itself; payload stays a plain object of db id -> boolean in event.detail[0].
Rejected: listening on document (Vue CE events don't bubble); wrapping the payload (not needed while db ids can't be CustomEvent option names).
Context: Vue's CE emit does `new CustomEvent(name, { detail: args, ...args[0] })` when args[0] is a plain object, so its keys double as event options. A db id like `bubbles` or `detail` would break this.

## 2026-09-29 - Vite build: plain build with a JS entry, fixed filename
Chose: `vite build` with `rolldownOptions.input` = src/elements/main.js, output dist/assets/elements.js (no hash), run after generate.js via `npm run build`.
Rejected: library mode (leaves `process.env.NODE_ENV` unreplaced, so the Vue runtime needs a manual `define`; lib mode is for publishing packages, not page bundles); hashed filenames (needs generate.js to read a manifest; Vercel revalidates unhashed files, so fixed is safe for now).
Context: vite.config.mjs. emptyOutDir only clears dist/assets, never generate.js output.

## 2026-09-29 - Accept MPL-2.0 for lightningcss (build-time only)
Chose: accept lightningcss (MPL-2.0), a required dependency of Vite 8.
Rejected: Vite 7.3.x (all-permissive deps, but previous major with limited support); other bundlers (official Vue plugin targets Vite).
Context: MPL-2.0 is file-level weak copyleft; obligations apply only when distributing (modified) MPL files. lightningcss runs on the build machine only, none of its code ships in dist/, and we don't modify it.

## 2026-09-29 - Front-end dependencies and licenses
Chose: vue 3.5.x (MIT, runtime dependency); vite 8.x (MIT) and @vitejs/plugin-vue 6.x (MIT) as dev dependencies.
Context: transitive deps are MIT, Apache-2.0, BSD-2/3, ISC, plus lightningcss MPL-2.0 (see entry above). Re-check licenses when adding dependencies.

## 2026-09-29 - Build smoke test: node:test with regex over generated HTML
Chose: Node's built-in test runner; regex assertions over dist/ output; assert current canonicals as-is (including homepage no-www vs command pages www).
Rejected: jsdom or other DOM parser (adds a dependency; generator output is controlled, so regex is reliable enough); fixing the canonical mismatch here (out of scope; a later fix updates the test in the same commit).
Context: tests/build.test.js. Real DOM checks arrive with Playwright in stage 2.

## 2026-09-29 - Stop tracking dist/
Chose: gitignore dist/ and delete it; build output is regenerated by `node generate.js` locally and on Vercel.
Rejected: keeping dist/ committed (redundant with Vercel's build, and Vite's hashed filenames would add commit churn).

## 2026-09-29 - Tag pre-Vue baseline as v1.0.0
Chose: annotated git tag v1.0.0 on main (ab346b2) plus a GitHub Release, before Vue migration starts.
Rejected: release branches / changelog tooling (overhead for a solo static site); relying on Vercel Instant Rollback alone (hosting-only, no git or diff anchor).
Context: baseline for rollback, screenshot/SEO parity checks, and before/after comparison.

## 2026-04-29 - Require explicit workaround field
Chose: every `data.json` compatibility record includes a `workaround` field, using `null` when no workaround applies.
Rejected: omitting `workaround` unless needed, because that makes validation and UI rendering less consistent.
Context: follows the split between `supported`, `native`, and `workaround` compatibility semantics.

## 2026-04-29 - Split support semantics in data.json
Chose: model compatibility with separate `supported`, `native`, and `workaround` fields.
Rejected: using `supported` alone to mean both native support and workaround/equivalent support, because it hides important distinctions.
Context: `data.json` currently mixes native support with equivalents like SQL Server `OPENJSON` for `JSON_TABLE` and `CROSS APPLY` for `LATERAL`.

## 2026-04-17 - Started decision log
Chose: plain markdown over Beads (`bd`) CLI.
Rejected: Beads - overkill for current repo size; Gas Town ecosystem friction.
Context: Will migrate to Beads if dependency graphs between decisions start to
matter. Entries here translate directly to `bd create` calls.
