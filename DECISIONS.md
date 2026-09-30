# Decisions

Append-only log of non-obvious choices. Newest on top. One entry per decision.

Format:
## YYYY-MM-DD — Short title
Chose: <what>
Rejected: <what and why>
Context: <optional — link to commit, file, or issue>

---

## 2026-09-30 - Popular list e2e tests read the shadow root directly
Chose: tests/e2e/popular.spec.js stands in for `/api/popular` and the index with `page.route`, and reads the live links with `element.shadowRoot.querySelectorAll('a')` in `page.evaluate`. It checks: the live list replaces the build-time one in order; unknown slugs are dropped; a failing, empty or non-list `/api/popular` keeps the build-time list; search and the popular list make one index request (and one data.json request when the API fails); axe finds nothing in the live list in either theme.
Rejected: Playwright CSS locators for the live links. The build-time links share `class="example"`, Playwright's CSS reaches into shadow roots, so `popular-commands .example` matches both lists, and `:not(popular-commands > a)` matched nothing under Playwright's shadow-piercing engine.

## 2026-09-30 - <popular-commands> owns the badge styles; one !important for slotted links
Chose: the live links render in the element's shadow root, so the `.example` badge rules moved from styles.css into PopularCommands.ce.vue, applied to `.example` (live) and `::slotted(a)` (the build-time links). The slotted links' `color` is `!important`.
Rejected: `shadowRoot: false` so page CSS applies (Vue mounts into the element and replaces its children, so the build-time list would vanish until the fetch finishes); keeping a second copy of the badge rules in styles.css for the slotted links (two copies to drift).
Context: for slotted elements the page's own rules beat `::slotted()` whatever the specificity, because the cascade compares the page and the shadow root before specificity. The page's `a { color: var(--color-primary) }` therefore won over the badge color, failing contrast on the light theme. For `!important` declarations that order reverses, which is the mechanism CSS provides for this. axe caught it; the homepage screenshots passed, because the color change was within Playwright's per-pixel tolerance, so screenshots aren't proof that a style is unchanged.

## 2026-09-30 - Which parts move to Vue, and which stay
Chose: move `popular.js` (to reuse the 27 KB command index instead of the full data.json) and `splash.js` (a template instead of createElement code, and native `<dialog>` for its modal behaviour). Keep non-Vue: the page content generate.js builds, THEME_SCRIPT, compare.js, track.js, header.html, and the Vercel edge functions. Reasons per part are in docs/front-end.md.
Rejected: moving the static page content (custom elements render only in the browser, so crawlers, no-JS readers and first paint would lose it; doing it properly means a Vue SSG, a different architecture); moving compare.js's loop into DbFilter (ties a reusable element to one page's selectors); moving track.js (no UI or state, and it should run even if the Vue bundle fails).
Context: the splash's accessibility bug (claims modal, doesn't move focus or make the page inert) would also be fixed by a native `<dialog>` without Vue; the move is for the template and practice, not the fix.

## 2026-09-30 - Search e2e tests stand in for the API with page.route
Chose: tests/e2e/search-data.spec.js answers `/api/v2/command-index` with `page.route` (an index built from data.json, one description changed to show which source rendered) and checks: the API is used with no data.json request; a 500 and a request that never answers (the element's 5 s timeout) both fall back to data.json; a description holding an `<img onerror>` payload renders as text. It uses a command page, since the homepage also fetches data.json for its popular list.
Rejected: running the real API during e2e (a .NET process in the Playwright web server for four tests; the API has its own tests, and the element's contract is the JSON shape).
Context: `vite preview` answers `/api/v2/*` with its HTML page and status 200, so the rest of the e2e suite already runs the "200 that isn't the index" fallback. Gotcha: `import.meta.url` in a Playwright spec fails with "require is not defined in ES module scope" (Playwright's transform), so the spec reads data.json relative to the repo root, where Playwright runs.

## 2026-09-30 - Search loads the API index first, falls back to data.json
Chose: `<command-search>` gets its data from a composable, `useCommandIndex(src, fallbackSrc)` in src/elements/commandIndex.js, which wraps a plain `loadCommandIndex()` (fetch passed in, unit tested with node --test). It tries `/api/v2/command-index` with a 5 s timeout (`AbortSignal.timeout`), and on any failure (network error, non-2xx, not JSON, JSON that isn't an index of `{ slug }` objects, or the timeout) loads `/data.json?v=2`, which has the same fields and more. A fallback logs a console warning, not an error.
Rejected: API only (search would break while the API is undeployed, during an Azure outage, and under `vite preview`, which has no API); no timeout (a cold start after scale-to-zero would leave search inert for however long it takes); trusting any 200 (a misrouted request can return an HTML page with status 200).
Context: the 5 s is an estimate of the cold-start time, not a measurement; revisit once the API is live. Gotcha: in Node, `AbortSignal.timeout()`'s timer doesn't keep the event loop alive, so the timeout test's fake hanging request holds a timer of its own or Node cancels the test; browsers don't have this issue. Node's test summary counts those as "cancelled", not "fail".

## 2026-09-30 - Search gets a slim index endpoint
Chose: `GET /api/v2/command-index`, name -> `{ slug, description }` for every command in data.json order (27 KB, about 9 KB gzipped, against 546 KB / 121 KB for the full data). Built once when the catalog loads; same caching, ETag and rate limit as the other command endpoints. The search fetches it once and filters in the browser, as before.
Rejected: `GET /api/v2/commands` (no size win; moving to the API would only prove the connection); server-side search per keystroke (a network wait on every keystroke, a cold start on the first after idle, and visitors share a rate-limit bucket per Vercel edge server, so typing across many people could hit it); `/api/v2/commands/index` ("index" is a valid slug, so it would collide with `{slug}`).

## 2026-09-30 - API image on GHCR is public
Chose: make the ghcr.io/computerguycj/caniusesql-api package public, so Container Apps pulls it without credentials. No secrets go in the image; runtime settings (trusted proxy range, limits) come from Container Apps environment variables.
Rejected: a private package with a classic PAT (`read:packages`) as a Container Apps registry secret (GHCR doesn't accept fine-grained tokens; a classic one covers every package on the account, and when it expires the next scale-from-zero fails to pull, taking the API down); Azure Container Registry with a managed identity (no stored secret, but about $5/month for Basic, against the $0 target).
Context: the repo is public (MIT) and the image holds only its code and the data.json the site already serves, so a public image reveals nothing new. The package first exists after the first push to main; its visibility is set on its GitHub settings page.

## 2026-09-30 - API CI/CD: GitHub Actions, GHCR, OIDC sign-in, deploy by digest
Chose: .github/workflows/api.yml runs on changes to server/, data.json or itself. `test` runs `dotnet test`; `image` builds server/Dockerfile (pull requests build only; main pushes to `ghcr.io/computerguycj/caniusesql-api` with the workflow's own token, tags `sha-<short>` and `latest`); `deploy` runs `az containerapp update --image <image>@<digest>` in a `production` environment, signed in to Azure with OpenID Connect. Deploy is skipped until the repository variable `AZURE_CONTAINER_APP` exists (chunk 5).
Rejected: deploying a tag (`latest` doesn't change string between builds, so Container Apps may not roll a new revision, and a tag can be moved; a digest can't); an Azure service principal secret in GitHub secrets (OIDC stores nothing that can leak; Azure trusts tokens for this repo's `production` environment only); Azure Container Registry (about $5/month for Basic; GHCR is free).
Context: actions are pinned to major version tags, not commit SHAs, because this session can't read other repositories to look up SHAs; pinning to SHAs is the stricter option and can be done later. Licenses (CI tooling, not shipped): actions/checkout and actions/setup-dotnet MIT, docker/setup-buildx-action, login-action, metadata-action and build-push-action Apache-2.0, azure/login MIT. The workflow has not run yet; its first run is on the PR.

## 2026-09-30 - API container: chiseled .NET 10 image, non-root, allowlisted build context
Chose: a two-stage server/Dockerfile: `mcr.microsoft.com/dotnet/sdk:10.0` publishes, `mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled` runs it as the built-in non-root `app` user (UID 1654) on port 8080. Built from the repo root so the image gets data.json; .dockerignore excludes everything except data.json and the API project. `InvariantGlobalization` on, since the chiseled image has no ICU.
Rejected: the regular `aspnet:10.0` image (has a shell and apt, both unneeded and more to patch); Alpine (musl, and no advantage here over chiseled); a self-contained or Native AOT build (controllers and reflection-based System.Text.Json don't fully support trimming or AOT); `-extra` chiseled with ICU (nothing is culture-specific).
Context: this session can't pull from mcr.microsoft.com, so the image was never built here; the same restore/publish was run from a copy of just the allowlisted files and served /api/v2/health and /api/v2/commands. The first real image build is in GitHub Actions. Microsoft's .NET images: .NET itself is MIT; the Ubuntu packages in them carry their own licenses.

## 2026-09-30 - Rate limit per rightmost X-Forwarded-For entry, from trusted proxies only
Chose: a fixed window per client IP (300 per 60 s, from config) on the command endpoints (`[EnableRateLimiting]`; health is exempt), 429 problem+json with Retry-After. The client IP comes from `UseForwardedHeaders` with `ForwardLimit = 1`, and only on connections from `ForwardedHeaders:TrustedNetworks` (the Container Apps ingress range, set in chunk 5; empty means trust nobody). So the key is the entry the ingress itself wrote, which can't be spoofed.
Rejected: the leftmost entry (what most examples use; the caller writes it, so a fresh fake IP per request skips the limit); Vercel's client IP plus a shared-secret header proving the request came through Vercel (true per-visitor limits, but a `vercel.json` rewrite can't add request headers, so it needs Routing Middleware on every API call; can be added later without undoing this); trusting any peer (anyone reaching the app directly could pick their own IP).
Context: through Vercel the rightmost entry is a Vercel edge server shared by many visitors, so this is a per-edge ceiling, hence the high limit; the one-hour caching means real visitors send few requests, and Vercel's own DDoS protection sits in front. The exact header format behind Vercel and Container Apps is an inference until checked on the preview in chunk 5. `KnownNetworks` is obsolete in .NET 10; it's `KnownIPNetworks`.

## 2026-09-30 - HTTP caching: one weak ETag for the data version, successes only
Chose: an action filter (`CatalogCacheFilter`, applied with `[ServiceFilter]` so DI supplies the catalog) adds `Cache-Control: public, max-age=3600` and `ETag: W/"<SHA-256 of data.json>"` to 200s, and turns a matching `If-None-Match` (weak comparison, `*` included) into a 304 with no body. 400s and 404s get neither header; health is `no-store`.
Rejected: a hash per response body (every response is derived from data.json alone, so the file's hash already changes exactly when any response does, and nothing is serialized twice); a strong ETag (the proxies in front may compress the body, and a strong ETag promises identical bytes); `[ResponseCache]` for the commands (it sets its headers before the action runs, so 404s would be cached too); ASP.NET Core's output caching middleware (caches on the server; the goal here is fewer requests from browsers).

## 2026-09-30 - API JSON: explicit options, HTML-sensitive characters escaped
Chose: `AddJsonOptions` sets camelCase property names, no dictionary key policy (command names stay as written), and `JavaScriptEncoder.Default`, so `<`, `>` and `&` go out as `\u003C` etc. A test checks that JOIN's description has no raw `<`.
Rejected: MVC's default. With no encoder set, ASP.NET Core's JSON output formatter uses `UnsafeRelaxedJsonEscaping`, which writes `<a href=…>` from data.json raw. That's valid JSON and harmless as `application/json` with nosniff, but escaping makes it inert if anything ever treats it as HTML, and costs nothing: parsed values are identical.
Context: found by curling the running API, not from the docs. server/src/CanIUseSql.Api/Program.cs.

## 2026-09-30 - Malformed slug is a 400 from model validation, not a route constraint
Chose: `{slug}` with `[RegularExpression(SlugPattern)]` and `[StringLength(64)]` on the parameter; `[ApiController]` turns a failure into a 400 ValidationProblemDetails before the action runs. Well-formed but unknown slugs are a 404 ProblemDetails. `AddProblemDetails` plus `UseStatusCodePages` make unmatched routes `application/problem+json` too.
Rejected: a regex route constraint (`{slug:regex(...)}`). A failing constraint means "this route doesn't match", so the request falls through to a 404, not a 400. Constraints are for choosing between routes, not validating input. Also rejected: `[Produces("application/json")]`, which forced that content type onto error responses and replaced `application/problem+json`.

## 2026-09-30 - Catalog loads strictly; API always writes optional keys
Chose: `CommandCatalog` deserializes data.json into records with `UnmappedMemberHandling.Disallow`, `RespectNullableAnnotations` and `RespectRequiredConstructorParameters`, keeps data.json order (`OrderedDictionary`), and checks slugs are unique and match the site's pattern. It's resolved right after `Build()`, so bad data stops startup. A dialect's `since`/`syntax` is either missing or null in data.json (107 and 32 missing); both load as null and the API always writes the key. The parity test treats a missing key and null as equal and checks the name order.
Rejected: lenient loading (an unknown field would silently vanish from the API); omitting nulls on output (data.json also has explicit nulls, so neither choice reproduces the file byte for byte); `Dictionary` for the command map (its order isn't guaranteed, and the search lists results in data.json order).
Context: server/src/CanIUseSql.Api/Catalog/. data.json is linked into the API project and copied next to the binaries; `Catalog:Path` overrides the location.

## 2026-09-30 - .NET tests run on Microsoft.Testing.Platform, xUnit v3
Chose: xUnit v3 (`xunit.v3` 4.0.1, Apache-2.0) with `Microsoft.AspNetCore.Mvc.Testing` 10.0.12 (MIT) for in-memory HTTP tests through `WebApplicationFactory<Program>`. `server/global.json` opts `dotnet test` into Microsoft.Testing.Platform; xUnit v3 test projects are executables that host the platform themselves, so there is no `Microsoft.NET.Test.Sdk` or `xunit.runner.visualstudio`.
Rejected: VSTest (the .NET 10 SDK refuses to run an MTP-based project through the VSTest `dotnet test` path: "Testing with VSTest target is no longer supported"); NUnit/MSTest (xUnit is the ASP.NET Core docs' default); coverlet (no coverage target yet, one less dependency).
Context: server/global.json only sets the test runner, it does not pin an SDK version.

## 2026-09-30 - data.json stays the source of truth; the API serves a copy
Chose: the API loads the same data.json the static pages are built from, once at startup, and a parity test fails if `GET /api/v2/commands` differs from the file.
Rejected: a database as the source (a second copy to keep in sync, and hosting cost); making the static build read from the API (the site would depend on a scale-to-zero container at build time).

## 2026-09-30 - ASP.NET Core controllers, not minimal APIs
Chose: `[ApiController]` classes with attribute routing under `/api/v2`, registered with `AddControllers()` / `MapControllers()`.
Rejected: minimal APIs (less code for a read-only API this size, but the point of stage 3 is practice configuring controllers: filters, model binding, route constraints, ProblemDetails).
Context: server/src/CanIUseSql.Api.

## 2026-09-30 - Host the .NET API on Azure Container Apps
Chose: .NET 10 LTS (supported to Nov 2028) in a container on Azure Container Apps, consumption plan, scale to zero, image on GHCR. Vercel rewrites `/api/v2/*` to it, so browsers see the site's own origin (no CORS, no new `connect-src` origin). A $5 budget alert on the subscription.
Rejected: App Service F1 (60 CPU-minutes a day, no always-on) and B1 (about $13/month); Google Cloud Run (similar, but the interview is .NET and Azure); Render (free tier sleeps with a slow cold start and less control); moving the whole site off Vercel (no reason to, and it breaks the existing edge functions). Vercel itself has no .NET runtime.
Context: expected cost $0/month inside the free grant (180k vCPU-seconds, 360k GiB-seconds, 2M requests). Cold starts after idle are the tradeoff for scale to zero. `server/` is in .vercelignore so the .NET code isn't uploaded to Vercel.

## 2026-09-30 - Tag end of stage 2 as v2.0.0
Chose: annotated tag v2.0.0 on main (ee5dad1) plus a GitHub Release, marking stages 1 and 2 (Vue custom elements, themes, enforced CSP).
Rejected: v1.x (a build step, a new header, and a CSP that now blocks what it used to allow are breaking changes for a website); tagging stage 1 separately (not requested; c6a27f5 can still be tagged later).
Context: the Claude Code session's git access can push its working branch but not tags (HTTP 403 on the tag push), so the tag is created from a local clone or the GitHub Releases page.

## 2026-09-30 - Enforce the Content Security Policy
Chose: switch the header from `Content-Security-Policy-Report-Only` to `Content-Security-Policy` (one constant in scripts/csp.mjs); same directives and hashes, still reporting to /api/csp-report. csp.spec.js now also proves enforcement: an injected inline script doesn't run, an injected `<style>` doesn't apply, a script from another origin doesn't load, and each fires a violation.
Rejected: waiting longer in report-only (the user chose to enforce now; production reports had not been reviewed from this session, which has no Vercel access).
Context: the policy blocked the no-flash tests' own frame decoding (they loaded screencast PNGs as data: images inside the page, and img-src doesn't allow data:); frames are now decoded in a separate blank page (framePixels in tests/e2e/helpers.js). Vercel's preview toolbar script (vercel.live) is now blocked on preview deployments; production doesn't load it.

## 2026-09-29 - Custom mode tests: extreme themes, dialog, tampering; checker covers every text on a derived tint
Chose: tests/e2e/custom.spec.js covers the three extreme accents that still pass (#000000 on Light, #ffffff on Dark, #ff00ff on Dark) with full-page screenshots plus axe WCAG 2.2 AA, the focus walk, and target size; the dialog (axe, 24px controls, Tab never reaching the page behind it, the failing-pick flow, Escape returning focus); a tampered localStorage (head script ignores CSS injection, a non --color-* name, a bad base; the picker recomputes tokens and falls back to System on a failing accent); and the no-flash screencast for a saved Custom theme. The focus walk and target-size check moved into tests/e2e/helpers.js so both specs share them. Dialog radios went from 20px to 24px.
Rejected: checking only accent-colored text (the black-accent test found muted search-result descriptions on the search-highlight tint at 4.44:1).
Context: the checker now also tests muted text on the search highlight and badge text on the hovered badge (`.example:hover`), and the search-highlight tint dropped from 6% to 4% of the accent, which keeps muted text at 4.64:1 or better on all three extremes. A modal dialog doesn't stop Tab from leaving to the browser's own UI (per spec), so the test only forbids focus landing on page content behind it.

## 2026-09-29 - Custom mode UI: native dialog, tokens set on <html> with setProperty
Chose: "Custom…" in the picker's select opens a native `<dialog>` with `showModal()` (base radios, `<input type="color">`, an in-dialog preview, the failing pairs with ratios, a "Use #xxxxxx instead" suggestion, Apply disabled until every pair passes). An "Edit" button (screen readers hear "Edit custom colors") appears while Custom is active, because re-selecting the same option fires no change event. Apply sets `data-theme` to the base, a `data-custom` marker, and the derived tokens as inline custom properties on `<html>` via `style.setProperty`; inline properties beat every stylesheet and layer, so tokens.css has no Custom rules. localStorage keeps `{ base, accent, tokens }`; the head script applies the stored tokens before first paint only if every name is `--color-*` and every value `#rrggbb(aa)` (all or nothing); on mount the picker recomputes the tokens from base + accent and falls back to System if they no longer pass. Base colors are read from tokens.css by resolving `var(--…)` on a hidden probe with the chosen `color-scheme`; new fixed tokens `--ink-light` / `--ink-dark` and a themed `--color-backdrop`.
Rejected: previewing on the whole page while the dialog is open (clean revert on Cancel is more risk than it's worth); `<form method="dialog">` (the CSP has `form-action 'none'`; plain buttons avoid depending on how browsers treat that); per-token validation in the head script (a partly applied theme can break contrast); trusting the stored tokens after load.
Context: `style.setProperty` and Vue `:style` bindings go through the CSSOM, which the CSP doesn't restrict; the CSP test sees zero violations. The select grew from 85px to 101px (it's as wide as "Custom…"), so the size reservations were re-measured, plus a wider one for `:root[data-custom]` (the head script sets it before first paint); the header now wraps to three rows below 324px. The dialog returns focus to its opener (select or Edit) on Apply, Cancel, and Escape.

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
