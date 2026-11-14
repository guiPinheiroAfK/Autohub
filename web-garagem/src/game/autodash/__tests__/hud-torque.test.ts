import { describe, it, expect } from "vitest"
import { giroDeForcaMaxima } from "../render/hud-torque"
import { MOTORES } from "../physics/motores"

describe("torque no HUD (Fase 7)", () => {
  it("marca a faixa de força onde cada motor tem o pico da curva", () => {
    expect(giroDeForcaMaxima(MOTORES.i4)).toBeCloseTo(7500, -2) // VTEC: força em cima
    expect(giroDeForcaMaxima(MOTORES.i3)).toBeCloseTo(5000, -2) // 1.0 turbo: cheio cedo
    for (const m of Object.values(MOTORES)) {
      const p = giroDeForcaMaxima(m)
      expect(p).toBeGreaterThan(m.idle)
      expect(p).toBeLessThan(m.corte)
    }
  })
})
