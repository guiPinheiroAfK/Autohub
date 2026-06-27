import { Hono } from "hono"
import { sql } from "../db/client.ts"
import type { AppEnv } from "../types.ts"

export const comentariosPublicoRoutes = new Hono()

// GET /comentarios/:veiculoId — público, só retorna se veículo for público
comentariosPublicoRoutes.get("/comentarios/:veiculoId", async (c) => {
  const { veiculoId } = c.req.param()

  const [v] = await sql`SELECT visibilidade FROM veiculos WHERE id = ${veiculoId}`
  if (!v || v.visibilidade !== "publico") return c.json({ error: "Não encontrado" }, 404)

  const comentarios = await sql`
    SELECT c.id, c.texto, c.criado_em,
           u.nome as autor_nome, u.avatar_url as autor_avatar
    FROM comentarios c
    JOIN usuarios u ON u.id = c.usuario_id
    WHERE c.veiculo_id = ${veiculoId}
    ORDER BY c.criado_em ASC
    LIMIT 100
  `
  return c.json(comentarios)
})

export const comentariosRoutes = new Hono<AppEnv>()

// Auth já é garantido pelo grupo pai (api.use("*", authMiddleware) em app.ts)

// POST /:veiculoId — requer auth (montado em /comentarios via app.ts)
comentariosRoutes.post("/:veiculoId", async (c) => {
  const userId = c.get("userId") as string
  const { veiculoId } = c.req.param()

  const [v] = await sql`SELECT id, visibilidade FROM veiculos WHERE id = ${veiculoId}`
  if (!v || v.visibilidade !== "publico") {
    return c.json({ error: "Veículo não encontrado ou privado" }, 404)
  }

  const body = await c.req.json().catch(() => null)
  const texto = body?.texto?.trim()
  if (!texto || texto.length > 500) {
    return c.json({ error: "Texto entre 1 e 500 caracteres" }, 400)
  }

  const [comentario] = await sql`
    INSERT INTO comentarios (veiculo_id, usuario_id, texto)
    VALUES (${veiculoId}, ${userId}, ${texto})
    RETURNING id, texto, criado_em
  `

  const [user] = await sql`SELECT nome, avatar_url FROM usuarios WHERE id = ${userId}`

  // Notifica o dono do build se for outro usuário
  const [garagem] = await sql`
    SELECT g.usuario_id FROM garagens g
    JOIN veiculos v ON v.garagem_id = g.id
    WHERE v.id = ${veiculoId}
  `
  if (garagem && garagem.usuario_id !== userId) {
    const [veiculo] = await sql`SELECT apelido FROM veiculos WHERE id = ${veiculoId}`
    await sql`
      INSERT INTO notificacoes (usuario_id, tipo, titulo, corpo, link)
      VALUES (
        ${garagem.usuario_id},
        'update_build',
        ${`${user.nome} comentou no seu build`},
        ${texto.slice(0, 120)},
        ${`/g/.../${veiculoId}`}
      )
    `
  }

  return c.json({
    ...comentario,
    autor_nome: user.nome,
    autor_avatar: user.avatar_url,
  }, 201)
})

// DELETE /:comentarioId — dono do comentário (montado em /comentarios via app.ts)
comentariosRoutes.delete("/:comentarioId", async (c) => {
  const userId = c.get("userId") as string
  const { comentarioId } = c.req.param()

  const result = await sql`
    DELETE FROM comentarios
    WHERE id = ${comentarioId} AND usuario_id = ${userId}
    RETURNING id
  `
  if (result.length === 0) return c.json({ error: "Comentário não encontrado" }, 404)
  return c.json({ deleted: true })
})
