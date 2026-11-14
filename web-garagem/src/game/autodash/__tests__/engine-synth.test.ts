import { describe, it, expect } from "vitest"
import { EngineSynth, freqDisparo } from "../sound/engine-synth"
import { ENGINE_PROFILES, MOTOR_DO_CARRO, perfilDoCarro } from "../sound/profiles"
import { CARS } from "../data"

const SR = 22050

// 1 s de escape em regime (descarta o primeiro 0,5 s de aquecimento)
function escape(id: string, rpm: number, carga = 1): Float32Array {
  const s = new EngineSynth(SR, ENGINE_PROFILES[id], 42)
  s.st.rpm = rpm; s.st.carga = carga
  const lixo = new Float32Array(SR / 2), lixo2 = new Float32Array(SR / 2)
  s.render(lixo, lixo2)
  const esc = new Float32Array(SR), adm = new Float32Array(SR)
  s.render(esc, adm)
  let m = 0
  for (const v of esc) m += v
  m /= esc.length
  return esc.map(v => v - m)
}

// magnitude da DFT numa frequência (Hz)
function mag(x: Float32Array, f: number): number {
  let re = 0, im = 0
  const w = 2 * Math.PI * f / SR
  for (let i = 0; i < x.length; i++) { re += x[i] * Math.cos(w * i); im -= x[i] * Math.sin(w * i) }
  return Math.hypot(re, im) / x.length
}

function rms(x: Float32Array): number {
  let s = 0
  for (const v of x) s += v * v
  return Math.sqrt(s / x.length)
}

describe("síntese de motor por pulsos", () => {
  it("frequência de disparo = rpm/60 × cilindros/2", () => {
    expect(freqDisparo(ENGINE_PROFILES.i4, 3000)).toBe(100)
    expect(freqDisparo(ENGINE_PROFILES.i5, 3000)).toBe(125)
    expect(freqDisparo(ENGINE_PROFILES["v8-cruzado"], 3000)).toBe(200)
  })

  it("o 4 cilindros tem pico na frequência de disparo, não no meio", () => {
    const x = escape("i4", 3000)
    expect(mag(x, 100)).toBeGreaterThan(mag(x, 75) * 3)
    expect(mag(x, 100)).toBeGreaterThan(mag(x, 125) * 3)
  })

  it("o 5 cilindros soa em 2,5× a rotação (144° entre disparos)", () => {
    const x = escape("i5", 3000)
    expect(mag(x, 125)).toBeGreaterThan(mag(x, 100) * 3)
  })

  it("V8 cruzado tem 'burble' (sub-harmônicos) que o V8 plano não tem", () => {
    const sub = (x: Float32Array) => [25, 50, 75, 125, 150, 175].reduce((s, f) => s + mag(x, f), 0) / mag(x, 200)
    expect(sub(escape("v8-cruzado", 3000))).toBeGreaterThan(sub(escape("v8-plano", 3000)) * 2)
  })

  it("boxer com coletor desigual galopa mais que o 4 em linha", () => {
    const galope = (x: Float32Array) => mag(x, 50) / mag(x, 100)
    expect(galope(escape("boxer4", 3000))).toBeGreaterThan(galope(escape("i4", 3000)))
  })

  it("acelerador cheio é mais alto que motor aliviado", () => {
    expect(rms(escape("i6", 4000, 1))).toBeGreaterThan(rms(escape("i6", 4000, 0)) * 1.8)
  })

  it("limitador corta ignições (som cai e falha)", () => {
    const s = new EngineSynth(SR, ENGINE_PROFILES.i4, 7)
    s.st.rpm = 7800; s.st.carga = 1
    const a = new Float32Array(SR), b = new Float32Array(SR)
    s.render(a, b)
    const livre = rms(a)
    s.st.corte = true
    s.render(a, b)
    expect(rms(a)).toBeLessThan(livre * 0.8)
  })

  it("desligado não faz som; saída é finita em todo o giro", () => {
    for (const id of Object.keys(ENGINE_PROFILES)) {
      for (const rpm of [800, 3000, 8000]) {
        const x = escape(id, rpm)
        for (let i = 0; i < x.length; i += 97) expect(Number.isFinite(x[i])).toBe(true)
      }
    }
    const s = new EngineSynth(SR, ENGINE_PROFILES.i4)
    s.st.ligado = false
    const a = new Float32Array(SR / 4), b = new Float32Array(SR / 4)
    s.render(a, b)
    expect(rms(a)).toBe(0)
  })

  it("todo carro do jogo tem um motor com perfil", () => {
    for (const c of CARS) {
      expect(perfilDoCarro(c.body).eventos.length).toBeGreaterThan(0)
      if (MOTOR_DO_CARRO[c.body]) expect(ENGINE_PROFILES[MOTOR_DO_CARRO[c.body]]).toBeDefined()
    }
  })
})
