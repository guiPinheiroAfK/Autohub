import { useState } from "react"
import { api } from "@/lib/api/client"
import { useSettings } from "@/context/SettingsContext"
import type { Fase, Moeda } from "@/types"
import type { AlertPendente, AnyItem, FaseLocalAPI } from "./types"
import { faseOrcMin, faseOrcMax, somaItensMax, somaItensMin } from "./helpers"

interface Params {
  fase: Fase | FaseLocalAPI
  onChanged?: () => void
}

// Orçamento da fase: alerta quando os itens passam do teto e edição manual da faixa
export function useOrcamentoFase({ fase, onChanged }: Params) {
  const { validarOrcamentoFase } = useSettings()

  const [alertPendente, setAlertPendente] = useState<AlertPendente | null>(null)
  const [editandoOrcFase, setEditandoOrcFase] = useState(false)
  const [orcMinEdit, setOrcMinEdit] = useState("")
  const [orcMaxEdit, setOrcMaxEdit] = useState("")
  const [savingOrc, setSavingOrc] = useState(false)

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

  return { alertPendente, setAlertPendente, editandoOrcFase, setEditandoOrcFase, orcMinEdit, setOrcMinEdit, orcMaxEdit, setOrcMaxEdit, savingOrc, orcMin, orcMax, checkOrcamento, handleAjustarOrcAuto, handleSalvarOrcManual }
}
