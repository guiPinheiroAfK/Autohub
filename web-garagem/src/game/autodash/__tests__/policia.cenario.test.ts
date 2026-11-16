// Cenário da polícia por estrelas (Fase 6) no engine real, com o harness
// determinístico. Não é golden: confere as regras pelo estado do engine.
// Sem trânsito civil (a sonda apaga) para a partida não acabar numa batida, e
// sem render (a sonda desliga): o teste é de regra, não de desenho.
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { ESTRELAS, FURADO_TETO, ESFRIA_S, BONUS_FRESTA, INFRACOES } from "../world/policia"
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
    const O = 400 // quadro em que sobe para 3★ (tecla O três vezes; depois da partida e do semáforo)
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
      if (pregosZ !== null && furouEm < 0) {
        eng.playerX = fatos.mira
        fatos.viaturaNaChegada = eng.traffic.some((t: any) => t.parked && Math.abs(t.offset) > 1)
      }
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
    expect(fatos.viaturaNaChegada).toBe(true) // não some antes de o carro chegar
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

  it("4★: bloqueio com fresta no meio, passar nela dá bônus e esquenta", async () => {
    const O = 400 // depois da partida do motor e do semáforo
    const fatos: Record<string, any> = {}
    let bloqueio: { z: number; fresta: number } | null = null
    let cruzou = -1
    await runScenario(O + 60 * 30, 515151, (i, api) => {
      LARGADA(i, api)
      if (i >= O && i <= O + 3) api.tap("o")
    }, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.traffic = eng.traffic.filter((t: any) => t.role !== "civilian" && t.role !== "oncoming")
      eng.eventTimer = 1e9
      // sem encostão: as viaturas da caçada ficam longe (o teste é do bloqueio)
      for (const t of viaturas(eng)) t.z = ((eng.position - 8000) % eng.trackLen + eng.trackLen) % eng.trackLen
      if (!bloqueio && eng.policia.bloqueios.length) {
        bloqueio = eng.policia.bloqueios[0]
        const vs = eng.traffic.filter((t: any) => t.kind === "roadblock")
        fatos.viaturas = vs.length
        fatos.mesmaLinha = vs.every((t: any) => t.z === bloqueio!.z && t.parked)
        fatos.frestaLivre = !vs.some((t: any) => t.offset === bloqueio!.fresta)
        fatos.frestaNoMeio = Math.abs(bloqueio.fresta) < 0.5
      }
      // até cruzar: mira a fresta e guarda placar e calor do quadro anterior
      if (bloqueio && cruzou < 0) {
        if (eng.policia.bloqueios[0]?.checado ?? true) {
          cruzou = i
          fatos.ganho = eng.score - fatos.scoreAntes
          fatos.esquentou = eng.policia.calor - fatos.calorAntes
          fatos.estado = eng.state
        } else {
          eng.playerX = bloqueio.fresta
          fatos.viaturasNaChegada = eng.traffic.filter((t: any) => t.kind === "roadblock").length
          fatos.scoreAntes = eng.score
          fatos.calorAntes = eng.policia.calor
        }
      }
    })
    expect(bloqueio).not.toBeNull()
    expect(fatos.viaturas).toBe(3)
    expect(fatos.mesmaLinha).toBe(true)
    expect(fatos.frestaLivre).toBe(true)
    expect(fatos.frestaNoMeio).toBe(true)
    expect(cruzou).toBeGreaterThan(0)
    expect(fatos.viaturasNaChegada).toBe(3) // continuam lá quando o carro chega
    expect(fatos.estado).toBe("racing")
    expect(fatos.ganho).toBeGreaterThanOrEqual(BONUS_FRESTA)
    expect(fatos.esquentou).toBeGreaterThanOrEqual(INFRACOES.bloqueio)
  }, 60_000)

  it("5★: o helicóptero vê pelo holofote, e pé no fundo em reta tira o carro da luz", async () => {
    const O = 400 // depois da partida do motor e do semáforo
    const fatos: Record<string, any> = { heliVeio: -1, vistoSoPeloHeli: false, saiuDaLuz: false, despiste: -1 }
    await runScenario(O + 60 * 70, 616161, (i, api) => {
      LARGADA(i, api)
      if (i >= O && i <= O + 4) api.tap("o")
    }, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.traffic = eng.traffic.filter((t: any) => t.role !== "civilian" && t.role !== "oncoming")
      eng.eventTimer = 1e9
      eng.obstacles = eng.obstacles.filter((o: any) => o.kind !== "pregos")
      eng.traffic = eng.traffic.filter((t: any) => t.kind !== "roadblock")
      eng.playerX = 0
      // as viaturas ficam longe: quem te vê é só o helicóptero
      for (const t of viaturas(eng)) t.z = ((eng.position - 30000) % eng.trackLen + eng.trackLen) % eng.trackLen
      const p = eng.policia
      if (p.heli && fatos.heliVeio < 0) fatos.heliVeio = i
      if (p.holofote && p.visto) fatos.vistoSoPeloHeli = true
      if (fatos.vistoSoPeloHeli && p.heli && !p.holofote) fatos.saiuDaLuz = true
      if (i > O + 5 && fatos.despiste < 0 && viaturas(eng).length === 0) {
        fatos.despiste = i
        fatos.heliDepois = p.heli
      }
    })
    expect(fatos.heliVeio).toBeGreaterThan(O)
    expect(fatos.vistoSoPeloHeli).toBe(true)
    expect(fatos.saiuDaLuz).toBe(true)
    expect(fatos.despiste).toBeGreaterThan(fatos.heliVeio)
    expect(fatos.heliDepois).toBeNull()
  }, 60_000)

  it("atalho de teste: garagem [L] larga em 1★ e as teclas 0–5 definem as estrelas", async () => {
    const f: Record<string, any> = {}
    await runScenario(1500, 717171, (i, api) => {
      if (i === 10) api.tap("Enter")
      if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
      if (i === 18) api.tap("Enter")
      if (i === 25) api.tap("l")      // garagem -> teste de polícia
      if (i === 27) api.down("w")
      if (i === 400) api.tap("3")
      if (i === 1000) api.tap("5")
      if (i === 1300) api.tap("0")
    }, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.traffic = eng.traffic.filter((t: any) => t.role !== "civilian")
      const snap = () => ({ estrelas: Math.floor(eng.policia.calor), viaturas: viaturas(eng).length, heli: !!eng.policia.heli, semEventos: eng.eventTimer > 1e8 })
      if (i === 399) f.largada = snap()
      if (i === 401) f.tres = snap()
      if (i === 999) f.tresDepois = snap() // 10 s depois: o calor não sobe sozinho no teste
      if (i === 1100) f.cinco = snap()
      if (i === 1301) f.zero = snap()
      f.estado = eng.state
    })
    expect(f.largada).toMatchObject({ estrelas: 1, viaturas: 1, semEventos: true })
    expect(f.tres).toMatchObject({ estrelas: 3, viaturas: 3, heli: false })
    expect(f.tresDepois.estrelas).toBeLessThanOrEqual(3)
    expect(f.cinco).toMatchObject({ estrelas: 5, viaturas: 4, heli: true })
    expect(f.zero).toMatchObject({ estrelas: 0, viaturas: 0, heli: false })
    expect(f.estado).toBe("racing")
  }, 60_000)
})
