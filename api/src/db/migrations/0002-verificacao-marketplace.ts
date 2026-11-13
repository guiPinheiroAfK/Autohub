/**
 * Migration v2 — verificação de e-mail, reset de senha, follows, notificações, colaborações, marketplace e lojas.
 * SQL copiado sem alteração de db/migrate.ts.
 * Esta versão já foi aplicada no Neon: não reescrever o SQL, só criar uma versão nova.
 */

import { sql } from "../client.ts"

export async function aplicar() {
  // ── v2: colunas novas em tabelas existentes ──────────────────────────────
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email_verificado BOOLEAN NOT NULL DEFAULT false`
  await sql`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE`
  await sql`ALTER TABLE garagens ADD COLUMN IF NOT EXISTS publica BOOLEAN NOT NULL DEFAULT false`
  await sql`ALTER TABLE garagens ADD COLUMN IF NOT EXISTS bio TEXT`
  await sql`ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS capa_url TEXT`

  // ── v2: verificação de e-mail ─────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS email_verificacoes (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token      TEXT NOT NULL UNIQUE,
      usado      BOOLEAN NOT NULL DEFAULT false,
      expira_em  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
      criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `

  // ── v2: reset de senha ────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS senha_resets (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      token      TEXT NOT NULL UNIQUE,
      usado      BOOLEAN NOT NULL DEFAULT false,
      expira_em  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 hour'),
      criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `

  // ── v2: follows (usuário segue garagem) ───────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS follows (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      seguidor_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      garagem_id  TEXT NOT NULL REFERENCES garagens(id) ON DELETE CASCADE,
      criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(seguidor_id, garagem_id)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_follows_garagem ON follows(garagem_id)`

  // ── v2: notificações ──────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS notificacoes (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      usuario_id  TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      tipo        TEXT NOT NULL CHECK (tipo IN ('novo_follow','convite_collab','collab_aceito','update_build')),
      titulo      TEXT NOT NULL,
      corpo       TEXT,
      lida        BOOLEAN NOT NULL DEFAULT false,
      link        TEXT,
      criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON notificacoes(usuario_id, lida)`

  // ── v2: colaborações em veículos ──────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS colaboracoes (
      id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      veiculo_id      TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
      convidado_email TEXT NOT NULL,
      convidado_id    TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
      papel           TEXT NOT NULL DEFAULT 'editor' CHECK (papel IN ('editor','viewer','mecanico')),
      status          TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','ativo','recusado','removido')),
      token_convite   TEXT UNIQUE,
      convidado_por   TEXT NOT NULL REFERENCES usuarios(id),
      criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
      aceito_em       TIMESTAMPTZ
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_colaboracoes_veiculo ON colaboracoes(veiculo_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_colaboracoes_convidado ON colaboracoes(convidado_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_colaboracoes_email ON colaboracoes(convidado_email)`

  // ── v2: corrige constraint de papel (viewer → visualizador) ─────────────────
  await sql`ALTER TABLE colaboracoes DROP CONSTRAINT IF EXISTS colaboracoes_papel_check`
  await sql`ALTER TABLE colaboracoes ADD CONSTRAINT colaboracoes_papel_check CHECK (papel IN ('editor','visualizador','mecanico'))`

  // ── v2: marketplace ───────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS marketplace_anuncios (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      garagem_id    TEXT NOT NULL REFERENCES garagens(id) ON DELETE CASCADE,
      titulo        TEXT NOT NULL,
      descricao     TEXT,
      preco         NUMERIC(12,2),
      moeda         TEXT NOT NULL DEFAULT 'BRL' CHECK (moeda IN ('BRL','USD','PYG')),
      categoria     TEXT NOT NULL CHECK (categoria IN ('motor','suspensao','freios','eletrica','carroceria','rodas','interior','acessorios','veiculo_completo','outro')),
      condicao      TEXT NOT NULL CHECK (condicao IN ('novo','usado','recondicionado')),
      localizacao   TEXT,
      status        TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pausado','vendido')),
      criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_marketplace_garagem ON marketplace_anuncios(garagem_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_marketplace_status ON marketplace_anuncios(status, criado_em DESC)`

  // ── v2: interesses em anúncios do marketplace ─────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS marketplace_interesses (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      anuncio_id TEXT NOT NULL REFERENCES marketplace_anuncios(id) ON DELETE CASCADE,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      mensagem   TEXT,
      criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(anuncio_id, usuario_id)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_interesses_anuncio ON marketplace_interesses(anuncio_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_interesses_usuario ON marketplace_interesses(usuario_id)`

  // ── feat/marketplace-monetizacao ─────────────────────────────────────────────
  await sql`ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS youtube_url TEXT`

  await sql`ALTER TABLE marketplace_anuncios ADD COLUMN IF NOT EXISTS patrocinado BOOLEAN NOT NULL DEFAULT false`
  await sql`ALTER TABLE marketplace_anuncios ADD COLUMN IF NOT EXISTS patrocinado_ate TIMESTAMPTZ`

  await sql`
    CREATE TABLE IF NOT EXISTS marketplace_lojas (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      garagem_id  TEXT NOT NULL REFERENCES garagens(id) ON DELETE CASCADE,
      nome        TEXT NOT NULL,
      descricao   TEXT,
      logo_url    TEXT,
      banner_url  TEXT,
      instagram   TEXT,
      whatsapp    TEXT,
      website     TEXT,
      criada_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(garagem_id)
    )
  `
  await sql`ALTER TABLE marketplace_anuncios ADD COLUMN IF NOT EXISTS loja_id TEXT REFERENCES marketplace_lojas(id) ON DELETE SET NULL`

  await sql`
    CREATE TABLE IF NOT EXISTS eventos_calendario (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      titulo      TEXT NOT NULL,
      descricao   TEXT,
      data_inicio DATE NOT NULL,
      data_fim    DATE,
      local       TEXT,
      url         TEXT,
      imagem_url  TEXT,
      tipo        TEXT NOT NULL DEFAULT 'encontro' CHECK (tipo IN ('encontro','corrida','rally','drift','exposicao','show','patrocinado')),
      patrocinado BOOLEAN NOT NULL DEFAULT false,
      patrocinado_ate TIMESTAMPTZ,
      garagem_id  TEXT REFERENCES garagens(id) ON DELETE SET NULL,
      criado_por  TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
      criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_eventos_data ON eventos_calendario(data_inicio)`
}
