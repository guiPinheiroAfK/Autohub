// AutoDash — traffic/intensidade.ts. Como o trânsito complica com os pontos
// (playtest 16/11: "mudar como o trânsito complica conforme sobem os pontos").
//
// Antes a única coisa que subia era a QUANTIDADE de carros (+3 por nível). Agora
// a intensidade (0..1, pelos pontos) muda o JEITO do trânsito, em estágios
// avisados na tela:
//   CALMO          poucos carros, quase só carro de passeio, pouca troca de faixa
//   MOVIMENTADO    caminhões e ônibus, motos costurando, "ondas" (pelotões de 2 a
//                  3 veículos lado a lado com uma faixa livre: bíblia de cenários 1.5)
//   PESADO         mais ondas, mais troca de faixa, freada brusca de vez em quando
//                  (com luz de freio: dá para ler)
//   CAÓTICO        tudo isso no máximo
// A quantidade sobe junto, mas com teto: ficar mais difícil é ficar mais VIVO,
// não virar parede.
import type { AutoDashEngine } from "../engine"
import type { TrafficKind } from "./types"

export const INTENSIDADE = {
  pontosMax: 90000,  // pontos para chegar ao máximo
  estagios: [
    { de: 0, nome: "CALMO", cor: "#4ade80" },
    { de: 0.2, nome: "MOVIMENTADO", cor: "#facc15" },
    { de: 0.5, nome: "PESADO", cor: "#fb923c" },
    { de: 0.8, nome: "CAÓTICO", cor: "#ef4444" },
  ],
  carros: [12, 30] as const,    // quantidade no mínimo e no máximo
  onda: [0.04, 0.32] as const,  // chance de nascer uma onda em vez de um veículo
  troca: [0.7, 2.6] as const,   // multiplicador da chance de troca de faixa
  freadaPorS: 0.05,             // freadas bruscas por segundo por carro, no máximo
}

/** Intensidade do trânsito agora (0..1). Corrida: fixa e baixa. */
export function intensidade(eng: AutoDashEngine): number {
  if (eng.mode === "race") return 0.15
  return Math.max(0, Math.min(1, eng.score / INTENSIDADE.pontosMax))
}

const lerp = (r: readonly [number, number], k: number) => r[0] + (r[1] - r[0]) * k

/** Quantos veículos manter na pista nesta intensidade. */
export function carrosAlvo(k: number): number { return Math.round(lerp(INTENSIDADE.carros, k)) }

/** Chance de a próxima vaga virar uma onda. */
export function chanceOnda(k: number): number { return lerp(INTENSIDADE.onda, k) }

/** Multiplicador da chance de troca de faixa dos civis. */
export function fatorTroca(k: number): number { return lerp(INTENSIDADE.troca, k) }

/** Sorteia o tipo do veículo pela intensidade (`u` em [0, 1)). */
export function tipoPorIntensidade(k: number, u: number): TrafficKind {
  // calmo: 78% carro, 4% moto, 10% caminhão, 8% ônibus → caótico: 46/20/22/12
  const carro = 0.78 - 0.32 * k, moto = 0.04 + 0.16 * k, caminhao = 0.1 + 0.12 * k
  if (u < carro) return "car"
  if (u < carro + moto) return "moto"
  if (u < carro + moto + caminhao) return "truck"
  return "bus"
}

/** Estágio (índice) desta intensidade. */
export function estagio(k: number): number {
  let e = 0
  INTENSIDADE.estagios.forEach((s, i) => { if (k >= s.de) e = i })
  return e
}
