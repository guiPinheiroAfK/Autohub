// Cenário da polícia por estrelas (Fase 6) no engine real, com o harness
// determinístico. Não é golden: confere as regras pelo estado do engine.
// Sem trânsito civil (a sonda apaga) para a partida não acabar numa batida, e
// sem render (a sonda desliga): o teste é de regra, não de desenho.
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { ESTRELAS, FURADO_TETO, ESFRIA_S } from "../world/policia"
import { CARS } from "../data"

const LARGADA = (i: number, api: { tap(k: string): void; down(k: string): void }) => {
  if (i === 10) api.tap("Enter")                    // menu -> pede nome
  if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])  // digita o nome
  if (i === 18) api.tap("Enter")                    // garagem
  if (i === 25) api.tap("Enter")                    // largada solo
  if (i === 27) api.down("w")                       // pé no fundo até o fim
}

const viaturas = (eng: any) => eng.traffic.filter((t: any) => t.role === "police" && !t.parked)

describe("polícia por estrelas — cenário no engine", () => {
  it("3★: reforço, pregos com faixa livre, pneu furado, despiste e esfriamento", async () => {
    const O = 300 // quadro em que sobe para 3★ (tecla O três vezes)
    const fatos: Record<string, any> = {}
    let pregosZ: number | null = null
    let furouEm = -1
    let despisteEm = -1
    let afastou = false
    let calorAnterior = 0

    await runScenario(O + 60 * 40, 424242, (i, api) => {
      LARGADA(i, api)
      if (i === O || i === O + 1 || i === O + 2) api.tap("o")
    }, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.traffic = eng.traffic.filter((t: any) => t.role !== "civilian" && t.role !== "oncoming")
      eng.eventTimer = 1e9 // sem evento de mapa sorteado: o teste é da polícia
      if (i === O + 3) {
        fatos.estado = eng.state
        fatos.estrelas = Math.floor(eng.policia.calor)
        fatos.viaturas = viaturas(eng).map((t: any) => ({ top: t.top, accel: t.accel }))
      }
      // pregos: anota o primeiro tapete e mira o carro numa faixa coberta
      const pregos = eng.obstacles.filter((o: any) => o.kind === "pregos")
      if (pregos.length && pregosZ === null) {
        pregosZ = pregos[0].z
        const cobertas = new Set(pregos.map((o: any) => o.offset))
        fatos.pregos = { faixas: pregos.length, livres: eng.laneCenters.filter((c: number) => !cobertas.has(c)).length }
        fatos.placas = eng.roadSigns.filter((s: any) => s.type === "policia").length
        fatos.viaturaAcostamento = eng.traffic.some((t: any) => t.parked && Math.abs(t.offset) > 1)
        fatos.mira = pregos[0].offset
      }
      if (pregosZ !== null && furouEm < 0) eng.playerX = fatos.mira
      if (furouEm < 0 && eng.policia.furadoT > 0) furouEm = i
      if (furouEm > 0 && i === furouEm + 240) {
        fatos.velFurado = eng.speed
        fatos.furadoT = eng.policia.furadoT
      }
      // despiste: em reta limpa o carro (244) deixa as viaturas (222) para trás
      // sozinho. Se ainda não aconteceu depois do pneu, elas são jogadas 40.000 u
      // para trás (ninguém vê).
      if (i > O + 3 && despisteEm < 0 && viaturas(eng).length === 0) {
        despisteEm = i
        fatos.calorAntes = calorAnterior
        fatos.calorDespiste = eng.policia.calor
        fatos.esfriaT = eng.policia.esfriaT
      }
      if (furouEm > 0 && i >= furouEm + 300 && despisteEm < 0 && !afastou) {
        afastou = true
        for (const t of viaturas(eng)) t.z = ((eng.position - 40000) % eng.trackLen + eng.trackLen) % eng.trackLen
      }
      calorAnterior = eng.policia.calor
      if (despisteEm > 0 && i === despisteEm + Math.ceil(ESFRIA_S * 60) + 5) fatos.calorEsfriou = eng.policia.calor
      fatos.estadoFinal = eng.state
    })

    const top = CARS[0].topSpeed
    expect(fatos.estado).toBe("racing")
    expect(fatos.estrelas).toBe(3)
    // reforço: as viaturas da estrela, com teto e arrancada da tabela
    expect(fatos.viaturas).toHaveLength(ESTRELAS[2].viaturas)
    for (const v of fatos.viaturas) {
      expect(v.top).toBe(Math.min(ESTRELAS[2].teto, top - 8))
      expect(v.accel).toBe(ESTRELAS[2].arrancada)
    }
    // E8: tapete em 2 faixas (3★), sempre com faixa livre, placas e viatura no acostamento
    expect(fatos.pregos.faixas).toBe(2)
    expect(fatos.pregos.livres).toBeGreaterThanOrEqual(1)
    expect(fatos.placas).toBe(3)
    expect(fatos.viaturaAcostamento).toBe(true)
    // pneu furado: o carro segue, mas abaixo do teto do furado
    expect(furouEm).toBeGreaterThan(0)
    expect(fatos.furadoT).toBeGreaterThan(0)
    expect(fatos.velFurado).toBeLessThanOrEqual(top * FURADO_TETO + 0.5)
    expect(fatos.velFurado).toBeGreaterThan(60)
    // despiste: viaturas somem, o calor perde a fração e depois esfria uma estrela
    expect(despisteEm).toBeGreaterThan(0)
    expect(fatos.calorDespiste).toBe(Math.floor(fatos.calorAntes))
    expect(fatos.calorDespiste).toBeGreaterThanOrEqual(3)
    expect(fatos.esfriaT).toBe(ESFRIA_S)
    expect(fatos.calorEsfriou).toBe(fatos.calorDespiste - 1)
    expect(fatos.estadoFinal).toBe("racing")
  }, 180_000)
})
