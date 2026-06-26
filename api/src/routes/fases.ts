import type { AppEnv } from "../types.ts"
import { Hono } from "hono"
import { z } from "zod"
import { sql } from "../db/client.ts"
import { authMiddleware } from "../middleware/auth.ts"

export const fasesRoutes = new Hono<AppEnv>()
fasesRoutes.use("*", authMiddleware)

const faseSchema = z.object({
  titulo: z.string().min(1).max(200),
  ordem: z.number().int().min(0).default(0),
  status: z.enum(["planejado", "andamento", "concluido"]).default("planejado"),
  orcamentoMin: z.number().min(0).default(0),
  orcamentoMax: z.number().min(0).default(0),
  moeda: z.enum(["BRL", "USD", "PYG"]).default("BRL"),
  nota: z.string().optional().nullable(),
})

// Verifica que o veículo pertence ao usuário
async function checkVeiculoOwner(veiculoId: string, userId: string) {
  const [row] = await sql`
    SELECT v.id FROM veiculos v
                       JOIN garagens g ON g.id = v.garagem_id
    WHERE v.id = ${veiculoId} AND g.usuario_id = ${userId}
  `
  return !!row
}

// GET /veiculos/:veiculoId/fases
fasesRoutes.get("/veiculos/:veiculoId/fases", async (c) => {
  const userId = c.get("userId") as string
  const { veiculoId } = c.req.param()
  if (!(await checkVeiculoOwner(veiculoId, userId))) {
    return c.json({ error: "Veículo não encontrado" }, 404)
  }

  const fases = await sql`
    SELECT f.*,
           COUNT(i.id)::int AS total_itens,
      COUNT(i.id) FILTER (WHERE i.status = 'concluido')::int AS itens_concluidos
    FROM fases f
           LEFT JOIN itens i ON i.fase_id = f.id
    WHERE f.veiculo_id = ${veiculoId}
    GROUP BY f.id
    ORDER BY f.ordem
  `
  return c.json(fases)
})

// POST /veiculos/:veiculoId/fases
fasesRoutes.post("/veiculos/:veiculoId/fases", async (c) => {
  const userId = c.get("userId") as string
  const { veiculoId } = c.req.param()
  if (!(await checkVeiculoOwner(veiculoId, userId))) {
    return c.json({ error: "Veículo não encontrado" }, 404)
  }

  const body = await c.req.json().catch(() => null)
  const parsed = faseSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400)

  const d = parsed.data
  const [fase] = await sql`
    INSERT INTO fases (veiculo_id, titulo, ordem, status, orcamento_min, orcamento_max, moeda, nota)
    VALUES (${veiculoId}, ${d.titulo}, ${d.ordem}, ${d.status}, ${d.orcamentoMin}, ${d.orcamentoMax}, ${d.moeda}, ${d.nota ?? null})
      RETURNING *
  `
  return c.json(fase, 201)
})

// PATCH /fases/:id
fasesRoutes.patch("/fases/:id", async (c) => {
  const userId = c.get("userId") as string
  const { id } = c.req.param()

  const [fase] = await sql`
    SELECT f.id, f.veiculo_id FROM fases f
                                     JOIN veiculos v ON v.id = f.veiculo_id
                                     JOIN garagens g ON g.id = v.garagem_id
    WHERE f.id = ${id} AND g.usuario_id = ${userId}
  `
  if (!fase) return c.json({ error: "Fase não encontrada" }, 404)

  const body = await c.req.json().catch(() => null)
  const parsed = faseSchema.partial().safeParse(body)
  if (!parsed.success) return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400)

  const d = parsed.data

  if (Object.keys(d).length === 0) return c.json({ error: "Nada para atualizar" }, 400)

  const [current] = await sql`SELECT * FROM fases WHERE id = ${id}`
  const [updated] = await sql`
    UPDATE fases SET
      titulo        = ${d.titulo       !== undefined ? d.titulo       : current.titulo},
      ordem         = ${d.ordem        !== undefined ? d.ordem        : current.ordem},
      status        = ${d.status       !== undefined ? d.status       : current.status},
      orcamento_min = ${d.orcamentoMin !== undefined ? d.orcamentoMin : current.orcamento_min},
      orcamento_max = ${d.orcamentoMax !== undefined ? d.orcamentoMax : current.orcamento_max},
      moeda         = ${d.moeda        !== undefined ? d.moeda        : current.moeda},
      nota          = ${d.nota         !== undefined ? d.nota         : current.nota}
    WHERE id = ${id}
    RETURNING *
  `
  return c.json(updated)
})

// POST /fases/:id/resetar — "zerar fase" pro caso de eterno stage 0:
// volta a fase e todos os itens dela pra "planejado".
fasesRoutes.post("/fases/:id/resetar", async (c) => {
  const userId = c.get("userId") as string
  const { id } = c.req.param()

  const [fase] = await sql`
    SELECT f.id FROM fases f
                     JOIN veiculos v ON v.id = f.veiculo_id
                     JOIN garagens g ON g.id = v.garagem_id
    WHERE f.id = ${id} AND g.usuario_id = ${userId}
  `
  if (!fase) return c.json({ error: "Fase não encontrada" }, 404)

  const [, [updated]] = await sql.transaction((tx) => [
    tx`UPDATE itens SET status = 'planejado' WHERE fase_id = ${id}`,
    tx`UPDATE fases SET status = 'planejado' WHERE id = ${id} RETURNING *`,
  ])

  return c.json(updated)
})

// DELETE /fases/:id
fasesRoutes.delete("/fases/:id", async (c) => {
  const userId = c.get("userId") as string
  const { id } = c.req.param()

  const result = await sql`
    DELETE FROM fases f
      USING veiculos v, garagens g
    WHERE f.id = ${id}
      AND f.veiculo_id = v.id
      AND v.garagem_id = g.id
      AND g.usuario_id = ${userId}
      RETURNING f.id
  `
  if (result.length === 0) return c.json({ error: "Fase não encontrada" }, 404)
  return c.json({ deleted: true })
})
