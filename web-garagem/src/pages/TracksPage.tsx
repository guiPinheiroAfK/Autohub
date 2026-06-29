import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Flag, Clock, ChevronRight, Route, Gauge, Plus, BadgeCheck, User, MapPin } from "lucide-react"
import { api } from "@/lib/api/client"
import { useAuth } from "@/context/AuthContext"
import { CriarDestinoModal } from "@/components/shared/CriarDestinoModal"
import type { Rota } from "@/types/tracks"

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTempo(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}min` : `${m} min`
}

type Dificuldade = "tranquila" | "moderada" | "desafiadora"

function getDificuldade(rota: Rota): Dificuldade | null {
  const km = rota.distancia_km
  const ideal = rota.tempo_ideal_s
  if (km == null && ideal == null) return null
  if ((km ?? 0) > 60 || (ideal ?? 0) > 4500) return "desafiadora"
  if ((km ?? 0) > 25 || (ideal ?? 0) > 1800) return "moderada"
  return "tranquila"
}

const DIFI_CONFIG: Record<Dificuldade, { label: string; color: string; dots: number }> = {
  tranquila:   { label: "Tranquila",   color: "text-green", dots: 1 },
  moderada:    { label: "Moderada",    color: "text-amber", dots: 2 },
  desafiadora: { label: "Desafiadora", color: "text-red",   dots: 3 },
}

const REGIAO_DOT: Record<string, string> = {
  Sul: "bg-blue", Sudeste: "bg-purple", "Centro-Oeste": "bg-amber", Nordeste: "bg-green", Norte: "bg-green",
}

// ── Card de rota ──────────────────────────────────────────────────────────────

function RotaCard({ rota }: { rota: Rota }) {
  const difi = getDificuldade(rota)
  const difiCfg = difi ? DIFI_CONFIG[difi] : null
  const dotColor = rota.regiao ? (REGIAO_DOT[rota.regiao] ?? "bg-faint-foreground") : "bg-faint-foreground"

  return (
    <Link
      to={`/tracks/${rota.id}`}
      className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-surface p-5 transition-all hover:border-border-strong hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-[15px] font-bold leading-snug text-foreground transition-colors group-hover:text-purple">
          {rota.nome}
        </h3>
        {rota.regiao && (
          <div className="flex shrink-0 items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${dotColor}`} />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-faint-foreground">{rota.regiao}</span>
          </div>
        )}
      </div>

      {/* Largada livre → chegada */}
      <div className="flex items-center gap-2 text-[12px]">
        <span className="flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          <MapPin className="size-2.5" /> largada livre
        </span>
        <ChevronRight className="size-3 text-faint-foreground" />
        <span className="flex items-center gap-1 font-medium text-foreground">
          <Flag className="size-3 text-purple" />
          <span className="line-clamp-1">{rota.ponto_b_nome}</span>
        </span>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <div className="flex flex-wrap items-center gap-3">
          {rota.distancia_km != null && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Route className="size-3" />{Number(rota.distancia_km)} km
            </span>
          )}
          {rota.tempo_ideal_s != null && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="size-3" />{formatTempo(rota.tempo_ideal_s)}
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Gauge className="size-3" />{rota.total_runs} {rota.total_runs === 1 ? "run" : "runs"}
          </span>
        </div>

        {difiCfg ? (
          <div className={`flex items-center gap-1 text-[10px] font-semibold ${difiCfg.color}`}>
            {Array.from({ length: 3 }).map((_, i) => (
              <span key={i} className="inline-block size-1.5 rounded-full" style={{ opacity: i < difiCfg.dots ? 1 : 0.25, background: "currentColor" }} />
            ))}
            <span className="ml-0.5">{difiCfg.label}</span>
          </div>
        ) : rota.criador_nome ? (
          <span className="flex items-center gap-1 text-[10px] text-faint-foreground">
            <User className="size-2.5" />{rota.criador_nome}
          </span>
        ) : null}
      </div>

      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-faint-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
    </Link>
  )
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function TracksPage() {
  const { user } = useAuth()
  const [rotas, setRotas] = useState<Rota[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)

  useEffect(() => {
    api.get<{ rotas: Rota[] }>("/api/tracks/rotas")
      .then((r) => setRotas(r.rotas))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const oficiais = rotas.filter((r) => r.oficial)
  const comunidade = rotas.filter((r) => !r.oficial)

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
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint-foreground">Autohub Tracks</span>
          </div>
          <h1 className="font-display text-[28px] font-bold leading-tight text-foreground">Pontos de chegada</h1>
          <p className="mt-1.5 max-w-[480px] text-sm text-muted-foreground">
            Largada livre: comece de onde estiver e corra até a chegada. Telemetria completa,
            leaderboard e modo fantasma. Qualquer um pode criar um destino.
          </p>

          <button
            onClick={() => setModalAberto(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-purple px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Plus className="size-4" /> Criar ponto de chegada
          </button>
        </div>
      </div>

      {/* ── Loading ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-surface" />)}
        </div>
      ) : (
        <>
          {/* ── Oficiais ──────────────────────────────────────────────── */}
          {oficiais.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <BadgeCheck className="size-4 text-purple" />
                <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint-foreground">Rotas oficiais</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {oficiais.map((r) => <RotaCard key={r.id} rota={r} />)}
              </div>
            </div>
          )}

          {/* ── Comunidade ────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <User className="size-4 text-blue" />
              <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-faint-foreground">Da comunidade</h2>
            </div>
            {comunidade.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {comunidade.map((r) => <RotaCard key={r.id} rota={r} />)}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-10 text-center">
                <Flag className="size-6 text-faint-foreground" />
                <div>
                  <p className="text-[13px] font-medium text-foreground">Nenhum destino da comunidade ainda</p>
                  <p className="text-[12px] text-muted-foreground">Seja o primeiro a marcar um ponto de chegada.</p>
                </div>
                <button onClick={() => setModalAberto(true)} className="inline-flex items-center gap-2 rounded-lg bg-purple px-3.5 py-2 text-[12px] font-semibold text-white hover:opacity-90">
                  <Plus className="size-3.5" /> Criar chegada
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <p className="text-center text-[11px] text-faint-foreground">
        Respeite os limites de velocidade. O Autohub Tracks é um diário de bordo — não incentiva direção perigosa.
      </p>

      {modalAberto && (
        <CriarDestinoModal
          isAdmin={!!user?.admin}
          onClose={() => setModalAberto(false)}
          onCriado={(rota) => { setRotas((prev) => [rota, ...prev]); setModalAberto(false) }}
        />
      )}
    </div>
  )
}
