import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { authMiddleware } from "./middleware/auth"
import { authRoutes } from "./routes/auth"
import { veiculosRoutes } from "./routes/veiculos"
import { fasesRoutes } from "./routes/fases"
import { itensRoutes } from "./routes/itens"
import { cotacoesRoutes } from "./routes/cotacoes"
import { sql } from "./db/client"
import type { AppEnv } from "./types"

export const app = new Hono()

// ── Middlewares globais ─────────────────────────────────────────────────────
app.use(logger())
app.use(
    cors({
        // Em produção no Netlify, front e api ficam no mesmo domínio (mesmo site,
        // /api/* e /auth/* roteados pra Function) — CORS nem entra em ação. Isso
        // aqui só importa pro dev local (front em :5173, api em :8000).
        origin: (process.env.CORS_ORIGINS ?? "http://localhost:5173").split(","),
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        credentials: true,
    })
)

// ── Healthcheck ─────────────────────────────────────────────────────────────
app.get("/", (c) => c.json({ ok: true, service: "api" }))

// ── Rotas públicas ───────────────────────────────────────────────────────────
app.route("/auth", authRoutes)

// ── Rotas protegidas ─────────────────────────────────────────────────────────
const api = new Hono<AppEnv>()
api.use("*", authMiddleware)

// /auth/me fica no grupo protegido
api.get("/auth/me", async (c) => {
    const userId = c.get("userId") as string
    const [usuario] = await sql`
    SELECT u.id, u.nome, u.email, u.avatar_url, u.criado_em,
           g.id as garagem_id, g.slug as garagem_slug, g.nome as garagem_nome
    FROM usuarios u
    LEFT JOIN garagens g ON g.usuario_id = u.id
    WHERE u.id = ${userId}
    LIMIT 1
  `
    if (!usuario) return c.json({ error: "Não encontrado" }, 401)
    return c.json({
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        avatarUrl: usuario.avatar_url,
        garagem: {
            id: usuario.garagem_id,
            slug: usuario.garagem_slug,
            nome: usuario.garagem_nome,
        },
    })
})

api.route("/veiculos", veiculosRoutes)
api.route("/", fasesRoutes)
api.route("/itens", itensRoutes)
api.route("/cotacoes", cotacoesRoutes)
app.route("/api", api)
