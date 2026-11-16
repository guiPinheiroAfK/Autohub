import { describe, it, expect } from "vitest"
import { arrasto, tetoSuave, arrastoExcedente, K_EXC, TETO_SUAVE_FRAC } from "../physics/arrasto"

describe("teto suave e arrasto acima do topo (P5)", () => {
  const top = 244

  it("arrasto é o de sempre: 5 + 0,028·v", () => {
    expect(arrasto(0)).toBe(5)
    expect(arrasto(200)).toBeCloseTo(10.6)
  })

  it("até 96% do topo a força do motor não muda", () => {
    for (let v = 0; v <= top * (1 - TETO_SUAVE_FRAC); v += 1) {
      for (const a of [0, 3, 12, 40]) expect(tetoSuave(a, v, top)).toBe(a)
    }
  })

  it("nos últimos 4% a sobra some suave, sem degrau, e no topo o motor só empata com o arrasto", () => {
    const a = 14
    let ant = tetoSuave(a, top * 0.96, top)
    for (let v = top * 0.96; v <= top; v += 0.05) {
      const k = tetoSuave(a, v, top)
      expect(k).toBeLessThanOrEqual(ant + 1e-9)
      expect(k).toBeGreaterThanOrEqual(arrasto(v) - 1e-9)
      expect(Math.abs(k - ant)).toBeLessThan(0.6)
      ant = k
    }
    expect(tetoSuave(a, top, top)).toBeCloseTo(arrasto(top))
    expect(tetoSuave(a, top + 10, top)).toBeCloseTo(arrasto(top + 10))
    // força menor que o arrasto (subida, marcha errada) passa intacta
    expect(tetoSuave(4, top - 1, top)).toBe(4)
  })

  it("acima do topo o arrasto extra é quadrático: o nitro (+42) equilibra em ~topo + 29", () => {
    expect(arrastoExcedente(top - 5, top)).toBe(0)
    expect(arrastoExcedente(top, top)).toBe(0)
    expect(arrastoExcedente(top + 10, top)).toBeCloseTo(K_EXC * 100)
    expect(Math.sqrt(42 / K_EXC)).toBeGreaterThan(28)
    expect(Math.sqrt(42 / K_EXC)).toBeLessThan(30)
  })
})
