// Partida do motor: animação de duração fixa antes do semáforo, sem tempo contado.
import { describe, it, expect } from "vitest"
import { runScenario, FRAME_MS } from "./harness"
import { PARTIDA_S, giroDaPartida, tremidaDaPartida } from "../sim/partida"

describe("partida — funções", () => {
  it("o giro começa baixo, só sobe na pegada e termina na lenta", () => {
    const idle = 900
    expect(giroDaPartida(idle, PARTIDA_S)).toBeLessThan(idle * 0.3)
    expect(giroDaPartida(idle, PARTIDA_S * 0.5)).toBeLessThan(idle * 0.3)
    expect(giroDaPartida(idle, 0)).toBeCloseTo(idle, 5)
  })
  it("a tremida fica entre 0 e 1 e some no fim", () => {
    for (let r = PARTIDA_S; r > 0; r -= 0.01) {
      const t = tremidaDaPartida(r)
      expect(t).toBeGreaterThanOrEqual(0)
      expect(t).toBeLessThanOrEqual(1)
    }
    expect(tremidaDaPartida(0)).toBe(0)
  })
})

describe("partida — cenário no engine", () => {
  it("countT fica parado, o semáforo não acende e o pé não sobe giro; depois a contagem começa do zero", async () => {
    let fimDaPartida = -1
    let primeiroCountT = -1
    let giroMaxNaPartida = 0
    let idle = 0
    let ruim = ""
    await runScenario(260, 777, (i, api) => {
      if (i === 10) api.tap("Enter")
      if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
      if (i === 18) api.tap("Enter")
      if (i === 25) api.tap("Enter")      // largada solo
      if (i === 26) api.down("w")         // pé no fundo durante a partida
    }, (i, eng) => {
      if (i === 0) eng.render = () => {}
      if (eng.state !== "countdown" && eng.state !== "racing") return
      if (eng.partidaT > 0) {
        if (eng.countT !== 0) ruim = `countT andou na partida (quadro ${i})`
        if (eng.greenFired) ruim = "verde na partida"
        if (eng.score !== 0 || eng.km !== 0) ruim = "pontuação/km na partida"
        giroMaxNaPartida = Math.max(giroMaxNaPartida, eng.rpm)
      } else if (eng.state === "countdown") {
        if (fimDaPartida < 0) { fimDaPartida = i; idle = eng.rpm }
        if (eng.countT > 0 && primeiroCountT < 0) primeiroCountT = i
      }
    })
    expect(ruim).toBe("")
    expect(fimDaPartida).toBeGreaterThan(0)
    // a etapa dura PARTIDA_S (quadros de 1/60 s) e a contagem só anda depois
    expect(primeiroCountT).toBeGreaterThanOrEqual(fimDaPartida)
    expect((fimDaPartida - 26) * FRAME_MS / 1000).toBeGreaterThan(PARTIDA_S - 0.1)
    expect((fimDaPartida - 26) * FRAME_MS / 1000).toBeLessThan(PARTIDA_S + 0.1)
    // acelerando no fundo, o giro na partida nunca passou da lenta
    expect(giroMaxNaPartida).toBeLessThanOrEqual(idle + 1)
  })
})
