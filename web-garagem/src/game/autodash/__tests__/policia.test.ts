// Regras puras da polícia por estrelas (Fase 6, world/policia.ts).
import { describe, it, expect } from "vitest"
import {
  ESTRELAS, INFRACOES, MAX_CALOR, MARGEM_FUGA,
  estrelasDe, nivelDe, tetoViatura, somarCalor,
} from "../world/policia"
import { CARS } from "../data"

describe("polícia por estrelas — tabela", () => {
  it("tem 5 estrelas, e cada uma é pelo menos tão brava quanto a anterior", () => {
    expect(ESTRELAS).toHaveLength(5)
    for (let i = 1; i < ESTRELAS.length; i++) {
      expect(ESTRELAS[i].viaturas).toBeGreaterThanOrEqual(ESTRELAS[i - 1].viaturas)
      expect(ESTRELAS[i].teto).toBeGreaterThan(ESTRELAS[i - 1].teto)
      expect(ESTRELAS[i].arrancada).toBeGreaterThanOrEqual(ESTRELAS[i - 1].arrancada)
      expect(ESTRELAS[i].despisteS).toBeGreaterThan(ESTRELAS[i - 1].despisteS)
    }
  })

  it("2★ mantém a perseguição de antes (teto 215, arrancada 55)", () => {
    expect(ESTRELAS[1].teto).toBe(215)
    expect(ESTRELAS[1].arrancada).toBe(55)
  })
})

describe("polícia por estrelas — calor", () => {
  it("estrelas são a parte inteira do calor, de 0 a 5", () => {
    expect(estrelasDe(0)).toBe(0)
    expect(estrelasDe(0.99)).toBe(0)
    expect(estrelasDe(1)).toBe(1)
    expect(estrelasDe(3.5)).toBe(3)
    expect(estrelasDe(MAX_CALOR)).toBe(5)
    expect(estrelasDe(9)).toBe(5)
    expect(estrelasDe(-1)).toBe(0)
  })

  it("nível só existe com estrela", () => {
    expect(nivelDe(0)).toBeNull()
    expect(nivelDe(1)).toBe(ESTRELAS[0])
    expect(nivelDe(5)).toBe(ESTRELAS[4])
  })

  it("radar dá 1★, blitz dá 2★, e o calor não passa do máximo", () => {
    expect(estrelasDe(somarCalor(0, "radar"))).toBe(1)
    expect(estrelasDe(somarCalor(0, "blitz"))).toBe(2)
    let c = 0
    for (let i = 0; i < 20; i++) c = somarCalor(c, "blitz")
    expect(c).toBe(MAX_CALOR)
    expect(INFRACOES.encostao).toBeLessThan(1)
  })
})

describe("polícia por estrelas — fuga honesta (ADR 0008)", () => {
  it("em 5★ nenhuma viatura alcança o teto de nenhum carro", () => {
    for (const car of CARS) {
      for (const n of ESTRELAS) {
        expect(tetoViatura(n, car.topSpeed)).toBeLessThanOrEqual(car.topSpeed - MARGEM_FUGA)
      }
    }
  })

  it("carro rápido enfrenta o teto da tabela", () => {
    expect(tetoViatura(ESTRELAS[4], 262)).toBe(ESTRELAS[4].teto)
    expect(tetoViatura(ESTRELAS[4], 220)).toBe(220 - MARGEM_FUGA)
  })
})
