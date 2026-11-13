import type { Item, ItemAPI, Moeda } from "@/types"

export type AnyStatus = "planejado" | "andamento" | "concluido"

export type AnyItem = Item | ItemAPI

export interface FaseLocalAPI {
  id: string; titulo: string; ordem: number; status: AnyStatus
  orcamento_min: number | string; orcamento_max: number | string
  moeda: "BRL" | "USD" | "PYG"; nota?: string | null
}

export interface ItemFormValue {
  nome: string; detalhe: string; precoMin: string; precoMax: string
  moeda: Moeda; linkCompra: string
}

export interface AlertPendente {
  somaMin: number
  somaMax: number
  moeda: Moeda
  onAjustarManual: () => void  // abre a edição de faixa no footer
}
