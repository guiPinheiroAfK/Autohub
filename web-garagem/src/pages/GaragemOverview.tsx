import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Plus, Gauge, Wrench, Clock } from "lucide-react"
import { api } from "@/lib/api/client"
import { useAuth } from "@/context/AuthContext"
import { VeiculoCard } from "@/components/shared/VeiculoCard"
import type { VeiculoComMetricas } from "@/types"

function SkeletonCard() {
  return (
      <div className="h-[175px] animate-pulse rounded-xl border border-border bg-surface" />
  )
}

// ── Stat rápido no topo da garagem ────────────────────────────────────────────
function GaragemStat({ icon: Icon, label, value, accent }: {
  icon: typeof Gauge
  label: string
  value: string | number
  accent?: string
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

  // Stats agregados
  const totalFases = veiculos.reduce((s, v) => s + v.total_fases, 0)
  const totalItens = veiculos.reduce((s, v) => s + v.total_itens, 0)
  const emAndamento = veiculos.filter(v => v.status === "em_andamento").length

  return (
      <div className="flex flex-col gap-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between">
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-faint-foreground">
              Garagem
            </div>
            <h1 className="font-display text-[28px] font-semibold leading-tight text-foreground">
              {user?.garagem?.nome ?? "Minha Garagem"}
            </h1>
            {!loading && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {veiculos.length === 0
                      ? "Nenhum veículo ainda"
                      : `${veiculos.length} veículo${veiculos.length !== 1 ? "s" : ""}`}
                </p>
            )}
          </div>

          <Link
              to="/novo"
              className="animate-page-in flex items-center gap-1.5 rounded-lg bg-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              style={{ animationDelay: '200ms' }} // Opcional: um leve atraso para ele aparecer depois do texto
          >
            <Plus className="size-4" />
            Criar primeiro veículo
          </Link>
        </div>

        {/* ── Stats rápidos (só aparece com dados) ─────────────────────── */}
        {!loading && veiculos.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5">
              <GaragemStat icon={Wrench} label="em andamento" value={emAndamento} accent="text-amber" />
              <GaragemStat icon={Gauge} label="fases totais" value={totalFases} accent="text-purple" />
              <GaragemStat icon={Clock} label="itens totais" value={totalItens} accent="text-blue" />
            </div>
        )}

        {/* ── Loading ────────────────────────────────────────────────────── */}
        {loading && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
        )}

        {/* ── Erro ──────────────────────────────────────────────────────── */}
        {erro && (
            <p className="rounded-lg border border-red-bg bg-red-bg px-4 py-3 text-sm text-red">
              {erro}
            </p>
        )}

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {!loading && !erro && veiculos.length === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-20 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-surface text-faint-foreground">
                <Wrench className="size-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Garagem vazia</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Adicione seu primeiro projeto de build
                </p>
              </div>
              <Link
                  to="/novo"
                  className="flex items-center gap-1.5 rounded-lg bg-purple px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                <Plus className="size-4" />
                Criar primeiro veículo
              </Link>
            </div>
        )}

        {/* ── Grid de veículos ──────────────────────────────────────────── */}
        {!loading && veiculos.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {veiculos.map((v, index) => (
                  <div
                      key={v.id}
                      className="animate-page-in"
                      // Cada card vai demorar 100ms a mais que o anterior para subir
                      style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <VeiculoCard veiculo={v} />
                  </div>
              ))}
            </div>
        )}
      </div>
  )
}
