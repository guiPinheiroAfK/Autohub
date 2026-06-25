import { AlertTriangle } from "lucide-react"
import { formatFaixa } from "@/lib/format"
import type { Moeda } from "@/types"

interface OrcamentoAlertProps {
    tituloFase: string
    moeda: Moeda
    orcamentoMax: number   // limite atual da fase
    somaItensMax: number   // soma dos precoMax dos itens
    onAjustarAuto: () => void
    onAjustarManual: () => void
    onIgnorar: () => void
}

export function OrcamentoAlert({
                                   tituloFase,
                                   moeda,
                                   orcamentoMax,
                                   somaItensMax,
                                   onAjustarAuto,
                                   onAjustarManual,
                                   onIgnorar,
                               }: OrcamentoAlertProps) {
    return (
        // Overlay
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
            <div className="w-full max-w-[400px] rounded-2xl border border-border-strong bg-surface shadow-2xl">

                {/* Ícone + título */}
                <div className="flex items-start gap-3 px-5 pt-5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-bg">
                        <AlertTriangle className="size-4.5 text-amber" />
                    </div>
                    <div>
                        <p className="text-[13px] font-semibold text-foreground">
                            Orçamento da fase excedido
                        </p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                            {tituloFase}
                        </p>
                    </div>
                </div>

                {/* Valores */}
                <div className="mx-5 mt-4 rounded-xl border border-border bg-surface-2 p-3.5">
                    <div className="flex items-center justify-between text-[12px]">
                        <span className="text-muted-foreground">Orçamento máximo da fase</span>
                        <span className="font-data font-semibold text-foreground">
              {formatFaixa(0, orcamentoMax, moeda)}
            </span>
                    </div>
                    <div className="my-2.5 h-px bg-border" />
                    <div className="flex items-center justify-between text-[12px]">
                        <span className="text-muted-foreground">Soma dos itens</span>
                        <span className="font-data font-semibold text-red">
              {formatFaixa(0, somaItensMax, moeda)}
            </span>
                    </div>
                    <div className="my-2.5 h-px bg-border" />
                    <div className="flex items-center justify-between text-[12px]">
                        <span className="text-muted-foreground">Diferença</span>
                        <span className="font-data font-semibold text-amber">
              +{formatFaixa(0, somaItensMax - orcamentoMax, moeda)}
            </span>
                    </div>
                </div>

                <p className="px-5 pt-3 text-[12px] text-muted-foreground">
                    O valor máximo dos itens ultrapassa o orçamento definido para essa fase.
                    Como prefere resolver?
                </p>

                {/* Ações */}
                <div className="flex flex-col gap-2 p-5">
                    <button
                        onClick={onAjustarAuto}
                        className="w-full rounded-lg bg-purple py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                    >
                        Ajustar automaticamente
                    </button>
                    <button
                        onClick={onAjustarManual}
                        className="w-full rounded-lg border border-border py-2.5 text-[13px] text-foreground transition-colors hover:border-border-strong hover:bg-surface-2"
                    >
                        Alterar manualmente
                    </button>
                    <button
                        onClick={onIgnorar}
                        className="w-full py-2 text-[12px] text-faint-foreground transition-colors hover:text-muted-foreground"
                    >
                        Ignorar por agora
                    </button>
                </div>
            </div>
        </div>
    )
}
