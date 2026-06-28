import type { Context, Next } from "hono";
import type { Env } from "../types";
import { createRepository } from "../services/repositories";
import { hashPassword, verifySessionToken } from "../services/security";

export type AuthVariables = { userId: string };

export const requireAuth = async (c: Context<{ Bindings: Env; Variables: AuthVariables }>, next: Next) => {
  const authorization = c.req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) return c.json({ ok: false, error: "authentication_required" }, 401);
  const token = authorization.slice(7).trim();
  const claims = await verifySessionToken(token, c.env.JWT_SECRET);
  if (!claims) return c.json({ ok: false, error: "invalid_or_expired_session" }, 401);
  const session = await createRepository(c.env.DB).findActiveSessionByTokenHash(await hashPassword(token));
  if (!session || session.userId !== claims.userId) return c.json({ ok: false, error: "session_not_found" }, 401);
  c.set("userId", claims.userId);
  await next();
};
