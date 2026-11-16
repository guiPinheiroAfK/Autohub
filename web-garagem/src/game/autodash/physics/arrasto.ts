// AutoDash — physics/arrasto.ts. Arrasto e teto de velocidade (P5 de
// docs/pesquisa/fisica-carro.md). Funções puras.
//
// O arrasto do jogo é linear (rolamento + termo linear) e fica assim: trocar
// por v² no geral muda o 0–200 de todo carro. O que muda é o TETO: em vez de
// uma parede no topSpeed (o velocímetro travava exato em 244), a sobra de força
// some suave nos últimos 4% e o ponteiro "rasteja" até a máxima. Acima do topo
// (nitro, descida) entra um arrasto quadrático no excesso.
import { clamp } from "../math"

export const TETO_SUAVE_FRAC = 0.04 // faixa final do topo em que a sobra de força some
export const K_EXC = 0.05           // km/h/s por (km/h acima do topo)²

/** Arrasto de sempre (km/h/s): rolamento constante mais termo linear. */
export function arrasto(v: number): number {
  return 5 + v * 0.028
}

/**
 * Força do motor perto do topo (km/h/s). Abaixo de 96% do topo não muda nada;
 * daí até o topo a sobra além do arrasto cai com a raiz da distância; no topo
 * e acima o motor só empata com o arrasto.
 */
export function tetoSuave(a: number, v: number, top: number): number {
  const d = arrasto(v)
  if (a <= d) return a
  return d + (a - d) * Math.sqrt(clamp((top - v) / (TETO_SUAVE_FRAC * top), 0, 1))
}

/** Arrasto extra acima do topo (km/h/s): nitro e descida se equilibram em vez de bater num teto. */
export function arrastoExcedente(v: number, top: number): number {
  const x = Math.max(0, v - top)
  return K_EXC * x * x
}
