import { Hono } from "hono"
import { z } from "zod"
import { sql } from "../db/client"
import type { AppEnv } from "../types"

export const marketplacePublicoRoutes = new Hono<AppEnv>()
export const marketplaceRoutes = new Hono<AppEnv>()

const CATEGORIAS = ["motor","suspensao","freios","eletrica","carroceria","rodas","interior","acessorios","veiculo_completo","outro"] as const
const CONDICOES  = ["novo","usado","recondicionado"] as const
const MOEDAS     = ["BRL","USD","PYG"] as const

const anuncioSchema = z.object({
  titulo:      z.string().min(3).max(120),
  descricao:   z.string().max(1000).optional(),
  preco:       z.number().positive().optional(),
  moeda:       z.enum(MOEDAS).default("BRL"),
  categoria:   z.enum(CATEGORIAS),
  condicao:    z.enum(CONDICOES),
  localizacao: z.string().max(100).optional(),
})

// GET /marketplace — listagem pública com filtros
marketplacePublicoRoutes.get("/marketplace", async (c) => {
  const { categoria, condicao, q, limit = "20", offset = "0" } = c.req.query()
  const lim = Math.min(Number(limit), 50)
  const off = Number(offset)

  const anuncios = await sql`
    SELECT a.id, a.titulo, a.descricao, a.preco, a.moeda, a.categoria, a.condicao,
           a.localizacao, a.status, a.criado_em,
           g.id as garagem_id, g.nome as garagem_nome, g.slug as garagem_slug,
           u.nome as vendedor_nome,
           (SELECT COUNT(*)::int FROM marketplace_interesses WHERE anuncio_id = a.id) as total_interesses
    FROM marketplace_anuncios a
    JOIN garagens g ON g.id = a.garagem_id
    JOIN usuarios u ON u.id = g.usuario_id
    WHERE a.status = 'ativo'
      ${categoria ? sql`AND a.categoria = ${categoria}` : sql``}
      ${condicao  ? sql`AND a.condicao  = ${condicao}`  : sql``}
      ${q ? sql`AND (a.titulo ILIKE ${'%' + q + '%'} OR a.descricao ILIKE ${'%' + q + '%'})` : sql``}
    ORDER BY a.criado_em DESC
    LIMIT ${lim} OFFSET ${off}
  `

  const [{ total }] = await sql`
    SELECT COUNT(*)::int as total FROM marketplace_anuncios
    WHERE status = 'ativo'
      ${categoria ? sql`AND categoria = ${categoria}` : sql``}
      ${condicao  ? sql`AND condicao  = ${condicao}`  : sql``}
      ${q ? sql`AND (titulo ILIKE ${'%' + q + '%'} OR descricao ILIKE ${'%' + q + '%'})` : sql``}
  `

  return c.json({ anuncios, total, limit: lim, offset: off })
})

// GET /marketplace/:id — detalhes públicos
marketplacePublicoRoutes.get("/marketplace/:id", async (c) => {
  const { id } = c.req.param()

  const [anuncio] = await sql`
    SELECT a.id, a.titulo, a.descricao, a.preco, a.moeda, a.categoria, a.condicao,
           a.localizacao, a.status, a.criado_em,
           g.id as garagem_id, g.nome as garagem_nome, g.slug as garagem_slug,
           u.nome as vendedor_nome
    FROM marketplace_anuncios a
    JOIN garagens g ON g.id = a.garagem_id
    JOIN usuarios u ON u.id = g.usuario_id
    WHERE a.id = ${id}
  `

  if (!anuncio) return c.json({ error: "Não encontrado" }, 404)
  return c.json(anuncio)
})

// GET /api/marketplace/meus — meus anúncios
marketplaceRoutes.get("/meus", async (c) => {
  const userId = c.get("userId") as string

  const [garagem] = await sql`SELECT id FROM garagens WHERE usuario_id = ${userId}`
  if (!garagem) return c.json({ anuncios: [] })

  const anuncios = await sql`
    SELECT id, titulo, preco, moeda, categoria, condicao, status, criado_em
    FROM marketplace_anuncios
    WHERE garagem_id = ${garagem.id}
    ORDER BY criado_em DESC
  `
  return c.json({ anuncios })
})

// POST /api/marketplace — criar anúncio
marketplaceRoutes.post("/", async (c) => {
  const userId = c.get("userId") as string

  const [garagem] = await sql`SELECT id FROM garagens WHERE usuario_id = ${userId}`
  if (!garagem) return c.json({ error: "Garagem não encontrada" }, 400)

  const body = await c.req.json().catch(() => null)
  const parsed = anuncioSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: "Dados inválidos", detalhes: parsed.error.flatten() }, 400)

  const { titulo, descricao, preco, moeda, categoria, condicao, localizacao } = parsed.data

  const [anuncio] = await sql`
    INSERT INTO marketplace_anuncios (garagem_id, titulo, descricao, preco, moeda, categoria, condicao, localizacao)
    VALUES (${garagem.id}, ${titulo}, ${descricao ?? null}, ${preco ?? null}, ${moeda}, ${categoria}, ${condicao}, ${localizacao ?? null})
    RETURNING *
  `
  return c.json(anuncio, 201)
})

// PATCH /api/marketplace/:id — atualizar anúncio
marketplaceRoutes.patch("/:id", async (c) => {
  const userId = c.get("userId") as string
  const { id } = c.req.param()

  const [garagem] = await sql`SELECT id FROM garagens WHERE usuario_id = ${userId}`
  if (!garagem) return c.json({ error: "Garagem não encontrada" }, 400)

  const [anuncio] = await sql`SELECT id FROM marketplace_anuncios WHERE id = ${id} AND garagem_id = ${garagem.id}`
  if (!anuncio) return c.json({ error: "Não encontrado ou sem permissão" }, 404)

  const body = await c.req.json().catch(() => null)
  const parsed = anuncioSchema.partial().safeParse(body)
  if (!parsed.success) return c.json({ error: "Dados inválidos" }, 400)

  const d = parsed.data
  const [updated] = await sql`
    UPDATE marketplace_anuncios SET
      titulo        = COALESCE(${d.titulo ?? null}, titulo),
      descricao     = COALESCE(${d.descricao ?? null}, descricao),
      preco         = COALESCE(${d.preco ?? null}, preco),
      moeda         = COALESCE(${d.moeda ?? null}, moeda),
      categoria     = COALESCE(${d.categoria ?? null}, categoria),
      condicao      = COALESCE(${d.condicao ?? null}, condicao),
      localizacao   = COALESCE(${d.localizacao ?? null}, localizacao),
      atualizado_em = now()
    WHERE id = ${id}
    RETURNING *
  `
  return c.json(updated)
})

// PATCH /api/marketplace/:id/status — ativo/pausado/vendido
marketplaceRoutes.patch("/:id/status", async (c) => {
  const userId = c.get("userId") as string
  const { id } = c.req.param()

  const [garagem] = await sql`SELECT id FROM garagens WHERE usuario_id = ${userId}`
  if (!garagem) return c.json({ error: "Garagem não encontrada" }, 400)

  const body = await c.req.json().catch(() => ({}))
  const status = body?.status
  if (!["ativo","pausado","vendido"].includes(status)) return c.json({ error: "Status inválido" }, 400)

  const [updated] = await sql`
    UPDATE marketplace_anuncios SET status = ${status}, atualizado_em = now()
    WHERE id = ${id} AND garagem_id = ${garagem.id}
    RETURNING id, status
  `
  if (!updated) return c.json({ error: "Não encontrado" }, 404)
  return c.json(updated)
})

// POST /api/marketplace/:id/interesse — demonstrar interesse
marketplaceRoutes.post("/:id/interesse", async (c) => {
  const userId = c.get("userId") as string
  const { id } = c.req.param()

  const [anuncio] = await sql`
    SELECT a.id, a.titulo, g.usuario_id as dono_id, u.nome as dono_nome,
           ud.nome as interessado_nome
    FROM marketplace_anuncios a
    JOIN garagens g ON g.id = a.garagem_id
    JOIN usuarios u ON u.id = g.usuario_id
    JOIN usuarios ud ON ud.id = ${userId}
    WHERE a.id = ${id} AND a.status = 'ativo'
  `
  if (!anuncio) return c.json({ error: "Anúncio não encontrado ou inativo" }, 404)
  if (anuncio.dono_id === userId) return c.json({ error: "Você é o vendedor deste anúncio" }, 400)

  const body = await c.req.json().catch(() => ({}))
  const mensagem = typeof body?.mensagem === "string" ? body.mensagem.trim().slice(0, 500) : null

  const [existente] = await sql`SELECT id FROM marketplace_interesses WHERE anuncio_id = ${id} AND usuario_id = ${userId}`
  if (existente) return c.json({ error: "Você já demonstrou interesse neste anúncio" }, 409)

  await sql`
    INSERT INTO marketplace_interesses (anuncio_id, usuario_id, mensagem)
    VALUES (${id}, ${userId}, ${mensagem})
  `

  // Notifica o dono do anúncio
  const texto = mensagem
    ? `${anuncio.interessado_nome} demonstrou interesse em "${anuncio.titulo}": "${mensagem.slice(0, 80)}${mensagem.length > 80 ? "…" : ""}"`
    : `${anuncio.interessado_nome} demonstrou interesse em "${anuncio.titulo}"`

  await sql`
    INSERT INTO notificacoes (usuario_id, tipo, titulo, corpo, link)
    VALUES (${anuncio.dono_id}, 'update_build',
            'Novo interesse no marketplace',
            ${texto},
            ${`/marketplace`})
  `

  return c.json({ ok: true }, 201)
})

// DELETE /api/marketplace/:id/interesse — cancelar interesse
marketplaceRoutes.delete("/:id/interesse", async (c) => {
  const userId = c.get("userId") as string
  const { id } = c.req.param()

  await sql`DELETE FROM marketplace_interesses WHERE anuncio_id = ${id} AND usuario_id = ${userId}`
  return c.json({ ok: true })
})

// GET /api/marketplace/:id/interesses — lista de interessados (somente dono)
marketplaceRoutes.get("/:id/interesses", async (c) => {
  const userId = c.get("userId") as string
  const { id } = c.req.param()

  const [garagem] = await sql`SELECT id FROM garagens WHERE usuario_id = ${userId}`
  const [anuncio] = await sql`SELECT id FROM marketplace_anuncios WHERE id = ${id} AND garagem_id = ${garagem?.id}`
  if (!anuncio) return c.json({ error: "Sem acesso" }, 403)

  const interesses = await sql`
    SELECT i.id, i.mensagem, i.criado_em,
           u.nome, u.email, g.slug as garagem_slug, g.nome as garagem_nome
    FROM marketplace_interesses i
    JOIN usuarios u ON u.id = i.usuario_id
    LEFT JOIN garagens g ON g.usuario_id = i.usuario_id
    WHERE i.anuncio_id = ${id}
    ORDER BY i.criado_em DESC
  `
  return c.json({ interesses })
})

// GET /api/marketplace/:id/meu-interesse — verifica se o usuário já demonstrou interesse
marketplaceRoutes.get("/:id/meu-interesse", async (c) => {
  const userId = c.get("userId") as string
  const { id } = c.req.param()
  const [i] = await sql`SELECT id FROM marketplace_interesses WHERE anuncio_id = ${id} AND usuario_id = ${userId}`
  return c.json({ interesse: !!i })
})

// DELETE /api/marketplace/:id — remover anúncio
marketplaceRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId") as string
  const { id } = c.req.param()

  const [garagem] = await sql`SELECT id FROM garagens WHERE usuario_id = ${userId}`
  if (!garagem) return c.json({ error: "Garagem não encontrada" }, 400)

  const [deleted] = await sql`
    DELETE FROM marketplace_anuncios WHERE id = ${id} AND garagem_id = ${garagem.id} RETURNING id
  `
  if (!deleted) return c.json({ error: "Não encontrado" }, 404)
  return c.json({ ok: true })
})
