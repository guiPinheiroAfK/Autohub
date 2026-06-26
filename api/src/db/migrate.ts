/**
 * migrate.ts — cria todas as tabelas do schema se não existirem.
 * Roda antes do servidor subir (via `bun run migrate`).
 * Sem lib de migration por enquanto; para mudanças futuras, adicionar
 * uma tabela _migrations e numerar os scripts.
 */

import { sql } from "./client.ts"

async function migrate() {
  console.log("▶ Rodando migrations...")

  await sql`
    CREATE TABLE IF NOT EXISTS usuarios (
                                          id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      nome          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      hashed_password TEXT NOT NULL,
      avatar_url    TEXT,
      ativo         BOOLEAN NOT NULL DEFAULT true,
      criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
      )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS garagens (
                                          id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      usuario_id  TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      nome        TEXT NOT NULL,
      slug        TEXT NOT NULL UNIQUE,
      bio         TEXT,
      criada_em   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_garagens_usuario ON garagens(usuario_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS veiculos (
                                          id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      garagem_id        TEXT NOT NULL REFERENCES garagens(id) ON DELETE CASCADE,
      apelido           TEXT NOT NULL,
      marca             TEXT NOT NULL,
      modelo            TEXT NOT NULL,
      ano_fabricacao    INT NOT NULL,
      ano_modelo        INT NOT NULL,
      perfil            TEXT NOT NULL CHECK (perfil IN ('daily','street_build','restomod','track','project')),
      status            TEXT NOT NULL DEFAULT 'planejamento' CHECK (status IN ('planejamento','em_andamento','concluido','pausado')),
      visibilidade      TEXT NOT NULL DEFAULT 'privado' CHECK (visibilidade IN ('publico','privado')),
      capa_url          TEXT,
      meta_potencia_whp INT,
      criado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
      )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_veiculos_garagem ON veiculos(garagem_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS fornecedores (
                                              id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      usuario_id    TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
      nome          TEXT NOT NULL,
      pais          TEXT NOT NULL,
      avaliacao     NUMERIC(2,1) CHECK (avaliacao BETWEEN 0 AND 5),
      link_rastreio TEXT,
      observacoes   TEXT
      )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_fornecedores_usuario ON fornecedores(usuario_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS fases (
                                       id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      veiculo_id    TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
      titulo        TEXT NOT NULL,
      ordem         INT NOT NULL DEFAULT 0,
      status        TEXT NOT NULL DEFAULT 'planejado' CHECK (status IN ('planejado','andamento','concluido')),
      orcamento_min NUMERIC(12,2) NOT NULL DEFAULT 0,
      orcamento_max NUMERIC(12,2) NOT NULL DEFAULT 0,
      moeda         TEXT NOT NULL DEFAULT 'BRL' CHECK (moeda IN ('BRL','USD','PYG')),
      nota          TEXT
      )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_fases_veiculo ON fases(veiculo_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS itens (
                                       id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      fase_id       TEXT NOT NULL REFERENCES fases(id) ON DELETE CASCADE,
      nome          TEXT NOT NULL,
      detalhe       TEXT,
      preco_min     NUMERIC(12,2) NOT NULL DEFAULT 0,
      preco_max     NUMERIC(12,2) NOT NULL DEFAULT 0,
      moeda         TEXT NOT NULL DEFAULT 'BRL' CHECK (moeda IN ('BRL','USD','PYG')),
      status        TEXT NOT NULL DEFAULT 'planejado' CHECK (status IN ('planejado','andamento','concluido')),
      fornecedor_id TEXT REFERENCES fornecedores(id) ON DELETE SET NULL,
      link_compra   TEXT
      )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_itens_fase ON itens(fase_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS documentos (
                                            id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      veiculo_id     TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
      tipo           TEXT NOT NULL CHECK (tipo IN ('manual','recibo','nota_fiscal','crlv','outro')),
      nome_arquivo   TEXT NOT NULL,
      url            TEXT NOT NULL,
      tamanho_bytes  INT NOT NULL DEFAULT 0,
      criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
      )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_documentos_veiculo ON documentos(veiculo_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS despesas (
                                          id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      item_id       TEXT NOT NULL REFERENCES itens(id) ON DELETE CASCADE,
      valor         NUMERIC(12,2) NOT NULL,
      moeda         TEXT NOT NULL CHECK (moeda IN ('BRL','USD','PYG')),
      data          TIMESTAMPTZ NOT NULL,
      fornecedor_id TEXT REFERENCES fornecedores(id) ON DELETE SET NULL,
      documento_id  TEXT REFERENCES documentos(id) ON DELETE SET NULL
      )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_despesas_item ON despesas(item_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS cotacoes (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      data        DATE NOT NULL DEFAULT CURRENT_DATE,
      par         TEXT NOT NULL,
      taxa_compra NUMERIC(18,6) NOT NULL,
      taxa_venda  NUMERIC(18,6) NOT NULL,
      fonte       TEXT NOT NULL DEFAULT 'awesomeapi',
      criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(data, par)
    )
  `

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

  console.log("✔ Migrations concluídas.")
}

migrate().catch((err) => {
  console.error("✖ Migration falhou:", err)
  process.exit(1)
})
