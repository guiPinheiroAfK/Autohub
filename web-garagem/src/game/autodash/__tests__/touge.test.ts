// Playtest 16/11: "o drift ficou confuso; melhor algo mais fechado, tipo batalha
// de chefe de PS2: aperta na hora certa e escorrega" + "o Touge!".
// + "não só o Shift: segurar o W, frear (S), nitro (Espaço)" + "comandos no lugar
// certo; a luta mais luta, com momentos de correr por conta".
// Engine real, solo: o duelo de touge abre à frente com o rival e sem trânsito;
// quem aperta o SHIFT na hora em cada curva derruba a barra do rival e vence;
// quem não aperta nada erra todas, sai de frente e perde.
// 17/11 ("agora tudo controlamos, ficou só confuso"): nas cenas o CARRO pilota
// (freia, faz o drift, troca de lado e dá o nitro) e o volante fica travado; o
// jogador só aperta SHIFT. Nos trechos livres o volante é dele.
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { spawnTouge, comandoTouge, comandoAtual, anguloDrift, zonaDa } from "../world/touge"
import { perderDrift } from "../world/drift"

const LARGADA = (i: number, api: { tap(k: string): void; down(k: string): void }) => {
  if (i === 10) api.tap("Enter")
  if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
  if (i === 18) api.tap("Enter")
  if (i === 25) api.tap("Enter")
  if (i === 27) api.down("w")
}

async function duelo(apertar: boolean, girar = false) {
  let volanteMexeu = false, abriu = false, venceu: boolean | null = null, perfeitos = 0, maxAng = 0, semTransito = true, zonaVista = false, rodou = false, trocas = 0, sJogados = 0, passou = false
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
      // a única coisa do jogador na cena: SHIFT ao cruzar a linha amarela
      if (at && at.cmd === "shift" && Math.abs(at.t) < 0.03) comandoTouge(eng, "shift")
      // ultrapassagem: vai para a faixa livre
      const p = tg.porta
      if (p && !p.feita) eng.playerX += (-p.lado * 0.5 - eng.playerX) * 0.05
      passou = passou || tg.papel === "lider"
      const dr = anguloDrift(eng)
      if (dr) zonaVista = true
      trocas = tg.curvas.filter((c: { troca: boolean | null }) => c.troca === true).length
      sJogados = tg.curvas.filter((c: { tipo: string; nota: string | null }) => c.tipo === "s" && c.nota).length
    }
    if (tg.fase === "batalha" && girar) {
      // o "piloto" afobado: entra certo, mas pisa fundo e vira para dentro o tempo todo
      const at = comandoAtual(eng)
      if (at && at.cmd === "shift" && Math.abs(at.t) < 0.03) comandoTouge(eng, "shift")
      eng.keys.add("w")
      const dr = anguloDrift(eng)
      eng.keys.delete("a"); eng.keys.delete("d")
      if (dr) { eng.keys.add(dr.dir > 0 ? "d" : "a"); volanteMexeu = volanteMexeu || Math.abs(eng.steerVel) > 0.2 }
      if (tg.curvas.some((k: { rodou: boolean }) => k.rodou)) rodou = true
    }
    maxAng = Math.max(maxAng, Math.abs(eng.driftAng))
    perfeitos = tg.curvas.filter((c: { final: string | null }) => c.final === "perfeito").length
    if (tg.fase === "fim" && venceu === null) venceu = tg.vidaRival < tg.vidaVoce
  })
  return { volanteMexeu, abriu, venceu, perfeitos, maxAng, semTransito, zonaVista, rodou, trocas, sJogados, passou }
}

describe("duelo de touge", () => {
  it("só o Shift nas cenas (o carro pilota o resto) e a ultrapassagem: você vence", async () => {
    const r = await duelo(true)
    expect(r.abriu).toBe(true)
    expect(r.perfeitos).toBeGreaterThanOrEqual(3) // a ultrapassagem e a distância também tiram espírito
    expect(r.maxAng, "o carro não escorregou").toBeGreaterThan(0.4)
    expect(r.venceu).toBe(true)
    expect(r.semTransito, "nasceu trânsito no duelo").toBe(true)
    expect(r.zonaVista).toBe(true)
    expect(r.sJogados).toBeGreaterThan(0)
    expect(r.trocas, "não trocou de lado nos S").toBe(r.sJogados)
    expect(r.passou, "não fez a ultrapassagem").toBe(true)
  }, 120_000)

  it("o volante fica travado na cena: virar para dentro no drift não faz o carro rodar", async () => {
    const r = await duelo(false, true)
    expect(r.abriu).toBe(true)
    expect(r.rodou, "rodou com o volante travado").toBe(false)
    expect(r.volanteMexeu, "o volante mexeu durante a cena").toBe(false)
  }, 120_000)

  it("sem apertar: erra as curvas e perde o duelo", async () => {
    const r = await duelo(false)
    expect(r.abriu).toBe(true)
    expect(r.perfeitos).toBe(0)
    expect(r.venceu).toBe(false)
  }, 120_000)
})

describe("fim do duelo", () => {
  it("acabaram as cenas e os dois vivos: a decisão zera a barra de quem está pior (sem acabar do nada)", async () => {
    let decidiu = false, vidaNoFim = [100, 100], fimPor = "", viuDecisivo = false
    await runScenario(60 * 70, 8, LARGADA, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.immuneT = 10; eng.combustivel = 1; eng.eventTimer = 1e9
      if (i === 360) { eng.zones = []; eng.obstacles = []; spawnTouge(eng) }
      const tg = eng.touge
      if (!tg) return
      eng.playerX = Math.max(-0.9, Math.min(0.9, eng.playerX))
      if (tg.fase === "batalha" && !decidiu) {
        // as cenas já passaram e a vida está empatada em 60 x 55: só a decisão resolve
        if (tg.atual >= tg.curvas.length && !tg.decisivo) { tg.vidaVoce = 60; tg.vidaRival = 55 }
        if (tg.atual < tg.curvas.length) { tg.atual = tg.curvas.length; for (const c of tg.curvas) { c.nota = "bom"; c.nitro = true; c.final = "otimo" } }
        if (tg.decisivo) viuDecisivo = true
      }
      if (tg.fase === "fim" && !decidiu) { decidiu = true; vidaNoFim = [tg.vidaVoce, tg.vidaRival]; fimPor = tg.vidaVoce <= 0 || tg.vidaRival <= 0 ? "nocaute" : "outro" }
    })
    expect(viuDecisivo, "não entrou na decisão").toBe(true)
    expect(decidiu, "o duelo não terminou").toBe(true)
    expect(fimPor, `terminou sem nocaute (${vidaNoFim})`).toBe("nocaute")
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
