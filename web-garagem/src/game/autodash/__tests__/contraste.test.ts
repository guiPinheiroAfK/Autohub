import { describe, it, expect } from "vitest"
import { razaoContraste, luminancia, leituraPintura, ASFALTO } from "../cosmetic/contraste"

describe("contraste da pintura (Fase 7, prévia)", () => {
  it("bate com a tabela da pesquisa contra o asfalto atual", () => {
    // visual-e-desafio.md §1.4: vermelho 1,4 · azul 1,1 · branco 5,9 · amarelo 4,0
    expect(razaoContraste("#e0342f", ASFALTO)).toBeCloseTo(1.4, 1)
    expect(razaoContraste("#1d4ed8", ASFALTO)).toBeCloseTo(1.1, 1)
    expect(razaoContraste("#f8fafc", ASFALTO)).toBeCloseTo(5.9, 1)
    expect(razaoContraste("#facc15", ASFALTO)).toBeCloseTo(4.0, 1)
  })

  it("lê rgb() do shade igual ao hex", () => {
    expect(luminancia("rgb(255,255,255)")).toBeCloseTo(1)
    expect(luminancia("#000000")).toBe(0)
    expect(luminancia("rgb(224,52,47)")).toBeCloseTo(luminancia("#e0342f"))
  })

  it("dá nota: azul some, branco destaca, vermelho some também à noite", () => {
    expect(leituraPintura("#1d4ed8", 1).nota).toBe("some")
    expect(leituraPintura("#f8fafc", 1).nota).toBe("destaca")
    // à noite os dois escurecem juntos perto do preto: vermelho continua sumindo
    expect(leituraPintura("#e0342f", 0.42).nota).toBe("some")
  })
})
