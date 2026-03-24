import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "./db.js";
import { users, sessions } from "@digital-menu/db";

const SALT_ROUNDS = 10;
const SESSION_COOKIE = "session_id";
const SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createSessionId(): string {
  return randomBytes(32).toString("hex");
}

export async function createSession(userId: number): Promise<string> {
  const id = createSessionId();
  const expiresAt = new Date(Date.now() + SESSION_AGE_MS);
  await db.insert(sessions).values({ id, userId, expiresAt });
  return id;
}

export async function getSession(sessionId: string | undefined): Promise<{ userId: number; email: string; role: string } | null> {
  if (!sessionId) return null;
  const [row] = await db
    .select({
      userId: sessions.userId,
      expiresAt: sessions.expiresAt
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!row || row.expiresAt < new Date()) return null;
  const [user] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);
  if (!user) return null;
  return { userId: user.id, email: user.email, role: user.role };
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

function parseCookie(str: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of str.split(";")) {
    const [key, ...v] = part.trim().split("=");
    if (key && v.length) out[key] = decodeURIComponent(v.join("=").trim());
  }
  return out;
}

export function getSessionIdFromCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  return parseCookie(cookieHeader)[SESSION_COOKIE];
}

// Re-export for routes to set cookie
export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const SESSION_AGE_DAYS = 7;
export function sessionCookieOptions(overrides?: { maxAge?: number }) {
  const maxAge = overrides?.maxAge ?? SESSION_AGE_DAYS * 24 * 60 * 60;
  return {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge
  };
}
