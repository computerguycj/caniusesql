# Decisions

Append-only log of non-obvious choices. Newest on top. One entry per decision.

Format:
## YYYY-MM-DD — Short title
Chose: <what>
Rejected: <what and why>
Context: <optional — link to commit, file, or issue>

---

## 2026-04-17 — Started decision log
Chose: plain markdown over Beads (`bd`) CLI.
Rejected: Beads — overkill for current repo size; Gas Town ecosystem friction.
Context: Will migrate to Beads if dependency graphs between decisions start to
matter. Entries here translate directly to `bd create` calls.