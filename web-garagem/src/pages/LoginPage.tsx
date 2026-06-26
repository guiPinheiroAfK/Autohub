import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Wrench, Eye, EyeOff } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api/client"

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
      setView("esqueci-ok") // silencioso mesmo em caso de erro
    } finally {
      setLoading(false)
    }
  }

  if (view === "esqueci" || view === "esqueci-ok") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-[380px] animate-page-in">
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-xl bg-purple-bg text-purple">
              <Wrench className="size-6" />
            </div>
            <h1 className="font-display text-xl font-semibold text-foreground">Recuperar senha</h1>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6">
            {view === "esqueci-ok" ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <p className="text-sm text-foreground font-medium">E-mail enviado!</p>
                <p className="text-[13px] text-muted-foreground">
                  Se existe uma conta com esse e-mail, você receberá um link para redefinir a senha em breve.
                </p>
                <button
                  onClick={() => { setView("form"); setError(null) }}
                  className="text-sm text-purple hover:underline"
                >
                  Voltar ao login
                </button>
              </div>
            ) : (
              <form onSubmit={handleEsqueciSenha} className="flex flex-col gap-4">
                <p className="text-[13px] text-muted-foreground">
                  Digite seu e-mail e enviaremos um link para redefinir a senha.
                </p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint-foreground">
                    E-mail
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-purple py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
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
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[380px] animate-page-in">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-purple-bg text-purple">
            <Wrench className="size-6" />
          </div>
          <div className="text-center">
            <h1 className="font-display text-xl font-semibold text-foreground">AutoHub Garagem</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Gerencie seus projetos de build</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6">
          <div className="mb-6 flex rounded-lg border border-border bg-background p-1">
            {(["login", "register"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setError(null) }}
                className={[
                  "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors",
                  tab === t
                    ? "bg-surface text-foreground shadow-sm"
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
                <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint-foreground">
                  Nome
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Gui Vargas"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint-foreground">
                E-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="gui@pinedevs.com.br"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint-foreground">
                  Senha
                </label>
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
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
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
              className="mt-1 w-full rounded-lg bg-purple py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
      </div>
    </div>
  )
}
