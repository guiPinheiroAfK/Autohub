/**
 * Migration v4 — AutoHub Tracks: rotas, runs, pontos de telemetria e badges.
 * SQL copiado sem alteração de db/migrate.ts.
 * Esta versão já foi aplicada no Neon: não reescrever o SQL, só criar uma versão nova.
 */

import { sql } from "../client.ts"

export async function aplicar() {
  // ── v4: AutoHub Tracks — rotas, runs, telemetria e badges ────────────────────
  // (estas tabelas já existiam em produção mas faltavam no migrate; agora
  //  reproduzidas fielmente para que um banco novo nasça completo)
  await sql`
    CREATE TABLE IF NOT EXISTS rotas (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      nome          TEXT NOT NULL,
      descricao     TEXT,
      regiao        TEXT,
      ponto_a_nome  TEXT NOT NULL DEFAULT 'Largada livre',
      ponto_a_lat   NUMERIC NOT NULL DEFAULT 0,
      ponto_a_lng   NUMERIC NOT NULL DEFAULT 0,
      ponto_b_nome  TEXT NOT NULL,
      ponto_b_lat   NUMERIC NOT NULL DEFAULT 0,
      ponto_b_lng   NUMERIC NOT NULL DEFAULT 0,
      distancia_km  NUMERIC,
      tempo_ideal_s INTEGER,
      ativa         BOOLEAN NOT NULL DEFAULT true,
      oficial       BOOLEAN NOT NULL DEFAULT false,
      criado_por    TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
      criada_em     TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  // Colunas novas em bancos que já tinham 'rotas' (produção)
  await sql`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS oficial BOOLEAN NOT NULL DEFAULT false`
  await sql`ALTER TABLE rotas ADD COLUMN IF NOT EXISTS criado_por TEXT REFERENCES usuarios(id) ON DELETE SET NULL`
  // Rotas curadas pré-existentes (sem dono) passam a ser oficiais
  await sql`UPDATE rotas SET oficial = true WHERE criado_por IS NULL AND oficial = false`

  await sql`
    CREATE TABLE IF NOT EXISTS runs (
      id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      usuario_id    TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      veiculo_id    TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
      rota_id       TEXT NOT NULL REFERENCES rotas(id) ON DELETE CASCADE,
      status        TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento','concluida','cancelada')),
      iniciada_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
      concluida_em  TIMESTAMPTZ,
      duracao_s     INTEGER,
      distancia_km  NUMERIC,
      vel_media_kmh NUMERIC,
      vel_max_kmh   NUMERIC,
      clima         TEXT,
      temperatura_c NUMERIC,
      periodo_dia   TEXT
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_runs_rota ON runs(rota_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_runs_usuario ON runs(usuario_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS run_pontos (
      id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      run_id         TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      offset_ms      INTEGER NOT NULL,
      lat            NUMERIC NOT NULL,
      lng            NUMERIC NOT NULL,
      velocidade_kmh NUMERIC
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_run_pontos_run ON run_pontos(run_id)`

  await sql`
    CREATE TABLE IF NOT EXISTS badges (
      id        TEXT PRIMARY KEY,
      nome      TEXT NOT NULL,
      descricao TEXT,
      emoji     TEXT
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS usuario_badges (
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      badge_id   TEXT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
      run_id     TEXT REFERENCES runs(id) ON DELETE SET NULL,
      ganho_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (usuario_id, badge_id)
    )
  `
}
