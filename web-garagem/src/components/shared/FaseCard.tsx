import { useState, useEffect } from "react"
import { ChevronDown, ExternalLink, MapPin, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatFaixa } from "@/lib/format"
import { api } from "@/lib/api/client"
import type { Fase, Item, ItemAPI } from "@/types"

// ── Status ────────────────────────────────────────────────────────────────────

type AnyStatus = "planejado" | "andamento" | "concluido"

const STATUS_LABEL: Record<AnyStatus, string> = {
  planejado: "Planejado",
  andamento: "Em andamento",
  concluido: "Concluído",
}

const STATUS_BADGE: Record<AnyStatus, string> = {
  planejado: "text-faint-foreground border-border",
  andamento: "text-amber border-amber/30 bg-amber-bg",
  concluido: "text-green border-green/30 bg-green-bg",
}

const STATUS_DOT: Record<AnyStatus, string> = {
  planejado: "bg-faint-foreground/50",
  andamento: "bg-amber",
  concluido: "bg-green",
}

const PROGRESS_BAR: Record<AnyStatus, string> = {
  planejado: "bg-faint-foreground/20",
  andamento: "bg-amber",
  concluido: "bg-green",
}

// ── Helpers snake/camel ───────────────────────────────────────────────────────

type AnyItem = Item | ItemAPI

function isItemAPI(item: AnyItem): item is ItemAPI {
  return "preco_min" in item
}

function itemPrecoMin(item: AnyItem) { return isItemAPI(item) ? Number(item.preco_min) : item.precoMin }
function itemPrecoMax(item: AnyItem) { return isItemAPI(item) ? Number(item.preco_max) : item.precoMax }
function itemFornecedor(item: AnyItem): string | null { return isItemAPI(item) ? (item.fornecedor_nome ?? null) : null }
function itemPais(item: AnyItem): string | null { return isItemAPI(item) ? (item.fornecedor_pais ?? null) : null }
function itemLink(item: AnyItem): string | null { return isItemAPI(item) ? (item.link_compra ?? null) : ((item as Item).linkCompra ?? null) }

interface FaseLocalAPI {
  id: string; titulo: string; ordem: number; status: AnyStatus
  orcamento_min: number | string; orcamento_max: number | string
  moeda: "BRL" | "USD" | "PYG"; nota?: string | null
}

function faseOrcMin(fase: Fase | FaseLocalAPI): number {
  return "orcamento_min" in fase ? Number((fase as FaseLocalAPI).orcamento_min) : fase.orcamentoMin
}
function faseOrcMax(fase: Fase | FaseLocalAPI): number {
  return "orcamento_max" in fase ? Number((fase as FaseLocalAPI).orcamento_max) : fase.orcamentoMax
}
function faseNota(fase: Fase | FaseLocalAPI): string | null {
  return (fase as FaseLocalAPI).nota ?? null
}

function progressoItens(itens: AnyItem[]): number {
  if (itens.length === 0) return 0
  return Math.round((itens.filter(i => i.status === "concluido").length / itens.length) * 100)
}

const PAIS_FLAG: Record<string, string> = { BR: "🇧🇷", PY: "🇵🇾", US: "🇺🇸", DE: "🇩🇪", JP: "🇯🇵" }

// ── Animate height ────────────────────────────────────────────────────────────

function AnimatedExpand({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
      <div
          style={{
            display: "grid",
            gridTemplateRows: open ? "1fr" : "0fr",
            transition: "grid-template-rows 220ms cubic-bezier(0.4,0,0.2,1)"
          }}
      >
        <div style={{ overflow: "hidden" }}>
          {children}
        </div>
      </div>
  )
}

// ── Checkbox de item ──────────────────────────────────────────────────────────

function ItemCheckbox({
                        item,
                        onToggle,
                      }: {
  item: AnyItem
  onToggle: (id: string, next: AnyStatus) => void
}) {
  const [loading, setLoading] = useState(false)
  const done = item.status === "concluido"

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    const next: AnyStatus = done ? "planejado" : "concluido"
    try {
      await onToggle(item.id, next)
    } finally {
      setLoading(false)
    }
  }

  return (
      <button
          onClick={handleClick}
          disabled={loading}
          title={done ? "Marcar como pendente" : "Marcar como concluído"}
          className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-md border transition-all duration-150",
              done
                  ? "border-green bg-green text-white"
                  : "border-border bg-transparent text-transparent hover:border-green/60 hover:bg-green/10 hover:text-green/60",
              loading && "opacity-40 cursor-not-allowed"
          )}
      >
        <Check className="size-3 stroke-[2.5]" />
      </button>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface FaseCardProps {
  fase: Fase | FaseLocalAPI
  itens: AnyItem[]
  defaultOpen?: boolean
  onItemStatusChange?: (itemId: string, newStatus: AnyStatus) => void
}

// ── Componente principal ──────────────────────────────────────────────────────

export function FaseCard({ fase, itens: initialItens, defaultOpen = false, onItemStatusChange }: FaseCardProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [itens, setItens] = useState<AnyItem[]>(initialItens)

  // Sincroniza se o pai re-renderizar com novos itens
  useEffect(() => { setItens(initialItens) }, [initialItens])

  const status = fase.status as AnyStatus
  const concluidos = itens.filter(i => i.status === "concluido").length
  const nota = faseNota(fase)
  const progresso = status === "concluido" ? 100 : status === "planejado" ? 0 : progressoItens(itens)

  async function handleToggle(itemId: string, next: AnyStatus) {
    // Optimistic update
    setItens(prev => prev.map(i => i.id === itemId ? { ...i, status: next } : i))
    try {
      await api.patch(`/api/itens/${itemId}`, { status: next })
      onItemStatusChange?.(itemId, next)
    } catch {
      // Reverte se falhar
      setItens(prev => prev.map(i => i.id === itemId ? { ...i, status: i.status } : i))
    }
  }

  return (
      <div
          className={cn(
              "overflow-hidden rounded-xl border bg-surface transition-colors duration-150",
              open ? "border-border-strong" : "border-border hover:border-border-strong"
          )}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <button
            onClick={() => setOpen(o => !o)}
            className="group flex w-full items-center gap-3 px-5 py-4 text-left"
        >
        <span className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors",
            STATUS_BADGE[status]
        )}>
          {STATUS_LABEL[status]}
        </span>

          <span className="flex-1 text-[13px] font-semibold leading-tight text-foreground">
          {fase.titulo}
        </span>

          <span className="shrink-0 font-data text-[11px] text-faint-foreground">
          {concluidos}/{itens.length}
        </span>

          <span className="shrink-0 whitespace-nowrap font-data text-[12px] text-muted-foreground">
          {formatFaixa(faseOrcMin(fase), faseOrcMax(fase), fase.moeda)}
        </span>

          <ChevronDown className={cn(
              "size-4 shrink-0 text-faint-foreground transition-transform duration-200",
              open && "rotate-180"
          )} />
        </button>

        {/* ── Barra de progresso ─────────────────────────────────────────── */}
        <div className="h-[2px] bg-surface-2">
          <div
              className={cn("h-full transition-all duration-500", PROGRESS_BAR[status])}
              style={{ width: `${progresso}%` }}
          />
        </div>

        {/* ── Conteúdo com animação ──────────────────────────────────────── */}
        <AnimatedExpand open={open}>
          <div className="border-t border-border">
            {nota && (
                <div className="border-b border-amber/20 bg-amber-bg/30 px-5 py-2.5">
                  <p className="text-[12px] italic text-amber">⚠ {nota}</p>
                </div>
            )}

            <table className="w-full border-collapse">
              <thead>
              <tr className="bg-surface-2">
                <th className="w-8 px-4 py-2.5" />
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
                  Componente
                </th>
                <th className="hidden px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground sm:table-cell">
                  Fornecedor
                </th>
                <th className="px-5 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-faint-foreground">
                  Estimado
                </th>
                <th className="w-8 px-3 py-2.5" />
              </tr>
              </thead>
              <tbody>
              {itens.map((item) => {
                const fornecedor = itemFornecedor(item)
                const pais = itemPais(item)
                const link = itemLink(item)
                const itemStatus = item.status as AnyStatus
                const done = itemStatus === "concluido"

                return (
                    <tr
                        key={item.id}
                        className={cn(
                            "group border-t border-border transition-colors duration-100 hover:bg-surface-2/40",
                            done && "opacity-50"
                        )}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3 align-middle">
                        <ItemCheckbox item={item} onToggle={handleToggle} />
                      </td>

                      {/* Nome + detalhe */}
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-start gap-2">
                        <span className={cn(
                            "mt-[6px] size-1.5 shrink-0 rounded-full transition-colors",
                            STATUS_DOT[itemStatus]
                        )} />
                          <div>
                            <div className={cn(
                                "text-[13px] font-medium leading-snug transition-colors",
                                done ? "text-muted-foreground line-through decoration-faint-foreground" : "text-foreground"
                            )}>
                              {item.nome}
                            </div>
                            {item.detalhe && (
                                <div className="mt-0.5 text-[11px] text-muted-foreground">{item.detalhe}</div>
                            )}
                            {fornecedor && (
                                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-faint-foreground sm:hidden">
                                  {pais && PAIS_FLAG[pais] && <span>{PAIS_FLAG[pais]}</span>}
                                  <span>{fornecedor}</span>
                                </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Fornecedor desktop */}
                      <td className="hidden px-4 py-3 align-top sm:table-cell">
                        {fornecedor ? (
                            <div className="flex items-center gap-1.5">
                              {pais && PAIS_FLAG[pais] && <span className="text-[13px]">{PAIS_FLAG[pais]}</span>}
                              <span className="flex items-center gap-1 text-[11px] text-faint-foreground">
                            <MapPin className="size-2.5 shrink-0" />
                                {fornecedor}
                          </span>
                            </div>
                        ) : (
                            <span className="text-[11px] text-faint-foreground/30">—</span>
                        )}
                      </td>

                      {/* Preço */}
                      <td className="px-5 py-3 text-right align-top">
                      <span className="font-data text-[12px] text-muted-foreground">
                        {formatFaixa(itemPrecoMin(item), itemPrecoMax(item), item.moeda)}
                      </span>
                      </td>

                      {/* Link externo */}
                      <td className="px-3 py-3 align-top">
                        {link ? (
                            <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="flex size-6 items-center justify-center rounded-md text-faint-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                            >
                              <ExternalLink className="size-3" />
                            </a>
                        ) : <div className="size-6" />}
                      </td>
                    </tr>
                )
              })}
              </tbody>

              <tfoot>
              <tr className="border-t border-border bg-surface-2/40">
                <td />
                <td colSpan={2} className="px-3 py-2.5 text-[10px] uppercase tracking-wide text-faint-foreground">
                  {concluidos === itens.length && itens.length > 0
                      ? "✓ Todos os itens concluídos"
                      : `${itens.length - concluidos} restante${itens.length - concluidos !== 1 ? "s" : ""}`}
                </td>
                <td className="px-5 py-2.5 text-right">
                  <span className="font-data text-[12px] font-semibold text-foreground">
                    {formatFaixa(faseOrcMin(fase), faseOrcMax(fase), fase.moeda)}
                  </span>
                </td>
                <td />
              </tr>
              </tfoot>
            </table>
          </div>
        </AnimatedExpand>
      </div>
  )
}
