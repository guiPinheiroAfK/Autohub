import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { StatusBadge, StatusDot } from "@/components/shared/StatusBadge"
import { formatFaixa } from "@/lib/format"
import type { FaseDetalhe, ItemDetalhe } from "@/lib/api/veiculos"

const FILL_CLASS = {
  planejado: "bg-purple",
  andamento: "bg-amber",
  concluido: "bg-green",
} as const

function fillWidth(fase: FaseDetalhe): number {
  if (fase.status === "concluido") return 100
  if (fase.status === "planejado") return 0
  if (fase.itens.length === 0) return 40
  const concluidos = fase.itens.filter((i) => i.status === "concluido").length
  return Math.max(8, Math.round((concluidos / fase.itens.length) * 100))
}

interface FaseCardProps {
  fase: FaseDetalhe
  defaultOpen?: boolean
}

export function FaseCard({ fase, defaultOpen = false }: FaseCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-border-strong">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-[18px] py-[14px] text-left"
      >
        <StatusBadge status={fase.status} />
        <span className="flex-1 text-sm font-medium text-foreground">{fase.titulo}</span>
        <span className="whitespace-nowrap text-[13px] text-muted-foreground">
          {formatFaixa(fase.orcamentoMin, fase.orcamentoMax, fase.moeda)}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-faint-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      <div className="h-[2px] bg-surface-2">
        <div
          className={cn("h-full transition-all duration-300", FILL_CLASS[fase.status])}
          style={{ width: `${fillWidth(fase)}%` }}
        />
      </div>

      {open && (
        <div className="flex flex-col gap-2.5 border-t border-border px-[18px] py-4">
          <div className="overflow-hidden rounded-[10px] border border-border">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="bg-surface-2 px-[18px] py-[9px] text-left text-[11px] font-medium uppercase tracking-wide text-faint-foreground">
                    Componente
                  </th>
                  <th className="bg-surface-2 px-[18px] py-[9px] text-right text-[11px] font-medium uppercase tracking-wide text-faint-foreground">
                    Preço est.
                  </th>
                </tr>
              </thead>
              <tbody>
                {fase.itens.map((item: ItemDetalhe) => (
                  <tr key={item.id} className="border-t border-border first:border-t-0">
                    <td className="flex items-start gap-2.5 px-[18px] py-[11px] align-top">
                      <StatusDot status={item.status} />
                      <div>
                        <div className="text-[13px] font-medium text-foreground">{item.nome}</div>
                        {item.detalhe && (
                          <div className="mt-0.5 text-xs text-muted-foreground">{item.detalhe}</div>
                        )}
                        {item.fornecedorNome && (
                          <div className="mt-0.5 text-[11px] text-faint-foreground">
                            via {item.fornecedorNome}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-[18px] py-[11px] text-right text-xs text-muted-foreground">
                      {formatFaixa(item.precoMin, item.precoMax, item.moeda)}
                    </td>
                  </tr>
                ))}
                {fase.nota && (
                  <tr className="border-t border-amber/15 bg-amber-bg/40">
                    <td colSpan={2} className="px-[18px] py-2.5 text-xs italic text-amber">
                      ⚠ {fase.nota}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
