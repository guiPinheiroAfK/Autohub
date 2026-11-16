// Playtest 16/11: "o drift ficou confuso; melhor algo mais fechado, tipo batalha
// de chefe de PS2: aperta na hora certa e escorrega" + "o Touge!".
// + "não só o Shift: segurar o W, frear (S), nitro (Espaço)".
// Engine real, solo: o duelo de touge abre à frente com o rival e sem trânsito;
// quem faz a sequência na hora em cada curva derruba a barra do rival e vence;
// quem não aperta nada erra todas, sai de frente e perde.
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { spawnTouge, comandoTouge, comandoAtual, TOUGE } from "../world/touge"
import { perderDrift } from "../world/drift"

const LARGADA = (i: number, api: { tap(k: string): void; down(k: string): void }) => {
  if (i === 10) api.tap("Enter")
  if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
  if (i === 18) api.tap("Enter")
  if (i === 25) api.tap("Enter")
  if (i === 27) api.down("w")
}

async function duelo(apertar: boolean) {
  let abriu = false, venceu: boolean | null = null, perfeitos = 0, maxAng = 0, semTransito = true
  await runScenario(60 * 70, 8, LARGADA, (i, eng) => {
    if (i === 0) eng.render = () => {}
    eng.immuneT = 10; eng.combustivel = 1; eng.eventTimer = 1e9
    if (i === 360) { eng.zones = []; eng.obstacles = []; abriu = spawnTouge(eng) }
    const tg = eng.touge
    if (!tg) return
    if (tg.fase === "batalha") semTransito = semTransito && eng.traffic.every((t: { role: string }) => t.role === "racha" || t.role === "police")
    eng.playerX = Math.max(-0.9, Math.min(0.9, eng.playerX)) // o "piloto" não sai da pista
    if (tg.fase === "batalha" && apertar) {
      // o "piloto" aperta cada comando quando o anel fecha (W já está segurado)
      const at = comandoAtual(eng)
      if (at && at.cmd !== "w" && Math.abs(at.t) < 0.03) comandoTouge(eng, at.cmd)
    }
    maxAng = Math.max(maxAng, Math.abs(eng.driftAng))
    perfeitos = tg.curvas.filter((c: { final: string | null }) => c.final === "perfeito").length
    if (tg.fase === "fim" && venceu === null) venceu = tg.vidaRival < tg.vidaVoce
  })
  return { abriu, venceu, perfeitos, maxAng, semTransito }
}

describe("duelo de touge", () => {
  it("S, Shift, W e Espaço na hora em cada curva: curva PERFEITA, o carro escorrega e você vence", async () => {
    const r = await duelo(true)
    expect(r.abriu).toBe(true)
    expect(r.perfeitos).toBeGreaterThanOrEqual(Math.ceil(100 / TOUGE.dano.perfeito))
    expect(r.maxAng, "o carro não escorregou").toBeGreaterThan(0.4)
    expect(r.venceu).toBe(true)
    expect(r.semTransito, "nasceu trânsito no duelo").toBe(true)
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
