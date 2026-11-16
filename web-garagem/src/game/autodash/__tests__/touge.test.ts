// Playtest 16/11: "o drift ficou confuso; melhor algo mais fechado, tipo batalha
// de chefe de PS2: aperta na hora certa e escorrega" + "o Touge!".
// + "não só o Shift: segurar o W, frear (S), nitro (Espaço)".
// Engine real, solo: o duelo de touge abre à frente com o rival e sem trânsito;
// quem faz a sequência na hora em cada curva derruba a barra do rival e vence;
// quem não aperta nada erra todas, sai de frente e perde.
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { spawnTouge, comandoTouge, comandoAtual, anguloDrift, zonaDa, TOUGE } from "../world/touge"
import { perderDrift } from "../world/drift"

const LARGADA = (i: number, api: { tap(k: string): void; down(k: string): void }) => {
  if (i === 10) api.tap("Enter")
  if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
  if (i === 18) api.tap("Enter")
  if (i === 25) api.tap("Enter")
  if (i === 27) api.down("w")
}

async function duelo(apertar: boolean, girar = false) {
  let abriu = false, venceu: boolean | null = null, perfeitos = 0, maxAng = 0, semTransito = true, zonaVista = false, rodou = false, trocas = 0, sJogados = 0
  await runScenario(60 * 70, 8, LARGADA, (i, eng) => {
    if (i === 0) eng.render = () => {}
    eng.immuneT = 10; eng.combustivel = 1; eng.eventTimer = 1e9
    if (i === 360) { eng.zones = []; eng.obstacles = []; abriu = spawnTouge(eng) }
    const tg = eng.touge
    if (!tg) return
    if (tg.fase === "batalha") semTransito = semTransito && eng.traffic.every((t: { role: string }) => t.role === "racha" || t.role === "police")
    eng.playerX = Math.max(-0.9, Math.min(0.9, eng.playerX)) // o "piloto" não sai da pista
    if (tg.fase === "batalha" && apertar) {
      // o "piloto" aperta cada comando quando o anel fecha e, de lado, segura o
      // ângulo no meio da faixa verde no pé (tira o W acima, põe abaixo)
      const at = comandoAtual(eng)
      if (at && at.cmd !== "drift" && Math.abs(at.t) < 0.03) comandoTouge(eng, at.cmd)
      // de lado: segura o ponteiro no meio da faixa verde no volante (W sempre no fundo)
      eng.keys.delete("a"); eng.keys.delete("d")
      const dr = anguloDrift(eng)
      if (dr) {
        zonaVista = true
        const z = zonaDa(dr.c), meio = (z[0] + z[1]) / 2
        const lado = dr.ang < meio ? dr.dir : -dr.dir
        if (Math.abs(dr.ang - meio) > 0.05) eng.keys.add(lado > 0 ? "d" : "a")
      }
      trocas = tg.curvas.filter((c: { troca: boolean | null }) => c.troca === true).length
      sJogados = tg.curvas.filter((c: { tipo: string; nota: string | null }) => c.tipo === "s" && c.nota).length
    }
    if (tg.fase === "batalha" && girar) {
      // o "piloto" afobado: entra certo, mas pisa fundo e vira para dentro
      const at = comandoAtual(eng)
      if (at && at.cmd === "shift" && Math.abs(at.t) < 0.03) comandoTouge(eng, "shift")
      eng.keys.add("w")
      const dr = anguloDrift(eng)
      eng.keys.delete("a"); eng.keys.delete("d")
      if (dr) eng.keys.add(dr.dir > 0 ? "d" : "a")
      if (tg.curvas.some((k: { rodou: boolean }) => k.rodou)) rodou = true
    }
    maxAng = Math.max(maxAng, Math.abs(eng.driftAng))
    perfeitos = tg.curvas.filter((c: { final: string | null }) => c.final === "perfeito").length
    if (tg.fase === "fim" && venceu === null) venceu = tg.vidaRival < tg.vidaVoce
  })
  return { abriu, venceu, perfeitos, maxAng, semTransito, zonaVista, rodou, trocas, sJogados }
}

describe("duelo de touge", () => {
  it("S, Shift, ângulo no volante, troca nos S e Espaço: curvas PERFEITAS e você vence", async () => {
    const r = await duelo(true)
    expect(r.abriu).toBe(true)
    expect(r.perfeitos).toBeGreaterThanOrEqual(Math.ceil(100 / TOUGE.dano.perfeito))
    expect(r.maxAng, "o carro não escorregou").toBeGreaterThan(0.4)
    expect(r.venceu).toBe(true)
    expect(r.semTransito, "nasceu trânsito no duelo").toBe(true)
    expect(r.zonaVista).toBe(true)
    expect(r.sJogados).toBeGreaterThan(0)
    expect(r.trocas, "não trocou de lado nos S").toBe(r.sJogados)
  }, 120_000)

  it("pé no fundo e volante para dentro no drift: o carro roda", async () => {
    const r = await duelo(false, true)
    expect(r.abriu).toBe(true)
    expect(r.rodou, "não rodou").toBe(true)
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
