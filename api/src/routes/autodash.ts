import { Hono } from "hono"
import { sql } from "../db/client.ts"

/**
 * Leaderboard global do AutoDash (minigame em /autodash no front).
 * Rotas públicas: o jogo roda sem login; scores são assinados pelo nome
 * de piloto salvo no navegador.
 */
export const autodashRoutes = new Hono()

const TOP_N = 10

async function topScores() {
  return sql`
    SELECT nome, pontos, km, criado_em
    FROM autodash_scores
    ORDER BY pontos DESC, criado_em ASC
    LIMIT ${TOP_N}
  `
}

// GET /api/autodash/leaderboard — top 10 global
autodashRoutes.get("/autodash/leaderboard", async (c) => {
  return c.json({ scores: await topScores() })
})

// POST /api/autodash/score — registra uma corrida e devolve o top atualizado
autodashRoutes.post("/autodash/score", async (c) => {
  const body = await c.req.json().catch(() => null)
  const nome = String(body?.nome ?? "").trim().slice(0, 12)
  const pontos = Math.floor(Number(body?.pontos))
  const km = Math.round(Number(body?.km) * 10) / 10

  if (!nome || !Number.isFinite(pontos) || pontos <= 0 || pontos > 10_000_000) {
    return c.json({ error: "Score inválido" }, 400)
  }
  if (!Number.isFinite(km) || km < 0 || km > 2000) {
    return c.json({ error: "Distância inválida" }, 400)
  }

  await sql`
    INSERT INTO autodash_scores (nome, pontos, km)
    VALUES (${nome}, ${pontos}, ${km})
  `
  return c.json({ scores: await topScores() })
})
