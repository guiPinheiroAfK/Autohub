// AutoDash — world/clock.ts. Relógio em ticks (ADR 0013).
// Um tick = 1/20 s de SIMULAÇÃO, acumulado do dt do quadro: pausa e menus não
// avançam. Um dia = 24000 ticks (20 min de jogo). Como no Minecraft, o tick 0 é
// o amanhecer (6h): hora = (tick / 1000 + 6) mod 24.

export const TICK_S = 1 / 20
export const TICKS_PER_DAY = 24000

// Horário do jogo: "ciclo" anda sozinho; os outros são fixos.
export type HoraModo = "ciclo" | "amanhecer" | "dia" | "por-do-sol" | "noite"
export const HORA_MODOS: HoraModo[] = ["ciclo", "amanhecer", "dia", "por-do-sol", "noite"]
export const HORA_NOME: Record<HoraModo, string> = {
  ciclo: "ciclo do dia", amanhecer: "amanhecer", dia: "dia", "por-do-sol": "pôr do sol", noite: "noite",
}
// hora de relógio de cada horário fixo (o ciclo começa às 9h, como antes)
const HORA_FIXA: Record<HoraModo, number> = { ciclo: 9, amanhecer: 6, dia: 12, "por-do-sol": 18, noite: 0 }

export interface Clock {
  tick: number    // ticks inteiros desde o início
  acc: number     // sobra de tempo (s) que ainda não fechou um tick
  speed: number   // multiplicador do relógio (0 = parado)
}

export function tickForHour(h: number): number {
  return Math.round((((h - 6) % 24) + 24) % 24 * 1000)
}

/** Relógio novo para um modo de horário. Horário fixo = relógio parado. */
export function newClock(modo: HoraModo = "ciclo", speed = 1): Clock {
  return { tick: tickForHour(HORA_FIXA[modo]), acc: 0, speed: modo === "ciclo" ? speed : 0 }
}

/** Avança o relógio pelo dt do quadro. Devolve quantos ticks fecharam. */
export function advanceClock(c: Clock, dt: number): number {
  if (c.speed <= 0 || dt <= 0) return 0
  c.acc += dt * c.speed
  const n = Math.floor(c.acc / TICK_S + 1e-9)
  if (n > 0) { c.tick += n; c.acc -= n * TICK_S }
  return n
}

/** Fração do dia, 0..1 (0 = amanhecer, 0,25 = meio-dia, 0,5 = pôr do sol, 0,75 = meia-noite). */
export function dayFrac(tick: number): number {
  return (((tick % TICKS_PER_DAY) + TICKS_PER_DAY) % TICKS_PER_DAY) / TICKS_PER_DAY
}

export function hourOf(tick: number): number {
  return (dayFrac(tick) * 24 + 6) % 24
}

export function formatHour(tick: number): string {
  const h = hourOf(tick)
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60)
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}

export function proximaHora(m: HoraModo): HoraModo {
  return HORA_MODOS[(HORA_MODOS.indexOf(m) + 1) % HORA_MODOS.length]
}
