// Os bancos de grãos que os perfis usam existem, estão bem formados e têm crédito.
import { describe, it, expect } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { GRAVACAO_DO_PERFIL, TEXTURA, CREDITO_GRAVACAO, ENGINE_PROFILES } from "../sound/profiles"

const SOM = fileURLToPath(new URL("../../../../public/autodash/som/", import.meta.url))
const NIVEL_REF = 0.135 // audio.ts: o jogo iguala o volume por NIVEL_REF / nivel, limitado a NIVEL_PISO–3,5
const NIVEL_PISO = 0.2   // audio.ts

const bancos = [...new Set([...Object.values(GRAVACAO_DO_PERFIL).map(g => g.banco), TEXTURA.banco])]

describe("bancos de som gravado", () => {
  for (const b of bancos) {
    it(`${b}: arquivos, grãos, nível e crédito`, () => {
      expect(existsSync(SOM + b + ".mp3"), "mp3").toBe(true)
      const j = JSON.parse(readFileSync(SOM + b + ".json", "utf8"))
      expect(j.graos.length).toBeGreaterThan(100)
      expect(j.clique).toBeCloseTo(0.1, 5)
      expect(typeof j.nivel).toBe("number")
      const fator = NIVEL_REF / j.nivel
      expect(fator, "volume fora do limite do ajuste de audio.ts").toBeGreaterThanOrEqual(NIVEL_PISO)
      expect(fator, "volume fora do limite do ajuste de audio.ts").toBeLessThanOrEqual(3.5)
      for (const [c, esq, dir, hz, classe, ganho] of j.graos as number[][]) {
        expect(c).toBeLessThan(j.duracao)
        expect(esq).toBeGreaterThan(0); expect(dir).toBeGreaterThan(0); expect(hz).toBeGreaterThan(0)
        expect([0, 1, 2]).toContain(classe)
        expect(ganho).toBeGreaterThan(0)
      }
      expect(CREDITO_GRAVACAO[b], "sem crédito em CREDITO_GRAVACAO").toBeTruthy()
    })
  }

  it("os três V8 usam gravação (cruzados no banco do simulador) e cada um está no seletor do teste de motor", () => {
    for (const id of ["v8-cruzado", "v8-cruzado-ford", "v8-plano"]) {
      expect(ENGINE_PROFILES[id]).toBeDefined()
      expect(GRAVACAO_DO_PERFIL[id]).toBeDefined()
    }
    expect(GRAVACAO_DO_PERFIL["v8-cruzado"].banco).toBe("sim-v8-ls")
    expect(GRAVACAO_DO_PERFIL["v8-cruzado-ford"].banco).toBe("sim-v8-454")
    expect(GRAVACAO_DO_PERFIL["v8-plano"].banco).toBe("sim-v8-f136")
  })

  it("os motores gravados no simulador cobrem da lenta perto do corte", () => {
    for (const [id, ate] of [["v10", 8500], ["i4", 8000], ["v6", 6200], ["i6", 5600], ["i6-corrida", 7500], ["v8-cruzado", 6000], ["v12", 10500],
      ["v8-plano", 8500], ["v8-cruzado-ford", 5200], ["i5", 5600], ["boxer4", 6200],
      ["boxer6", 7500], ["i6-aspirado", 6500], ["i3", 5800], ["v6", 7000]] as const) {
      const j = JSON.parse(readFileSync(SOM + GRAVACAO_DO_PERFIL[id].banco + ".json", "utf8"))
      const rpm = (j.graos as number[][]).map(g => g[3] * 60 * j.voltasPorGrao)
      expect(Math.min(...rpm), id).toBeLessThan(1500)
      expect(Math.max(...rpm), id).toBeGreaterThan(ate)
    }
  })
})
