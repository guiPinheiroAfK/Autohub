// 17/11: "cadê a colisão? guard-rails não fazem nada". A borda segura o carro na serra.
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { trocarRegiao } from "../world/regiao"
import { limitesLaterais } from "../world/bordas"
import { SEG_LEN } from "../data"
import { PLAYER_Z } from "../engine"

const LARGADA = (i: number, api: { tap(k: string): void; down(k: string): void }) => {
  if (i === 10) api.tap("Enter")
  if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
  if (i === 18) api.tap("Enter")
  if (i === 25) api.tap("Enter")
  if (i === 27) api.down("w")
}

describe("guard-rail e paredão", () => {
  it("na subida da serra o carro não atravessa nem o paredão nem o guard-rail", async () => {
    let maxX = 0, minX = 0, raspou = false, velAntes = 0, velDepois = 0, limites: { esq: number; dir: number } | null = null
    await runScenario(60 * 14, 5, LARGADA, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.immuneT = 10; eng.combustivel = 1; eng.eventTimer = 1e9; eng.rachaT = 1e9
      if (i === 400) { trocarRegiao(eng, "serra", true) }
      if (!eng.montanha || i < 405) return
      if (i === 405) eng.position = (eng.montanha.a + 1200) * SEG_LEN - PLAYER_Z // meio da subida
      const idx = Math.floor((eng.position + PLAYER_Z) / SEG_LEN)
      limites = limitesLaterais(eng, idx)
      // (o que o engine deixou depois do quadro, antes de o teste empurrar de novo)
      if (i === 430) velDepois = eng.speed // depois de raspar um quadro (o teste põe 150 antes)
      if (i > 421) { maxX = Math.max(maxX, eng.playerX); minX = Math.min(minX, eng.playerX) }
      if (i >= 420 && i < 480) { eng.speed = 150; eng.playerX = 1.5; velAntes = eng.speed } // empurra para a direita
      if (i >= 480 && i < 540) { eng.speed = 150; eng.playerX = -1.5 } // e para a esquerda
      raspou = raspou || eng.naBorda
    })
    expect(limites, "sem limites na subida").not.toBeNull()
    expect(maxX, "atravessou o lado direito").toBeLessThanOrEqual(1.045)
    expect(minX, "atravessou o lado esquerdo").toBeGreaterThanOrEqual(-1.045)
    expect(raspou).toBe(true)
    expect(velAntes).toBeGreaterThan(velDepois) // raspar custa velocidade (150 → menos)
  }, 60_000)
})
