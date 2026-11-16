// AutoDash — sim/clima.ts. Liga o relógio e o clima (dados puros em world/clock.ts
// e world/weather.ts) ao engine: largada, avanço por quadro e efeitos da troca.
import type { AutoDashEngine } from "../engine"
import { advanceClock, newClock, TICK_S, type HoraModo } from "../world/clock"
import { CLIMAS, climaNoTick, type ClimaId, type ClimaModo, type ClimaDef } from "../world/weather"
import { initRain } from "../fx/particles"

/**
 * Transições (playtest 16/11: "a mudança de bioma e de clima está muito bruta").
 * O clima novo entra misturado ao anterior em `climaS` (luz, névoa, aderência,
 * freio e a chuva aparecendo/sumindo); a região nova, em `biomaS` (céu e fundo).
 */
export const TRANSICAO = { climaS: 8, biomaS: 5 }

export interface ClimaVisto extends ClimaDef { chuvaK: number } // chuvaK: 0..1, intensidade da chuva

const mistura = (a: number, b: number, k: number) => a + (b - a) * k

/** Clima em vigor, já misturado com o anterior durante a transição. */
export function climaAtual(eng: AutoDashEngine): ClimaVisto {
  const cur = CLIMAS[eng.clima]
  const k = eng.climaMix ?? 1
  if (k >= 1 || !eng.climaAnt) return { ...cur, chuvaK: cur.chuva ? 1 : 0 }
  const ant = eng.climaAnt
  return {
    ...cur,
    grip: mistura(ant.grip, cur.grip, k), freio: mistura(ant.freio, cur.freio, k),
    visib: mistura(ant.visib, cur.visib, k), amb: mistura(ant.amb, cur.amb, k),
    cinza: mistura(ant.cinza, cur.cinza, k),
    chuva: cur.chuva || ant.chuva,
    chuvaK: mistura(ant.chuvaK, cur.chuva ? 1 : 0, k),
  }
}

/** Troca o clima e dispara o que muda junto (gotas e som de chuva). `suave`: com transição. */
export function setClima(eng: AutoDashEngine, id: ClimaId, suave = false) {
  if (id === eng.clima) return
  const era = CLIMAS[eng.clima].chuva, vai = CLIMAS[id].chuva
  // a transição parte do que está NA TELA (playtest 16/11: "o clima está bugando"):
  // antes partia do clima cheio de antes e, trocando no meio de outra transição,
  // a imagem pulava
  eng.climaAnt = climaAtual(eng)
  eng.climaMix = suave ? 0 : 1
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
  if (eng.climaMix < 1) eng.climaMix = Math.min(1, eng.climaMix + dt / TRANSICAO.climaS)
  if (eng.biomaMix < 1) eng.biomaMix = Math.min(1, eng.biomaMix + dt / TRANSICAO.biomaS)
  setClima(eng, eng.climaForcado ?? climaNoTick(eng.climaModo, eng.bioma.climas, eng.climaSeed, Math.floor(eng.climaS / TICK_S)), true)
}

/** Seed do clima quando a pista não tem uma (solo): hash do traçado, sem Math.random. */
export function seedDoTracado(eng: AutoDashEngine): number {
  let h = eng.segments.length >>> 0
  for (let i = 0; i < Math.min(96, eng.segments.length); i++) {
    h = Math.imul(h ^ Math.round(eng.segments[i].curve * 1000), 16777619) >>> 0
  }
  return h
}
