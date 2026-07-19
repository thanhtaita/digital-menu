# ADR-002: Standardize local-dev API port references on 3002

**Status:** Accepted
**Date:** 2026-07-18 (documenting a prior fix; original change predates this ADR)

## Context

`apps/api/src/index.ts` falls back to `PORT=3001` when the `PORT` env var is unset. But
`apps/api/package.json`'s `dev` script hardcodes `PORT=3002` via `cross-env`, which always wins in actual
local dev - nobody runs `apps/api` any way other than through that `dev` script. Despite that, several
other places in the repo assumed the code's bare fallback (3001) was the real port: both frontends'
hardcoded fallback constants (`http://localhost:3001/...` in `api-client.ts`/`image-url.ts`/etc.) and
`.env.example`/`SETUP.md` all pointed at 3001. Following the setup docs literally, or running a frontend
without a `.env` override, silently pointed requests at the wrong port.

## Decision

Standardize every *consumer-facing* reference to the effective local-dev port (3002) - both frontends'
fallback defaults, `.env.example`, and `SETUP.md` - to match what the `dev` script actually runs, rather
than changing `apps/api/src/index.ts`'s own bare fallback. The code-level fallback intentionally stays at
3001 (a generic "no PORT set" default with no local-dev-specific assumption baked into the API itself);
the convention is that anything *referring to* the running local API from outside the process must use
3002, since that's what `cross-env PORT=3002` in the `dev` script actually binds.

## Consequences

- If the `dev` script's port is ever changed, `.env.example`, `SETUP.md`, and both frontends' hardcoded
  fallback defaults must be updated together in the same change - they are the four places this decision
  is encoded, and updating only one silently reintroduces the original bug.
- `apps/api/src/index.ts`'s own `PORT` fallback (3001) is not itself "wrong" and does not need to match
  3002 - it's a generic default, not a claim about what local dev uses.
- See [`docs/architecture/known-gaps.md`](../architecture/known-gaps.md) for where this was previously
  tracked as an unresolved gotcha before being promoted to this ADR.
