// Combustível (Fase 5): consumo, abastecimento e pane seca. Funções puras.
import { describe, it, expect } from "vitest"
import { COMBUSTIVEL, consumoLs, gastar, abastecer, tetoDoPe, consumoDoCarro } from "../world/combustivel"

describe("combustível", () => {
  it("sem pé gasta só a lenta", () => {
    expect(consumoLs(0, 0.9, false)).toBeCloseTo(COMBUSTIVEL.lentaLs, 6)
  })
  it("giro alto gasta mais que giro baixo com o mesmo pé (trocar cedo economiza)", () => {
    expect(consumoLs(1, 0.9, false)).toBeGreaterThan(consumoLs(1, 0.4, false) * 1.3)
  })
  it("nitro soma consumo", () => {
    expect(consumoLs(1, 0.5, true) - consumoLs(1, 0.5, false)).toBeCloseTo(COMBUSTIVEL.nitroLs, 6)
  })
  it("um tanque dura uns 3 a 6 minutos de pé no fundo em giro alto", () => {
    const s = COMBUSTIVEL.tanqueL / consumoLs(1, 0.8, false)
    expect(s).toBeGreaterThan(180)
    expect(s).toBeLessThan(360)
  })
  it("muscle bebe mais que o roadster", () => {
    expect(consumoDoCarro("muscle")).toBeGreaterThan(consumoDoCarro("roadster"))
    expect(consumoDoCarro("gt")).toBe(1)
  })
  it("gastar nunca passa de zero", () => {
    expect(gastar(0.001, 10, 1)).toBe(0)
  })
  it("a bomba só enche devagar e para no cheio", () => {
    expect(abastecer(0.5, COMBUSTIVEL.abasteceVmax + 1, 1)).toBe(0.5)
    expect(abastecer(0.5, 40, 1)).toBeCloseTo(0.7, 6)
    expect(abastecer(0.95, 40, 1)).toBe(1)
  })
  it("pane seca engasga em pulsos e nunca dá o pé inteiro", () => {
    expect(tetoDoPe(0.01, 0.3)).toBe(1)
    const amostras = Array.from({ length: 50 }, (_, i) => tetoDoPe(0, i * 0.037))
    expect(Math.max(...amostras)).toBe(COMBUSTIVEL.panePe)
    expect(Math.min(...amostras)).toBe(0)
  })
})
