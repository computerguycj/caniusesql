# Decisions

Append-only log of non-obvious choices. Newest on top. One entry per decision.

Format:
## YYYY-MM-DD — Short title
Chose: <what>
Rejected: <what and why>
Context: <optional — link to commit, file, or issue>

---

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
