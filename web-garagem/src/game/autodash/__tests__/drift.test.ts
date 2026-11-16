// Playtest 16/11: "seria legal ter uns trechos que o carro faz tipo um drift".
// Engine real, solo: na zona de drift (curvas em S), segurar Shift com o volante
// para dentro da curva abre a traseira, junta pontos (em dobro na zona) e, ao
// soltar, soma "DRIFT +N" no placar. Bater no meio perde os pontos.
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { spawnZonaDrift, DRIFT, perderDrift } from "../world/drift"
import { PLAYER_Z } from "../engine"
import { SEG_LEN } from "../data"

const LARGADA = (i: number, api: { tap(k: string): void; down(k: string): void }) => {
  if (i === 10) api.tap("Enter")
  if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
  if (i === 18) api.tap("Enter")
  if (i === 25) api.tap("Enter")
  if (i === 27) api.down("w")
}

describe("drift com freio de mão", () => {
  it("na zona, Shift com o volante para dentro da curva abre a traseira e soma pontos em dobro", async () => {
    let zona: { z: number; end: number } | undefined
    let maxAng = 0, somou = 0, x2 = false, scoreAntes = 0
    await runScenario(60 * 20, 5, LARGADA, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.immuneT = 10; eng.combustivel = 1; eng.eventTimer = 1e9
      if (i === 360) {
        eng.zones = []; eng.obstacles = []; eng.traffic = []
        spawnZonaDrift(eng)
        zona = eng.zones.find((z: { type: string }) => z.type === "drift")
        // já dentro da zona, a 130 km/h
        eng.position = zona!.z + 60 * SEG_LEN - PLAYER_Z
        eng.speed = 130; eng.playerX = 0
      }
      if (!zona || i <= 360) return
      eng.traffic = []; eng.obstacles = []
      const idx = Math.floor((eng.position + PLAYER_Z) / SEG_LEN) % eng.segments.length
      const curva = eng.segments[idx].curve
      // o "piloto": volante para dentro da curva e Shift segurado por 3 s; depois solta
      eng.keys.delete("a"); eng.keys.delete("d")
      if (i < 360 + 180) {
        eng.keys.add("shift")
        if (curva > 0.2) eng.keys.add("d"); else if (curva < -0.2) eng.keys.add("a")
        // mantém o carro na pista sem tirar a física (o teste mede ângulo e pontos)
        eng.playerX = Math.max(-0.8, Math.min(0.8, eng.playerX))
      } else eng.keys.delete("shift")
      if (i === 361) scoreAntes = eng.score
      maxAng = Math.max(maxAng, Math.abs(eng.driftAng))
      if (eng.naZonaDrift && eng.driftPts > 0) x2 = true
      if (eng.floaters.some((f: { text: string }) => f.text.startsWith("DRIFT +"))) somou = eng.score - scoreAntes
    })
    expect(zona, "a zona não abriu").toBeDefined()
    expect(maxAng, "a traseira não abriu").toBeGreaterThan(DRIFT.ang * 0.6)
    expect(x2, "não estava dentro da zona").toBe(true)
    expect(somou, "o drift não somou pontos").toBeGreaterThan(DRIFT.minPontos)
  }, 90_000)

  it("bater no meio do drift perde os pontos", async () => {
    let perdeu = false
    await runScenario(60 * 8, 6, LARGADA, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.immuneT = 10; eng.combustivel = 1
      if (i === 360) { eng.driftPts = 500; perderDrift(eng); perdeu = eng.driftPts === 0 && eng.floaters.some((f: { text: string }) => f.text === "DRIFT PERDIDO") }
    })
    expect(perdeu).toBe(true)
  }, 60_000)
})
