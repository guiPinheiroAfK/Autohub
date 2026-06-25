import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import {
  MapPin, Flag, Clock, Route, Trophy, Play, ChevronLeft,
  Users, Wind, Sun, CloudRain, Cloud, Zap
} from "lucide-react"
import { api } from "@/lib/api/client"
import type { Rota, LeaderboardEntry } from "@/types/tracks"
import type { VeiculoComMetricas } from "@/types"

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTempo(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2,"0")}m ${sec.toString().padStart(2,"0")}s`
  return `${m}:${sec.toString().padStart(2,"0")}`
}

function formatDiff(diff: number, ideal: number) {
  if (diff === 0) return <span className="text-green font-medium">Cravo! 🎯</span>
  const sign = diff > 0 ? "+" : "-"
  const pct = Math.round((diff / ideal) * 100)
  const color = diff <= 60 ? "text-green" : diff <= 300 ? "text-amber" : "text-red"
  return <span className={color}>{sign}{formatTempo(diff)} ({pct}%)</span>
}

const CLIMA_ICON: Record<string, React.ReactNode> = {
  sol: <Sun className="size-3" />,
  nublado: <Cloud className="size-3" />,
  chuva: <CloudRain className="size-3" />,
  neve: <Wind className="size-3" />,
  tempestade: <Zap className="size-3" />,
}

const PERIODO_LABEL: Record<string, string> = {
  manha: "☀️ Manhã", tarde: "🌤️ Tarde", noite: "🌆 Noite", madrugada: "🌙 Madrugada"
}

const PERFIL_LABEL: Record<string, string> = {
  daily: "Daily", street_build: "Street", restomod: "Restomod",
  track: "Track", project: "Projeto"
}

// ── Modal de seleção de veículo ───────────────────────────────────────────────

function ModalVeiculo({ rotaId, onClose }: { rotaId: string; onClose: () => void }) {
  const [veiculos, setVeiculos] = useState<VeiculoComMetricas[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<VeiculoComMetricas[]>("/api/veiculos")
      .then(setVeiculos)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full sm:w-[420px] rounded-t-2xl sm:rounded-2xl border border-border bg-background p-6 flex flex-col gap-4">
        <div>
          <h3 className="font-display text-[17px] font-semibold text-foreground">Escolha o veículo</h3>
          <p className="mt-1 text-[12px] text-muted-foreground">Qual carro vai fazer essa rota?</p>
        </div>

        {loading ? (
          <div className="flex flex-col gap-2">
            {[1,2].map(i => <div key={i} className="h-14 animate-pulse rounded-lg bg-surface" />)}
          </div>
        ) : veiculos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum veículo na garagem.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
            {veiculos.map(v => (
              <Link
                key={v.id}
                to={`/tracks/${rotaId}/run?veiculo=${v.id}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 hover:border-purple/40 hover:bg-purple-bg transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">{v.apelido}</p>
                  <p className="text-[11px] text-muted-foreground">{v.marca} {v.modelo}</p>
                </div>
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[9px] text-faint-foreground uppercase tracking-wider">
                  {PERFIL_LABEL[v.perfil] ?? v.perfil}
                </span>
              </Link>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-1 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-surface"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function RotaDetalhePage() {
  const { rotaId } = useParams<{ rotaId: string }>()
  const [rota, setRota] = useState<Rota | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [tempoIdeal, setTempoIdeal] = useState<number | null>(null)
  const [modo, setModo] = useState<"regularidade" | "tempo">("regularidade")
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (!rotaId) return
    Promise.all([
      api.get<{ rota: Rota }>(`/api/tracks/rotas/${rotaId}`).then(r => setRota(r.rota)),
      api.get<{ leaderboard: LeaderboardEntry[]; tempo_ideal_s: number }>(
        `/api/tracks/rotas/${rotaId}/leaderboard?modo=${modo}`
      ).then(r => { setLeaderboard(r.leaderboard); setTempoIdeal(r.tempo_ideal_s) }),
    ]).finally(() => setLoading(false))
  }, [rotaId, modo])

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-6 w-48 animate-pulse rounded bg-surface" />
        <div className="h-32 animate-pulse rounded-xl bg-surface" />
        <div className="h-64 animate-pulse rounded-xl bg-surface" />
      </div>
    )
  }

  if (!rota) return <p className="text-muted-foreground">Rota não encontrada.</p>

  return (
    <div className="flex flex-col gap-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link to="/tracks" className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-3" /> Tracks
        </Link>
        <span className="text-[12px] text-faint-foreground">/</span>
        <span className="text-[12px] text-foreground">{rota.nome}</span>
      </div>

      {/* Hero da rota */}
      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {rota.regiao && (
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-faint-foreground">
                {rota.regiao}
              </span>
            )}
            <h1 className="font-display text-[22px] font-semibold text-foreground">{rota.nome}</h1>
            {rota.descricao && (
              <p className="mt-1 text-[13px] text-muted-foreground">{rota.descricao}</p>
            )}
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-purple px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            <Play className="size-4 fill-white" /> Iniciar
          </button>
        </div>

        {/* Rota visual */}
        <div className="flex flex-col gap-1.5 mb-5">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <MapPin className="size-4 shrink-0 text-green" />
            <span className="font-medium">{rota.ponto_a_nome}</span>
          </div>
          <div className="ml-2 h-4 border-l-2 border-dashed border-border" />
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Flag className="size-4 shrink-0 text-purple" />
            <span className="font-medium">{rota.ponto_b_nome}</span>
          </div>
        </div>

        {/* Stats da rota */}
        <div className="flex flex-wrap gap-4 border-t border-border pt-4">
          {rota.distancia_km && (
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Route className="size-3.5" />
              <span className="font-medium text-foreground">{Number(rota.distancia_km).toFixed(0)} km</span>
            </div>
          )}
          {rota.tempo_ideal_s && (
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Clock className="size-3.5" />
              <span>Ideal: <span className="font-medium text-foreground">{formatTempo(rota.tempo_ideal_s)}</span></span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Users className="size-3.5" />
            <span className="font-medium text-foreground">{rota.total_runs}</span> run{Number(rota.total_runs) !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="size-4 text-amber" />
            <h2 className="text-[14px] font-semibold text-foreground">Leaderboard</h2>
          </div>

          {/* Toggle modo */}
          <div className="flex rounded-lg border border-border bg-surface p-0.5 text-[11px]">
            {(["regularidade", "tempo"] as const).map(m => (
              <button
                key={m}
                onClick={() => setModo(m)}
                className={`rounded-md px-3 py-1 font-medium transition-colors ${
                  modo === m ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "regularidade" ? "🎯 Regularidade" : "⚡ Tempo"}
              </button>
            ))}
          </div>
        </div>

        {modo === "regularidade" && tempoIdeal && (
          <p className="text-[11px] text-faint-foreground">
            Quem chegar mais perto de <strong className="text-foreground">{formatTempo(tempoIdeal)}</strong> (tempo ideal) fica no topo.
            Punição para quem vai rápido demais ou devagar demais.
          </p>
        )}

        {leaderboard.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
            <span className="text-3xl">🏁</span>
            <div>
              <p className="text-sm font-medium text-foreground">Sem runs ainda</p>
              <p className="mt-1 text-sm text-muted-foreground">Seja o primeiro a completar essa rota!</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {leaderboard.map((entry, idx) => (
              <div
                key={entry.id}
                className={`flex items-center gap-4 rounded-xl border px-4 py-3.5 ${
                  idx === 0 ? "border-amber/30 bg-amber-bg" :
                  idx === 1 ? "border-border bg-surface/80" :
                  idx === 2 ? "border-border/60 bg-surface/40" : "border-transparent"
                }`}
              >
                {/* Posição */}
                <div className="w-8 shrink-0 text-center">
                  {idx === 0 ? <span className="text-xl">🥇</span> :
                   idx === 1 ? <span className="text-xl">🥈</span> :
                   idx === 2 ? <span className="text-xl">🥉</span> :
                   <span className="font-data text-sm font-bold text-faint-foreground">{idx + 1}</span>}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">{entry.usuario_nome}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {entry.veiculo_apelido} · {entry.veiculo_marca} {entry.veiculo_modelo}
                  </p>
                </div>

                {/* Context badges */}
                <div className="flex items-center gap-1.5">
                  {entry.clima && CLIMA_ICON[entry.clima] && (
                    <span title={entry.clima} className="text-faint-foreground">
                      {CLIMA_ICON[entry.clima]}
                    </span>
                  )}
                  {entry.periodo_dia && (
                    <span className="text-[10px] text-faint-foreground">
                      {PERIODO_LABEL[entry.periodo_dia]?.split(" ")[0]}
                    </span>
                  )}
                </div>

                {/* Tempo */}
                <div className="text-right shrink-0">
                  <p className="font-data text-[14px] font-bold text-foreground">
                    {formatTempo(entry.duracao_s)}
                  </p>
                  {modo === "regularidade" && tempoIdeal && (
                    <p className="text-[10px]">
                      {formatDiff(entry.diff_ideal_s, tempoIdeal)}
                    </p>
                  )}
                  {modo === "tempo" && (
                    <p className="text-[10px] text-faint-foreground">
                      {Number(entry.vel_media_kmh).toFixed(0)} km/h méd.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && <ModalVeiculo rotaId={rota.id} onClose={() => setShowModal(false)} />}
    </div>
  )
}
