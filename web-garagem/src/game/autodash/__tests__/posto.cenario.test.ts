// Fase 8.2: posto com carros abastecendo na faixa de fora. Engine real, solo:
// com o tanque baixo o posto abre à frente com 1–3 carros parados nas bombas,
// sempre fora da pista e fora da sua faixa de bomba.
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { postoAFrente, postoPatio, POSTO_FAIXA } from "../world/posto"
import { PLAYER_Z as PLAYER_Z_TESTE } from "../engine"

const LARGADA = (i: number, api: { tap(k: string): void; down(k: string): void }) => {
  if (i === 10) api.tap("Enter")
  if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
  if (i === 18) api.tap("Enter")
  if (i === 25) api.tap("Enter")
  if (i === 27) api.down("w")
}

describe("posto com carros", () => {
  it("abre com carros parados só na faixa de fora", async () => {
    let visto = false, parados = 0, ok = true
    await runScenario(60 * 20, 77, LARGADA, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.immuneT = 10
      if (i === 60 * 6) eng.combustivel = 0.3 // abaixo de chamaPosto: o posto abre
      const r = postoAFrente(eng)
      if (!r || visto) return
      visto = true
      const pt = postoPatio(r)
      const meus = eng.traffic.filter(t => t.parked && t.role === "civilian")
      parados = meus.length
      for (const t of meus) {
        const x = t.offset * r.lado
        // fora da pista (> 1), além da ilha e dentro do pátio
        if (x <= 1 || x < pt.inner + POSTO_FAIXA || x > pt.outer) ok = false
      }
    })
    expect(visto, "o posto não abriu").toBe(true)
    expect(parados).toBeGreaterThanOrEqual(1)
    expect(parados).toBeLessThanOrEqual(3)
    expect(ok, "carro parado fora do lugar").toBe(true)
  }, 60_000)
})

describe("carro saindo do posto", () => {
  it("com você chegando, o da frente termina, sai pelo pátio e entra na pista", async () => {
    let soltou = false, entrou = false
    await runScenario(60 * 30, 77, LARGADA, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.immuneT = 10
      if (i === 60 * 6) eng.combustivel = 0.3
      const r = postoAFrente(eng)
      if (r && !soltou && i > 60 * 6) {
        const meus = eng.traffic.filter(t => t.posto === r.id)
        if (meus.length && !meus.some(t => t.saindoPosto)) {
          // você logo atrás do pátio, devagar (sem passar pelos carros)
          const z = Math.min(...meus.map(t => t.z)) - 6000
          eng.position = z - PLAYER_Z_TESTE; eng.speed = 20; eng.playerX = 0
        }
      }
      for (const t of eng.traffic) {
        if (t.saindoPosto) soltou = true
        if (soltou && t.saindoPosto === false && t.offset < 0.95) entrou = true
      }
      if (soltou) eng.speed = Math.min(eng.speed, 20)
    })
    expect(soltou, "nenhum carro saiu do posto").toBe(true)
    expect(entrou, "o carro não entrou na pista").toBe(true)
  }, 90_000)
})
