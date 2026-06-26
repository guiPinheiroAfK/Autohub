import { neon } from "@neondatabase/serverless"

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error("DATABASE_URL não definida")

export const sql = neon(DATABASE_URL)

// Helper: gera SET clause para UPDATE dinâmico (substitui sql(fields) do postgres.js)
// Uso: const { set, values } = buildSet({ nome: "x", status: "y" })
//      sql.unsafe(`UPDATE t SET ${set} WHERE id = $N`, [...values, id])
// Como neon não tem sql.unsafe, usamos buildSetSql que retorna string segura via substituição.
// Na prática, fazemos SELECT + merge + UPDATE explícito em vez de sql(fields).
