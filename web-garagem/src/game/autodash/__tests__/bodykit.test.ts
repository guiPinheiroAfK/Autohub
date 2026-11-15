import { describe, it, expect } from "vitest"
import { KITS, AROS, ALTURAS, FUMACAS, CHAMAS, idx, proximo, corFumaca, coresChama } from "../cosmetic/bodykit"
import { CARS, WINGS, defaultConfig, type CarCustom } from "../data"
import { drawPlayerCar } from "../render/primitives"

// Contexto de canvas falso que grava cada chamada e atribuição (como o golden).
function gravador() {
  const log: string[] = []
  const grad = { addColorStop: (o: number, c: string) => log.push(`stop ${o} ${c}`) }
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(_t, p) {
      if (p === "createRadialGradient" || p === "createLinearGradient") return (...a: number[]) => { log.push(`${String(p)} ${a.join(",")}`); return grad }
      return (...a: unknown[]) => { log.push(`${String(p)}(${a.join(",")})`) }
    },
    set(_t, p, v) { log.push(`${String(p)}=${String(v)}`); return true },
  }) as unknown as CanvasRenderingContext2D
  return { ctx, log }
}

function desenho(custom: CarCustom, body = 0, nitro = false) {
  const { ctx, log } = gravador()
  drawPlayerCar(ctx, 480, 500, CARS[body], custom, 0.2, true, 0.5, nitro, 1)
  return log
}

const ANTIGO: CarCustom = { paint: 3, stripe: 1, neon: 2, wheel: 1, wing: 2, motor: "" }

describe("bodykit (Fase 7): dados", () => {
  it("índice 0 de cada tabela é o desenho de antes", () => {
    expect(KITS[0].saias || KITS[0].difusor || KITS[0].widebody).toBe(false)
    expect(ALTURAS[0].desce).toBe(0)
    expect(ALTURAS[0].cambagem).toBe(0)
    expect(FUMACAS[0].cor).toBeNull()
    expect(CHAMAS[0].cores).toEqual(["#fb923c", "#fde047"])
    expect(AROS[0].aba).toBe(0.024)
  })

  it("índice inválido vira 0 e proximo dá a volta", () => {
    expect(idx(undefined, 4)).toBe(0)
    expect(idx(7, 4)).toBe(0)
    expect(idx(-1, 4)).toBe(0)
    expect(idx(Number.NaN, 4)).toBe(0)
    expect(idx(2, 4)).toBe(2)
    expect(proximo(3, 4)).toBe(0)
    expect(proximo(undefined, 4)).toBe(1)
  })

  it("fumaça e chama padrão devolvem as cores de antes", () => {
    expect(corFumaca(ANTIGO, "#64748b")).toBe("#64748b")
    expect(corFumaca(undefined, "#cbd5e1")).toBe("#cbd5e1")
    expect(corFumaca({ ...ANTIGO, fumaca: 2 }, "#64748b")).toBe(FUMACAS[2].cor)
    expect(coresChama(ANTIGO)).toEqual(["#fb923c", "#fde047"])
    expect(coresChama({ ...ANTIGO, chama: 1 })).toEqual(CHAMAS[1].cores)
  })

  it("config nova já vem com a estética zerada e câmera dinâmica", () => {
    const cfg = defaultConfig()
    for (const c of cfg.customs) {
      expect([c.kit, c.aro, c.altura, c.fumaca, c.chama]).toEqual([0, 0, 0, 0, 0])
    }
    expect(cfg.camera).toBe("dinamica")
    expect(WINGS.length).toBe(4)
  })
})

describe("bodykit (Fase 7): desenho", () => {
  it("config salva sem os campos novos desenha igual à config zerada", () => {
    for (let b = 0; b < CARS.length; b++) {
      const zerado = { ...ANTIGO, kit: 0, aro: 0, altura: 0, fumaca: 0, chama: 0 }
      expect(desenho(ANTIGO, b, true)).toEqual(desenho(zerado, b, true))
    }
  })

  it("cada peça muda o desenho, e só ela", () => {
    const base = desenho(ANTIGO)
    const pecas: Partial<CarCustom>[] = [
      { kit: 1 }, { kit: 2 }, { kit: 3 }, { aro: 1 }, { aro: 2 }, { aro: 3 },
      { altura: 1 }, { altura: 2 }, { wing: 3 },
    ]
    const vistos = new Set<string>()
    for (const p of pecas) {
      const d = desenho({ ...ANTIGO, ...p })
      expect(d).not.toEqual(base)
      vistos.add(d.join("|"))
    }
    expect(vistos.size).toBe(pecas.length)
  })

  it("chama muda a ponta do escapamento no nitro", () => {
    const azul = desenho({ ...ANTIGO, chama: 1 }, 0, true)
    expect(azul).toContain(`fillStyle=${CHAMAS[1].cores[1]}`)
    expect(azul).not.toContain("fillStyle=#fde047")
  })

  it("save e restore ficam equilibrados com qualquer combinação", () => {
    for (const altura of [0, 1, 2]) for (const aro of [0, 1, 2, 3]) for (const kit of [0, 3]) {
      const d = desenho({ ...ANTIGO, altura, aro, kit, wing: 3 })
      const saves = d.filter(l => l.startsWith("save(")).length
      const restores = d.filter(l => l.startsWith("restore(")).length
      expect(saves).toBe(restores)
    }
  })
})
