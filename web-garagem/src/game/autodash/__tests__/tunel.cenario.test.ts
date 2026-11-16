// Fase 8.7: túnel raro. Engine real, solo: dentro dele o som fica fechado (eco)
// e o jogador está "dentro"; ao sair, o clarão acende e o eco volta ao normal.
// O trecho é plano (rampa linear da entrada à saída) e cabe na distância de desenho.
import { describe, it, expect } from "vitest"
import { runScenario } from "./harness"
import { spawnEvent, sortearEvento } from "../world/events"
import { TUNEL } from "../world/tunel"
import { PLAYER_Z } from "../engine"
import { SEG_LEN, DRAW_DIST } from "../data"

const LARGADA = (i: number, api: { tap(k: string): void; down(k: string): void }) => {
  if (i === 10) api.tap("Enter")
  if (i >= 12 && i <= 16) api.tap("TESTE"[i - 12])
  if (i === 18) api.tap("Enter")
  if (i === 25) api.tap("Enter")
  if (i === 27) api.down("w")
}

describe("túnel", () => {
  it("cabe na distância de desenho (a saída aparece lá no fundo)", () => {
    expect(TUNEL.comprimento / SEG_LEN).toBeLessThan(DRAW_DIST)
  })

  it("dentro: eco e escuro; saindo: clarão e eco desliga", async () => {
    let a = -1, b = -1, plano = true
    let dentroVisto = false, ecoDentro = true, claraoNaSaida = false, ecoDepois = false, terminou = false
    await runScenario(60 * 25, 9, LARGADA, (i, eng) => {
      if (i === 0) eng.render = () => {}
      eng.immuneT = 10; eng.combustivel = 1
      if (i === 200) {
        eng.eventTimer = 1e9; eng.zones = []
        spawnEvent(eng, "tunnel")
        const zn = eng.zones.find((z: { type: string }) => z.type === "tunnel")
        a = Math.floor(zn.z / SEG_LEN); b = Math.floor(zn.end / SEG_LEN)
        // relevo plano: degraus iguais de segmento a segmento
        const N = eng.segments.length, d0 = eng.segments[a % N].y2 - eng.segments[a % N].y1
        for (let k = a; k < b; k++) if (Math.abs((eng.segments[k % N].y2 - eng.segments[k % N].y1) - d0) > 1e-6) plano = false
        eng.position = (a - 20) * SEG_LEN - PLAYER_Z
        eng.speed = 200; eng.playerX = 0.25
      }
      if (a < 0 || terminou) return
      eng.speed = Math.max(eng.speed, 200); eng.playerX = 0.25
      const idx = Math.floor((eng.position + PLAYER_Z) / SEG_LEN)
      if (idx > a + 2 && idx < b - 2) {
        if (eng.dentroTunel) dentroVisto = true
        if (!eng.sobViaduto) ecoDentro = false
      }
      if (idx >= b + 1 && idx <= b + 6 && eng.claraoT > 0) claraoNaSaida = true
      if (idx > b + 120) { ecoDepois = !eng.sobViaduto && !eng.dentroTunel; terminou = true }
    })
    expect(plano, "relevo do túnel não é plano").toBe(true)
    expect(dentroVisto).toBe(true)
    expect(ecoDentro, "sem eco dentro do túnel").toBe(true)
    expect(claraoNaSaida, "sem clarão na saída").toBe(true)
    expect(ecoDepois, "o eco não desligou depois").toBe(true)
  }, 60_000)

  it("é raro: entra no sorteio só às vezes", () => {
    // com o túnel no pool, ele sai como qualquer outro; a raridade vem de ele
    // só entrar no pool com TUNEL.chance. Aqui: o sorteio aceita o túnel.
    expect(sortearEvento(["tunnel"], [], 0.5)).toBe("tunnel")
    expect(TUNEL.chance).toBeLessThan(0.5)
  })
})
