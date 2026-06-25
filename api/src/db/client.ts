import postgres from "postgres"

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error("DATABASE_URL não definida")

// Neon é Postgres de verdade (wire protocol compatível) — não precisa de
// driver especial. Só exige SSL e, como cada invocação de Netlify Function
// pode ser uma instância nova, um pool pequeno evita esgotar as conexões
// do lado do Neon (use a connection string com "-pooler" no host, que já
// passa pelo PgBouncer deles).
const isNeon = DATABASE_URL.includes("neon.tech")

export const sql = postgres(DATABASE_URL, {
  max: isNeon ? 1 : 10,
  idle_timeout: isNeon ? 20 : 30,
  connect_timeout: 10,
  ssl: isNeon ? "require" : undefined,
})
