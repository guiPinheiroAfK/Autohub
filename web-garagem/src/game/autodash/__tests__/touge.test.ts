// Playtest 16/11: "o drift ficou confuso; melhor algo mais fechado, tipo batalha
// de chefe de PS2: aperta na hora certa e escorrega" + "o Touge!".
// Engine real, solo: o duelo de touge abre à frente com o rival; quem aperta
// Shift na hora em cada curva derruba a barra do rival e vence; quem não aperta
// erra todas, sai de frente e perde.
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { spawnTouge, apertouShift, tempoAteEntrada, TOUGE } from "../world/touge"
import { perderDrift } from "../world/drift"

const LARGADA = (i: number, api: { tap(k: string): void; down(k: string): void }) => {
  if (i === 10) api.tap("Enter")
  if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
  if (i === 18) api.tap("Enter")
  if (i === 25) api.tap("Enter")
  if (i === 27) api.down("w")
}

async function duelo(apertar: boolean) {
  let abriu = false, venceu: boolean | null = null, perfeitos = 0, maxAng = 0
  await runScenario(60 * 70, 8, LARGADA, (i, eng) => {
    if (i === 0) eng.render = () => {}
    eng.immuneT = 10; eng.combustivel = 1; eng.eventTimer = 1e9
    if (i === 360) { eng.zones = []; eng.obstacles = []; abriu = spawnTouge(eng) }
    const tg = eng.touge
    if (!tg) return
    eng.traffic = eng.traffic.filter((t: { role: string }) => t.role === "racha")
    eng.playerX = Math.max(-0.9, Math.min(0.9, eng.playerX)) // o "piloto" não sai da pista
    if (tg.fase === "batalha") {
      const c = tg.curvas[tg.atual]
      if (apertar && c && !c.nota && Math.abs(tempoAteEntrada(eng, c)) < 0.03) apertouShift(eng)
    }
    maxAng = Math.max(maxAng, Math.abs(eng.driftAng))
    perfeitos = tg.curvas.filter((c: { nota: string | null }) => c.nota === "perfeito").length
    if (tg.fase === "fim" && venceu === null) venceu = tg.vidaRival < tg.vidaVoce
  })
  return { abriu, venceu, perfeitos, maxAng }
}

describe("duelo de touge", () => {
  it("apertando Shift na hora em cada curva: PERFEITO, o carro escorrega e você vence", async () => {
    const r = await duelo(true)
    expect(r.abriu).toBe(true)
    expect(r.perfeitos).toBeGreaterThanOrEqual(Math.ceil(100 / TOUGE.dano.perfeito))
    expect(r.maxAng, "o carro não escorregou").toBeGreaterThan(0.4)
    expect(r.venceu).toBe(true)
  }, 120_000)

  it("sem apertar: erra as curvas e perde o duelo", async () => {
    const r = await duelo(false)
    expect(r.abriu).toBe(true)
    expect(r.perfeitos).toBe(0)
    expect(r.venceu).toBe(false)
  }, 120_000)
})

describe("drift livre com freio de mão", () => {
  it("bater no meio do drift perde os pontos", async () => {
    let perdeu = false
    await runScenario(60 * 8, 6, LARGADA, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.immuneT = 10; eng.combustivel = 1
      if (i === 360) { eng.driftPts = 500; perderDrift(eng); perdeu = eng.driftPts === 0 && eng.floaters.some((f: { text: string }) => f.text === "DRIFT PERDIDO") }
    })
    expect(perdeu).toBe(true)
  }, 60_000)
})
