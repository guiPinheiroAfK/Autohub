import { formatMoeda } from "@/lib/format"
import type { Moeda, VeiculoDetalheAPI } from "@/types"
import type { TotalPorMoeda } from "./calc"

// ── Metric card ───────────────────────────────────────────────────────────────
function Stat({
                  label, value, sub, accent
              }: { label: string; value: string; sub?: string; accent?: string }) {
    return (
        <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface px-4 py-3.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
                {label}
            </div>
            <div className={`font-display text-[22px] font-semibold leading-none ${accent ?? "text-foreground"}`}>
                {value}
            </div>
            {sub && <div className="text-[11px] text-faint-foreground">{sub}</div>}
        </div>
    )
}

interface StatsVeiculoProps {
    progresso: number
    concluidosItens: number
    totalItens: number
    principal: TotalPorMoeda | undefined
    fasesConcluidas: number
    fasesAndamento: number
    totalFases: number
    metaWhp: VeiculoDetalheAPI["meta_potencia_whp"]
}

// Bloco de stats reutilizado tanto no mobile quanto no sidebar desktop
export function StatsVeiculo({
    progresso, concluidosItens, totalItens, principal, fasesConcluidas, fasesAndamento, totalFases, metaWhp,
}: StatsVeiculoProps) {
    return (
        <>
            <Stat
                label="Progresso"
                value={`${progresso}%`}
                sub={`${concluidosItens} de ${totalItens} itens`}
                accent="text-green"
            />
            <Stat
                label="Investido"
                value={principal ? formatMoeda(principal.gasto, principal.moeda as Moeda) : "R$ 0"}
                sub={principal ? `de ${formatMoeda(principal.estimadoMax, principal.moeda as Moeda)}` : "sem itens"}
                accent="text-purple"
            />
            <Stat
                label="Fases"
                value={`${fasesConcluidas}/${totalFases}`}
                sub={fasesAndamento > 0 ? `${fasesAndamento} em andamento` : "concluídas"}
                accent="text-amber"
            />
            <Stat
                label="Meta"
                value={metaWhp ? `${metaWhp} whp` : "—"}
                sub="potência alvo"
            />
        </>
    )
}
