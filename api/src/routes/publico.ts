import { Hono } from "hono"
import { sql } from "../db/client"

export const publicoRoutes = new Hono()

// GET /g/:slug — garagem pública
publicoRoutes.get("/g/:slug", async (c) => {
  const { slug } = c.req.param()

  const [garagem] = await sql`
    SELECT g.id, g.nome, g.slug, g.bio, g.publica, g.criada_em,
           u.nome as dono_nome, u.avatar_url as dono_avatar,
           COUNT(DISTINCT f.seguidor_id)::int as total_follows
    FROM garagens g
    JOIN usuarios u ON u.id = g.usuario_id
    LEFT JOIN follows f ON f.garagem_id = g.id
    WHERE g.slug = ${slug}
    GROUP BY g.id, u.nome, u.avatar_url
  `

  if (!garagem) return c.json({ error: "Garagem não encontrada" }, 404)
  if (!garagem.publica) return c.json({ error: "Garagem privada" }, 403)

  const veiculos = await sql`
    SELECT v.id, v.apelido, v.marca, v.modelo, v.ano_fabricacao, v.ano_modelo,
           v.perfil, v.status, v.capa_url,
           COUNT(DISTINCT f.id)::int as total_fases,
           COUNT(DISTINCT i.id)::int as total_itens
    FROM veiculos v
    LEFT JOIN fases f ON f.veiculo_id = v.id
    LEFT JOIN itens i ON i.fase_id = f.id
    WHERE v.garagem_id = ${garagem.id}
      AND v.visibilidade = 'publico'
    GROUP BY v.id
    ORDER BY v.criado_em DESC
  `

  return c.json({ garagem, veiculos })
})

// GET /feed — builds públicos recentes
publicoRoutes.get("/feed", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 50)
  const offset = Number(c.req.query("offset") ?? 0)

  const veiculos = await sql`
    SELECT v.id, v.apelido, v.marca, v.modelo, v.ano_fabricacao, v.ano_modelo,
           v.perfil, v.status, v.capa_url, v.criado_em,
           g.slug as garagem_slug, g.nome as garagem_nome,
           u.nome as dono_nome, u.avatar_url as dono_avatar,
           COUNT(DISTINCT f.id)::int as total_fases,
           COUNT(DISTINCT i.id)::int as total_itens,
           COUNT(DISTINCT i2.id)::int as itens_concluidos
    FROM veiculos v
    JOIN garagens g ON g.id = v.garagem_id
    JOIN usuarios u ON u.id = g.usuario_id
    LEFT JOIN fases f ON f.veiculo_id = v.id
    LEFT JOIN itens i ON i.fase_id = f.id
    LEFT JOIN itens i2 ON i2.fase_id = f.id AND i2.status = 'concluido'
    WHERE v.visibilidade = 'publico'
      AND g.publica = true
    GROUP BY v.id, g.slug, g.nome, u.nome, u.avatar_url
    ORDER BY v.criado_em DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  return c.json({ veiculos, offset, limit })
})
