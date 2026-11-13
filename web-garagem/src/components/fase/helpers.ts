import type { Fase, Item, ItemAPI, Moeda } from "@/types"
import type { AnyItem, FaseLocalAPI } from "./types"

function isItemAPI(item: AnyItem): item is ItemAPI {
  return "preco_min" in item
}

export function itemPrecoMin(item: AnyItem) { return isItemAPI(item) ? Number(item.preco_min) : item.precoMin }
export function itemPrecoMax(item: AnyItem) { return isItemAPI(item) ? Number(item.preco_max) : item.precoMax }
export function itemFornecedor(item: AnyItem): string | null { return isItemAPI(item) ? (item.fornecedor_nome ?? null) : null }
export function itemPais(item: AnyItem): string | null { return isItemAPI(item) ? (item.fornecedor_pais ?? null) : null }
export function itemLink(item: AnyItem): string | null {
  return isItemAPI(item) ? (item.link_compra ?? null) : ((item as Item).linkCompra ?? null)
}


export function faseOrcMin(fase: Fase | FaseLocalAPI): number {
  return "orcamento_min" in fase ? Number((fase as FaseLocalAPI).orcamento_min) : fase.orcamentoMin
}
export function faseOrcMax(fase: Fase | FaseLocalAPI): number {
  return "orcamento_max" in fase ? Number((fase as FaseLocalAPI).orcamento_max) : fase.orcamentoMax
}
export function faseNota(fase: Fase | FaseLocalAPI): string | null {
  return (fase as FaseLocalAPI).nota ?? null
}

export function progressoItens(itens: AnyItem[]): number {
  if (itens.length === 0) return 0
  return Math.round((itens.filter(i => i.status === "concluido").length / itens.length) * 100)
}

/** Soma precoMax de todos os itens da mesma moeda da fase */
export function somaItensMax(itens: AnyItem[], moeda: Moeda): number {
  return itens
      .filter(i => i.moeda === moeda)
      .reduce((sum, i) => sum + itemPrecoMax(i), 0)
}
export function somaItensMin(itens: AnyItem[], moeda: Moeda): number {
  return itens
      .filter(i => i.moeda === moeda)
      .reduce((sum, i) => sum + itemPrecoMin(i), 0)
}
