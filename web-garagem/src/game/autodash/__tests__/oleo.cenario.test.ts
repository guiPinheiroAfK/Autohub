// Playtest 16/11: "passar em cima do óleo não faz nada". Engine real, solo:
// reto e sem volante pela mancha, o carro tem de sair do lugar de lado, perder
// um pouco de velocidade e patinar.
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { spawnOleo } from "../world/oleo"
import { PLAYER_Z } from "../engine"

const LARGADA = (i: number, api: { tap(k: string): void; down(k: string): void }) => {
  if (i === 10) api.tap("Enter")
  if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
  if (i === 18) api.tap("Enter")
  if (i === 25) api.tap("Enter")
  if (i === 27) api.down("w")
}

describe("óleo na pista", () => {
  it("pisar na mancha tira o carro da linha, segura a velocidade e patina", async () => {
    let x0 = 0, maxDesvio = 0, pisou = false, patinou = false, vAntes = 0, vDepois = 0, mancha: { z: number; offset: number } | undefined
    await runScenario(60 * 14, 21, LARGADA, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.immuneT = 10; eng.combustivel = 1; eng.eventTimer = 1e9
      if (i === 300) {
        eng.zones = []; eng.obstacles = []; eng.traffic = []
        spawnOleo(eng, 1, 0.3)
        mancha = eng.obstacles.find((o: { kind: string }) => o.kind === "oleo")
        // logo antes da mancha grande, na faixa dela, a 150 km/h
        eng.position = mancha!.z - 2500 - PLAYER_Z
        eng.playerX = mancha!.offset; eng.speed = 150; eng.steerVel = 0
        x0 = eng.playerX
      }
      if (!mancha || i <= 300) return
      if (eng.oleoT > 0 && !pisou) { pisou = true; vAntes = eng.speed }
      if (pisou && !vDepois) vDepois = eng.speed
      if (eng.wheelspinT > 0) patinou = true
      if (pisou) maxDesvio = Math.max(maxDesvio, Math.abs(eng.playerX - x0))
    })
    expect(pisou, "não pisou na mancha").toBe(true)
    expect(maxDesvio, "o carro não saiu da linha").toBeGreaterThan(0.15)
    expect(patinou).toBe(true)
    expect(vDepois).toBeLessThan(vAntes + 1)
  }, 60_000)
})
