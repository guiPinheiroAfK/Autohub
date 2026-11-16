// Fase 8.5: biomas com traçado próprio e a região mudando ao longo da partida.
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { BIOMES } from "../world/biomes"
import { trocarRegiao, regiaoNaVirada, REGIAO } from "../world/regiao"
import { TRECHOS_DO_BIOMA } from "../world/cenario"
import { DRAW_DIST, SEG_LEN } from "../data"

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
      for (const t of eng.cenario) expect(TRECHOS_DO_BIOMA.serra).toContain(t.tipo)
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
