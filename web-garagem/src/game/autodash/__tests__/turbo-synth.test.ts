// Som do turbo (sound/turbo-synth.ts): apito segue o eixo, alívio soa e some, sem NaN.
import { describe, it, expect } from "vitest"
import { TurboSynth, GatilhoAlivio, eixoDoSom, type TurboSom } from "../sound/turbo-synth"

const SR = 48000
const S15: TurboSom = { apito: [1400, 6000], turbinas: 1, cilindros: 4, flutter: true }
const SUPRA: TurboSom = { apito: [1300, 5500], turbinas: 2, cilindros: 6, flutter: false }

function rodar(t: TurboSynth, seg: number): Float32Array {
  const out = new Float32Array(Math.floor(seg * SR)), b = new Float32Array(128)
  for (let i = 0; i < out.length; i += 128) {
    const n = Math.min(128, out.length - i)
    t.render(b, n); out.set(b.subarray(0, n), i)
  }
  return out
}
const rms = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length)

/** Frequência de maior energia entre `lo` e `hi` Hz (DFT direta, passo de 10 Hz). */
function pico(x: Float32Array, lo: number, hi: number): number {
  let melhor = 0, fm = 0
  for (let f = lo; f <= hi; f += 10) {
    let re = 0, im = 0
    for (let i = 0; i < x.length; i++) { const w = 2 * Math.PI * f * i / SR; re += x[i] * Math.cos(w); im += x[i] * Math.sin(w) }
    const p = re * re + im * im
    if (p > melhor) { melhor = p; fm = f }
  }
  return fm
}

describe("turbo", () => {
  it("o apito sobe de tom com o eixo e acompanha a faixa da turbina", () => {
    for (const [eixo, alvo] of [[0.3, 1400 + 4600 * Math.pow(0.3, 1.25)], [0.9, 1400 + 4600 * Math.pow(0.9, 1.25)]]) {
      const t = new TurboSynth(SR, 3); t.setConfig(S15)
      Object.assign(t.st, { eixo, boost: eixo, carga: 1, rpm: 5000, ligado: true })
      const x = rodar(t, 0.6).subarray(Math.floor(0.4 * SR))
      expect(Math.abs(pico(x, alvo * 0.8, alvo * 1.2) - alvo) / alvo).toBeLessThan(0.02)
    }
  })

  it("blow-off e flutter soam ao aliviar e somem sozinhos, sem NaN", () => {
    for (const cfg of [S15, SUPRA]) {
      const t = new TurboSynth(SR, 5); t.setConfig(cfg)
      Object.assign(t.st, { eixo: 0.9, boost: 0.9, carga: 1, rpm: 6000, ligado: true })
      const pe = rodar(t, 1.5).subarray(SR) // pé no fundo com o eixo já cheio
      Object.assign(t.st, { eixo: 0.5, boost: 0, carga: 0 })
      t.alivio(0.9)
      const alivio = rodar(t, 0.3), depois = (rodar(t, 1.4), rodar(t, 0.3))
      for (const x of [pe, alivio, depois]) expect(x.every(Number.isFinite)).toBe(true)
      expect(rms(alivio), cfg.flutter ? "flutter" : "blow-off").toBeGreaterThan(2 * rms(pe))
      expect(rms(depois)).toBeLessThan(rms(alivio) / 10)
    }
  })

  it("sem turbo (config nula) fica mudo", () => {
    const t = new TurboSynth(SR); t.setConfig(null)
    Object.assign(t.st, { eixo: 1, boost: 1, carga: 1, rpm: 6000, ligado: true })
    t.alivio(1)
    expect(rodar(t, 0.2).every(v => v === 0)).toBe(true)
  })

  it("o alívio dispara uma vez por tirada de pé, também com pedal analógico", () => {
    const g = new GatilhoAlivio()
    // pedal que cai aos poucos (mouse, toque): passa por 0,4 antes de 0,2
    const disparos = [1, 0.8, 0.6, 0.4, 0.2, 0.1, 0].map(c => g.passo(c, 0.8)).filter(Boolean)
    expect(disparos).toEqual([0.8])
    // eixo parado não alivia; sem pisar de novo não alivia outra vez
    expect([1, 0].map(c => g.passo(c, 0.2)).filter(Boolean)).toEqual([])
    expect(g.passo(0, 0.9)).toBe(0)
  })

  it("o eixo do som sobe com o atraso do turbo e desce devagar", () => {
    const tb = { spool: 2600, cheio: 4000, lag: 0.45, peso: 0.4, apito: [1400, 6000] as [number, number] }
    let e = 0
    for (let i = 0; i < 30; i++) e = eixoDoSom(e, 1, 6000, 7500, 1, 1 / 60, tb)
    expect(e).toBeGreaterThan(0.5); expect(e).toBeLessThan(0.95)
    const cheio = e
    for (let i = 0; i < 30; i++) e = eixoDoSom(e, 0, 6000, 7500, 0, 1 / 60, tb)
    expect(e).toBeGreaterThan(cheio * 0.6) // desce em ~1,5 s, não na hora
  })

  it("com o pé no fundo e a pressão cheia, o eixo segue o giro (apito sobe na marcha e cai na troca)", () => {
    const tb = { spool: 2600, cheio: 4000, lag: 0.45, peso: 0.4, apito: [1400, 6000] as [number, number] }
    const assenta = (rpm: number, e0: number) => { let e = e0; for (let i = 0; i < 240; i++) e = eixoDoSom(e, 1, rpm, 7500, 1, 1 / 60, tb); return e }
    const meio = assenta(4500, 0), topo = assenta(7200, meio)
    expect(topo - meio).toBeGreaterThan(0.15)
    // troca: giro cai 35% com o pé embaixo; em 0,5 s o eixo já desceu boa parte
    let e = topo
    for (let i = 0; i < 30; i++) e = eixoDoSom(e, 1, 4700, 7500, 1, 1 / 60, tb)
    expect(topo - e).toBeGreaterThan(0.08)
  })
})
