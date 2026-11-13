import type { Moeda } from "./types"

export const CATEGORIAS: Record<string, string> = {
  motor: "Motor",
  suspensao: "Suspensão",
  freios: "Freios",
  eletrica: "Elétrica",
  carroceria: "Carroceria",
  rodas: "Rodas",
  interior: "Interior",
  acessorios: "Acessórios",
  veiculo_completo: "Veículo Completo",
  outro: "Outro",
}

export const CONDICAO_LABEL: Record<string, string> = {
  novo: "Novo",
  usado: "Usado",
  recondicionado: "Recondicionado",
}

export const CONDICAO_COLOR: Record<string, string> = {
  novo: "text-green bg-green-bg",
  usado: "text-amber bg-amber-bg",
  recondicionado: "text-purple bg-purple-bg",
}

export const MOEDAS: Moeda[] = ["BRL", "USD", "PYG"]

export const CATEGORIAS_ARRAY = Object.entries(CATEGORIAS)

export const POR_PAGINA = 18
