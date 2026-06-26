import { Hono } from "hono"
import { sql } from "../db/client.ts"

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

// GET /g/:slug/:veiculoId — build público detalhado
publicoRoutes.get("/g/:slug/:veiculoId", async (c) => {
  const { slug, veiculoId } = c.req.param()

  const [garagem] = await sql`
    SELECT g.id, g.nome, g.slug, g.publica, u.nome as dono_nome, u.avatar_url as dono_avatar
    FROM garagens g JOIN usuarios u ON u.id = g.usuario_id
    WHERE g.slug = ${slug}
  `
  if (!garagem) return c.json({ error: "Garagem não encontrada" }, 404)
  if (!garagem.publica) return c.json({ error: "Garagem privada" }, 403)

  const [veiculo] = await sql`
    SELECT v.id, v.apelido, v.marca, v.modelo, v.ano_fabricacao, v.ano_modelo,
           v.perfil, v.status, v.capa_url, v.meta_potencia_whp, v.criado_em, v.youtube_url
    FROM veiculos v
    WHERE v.id = ${veiculoId}
      AND v.garagem_id = ${garagem.id}
      AND v.visibilidade = 'publico'
  `
  if (!veiculo) return c.json({ error: "Veículo não encontrado" }, 404)

  const fases = await sql`
    SELECT f.id, f.titulo, f.ordem, f.status,
           COALESCE(
             json_agg(
               json_build_object('id', i.id, 'nome', i.nome, 'status', i.status)
               ORDER BY i.id
             ) FILTER (WHERE i.id IS NOT NULL),
             '[]'
           ) as itens
    FROM fases f
    LEFT JOIN itens i ON i.fase_id = f.id
    WHERE f.veiculo_id = ${veiculoId}
    GROUP BY f.id
    ORDER BY f.ordem
  `

  return c.json({ garagem, veiculo, fases })
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
