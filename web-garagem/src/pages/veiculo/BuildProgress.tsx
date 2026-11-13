import type { FaseAPI } from "@/types"

// ── Barra de progresso de build ───────────────────────────────────────────────
export function BuildProgress({ fases }: { fases: FaseAPI[] }) {
    if (fases.length === 0) return null
    return (
        <div className="rounded-xl border border-border bg-surface p-5">
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
                Progresso por fase
            </div>
            <div className="flex flex-col gap-2.5">
                {fases.map((f) => {
                    const total = f.itens?.length ?? 0
                    const done = f.itens?.filter(i => i.status === "concluido").length ?? 0
                    const pct = f.status === "concluido" ? 100 : f.status === "planejado" ? 0 : total > 0 ? Math.round((done / total) * 100) : 0

                    return (
                        <div key={f.id} className="flex items-center gap-3">
                            <div className="w-[120px] shrink-0 truncate text-[11px] text-muted-foreground sm:w-[160px]">
                                {f.titulo}
                            </div>
                            <div className="flex-1 h-1.5 rounded-full bg-surface-2">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                        f.status === "concluido" ? "bg-green" :
                                            f.status === "andamento" ? "bg-amber" : "bg-faint-foreground/30"
                                    }`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <span className="w-8 shrink-0 text-right font-data text-[11px] text-faint-foreground">
                {pct}%
              </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
