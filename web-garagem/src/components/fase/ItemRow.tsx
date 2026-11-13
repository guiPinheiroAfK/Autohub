import { MapPin, ExternalLink, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatFaixa } from "@/lib/format"
import type { AnyItem, AnyStatus, ItemFormValue } from "./types"
import { itemFornecedor, itemPais, itemLink, itemPrecoMin, itemPrecoMax } from "./helpers"
import { PAIS_FLAG, STATUS_DOT } from "./constants"
import { ItemCheckbox } from "./ItemCheckbox"
import { ItemForm } from "./ItemForm"

interface ItemRowProps {
  item: AnyItem
  index: number
  editing: boolean
  savingEdit: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: (v: ItemFormValue) => void
  onToggle: (id: string, next: AnyStatus) => void
  onDelete: (id: string) => void
}

export function ItemRow({ item, index, editing, savingEdit, onEdit, onCancelEdit, onSaveEdit, onToggle, onDelete }: ItemRowProps) {
                  const fornecedor = itemFornecedor(item)
                  const pais = itemPais(item)
                  const link = itemLink(item)
                  const itemStatus = item.status as AnyStatus
                  const done = itemStatus === "concluido"

                  if (editing) {
                    return (
                        <tr key={item.id} className="border-t border-border bg-surface-2/30">
                          <td colSpan={5}>
                            <ItemForm
                                initial={{
                                  nome: item.nome,
                                  detalhe: item.detalhe ?? "",
                                  precoMin: String(itemPrecoMin(item)),
                                  precoMax: String(itemPrecoMax(item)),
                                  moeda: item.moeda,
                                  linkCompra: link ?? "",
                                }}
                                saving={savingEdit}
                                onSave={onSaveEdit}
                                onCancel={onCancelEdit}
                            />
                          </td>
                        </tr>
                    )
                  }

                  return (
                      <tr
                          key={item.id}
                          className={cn(
                              "animate-page-in group border-t border-border transition-colors duration-100 hover:bg-surface-2/40",
                              done && "opacity-50"
                          )}
                          // 👇 O style precisa ficar aqui, DENTRO da abertura da tag <tr>
                          style={{ animationDelay: `${index * 40}ms` }}
                      >
                        {/* 👇 Repare que o > do <tr> ficou lá em cima. Agora as <td> começam aqui */}
                        <td className="px-4 py-3 align-middle">
                          <ItemCheckbox item={item} onToggle={onToggle} />
                        </td>
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
                        <td className="px-5 py-3 text-right align-top">
                        <span className="font-data text-[12px] text-muted-foreground">
                          {formatFaixa(itemPrecoMin(item), itemPrecoMax(item), item.moeda)}
                        </span>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            {link && (
                                <a href={link} target="_blank" rel="noopener noreferrer"
                                   onClick={e => e.stopPropagation()} title="Abrir link de compra"
                                   className="flex size-6 items-center justify-center rounded-md text-faint-foreground hover:text-foreground"
                                >
                                  <ExternalLink className="size-3" />
                                </a>
                            )}
                            <button onClick={onEdit} title="Editar item"
                                    className="flex size-6 items-center justify-center rounded-md text-faint-foreground hover:text-foreground"
                            >
                              <Pencil className="size-3" />
                            </button>
                            <button onClick={() => onDelete(item.id)} title="Excluir item"
                                    className="flex size-6 items-center justify-center rounded-md text-faint-foreground hover:text-red"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                  )
}
