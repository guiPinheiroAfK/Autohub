// AutoDash — world/combustivel.ts. Combustível como dados e funções puras (Fase 5, D19).
//
// O tanque é guardado como fração (0..1). O consumo é de JOGO, não real: um
// tanque dura uns 4 minutos de pé no fundo, para o posto aparecer dentro de uma
// rodada. Quem gasta é o pé, o giro e o nitro: trocar de marcha cedo economiza,
// e é isso que dá lógica ao câmbio (D19). Só vale no solo (GUIA, decisões em aberto).
import type { BodyKind } from "../data"

export const COMBUSTIVEL = {
  tanqueL: 50,           // litros (igual para todos; o consumo é que muda por carro)
  lentaLs: 0.008,        // L/s em marcha lenta ou sem pé
  peLs: 0.07,            // L/s com o pé no fundo e o giro baixo
  giroLs: 0.2,           // L/s a mais no giro máximo (× fração da faixa ^ 1,5)
  nitroLs: 0.35,         // L/s a mais com o nitro aceso
  reserva: 0.2,          // abaixo disso acende a reserva
  chamaPosto: 0.45,      // abaixo disso o próximo posto é aberto à frente
  chamaPostoDeNovo: 0.2, // passou reto pelo posto: o próximo só quando cair aqui
  abasteceVmax: 70,      // km/h máximos para a bomba encher
  abasteceLs: 4,         // L/s passando devagar pela bomba (8% do tanque por segundo)
  paradoVmax: 5,         // km/h: abaixo disso é "parado na bomba" (Fase 8.2)
  paradoLs: 20,          // L/s parado na bomba (40%/s: parar vale o tempo de frear e sair)
  panePe: 0.35,          // pé efetivo máximo na pane seca, quando o motor pega
  paneHz: 2.3,           // engasgos por segundo na pane seca
} as const

// consumo relativo por carroceria: V8 grande bebe mais, roadster leve bebe menos
export const CONSUMO_CARRO: Partial<Record<BodyKind, number>> = {
  muscle: 1.3, apex: 1.25, rotor: 1.2, kaiju: 1.15, ghost: 1.1,
  ninja: 0.9, sylva: 0.9, roadster: 0.8,
}

export function consumoDoCarro(body: BodyKind): number {
  return CONSUMO_CARRO[body] ?? 1
}

/**
 * Litros por segundo. `pe` é o pé efetivo (0..1), `fracGiro` a posição do giro
 * na faixa do motor (0 = lenta, 1 = corte), `carro` o multiplicador da carroceria.
 */
export function consumoLs(pe: number, fracGiro: number, nitro: boolean, carro = 1): number {
  const f = Math.min(1, Math.max(0, fracGiro))
  const p = Math.min(1, Math.max(0, pe))
  const base = COMBUSTIVEL.lentaLs + p * (COMBUSTIVEL.peLs + COMBUSTIVEL.giroLs * Math.pow(f, 1.5))
  return base * carro + (nitro ? COMBUSTIVEL.nitroLs : 0)
}

/** Tanque (fração) depois de `dt` segundos gastando `ls` litros por segundo. */
export function gastar(tanque: number, ls: number, dt: number): number {
  return Math.max(0, tanque - (ls * dt) / COMBUSTIVEL.tanqueL)
}

/** Litros por segundo da bomba nesta velocidade (0 acima do limite). */
export function vazaoBomba(kmh: number): number {
  if (kmh > COMBUSTIVEL.abasteceVmax) return 0
  return kmh <= COMBUSTIVEL.paradoVmax ? COMBUSTIVEL.paradoLs : COMBUSTIVEL.abasteceLs
}

/** Tanque (fração) depois de `dt` segundos na bomba. Parado enche bem mais rápido que passando devagar. */
export function abastecer(tanque: number, kmh: number, dt: number): number {
  return Math.min(1, tanque + (vazaoBomba(kmh) * dt) / COMBUSTIVEL.tanqueL)
}

/**
 * Teto do pé (0..1) pelo combustível. Com combustível: 1. Na pane seca o motor
 * engasga: pega por um instante com pouca força e falha, em pulsos regulares
 * (determinístico pelo relógio `t`, para o replay repetir).
 */
export function tetoDoPe(tanque: number, t: number): number {
  if (tanque > 0) return 1
  const fase = (t * COMBUSTIVEL.paneHz) % 1
  return fase < 0.55 ? COMBUSTIVEL.panePe : 0
}
