import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import {
  buscarVeiculo,
  progressoVeiculo,
  totaisPorMoeda,
  contagemItens,
  type VeiculoDetalheCompleto,
} from "@/lib/api/veiculos"
import { formatMoeda } from "@/lib/format"
import { Metric } from "@/components/shared/Metric"
import { FaseCard } from "@/components/shared/FaseCard"
import type { PerfilVeiculo, StatusVeiculo } from "@/types"

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

export default function VeiculoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const [veiculo, setVeiculo] = useState<VeiculoDetalheCompleto | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setVeiculo(null)
    setErro(null)
    buscarVeiculo(id)
      .then(setVeiculo)
      .catch((e) => setErro(e instanceof Error ? e.message : "Veículo não encontrado"))
  }, [id])

  if (erro) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-sm text-muted-foreground">{erro}</p>
        <Link to="/" className="text-sm text-purple hover:underline">
          Voltar para a garagem
        </Link>
      </div>
    )
  }

  if (!veiculo) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  const totais = totaisPorMoeda(veiculo)
  const principal = totais[0]
  const progresso = progressoVeiculo(veiculo)
  const { total, concluidos } = contagemItens(veiculo)

  return (
    <div className="flex flex-col gap-10">
      <div className="border-b border-border pb-8">
        <div className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-faint-foreground">
          {veiculo.marca} {veiculo.modelo} · {veiculo.anoModelo} · {PERFIL_LABEL[veiculo.perfil]}
        </div>
        <h1 className="font-display text-[36px] font-semibold leading-[1.1] text-foreground">
          {veiculo.apelido}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {STATUS_LABEL[veiculo.status]}
          {veiculo.metaPotenciaWhp && ` · meta de ${veiculo.metaPotenciaWhp} whp`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Metric label="Progresso" value={`${progresso}%`} tone="green" />
        <Metric
          label="Investido"
          value={principal ? formatMoeda(principal.gasto, principal.moeda) : "—"}
          tone="purple"
        />
        <Metric
          label="Estimado total"
          value={principal ? formatMoeda(principal.estimadoMax, principal.moeda) : "—"}
        />
        <Metric label="Itens concluídos" value={`${concluidos} / ${total}`} tone="amber" />
      </div>

      <div>
        <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.1em] text-faint-foreground">
          Fases do build
        </div>
        <div className="flex flex-col gap-2.5">
          {veiculo.fases.map((fase, idx) => (
            <FaseCard key={fase.id} fase={fase} defaultOpen={idx === 0} />
          ))}
          {veiculo.fases.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma fase cadastrada ainda para esse veículo.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
