// Vácuo (E9, Fase 5): força pela distância e pela faixa, teto de +4%. Funções puras.
import { describe, it, expect } from "vitest"
import { VACUO, forcaVacuo, empurraoVacuo } from "../sim/vacuo"
import { arrasto, arrastoExcedente } from "../physics/arrasto"

describe("vácuo", () => {
  it("só vale colado atrás, na mesma faixa, com o da frente andando", () => {
    expect(forcaVacuo(600, 0, 200, 210)).toBeGreaterThan(0.5)
    expect(forcaVacuo(VACUO.alcanceZ + 1, 0, 200, 210)).toBe(0)   // longe
    expect(forcaVacuo(100, 0, 200, 210)).toBe(0)                    // encostado
    expect(forcaVacuo(600, 0.4, 200, 210)).toBe(0)                  // outra faixa
    expect(forcaVacuo(600, 0, 80, 210)).toBe(0)                     // caminhão lento não puxa
    expect(forcaVacuo(600, 0, 70, 70)).toBe(0)                      // devagar não tem vácuo
  })
  it("mais perto e mais alinhado puxa mais", () => {
    expect(forcaVacuo(500, 0, 200, 210)).toBeGreaterThan(forcaVacuo(1200, 0, 200, 210))
    expect(forcaVacuo(600, 0, 200, 210)).toBeGreaterThan(forcaVacuo(600, 0.18, 200, 210))
  })
  it("empurra até +4% da máxima e para", () => {
    expect(empurraoVacuo(1, 200, 244)).toBeCloseTo(VACUO.acel, 6)
    expect(empurraoVacuo(1, 244 * 1.04, 244)).toBe(0)
    expect(empurraoVacuo(0.5, 244 * 1.025, 244)).toBe(0)
    expect(empurraoVacuo(0, 100, 244)).toBe(0)
  })
  it("no teto o empurrão vence o arrasto excedente (o ganho chega perto dos 4%)", () => {
    const top = 244, v = top * 1.035
    expect(empurraoVacuo(1, v, top)).toBeGreaterThan(arrastoExcedente(v, top))
    expect(arrasto(v)).toBeGreaterThan(0)
  })
})

describe("vácuo no teto do carro", () => {
  it("sem vácuo o carro do passo longitudinal é o mesmo objeto (nada muda)", async () => {
    const { specComVacuo } = await import("../sim/vacuo")
    const spec = { topSpeed: 244 } as Parameters<typeof specComVacuo>[0]
    expect(specComVacuo(spec, 0)).toBe(spec)
    expect(specComVacuo(spec, 1).topSpeed).toBeCloseTo(244 * 1.04, 6)
  })
})
