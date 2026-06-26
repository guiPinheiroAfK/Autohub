import { useState } from "react"
import { useSearchParams, Link, useNavigate } from "react-router-dom"
import { KeyRound, Eye, EyeOff, CheckCircle, ArrowLeft } from "lucide-react"
import { api } from "@/lib/api/client"

export default function ResetarSenhaPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get("token")

  const [senha, setSenha] = useState("")
  const [confirma, setConfirma] = useState("")
  const [showSenha, setShowSenha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState("")
  const [sucesso, setSucesso] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (senha.length < 8) { setErro("Mínimo 8 caracteres."); return }
    if (senha !== confirma) { setErro("As senhas não coincidem."); return }
    if (!token) { setErro("Token inválido."); return }

    setLoading(true); setErro("")
    try {
      await api.post("/auth/resetar-senha", { token, nova_senha: senha })
      setSucesso(true)
      setTimeout(() => navigate("/login"), 2500)
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Token inválido ou expirado.")
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <p className="text-sm text-muted-foreground">Link inválido. Solicite um novo reset de senha.</p>
          <Link to="/login" className="mt-4 inline-block text-sm text-purple hover:underline">
            Voltar ao login
          </Link>
        </div>
      </div>
    )
  }

  if (sucesso) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-green-bg">
            <CheckCircle className="size-7 text-green" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">Senha redefinida!</h2>
            <p className="mt-1 text-sm text-muted-foreground">Redirecionando para o login...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-purple-bg text-purple">
            <KeyRound className="size-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Nova senha</h1>
            <p className="text-[12px] text-muted-foreground">AutoHub</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Nova senha</label>
            <div className="relative">
              <input
                type={showSenha ? "text" : "password"}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
                required
              />
              <button
                type="button"
                onClick={() => setShowSenha(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-faint-foreground hover:text-foreground"
              >
                {showSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Confirmar senha</label>
            <input
              type={showSenha ? "text" : "password"}
              value={confirma}
              onChange={e => setConfirma(e.target.value)}
              placeholder="Repita a senha"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
              required
            />
          </div>

          {erro && <p className="rounded-lg bg-red-bg px-3 py-2 text-[12px] text-red">{erro}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-purple py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Redefinir senha"}
          </button>

          <Link to="/login" className="flex items-center justify-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-3" /> Voltar ao login
          </Link>
        </form>
      </div>
    </div>
  )
}
