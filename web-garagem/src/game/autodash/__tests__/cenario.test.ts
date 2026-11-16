// Fase 8.4: cenário de beira por trechos (world/cenario.ts).
import { describe, it, expect } from "vitest"
import { gerarTrechos, tipoNoSeg, enfeitesDoSegmento, CENARIO, TRECHOS_DO_BIOMA, hash01, ENF, FIACAO, CHEGADA_CIDADE } from "../world/cenario"

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
        const chegada = bioma === "cidade" ? CHEGADA_CIDADE.map(c => c[0]) : []
        for (const x of t) expect([...TRECHOS_DO_BIOMA[bioma], ...chegada]).toContain(x.tipo)
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

describe("cidade Tokyo (16/11)", () => {
  it("chega pelo mato, passa pelos outdoors da entrada e entra em Shibuya", () => {
    const t = gerarTrechos(6000, 4, "cidade")
    expect(t.slice(0, 3).map(x => x.tipo)).toEqual(["mata", "entrada", "shibuya"])
    let outdoors = 0
    for (let idx = t[1].a + CENARIO.transicao; idx < t[1].b; idx++) outdoors += enfeitesDoSegmento(t, idx, 0).filter(e => e.kind === ENF.outdoor).length
    expect(outdoors).toBeGreaterThan(10)
  })

  it("o quarteirão varia: vários tipos e larguras de lote no mesmo distrito", () => {
    const t = gerarTrechos(6000, 4, "cidade")
    const sh = t.find(x => x.tipo === "shibuya")!
    const kinds = new Set<number>(), escalas = new Set<number>()
    for (let idx = sh.a + CENARIO.transicao; idx < sh.b; idx++) for (const e of enfeitesDoSegmento(t, idx, 0)) { kinds.add(e.kind); escalas.add(Math.round(e.escala * 100)) }
    for (const k of [ENF.predioJP, ENF.lojinha, ENF.fachadaShibuya, ENF.pedestres]) expect(kinds).toContain(k)
    expect(escalas.size).toBeGreaterThan(15)
  })

  it("a cidade alterna os distritos e cada um tem os seus enfeites", () => {
    const t = gerarTrechos(6000, 3, "cidade")
    const tipos = new Set(t.map(x => x.tipo))
    for (const d of ["shibuya", "shinjuku", "oficinas"]) expect(tipos).toContain(d)
    const kinds = (tipo: string) => {
      const tr = t.find(x => x.tipo === tipo)!
      const ks = new Set<number>()
      for (let idx = tr.a + CENARIO.transicao; idx < tr.b; idx++) for (const e of enfeitesDoSegmento(t, idx, 0)) ks.add(e.kind)
      return ks
    }
    expect(kinds("shibuya")).toContain(ENF.telaLED)
    expect(kinds("shinjuku")).toContain(ENF.letreiroVertical)
    expect(kinds("oficinas")).toContain(ENF.galpao)
  })

  it("o poste com fiação fica sempre à esquerda, na distância que o desenho usa para achar o par", () => {
    const t = gerarTrechos(6000, 9, "cidade")
    let n = 0
    for (let idx = 0; idx < 6000; idx++) for (const e of enfeitesDoSegmento(t, idx, 0)) {
      if (e.kind !== ENF.fiacao) continue
      n++
      expect(e.lado).toBe(-1); expect(e.dist).toBe(FIACAO.dist); expect(e.escala).toBe(FIACAO.escala)
    }
    expect(n).toBeGreaterThan(10)
  })
})
