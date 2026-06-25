/**
 * Entrypoint pro Bun (dev local / Docker). Em produção no Netlify, a mesma
 * `app` é servida por api/netlify/functions/api.mts — sem duplicar rota
 * nenhuma, os dois entrypoints só montam o mesmo Hono app em runtimes
 * diferentes.
 */
import { app } from "./app"

const PORT = Number(process.env.PORT ?? 8000)
console.log(`🚀 autohub-api rodando em http://localhost:${PORT}`)

export default {
  port: PORT,
  fetch: app.fetch,
}
