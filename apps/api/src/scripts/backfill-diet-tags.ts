/**
 * One-off backfill: for every `ingredients` row with diet_tags IS NULL, ask the configured LLM provider
 * (see lib/ai/) to judge its compatibility with each diet type in DietType (vegan, vegetarian, pescatarian,
 * halal, kosher, gluten_free, dairy_free, nut_free). High-confidence judgments (confidence === "high") are
 * applied directly to ingredients.diet_tags; medium/low confidence judgments are queued in
 * ingredient_diet_candidates for a superadmin to accept/reject in the admin portal. Diet types the model
 * has no opinion on are left untagged (no signal - never treated as a violation, see restriction-engine).
 *
 * Usage: pnpm --filter @digital-menu/api backfill:diet-tags
 * Safe to re-run: ingredients that have already been scanned at least once (diet_tags not null) are
 * skipped, and duplicate candidate rows are no-ops via the (ingredient_id, diet_type) unique index.
 */
import { isNull } from "drizzle-orm";
import { ingredientDietCandidates, ingredients } from "@digital-menu/db";
import { db } from "../lib/db.js";
import { applyDietTag, proposeDietTags, AUTO_ACCEPT_CONFIDENCE } from "../services/diet-tagging.js";

async function main() {
  const unscanned = await db.select().from(ingredients).where(isNull(ingredients.dietTags));

  let autoAccepted = 0;
  let queued = 0;
  let noOpinion = 0;

  for (const ingredient of unscanned) {
    const proposals = await proposeDietTags({
      canonicalName: ingredient.canonicalName,
      description: ingredient.description
    });

    if (proposals.length === 0) {
      noOpinion++;
      continue;
    }

    for (const proposal of proposals) {
      if (proposal.confidence === AUTO_ACCEPT_CONFIDENCE) {
        await applyDietTag({
          ingredientId: ingredient.id,
          dietType: proposal.dietType,
          compatible: proposal.compatible
        });
        autoAccepted++;
        console.log(
          `  auto-accepted: "${ingredient.canonicalName}" ${proposal.dietType}=${proposal.compatible} (${proposal.confidence})`
        );
        continue;
      }

      await db
        .insert(ingredientDietCandidates)
        .values({
          ingredientId: ingredient.id,
          dietType: proposal.dietType,
          compatible: proposal.compatible,
          confidence: proposal.confidence,
          reasoning: proposal.reasoning
        })
        .onConflictDoNothing({
          target: [ingredientDietCandidates.ingredientId, ingredientDietCandidates.dietType]
        });
      queued++;
      console.log(
        `  queued for review: "${ingredient.canonicalName}" ${proposal.dietType}=${proposal.compatible} (${proposal.confidence})`
      );
    }
  }

  console.log(
    `\nDone. ${unscanned.length} ingredient(s) had no diet_tags. ` +
      `auto-accepted=${autoAccepted} queued-for-review=${queued} no-opinion=${noOpinion}`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
