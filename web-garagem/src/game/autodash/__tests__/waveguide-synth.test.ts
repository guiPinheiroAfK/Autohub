import { describe, it, expect } from "vitest"
import { WaveguideSynth, motorGuiasDoPerfil } from "../sound/waveguide-synth"
import { ENGINE_PROFILES } from "../sound/profiles"

const SR = 22050

function render(id: string, rpm: number, carga = 1, seg = 1, corte = false) {
  const s = new WaveguideSynth(SR, ENGINE_PROFILES[id], 9)
  s.st.rpm = rpm; s.st.carga = carga; s.st.corte = corte
  const n = Math.round(SR * seg)
  const w = new Float32Array(SR / 2), w2 = new Float32Array(SR / 2)
  s.render(w, w2) // aquece os dutos
  const a = new Float32Array(n), b = new Float32Array(n)
  s.render(a, b)
  return a
}
const rms = (x: Float32Array) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length)
function mag(x: Float32Array, f: number) {
  let re = 0, im = 0
  const w = 2 * Math.PI * f / SR
  for (let i = 0; i < x.length; i++) { re += x[i] * Math.cos(w * i); im -= x[i] * Math.sin(w * i) }
  return Math.hypot(re, im) / x.length
}

describe("motor por guias de onda (modelo físico)", () => {
  it("todo perfil gera som finito e estável em todo o giro (sem realimentação explodindo)", () => {
    for (const id of Object.keys(ENGINE_PROFILES)) {
      for (const rpm of [800, 4000, 9000]) {
        const x = render(id, rpm, 1, 0.5)
        // um expect por amostra deixava o teste lento (centenas de milhares de chamadas)
        let pico = 0, ruins = 0
        for (const v of x) { if (!Number.isFinite(v)) ruins++; pico = Math.max(pico, Math.abs(v)) }
        expect(ruins, `${id} @${rpm}`).toBe(0)
        expect(rms(x), `${id} @${rpm}`).toBeGreaterThan(1e-4)
        expect(pico, `${id} @${rpm}`).toBeLessThan(5)
      }
    }
  })

  it("o 4 cilindros tem energia na frequência de disparo", () => {
    const x = render("i4", 3000)
    const f = 100
    expect(mag(x, f)).toBeGreaterThan(mag(x, f * 0.75) * 2)
  })

  it("pé no fundo é mais alto que aliviado; limitador derruba o som", () => {
    expect(rms(render("v8-cruzado-ford", 4000, 1))).toBeGreaterThan(rms(render("v8-cruzado-ford", 4000, 0)) * 1.3)
    expect(rms(render("i4", 8500, 1, 1, true))).toBeLessThan(rms(render("i4", 8500, 1)))
  })

  it("cano de V8 é mais longo que o de 4 cilindros (corpo mais grave)", () => {
    expect(motorGuiasDoPerfil(ENGINE_PROFILES["v8-cruzado-ford"]).cano.atraso)
      .toBeGreaterThan(motorGuiasDoPerfil(ENGINE_PROFILES["i4-pequeno"]).cano.atraso)
  })
})
