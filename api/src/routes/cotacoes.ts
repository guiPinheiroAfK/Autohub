import { Hono } from "hono"
import { sql } from "../db/client.ts"

export const cotacoesRoutes = new Hono()

// GET /api/cotacoes — retorna a cotação mais recente de cada par
cotacoesRoutes.get("/", async (c) => {
  const rows = await sql`
    SELECT DISTINCT ON (par)
      par, taxa_compra, taxa_venda, data, criado_em
    FROM cotacoes
    ORDER BY par, data DESC, criado_em DESC
  `

  return c.json({
    cotacoes: rows.map(r => ({
      par:          r.par,
      taxa_compra:  Number(r.taxa_compra),
      taxa_venda:   Number(r.taxa_venda),
      data:         r.data,
      criado_em:    r.criado_em,
    })),
  })
})
