import { useState, useRef } from "react"
import { BookOpen as BookOpenIcon } from "lucide-react"
import { SUGESTOES_PECAS } from "@/data/sugestoes-pecas"
import { CatalogoPecas } from "@/components/shared/CatalogoPecas"
import type { Moeda } from "@/types"
import type { ItemFormValue } from "./types"

const MOEDAS: Moeda[] = ["BRL", "USD", "PYG"]


export function ItemForm({ initial, saving, onSave, onCancel }: {
  initial: ItemFormValue; saving: boolean
  onSave: (v: ItemFormValue) => void; onCancel: () => void
}) {
  const [v, setV] = useState<ItemFormValue>(initial)
  const [sugestoes, setSugestoes] = useState<typeof SUGESTOES_PECAS>([])
  const [showSug, setShowSug] = useState(false)
  const [showCatalogo, setShowCatalogo] = useState(false)
  const nomeRef = useRef<HTMLInputElement>(null)

  function handleNomeChange(nome: string) {
    setV(prev => ({ ...prev, nome }))
    if (nome.length >= 2) {
      const q = nome.toLowerCase()
      const filtradas = SUGESTOES_PECAS
        .filter(s => s.nome.toLowerCase().includes(q))
        .slice(0, 7)
      setSugestoes(filtradas)
      setShowSug(filtradas.length > 0)
    } else {
      setShowSug(false)
    }
  }

  function handleSelectSugestao(nome: string) {
    setV(prev => ({ ...prev, nome }))
    setShowSug(false)
    nomeRef.current?.focus()
  }

  return (
      <>
        {showCatalogo && (
          <CatalogoPecas
            onSelect={nome => { setV(prev => ({ ...prev, nome })); nomeRef.current?.focus() }}
            onClose={() => setShowCatalogo(false)}
          />
        )}
      <div className="flex flex-col gap-2 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          {/* Campo nome com typeahead */}
          <div className="relative min-w-0 flex-1">
            <input
              ref={nomeRef}
              autoFocus
              value={v.nome}
              onChange={e => handleNomeChange(e.target.value)}
              onFocus={() => v.nome.length >= 2 && sugestoes.length > 0 && setShowSug(true)}
              onBlur={() => setTimeout(() => setShowSug(false), 120)}
              placeholder='Nome — ex: "Pistões Wiseco", "Downpipe 3"'
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
            />
            {showSug && (
              <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[240px] overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                {sugestoes.map((s) => (
                  <button
                    key={s.nome}
                    type="button"
                    onMouseDown={() => handleSelectSugestao(s.nome)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-surface-2"
                  >
                    <span className="text-[13px] text-foreground">{s.nome}</span>
                    <span className="ml-3 shrink-0 text-[10px] text-faint-foreground">{s.categoria}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <input value={v.detalhe}
                 onChange={e => setV({ ...v, detalhe: e.target.value })}
                 placeholder="Detalhe — opcional"
                 className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input type="number" min={0} step="0.01" value={v.precoMin}
                 onChange={e => setV({ ...v, precoMin: e.target.value })}
                 placeholder="Preço mín."
                 className="w-24 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
          />
          <span className="text-faint-foreground">—</span>
          <input type="number" min={0} step="0.01" value={v.precoMax}
                 onChange={e => setV({ ...v, precoMax: e.target.value })}
                 placeholder="Preço máx."
                 className="w-24 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
          />
          <select value={v.moeda} onChange={e => setV({ ...v, moeda: e.target.value as Moeda })}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground focus:border-purple focus:outline-none"
          >
            {MOEDAS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input value={v.linkCompra}
                 onChange={e => setV({ ...v, linkCompra: e.target.value })}
                 placeholder="Link de compra — opcional"
                 className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple focus:outline-none"
          />
        </div>
        {/* Catálogo de peças — botão prominente */}
        <button
          type="button"
          onClick={() => setShowCatalogo(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-purple/30 bg-purple-bg px-3 py-2 text-[12px] font-medium text-purple transition-colors hover:border-purple/60 hover:bg-purple/10"
        >
          <BookOpenIcon className="size-3.5 shrink-0" />
          Explorar catálogo de peças
          <span className="ml-auto text-[10px] font-normal text-purple/60">370+ itens</span>
        </button>

        <div className="flex items-center gap-2">
          <button disabled={saving || v.nome.trim().length === 0} onClick={() => onSave(v)}
                  className="rounded-md bg-purple px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button onClick={onCancel}
                  className="rounded-md px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => setShowCatalogo(true)}
            className="ml-auto flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-purple/40 hover:bg-purple-bg hover:text-purple"
          >
            <BookOpenIcon className="size-3.5" /> Catálogo de peças
          </button>
        </div>
      </div>
      </>
  )
}
