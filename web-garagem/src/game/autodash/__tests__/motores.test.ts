import { describe, it, expect } from "vitest"
import { MOTORES, curvaEm, forcaEm, boostAlvo, passoBoost, rpmPorKmh, faixa, motorFisico } from "../physics/motores"
import { ENGINE_PROFILES } from "../sound/profiles"
import { CARS, GEAR_RATIOS, RPM_PER_KMH, RPM_LIMITER, RPM_IDLE } from "../data"

describe("motores reais (faixa de giro e curva de força)", () => {
  it("todo motor de som tem lado físico, e turbo no som = turbo na física", () => {
    for (const [id, p] of Object.entries(ENGINE_PROFILES)) {
      expect(MOTORES[id], id).toBeDefined()
      const somTurbo = p.inducao === "turbo" || p.inducao === "biturbo"
      expect(!!MOTORES[id].turbo, id).toBe(somTurbo)
    }
  })

  it("lenta < faixa vermelha < corte, e curvas em ordem de giro, entre 0 e 1", () => {
    for (const [id, m] of Object.entries(MOTORES)) {
      expect(m.idle, id).toBeLessThan(m.redline)
      expect(m.redline, id).toBeLessThan(m.corte)
      for (let i = 1; i < m.curva.length; i++) expect(m.curva[i][0], id).toBeGreaterThan(m.curva[i - 1][0])
      for (const [, f] of m.curva) { expect(f).toBeGreaterThan(0); expect(f).toBeLessThanOrEqual(1) }
      expect(Math.max(...m.curva.map(c => c[1])), id).toBe(1)
      expect(curvaEm(m, m.corte), id).toBe(0)
    }
  })

  it("nem todo motor gira igual: cortes de 6000 a mais de 9000", () => {
    const cortes = Object.values(MOTORES).map(m => m.corte)
    expect(Math.min(...cortes)).toBeLessThanOrEqual(6000)
    expect(Math.max(...cortes)).toBeGreaterThan(9000)
  })

  it("V8 de 71 tem força embaixo; o VTEC só acorda em cima", () => {
    const v8 = MOTORES["v8-cruzado-ford"], vtec = MOTORES.i4
    expect(curvaEm(v8, 2500)).toBeGreaterThan(curvaEm(vtec, 2500) * 1.6)
    expect(curvaEm(vtec, 7500)).toBeGreaterThan(curvaEm(vtec, 5000) * 1.4)
  })

  it("turbo tem atraso: a força chega depois de segurar o pé", () => {
    const m = MOTORES["i4-turbo"]
    let b = 0
    for (let i = 0; i < 6; i++) b = passoBoost(m, b, boostAlvo(m, 5000, 1), 1 / 60) // 0,1 s
    const cedo = forcaEm(m, 5000, b)
    for (let i = 0; i < 120; i++) b = passoBoost(m, b, boostAlvo(m, 5000, 1), 1 / 60) // +2 s
    expect(forcaEm(m, 5000, b)).toBeGreaterThan(cedo * 1.25)
    // abaixo do spool não enche, e ao aliviar esvazia rápido
    expect(boostAlvo(m, 2000, 1)).toBe(0)
    for (let i = 0; i < 50; i++) b = passoBoost(m, b, 0, 1 / 60) // ~0,8 s
    expect(b).toBeLessThan(0.05)
  })

  it("velocidade de cada marcha é a mesma para todo motor (equilíbrio fica nos carros)", () => {
    const ref = (RPM_LIMITER - RPM_IDLE) / (GEAR_RATIOS[2] * RPM_PER_KMH)
    for (const m of Object.values(MOTORES)) {
      expect(faixa(m) / (GEAR_RATIOS[2] * rpmPorKmh(m))).toBeCloseTo(ref, 6)
    }
  })

  it("todo carro resolve um motor; escolha da garagem troca o motor físico", () => {
    for (const c of CARS) expect(motorFisico(c).corte).toBeGreaterThan(5000)
    const muscle = CARS.find(c => c.body === "muscle")!
    expect(motorFisico(muscle).corte).toBe(6000)
    expect(motorFisico(muscle, "v12").corte).toBe(9250)
  })
})
