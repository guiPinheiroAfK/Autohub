/**
 * Migration v3 — fotos de veículos (Cloudinary), comentários em builds e push subscriptions.
 * SQL copiado sem alteração de db/migrate.ts.
 * Esta versão já foi aplicada no Neon: não reescrever o SQL, só criar uma versão nova.
 */

import { sql } from "../client.ts"

export async function aplicar() {
  // ── v3: fotos de veículos via Cloudinary ─────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS fotos_veiculos (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      veiculo_id TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
      url        TEXT NOT NULL,
      legenda    TEXT,
      ordem      INT NOT NULL DEFAULT 0,
      criada_em  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_fotos_veiculo ON fotos_veiculos(veiculo_id, ordem ASC)`

  // ── v3: comentários em builds públicos ────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS comentarios (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      veiculo_id TEXT NOT NULL REFERENCES veiculos(id) ON DELETE CASCADE,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      texto      TEXT NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 500),
      criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_comentarios_veiculo ON comentarios(veiculo_id, criado_em DESC)`

  // ── v3: push subscriptions para Web Push notifications ───────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      endpoint   TEXT NOT NULL UNIQUE,
      p256dh     TEXT NOT NULL,
      auth       TEXT NOT NULL,
      criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_push_usuario ON push_subscriptions(usuario_id)`
}
