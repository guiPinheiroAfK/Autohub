// AutoDash — sound/turbo-synth.ts. Som do turbo por modelo (DSP puro: roda no
// AudioWorklet e nos testes). Antes eram três senos e um ruído filtrado no
// WebAudio: um apito "de sintetizador", liso e parado. Aqui o turbo é tratado
// como a máquina que ele é:
//
//   - APITO: passagem das pás do compressor. Não é um seno puro: o eixo flutua
//     (folga do mancal, ar turbulento) e cada pulso do escape empurra a turbina,
//     então o tom tem largura (ruído ressonante na mesma frequência), um leve
//     tremor e um "pulsar" no ritmo da ignição. Biturbo: duas turbinas, cada
//     uma com metade dos cilindros, desafinadas e com os pulsos defasados.
//   - SOPRO: o ar entrando no compressor, ruído largo que pulsa com a admissão.
//   - ALÍVIO ao tirar o pé com pressão no coletor:
//       blow-off ("pssh"): a válvula abre de estalo e o jato perde pressão; o
//       chiado desce de tom junto com a pressão.
//       flutter ("tututu"): sem válvula, o ar volta pelo compressor em surtos;
//       cada surto é um sopro com um pio do eixo, cada vez mais lento, e o apito
//       engasga junto.
//
// O eixo (0..1) vem da thread principal (eixoDoSom, com a física do turbo); aqui
// ele só é suavizado por amostra.

import type { Turbo } from "../physics/motores"
import { Sorteio } from "./sorteio"

/** Configuração do turbo no som (sai de physics/motores.ts e do perfil de som). */
export interface TurboSom {
  apito: [number, number] // faixa do apito (Hz) do eixo parado ao eixo cheio
  turbinas: number        // 1, 2 ou 4
  cilindros: number       // eventos de ignição por ciclo (ritmo dos pulsos)
  flutter: boolean        // sem válvula de alívio: surto do compressor
}

export interface TurboState {
  eixo: number   // giro do eixo, 0..1
  boost: number  // pressão no coletor, 0..1
  carga: number  // acelerador, 0..1
  rpm: number
  ligado: boolean
}

/**
 * Passo do eixo da turbina no som. O eixo gira com o FLUXO do escape, que
 * cresce com o giro: com a pressão cheia (pé no fundo) a válvula de alívio
 * segura a pressão, mas o eixo continua subindo com o giro. Assim o apito sobe
 * dentro de cada marcha e cai na troca, em vez de ficar parado no máximo
 * enquanto o W está apertado (era o que acontecia: o eixo seguia a pressão).
 * Sem a pressão da física (boostFisico < 0) estima pela energia do escape.
 */
export function eixoDoSom(eixo: number, boostFisico: number, rpm: number, corteMotor: number, carga: number, dt: number, tb: Turbo | null): number {
  const giro = Math.min(1, Math.max(0, rpm / corteMotor))
  const energia = Math.min(1.2, rpm / corteMotor) * (0.15 + 0.85 * carga)
  const alvo = boostFisico >= 0
    ? Math.min(1, boostFisico * (0.4 + 0.6 * giro))
    : Math.min(1, energia * 1.3) // válvula de alívio do escape limita o eixo
  const lag = tb?.lag ?? 0.35
  // sobe com o atraso do turbo; com o pé ainda embaixo (troca de marcha) desce
  // rápido junto com o giro; aliviado, desce devagar (o assobio que vai morrendo)
  const tau = alvo > eixo ? lag * 1.2 : carga > 0.5 ? lag * 1.5 : (tb?.desce ?? 1.5)
  return eixo + (alvo - eixo) * Math.min(1, dt / tau)
}

/**
 * Quando aliviar: pé passou de 0,5 e depois caiu abaixo de 0,3 com o eixo ainda
 * girando (> 0,35). Trava entre os dois limiares, então um pedal analógico
 * (mouse, toque) que cai aos poucos também dispara. Devolve o nível (0 = nada).
 */
export class GatilhoAlivio {
  private armado = false
  passo(carga: number, eixo: number): number {
    if (carga > 0.5) { this.armado = true; return 0 }
    if (this.armado && carga < 0.3) {
      this.armado = false
      if (eixo > 0.35) return Math.max(0.5, eixo)
    }
    return 0
  }
}

/** Passa-faixa RBJ de pico constante (0 dB), coeficientes trocáveis. */
class PassaFaixa {
  private b0 = 0; private a1 = 0; private a2 = 0
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0
  set(f: number, q: number, sr: number) {
    const w = 2 * Math.PI * Math.min(f, sr * 0.45) / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al
    this.b0 = al / a0; this.a1 = -2 * Math.cos(w) / a0; this.a2 = (1 - al) / a0
  }
  run(x: number): number {
    const y = this.b0 * (x - this.x2) - this.a1 * this.y1 - this.a2 * this.y2
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y
    return y
  }
}

/** Passa-altas de 1 polo. */
class PassaAlta {
  private k: number; private lp = 0
  constructor(f: number, sr: number) { this.k = 1 - Math.exp(-2 * Math.PI * f / sr) }
  run(x: number): number { this.lp += (x - this.lp) * this.k; return x - this.lp }
}

class Turbina {
  fase = 0            // fase do apito (ciclos)
  pulso = 0           // fase do pulso do escape desta turbina (ciclos)
  tremor = 0          // ruído lento do eixo
  ar = new PassaFaixa() // largura do tom: ruído ressonante no apito
  readonly desafina: number
  readonly ganho: number
  constructor(desafina: number, ganho: number, defasagem: number) { this.desafina = desafina; this.ganho = ganho; this.pulso = defasagem }
}

// níveis (mesma escala dos ganhos antigos do WebAudio, na entrada de `out`)
const APITO_MAX = 0.06
const TREMOR = 0.004        // desvio do eixo (fração da frequência)
const PULSO_FM = 0.0025     // cada pulso do escape acelera o eixo um pouco
const PULSO_AM = 0.3        // e o apito pulsa junto
const SOPRO_K = 0.014
const BOV_K = 0.18          // blow-off (já com a saturação que o efeito antigo levava)
const FLUTTER_K = 0.2

export class TurboSynth {
  st: TurboState = { eixo: 0, boost: 0, carga: 0, rpm: 900, ligado: false }
  cfg: TurboSom | null = null
  private sr: number
  private rnd: Sorteio
  private turbinas: Turbina[] = []
  private eixo = 0            // eixo suavizado por amostra
  private eixoLento = 0       // para medir a aceleração do eixo
  private subindo = 0
  private descendo = 0        // eixo desacelerando sem carga: o assobio que desce depois do alívio
  private carga = 0
  private boost = 0
  private sopro = new PassaFaixa()
  private n = 0               // amostra (para atualizar filtros a cada 32)
  // blow-off
  private bovT = -1
  private bovNivel = 0
  private bovHp: PassaAlta
  private bovJato = new PassaFaixa()
  // flutter
  private flT = -1
  private flFim = 0
  private flNivel = 0
  private flProx = 0          // próximo surto (s desde o início)
  private flHz = 13
  private flSurto = -1        // s desde o último surto
  private flPer = 0.08
  private flAmp = 0
  private flPio = 0           // fase do pio do surto
  private flPioHz = 0
  private flBp = new PassaFaixa()

  constructor(sr: number, seed = 7) {
    this.sr = sr
    this.rnd = new Sorteio(seed, 7)
    this.bovHp = new PassaAlta(1800, sr)
  }

  setConfig(c: TurboSom | null) {
    this.cfg = c
    if (!c) { this.turbinas = []; return }
    const n = Math.max(1, Math.min(4, c.turbinas))
    // até duas turbinas soando (quadri = duas mais desafinadas)
    this.turbinas = n === 1 ? [new Turbina(1, 1, 0)]
      : [new Turbina(1, 1, 0), new Turbina(1.013 + 0.004 * (n - 2), 0.7, 0.5)]
  }

  /** Tirou o pé com pressão: blow-off ou flutter (conforme o turbo), `nivel` 0..1. */
  alivio(nivel: number) {
    if (!this.cfg) return
    if (this.cfg.flutter) {
      this.flT = 0; this.flNivel = nivel; this.flFim = 0.45 + nivel * 0.45
      this.flProx = 0.015; this.flHz = 13; this.flSurto = -1
    } else {
      this.bovT = 0; this.bovNivel = nivel
    }
  }

  private ruido(): number { return this.rnd.proximo() * 2 - 1 }

  render(out: Float32Array, n: number) {
    const c = this.cfg
    if (!c || (!this.st.ligado && this.eixo < 0.01 && this.bovT < 0 && this.flT < 0)) { out.fill(0, 0, n); return }
    const sr = this.sr, dt = 1 / sr
    const kE = 1 - Math.exp(-dt / 0.015), kL = 1 - Math.exp(-dt / 0.06), kC = 1 - Math.exp(-dt / 0.03)
    const kTremor = 1 - Math.exp(-2 * Math.PI * 25 * dt)
    const [f0, f1] = c.apito
    const nt = this.turbinas.length
    // pulsos por turbina: cada turbina recebe o escape de metade dos cilindros
    const pulsosPorVolta = c.cilindros / 2 / nt
    const alvoE = Math.max(0, Math.min(1, this.st.eixo))
    for (let i = 0; i < n; i++) {
      this.eixo += (alvoE - this.eixo) * kE
      const antes = this.eixoLento
      this.eixoLento += (this.eixo - this.eixoLento) * kL
      // eixo acelerando (por segundo), suavizado: o apito aparece na subida
      this.subindo += (Math.max(0, (this.eixoLento - antes) * sr) - this.subindo) * kL
      this.descendo += (Math.max(0, (antes - this.eixoLento) * sr) - this.descendo) * kL
      this.carga += (this.st.carga - this.carga) * kC
      this.boost += (this.st.boost - this.boost) * kC
      const e = this.eixo, carga = this.carga
      if ((this.n++ & 31) === 0) {
        const fs = 1500 + 3000 * e
        this.sopro.set(fs, 0.8, sr)
        for (const tb of this.turbinas) {
          const fa = (f0 + (f1 - f0) * Math.pow(e, 1.25)) * tb.desafina
          tb.ar.set(fa, 30, sr)
        }
      }
      // ---- apito (+ engasgo durante o flutter)
      let engasgo = 1
      if (this.flT >= 0 && this.flSurto >= 0) engasgo = 1 - 0.7 * Math.exp(-this.flSurto / (this.flPer * 0.35))
      const nivelApito = Math.min(APITO_MAX, e * e * (0.003 + 0.009 * carga) + this.subindo * 0.035
        + this.descendo * e * 0.03 * (1 - carga)) * engasgo
      const fPulso = this.st.rpm / 60 * pulsosPorVolta
      let apito = 0, pulsoMedio = 0
      for (const tb of this.turbinas) {
        tb.pulso += fPulso * dt; tb.pulso -= Math.floor(tb.pulso)
        const cp = Math.cos(2 * Math.PI * tb.pulso), p = cp > 0 ? cp * cp * cp * cp : 0 // pulso curto (média ≈ 0,19)
        pulsoMedio += p / nt
        tb.tremor += (this.ruido() - tb.tremor) * kTremor
        const fa = (f0 + (f1 - f0) * Math.pow(e, 1.25)) * tb.desafina
          * (1 + TREMOR * 8 * tb.tremor + PULSO_FM * carga * p)
        tb.fase += fa * dt; tb.fase -= Math.floor(tb.fase)
        const th = 2 * Math.PI * tb.fase
        const tom = Math.sin(th) + 0.2 * Math.sin(2 * th)
        // ar: ruído ressonante (Q 30) normalizado para ~0,5 de RMS
        const ar = tb.ar.run(this.ruido()) * Math.sqrt(30 * sr / (Math.PI * fa)) * 0.85
        apito += tb.ganho * (0.75 * tom + 0.5 * ar) * (1 + PULSO_AM * carga * (p - 0.19))
      }
      let s = nivelApito * apito
      // ---- sopro do compressor (pulsa com a admissão)
      const nivelSopro = this.boost * carga * SOPRO_K + this.subindo * 0.012
      if (nivelSopro > 1e-5) s += nivelSopro * this.sopro.run(this.ruido()) * 2.2 * (1 + 0.3 * (pulsoMedio - 0.19))
      // ---- blow-off: estalo da válvula + jato que perde pressão
      if (this.bovT >= 0) {
        const t = this.bovT, tau = 0.1 + 0.12 * this.bovNivel
        const P = Math.exp(-t / tau)
        if ((this.n & 31) === 1) this.bovJato.set(2500 + 3500 * P, 1.5, sr)
        const ataque = Math.min(1, t / 0.004)
        const w = this.bovHp.run(this.ruido())
        const jato = 0.55 * this.bovJato.run(w) * 2.2 + 0.45 * w
        const estalo = t < 0.004 ? this.ruido() * Math.exp(-t / 0.0006) * 0.25 : 0
        s += BOV_K * this.bovNivel * (Math.sqrt(P) * ataque * jato + estalo)
        this.bovT += dt
        if (P < 0.005) this.bovT = -1
      }
      // ---- flutter: surtos cada vez mais lentos, cada um com um pio do eixo
      if (this.flT >= 0) {
        const t = this.flT
        if (t >= this.flProx && t < this.flFim) {
          const fase = t / this.flFim
          this.flPer = 1 / this.flHz
          this.flAmp = this.flNivel * (1 - 0.75 * fase) * (0.85 + 0.3 * this.rnd.proximo())
          this.flBp.set(2800 * (1 - 0.55 * fase), 1.8, sr)
          this.flPioHz = (f0 + (f1 - f0) * Math.pow(e, 1.25)) * 0.5
          this.flSurto = 0
          this.flProx = t + this.flPer * (0.92 + 0.16 * this.rnd.proximo())
          this.flHz = Math.max(7.5, this.flHz * 0.95)
        }
        if (this.flSurto >= 0) {
          const u = this.flSurto, env = Math.min(1, u / 0.002) * Math.exp(-u / (this.flPer * 0.3))
          // pio: o eixo engasga e cai de tom dentro do surto
          this.flPio += this.flPioHz * (1 - 1.5 * u) * dt; this.flPio -= Math.floor(this.flPio)
          const surto = this.flBp.run(this.ruido()) * 2.5 + 0.35 * Math.sin(2 * Math.PI * this.flPio)
          s += FLUTTER_K * this.flAmp * env * surto
          this.flSurto += dt
        }
        this.flT += dt
        if (t > this.flFim + 0.15) { this.flT = -1; this.flSurto = -1 }
      }
      out[i] = s
    }
  }
}
