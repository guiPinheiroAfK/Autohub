// Playtest 16/11: "a serra precisava ter mais coisa caótica, mais emoção, sem
// ser mais difícil, mais completa". Na subida: QUEDA DE BARREIRAS (pedras na
// faixa do paredão) e CAMINHÃO QUEBRADO (na faixa do vale), cada um numa faixa
// só, com placa antes, nascendo perto do jogador (o spawner apaga estacionado
// muito à frente) e ainda lá quando ele chega; a cachoeira respinga na tela.
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { spawnMontanha, faseNoSeg, faixaDoMomento, MOMENTOS_SERRA } from "../world/montanha"
import { trocarRegiao } from "../world/regiao"
import { enfeitesDoSegmento, ENF } from "../world/cenario"
import { DRAW_DIST, SEG_LEN } from "../data"
import { PLAYER_Z } from "../engine"

const LARGADA = (i: number, api: { tap(k: string): void; down(k: string): void }) => {
  if (i === 10) api.tap("Enter")
  if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
  if (i === 18) api.tap("Enter")
  if (i === 25) api.tap("Enter")
  if (i === 27) api.down("w")
}

interface Visto { tipo: string; faixa: number; offsets: number[]; larguras: number[]; placaAntes: boolean; trianguloAntes: boolean; detritos: boolean; presenteNaChegada: boolean }

describe("momentos da subida da serra", () => {
  it("barreiras e caminhão quebrado numa faixa só, com placa antes, e respingo na cachoeira", async () => {
    let ok = false, fases: string[] = [], respingo = 0, k = 0, pulou = -1, criadoAntes = false
    const vistos: Visto[] = []
    await runScenario(60 * 45, 6, LARGADA, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.immuneT = 10; eng.combustivel = 1; eng.eventTimer = 1e9
      if (i === 360) {
        trocarRegiao(eng, "serra", false)
        ok = spawnMontanha(eng)
        fases = eng.montanha ? eng.montanha.momentos.map((mo: { idx: number }) => faseNoSeg(eng, mo.idx)) : []
      }
      const m = eng.montanha
      if (i <= 360 || !m || k >= m.momentos.length) return
      eng.speed = 150
      eng.playerX = 0 // entre as duas faixas do meio
      respingo = Math.max(respingo, eng.respingoT)
      const N = eng.segments.length
      const idx = Math.floor((eng.position + PLAYER_Z) / SEG_LEN) % N
      const mo = m.momentos[k]
      // leva o jogador para um pouco antes de onde o momento nasce
      if (pulou !== k) {
        pulou = k
        criadoAntes = criadoAntes || mo.feito
        eng.position = (mo.idx - Math.ceil(DRAW_DIST * MOMENTOS_SERRA.nasceA) - 40) * SEG_LEN - PLAYER_Z
        return
      }
      if (!mo.feito) return
      const z0 = mo.idx * SEG_LEN
      if (vistos.length === k) {
        // acabou de nascer: o que apareceu
        const faixa = faixaDoMomento(eng, mo.tipo)
        const pedras = eng.obstacles.filter((o: { kind: string; visual?: string; z: number }) => o.kind === "cone" && o.visual === "pedra" && o.z >= z0 && o.z <= z0 + 40 * SEG_LEN)
        const caminhao = eng.traffic.filter((t: { kind: string; parked?: boolean; z: number }) => t.kind === "truck" && t.parked && t.z === z0)
        const label = mo.tipo === "barreira" ? "QUEDA DE BARREIRAS" : "VEÍCULO PARADO"
        const placa = eng.roadSigns.find((s: { label?: string; z: number }) => s.label === label && s.z < z0 && s.z > z0 - 150 * SEG_LEN)
        const tri = eng.obstacles.find((o: { visual?: string; z: number }) => o.visual === "triangulo" && o.z < z0 && o.z > z0 - 4000)
        const det = eng.obstacles.some((o: { visual?: string; z: number }) => o.visual === "detritos" && Math.abs(o.z - z0) < 40 * SEG_LEN)
        const objs = mo.tipo === "barreira" ? pedras : caminhao
        vistos.push({
          tipo: mo.tipo, faixa,
          offsets: objs.map((o: { offset: number }) => o.offset),
          larguras: pedras.map((o: { w: number }) => o.w),
          placaAntes: !!placa, trianguloAntes: !!tri, detritos: det, presenteNaChegada: false,
        })
      }
      // chegou perto: ainda está lá (o spawner não apagou o caminhão)?
      if (idx >= mo.idx - 15) {
        const v = vistos[k]
        v.presenteNaChegada = mo.tipo === "barreira"
          ? eng.obstacles.some((o: { visual?: string; kind: string; z: number }) => o.kind === "cone" && o.visual === "pedra" && o.z >= z0)
          : eng.traffic.some((t: { kind: string; parked?: boolean; z: number }) => t.kind === "truck" && t.parked && t.z === z0)
        k++
      }
    })
    expect(ok, "a montanha não coube").toBe(true)
    expect(fases.every(f => f === "serraMeio"), `momentos fora da subida: ${fases}`).toBe(true)
    expect(criadoAntes, "momento nasceu longe demais (antes do jogador chegar perto)").toBe(false)
    expect(vistos.map(v => v.tipo)).toEqual(["barreira", "caminhao", "barreira", "caminhao"])
    for (const v of vistos) {
      expect(v.placaAntes, `${v.tipo}: sem placa antes`).toBe(true)
      expect(v.presenteNaChegada, `${v.tipo}: sumiu antes do jogador chegar`).toBe(true)
      if (v.tipo === "barreira") {
        expect(v.offsets.length).toBeGreaterThanOrEqual(3)
        expect(v.offsets.length).toBeLessThanOrEqual(4)
        expect(Math.abs(v.faixa)).toBe(0.75)
        expect(v.detritos, "barreira sem detritos").toBe(true)
        // toda pedra cabe na faixa colada ao paredão (faixa de 0,5 de largura)
        v.offsets.forEach((o, j) => expect(Math.abs(o - v.faixa) + v.larguras[j] / 2).toBeLessThan(0.25))
      } else {
        expect(v.offsets).toEqual([v.faixa])
        expect(v.trianguloAntes, "caminhão sem triângulo antes").toBe(true)
      }
    }
    // barreira do lado do paredão, caminhão do lado do vale
    expect(Math.sign(vistos[0].faixa)).toBe(-Math.sign(vistos[1].faixa))
    expect(respingo, "a cachoeira não respingou").toBeGreaterThan(0)
  }, 120_000)

  it("o mirante tem estacionamento e gente olhando a vista, no máximo 3 enfeites por segmento", () => {
    const trechos = [{ a: 0, b: 400, tipo: "mirante" as const }]
    let est = 0, ped = 0, max = 0
    for (let idx = 60; idx < 400; idx++) {
      const e = enfeitesDoSegmento(trechos, idx, ENF.arvore)
      max = Math.max(max, e.length)
      est += e.filter(x => x.kind === ENF.estacionamento).length
      ped += e.filter(x => x.kind === ENF.pedestres).length
    }
    expect(est).toBeGreaterThan(0)
    expect(ped).toBeGreaterThan(0)
    expect(max).toBeLessThanOrEqual(3)
  })
})
