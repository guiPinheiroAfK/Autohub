import { useState } from "react"
import { api } from "@/lib/api/client"
import type { StatusVeiculo, VeiculoDetalheAPI } from "@/types"
import type { VeiculoDataSetter } from "./types"

interface Params {
    id: string | undefined
    data: VeiculoDetalheAPI | null
    setData: VeiculoDataSetter
    carregar: () => Promise<void>
}

// Troca de status do veículo (otimista; recarrega em caso de erro)
export function useStatusVeiculo({ id, data, setData, carregar }: Params) {
    const [savingStatus, setSavingStatus] = useState(false)

    async function handleStatusChange(status: StatusVeiculo) {
        if (!id || !data) return
        setSavingStatus(true)
        setData({ ...data, status })
        try {
            await api.patch(`/api/veiculos/${id}`, { status })
        } catch (e) {
            alert(e instanceof Error ? e.message : "Erro ao atualizar status")
            carregar()
        } finally {
            setSavingStatus(false)
        }
    }

    return { savingStatus, handleStatusChange }
}
