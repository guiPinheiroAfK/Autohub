import { describe, it, expect } from "vitest"
import { giroNaTroca, cambioDe, K_TROCA } from "../physics/troca"
import { MOTORES, faixa } from "../physics/motores"
import { CARS } from "../data"

const DT = 1 / 60

// Simula uma troca inteira de `ms` milissegundos e devolve o giro no fim.
function troca(id: string, de: number, para: number, ms: number, tipo: "H" | "seq" | "dct" | "conv", blipAte = 0) {
  const m = MOTORES[id]
  let rpm = de
  const passos: number[] = []
  for (let t = 0; t < ms / 1000; t += DT) {
    rpm = giroNaTroca(m, rpm, para, DT, tipo, t < blipAte)
    passos.push(rpm)
  }
  return { fim: rpm, passos }
}

describe("giro na troca (R1)", () => {
  it("na subida o giro cai sem saltar e sem passar do alvo", () => {
    const { passos } = troca("v10", 7800, 5600, 220, "H")
    expect(passos[0]).toBeLessThan(7800)
    expect(passos[0]).toBeGreaterThan(7400) // um quadro não teleporta
    for (let i = 1; i < passos.length; i++) {
      expect(passos[i]).toBeLessThanOrEqual(passos[i - 1])
      expect(passos[i]).toBeGreaterThanOrEqual(5600)
    }
  })

  it("rotativo cai rápido; big block de 71 cai preguiçoso", () => {
    const rot = troca("rotativo", 7500, 5000, 200, "H").fim
    const ford = troca("v8-cruzado-ford", 5500, 3000, 200, "H").fim
    // fração do caminho percorrida na mesma troca
    expect((7500 - rot) / 2500).toBeGreaterThan(0.75)
    expect((5500 - ford) / 2500).toBeLessThan(0.45)
  })

  it("DCT chega no giro novo antes do H", () => {
    const h = troca("v8-plano", 8000, 6500, 200, "H").fim
    const dct = troca("v8-plano", 8000, 6500, 200, "dct").fim
    expect(dct).toBeLessThan(h)
    expect(K_TROCA.dct).toBeGreaterThan(K_TROCA.H)
  })

  it("redução com blip passa um pouco do alvo e nunca do corte", () => {
    const m = MOTORES.i4
    const { passos } = troca("i4", 5000, 7000, 300, "seq", 0.1)
    expect(Math.max(...passos)).toBeGreaterThan(7000)
    expect(Math.max(...passos)).toBeLessThan(7000 + 0.05 * faixa(m))
    const perto = troca("i4", 8000, 8600, 300, "seq", 0.3)
    expect(Math.max(...perto.passos)).toBeLessThan(m.corte - 50)
  })

  it("câmbio padrão é H; GT sequencial, TARGA e FANTASMA de dupla embreagem", () => {
    expect(cambioDe(CARS.find(c => c.id === "muscle")!)).toBe("H")
    expect(cambioDe(CARS.find(c => c.id === "gt")!)).toBe("seq")
    expect(cambioDe(CARS.find(c => c.id === "flat6")!)).toBe("dct")
    expect(cambioDe(CARS.find(c => c.id === "ghost")!)).toBe("dct")
  })
})
