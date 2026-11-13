import { useEffect, useState } from "react"
import { api } from "@/lib/api/client"
import type { Fase, ItemAPI } from "@/types"
import type { AnyItem, AnyStatus, FaseLocalAPI, ItemFormValue } from "./types"

interface Params {
  fase: Fase | FaseLocalAPI
  initialItens: AnyItem[]
  onChanged?: () => void
  checkOrcamento: (itensAtual: AnyItem[]) => void
}

// Itens da fase: status, criação / edição / exclusão e reset da fase
export function useItensFase({ fase, initialItens, onChanged, checkOrcamento }: Params) {
  const [itens, setItens] = useState<AnyItem[]>(initialItens)
  const [faseStatus, setFaseStatus] = useState<AnyStatus>(fase.status as AnyStatus)
  const [addingItem, setAddingItem] = useState(false)
  const [savingNewItem, setSavingNewItem] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => { setItens(initialItens) }, [initialItens])
  useEffect(() => { setFaseStatus(fase.status as AnyStatus) }, [fase.status])

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

  return { itens, faseStatus, addingItem, setAddingItem, savingNewItem, editingId, setEditingId, savingEdit, resetting, handleToggle, handleCreateItem, handleEditItem, handleDeleteItem, handleResetarFase }
}
