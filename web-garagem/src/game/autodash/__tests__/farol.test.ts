// 17/11: "um botão de liga e desliga para o farol alto, não só o que pisca".
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { PLAYER_Z } from "../engine"

const LARGADA = (i: number, api: { tap(k: string): void; down(k: string): void }) => {
  if (i === 10) api.tap("Enter")
  if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
  if (i === 18) api.tap("Enter")
  if (i === 25) api.tap("Enter")
  if (i === 27) api.down("w")
}

describe("farol alto", () => {
  it("[F] liga e desliga, fica ligado e o carro da frente cede", async () => {
    const estados: boolean[] = []
    let cedeu = false
    await runScenario(60 * 14, 5, (i, api) => {
      LARGADA(i, api)
      if (i === 420 || i === 520) api.tap("f")
    }, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.immuneT = 10; eng.combustivel = 1; eng.eventTimer = 1e9; eng.rachaT = 1e9
      if (i === 410) { // um carro na sua faixa, logo à frente
        eng.traffic.push({ z: eng.position + PLAYER_Z + 2500, offset: eng.playerX, targetOffset: eng.playerX, speed: 80, kind: "car", role: "civilian", color: "#fff", blinkT: 0, prevD: 1 })
      }
      if (i === 419) estados.push(eng.farolAlto)
      if (i === 480) { estados.push(eng.farolAlto); cedeu = eng.traffic.some((t: { yieldT?: number; role: string }) => t.role === "civilian" && (t.yieldT ?? 0) > 0) || eng.traffic.some((t: { targetOffset: number; offset: number }) => t.targetOffset !== t.offset) }
      if (i === 600) estados.push(eng.farolAlto)
    })
    expect(estados).toEqual([false, true, false])
    expect(cedeu, "ninguém cedeu com o farol alto ligado").toBe(true)
  }, 60_000)
})
