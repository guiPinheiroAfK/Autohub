import { describe, it, expect } from "vitest"
import { autoGearTarget, limitesAuto, marchaDoNeutro } from "../physics/gearbox"
import { rpmFor } from "../physics/rpm"
import { motorDe, giroNaFrac } from "../physics/motores"
import { relacoes, relacoesDeN } from "../physics/cambio"
import { CARS } from "../data"
import type { AutoDashEngine } from "../engine"

// Só o que o câmbio lê do engine: marcha, velocidade, giro e o carro.
function eng(gear: number, speed: number, carIdx = 0): AutoDashEngine {
  const e = { gear, speed, rpm: 0, boost: 0, cfg: { carIdx } } as unknown as AutoDashEngine
  e.rpm = rpmFor(e, speed, gear)
  return e
}

// um carro de cada família de motor (V10, V8 de 71, VTEC, rotativo, boxer 6)
const carros = ["gt", "muscle", "ninja", "rotor", "flat6", "ghost"].map(b => CARS.findIndex(c => c.body === b))

describe("câmbio automático", () => {
  for (const ci of carros) {
    const nome = CARS[ci].name
    const L = limitesAuto(motorDe(eng(1, 0, ci)))
    const N = relacoes(CARS[ci]).length

    it(`${nome}: freando na última marcha ele reduz (não fica preso)`, () => {
      let v = 120
      while (rpmFor(eng(N, v, ci), v, N) >= L.rodagem) v -= 1
      expect(autoGearTarget(eng(N, v, ci), false)).toBeLessThan(N)
    })

    it(`${nome}: sem gás, desce até manter o giro de rodagem`, () => {
      for (let v = 20; v <= 250; v += 5) {
        for (let g = 2; g <= N; g++) {
          const t = autoGearTarget(eng(g, v, ci), false)
          expect(t).toBeLessThanOrEqual(g)
          if (t < g) expect(rpmFor(eng(g, v, ci), v, t) >= L.rodagem || t === 1).toBe(true)
        }
      }
    })

    it(`${nome}: kickdown a 120 km/h na última pula pra uma marcha de força`, () => {
      const t = autoGearTarget(eng(N, 120, ci), true)
      expect(t).toBeLessThan(N)
      expect(rpmFor(eng(N, 120, ci), 120, t)).toBeLessThanOrEqual(L.kickdown)
    })

    it(`${nome}: sobe antes da faixa vermelha e não fica caçando marcha`, () => {
      for (let g = 1; g < N; g++) {
        let v = 1
        while (rpmFor(eng(g, v, ci), v, g) <= L.sobe) v += 0.5
        expect(autoGearTarget(eng(g, v, ci), true)).toBe(g + 1)
        expect(autoGearTarget(eng(g + 1, v, ci), true)).toBe(g + 1)
      }
    })

    it(`${nome}: chega na última e volta a reduzir quando desacelera`, () => {
      let g = 1
      for (let v = 5; v <= 250; v += 1) g = autoGearTarget(eng(g, v, ci), true)
      expect(g).toBe(N)
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

describe("câmbio por carro", () => {
  it("1ª e última são as mesmas para qualquer número de marchas", () => {
    for (let n = 3; n <= 10; n++) {
      const r = relacoesDeN(n)
      expect(r.length).toBe(n)
      expect(r[0]).toBeCloseTo(3.4, 9)
      expect(r[n - 1]).toBeCloseTo(0.88, 9)
      for (let i = 1; i < n; i++) expect(r[i]).toBeLessThan(r[i - 1])
    }
  })
  it("6 marchas = as relações de sempre (carros padrão inalterados)", () => {
    expect(relacoesDeN(6)).toEqual([3.4, 2.35, 1.75, 1.38, 1.12, 0.88])
  })
  it("muscle de 4 marchas cai muito mais o giro na troca que o hiper de 9", () => {
    const queda = (n: number) => 1 - relacoesDeN(n)[2] / relacoesDeN(n)[1]
    expect(relacoes(CARS.find(c => c.body === "muscle")!).length).toBe(4)
    expect(relacoes(CARS.find(c => c.body === "ghost")!).length).toBe(9)
    expect(queda(4)).toBeGreaterThan(queda(9) * 2)
  })
})

describe("engatar saindo do neutro", () => {
  for (const ci of carros) {
    const nome = CARS[ci].name
    it(`${nome}: em qualquer velocidade não engata marcha que passe do corte`, () => {
      const m = motorDe(eng(1, 0, ci))
      const N = relacoes(CARS[ci]).length
      const v1 = (() => { let v = 1; while (rpmFor(eng(1, v, ci), v, 1) < m.corte) v++; return v })()
      for (let v = 0; v <= 300; v += 5) {
        const g = marchaDoNeutro(eng(0, v, ci))
        expect(g).toBeGreaterThanOrEqual(1)
        expect(g).toBeLessThanOrEqual(N)
        // acima da velocidade de corte da 1ª, nunca volta para a 1ª
        if (v > v1) expect(g).toBeGreaterThan(1)
        if (rpmFor(eng(N, v, ci), v, N) <= giroNaFrac(m, 0.8)) expect(rpmFor(eng(g, v, ci), v, g)).toBeLessThanOrEqual(giroNaFrac(m, 0.8))
      }
    })
  }
})
