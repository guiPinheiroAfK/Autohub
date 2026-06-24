import type { Context, Next } from "hono"
import { verifyToken } from "./jwt"
import type { AppEnv } from "../types"

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const header = c.req.header("Authorization")
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Não autorizado" }, 401)
  }

  try {
    const token = header.slice(7)
    const payload = await verifyToken(token)
    c.set("userId", payload.sub)
    c.set("userEmail", payload.email)
    await next()
  } catch {
    return c.json({ error: "Token inválido ou expirado" }, 401)
  }
}
