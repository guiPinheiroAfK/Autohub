import { Hono } from "hono"
import { z } from "zod"
import { sql } from "../db/client.ts"
import type { AppEnv } from "../types.ts"

export const lojasPublicoRoutes = new Hono<AppEnv>()
export const lojasRoutes = new Hono<AppEnv>()

const lojaSchema = z.object({
  nome: z.string().min(2).max(100),
  descricao: z.string().max(500).optional(),
  logoUrl: z.string().url().optional().nullable(),
  bannerUrl: z.string().url().optional().nullable(),
  instagram: z.string().max(50).optional().nullable(),
  whatsapp: z.string().max(20).optional().nullable(),
  website: z.string().url().optional().nullable(),
})

async function getGaragemId(userId: string): Promise<string | null> {
  const [g] = await sql`SELECT id FROM garagens WHERE usuario_id = ${userId} LIMIT 1`
  return g?.id ?? null
}

// GET /lojas/:garagemSlug — perfil público da loja
lojasPublicoRoutes.get("/lojas/:garagemSlug", async (c) => {
  const { garagemSlug } = c.req.param()
  const [loja] = await sql`
    SELECT l.*, g.nome as garagem_nome, g.slug as garagem_slug, g.publica as garagem_publica,
           u.nome as dono_nome, u.avatar_url as dono_avatar
    FROM marketplace_lojas l
    JOIN garagens g ON g.id = l.garagem_id
    JOIN usuarios u ON u.id = g.usuario_id
    WHERE g.slug = ${garagemSlug}
  `
  if (!loja) return c.json({ error: "Loja não encontrada" }, 404)

  const anuncios = await sql`
    SELECT a.id, a.titulo, a.preco, a.moeda, a.categoria, a.condicao, a.status, a.patrocinado, a.criado_em
    FROM marketplace_anuncios a
    WHERE a.garagem_id = ${loja.garagem_id} AND a.status = 'ativo'
    ORDER BY a.patrocinado DESC, a.criado_em DESC
    LIMIT 20
  `
  return c.json({ loja, anuncios })
})

// GET /lojas/minha — loja do usuário autenticado (pode não existir)
lojasRoutes.get("/minha", async (c) => {
  const userId = c.get("userId") as string
  const garagemId = await getGaragemId(userId)
  if (!garagemId) return c.json({ error: "Garagem não encontrada" }, 404)
  const [loja] = await sql`SELECT * FROM marketplace_lojas WHERE garagem_id = ${garagemId}`
  return c.json({ loja: loja ?? null })
})

// POST /lojas — cria loja (uma por garagem)
lojasRoutes.post("/", async (c) => {
  const userId = c.get("userId") as string
  const garagemId = await getGaragemId(userId)
  if (!garagemId) return c.json({ error: "Garagem não encontrada" }, 404)

  const body = await c.req.json().catch(() => null)
  const parsed = lojaSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400)
  const d = parsed.data

  const [existing] = await sql`SELECT id FROM marketplace_lojas WHERE garagem_id = ${garagemId}`
  if (existing) return c.json({ error: "Você já tem uma loja. Use PATCH para editar." }, 409)

  const [loja] = await sql`
    INSERT INTO marketplace_lojas (garagem_id, nome, descricao, logo_url, banner_url, instagram, whatsapp, website)
    VALUES (${garagemId}, ${d.nome}, ${d.descricao ?? null}, ${d.logoUrl ?? null}, ${d.bannerUrl ?? null},
            ${d.instagram ?? null}, ${d.whatsapp ?? null}, ${d.website ?? null})
    RETURNING *
  `
  return c.json(loja, 201)
})

// PATCH /lojas — atualiza loja
lojasRoutes.patch("/", async (c) => {
  const userId = c.get("userId") as string
  const garagemId = await getGaragemId(userId)
  if (!garagemId) return c.json({ error: "Garagem não encontrada" }, 404)

  const body = await c.req.json().catch(() => null)
  const parsed = lojaSchema.partial().safeParse(body)
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400)
  const d = parsed.data

  const [current] = await sql`SELECT * FROM marketplace_lojas WHERE garagem_id = ${garagemId}`
  if (!current) return c.json({ error: "Loja não encontrada" }, 404)

  const [updated] = await sql`
    UPDATE marketplace_lojas SET
      nome        = ${d.nome        !== undefined ? d.nome        : current.nome},
      descricao   = ${d.descricao   !== undefined ? d.descricao   : current.descricao},
      logo_url    = ${d.logoUrl     !== undefined ? d.logoUrl     : current.logo_url},
      banner_url  = ${d.bannerUrl   !== undefined ? d.bannerUrl   : current.banner_url},
      instagram   = ${d.instagram   !== undefined ? d.instagram   : current.instagram},
      whatsapp    = ${d.whatsapp    !== undefined ? d.whatsapp    : current.whatsapp},
      website     = ${d.website     !== undefined ? d.website     : current.website}
    WHERE garagem_id = ${garagemId}
    RETURNING *
  `
  return c.json(updated)
})

// DELETE /lojas — deleta loja
lojasRoutes.delete("/", async (c) => {
  const userId = c.get("userId") as string
  const garagemId = await getGaragemId(userId)
  if (!garagemId) return c.json({ error: "Garagem não encontrada" }, 404)
  await sql`DELETE FROM marketplace_lojas WHERE garagem_id = ${garagemId}`
  return c.json({ deleted: true })
})
