# ADR-001: Replace the flat `CLAUDE.md` convention with a structured `docs/` system

**Status:** Accepted
**Date:** 2026-07-18

## Context

Since the project's early history, `CLAUDE.md` was the single, canonical, always-loaded project-knowledge
file - one flat markdown document covering project goal, monorepo structure, system design, database
schema, reference data, a "Features implemented" section per app, and a "Known gaps / gotchas" list.
`AGENTS.md` and `.cursor/rules/global.md` mirrored its conventions for other agent tools. This replaced
an even earlier era of separate `PROGRESS.md` / `IMPLEMENTED_ROUTES.md` / per-app `FEATURES.md` files,
which had drifted out of sync with each other and with the code - `CLAUDE.md`'s original opening line
said as much: "there is no `PROGRESS.md`... don't reintroduce deleted docs."

That flat-file convention worked while the project was small, but two problems grew with it:

1. **No per-feature trail.** `CLAUDE.md`'s "Features implemented" section only ever holds the *current*
   state of each app - a terse, present-tense list. Once a feature landed and the paragraph was edited to
   describe the new state, the *why* (design tradeoffs, rejected alternatives, what the commit actually
   changed and when) was gone unless someone went spelunking through `git log`. There was no durable home
   for "how did we decide to do it this way" or "what shipped on which date."
2. **One file, unbounded growth.** Every new feature added more paragraphs to the same file that every
   agent session loads in full, every time, regardless of what that session is actually working on. The
   "Known gaps / gotchas" list in particular was accumulating items that were really standing decisions
   (e.g. the port-default mismatch, see ADR-002) with no separate place for the decision record itself.

## Decision

Replace the flat file with a structured `docs/` tree (see `docs/index.md` for the full layout):
`goals/<goal>/features/<feature>/{README,design,task-log}.md` for feature-level knowledge with a
mandatory append-only task log, `architecture/*.md` for birds-eye system docs (linking into
`.claude/skills/*/SKILL.md` for implementation depth rather than duplicating it), `decisions/ADR-NNN-*.md`
for durable tradeoffs, `operations/*.md` for real (not aspirational) deployment/monitoring/rollback state,
and `releases/YYYY-MM-DD.md` for what shipped on a given date. `CLAUDE.md` becomes a short orientation
page pointing into `docs/index.md`, keeping only agent-operating conventions (`Conventions & rules`) and
the skills index, which are out of scope for this restructure.

Critically, this is **not** a return to the old multi-file-drift problem the flat-file era was itself
trying to avoid. The old `PROGRESS.md`/`FEATURES.md`/`IMPLEMENTED_ROUTES.md` split failed because several
files could each claim to describe the same fact with no single owner, and nothing forced them to agree.
This structure instead gives **each fact exactly one canonical home** - a feature's current behavior lives
only in its `README.md`, its technical approach only in `design.md`, its history only in `task-log.md` -
and a generated rollup (`docs/TASKLOGGING.md`, via `scripts/gen-tasklog.mjs` / `pnpm docs:tasklog`)
aggregates the append-only logs into one chronological view without anyone hand-maintaining a second copy.
Drift is structurally prevented for the rollup (it's regenerated, never hand-edited) and reduced elsewhere
by narrowing each file's scope to one fact per home.

## Consequences

- Every future feature-level change must at minimum append a `task-log.md` entry (see the enforcement
  contract in `CLAUDE.md`, `AGENTS.md` §9, and `.cursor/rules/global.md`) - this is the new mandatory
  minimum that replaces "edit the Features implemented paragraph."
- `docs/TASKLOGGING.md` must never be hand-edited; it is regenerated from source `task-log.md` files.
- `CLAUDE.md` line 3's old instruction ("there is no PROGRESS.md/FEATURES.md, don't reintroduce deleted
  docs") is superseded by this ADR for the specific case of `docs/`. It still correctly warns against
  going back to *hand-maintained, multiple, un-synced* files describing the same fact - that constraint is
  preserved, just satisfied differently now (one owner per fact, one generated rollup) instead of by
  having no structure at all.
- Only 4 already-shipped features were backfilled into this structure at introduction time (see
  `docs/releases/2026-07-11.md` and `docs/releases/2026-07-12.md`); everything before that predates this
  system and was deliberately left undocumented rather than retroactively reconstructed in full.
