export interface Cotacao {
  par: string
  taxa_compra: number
  taxa_venda: number
  data: string
}

export interface Follow {
  id: string
  nome: string
  slug: string
  dono_nome: string
  garagem_nome?: string
  mutuo: boolean
  criado_em: string
}
