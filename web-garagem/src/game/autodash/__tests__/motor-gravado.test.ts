import { describe, it, expect } from "vitest"
import { MotorGravado, graosDoJson, ALIVIO, CARGA, ESTAVEL, type BancoGraos } from "../sound/motor-gravado"

const SR = 16000

// Gravação sintética: um pulso por explosão, frequência subindo de 20 a 260 Hz
// e voltando; marca cada pulso como grão (a classe acompanha o sentido do giro).
function bancoSintetico(): BancoGraos {
  const dur = 12, dados = new Float32Array(SR * dur)
  const marcas: number[] = []
  let fase = 0
  for (let i = 0; i < dados.length; i++) {
    const t = i / SR, u = t / dur
    const hz = 20 + 240 * (u < 0.5 ? u * 2 : 2 - u * 2)
    fase += hz / SR
    if (fase >= 1) { fase -= 1; marcas.push(t) }
  }
  for (const m of marcas) {
    const c = Math.round(m * SR)
    for (let k = 0; k < 40 && c + k < dados.length; k++) dados[c + k] += Math.exp(-k / 6) * 0.5
  }
  const graos: number[][] = []
  for (let j = 1; j < marcas.length - 1; j++) {
    const esq = marcas[j] - marcas[j - 1], dir = marcas[j + 1] - marcas[j]
    const classe = marcas[j] < 4 ? CARGA : marcas[j] < 8 ? ESTAVEL : ALIVIO
    graos.push([marcas[j], esq, dir, 2 / (esq + dir), classe, 1])
  }
  return { nome: "teste", sr: SR, dados, graos: graosDoJson(graos), cilindros: 4 }
}

function tocar(m: MotorGravado, rpm: number, carga: number, seg: number): Float32Array {
  m.fixar(rpm, carga)
  const out = new Float32Array(Math.floor(SR * seg))
  for (let i = 0; i < out.length; i += 128) {
    const n = Math.min(128, out.length - i)
    const blk = new Float32Array(n)
    m.render(blk, n)
    out.set(blk, i)
  }
  return out
}

const rms = (x: Float32Array, de = 0) => {
  let s = 0
  for (let i = de; i < x.length; i++) s += x[i] * x[i]
  return Math.sqrt(s / (x.length - de))
}

// período dominante pela autocorrelação
function periodo(x: Float32Array, min: number, max: number): number {
  let melhor = min, nota = -Infinity
  for (let lag = min; lag <= max; lag++) {
    let s = 0
    for (let i = SR * 0.3; i < x.length - lag; i++) s += x[i] * x[i + lag]
    if (s > nota) { nota = s; melhor = lag }
  }
  return melhor
}

describe("motor gravado (grãos síncronos ao giro)", () => {
  it("sem banco fica em silêncio", () => {
    const m = new MotorGravado(SR)
    expect(rms(tocar(m, 3000, 1, 0.2))).toBe(0)
  })

  it("segue o giro pedido: explosão a giro/60 × cilindros/2", () => {
    const m = new MotorGravado(SR)
    m.setBanco(bancoSintetico())
    for (const rpm of [1500, 3000, 6000]) {
      const x = tocar(m, rpm, 1, 1)
      expect(x.every(Number.isFinite)).toBe(true)
      const hz = rpm / 60 * 2
      const p = periodo(x, Math.floor(SR / hz * 0.8), Math.ceil(SR / hz * 1.2))
      expect(Math.abs(SR / p - hz) / hz).toBeLessThan(0.03)
    }
  })

  it("fora da faixa gravada ainda alcança o giro (reamostrando)", () => {
    const m = new MotorGravado(SR)
    m.setBanco(bancoSintetico())
    const x = tocar(m, 9000, 1, 1) // 300 Hz: acima dos 260 da gravação
    const p = periodo(x, 40, 70)
    expect(Math.abs(SR / p - 300) / 300).toBeLessThan(0.04)
  })

  it("pé fora soa mais baixo que pé no fundo", () => {
    const m = new MotorGravado(SR)
    m.setBanco(bancoSintetico())
    const cheio = rms(tocar(m, 4000, 1, 1), SR * 0.3)
    const fora = rms(tocar(m, 4000, 0, 1), SR * 0.3)
    expect(fora).toBeLessThan(cheio * 0.8)
    expect(fora).toBeGreaterThan(0)
  })

  it("janelas somam 1 mesmo com o giro mudando rápido (sem tremor de volume)", () => {
    // gravação "DC": toda amostra vale 1, então a saída é a própria soma das janelas
    const dur = 10, dados = new Float32Array(SR * dur).fill(1)
    const graos: number[][] = []
    for (let i = 0; i < 400; i++) {
      const hz = 20 * Math.pow(300 / 20, i / 399)
      graos.push([1 + 8 * i / 399, 1 / hz, 1 / hz, hz, CARGA, 1])
    }
    const m = new MotorGravado(SR)
    m.setBanco({ nome: "dc", sr: SR, dados, graos: graosDoJson(graos), cilindros: 4 })
    tocar(m, 3000, 1, 0.6) // volume (amp) assenta
    let pior = 0
    const blk = new Float32Array(128)
    for (let i = 0; i < SR * 2; i += 128) {
      // troca de marcha e pé: o giro pula entre 1500 e 7000 a cada 50 ms
      m.st.rpm = Math.floor(i / (SR * 0.05)) % 2 ? 7000 : 1500
      m.render(blk, 128)
      for (const v of blk) pior = Math.max(pior, Math.abs(v - 1))
    }
    expect(pior).toBeLessThan(1e-3)
  })

  it("no limitador metade das explosões falha (grão de alívio), mesmo seguindo a gravação", () => {
    const b = bancoSintetico()
    // fração de grãos de alívio tocados em 1 s
    const falhas = (corte: boolean) => {
      const m = new MotorGravado(SR, 3)
      m.setBanco(b)
      m.fixar(3000, 1); m.st.corte = corte
      const um = new Float32Array(1)
      let ant = -1, n = 0, alivio = 0
      for (let i = 0; i < SR; i++) {
        m.render(um, 1)
        const u = m["ultimo"]
        if (u !== ant && u >= 0) { n++; if (b.graos[u * 6 + 4] === ALIVIO) alivio++; ant = u }
      }
      return alivio / n
    }
    expect(falhas(false)).toBeLessThan(0.05)
    const f = falhas(true)
    expect(f).toBeGreaterThan(0.35)
    expect(f).toBeLessThan(0.65)
  })

  it("desligado, some", () => {
    const m = new MotorGravado(SR)
    m.setBanco(bancoSintetico())
    tocar(m, 2000, 0.5, 0.3)
    m.st.ligado = false
    const x = tocar(m, 2000, 0.5, 0.5)
    expect(rms(x, SR * 0.3)).toBeLessThan(1e-3)
  })
})
