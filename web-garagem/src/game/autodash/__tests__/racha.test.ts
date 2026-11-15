// Racha (Fase 5): sorteio do desafiante e quem venceu o sprint. Funções puras.
import { describe, it, expect } from "vitest"
import { DESAFIANTES, RACHA, desafianteDe, venceuRacha } from "../world/racha"

describe("racha", () => {
  it("sorteio cobre todos os desafiantes e nunca sai da lista", () => {
    const vistos = new Set<string>()
    for (let u = 0; u < 1; u += 0.01) vistos.add(desafianteDe(u).nome)
    expect(vistos.size).toBe(DESAFIANTES.length)
    expect(desafianteDe(0.999999).nome).toBe(DESAFIANTES[DESAFIANTES.length - 1].nome)
  })
  it("ritmo dos desafiantes fica perto do carro do jogador (desafio justo, sem elástico)", () => {
    for (const d of DESAFIANTES) {
      expect(d.ritmo).toBeGreaterThan(0.9)
      expect(d.ritmo).toBeLessThan(1.05)
      expect(d.fecha).toBeGreaterThanOrEqual(0)
      expect(d.fecha).toBeLessThanOrEqual(1)
    }
  })
  it("ninguém chegou: sem resultado", () => {
    expect(venceuRacha(1, 2, RACHA.distanciaKm)).toBeNull()
  })
  it("quem chega primeiro vence; empate é do jogador", () => {
    expect(venceuRacha(2.5, 2.4, 2.5)).toBe(true)
    expect(venceuRacha(2.3, 2.51, 2.5)).toBe(false)
    expect(venceuRacha(2.6, 2.6, 2.5)).toBe(true)
  })
})
