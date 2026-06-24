import { api } from "@/lib/api/client"
import type { Moeda, PerfilVeiculo, StatusFase, StatusItem, StatusVeiculo, Visibilidade } from "@/types"

// Shapes exatamente como o api devolve (snake_case, vindo direto
// do postgres.js — NUMERIC chega como string, por isso os parsers abaixo).

interface VeiculoRow {
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
  total_fases: number
  total_itens: number
  itens_concluidos: number
}

interface ItemRow {
  id: string
  fase_id: string
  nome: string
  detalhe: string | null
  preco_min: string
  preco_max: string
  moeda: Moeda
  status: StatusItem
  fornecedor_id: string | null
  link_compra: string | null
  fornecedor_nome: string | null
  fornecedor_pais: string | null
}

interface FaseRow {
  id: string
  veiculo_id: string
  titulo: string
  ordem: number
  status: StatusFase
  orcamento_min: string
  orcamento_max: string
  moeda: Moeda
  nota: string | null
  total_itens: number
  itens_concluidos: number
  itens: ItemRow[]
}

interface VeiculoDetalheRow extends VeiculoRow {
  fases: FaseRow[]
}

// ── Tipos expostos pro front (camelCase, números reais) ─────────────────────

export interface VeiculoResumo {
  id: string
  apelido: string
  marca: string
  modelo: string
  anoModelo: number
  perfil: PerfilVeiculo
  status: StatusVeiculo
  metaPotenciaWhp: number | null
  totalFases: number
  totalItens: number
  itensConcluidos: number
  progresso: number // 0-100
}

export interface ItemDetalhe {
  id: string
  faseId: string
  nome: string
  detalhe: string | null
  precoMin: number
  precoMax: number
  moeda: Moeda
  status: StatusItem
  fornecedorNome: string | null
}

export interface FaseDetalhe {
  id: string
  titulo: string
  ordem: number
  status: StatusFase
  orcamentoMin: number
  orcamentoMax: number
  moeda: Moeda
  nota: string | null
  itens: ItemDetalhe[]
}

export interface VeiculoDetalheCompleto {
  id: string
  apelido: string
  marca: string
  modelo: string
  anoFabricacao: number
  anoModelo: number
  perfil: PerfilVeiculo
  status: StatusVeiculo
  metaPotenciaWhp: number | null
  fases: FaseDetalhe[]
}

export interface TotalMoeda {
  moeda: Moeda
  estimadoMin: number
  estimadoMax: number
  gasto: number
}

function progressoDe(total: number, concluidos: number): number {
  if (total === 0) return 0
  return Math.round((concluidos / total) * 100)
}

function mapVeiculoResumo(v: VeiculoRow): VeiculoResumo {
  return {
    id: v.id,
    apelido: v.apelido,
    marca: v.marca,
    modelo: v.modelo,
    anoModelo: v.ano_modelo,
    perfil: v.perfil,
    status: v.status,
    metaPotenciaWhp: v.meta_potencia_whp,
    totalFases: v.total_fases,
    totalItens: v.total_itens,
    itensConcluidos: v.itens_concluidos,
    progresso: progressoDe(v.total_itens, v.itens_concluidos),
  }
}

function mapItem(i: ItemRow): ItemDetalhe {
  return {
    id: i.id,
    faseId: i.fase_id,
    nome: i.nome,
    detalhe: i.detalhe,
    precoMin: Number(i.preco_min),
    precoMax: Number(i.preco_max),
    moeda: i.moeda,
    status: i.status,
    fornecedorNome: i.fornecedor_nome,
  }
}

function mapFase(f: FaseRow): FaseDetalhe {
  return {
    id: f.id,
    titulo: f.titulo,
    ordem: f.ordem,
    status: f.status,
    orcamentoMin: Number(f.orcamento_min),
    orcamentoMax: Number(f.orcamento_max),
    moeda: f.moeda,
    nota: f.nota,
    itens: f.itens.map(mapItem),
  }
}

function mapVeiculoDetalhe(v: VeiculoDetalheRow): VeiculoDetalheCompleto {
  return {
    id: v.id,
    apelido: v.apelido,
    marca: v.marca,
    modelo: v.modelo,
    anoFabricacao: v.ano_fabricacao,
    anoModelo: v.ano_modelo,
    perfil: v.perfil,
    status: v.status,
    metaPotenciaWhp: v.meta_potencia_whp,
    fases: v.fases.map(mapFase),
  }
}

export async function listarVeiculos(): Promise<VeiculoResumo[]> {
  const rows = await api.get<VeiculoRow[]>("/api/veiculos")
  return rows.map(mapVeiculoResumo)
}

export async function buscarVeiculo(id: string): Promise<VeiculoDetalheCompleto> {
  const row = await api.get<VeiculoDetalheRow>(`/api/veiculos/${id}`)
  return mapVeiculoDetalhe(row)
}

export interface NovoVeiculoInput {
  apelido: string
  marca: string
  modelo: string
  anoFabricacao: number
  anoModelo: number
  perfil: PerfilVeiculo
  metaPotenciaWhp?: number | null
}

export async function criarVeiculo(input: NovoVeiculoInput): Promise<{ id: string }> {
  const row = await api.post<VeiculoRow>("/api/veiculos", input)
  return { id: row.id }
}

/** Progresso geral do veículo (todos os itens de todas as fases). */
export function progressoVeiculo(v: VeiculoDetalheCompleto): number {
  const todos = v.fases.flatMap((f) => f.itens)
  return progressoDe(todos.length, todos.filter((i) => i.status === "concluido").length)
}

export function contagemItens(v: VeiculoDetalheCompleto): { total: number; concluidos: number } {
  const todos = v.fases.flatMap((f) => f.itens)
  return { total: todos.length, concluidos: todos.filter((i) => i.status === "concluido").length }
}

export function totaisPorMoeda(v: VeiculoDetalheCompleto): TotalMoeda[] {
  const todos = v.fases.flatMap((f) => f.itens)
  const mapa = new Map<Moeda, TotalMoeda>()

  for (const item of todos) {
    const atual = mapa.get(item.moeda) ?? { moeda: item.moeda, estimadoMin: 0, estimadoMax: 0, gasto: 0 }
    atual.estimadoMin += item.precoMin
    atual.estimadoMax += item.precoMax
    if (item.status === "concluido") atual.gasto += item.precoMax
    mapa.set(item.moeda, atual)
  }

  return [...mapa.values()]
}
