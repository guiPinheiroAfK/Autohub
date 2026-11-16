// Fase 8.4: cenário de beira por trechos (world/cenario.ts).
import { describe, it, expect } from "vitest"
import { gerarTrechos, tipoNoSeg, enfeitesDoSegmento, CENARIO, TRECHOS_DO_BIOMA, hash01 } from "../world/cenario"

describe("cenário por trechos", () => {
  it("os trechos cobrem a pista inteira, sem buraco e sem dois iguais seguidos", () => {
    for (const bioma of ["cidade", "costa"]) {
      for (const seed of [1, 42, 99999]) {
        const N = 4000
        const t = gerarTrechos(N, seed, bioma)
        expect(t[0].a).toBe(0)
        expect(t[t.length - 1].b).toBe(N)
        for (let i = 1; i < t.length; i++) {
          expect(t[i].a).toBe(t[i - 1].b)
          expect(t[i].tipo).not.toBe(t[i - 1].tipo)
        }
        for (const x of t.slice(0, -1)) expect(x.b - x.a).toBeGreaterThanOrEqual(CENARIO.trechoMin)
        for (const x of t) expect(TRECHOS_DO_BIOMA[bioma]).toContain(x.tipo)
      }
    }
  })

  it("a mesma pista desenha sempre o mesmo cenário", () => {
    const a = gerarTrechos(3000, 7, "cidade"), b = gerarTrechos(3000, 7, "cidade")
    expect(a).toEqual(b)
    for (let idx = 0; idx < 3000; idx += 37) expect(enfeitesDoSegmento(a, idx, 0)).toEqual(enfeitesDoSegmento(b, idx, 0))
    expect(hash01(123, 4)).toBe(hash01(123, 4))
  })

  it("densidade: no máximo 3 enfeites por segmento e ~2 em média", () => {
    const t = gerarTrechos(4000, 5, "costa")
    let soma = 0, max = 0
    for (let idx = 0; idx < 4000; idx++) {
      const n = enfeitesDoSegmento(t, idx, 7).length
      soma += n; max = Math.max(max, n)
    }
    expect(max).toBeLessThanOrEqual(3)
    expect(soma / 4000).toBeLessThan(2)
  })

  it("na transição os dois tipos se misturam e depois fica só o novo", () => {
    const t = gerarTrechos(4000, 11, "cidade")
    const b = t[1]
    const tipos = new Set<string>()
    for (let idx = b.a; idx < b.a + CENARIO.transicao; idx++) tipos.add(tipoNoSeg(t, idx))
    expect(tipos.size).toBe(2)
    for (let idx = b.a + CENARIO.transicao; idx < b.b; idx++) expect(tipoNoSeg(t, idx)).toBe(b.tipo)
  })
})
