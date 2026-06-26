/**
 * Google OAuth 2.0 — Authorization Code Flow
 *
 * Variáveis de ambiente necessárias:
 *   GOOGLE_CLIENT_ID     — obtido no Google Cloud Console
 *   GOOGLE_CLIENT_SECRET — obtido no Google Cloud Console
 *   APP_URL              — URL base da API (ex: https://autohubbr.netlify.app em prod,
 *                          http://localhost:8000 em dev)
 *   FRONTEND_URL         — URL do frontend (ex: http://localhost:5173 em dev,
 *                          deixar vazio em prod pois frontend e backend ficam no mesmo domínio)
 *
 * No Google Console, registrar os redirect URIs:
 *   https://autohubbr.netlify.app/auth/google/callback
 *   http://localhost:8000/auth/google/callback
 */

import { Hono } from "hono"
import { sql } from "../db/client.ts"
import { signToken } from "../middleware/jwt.ts"

export const googleAuthRoutes = new Hono()

const GOOGLE_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_USER_URL  = "https://www.googleapis.com/oauth2/v2/userinfo"

function getClientId()     { return process.env.GOOGLE_CLIENT_ID ?? "" }
function getClientSecret() { return process.env.GOOGLE_CLIENT_SECRET ?? "" }

function getRedirectUri() {
  const base = process.env.APP_URL ?? "http://localhost:8000"
  return `${base}/auth/google/callback`
}

function getFrontendUrl() {
  // Em produção, front e back ficam no mesmo domínio → sem FRONTEND_URL
  return process.env.FRONTEND_URL ?? process.env.APP_URL ?? "http://localhost:5173"
}

function buildSlug(nome: string, suffix: string) {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 54) + "-" + suffix
}

// GET /auth/google — inicia o fluxo OAuth
googleAuthRoutes.get("/google", (c) => {
  if (!getClientId()) {
    return c.json({ error: "Google OAuth não configurado" }, 503)
  }

  const state = crypto.randomUUID()
  const params = new URLSearchParams({
    client_id:    getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope:        "openid email profile",
    state,
    access_type:  "online",
    prompt:       "select_account",
  })

  // Guarda state em cookie de curta duração para validar no callback
  const res = c.redirect(`${GOOGLE_AUTH_URL}?${params}`, 302)
  res.headers.append("Set-Cookie", `oauth_state=${state}; HttpOnly; SameSite=Lax; Max-Age=300; Path=/`)
  return res
})

// GET /auth/google/callback — Google redireciona aqui com ?code=...&state=...
googleAuthRoutes.get("/google/callback", async (c) => {
  const { code, state, error: oauthError } = c.req.query()
  const frontendUrl = getFrontendUrl()

  if (oauthError || !code) {
    return c.redirect(`${frontendUrl}/login?erro=google_cancelado`, 302)
  }

  // Valida state (best-effort: lê do cookie se disponível)
  const cookieHeader = c.req.header("cookie") ?? ""
  const stateCookie  = cookieHeader.split(";").find(s => s.trim().startsWith("oauth_state="))?.split("=")[1]
  if (stateCookie && stateCookie !== state) {
    return c.redirect(`${frontendUrl}/login?erro=state_invalido`, 302)
  }

  try {
    // 1. Troca code por access_token
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     getClientId(),
        client_secret: getClientSecret(),
        redirect_uri:  getRedirectUri(),
        grant_type:    "authorization_code",
      }),
    })

    if (!tokenRes.ok) {
      throw new Error("Falha ao trocar code por token")
    }

    const tokens = await tokenRes.json() as { access_token: string }

    // 2. Busca perfil do usuário
    const userRes = await fetch(GOOGLE_USER_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!userRes.ok) throw new Error("Falha ao buscar perfil do Google")

    const gUser = await userRes.json() as {
      id: string; email: string; name: string; picture?: string
    }

    if (!gUser.email || !gUser.id) throw new Error("Perfil do Google inválido")

    // 3. Acha ou cria o usuário
    let usuario: { id: string; email: string } | undefined

    // a) Já tem google_id vinculado
    const [porGoogleId] = await sql`
      SELECT id, email FROM usuarios WHERE google_id = ${gUser.id} LIMIT 1
    `
    if (porGoogleId) {
      usuario = porGoogleId as { id: string; email: string }
    } else {
      // b) Já tem conta por e-mail → vincula o google_id
      const [porEmail] = await sql`SELECT id, email FROM usuarios WHERE email = ${gUser.email} LIMIT 1`
      if (porEmail) {
        await sql`UPDATE usuarios SET google_id = ${gUser.id} WHERE id = ${porEmail.id}`
        usuario = porEmail as { id: string; email: string }
      } else {
        // c) Cria nova conta (sem senha — só Google)
        const newUserId = crypto.randomUUID()
        const newSlug = buildSlug(gUser.name, newUserId.slice(0, 6))
        const [[newU]] = await sql.transaction((tx) => [
          tx`INSERT INTO usuarios (id, nome, email, hashed_password, google_id, email_verificado, avatar_url)
             VALUES (${newUserId}, ${gUser.name}, ${gUser.email}, ${"google_oauth_no_password"},
                     ${gUser.id}, true, ${gUser.picture ?? null})
             RETURNING id, email`,
          tx`INSERT INTO garagens (usuario_id, nome, slug)
             VALUES (${newUserId}, ${"Garagem de " + gUser.name}, ${newSlug})`,
        ])
        usuario = { id: newU.id as string, email: newU.email as string }
      }
    }

    // 4. Emite JWT e redireciona para o frontend
    const jwt = await signToken({ sub: usuario.id, email: usuario.email })

    // Limpa o cookie de state e redireciona
    const res = c.redirect(`${frontendUrl}/auth/callback?token=${encodeURIComponent(jwt)}`, 302)
    res.headers.append("Set-Cookie", "oauth_state=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/")
    return res

  } catch (err) {
    console.error("[google-auth] erro:", err)
    return c.redirect(`${frontendUrl}/login?erro=google_falhou`, 302)
  }
})
