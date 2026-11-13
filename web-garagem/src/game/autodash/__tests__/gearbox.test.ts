import { describe, it, expect } from "vitest"
import { autoGearTarget, AUTO_UPSHIFT_RPM, KICKDOWN_RPM, COAST_RPM } from "../physics/gearbox"
import { rpmFor } from "../physics/rpm"
import type { AutoDashEngine } from "../engine"

// Só o que o câmbio lê do engine: marcha, velocidade, giro e o carro (carIdx 0).
function eng(gear: number, speed: number): AutoDashEngine {
  const e = { gear, speed, rpm: 0, cfg: { carIdx: 0 } } as unknown as AutoDashEngine
  e.rpm = rpmFor(e, speed, gear)
  return e
}

describe("câmbio automático", () => {
  it("bug corrigido: freando na 6ª ele reduz bem antes de 42 km/h", () => {
    // antes: só reduzia com rpm < 2000 (6ª abaixo de ~42 km/h)
    const e = eng(6, 45)
    expect(e.rpm).toBeLessThan(COAST_RPM)
    expect(autoGearTarget(e, false)).toBeLessThan(6)
  })

  it("sem gás, desce marcha até manter o giro acima do mínimo de rodagem", () => {
    for (let v = 20; v <= 250; v += 5) {
      for (let g = 2; g <= 6; g++) {
        const e = eng(g, v)
        const t = autoGearTarget(e, false)
        expect(t).toBeLessThanOrEqual(g)
        if (t < g) expect(rpmFor(e, v, t) >= COAST_RPM || t === 1).toBe(true)
      }
    }
  })

  it("kickdown: retomada a 120 km/h na 6ª pula direto pra uma marcha de força", () => {
    const e = eng(6, 120)
    const t = autoGearTarget(e, true)
    expect(t).toBeLessThanOrEqual(4)
    expect(rpmFor(e, 120, t)).toBeLessThanOrEqual(KICKDOWN_RPM)
  })

  it("no gás em velocidade de cruzeiro alta não reduz à toa", () => {
    expect(autoGearTarget(eng(6, 210), true)).toBe(6)
  })

  it("sobe no corte e não fica caçando marcha depois da troca", () => {
    for (let g = 1; g <= 5; g++) {
      // velocidade em que a marcha g bate o giro de troca
      let v = 1
      while (rpmFor(eng(g, v), v, g) <= AUTO_UPSHIFT_RPM) v += 0.5
      expect(autoGearTarget(eng(g, v), true)).toBe(g + 1)
      // já na marcha de cima, a mesma velocidade não pede kickdown de volta
      expect(autoGearTarget(eng(g + 1, v), true)).toBe(g + 1)
    }
  })

  it("chega na 6ª e volta a reduzir quando desacelera", () => {
    let g = 1
    for (let v = 5; v <= 240; v += 1) {
      const t = autoGearTarget(eng(g, v), true)
      if (t !== g) g = t
    }
    expect(g).toBe(6)
    for (let v = 240; v >= 10; v -= 1) {
      const t = autoGearTarget(eng(g, v), false)
      if (t !== g) g = t
    }
    expect(g).toBeLessThanOrEqual(2)
  })
})
