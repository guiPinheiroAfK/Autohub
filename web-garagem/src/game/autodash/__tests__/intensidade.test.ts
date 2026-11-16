// Playtest 16/11: "mudar como o trânsito complica conforme sobem os pontos" e
// "passando a placa da serra já fica escuro de novo".
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { intensidade, carrosAlvo, chanceOnda, fatorTroca, tipoPorIntensidade, estagio, INTENSIDADE } from "../traffic/intensidade"
import { skyNow } from "../render/backdrop"
import { biomeById } from "../world/biomes"
import { TICKS_PER_DAY } from "../world/clock"

const LARGADA = (i: number, api: { tap(k: string): void; down(k: string): void }) => {
  if (i === 10) api.tap("Enter")
  if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
  if (i === 18) api.tap("Enter")
  if (i === 25) api.tap("Enter")
  if (i === 27) api.down("w")
}

describe("intensidade do trânsito", () => {
  it("cresce com os pontos e muda o jeito, não só a quantidade", () => {
    const eng = { mode: "solo", score: 0 } as never as Parameters<typeof intensidade>[0]
    expect(intensidade(eng)).toBe(0)
    ;(eng as { score: number }).score = INTENSIDADE.pontosMax * 2
    expect(intensidade(eng)).toBe(1)
    expect(carrosAlvo(1)).toBeGreaterThan(carrosAlvo(0))
    expect(carrosAlvo(1)).toBeLessThanOrEqual(INTENSIDADE.carros[1]) // com teto
    expect(chanceOnda(1)).toBeGreaterThan(chanceOnda(0))
    expect(fatorTroca(1)).toBeGreaterThan(fatorTroca(0))
    // calmo: quase só carro; caótico: bem mais moto e caminhão
    const conta = (k: number) => {
      const c: Record<string, number> = {}
      for (let i = 0; i < 1000; i++) { const t = tipoPorIntensidade(k, i / 1000); c[t] = (c[t] ?? 0) + 1 }
      return c
    }
    const calmo = conta(0), caos = conta(1)
    expect(calmo.car).toBeGreaterThan(700)
    expect(caos.moto).toBeGreaterThan(calmo.moto ?? 0)
    expect(caos.truck).toBeGreaterThan(calmo.truck)
    expect([0, 0.3, 0.6, 0.9].map(estagio)).toEqual([0, 1, 2, 3])
  })

  it("com muitos pontos, nascem ondas e há freada brusca, mas a pista quase nunca fecha", async () => {
    let onda = false, freada = false, paredes = 0, quadros = 0
    await runScenario(60 * 40, 12, LARGADA, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.immuneT = 10; eng.combustivel = 1; eng.eventTimer = 1e9
      if (i < 360) return
      eng.score = Math.max(eng.score, INTENSIDADE.pontosMax)
      const civis = eng.traffic.filter((t: { role: string; parked?: boolean }) => t.role === "civilian" && !t.parked)
      if (civis.some((t: { sustoT?: number }) => (t.sustoT ?? 0) > 0)) freada = true
      // onda: 2+ civis em faixas diferentes a menos de 600 u um do outro
      // (só quem está assentado na faixa: no meio de uma troca ele está entre duas)
      const assentados = civis.filter((t: { offset: number; targetOffset: number }) => t.offset === t.targetOffset)
      quadros++
      let parede = false
      const frente = eng.position + 1500
      for (const a of assentados) {
        const juntos = assentados.filter((b: { z: number }) => Math.abs(b.z - a.z) < 600)
        const faixas = new Set(juntos.map((b: { offset: number }) => Math.round((b.offset + 0.75) / 0.5)))
        if (faixas.size >= 2) onda = true
        const d = a.z - frente
        if (faixas.size >= 4 && d > 0 && d < 20000) parede = true // as 4 faixas fechadas logo à frente
      }
      if (parede) paredes++
    })
    expect(onda, "não nasceu onda").toBe(true)
    expect(freada, "nenhuma freada brusca").toBe(true)
    // o movimento ainda junta 4 de vez em quando, mas é raro e se desfaz
    expect(paredes / quadros, "as 4 faixas fechadas à frente com frequência").toBeLessThan(0.02)
  }, 120_000)
})

describe("céu da viagem", () => {
  it("rodovia, serra e costa são de dia a qualquer hora (a cidade é a noite)", () => {
    for (const id of ["rodovia", "serra", "costa"]) {
      for (let h = 0; h < 24; h++) {
        const eng = {
          bioma: biomeById(id), biomaAnt: null, biomaMix: 1, mode: "solo", horaModo: "dia",
          clima: "limpo", climaMix: 1, climaAnt: null, clock: { tick: ((h - 6 + 24) % 24) / 24 * TICKS_PER_DAY },
        } as never as Parameters<typeof skyNow>[0]
        expect(skyNow(eng).amb, `${id} às ${h}h`).toBeGreaterThanOrEqual(0.7)
      }
    }
  })
})
