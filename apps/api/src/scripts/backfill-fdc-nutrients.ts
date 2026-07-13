/**
 * One-off backfill: for every `ingredients` row with fdc_id IS NULL, look for a matching food in
 * the `fdc` reference schema (see resources/fdc-data/import). High-confidence matches
 * (score >= AUTO_ACCEPT_THRESHOLD) are applied immediately; everything else is queued in
 * ingredient_fdc_candidates for a superadmin to accept/reject in the admin portal. Ingredients with
 * no candidate above CANDIDATE_THRESHOLD are left alone (fdc_id null, no nutrients) - expected for
 * exotic/restaurant-specific ingredients with no FDC equivalent.
 *
 * Usage: pnpm --filter @digital-menu/api backfill:fdc
 * Safe to re-run: already-matched ingredients (fdc_id not null) are skipped, and duplicate
 * candidate rows are no-ops via the (ingredient_id, fdc_id) unique index.
 */
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { isNull } from "drizzle-orm";
import { ingredientFdcCandidates, ingredients } from "@digital-menu/db";
import { db } from "../lib/db.js";
import { applyFdcMatch, findFdcCandidates, AUTO_ACCEPT_THRESHOLD, CANDIDATE_THRESHOLD } from "../services/fdc-matching.js";

/**
 * Full per-ingredient record for the run log - every candidate returned by
 * findFdcCandidates (not just the top one), so a run at FDC_MATCH_CANDIDATE_THRESHOLD=0
 * can be inspected offline to see what fdc.food actually matched against.
 */
type LogRecord = {
  ingredientId: number;
  canonicalName: string;
  outcome: "auto-accepted" | "queued" | "no-match";
  candidates: Array<{ fdcId: number; description: string; dataType: string; score: number }>;
};

async function writeRunLog(records: LogRecord[]): Promise<string> {
  const root = process.env.FDC_BACKFILL_LOG_DIR ?? join(process.cwd(), "logs", "fdc-backfill");
  await mkdir(root, { recursive: true });

  const timestamp = new Date().toISOString().replace(/:/g, "-");
  const filePath = join(root, `${timestamp}.json`);

  await writeFile(
    filePath,
    `${JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        candidateThreshold: CANDIDATE_THRESHOLD,
        autoAcceptThreshold: AUTO_ACCEPT_THRESHOLD,
        records
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return filePath;
}

async function main() {
  const unmatched = await db.select().from(ingredients).where(isNull(ingredients.fdcId));

  let autoAccepted = 0;
  let queued = 0;
  let noMatch = 0;
  const records: LogRecord[] = [];

  for (const ingredient of unmatched) {
    const candidates = await findFdcCandidates(ingredient.canonicalName);
    if (candidates.length === 0) {
      noMatch++;
      records.push({ ingredientId: ingredient.id, canonicalName: ingredient.canonicalName, outcome: "no-match", candidates: [] });
      continue;
    }

    const top = candidates[0]!;
    if (top.score >= AUTO_ACCEPT_THRESHOLD) {
      await applyFdcMatch({ ingredientId: ingredient.id, fdcId: top.fdcId });
      autoAccepted++;
      console.log(`  auto-accepted: "${ingredient.canonicalName}" -> fdc:${top.fdcId} "${top.description}" (${top.score.toFixed(2)})`);
      records.push({ ingredientId: ingredient.id, canonicalName: ingredient.canonicalName, outcome: "auto-accepted", candidates });
      continue;
    }

    for (const candidate of candidates) {
      await db
        .insert(ingredientFdcCandidates)
        .values({
          ingredientId: ingredient.id,
          fdcId: candidate.fdcId,
          fdcDescription: candidate.description,
          fdcDataType: candidate.dataType,
          score: candidate.score.toFixed(4)
        })
        .onConflictDoNothing({ target: [ingredientFdcCandidates.ingredientId, ingredientFdcCandidates.fdcId] });
    }
    queued++;
    console.log(`  queued for review: "${ingredient.canonicalName}" (${candidates.length} candidate(s), top score ${top.score.toFixed(2)})`);
    records.push({ ingredientId: ingredient.id, canonicalName: ingredient.canonicalName, outcome: "queued", candidates });
  }

  console.log(
    `\nDone. ${unmatched.length} ingredient(s) had no fdc_id. ` +
      `auto-accepted=${autoAccepted} queued-for-review=${queued} no-match=${noMatch}`
  );

  const logPath = await writeRunLog(records);
  console.log(`Full run log (all candidates per ingredient) written to ${logPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
