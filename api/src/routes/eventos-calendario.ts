import { Hono } from "hono"
import { z } from "zod"
import { sql } from "../db/client.ts"
import type { AppEnv } from "../types.ts"

export const eventosPublicoRoutes = new Hono<AppEnv>()
export const eventosRoutes = new Hono<AppEnv>()

const eventoSchema = z.object({
  titulo: z.string().min(3).max(150),
  descricao: z.string().max(1000).optional(),
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  local: z.string().max(150).optional(),
  url: z.string().url().optional().nullable(),
  imagemUrl: z.string().url().optional().nullable(),
  tipo: z.enum(["encontro", "corrida", "rally", "drift", "exposicao", "show", "patrocinado"]).default("encontro"),
})

async function getGaragemId(userId: string): Promise<string | null> {
  const [g] = await sql`SELECT id FROM garagens WHERE usuario_id = ${userId} LIMIT 1`
  return g?.id ?? null
}

// GET /eventos-calendario — lista eventos futuros + alguns passados
eventosPublicoRoutes.get("/eventos-calendario", async (c) => {
  const { mes, ano } = c.req.query()

  let eventos
  if (mes && ano) {
    eventos = await sql`
      SELECT e.*, g.nome as garagem_nome, g.slug as garagem_slug, u.nome as criado_por_nome
      FROM eventos_calendario e
      LEFT JOIN garagens g ON g.id = e.garagem_id
      LEFT JOIN usuarios u ON u.id = e.criado_por
      WHERE date_trunc('month', e.data_inicio) = ${`${ano}-${mes.padStart(2, "0")}-01`}::date
      ORDER BY e.patrocinado DESC, e.data_inicio ASC
    `
  } else {
    eventos = await sql`
      SELECT e.*, g.nome as garagem_nome, g.slug as garagem_slug, u.nome as criado_por_nome
      FROM eventos_calendario e
      LEFT JOIN garagens g ON g.id = e.garagem_id
      LEFT JOIN usuarios u ON u.id = e.criado_por
      WHERE e.data_inicio >= CURRENT_DATE - interval '7 days'
      ORDER BY e.patrocinado DESC, e.data_inicio ASC
      LIMIT 50
    `
  }
  return c.json({ eventos })
})

// POST /eventos-calendario — cria evento (qualquer usuário autenticado)
eventosRoutes.post("/", async (c) => {
  const userId = c.get("userId") as string
  const garagemId = await getGaragemId(userId)
  const body = await c.req.json().catch(() => null)
  const parsed = eventoSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400)
  const d = parsed.data

  const [evento] = await sql`
    INSERT INTO eventos_calendario (titulo, descricao, data_inicio, data_fim, local, url, imagem_url, tipo, garagem_id, criado_por)
    VALUES (${d.titulo}, ${d.descricao ?? null}, ${d.dataInicio}, ${d.dataFim ?? null},
            ${d.local ?? null}, ${d.url ?? null}, ${d.imagemUrl ?? null}, ${d.tipo},
            ${garagemId ?? null}, ${userId})
    RETURNING *
  `
  return c.json(evento, 201)
})

// DELETE /eventos-calendario/:id — dono pode deletar
eventosRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId") as string
  const { id } = c.req.param()
  const result = await sql`
    DELETE FROM eventos_calendario WHERE id = ${id} AND criado_por = ${userId} RETURNING id
  `
  if (result.length === 0) return c.json({ error: "Evento não encontrado ou sem permissão" }, 404)
  return c.json({ deleted: true })
})
