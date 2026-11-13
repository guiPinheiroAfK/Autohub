import type { AnyStatus, ItemFormValue } from "./types"

export const STATUS_LABEL: Record<AnyStatus, string> = {
  planejado: "Planejado",
  andamento: "Em andamento",
  concluido: "Concluído",
}

export const STATUS_BADGE: Record<AnyStatus, string> = {
  planejado: "text-faint-foreground border-border",
  andamento: "text-amber border-amber/30 bg-amber-bg",
  concluido: "text-green border-green/30 bg-green-bg",
}

export const STATUS_DOT: Record<AnyStatus, string> = {
  planejado: "bg-faint-foreground/50",
  andamento: "bg-amber",
  concluido: "bg-green",
}

export const PROGRESS_BAR: Record<AnyStatus, string> = {
  planejado: "bg-faint-foreground/20",
  andamento: "bg-amber",
  concluido: "bg-green",
}

export const PAIS_FLAG: Record<string, string> = { BR: "🇧🇷", PY: "🇵🇾", US: "🇺🇸", DE: "🇩🇪", JP: "🇯🇵" }

export const ITEM_FORM_EMPTY: ItemFormValue = { nome: "", detalhe: "", precoMin: "", precoMax: "", moeda: "BRL", linkCompra: "" }
