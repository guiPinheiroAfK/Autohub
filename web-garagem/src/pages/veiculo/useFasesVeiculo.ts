import { useState } from "react"
import { api } from "@/lib/api/client"
import type { VeiculoDetalheAPI } from "@/types"
import type { NovaFaseValue } from "./types"

interface Params {
    id: string | undefined
    data: VeiculoDetalheAPI | null
    carregar: () => Promise<void>
}

// Criação de nova fase do build
export function useFasesVeiculo({ id, data, carregar }: Params) {
    const [addingFase, setAddingFase] = useState(false)
    const [savingFase, setSavingFase] = useState(false)

    async function handleCriarFase(v: NovaFaseValue) {
        if (!id) return
        setSavingFase(true)
        try {
            await api.post(`/api/veiculos/${id}/fases`, {
                titulo: v.titulo.trim(),
                ordem: (data?.fases.length ?? 0) + 1,
                orcamentoMin: v.orcamentoMin ? Number(v.orcamentoMin) : 0,
                orcamentoMax: v.orcamentoMax ? Number(v.orcamentoMax) : (v.orcamentoMin ? Number(v.orcamentoMin) : 0),
                moeda: v.moeda,
                nota: v.nota.trim() || null,
            })
            setAddingFase(false)
            await carregar()
        } catch (e) {
            alert(e instanceof Error ? e.message : "Erro ao criar fase")
        } finally {
            setSavingFase(false)
        }
    }

    return { addingFase, setAddingFase, savingFase, handleCriarFase }
}
