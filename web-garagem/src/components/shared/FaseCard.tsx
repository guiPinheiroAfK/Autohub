import { useState } from "react"
import { ChevronDown, RotateCcw, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatFaixa } from "@/lib/format"
import { OrcamentoAlert } from "@/components/shared/OrcamentoAlert"
import type { Fase, Moeda } from "@/types"
import { AnimatedExpand } from "@/components/fase/AnimatedExpand"
import { ItemRow } from "@/components/fase/ItemRow"
import { ItemForm } from "@/components/fase/ItemForm"
import { ITEM_FORM_EMPTY } from "@/components/fase/constants"
import { STATUS_BADGE, STATUS_LABEL, PROGRESS_BAR } from "@/components/fase/constants"
import { faseNota, progressoItens } from "@/components/fase/helpers"
import type { FaseLocalAPI, AnyItem } from "@/components/fase/types"
import { useOrcamentoFase } from "@/components/fase/useOrcamentoFase"
import { useItensFase } from "@/components/fase/useItensFase"

// ── Props ─────────────────────────────────────────────────────────────────────

interface FaseCardProps {
  fase: Fase | FaseLocalAPI
  itens: AnyItem[]
  defaultOpen?: boolean
  onChanged?: () => void
}

// ── Componente principal ──────────────────────────────────────────────────────

export function FaseCard({ fase, itens: initialItens, defaultOpen = false, onChanged }: FaseCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  const {
    alertPendente, setAlertPendente, editandoOrcFase, setEditandoOrcFase,
    orcMinEdit, setOrcMinEdit, orcMaxEdit, setOrcMaxEdit, savingOrc, orcMin, orcMax,
    checkOrcamento, handleAjustarOrcAuto, handleSalvarOrcManual,
  } = useOrcamentoFase({ fase, onChanged })

  const {
    itens, faseStatus, addingItem, setAddingItem, savingNewItem, editingId, setEditingId,
    savingEdit, resetting, handleToggle, handleCreateItem, handleEditItem, handleDeleteItem, handleResetarFase,
  } = useItensFase({ fase, initialItens, onChanged, checkOrcamento })

  const concluidos = itens.filter(i => i.status === "concluido").length
  const nota = faseNota(fase)
  const progresso = faseStatus === "concluido" ? 100 : faseStatus === "planejado" ? 0 : progressoItens(itens)

  return (
      <>
        {/* ── Popup orçamento ────────────────────────────────────────────── */}
        {alertPendente && (
            <OrcamentoAlert
                tituloFase={fase.titulo}
                moeda={alertPendente.moeda}
                orcamentoMax={orcMax}
                somaItensMax={alertPendente.somaMax}
                onAjustarAuto={handleAjustarOrcAuto}
                onAjustarManual={alertPendente.onAjustarManual}
                onIgnorar={() => setAlertPendente(null)}
            />
        )}

        <div className={cn(
            "overflow-hidden rounded-xl border bg-surface transition-colors duration-150",
            open ? "border-border-strong" : "border-border hover:border-border-strong"
        )}>
          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="flex w-full items-center gap-3 px-5 py-4 text-left">
            <button onClick={() => setOpen(o => !o)} className="group flex flex-1 items-center gap-3 text-left">
            <span className={cn(
                "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider transition-colors",
                STATUS_BADGE[faseStatus]
            )}>
              {STATUS_LABEL[faseStatus]}
            </span>

              <span className="flex-1 text-[13px] font-semibold leading-tight text-foreground">
              {fase.titulo}
            </span>

              <span className="shrink-0 font-data text-[11px] text-faint-foreground">
              {concluidos}/{itens.length}
            </span>

              <span className={cn(
                  "shrink-0 whitespace-nowrap font-data text-[12px]",
                  savingOrc ? "text-faint-foreground animate-pulse" : "text-muted-foreground"
              )}>
              {formatFaixa(orcMin, orcMax, fase.moeda as Moeda)}
            </span>
            </button>

            <button
                onClick={handleResetarFase}
                disabled={resetting}
                title="Zerar fase"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-faint-foreground transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
            >
              <RotateCcw className={cn("size-3.5", resetting && "animate-spin")} />
            </button>

            <button onClick={() => setOpen(o => !o)}>
              <ChevronDown className={cn(
                  "size-4 shrink-0 text-faint-foreground transition-transform duration-200",
                  open && "rotate-180"
              )} />
            </button>
          </div>

          {/* ── Barra de progresso ─────────────────────────────────────────── */}
          <div className="h-[2px] bg-surface-2">
            <div
                className={cn("h-full transition-all duration-500", PROGRESS_BAR[faseStatus])}
                style={{ width: `${progresso}%` }}
            />
          </div>

          {/* ── Conteúdo expandido ──────────────────────────────────────────── */}
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
                  <th className="w-16 px-3 py-2.5" />
                </tr>
                </thead>
                <tbody>
                {itens.map((item, index) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    index={index}
                    editing={editingId === item.id}
                    savingEdit={savingEdit}
                    onEdit={() => setEditingId(item.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onSaveEdit={v => handleEditItem(item.id, v)}
                    onToggle={handleToggle}
                    onDelete={handleDeleteItem}
                  />
                ))}

                {addingItem && (
                    <tr className="border-t border-border bg-surface-2/30">
                      <td colSpan={5}>
                        <ItemForm initial={ITEM_FORM_EMPTY} saving={savingNewItem}
                                  onSave={handleCreateItem} onCancel={() => setAddingItem(false)}
                        />
                      </td>
                    </tr>
                )}
                </tbody>

                <tfoot>
                <tr className="border-t border-border bg-surface-2/40">
                  <td colSpan={2} className="px-3 py-2.5">
                    {!addingItem ? (
                        <button onClick={() => { setAddingItem(true); setOpen(true) }}
                                className="flex items-center gap-1 text-[11px] font-medium text-purple hover:underline"
                        >
                          <Plus className="size-3" /> Adicionar item
                        </button>
                    ) : (
                        <span className="text-[10px] uppercase tracking-wide text-faint-foreground">
                        {concluidos === itens.length && itens.length > 0
                            ? "✓ Todos os itens concluídos"
                            : `${itens.length - concluidos} restante${itens.length - concluidos !== 1 ? "s" : ""}`}
                      </span>
                    )}
                  </td>
                  <td className="hidden sm:table-cell" />

                  {/* Orçamento da fase — clicável pra editar manualmente */}
                  <td className="px-5 py-2.5 text-right" colSpan={2}>
                    {editandoOrcFase ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <input type="number" min={0} value={orcMinEdit}
                                 onChange={e => setOrcMinEdit(e.target.value)}
                                 placeholder="mín"
                                 className="w-20 rounded-md border border-border bg-background px-2 py-1 text-right text-[12px] text-foreground focus:border-purple focus:outline-none"
                          />
                          <span className="text-faint-foreground text-[11px]">—</span>
                          <input type="number" min={0} value={orcMaxEdit}
                                 onChange={e => setOrcMaxEdit(e.target.value)}
                                 placeholder="máx"
                                 className="w-20 rounded-md border border-border bg-background px-2 py-1 text-right text-[12px] text-foreground focus:border-purple focus:outline-none"
                          />
                          <button disabled={savingOrc} onClick={handleSalvarOrcManual}
                                  className="rounded-md bg-purple px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {savingOrc ? "..." : "OK"}
                          </button>
                          <button onClick={() => setEditandoOrcFase(false)}
                                  className="text-[11px] text-faint-foreground hover:text-foreground"
                          >
                            ✕
                          </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                              setEditandoOrcFase(true)
                              setOrcMinEdit(String(orcMin))
                              setOrcMaxEdit(String(orcMax))
                            }}
                            title="Editar orçamento da fase"
                            className="group/orc font-data text-[12px] font-semibold text-foreground hover:text-purple transition-colors"
                        >
                          {formatFaixa(orcMin, orcMax, fase.moeda as Moeda)}
                          <span className="ml-1 text-[10px] text-faint-foreground opacity-0 transition-opacity group-hover/orc:opacity-100">
                          editar
                        </span>
                        </button>
                    )}
                  </td>
                </tr>
                </tfoot>
              </table>
            </div>
          </AnimatedExpand>
        </div>
      </>
  )
}
