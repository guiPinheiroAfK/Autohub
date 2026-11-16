// Playtest 16/11: "subindo o carro pesa demais, só perde velocidade e nem com a
// marcha de baixo muda nada" e "saindo do viaduto o carro nem embala".
// 1) Bloco longitudinal real numa ladeira constante: subida moderada não come a
//    velocidade de quem está forte; a mais forte da pista cobra, mas devagar.
// 2) Engine real no elevado: descendo a rampa o carro ganha velocidade sozinho.
import { describe, it, expect } from "vitest"
import { CARS } from "../data"
import { motorFisico, giroNaFrac } from "../physics/motores"
import { passoLongitudinal } from "../sim/longitudinal"
import type { AutoDashEngine } from "../engine"
import { runScenario } from "./harness"
import { spawnEvent } from "../world/events"
import { ramalNoSeg, ramalCentro, elevacao, ELEVADO_PLATO, type Ramal } from "../world/ramais"
import { PLAYER_Z } from "../engine"
import { SEG_LEN } from "../data"

function engDeTeste(carIdx: number, v: number): AutoDashEngine {
  const mudo = new Proxy({}, { get: () => () => {} })
  return {
    cfg: { carIdx, transmission: "auto", customs: [] }, state: "racing", clima: "limpo",
    speed: v, rpm: 0, gear: 4, boost: 0.5, eixo: 0.5, shiftT: 0, marchaDoGiro: 4, reduzindo: false,
    wheelspinT: 0, bogT: 0, patina: 0, nitroOn: false, nitroMeter: 0,
    particles: [], audio: mudo, somT: 0, pitchY: 0, trauma: 0, gasF: 1,
  } as unknown as AutoDashEngine
}

function subir(carIdx: number, grade: number, s: number): number {
  const e = engDeTeste(carIdx, 160)
  const mf = motorFisico(CARS[carIdx])
  e.rpm = giroNaFrac(mf, 0.6)
  for (let i = 0; i < s * 60; i++) passoLongitudinal(e, CARS[carIdx], mf, { throttle: 1, braking: false, centrif: 0, grade, dt: 1 / 60 })
  return e.speed
}

describe("ladeira", () => {
  it("subida moderada não derruba quem está no pé", () => {
    for (const c of [0, 1]) expect(subir(c, 0.06, 10), `carro ${c}`).toBeGreaterThan(160)
  })
  it("a subida mais forte cobra, mas devagar", () => {
    for (const c of [0, 1, 9]) {
      const v = subir(c, 0.13, 5)
      expect(v, `carro ${c}`).toBeLessThan(160)
      expect(v, `carro ${c}`).toBeGreaterThan(130)
    }
  })
})

const LARGADA = (i: number, api: { tap(k: string): void; down(k: string): void }) => {
  if (i === 10) api.tap("Enter")
  if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
  if (i === 18) api.tap("Enter")
  if (i === 25) api.tap("Enter")
}

describe("descida do elevado", () => {
  it("sem acelerar, a rampa de descida embala o carro", async () => {
    let r: Ramal | undefined, vTopo = 0, vPe = 0, desceu = false
    await runScenario(60 * 30, 3, LARGADA, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.immuneT = 10; eng.combustivel = 1
      if (i === 360) {
        eng.eventTimer = 1e9; eng.zones = []
        spawnEvent(eng, "viaduct")
        r = eng.ramais.find((q: Ramal) => q.alto)
        if (!r) return
        // no fim do platô, em cima do tabuleiro, a 120 km/h em 4ª e sem acelerar
        eng.position = (r.topo! + ELEVADO_PLATO) * SEG_LEN - PLAYER_Z
        eng.speed = 120; eng.gear = 4; eng.marchaDoGiro = 4; eng.elevJogador = r.alto!
      }
      if (!r || i <= 360 || desceu) return
      const idx = Math.floor((eng.position + PLAYER_Z) / SEG_LEN) % eng.segments.length
      const q = ramalNoSeg(eng.ramais, idx)
      if (q && q.r === r) eng.playerX = ramalCentro(q)
      if (!vTopo) vTopo = eng.speed
      if (elevacao(r, idx) < r.alto! * 0.1) { vPe = eng.speed; desceu = true }
    })
    expect(r, "o elevado não coube").toBeDefined()
    expect(desceu, "não chegou ao pé da rampa").toBe(true)
    expect(vPe - vTopo, "a descida não embalou").toBeGreaterThan(15)
  }, 90_000)
})
