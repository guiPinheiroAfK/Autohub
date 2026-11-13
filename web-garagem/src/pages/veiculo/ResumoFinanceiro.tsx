import { formatMoeda, formatFaixa } from "@/lib/format"
import type { FaseAPI, Moeda } from "@/types"
import { calcTotais } from "./calc"

// ── Resumo financeiro ─────────────────────────────────────────────────────────
export function ResumoFinanceiro({ fases }: { fases: FaseAPI[] }) {
    const totais = calcTotais(fases)
    if (totais.length === 0) return null

    return (
        <div className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
                Resumo financeiro
            </div>
            <div className="flex flex-col gap-4">
                {totais.map((t) => {
                    const pct = t.estimadoMax > 0 ? Math.round((t.gasto / t.estimadoMax) * 100) : 0
                    return (
                        <div key={t.moeda} className="flex flex-col gap-2">
                            <div className="flex items-baseline justify-between">
                                <span className="text-[11px] text-faint-foreground">{t.moeda}</span>
                                <span className="font-data text-sm text-foreground">
                  {formatMoeda(t.gasto, t.moeda as Moeda)}{" "}
                                    <span className="text-faint-foreground">
                    / {formatFaixa(t.estimadoMin, t.estimadoMax, t.moeda as Moeda)}
                  </span>
                </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-surface-2">
                                <div
                                    className="h-2 rounded-full bg-purple transition-all duration-500"
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-faint-foreground">
                                <span>Realizado</span>
                                <span>{pct}% do estimado</span>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
