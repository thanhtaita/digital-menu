import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import pg from "pg";
import {
  ingredients,
  ingredientAliases,
  type NewIngredient,
  type NewIngredientAlias
} from "@digital-menu/db";

const { Pool } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:123456@localhost:5433/digital_menu";

/**
 * Test ingredient set: common allergens + dietary staples + a few extras.
 * Used for admin portal ingredient tagging and diner restriction flows.
 */
const TEST_INGREDIENTS: Array<{
  canonicalName: string;
  slug: string;
  description: string | null;
  isCommonAllergen: boolean;
  commonAllergenGroup: string | null;
  aliases: string[];
}> = [
  {
    canonicalName: "Milk",
    slug: "milk",
    description: "Dairy milk from cows. Common allergen.",
    isCommonAllergen: true,
    commonAllergenGroup: "milk",
    aliases: ["dairy", "cow milk", "lait"]
  },
  {
    canonicalName: "Eggs",
    slug: "eggs",
    description: "Chicken eggs. Common allergen.",
    isCommonAllergen: true,
    commonAllergenGroup: "eggs",
    aliases: ["egg", "œuf"]
  },
  {
    canonicalName: "Fish",
    slug: "fish",
    description: "Finfish. Major allergen.",
    isCommonAllergen: true,
    commonAllergenGroup: "fish",
    aliases: ["poisson", "pesce"]
  },
  {
    canonicalName: "Shellfish",
    slug: "shellfish",
    description: "Crustaceans and mollusks. Major allergen.",
    isCommonAllergen: true,
    commonAllergenGroup: "shellfish",
    aliases: ["shrimp", "crab", "lobster", "mollusk"]
  },
  {
    canonicalName: "Tree nuts",
    slug: "tree-nuts",
    description: "Tree nuts (almonds, walnuts, cashews, etc.). Major allergen.",
    isCommonAllergen: true,
    commonAllergenGroup: "tree_nuts",
    aliases: ["nuts", "almond", "walnut", "cashew", "pecan", "hazelnut"]
  },
  {
    canonicalName: "Peanuts",
    slug: "peanuts",
    description: "Peanuts (legume). Major allergen.",
    isCommonAllergen: true,
    commonAllergenGroup: "peanuts",
    aliases: ["peanut", "groundnut", "arachide"]
  },
  {
    canonicalName: "Wheat",
    slug: "wheat",
    description: "Wheat and gluten-containing grains. Major allergen.",
    isCommonAllergen: true,
    commonAllergenGroup: "wheat",
    aliases: ["gluten", "blé", "farine"]
  },
  {
    canonicalName: "Soybeans",
    slug: "soybeans",
    description: "Soy and soy products. Major allergen.",
    isCommonAllergen: true,
    commonAllergenGroup: "soybeans",
    aliases: ["soy", "soya", "tofu", "edamame"]
  },
  {
    canonicalName: "Sesame",
    slug: "sesame",
    description: "Sesame seeds and oil. Major allergen.",
    isCommonAllergen: true,
    commonAllergenGroup: "sesame",
    aliases: ["sesame seeds", "tahini", "benne"]
  },
  {
    canonicalName: "Garlic",
    slug: "garlic",
    description: "Garlic, used for flavor.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["ail", "aglio"]
  },
  {
    canonicalName: "Onion",
    slug: "onion",
    description: "Onion, bulb vegetable.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["onions", "oignon", "cebolla"]
  },
  {
    canonicalName: "Tomato",
    slug: "tomato",
    description: "Tomato, fruit used as vegetable.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["tomatoes", "tomate", "pomodoro"]
  },
  {
    canonicalName: "Olive oil",
    slug: "olive-oil",
    description: "Oil pressed from olives.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["olive oil", "huile d'olive"]
  },
  {
    canonicalName: "Butter",
    slug: "butter",
    description: "Dairy butter. Contains milk.",
    isCommonAllergen: false,
    commonAllergenGroup: "milk",
    aliases: ["beurre", "burro"]
  },
  {
    canonicalName: "Cheese",
    slug: "cheese",
    description: "Dairy cheese. Contains milk.",
    isCommonAllergen: false,
    commonAllergenGroup: "milk",
    aliases: ["fromage", "formaggio", "dairy"]
  },
  {
    canonicalName: "Chicken",
    slug: "chicken",
    description: "Poultry, chicken.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["poulet", "pollo", "poultry"]
  },
  {
    canonicalName: "Beef",
    slug: "beef",
    description: "Beef, red meat.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["boeuf", "manzo", "red meat"]
  },
  {
    canonicalName: "Basil",
    slug: "basil",
    description: "Fresh or dried basil herb.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["basilic", "basilico"]
  },
  {
    canonicalName: "Black pepper",
    slug: "black-pepper",
    description: "Black pepper, ground or whole.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["pepper", "poivre", "pepe"]
  },
  {
    canonicalName: "Salt",
    slug: "salt",
    description: "Table salt (sodium chloride).",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["sodium chloride", "sel", "sale"]
  },
  {
    canonicalName: "Rice",
    slug: "rice",
    description: "Rice grain, gluten-free staple.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["riz", "riso"]
  },
  {
    canonicalName: "Potato",
    slug: "potato",
    description: "Potato, starchy tuber.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["potatoes", "pomme de terre", "patata"]
  },
  {
    canonicalName: "Lemon",
    slug: "lemon",
    description: "Lemon citrus fruit.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["lemons", "citron", "limone"]
  },
  {
    canonicalName: "Cilantro",
    slug: "cilantro",
    description: "Cilantro / coriander leaves.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["coriander", "coriandre", "coriandolo"]
  },
  {
    canonicalName: "Cumin",
    slug: "cumin",
    description: "Cumin spice.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["cumino", "cumin seed"]
  },
  // Polar Palate menu (ai-test-menu-seed.json)
  {
    canonicalName: "Durian",
    slug: "durian",
    description: "Durian fruit. Strong aroma; polarizing flavor.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["durian fruit"]
  },
  {
    canonicalName: "Coconut milk",
    slug: "coconut-milk",
    description: "Coconut milk from pressed coconut flesh.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["coconut cream", "lait de coco"]
  },
  {
    canonicalName: "Sugar",
    slug: "sugar",
    description: "Refined sugar (sucrose).",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["sucrose", "sucre", "zucchero"]
  },
  {
    canonicalName: "Mustard",
    slug: "mustard",
    description: "Mustard seed or prepared mustard.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["moutarde", "senape"]
  },
  {
    canonicalName: "Blue cheese",
    slug: "blue-cheese",
    description: "Mold-ripened blue cheese. Contains milk.",
    isCommonAllergen: false,
    commonAllergenGroup: "milk",
    aliases: ["roquefort", "gorgonzola", "stilton"]
  },
  {
    canonicalName: "Chili pepper",
    slug: "chili-pepper",
    description: "Hot chili peppers (capsaicin). Not a common allergen.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["chile", "hot pepper", "ghost pepper", "habanero", "jalapeño"]
  },
  {
    canonicalName: "Liver",
    slug: "liver",
    description: "Organ meat (liver). Offal.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["foie", "offal liver"]
  },
  {
    canonicalName: "Lamb",
    slug: "lamb",
    description: "Lamb, red meat.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["agneau", "agnello", "mutton"]
  },
  {
    canonicalName: "Pork",
    slug: "pork",
    description: "Pork, red meat.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["porc", "maiale", "bacon", "ham"]
  },
  {
    canonicalName: "Capers",
    slug: "capers",
    description: "Pickled caper buds.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["caper", "câpres"]
  },
  {
    canonicalName: "Tofu",
    slug: "tofu",
    description: "Soybean curd. Contains soy.",
    isCommonAllergen: false,
    commonAllergenGroup: "soybeans",
    aliases: ["bean curd", "soy curd"]
  },
  {
    canonicalName: "Quinoa",
    slug: "quinoa",
    description: "Quinoa seed, gluten-free grain.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["quinua"]
  },
  {
    canonicalName: "Lime",
    slug: "lime",
    description: "Lime citrus fruit.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["limes", "citron vert", "limetta"]
  },
  {
    canonicalName: "Anchovy",
    slug: "anchovy",
    description: "Anchovy, small oily fish.",
    isCommonAllergen: false,
    commonAllergenGroup: "fish",
    aliases: ["anchovies", "anchois", "acciuga"]
  },
  {
    canonicalName: "Olive",
    slug: "olive",
    description: "Olives, brined or cured fruit.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["olives", "olive fruit"]
  },
  {
    canonicalName: "Tripe",
    slug: "tripe",
    description: "Beef or lamb stomach lining. Offal.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["honeycomb tripe", "offal tripe"]
  },
  {
    canonicalName: "Octopus",
    slug: "octopus",
    description: "Octopus, cephalopod seafood.",
    isCommonAllergen: false,
    commonAllergenGroup: "shellfish",
    aliases: ["polpo", "poulpe"]
  },
  {
    canonicalName: "Beet",
    slug: "beet",
    description: "Beetroot, earthy root vegetable.",
    isCommonAllergen: false,
    commonAllergenGroup: null,
    aliases: ["beetroot", "beets", "betterave"]
  },
  {
    canonicalName: "Goat cheese",
    slug: "goat-cheese",
    description: "Cheese made from goat milk. Contains milk.",
    isCommonAllergen: false,
    commonAllergenGroup: "milk",
    aliases: ["chèvre", "caprino"]
  },
  {
    canonicalName: "Chocolate",
    slug: "chocolate",
    description: "Chocolate / cocoa. May contain milk.",
    isCommonAllergen: false,
    commonAllergenGroup: "milk",
    aliases: ["cocoa", "dark chocolate", "chocolat"]
  },
  {
    canonicalName: "Cream",
    slug: "cream",
    description: "Dairy cream. Contains milk.",
    isCommonAllergen: false,
    commonAllergenGroup: "milk",
    aliases: ["heavy cream", "crème", "panna"]
  }
];

async function seed() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  console.log("Seeding test ingredients and aliases...");

  for (const row of TEST_INGREDIENTS) {
    const [inserted] = await db
      .insert(ingredients)
      .values({
        canonicalName: row.canonicalName,
        slug: row.slug,
        description: row.description,
        isCommonAllergen: row.isCommonAllergen,
        commonAllergenGroup: row.commonAllergenGroup,
        approvalStatus: "approved",
        requestedByRestaurantId: null
      } as NewIngredient)
      .onConflictDoUpdate({
        target: ingredients.slug,
        set: {
          canonicalName: row.canonicalName,
          description: row.description,
          isCommonAllergen: row.isCommonAllergen,
          commonAllergenGroup: row.commonAllergenGroup,
          approvalStatus: "approved",
          requestedByRestaurantId: null
        }
      })
      .returning({ id: ingredients.id });

    if (!inserted) {
      const [existing] = await db
        .select({ id: ingredients.id })
        .from(ingredients)
        .where(eq(ingredients.slug, row.slug))
        .limit(1);
      if (!existing) throw new Error(`Failed to upsert ingredient: ${row.slug}`);
    }

    const ingredientId = inserted?.id ?? (
      await db
        .select({ id: ingredients.id })
        .from(ingredients)
        .where(eq(ingredients.slug, row.slug))
        .limit(1)
    )[0].id;

    for (const alias of row.aliases) {
      const aliasLower = alias.toLowerCase().trim();
      if (aliasLower === row.canonicalName.toLowerCase()) continue;
      await db
        .insert(ingredientAliases)
        .values({
          ingredientId,
          alias: aliasLower,
          languageCode: "en"
        } as NewIngredientAlias)
        .onConflictDoNothing({
          target: [ingredientAliases.ingredientId, ingredientAliases.alias]
        });
    }
  }

  const count = await db.select().from(ingredients);
  const aliasCount = await db.select().from(ingredientAliases);
  console.log(`Done. Ingredients: ${count.length}, Aliases: ${aliasCount.length}`);
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
