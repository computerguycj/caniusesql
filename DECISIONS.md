# Decisions

Append-only log of non-obvious choices. Newest on top. One entry per decision.

Format:
## YYYY-MM-DD — Short title
Chose: <what>
Rejected: <what and why>
Context: <optional — link to commit, file, or issue>

---

## 2026-09-29 - Custom mode math: one accent drives nine tokens, checked pair by pair
Chose: src/elements/customTheme.js (pure functions, unit tested) derives the accent-driven tokens from one accent and the base palette: accent; a "stronger" shade 15% toward the base's text color for hover and badge text; text-on-accent is whichever of two inks (light or dark, read from tokens) contrasts more; the focus ring is the accent at 20% alpha; badge and search-highlight tints are 6-14% of the accent over the surface; the badge border 35%. It checks eight pairs (4.5:1 for text, 3:1 for the focus ring) and suggests the nearest passing accent by moving HSL lightness only, same hue and saturation, whichever direction is closer.
Rejected: badge text = accent on a 12% tint (the shipped Light accent failed at 4.28:1; the shipped theme already used a darker badge text); mixing in OKLab (better-looking tints, but more code, and the checks are on the final sRGB values either way); letting the user pick text-on-accent (one more way to fail).
Context: some mid-lightness accents fail with both inks on them: around relative luminance 0.19, neither white nor near-black text reaches 4.5:1 (e.g. #7a7a7a), so no ink choice can save them; the suggestion moves them out of that band. Node prints a MODULE_TYPELESS_PACKAGE_JSON warning when tests import these ESM .js files, because package.json has no "type"; adding "type": "module" would break the CommonJS build test, so the warning stays for now.

## 2026-09-29 - Search collapses to a button on narrow headers
Chose: below a 720px header (container query; the same breakpoint as the theme picker's label), <command-search> is a 34px button with `aria-expanded`. Tap, Enter/Space, or "/" shows the input absolutely positioned over the header's first row (offsets match the header padding) and focuses it; Escape clears, collapses, and returns focus to the button; clicking outside or tabbing away collapses and keeps the text. On narrow headers the title gets `flex-basis: calc(100% - 96px)` (row minus logo, button, and two gaps) so the theme picker and Buy Me a Coffee wrap to the second row. scroll-padding-top re-measured across all 149 pages: header wraps at 308px and 792px.
Rejected: hiding the title on narrow screens (on command pages the header <h1> is the only place the command name appears); search on its own full-width row (about 45px more sticky header on phones); growing the header while search is open (moves the page).
Context: before, command titles were cut from 316px up to 728px (MERGE) or 940px (JSON_TABLE) and the homepage title was overlapped. Now MERGE fits from 332px and JSON_TABLE from 420px; between 792px and 940px the wide layout still truncates JSON_TABLE with an ellipsis, as it did before. Wide headers are pixel-identical to before.

## 2026-09-29 - Non-Vue inventory (started; stage 3 finishes it)
Every part of the front end that isn't Vue, and why. "Not done yet" means exactly that; it isn't intentional until it has a real reason.
- No-flash theme script (inline, `THEME_SCRIPT` in generate.js): intentional. It must run before first paint; the Vue bundle is a deferred module and loads too late.
- Page content from generate.js (headings, compatibility table, cards, syntax text): intentional. Static HTML for SEO and first paint; Vue elements wrap or sit beside it.
- compare.js (hides rows and cards on `filter-change`): not done yet.
- splash.js (first-visit intro overlay): not done yet.
- popular.js (fills "Popular commands" from /api/popular): not done yet.
- track.js (page-view ping to /api/track): not done yet; may stay plain JS (no UI).
- api/*.js edge functions: not front end; replaced by the ASP.NET Core API in stage 3.

## 2026-09-29 - Theme picker switch-over: no-flash inline script, header as container
Chose: `<theme-picker>` in the header after the search box; a one-line inline script (`THEME_SCRIPT` in generate.js) first in `<head>`, before any stylesheet, sets `data-theme` from localStorage; the CSP allows it by SHA-256 hash via `npm run csp:update`. `.site-header` gets `container-type: inline-size` so the picker's label can appear through a container query. `theme-picker:not(:defined)` reserves 85x32px, or 134.6x32px when the header is at least 720px wide (measured; no shift at 1280, 700, 375, 310px). scroll-padding-top re-measured: the header now wraps at 308, 314 and 566px.
Rejected: applying the saved theme from the Vue element only (paints the OS theme first; the screencast test fails without the head script); a `defer` or external script (runs after first paint); `'unsafe-inline'` for the script.
Context: the no-flash test records every frame Chromium paints while loading /f/merge/ with a saved theme opposite the OS, and checks the page background in each. It ignores frames from before the navigation, because the screencast can hand over a stale frame of the previous page first (seen once, then confirmed by separating before/after frames).

## 2026-09-29 - <theme-picker>: native select, owns the theme side effect, container query on the header
Chose: a native `<select>` (System/Light/Dark) wrapped in its `<label>` (no id needed). The element owns the site theme: it sets or removes `data-theme` on `<html>`, saves the choice in localStorage (`caniusesql_theme`; System removes the key), follows other tabs through the `storage` event, and emits `theme-change` (detail[0] is the choice). Mobile-first: the "Theme" text is screen-reader-only by default and a container query (`@container (min-width: 720px)`) shows it when the header, the container, has room.
Rejected: three toggle buttons (wider on phones, and needs ARIA to act as one group); a `<dialog>` (not a modal control); emitting only and letting page code apply the theme (a second script owning the same state); `container-type` on the element's own host (inline-size containment makes a flex item's content width 0, so it would collapse; the header is the natural container).
Context: container queries resolve through the flat tree, so the shadow-root styles can query the light-DOM header; verified label shown at 1280px, hidden at 375px. The header gets `container-type: inline-size` in the switch-over commit.

## 2026-09-29 - Tokens use light-dark(); themes switch through color-scheme; tokens in @layer theme
Chose: every themed token is written once as `light-dark(<light>, <dark>)`; `:root` gets `color-scheme: light dark` (System), and `data-theme="light"` / `"dark"` on `<html>` sets `color-scheme` to one value. Shadows wrap light-dark() around the color inside the shadow, since box-shadow isn't a color. Browsers without light-dark() get the light values from an `@supports not` block (Light only); tests/build.test.js keeps that block equal to the light values. tokens.css declares `@layer base, components, theme;` and puts everything in `theme`; styles.css stays unlayered.
Rejected: separate dark blocks (dark values written twice: once for the OS preference, once for the data-theme override); resolving System to light/dark in JS (no dark mode without JS).
Context: one property drives the tokens, native controls, and scrollbars, and color-scheme is inherited into the custom elements' shadow roots, so they needed no change. Verified: light OS + data-theme="dark" renders pixel-identical to a dark OS, and the reverse, on / and /f/merge/. Layer order: later layers beat earlier ones, unlayered styles beat all layers, and for !important declarations the order flips (earlier layers win, and layered !important beats unlayered !important). light-dark() needs Chrome 123+, Firefox 120+, Safari 17.5+.

## 2026-09-29 - Content Security Policy, report-only, inline styles allowed by hash
Chose: a site-wide `Content-Security-Policy-Report-Only` header in vercel.json, generated by scripts/csp.mjs (`npm run csp:update`). Allowances and why: `default-src 'self'`; `script-src 'self'` (all scripts are same-origin files); `style-src 'self'` plus one SHA-256 hash per Vue component style (Vue injects each component's CSS as a `<style>` in its shadow root); `img-src 'self' https://cdn.buymeacoffee.com` (the only third-party resource, the Buy Me a Coffee button image; no third-party scripts exist); `connect-src 'self'` (data.json and /api/*); `object-src 'none'`, `base-uri 'self'`, `form-action 'none'` (no forms), `frame-ancestors 'none'`. Violations go to /api/csp-report (edge function, one log line per report, nothing stored). The browser tests serve the same header through `vite preview` and fail on any violation.
Rejected: `style-src 'unsafe-inline'` (weaker; allows injected CSS); nonces (need a fresh value per response, which a static site can't give without edge middleware); hashing CSS at build time inside Vite (the browser's view of each `<style>` is the ground truth, so the script hashes what Chromium actually sees); a third-party report collector (another origin in the policy and user data sent off-site).
Context: splash.js's injected `<style>` and the logo's style attributes moved into styles.css first (cb073ee) so they need no allowance. Hashes change whenever a component's `<style>` changes; the CSP test catches a stale list (verified by moving the copy button 1px). Vercel runtime logs on the Hobby plan are kept briefly, so read reports soon after a deploy. Vercel's preview toolbar injects a vercel.live script on preview URLs only, so expect script-src reports from previews, not production. Enforcing comes after the theme picker and Custom mode land.

## 2026-09-29 - WCAG 2.2 AA: scroll-padding for the sticky header, focus and target-size tests
Chose: target WCAG 2.2 AA (axe tags add `wcag22aa`). `html { scroll-padding-top }` of header height + 16px, mobile-first: 188px base (header wraps to 3 rows below 314px), 138px from 314px, 86px from 466px; breakpoints measured where the header actually wraps across all 149 pages. New focus.spec.js tabs forward then backward through each page and checks every stop has a visible indicator (2px+ outline or the browser's own ring), author outlines at 3:1 against background and surface, and nothing drawn on top of it; plus every control at least 24x24px except links inside text.
Rejected: a single scroll-padding value (188px would leave a big gap on desktop); measuring the header with JS at runtime (one more script for a static number); checking "is it below the header's bottom edge" (flags the skip link, which sits over the header on purpose; `elementFromPoint` checks what is actually on top).
Context: without scroll-padding, all 8 focus runs fail (homepage cards land under the header when tabbing backwards). Header heights depend on fonts, like the <db-filter> reservation; re-measure if the header's content changes. The screen reader pass (NVDA or VoiceOver) can't run here and still needs a person.

## 2026-09-29 - Page listens for element events on document, capture phase (supersedes "listen on the element")
Chose: compare.js listens for `filter-change` with `document.addEventListener(..., true)`. Vue CE events don't bubble, but capture runs from document down to the target for every event, so the listener sees it without the component changing.
Rejected: a listener on the element (lost if the element is ever replaced; verified: after swapping in a fresh <db-filter>, the old listener no longer hid rows); making the component dispatch bubbling, composed events itself (changes the component for a page concern).
Context: supersedes the 2026-09-29 "Vue custom element events: listen on the element" entry. Nothing on the site re-renders today (no pushState routing, no DOM replacement; checked), so this is insurance for stage 3. Same idea as jQuery `.on()` delegation surviving an UpdatePanel partial postback.

## 2026-09-29 - What state lives outside the components
Chose: the DB filter selection stays in localStorage (already the case), so a remounted <db-filter> restores it. The search box's typed text stays inside <command-search> and is lost on remount.
Rejected: persisting the search text (it's transient; restoring a half-typed query after a re-render would surprise more than help).
Context: verified by replacing both elements in the live page: the filter came back with the saved selection, the search box came back empty. No inputs sit in a <form> (none exist), so shadow DOM inputs not submitting with a form doesn't apply.

## 2026-09-29 - Copy button always visible, 24px tall (supersedes hover-to-reveal)
Chose: the copy button is always visible, `min-height: 24px`.
Rejected: reveal on hover or focus (a hover-only control is invisible to anyone who doesn't hover there; the addendum rules it out); 23px (below the WCAG 2.2 AA target size).
Context: supersedes the hover reveal kept in the <copy-code> entries and makes the "(hover: none)" entry moot. CLAUDE.md now also states the v-html and precompiled-templates rules.

## 2026-09-29 - Light and Dark palettes fixed to pass WCAG AA
Chose: nearest passing shade of the same hue and saturation (HSL lightness only), with a 4.6:1 target for a small margin over 4.5. Light: accent #3498db -> #1f74ae (hover #226a9a, badge text #2472a4), muted #7f8c8d -> #657171, success #27ae60 -> #1c7c44, warning #d97706 -> #a75c05. Dark: text on the accent is now dark (#0d1117) instead of white; status colors get dark values (danger #df6065, neutral #8a8a8a, warning text #a88423, success-strong #289d56) and the version badges get dark tinted backgrounds instead of light pastels. New --color-control-border (light #8191a2, dark #5c6775) for the search input so it has a 3:1 boundary; other borders stay decorative. Splash dismiss text #7f8c8d -> #849192.
Rejected: darkening Dark's accent for white header text (the accent is also Dark's link color and would lose contrast there); a sitewide darker --color-border (table and card lines are decorative and would all get heavier).
Context: axe finds no contrast violations on all 149 pages or the splash, in light and dark. The a11y tests no longer carry test.fail() markers. Screenshot baselines were re-recorded.

## 2026-09-29 - Browser tests: Playwright + axe, Linux baselines, known contrast failures marked
Chose: @playwright/test pinned to 1.56.1 (matches the Chromium build in the dev container, so no browser download); `vite preview --outDir dist` as the test server (no new server dependency); screenshots of / (one screen tall) and /f/merge/ (full length), light and dark, 1280 and 375px, with animations disabled and the intro splash suppressed by its cookie; axe scans (WCAG 2.1 A/AA) with the search list open. Today's contrast failures are a separate `test.fail()` test per page and scheme, so the palette fix must remove the marker. `npm run test:e2e`, not part of `npm test` (needs a browser).
Rejected: latest Playwright 1.63 (would need a browser download here); full-length homepage (148 near-identical cards, about 1.5 MB per PNG, 5.6 MB per baseline set); excluding color-contrast from the scan (hides the failures instead of tracking them).
Context: baselines are Linux + Chromium renders (`-linux.png`); fonts render differently on macOS, so compare in Linux. Disabling animations also removed the intermittent 375px screenshot difference seen in stage 1 (inference: a transition was mid-flight).

## 2026-09-29 - Accept MPL-2.0 for axe-core and @axe-core/playwright (test-only)
Chose: accept axe-core and @axe-core/playwright 4.x (MPL-2.0) as dev dependencies for the accessibility scans.
Rejected: no automated scan (manual checklist only); Lighthouse (runs axe-core internally anyway); pa11y (LGPL-3.0).
Context: same reasoning as lightningcss. They run only in the test run, none of their code ships in dist/, and we don't modify them. @playwright/test is Apache-2.0.

## 2026-09-29 - Color tokens in their own file, enforced by stylelint
Chose: templates/tokens.css holds every color value (light in `:root`, dark in the `prefers-color-scheme` block) and is linked before styles.css; stylelint runs `color-no-hex`, `color-named: never`, and `function-disallowed-list` (rgb/hsl/etc.) on all other CSS and `.vue` style blocks, as part of `npm test`.
Rejected: tokens at the top of styles.css with stylelint-disable comments (easy to widen by accident); `color-no-hex` alone (`white` and `rgba()` would slip through).
Context: new dev dependencies stylelint 17.x (MIT) and postcss-html 2.x (MIT, parses `.vue` style blocks); new transitive licenses are MIT/ISC/BSD plus argparse (Python-2.0, permissive). The linter can't see colors in JS strings or SVG attributes, so splash.js and the header logo use `var()` by hand; favicon.svg keeps its hex (standalone file, can't read page tokens). Splash and logo colors are tokens but fixed across themes on purpose.

## 2026-09-29 - Delete search.js (supersedes "search.js keeps its name")
Chose: delete templates/search.js, its script tag, and its copy step now that <copy-code> owns the copy buttons; `copy-code:not(:defined) { display: block; }` so the wrapper is a block before and after Vue renders.
Rejected: renaming it to copy.js (nothing left to put in it).
Context: supersedes the 2026-09-29 "<command-search> switch-over" entry's plan to rename search.js later. generate.js never clears dist/, so local builds keep a stale dist/search.js; Vercel builds from a clean checkout, and no page references it.

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
