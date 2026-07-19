# Digital Menu — Setup & Reset

How to set up the monorepo from scratch and how to reset the database and apps when needed.

---

## Prerequisites

- **Node.js** 18+ (22 recommended)
- **pnpm** 9+ (`npm install -g pnpm`)
- **PostgreSQL** (listening on port **5433** in these instructions; adjust if yours differs)
- Database **`digital_menu`** and user **`postgres`** (password **123456** in examples)

Create the database if it doesn’t exist:

```bash
# Example (adjust user/host/port for your setup)
psql -U postgres -h localhost -p 5433 -c "CREATE DATABASE digital_menu;"
```

---

## First-time setup

Run from the **repository root** (`digital-menu/`).

### 1. Install dependencies

```bash
pnpm install
```

### 2. Environment

Copy the example env and edit if needed (e.g. password, port):

```bash
cp .env.example .env
```

Default in `.env.example`:

- `DATABASE_URL=postgres://postgres:123456@localhost:5433/digital_menu`
- `PORT=3002` (matches the `cross-env PORT=3002` override baked into `apps/api`'s `dev` script - see `apps/api/package.json`)

### 3. Git hooks

Run once after cloning to activate the repo's git hooks (currently: a `commit-msg` check that flags
`apps/`/`packages/` changes with no corresponding `docs/` update - see `CLAUDE.md`'s "which doc to touch"
contract):

```bash
bash scripts/setup-hooks.sh
```

### 4. Database: schema changes and migrate

**Adding tables/columns** (agents and humans): edit `packages/db/src/schema/schema.ts`, then generate — do not hand-write SQL in `packages/db/drizzle/`:

```bash
pnpm --filter @digital-menu/db drizzle:generate
pnpm --filter @digital-menu/db drizzle:migrate
```

**Applying existing migrations** (e.g. after `git pull`):

```bash
pnpm --filter @digital-menu/db drizzle:migrate
```

After migrate, confirm new tables exist. If migrate says success but tables are missing, a prior migration may be stuck — see **Reset** below or `CLAUDE.md` §7.

### 5. Seed test data (optional)

Load ingredients + aliases into `ingredients` and `ingredient_aliases`, then seed demo restaurants and menus:

```bash
pnpm --filter @digital-menu/seed seed
pnpm --filter @digital-menu/seed seed:menus
```

Run **`seed` first** — `seed:menus` links dishes to ingredient slugs and will fail if the dictionary is empty.

Both scripts build `@digital-menu/db` before running. Safe to re-run (idempotent).

**Ingredients** (`seed`): loads the test ingredient dictionary from [`packages/seed/src/seed-test-data.ts`](packages/seed/src/seed-test-data.ts) (allergens, staples, and Polar Palate menu ingredients).

**Menus** (`seed:menus`): loads:

- [`packages/seed/data/menu-seed.json`](packages/seed/data/menu-seed.json) — **Bella Cucina** (`bella-cucina`, owner `chef@bella-cucina.test` / `changeme123`)
- [`packages/seed/data/ai-test-menu-seed.json`](packages/seed/data/ai-test-menu-seed.json) — **Polar Palate** (`polar-palate`, owner `chef@polar-palate.test` / `changeme123`) — 15 polarizing dishes for AI recommendation QA

After seeding menus, verify:

- `GET http://localhost:3002/api/v1/public/restaurants`
- `GET http://localhost:3002/api/v1/public/restaurants/bella-cucina/menu`
- `GET http://localhost:3002/api/v1/public/restaurants/polar-palate/menu`
- Diner chat: `http://localhost:3003/r/polar-palate/chat` (with diner app running)

### 6. Run the API

```bash
pnpm --filter @digital-menu/api dev
```

API base: **http://localhost:3002** (the `dev` script hardcodes `PORT=3002` via `cross-env`, overriding the `PORT=3001` fallback in `apps/api/src/index.ts` and whatever `.env` says)

- Health: `GET /api/v1/health`
- Ingredients: `GET /api/v1/ingredients?q=garlic`

---

## Reset (database + clean state)

Use when the database is in a bad state (e.g. after a failed migration) or you want a fresh schema and data.

### Full reset: schema + migrations + seed

From the **repository root**:

```bash
# 1. Drop public schema and re-apply migrations
pnpm --filter @digital-menu/db db:reset

# 2. (Optional) Seed test data again
pnpm --filter @digital-menu/seed seed
pnpm --filter @digital-menu/seed seed:menus
```

`db:reset` runs `packages/db/scripts/reset-schema.ts` (drops and recreates the `public` schema) then `drizzle:migrate`. All tables and the Drizzle journal are recreated; data is lost.

### Reset only migrations (no seed)

If you only want to re-run migrations on a clean schema:

```bash
pnpm --filter @digital-menu/db db:reset
```

Do **not** run `seed` if you don’t want test ingredients.

---

## Per-app commands (from root)

| What | Command |
|------|---------|
| Install all deps | `pnpm install` |
| Build everything | `pnpm build` |
| **Database** | |
| Run migrations | `pnpm --filter @digital-menu/db drizzle:migrate` |
| Reset schema + migrate | `pnpm --filter @digital-menu/db db:reset` |
| Generate new migration | `pnpm --filter @digital-menu/db drizzle:generate` |
| Drizzle Studio (DB GUI) | `pnpm --filter @digital-menu/db drizzle:studio` |
| **Seed** | |
| Seed test ingredients | `pnpm --filter @digital-menu/seed seed` |
| Seed demo restaurant menus | `pnpm --filter @digital-menu/seed seed:menus` (run after `seed`) |
| **API** | |
| Run API dev server | `pnpm --filter @digital-menu/api dev` |
| Build API | `pnpm --filter @digital-menu/api build` |
| Start API (production) | `pnpm --filter @digital-menu/api start` |

---

## Workspace layout

```
digital-menu/
├── apps/
│   └── api/          # Fastify API (dev server runs on port 3002 - see apps/api/package.json)
├── packages/
│   ├── db/            # Drizzle schema + migrations
│   ├── shared/        # Zod schemas, enums
│   └── seed/          # Test data seeding (ingredients + aliases)
├── .env.example
├── package.json       # Root scripts (turbo)
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Troubleshooting

- **“password authentication failed”** — Set `DATABASE_URL` in `.env` with the correct user/password/port (e.g. `postgres:123456@localhost:5433`).
- **“relation … already exists”** — DB is in a partial state. Run `pnpm --filter @digital-menu/db db:reset` then optionally `pnpm --filter @digital-menu/seed seed`.
- **“Cannot find module '@digital-menu/db/dist/index.js'”** — The seed script now runs `pnpm --filter @digital-menu/db build` before seeding; if you run the seed script manually, run that build first.
- **Port in use** — The `dev` script hardcodes `PORT=3002` via `cross-env` (overrides `.env`); change it in `apps/api/package.json`'s `dev` script if you need a different port for local dev, or stop the process using 3002.
