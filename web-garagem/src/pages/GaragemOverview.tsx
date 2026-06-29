import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Plus, Gauge, Wrench, Clock, TrendingUp, CalendarDays, ArrowRight, Users, ArrowLeftRight, MapPin } from "lucide-react"
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

function formatDataCurta(iso: string) {
  const d = new Date(iso + "T12:00:00")
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "")
}

const MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]

function formatDataBox(iso: string) {
  const [, m, d] = iso.split("-")
  return { dia: d, mes: MESES_ABREV[Number(m) - 1] }
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Cotacao {
  par: string
  taxa_compra: number
  taxa_venda: number
  data: string
}

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

function CotacoesWidget() {
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<{ cotacoes: Cotacao[] }>("/api/cotacoes")
      .then(r => setCotacoes(r.cotacoes))
      .catch(() => {}) // silencioso — cotações são extras, não crítico
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3">
        <TrendingUp className="size-4 shrink-0 text-faint-foreground" />
        <div className="h-3 w-40 animate-pulse rounded bg-surface-2" />
      </div>
    )
  }

  if (cotacoes.length === 0) return null

  const usd = cotacoes.find(c => c.par === "USD-BRL")
  const pyg = cotacoes.find(c => c.par === "PYG-BRL")

  const dataLabel = usd
    ? formatDataCurta(typeof usd.data === "string" ? usd.data.split("T")[0] : usd.data)
    : ""

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border bg-surface px-4 py-3">
      <div className="flex items-center gap-1.5">
        <TrendingUp className="size-3.5 shrink-0 text-green" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
          Cotações
        </span>
      </div>

      {usd && (
        <span className="flex items-center gap-1.5 text-[12px]">
          <span className="font-medium text-foreground">USD</span>
          <span className="text-muted-foreground">
            R$ {usd.taxa_compra.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </span>
      )}

      {pyg && (
        <span className="flex items-center gap-1.5 text-[12px]">
          <span className="font-medium text-foreground">PYG</span>
          <span className="text-muted-foreground">
            R$ {pyg.taxa_compra.toLocaleString("pt-BR", { minimumFractionDigits: 5, maximumFractionDigits: 5 })}
          </span>
        </span>
      )}

      {dataLabel && (
        <span className="ml-auto text-[10px] text-faint-foreground">
          Atualizado {dataLabel}
        </span>
      )}
    </div>
  )
}

// ── Widget social (seguidores / seguindo) ─────────────────────────────────────

interface Follow {
  id: string
  nome: string
  slug: string
  dono_nome: string
  garagem_nome?: string
  mutuo: boolean
  criado_em: string
}

function SocialWidget() {
  const [tab, setTab] = useState<"seguidores" | "seguindo">("seguidores")
  const [seguidores, setSeguidores] = useState<Follow[]>([])
  const [seguindo, setSeguindo] = useState<Follow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<{ seguidores: Follow[] }>("/api/social/seguidores"),
      api.get<{ follows: Follow[] }>("/api/social/follows"),
    ])
      .then(([s, f]) => {
        setSeguidores(s.seguidores ?? [])
        setSeguindo(f.follows ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const lista = tab === "seguidores" ? seguidores : seguindo
  const totalMutuos = seguidores.filter(s => s.mutuo).length

  return (
    <div className="rounded-xl border border-border bg-surface">
      {/* Faixa de contadores */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-faint-foreground" />
          <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
            Comunidade
          </span>
        </div>
        <div className="flex items-center gap-3 ml-1">
          {([
            { v: "seguidores", l: "Seguidores", n: seguidores.length },
            { v: "seguindo",   l: "Seguindo",   n: seguindo.length   },
          ] as const).map(t => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={[
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors",
                tab === t.v
                  ? "bg-purple-bg text-purple"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <span className="font-bold">{t.n}</span> {t.l}
            </button>
          ))}
          {totalMutuos > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-green-bg px-2 py-0.5 text-[10px] font-medium text-green ml-1">
              <ArrowLeftRight className="size-3" />
              {totalMutuos} mútuo{totalMutuos !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <Link
          to="/feed"
          className="ml-auto flex items-center gap-1 text-[11px] text-purple hover:underline shrink-0"
        >
          Explorar <ArrowRight className="size-3" />
        </Link>
      </div>

      {/* Lista horizontal com scroll */}
      <div className="flex items-center gap-2 overflow-x-auto px-4 py-2.5 scrollbar-none">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="h-8 w-24 shrink-0 animate-pulse rounded-lg bg-surface-2" />
          ))
        ) : lista.length === 0 ? (
          <p className="text-[12px] text-faint-foreground py-1">
            {tab === "seguidores" ? "Ninguém seguindo ainda" : "Você não segue ninguém ainda"}
          </p>
        ) : (
          lista.map(item => {
            // garagem_nome (seguidores) ou nome (follows) = nome da garagem, sempre definido
            const nome = item.garagem_nome ?? item.nome ?? item.dono_nome ?? "Usuário"
            return (
              <Link
                key={item.id + tab}
                to={`/g/${item.slug}`}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 transition-colors hover:border-purple/40 hover:bg-surface-2"
              >
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-purple-bg text-[10px] font-bold text-purple">
                  {nome[0]?.toUpperCase() ?? "G"}
                </div>
                <span className="text-[12px] font-medium text-foreground">{nome}</span>
                {item.mutuo && (
                  <ArrowLeftRight className="size-3 text-green" />
                )}
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Preview de próximos eventos ───────────────────────────────────────────────

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
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
            Próximos eventos
          </span>
        </div>
        <Link
          to="/eventos"
          className="flex items-center gap-1 text-[11px] text-purple hover:underline"
        >
          Ver calendário <ArrowRight className="size-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {proximos.map(evento => {
          const { dia, mes } = formatDataBox(evento.data_inicio)
          return (
            <Link
              key={evento.id}
              to="/eventos"
              className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-3.5 transition-colors hover:border-border-strong"
            >
              {/* Data */}
              <div className="flex w-11 shrink-0 flex-col items-center rounded-lg border border-border bg-surface-2 py-1.5">
                <span className="font-data text-[18px] font-bold leading-none text-foreground">{dia}</span>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-faint-foreground">{mes}</span>
              </div>
              {/* Info */}
              <div className="flex min-w-0 flex-col gap-1">
                <span className={`w-fit rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${TIPO_COLOR[evento.tipo]}`}>
                  {TIPO_LABEL[evento.tipo]}
                </span>
                <span className="line-clamp-2 text-[12px] font-medium leading-snug text-foreground">
                  {evento.nome}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-faint-foreground">
                  <MapPin className="size-2.5 shrink-0" />
                  {evento.cidade} · {evento.estado}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// Silhueta de carro esportivo — perfil RX-7 FD / C5: nariz longo, fastback, faróis retráteis abertos
function CarSilhouette() {
  function Wheel({ cx, cy }: { cx: number; cy: number }) {
    const R = 15, rInner = 9, rHub = 3.5
    return (
      <g>
        <circle cx={cx} cy={cy} r={R} fill="rgba(10,10,18,0.98)" stroke="rgba(127,119,221,0.65)" strokeWidth="2"/>
        {Array.from({ length: 5 }).map((_, i) => {
          const a = ((-90 + i * 72) * Math.PI) / 180
          return (
            <line key={i}
              x1={cx} y1={cy}
              x2={cx + (R - 1.5) * Math.cos(a)}
              y2={cy + (R - 1.5) * Math.sin(a)}
              stroke="rgba(127,119,221,0.55)" strokeWidth="1.5"
            />
          )
        })}
        <circle cx={cx} cy={cy} r={rInner} fill="rgba(127,119,221,0.12)" stroke="rgba(127,119,221,0.45)" strokeWidth="1.5"/>
        <circle cx={cx} cy={cy} r={rHub}   fill="rgba(127,119,221,0.85)"/>
      </g>
    )
  }

  return (
    <svg viewBox="0 0 310 86" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[260px]">
      {/* ── Corpo (fastback longo, nariz baixo — RX-7 FD) ── */}
      <path
        d="
          M 22 76
          L 22 66
          Q 38 48 65 32
          Q 90 19 118 16
          L 210 13
          Q 233 13 250 26
          Q 265 39 272 51
          L 289 55
          Q 298 57 301 65
          L 303 76
          Z
        "
        fill="rgba(127,119,221,0.13)"
        stroke="rgba(127,119,221,0.52)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* ── Janela lateral ── */}
      <path
        d="
          M 121 16
          L 210 13
          Q 233 13 250 26
          Q 260 35 264 43
          L 175 42
          Q 152 41 132 29
          Z
        "
        fill="rgba(127,119,221,0.07)"
        stroke="rgba(127,119,221,0.27)"
        strokeWidth="1"
        strokeLinejoin="round"
      />

      {/* ── Coluna C / linha do fastback ── */}
      <path d="M 121 16 Q 100 22 80 35" stroke="rgba(127,119,221,0.30)" strokeWidth="1.2" fill="none" strokeLinecap="round"/>

      {/* ── Para-brisa (coluna A) ── */}
      <path d="M 250 26 Q 266 40 272 51" stroke="rgba(127,119,221,0.38)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>

      {/* ── Spoiler/lip traseiro ── */}
      <path d="M 22 63 L 28 59 L 30 62" stroke="rgba(127,119,221,0.45)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>

      {/* ── Faróis retráteis ABERTOS (detalhe icônico do FD!) ── */}
      {/* caixa do farol (no capô) */}
      <rect x="285" y="52" width="16" height="5" rx="1"
        fill="rgba(18,18,30,0.9)" stroke="rgba(127,119,221,0.35)" strokeWidth="1"/>
      {/* lente do farol (aberta, inclinada para trás ~15°) */}
      <rect x="287" y="39" width="9" height="15" rx="1.5"
        fill="rgba(232,121,249,0.68)"
        transform="rotate(15 293 52)"
      />
      {/* reflexo na lente */}
      <rect x="288" y="40" width="4" height="6" rx="1"
        fill="rgba(255,255,255,0.22)"
        transform="rotate(15 293 52)"
      />

      {/* ── Farol traseiro ── */}
      <path d="M 21 62 L 21 73 Q 21 75 23 75 L 25 75 L 25 63 Z" fill="rgba(226,75,74,0.55)"/>

      {/* ── Reflexo sutil no teto ── */}
      <path d="M 122 16 Q 165 12 210 13" stroke="rgba(255,255,255,0.07)" strokeWidth="2" fill="none"/>

      {/* ── Character line ── */}
      <path d="M 26 62 Q 168 56 291 59" stroke="rgba(127,119,221,0.13)" strokeWidth="1" fill="none"/>

      {/* ── Rodas (5 raios — mesma linguagem do ícone do app) ── */}
      <Wheel cx={82}  cy={76} />
      <Wheel cx={238} cy={76} />
    </svg>
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

      {/* ── Hero de boas-vindas ─────────────────────────────────────────── */}
      <div className="animate-page-in relative overflow-hidden rounded-2xl border border-border bg-surface">
        {/* glow de fundo */}
        <div className="pointer-events-none absolute -right-10 -top-10 size-64 rounded-full bg-purple/8 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 left-1/4 size-40 rounded-full bg-purple/5 blur-2xl" />

        <div className="relative flex items-center gap-4 px-6 py-5 sm:gap-8">
          <div className="flex-1 min-w-0">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-faint-foreground">
              Minha garagem
            </div>
            <h1 className="font-display text-[26px] font-bold leading-tight text-foreground">
              {user?.garagem?.nome ?? "Minha Garagem"}
            </h1>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {loading
                ? "Carregando..."
                : veiculos.length === 0
                  ? "Nenhum projeto ainda — adicione seu primeiro build abaixo"
                  : `${veiculos.length} projeto${veiculos.length !== 1 ? "s" : ""} · ${emAndamento} em andamento`}
            </p>
          </div>
          {/* Silhueta do carro (decorativa) */}
          <div className="hidden sm:block shrink-0 opacity-80">
            <CarSilhouette />
          </div>
        </div>
      </div>

      {/* ── Botão novo veículo ──────────────────────────────────────────── */}
      <div className="animate-page-in flex items-center justify-between" style={{ animationDelay: "80ms" }}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint-foreground">
          {veiculos.length > 0 ? `${veiculos.length} veículo${veiculos.length !== 1 ? "s" : ""}` : "Builds"}
        </div>

        {veiculos.length >= 10 ? (
          <div className="relative group">
            <button
              disabled
              className="flex items-center gap-1.5 rounded-lg bg-purple/40 px-4 py-2 text-sm font-medium text-white/60 cursor-not-allowed"
            >
              <Plus className="size-4" />
              Novo veículo
            </button>
            <div className="pointer-events-none absolute right-0 top-full mt-1.5 z-10 hidden w-56 rounded-lg border border-border bg-surface px-3 py-2 text-[11px] text-muted-foreground shadow-lg group-hover:block">
              Limite de 10 builds atingido (plano gratuito)
            </div>
          </div>
        ) : (
          <Link
            to="/novo"
            className="flex items-center gap-1.5 rounded-lg bg-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="size-4" />
            {veiculos.length === 0 ? "Criar primeiro build" : "Novo veículo"}
          </Link>
        )}
      </div>

      {/* ── Stats + cotações ─────────────────────────────────────────────── */}
      {!loading && veiculos.length > 0 && (
        <div className="animate-page-in flex flex-col gap-2.5" style={{ animationDelay: "120ms" }}>
          <div className="grid grid-cols-3 gap-2.5">
            <GaragemStat icon={Wrench} label="em andamento" value={emAndamento} accent="text-amber" />
            <GaragemStat icon={Gauge}  label="fases totais"  value={totalFases}  accent="text-purple" />
            <GaragemStat icon={Clock}  label="itens totais"  value={totalItens}  accent="text-blue" />
          </div>
          <CotacoesWidget />
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      )}

      {/* ── Erro ─────────────────────────────────────────────────────────── */}
      {erro && (
        <p className="rounded-lg border border-red-bg bg-red-bg px-4 py-3 text-sm text-red">
          {erro}
        </p>
      )}

      {/* ── Comunidade ───────────────────────────────────────────────────── */}
      <div className="animate-page-in" style={{ animationDelay: "160ms" }}>
        <SocialWidget />
      </div>

      {/* ── Grid de veículos ─────────────────────────────────────────────── */}
      {!loading && veiculos.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {veiculos.map((v, index) => (
            <div
              key={v.id}
              className="animate-page-in"
              style={{ animationDelay: `${200 + index * 80}ms` }}
            >
              <VeiculoCard veiculo={v} />
            </div>
          ))}
        </div>
      )}

      {!loading && !erro && veiculos.length === 0 && (
        <div className="animate-page-in flex flex-col items-center gap-5 rounded-2xl border border-dashed border-border py-20 text-center" style={{ animationDelay: "200ms" }}>
          {/* mini car */}
          <div className="flex size-16 items-center justify-center rounded-2xl bg-surface-2">
            <div className="w-12 opacity-70"><CarSilhouette /></div>
          </div>
          <div>
            <p className="font-display text-[16px] font-bold text-foreground">Garagem vazia</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Adicione seu primeiro projeto e acompanhe o build passo a passo
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Link
              to="/novo"
              className="flex items-center gap-1.5 rounded-xl bg-purple px-5 py-2.5 text-[14px] font-semibold text-white hover:opacity-90 transition-opacity shadow-lg shadow-purple/20"
            >
              <Plus className="size-4" /> Criar primeiro build
            </Link>
            <Link to="/feed" className="text-[12px] text-muted-foreground hover:text-purple transition-colors">
              ou explore builds da comunidade →
            </Link>
          </div>
        </div>
      )}

      {/* ── Próximos eventos ─────────────────────────────────────────────── */}
      {!loading && <ProximosEventos />}

    </div>
  )
}
