// Cenários de equivalência além da partida solo: corrida com bots e tela de duelo.
// Cada cenário grava um snapshot do hash de tudo que o engine desenha. Se a
// corrida ou o duelo mudarem de comportamento durante a refatoração, o teste falha.

import { describe, it, expect } from "vitest"
import { runScenario, drive } from "./harness"

describe("AutoDash — cenários golden (corrida e duelo)", () => {
  it("corrida com bots: lobby -> largada -> pilotagem -> pausa", async () => {
    const result = await runScenario(1500, 777001, (i, api) => {
      if (i === 10) api.tap("c")        // menu -> lobby da corrida
      if (i === 20) api.tap("Enter")    // lobby -> corrida com bots
      drive(i, api, 60)
      if (i === 300) api.tap("p")       // tenta pausar (tecla pode não existir: vale do mesmo jeito)
      if (i === 330) api.tap("p")
    })
    expect({ frames: result.frames, calls: result.calls, hash: result.hash, finalState: result.finalState, finalMode: result.finalMode }).toMatchSnapshot()
  }, 180_000)

  it("tela de duelo sem rede: menu -> lobby do duelo -> voltar", async () => {
    const result = await runScenario(300, 777002, (i, api) => {
      if (i === 10) api.tap("d")        // menu -> sem nome salvo: pede nome (destino: lobby do duelo)
      if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12]) // digita o nome
      if (i === 18) api.tap("Enter")    // confirma nome -> lobby do duelo
      if (i === 150) api.tap("Escape")  // tenta voltar
    })
    expect({ frames: result.frames, calls: result.calls, hash: result.hash, finalState: result.finalState, finalMode: result.finalMode }).toMatchSnapshot()
  }, 180_000)
})
