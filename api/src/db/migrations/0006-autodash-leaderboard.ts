/**
 * Migration v6 — leaderboard global do AutoDash (minigame).
 * SQL copiado sem alteração de db/migrate.ts.
 * Esta versão já foi aplicada no Neon: não reescrever o SQL, só criar uma versão nova.
 */

import { sql } from "../client.ts"

export async function aplicar() {
  // ── v6: leaderboard global do AutoDash (minigame) ────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS autodash_scores (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      nome       TEXT NOT NULL,
      pontos     INT NOT NULL CHECK (pontos > 0),
      km         NUMERIC(8,1) NOT NULL DEFAULT 0,
      usuario_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
      criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_autodash_pontos ON autodash_scores(pontos DESC)`
}
