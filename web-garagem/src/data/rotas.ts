export interface RotaStatic {
  id: string
  nome: string
  descricao: string
  ponto_a_nome: string
  ponto_b_nome: string
  distancia_km: number
  tempo_ideal_s: number
  regiao: string
}

export const ROTAS: RotaStatic[] = [
  {
    id: "foz-cataratas",
    nome: "Foz → Cataratas",
    descricao: "Trecho urbano até a entrada do Parque Nacional do Iguaçu — traffic light a traffic light.",
    ponto_a_nome: "Centro de Foz do Iguaçu",
    ponto_b_nome: "Parque Nacional do Iguaçu",
    distancia_km: 18,
    tempo_ideal_s: 1500,
    regiao: "Sul",
  },
  {
    id: "foz-puerto",
    nome: "Foz → Puerto Iguazú",
    descricao: "Travessia internacional pela Ponte Tancredo Neves até o centro argentino.",
    ponto_a_nome: "Ponte Tancredo Neves (BR)",
    ponto_b_nome: "Plaza San Martín, Puerto Iguazú",
    distancia_km: 12,
    tempo_ideal_s: 900,
    regiao: "Sul",
  },
  {
    id: "floripa-lagoa",
    nome: "Floripa → Lagoa da Conceição",
    descricao: "Clássico percurso da ilha pela SC-404, com curvas e visual para o mar.",
    ponto_a_nome: "Centro de Florianópolis",
    ponto_b_nome: "Lagoa da Conceição",
    distancia_km: 14,
    tempo_ideal_s: 1200,
    regiao: "Sul",
  },
  {
    id: "curitiba-graciosa",
    nome: "Curitiba → Serra da Graciosa",
    descricao: "Descida histórica da Serra do Mar pela Estrada da Graciosa — 36 curvas e mata atlântica.",
    ponto_a_nome: "Largo da Ordem, Curitiba",
    ponto_b_nome: "Morretes — Praça Rocha Pombo",
    distancia_km: 72,
    tempo_ideal_s: 5400,
    regiao: "Sul",
  },
  {
    id: "sp-interlagos",
    nome: "São Paulo → Interlagos",
    descricao: "Trajeto pela Marginal Pinheiros até a entrada do Autódromo José Carlos Pace.",
    ponto_a_nome: "Ibirapuera, São Paulo",
    ponto_b_nome: "Autódromo de Interlagos",
    distancia_km: 22,
    tempo_ideal_s: 1800,
    regiao: "Sudeste",
  },
  {
    id: "rj-petropolis",
    nome: "Rio → Petrópolis",
    descricao: "Subida da Serra Fluminense pela BR-040, com vistas do litoral e curvas clássicas.",
    ponto_a_nome: "Centro do Rio de Janeiro",
    ponto_b_nome: "Praça Dom Pedro II, Petrópolis",
    distancia_km: 68,
    tempo_ideal_s: 4500,
    regiao: "Sudeste",
  },
  {
    id: "bh-ouro-preto",
    nome: "BH → Ouro Preto",
    descricao: "Trecho mineiro pela BR-356 e MG-030 — estradas sinuosas cortando o Quadrilátero Ferrífero.",
    ponto_a_nome: "Praça da Liberdade, Belo Horizonte",
    ponto_b_nome: "Praça Tiradentes, Ouro Preto",
    distancia_km: 96,
    tempo_ideal_s: 6600,
    regiao: "Sudeste",
  },
  {
    id: "campo-grande-bonito",
    nome: "Campo Grande → Bonito",
    descricao: "Rota do ecoturismo no Mato Grosso do Sul — 300 km de planície e cerrado.",
    ponto_a_nome: "Campo Grande — Terminal Rodoviário",
    ponto_b_nome: "Bonito — Praça Central",
    distancia_km: 298,
    tempo_ideal_s: 14400,
    regiao: "Centro-Oeste",
  },
]
