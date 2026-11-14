import { describe, it, expect } from "vitest"
import { MOTORES, curvaEm, forcaEm, boostAlvo, passoBoost, rpmPorKmh, faixa, motorFisico, taxaSolto, giroDoSom, forcaNoCorte, faseCorte, CORTE_DURO_HZ, fatorSpool } from "../physics/motores"
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

  it("giro solto: motor leve sobe bem mais rápido que o big block de 71", () => {
    expect(taxaSolto(MOTORES.i4, true)).toBeGreaterThan(taxaSolto(MOTORES["v8-cruzado-ford"], true) * 2.5)
    expect(taxaSolto(MOTORES.rotativo, false)).toBeGreaterThan(taxaSolto(MOTORES.w16, false) * 2.5)
  })

  it("limitador: corte duro bate mais fundo que o suave; fora do corte o giro do som é o da física", () => {
    const fundo = (m: typeof MOTORES.i4) => {
      let min = Infinity
      for (let t = 0; t < 1; t += 0.001) min = Math.min(min, giroDoSom(m, m.corte, 1, true, t))
      return m.corte - min
    }
    expect(fundo(MOTORES.i4)).toBeGreaterThan(fundo(MOTORES.v12) * 2)
    expect(giroDoSom(MOTORES.v12, 5000, 1, false, 0.37)).toBe(5000)
  })

  it("lenta irregular só no comando bravo e no rotativo, e só perto da lenta", () => {
    const osc = (m: typeof MOTORES.i4, rpm: number) => {
      let a = Infinity, b = -Infinity
      for (let t = 0; t < 2; t += 0.01) { const r = giroDoSom(m, rpm, 0, false, t); a = Math.min(a, r); b = Math.max(b, r) }
      return b - a
    }
    const v8 = MOTORES["v8-cruzado-ford"]
    expect(osc(v8, v8.idle)).toBeGreaterThan(100)
    expect(osc(v8, 4000)).toBe(0)
    expect(osc(MOTORES.v12, MOTORES.v12.idle)).toBe(0)
  })
  it("limitador físico: corte duro pulsa com o som, corte suave segura em rampa (R4)", () => {
    const duro = MOTORES.i4, suave = MOTORES.v10
    expect(duro.corteDuro).toBe(true)
    expect(suave.corteDuro).toBeFalsy()
    // abaixo do corte nada muda
    expect(forcaNoCorte(duro, duro.corte - 200, 0.01)).toBe(1)
    expect(forcaNoCorte(suave, suave.corte - 50, 0.01)).toBe(1) // onde o limitador antigo zerava
    // corte duro: em 1 s no limitador, ~45% do tempo com força, em 13 pulsos
    let com = 0, pulsos = 0, antes = 1
    for (let i = 0; i < 1000; i++) {
      const k = forcaNoCorte(duro, duro.corte, i / 1000)
      expect(k === 0 || k === 1).toBe(true)
      if (k === 0 && antes === 1) pulsos++
      com += k; antes = k
    }
    expect(com / 1000).toBeGreaterThan(0.4)
    expect(com / 1000).toBeLessThan(0.5)
    expect(Math.abs(pulsos - CORTE_DURO_HZ)).toBeLessThanOrEqual(1)
    // o som e a física batem juntos: força zero no começo do dente do som
    expect(faseCorte(0.5 / CORTE_DURO_HZ)).toBeCloseTo(0.5)
    // corte suave: rampa contínua e decrescente até zero no corte
    let ult = 1
    for (let r = suave.corte - 50; r <= suave.corte; r += 5) {
      const k = forcaNoCorte(suave, r, 0)
      expect(k).toBeLessThanOrEqual(ult)
      ult = k
    }
    expect(forcaNoCorte(suave, suave.corte, 0)).toBe(0)
  })
  it("turbo enche mais rápido em giro alto (R5)", () => {
    const m = MOTORES["i4-turbo"]
    expect(fatorSpool(m)).toBe(1)                       // sem giro: como antes
    expect(fatorSpool(m, m.turbo!.cheio)).toBe(1)
    expect(fatorSpool(m, 5000)).toBeCloseTo(0.8)        // 5000 rpm: 20% mais rápido
    expect(fatorSpool(m, 9000)).toBe(0.6)               // teto: 40% mais rápido
    expect(fatorSpool(m, 1000)).toBe(2)                 // embaixo: no máximo 2× mais lento
    expect(fatorSpool(MOTORES.v10, 8000)).toBe(1)       // aspirado: nada muda
    const encher = (rpm: number) => {
      let b = 0, t = 0
      while (b < 0.6) { b = passoBoost(m, b, 1, 1 / 60, rpm); t += 1 / 60 }
      return t
    }
    expect(encher(7000)).toBeLessThan(encher(4000))
    // esvaziar continua igual (~0,2 s), com ou sem giro
    expect(passoBoost(m, 1, 0, 1 / 60, 7000)).toBe(passoBoost(m, 1, 0, 1 / 60))
  })
})

