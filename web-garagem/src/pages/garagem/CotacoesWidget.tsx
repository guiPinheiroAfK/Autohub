import { TrendingUp } from "lucide-react"
import { useCotacoes } from "./useCotacoes"
import { formatDataCurta } from "./helpers"

// ── Widget de cotações ────────────────────────────────────────────────────────

export function CotacoesWidget() {
  const { cotacoes, loading } = useCotacoes()

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
