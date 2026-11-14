// AutoDash — sim/clima.ts. Liga o relógio e o clima (dados puros em world/clock.ts
// e world/weather.ts) ao engine: largada, avanço por quadro e efeitos da troca.
import type { AutoDashEngine } from "../engine"
import { advanceClock, newClock, TICK_S, type HoraModo } from "../world/clock"
import { CLIMAS, climaNoTick, type ClimaId, type ClimaModo } from "../world/weather"
import { initRain } from "../fx/particles"

export function climaAtual(eng: AutoDashEngine) {
  return CLIMAS[eng.clima]
}

/** Troca o clima e dispara o que muda junto (gotas e som de chuva). */
export function setClima(eng: AutoDashEngine, id: ClimaId) {
  if (id === eng.clima) return
  const era = CLIMAS[eng.clima].chuva, vai = CLIMAS[id].chuva
  eng.clima = id
  if (vai && !era) { initRain(eng); eng.audio.rain(true) }
  if (!vai && era) eng.audio.rain(false)
}

/** Largada: relógio no horário escolhido e clima da janela 0. */
export function iniciarTempo(eng: AutoDashEngine, hora: HoraModo, clima: ClimaModo, seed: number) {
  eng.clock = newClock(hora)
  eng.horaModo = hora
  eng.climaModo = clima
  eng.climaSeed = seed >>> 0
  eng.climaS = 0
  eng.clima = "limpo"
  eng.audio.rain(false)
  setClima(eng, climaNoTick(clima, eng.bioma.climas, eng.climaSeed, 0))
}

/** Avança relógio e clima pelo dt de simulação (pausa e menus não chamam). */
export function tickTempo(eng: AutoDashEngine, dt: number) {
  advanceClock(eng.clock, dt)
  eng.climaS += dt
  setClima(eng, climaNoTick(eng.climaModo, eng.bioma.climas, eng.climaSeed, Math.floor(eng.climaS / TICK_S)))
}

/** Seed do clima quando a pista não tem uma (solo): hash do traçado, sem Math.random. */
export function seedDoTracado(eng: AutoDashEngine): number {
  let h = eng.segments.length >>> 0
  for (let i = 0; i < Math.min(96, eng.segments.length); i++) {
    h = Math.imul(h ^ Math.round(eng.segments[i].curve * 1000), 16777619) >>> 0
  }
  return h
}
