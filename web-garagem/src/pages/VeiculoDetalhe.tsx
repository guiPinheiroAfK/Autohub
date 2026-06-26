import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { ArrowRight, Zap, Target, Layers, CheckCircle2, Plus, ChevronDown, Users, X, Mail } from "lucide-react"
import { api } from "@/lib/api/client"
import { formatMoeda, formatFaixa } from "@/lib/format"
import { FaseCard } from "@/components/shared/FaseCard"
import { FotoGaleria } from "@/components/shared/FotoGaleria"
import { useAuth } from "@/context/AuthContext"
import type { PerfilVeiculo, StatusVeiculo, VeiculoDetalheAPI, FaseAPI, Moeda } from "@/types"

const PERFIL_LABEL: Record<PerfilVeiculo, string> = {
    daily: "Daily",
    street_build: "Street Build",
    restomod: "Restomod",
    track: "Track",
    project: "Projeto",
}

const STATUS_LABEL: Record<StatusVeiculo, string> = {
    planejamento: "Planejamento",
    em_andamento: "Em andamento",
    concluido: "Concluído",
    pausado: "Pausado",
}

const STATUS_DOT: Record<StatusVeiculo, string> = {
    planejamento: "bg-faint-foreground",
    em_andamento: "bg-amber animate-pulse",
    concluido: "bg-green",
    pausado: "bg-faint-foreground",
}

// Agrupa itens por moeda e calcula estimado + gasto
function calcTotais(fases: FaseAPI[]) {
    const acc: Record<string, { moeda: string; estimadoMin: number; estimadoMax: number; gasto: number }> = {}
    for (const f of fases) {
        for (const i of f.itens ?? []) {
            const m = i.moeda
            if (!acc[m]) acc[m] = { moeda: m, estimadoMin: 0, estimadoMax: 0, gasto: 0 }
            acc[m].estimadoMin += Number(i.preco_min)
            acc[m].estimadoMax += Number(i.preco_max)
            if (i.status === "concluido") acc[m].gasto += Number(i.preco_max)
        }
    }
    return Object.values(acc)
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
    return (
        <div className="flex flex-col gap-8 animate-pulse">
            <div className="flex flex-col gap-3 border-b border-border pb-8">
                <div className="h-3 w-32 rounded bg-surface" />
                <div className="h-9 w-64 rounded-lg bg-surface" />
                <div className="h-3 w-44 rounded bg-surface" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[0,1,2,3].map(i => (
                    <div key={i} className="h-[72px] rounded-xl border border-border bg-surface" />
                ))}
            </div>
            <div className="flex flex-col gap-2.5">
                {[0,1,2].map(i => (
                    <div key={i} className="h-[54px] rounded-xl border border-border bg-surface" />
                ))}
            </div>
        </div>
    )
}

// ── Metric card ───────────────────────────────────────────────────────────────
function Stat({
                  label, value, sub, accent
              }: { label: string; value: string; sub?: string; accent?: string }) {
    return (
        <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface px-4 py-3.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
                {label}
            </div>
            <div className={`font-display text-[22px] font-semibold leading-none ${accent ?? "text-foreground"}`}>
                {value}
            </div>
            {sub && <div className="text-[11px] text-faint-foreground">{sub}</div>}
        </div>
    )
}

// ── Barra de progresso de build ───────────────────────────────────────────────
function BuildProgress({ fases }: { fases: FaseAPI[] }) {
    if (fases.length === 0) return null
    return (
        <div className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
                Progresso por fase
            </div>
            <div className="flex flex-col gap-2.5">
                {fases.map((f) => {
                    const total = f.itens?.length ?? 0
                    const done = f.itens?.filter(i => i.status === "concluido").length ?? 0
                    const pct = f.status === "concluido" ? 100 : f.status === "planejado" ? 0 : total > 0 ? Math.round((done / total) * 100) : 0

                    return (
                        <div key={f.id} className="flex items-center gap-3">
                            <div className="w-[120px] shrink-0 truncate text-[11px] text-muted-foreground sm:w-[160px]">
                                {f.titulo}
                            </div>
                            <div className="flex-1 h-1.5 rounded-full bg-surface-2">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                        f.status === "concluido" ? "bg-green" :
                                            f.status === "andamento" ? "bg-amber" : "bg-faint-foreground/30"
                                    }`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <span className="w-8 shrink-0 text-right font-data text-[11px] text-faint-foreground">
                {pct}%
              </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ── Resumo financeiro ─────────────────────────────────────────────────────────
function ResumoFinanceiro({ fases }: { fases: FaseAPI[] }) {
    const totais = calcTotais(fases)
    if (totais.length === 0) return null

    return (
        <div className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
                Resumo financeiro
            </div>
            <div className="flex flex-col gap-4">
                {totais.map((t) => {
                    const pct = t.estimadoMax > 0 ? Math.round((t.gasto / t.estimadoMax) * 100) : 0
                    return (
                        <div key={t.moeda} className="flex flex-col gap-2">
                            <div className="flex items-baseline justify-between">
                                <span className="text-[11px] text-faint-foreground">{t.moeda}</span>
                                <span className="font-data text-sm text-foreground">
                  {formatMoeda(t.gasto, t.moeda as Moeda)}{" "}
                                    <span className="text-faint-foreground">
                    / {formatFaixa(t.estimadoMin, t.estimadoMax, t.moeda as Moeda)}
                  </span>
                </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-surface-2">
                                <div
                                    className="h-2 rounded-full bg-purple transition-all duration-500"
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-faint-foreground">
                                <span>Realizado</span>
                                <span>{pct}% do estimado</span>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

const STATUS_OPCOES: StatusVeiculo[] = ["planejamento", "em_andamento", "concluido", "pausado"]

// ── Trocador de status do veículo ──────────────────────────────────────────────
// É o "destransformar de concluído" que a Kamilly pediu: dá pra voltar o
// veículo pra qualquer status a qualquer momento — junto com o "+ nova fase"
// embaixo, isso cobre o fluxo de reabrir um projeto "concluído".
function StatusVeiculoMenu({
                               status,
                               saving,
                               onChange,
                           }: { status: StatusVeiculo; saving: boolean; onChange: (s: StatusVeiculo) => void }) {
    const [open, setOpen] = useState(false)

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:border-border-strong disabled:opacity-50"
            >
                <span className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} />
                {STATUS_LABEL[status]}
                <ChevronDown className={cn_("size-3 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute left-0 top-full z-20 mt-1.5 flex w-44 flex-col gap-0.5 rounded-lg border border-border bg-surface p-1 shadow-lg">
                        {STATUS_OPCOES.map((s) => (
                            <button
                                key={s}
                                onClick={() => { onChange(s); setOpen(false) }}
                                className={cn_(
                                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-surface-2",
                                    s === status ? "text-foreground font-medium" : "text-muted-foreground"
                                )}
                            >
                                <span className={`size-1.5 rounded-full ${STATUS_DOT[s]}`} />
                                {STATUS_LABEL[s]}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

// pequeno helper local para não trazer a dependência inteira do cn de outro módulo
function cn_(...c: (string | false | undefined)[]) { return c.filter(Boolean).join(" ") }

// ── Form de nova fase ──────────────────────────────────────────────────────────
interface NovaFaseValue { titulo: string; orcamentoMin: string; orcamentoMax: string; moeda: Moeda; nota: string }
const NOVA_FASE_EMPTY: NovaFaseValue = { titulo: "", orcamentoMin: "", orcamentoMax: "", moeda: "BRL", nota: "" }
const MOEDAS: Moeda[] = ["BRL", "USD", "PYG"]

function NovaFaseForm({
                          proximaOrdem,
                          saving,
                          onSave,
                          onCancel,
                      }: { proximaOrdem: number; saving: boolean; onSave: (v: NovaFaseValue) => void; onCancel: () => void }) {
    const [v, setV] = useState<NovaFaseValue>(NOVA_FASE_EMPTY)

    return (
        <div className="flex flex-col gap-2.5 rounded-xl border border-dashed border-border bg-surface p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
                <input
                    autoFocus
                    value={v.titulo}
                    onChange={(e) => setV({ ...v, titulo: e.target.value })}
                    placeholder={`Nome da fase ${proximaOrdem} — ex: "Troca de radiador"`}
                    className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
                />
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <input
                    type="number" min={0} step="0.01"
                    value={v.orcamentoMin}
                    onChange={(e) => setV({ ...v, orcamentoMin: e.target.value })}
                    placeholder="Orçamento mín."
                    className="w-28 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
                />
                <span className="text-faint-foreground">—</span>
                <input
                    type="number" min={0} step="0.01"
                    value={v.orcamentoMax}
                    onChange={(e) => setV({ ...v, orcamentoMax: e.target.value })}
                    placeholder="Orçamento máx."
                    className="w-28 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
                />
                <select
                    value={v.moeda}
                    onChange={(e) => setV({ ...v, moeda: e.target.value as Moeda })}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground focus:border-purple focus:outline-none"
                >
                    {MOEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <input
                    value={v.nota}
                    onChange={(e) => setV({ ...v, nota: e.target.value })}
                    placeholder="Nota/aviso — opcional"
                    className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
                />
            </div>
            <div className="flex items-center gap-2">
                <button
                    disabled={saving || v.titulo.trim().length === 0}
                    onClick={() => onSave(v)}
                    className="rounded-md bg-purple px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {saving ? "Salvando..." : "Criar fase"}
                </button>
                <button onClick={onCancel} className="rounded-md px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground">
                    Cancelar
                </button>
            </div>
        </div>
    )
}

// ── Colaboradores ────────────────────────────────────────────────────────────

const PAPEL_LABEL: Record<string, string> = {
  mecanico: "Mecânico",
  editor: "Editor",
  visualizador: "Visualizador",
}

// Shape retornado por GET /api/colaboracoes/veiculo/:id
interface Colaborador {
  id: string
  convidado_email: string
  papel: string
  status: "pendente" | "ativo" | "recusado" | "removido"
  nome: string | null        // preenchido quando aceito
  avatar_url: string | null
  criado_em: string
}

function ColaboradoresPanel({ veiculoId, isDono }: { veiculoId: string; isDono: boolean }) {
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

// ── Página principal ──────────────────────────────────────────────────────────
export default function VeiculoDetalhe() {
    const { id } = useParams<{ id: string }>()
    const { user } = useAuth()
    const [data, setData] = useState<VeiculoDetalheAPI | null>(null)
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState<string | null>(null)
    const [savingStatus, setSavingStatus] = useState(false)
    const [addingFase, setAddingFase] = useState(false)
    const [savingFase, setSavingFase] = useState(false)

    async function carregar() {
        if (!id) return
        try {
            const res = await api.get<VeiculoDetalheAPI>(`/api/veiculos/${id}`)
            setData(res)
            setErro(null)
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Erro ao carregar veículo")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setLoading(true)
        carregar()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    async function handleStatusChange(status: StatusVeiculo) {
        if (!id || !data) return
        setSavingStatus(true)
        setData({ ...data, status })
        try {
            await api.patch(`/api/veiculos/${id}`, { status })
        } catch (e) {
            alert(e instanceof Error ? e.message : "Erro ao atualizar status")
            carregar()
        } finally {
            setSavingStatus(false)
        }
    }

    async function handleCriarFase(v: NovaFaseValue) {
        if (!id) return
        setSavingFase(true)
        try {
            await api.post(`/api/veiculos/${id}/fases`, {
                titulo: v.titulo.trim(),
                ordem: (data?.fases.length ?? 0) + 1,
                orcamentoMin: v.orcamentoMin ? Number(v.orcamentoMin) : 0,
                orcamentoMax: v.orcamentoMax ? Number(v.orcamentoMax) : (v.orcamentoMin ? Number(v.orcamentoMin) : 0),
                moeda: v.moeda,
                nota: v.nota.trim() || null,
            })
            setAddingFase(false)
            await carregar()
        } catch (e) {
            alert(e instanceof Error ? e.message : "Erro ao criar fase")
        } finally {
            setSavingFase(false)
        }
    }

    if (loading) return <Skeleton />

    if (erro || !data) {
        return (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
                <p className="text-sm text-muted-foreground">{erro ?? "Veículo não encontrado."}</p>
                <Link to="/" className="text-sm text-purple hover:underline">
                    Voltar para a garagem
                </Link>
            </div>
        )
    }

    const isDono = data.garagem_id === user?.garagem?.id

    const fases = data.fases ?? []
    const todosItens = fases.flatMap((f) => f.itens ?? [])
    const totalItens = todosItens.length
    const concluidosItens = todosItens.filter((i) => i.status === "concluido").length
    const progresso = totalItens > 0 ? Math.round((concluidosItens / totalItens) * 100) : 0
    const totais = calcTotais(fases)
    const principal = totais[0]

    const fasesStatus = {
        concluidas: fases.filter(f => f.status === "concluido").length,
        andamento: fases.filter(f => f.status === "andamento").length,
        planejadas: fases.filter(f => f.status === "planejado").length,
    }

    // Bloco de stats reutilizado tanto no mobile quanto no sidebar desktop
    const statsBlock = (
        <>
            <Stat
                label="Progresso"
                value={`${progresso}%`}
                sub={`${concluidosItens} de ${totalItens} itens`}
                accent="text-green"
            />
            <Stat
                label="Investido"
                value={principal ? formatMoeda(principal.gasto, principal.moeda as Moeda) : "R$ 0"}
                sub={principal ? `de ${formatMoeda(principal.estimadoMax, principal.moeda as Moeda)}` : "sem itens"}
                accent="text-purple"
            />
            <Stat
                label="Fases"
                value={`${fasesStatus.concluidas}/${fases.length}`}
                sub={fasesStatus.andamento > 0 ? `${fasesStatus.andamento} em andamento` : "concluídas"}
                accent="text-amber"
            />
            <Stat
                label="Meta"
                value={data.meta_potencia_whp ? `${data.meta_potencia_whp} whp` : "—"}
                sub="potência alvo"
            />
        </>
    )

    return (
        <div className="lg:grid lg:grid-cols-[1fr_300px] lg:items-start lg:gap-8">

            {/* ── Coluna principal ─────────────────────────────────────────────── */}
            <div className="flex flex-col gap-8 min-w-0">

                {/* Hero */}
                <div className="border-b border-border pb-8">
                    <div className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-faint-foreground">
                        <span>{data.marca}</span>
                        <span className="text-border-strong">·</span>
                        <span>{data.modelo}</span>
                        <span className="text-border-strong">·</span>
                        <span>{data.ano_modelo}</span>
                        <span className="text-border-strong">·</span>
                        <span>{PERFIL_LABEL[data.perfil as PerfilVeiculo]}</span>
                    </div>

                    <h1 className="font-display text-[38px] font-semibold leading-[1.05] text-foreground">
                        {data.apelido}
                    </h1>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                        <StatusVeiculoMenu
                            status={data.status as StatusVeiculo}
                            saving={savingStatus}
                            onChange={handleStatusChange}
                        />

                        {data.meta_potencia_whp && (
                            <>
                                <span className="text-faint-foreground">·</span>
                                <div className="flex items-center gap-1.5">
                                    <Zap className="size-3.5 text-amber" />
                                    <span className="font-data text-sm text-amber">
                                        meta {data.meta_potencia_whp} whp
                                    </span>
                                </div>
                            </>
                        )}

                        <span className="text-faint-foreground">·</span>
                        <div className="flex items-center gap-1.5">
                            <Layers className="size-3.5 text-faint-foreground" />
                            <span className="text-sm text-muted-foreground">
                                {fases.length} fase{fases.length !== 1 && "s"}
                            </span>
                        </div>

                        {fasesStatus.andamento > 0 && (
                            <>
                                <span className="text-faint-foreground">·</span>
                                <span className="rounded-full border border-amber/30 bg-amber-bg px-2 py-0.5 text-[11px] font-medium text-amber">
                                    {fasesStatus.andamento} em andamento
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Stats — mobile/tablet apenas (some no lg) */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:hidden">
                    {statsBlock}
                </div>

                {/* Painéis — mobile/tablet apenas */}
                {fases.length > 0 && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
                        <BuildProgress fases={fases} />
                        <ResumoFinanceiro fases={fases} />
                    </div>
                )}

                {/* ── Fases ────────────────────────────────────────────────────── */}
                <div>
                    <div className="mb-4 flex items-center justify-between">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
                            Fases do build
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-faint-foreground">
                            <span className="flex items-center gap-1">
                                <CheckCircle2 className="size-3 text-green" />
                                {fasesStatus.concluidas} concluída{fasesStatus.concluidas !== 1 && "s"}
                            </span>
                            <span className="flex items-center gap-1">
                                <Target className="size-3 text-faint-foreground" />
                                {fasesStatus.planejadas} planejada{fasesStatus.planejadas !== 1 && "s"}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2.5">
                        {fases.map((fase, idx) => (
                            <div
                                key={fase.id}
                                className="animate-page-in"
                                style={{ animationDelay: `${idx * 150}ms` }}
                            >
                                <FaseCard
                                    fase={fase}
                                    itens={fase.itens ?? []}
                                    defaultOpen={idx === 0}
                                    onChanged={carregar}
                                />
                            </div>
                        ))}

                        {fases.length === 0 && !addingFase && (
                            <div className="flex flex-col items-center gap-2 py-14 text-center">
                                <p className="text-sm text-muted-foreground">Nenhuma fase ainda.</p>
                                <button
                                    onClick={() => setAddingFase(true)}
                                    className="flex items-center gap-1 text-sm text-purple hover:underline"
                                >
                                    Adicionar primeira fase <ArrowRight className="size-3" />
                                </button>
                            </div>
                        )}

                        {addingFase && (
                            <NovaFaseForm
                                proximaOrdem={fases.length + 1}
                                saving={savingFase}
                                onSave={handleCriarFase}
                                onCancel={() => setAddingFase(false)}
                            />
                        )}

                        {fases.length > 0 && !addingFase && (
                            <button
                                onClick={() => setAddingFase(true)}
                                className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-3 text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                            >
                                <Plus className="size-3.5" /> Adicionar fase
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Fotos da build ───────────────────────────────────────────── */}
                <div className="rounded-xl border border-border bg-surface p-5">
                    <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
                        Fotos da build
                    </div>
                    <FotoGaleria veiculoId={data.id} />
                </div>

                {/* ── Colaboradores (mobile) ───────────────────────────────────── */}
                <div className="lg:hidden">
                    <ColaboradoresPanel veiculoId={data.id} isDono={isDono} />
                </div>
            </div>

            {/* ── Sidebar desktop ──────────────────────────────────────────────── */}
            <aside className="hidden lg:flex flex-col gap-4 sticky top-[80px]">
                <div className="grid grid-cols-2 gap-2">
                    {statsBlock}
                </div>
                {fases.length > 0 && (
                    <>
                        <BuildProgress fases={fases} />
                        <ResumoFinanceiro fases={fases} />
                    </>
                )}
                <ColaboradoresPanel veiculoId={data.id} isDono={isDono} />
            </aside>
        </div>
    )
}
