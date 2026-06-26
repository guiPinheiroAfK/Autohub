// Schema de domínio do AutoHubGaragem.
// Hierarquia: Garagem → Veículo → Fase (do build) → Item (componente).
// Independente do FrotaOS — nenhum tipo, tabela ou backend é compartilhado.

export type Moeda = "BRL" | "USD" | "PYG"

export type PerfilVeiculo = "daily" | "street_build" | "restomod" | "track" | "project"

export type StatusVeiculo = "planejamento" | "em_andamento" | "concluido" | "pausado"

export type Visibilidade = "publico" | "privado"

export type StatusFase = "planejado" | "andamento" | "concluido"

export type StatusItem = "planejado" | "andamento" | "concluido"

export type TipoDocumento = "manual" | "recibo" | "nota_fiscal" | "crlv" | "outro"

/** Dono da garagem. Auth é o único ponto de contato com qualquer outro sistema. */
export interface Usuario {
  id: string
  nome: string
  email: string
  avatarUrl?: string
  criadoEm: string // ISO date
}

/**
 * Container de 1..N veículos de um usuário. Existe como entidade própria
 * (em vez de só usuarioId no Veiculo) porque a garagem pode ter uma página
 * pública própria (ex: autohub.app/g/gui) — é a unidade de "perfil/vitrine".
 */
export interface Garagem {
  id: string
  usuarioId: string
  nome: string
  slug: string // usado na URL pública
  bio?: string
  criadaEm: string
}

export interface Veiculo {
  id: string
  garagemId: string
  apelido: string // "RX-8 K24", "Civic do dia a dia"
  marca: string
  modelo: string
  anoFabricacao: number
  anoModelo: number
  perfil: PerfilVeiculo
  status: StatusVeiculo
  visibilidade: Visibilidade
  capaUrl?: string
  metaPotenciaWhp?: number // meta declarada, ex: 370 — opcional, só builds de performance
  criadoEm: string
}

/**
 * Uma etapa do build (ex: "Fase 1 — Mecânica e swap"). Equivalente direto
 * dos "phase cards" do HTML que você me mandou.
 */
export interface Fase {
  id: string
  veiculoId: string
  titulo: string
  ordem: number
  status: StatusFase
  orcamentoMin: number
  orcamentoMax: number
  moeda: Moeda
  nota?: string // ex: aviso "só depois de X meses"
  ilustracaoTipo?: string // reservado: diagramas custom só pra builds-vitrine (showcase)
}

/** Componente dentro de uma fase — peça ou serviço estimado. */
export interface Item {
  id: string
  faseId: string
  nome: string
  detalhe?: string
  precoMin: number
  precoMax: number
  moeda: Moeda
  status: StatusItem
  fornecedorId?: string
  linkCompra?: string
}

/**
 * Compra real registrada contra um item — separado da estimativa pra dar
 * TCO de verdade (estimado vs. gasto). Um item pode ter 0 despesas (ainda
 * não comprado) ou mais de 1 (peça + frete em lançamentos diferentes).
 */
export interface Despesa {
  id: string
  itemId: string
  valor: number
  moeda: Moeda
  data: string
  fornecedorId?: string
  documentoId?: string // nota fiscal/recibo anexado
}

export interface Fornecedor {
  id: string
  nome: string
  pais: string
  avaliacao?: number // 0-5
  linkRastreio?: string
  observacoes?: string
}

export interface Documento {
  id: string
  veiculoId: string
  tipo: TipoDocumento
  nomeArquivo: string
  url: string
  tamanhoBytes: number
  criadoEm: string
}

// ─── Tipos de resposta da API (snake_case vindo do Postgres) ─────────────────

/** Veículo com contadores agregados — resposta de GET /api/veiculos */
export interface VeiculoComMetricas {
  id: string
  garagem_id: string
  apelido: string
  marca: string
  modelo: string
  ano_fabricacao: number
  ano_modelo: number
  perfil: PerfilVeiculo
  status: StatusVeiculo
  visibilidade: Visibilidade
  capa_url: string | null
  meta_potencia_whp: number | null
  criado_em: string
  // agregados do GROUP BY
  total_fases: number
  total_itens: number
  itens_concluidos: number
}

/** Fase com itens embutidos — dentro de VeiculoDetalheAPI */
export interface FaseAPI {
  id: string
  veiculo_id: string
  titulo: string
  ordem: number
  status: StatusFase
  orcamento_min: number
  orcamento_max: number
  moeda: Moeda
  nota: string | null
  total_itens: number
  itens_concluidos: number
  gasto_realizado: number
  itens: ItemAPI[]
}

export interface ItemAPI {
  id: string
  fase_id: string
  nome: string
  detalhe: string | null
  preco_min: number
  preco_max: number
  moeda: Moeda
  status: StatusItem
  fornecedor_id: string | null
  link_compra: string | null
  fornecedor_nome: string | null
  fornecedor_pais: string | null
}

/** Resposta completa de GET /api/veiculos/:id */
export interface VeiculoDetalheAPI extends VeiculoComMetricas {
  fases: FaseAPI[]
  youtube_url?: string | null
}