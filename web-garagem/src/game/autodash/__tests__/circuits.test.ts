import { describe, it, expect } from "vitest"
import { CIRCUITS, montarCircuito, validarCircuito, circuitById } from "../world/circuits"
import { ramalPerfil, ramalBordas, ramalNoSeg, sobreRamal, ganhoRamal, RAMAL_ABRE, RAMAL_COLADO, RAMAL_DESCOLA, type Ramal } from "../world/ramais"

describe("circuitos fixos", () => {
  it("há pelo menos três circuitos, com ids únicos", () => {
    expect(CIRCUITS.length).toBeGreaterThanOrEqual(3)
    expect(new Set(CIRCUITS.map(c => c.id)).size).toBe(CIRCUITS.length)
    expect(circuitById("anel-shibuya")?.nome).toBe("Anel de Shibuya")
    expect(circuitById("nao-existe")).toBeNull()
  })

  for (const def of CIRCUITS) {
    it(`${def.id}: fecha o loop, tem tamanho de volta e ramais válidos`, () => {
      expect(validarCircuito(def)).toEqual([])
    })

    it(`${def.id}: a montagem é determinística (mesma definição, mesma pista)`, () => {
      const a = montarCircuito(def), b = montarCircuito(def)
      expect(a.segments).toEqual(b.segments)
      expect(a.ramais).toEqual(b.ramais)
    })

    it(`${def.id}: tem pelo menos um ramal e trechos com nome`, () => {
      const m = montarCircuito(def)
      expect(m.ramais.length).toBeGreaterThanOrEqual(1)
      expect(m.trechos.length).toBeGreaterThanOrEqual(4)
    })
  }
})

describe("ramal paralelo", () => {
  const r: Ramal = { id: "t", nome: "Teste", a: 1000, b: 1600, lado: 1, afast: 0.5, larg: 0.6, ganho: 1.2 }
  const miolo = 1300

  it("fora do trecho não existe", () => {
    expect(ramalPerfil(r, 999)).toBeNull()
    expect(ramalPerfil(r, 1601)).toBeNull()
    expect(ramalNoSeg([r], 500)).toBeNull()
  })

  it("abre nas pontas, corre colado e só depois descola", () => {
    expect(ramalPerfil(r, 1000)).toEqual({ f: 0, w: 0 })
    expect(ramalPerfil(r, 1000 + RAMAL_ABRE)).toEqual({ f: 0, w: 1 })
    expect(ramalPerfil(r, 1000 + RAMAL_ABRE + RAMAL_COLADO)!.f).toBe(0)
    expect(ramalPerfil(r, 1000 + RAMAL_ABRE + RAMAL_COLADO + RAMAL_DESCOLA)!.f).toBe(1)
    expect(ramalPerfil(r, miolo)).toEqual({ f: 1, w: 1 })
  })

  it("é simétrico: a saída espelha a entrada", () => {
    for (const d of [0, 5, 60, 130, 150, 200]) {
      expect(ramalPerfil(r, r.a + d)).toEqual(ramalPerfil(r, r.b - d))
    }
  })

  it("colado encosta na pista; separado deixa a grama do afastamento", () => {
    const colado = ramalBordas(r, { f: 0, w: 1 })
    expect(colado.inner).toBeCloseTo(0.97, 9)
    const sep = ramalBordas(r, { f: 1, w: 1 })
    expect(sep.inner).toBeCloseTo(1.11 + r.afast, 9)
    expect(sep.outer - sep.inner).toBeCloseTo(r.larg, 9)
  })

  it("o carro só conta como no ramal dentro do asfalto dele", () => {
    const q = ramalNoSeg([r], miolo)!
    const centro = (q.inner + q.outer) / 2
    expect(sobreRamal(q, centro)).toBe(true)
    expect(sobreRamal(q, 1.3)).toBe(false)            // grama entre a pista e o ramal
    expect(sobreRamal(q, q.outer + 0.3)).toBe(false)  // passou da borda de fora
    expect(sobreRamal(q, -centro)).toBe(false)        // lado errado
  })

  it("o ganho só vale no miolo, em cima do ramal", () => {
    const q = ramalNoSeg([r], miolo)!
    const centro = (q.inner + q.outer) / 2
    expect(ganhoRamal(q, centro)).toBe(1.2)
    expect(ganhoRamal(q, 0.5)).toBe(1)                // na pista principal
    expect(ganhoRamal(q, 1.3)).toBe(1)                // na grama
    const entrada = ramalNoSeg([r], r.a + 60)!        // faixa colada de entrada
    expect(ganhoRamal(entrada, 1.3)).toBe(1)
    expect(ganhoRamal(null, 1.5)).toBe(1)
  })

  it("ramal à esquerda espelha o lado", () => {
    const e: Ramal = { ...r, lado: -1 }
    const q = ramalNoSeg([e], miolo)!
    const centro = (q.inner + q.outer) / 2
    expect(sobreRamal(q, -centro)).toBe(true)
    expect(sobreRamal(q, centro)).toBe(false)
    expect(ganhoRamal(q, -centro)).toBe(1.2)
  })
})
