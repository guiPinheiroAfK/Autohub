import type { AppEnv } from "../types"
import { Hono } from "hono"
import { z } from "zod"
import { sql } from "../db/client"
import { authMiddleware } from "../middleware/auth"

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
 * Recalcula o status da fase a partir dos itens dela e persiste, dentro
 * da mesma transação do caller. É o "feedback" pedido: quando todo item
 * vira concluído, a fase vira concluído (e a linha fica verde no front);
 * se algum item volta atrás, a fase volta pra andamento/planejado.
 */
import type { TransactionSql } from "postgres"

async function recalcularStatusFase(
    tx: TransactionSql,
    faseId: string
): Promise<"planejado" | "andamento" | "concluido"> {
    const [agregado] = await tx`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'concluido')::int AS concluidos
    FROM itens WHERE fase_id = ${faseId}
  `
    const total = agregado?.total ?? 0
    const concluidos = agregado?.concluidos ?? 0

    const novoStatus = total > 0 && concluidos === total ? "concluido" : concluidos > 0 ? "andamento" : "planejado"

    await tx`UPDATE fases SET status = ${novoStatus} WHERE id = ${faseId}`
    return novoStatus
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

    const [item, faseStatus] = await sql.begin(async (tx) => {
        const [i] = await tx`
      INSERT INTO itens (fase_id, nome, detalhe, preco_min, preco_max, moeda, status, fornecedor_id, link_compra)
      VALUES (
        ${d.faseId}, ${d.nome}, ${d.detalhe ?? null}, ${d.precoMin}, ${d.precoMax},
        ${d.moeda}, ${d.status}, ${d.fornecedorId ?? null}, ${d.linkCompra ?? null}
      )
      RETURNING *
    `
        const status = await recalcularStatusFase(tx, d.faseId)
        return [i, status]
    })

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
    const fields: Record<string, unknown> = {}
    if (d.status !== undefined) fields.status = d.status
    if (d.nome !== undefined) fields.nome = d.nome
    if (d.detalhe !== undefined) fields.detalhe = d.detalhe
    if (d.preco_min !== undefined) fields.preco_min = d.preco_min
    if (d.preco_max !== undefined) fields.preco_max = d.preco_max
    if (d.moeda !== undefined) fields.moeda = d.moeda
    if (d.link_compra !== undefined) fields.link_compra = d.link_compra

    if (Object.keys(fields).length === 0) {
        return c.json({ error: "Nada para atualizar" }, 400)
    }

    const [updated, faseStatus] = await sql.begin(async (tx) => {
        const [i] = await tx`UPDATE itens SET ${tx(fields)} WHERE id = ${id} RETURNING *`
        const status = await recalcularStatusFase(tx, owned.fase_id)
        return [i, status]
    })

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

    const [, faseStatus] = await sql.begin(async (tx) => {
        await tx`DELETE FROM itens WHERE id = ${id}`
        const status = await recalcularStatusFase(tx, owned.fase_id)
        return [null, status]
    })

    return c.json({ deleted: true, faseStatus })
})
