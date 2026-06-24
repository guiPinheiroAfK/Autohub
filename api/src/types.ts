// Tipa as variáveis que o authMiddleware injeta no contexto Hono via c.set().
// Sem isso, c.get("userId") falha o typecheck (mas não quebra o Bun em
// runtime, já que ele roda TS sem checar tipos — ainda assim, vale corrigir).
export type AppEnv = {
  Variables: {
    userId: string
    userEmail: string
  }
}
