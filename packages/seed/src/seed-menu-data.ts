import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import pg from "pg";
import {
  users,
  restaurants,
  restaurantAdmins,
  menus,
  menuSections,
  dishes,
  dishMedia,
  dishIngredients,
  dishTranslations,
  ingredients
} from "@digital-menu/db";

const { Pool } = pg;

const SALT_ROUNDS = 10;
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:123456@localhost:5433/digital_menu";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MENU_SEED_PATHS = [
  join(__dirname, "../data/menu-seed.json"),
  join(__dirname, "../data/ai-test-menu-seed.json")
];

const SUPERADMIN_SEED: OwnerSeed = {
  email: "admin@digital-menu.test",
  password: "changeme123",
  displayName: "Platform Admin",
  role: "superadmin"
};

type DishMediaSeed = {
  url: string;
  kind: "image" | "video";
  displayOrder?: number;
};

type DishIngredientSeed = {
  slug: string;
  isOptional?: boolean;
  isHidden?: boolean;
  displayOrder?: number;
};

type DishTranslationSeed = {
  locale: string;
  name: string;
  description?: string | null;
};

type DishSeed = {
  name: string;
  description?: string | null;
  price: string;
  imageUrl?: string | null;
  isAvailable?: boolean;
  displayOrder?: number;
  media?: DishMediaSeed[];
  ingredients?: DishIngredientSeed[];
  translations?: DishTranslationSeed[];
};

type SectionSeed = {
  name: string;
  displayOrder?: number;
  dishes?: DishSeed[];
};

type MenuSeed = {
  name: string;
  isPublished?: boolean;
  displayOrder?: number;
  sections?: SectionSeed[];
};

type OwnerSeed = {
  email: string;
  password: string;
  displayName?: string | null;
  role?: "diner" | "restaurant_admin" | "superadmin";
};

type RestaurantSeed = {
  slug: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  isActive?: boolean;
};

type RestaurantBundle = {
  owner: OwnerSeed;
  restaurant: RestaurantSeed;
  menus: MenuSeed[];
};

type MenuSeedFile = {
  restaurants: RestaurantBundle[];
};

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function loadIngredientSlugMap(db: ReturnType<typeof drizzle>) {
  const rows = await db.select({ id: ingredients.id, slug: ingredients.slug }).from(ingredients);
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.slug, row.id);
  }
  return map;
}

async function upsertOwner(tx: ReturnType<typeof drizzle>, owner: OwnerSeed) {
  const passwordHash = await hashPassword(owner.password);
  const role = owner.role ?? "restaurant_admin";

  const [existing] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, owner.email))
    .limit(1);

  if (existing) {
    await tx
      .update(users)
      .set({
        passwordHash,
        displayName: owner.displayName ?? null,
        role
      })
      .where(eq(users.id, existing.id));
    return existing.id;
  }

  const [inserted] = await tx
    .insert(users)
    .values({
      email: owner.email,
      passwordHash,
      displayName: owner.displayName ?? null,
      role
    })
    .returning({ id: users.id });

  if (!inserted) throw new Error(`Failed to create owner: ${owner.email}`);
  return inserted.id;
}

async function upsertRestaurant(
  tx: ReturnType<typeof drizzle>,
  restaurant: RestaurantSeed,
  ownerId: number
) {
  const [existing] = await tx
    .select({ id: restaurants.id })
    .from(restaurants)
    .where(eq(restaurants.slug, restaurant.slug))
    .limit(1);

  if (existing) {
    await tx
      .update(restaurants)
      .set({
        name: restaurant.name,
        description: restaurant.description ?? null,
        logoUrl: restaurant.logoUrl ?? null,
        ownerId,
        isActive: restaurant.isActive ?? true
      })
      .where(eq(restaurants.id, existing.id));
    return existing.id;
  }

  const [inserted] = await tx
    .insert(restaurants)
    .values({
      slug: restaurant.slug,
      name: restaurant.name,
      description: restaurant.description ?? null,
      logoUrl: restaurant.logoUrl ?? null,
      ownerId,
      isActive: restaurant.isActive ?? true
    })
    .returning({ id: restaurants.id });

  if (!inserted) throw new Error(`Failed to create restaurant: ${restaurant.slug}`);
  return inserted.id;
}

async function ensureRestaurantAdmin(
  tx: ReturnType<typeof drizzle>,
  userId: number,
  restaurantId: number
) {
  await tx
    .insert(restaurantAdmins)
    .values({ userId, restaurantId })
    .onConflictDoNothing({
      target: [restaurantAdmins.userId, restaurantAdmins.restaurantId]
    });
}

async function upsertMenu(
  tx: ReturnType<typeof drizzle>,
  restaurantId: number,
  menu: MenuSeed
) {
  const [existing] = await tx
    .select({ id: menus.id })
    .from(menus)
    .where(and(eq(menus.restaurantId, restaurantId), eq(menus.name, menu.name)))
    .limit(1);

  if (existing) {
    await tx
      .update(menus)
      .set({
        isPublished: menu.isPublished ?? false,
        displayOrder: menu.displayOrder ?? 0
      })
      .where(eq(menus.id, existing.id));
    return existing.id;
  }

  const [inserted] = await tx
    .insert(menus)
    .values({
      restaurantId,
      name: menu.name,
      isPublished: menu.isPublished ?? false,
      displayOrder: menu.displayOrder ?? 0
    })
    .returning({ id: menus.id });

  if (!inserted) throw new Error(`Failed to create menu: ${menu.name}`);
  return inserted.id;
}

async function upsertSection(
  tx: ReturnType<typeof drizzle>,
  menuId: number,
  section: SectionSeed
) {
  const [existing] = await tx
    .select({ id: menuSections.id })
    .from(menuSections)
    .where(and(eq(menuSections.menuId, menuId), eq(menuSections.name, section.name)))
    .limit(1);

  if (existing) {
    await tx
      .update(menuSections)
      .set({ displayOrder: section.displayOrder ?? 0 })
      .where(eq(menuSections.id, existing.id));
    return existing.id;
  }

  const [inserted] = await tx
    .insert(menuSections)
    .values({
      menuId,
      name: section.name,
      displayOrder: section.displayOrder ?? 0
    })
    .returning({ id: menuSections.id });

  if (!inserted) throw new Error(`Failed to create section: ${section.name}`);
  return inserted.id;
}

async function upsertDish(
  tx: ReturnType<typeof drizzle>,
  sectionId: number,
  dish: DishSeed
) {
  const [existing] = await tx
    .select({ id: dishes.id })
    .from(dishes)
    .where(and(eq(dishes.sectionId, sectionId), eq(dishes.name, dish.name)))
    .limit(1);

  if (existing) {
    await tx
      .update(dishes)
      .set({
        description: dish.description ?? null,
        price: dish.price,
        imageUrl: dish.imageUrl ?? null,
        isAvailable: dish.isAvailable ?? true,
        displayOrder: dish.displayOrder ?? 0
      })
      .where(eq(dishes.id, existing.id));
    return existing.id;
  }

  const [inserted] = await tx
    .insert(dishes)
    .values({
      sectionId,
      name: dish.name,
      description: dish.description ?? null,
      price: dish.price,
      imageUrl: dish.imageUrl ?? null,
      isAvailable: dish.isAvailable ?? true,
      displayOrder: dish.displayOrder ?? 0
    })
    .returning({ id: dishes.id });

  if (!inserted) throw new Error(`Failed to create dish: ${dish.name}`);
  return inserted.id;
}

async function replaceDishMedia(
  tx: ReturnType<typeof drizzle>,
  dishId: number,
  media: DishMediaSeed[]
) {
  await tx.delete(dishMedia).where(eq(dishMedia.dishId, dishId));
  if (media.length === 0) return;

  await tx.insert(dishMedia).values(
    media.map((row, index) => ({
      dishId,
      url: row.url,
      kind: row.kind,
      displayOrder: row.displayOrder ?? index
    }))
  );
}

async function replaceDishIngredients(
  tx: ReturnType<typeof drizzle>,
  dishId: number,
  ingredientRows: DishIngredientSeed[],
  slugToId: Map<string, number>,
  dishName: string
) {
  await tx.delete(dishIngredients).where(eq(dishIngredients.dishId, dishId));
  if (ingredientRows.length === 0) return;

  const values = ingredientRows.map((row, index) => {
    const ingredientId = slugToId.get(row.slug);
    if (ingredientId == null) {
      throw new Error(`Unknown ingredient slug "${row.slug}" on dish "${dishName}"`);
    }
    return {
      dishId,
      ingredientId,
      isOptional: row.isOptional ?? false,
      isHidden: row.isHidden ?? false,
      displayOrder: row.displayOrder ?? index
    };
  });

  await tx.insert(dishIngredients).values(values);
}

async function upsertDishTranslations(
  tx: ReturnType<typeof drizzle>,
  dishId: number,
  translations: DishTranslationSeed[]
) {
  for (const row of translations) {
    await tx
      .insert(dishTranslations)
      .values({
        dishId,
        locale: row.locale,
        name: row.name,
        description: row.description ?? null
      })
      .onConflictDoUpdate({
        target: [dishTranslations.dishId, dishTranslations.locale],
        set: {
          name: row.name,
          description: row.description ?? null
        }
      });
  }
}

async function seedRestaurantBundle(
  db: ReturnType<typeof drizzle>,
  bundle: RestaurantBundle,
  slugToId: Map<string, number>
) {
  const { owner, restaurant, menus: menuList } = bundle;

  await db.transaction(async (tx) => {
    const ownerId = await upsertOwner(tx, owner);
    const restaurantId = await upsertRestaurant(tx, restaurant, ownerId);
    await ensureRestaurantAdmin(tx, ownerId, restaurantId);

    for (const menu of menuList) {
      const menuId = await upsertMenu(tx, restaurantId, menu);

      for (const section of menu.sections ?? []) {
        const sectionId = await upsertSection(tx, menuId, section);

        for (const dish of section.dishes ?? []) {
          const dishId = await upsertDish(tx, sectionId, dish);
          await replaceDishMedia(tx, dishId, dish.media ?? []);
          await replaceDishIngredients(tx, dishId, dish.ingredients ?? [], slugToId, dish.name);
          await upsertDishTranslations(tx, dishId, dish.translations ?? []);
        }
      }
    }

    console.log(`  Seeded restaurant "${restaurant.slug}" (${restaurant.name})`);
  });
}

function loadMenuSeedFiles(): MenuSeedFile {
  const restaurants: RestaurantBundle[] = [];
  for (const path of MENU_SEED_PATHS) {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as MenuSeedFile;
    if (!Array.isArray(parsed.restaurants) || parsed.restaurants.length === 0) {
      throw new Error(`${path} must contain a non-empty restaurants array`);
    }
    restaurants.push(...parsed.restaurants);
  }
  return { restaurants };
}

async function seed() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);

  console.log("Seeding restaurants and menus from seed JSON files...");

  const slugToId = await loadIngredientSlugMap(db);
  if (slugToId.size === 0) {
    throw new Error(
      "No ingredients found. Run `pnpm --filter @digital-menu/seed seed` first to load the ingredient dictionary."
    );
  }

  const data = loadMenuSeedFiles();
  for (const bundle of data.restaurants) {
    await seedRestaurantBundle(db, bundle, slugToId);
  }

  await db.transaction((tx) => upsertOwner(tx, SUPERADMIN_SEED));
  console.log(`  Seeded superadmin "${SUPERADMIN_SEED.email}"`);

  const restaurantCount = await db.select().from(restaurants);
  const menuCount = await db.select().from(menus);
  const dishCount = await db.select().from(dishes);
  console.log(
    `Done. Restaurants: ${restaurantCount.length}, Menus: ${menuCount.length}, Dishes: ${dishCount.length}`
  );

  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
