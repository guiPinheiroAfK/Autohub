import { describe, it, expect } from "vitest"
import { lenteDoFov, lenteAtual, alvoFov, passoFov, FOV_VEL, FOV_NITRO } from "../render/fov"
import { CAM_DEPTH, CAM_HEIGHT, CARS, FOV } from "../data"
import type { AutoDashEngine } from "../engine"

function eng(over: Record<string, unknown> = {}): AutoDashEngine {
  return {
    cfg: { carIdx: 0, camera: "dinamica" }, state: "racing", speed: 0,
    nitroZoom: 0, fovF: 0, ...over,
  } as unknown as AutoDashEngine
}

// escala da projeção em road.ts: s = depth / dz
const escala = (depth: number, avanco: number, distDoJogador: number) =>
  depth / (CAM_HEIGHT * CAM_DEPTH - avanco + distDoJogador)

describe("FOV dinâmico (Fase 7)", () => {
  it("lente de 100° é a de sempre", () => {
    const l = lenteDoFov(FOV)
    expect(l.depth).toBeCloseTo(CAM_DEPTH, 12)
    expect(l.avanco).toBeCloseTo(0, 9)
    expect(lenteAtual(eng())).toEqual({ depth: CAM_DEPTH, avanco: 0 })
  })

  it("o chão do jogador fica no mesmo ponto e o longe encolhe", () => {
    const l = lenteDoFov(FOV + FOV_VEL + FOV_NITRO)
    // no jogador (distância 0): mesma escala → mesmo ponto da tela e mesmo tamanho
    expect(escala(l.depth, l.avanco, 0)).toBeCloseTo(escala(CAM_DEPTH, 0, 0), 12)
    // longe: menor, mas pouco (≥ 0,9) — sem enjoo
    const r = escala(l.depth, l.avanco, 60000) / escala(CAM_DEPTH, 0, 60000)
    expect(r).toBeLessThan(0.96)
    expect(r).toBeGreaterThan(0.9)
    // a câmera anda pouco para a frente (bem menos que um segmento)
    expect(l.avanco).toBeGreaterThan(0)
    expect(l.avanco).toBeLessThan(100)
  })

  it("só abre correndo, com câmera dinâmica e acima de 150 km/h", () => {
    const top = CARS[0].topSpeed
    expect(alvoFov(eng({ speed: 140 }))).toBe(0)
    expect(alvoFov(eng({ speed: top }))).toBeCloseTo(FOV_VEL / (FOV_VEL + FOV_NITRO))
    expect(alvoFov(eng({ speed: top, nitroZoom: 1 }))).toBeCloseTo(1)
    expect(alvoFov(eng({ speed: top, state: "garage" }))).toBe(0)
    expect(alvoFov(eng({ speed: top, cfg: { carIdx: 0, camera: "fixa" } }))).toBe(0)
  })

  it("a lente segue devagar (sem tranco na batida) e não passa do alvo", () => {
    const e = eng({ speed: CARS[0].topSpeed, nitroZoom: 1 })
    passoFov(e, 1 / 60)
    expect(e.fovF).toBeLessThan(0.05)
    for (let i = 0; i < 600; i++) passoFov(e, 1 / 60)
    expect(e.fovF).toBeGreaterThan(0.99)
    expect(e.fovF).toBeLessThanOrEqual(1)
    // batida: a velocidade cai de uma vez, a lente fecha em ~0,6 s, não num quadro
    e.speed = 0; e.nitroZoom = 0
    passoFov(e, 1 / 60)
    expect(e.fovF).toBeGreaterThan(0.95)
    for (let i = 0; i < 600; i++) passoFov(e, 1 / 60)
    expect(e.fovF).toBe(0)
  })
})
