import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Zap, Layers, CheckCircle2 } from "lucide-react"
import type { PerfilVeiculo, StatusVeiculo, VeiculoComMetricas } from "@/types"

const PERFIL_LABEL: Record<PerfilVeiculo, string> = {
  daily: "Daily",
  street_build: "Street Build",
  restomod: "Restomod",
  track: "Track",
  project: "Projeto",
}

const PERFIL_DOT: Record<PerfilVeiculo, string> = {
  daily:        "bg-blue",
  street_build: "bg-coral",
  restomod:     "bg-purple",
  track:        "bg-red",
  project:      "bg-amber",
}

const PERFIL_TEXT: Record<PerfilVeiculo, string> = {
  daily:        "text-blue",
  street_build: "text-coral",
  restomod:     "text-purple",
  track:        "text-red",
  project:      "text-amber",
}

const STATUS_LABEL: Record<StatusVeiculo, string> = {
  planejamento: "Planejamento",
  em_andamento: "Em andamento",
  concluido:    "Concluído",
  pausado:      "Pausado",
}

const STATUS_COLOR: Record<StatusVeiculo, string> = {
  planejamento: "text-faint-foreground",
  em_andamento: "text-amber",
  concluido:    "text-green",
  pausado:      "text-faint-foreground",
}

const PROGRESS_BAR: Record<StatusVeiculo, string> = {
  planejamento: "bg-faint-foreground/30",
  em_andamento: "bg-amber",
  concluido:    "bg-green",
  pausado:      "bg-faint-foreground/20",
}

export function VeiculoCard({ veiculo }: { veiculo: VeiculoComMetricas }) {
  const progresso =
      veiculo.total_itens > 0
          ? Math.round((veiculo.itens_concluidos / veiculo.total_itens) * 100)
          : 0

  const status = veiculo.status as StatusVeiculo
  const perfil = veiculo.perfil as PerfilVeiculo

  return (
      <Link
          to={`/veiculo/${veiculo.id}`}
          className="group flex flex-col rounded-xl border border-border bg-surface p-5 transition-all hover:border-border-strong hover:bg-surface/80"
      >
        {/* ── Topo ───────────────────────────────────────────────────────── */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            {/* perfil badge */}
            <div className="flex items-center gap-1.5">
              <span className={cn("size-1.5 rounded-full", PERFIL_DOT[perfil])} />
              <span className={cn("text-[11px] font-medium", PERFIL_TEXT[perfil])}>
              {PERFIL_LABEL[perfil]}
            </span>
            </div>
            {/* nome */}
            <h3 className="font-display text-[18px] font-semibold leading-tight text-foreground">
              {veiculo.apelido}
            </h3>
            <p className="text-[12px] text-muted-foreground">
              {veiculo.marca} {veiculo.modelo} · {veiculo.ano_modelo}
            </p>
          </div>

          {/* meta whp */}
          {veiculo.meta_potencia_whp && (
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <div className="flex items-center gap-1 text-amber">
                  <Zap className="size-3" />
                  <span className="font-data text-sm font-semibold">{veiculo.meta_potencia_whp}</span>
                </div>
                <span className="text-[10px] text-faint-foreground">whp meta</span>
              </div>
          )}
        </div>

        {/* ── Progresso ──────────────────────────────────────────────────── */}
        <div className="mb-1.5 flex items-center justify-between">
        <span className={cn("text-[11px] font-medium", STATUS_COLOR[status])}>
          {STATUS_LABEL[status]}
        </span>
          <span className="font-data text-[11px] text-muted-foreground">{progresso}%</span>
        </div>
        <div className="h-1 w-full rounded-full bg-surface-2">
          <div
              className={cn("h-1 rounded-full transition-all duration-500", PROGRESS_BAR[status])}
              style={{ width: `${progresso}%` }}
          />
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3.5">
          <div className="flex items-center gap-3 text-[11px] text-faint-foreground">
          <span className="flex items-center gap-1">
            <Layers className="size-3" />
            {veiculo.total_fases} fase{veiculo.total_fases !== 1 && "s"}
          </span>
            <span className="flex items-center gap-1">
            <CheckCircle2 className="size-3" />
              {veiculo.itens_concluidos}/{veiculo.total_itens} itens
          </span>
          </div>

          <span className="text-[11px] text-faint-foreground opacity-0 transition-opacity group-hover:opacity-100">
          Ver build →
        </span>
        </div>
      </Link>
  )
}
