import { z } from "zod";

export const roleEnum = z.enum(["diner", "restaurant_admin", "superadmin"]);

export type Role = z.infer<typeof roleEnum>;

