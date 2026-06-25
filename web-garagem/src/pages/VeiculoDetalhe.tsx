import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { ArrowRight, Zap, Target, Layers, CheckCircle2 } from "lucide-react"
import { api } from "@/lib/api/client"
import { formatMoeda, formatFaixa } from "@/lib/format"
import { FaseCard } from "@/components/shared/FaseCard"
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

// ── Página principal ──────────────────────────────────────────────────────────
export default function VeiculoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<VeiculoDetalheAPI | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    api
        .get<VeiculoDetalheAPI>(`/api/veiculos/${id}`)
        .then(setData)
        .catch((e) => setErro(e.message))
        .finally(() => setLoading(false))
  }, [id])

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

  return (
      <div className="flex flex-col gap-10">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
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
            {/* status */}
            <div className="flex items-center gap-1.5">
              <span className={`size-1.5 rounded-full ${STATUS_DOT[data.status as StatusVeiculo]}`} />
              <span className="text-sm text-muted-foreground">{STATUS_LABEL[data.status as StatusVeiculo]}</span>
            </div>

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

        {/* ── Stats ────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              label="Metas"
              value={data.meta_potencia_whp ? `${data.meta_potencia_whp} whp` : "—"}
              sub="potência alvo"
          />
        </div>

        {/* ── Painel lateral: progresso + financeiro ────────────────────────── */}
        {fases.length > 0 && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <BuildProgress fases={fases} />
              <ResumoFinanceiro fases={fases} />
            </div>
        )}

        {/* ── Fases ────────────────────────────────────────────────────────── */}
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
                <FaseCard
                    key={fase.id}
                    fase={fase}
                    itens={fase.itens ?? []}
                    defaultOpen={idx === 0}
                />
            ))}
            {fases.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-14 text-center">
                  <p className="text-sm text-muted-foreground">Nenhuma fase ainda.</p>
                  <button className="flex items-center gap-1 text-sm text-purple hover:underline">
                    Adicionar primeira fase <ArrowRight className="size-3" />
                  </button>
                </div>
            )}
          </div>
        </div>
      </div>
  )
}
