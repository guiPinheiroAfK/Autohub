// Playtest 15/11: (1) o turbo ficava cheio na troca de marcha, como antilag;
// (2) a viatura passava por dentro do trânsito e ficava parada um pouco à sua frente.
import { describe, it, expect } from "vitest"
import { MOTORES, aliviaNaTroca, boostDoEixo, boostAlvo } from "../physics/motores"
import { PoliceDriver } from "../traffic/driver"
import { KINDS, type Traffic, type WorldView } from "../traffic/types"

describe("turbo na troca de marcha", () => {
  const m = MOTORES["i4-turbo"]
  it("a pressão alivia na troca e a marcha seguinte devolve a do eixo (força igual)", () => {
    const dt = 1 / 60
    const eixo = 1
    let boost = 1
    // troca de 0,22 s: borboleta fechada, o eixo segue girando
    for (let t = 0; t < 0.22; t += dt) boost = aliviaNaTroca(m, boost, dt)
    expect(boost).toBeLessThan(0.05)       // pssh: o coletor esvaziou (o som segue isto)
    // engatou: a pressão volta à do eixo, como antes (equilíbrio de medidas.test.ts)
    const giro = 4800
    expect(boostDoEixo(m, boost, eixo, giro, 1, dt)).toBe(Math.min(eixo, boostAlvo(m, giro, 1)))
  })
})

function mundo(traffic: Traffic[], playerZ: number, playerSpeed: number, playerX = 0): WorldView {
  const trackLen = 1_000_000
  return {
    traffic, playerX, playerZ, playerSpeed, trackLen, demo: false,
    wrapDz(a, b) { let d = (a - b) % trackLen; if (d > trackLen / 2) d -= trackLen; if (d < -trackLen / 2) d += trackLen; return d },
  }
}
const carro = (z: number, offset: number, speed: number, extra: Partial<Traffic> = {}): Traffic =>
  ({ z, offset, targetOffset: offset, speed, kind: "car", role: "civilian", color: "#fff", blinkT: 0, prevD: 0, ...extra })

describe("viatura no trânsito", () => {
  it("freia a tempo atrás de um carro lento em vez de passar por dentro", () => {
    // pista cheia nas faixas vizinhas: ela não tem para onde desviar
    // o lento aparece a 12 mil u (dentro do que ela enxerga): 205 contra 90 km/h
    const lento = carro(26_000, 0, 90)
    const vizinhos = [-0.5, 0.5].flatMap(o => [0, 4000, 8000, 12_000, 16_000, 20_000, 24_000].map(z => carro(14_000 + z, o, 90)))
    const pm = carro(14_000, 0, 205, { kind: "police", role: "police", top: 205, accel: 50 })
    const trafego = [lento, ...vizinhos, pm]
    const d = new PoliceDriver(), dt = 1 / 60
    const corpo = (KINDS.police.len + KINDS.car.len) / 2
    let dentro = 0, primeiro = ""
    for (let i = 0; i < 60 * 10; i++) {
      for (const c of trafego) if (c !== pm) c.z += c.speed * 132 * dt
      // jogador bem atrás e mais rápido que o trânsito: ela quer correr
      d.drive(pm, mundo(trafego, pm.z - 30_000, 200), dt)
      // por dentro de algum carro (mesma faixa e corpos sobrepostos)
      for (const c of trafego) if (c !== pm && Math.abs(pm.offset - c.offset) < 0.3 && Math.abs(c.z - pm.z) < corpo) { if (!dentro) primeiro = `i=${i} pm ${pm.offset.toFixed(2)}->${pm.targetOffset} v${pm.speed.toFixed(0)} c ${c.offset} dz ${(c.z - pm.z).toFixed(0)}`; dentro++ }
    }
    expect(dentro, primeiro).toBe(0)
  })

  it("não fica parada um pouco à sua frente antes do encostão", () => {
    const pm = carro(10_200, 0.5, 150, { kind: "police", role: "police", top: 205, accel: 50 })
    const d = new PoliceDriver(), dt = 1 / 60
    let playerZ = 10_000
    let frente = 0
    for (let i = 0; i < 60 * 8; i++) {
      d.drive(pm, mundo([pm], playerZ, 150, 0), dt)
      playerZ += 150 * 132 * dt
      if (pm.z - playerZ > 150) frente += dt
    }
    expect(frente).toBeLessThan(1.5)
  })
})
