/**
 * Migration v8 — modo corrida do AutoDash (até 4 pilotos, por voltas).
 * SQL copiado sem alteração de db/migrate.ts.
 * Esta versão já foi aplicada no Neon: não reescrever o SQL, só criar uma versão nova.
 */

import { sql } from "../client.ts"

export async function aplicar() {
  // ── v8: modo CORRIDA do AutoDash (até 4 pilotos, por voltas) ────────────────
  // Tabela separada do duelo de propósito: o duelo tem 2 slots fixos
  // (host/guest) e largada automática; a corrida tem N participantes numa
  // tabela filha e a largada é dada pelo dono da sala.
  await sql`
    CREATE TABLE IF NOT EXISTS autodash_race_rooms (
      code       TEXT PRIMARY KEY,
      seed       INT NOT NULL,
      voltas     INT NOT NULL DEFAULT 3,
      owner_id   TEXT NOT NULL,
      start_at   TIMESTAMPTZ,
      criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS autodash_race_players (
      code       TEXT NOT NULL REFERENCES autodash_race_rooms(code) ON DELETE CASCADE,
      player_id  TEXT NOT NULL,
      nome       TEXT NOT NULL,
      car        INT NOT NULL DEFAULT 0,
      paint      INT NOT NULL DEFAULT 0,
      estado     JSONB,
      visto_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
      entrou_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (code, player_id)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_race_players_code ON autodash_race_players(code)`
}
