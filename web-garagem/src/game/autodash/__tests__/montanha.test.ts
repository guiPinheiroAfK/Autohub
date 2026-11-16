// Playtest 16/11 ("o Touge!" + docs/specs/autodash/MONTANHA-COSTA-PRAIA.md): a
// serra abre uma montanha na pista à frente: sobe, mirante, desce. O relevo é
// somado ao de antes sem degrau, a pista na tela não muda, e o rival do touge
// chama no mirante.
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { spawnMontanha, faseNoSeg } from "../world/montanha"
import { trocarRegiao } from "../world/regiao"
import { DRAW_DIST, SEG_LEN } from "../data"
import { PLAYER_Z } from "../engine"

const LARGADA = (i: number, api: { tap(k: string): void; down(k: string): void }) => {
  if (i === 10) api.tap("Enter")
  if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
  if (i === 18) api.tap("Enter")
  if (i === 25) api.tap("Enter")
  if (i === 27) api.down("w")
}

describe("montanha da serra", () => {
  it("sobe e desce sem degrau, não mexe na tela, e o rival chama no mirante", async () => {
    let ok = false, degrau = 0, mexeuNaTela = false, altura = 0, chamou = false, fases = new Set<string>()
    await runScenario(60 * 50, 4, LARGADA, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.immuneT = 10; eng.combustivel = 1
      if (i === 360) {
        trocarRegiao(eng, "serra", false)
        const N = eng.segments.length, base = Math.floor(eng.position / SEG_LEN)
        const tela = Array.from({ length: DRAW_DIST }, (_, k) => eng.segments[(base + k) % N].y1)
        ok = spawnMontanha(eng, true)
        const N2 = eng.segments.length // a volta cresce para caber a viagem
        mexeuNaTela = tela.some((y, k) => y !== eng.segments[(base + k) % N2].y1)
        for (let k = 0; k < N2; k++) {
          const s = eng.segments[k], prox = eng.segments[(k + 1) % N2]
          degrau = Math.max(degrau, Math.abs(s.y2 - prox.y1))
        }
        const m = eng.montanha!
        for (let k = 0; k < m.total; k++) altura = Math.max(altura, eng.segments[(m.a + k) % N2].y1 - eng.segments[m.a].y1)
        // pula para perto do mirante, a 150 km/h
        let acc = 0
        for (const [f, n] of m.fases) { if (f === "mirante") break; acc += n }
        eng.position = ((m.a + acc) % N2) * SEG_LEN - PLAYER_Z; eng.speed = 150
      }
      if (i > 360 && eng.montanha) {
        const idx = Math.floor((eng.position + PLAYER_Z) / SEG_LEN) % eng.segments.length
        const f = faseNoSeg(eng, idx); if (f) fases.add(f)
        if (eng.touge) chamou = true
        eng.speed = Math.max(eng.speed, 120)
      }
    })
    expect(ok, "a montanha não coube").toBe(true)
    expect(mexeuNaTela, "mudou a pista que estava na tela").toBe(false)
    expect(degrau, "degrau no relevo").toBeLessThan(1) // (a pista já tem ~0,1 u de arredondamento; o relevo mede milhares)
    expect(altura).toBeGreaterThan(3000)
    expect(fases.has("mirante")).toBe(true)
    expect(chamou, "o rival não chamou no mirante").toBe(true)
  }, 120_000)
})
