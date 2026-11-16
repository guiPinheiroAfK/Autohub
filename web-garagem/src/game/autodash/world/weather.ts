// AutoDash — world/weather.ts. Clima como estado discreto (ADR 0013), com
// entradas da física (ADR 0012): aderência, freio e visibilidade. Não é só visual.
// O clima só muda na virada de uma janela de ticks, nunca no meio de um quadro,
// e o sorteio usa a seed da pista: a mesma pista repete o mesmo clima.

import { TICKS_PER_DAY } from "./clock"

export type ClimaId = "limpo" | "nublado" | "chuva" | "neblina"
export type ClimaModo = "sorteio" | ClimaId

export interface ClimaDef {
  id: ClimaId
  nome: string
  grip: number    // multiplica a aderência do carro
  freio: number   // multiplica a desaceleração do freio
  visib: number   // 1 = horizonte limpo; menor = névoa encobre o fundo da pista
  amb: number     // multiplica a luminosidade
  cinza: number   // quanto o céu puxa pro cinza (0 = nada)
  chuva: boolean  // gotas, pista molhada e som de chuva
  peso: number    // chance relativa no sorteio
}

export const CLIMAS: Record<ClimaId, ClimaDef> = {
  // chuva mantém os números de antes (grip ×0,62, freio 78 em vez de 105)
  limpo:   { id: "limpo",   nome: "limpo",   grip: 1,    freio: 1,        visib: 1,    amb: 1,    cinza: 0,    chuva: false, peso: 0.6 },
  nublado: { id: "nublado", nome: "nublado", grip: 1,    freio: 1,        visib: 0.88, amb: 0.86, cinza: 0.45, chuva: false, peso: 0.15 },
  chuva:   { id: "chuva",   nome: "chuva",   grip: 0.62, freio: 78 / 105, visib: 0.8,  amb: 0.8,  cinza: 0,    chuva: true,  peso: 0.17 },
  neblina: { id: "neblina", nome: "neblina", grip: 0.93, freio: 0.95,     visib: 0.42, amb: 0.9,  cinza: 0.6,  chuva: false, peso: 0.08 },
}

export const CLIMA_MODOS: ClimaModo[] = ["sorteio", "limpo", "nublado", "chuva", "neblina"]

// O clima pode virar a cada minuto de jogo (1200 ticks).
export const JANELA_TICKS = TICKS_PER_DAY / 20

export function proximoClima(m: ClimaModo): ClimaModo {
  return CLIMA_MODOS[(CLIMA_MODOS.indexOf(m) + 1) % CLIMA_MODOS.length]
}

function hash32(a: number, b: number): number {
  let h = (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

/**
 * Clima de uma janela. A janela 0 (a largada) é sempre limpa, como antes; as
 * seguintes sorteiam entre os climas que o bioma aceita, pesados por `peso`.
 */
export function climaDaJanela(permitidos: string[], seed: number, janela: number): ClimaId {
  const ids = (permitidos.filter(c => c in CLIMAS) as ClimaId[])
  if (janela <= 0 || ids.length === 0) return ids.includes("limpo") || ids.length === 0 ? "limpo" : ids[0]
  const total = ids.reduce((s, c) => s + CLIMAS[c].peso, 0)
  let r = (hash32(seed | 0, janela) / 2 ** 32) * total
  for (const c of ids) { r -= CLIMAS[c].peso; if (r < 0) return c }
  return ids[ids.length - 1]
}

/** Clima que vale `ticks` depois da largada, conforme o modo escolhido. */
export function climaNoTick(modo: ClimaModo, permitidos: string[], seed: number, ticks: number): ClimaId {
  if (modo !== "sorteio") return modo
  return climaDaJanela(permitidos, seed, Math.floor(ticks / JANELA_TICKS))
}
