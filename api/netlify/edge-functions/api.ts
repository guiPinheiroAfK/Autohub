// Edge Function — roda na borda (Deno Deploy, zero cold start, ~50ms vs ~1-3s do Lambda).
// O neon() HTTP driver não precisa de TCP, funciona em qualquer runtime de edge.
import { app } from "../../src/app.ts"

export default async (req: Request) => app.fetch(req)

export const config = {
  path: ["/api/*", "/auth/*"],
}
