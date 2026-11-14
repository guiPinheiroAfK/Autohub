import { describe, it, expect } from "vitest"
import { advanceClock, dayFrac, formatHour, hourOf, newClock, tickForHour, TICKS_PER_DAY, TICK_S } from "../world/clock"
import { CLIMAS, climaDaJanela, climaNoTick, JANELA_TICKS } from "../world/weather"

describe("relógio em ticks (ADR 0013)", () => {
  it("tick 0 é o amanhecer e um dia tem 24000 ticks (20 min)", () => {
    expect(hourOf(0)).toBe(6)
    expect(hourOf(6000)).toBe(12)
    expect(hourOf(12000)).toBe(18)
    expect(hourOf(18000)).toBe(0)
    expect(TICKS_PER_DAY * TICK_S).toBe(20 * 60)
  })

  it("tickForHour e formatHour são inversos", () => {
    for (const h of [0, 6, 9, 12, 18, 23]) {
      expect(hourOf(tickForHour(h))).toBeCloseTo(h, 6)
    }
    expect(formatHour(tickForHour(9))).toBe("09:00")
    expect(formatHour(tickForHour(18.5))).toBe("18:30")
  })

  it("acumula dt de quadro em ticks inteiros, sem perder sobra", () => {
    const c = newClock("ciclo")
    const t0 = c.tick
    let n = 0
    for (let i = 0; i < 600; i++) n += advanceClock(c, 1 / 60) // 10 s a 60 fps
    expect(n).toBe(200)
    expect(c.tick - t0).toBe(200)
  })

  it("horário fixo não anda; ciclo ×2 anda o dobro", () => {
    const fixo = newClock("noite")
    advanceClock(fixo, 5)
    expect(hourOf(fixo.tick)).toBe(0)
    const rapido = newClock("ciclo", 2)
    const t0 = rapido.tick
    advanceClock(rapido, 1)
    expect(rapido.tick - t0).toBe(40)
  })

  it("o ciclo começa às 9h (mesmo céu de largada de antes)", () => {
    expect(formatHour(newClock("ciclo").tick)).toBe("09:00")
    expect(dayFrac(newClock("ciclo").tick)).toBeCloseTo(0.125, 6)
  })
})

describe("clima (ADR 0013)", () => {
  const todos = ["limpo", "nublado", "chuva", "neblina"]

  it("chuva mantém a física de antes (grip ×0,62, freio 78)", () => {
    expect(CLIMAS.chuva.grip).toBe(0.62)
    expect(105 * CLIMAS.chuva.freio).toBeCloseTo(78, 9)
    expect(CLIMAS.limpo.grip).toBe(1)
    expect(CLIMAS.limpo.visib).toBe(1)
  })

  it("a largada (janela 0) é sempre limpa", () => {
    for (let seed = 0; seed < 50; seed++) expect(climaDaJanela(todos, seed, 0)).toBe("limpo")
  })

  it("mesma seed e janela dão o mesmo clima (replay determinístico)", () => {
    for (let j = 1; j < 30; j++) expect(climaDaJanela(todos, 1234, j)).toBe(climaDaJanela(todos, 1234, j))
  })

  it("só sorteia climas que o bioma aceita", () => {
    for (let j = 1; j < 200; j++) expect(["limpo", "chuva"]).toContain(climaDaJanela(["limpo", "chuva"], 7, j))
  })

  it("a distribuição segue os pesos (limpo é o mais comum, todos aparecem)", () => {
    const n: Record<string, number> = {}
    for (let s = 0; s < 40; s++) for (let j = 1; j <= 100; j++) {
      const c = climaDaJanela(todos, s, j); n[c] = (n[c] ?? 0) + 1
    }
    expect(n.limpo / 4000).toBeGreaterThan(0.5)
    for (const c of todos) expect(n[c]).toBeGreaterThan(0)
  })

  it("modo fixo ignora o sorteio; o clima só vira na janela de 1 minuto", () => {
    expect(climaNoTick("neblina", todos, 1, 0)).toBe("neblina")
    expect(climaNoTick("sorteio", todos, 99, JANELA_TICKS - 1)).toBe("limpo")
    expect(JANELA_TICKS * TICK_S).toBe(60)
  })
})
