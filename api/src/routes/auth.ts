import { Hono } from "hono"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { sql } from "../db/client.ts"
import { signToken } from "../middleware/jwt.ts"
import { enviarVerificacaoEmail } from "../lib/email.ts"

// Validação manual com zod (sem @hono/zod-validator, que não está
// instalado — evita dependência extra só pra isso).

export const authRoutes = new Hono()

const registerSchema = z.object({
  nome: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// POST /auth/register
authRoutes.post("/register", async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400)
  }

  const { nome, email, password } = parsed.data

  const existing = await sql`SELECT id FROM usuarios WHERE email = ${email} LIMIT 1`
  if (existing.length > 0) {
    return c.json({ error: "E-mail já cadastrado" }, 409)
  }

  const hashed = await bcrypt.hash(password, 12)

  const userId = crypto.randomUUID()
  const slug = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60)

  const [[u], [g]] = await sql.transaction((tx) => [
    tx`INSERT INTO usuarios (id, nome, email, hashed_password)
       VALUES (${userId}, ${nome}, ${email}, ${hashed})
       RETURNING id, nome, email`,
    tx`INSERT INTO garagens (usuario_id, nome, slug)
       VALUES (${userId}, ${"Garagem de " + nome}, ${slug + "-" + userId.slice(0, 6)})
       RETURNING id, slug`,
  ])

  const usuario = {
    id: u.id as string,
    nome: u.nome as string,
    email: u.email as string,
    garagemId: g.id as string,
    garagemSlug: g.slug as string,
  }

  const token = await signToken({ sub: usuario.id, email: usuario.email })

  // Enviar verificação de email (não bloqueia o registro)
  const verificacaoToken = crypto.randomUUID()
  await sql`INSERT INTO email_verificacoes (usuario_id, token) VALUES (${usuario.id}, ${verificacaoToken})`
  enviarVerificacaoEmail(usuario.email, usuario.nome, verificacaoToken).catch(console.error)

  return c.json({
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      garagemId: usuario.garagemId,
      emailVerificado: false,
    },
  }, 201)
})

// POST /auth/login
authRoutes.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos" }, 400)
  }

  const { email, password } = parsed.data

  const [usuario] = await sql`
    SELECT id, nome, email, hashed_password, ativo
    FROM usuarios WHERE email = ${email} LIMIT 1
  `

  if (!usuario || !usuario.ativo) {
    return c.json({ error: "Credenciais inválidas" }, 401)
  }

  const ok = await bcrypt.compare(password, usuario.hashed_password)
  if (!ok) {
    return c.json({ error: "Credenciais inválidas" }, 401)
  }

  // Pega a garagem do usuário
  const [garagem] = await sql`
    SELECT id FROM garagens WHERE usuario_id = ${usuario.id} LIMIT 1
  `

  const token = await signToken({ sub: usuario.id, email: usuario.email })

  return c.json({
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      garagemId: garagem?.id ?? null,
    },
  })
})
