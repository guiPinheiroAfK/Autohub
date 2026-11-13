/**
 * Migration v7 — salas de duelo online do AutoDash.
 * SQL copiado sem alteração de db/migrate.ts.
 * Esta versão já foi aplicada no Neon: não reescrever o SQL, só criar uma versão nova.
 */

import { sql } from "../client.ts"

export async function aplicar() {
  // ── v7: salas de duelo online do AutoDash ────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS autodash_rooms (
      code        TEXT PRIMARY KEY,
      seed        INT NOT NULL,
      host_name   TEXT NOT NULL,
      guest_name  TEXT,
      start_at    TIMESTAMPTZ,
      host_state  JSONB,
      guest_state JSONB,
      criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  await sql`ALTER TABLE autodash_rooms ADD COLUMN IF NOT EXISTS rematch_host BOOLEAN NOT NULL DEFAULT false`
  await sql`ALTER TABLE autodash_rooms ADD COLUMN IF NOT EXISTS rematch_guest BOOLEAN NOT NULL DEFAULT false`
}
