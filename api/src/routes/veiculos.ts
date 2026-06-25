import type { AppEnv } from "../types"
import { Hono } from "hono"
import { z } from "zod"
import { sql } from "../db/client"
import { authMiddleware } from "../middleware/auth"

export const veiculosRoutes = new Hono<AppEnv>()

// Todas as rotas exigem auth
veiculosRoutes.use("*", authMiddleware)

const veiculoSchema = z.object({
  apelido: z.string().min(1).max(120),
  marca: z.string().min(1).max(80),
  modelo: z.string().min(1).max(120),
  anoFabricacao: z.number().int().min(1900).max(2030),
  anoModelo: z.number().int().min(1900).max(2030),
  perfil: z.enum(["daily", "street_build", "restomod", "track", "project"]),
  status: z.enum(["planejamento", "em_andamento", "concluido", "pausado"]).default("planejamento"),
  visibilidade: z.enum(["publico", "privado"]).default("privado"),
  capaUrl: z.string().url().optional().nullable(),
  metaPotenciaWhp: z.number().int().positive().optional().nullable(),
})

// Busca a garagem do usuário autenticado
async function getGaragemId(userId: string): Promise<string | null> {
  const [g] = await sql`SELECT id FROM garagens WHERE usuario_id = ${userId} LIMIT 1`
  return g?.id ?? null
}

// GET /veiculos — lista veículos da garagem do usuário
veiculosRoutes.get("/", async (c) => {
  const userId = c.get("userId") as string
  const garagemId = await getGaragemId(userId)
  if (!garagemId) return c.json({ error: "Garagem não encontrada" }, 404)

  const veiculos = await sql`
    SELECT v.*,
           COUNT(DISTINCT f.id)::int AS total_fases,
      COUNT(DISTINCT i.id)::int AS total_itens,
      COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'concluido')::int AS itens_concluidos
    FROM veiculos v
           LEFT JOIN fases f ON f.veiculo_id = v.id
           LEFT JOIN itens i ON i.fase_id = f.id
    WHERE v.garagem_id = ${garagemId}
    GROUP BY v.id
    ORDER BY v.criado_em DESC
  `

  return c.json(veiculos)
})

// GET /veiculos/:id — detalhe com fases e itens
veiculosRoutes.get("/:id", async (c) => {
  const userId = c.get("userId") as string
  const garagemId = await getGaragemId(userId)
  if (!garagemId) return c.json({ error: "Garagem não encontrada" }, 404)

  const { id } = c.req.param()

  const [veiculo] = await sql`
    SELECT * FROM veiculos
    WHERE id = ${id} AND garagem_id = ${garagemId}
  `
  if (!veiculo) return c.json({ error: "Veículo não encontrado" }, 404)

  const fases = await sql`
    SELECT f.*,
           COUNT(i.id)::int AS total_itens,
      COUNT(i.id) FILTER (WHERE i.status = 'concluido')::int AS itens_concluidos,
      COALESCE(SUM(i.preco_max) FILTER (WHERE i.status = 'concluido'), 0) AS gasto_realizado
    FROM fases f
           LEFT JOIN itens i ON i.fase_id = f.id
    WHERE f.veiculo_id = ${id}
    GROUP BY f.id
    ORDER BY f.ordem
  `

// Itens de todas as fases de uma vez
  // Substituímos (f: { id: string }) por (f: any)
  const faseIds = fases.map((f: any) => f.id)

  const itens = faseIds.length
      ? await sql`
        SELECT i.*, fo.nome AS fornecedor_nome, fo.pais AS fornecedor_pais
        FROM itens i
               LEFT JOIN fornecedores fo ON fo.id = i.fornecedor_id
        WHERE i.fase_id = ANY(${faseIds})
        ORDER BY i.id ASC -- Usa o ID ou a data para manter a ordem!
      `
      : []

  // Agrupa itens por fase
  // Tipamos o acc e o item para evitar o conflito do typeof itens
  const itensPorFase = itens.reduce((acc: Record<string, any[]>, item: any) => {
    if (!acc[item.fase_id]) acc[item.fase_id] = []
    acc[item.fase_id].push(item)
    return acc
  }, {})

  return c.json({
    ...veiculo,
    // Substituímos (f: { id: string }) por (f: any) novamente
    fases: fases.map((f: any) => ({
      ...f,
      itens: itensPorFase[f.id] ?? [],
    })),
  })
})

// POST /veiculos — cria veículo
veiculosRoutes.post("/", async (c) => {
  const userId = c.get("userId") as string
  const garagemId = await getGaragemId(userId)
  if (!garagemId) return c.json({ error: "Garagem não encontrada" }, 404)

  const body = await c.req.json().catch(() => null)
  const parsed = veiculoSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400)
  }

  const d = parsed.data
  const [veiculo] = await sql`
    INSERT INTO veiculos (
      garagem_id, apelido, marca, modelo,
      ano_fabricacao, ano_modelo, perfil, status,
      visibilidade, capa_url, meta_potencia_whp
    ) VALUES (
               ${garagemId}, ${d.apelido}, ${d.marca}, ${d.modelo},
               ${d.anoFabricacao}, ${d.anoModelo}, ${d.perfil}, ${d.status},
               ${d.visibilidade}, ${d.capaUrl ?? null}, ${d.metaPotenciaWhp ?? null}
             )
      RETURNING *
  `

  return c.json(veiculo, 201)
})

// PATCH /veiculos/:id — atualiza campos parcialmente
veiculosRoutes.patch("/:id", async (c) => {
  const userId = c.get("userId") as string
  const garagemId = await getGaragemId(userId)
  if (!garagemId) return c.json({ error: "Garagem não encontrada" }, 404)

  const { id } = c.req.param()
  const body = await c.req.json().catch(() => null)
  const parsed = veiculoSchema.partial().safeParse(body)
  if (!parsed.success) {
    return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400)
  }

  const d = parsed.data
  const fields: Record<string, unknown> = {}
  if (d.apelido !== undefined) fields.apelido = d.apelido
  if (d.marca !== undefined) fields.marca = d.marca
  if (d.modelo !== undefined) fields.modelo = d.modelo
  if (d.anoFabricacao !== undefined) fields.ano_fabricacao = d.anoFabricacao
  if (d.anoModelo !== undefined) fields.ano_modelo = d.anoModelo
  if (d.perfil !== undefined) fields.perfil = d.perfil
  if (d.status !== undefined) fields.status = d.status
  if (d.visibilidade !== undefined) fields.visibilidade = d.visibilidade
  if (d.capaUrl !== undefined) fields.capa_url = d.capaUrl
  if (d.metaPotenciaWhp !== undefined) fields.meta_potencia_whp = d.metaPotenciaWhp

  if (Object.keys(fields).length === 0) {
    return c.json({ error: "Nenhum campo para atualizar" }, 400)
  }

  // Verifica ownership antes de atualizar
  const [existing] = await sql`
    SELECT id FROM veiculos WHERE id = ${id} AND garagem_id = ${garagemId}
  `
  if (!existing) return c.json({ error: "Veículo não encontrado" }, 404)

  const [updated] = await sql`
    UPDATE veiculos SET ${sql(fields)} WHERE id = ${id} RETURNING *
  `

  return c.json(updated)
})

// DELETE /veiculos/:id
veiculosRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId") as string
  const garagemId = await getGaragemId(userId)
  if (!garagemId) return c.json({ error: "Garagem não encontrada" }, 404)

  const { id } = c.req.param()

  const result = await sql`
    DELETE FROM veiculos
    WHERE id = ${id} AND garagem_id = ${garagemId}
      RETURNING id
  `

  if (result.length === 0) return c.json({ error: "Veículo não encontrado" }, 404)
  return c.json({ deleted: true })
})
