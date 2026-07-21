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
  // uma entrada por piloto: só a melhor corrida de cada nome conta
  return sql`
    SELECT nome, pontos, km, criado_em FROM (
      SELECT DISTINCT ON (nome) nome, pontos, km, criado_em
      FROM autodash_scores
      ORDER BY nome, pontos DESC, criado_em ASC
    ) melhores
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

// ── Duelo online (2 jogadores, salas por código, telemetria por polling) ─────
// Netlify Functions não seguram WebSocket, então o duelo sincroniza por
// timestamp de largada + posts de estado a ~1s. Suficiente pra "quem vai
// mais longe" com carro fantasma.

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function newCode() {
  let code = ""
  for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return code
}

function cleanName(v: unknown) {
  return String(v ?? "").trim().slice(0, 12)
}

// POST /api/autodash/room — cria sala e vira host
autodashRoutes.post("/autodash/room", async (c) => {
  const body = await c.req.json().catch(() => null)
  const nome = cleanName(body?.nome)
  if (!nome) return c.json({ error: "Nome obrigatório" }, 400)

  await sql`DELETE FROM autodash_rooms WHERE criado_em < now() - interval '2 hours'`

  const seed = Math.floor(Math.random() * 2 ** 31)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode()
    try {
      await sql`INSERT INTO autodash_rooms (code, seed, host_name) VALUES (${code}, ${seed}, ${nome})`
      return c.json({ code, seed, role: "host" })
    } catch { /* código colidiu, tenta outro */ }
  }
  return c.json({ error: "Não consegui criar a sala, tenta de novo" }, 500)
})

// POST /api/autodash/room/:code/join — entra numa sala e arma a largada
autodashRoutes.post("/autodash/room/:code/join", async (c) => {
  const code = c.req.param("code").toUpperCase()
  const body = await c.req.json().catch(() => null)
  const nome = cleanName(body?.nome)
  if (!nome) return c.json({ error: "Nome obrigatório" }, 400)

  const [room] = await sql`SELECT code, guest_name FROM autodash_rooms WHERE code = ${code}`
  if (!room) return c.json({ error: "Sala não encontrada" }, 404)
  if (room.guest_name) return c.json({ error: "Sala já está cheia" }, 409)

  const [updated] = await sql`
    UPDATE autodash_rooms
    SET guest_name = ${nome}, start_at = now() + interval '6 seconds'
    WHERE code = ${code}
    RETURNING seed, host_name, EXTRACT(EPOCH FROM (start_at - now())) * 1000 AS start_in_ms
  `
  return c.json({
    seed: updated.seed,
    role: "guest",
    oppName: updated.host_name,
    startInMs: Math.round(Number(updated.start_in_ms)),
  })
})

// GET /api/autodash/room/:code — host espera oponente
autodashRoutes.get("/autodash/room/:code", async (c) => {
  const code = c.req.param("code").toUpperCase()
  const [room] = await sql`
    SELECT guest_name, EXTRACT(EPOCH FROM (start_at - now())) * 1000 AS start_in_ms
    FROM autodash_rooms WHERE code = ${code}
  `
  if (!room) return c.json({ error: "Sala não encontrada" }, 404)
  return c.json({
    oppName: room.guest_name ?? null,
    startInMs: room.start_in_ms === null ? null : Math.round(Number(room.start_in_ms)),
  })
})

// POST /api/autodash/room/:code/state — telemetria; devolve o estado do rival
autodashRoutes.post("/autodash/room/:code/state", async (c) => {
  const code = c.req.param("code").toUpperCase()
  const body = await c.req.json().catch(() => null)
  const role = body?.role === "host" ? "host" : body?.role === "guest" ? "guest" : null
  const st = body?.st
  if (!role || typeof st !== "object" || st === null) return c.json({ error: "Payload inválido" }, 400)

  const safe = {
    d: Number(st.d) || 0,          // km percorridos
    s: Math.floor(Number(st.s)) || 0, // pontos
    v: Number(st.v) || 0,          // km/h
    x: Number(st.x) || 0,          // posição lateral (-1..1)
    c: Boolean(st.c),              // bateu?
    car: Math.min(3, Math.max(0, Math.floor(Number(st.car)) || 0)),   // carroceria
    paint: Math.min(9, Math.max(0, Math.floor(Number(st.paint)) || 0)), // pintura
    t: Date.now(),                 // carimbo pra detectar rival sumido
  }

  // postar estado também limpa minha flag de revanche que tenha sobrado
  const [room] = role === "host"
    ? await sql`
        UPDATE autodash_rooms SET host_state = ${JSON.stringify(safe)}::jsonb, rematch_host = false
        WHERE code = ${code}
        RETURNING guest_state AS opp, guest_name AS opp_name,
                  EXTRACT(EPOCH FROM (start_at - now())) * 1000 AS start_in_ms
      `
    : await sql`
        UPDATE autodash_rooms SET guest_state = ${JSON.stringify(safe)}::jsonb, rematch_guest = false
        WHERE code = ${code}
        RETURNING host_state AS opp, host_name AS opp_name,
                  EXTRACT(EPOCH FROM (start_at - now())) * 1000 AS start_in_ms
      `
  if (!room) return c.json({ error: "Sala não encontrada" }, 404)
  return c.json({
    opp: room.opp ?? null,
    oppName: room.opp_name ?? null,
    startInMs: room.start_in_ms === null ? null : Math.round(Number(room.start_in_ms)),
  })
})

// POST /api/autodash/room/:code/rematch — topa revanche; quando os dois
// toparem, a mesma sala ganha pista nova e largada agendada
autodashRoutes.post("/autodash/room/:code/rematch", async (c) => {
  const code = c.req.param("code").toUpperCase()
  const body = await c.req.json().catch(() => null)
  const role = body?.role === "host" ? "host" : body?.role === "guest" ? "guest" : null
  if (!role) return c.json({ error: "Payload inválido" }, 400)

  if (role === "host") await sql`UPDATE autodash_rooms SET rematch_host = true WHERE code = ${code}`
  else await sql`UPDATE autodash_rooms SET rematch_guest = true WHERE code = ${code}`

  // os dois toparam? agenda a nova corrida (o WHERE garante que só um UPDATE vence)
  await sql`
    UPDATE autodash_rooms
    SET seed = floor(random() * 2147483647)::int,
        start_at = now() + interval '5 seconds',
        host_state = NULL, guest_state = NULL,
        rematch_host = false, rematch_guest = false
    WHERE code = ${code} AND rematch_host AND rematch_guest
  `

  const [room] = await sql`
    SELECT seed, EXTRACT(EPOCH FROM (start_at - now())) * 1000 AS start_in_ms
    FROM autodash_rooms WHERE code = ${code}
  `
  if (!room) return c.json({ error: "Sala não encontrada" }, 404)
  return c.json({
    seed: room.seed,
    startInMs: room.start_in_ms === null ? null : Math.round(Number(room.start_in_ms)),
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// MODO CORRIDA — até 4 pilotos, por voltas, largada dada pelo dono da sala.
// Separado do duelo de propósito: lá são 2 slots fixos e largada automática.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PILOTOS = 4

function cleanId(v: unknown) {
  return String(v ?? "").trim().slice(0, 40)
}
function cleanInt(v: unknown, lo: number, hi: number, fallback: number) {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback
}

/** Lista os pilotos da sala, na ordem em que entraram. */
async function pilotos(code: string) {
  return sql`
    SELECT player_id, nome, car, paint, estado,
           EXTRACT(EPOCH FROM (now() - visto_em)) AS ha_segundos
    FROM autodash_race_players
    WHERE code = ${code}
    ORDER BY entrou_em ASC
  `
}

// POST /api/autodash/race — cria a sala; quem cria é o dono (dá a largada)
autodashRoutes.post("/autodash/race", async (c) => {
  const body = await c.req.json().catch(() => null)
  const nome = cleanName(body?.nome)
  const playerId = cleanId(body?.playerId)
  if (!nome || !playerId) return c.json({ error: "Nome e playerId obrigatórios" }, 400)
  const voltas = cleanInt(body?.voltas, 1, 9, 3)

  await sql`DELETE FROM autodash_race_rooms WHERE criado_em < now() - interval '2 hours'`

  const seed = Math.floor(Math.random() * 2 ** 31)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode()
    try {
      await sql`
        INSERT INTO autodash_race_rooms (code, seed, voltas, owner_id)
        VALUES (${code}, ${seed}, ${voltas}, ${playerId})
      `
      await sql`
        INSERT INTO autodash_race_players (code, player_id, nome, car, paint)
        VALUES (${code}, ${playerId}, ${nome}, ${cleanInt(body?.car, 0, 9, 0)}, ${cleanInt(body?.paint, 0, 99, 0)})
      `
      return c.json({ code, seed, voltas, owner: true })
    } catch { /* código colidiu, tenta outro */ }
  }
  return c.json({ error: "Não consegui criar a sala, tenta de novo" }, 500)
})

// POST /api/autodash/race/:code/join — entra na sala (enquanto não largou)
autodashRoutes.post("/autodash/race/:code/join", async (c) => {
  const code = c.req.param("code").toUpperCase()
  const body = await c.req.json().catch(() => null)
  const nome = cleanName(body?.nome)
  const playerId = cleanId(body?.playerId)
  if (!nome || !playerId) return c.json({ error: "Nome e playerId obrigatórios" }, 400)

  const [room] = await sql`
    SELECT code, seed, voltas, owner_id, start_at FROM autodash_race_rooms WHERE code = ${code}
  `
  if (!room) return c.json({ error: "Sala não encontrada" }, 404)
  if (room.start_at) return c.json({ error: "Essa corrida já começou" }, 409)

  const [{ n }] = await sql`
    SELECT COUNT(*)::int AS n FROM autodash_race_players
    WHERE code = ${code} AND player_id <> ${playerId}
  `
  if (n >= MAX_PILOTOS) return c.json({ error: "Sala cheia (4 pilotos)" }, 409)

  // reentrar é idempotente: se cair a conexão, volta pro mesmo lugar
  await sql`
    INSERT INTO autodash_race_players (code, player_id, nome, car, paint)
    VALUES (${code}, ${playerId}, ${nome}, ${cleanInt(body?.car, 0, 9, 0)}, ${cleanInt(body?.paint, 0, 99, 0)})
    ON CONFLICT (code, player_id) DO UPDATE SET nome = EXCLUDED.nome, visto_em = now()
  `
  return c.json({
    seed: room.seed,
    voltas: room.voltas,
    owner: room.owner_id === playerId,
  })
})

// GET /api/autodash/race/:code — estado do lobby / da corrida
autodashRoutes.get("/autodash/race/:code", async (c) => {
  const code = c.req.param("code").toUpperCase()
  const [room] = await sql`
    SELECT seed, voltas, owner_id,
           EXTRACT(EPOCH FROM (start_at - now())) * 1000 AS start_in_ms
    FROM autodash_race_rooms WHERE code = ${code}
  `
  if (!room) return c.json({ error: "Sala não encontrada" }, 404)
  return c.json({
    seed: room.seed,
    voltas: room.voltas,
    ownerId: room.owner_id,
    startInMs: room.start_in_ms === null ? null : Math.round(Number(room.start_in_ms)),
    pilotos: await pilotos(code),
  })
})

// POST /api/autodash/race/:code/start — SÓ o dono dá a largada
autodashRoutes.post("/autodash/race/:code/start", async (c) => {
  const code = c.req.param("code").toUpperCase()
  const body = await c.req.json().catch(() => null)
  const playerId = cleanId(body?.playerId)

  const [room] = await sql`SELECT owner_id, start_at FROM autodash_race_rooms WHERE code = ${code}`
  if (!room) return c.json({ error: "Sala não encontrada" }, 404)
  if (room.owner_id !== playerId) return c.json({ error: "Só o dono da sala dá a largada" }, 403)
  if (room.start_at) return c.json({ error: "Já largou" }, 409)

  const [updated] = await sql`
    UPDATE autodash_race_rooms SET start_at = now() + interval '5 seconds'
    WHERE code = ${code}
    RETURNING EXTRACT(EPOCH FROM (start_at - now())) * 1000 AS start_in_ms
  `
  return c.json({ startInMs: Math.round(Number(updated.start_in_ms)) })
})

// POST /api/autodash/race/:code/state — telemetria; devolve todos os rivais
autodashRoutes.post("/autodash/race/:code/state", async (c) => {
  const code = c.req.param("code").toUpperCase()
  const body = await c.req.json().catch(() => null)
  const playerId = cleanId(body?.playerId)
  if (!playerId) return c.json({ error: "playerId obrigatório" }, 400)

  const st = body?.st ?? {}
  const safe = {
    d: Number(st.d) || 0,        // distância total percorrida (pra ordenar)
    lap: cleanInt(st.lap, 0, 99, 0),
    z: Number(st.z) || 0,        // posição na volta (pra dead reckoning)
    v: Number(st.v) || 0,        // km/h
    x: Number(st.x) || 0,        // faixa (-1..1)
    c: !!st.c,                   // bateu (respawnando)
    fin: !!st.fin,               // terminou
  }
  await sql`
    UPDATE autodash_race_players SET estado = ${JSON.stringify(safe)}::jsonb, visto_em = now()
    WHERE code = ${code} AND player_id = ${playerId}
  `
  const [room] = await sql`
    SELECT voltas, EXTRACT(EPOCH FROM (start_at - now())) * 1000 AS start_in_ms
    FROM autodash_race_rooms WHERE code = ${code}
  `
  if (!room) return c.json({ error: "Sala não encontrada" }, 404)
  const todos = await pilotos(code)
  return c.json({
    voltas: room.voltas,
    startInMs: room.start_in_ms === null ? null : Math.round(Number(room.start_in_ms)),
    rivais: todos.filter((p: { player_id: string }) => p.player_id !== playerId),
  })
})
