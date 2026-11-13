import { useState } from "react"
import { ChevronDown } from "lucide-react"
import type { StatusVeiculo } from "@/types"
import { STATUS_LABEL, STATUS_DOT } from "./constants"

const STATUS_OPCOES: StatusVeiculo[] = ["planejamento", "em_andamento", "concluido", "pausado"]

// ── Trocador de status do veículo ──────────────────────────────────────────────
// É o "destransformar de concluído" que a Kamilly pediu: dá pra voltar o
// veículo pra qualquer status a qualquer momento — junto com o "+ nova fase"
// embaixo, isso cobre o fluxo de reabrir um projeto "concluído".
export function StatusVeiculoMenu({
                               status,
                               saving,
                               onChange,
                           }: { status: StatusVeiculo; saving: boolean; onChange: (s: StatusVeiculo) => void }) {
    const [open, setOpen] = useState(false)

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:border-border-strong disabled:opacity-50"
            >
                <span className={`size-1.5 rounded-full ${STATUS_DOT[status]}`} />
                {STATUS_LABEL[status]}
                <ChevronDown className={cn_("size-3 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute left-0 top-full z-20 mt-1.5 flex w-44 flex-col gap-0.5 rounded-lg border border-border bg-surface p-1 shadow-lg">
                        {STATUS_OPCOES.map((s) => (
                            <button
                                key={s}
                                onClick={() => { onChange(s); setOpen(false) }}
                                className={cn_(
                                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-surface-2",
                                    s === status ? "text-foreground font-medium" : "text-muted-foreground"
                                )}
                            >
                                <span className={`size-1.5 rounded-full ${STATUS_DOT[s]}`} />
                                {STATUS_LABEL[s]}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

// pequeno helper local para não trazer a dependência inteira do cn de outro módulo
function cn_(...c: (string | false | undefined)[]) { return c.filter(Boolean).join(" ") }
