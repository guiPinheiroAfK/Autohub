// Golden master do EQUILÍBRIO (docs/pesquisa/fisica-carro.md, seção 8).
//
// Roda o bloco longitudinal REAL do jogo (sim/longitudinal.ts) numa reta plana,
// clima limpo, câmbio automático e largada perfeita (52 km/h no verde, giro em
// 55% da faixa, boost a 35% do alvo, como sai do grid). Mede 0–100, 0–160,
// 0–200, o tempo até 95% da máxima e a velocidade aos 40 s de cada carro.
//
// Melhoria de sensação não pode mexer no equilíbrio: cada tempo tem de ficar a
// ±3% da referência. Se o equilíbrio mudar de propósito, atualize a tabela no
// mesmo commit e diga por quê.
// 14/11: tabela refeita com ESCALA_ACEL = 0,65 (data.ts, aceleração "mais real"
// a pedido do usuário). Os tempos esticaram ~1/0,65; a ordem entre os carros e
// a máxima de cada um não mudaram.
//
// Para ver a tabela medida: MEDIDAS=1 npx vitest run medidas

import { describe, it, expect } from "vitest"
import { CARS } from "../data"
import { motorFisico, giroNaFrac, boostAlvo, respostaDe } from "../physics/motores"
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
    speed: 0, rpm: 0, gear: 1, boost: 0, eixo: 0,
    shiftT: 0, marchaDoGiro: 1, reduzindo: false, wheelspinT: 0, bogT: 0, patina: 0,
    nitroOn: false, nitroMeter: 0,
    particles: [], audio: mudo, somT: 0, pitchY: 0, trauma: 0,
    gasF: 1, // pé no fundo desde o grid
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
  eng.eixo = eng.boost
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

/** Retomada: de 100 a 160 km/h numa marcha de força, saindo do pé solto (gás efetivo 0) ou já no fundo. */
export function retomada(carIdx: number, gasInicial: number): number {
  const spec = CARS[carIdx]
  const mf = motorFisico(spec)
  const eng = engDeTeste(carIdx)
  eng.speed = 100
  eng.gear = 3
  eng.marchaDoGiro = 3
  eng.gasF = gasInicial
  let t = 0
  while (eng.speed < 160 && t < 30) {
    passoLongitudinal(eng, spec, mf, { throttle: 1, braking: false, centrif: 0, grade: 0, dt: DT })
    t += DT
  }
  return t
}

// Referência medida antes das melhorias de feel (commit do teste), dt = 1/60.
// [0–100, 0–160, 0–200, até 95% do topo] em s; v40 e v60 em km/h.
const REFERENCIA: Record<string, [number, number, number, number, number, number]> = {
  gt: [3.733, 12.417, 26.467, 41.800, 228.0, 244.0],
  muscle: [2.933, 10.900, 20.233, 38.533, 249.1, 260.0],
  ninja: [3.967, 13.633, 32.867, 43.767, 210.7, 228.0],
  ghost: [3.700, 12.117, 23.267, 46.533, 233.7, 253.6],
  zcoupe: [3.517, 11.633, 23.550, 36.433, 242.8, 248.0],
  rotor: [3.733, 12.250, 26.717, 43.200, 226.9, 243.9],
  apex: [3.133, 9.750, 18.000, 32.650, 259.8, 262.0],
  kaiju: [3.367, 10.417, 20.833, 29.417, 240.0, 240.0],
  sylva: [3.933, 13.617, 30.667, 48.533, 214.6, 234.5],
  roadster: [4.817, 18.100, NaN, NaN, 180.1, 190.4], // não chega a 200 nem a 95% de 220 em 60 s
  alta: [3.283, 10.433, 20.483, 29.633, 242.0, 242.0],
  flat6: [3.150, 9.983, 19.400, 36.833, 250.0, 258.0],
  "test-fwd": [4.017, 13.000, 28.167, 45.000, 222.3, 244.0],
  "test-rwd": [3.733, 12.417, 26.467, 41.800, 228.0, 244.0],
  "test-awd5050": [3.967, 13.483, 30.683, 50.400, 215.0, 243.0],
  "test-awd3070": [3.967, 13.483, 30.683, 50.400, 215.0, 243.0],
}

const TOL = 0.03

describe("medidas de equilíbrio (0–100, 0–160, 0–200, máxima)", () => {
  const tabela: string[] = []
  for (let ci = 0; ci < CARS.length; ci++) {
    const spec = CARS[ci]
    it(`${spec.name}: tempos a ±3% da referência`, () => {
      const m = medir(ci)
      tabela.push(`  ${JSON.stringify(spec.id)}: [${[m.t100, m.t160, m.t200, m.t95].map(x => isNaN(x) ? "NaN" : x.toFixed(3)).join(", ")}, ${m.v40.toFixed(1)}, ${m.v60.toFixed(1)}],`)
      const ref = REFERENCIA[spec.id]
      expect(ref, `sem referência para ${spec.id}`).toBeDefined()
      const [r100, r160, r200, r95, rv40, rv60] = ref
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
      // velocidade aos 60 s (a máxima de fato): a ±0,3%
      expect(Math.abs(m.v60 / rv60 - 1), `v60: ${m.v60.toFixed(1)} contra ${rv60}`).toBeLessThanOrEqual(0.003)
    })
  }
  it("tabela", () => {
    if (process.env.MEDIDAS) console.log(tabela.join("\n"))
  })
})

describe("rampa do acelerador (R6) na retomada", () => {
  it("sair do pé solto custa pouco: no 100–160, no máximo 1,5 × o atraso do motor", () => {
    const linhas: string[] = []
    for (let ci = 0; ci < CARS.length; ci++) {
      const solto = retomada(ci, 0), fundo = retomada(ci, 1)
      const tau = respostaDe(motorFisico(CARS[ci]))
      linhas.push(`  ${CARS[ci].id}: +${(solto - fundo).toFixed(3)} s (τ ${tau})`)
      expect(fundo, CARS[ci].name).toBeGreaterThan(1) // retomada de verdade (não NaN)
      expect(fundo, CARS[ci].name).toBeLessThan(15)
      expect(solto - fundo, CARS[ci].name).toBeGreaterThanOrEqual(0)
      expect(solto - fundo, CARS[ci].name).toBeLessThanOrEqual(1.5 * tau + 1e-9)
    }
    if (process.env.MEDIDAS) console.log(linhas.join("\n"))
  })
})
