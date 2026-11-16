// Fase 8.6: viaduto com elevado. Engine real, solo: o elevado sobe até o platô
// no cruzamento e desce; quem dirige por ele não cai nem sai da pista, a câmera
// sobe junto, e os carros do elevado seguem o centro dele sem se sobrepor.
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { spawnEvent, VIADUTO } from "../world/events"
import { ramalNoSeg, ramalCentro, elevacao, type Ramal } from "../world/ramais"
import { PLAYER_Z } from "../engine"
import { SEG_LEN } from "../data"
import { KINDS } from "../traffic/types"

const LARGADA = (i: number, api: { tap(k: string): void; down(k: string): void }) => {
  if (i === 10) api.tap("Enter")
  if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
  if (i === 18) api.tap("Enter")
  if (i === 25) api.tap("Enter")
  if (i === 27) api.down("w")
}

describe("viaduto com elevado", () => {
  it("sobe até o platô, desce de volta e não derruba quem segue por ele", async () => {
    let r: Ramal | undefined
    let maxElev = 0, fora = 0, camera = 0, bateu = false, terminou = false, sobrepos = 0, sobeRamal = 0
    await runScenario(60 * 40, 3, LARGADA, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.immuneT = 10; eng.combustivel = 1
      if (i === 200) {
        eng.eventTimer = 1e9; eng.zones = []
        spawnEvent(eng, "viaduct")
        r = eng.ramais.find((q: Ramal) => q.alto)
        if (!r) return
        // põe o carro na faixa colada do elevado, já andando
        eng.position = (r.a + 40) * SEG_LEN - PLAYER_Z
        eng.playerX = 1.28; eng.speed = 150
      }
      if (!r || i <= 200 || terminou) return
      const idx = Math.floor((eng.position + PLAYER_Z) / SEG_LEN) % eng.segments.length
      // (a altura é a do quadro: o carro já andou ~1,6 segmento depois dela)
      // "dirige" pelo centro do elevado (o volante do teste)
      const q = ramalNoSeg(eng.ramais, idx)
      if (q && q.r === r) eng.playerX = ramalCentro(q)
      eng.speed = Math.max(eng.speed, 150)
      maxElev = Math.max(maxElev, eng.elevJogador)
      if (eng.offroadT > 0) fora++
      if (eng.crashed) bateu = true
      if (elevacao(r, idx) > 0 && Math.abs(eng.elevJogador - elevacao(r, idx)) > 150) camera++
      // carros do elevado: nenhum dentro do outro
      const lá = eng.traffic.filter((t: { offset: number }) => t.offset > 1.1)
      for (let a = 0; a < lá.length; a++) for (let b = a + 1; b < lá.length; b++) {
        if (Math.abs(lá[a].offset - lá[b].offset) < 0.3 && Math.abs(lá[a].z - lá[b].z) < KINDS.car.len) sobrepos++
      }
      sobeRamal = Math.max(sobeRamal, lá.length)
      if (idx > r.b + 5) terminou = true
    })
    expect(r, "o elevado não coube").toBeDefined()
    expect(terminou, "não chegou ao fim do elevado").toBe(true)
    expect(maxElev).toBeGreaterThan(VIADUTO.alto * 0.95)
    expect(fora, "saiu da pista").toBe(0)
    expect(camera, "a câmera não acompanhou o tabuleiro").toBe(0)
    expect(bateu).toBe(false)
    expect(sobrepos).toBe(0)
    expect(sobeRamal).toBeGreaterThan(0)
  }, 120_000)
})

describe("viatura de tocaia no viaduto", () => {
  it("só com você procurado; quando você passa, ela sai atrás", async () => {
    let nasceu = false, saiu = false, semEstrela = true
    await runScenario(60 * 12, 4, LARGADA, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.immuneT = 10; eng.combustivel = 1
      if (i === 150) { eng.eventTimer = 1e9; eng.zones = []; spawnEvent(eng, "viaduct"); semEstrela = !eng.traffic.some((t: { tocaia?: boolean }) => t.tocaia) }
      if (i === 200) {
        eng.eventTimer = 1e9; eng.zones = []; eng.ramais = []
        eng.policia.calor = 1.5 // 1★
        spawnEvent(eng, "viaduct")
        const t = eng.traffic.find((x: { tocaia?: boolean }) => x.tocaia)
        nasceu = !!t
        if (t) { eng.position = t.z + 1000 - PLAYER_Z; eng.speed = 100 } // você acabou de passar
      }
      if (i > 210 && eng.traffic.some((t: { role: string; parked?: boolean; offset: number }) => t.role === "police" && !t.parked && t.offset < -0.5)) saiu = true
    })
    expect(semEstrela, "tocaia sem estrela").toBe(true)
    expect(nasceu).toBe(true)
    expect(saiu, "a viatura não saiu atrás").toBe(true)
  }, 60_000)
})
