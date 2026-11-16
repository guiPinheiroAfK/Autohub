// AutoDash — physics/cambio.ts. Câmbio por carro: número de marchas e relações.
//
// 1ª e última são as mesmas para todo carro (mesma arrancada e mesma final);
// o que muda é o escalonamento entre elas. Câmbio de 4 marchas (muscle de 71)
// derruba ~40% do giro a cada troca; o de 9 (hiperesportivo) só ~15% e o motor
// fica cantando lá em cima. O carro com 6 marchas usa as relações de sempre.

import { GEAR_RATIOS, CARS, type CarSpec } from "../data"

const cache = new Map<number, number[]>()

/** Relações de um câmbio de n marchas, entre a 1ª e a última do padrão. */
export function relacoesDeN(n: number): number[] {
  if (n === GEAR_RATIOS.length) return GEAR_RATIOS
  let r = cache.get(n)
  if (!r) {
    const r1 = GEAR_RATIOS[0], rn = GEAR_RATIOS[GEAR_RATIOS.length - 1]
    // posição em escala log com expoente 0,85: degraus maiores embaixo e mais
    // fechados em cima, como as 6 marchas originais e câmbios de verdade
    r = Array.from({ length: n }, (_, i) => r1 * Math.pow(rn / r1, Math.pow(i / (n - 1), 0.85)))
    cache.set(n, r)
  }
  return r
}

export function relacoes(spec: CarSpec): number[] {
  return relacoesDeN(Math.max(3, Math.min(10, spec.marchas ?? GEAR_RATIOS.length)))
}

/** Número de marchas do carro atual. */
export function nMarchas(eng: { cfg: { carIdx: number } }): number {
  return relacoes(CARS[eng.cfg.carIdx]).length
}

/** Relação da marcha (1 = primeira) do carro atual. */
export function relacao(eng: { cfg: { carIdx: number } }, gear: number): number {
  const r = relacoes(CARS[eng.cfg.carIdx])
  return r[Math.max(0, Math.min(r.length, gear) - 1)]
}

/** Fator de força por marcha (marcha baixa multiplica torque). */
export function fatorMarcha(eng: { cfg: { carIdx: number } }, gear: number): number {
  return Math.pow(relacao(eng, gear) / relacao(eng, 1), 0.9)
}
