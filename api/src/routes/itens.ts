import type { AppEnv } from "../types.ts"
import { Hono } from "hono"
import { z } from "zod"
import { sql } from "../db/client.ts"
import { authMiddleware } from "../middleware/auth.ts"

export const itensRoutes = new Hono<AppEnv>()
itensRoutes.use("*", authMiddleware)

const statusEnum = z.enum(["planejado", "andamento", "concluido"])

const createSchema = z.object({
    faseId: z.string().min(1),
    nome: z.string().min(1).max(200),
    detalhe: z.string().max(500).optional().nullable(),
    precoMin: z.number().min(0).default(0),
    precoMax: z.number().min(0).default(0),
    moeda: z.enum(["BRL", "USD", "PYG"]).default("BRL"),
    status: statusEnum.default("planejado"),
    fornecedorId: z.string().optional().nullable(),
    linkCompra: z.string().url().optional().nullable(),
})

const patchSchema = z.object({
    status: statusEnum.optional(),
    nome: z.string().min(1).max(200).optional(),
    detalhe: z.string().max(500).nullable().optional(),
    preco_min: z.number().min(0).optional(),
    preco_max: z.number().min(0).optional(),
    moeda: z.enum(["BRL", "USD", "PYG"]).optional(),
    link_compra: z.string().url().nullable().optional(),
})

// Verifica ownership: item → fase → veiculo → garagem → usuario
async function checkItemOwner(itemId: string, userId: string) {
    const [row] = await sql`
    SELECT i.id, i.fase_id FROM itens i
                         JOIN fases f ON f.id = i.fase_id
                         JOIN veiculos v ON v.id = f.veiculo_id
                         JOIN garagens g ON g.id = v.garagem_id
    WHERE i.id = ${itemId} AND g.usuario_id = ${userId}
  `
    return row ?? null
}

// Verifica que a fase pertence ao usuário (pra criar item nela)
async function checkFaseOwner(faseId: string, userId: string) {
    const [row] = await sql`
    SELECT f.id FROM fases f
                     JOIN veiculos v ON v.id = f.veiculo_id
                     JOIN garagens g ON g.id = v.garagem_id
    WHERE f.id = ${faseId} AND g.usuario_id = ${userId}
  `
    return !!row
}

/**
 * Recalcula o status da fase a partir dos itens dela e persiste.
 * Quando todo item vira concluído, a fase vira concluído (e a linha fica
 * verde no front); se algum item volta atrás, a fase volta pra andamento/planejado.
 */
async function recalcularStatusFase(faseId: string): Promise<"planejado" | "andamento" | "concluido"> {
    const [agregado] = await sql`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'concluido')::int AS concluidos
    FROM itens WHERE fase_id = ${faseId}
  `
    const { total, concluidos } = agregado as { total: number; concluidos: number }
    const novoStatus = total > 0 && concluidos === total ? "concluido"
        : concluidos > 0 ? "andamento" : "planejado"
    await sql`UPDATE fases SET status = ${novoStatus} WHERE id = ${faseId}`
    return novoStatus as "planejado" | "andamento" | "concluido"
}

// POST /itens — cria item dentro de uma fase
itensRoutes.post("/", async (c) => {
    const userId = c.get("userId") as string
    const body = await c.req.json().catch(() => null)
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
        return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400)
    }

    const d = parsed.data
    if (!(await checkFaseOwner(d.faseId, userId))) {
        return c.json({ error: "Fase não encontrada" }, 404)
    }

    const [item] = await sql`
      INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status, fornecedor_id, link_compra)
      VALUES (
        ${d.faseId}, ${d.nome}, ${d.detalhe ?? null}, ${d.precoMin}, ${d.precoMax},
        ${d.moeda}, ${d.status}, ${d.fornecedorId ?? null}, ${d.linkCompra ?? null}
      )
      RETURNING *
    `
    const faseStatus = await recalcularStatusFase(d.faseId)
    return c.json({ ...item, faseStatus }, 201)
})

// PATCH /itens/:id
itensRoutes.patch("/:id", async (c) => {
    const userId = c.get("userId") as string
    const { id } = c.req.param()

    const owned = await checkItemOwner(id, userId)
    if (!owned) {
        return c.json({ error: "Item não encontrado" }, 404)
    }

    const body = await c.req.json().catch(() => null)
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
        return c.json({ error: "Dados inválidos", details: parsed.error.flatten() }, 400)
    }

    const d = parsed.data

    if (Object.keys(d).length === 0) {
        return c.json({ error: "Nada para atualizar" }, 400)
    }

    const [current] = await sql`SELECT * FROM itens WHERE id = ${id}`
    const [updated] = await sql`
      UPDATE itens SET
        nome        = ${d.nome        !== undefined ? d.nome        : current.nome},
        detalhe     = ${d.detalhe     !== undefined ? d.detalhe     : current.detalhe},
        preco_min   = ${d.preco_min   !== undefined ? d.preco_min   : current.preco_min},
        preco_max   = ${d.preco_max   !== undefined ? d.preco_max   : current.preco_max},
        moeda       = ${d.moeda       !== undefined ? d.moeda       : current.moeda},
        status      = ${d.status      !== undefined ? d.status      : current.status},
        link_compra = ${d.link_compra !== undefined ? d.link_compra : current.link_compra}
      WHERE id = ${id}
      RETURNING *
    `
    const faseStatus = await recalcularStatusFase(owned.fase_id)
    return c.json({ ...updated, faseStatus })
})

// DELETE /itens/:id
itensRoutes.delete("/:id", async (c) => {
    const userId = c.get("userId") as string
    const { id } = c.req.param()

    const owned = await checkItemOwner(id, userId)
    if (!owned) {
        return c.json({ error: "Item não encontrado" }, 404)
    }

    await sql`DELETE FROM itens WHERE id = ${id}`
    const faseStatus = await recalcularStatusFase(owned.fase_id)
    return c.json({ deleted: true, faseStatus })
})
