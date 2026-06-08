import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";

// apps/api/.env must win over machine/user OPENAI_API_KEY (dotenv skips existing vars by default)
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env"), override: true });

const port = Number(process.env.PORT) || 3001;

buildApp()
  .then((app) => app.listen({ port, host: "0.0.0.0" }))
  .then(() => console.log(`API listening on http://localhost:${port}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
