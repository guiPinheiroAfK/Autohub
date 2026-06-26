import { Hono } from "hono"
import { z } from "zod"
import { sql } from "../db/client.ts"
import { enviarConviteColaboracao } from "../lib/email.ts"
import type { AppEnv } from "../types.ts"

export const colaboracoesRoutes = new Hono<AppEnv>()

const conviteSchema = z.object({
  email: z.string().email(),
  papel: z.enum(["editor", "visualizador", "mecanico"]).default("editor"),
})

// GET /colaboracoes/veiculo/:veiculoId — listar colaboradores
colaboracoesRoutes.get("/veiculo/:veiculoId", async (c) => {
  const userId = c.get("userId") as string
  const { veiculoId } = c.req.param()

  // Só dono ou colaborador ativo pode ver
  const acesso = await temAcesso(userId, veiculoId)
  if (!acesso) return c.json({ error: "Sem acesso" }, 403)

  const colaboradores = await sql`
    SELECT col.id, col.convidado_email, col.papel, col.status, col.criado_em, col.aceito_em,
           u.nome as nome, u.avatar_url
    FROM colaboracoes col
    LEFT JOIN usuarios u ON u.id = col.convidado_id
    WHERE col.veiculo_id = ${veiculoId}
      AND col.status NOT IN ('recusado', 'removido')
    ORDER BY col.criado_em DESC
  `

  return c.json({ colaboradores })
})

// POST /colaboracoes/veiculo/:veiculoId/convidar
colaboracoesRoutes.post("/veiculo/:veiculoId/convidar", async (c) => {
  const userId = c.get("userId") as string
  const { veiculoId } = c.req.param()

  // Só o dono pode convidar
  const isDono = await ehDono(userId, veiculoId)
  if (!isDono) return c.json({ error: "Apenas o dono pode convidar colaboradores" }, 403)

  const body = await c.req.json().catch(() => null)
  const parsed = conviteSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: "Dados inválidos" }, 400)

  const { email, papel } = parsed.data

  // Verificar se já tem convite ativo para este email
  const [existente] = await sql`
    SELECT id FROM colaboracoes
    WHERE veiculo_id = ${veiculoId} AND convidado_email = ${email}
      AND status IN ('pendente', 'ativo')
  `
  if (existente) return c.json({ error: "Já existe um convite ativo para este e-mail" }, 409)

  const token = crypto.randomUUID()
  const [veiculo] = await sql`
    SELECT v.apelido, v.marca, v.modelo, u.nome as dono_nome
    FROM veiculos v JOIN garagens g ON g.id = v.garagem_id JOIN usuarios u ON u.id = g.usuario_id
    WHERE v.id = ${veiculoId}
  `

  // Verificar se o convidado já é usuário
  const [convidadoUser] = await sql`SELECT id FROM usuarios WHERE email = ${email}`

  const [collab] = await sql`
    INSERT INTO colaboracoes (veiculo_id, convidado_email, convidado_id, papel, token_convite, convidado_por)
    VALUES (${veiculoId}, ${email}, ${convidadoUser?.id ?? null}, ${papel}, ${token}, ${userId})
    RETURNING id
  `

  // Notificar se já é usuário
  if (convidadoUser) {
    await sql`
      INSERT INTO notificacoes (usuario_id, tipo, titulo, corpo, link)
      VALUES (${convidadoUser.id}, 'convite_collab',
              'Convite para colaborar em um build',
              ${`${veiculo.dono_nome} te convidou para o build ${veiculo.apelido}`},
              ${`/convite?token=${token}`})
    `
  }

  // Enviar email (não bloqueia a resposta se falhar)
  const nomeVeiculo = `${veiculo.marca} ${veiculo.modelo} — ${veiculo.apelido}`
  enviarConviteColaboracao(email, veiculo.dono_nome, nomeVeiculo, papel, token).catch(console.error)

  return c.json({ ok: true, convite_id: collab.id }, 201)
})

// POST /colaboracoes/aceitar/:token
colaboracoesRoutes.post("/aceitar/:token", async (c) => {
  const userId = c.get("userId") as string
  const { token } = c.req.param()

  const [convite] = await sql`
    SELECT col.*, v.apelido, v.marca, v.modelo, u.nome as dono_nome, u.id as dono_id,
           ue.email as email_usuario
    FROM colaboracoes col
    JOIN veiculos v ON v.id = col.veiculo_id
    JOIN garagens g ON g.id = v.garagem_id
    JOIN usuarios u ON u.id = g.usuario_id
    JOIN usuarios ue ON ue.id = ${userId}
    WHERE col.token_convite = ${token} AND col.status = 'pendente'
  `

  if (!convite) return c.json({ error: "Convite inválido ou já usado" }, 404)
  if (convite.convidado_email !== convite.email_usuario) {
    return c.json({ error: "Este convite foi enviado para outro e-mail" }, 403)
  }

  await sql`
    UPDATE colaboracoes SET status = 'ativo', convidado_id = ${userId}, aceito_em = now()
    WHERE token_convite = ${token}
  `

  // Notificar dono
  await sql`
    INSERT INTO notificacoes (usuario_id, tipo, titulo, corpo, link)
    VALUES (${convite.dono_id}, 'collab_aceito',
            'Convite de colaboração aceito',
            ${`${convite.email_usuario} aceitou o convite para ${convite.apelido}`},
            ${`/v/${convite.veiculo_id}`})
  `

  return c.json({ ok: true, veiculo_id: convite.veiculo_id })
})

// DELETE /colaboracoes/:colaboracaoId — remover colaborador
colaboracoesRoutes.delete("/:colaboracaoId", async (c) => {
  const userId = c.get("userId") as string
  const { colaboracaoId } = c.req.param()

  const [collab] = await sql`
    SELECT col.*, g.usuario_id as dono_id
    FROM colaboracoes col
    JOIN veiculos v ON v.id = col.veiculo_id
    JOIN garagens g ON g.id = v.garagem_id
    WHERE col.id = ${colaboracaoId}
  `

  if (!collab) return c.json({ error: "Não encontrado" }, 404)

  // Dono pode remover qualquer um; colaborador pode se remover
  if (collab.dono_id !== userId && collab.convidado_id !== userId) {
    return c.json({ error: "Sem permissão" }, 403)
  }

  await sql`UPDATE colaboracoes SET status = 'removido' WHERE id = ${colaboracaoId}`
  return c.json({ ok: true })
})

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ehDono(userId: string, veiculoId: string): Promise<boolean> {
  const [r] = await sql`
    SELECT 1 FROM veiculos v JOIN garagens g ON g.id = v.garagem_id
    WHERE v.id = ${veiculoId} AND g.usuario_id = ${userId}
  `
  return !!r
}

async function temAcesso(userId: string, veiculoId: string): Promise<boolean> {
  if (await ehDono(userId, veiculoId)) return true
  const [r] = await sql`
    SELECT 1 FROM colaboracoes
    WHERE veiculo_id = ${veiculoId} AND convidado_id = ${userId} AND status = 'ativo'
  `
  return !!r
}
