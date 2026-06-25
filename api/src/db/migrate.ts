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

  // ── Tracks ────────────────────────────────────────────────────────────────

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

  await sql`
    CREATE TABLE IF NOT EXISTS rotas (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      nome          TEXT NOT NULL,
      descricao     TEXT,
      ponto_a_nome  TEXT NOT NULL,
      ponto_a_lat   NUMERIC(10,7) NOT NULL,
      ponto_a_lng   NUMERIC(10,7) NOT NULL,
      ponto_b_nome  TEXT NOT NULL,
      ponto_b_lat   NUMERIC(10,7) NOT NULL,
      ponto_b_lng   NUMERIC(10,7) NOT NULL,
      distancia_km  NUMERIC(8,2),
      tempo_ideal_s INT,
      regiao        TEXT,
      ativa         BOOLEAN NOT NULL DEFAULT true,
      criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS runs (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      usuario_id    TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      veiculo_id    TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
      rota_id       TEXT NOT NULL REFERENCES rotas(id) ON DELETE CASCADE,
      status        TEXT NOT NULL DEFAULT 'em_andamento'
                    CHECK (status IN ('em_andamento','concluida','cancelada')),
      iniciada_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
      concluida_em  TIMESTAMPTZ,
      duracao_s     INT,
      distancia_km  NUMERIC(8,3),
      vel_media_kmh NUMERIC(6,2),
      vel_max_kmh   NUMERIC(6,2),
      clima         TEXT,
      temperatura_c NUMERIC(4,1),
      periodo_dia   TEXT CHECK (periodo_dia IN ('manha','tarde','noite','madrugada'))
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_runs_usuario ON runs(usuario_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_runs_rota   ON runs(rota_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS run_pontos (
      id             BIGSERIAL PRIMARY KEY,
      run_id         TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      offset_ms      INT NOT NULL,
      lat            NUMERIC(10,7) NOT NULL,
      lng            NUMERIC(10,7) NOT NULL,
      velocidade_kmh NUMERIC(6,2)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_run_pontos_run ON run_pontos(run_id, offset_ms)`

  await sql`
    CREATE TABLE IF NOT EXISTS badges (
      id        TEXT PRIMARY KEY,
      nome      TEXT NOT NULL,
      descricao TEXT NOT NULL,
      emoji     TEXT NOT NULL
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS usuario_badges (
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      badge_id   TEXT NOT NULL REFERENCES badges(id),
      ganho_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
      run_id     TEXT REFERENCES runs(id) ON DELETE SET NULL,
      PRIMARY KEY (usuario_id, badge_id)
    )
  `

  // Seed dos badges fixos (INSERT OR IGNORE)
  await sql`
    INSERT INTO badges (id, nome, descricao, emoji) VALUES
      ('night_rider',  'Night Rider',    'Completou uma rota de madrugada (0h–5h)',           '🌙'),
      ('early_bird',   'Early Bird',     'Completou uma rota antes das 7h',                   '🌅'),
      ('clockwork',    'Clockwork',      'Fez a mesma rota 3x com menos de 1 min de variação','⏱️'),
      ('regularidade', 'Regularidade',   'Chegou dentro de 60 s do tempo ideal da rota',       '🎯'),
      ('primeiro_km',  'Primeiro KM',    'Completou sua primeira rota',                        '🏁'),
      ('chuva',        'Chuva de Prata', 'Completou uma rota sob chuva',                       '🌧️'),
      ('velocista',    'Velocista',      'Registrou mais de 200 km/h em uma run',              '⚡')
    ON CONFLICT (id) DO NOTHING
  `

  // Seed das rotas oficiais (5 percursos brasileiros reais)
  await sql`
    INSERT INTO rotas (nome, descricao, ponto_a_nome, ponto_a_lat, ponto_a_lng,
                       ponto_b_nome, ponto_b_lat, ponto_b_lng,
                       distancia_km, tempo_ideal_s, regiao)
    VALUES
      (
        'Foz do Iguaçu → Cataratas',
        'Do centro de Foz até a entrada do Parque Nacional do Iguaçu. Rota turística clássica pelo sul do Brasil.',
        'Terminal Rodoviário de Foz do Iguaçu', -25.5478, -54.5882,
        'Parque Nacional do Iguaçu', -25.6953, -54.4367,
        21.0, 1500, 'Sul'
      ),
      (
        'Foz do Iguaçu → Puerto Iguazú',
        'Travessia internacional pela Ponte da Amizade. Brasil → Argentina em menos de 20 minutos.',
        'Aduana Brasileira (Ponte da Amizade)', -25.5278, -54.5700,
        'Aduana Argentina (Puerto Iguazú)', -25.5943, -54.5733,
        14.0, 1200, 'Sul'
      ),
      (
        'Florianópolis → Lagoa da Conceição',
        'Do centro histórico da ilha até a Lagoa, passando pelas curvas da SC-401. Visual cinematográfico.',
        'Centro Histórico Florianópolis', -27.5954, -48.5480,
        'Lagoa da Conceição', -27.5901, -48.4523,
        14.0, 1080, 'Sul'
      ),
      (
        'Curitiba → Serra da Graciosa',
        'Descida histórica pela Estrada da Graciosa (PR-410). Uma das estradas mais bonitas do Brasil.',
        'Praça Tiradentes — Curitiba', -25.4297, -49.2711,
        'Mirante da Serra da Graciosa', -25.3200, -48.8900,
        70.0, 5400, 'Sul'
      ),
      (
        'Vila Mariana → Autódromo de Interlagos',
        'Percurso urbano paulistano com destino ao Autódromo José Carlos Pace. Clássico da cena motorsport de SP.',
        'Vila Mariana — São Paulo', -23.5875, -46.6406,
        'Autódromo de Interlagos', -23.7017, -46.6983,
        18.0, 2100, 'Sudeste'
      )
    ON CONFLICT DO NOTHING
  `

  console.log("✔ Migrations concluídas.")
  await sql.end()
}

migrate().catch((err) => {
  console.error("✖ Migration falhou:", err)
  process.exit(1)
})
