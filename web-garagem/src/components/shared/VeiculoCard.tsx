import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"
import type { VeiculoResumo } from "@/lib/api/veiculos"
import type { PerfilVeiculo, StatusVeiculo } from "@/types"

const PERFIL_LABEL: Record<PerfilVeiculo, string> = {
  daily: "Daily",
  street_build: "Street Build",
  restomod: "Restomod",
  track: "Track",
  project: "Projeto",
}

const PERFIL_CLASS: Record<PerfilVeiculo, string> = {
  daily: "bg-blue-bg text-blue",
  street_build: "bg-coral-bg text-coral",
  restomod: "bg-purple-bg text-purple",
  track: "bg-red-bg text-red",
  project: "bg-amber-bg text-amber",
}

const STATUS_LABEL: Record<StatusVeiculo, string> = {
  planejamento: "Planejamento",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  pausado: "Pausado",
}

export function VeiculoCard({ veiculo }: { veiculo: VeiculoResumo }) {
  return (
    <Link
      to={`/veiculo/${veiculo.id}`}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span
            className={cn(
              "inline-flex w-fit items-center rounded-full px-2.5 py-[3px] text-[11px] font-medium",
              PERFIL_CLASS[veiculo.perfil]
            )}
          >
            {PERFIL_LABEL[veiculo.perfil]}
          </span>
          <h3 className="mt-2 font-display text-lg font-semibold text-foreground">{veiculo.apelido}</h3>
          <p className="text-xs text-muted-foreground">
            {veiculo.marca} {veiculo.modelo} · {veiculo.anoModelo}
          </p>
        </div>
        {veiculo.metaPotenciaWhp && (
          <span className="whitespace-nowrap font-data text-xs font-semibold text-amber">
            meta {veiculo.metaPotenciaWhp} whp
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{STATUS_LABEL[veiculo.status]}</span>
        <span className="font-data">{veiculo.progresso}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface-2">
        <div className="h-1.5 rounded-full bg-green transition-all" style={{ width: `${veiculo.progresso}%` }} />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-[11px] text-faint-foreground">
        <span>
          {veiculo.totalFases} fase{veiculo.totalFases !== 1 && "s"} ·{" "}
          {veiculo.itensConcluidos}/{veiculo.totalItens} itens concluídos
        </span>
      </div>
    </Link>
  )
}
