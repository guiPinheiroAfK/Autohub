import { useEffect, useState } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { CheckCircle, XCircle, Loader, Mail } from "lucide-react"
import { api } from "@/lib/api/client"

type Estado = "loading" | "sucesso" | "erro" | "sem-token"

export default function VerificarEmailPage() {
  const [params] = useSearchParams()
  const token = params.get("token")
  const [estado, setEstado] = useState<Estado>(token ? "loading" : "sem-token")
  const [mensagem, setMensagem] = useState("")
  const [reenviando, setReenviando] = useState(false)
  const [email, setEmail] = useState("")
  const [reenviado, setReenviado] = useState(false)

  useEffect(() => {
    if (!token) return
    api.get<{ ok: boolean }>(`/auth/verificar-email?token=${token}`)
      .then(() => setEstado("sucesso"))
      .catch(e => { setEstado("erro"); setMensagem(e.message ?? "Token inválido ou expirado.") })
  }, [token])

  async function reenviar() {
    if (!email) return
    setReenviando(true)
    try {
      await api.post("/auth/reenviar-verificacao", { email })
      setReenviado(true)
    } finally {
      setReenviando(false)
    }
  }

  if (estado === "loading") {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <Loader className="size-8 animate-spin text-purple" />
        <p className="text-sm text-muted-foreground">Verificando e-mail...</p>
      </div>
    )
  }

  if (estado === "sucesso") {
    return (
      <div className="flex flex-col items-center gap-6 py-24 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-green-bg">
          <CheckCircle className="size-8 text-green" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">E-mail verificado!</h2>
          <p className="mt-2 text-sm text-muted-foreground">Sua conta está confirmada. Bem-vindo ao AutoHub.</p>
        </div>
        <Link to="/" className="rounded-xl bg-purple px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">
          Entrar na garagem
        </Link>
      </div>
    )
  }

  if (estado === "sem-token") {
    return (
      <div className="flex flex-col items-center gap-6 py-24 text-center max-w-sm mx-auto">
        <div className="flex size-16 items-center justify-center rounded-full bg-purple-bg">
          <Mail className="size-8 text-purple" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Reenviar verificação</h2>
          <p className="mt-2 text-sm text-muted-foreground">Digite seu e-mail para receber um novo link de verificação.</p>
        </div>
        {reenviado ? (
          <p className="text-sm font-medium text-green">E-mail enviado! Verifique sua caixa de entrada.</p>
        ) : (
          <div className="flex w-full flex-col gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
            />
            <button
              onClick={reenviar}
              disabled={reenviando || !email}
              className="w-full rounded-lg bg-purple px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {reenviando ? "Enviando..." : "Reenviar verificação"}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 py-24 text-center max-w-sm mx-auto">
      <div className="flex size-16 items-center justify-center rounded-full bg-red-bg">
        <XCircle className="size-8 text-red" />
      </div>
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Link inválido</h2>
        <p className="mt-2 text-sm text-muted-foreground">{mensagem}</p>
      </div>
      {reenviado ? (
        <p className="text-sm font-medium text-green">Novo e-mail enviado!</p>
      ) : (
        <div className="flex w-full flex-col gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
          />
          <button
            onClick={reenviar}
            disabled={reenviando || !email}
            className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-surface"
          >
            {reenviando ? "Enviando..." : "Reenviar link"}
          </button>
        </div>
      )}
    </div>
  )
}
