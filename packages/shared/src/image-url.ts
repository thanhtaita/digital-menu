import { z } from "zod";

/**
 * Absolute http(s) URL or a path served by the API static handler (`/uploads/...`).
 * Empty string clears the field.
 */
export const imageUrlFieldSchema = z
  .union([z.literal(""), z.string().url(), z.string().regex(/^\/uploads\/.+/)])
  .optional();
