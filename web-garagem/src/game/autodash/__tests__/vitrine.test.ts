import { describe, it, expect } from "vitest"
import { VITRINE, proximaVitrine, nomeVitrine } from "../render/menus/estetica"
import { defaultConfig } from "../data"
import type { AutoDashEngine } from "../engine"

function eng(): AutoDashEngine {
  return { cfg: defaultConfig(), audio: { ui() {} } } as unknown as AutoDashEngine
}

describe("vitrine da garagem [1] (Fase 7)", () => {
  it("cicla os visuais prontos e volta exatamente ao seu, sem mexer na pintura", () => {
    const e = eng()
    const c = e.cfg.customs[0]
    Object.assign(c, { paint: 5, kit: 2, aro: 3, neon: 1 })
    const antes = { ...c }
    expect(nomeVitrine(e)).toBe("o seu")
    for (let i = 0; i < VITRINE.length; i++) {
      proximaVitrine(e)
      expect(nomeVitrine(e)).toBe(VITRINE[i].nome)
      expect(c).toMatchObject(VITRINE[i].v)
      expect(c.paint).toBe(5)
    }
    proximaVitrine(e)
    expect(nomeVitrine(e)).toBe("o seu")
    expect(c).toEqual(antes)
  })

  it("trocar de carro no meio recomeça a vitrine no carro novo", () => {
    const e = eng()
    proximaVitrine(e)
    e.cfg.carIdx = 1
    expect(nomeVitrine(e)).toBe("o seu")
    proximaVitrine(e)
    expect(nomeVitrine(e)).toBe(VITRINE[0].nome)
  })
})
