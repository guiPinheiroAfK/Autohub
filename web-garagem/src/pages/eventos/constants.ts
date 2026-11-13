import { TIPO_LABEL, type TipoEvento } from "@/data/eventos"
import type { EventoPessoal } from "./types"

export const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]
export const MESES_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]

export const TIPO_EMOJI: Record<TipoEvento, string> = {
  racing:    "🏎️",
  show:      "✨",
  encontro:  "🤝",
  rally:     "🏔️",
  drift:     "💨",
  exposicao: "🏛️",
}
export const TIPOS: Array<TipoEvento | "todos"> = ["todos","racing","drift","rally","show","encontro","exposicao"]
export const TIPO_LABEL_ALL: Record<TipoEvento | "todos", string> = { todos: "Todos", ...TIPO_LABEL }

export const COR_CLASS: Record<EventoPessoal["cor"], string> = {
  purple: "border-purple/30 bg-purple-bg text-purple",
  amber:  "border-amber/30  bg-amber-bg  text-amber",
  green:  "border-green/30  bg-green-bg  text-green",
  red:    "border-red/30    bg-red-bg    text-red",
}
