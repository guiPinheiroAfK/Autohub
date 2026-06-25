import type { Context, Next } from "hono"

/** Variáveis injetadas pelo authMiddleware no contexto do Hono. */
export type AppVariables = {
  userId: string
  userEmail: string
}

/** Use este tipo em todos os `new Hono<AppEnv>()` e handlers. */
export type AppEnv = { Variables: AppVariables }

/** Alias tipado para handlers individuais. */
export type AppContext = Context<AppEnv>
export type AppNext = Next
