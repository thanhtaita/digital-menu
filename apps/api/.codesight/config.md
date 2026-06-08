# Config

## Environment Variables

- `AI_AUTO_CREATE_CONFIDENCE` (has default) — .env
- `AI_FUZZY_MATCH_THRESHOLD` (has default) — .env
- `AI_SUGGESTION_MAX_TOKENS` (has default) — .env
- `AI_SUGGESTION_MODEL` (has default) — .env
- `AI_SUGGESTION_TEMPERATURE` (has default) — .env
- `DATABASE_URL` **required** — src\lib\db.ts
- `DINER_APP_URL` **required** — src\routes\qr.ts
- `GEMINI_API_KEY` (has default) — .env
- `NODE_ENV` **required** — src\lib\auth.ts
- `PORT` **required** — src\index.ts
- `UPLOAD_DIR` **required** — src\lib\uploads.ts

## Config Files

- `tsconfig.json`

## Key Dependencies

- @google/generative-ai: ^0.24.1
- drizzle-orm: ^0.38.0
- fastify: ^5.0.0
- pg: ^8.11.5
