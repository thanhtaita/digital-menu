import { eq, and } from "drizzle-orm";
import { db } from "./db.js";
import { restaurants, restaurantAdmins } from "@digital-menu/db";

/** Restaurant IDs the user owns or is linked to as admin. */
export async function getRestaurantIdsManagedByUser(userId: number): Promise<number[]> {
  const owned = await db.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.ownerId, userId));
  const admins = await db
    .select({ restaurantId: restaurantAdmins.restaurantId })
    .from(restaurantAdmins)
    .where(eq(restaurantAdmins.userId, userId));
  return [...new Set([...owned.map((r) => r.id), ...admins.map((a) => a.restaurantId)])];
}


/** Returns true if the user is owner or has admin access to the restaurant. */
export async function canUserManageRestaurant(userId: number, restaurantId: number): Promise<boolean> {
  const [restaurant] = await db
    .select({ ownerId: restaurants.ownerId })
    .from(restaurants)
    .where(eq(restaurants.id, restaurantId))
    .limit(1);
  if (!restaurant) return false;
  if (restaurant.ownerId === userId) return true;
  const [admin] = await db
    .select({ id: restaurantAdmins.id })
    .from(restaurantAdmins)
    .where(and(eq(restaurantAdmins.userId, userId), eq(restaurantAdmins.restaurantId, restaurantId)))
    .limit(1);
  return admin != null;
}

/** Superadmin can manage any restaurant. */
export async function canUserManageRestaurantWithRole(
  userId: number,
  role: string,
  restaurantId: number
): Promise<boolean> {
  if (role === "superadmin") return true;
  return canUserManageRestaurant(userId, restaurantId);
}
