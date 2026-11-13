export interface Anuncio {
  id: string
  titulo: string
  descricao?: string
  preco?: number
  moeda: "BRL" | "USD" | "PYG"
  categoria: string
  condicao: "novo" | "usado" | "recondicionado"
  localizacao?: string
  status: "ativo" | "pausado" | "vendido"
  criado_em: string
  garagem_id: string
  garagem_nome: string
  garagem_slug: string
  vendedor_nome: string
  total_interesses: number
  patrocinado?: boolean
  patrocinado_ate?: string
}

export interface Interessado {
  id: string
  mensagem?: string
  criado_em: string
  nome: string
  email: string
  garagem_slug?: string
  garagem_nome?: string
}

export type Moeda = "BRL" | "USD" | "PYG"
