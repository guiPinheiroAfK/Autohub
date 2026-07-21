// AutoDash — bots do modo corrida.
//
// Existem por dois motivos: dá pra testar a corrida sozinho, e dá pra encher a
// sala quando faltam pilotos. Um bot NÃO roda a física completa do carro — ele
// segue um ritmo alvo com variação, o que é barato e já convence, porque o que
// o jogador vê do rival é posição, velocidade e faixa.

import { KMH2UPS } from "../data"
import { corPorIndice, type Rival } from "./types"

const NOMES = ["KAMI", "L4BT", "TURBO", "DIESEL", "NITRO", "GHOST", "V8", "ZERO"]

/**
 * O que o bot enxerga da pista. Sem isso ele atravessa o trânsito e nunca é
 * segurado por nada — enquanto o jogador toma freada atrás de caminhão. Era
 * essa assimetria que fazia os bots sumirem na frente.
 */
export interface PistaInfo {
  /** Veículo mais próximo à frente na faixa `x`, dentro de `alcance`. */
  aFrente(z: number, x: number, alcance: number): { dz: number; v: number } | null
  /** A faixa está livre num raio de `alcance` em Z? */
  faixaLivre(z: number, x: number, alcance: number): boolean
}

/** Perfil de pilotagem — dá personalidade e evita que todos andem colados. */
interface Perfil {
  ritmo: number       // km/h de cruzeiro almejado
  agressao: number    // 0..1 — quanto troca de faixa
  erro: number        // 0..1 — chance de perder tempo (simula batida/erro)
}

export class BotRacer {
  readonly rival: Rival
  private perfil: Perfil
  private trocaT = 0
  private alvoX: number
  private penalidadeT = 0

  constructor(id: string, nome: string, car: number, paint: number, dificuldade: number, cor: string) {
    // dificuldade 0..1 → ritmo entre ~150 e ~205 km/h. É o TETO dele em pista
    // limpa; o trânsito segura o resto, igual segura você. Antes era 185-245 e
    // sem freio nenhum, então eles sumiam no horizonte já na primeira reta.
    const ritmo = 150 + dificuldade * 55 + (Math.random() - 0.5) * 12
    this.perfil = {
      ritmo,
      agressao: 0.3 + Math.random() * 0.5,
      erro: 0.5 - dificuldade * 0.4,
    }
    this.alvoX = [-0.75, -0.25, 0.25, 0.75][Math.floor(Math.random() * 4)]
    this.rival = {
      id, nome, car, paint, bot: true, cor,
      z: 0, lap: 0, d: 0, v: 0, x: this.alvoX,
      crashed: false, finished: false, staleFor: 0,
    }
  }

  static gerar(qtd: number, dificuldade: number, evitarNomes: string[] = []): BotRacer[] {
    const pool = NOMES.filter(n => !evitarNomes.includes(n))
    const out: BotRacer[] = []
    for (let i = 0; i < qtd; i++) {
      const nome = pool.splice(Math.floor(Math.random() * pool.length), 1)[0] ?? `BOT_${i + 1}`
      // espalha a dificuldade em volta do alvo pra ter grid variado
      const d = Math.min(1, Math.max(0, dificuldade + (Math.random() - 0.5) * 0.35))
      out.push(new BotRacer(`bot_${i}_${Math.random().toString(36).slice(2, 7)}`, nome, i % 4, i % 6, d, corPorIndice(i)))
    }
    return out
  }

  /** Avança o bot um frame. `trackLen` fecha a volta; `voltas` encerra a corrida. */
  update(dt: number, trackLen: number, voltas: number, pista?: PistaInfo) {
    const r = this.rival
    if (r.finished) { r.v = 0; return }

    // erro de pilotagem: para um pouco, como se tivesse batido
    if (this.penalidadeT > 0) {
      this.penalidadeT -= dt
      r.crashed = true
      r.v = Math.max(0, r.v - 260 * dt)
    } else {
      r.crashed = false
      if (Math.random() < this.perfil.erro * 0.0016) this.penalidadeT = 1.4 + Math.random() * 1.6
      // ritmo alvo — mas o TRÂNSITO manda: preso atrás de alguém, ele freia e
      // só passa se abrir faixa. É o que o jogador enfrenta.
      let alvo = this.perfil.ritmo + Math.sin(performance.now() / 2600 + r.d * 1e-5) * 9
      const frente = pista?.aFrente(r.z, r.x, 2600)
      if (frente && frente.v < alvo) {
        // quanto mais perto, mais colado no ritmo do da frente
        const aperto = 1 - Math.min(1, frente.dz / 2600)
        alvo = Math.min(alvo, frente.v + (alvo - frente.v) * (1 - aperto))
        if (frente.dz < 700) alvo = Math.min(alvo, Math.max(0, frente.v - 12))
        // tenta ultrapassar: só muda se a faixa estiver realmente livre
        if (this.trocaT <= 0.4 && pista) {
          for (const lado of Math.random() < 0.5 ? [-0.5, 0.5] : [0.5, -0.5]) {
            const faixa = r.x + lado
            if (faixa < -0.9 || faixa > 0.9) continue
            if (pista.faixaLivre(r.z, faixa, 1600)) { this.alvoX = faixa; this.trocaT = 1.6; break }
          }
        }
      }
      r.v += Math.max(-150 * dt, Math.min(48 * dt, alvo - r.v))
    }

    // troca de faixa de vez em quando (só pra faixa livre)
    this.trocaT -= dt
    if (this.trocaT <= 0) {
      this.trocaT = 2.5 + Math.random() * 5 * (1 - this.perfil.agressao)
      const cand = [-0.75, -0.25, 0.25, 0.75][Math.floor(Math.random() * 4)]
      if (!pista || pista.faixaLivre(r.z, cand, 1400)) this.alvoX = cand
    }
    const passo = 0.9 * dt
    r.x += Math.max(-passo, Math.min(passo, this.alvoX - r.x))

    // avança e fecha volta
    const avanco = r.v * KMH2UPS * dt
    r.d += avanco
    r.z += avanco
    if (r.z >= trackLen) { r.z -= trackLen; r.lap++ }
    if (r.lap >= voltas && !r.finished) { r.finished = true; r.finishT = performance.now(); r.v = 0 }
  }
}
