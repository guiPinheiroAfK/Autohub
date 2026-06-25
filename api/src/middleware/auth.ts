import type { Next } from "hono"
import type { AppContext } from "../types"
import { verifyToken } from "./jwt"

export async function authMiddleware(c: AppContext, next: Next) {
  const header = c.req.header("Authorization")
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Não autorizado" }, 401)
  }
  try {
    const token = header.slice(7)
    const payload = await verifyToken(token)
    c.set("userId", payload.sub!)
    c.set("userEmail", payload.email as string)
    await next()
  } catch {
    return c.json({ error: "Token inválido ou expirado" }, 401)
  }
}
