import { describe, it, expect } from "vitest"
import { accelK, driveSplit, LAT_CLAMP, steerK, wheelspinK, driveLabel } from "../physics/traction"
import { CARS, type CarSpec } from "../data"

// Carro base de teste: mesmos números do AUTOHUB GT, tração e pneu por parâmetro.
const base = CARS[0]
const car = (over: Partial<CarSpec>): CarSpec => ({ ...base, ...over })

describe("referência: RWD com pneu padrão é exatamente 1", () => {
  it("nenhuma combinação de aceleração e força lateral reduz a tração", () => {
    for (let a = 0; a <= 1.0001; a += 0.05) {
      for (let c = 0; c <= 2; c += 0.05) {
        expect(accelK(base, a, c)).toBe(1)
      }
    }
  })

  it("o carro padrão (gt) tem RWD e pneu padrão por omissão", () => {
    expect(driveSplit(base)).toEqual({ front: 0, rear: 1 })
    expect(accelK(base, 1, 0)).toBe(1)
  })
})

describe("divisão de torque", () => {
  it("FWD manda tudo para a frente, RWD para trás", () => {
    expect(driveSplit(car({ drive: "FWD" }))).toEqual({ front: 1, rear: 0 })
    expect(driveSplit(car({ drive: "RWD" }))).toEqual({ front: 0, rear: 1 })
  })

  it("AWD respeita a fração da dianteira (30/70 e 50/50)", () => {
    expect(driveSplit(car({ drive: "AWD", frontBias: 0.3 }))).toEqual({ front: 0.3, rear: 0.7 })
    expect(driveSplit(car({ drive: "AWD", frontBias: 0.5 }))).toEqual({ front: 0.5, rear: 0.5 })
  })
})

describe("tração por eixo", () => {
  it("FWD perde aceleração em marcha baixa com acelerador cheio (pneu padrão)", () => {
    // capacidade dianteira = 2 × (0,5 − 0,15) = 0,7; perda FWD de 2% → 0,686
    expect(accelK(car({ drive: "FWD" }), 1, 0)).toBeCloseTo(0.7 * 0.98, 6)
  })

  it("FWD não perde nada com acelerador leve (a demanda cabe no eixo)", () => {
    expect(accelK(car({ drive: "FWD" }), 0.5, 0)).toBeCloseTo(0.98, 9)
  })

  it("nunca cai abaixo do piso de tração", () => {
    const k = accelK(car({ drive: "FWD", tyre: "misto" }), 1, 0)
    expect(k).toBeGreaterThanOrEqual(0.5 * 0.98 - 1e-9)
  })

  it("com pneu de chuva, a integral 30/70 segura mais que a 50/50", () => {
    const awd3070 = accelK(car({ drive: "AWD", frontBias: 0.3, tyre: "misto" }), 1, 0)
    const awd5050 = accelK(car({ drive: "AWD", frontBias: 0.5, tyre: "misto" }), 1, 0)
    expect(awd3070).toBeGreaterThan(awd5050)
  })

  it("com pneu de chuva, a traseira RWD perde menos que a dianteira FWD e mais que a integral 30/70", () => {
    const fwd = accelK(car({ drive: "FWD", tyre: "misto" }), 1, 0)
    const rwd = accelK(car({ drive: "RWD", tyre: "misto" }), 1, 0)
    const awd = accelK(car({ drive: "AWD", frontBias: 0.3, tyre: "misto" }), 1, 0)
    expect(fwd).toBeLessThan(rwd)
    expect(rwd).toBeLessThan(awd)
  })

  it("pneu esportivo ou macio aumenta a tração (e não a reduz)", () => {
    const padrao = accelK(car({ drive: "FWD" }), 1, 0)
    expect(accelK(car({ drive: "FWD", tyre: "esportivo" }), 1, 0)).toBeGreaterThanOrEqual(padrao)
    expect(accelK(car({ drive: "FWD", tyre: "macio" }), 1, 0)).toBeGreaterThanOrEqual(padrao)
  })

  it("força lateral na saída de curva tira tração do eixo motor", () => {
    const reta = accelK(car({ drive: "FWD" }), 1, 0)
    const curva = accelK(car({ drive: "FWD" }), 1, 0.3)
    expect(curva).toBeLessThan(reta)
  })

  it("força lateral acima do teto não piora além do teto", () => {
    const teto = accelK(car({ drive: "FWD" }), 1, LAT_CLAMP * 0.35)
    const muito = accelK(car({ drive: "FWD" }), 1, 5)
    expect(muito).toBeCloseTo(teto, 9)
  })
})

describe("perda do sistema e relação final", () => {
  it("AWD perde 5% e FWD perde 2% pelo sistema de tração", () => {
    expect(accelK(car({ drive: "AWD", frontBias: 0.5 }), 0.2, 0)).toBeCloseTo(0.95, 6)
    expect(accelK(car({ drive: "FWD" }), 0.2, 0)).toBeCloseTo(0.98, 6)
  })

  it("relação final mais curta (maior) aumenta a aceleração", () => {
    const longa = accelK(car({ finalDrive: 1 }), 0.5, 0)
    const curta = accelK(car({ finalDrive: 1.21 }), 0.5, 0)
    expect(curta).toBeGreaterThan(longa)
    expect(curta / longa).toBeCloseTo(1.1, 6)
  })
})

describe("direção e patinada por tração", () => {
  it("RWD não muda a direção nem a patinada (referência exata)", () => {
    for (let a = 0; a <= 1; a += 0.1) expect(steerK(base, a)).toBe(1)
    expect(wheelspinK(base)).toBe(1)
  })

  it("FWD abre a curva no gás e fecha ao aliviar", () => {
    const fwd = car({ drive: "FWD" })
    expect(steerK(fwd, 1)).toBeCloseTo(0.65, 9)
    expect(steerK(fwd, 0.5)).toBeLessThan(1)
    expect(steerK(fwd, 0)).toBeCloseTo(1.12, 9)
  })

  it("AWD sente o efeito na proporção do torque dianteiro", () => {
    const a50 = steerK(car({ drive: "AWD", frontBias: 0.5 }), 1)
    const a30 = steerK(car({ drive: "AWD", frontBias: 0.3 }), 1)
    const fwd = steerK(car({ drive: "FWD" }), 1)
    expect(fwd).toBeLessThan(a50)
    expect(a50).toBeLessThan(a30)
    expect(a30).toBeLessThan(1)
  })

  it("patinada: AWD 50/50 < AWD 30/70 < RWD < FWD", () => {
    const a50 = wheelspinK(car({ drive: "AWD", frontBias: 0.5 }))
    const a30 = wheelspinK(car({ drive: "AWD", frontBias: 0.3 }))
    expect(a50).toBeLessThan(a30)
    expect(a30).toBeLessThan(1)
    expect(wheelspinK(car({ drive: "FWD" }))).toBeGreaterThan(1)
  })

  it("rótulo de tração legível", () => {
    expect(driveLabel(base)).toBe("tração traseira (RWD) · pneu padrão")
    expect(driveLabel(car({ drive: "AWD", frontBias: 0.3 }))).toBe("tração integral 30/70 (AWD) · pneu padrão")
  })
})
