import { Link } from "react-router-dom"
import { MapPin, Flag, Clock, ChevronRight, Route, Zap, Gauge, Users } from "lucide-react"
import { ROTAS } from "@/data/rotas"
import type { RotaStatic } from "@/data/rotas"

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTempo(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}min` : `${m} min`
}

type Dificuldade = "tranquila" | "moderada" | "desafiadora"

function getDificuldade(rota: RotaStatic): Dificuldade {
  const km = rota.distancia_km
  const ideal = rota.tempo_ideal_s
  if (km > 60 || ideal > 4500) return "desafiadora"
  if (km > 25 || ideal > 1800) return "moderada"
  return "tranquila"
}

const DIFI_CONFIG: Record<Dificuldade, { label: string; color: string; dots: number }> = {
  tranquila:   { label: "Tranquila",   color: "text-green",  dots: 1 },
  moderada:    { label: "Moderada",    color: "text-amber",  dots: 2 },
  desafiadora: { label: "Desafiadora", color: "text-red",    dots: 3 },
}

const REGIAO_ACCENT: Record<string, string> = {
  Sul:            "from-blue/10",
  Sudeste:        "from-purple/10",
  "Centro-Oeste": "from-amber/10",
  Nordeste:       "from-green/10",
  Norte:          "from-green/10",
}

const REGIAO_DOT: Record<string, string> = {
  Sul:            "bg-blue",
  Sudeste:        "bg-purple",
  "Centro-Oeste": "bg-amber",
  Nordeste:       "bg-green",
  Norte:          "bg-green",
}

// ── Card de rota ──────────────────────────────────────────────────────────────

function RotaCard({ rota }: { rota: RotaStatic }) {
  const difi = getDificuldade(rota)
  const difiCfg = DIFI_CONFIG[difi]
  const gradFrom = REGIAO_ACCENT[rota.regiao] ?? "from-surface"
  const dotColor = REGIAO_DOT[rota.regiao] ?? "bg-faint-foreground"

  return (
    <Link
      to={`/tracks/${rota.id}`}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-surface p-5 transition-all hover:border-border-strong hover:shadow-md"
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${gradFrom} to-transparent opacity-60`} />

      <div className="relative flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-[15px] font-bold leading-snug text-foreground transition-colors group-hover:text-purple">
            {rota.nome}
          </h3>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${dotColor}`} />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-faint-foreground">
              {rota.regiao}
            </span>
          </div>
        </div>

        <div className="flex items-stretch gap-2">
          <div className="flex flex-col items-center pt-0.5">
            <div className="size-2 rounded-full bg-green" />
            <div className="my-1 flex-1 border-l border-dashed border-border" />
            <div className="size-2 rounded-full bg-purple" />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <MapPin className="size-3 shrink-0 text-green" />
              <span className="line-clamp-1">{rota.ponto_a_nome}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Flag className="size-3 shrink-0 text-purple" />
              <span className="line-clamp-1">{rota.ponto_b_nome}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Route className="size-3" />
              {rota.distancia_km} km
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="size-3" />
              {formatTempo(rota.tempo_ideal_s)}
            </span>
          </div>

          <div className={`flex items-center gap-1 text-[10px] font-semibold ${difiCfg.color}`}>
            {Array.from({ length: 3 }).map((_, i) => (
              <span
                key={i}
                className={`inline-block size-1.5 rounded-full`}
                style={{ opacity: i < difiCfg.dots ? 1 : 0.25, background: "currentColor" }}
              />
            ))}
            <span className="ml-0.5">{difiCfg.label}</span>
          </div>
        </div>
      </div>

      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-faint-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
    </Link>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function TracksPage() {
  const regioes = [...new Set(ROTAS.map(r => r.regiao))].sort()

  return (
    <div className="flex flex-col gap-8">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-purple/5 blur-3xl" />
        <div className="relative">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-purple-bg">
              <Gauge className="size-4 text-purple" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint-foreground">
              Autohub Tracks
            </span>
          </div>
          <h1 className="font-display text-[28px] font-bold leading-tight text-foreground">
            Rotas Oficiais
          </h1>
          <p className="mt-1.5 max-w-[480px] text-sm text-muted-foreground">
            Percursos curados para entusiastas. Selecione um veículo, ative o GPS e registre
            sua viagem com telemetria completa e modo fantasma.
          </p>

          <div className="mt-5 flex flex-wrap gap-5">
            <div className="flex items-center gap-2">
              <Route className="size-4 text-purple" />
              <span className="text-[13px]">
                <span className="font-data font-bold text-foreground">{ROTAS.length}</span>
                <span className="ml-1 text-muted-foreground">rotas disponíveis</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="size-4 text-blue" />
              <span className="text-[13px]">
                <span className="font-data font-bold text-foreground">0</span>
                <span className="ml-1 text-muted-foreground">runs registradas</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Banner modo ghost ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
        <span className="shrink-0 text-xl">👻</span>
        <div>
          <p className="text-[12px] font-semibold text-foreground">Modo Ghost ativo</p>
          <p className="text-[11px] text-muted-foreground">
            Fantasmas dos outros usuários são carregados antes de sair e reproduzidos em sincronia
            com seu tempo — sem WebSocket, sem custo extra.
          </p>
        </div>
        <div className="ml-auto shrink-0 hidden sm:flex items-center gap-1 text-[10px] text-faint-foreground">
          <Zap className="size-3 text-amber" />
          Zero latência
        </div>
      </div>

      {/* ── Rotas por região ──────────────────────────────────────────── */}
      {regioes.map(regiao => {
        const grupo = ROTAS.filter(r => r.regiao === regiao)
        return (
          <div key={regiao} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${REGIAO_DOT[regiao] ?? "bg-faint-foreground"}`} />
              <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint-foreground">
                {regiao}
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {grupo.map(r => <RotaCard key={r.id} rota={r} />)}
            </div>
          </div>
        )
      })}

      <p className="text-center text-[11px] text-faint-foreground">
        Respeite os limites de velocidade. O Autohub Tracks é um diário de bordo — não incentiva direção perigosa.
      </p>
    </div>
  )
}
