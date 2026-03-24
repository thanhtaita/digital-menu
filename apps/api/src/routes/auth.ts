import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../lib/db.js";
import { users, restaurants, restaurantAdmins } from "@digital-menu/db";
import {
  registerBodySchema,
  loginBodySchema,
  type RegisterBody,
  type LoginBody
} from "@digital-menu/shared";
import {
  hashPassword,
  verifyPassword,
  createSession,
  deleteSession,
  getSessionIdFromCookie,
  getSession,
  SESSION_COOKIE_NAME,
  sessionCookieOptions
} from "../lib/auth.js";

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: RegisterBody }>("/register", async (request, reply) => {
    const parsed = registerBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { email, password, displayName, restaurantName, restaurantSlug } = parsed.data;

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      return reply.status(409).send({ error: "Email already registered", code: "EMAIL_TAKEN" });
    }

    if (restaurantSlug && !restaurantName) {
      return reply.status(422).send({ error: "restaurantName required when restaurantSlug is provided" });
    }

    const existingSlugRows =
      restaurantSlug != null
        ? await db.select().from(restaurants).where(eq(restaurants.slug, restaurantSlug)).limit(1)
        : [];
    if (existingSlugRows.length > 0) {
      return reply.status(409).send({ error: "Restaurant slug already taken", code: "SLUG_TAKEN" });
    }

    const passwordHash = await hashPassword(password);
    const role = restaurantName && restaurantSlug ? "restaurant_admin" : "diner";
    const [insertedUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        role,
        displayName: displayName ?? null
      })
      .returning({ id: users.id, email: users.email, role: users.role });

    if (!insertedUser) {
      return reply.status(500).send({ error: "Failed to create user" });
    }

    let restaurantId: number | null = null;
    if (restaurantName && restaurantSlug) {
      const [restaurant] = await db
        .insert(restaurants)
        .values({
          name: restaurantName,
          slug: restaurantSlug,
          ownerId: insertedUser.id
        })
        .returning({ id: restaurants.id });
      if (restaurant) {
        restaurantId = restaurant.id;
        await db.insert(restaurantAdmins).values({
          userId: insertedUser.id,
          restaurantId: restaurant.id
        });
      }
    }

    const sessionId = await createSession(insertedUser.id);
    reply.setCookie(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions());
    return reply.status(201).send({
      user: { id: insertedUser.id, email: insertedUser.email, role: insertedUser.role },
      restaurantId
    });
  });

  app.post<{ Body: LoginBody }>("/login", async (request, reply) => {
    const parsed = loginBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(422).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { email, password } = parsed.data;

    const [user] = await db
      .select({ id: users.id, email: users.email, role: users.role, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return reply.status(401).send({ error: "Invalid email or password", code: "INVALID_CREDENTIALS" });
    }

    const sessionId = await createSession(user.id);
    reply.setCookie(SESSION_COOKIE_NAME, sessionId, sessionCookieOptions());
    return reply.send({
      user: { id: user.id, email: user.email, role: user.role }
    });
  });

  app.post("/logout", async (request, reply) => {
    const sessionId = getSessionIdFromCookie(request.headers.cookie);
    if (sessionId) await deleteSession(sessionId);
    reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return reply.status(204).send();
  });

  app.get("/me", async (request, reply) => {
    const sessionId = getSessionIdFromCookie(request.headers.cookie);
    const session = await getSession(sessionId);
    if (!session) {
      return reply.status(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
    }
    const [user] = await db
      .select({ id: users.id, email: users.email, role: users.role, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    if (!user) return reply.status(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
    return reply.send({ id: user.id, email: user.email, role: user.role, displayName: user.displayName });
  });
}
