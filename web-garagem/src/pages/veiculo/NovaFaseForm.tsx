import { useState } from "react"
import type { Moeda } from "@/types"
import type { NovaFaseValue } from "./types"

// ── Form de nova fase ──────────────────────────────────────────────────────────
const NOVA_FASE_EMPTY: NovaFaseValue = { titulo: "", orcamentoMin: "", orcamentoMax: "", moeda: "BRL", nota: "" }
const MOEDAS: Moeda[] = ["BRL", "USD", "PYG"]

export function NovaFaseForm({
                          proximaOrdem,
                          saving,
                          onSave,
                          onCancel,
                      }: { proximaOrdem: number; saving: boolean; onSave: (v: NovaFaseValue) => void; onCancel: () => void }) {
    const [v, setV] = useState<NovaFaseValue>(NOVA_FASE_EMPTY)

    return (
        <div className="flex flex-col gap-2.5 rounded-xl border border-dashed border-border bg-surface p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
                <input
                    autoFocus
                    value={v.titulo}
                    onChange={(e) => setV({ ...v, titulo: e.target.value })}
                    placeholder={`Nome da fase ${proximaOrdem} — ex: "Troca de radiador"`}
                    className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
                />
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <input
                    type="number" min={0} step="0.01"
                    value={v.orcamentoMin}
                    onChange={(e) => setV({ ...v, orcamentoMin: e.target.value })}
                    placeholder="Orçamento mín."
                    className="w-28 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
                />
                <span className="text-faint-foreground">—</span>
                <input
                    type="number" min={0} step="0.01"
                    value={v.orcamentoMax}
                    onChange={(e) => setV({ ...v, orcamentoMax: e.target.value })}
                    placeholder="Orçamento máx."
                    className="w-28 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
                />
                <select
                    value={v.moeda}
                    onChange={(e) => setV({ ...v, moeda: e.target.value as Moeda })}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground focus:border-purple focus:outline-none"
                >
                    {MOEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <input
                    value={v.nota}
                    onChange={(e) => setV({ ...v, nota: e.target.value })}
                    placeholder="Nota/aviso — opcional"
                    className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
                />
            </div>
            <div className="flex items-center gap-2">
                <button
                    disabled={saving || v.titulo.trim().length === 0}
                    onClick={() => onSave(v)}
                    className="rounded-md bg-purple px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {saving ? "Salvando..." : "Criar fase"}
                </button>
                <button onClick={onCancel} className="rounded-md px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground">
                    Cancelar
                </button>
            </div>
        </div>
    )
}
