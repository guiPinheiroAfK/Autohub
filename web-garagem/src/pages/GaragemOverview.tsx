import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Plus } from "lucide-react"
import { listarVeiculos, type VeiculoResumo } from "@/lib/api/veiculos"
import { VeiculoCard } from "@/components/shared/VeiculoCard"

export default function GaragemOverview() {
  const [veiculos, setVeiculos] = useState<VeiculoResumo[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    listarVeiculos()
      .then(setVeiculos)
      .catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar veículos"))
  }, [])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.12em] text-faint-foreground">
            Garagem
          </div>
          <h1 className="font-display text-[28px] font-semibold leading-tight text-foreground">
            Seus projetos
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {veiculos === null
              ? "Carregando..."
              : `${veiculos.length} veículo${veiculos.length !== 1 ? "s" : ""} cadastrado${veiculos.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        <Link
          to="/novo"
          className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-purple px-3.5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" />
          Novo veículo
        </Link>
      </div>

      {erro && (
        <p className="rounded-lg border border-red-bg bg-red-bg px-3 py-2 text-sm text-red">{erro}</p>
      )}

      {veiculos && veiculos.length === 0 && !erro && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">Você ainda não cadastrou nenhum veículo.</p>
          <Link to="/novo" className="text-sm text-purple hover:underline">
            Cadastrar o primeiro
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {veiculos?.map((v) => (
          <VeiculoCard key={v.id} veiculo={v} />
        ))}
      </div>
    </div>
  )
}
