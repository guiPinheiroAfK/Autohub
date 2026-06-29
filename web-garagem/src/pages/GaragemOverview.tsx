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

function CarSilhouette() {
  const [pct, setPct] = useState({ s: 0, r: 0 })

  // Simulação de volta num circuito: aceleração, trocas de marcha, freadas, curvas
  useEffect(() => {
    const INTRO = 1200   // ms de subida inicial
    const TOTAL = 19000  // ms de volta completa (loop)

    // Keyframes: { t = ms na volta, s = velocidade 0-1, r = RPM 0-1 }
    // RPM cai brevemente em trocas de marcha; velocidade cai em freadas
    const KF = [
      { t: 0,     s: 0.12, r: 0.22 },  // saída de curva lenta
      { t: 1800,  s: 0.78, r: 0.87 },  // aceleração forte
      { t: 3000,  s: 0.85, r: 0.74 },  // troca de marcha (RPM despenca)
      { t: 3400,  s: 0.87, r: 0.89 },  // retoma após troca
      { t: 5000,  s: 0.91, r: 0.91 },  // reta a fundo
      { t: 5350,  s: 0.92, r: 0.78 },  // troca de marcha
      { t: 5750,  s: 0.93, r: 0.92 },  // fundo da reta
      { t: 7100,  s: 0.42, r: 0.50 },  // freada forte
      { t: 8100,  s: 0.32, r: 0.55 },  // curva lenta
      { t: 9300,  s: 0.68, r: 0.83 },  // aceleração
      { t: 10400, s: 0.78, r: 0.72 },  // troca de marcha
      { t: 10800, s: 0.80, r: 0.86 },  // retoma
      { t: 12600, s: 0.28, r: 0.46 },  // freada muito forte
      { t: 13600, s: 0.22, r: 0.50 },  // hairpin
      { t: 15800, s: 0.62, r: 0.80 },  // saída acelerando
      { t: 17200, s: 0.75, r: 0.86 },  // chegando na última curva
      { t: 19000, s: 0.12, r: 0.22 },  // fecha o loop
    ]

    let origin: number | null = null
    let raf: number

    const step = (now: number) => {
      if (origin === null) origin = now
      const total = now - origin

      let s: number, r: number

      if (total < INTRO) {
        // Arrancada inicial suave
        const e = 1 - (1 - total / INTRO) ** 3
        s = KF[0].s * e
        r = KF[0].r * e
      } else {
        const lap = (total - INTRO) % TOTAL

        // Interpola entre os dois keyframes vizinhos
        let a = KF[KF.length - 1], b = KF[0]
        for (let i = 0; i < KF.length - 1; i++) {
          if (lap >= KF[i].t && lap < KF[i + 1].t) { a = KF[i]; b = KF[i + 1]; break }
        }
        const seg = b.t - a.t
        const t   = seg > 0 ? (lap - a.t) / seg : 0
        const e   = t * t * (3 - 2 * t)  // smoothstep

        s = a.s + (b.s - a.s) * e
        r = a.r + (b.r - a.r) * e

        // Micro-vibração do motor (frequências diferentes para s e r = mais natural)
        r += Math.sin(now * 0.023) * 0.010
        s += Math.sin(now * 0.011) * 0.004
      }

      setPct({
        s: Math.max(0, Math.min(1, s)),
        r: Math.max(0, Math.min(1, r)),
      })
      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Ponto na circunferência (ângulo em graus, sentido horário SVG)
  const ap = (cx: number, cy: number, r: number, deg: number) => [
    cx + r * Math.cos((deg * Math.PI) / 180),
    cy + r * Math.sin((deg * Math.PI) / 180),
  ] as const

  // Renderiza um gauge como JSX (não componente — evita re-mount em cada frame)
  const gauge = (cx: number, cy: number, R: number, val: number, label: string) => {
    const S = 135, T = 270                          // 7h → 5h, 270° de varredura
    const [sx, sy] = ap(cx, cy, R, S)              // início do arco
    const [ex, ey] = ap(cx, cy, R, S + T)          // fim do arco
    const [fx, fy] = ap(cx, cy, R, S + val * T)    // ponteiro — arco cheio
    const [nx, ny] = ap(cx, cy, R - 14, S + val * T) // ponta do ponteiro
    const [rx, ry] = ap(cx, cy, R, S + 0.82 * T)  // início da zona vermelha
    const laf = val * T > 180 ? 1 : 0              // large-arc-flag

    return (
      <g>
        {/* Brilho ambiente */}
        <circle cx={cx} cy={cy} r={R + 10} fill="rgba(127,119,221,0.04)" />
        <circle cx={cx} cy={cy} r={R + 2} fill="none"
          stroke="rgba(127,119,221,0.07)" strokeWidth="1" />

        {/* Trilha */}
        <path d={`M${sx} ${sy}A${R} ${R} 0 1 1 ${ex} ${ey}`}
          fill="none" stroke="rgba(127,119,221,0.13)" strokeWidth="8" strokeLinecap="round" />

        {/* Zona vermelha — últimos 18% */}
        <path d={`M${rx} ${ry}A${R} ${R} 0 0 1 ${ex} ${ey}`}
          fill="none" stroke="rgba(210,50,50,0.4)" strokeWidth="8" strokeLinecap="round" />

        {/* Arco de preenchimento */}
        {val > 0.005 && (
          <path d={`M${sx} ${sy}A${R} ${R} 0 ${laf} 1 ${fx} ${fy}`}
            fill="none" stroke="rgba(127,119,221,0.88)" strokeWidth="8" strokeLinecap="round" />
        )}

        {/* Face interna escura */}
        <circle cx={cx} cy={cy} r={R - 18} fill="rgba(6,6,14,0.85)" />

        {/* Marcações (10 ticks: 4 major + 6 minor) */}
        {Array.from({ length: 10 }, (_, i) => {
          const deg = S + (i / 9) * T
          const major = i % 3 === 0
          const [ax, ay] = ap(cx, cy, R - (major ? 15 : 10), deg)
          const [bx, by] = ap(cx, cy, R - 2, deg)
          return (
            <line key={i} x1={ax} y1={ay} x2={bx} y2={by}
              stroke={`rgba(255,255,255,${major ? 0.3 : 0.1})`}
              strokeWidth={major ? 1.5 : 1} strokeLinecap="round" />
          )
        })}

        {/* Ponteiro */}
        {val > 0 && (
          <line x1={cx} y1={cy} x2={nx} y2={ny}
            stroke="rgba(255,255,255,0.92)" strokeWidth="2" strokeLinecap="round" />
        )}

        {/* Hub */}
        <circle cx={cx} cy={cy} r="5" fill="rgba(127,119,221,0.9)" />
        <circle cx={cx} cy={cy} r="2" fill="rgba(255,255,255,0.6)" />

        {/* Label dentro da face */}
        <text x={cx} y={cy + 20} textAnchor="middle"
          fontSize="7" fontWeight="600" letterSpacing="1.5"
          fill="rgba(127,119,221,0.45)" fontFamily="ui-monospace,monospace">
          {label}
        </text>
      </g>
    )
  }

  const speedKmh = Math.round(pct.s * 280)
  const rpmStr   = (pct.r * 9).toFixed(1)

  return (
    <svg viewBox="0 0 340 132" fill="none" xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[320px]">

      {/* Painel de fundo */}
      <rect x="0.5" y="0.5" width="339" height="131" rx="12"
        fill="rgba(8,8,18,0.55)" stroke="rgba(127,119,221,0.1)" strokeWidth="1" />

      {/* Tacômetro (esquerda) */}
      {gauge(78, 65, 50, pct.r, "RPM")}

      {/* Velocímetro (direita) */}
      {gauge(262, 65, 50, pct.s, "KM/H")}

      {/* Display digital central */}
      <text x="170" y="56" textAnchor="middle"
        fontSize="36" fontWeight="700" fill="rgba(255,255,255,0.92)"
        fontFamily="ui-monospace,monospace">
        {speedKmh}
      </text>
      <text x="170" y="71" textAnchor="middle"
        fontSize="7.5" fontWeight="600" letterSpacing="3"
        fill="rgba(127,119,221,0.55)" fontFamily="ui-monospace,monospace">
        KM / H
      </text>
      <line x1="148" y1="80" x2="192" y2="80"
        stroke="rgba(127,119,221,0.15)" strokeWidth="1" />
      <text x="170" y="93" textAnchor="middle"
        fontSize="9" fontWeight="500" letterSpacing="0.8"
        fill="rgba(127,119,221,0.38)" fontFamily="ui-monospace,monospace">
        {rpmStr}k RPM
      </text>
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
