import { Hono } from "hono"
import { sql } from "../db/client"
import type { AppEnv } from "../types"

export const tracksRoutes = new Hono<AppEnv>()

// ── GET /api/tracks/rotas ─────────────────────────────────────────────────────

tracksRoutes.get("/rotas", async (c) => {
  const rotas = await sql`
    SELECT r.*,
      COUNT(ru.id) FILTER (WHERE ru.status = 'concluida') AS total_runs
    FROM rotas r
    LEFT JOIN runs ru ON ru.rota_id = r.id
    WHERE r.ativa = true
    GROUP BY r.id
    ORDER BY r.regiao, r.nome
  `
  return c.json({ rotas })
})

// ── GET /api/tracks/rotas/:id ─────────────────────────────────────────────────

tracksRoutes.get("/rotas/:id", async (c) => {
  const rotaId = c.req.param("id")
  const [rota] = await sql`SELECT * FROM rotas WHERE id = ${rotaId} AND ativa = true`
  if (!rota) return c.json({ error: "Rota não encontrada" }, 404)
  return c.json({ rota })
})

// ── GET /api/tracks/rotas/:id/leaderboard ─────────────────────────────────────

tracksRoutes.get("/rotas/:id/leaderboard", async (c) => {
  const rotaId = c.req.param("id")
  const modo = (c.req.query("modo") ?? "regularidade") as "regularidade" | "tempo"
  const perfil = c.req.query("perfil")

  const [rota] = await sql`SELECT tempo_ideal_s FROM rotas WHERE id = ${rotaId}`
  if (!rota) return c.json({ error: "Rota não encontrada" }, 404)

  const perfilFilter = perfil && perfil !== "todos" ? sql`AND v.perfil = ${perfil}` : sql``

  const entries = await sql`
    SELECT
      ru.id,
      ru.duracao_s,
      ru.vel_media_kmh,
      ru.vel_max_kmh,
      ru.clima,
      ru.periodo_dia,
      ru.concluida_em,
      ABS(ru.duracao_s - ${rota.tempo_ideal_s ?? 0}) AS diff_ideal_s,
      u.nome    AS usuario_nome,
      v.apelido AS veiculo_apelido,
      v.marca   AS veiculo_marca,
      v.modelo  AS veiculo_modelo,
      v.perfil  AS veiculo_perfil
    FROM runs ru
    JOIN usuarios u  ON u.id  = ru.usuario_id
    JOIN veiculos v  ON v.id  = ru.veiculo_id
    WHERE ru.rota_id = ${rotaId}
      AND ru.status  = 'concluida'
      AND ru.duracao_s IS NOT NULL
      ${perfilFilter}
    ORDER BY ${modo === "regularidade"
      ? sql`diff_ideal_s ASC`
      : sql`ru.duracao_s ASC`}
    LIMIT 50
  `

  return c.json({ leaderboard: entries, tempo_ideal_s: rota.tempo_ideal_s })
})

// ── GET /api/tracks/rotas/:id/ghosts ─────────────────────────────────────────
// Retorna as 3 melhores runs completas com todos os pontos GPS, para replay local

tracksRoutes.get("/rotas/:id/ghosts", async (c) => {
  const rotaId = c.req.param("id")

  const runs = await sql`
    SELECT
      ru.id, ru.duracao_s, ru.vel_media_kmh, ru.concluida_em,
      u.nome    AS usuario_nome,
      v.apelido AS veiculo_apelido,
      v.marca   AS veiculo_marca,
      v.modelo  AS veiculo_modelo
    FROM runs ru
    JOIN usuarios u ON u.id = ru.usuario_id
    JOIN veiculos v ON v.id = ru.veiculo_id
    WHERE ru.rota_id = ${rotaId}
      AND ru.status  = 'concluida'
      AND ru.duracao_s IS NOT NULL
    ORDER BY ru.duracao_s ASC
    LIMIT 3
  `

  if (runs.length === 0) return c.json({ ghosts: [] })

  const runIds = runs.map(r => r.id)
  const pontos = await sql`
    SELECT run_id, offset_ms, lat, lng, velocidade_kmh
    FROM run_pontos
    WHERE run_id = ANY(${runIds}::text[])
    ORDER BY run_id, offset_ms
  `

  const ghosts = runs.map(r => ({
    ...r,
    pontos: pontos
      .filter(p => p.run_id === r.id)
      .map(p => ({
        offset_ms: p.offset_ms,
        lat: Number(p.lat),
        lng: Number(p.lng),
        velocidade_kmh: p.velocidade_kmh ? Number(p.velocidade_kmh) : null,
      })),
  }))

  return c.json({ ghosts })
})

// ── POST /api/tracks/runs — inicia uma run ────────────────────────────────────

tracksRoutes.post("/runs", async (c) => {
  const userId = c.get("userId")
  const body = await c.req.json<{ rota_id: string; veiculo_id: string }>()

  if (!body.rota_id || !body.veiculo_id) {
    return c.json({ error: "rota_id e veiculo_id são obrigatórios" }, 400)
  }

  const [rota] = await sql`SELECT id FROM rotas WHERE id = ${body.rota_id} AND ativa = true`
  if (!rota) return c.json({ error: "Rota inválida" }, 404)

  const [veiculo] = await sql`
    SELECT v.id FROM veiculos v
    JOIN garagens g ON g.id = v.garagem_id
    WHERE v.id = ${body.veiculo_id} AND g.usuario_id = ${userId}
  `
  if (!veiculo) return c.json({ error: "Veículo não encontrado" }, 404)

  // Cancela qualquer run em andamento na mesma rota
  await sql`
    UPDATE runs SET status = 'cancelada'
    WHERE usuario_id = ${userId} AND status = 'em_andamento'
  `

  const [run] = await sql`
    INSERT INTO runs (usuario_id, veiculo_id, rota_id)
    VALUES (${userId}, ${body.veiculo_id}, ${body.rota_id})
    RETURNING *
  `
  return c.json({ run }, 201)
})

// ── POST /api/tracks/runs/:id/pontos — salva lote de pontos GPS ───────────────

tracksRoutes.post("/runs/:id/pontos", async (c) => {
  const userId = c.get("userId")
  const runId = c.req.param("id")

  const [run] = await sql`
    SELECT id FROM runs WHERE id = ${runId} AND usuario_id = ${userId} AND status = 'em_andamento'
  `
  if (!run) return c.json({ error: "Run não encontrada" }, 404)

  const body = await c.req.json<{
    pontos: Array<{ offset_ms: number; lat: number; lng: number; velocidade_kmh?: number }>
  }>()

  if (!body.pontos?.length) return c.json({ ok: true })

  // Insere em lote usando VALUES list
  for (const p of body.pontos) {
    await sql`
      INSERT INTO run_pontos (run_id, offset_ms, lat, lng, velocidade_kmh)
      VALUES (${runId}, ${p.offset_ms}, ${p.lat}, ${p.lng}, ${p.velocidade_kmh ?? null})
    `
  }

  return c.json({ ok: true, saved: body.pontos.length })
})

// ── POST /api/tracks/runs/:id/finalizar ──────────────────────────────────────

tracksRoutes.post("/runs/:id/finalizar", async (c) => {
  const userId = c.get("userId")
  const runId = c.req.param("id")

  const [run] = await sql`
    SELECT ru.*, r.tempo_ideal_s, r.ponto_b_lat, r.ponto_b_lng
    FROM runs ru
    JOIN rotas r ON r.id = ru.rota_id
    WHERE ru.id = ${runId} AND ru.usuario_id = ${userId} AND ru.status = 'em_andamento'
  `
  if (!run) return c.json({ error: "Run não encontrada" }, 404)

  const body = await c.req.json<{
    duracao_s: number
    distancia_km: number
    vel_media_kmh: number
    vel_max_kmh: number
    lat_final: number
    lng_final: number
  }>()

  // Determina período do dia
  const hora = new Date().getHours()
  const periodo_dia =
    hora >= 5 && hora < 12 ? "manha" :
    hora >= 12 && hora < 18 ? "tarde" :
    hora >= 18 && hora < 24 ? "noite" : "madrugada"

  // Busca clima no Open-Meteo (gratuito, sem chave)
  let clima: string | null = null
  let temperatura_c: number | null = null
  try {
    const lat = body.lat_final ?? run.ponto_b_lat
    const lng = body.lng_final ?? run.ponto_b_lng
    const wResp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,weathercode&timezone=America%2FSao_Paulo`,
      { signal: AbortSignal.timeout(5_000) }
    )
    if (wResp.ok) {
      const wData = await wResp.json() as {
        current: { temperature_2m: number; weathercode: number }
      }
      temperatura_c = wData.current.temperature_2m
      const wc = wData.current.weathercode
      clima = wc === 0 ? "sol" :
              wc <= 3 ? "nublado" :
              wc <= 67 ? "chuva" :
              wc <= 77 ? "neve" : "tempestade"
    }
  } catch { /* clima é opcional */ }

  const [updated] = await sql`
    UPDATE runs SET
      status       = 'concluida',
      concluida_em = now(),
      duracao_s     = ${body.duracao_s},
      distancia_km  = ${body.distancia_km},
      vel_media_kmh = ${body.vel_media_kmh},
      vel_max_kmh   = ${body.vel_max_kmh},
      clima         = ${clima},
      temperatura_c = ${temperatura_c},
      periodo_dia   = ${periodo_dia}
    WHERE id = ${runId}
    RETURNING *
  `

  // ── Badges ───────────────────────────────────────────────────────────────
  const novosBadges: string[] = []

  async function award(badgeId: string, reason: string) {
    try {
      await sql`
        INSERT INTO usuario_badges (usuario_id, badge_id, run_id)
        VALUES (${userId}, ${badgeId}, ${runId})
        ON CONFLICT DO NOTHING
      `
      novosBadges.push(reason)
    } catch { /* ignora duplicados */ }
  }

  // Primeiro KM
  const [countRuns] = await sql`
    SELECT COUNT(*) AS n FROM runs WHERE usuario_id = ${userId} AND status = 'concluida'
  `
  if (Number(countRuns.n) === 1) await award("primeiro_km", "Primeira run concluída!")

  // Night Rider / Early Bird
  if (periodo_dia === "madrugada") await award("night_rider", "Run de madrugada!")
  if (hora < 7) await award("early_bird", "Run no amanhecer!")

  // Chuva
  if (clima === "chuva" || clima === "tempestade") await award("chuva", "Run sob chuva!")

  // Regularidade (dentro de 60s do tempo ideal)
  if (run.tempo_ideal_s && Math.abs(body.duracao_s - run.tempo_ideal_s) <= 60) {
    await award("regularidade", "Tempo cravo no ideal!")
  }

  // Velocista
  if (body.vel_max_kmh >= 200) await award("velocista", "Mais de 200 km/h!")

  // Clockwork: 3 runs na mesma rota com variação < 60s
  const runsRota = await sql`
    SELECT duracao_s FROM runs
    WHERE usuario_id = ${userId} AND rota_id = ${run.rota_id}
      AND status = 'concluida' AND duracao_s IS NOT NULL
    ORDER BY concluida_em DESC
    LIMIT 3
  `
  if (runsRota.length >= 3) {
    const tempos = runsRota.map(r => Number(r.duracao_s))
    const variacao = Math.max(...tempos) - Math.min(...tempos)
    if (variacao < 60) await award("clockwork", "3 runs idênticas!")
  }

  return c.json({ run: updated, badges: novosBadges })
})

// ── GET /api/tracks/meus-runs ─────────────────────────────────────────────────

tracksRoutes.get("/meus-runs", async (c) => {
  const userId = c.get("userId")

  const runs = await sql`
    SELECT
      ru.*,
      ro.nome     AS rota_nome,
      ro.regiao   AS rota_regiao,
      v.apelido   AS veiculo_apelido,
      v.marca     AS veiculo_marca,
      v.modelo    AS veiculo_modelo
    FROM runs ru
    JOIN rotas   ro ON ro.id = ru.rota_id
    JOIN veiculos v  ON v.id  = ru.veiculo_id
    WHERE ru.usuario_id = ${userId}
    ORDER BY ru.iniciada_em DESC
    LIMIT 50
  `
  return c.json({ runs })
})

// ── GET /api/tracks/badges ────────────────────────────────────────────────────

tracksRoutes.get("/badges", async (c) => {
  const userId = c.get("userId")

  const todos = await sql`SELECT * FROM badges ORDER BY id`
  const ganhos = await sql`
    SELECT ub.badge_id, ub.ganho_em, ub.run_id
    FROM usuario_badges ub
    WHERE ub.usuario_id = ${userId}
  `
  const ganhosMap = new Map(ganhos.map(g => [g.badge_id, g]))

  return c.json({
    badges: todos.map(b => ({
      ...b,
      ganho: ganhosMap.has(b.id),
      ganho_em: ganhosMap.get(b.id)?.ganho_em ?? null,
    })),
  })
})
