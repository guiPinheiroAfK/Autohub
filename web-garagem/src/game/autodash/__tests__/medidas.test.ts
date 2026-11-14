// Golden master do EQUILÍBRIO (docs/pesquisa/fisica-carro.md, seção 8).
//
// Roda o bloco longitudinal REAL do jogo (sim/longitudinal.ts) numa reta plana,
// clima limpo, câmbio automático e largada perfeita (52 km/h no verde, giro em
// 55% da faixa, boost a 35% do alvo, como sai do grid). Mede 0–100, 0–160,
// 0–200, o tempo até 95% da máxima e a velocidade aos 40 s de cada carro.
//
// Os números de referência abaixo são os de ANTES das melhorias de "feel"
// (R1–R6, P4, P5). Melhoria de sensação não pode mexer no equilíbrio: cada
// tempo tem de ficar a ±3% da referência. Se um dia o equilíbrio mudar de
// propósito, atualize a tabela no mesmo commit e diga por quê.
//
// Para ver a tabela medida: MEDIDAS=1 npx vitest run medidas

import { describe, it, expect } from "vitest"
import { CARS } from "../data"
import { motorFisico, giroNaFrac, boostAlvo } from "../physics/motores"
import { passoLongitudinal } from "../sim/longitudinal"
import type { AutoDashEngine } from "../engine"

const DT = 1 / 60
const DURACAO = 60 // s

// Só o que o bloco longitudinal lê e escreve no engine.
function engDeTeste(carIdx: number): AutoDashEngine {
  const mudo = new Proxy({}, { get: () => () => {} })
  return {
    cfg: { carIdx, transmission: "auto", customs: [] },
    state: "racing", clima: "limpo",
    speed: 0, rpm: 0, gear: 1, boost: 0,
    shiftT: 0, marchaDoGiro: 1, reduzindo: false, wheelspinT: 0, bogT: 0,
    nitroOn: false, nitroMeter: 0,
    particles: [], audio: mudo,
  } as unknown as AutoDashEngine
}

export interface Medida { t100: number; t160: number; t200: number; t95: number; v40: number; v60: number }

/** Largada perfeita e pé no fundo por 60 s numa reta plana. */
export function medir(carIdx: number): Medida {
  const spec = CARS[carIdx]
  const mf = motorFisico(spec)
  const eng = engDeTeste(carIdx)
  // como launch() deixa o carro na largada perfeita (modes/solo.ts)
  eng.speed = 52
  eng.rpm = giroNaFrac(mf, 0.55)
  eng.boost = 0.35 * boostAlvo(mf, eng.rpm, 1)
  const m: Medida = { t100: NaN, t160: NaN, t200: NaN, t95: NaN, v40: 0, v60: 0 }
  const n = Math.round(DURACAO / DT)
  for (let i = 1; i <= n; i++) {
    passoLongitudinal(eng, spec, mf, { throttle: 1, braking: false, centrif: 0, grade: 0, dt: DT })
    const t = i * DT
    if (isNaN(m.t100) && eng.speed >= 100) m.t100 = t
    if (isNaN(m.t160) && eng.speed >= 160) m.t160 = t
    if (isNaN(m.t200) && eng.speed >= 200) m.t200 = t
    if (isNaN(m.t95) && eng.speed >= 0.95 * spec.topSpeed) m.t95 = t
    if (i === Math.round(40 / DT)) m.v40 = eng.speed
  }
  m.v60 = eng.speed
  return m
}

// Referência medida antes das melhorias de feel (commit do teste), dt = 1/60.
// [0–100, 0–160, 0–200, até 95% do topo] em s; v40 em km/h.
const REFERENCIA: Record<string, [number, number, number, number, number]> = {
  gt: [2.650, 8.617, 18.117, 28.083, 244.0],
  muscle: [2.033, 7.633, 13.700, 25.600, 260.0],
  ninja: [2.750, 9.300, 22.217, 29.300, 228.0],
  ghost: [2.800, 8.733, 16.550, 31.667, 255.4],
  zcoupe: [2.500, 8.067, 16.067, 24.450, 248.0],
  rotor: [2.683, 8.333, 17.967, 28.683, 244.0],
  apex: [2.333, 6.933, 12.500, 22.033, 262.0],
  kaiju: [2.467, 7.183, 14.167, 19.750, 240.0],
  sylva: [2.817, 9.400, 20.783, 32.417, 235.8],
  roadster: [3.317, 12.100, 52.067, NaN, 190.3], // não chega a 95% de 220 em 60 s
  alta: [2.333, 7.250, 14.017, 19.967, 242.0],
  flat6: [2.317, 6.933, 13.367, 24.700, 258.0],
  "test-fwd": [2.850, 9.017, 19.250, 30.200, 244.0],
  "test-rwd": [2.650, 8.617, 18.117, 28.083, 244.0],
  "test-awd5050": [2.800, 9.333, 20.933, 33.767, 244.0],
  "test-awd3070": [2.800, 9.333, 20.933, 33.767, 244.0],
}

const TOL = 0.03

describe("medidas de equilíbrio (0–100, 0–160, 0–200, máxima)", () => {
  const tabela: string[] = []
  for (let ci = 0; ci < CARS.length; ci++) {
    const spec = CARS[ci]
    it(`${spec.name}: tempos a ±3% da referência`, () => {
      const m = medir(ci)
      tabela.push(`  ${JSON.stringify(spec.id)}: [${[m.t100, m.t160, m.t200, m.t95].map(x => isNaN(x) ? "NaN" : x.toFixed(3)).join(", ")}, ${m.v40.toFixed(1)}], // v60 ${m.v60.toFixed(1)}`)
      const ref = REFERENCIA[spec.id]
      expect(ref, `sem referência para ${spec.id}`).toBeDefined()
      const [r100, r160, r200, r95, rv40] = ref
      const perto = (v: number, r: number, nome: string) => {
        if (isNaN(r)) { expect(isNaN(v), `${nome}: antes não chegava`).toBe(true); return }
        expect(Math.abs(v / r - 1), `${nome}: ${v.toFixed(3)} contra ${r}`).toBeLessThanOrEqual(TOL)
      }
      perto(m.t100, r100, "0–100")
      perto(m.t160, r160, "0–160")
      perto(m.t200, r200, "0–200")
      perto(m.t95, r95, "até 95% do topo")
      // velocidade aos 40 s: a ±1% (o teto suave só mexe nos últimos 4%)
      expect(Math.abs(m.v40 / rv40 - 1), `v40: ${m.v40.toFixed(1)} contra ${rv40}`).toBeLessThanOrEqual(0.01)
    })
  }
  it("tabela", () => {
    if (process.env.MEDIDAS) console.log(tabela.join("\n"))
  })
})
