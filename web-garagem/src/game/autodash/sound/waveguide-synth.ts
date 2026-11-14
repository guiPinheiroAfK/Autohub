// AutoDash — sound/waveguide-synth.ts. Motor por GUIAS DE ONDA (modelo físico).
//
// Port para TypeScript do modelo do projeto "enginesound" de DasEtwas (MIT,
// https://github.com/DasEtwas/enginesound), que por sua vez segue Baldan et al.
// (2015), "Physically informed car engine sound synthesis for virtual and
// augmented environments". Acrescentado aqui: carga do acelerador (ignição e
// ruído de admissão crescem com o pé) e corte do limitador por cilindro.
//
// Ideia: cada cilindro tem três dutos com eco (admissão, escape e coletor do
// escape). O pistão empurra ar e a combustão dá um pulso; as válvulas abrem e
// fecham os dutos no tempo do virabrequim (mudando a reflexão). Os escapes se
// somam no coletor e passam pelo cano e pelo abafador, que também são dutos.
// O timbre sai dessas ressonâncias, não de filtros.

import type { EngineSoundProfile } from "./profiles"
import type { EngineSynthState } from "./engine-synth"
import { GANHOS_MOTOR } from "./ganhos-motor"
import { Sorteio } from "./sorteio"

const MAX_AMP = 20 // acima disso o duto "satura" (evita realimentação explodir)
// nível de saída (RMS) de todo motor a 3500 rpm com pé no fundo
const ALVO_RMS = 0.12
export const GIROS_MEDIDOS = [1200, 2200, 3000, 4200, 5500, 7000, 8500]
export const GANHO_SR = 48000 // taxa em que a tabela de ganhos é medida
const REF = 2 // índice de 3000 rpm: o nível de referência

function fract(x: number): number { return x - Math.trunc(x) }

function dampen(s: number): number {
  const a = Math.abs(s)
  if (a <= MAX_AMP) return s
  return Math.sign(s) * (MAX_AMP + 1 - 1 / (a - MAX_AMP + 1))
}

class Linha {
  private buf: Float32Array
  private pos = 0
  constructor(amostras: number) { this.buf = new Float32Array(Math.max(2, Math.round(amostras))) }
  ler(): number { const i = this.pos + 1; return this.buf[i === this.buf.length ? 0 : i] }
  escrever(v: number) { this.buf[this.pos] = v; if (++this.pos === this.buf.length) this.pos = 0 }
}

class Duto {
  private c0: Linha
  private c1: Linha
  private c0Out = 0
  private c1Out = 0
  alpha: number
  beta: number
  // saídas do último pop(): sem devolver array (roda milhões de vezes por segundo
  // na thread de áudio, e cada array novo vira lixo para o coletor)
  saiA = 0 // lado alpha
  saiB = 0 // lado beta
  constructor(atrasoS: number, sr: number, alpha: number, beta: number) {
    this.c0 = new Linha(atrasoS * sr); this.c1 = new Linha(atrasoS * sr)
    this.alpha = alpha; this.beta = beta
  }
  /** Lê as saídas: `saiA` (lado alpha) e `saiB` (lado beta). */
  pop() {
    this.c1Out = dampen(this.c1.ler())
    this.c0Out = dampen(this.c0.ler())
    this.saiA = this.c1Out * (1 - Math.abs(this.alpha))
    this.saiB = this.c0Out * (1 - Math.abs(this.beta))
  }
  push(x0: number, x1: number) {
    this.c0.escrever(this.c1Out * this.alpha + x0)
    this.c1.escrever(this.c0Out * this.beta + x1)
  }
}

class PassaBaixa {
  private a: number
  private y = 0
  constructor(constanteS: number, sr: number) { const dt = 1 / sr; this.a = dt / (constanteS + dt) }
  passo(x: number): number { this.y += this.a * (x - this.y); return this.y }
}

function valvulaEscape(c: number): number { return c > 0.75 && c < 1 ? -Math.sin(4 * Math.PI * c) : 0 }
function valvulaAdmissao(c: number): number { return c > 0 && c < 0.25 ? Math.sin(4 * Math.PI * c) : 0 }
function ignicao(c: number, t: number): number { return c > 0.5 && c < 0.5 + t / 2 ? Math.sin(2 * Math.PI * (c - 0.5) / t) : 0 }

/** Parâmetros físicos de um motor (tempos em segundos). */
export interface MotorGuias {
  cilindros: { offset: number; escape: number; admissao: number; coletor: number }[]
  escapeBeta: number; admissaoBeta: number; coletorBeta: number
  admAberta: number; admFechada: number; escAberta: number; escFechada: number
  pistao: number; ignicao: number; tempoIgnicao: number
  volAdmissao: number; volEscape: number; volVibracao: number
  ruidoAdm: number; ruidoAdmLp: number; vibracaoLp: number
  desvioAdm: number; desvioEsc: number
  flutuacao: number; flutuacaoLp: number
  cano: { atraso: number; alpha: number; beta: number }
  abafador: { atrasos: number[]; alpha: number; beta: number }
}

class Cilindro {
  esc: Duto; adm: Duto; col: Duto
  som = 0
  saiAdm = 0 // saída da admissão no último pop()
  saiEsc = 0 // saída do coletor do escape no último pop()
  private saidaColetor = 0
  corta = false // limitador: esta volta o cilindro não queima
  private ultimo = 0
  private m: MotorGuias
  private c: MotorGuias["cilindros"][number]
  constructor(m: MotorGuias, c: MotorGuias["cilindros"][number], sr: number) {
    this.m = m; this.c = c
    this.esc = new Duto(c.escape, sr, m.escFechada, m.escapeBeta)
    this.adm = new Duto(c.admissao, sr, m.admFechada, m.admissaoBeta)
    this.col = new Duto(c.coletor, sr, 0, m.coletorBeta)
  }
  /** Avança o cilindro: preenche `saiAdm`, `saiEsc` e `som`. */
  pop(manivela: number, escPrev: number, carga: number, sorteio: () => number, corte: boolean) {
    const m = this.m
    const cr = fract(manivela + this.c.offset)
    if (cr < this.ultimo) this.corta = corte && sorteio() < 0.7 // nova volta: sorteia se queima
    this.ultimo = cr
    const ign = this.corta ? 0 : ignicao(cr, m.tempoIgnicao) * m.ignicao * (0.18 + 0.82 * carga)
    // borboleta fechada = pouco ar: o pistão bombeia menos pressão sem gás
    this.som = Math.cos(4 * Math.PI * cr) * m.pistao * (0.4 + 0.6 * carga) + ign
    const ev = valvulaEscape(fract(cr + m.desvioEsc)), av = valvulaAdmissao(fract(cr + m.desvioAdm))
    this.esc.alpha = m.escFechada + (m.escAberta - m.escFechada) * ev
    this.adm.alpha = m.admFechada + (m.admAberta - m.admFechada) * av
    this.esc.pop(); this.adm.pop(); this.col.pop()
    this.saidaColetor = this.col.saiA
    this.col.push(this.esc.saiB, escPrev)
    this.saiAdm = this.adm.saiB; this.saiEsc = this.col.saiB
  }
  push(entradaAdm: number) {
    this.esc.push((1 - Math.abs(this.esc.alpha)) * this.som * 0.5, this.saidaColetor)
    this.adm.push((1 - Math.abs(this.adm.alpha)) * this.som * 0.5, entradaAdm)
  }
  valvulaAdm(manivela: number): number { return valvulaAdmissao(fract(manivela + this.c.offset)) }
}

export class WaveguideSynth {
  st: EngineSynthState = { rpm: 900, carga: 0, ligado: true, corte: false }
  private sr: number
  private m!: MotorGuias
  private cil: Cilindro[] = []
  private cano!: Duto
  private abaf: Duto[] = []
  private ruidoLp!: PassaBaixa
  private vibLp!: PassaBaixa
  private flutLp!: PassaBaixa
  private dcLp!: PassaBaixa
  private manivela = 0
  private coletorEsc = 0
  private rpm = 900
  private carga = 0
  private aleatorio: Sorteio
  private sorteio = () => this.rnd() // criado uma vez (não a cada amostra)
  private normalizar: boolean
  ganho = 1 // normaliza o volume entre motores e ao longo do giro (cada duto ressoa com força própria)
  perfilId = ""

  constructor(sr: number, perfil: EngineSoundProfile, seed = 1, normalizar = true) {
    this.sr = sr
    this.aleatorio = new Sorteio(seed, 1)
    this.normalizar = normalizar
    this.setPerfil(perfil)
  }

  /** Pula a suavização: giro e carga já no valor (para medir e para testes). */
  fixar(rpm: number, carga: number) {
    this.st.rpm = rpm; this.st.carga = carga
    this.rpm = rpm; this.carga = carga
  }

  private rnd(): number { return this.aleatorio.proximo() }

  setPerfil(p: EngineSoundProfile) {
    if (p.id === this.perfilId) return
    this.perfilId = p.id
    const m = motorGuiasDoPerfil(p)
    this.m = m
    const sr = this.sr
    this.cil = m.cilindros.map(c => new Cilindro(m, c, sr))
    this.cano = new Duto(m.cano.atraso, sr, m.cano.alpha, m.cano.beta)
    this.abaf = m.abafador.atrasos.map(d => new Duto(d, sr, m.abafador.alpha, m.abafador.beta))
    this.ruidoLp = new PassaBaixa(m.ruidoAdmLp, sr)
    this.vibLp = new PassaBaixa(m.vibracaoLp, sr)
    this.flutLp = new PassaBaixa(m.flutuacaoLp, sr)
    this.dcLp = new PassaBaixa(0.05, sr) // tira o DC (o pistão empurra num sentido só)
    this.coletorEsc = 0
    // curva de ganho pré-calculada (sound/ganhos-motor.ts); medir aqui na thread
    // de áudio travava o som ao trocar de carro nos motores grandes
    if (this.normalizar) this.curvaGanho = GANHOS_MOTOR[p.id] ?? medirCurvaGanho(sr, p)
  }

  private curvaGanho: number[] = GIROS_MEDIDOS.map(() => 1)

  /** Ganho de normalização no giro atual (interpolado em log entre os pontos medidos). */
  private ganhoNoGiro(rpm: number): number {
    const G = GIROS_MEDIDOS, c = this.curvaGanho
    if (rpm <= G[0]) return c[0]
    for (let i = 1; i < G.length; i++) {
      if (rpm <= G[i]) {
        const f = (rpm - G[i - 1]) / (G[i] - G[i - 1])
        return Math.exp(Math.log(c[i - 1]) * (1 - f) + Math.log(c[i]) * f)
      }
    }
    return c[c.length - 1]
  }

  /** Preenche `esc` com o som misturado e `adm` só com a admissão (n amostras). */
  render(esc: Float32Array, adm: Float32Array, n = esc.length) {
    const m = this.m, N = this.cil.length, M = this.abaf.length
    // ganho por bloco (128 amostras ≈ 3 ms): suave o bastante e barato
    const alvo = this.normalizar ? this.ganhoNoGiro(this.rpm) : 1
    for (let s = 0; s < n; s++) {
      this.ganho += (alvo - this.ganho) * 0.002
      this.rpm += (this.st.rpm - this.rpm) * 0.0015
      this.carga += (this.st.carga - this.carga) * 0.002
      const rpm = this.st.ligado ? this.rpm : 0
      this.manivela = fract(this.manivela + rpm / (120 * this.sr))
      const ruido = this.ruidoLp.passo(this.rnd() * 2 - 1) * m.ruidoAdm * (0.3 + 0.7 * this.carga)
      const escPrev = this.coletorEsc / N
      this.coletorEsc = 0
      let coletorAdm = 0, vib = 0
      const flut = this.flutLp.passo(this.rnd() * 2 - 1)
      const pos = this.manivela + m.flutuacao * flut
      for (const c of this.cil) {
        c.pop(pos, escPrev, this.st.ligado ? this.carga : 0, this.sorteio, this.st.corte)
        coletorAdm += c.saiAdm; this.coletorEsc += c.saiEsc; vib += c.som
      }
      this.cano.pop()
      const retoA = this.cano.saiA, retoB = this.cano.saiB
      let abA = 0, abB = 0
      for (const e of this.abaf) { e.pop(); abA += e.saiA; abB += e.saiB }
      for (const c of this.cil) c.push(coletorAdm / N + ruido * c.valvulaAdm(this.manivela))
      this.cano.push(this.coletorEsc, abA)
      this.coletorEsc += retoA
      for (const e of this.abaf) e.push(retoB / M, 0)
      vib = this.vibLp.passo(vib)
      const mix = (coletorAdm * m.volAdmissao + vib * m.volVibracao + abB * m.volEscape) * 0.1
      const out = mix - this.dcLp.passo(mix)
      esc[s] = out * this.ganho
      adm[s] = coletorAdm * m.volAdmissao * 0.1 * this.ganho
    }
  }
}

// Valores-base tirados de configurações de exemplo do enginesound (soam bem de
// fábrica); cada perfil do jogo ajusta cilindros, cano, abafador e ignição.
export function motorGuiasDoPerfil(p: EngineSoundProfile): MotorGuias {
  // semente fixa por perfil: dutos levemente desiguais, sempre os mesmos
  let h = 2166136261
  for (let i = 0; i < p.id.length; i++) h = Math.imul(h ^ p.id.charCodeAt(i), 16777619) >>> 0
  const rnd = () => { h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0; return (h & 0xffff) / 0xffff }
  const n = p.eventos.length
  const grande = Math.min(1, Math.max(0, (p.pulsoMs - 2) / 1.3)) // 0 = pequeno e liso, 1 = grande e gordo
  const cilindros = p.eventos.map(e => ({
    // ignição no meio do ciclo (0,5): o offset alinha o disparo ao ângulo do evento
    offset: fract(1 - e.ang / 720 + 1),
    // escape curto e quase igual entre cilindros; o caminho extra do coletor
    // (boxer, bancada do V8) vai no duto do coletor
    escape: 0.00025 + 0.0002 * rnd(),
    admissao: 0.0002 + 0.00035 * rnd(),
    coletor: 0.00055 + 0.0009 * rnd() + e.atrasoMs / 1000 * 0.6,
  }))
  // cano: ida e volta ressoam na frequência do "corpo" (boomHz)
  const cano = 1 / (2 * p.boomHz)
  const escala = 360 / p.coletorHz
  return {
    cilindros,
    escapeBeta: 0.06, admissaoBeta: -0.3 - 0.15 * (1 - p.admissao), coletorBeta: 0.0165,
    admAberta: 0.0123, admFechada: 0.8 + 0.2 * rnd(),
    escAberta: -0.0113 + 0.03 * p.aspereza, escFechada: 0.9 + 0.06 * (1 - p.aspereza),
    pistao: 2.4 + 1.5 * grande,
    ignicao: (1.5 + 3.5 * grande) * (n <= 4 ? 1 : 4 / Math.sqrt(n * 4)),
    tempoIgnicao: 0.08 + 0.09 * grande,
    volAdmissao: 0.25 + 0.3 * p.admissao,
    volEscape: 0.6,
    volVibracao: 0.04 + 0.12 * grande,
    ruidoAdm: 0.15 + 0.15 * p.aspereza + 0.1 * p.admissao,
    ruidoAdmLp: 0.0013 * (1 - 0.6 * p.aspereza),
    vibracaoLp: 0.00026 + 0.002 * grande,
    desvioAdm: 0.018, desvioEsc: 0.18,
    flutuacao: 0.02 + 0.06 * p.jitter,
    flutuacaoLp: 0.04,
    cano: { atraso: cano, alpha: 0.12, beta: -0.24 },
    abafador: { atrasos: [0.00027, 0.00025, 0.000167, 0.000146].map(d => d * escala), alpha: 0, beta: 0.0736 },
  }
}

/**
 * Mede o volume do motor com pé no fundo em GIROS_MEDIDOS e devolve a curva de
 * ganho: todo motor sai no mesmo nível em 3000 rpm, e os buracos e picos de
 * ressonância ao longo do giro são compensados só em parte (60%) — sobra um
 * pouco de "caráter" de cada escapamento. Caro: usado para gerar a tabela.
 */
export function medirCurvaGanho(sr: number, p: EngineSoundProfile): number[] {
  const t = new WaveguideSynth(sr, p, 7, false)
  const ganhos = GIROS_MEDIDOS.map(rpm => {
    t.fixar(rpm, 1)
    const n = Math.round(sr * 0.08), a = new Float32Array(n), b = new Float32Array(n)
    t.render(a, b)
    const k = Math.round(sr * 0.2), x = new Float32Array(k), y = new Float32Array(k)
    t.render(x, y)
    let s = 0
    for (const v of x) s += v * v
    const rms = Math.sqrt(s / k)
    return rms > 1e-6 ? Math.min(400, ALVO_RMS / rms) : 1
  })
  const ref = ganhos[REF]
  return ganhos.map(g => ref * Math.pow(g / ref, 0.6))
}
