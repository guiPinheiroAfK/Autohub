import { Hono } from "hono"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { sql } from "../db/client"
import { signToken } from "../middleware/jwt"
import { enviarVerificacaoEmail, enviarResetSenha } from "../lib/email"
import type { AppEnv } from "../types"

export const authV2Routes = new Hono<AppEnv>()

// POST /auth/verificar-email?token=xxx
authV2Routes.get("/verificar-email", async (c) => {
  const token = c.req.query("token")
  if (!token) return c.json({ error: "Token obrigatório" }, 400)

  const [verificacao] = await sql`
    SELECT id, usuario_id, usado, expira_em FROM email_verificacoes WHERE token = ${token}
  `

  if (!verificacao) return c.json({ error: "Token inválido" }, 404)
  if (verificacao.usado) return c.json({ error: "Token já utilizado" }, 400)
  if (new Date(verificacao.expira_em) < new Date()) return c.json({ error: "Token expirado" }, 400)

  await sql.begin(async (tx) => {
    await tx`UPDATE email_verificacoes SET usado = true WHERE id = ${verificacao.id}`
    await tx`UPDATE usuarios SET email_verificado = true WHERE id = ${verificacao.usuario_id}`
  })

  return c.json({ ok: true })
})

// POST /auth/reenviar-verificacao
authV2Routes.post("/reenviar-verificacao", async (c) => {
  const body = await c.req.json().catch(() => null)
  const email = body?.email
  if (!email) return c.json({ error: "E-mail obrigatório" }, 400)

  const [usuario] = await sql`
    SELECT id, nome, email, email_verificado FROM usuarios WHERE email = ${email}
  `
  if (!usuario) return c.json({ ok: true }) // silencioso — não revelar se existe
  if (usuario.email_verificado) return c.json({ error: "E-mail já verificado" }, 400)

  await sql`UPDATE email_verificacoes SET usado = true WHERE usuario_id = ${usuario.id} AND usado = false`

  const token = crypto.randomUUID()
  await sql`INSERT INTO email_verificacoes (usuario_id, token) VALUES (${usuario.id}, ${token})`

  enviarVerificacaoEmail(usuario.email, usuario.nome, token).catch(console.error)
  return c.json({ ok: true })
})

// POST /auth/esqueci-senha
authV2Routes.post("/esqueci-senha", async (c) => {
  const body = await c.req.json().catch(() => null)
  const email = body?.email
  if (!email) return c.json({ error: "E-mail obrigatório" }, 400)

  const [usuario] = await sql`SELECT id, nome, email FROM usuarios WHERE email = ${email}`
  if (!usuario) return c.json({ ok: true }) // silencioso

  await sql`UPDATE senha_resets SET usado = true WHERE usuario_id = ${usuario.id} AND usado = false`

  const token = crypto.randomUUID()
  await sql`INSERT INTO senha_resets (usuario_id, token) VALUES (${usuario.id}, ${token})`

  enviarResetSenha(usuario.email, usuario.nome, token).catch(console.error)
  return c.json({ ok: true })
})

// POST /auth/resetar-senha
authV2Routes.post("/resetar-senha", async (c) => {
  const body = await c.req.json().catch(() => null)
  const schema = z.object({ token: z.string(), nova_senha: z.string().min(8) })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return c.json({ error: "Dados inválidos" }, 400)

  const { token, nova_senha } = parsed.data

  const [reset] = await sql`
    SELECT id, usuario_id, usado, expira_em FROM senha_resets WHERE token = ${token}
  `

  if (!reset) return c.json({ error: "Token inválido" }, 404)
  if (reset.usado) return c.json({ error: "Token já utilizado" }, 400)
  if (new Date(reset.expira_em) < new Date()) return c.json({ error: "Token expirado" }, 400)

  const hashed = await bcrypt.hash(nova_senha, 12)
  await sql.begin(async (tx) => {
    await tx`UPDATE senha_resets SET usado = true WHERE id = ${reset.id}`
    await tx`UPDATE usuarios SET hashed_password = ${hashed} WHERE id = ${reset.usuario_id}`
  })

  return c.json({ ok: true })
})

// PATCH /api/auth/garagem — atualizar garagem (nome, bio, publica)
authV2Routes.patch("/garagem", async (c) => {
  const userId = c.get("userId") as string
  const body = await c.req.json().catch(() => null)
  const schema = z.object({
    nome: z.string().min(2).max(80).optional(),
    bio: z.string().max(300).nullable().optional(),
    publica: z.boolean().optional(),
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return c.json({ error: "Dados inválidos" }, 400)

  const { nome, bio, publica } = parsed.data

  const [g] = await sql`SELECT id FROM garagens WHERE usuario_id = ${userId}`
  if (!g) return c.json({ error: "Garagem não encontrada" }, 404)

  if (nome !== undefined) await sql`UPDATE garagens SET nome = ${nome} WHERE id = ${g.id}`
  if (bio !== undefined) await sql`UPDATE garagens SET bio = ${bio} WHERE id = ${g.id}`
  if (publica !== undefined) await sql`UPDATE garagens SET publica = ${publica} WHERE id = ${g.id}`

  const [updated] = await sql`SELECT id, nome, slug, bio, publica FROM garagens WHERE id = ${g.id}`
  return c.json({ garagem: updated })
})

// PATCH /api/auth/perfil — atualizar perfil do usuário
authV2Routes.patch("/perfil", async (c) => {
  const userId = c.get("userId") as string
  const body = await c.req.json().catch(() => null)
  const schema = z.object({
    nome: z.string().min(2).max(120).optional(),
    avatar_url: z.string().url().nullable().optional(),
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return c.json({ error: "Dados inválidos" }, 400)

  const { nome, avatar_url } = parsed.data
  if (nome !== undefined) await sql`UPDATE usuarios SET nome = ${nome} WHERE id = ${userId}`
  if (avatar_url !== undefined) await sql`UPDATE usuarios SET avatar_url = ${avatar_url} WHERE id = ${userId}`

  const [u] = await sql`SELECT id, nome, email, avatar_url FROM usuarios WHERE id = ${userId}`
  return c.json({ usuario: u })
})
