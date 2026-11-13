
export interface EventoDB {
  id: string
  titulo: string
  descricao?: string | null
  data_inicio: string
  data_fim?: string | null
  local?: string | null
  url?: string | null
  tipo: string
  patrocinado: boolean
  garagem_nome?: string | null
  garagem_slug?: string | null
  criado_por_nome?: string | null
}

// ── Personal event type ───────────────────────────────────────────────────────

export interface EventoPessoal {
  id: string
  titulo: string
  data: string
  nota?: string
  cor: "purple" | "amber" | "green" | "red"
}
