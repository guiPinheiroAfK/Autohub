import { useState, useEffect, useRef } from "react"
import { X, Search, BookOpen } from "lucide-react"
import { SUGESTOES_PECAS, CATEGORIAS_PECAS, type CategoriaPeca } from "@/data/sugestoes-pecas"
import { cn } from "@/lib/utils"

interface Props {
  onSelect: (nome: string) => void
  onClose: () => void
}

export function CatalogoPecas({ onSelect, onClose }: Props) {
  const [busca, setBusca] = useState("")
  const [categoria, setCategoria] = useState<CategoriaPeca | "Todos">("Todos")
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    searchRef.current?.focus()
    // Fechar com Escape
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const buscaLower = busca.toLowerCase()

  const filtradas = SUGESTOES_PECAS.filter(p => {
    const matchCat = categoria === "Todos" || p.categoria === categoria
    const matchBusca =
      buscaLower.length === 0 ||
      p.nome.toLowerCase().includes(buscaLower) ||
      p.tags?.some(t => t.toLowerCase().includes(buscaLower))
    return matchCat && matchBusca
  })

  // Agrupadas por categoria (só quando não está buscando)
  const mostraPorCategoria = buscaLower.length === 0

  const categorias: CategoriaPeca[] = mostraPorCategoria && categoria === "Todos"
    ? [...CATEGORIAS_PECAS]
    : []

  function handleSelect(nome: string) {
    onSelect(nome)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative flex max-h-[85vh] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <BookOpen className="size-4 shrink-0 text-purple" />
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint-foreground" />
            <input
              ref={searchRef}
              value={busca}
              onChange={e => { setBusca(e.target.value); setCategoria("Todos") }}
              placeholder="Buscar peça — ex: turbo, Wiseco, pastilha..."
              className="w-full rounded-lg bg-surface py-1.5 pl-8 pr-3 text-[13px] text-foreground placeholder:text-faint-foreground focus:outline-none"
            />
          </div>
          <button
            onClick={onClose}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-faint-foreground hover:bg-surface hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* ── Categorias ──────────────────────────────────────────────────── */}
        <div className="flex gap-1.5 overflow-x-auto border-b border-border px-4 py-2.5 scrollbar-none">
          {(["Todos", ...CATEGORIAS_PECAS] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setCategoria(cat)}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                categoria === cat
                  ? "border-purple/40 bg-purple-bg text-purple"
                  : "border-border text-faint-foreground hover:border-border-strong hover:text-muted-foreground"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Resultados ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {filtradas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma peça encontrada para "{busca}"</p>
              <p className="text-[11px] text-faint-foreground">Digite o nome exato ou uma marca</p>
            </div>
          ) : mostraPorCategoria && categoria === "Todos" ? (
            // Agrupado por categoria
            categorias.map(cat => {
              const itens = filtradas.filter(p => p.categoria === cat)
              if (itens.length === 0) return null
              return (
                <div key={cat}>
                  <div className="sticky top-0 bg-surface-2/80 px-4 py-1.5 backdrop-blur-sm">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
                      {cat}
                    </span>
                  </div>
                  {itens.map(peca => (
                    <button
                      key={peca.nome}
                      onClick={() => handleSelect(peca.nome)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-surface"
                    >
                      <span className="text-[13px] text-foreground">{peca.nome}</span>
                    </button>
                  ))}
                </div>
              )
            })
          ) : (
            // Lista plana (busca ativa ou categoria específica)
            filtradas.map(peca => (
              <button
                key={peca.nome}
                onClick={() => handleSelect(peca.nome)}
                className="flex w-full items-center justify-between border-b border-border/40 px-4 py-2.5 text-left transition-colors last:border-0 hover:bg-surface"
              >
                <span className="text-[13px] text-foreground">{peca.nome}</span>
                <span className="ml-3 shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-faint-foreground">
                  {peca.categoria}
                </span>
              </button>
            ))
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="border-t border-border px-4 py-2">
          <p className="text-[10px] text-faint-foreground">
            {filtradas.length} {filtradas.length === 1 ? "peça" : "peças"} · Clique para usar no item
          </p>
        </div>
      </div>
    </div>
  )
}
