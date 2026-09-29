# Working in this repo

## Read on session start
- Read `DECISIONS.md` before making non-trivial changes. It's the decision log
  for this repo. If a proposed change contradicts or supersedes a prior
  decision, flag it explicitly instead of silently overriding.

## Prompt me to log decisions
When any of the following happen during our session, stop and ask if I want
to add an entry to `DECISIONS.md`:

- I pick one approach after considering alternatives ("let's use X instead of Y")
- I reject an approach that looked promising ("that won't work because...")
- We discover a non-obvious constraint or gotcha (library quirk, platform limit,
  config requirement)
- I change direction mid-task ("actually, scrap that, do it this way")
- A fix depends on something that isn't self-evident from the code

Do NOT prompt for:
- Routine implementation choices (variable names, file layout, obvious idioms)
- Bug fixes where the fix is self-explanatory
- Formatting, linting, or cosmetic changes

When prompting, propose a draft entry in the format used in DECISIONS.md and
ask me to approve, edit, or skip. Default to skip if I don't respond — don't
nag.

## Entry format
Append to the top of DECISIONS.md under a new `## YYYY-MM-DD — <short title>`
heading. Keep entries short: what was chosen, what was rejected, why. Link
commits or files when useful.

## Colors come only from tokens
- Every color value (hex, `rgb()`/`hsl()`-style functions, named colors like
  `white`) lives in `templates/tokens.css`. Everywhere else, including the
  `<style>` blocks in `src/elements/*.vue`, use `var(--…)`.
- Need a new color? Add a token to `tokens.css` (light value in `:root`, dark
  value in the dark block if it differs), then reference it.
- `npm run lint` enforces this with stylelint (`color-no-hex`, `color-named`,
  `function-disallowed-list`); `npm test` runs it first.
- Not covered by the linter: colors in JS strings or HTML/SVG attributes.
  Don't put colors there; give the element a class and style it in a
  stylesheet (see the logo classes for `header.html`). `favicon.svg` is the
  one exception: it's a standalone file and can't read page tokens.

## Vue rules
- Never use `v-html` with anything user-provided (query strings, form input,
  localStorage, API responses). Render text with `{{ }}` or `textContent`.
  Today nothing uses `v-html` at all; keep it that way unless there's a
  reviewed reason.
- Templates are precompiled by Vite (`.vue` files only). Don't import the
  full `vue` build or pass template strings at runtime: the runtime compiler
  needs `unsafe-eval` under a Content Security Policy.
