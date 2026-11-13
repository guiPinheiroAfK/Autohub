import { useEffect, useState } from "react"
import { Users, X, Mail } from "lucide-react"
import { api } from "@/lib/api/client"
import type { Colaborador } from "./types"

// ── Colaboradores ────────────────────────────────────────────────────────────

const PAPEL_LABEL: Record<string, string> = {
  mecanico: "Mecânico",
  editor: "Editor",
  visualizador: "Visualizador",
}
export function ColaboradoresPanel({ veiculoId, isDono }: { veiculoId: string; isDono: boolean }) {
  const [lista, setLista] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [papel, setPapel] = useState("editor")
  const [convidando, setConvidando] = useState(false)
  const [erro, setErro] = useState("")
  const [ok, setOk] = useState("")

  function carregar() {
    setLoading(true)
    api.get<{ colaboradores: Colaborador[] }>(`/api/colaboracoes/veiculo/${veiculoId}`)
      .then(r => setLista(r.colaboradores ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { carregar() }, [veiculoId])

  async function convidar(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setConvidando(true); setErro(""); setOk("")
    try {
      await api.post(`/api/colaboracoes/veiculo/${veiculoId}/convidar`, { email: email.trim(), papel })
      setOk(`Convite enviado para ${email.trim()}`)
      setEmail("")
      carregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao convidar")
    } finally {
      setConvidando(false)
    }
  }

  async function remover(colaboracaoId: string) {
    if (!confirm("Remover este colaborador?")) return
    await api.delete(`/api/colaboracoes/${colaboracaoId}`)
    setLista(prev => prev.filter(c => c.id !== colaboracaoId))
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center gap-2">
        <Users className="size-4 text-faint-foreground" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
          Colaboradores
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2].map(i => <div key={i} className="h-9 animate-pulse rounded-lg bg-surface-2" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {lista.length === 0 ? (
            <p className="text-[12px] text-faint-foreground">Nenhum colaborador ainda.</p>
          ) : (
            lista.map(c => {
              const label = c.nome ?? c.convidado_email
              const initial = label[0].toUpperCase()
              return (
                <div key={c.id} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-surface-2">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-purple-bg text-[11px] font-bold text-purple">
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-foreground truncate">{label}</p>
                    <p className="text-[10px] text-faint-foreground">
                      {PAPEL_LABEL[c.papel] ?? c.papel}
                      {c.status === "pendente" && " · pendente"}
                    </p>
                  </div>
                  {isDono && (
                    <button
                      onClick={() => remover(c.id)}
                      className="shrink-0 text-faint-foreground hover:text-red"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {isDono && (
        <form onSubmit={convidar} className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-[11px] font-medium text-foreground">Convidar colaborador</p>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[12px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
          />
          <div className="flex gap-2">
            <select
              value={papel}
              onChange={e => setPapel(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-[12px] text-foreground focus:border-purple/50 focus:outline-none"
            >
              <option value="editor">Editor</option>
              <option value="mecanico">Mecânico</option>
              <option value="visualizador">Visualizador</option>
            </select>
            <button
              type="submit"
              disabled={convidando || !email.trim()}
              className="flex items-center gap-1 rounded-lg bg-purple px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Mail className="size-3" />
              {convidando ? "..." : "Convidar"}
            </button>
          </div>
          {erro && <p className="text-[11px] text-red">{erro}</p>}
          {ok && <p className="text-[11px] text-green">{ok}</p>}
        </form>
      )}
    </div>
  )
}
