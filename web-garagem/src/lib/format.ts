import type { Moeda } from "@/types"

const LOCALE_POR_MOEDA: Record<Moeda, string> = {
  BRL: "pt-BR",
  USD: "en-US",
  PYG: "es-PY",
}

export function formatMoeda(valor: number, moeda: Moeda): string {
  return valor.toLocaleString(LOCALE_POR_MOEDA[moeda], {
    style: "currency",
    currency: moeda,
    maximumFractionDigits: moeda === "PYG" ? 0 : 0,
  })
}

export function formatFaixa(min: number, max: number, moeda: Moeda): string {
  if (min === max) return formatMoeda(min, moeda)
  return `${formatMoeda(min, moeda)} – ${formatMoeda(max, moeda)}`
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}
