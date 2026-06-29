import { Hono } from "hono"
import { sql } from "../db/client.ts"
import type { AppEnv } from "../types.ts"

export const socialRoutes = new Hono<AppEnv>()

// POST /social/follows/:garagemId — seguir garagem
socialRoutes.post("/follows/:garagemId", async (c) => {
  const userId = c.get("userId") as string
  const { garagemId } = c.req.param()

  const [garagem] = await sql`SELECT id FROM garagens WHERE id = ${garagemId} AND publica = true`
  if (!garagem) return c.json({ error: "Garagem não encontrada ou privada" }, 404)

  const [minhaGaragem] = await sql`SELECT id FROM garagens WHERE usuario_id = ${userId}`
  if (minhaGaragem?.id === garagemId) return c.json({ error: "Não pode seguir sua própria garagem" }, 400)

  await sql`
    INSERT INTO follows (seguidor_id, garagem_id) VALUES (${userId}, ${garagemId})
    ON CONFLICT DO NOTHING
  `

  // Notificar dono da garagem
  const [dono] = await sql`SELECT usuario_id FROM garagens WHERE id = ${garagemId}`
  const [seguidor] = await sql`SELECT nome FROM usuarios WHERE id = ${userId}`
  if (dono) {
    await sql`
      INSERT INTO notificacoes (usuario_id, tipo, titulo, corpo, link)
      VALUES (${dono.usuario_id}, 'novo_follow', 'Nova pessoa seguindo sua garagem',
              ${`${seguidor.nome} começou a seguir sua garagem`}, ${`/g/`})
    `
  }

  return c.json({ ok: true })
})

// DELETE /social/follows/:garagemId — deixar de seguir
socialRoutes.delete("/follows/:garagemId", async (c) => {
  const userId = c.get("userId") as string
  const { garagemId } = c.req.param()

  await sql`DELETE FROM follows WHERE seguidor_id = ${userId} AND garagem_id = ${garagemId}`
  return c.json({ ok: true })
})

// GET /social/follows — garagens que o usuário segue (com flag mutuo)
socialRoutes.get("/follows", async (c) => {
  const userId = c.get("userId") as string

  const [minhaGaragem] = await sql`SELECT id FROM garagens WHERE usuario_id = ${userId}`

  const follows = await sql`
    SELECT g.id, g.nome, g.slug, u.nome as dono_nome, f.criado_em,
           EXISTS(
             SELECT 1 FROM follows f2
             WHERE f2.seguidor_id = g.usuario_id AND f2.garagem_id = ${minhaGaragem?.id ?? ""}
           ) as mutuo
    FROM follows f
    JOIN garagens g ON g.id = f.garagem_id
    JOIN usuarios u ON u.id = g.usuario_id
    WHERE f.seguidor_id = ${userId}
    ORDER BY f.criado_em DESC
  `

  return c.json({ follows })
})

// GET /social/seguidores — quem segue a garagem do usuário autenticado
socialRoutes.get("/seguidores", async (c) => {
  const userId = c.get("userId") as string

  const [minhaGaragem] = await sql`SELECT id FROM garagens WHERE usuario_id = ${userId}`
  if (!minhaGaragem) return c.json({ seguidores: [] })

  const seguidores = await sql`
    SELECT u.id, u.nome, u.avatar_url, g.slug, g.nome as garagem_nome, f.criado_em,
           EXISTS(
             SELECT 1 FROM follows f2
             WHERE f2.seguidor_id = ${userId} AND f2.garagem_id = g.id
           ) as mutuo
    FROM follows f
    JOIN usuarios u ON u.id = f.seguidor_id
    JOIN garagens g ON g.usuario_id = u.id
    WHERE f.garagem_id = ${minhaGaragem.id}
    ORDER BY f.criado_em DESC
  `

  return c.json({ seguidores })
})

// GET /social/notificacoes
socialRoutes.get("/notificacoes", async (c) => {
  const userId = c.get("userId") as string

  const notificacoes = await sql`
    SELECT id, tipo, titulo, corpo, lida, link, criado_em
    FROM notificacoes
    WHERE usuario_id = ${userId}
    ORDER BY criado_em DESC
    LIMIT 30
  `

  const [{ count }] = await sql`
    SELECT COUNT(*)::int as count FROM notificacoes
    WHERE usuario_id = ${userId} AND lida = false
  `

  return c.json({ notificacoes, nao_lidas: count })
})

// PATCH /social/notificacoes/:id/lida
socialRoutes.patch("/notificacoes/:id/lida", async (c) => {
  const userId = c.get("userId") as string
  const { id } = c.req.param()

  await sql`UPDATE notificacoes SET lida = true WHERE id = ${id} AND usuario_id = ${userId}`
  return c.json({ ok: true })
})

// PATCH /social/notificacoes/todas-lidas
socialRoutes.patch("/notificacoes/todas-lidas", async (c) => {
  const userId = c.get("userId") as string
  await sql`UPDATE notificacoes SET lida = true WHERE usuario_id = ${userId}`
  return c.json({ ok: true })
})

// POST /social/curtidas/:veiculoId — curtir um veículo público
socialRoutes.post("/curtidas/:veiculoId", async (c) => {
  const userId = c.get("userId") as string
  const { veiculoId } = c.req.param()

  const [v] = await sql`SELECT id FROM veiculos WHERE id = ${veiculoId} AND visibilidade = 'publico'`
  if (!v) return c.json({ error: "Veículo não encontrado" }, 404)

  await sql`
    INSERT INTO curtidas (veiculo_id, usuario_id) VALUES (${veiculoId}, ${userId})
    ON CONFLICT DO NOTHING
  `
  const [{ total }] = await sql`SELECT COUNT(*)::int as total FROM curtidas WHERE veiculo_id = ${veiculoId}`
  return c.json({ ok: true, total })
})

// DELETE /social/curtidas/:veiculoId — descurtir
socialRoutes.delete("/curtidas/:veiculoId", async (c) => {
  const userId = c.get("userId") as string
  const { veiculoId } = c.req.param()

  await sql`DELETE FROM curtidas WHERE veiculo_id = ${veiculoId} AND usuario_id = ${userId}`
  const [{ total }] = await sql`SELECT COUNT(*)::int as total FROM curtidas WHERE veiculo_id = ${veiculoId}`
  return c.json({ ok: true, total })
})

// GET /social/curtidas — veículos curtidos pelo usuário autenticado
socialRoutes.get("/curtidas", async (c) => {
  const userId = c.get("userId") as string
  const curtidas = await sql`SELECT veiculo_id FROM curtidas WHERE usuario_id = ${userId}`
  return c.json({ curtidas: curtidas.map(r => r.veiculo_id) })
})
