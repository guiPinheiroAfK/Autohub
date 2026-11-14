// AutoDash — sound/engine-synth.ts. Síntese de motor por PULSOS DE COMBUSTÃO.
// DSP puro (sem WebAudio): roda no AudioWorklet e nos testes. A cada evento de
// ignição do perfil nasce um pulso de pressão com envelope bi-exponencial
// (sobe rápido, decai em `pulsoMs`); a soma dos pulsos é o escape bruto. Os
// filtros de corpo/coletor/abafador ficam nos nós do WebAudio (audio.ts).
//
// Saída em 2 canais: [0] escape, [1] admissão (ruído com envelope curto, que só
// aparece no alto giro com o pé no fundo).

import type { EngineSoundProfile } from "./profiles"

interface Pulso { t: number; a: number; t1: number; t2: number; t3: number; asp: number }

export interface EngineSynthState {
  rpm: number      // giro alvo
  carga: number    // 0..1 (acelerador)
  ligado: boolean
  corte: boolean   // limitador: corta parte das ignições
}

export class EngineSynth {
  private ang = 0                  // grau no ciclo de 720°
  private prox = 0                 // índice do próximo evento
  private pulsos: Pulso[] = []
  private rpm = 900
  private carga = 0
  private seed: number
  private sr: number
  private perfil: EngineSoundProfile
  st: EngineSynthState = { rpm: 900, carga: 0, ligado: true, corte: false }

  constructor(sr: number, perfil: EngineSoundProfile, seed = 1) {
    this.sr = sr
    this.perfil = perfil
    this.seed = seed >>> 0 || 1
  }

  setPerfil(p: EngineSoundProfile) {
    if (p.id === this.perfil.id) return
    this.perfil = p
    this.prox = this.indiceApos(this.ang)
  }

  private rnd(): number {
    // mulberry32: determinístico pros testes
    let t = (this.seed = (this.seed + 0x6d2b79f5) >>> 0)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  private indiceApos(ang: number): number {
    const ev = this.perfil.eventos
    for (let i = 0; i < ev.length; i++) if (ev[i].ang >= ang) return i
    return ev.length
  }

  private disparar(i: number) {
    const p = this.perfil, e = p.eventos[i], rpm = Math.max(this.rpm, 300)
    if (!this.st.ligado || this.rpm < 150) return
    if (this.st.corte && this.rnd() < 0.7) return
    // intervalo médio entre pulsos (s): o pulso não pode ser mais largo que ele
    const iv = 120 / (rpm * p.eventos.length)
    const t1 = Math.min(p.pulsoMs / 1000, 0.42 * iv)
    const a = (0.3 + 0.7 * this.carga) * Math.min(1, Math.sqrt(2200 / rpm)) * e.ganho
      * (1 + p.jitter * (this.rnd() * 2 - 1))
    this.pulsos.push({ t: -e.atrasoMs / 1000, a, t1, t2: t1 * 0.22, t3: Math.min(0.0011, 0.25 * iv), asp: p.aspereza })
  }

  /** Preenche `esc` (escape) e `adm` (admissão) com n amostras. */
  render(esc: Float32Array, adm: Float32Array, n = esc.length) {
    const dt = 1 / this.sr, ev = this.perfil.eventos
    for (let s = 0; s < n; s++) {
      // giro e carga seguem o alvo suavizados (o motor tem inércia)
      this.rpm += (this.st.rpm - this.rpm) * 0.0015
      this.carga += (this.st.carga - this.carga) * 0.002
      // eventos ordenados por ângulo; `prox` aponta o próximo a disparar
      this.ang += this.rpm / 60 * 360 * dt
      if (this.ang >= 720) {
        while (this.prox < ev.length) this.disparar(this.prox++)
        this.ang -= 720
        this.prox = 0
      }
      while (this.prox < ev.length && ev[this.prox].ang <= this.ang) this.disparar(this.prox++)
      let x = 0, y = 0
      for (let j = this.pulsos.length - 1; j >= 0; j--) {
        const q = this.pulsos[j]
        if (q.t >= 0) {
          const env = Math.exp(-q.t / q.t1) - Math.exp(-q.t / q.t2)
          x += q.a * env
          if (q.asp > 0) x += q.a * q.asp * (this.rnd() * 2 - 1) * Math.exp(-q.t / q.t3) * 2
          y += q.a * (this.rnd() * 2 - 1) * Math.exp(-q.t / q.t3)
        }
        q.t += dt
        if (q.t > q.t1 * 8 + 0.002) this.pulsos.splice(j, 1)
      }
      esc[s] = x
      adm[s] = y
    }
  }
}

/** Frequência de disparo (Hz) de um perfil num giro: rpm/60 × eventos/2. */
export function freqDisparo(p: EngineSoundProfile, rpm: number): number {
  return rpm / 60 * p.eventos.length / 2
}
