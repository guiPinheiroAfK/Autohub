import type { FaseAPI } from "@/types"

// Agrupa itens por moeda e calcula estimado + gasto
export function calcTotais(fases: FaseAPI[]) {
    const acc: Record<string, { moeda: string; estimadoMin: number; estimadoMax: number; gasto: number }> = {}
    for (const f of fases) {
        for (const i of f.itens ?? []) {
            const m = i.moeda
            if (!acc[m]) acc[m] = { moeda: m, estimadoMin: 0, estimadoMax: 0, gasto: 0 }
            acc[m].estimadoMin += Number(i.preco_min)
            acc[m].estimadoMax += Number(i.preco_max)
            if (i.status === "concluido") acc[m].gasto += Number(i.preco_max)
        }
    }
    return Object.values(acc)
}

export type TotalPorMoeda = ReturnType<typeof calcTotais>[number]
