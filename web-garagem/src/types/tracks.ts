export interface Rota {
  id: string
  nome: string
  descricao: string | null
  ponto_a_nome: string
  ponto_a_lat: number
  ponto_a_lng: number
  ponto_b_nome: string
  ponto_b_lat: number
  ponto_b_lng: number
  distancia_km: number | null
  tempo_ideal_s: number | null
  regiao: string | null
  oficial: boolean
  criado_por: string | null
  criador_nome: string | null
  total_runs: number
}

export interface LeaderboardEntry {
  id: string
  duracao_s: number
  vel_media_kmh: number
  vel_max_kmh: number
  clima: string | null
  periodo_dia: string | null
  concluida_em: string
  diff_ideal_s: number
  usuario_nome: string
  veiculo_apelido: string
  veiculo_marca: string
  veiculo_modelo: string
  veiculo_perfil: string
}

export interface GhostPonto {
  offset_ms: number
  lat: number
  lng: number
  velocidade_kmh: number | null
}

export interface Ghost {
  id: string
  duracao_s: number
  vel_media_kmh: number
  usuario_nome: string
  veiculo_apelido: string
  veiculo_marca: string
  veiculo_modelo: string
  pontos: GhostPonto[]
}

export interface Run {
  id: string
  rota_id: string
  veiculo_id: string
  status: "em_andamento" | "concluida" | "cancelada"
  iniciada_em: string
  concluida_em: string | null
  duracao_s: number | null
}

export interface Badge {
  id: string
  nome: string
  descricao: string
  emoji: string
  ganho: boolean
  ganho_em: string | null
}
