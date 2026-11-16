// Fase 8.5: biomas com traçado próprio e a região mudando ao longo da partida.
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { BIOMES } from "../world/biomes"
import { trocarRegiao, regiaoNaVirada, REGIAO } from "../world/regiao"
import { TRECHOS_DO_BIOMA } from "../world/cenario"
import { DRAW_DIST, SEG_LEN } from "../data"
import { setClima, climaAtual, TRANSICAO } from "../sim/clima"

const LARGADA = (i: number, api: { tap(k: string): void; down(k: string): void }) => {
  if (i === 10) api.tap("Enter")
  if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
  if (i === 18) api.tap("Enter")
  if (i === 25) api.tap("Enter")
  if (i === 27) api.down("w")
}

describe("biomas e regiões", () => {
  it("serra e rodovia existem, com traçado e trechos próprios", () => {
    for (const id of ["serra", "rodovia"]) {
      expect(BIOMES[id].tracado).toBeDefined()
      expect(TRECHOS_DO_BIOMA[id].length).toBeGreaterThan(1)
    }
    expect(BIOMES.serra.tracado!.curva).toBeGreaterThan(1)
    expect(BIOMES.rodovia.tracado!.reta).toBeGreaterThan(1)
    expect(BIOMES.serra.climas.filter(c => c === "neblina").length).toBe(2)
    expect(BIOMES.cidade.tracado).toBeUndefined() // a cidade é a pista de sempre (golden)
  })

  it("trocar de região muda bioma e cenário e reescala só as curvas fora da tela", async () => {
    let ok = false
    await runScenario(60 * 6, 5, LARGADA, (i, eng) => {
      if (i === 0) eng.render = () => {}
      if (i !== 300) return
      const N = eng.segments.length, base = Math.floor(eng.position / SEG_LEN)
      const antes = eng.segments.map((s: { curve: number }) => s.curve)
      expect(eng.bioma.id).toBe("cidade")
      trocarRegiao(eng, "serra")
      expect(eng.bioma.id).toBe("serra")
      // o primeiro trecho é o cenário que estava na tela, mantido até depois do horizonte
      const [mantido, ...resto] = eng.cenario
      expect(mantido.a).toBe(base % N)
      expect(mantido.b - mantido.a).toBeGreaterThanOrEqual(DRAW_DIST)
      for (const t of resto) expect(TRECHOS_DO_BIOMA.serra).toContain(t.tipo)
      expect(eng.biomaAnt?.id).toBe("cidade")
      expect(eng.biomaMix).toBe(0)
      const k = BIOMES.serra.tracado!.curva
      for (let n = 0; n < DRAW_DIST; n++) expect(eng.segments[(base + n) % N].curve).toBe(antes[(base + n) % N])
      const longe = (base + DRAW_DIST + 50) % N
      expect(eng.segments[longe].curve).toBeCloseTo(antes[longe] * k, 9)
      ok = true
    })
    expect(ok).toBe(true)
  }, 60_000)

  it("a região só muda a cada REGIAO.cadaNiveis níveis, no solo", async () => {
    let trocas = 0
    await runScenario(60 * 4, 6, LARGADA, (i, eng) => {
      if (i === 0) eng.render = () => {}
      if (i !== 200) return
      let id = eng.bioma.id
      for (let n = 1; n <= 9; n++) { regiaoNaVirada(eng, n); if (eng.bioma.id !== id) { trocas++; id = eng.bioma.id } }
    })
    expect(trocas).toBe(Math.floor(9 / REGIAO.cadaNiveis))
  }, 60_000)
})

describe("transições suaves (16/11)", () => {
  it("a região nova entra aos poucos e o clima novo se mistura ao anterior", async () => {
    let meioBioma = -1, fimBioma = -1, gripMeio = 0, chuvaMeio = -1
    await runScenario(60 * 16, 5, LARGADA, (i, eng) => {
      if (i === 0) eng.render = () => {}
      if (i === 300) { trocarRegiao(eng, "costa"); setClima(eng, "limpo"); setClima(eng, "chuva", true) }
      if (i === 300 + Math.round(60 * TRANSICAO.biomaS / 2)) meioBioma = eng.biomaMix
      if (i === 300 + Math.round(60 * TRANSICAO.climaS / 2)) { const c = climaAtual(eng); gripMeio = c.grip; chuvaMeio = c.chuvaK }
      if (i === 300 + 60 * (TRANSICAO.climaS + 1)) fimBioma = eng.biomaMix
    })
    expect(meioBioma).toBeGreaterThan(0.3); expect(meioBioma).toBeLessThan(0.7)
    expect(fimBioma).toBe(1)
    // no meio da troca limpo → chuva a aderência está entre as duas
    expect(gripMeio).toBeLessThan(1); expect(gripMeio).toBeGreaterThan(0.62)
    expect(chuvaMeio).toBeGreaterThan(0.3); expect(chuvaMeio).toBeLessThan(0.7)
  }, 60_000)
})
