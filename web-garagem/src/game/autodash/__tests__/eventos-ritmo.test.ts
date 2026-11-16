// Ritmo dos eventos e cartões de aviso (world/events.ts, world/avisos.ts).
// Unidade: intervalo por nível e sorteio sem repetição. Cenário: o engine real
// por alguns minutos de solo, conferindo que todo evento vira cartão, que o
// próximo só sai depois que o anterior acabou e que os cartões não acumulam.
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { RITMO, intervaloEventos, sortearEvento, type EventoMapa } from "../world/events"
import { arrumarFloaters } from "../fx/particles"

const LARGADA = (i: number, api: { tap(k: string): void; down(k: string): void }) => {
  if (i === 10) api.tap("Enter")
  if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
  if (i === 18) api.tap("Enter")
  if (i === 25) api.tap("Enter")
  if (i === 27) api.down("w")
}

describe("ritmo dos eventos", () => {
  it("o intervalo encurta com o nível e para no piso", () => {
    for (const u of [0, 0.5, 0.999]) {
      const n1 = intervaloEventos(0, u)
      expect(n1).toBeGreaterThanOrEqual(RITMO.intervaloS[0]); expect(n1).toBeLessThanOrEqual(RITMO.intervaloS[1])
      let antes = Infinity
      for (let nivel = 0; nivel < 12; nivel++) {
        const v = intervaloEventos(nivel, u)
        expect(v).toBeLessThanOrEqual(antes); antes = v
        expect(v).toBeGreaterThanOrEqual(RITMO.intervaloMinS[0])
      }
    }
  })

  it("não sorteia nenhum dos últimos eventos", () => {
    const pool: EventoMapa[] = ["obstacles", "viaduct", "wrongway", "bridge", "obra"]
    let ultimos: EventoMapa[] = []
    for (let i = 0; i < 500; i++) {
      const k = sortearEvento(pool, ultimos, (i * 0.6180339887) % 1)
      expect(ultimos).not.toContain(k)
      ultimos = [k, ...ultimos].slice(0, RITMO.semRepetir)
    }
    // pool menor que a memória: ainda devolve alguém
    expect(sortearEvento(["bridge"], ["bridge"], 0.3)).toBe("bridge")
  })

  it("texto flutuante novo desce para baixo do que já está na tela", () => {
    const eng = { floaters: [
      { text: "a", color: "", y: 200, life: 1, big: false },
      { text: "b", color: "", y: 200, life: 1, big: true },
      { text: "c", color: "", y: 205, life: 1, big: false },
    ] } as unknown as Parameters<typeof arrumarFloaters>[0]
    arrumarFloaters(eng)
    const ys = eng.floaters.map(f => f.y)
    for (let i = 0; i < ys.length; i++) for (let j = i + 1; j < ys.length; j++) expect(Math.abs(ys[i] - ys[j])).toBeGreaterThanOrEqual(26)
  })
})

describe("eventos no engine", () => {
  it("todo evento vira cartão, o próximo espera o anterior acabar e os cartões não acumulam", async () => {
    for (const seed of [11, 4242]) {
      const sorteados: string[] = []
      let lista: unknown = null, maxCartoes = 0, saiuComEventoAtivo = 0, semCartao = 0
      await runScenario(60 * 240, seed, LARGADA, (i, eng) => {
        if (i === 0) { eng.render = () => {} }
        eng.immuneT = 10; eng.combustivel = 1; eng.rachaT = 1e9
        // a lista é trocada a cada sorteio: este é o quadro em que o evento nasceu
        // (a largada também troca a lista, por uma vazia)
        if (eng.ultimosEventos !== lista && eng.ultimosEventos.length > 0) {
          lista = eng.ultimosEventos
          sorteados.push(eng.ultimosEventos[0])
          const ativos = eng.avisos.filter(a => a.saindo < 0)
          if (ativos.length === 0) semCartao++
          if (ativos.length > 1) saiuComEventoAtivo++
        }
        maxCartoes = Math.max(maxCartoes, eng.avisos.length)
      })
      if (process.env.EVENTOS_LOG) console.log(seed, sorteados.join(" "))
      expect(sorteados.length, "eventos em 4 min").toBeGreaterThanOrEqual(4)
      for (let i = 1; i < sorteados.length; i++) expect(sorteados[i], "repetiu em seguida").not.toBe(sorteados[i - 1])
      expect(semCartao, "evento sem cartão").toBe(0)
      expect(saiuComEventoAtivo, "evento novo com outro ainda ativo").toBe(0)
      expect(maxCartoes).toBeLessThanOrEqual(3)
    }
  }, 120_000)
})
