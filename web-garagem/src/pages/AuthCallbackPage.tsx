import { useEffect, useState } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { Loader2, AlertCircle } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { api } from "@/lib/api/client"

export default function AuthCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [erro, setErro] = useState("")

  useEffect(() => {
    const token = params.get("token")
    const erro   = params.get("erro")

    if (erro) {
      const msgs: Record<string, string> = {
        google_cancelado: "Login com Google cancelado.",
        state_invalido:   "Sessão expirada. Tente novamente.",
        google_falhou:    "Falha ao autenticar com Google. Tente novamente.",
      }
      setErro(msgs[erro] ?? "Erro ao fazer login.")
      return
    }

    if (!token) {
      setErro("Token não encontrado.")
      return
    }

    localStorage.setItem("autohub_token", token)
    refreshUser().then(() => navigate("/", { replace: true }))
  }, [])

  if (erro) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <div className="flex items-center gap-2 text-red">
          <AlertCircle className="size-5" />
          <p className="text-sm font-medium">{erro}</p>
        </div>
        <button
          onClick={() => navigate("/login")}
          className="text-sm text-purple hover:underline"
        >
          Voltar ao login
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <Loader2 className="size-6 animate-spin text-purple" />
      <p className="text-sm text-muted-foreground">Autenticando...</p>
    </div>
  )
}
