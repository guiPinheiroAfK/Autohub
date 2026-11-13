import { useState } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { COR_CLASS } from "./constants"
import { getPessoais, savePessoais } from "./pessoais"
import type { EventoPessoal } from "./types"

export function ModalEventoPessoal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [titulo, setTitulo] = useState("")
  const [data, setData] = useState("")
  const [nota, setNota] = useState("")
  const [cor, setCor] = useState<EventoPessoal["cor"]>("purple")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim() || !data) return
    const pessoais = getPessoais()
    pessoais.push({ id: crypto.randomUUID(), titulo: titulo.trim(), data, nota: nota.trim() || undefined, cor })
    savePessoais(pessoais)
    onCreated()
    onClose()
  }

  const CORES: EventoPessoal["cor"][] = ["purple", "amber", "green", "red"]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-base font-semibold text-foreground">Lembrete pessoal</h2>
          <button onClick={onClose} className="text-faint-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Evento *</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Revisar freios antes do encontro"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Data *</label>
            <input
              type="date"
              value={data}
              onChange={e => setData(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:border-purple/50 focus:outline-none"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Nota</label>
            <input
              value={nota}
              onChange={e => setNota(e.target.value)}
              placeholder="Observações..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Cor</label>
            <div className="flex gap-2">
              {CORES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  className={cn(
                    "flex-1 rounded-lg border py-1.5 text-[11px] font-medium transition-colors capitalize",
                    COR_CLASS[c],
                    cor !== c && "opacity-40"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border py-2.5 text-[13px] text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
            <button type="submit" className="flex-1 rounded-lg bg-purple py-2.5 text-[13px] font-semibold text-white hover:opacity-90">
              Salvar
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
