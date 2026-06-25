import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { MapPin, Flag, Clock, Users, ChevronRight, Route } from "lucide-react"
import { api } from "@/lib/api/client"
import type { Rota } from "@/types/tracks"

const REGIAO_COLOR: Record<string, string> = {
  Sul: "text-blue border-blue/30 bg-blue-bg",
  Sudeste: "text-purple border-purple/30 bg-purple-bg",
  "Centro-Oeste": "text-amber border-amber/30 bg-amber-bg",
  Nordeste: "text-green border-green/30 bg-green-bg",
  Norte: "text-green border-green/30 bg-green-bg",
}

function formatTempo(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m} min`
}

function RotaCard({ rota }: { rota: Rota }) {
  const regiaoClass = rota.regiao ? (REGIAO_COLOR[rota.regiao] ?? "text-faint-foreground border-border") : "text-faint-foreground border-border"

  return (
    <Link
      to={`/tracks/${rota.id}`}
      className="group flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 transition-all hover:border-border-strong hover:shadow-sm"
    >
      {/* Linha superior: nome + badge de região */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-[15px] font-semibold leading-snug text-foreground group-hover:text-purple">
          {rota.nome}
        </h3>
        {rota.regiao && (
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${regiaoClass}`}>
            {rota.regiao}
          </span>
        )}
      </div>

      {/* Ponto A → Ponto B */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <MapPin className="size-3 shrink-0 text-green" />
          {rota.ponto_a_nome}
        </div>
        <div className="ml-1.5 h-3 border-l border-dashed border-border" />
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Flag className="size-3 shrink-0 text-purple" />
          {rota.ponto_b_nome}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-4">
          {rota.distancia_km && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Route className="size-3" />
              {Number(rota.distancia_km).toFixed(0)} km
            </span>
          )}
          {rota.tempo_ideal_s && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="size-3" />
              ideal {formatTempo(rota.tempo_ideal_s)}
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Users className="size-3" />
            {rota.total_runs} run{Number(rota.total_runs) !== 1 ? "s" : ""}
          </span>
        </div>
        <ChevronRight className="size-4 text-faint-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  )
}

export default function TracksPage() {
  const [rotas, setRotas] = useState<Rota[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<{ rotas: Rota[] }>("/api/tracks/rotas")
      .then(r => setRotas(r.rotas))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const regioes = [...new Set(rotas.map(r => r.regiao ?? "Outras"))].sort()

  return (
    <div className="flex flex-col gap-8">

      {/* Header */}
      <div>
        <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-faint-foreground">
          Autohub Tracks
        </div>
        <h1 className="font-display text-[28px] font-semibold leading-tight text-foreground">
          Rotas Oficiais
        </h1>
        <p className="mt-1 max-w-[520px] text-sm text-muted-foreground">
          Percursos curados para entusiastas. Selecione um veículo da sua garagem,
          ative o GPS e registre sua viagem com telemetria completa.
        </p>
      </div>

      {/* Explicação do modo fantasma */}
      <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-purple-bg text-purple text-[18px]">
          👻
        </div>
        <div>
          <p className="text-[13px] font-medium text-foreground">Modo Ghost ativado</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Ao iniciar uma rota, você verá os fantasmas dos outros usuários no mapa —
            carregados antes de sair, reproduzidos em sincronia com o seu tempo de viagem.
            Zero infra extra, pura diversão.
          </p>
        </div>
      </div>

      {/* Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-[180px] animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        </div>
      )}

      {/* Rotas por região */}
      {!loading && regioes.map(regiao => {
        const grupo = rotas.filter(r => (r.regiao ?? "Outras") === regiao)
        return (
          <div key={regiao} className="flex flex-col gap-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
              {regiao}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {grupo.map(r => <RotaCard key={r.id} rota={r} />)}
            </div>
          </div>
        )
      })}

      {/* Footer disclaimer */}
      <p className="text-center text-[11px] text-faint-foreground">
        Respeite os limites de velocidade. O Autohub Tracks é um diário de bordo — não incentiva direção perigosa.
      </p>
    </div>
  )
}
