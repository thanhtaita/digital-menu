import type { FastifyRequest, FastifyReply } from "fastify";
import { getSessionIdFromCookie, getSession } from "../lib/auth.js";

export type AuthUser = { userId: number; email: string; role: string };

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<{ user: AuthUser } | undefined> {
  const sessionId = getSessionIdFromCookie(request.headers.cookie);
  const user = await getSession(sessionId);
  if (!user) {
    reply.status(401).send({ error: "Unauthorized", code: "UNAUTHORIZED" });
    return undefined;
  }
  (request as FastifyRequest & { user: AuthUser }).user = {
    userId: user.userId,
    email: user.email,
    role: user.role
  };
  return { user: (request as FastifyRequest & { user: AuthUser }).user };
}

export function getOptionalUser(request: FastifyRequest): AuthUser | null {
  return (request as FastifyRequest & { user?: AuthUser }).user ?? null;
}
