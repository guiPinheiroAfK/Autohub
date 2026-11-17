// Trânsito (playtest 17/11): paredes de 4 faixas, mão dupla e sobreposição de carros.
// Engine real, solo, sem eventos sorteados: o jogador segura 180 km/h e a sonda
// mede o que ele vê à frente.
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { spawnEvent } from "../world/events"
import { PLAYER_Z } from "../engine"


const LARGADA = (i: number, api: { tap(k: string): void; down(k: string): void }) => {
  if (i === 10) api.tap("Enter")
  if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
  if (i === 18) api.tap("Enter")
  if (i === 25) api.tap("Enter")
  if (i === 27) api.down("w")
}

const faixa = (o: number) => Math.round((o + 0.75) / 0.5)

interface Vista { z: number; offset: number; targetOffset: number; role: string; parked?: boolean; kind: string }
const wrap = (eng: { trackLen: number }, a: number, b: number) => {
  let d = a - b
  if (d > eng.trackLen / 2) d -= eng.trackLen
  if (d < -eng.trackLen / 2) d += eng.trackLen
  return d
}

describe("trânsito do solo", () => {
  it("quase nunca fecha as 4 faixas à frente do jogador (janela que dá para ler a 180 km/h)", async () => {
    for (const seed of [3, 77, 2024]) {
      let frames = 0, parede4 = 0, parede3 = 0
      await runScenario(60 * 150, seed, LARGADA, (i, eng) => {
        if (i === 0) eng.render = () => {}
        eng.immuneT = 10; eng.combustivel = 1; eng.eventTimer = 1e9; eng.rachaT = 1e9
        if (i < 40) return
        eng.speed = Math.max(eng.speed, 180); eng.playerX = 0.25
        const pz = eng.position + PLAYER_Z
        const ocupadas = new Set<number>()
        for (const t of eng.traffic as Vista[]) {
          if (t.parked || t.role === "police") continue
          const d = wrap(eng, t.z, pz)
          if (d > 600 && d < 6000) ocupadas.add(faixa(t.offset))
        }
        frames++
        if (ocupadas.size >= 4) parede4++
        if (ocupadas.size >= 3) parede3++
      })
      expect(parede4 / frames, `seed ${seed}: parede de 4 faixas`).toBeLessThan(0.01)
      expect(parede3 / frames, `seed ${seed}: 3 de 4 faixas`).toBeLessThan(0.35)
    }
  }, 120_000)

  for (const [rotulo, pontos] of [["calmo", 0], ["caótico", 80000]] as const) it(`mão dupla (${rotulo}): civil não entra na contramão e a pista da direita não vira parede`, async () => {
    let invasoes = 0, parede2 = 0, frames = 0, contra = 0, paradosEsq = 0, esquerdaVista = 0
    await runScenario(60 * 70, 41, LARGADA, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.immuneT = 10; eng.combustivel = 1; eng.rachaT = 1e9; eng.eventTimer = 1e9
      if (i < 120) eng.score = pontos
      if (i === 120) { eng.zones = []; spawnEvent(eng, "wrongway") }
      if (i < 120) return
      eng.speed = Math.max(eng.speed, 180); eng.playerX = 0.5
      const pz = eng.position + PLAYER_Z
      const zn = eng.zones.find((z: { type: string }) => z.type === "wrongway")
      if (!zn) return
      const dentro = wrap(eng, pz, zn.z) > 9000 && wrap(eng, zn.end, pz) > 6000
      if (!dentro) return
      frames++
      const ocupadas = new Set<number>()
      for (const t of eng.traffic as Vista[]) {
        const d = wrap(eng, t.z, pz)
        if (t.role === "civilian" && d > 600 && d < 40000 && wrap(eng, t.z, zn.z) > 0 && wrap(eng, zn.end, t.z) > 0 && (t.offset < 0.05 || t.targetOffset < 0.05)) invasoes++
        if (t.role === "civilian" && d > 600 && d < 6000) ocupadas.add(faixa(t.offset))
        if (t.role === "oncoming" && d > 0 && d < 40000) contra++
        if (t.role === "civilian" && !t.parked && d > -2000 && d < 60000 && t.offset < -0.05 && wrap(eng, zn.end, t.z) > 0) { esquerdaVista++; if (((t as unknown as { vReal?: number }).vReal ?? 99) < 25) paradosEsq++ }
      }
      if (ocupadas.has(2) && ocupadas.has(3)) parede2++
    })
    console.log("MD2", rotulo, { frames, invasoes, esquerdaVista, paradosEsq, parede2, contra })
    expect(frames).toBeGreaterThan(300)
    expect(paradosEsq / frames, "civis parados na esquerda da mão dupla").toBeLessThan(0.1)
    expect(esquerdaVista / frames, "civis na esquerda da mão dupla (por quadro)").toBeLessThan(0.5)
    expect(invasoes / frames, "civis na contramão por quadro (era ~3,5)").toBeLessThan(0.3)
    expect(parede2 / frames, "as 2 faixas da direita cheias ao mesmo tempo").toBeLessThan(0.15)
    expect(contra).toBeGreaterThan(0) // ainda tem contramão
  }, 120_000)
})

describe("faixa fechada à frente (blitz, obra, carro batido)", () => {
  for (const evento of ["blitz", "obra", "oleo", "speedtrap"] as const) {
    it(`${evento}: o civil sai da faixa fechada em vez de parar atrás dela para sempre`, async () => {
      for (const seed of [8, 515]) {
        const parado = new Map<object, number>()
        let pior = 0
        await runScenario(60 * 70, seed, LARGADA, (i, eng) => {
          if (i === 0) eng.render = () => {}
          eng.immuneT = 10; eng.combustivel = 1; eng.rachaT = 1e9; eng.eventTimer = 1e9
          if (i === 150) { eng.zones = []; spawnEvent(eng, evento) }
          if (i < 150) return
          // o jogador passa devagar atrás do trânsito (o evento chega até os carros)
          eng.speed = Math.max(eng.speed, 110); eng.playerX = 0.25
          for (const t of eng.traffic as (Vista & { vReal?: number })[]) {
            if (t.role !== "civilian" || t.parked) continue
            const rel = wrap(eng, t.z, eng.position + PLAYER_Z)
            if (rel < -2000 || rel > 90000) { parado.delete(t); continue }
            if ((t.vReal ?? 99) < 2) { const n = (parado.get(t) ?? 0) + 1; parado.set(t, n); pior = Math.max(pior, n) } else parado.set(t, 0)
          }
        })
        expect(pior, `${evento} seed ${seed}: carro parado por ${(pior / 60).toFixed(1)} s`).toBeLessThan(60 * 8)
      }
    }, 120_000)
  }
})
