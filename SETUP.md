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
- `PORT=3001`

### 3. Database: migrate

Apply Drizzle migrations (creates tables):

```bash
pnpm --filter @digital-menu/db drizzle:migrate
```

### 4. Seed test data (optional)

Load 25 ingredients + aliases into `ingredients` and `ingredient_aliases`:

```bash
pnpm --filter @digital-menu/seed seed
```

This builds `@digital-menu/db` then runs the seed script. Safe to run multiple times.

### 5. Run the API

```bash
pnpm --filter @digital-menu/api dev
```

API base: **http://localhost:3001**

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
| **API** | |
| Run API dev server | `pnpm --filter @digital-menu/api dev` |
| Build API | `pnpm --filter @digital-menu/api build` |
| Start API (production) | `pnpm --filter @digital-menu/api start` |

---

## Workspace layout

```
digital-menu/
├── apps/
│   └── api/          # Fastify API (port 3001)
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
- **Port in use** — Change `PORT` in `.env` (default 3001) or stop the process using the port.
