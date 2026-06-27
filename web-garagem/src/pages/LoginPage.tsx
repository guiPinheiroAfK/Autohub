import { useState, useEffect, type FormEvent } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api/client"

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

function WheelSVG({ size = 56, opacity = 1 }: { size?: number; opacity?: number }) {
  const spoke =
    "M 63 50 Q 70 27 77.96 20.01 A 41 41 0 0 1 90.94 47.85 Q 82 57 63 50 Z " +
    "M 66 50 Q 72 35 77.07 24.77 A 37 37 0 0 1 86.86 46.78 Q 80 55 66 50 Z"
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ opacity }} aria-hidden="true">
      <defs>
        <linearGradient id="wg" x1="15%" y1="5%" x2="85%" y2="95%" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e879f9" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="43.5" stroke="url(#wg)" strokeWidth="5" />
      <g fill="url(#wg)" fillRule="evenodd" transform="rotate(-90,50,50)">
        {[0, 72, 144, 216, 288].map((a) => (
          <path key={a} d={spoke} transform={a ? `rotate(${a},50,50)` : undefined} />
        ))}
      </g>
      <circle cx="50" cy="50" r="13.5" stroke="url(#wg)" strokeWidth="4.5" />
      <circle cx="50" cy="50" r="4" fill="url(#wg)" />
    </svg>
  )
}

const API_ORIGIN = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:8000" : "")

type Tab = "login" | "register"
type View = "form" | "esqueci" | "esqueci-ok"

export default function LoginPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>("login")
  const [view, setView] = useState<View>("form")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPass, setShowPass] = useState(false)

  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [wheelSpinning, setWheelSpinning] = useState(false)

  useEffect(() => {
    if (!sessionStorage.getItem("login-wheel-spun")) {
      sessionStorage.setItem("login-wheel-spun", "1")
      setWheelSpinning(true)
      const t = setTimeout(() => setWheelSpinning(false), 800)
      return () => clearTimeout(t)
    }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (tab === "login") {
        await login(email, password)
      } else {
        await register(nome, email, password)
      }
      navigate("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }

  async function handleEsqueciSenha(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post("/auth/esqueci-senha", { email })
      setView("esqueci-ok")
    } catch {
      setView("esqueci-ok")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground animate-page-in">

      {/* ── Painel visual (desktop only) ─────────────────────────────────────── */}
      <div className="hidden lg:flex lg:flex-1 lg:flex-col relative overflow-hidden" style={{ backgroundColor: "#0a0a0f" }}>
        {/* Camada 1 — gradiente de base (aparece quando não há foto) */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#13101c] to-[#1c1430]" />

        {/* Camada 2 — brilho roxo suave no canto */}
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(120% 80% at 85% 15%, rgba(127,119,221,0.18), transparent 60%)" }}
        />

        {/* Camada 3 — foto de fundo (opcional: public/login-bg.jpg) */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "url('/login-bg.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />

        {/* Camada 4 — overlay escuro para legibilidade do texto */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/55 to-purple/10" />

        {/* Roda decorativa grande — fundo */}
        <div className={`absolute -bottom-24 -right-24 opacity-[0.06] pointer-events-none ${wheelSpinning ? "animate-wheel-spin" : ""}`}>
          <WheelSVG size={520} />
        </div>

        {/* Conteúdo sobre o overlay */}
        <div className="relative z-10 flex flex-col justify-between h-full px-10 py-10">
          {/* Logo topo-esquerda */}
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur-sm">
              <WheelSVG size={22} />
            </div>
            <span className="font-display text-base font-bold text-white">AutoHub</span>
          </div>

          {/* Copy — rodapé */}
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-3xl font-display font-bold text-white leading-snug max-w-[340px]">
                Sua garagem.<br />Sua história.
              </p>
              <p className="mt-3 text-sm text-white/60 leading-relaxed max-w-[300px]">
                Documente cada modificação, acompanhe builds da comunidade e conecte-se com quem respira automobilismo.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <p className="text-[11px] text-white/30">autohub.app</p>
              <span className="text-white/20">·</span>
              <Link
                to="/info"
                className="text-[11px] text-white/40 hover:text-white/70 transition-colors underline underline-offset-2"
              >
                Saiba mais
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Painel do form ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center lg:max-w-[480px] px-6 py-10 sm:px-10">
        <div className="w-full max-w-[360px]">

          {/* Mobile: logo acima do form */}
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-purple-bg ring-1 ring-purple/20">
              <WheelSVG size={36} />
            </div>
            <div className="text-center">
              <h1 className="font-display text-xl font-bold text-foreground">AutoHub</h1>
              <p className="text-sm text-muted-foreground">Sua garagem. Sua história.</p>
            </div>
          </div>

          {/* Desktop: título contextual */}
          <div className="mb-7 hidden lg:block">
            <h2 className="font-display text-2xl font-bold text-foreground">
              {view === "form"
                ? tab === "login" ? "Bem-vindo de volta" : "Crie sua conta"
                : "Recuperar senha"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {view === "form"
                ? tab === "login" ? "Entre para acessar sua garagem" : "Comece a documentar seu build hoje"
                : "Enviaremos um link para redefinir a senha"}
            </p>
          </div>

          {/* ── View: esqueci senha ── */}
          {(view === "esqueci" || view === "esqueci-ok") ? (
            view === "esqueci-ok" ? (
              <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
                <p className="text-sm font-semibold text-foreground">E-mail enviado!</p>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  Se existe uma conta com esse e-mail, você receberá um link para redefinir a senha em breve.
                </p>
                <button
                  onClick={() => { setView("form"); setError(null) }}
                  className="text-sm text-purple hover:underline text-left"
                >
                  ← Voltar ao login
                </button>
              </div>
            ) : (
              <form onSubmit={handleEsqueciSenha} className="flex flex-col gap-4">
                <p className="text-[13px] text-muted-foreground">
                  Digite seu e-mail e enviaremos um link para redefinir a senha.
                </p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint-foreground">E-mail</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-purple py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? "Enviando..." : "Enviar link"}
                </button>
                <button
                  type="button"
                  onClick={() => { setView("form"); setError(null) }}
                  className="text-center text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
              </form>
            )
          ) : (
            /* ── View: form principal ── */
            <div className="flex flex-col gap-4">
              <a
                href={`${API_ORIGIN}/auth/google`}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-surface py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-surface-2"
              >
                <GoogleIcon />
                Continuar com Google
              </a>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-background px-3 text-[11px] text-faint-foreground">ou</span>
                </div>
              </div>

              <div className="flex rounded-lg border border-border bg-surface p-1">
                {(["login", "register"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setTab(t); setError(null) }}
                    className={[
                      "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors",
                      tab === t
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    {t === "login" ? "Entrar" : "Criar conta"}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {tab === "register" && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint-foreground">Nome</label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Gui Vargas"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint-foreground">E-mail</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="gui@email.com"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint-foreground">Senha</label>
                    {tab === "login" && (
                      <button
                        type="button"
                        onClick={() => setView("esqueci")}
                        className="text-[11px] text-purple hover:underline"
                      >
                        Esqueci minha senha
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="mínimo 8 caracteres"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-faint-foreground hover:text-foreground"
                    >
                      {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="rounded-lg border border-red-bg bg-red-bg px-3 py-2 text-sm text-red">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-purple py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Aguarde..." : tab === "login" ? "Entrar" : "Criar conta"}
                </button>

                {tab === "register" && (
                  <p className="text-center text-[11px] text-faint-foreground">
                    Ao criar conta, você receberá um e-mail de verificação.
                  </p>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
