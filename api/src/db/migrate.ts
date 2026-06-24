/**
 * migrate.ts — cria todas as tabelas do schema se não existirem.
 * Roda antes do servidor subir (via `bun run migrate`).
 * Sem lib de migration por enquanto; para mudanças futuras, adicionar
 * uma tabela _migrations e numerar os scripts.
 */

import { sql } from "./client"

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

  console.log("✔ Migrations concluídas.")
  await sql.end()
}

migrate().catch((err) => {
  console.error("✖ Migration falhou:", err)
  process.exit(1)
})
