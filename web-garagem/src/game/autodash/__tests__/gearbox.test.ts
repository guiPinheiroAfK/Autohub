import { describe, it, expect } from "vitest"
import { autoGearTarget, limitesAuto } from "../physics/gearbox"
import { rpmFor } from "../physics/rpm"
import { motorDe } from "../physics/motores"
import { CARS } from "../data"
import type { AutoDashEngine } from "../engine"

// Só o que o câmbio lê do engine: marcha, velocidade, giro e o carro.
function eng(gear: number, speed: number, carIdx = 0): AutoDashEngine {
  const e = { gear, speed, rpm: 0, boost: 0, cfg: { carIdx } } as unknown as AutoDashEngine
  e.rpm = rpmFor(e, speed, gear)
  return e
}

// um carro de cada família de motor (V10, V8 de 71, VTEC, rotativo, boxer 6)
const carros = ["gt", "muscle", "ninja", "rotor", "flat6"].map(b => CARS.findIndex(c => c.body === b))

describe("câmbio automático", () => {
  for (const ci of carros) {
    const nome = CARS[ci].name
    const L = limitesAuto(motorDe(eng(1, 0, ci)))

    it(`${nome}: freando na 6ª ele reduz (não fica preso na marcha alta)`, () => {
      let v = 120
      while (rpmFor(eng(6, v, ci), v, 6) >= L.rodagem) v -= 1
      expect(autoGearTarget(eng(6, v, ci), false)).toBeLessThan(6)
    })

    it(`${nome}: sem gás, desce até manter o giro de rodagem`, () => {
      for (let v = 20; v <= 250; v += 5) {
        for (let g = 2; g <= 6; g++) {
          const t = autoGearTarget(eng(g, v, ci), false)
          expect(t).toBeLessThanOrEqual(g)
          if (t < g) expect(rpmFor(eng(g, v, ci), v, t) >= L.rodagem || t === 1).toBe(true)
        }
      }
    })

    it(`${nome}: kickdown a 120 km/h na 6ª pula pra uma marcha de força`, () => {
      const t = autoGearTarget(eng(6, 120, ci), true)
      expect(t).toBeLessThanOrEqual(4)
      expect(rpmFor(eng(6, 120, ci), 120, t)).toBeLessThanOrEqual(L.kickdown)
    })

    it(`${nome}: sobe antes da faixa vermelha e não fica caçando marcha`, () => {
      for (let g = 1; g <= 5; g++) {
        let v = 1
        while (rpmFor(eng(g, v, ci), v, g) <= L.sobe) v += 0.5
        expect(autoGearTarget(eng(g, v, ci), true)).toBe(g + 1)
        expect(autoGearTarget(eng(g + 1, v, ci), true)).toBe(g + 1)
      }
    })

    it(`${nome}: chega na 6ª e volta a reduzir quando desacelera`, () => {
      let g = 1
      for (let v = 5; v <= 240; v += 1) g = autoGearTarget(eng(g, v, ci), true)
      expect(g).toBe(6)
      for (let v = 240; v >= 10; v -= 1) g = autoGearTarget(eng(g, v, ci), false)
      expect(g).toBeLessThanOrEqual(2)
    })
  }

  it("cada motor troca num giro diferente (V8 de 71 bem antes do VTEC)", () => {
    const sobe = (b: string) => limitesAuto(motorDe(eng(1, 0, CARS.findIndex(c => c.body === b)))).sobe
    expect(sobe("muscle")).toBeLessThan(5600)
    expect(sobe("ninja")).toBeGreaterThan(7500)
  })
})
