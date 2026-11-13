import type { Dispatch, SetStateAction } from "react"
import type { Moeda, VeiculoDetalheAPI } from "@/types"

export type VeiculoDataSetter = Dispatch<SetStateAction<VeiculoDetalheAPI | null>>

// Valores do formulário de nova fase
export interface NovaFaseValue { titulo: string; orcamentoMin: string; orcamentoMax: string; moeda: Moeda; nota: string }

// Shape retornado por GET /api/colaboracoes/veiculo/:id
export interface Colaborador {
  id: string
  convidado_email: string
  papel: string
  status: "pendente" | "ativo" | "recusado" | "removido"
  nome: string | null        // preenchido quando aceito
  avatar_url: string | null
  criado_em: string
}
