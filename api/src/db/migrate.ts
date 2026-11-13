/**
 * migrate.ts — runner das migrations. Roda antes do servidor subir (via `bun run migrate`).
 * Cada versão fica em db/migrations/ e é executada nesta ordem.
 * Sem lib de migration por enquanto; para mudanças futuras, criar um novo arquivo
 * numerado em db/migrations/ e chamá-lo aqui, no fim da lista.
 * Nunca reescrever o SQL de uma versão já aplicada no Neon.
 */

import { aplicar as v0001 } from "./migrations/0001-schema-base.ts"
import { aplicar as v0002 } from "./migrations/0002-verificacao-marketplace.ts"
import { aplicar as v0003 } from "./migrations/0003-fotos-comentarios-push.ts"
import { aplicar as v0004 } from "./migrations/0004-tracks.ts"
import { aplicar as v0005 } from "./migrations/0005-curtidas.ts"
import { aplicar as v0006 } from "./migrations/0006-autodash-leaderboard.ts"
import { aplicar as v0007 } from "./migrations/0007-autodash-duelo.ts"
import { aplicar as v0008 } from "./migrations/0008-autodash-corrida.ts"

async function migrate() {
  console.log("▶ Rodando migrations...")

  await v0001()
  await v0002()
  await v0003()
  await v0004()
  await v0005()
  await v0006()
  await v0007()
  await v0008()

  console.log("✔ Migrations concluídas.")
}

migrate().catch((err) => {
  console.error("✖ Migration falhou:", err)
  process.exit(1)
})
