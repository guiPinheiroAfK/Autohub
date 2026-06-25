import { useState, useEffect, useRef } from "react"
import { ChevronDown, ExternalLink, MapPin, Check, Pencil, Trash2, Plus, RotateCcw, BookOpen as BookOpenIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatFaixa } from "@/lib/format"
import { api } from "@/lib/api/client"
import { useSettings } from "@/context/SettingsContext"
import { OrcamentoAlert } from "@/components/shared/OrcamentoAlert"
import { SUGESTOES_PECAS } from "@/data/sugestoes-pecas"
import { CatalogoPecas } from "@/components/shared/CatalogoPecas"
import type { Fase, Item, ItemAPI, Moeda } from "@/types"

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

const MOEDAS: Moeda[] = ["BRL", "USD", "PYG"]

// ── Helpers snake/camel ───────────────────────────────────────────────────────

type AnyItem = Item | ItemAPI

function isItemAPI(item: AnyItem): item is ItemAPI {
  return "preco_min" in item
}

function itemPrecoMin(item: AnyItem) { return isItemAPI(item) ? Number(item.preco_min) : item.precoMin }
function itemPrecoMax(item: AnyItem) { return isItemAPI(item) ? Number(item.preco_max) : item.precoMax }
function itemFornecedor(item: AnyItem): string | null { return isItemAPI(item) ? (item.fornecedor_nome ?? null) : null }
function itemPais(item: AnyItem): string | null { return isItemAPI(item) ? (item.fornecedor_pais ?? null) : null }
function itemLink(item: AnyItem): string | null {
  return isItemAPI(item) ? (item.link_compra ?? null) : ((item as Item).linkCompra ?? null)
}

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

/** Soma precoMax de todos os itens da mesma moeda da fase */
function somaItensMax(itens: AnyItem[], moeda: Moeda): number {
  return itens
      .filter(i => i.moeda === moeda)
      .reduce((sum, i) => sum + itemPrecoMax(i), 0)
}
function somaItensMin(itens: AnyItem[], moeda: Moeda): number {
  return itens
      .filter(i => i.moeda === moeda)
      .reduce((sum, i) => sum + itemPrecoMin(i), 0)
}

const PAIS_FLAG: Record<string, string> = { BR: "🇧🇷", PY: "🇵🇾", US: "🇺🇸", DE: "🇩🇪", JP: "🇯🇵" }

// ── Animate height ────────────────────────────────────────────────────────────

function AnimatedExpand({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
      <div style={{
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        transition: "grid-template-rows 220ms cubic-bezier(0.4,0,0.2,1)"
      }}>
        <div style={{ overflow: "hidden" }}>{children}</div>
      </div>
  )
}

// ── Checkbox ──────────────────────────────────────────────────────────────────

function ItemCheckbox({ item, onToggle }: { item: AnyItem; onToggle: (id: string, next: AnyStatus) => void }) {
  const [loading, setLoading] = useState(false)
  const done = item.status === "concluido"

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    const next: AnyStatus = done ? "planejado" : "concluido"
    try { await onToggle(item.id, next) }
    finally { setLoading(false) }
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

// ── ItemForm ──────────────────────────────────────────────────────────────────

interface ItemFormValue {
  nome: string; detalhe: string; precoMin: string; precoMax: string
  moeda: Moeda; linkCompra: string
}

const ITEM_FORM_EMPTY: ItemFormValue = { nome: "", detalhe: "", precoMin: "", precoMax: "", moeda: "BRL", linkCompra: "" }

function ItemForm({ initial, saving, onSave, onCancel }: {
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
            className="ml-auto flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] text-faint-foreground hover:bg-surface hover:text-purple"
          >
            <BookOpenIcon className="size-3" /> Catálogo
          </button>
        </div>
      </div>
      </>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface FaseCardProps {
  fase: Fase | FaseLocalAPI
  itens: AnyItem[]
  defaultOpen?: boolean
  onChanged?: () => void
}

// ── Componente principal ──────────────────────────────────────────────────────

export function FaseCard({ fase, itens: initialItens, defaultOpen = false, onChanged }: FaseCardProps) {
  const { validarOrcamentoFase } = useSettings()

  const [open, setOpen] = useState(defaultOpen)
  const [itens, setItens] = useState<AnyItem[]>(initialItens)
  const [faseStatus, setFaseStatus] = useState<AnyStatus>(fase.status as AnyStatus)
  const [addingItem, setAddingItem] = useState(false)
  const [savingNewItem, setSavingNewItem] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [resetting, setResetting] = useState(false)

  // ── Estado do popup de orçamento ──────────────────────────────────────────
  interface AlertPendente {
    somaMin: number
    somaMax: number
    moeda: Moeda
    onAjustarManual: () => void  // abre a edição de faixa no footer
  }
  const [alertPendente, setAlertPendente] = useState<AlertPendente | null>(null)
  const [editandoOrcFase, setEditandoOrcFase] = useState(false)
  const [orcMinEdit, setOrcMinEdit] = useState("")
  const [orcMaxEdit, setOrcMaxEdit] = useState("")
  const [savingOrc, setSavingOrc] = useState(false)

  useEffect(() => { setItens(initialItens) }, [initialItens])
  useEffect(() => { setFaseStatus(fase.status as AnyStatus) }, [fase.status])

  const concluidos = itens.filter(i => i.status === "concluido").length
  const nota = faseNota(fase)
  const progresso = faseStatus === "concluido" ? 100 : faseStatus === "planejado" ? 0 : progressoItens(itens)

  const orcMax = faseOrcMax(fase)
  const orcMin = faseOrcMin(fase)

  // Verifica se os itens ultrapassam o orçamento da fase (só moeda principal)
  function checkOrcamento(itensAtual: AnyItem[]) {
    if (!validarOrcamentoFase) return
    const moeda = fase.moeda as Moeda
    const soma = somaItensMax(itensAtual, moeda)
    const somaMin = somaItensMin(itensAtual, moeda)
    if (soma > orcMax) {
      setAlertPendente({
        somaMax: soma,
        somaMin,
        moeda,
        onAjustarManual: () => {
          setAlertPendente(null)
          setEditandoOrcFase(true)
          setOrcMinEdit(String(somaMin))
          setOrcMaxEdit(String(soma))
        },
      })
    }
  }

  async function handleAjustarOrcAuto() {
    if (!alertPendente) return
    const novoMin = alertPendente.somaMin
    const novoMax = alertPendente.somaMax
    setAlertPendente(null)
    setSavingOrc(true)
    try {
      await api.patch(`/api/fases/${fase.id}`, {
        orcamentoMin: novoMin,
        orcamentoMax: novoMax,
      })
      // Atualiza localmente sem refetch completo
      ;(fase as FaseLocalAPI).orcamento_min = novoMin
      ;(fase as FaseLocalAPI).orcamento_max = novoMax
      onChanged?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao ajustar orçamento")
    } finally {
      setSavingOrc(false)
    }
  }

  async function handleSalvarOrcManual() {
    setSavingOrc(true)
    try {
      await api.patch(`/api/fases/${fase.id}`, {
        orcamentoMin: Number(orcMinEdit) || 0,
        orcamentoMax: Number(orcMaxEdit) || 0,
      })
      ;(fase as FaseLocalAPI).orcamento_min = Number(orcMinEdit) || 0
      ;(fase as FaseLocalAPI).orcamento_max = Number(orcMaxEdit) || 0
      setEditandoOrcFase(false)
      onChanged?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao salvar orçamento")
    } finally {
      setSavingOrc(false)
    }
  }

  async function handleToggle(itemId: string, next: AnyStatus) {
    setItens(prev => prev.map(i => i.id === itemId ? { ...i, status: next } : i))
    try {
      const res = await api.patch<{ faseStatus: AnyStatus }>(`/api/itens/${itemId}`, { status: next })
      setFaseStatus(res.faseStatus)
      onChanged?.()
    } catch {
      setItens(prev => prev.map(i =>
          i.id === itemId
              ? { ...i, status: i.status === next ? (next === "concluido" ? "planejado" : "concluido") : i.status }
              : i
      ))
    }
  }

  async function handleCreateItem(v: ItemFormValue) {
    setSavingNewItem(true)
    try {
      const res = await api.post<ItemAPI & { faseStatus: AnyStatus }>("/api/itens", {
        faseId: fase.id,
        nome: v.nome.trim(),
        detalhe: v.detalhe.trim() || null,
        precoMin: v.precoMin ? Number(v.precoMin) : 0,
        precoMax: v.precoMax ? Number(v.precoMax) : (v.precoMin ? Number(v.precoMin) : 0),
        moeda: v.moeda,
        linkCompra: v.linkCompra.trim() || null,
      })
      const novosItens = [...itens, res]
      setItens(novosItens)
      setFaseStatus(res.faseStatus)
      setAddingItem(false)
      onChanged?.()
      checkOrcamento(novosItens)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao criar item")
    } finally {
      setSavingNewItem(false)
    }
  }

  async function handleEditItem(itemId: string, v: ItemFormValue) {
    setSavingEdit(true)
    try {
      const res = await api.patch<ItemAPI & { faseStatus: AnyStatus }>(`/api/itens/${itemId}`, {
        nome: v.nome.trim(),
        detalhe: v.detalhe.trim() || null,
        preco_min: v.precoMin ? Number(v.precoMin) : 0,
        preco_max: v.precoMax ? Number(v.precoMax) : (v.precoMin ? Number(v.precoMin) : 0),
        moeda: v.moeda,
        link_compra: v.linkCompra.trim() || null,
      })
      const novosItens = itens.map(i => i.id === itemId ? { ...i, ...res } : i)
      setItens(novosItens)
      setFaseStatus(res.faseStatus)
      setEditingId(null)
      onChanged?.()
      checkOrcamento(novosItens)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao salvar item")
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm("Excluir esse item? Não tem como desfazer.")) return
    try {
      const res = await api.delete<{ faseStatus: AnyStatus }>(`/api/itens/${itemId}`)
      setItens(prev => prev.filter(i => i.id !== itemId))
      setFaseStatus(res.faseStatus)
      onChanged?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao excluir item")
    }
  }

  async function handleResetarFase(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm(`Zerar "${fase.titulo}"? Volta a fase e todos os itens pra "planejado".`)) return
    setResetting(true)
    try {
      await api.post(`/api/fases/${fase.id}/resetar`, {})
      setItens(prev => prev.map(i => ({ ...i, status: "planejado" as AnyStatus })))
      setFaseStatus("planejado")
      onChanged?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao zerar fase")
    } finally {
      setResetting(false)
    }
  }

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
                {itens.map((item, index) => {
                  const fornecedor = itemFornecedor(item)
                  const pais = itemPais(item)
                  const link = itemLink(item)
                  const itemStatus = item.status as AnyStatus
                  const done = itemStatus === "concluido"
                  const isEditing = editingId === item.id

                  if (isEditing) {
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
                                onSave={v => handleEditItem(item.id, v)}
                                onCancel={() => setEditingId(null)}
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
                          <ItemCheckbox item={item} onToggle={handleToggle} />
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
                            <button onClick={() => setEditingId(item.id)} title="Editar item"
                                    className="flex size-6 items-center justify-center rounded-md text-faint-foreground hover:text-foreground"
                            >
                              <Pencil className="size-3" />
                            </button>
                            <button onClick={() => handleDeleteItem(item.id)} title="Excluir item"
                                    className="flex size-6 items-center justify-center rounded-md text-faint-foreground hover:text-red"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                  )
                })}

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
