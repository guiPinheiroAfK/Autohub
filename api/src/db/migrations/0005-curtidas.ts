/**
 * Migration v5 — curtidas em veículos públicos.
 * SQL copiado sem alteração de db/migrate.ts.
 * Esta versão já foi aplicada no Neon: não reescrever o SQL, só criar uma versão nova.
 */

import { sql } from "../client.ts"

export async function aplicar() {
  // ── v5: curtidas em veículos públicos ────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS curtidas (
      veiculo_id TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (veiculo_id, usuario_id)
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_curtidas_veiculo ON curtidas(veiculo_id)`
}
