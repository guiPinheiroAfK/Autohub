// Cenário do racha (Fase 5) no engine real, com o harness determinístico.
// Confere a pilotagem do desafiante: não atravessa o trânsito (freia a tempo ou
// contorna) e não abre uma vantagem absurda só porque a pista dele está vazia.
// O jogador fica imune (a sonda) para a partida não acabar numa batida: o teste
// é do desafiante, não de quem pilota o carro do jogador.
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { KINDS } from "../traffic/types"
import { convidarRacha } from "../modes/racha"
import { CARS } from "../data"

const LARGADA = (i: number, api: { tap(k: string): void; down(k: string): void }) => {
  if (i === 10) api.tap("Enter")
  if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
  if (i === 18) api.tap("Enter")
  if (i === 25) api.tap("Enter")
  if (i === 27) api.down("w")
}

async function rodarRacha(seed: number) {
  const CONVITE = 900 // ~15 s de solo: já embalado
  const ultimo = new Map<object, number | undefined>()
  const m = { atravessou: 0, sobreposto: 0, quadros: 0, somaEle: 0, somaEu: 0, vMax: 0, top: 0, venceu: null as boolean | null, fim: -1, maxVantagemEle: 0 }
  let convidou = false
  await runScenario(CONVITE + 60 * 90, seed, (i, api) => {
    LARGADA(i, api)
    if (i === CONVITE + 40) api.tap("f") // pisca o farol: aceita
  }, (i, eng) => {
    if (i === 0) { eng.render = () => {}; eng.eventTimer = 1e9 }
    eng.immuneT = 10; eng.rachaT = 1e9; eng.combustivel = 1
    if (i === CONVITE && !convidou) { convidou = convidarRacha(eng); m.top = CARS[eng.cfg.carIdx].topSpeed }
    const r = eng.racha
    if (r && r.fase === "corrida") {
      const ri = r.rival
      m.vMax = ri.racha.vMax
      m.quadros++; m.somaEle += ri.speed; m.somaEu += eng.speed
      m.maxVantagemEle = Math.max(m.maxVantagemEle, (r.ele - r.eu) * 1000)
      // sobreposição: mesma faixa e o carro dele mais da metade dentro do outro
      // (encostar na traseira num freio brusco do civil não conta); e travessia:
      // o outro estava à frente na mesma faixa e no quadro seguinte ficou atrás
      for (const o of eng.traffic) {
        // contramão (evento do mapa, velocidade negativa) não entra: é o mesmo perigo do jogador
        if (o === ri || o.role === "oncoming" || o.speed < 0 || (o.vReal ?? 0) < 0) continue
        const d = ((o.z - ri.z) % eng.trackLen + eng.trackLen * 1.5) % eng.trackLen - eng.trackLen / 2
        const junto = Math.abs(o.offset - ri.offset) < 0.3
        // (só quando é ELE quem entra: o civil mais rápido que bate atrás dele é do trânsito)
        const culpaDele = d > 0 ? ri.speed > o.speed : ri.speed >= o.speed
        if (junto && Math.abs(d) < KINDS[ri.kind].len / 2 && culpaDele) {
          m.sobreposto++
          if (process.env.RACHA_LOG && m.sobreposto % 3 === 1) console.log("sobre", i, o.kind, o.role, "tgt", ri.targetOffset.toFixed(2), o.targetOffset.toFixed(2), "olhar", ri.racha.olharT.toFixed(2), "blink", (ri.blinkT ?? 0).toFixed(2), "d", Math.round(d), "v", Math.round(ri.speed), Math.round(o.speed), "off", ri.offset.toFixed(2), o.offset.toFixed(2))
        }
        const antes = ultimo.get(o)
        // (salto grande de d = carro reciclado, não travessia; e só conta quando
        // é ELE que passa por dentro, não um civil que o ultrapassa por trás)
        if (junto && antes !== undefined && antes > 0 && d <= 0 && antes - d < 2000 && ri.speed > o.speed) {
          m.atravessou++
          if (process.env.RACHA_LOG) console.log("atravessou", i, o.kind, o.role, "d", Math.round(antes), Math.round(d), "v", Math.round(ri.speed), Math.round(o.speed), "off", ri.offset.toFixed(2), ri.targetOffset.toFixed(2), o.offset.toFixed(2), o.targetOffset.toFixed(2), "olhar", ri.racha.olharT.toFixed(2))
        }
        ultimo.set(o, junto ? d : undefined)
      }
    }
    if (m.quadros > 0 && !eng.racha && m.fim < 0) m.fim = i
  })
  return { ...m, convidou, mediaEle: m.somaEle / m.quadros, mediaEu: m.somaEu / m.quadros }
}

describe("racha — cenário no engine", () => {
  it("o desafiante não atravessa o trânsito e corre num ritmo de quem pega trânsito", async () => {
    for (const seed of [11, 4242, 777]) {
      const m = await rodarRacha(seed)
      if (process.env.RACHA_LOG) console.log(seed, JSON.stringify(m))
      expect(m.convidou).toBe(true)
      expect(m.quadros).toBeGreaterThan(60)
      expect(m.atravessou, "vezes que o desafiante atravessou um carro").toBe(0)
      expect(m.sobreposto, "quadros com o desafiante dentro de outro carro").toBe(0)
      // média abaixo da máxima dele: pega trânsito, ritmo de costura fora de vista e curva
      expect(m.mediaEle).toBeLessThan(m.vMax * 0.95)
    }
  }, 120_000)
})
