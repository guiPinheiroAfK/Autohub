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

// GET /feed — builds públicos rankeados por relevância
//
// Ordenação: score de engajamento com decaimento temporal (estilo Hacker News).
//   score = (comentarios*3 + fases + itens_concluidos + 1) / (idade_horas + 2)^1.5
//
//   - Comentários pesam mais (3x) por serem o sinal social mais forte.
//   - O "+1" no numerador garante que builds sem engajamento ainda sejam
//     rankeados por recência, em vez de zerarem.
//   - O "+2" na idade evita divisão por zero e suaviza as primeiras horas.
//   - Expoente 1.5 (gravidade) faz builds antigos afundarem gradualmente,
//     deixando espaço para os novos sem que a recência domine sozinha.
//
// Empate desfeito por criado_em DESC para manter a paginação estável.
// Use ?sort=recentes para a ordem puramente cronológica.
publicoRoutes.get("/feed", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 20), 50)
  const offset = Number(c.req.query("offset") ?? 0)
  const sort = c.req.query("sort") === "recentes" ? "recentes" : "relevante"

  const veiculos = sort === "recentes"
    ? await sql`
        SELECT v.id, v.apelido, v.marca, v.modelo, v.ano_fabricacao, v.ano_modelo,
               v.perfil, v.status, v.capa_url, v.criado_em,
               g.slug as garagem_slug, g.nome as garagem_nome,
               u.nome as dono_nome, u.avatar_url as dono_avatar,
               COUNT(DISTINCT f.id)::int   as total_fases,
               COUNT(DISTINCT i.id)::int   as total_itens,
               COUNT(DISTINCT i2.id)::int  as itens_concluidos,
               COUNT(DISTINCT c.id)::int   as total_comentarios,
               COUNT(DISTINCT cu.usuario_id)::int as total_curtidas
        FROM veiculos v
        JOIN garagens g ON g.id = v.garagem_id
        JOIN usuarios u ON u.id = g.usuario_id
        LEFT JOIN fases f       ON f.veiculo_id  = v.id
        LEFT JOIN itens i       ON i.fase_id     = f.id
        LEFT JOIN itens i2      ON i2.fase_id    = f.id AND i2.status = 'concluido'
        LEFT JOIN comentarios c ON c.veiculo_id  = v.id
        LEFT JOIN curtidas cu   ON cu.veiculo_id = v.id
        WHERE v.visibilidade = 'publico'
          AND g.publica = true
          AND u.email NOT LIKE 'teste\_%@autohub.test'
        GROUP BY v.id, g.slug, g.nome, u.nome, u.avatar_url
        ORDER BY v.criado_em DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    : await sql`
        SELECT v.id, v.apelido, v.marca, v.modelo, v.ano_fabricacao, v.ano_modelo,
               v.perfil, v.status, v.capa_url, v.criado_em,
               g.slug as garagem_slug, g.nome as garagem_nome,
               u.nome as dono_nome, u.avatar_url as dono_avatar,
               COUNT(DISTINCT f.id)::int   as total_fases,
               COUNT(DISTINCT i.id)::int   as total_itens,
               COUNT(DISTINCT i2.id)::int  as itens_concluidos,
               COUNT(DISTINCT c.id)::int   as total_comentarios,
               COUNT(DISTINCT cu.usuario_id)::int as total_curtidas
        FROM veiculos v
        JOIN garagens g ON g.id = v.garagem_id
        JOIN usuarios u ON u.id = g.usuario_id
        LEFT JOIN fases f       ON f.veiculo_id  = v.id
        LEFT JOIN itens i       ON i.fase_id     = f.id
        LEFT JOIN itens i2      ON i2.fase_id    = f.id AND i2.status = 'concluido'
        LEFT JOIN comentarios c ON c.veiculo_id  = v.id
        LEFT JOIN curtidas cu   ON cu.veiculo_id = v.id
        WHERE v.visibilidade = 'publico'
          AND g.publica = true
          AND u.email NOT LIKE 'teste\_%@autohub.test'
        GROUP BY v.id, g.slug, g.nome, u.nome, u.avatar_url
        ORDER BY (
          (COUNT(DISTINCT c.id) * 3 + COUNT(DISTINCT cu.usuario_id) * 2
           + COUNT(DISTINCT f.id) + COUNT(DISTINCT i2.id) + 1)
          / power(EXTRACT(EPOCH FROM (now() - v.criado_em)) / 3600 + 2, 1.5)
        ) DESC, v.criado_em DESC
        LIMIT ${limit} OFFSET ${offset}
      `

  return c.json({ veiculos, offset, limit, sort })
})
