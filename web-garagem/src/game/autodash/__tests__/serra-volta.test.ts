// A viagem da serra fica DENTRO da volta. Sem aplanar depois que o jogador sai, a
// próxima passada pelo mesmo trecho subia a montanha de novo, com o cenário da
// praia flutuando no morro (playtest 17/11).
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { trocarRegiao } from "../world/regiao"
import { spawnMontanha, esquecerMontanha } from "../world/montanha"
import { SEG_LEN } from "../data"
import { PLAYER_Z } from "../engine"

const LARGADA = (i: number, api: { tap(k: string): void; down(k: string): void }) => {
  if (i === 10) api.tap("Enter")
  if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
  if (i === 18) api.tap("Enter")
  if (i === 25) api.tap("Enter")
  if (i === 27) api.down("w")
}

describe("serra que acabou", () => {
  it("o relevo dela é aplanado quando o jogador sai, e não antes", async () => {
    let a = -1, total = 0, topoDentro = 0, topoDepois = -1, nitidoAntes = false
    await runScenario(60 * 12, 5, LARGADA, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.immuneT = 10; eng.combustivel = 1; eng.eventTimer = 1e9; eng.rachaT = 1e9
      if (i === 400) {
        trocarRegiao(eng, "serra", false); esquecerMontanha(eng); spawnMontanha(eng, true)
        a = eng.montanha.a; total = eng.montanha.total
        for (let k = 0; k < total; k++) topoDentro = Math.max(topoDentro, eng.segments[a + k].y1)
        expect(topoDentro).toBeGreaterThan(5000) // a subida existe
      }
      if (a < 0) return
      eng.speed = Math.max(eng.speed, 120); eng.playerX = 0.25
      const idx = Math.floor((eng.position + PLAYER_Z) / SEG_LEN)
      if (i === 410) eng.position = (a + 1500) * SEG_LEN - PLAYER_Z // no meio da serra
      if (i === 411) { for (let k = 0; k < total; k++) if (eng.segments[a + k].y1 > 5000) nitidoAntes = true }
      if (i === 450) eng.position = (a + total + 10) * SEG_LEN - PLAYER_Z // saiu pela religa
      if (i === 460 && idx > a + total) {
        topoDepois = 0
        for (let k = 0; k < total; k++) topoDepois = Math.max(topoDepois, Math.abs(eng.segments[a + k].y1 - eng.segments[a].y1))
      }
    })
    expect(nitidoAntes, "aplanou com o jogador ainda dentro").toBe(true)
    expect(topoDepois, "a serra continuou subindo depois que o jogador saiu").toBe(0)
  }, 60_000)
})
