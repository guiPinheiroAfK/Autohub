import { describe, it, expect } from "vitest"
import { ruido, smoothstep, traumaDeShake, passoCamera, zoomCamera, TRAUMA_DECAI } from "../render/camera"
import { KICK } from "../physics/troca"
import { CARS } from "../data"
import type { AutoDashEngine } from "../engine"

function eng(over: Partial<Record<string, unknown>> = {}): AutoDashEngine {
  return {
    cfg: { carIdx: 0 }, state: "racing", mode: "solo", speed: 0, rpm: 0,
    shakeT: 0, trauma: 0, camT: 0, nitroZoom: 0, nitroOn: false, nitroMeter: 0,
    ...over,
  } as unknown as AutoDashEngine
}

describe("câmera (R2)", () => {
  it("ruído suave: fica em [-1, 1], é determinístico e contínuo", () => {
    let ant = ruido(0)
    for (let t = 0; t < 50; t += 0.01) {
      const v = ruido(t)
      expect(v).toBeGreaterThanOrEqual(-1)
      expect(v).toBeLessThanOrEqual(1)
      expect(Math.abs(v - ant)).toBeLessThan(0.1) // sem salto entre amostras próximas
      ant = v
    }
    expect(ruido(12.34)).toBe(ruido(12.34))
    expect(smoothstep(150, 244, 100)).toBe(0)
    expect(smoothstep(150, 244, 300)).toBe(1)
  })

  it("trauma: batida treme bem mais que raspão, e decai sozinho", () => {
    const raspao = traumaDeShake(0.08) ** 2, batida = traumaDeShake(0.6) ** 2
    expect(batida).toBeGreaterThan(raspao * 4)
    expect(traumaDeShake(0)).toBe(0)
    const e = eng({ trauma: 0.9 })
    for (let i = 0; i < 60; i++) passoCamera(e, 1 / 60)
    expect(e.trauma).toBe(0)
    // shakeT ainda ativo segura um piso
    const f = eng({ shakeT: 0.5 })
    passoCamera(f, 1 / 60)
    expect(f.trauma).toBeCloseTo(0.8)
    expect(TRAUMA_DECAI).toBeGreaterThan(1)
  })

  it("zoom sutil: 1 até 150 km/h, ≤ 1,03 no topo e ≤ 1,055 com nitro, com rampa", () => {
    const top = CARS[0].topSpeed
    expect(zoomCamera(eng({ speed: 140 }))).toBe(1)
    expect(zoomCamera(eng({ speed: top }))).toBeCloseTo(1.03)
    expect(zoomCamera(eng({ speed: top, state: "paused" }))).toBe(1)
    const e = eng({ speed: top, nitroOn: true, nitroMeter: 50 })
    passoCamera(e, 0.1)
    expect(e.nitroZoom).toBeGreaterThan(0.3)
    expect(e.nitroZoom).toBeLessThan(0.5) // rampa de ~0,25 s, não salto
    for (let i = 0; i < 30; i++) passoCamera(e, 1 / 60)
    expect(zoomCamera(e)).toBeCloseTo(1.055)
    e.nitroOn = false
    passoCamera(e, 0.2)
    expect(e.nitroZoom).toBeCloseTo(0.5) // desce em ~0,4 s
  })

  it("chute de troca: maior no H, menor no DCT", () => {
    expect(Math.abs(KICK.H)).toBeGreaterThan(Math.abs(KICK.seq))
    expect(Math.abs(KICK.seq)).toBeGreaterThan(Math.abs(KICK.dct))
    expect(Math.abs(KICK.dct)).toBeGreaterThan(Math.abs(KICK.conv))
  })
})
