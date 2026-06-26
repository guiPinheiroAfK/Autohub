import { useEffect, useState } from "react"
import { useSearchParams, useNavigate, Link } from "react-router-dom"
import { CheckCircle, XCircle, Loader } from "lucide-react"
import { api } from "@/lib/api/client"
import { useAuth } from "@/context/AuthContext"

type Estado = "loading" | "sucesso" | "erro" | "sem-auth"

export default function ConvitePage() {
  const [params] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const token = params.get("token")
  const [estado, setEstado] = useState<Estado>("loading")
  const [veiculoId, setVeiculoId] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState("")

  useEffect(() => {
    if (!token) { setEstado("erro"); setMensagem("Token inválido."); return }
    if (!user) { setEstado("sem-auth"); return }

    api.post<{ ok: boolean; veiculo_id: string }>(`/api/colaboracoes/aceitar/${token}`, {})
      .then(r => { setEstado("sucesso"); setVeiculoId(r.veiculo_id) })
      .catch(e => { setEstado("erro"); setMensagem(e.message ?? "Erro ao aceitar convite.") })
  }, [token, user])

  if (estado === "sem-auth") {
    return (
      <div className="flex flex-col items-center gap-6 py-24 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-purple-bg">
          <CheckCircle className="size-8 text-purple" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Convite encontrado!</h2>
          <p className="mt-2 text-sm text-muted-foreground">Faça login ou crie uma conta para aceitar este convite.</p>
        </div>
        <div className="flex gap-3">
          <Link
            to={`/login?redirect=/convite?token=${token}`}
            className="rounded-xl bg-purple px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Fazer login
          </Link>
          <Link
            to={`/register?redirect=/convite?token=${token}`}
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-surface"
          >
            Criar conta
          </Link>
        </div>
      </div>
    )
  }

  if (estado === "loading") {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <Loader className="size-8 animate-spin text-purple" />
        <p className="text-sm text-muted-foreground">Processando convite...</p>
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
          <h2 className="font-display text-xl font-bold text-foreground">Convite aceito!</h2>
          <p className="mt-2 text-sm text-muted-foreground">Você agora é colaborador neste build.</p>
        </div>
        <button
          onClick={() => navigate(veiculoId ? `/v/${veiculoId}` : "/")}
          className="rounded-xl bg-purple px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Ver o build
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 py-24 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-red-bg">
        <XCircle className="size-8 text-red" />
      </div>
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Convite inválido</h2>
        <p className="mt-2 text-sm text-muted-foreground">{mensagem}</p>
      </div>
      <Link to="/" className="text-sm text-purple hover:underline">Voltar ao início</Link>
    </div>
  )
}
