import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { authMiddleware } from "./middleware/auth.ts"
import { authRoutes } from "./routes/auth.ts"
import { veiculosRoutes } from "./routes/veiculos.ts"
import { fasesRoutes } from "./routes/fases.ts"
import { itensRoutes } from "./routes/itens.ts"
import { cotacoesRoutes } from "./routes/cotacoes.ts"
import { publicoRoutes } from "./routes/publico.ts"
import { socialRoutes } from "./routes/social.ts"
import { colaboracoesRoutes } from "./routes/colaboracoes.ts"
import { authV2Routes } from "./routes/auth-v2.ts"
import { marketplacePublicoRoutes, marketplaceRoutes } from "./routes/marketplace.ts"
import { lojasPublicoRoutes, lojasRoutes } from "./routes/lojas.ts"
import { eventosPublicoRoutes, eventosRoutes } from "./routes/eventos-calendario.ts"
import { googleAuthRoutes } from "./routes/auth-google.ts"
import { comentariosPublicoRoutes, comentariosAuthRoutes } from "./routes/comentarios.ts"
import { sql } from "./db/client.ts"
import type { AppEnv } from "./types.ts"

export const app = new Hono()

// ── Middlewares globais ─────────────────────────────────────────────────────
app.use(logger())
app.use(
    cors({
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
app.route("/auth", authV2Routes)
app.route("/auth", googleAuthRoutes)
app.route("/api", publicoRoutes)
app.route("/api", marketplacePublicoRoutes)
app.route("/api", lojasPublicoRoutes)
app.route("/api", eventosPublicoRoutes)

// Comentários: GET público montado antes do grupo protegido para evitar
// que o authMiddleware em * capture e retorne 401 no GET sem token
app.get("/api/comentarios/:veiculoId", async (c) => {
    const veiculoId = c.req.param("veiculoId")
    const req = new Request(`http://localhost/${veiculoId}`, {
        method: "GET",
        headers: c.req.raw.headers,
    })
    return comentariosPublicoRoutes.fetch(req)
})
// ── Rotas protegidas ─────────────────────────────────────────────────────────
const api = new Hono<AppEnv>()
api.use("*", async (c, next) => {
    if (c.req.method === "GET" && c.req.path.startsWith("/api/comentarios/")) {
        return next()
    }
    return authMiddleware(c, next)
})

// /auth/me fica no grupo protegido
api.get("/auth/me", async (c) => {
    const userId = c.get("userId") as string
    const [usuario] = await sql`
        SELECT u.id, u.nome, u.email, u.avatar_url, u.email_verificado, u.criado_em,
               g.id as garagem_id, g.slug as garagem_slug, g.nome as garagem_nome,
               g.bio as garagem_bio, g.publica as garagem_publica
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
        emailVerificado: usuario.email_verificado,
        garagem: {
            id: usuario.garagem_id,
            slug: usuario.garagem_slug,
            nome: usuario.garagem_nome,
            bio: usuario.garagem_bio,
            publica: usuario.garagem_publica,
        },
    })
})

api.route("/veiculos", veiculosRoutes)
api.route("/", fasesRoutes)
api.route("/itens", itensRoutes)
api.route("/cotacoes", cotacoesRoutes)
api.route("/social", socialRoutes)
api.route("/colaboracoes", colaboracoesRoutes)
api.route("/auth", authV2Routes)
api.route("/marketplace", marketplaceRoutes)
api.route("/lojas", lojasRoutes)
api.route("/eventos-calendario", eventosRoutes)
api.route("/comentarios", comentariosAuthRoutes)
app.route("/api", api)
