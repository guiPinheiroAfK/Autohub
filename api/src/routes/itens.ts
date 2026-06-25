import type { AppEnv } from "../types"
import { Hono } from "hono"
import { z } from "zod"
import { sql } from "../db/client"
import { authMiddleware } from "../middleware/auth"

export const itensRoutes = new Hono<AppEnv>()
itensRoutes.use("*", authMiddleware)

const patchSchema = z.object({
    status: z.enum(["planejado", "andamento", "concluido"]).optional(),
    nome: z.string().min(1).max(200).optional(),
    detalhe: z.string().nullable().optional(),
    preco_min: z.number().min(0).optional(),
    preco_max: z.number().min(0).optional(),
    moeda: z.enum(["BRL", "USD", "PYG"]).optional(),
    link_compra: z.string().url().nullable().optional(),
})

// Verifica ownership: item → fase → veiculo → garagem → usuario
async function checkItemOwner(itemId: string, userId: string) {
    const [row] = await sql`
        SELECT i.id FROM itens i
                             JOIN fases f ON f.id = i.fase_id
                             JOIN veiculos v ON v.id = f.veiculo_id
                             JOIN garagens g ON g.id = v.garagem_id
        WHERE i.id = ${itemId} AND g.usuario_id = ${userId}
    `
    return row ? row.id : null
}

// PATCH /itens/:id
itensRoutes.patch("/:id", async (c) => {
    const userId = c.get("userId") as string
    const { id } = c.req.param()

    if (!(await checkItemOwner(id, userId))) {
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

    const [updated] = await sql`
        UPDATE itens SET ${sql(fields)} WHERE id = ${id} RETURNING *
    `

    return c.json(updated)
})
