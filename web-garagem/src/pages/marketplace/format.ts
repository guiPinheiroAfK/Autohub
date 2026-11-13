import type { Moeda } from "./types"

export function formatPreco(preco: number | undefined, moeda: Moeda) {
  if (!preco) return "A combinar"
  if (moeda === "BRL") return `R$ ${preco.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`
  if (moeda === "USD") return `US$ ${preco.toLocaleString("en-US", { minimumFractionDigits: 0 })}`
  if (moeda === "PYG") return `₲ ${preco.toLocaleString("es-PY", { minimumFractionDigits: 0 })}`
  return `${preco}`
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return "hoje"
  if (d === 1) return "ontem"
  if (d < 30) return `${d} dias atrás`
  return `${Math.floor(d / 30)} meses atrás`
}
