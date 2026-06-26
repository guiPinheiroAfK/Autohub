// Função Netlify (runtime Node.js — não é Edge Function) que serve a mesma
// `app` Hono usada no Bun local. Como Functions normais do Netlify rodam em
// Node.js de verdade (AWS Lambda), TCP direto pro Postgres funciona sem
// driver especial — por isso não precisamos do `hono/netlify` (esse adapter
// é pra Edge Functions, que rodam em Deno e não tem socket TCP).
//
// `app.fetch` já tem a assinatura (Request) => Promise<Response> que as
// Functions modernas do Netlify esperam — não precisa de adapter nenhum.
import { app } from "../../src/app"

export const config = {
  path: ["/api/*", "/auth/*"],
}

export default async (req: Request) => app.fetch(req)
