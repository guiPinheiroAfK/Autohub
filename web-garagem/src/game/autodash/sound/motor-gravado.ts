// AutoDash — sound/motor-gravado.ts. Motor a partir de GRAVAÇÃO REAL (síntese
// granular síncrona ao giro, a técnica dos simuladores comerciais).
//
// Uma gravação de motor subindo e descendo de giro é cortada, explosão por
// explosão, em grãos (tools/som/: cada grão vai de uma explosão à outra, com a
// frequência de explosão medida e a classe: carga, alívio ou estável). Para
// tocar num giro qualquer:
//   1. a cada período de explosão do giro ALVO nasce um grão novo;
//   2. o grão escolhido é o da gravação com giro mais próximo (de preferência o
//      seguinte ao anterior, para manter a variação real entre cilindros);
//   3. os grãos se sobrepõem pela metade com janela de Hann (soma constante).
//      Cada metade da janela tem o comprimento do espaço até o grão vizinho:
//      se o giro muda entre um grão e outro, a descida de um e a subida do
//      seguinte continuam do mesmo tamanho e a soma segue 1 (sem tremor).
// Como o espaçamento dos grãos segue o giro alvo e o conteúdo de cada grão não é
// esticado (TD-PSOLA), as ressonâncias do escape e do cofre ficam no lugar —
// som de motor de verdade, não uma fita acelerada. Só fora da faixa gravada o
// grão é reamostrado (pouco) para alcançar o giro.
//
// DSP puro (sem WebAudio): roda no AudioWorklet e nos testes.

import type { EngineSynthState } from "./engine-synth"

/** Banco de grãos já decodificado na taxa de saída. */
export interface BancoGraos {
  nome: string
  sr: number                 // taxa dos dados (a mesma da saída)
  dados: Float32Array
  /** 6 números por grão: centro (s), período à esquerda (s), à direita (s), Hz de explosão, classe, ganho */
  graos: Float32Array
  /** cilindros do motor gravado (explosões por 2 voltas) */
  cilindros: number
}

/** Classe do grão: 0 = alívio (giro caindo, pé fora), 1 = carga (subindo), 2 = estável (meia carga). */
export const ALIVIO = 0, CARGA = 1, ESTAVEL = 2
const CAMPOS = 6

// esq/dir: meia janela antes e depois do centro (amostras de saída)
interface Grao { centro: number; esq: number; dir: number; rho: number; ganho: number; fonte: number }

// o alívio da gravação é giro caindo em ponto morto, ainda alto no cofre; no
// carro andando, tirar o pé derruba bem mais o volume
const NIVEL_CLASSE = [0.55, 1, 0.8]

// fração de giro que o PSOLA cobre sem reamostrar (≈ ±6%)
const FOLGA = 0.06

export class MotorGravado {
  st: EngineSynthState = { rpm: 900, carga: 0, ligado: true, corte: false }
  private sr: number
  private b: BancoGraos | null = null
  private n = 0                   // amostra de saída atual
  private proxCentro = 0
  private passo = 0               // distância do último centro ao próximo (0 = ainda sem grão)
  private ativos: Grao[] = []
  private ultimo = -1             // índice do último grão usado
  private classeAtual = CARGA
  private porClasse: Int32Array[] = []
  private hzClasse: Float32Array[] = []
  private todos: Int32Array = new Int32Array(0)
  private hzTodos: Float32Array = new Float32Array(0)
  private rpm = 900
  private carga = 0
  private seed: number
  private amp = 0
  private prob = [0, 1, 0]        // probabilidade atual de cada classe
  /** cilindros do motor que está tocando (define a frequência de explosão alvo) */
  cilindros = 4

  constructor(sr: number, seed = 7) {
    this.sr = sr
    this.seed = seed >>> 0 || 7
  }

  get pronto(): boolean { return this.b !== null }
  get banco(): string { return this.b?.nome ?? "" }

  private rnd(): number {
    let t = (this.seed = (this.seed + 0x6d2b79f5) >>> 0)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  setBanco(b: BancoGraos) {
    this.b = b
    const g = b.graos, N = g.length / CAMPOS
    const ordenar = (idx: number[]) => {
      idx.sort((a, c) => g[a * CAMPOS + 3] - g[c * CAMPOS + 3])
      return [Int32Array.from(idx), Float32Array.from(idx.map(i => g[i * CAMPOS + 3]))] as const
    }
    this.porClasse = []; this.hzClasse = []
    for (const k of [ALIVIO, CARGA, ESTAVEL]) {
      const idx: number[] = []
      for (let i = 0; i < N; i++) if (g[i * CAMPOS + 4] === k) idx.push(i)
      const [a, h] = ordenar(idx)
      this.porClasse[k] = a; this.hzClasse[k] = h
    }
    const [a, h] = ordenar(Array.from({ length: N }, (_, i) => i))
    this.todos = a; this.hzTodos = h
    this.ativos = []; this.ultimo = -1; this.passo = 0
  }

  /** Pula a suavização (testes e medição). */
  fixar(rpm: number, carga: number) {
    this.st.rpm = rpm; this.st.carga = carga
    this.rpm = rpm; this.carga = carga
  }

  /** Probabilidade de cada classe pela carga: pé no fundo = carga, fora = alívio, meio = estável. */
  private sortearClasse(): number {
    const L = this.carga
    const s = (a: number, b: number, x: number) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u) }
    const p1 = s(0.35, 0.85, L), p0 = 1 - s(0.05, 0.4, L), p2 = Math.max(0, 1 - p1 - p0)
    const soma = p0 + p1 + p2
    this.prob[ALIVIO] = p0 / soma; this.prob[CARGA] = p1 / soma; this.prob[ESTAVEL] = p2 / soma
    const pAtual = this.prob[this.classeAtual]
    // fica na classe atual enquanto ela ainda faz sentido (continuidade do som)
    if (pAtual > 0.3) return this.classeAtual
    let r = this.rnd() * soma
    if ((r -= p1) < 0) return CARGA
    if ((r -= p0) < 0) return ALIVIO
    return ESTAVEL
  }

  /** Índice (no banco) de um grão próximo de `hz` dentro da lista ordenada. */
  private perto(lista: Int32Array, hz: Float32Array, alvo: number): number {
    if (lista.length === 0) return -1
    let lo = 0, hi = lista.length - 1
    while (lo < hi) { const m = (lo + hi) >> 1; if (hz[m] < alvo) lo = m + 1; else hi = m }
    // sorteio uniforme entre TODOS os grãos a ±2% do giro: escolher sempre o
    // mais próximo faz o motor voltar ao mesmo trecho da gravação a cada salto,
    // e o laço curto vira um pente (zumbido periódico)
    const TOL = 0.02
    let a = lo, b = lo
    while (a > 0 && Math.log(alvo / hz[a - 1]) < TOL) a--
    while (b < lista.length - 1 && Math.log(hz[b + 1] / alvo) < TOL) b++
    if (b - a >= 3) return lista[a + Math.floor(this.rnd() * (b - a + 1))]
    // poucos grãos nessa faixa: o mais próximo entre os vizinhos, com sorteio
    const K = 4
    a = Math.max(0, lo - K); b = Math.min(lista.length - 1, lo + K)
    let melhor = lo, nota = Infinity
    for (let i = a; i <= b; i++) {
      const d = Math.abs(Math.log(hz[i] / alvo)) + this.rnd() * 0.02
      if (d < nota) { nota = d; melhor = i }
    }
    return lista[melhor]
  }

  private escolher(hz: number): number {
    const g = this.b!.graos
    let classe = this.sortearClasse()
    // no limitador, metade das explosões falha: grão de alívio no lugar (a
    // falha vale mesmo quando daria para seguir a gravação)
    const falha = this.st.corte && this.rnd() < 0.5
    if (falha) classe = ALIVIO
    const j = this.ultimo + 1
    if (!falha && this.ultimo >= 0 && j < g.length / CAMPOS) {
      const o = this.ultimo * CAMPOS, p = j * CAMPOS
      const seguido = Math.abs(g[p] - g[o] - g[o + 2]) < 0.15 * g[o + 2]
      // segue a gravação enquanto o giro bate e a classe do próximo ainda serve
      const serve = g[p + 4] === classe || this.prob[g[p + 4]] >= 0.2
      if (seguido && serve && Math.abs(Math.log(g[p + 3] / hz)) < 0.035) return j
    }
    this.classeAtual = classe
    let i = this.perto(this.porClasse[classe], this.hzClasse[classe], hz)
    // a classe não tem grão nesse giro (ex.: lenta só existe "estável"): usa
    // qualquer classe, senão o mesmo punhado de grãos se repete e vira um pente
    const di = i < 0 ? Infinity : Math.abs(Math.log(g[i * CAMPOS + 3] / hz))
    if (di > 0.03) {
      const t = this.perto(this.todos, this.hzTodos, hz)
      if (Math.abs(Math.log(g[t * CAMPOS + 3] / hz)) < di - 0.01) i = t
    }
    return i
  }

  private novoGrao(esq: number, dir: number, hz: number) {
    const b = this.b!, g = b.graos
    const i = this.escolher(hz)
    if (i < 0) return
    this.ultimo = i
    const o = i * CAMPOS
    const lr = Math.log(hz / g[o + 3])
    const rho = Math.exp(lr - Math.max(-FOLGA, Math.min(FOLGA, lr)))
    // grão de alívio no limitador entra mais baixo (falha de ignição)
    const falha = this.st.corte && g[o + 4] === ALIVIO ? 0.55 : 1
    this.ativos.push({ centro: this.proxCentro, esq, dir, rho, ganho: g[o + 5] * falha * NIVEL_CLASSE[g[o + 4]], fonte: g[o] * b.sr })
  }

  render(out: Float32Array, len: number) {
    const b = this.b
    if (!b) { out.fill(0, 0, len); return }
    const dados = b.dados, nd = dados.length
    const kr = 1 - Math.exp(-1 / (0.012 * this.sr)), kc = 1 - Math.exp(-1 / (0.04 * this.sr))
    const ka = 1 - Math.exp(-1 / (0.03 * this.sr))
    for (let s = 0; s < len; s++) {
      this.rpm += (this.st.rpm - this.rpm) * kr
      this.carga += (this.st.carga - this.carga) * kc
      this.amp += ((this.st.ligado ? 1 : 0) - this.amp) * ka
      const hz = Math.max(8, this.rpm / 60 * this.cilindros / 2)
      const T = this.sr / hz
      // primeiro grão: entra suave, um período à frente
      if (this.passo <= 0) { this.passo = T; this.proxCentro = this.n + T }
      // o grão seguinte nasce quando o atual chega ao centro: sobe enquanto o
      // atual desce, no mesmo trecho (`passo`); o período de agora define o
      // espaço até o próximo
      while (this.n >= this.proxCentro - this.passo) {
        this.novoGrao(this.passo, T, hz)
        this.passo = T
        this.proxCentro += T
        if (this.ativos.length > 6) this.ativos.shift()
      }
      let y = 0
      for (let k = 0; k < this.ativos.length; k++) {
        const a = this.ativos[k]
        const u = this.n - a.centro
        if (u >= a.dir) continue
        const w = 0.5 * (1 + Math.cos(Math.PI * u / (u < 0 ? a.esq : a.dir)))
        const x = a.fonte + u * a.rho
        const xi = Math.floor(x)
        if (xi < 0 || xi + 1 >= nd) continue
        const fr = x - xi
        y += (dados[xi] + (dados[xi + 1] - dados[xi]) * fr) * w * a.ganho
      }
      out[s] = y * this.amp
      this.n++
      // descarta os grãos que já terminaram (terminam na ordem em que nasceram:
      // o fim de cada um é o centro do seguinte)
      if (this.ativos.length && this.n - this.ativos[0].centro >= this.ativos[0].dir) this.ativos.shift()
    }
  }
}

/** Converte o JSON do banco (tools/som) para o formato compacto do worklet. */
export function graosDoJson(graos: number[][]): Float32Array {
  const f = new Float32Array(graos.length * CAMPOS)
  graos.forEach((g, i) => f.set(g.slice(0, CAMPOS), i * CAMPOS))
  return f
}
