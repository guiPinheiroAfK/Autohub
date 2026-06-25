import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Plus, Gauge, Wrench, Clock, TrendingUp, CalendarDays, MapPin, ArrowRight, Navigation } from "lucide-react"
import { api } from "@/lib/api/client"
import { useAuth } from "@/context/AuthContext"
import { VeiculoCard } from "@/components/shared/VeiculoCard"
import { EVENTOS, TIPO_LABEL, TIPO_COLOR } from "@/data/eventos"
import type { VeiculoComMetricas } from "@/types"

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPassado(iso: string) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return new Date(iso + "T12:00:00") < hoje
}

function diasRestantes(iso: string): number {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  return Math.ceil((new Date(iso + "T12:00:00").getTime() - hoje.getTime()) / 86_400_000)
}

const MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]

// ── Sub-componentes ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return <div className="h-[178px] animate-pulse rounded-xl border border-border bg-surface" />
}

function GaragemStat({ icon: Icon, label, value, accent }: {
  icon: typeof Gauge; label: string; value: string | number; accent?: string
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-4 py-3">
      <Icon className={`size-4 shrink-0 ${accent ?? "text-faint-foreground"}`} />
      <div>
        <div className="font-data text-sm font-semibold text-foreground">{value}</div>
        <div className="text-[11px] text-faint-foreground">{label}</div>
      </div>
    </div>
  )
}

// ── Widget de cotações ────────────────────────────────────────────────────────

interface Cotacao { par: string; taxa_compra: number; data: string }

function CotacoesWidget() {
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<{ cotacoes: Cotacao[] }>("/api/cotacoes")
      .then(r => setCotacoes(r.cotacoes))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3">
        <TrendingUp className="size-4 shrink-0 text-faint-foreground" />
        <div className="h-3 w-44 animate-pulse rounded bg-surface-2" />
      </div>
    )
  }
  if (cotacoes.length === 0) return null

  const usd = cotacoes.find(c => c.par === "USD-BRL")
  const pyg = cotacoes.find(c => c.par === "PYG-BRL")
  const dataLabel = usd
    ? new Date((usd.data as string).split("T")[0] + "T12:00:00")
        .toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".","")
    : ""

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-1.5">
        <TrendingUp className="size-3.5 text-green" />
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-faint-foreground">Cotações</span>
      </div>
      {usd && (
        <span className="text-[12px]">
          <span className="font-medium text-foreground">USD</span>
          <span className="ml-1.5 text-muted-foreground">
            R$ {usd.taxa_compra.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </span>
      )}
      {pyg && (
        <span className="text-[12px]">
          <span className="font-medium text-foreground">PYG</span>
          <span className="ml-1.5 text-muted-foreground">
            R$ {(pyg.taxa_compra).toLocaleString("pt-BR", { minimumFractionDigits: 5, maximumFractionDigits: 5 })}
          </span>
        </span>
      )}
      {dataLabel && (
        <span className="ml-auto text-[10px] text-faint-foreground">Atualizado {dataLabel}</span>
      )}
    </div>
  )
}

// ── Próximos eventos embutidos ────────────────────────────────────────────────

function ProximosEventos() {
  const proximos = EVENTOS
    .filter(e => !isPassado(e.data_inicio))
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
    .slice(0, 3)

  if (proximos.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-faint-foreground" />
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint-foreground">
            Próximos eventos
          </span>
        </div>
        <Link to="/eventos" className="flex items-center gap-1 text-[11px] text-purple hover:underline">
          Ver calendário <ArrowRight className="size-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {proximos.map(evento => {
          const [, m, d] = evento.data_inicio.split("-")
          const dias = diasRestantes(evento.data_inicio)
          return (
            <Link
              key={evento.id}
              to="/eventos"
              className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-3.5 transition-colors hover:border-border-strong"
            >
              <div className="flex w-11 shrink-0 flex-col items-center rounded-lg border border-border bg-surface-2 py-1.5 transition-colors group-hover:border-purple/20 group-hover:bg-purple-bg/30">
                <span className="font-data text-[18px] font-bold leading-none text-foreground">{d}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-faint-foreground">
                  {MESES_ABREV[Number(m) - 1]}
                </span>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <span className={`w-fit rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${TIPO_COLOR[evento.tipo]}`}>
                  {TIPO_LABEL[evento.tipo]}
                </span>
                <span className="line-clamp-2 text-[12px] font-semibold leading-snug text-foreground">
                  {evento.nome}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-faint-foreground">
                  <MapPin className="size-2.5 shrink-0" />
                  {evento.cidade} · {evento.estado}
                </span>
                {dias >= 0 && dias <= 14 && (
                  <span className="text-[10px] font-semibold text-amber">
                    {dias === 0 ? "Hoje!" : dias === 1 ? "Amanhã!" : `em ${dias} dias`}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ── Tracks teaser ─────────────────────────────────────────────────────────────

function TrackTeaser() {
  return (
    <Link
      to="/tracks"
      className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-all hover:border-purple/30 hover:bg-purple-bg/20"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple-bg text-purple">
        <Navigation className="size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground">Autohub Tracks</p>
        <p className="text-[11px] text-muted-foreground">
          GPS · Telemetria · Modo Ghost · 5 rotas oficiais disponíveis
        </p>
      </div>
      <ArrowRight className="size-4 text-faint-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function GaragemOverview() {
  const { user } = useAuth()
  const [veiculos, setVeiculos] = useState<VeiculoComMetricas[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<VeiculoComMetricas[]>("/api/veiculos")
      .then(setVeiculos)
      .catch((e) => setErro(e.message))
      .finally(() => setLoading(false))
  }, [])

  const totalFases = veiculos.reduce((s, v) => s + v.total_fases, 0)
  const totalItens = veiculos.reduce((s, v) => s + v.total_itens, 0)
  const emAndamento = veiculos.filter(v => v.status === "em_andamento").length

  return (
    <div className="flex flex-col gap-8">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between">
        <div>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-faint-foreground">
            Garagem
          </div>
          <h1 className="font-display text-[28px] font-semibold leading-tight text-foreground">
            {user?.garagem?.nome ?? "Minha Garagem"}
          </h1>
          {!loading && (
            <p className="mt-1 text-sm text-muted-foreground">
              {veiculos.length === 0
                ? "Nenhum veículo ainda"
                : `${veiculos.length} veículo${veiculos.length !== 1 ? "s" : ""}`}
            </p>
          )}
        </div>

        <Link
          to="/novo"
          className="animate-page-in flex items-center gap-1.5 rounded-lg bg-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          style={{ animationDelay: "200ms" }}
        >
          <Plus className="size-4" />
          {veiculos.length === 0 ? "Criar veículo" : "Novo veículo"}
        </Link>
      </div>

      {/* ── Stats + cotações ──────────────────────────────────────────── */}
      {!loading && veiculos.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-3 gap-2.5">
            <GaragemStat icon={Wrench} label="em andamento" value={emAndamento} accent="text-amber" />
            <GaragemStat icon={Gauge}  label="fases totais"  value={totalFases}  accent="text-purple" />
            <GaragemStat icon={Clock}  label="itens totais"  value={totalItens}  accent="text-blue" />
          </div>
          <CotacoesWidget />
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      )}

      {/* ── Erro ─────────────────────────────────────────────────────── */}
      {erro && (
        <p className="rounded-lg border border-red-bg bg-red-bg px-4 py-3 text-sm text-red">{erro}</p>
      )}

      {/* ── Empty state ──────────────────────────────────────────────── */}
      {!loading && !erro && veiculos.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-20 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-surface text-faint-foreground">
            <Wrench className="size-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Garagem vazia</p>
            <p className="mt-1 text-sm text-muted-foreground">Adicione seu primeiro projeto de build</p>
          </div>
          <Link to="/novo" className="flex items-center gap-1.5 rounded-lg bg-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            <Plus className="size-4" /> Criar primeiro veículo
          </Link>
        </div>
      )}

      {/* ── Grid de veículos ─────────────────────────────────────────── */}
      {!loading && veiculos.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {veiculos.map((v, index) => (
            <div key={v.id} className="animate-page-in" style={{ animationDelay: `${index * 100}ms` }}>
              <VeiculoCard veiculo={v} />
            </div>
          ))}
        </div>
      )}

      {/* ── Tracks teaser ────────────────────────────────────────────── */}
      {!loading && <TrackTeaser />}

      {/* ── Próximos eventos ─────────────────────────────────────────── */}
      {!loading && <ProximosEventos />}

    </div>
  )
}
