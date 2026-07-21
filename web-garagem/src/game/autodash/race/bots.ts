// AutoDash — bots do modo corrida.
//
// Existem por dois motivos: dá pra testar a corrida sozinho, e dá pra encher a
// sala quando faltam pilotos. Um bot NÃO roda a física completa do carro — ele
// segue um ritmo alvo com variação, o que é barato e já convence, porque o que
// o jogador vê do rival é posição, velocidade e faixa.

import { KMH2UPS } from "../data"
import type { Rival } from "./types"

const NOMES = ["KAMI", "L4BT", "TURBO", "DIESEL", "NITRO", "GHOST", "V8", "ZERO"]

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

  constructor(id: string, nome: string, car: number, paint: number, dificuldade: number) {
    // dificuldade 0..1 → ritmo entre ~185 e ~245 km/h
    const ritmo = 185 + dificuldade * 60 + (Math.random() - 0.5) * 14
    this.perfil = {
      ritmo,
      agressao: 0.3 + Math.random() * 0.5,
      erro: 0.5 - dificuldade * 0.4,
    }
    this.alvoX = [-0.75, -0.25, 0.25, 0.75][Math.floor(Math.random() * 4)]
    this.rival = {
      id, nome, car, paint, bot: true,
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
      out.push(new BotRacer(`bot_${i}_${Math.random().toString(36).slice(2, 7)}`, nome, i % 4, i % 6, d))
    }
    return out
  }

  /** Avança o bot um frame. `trackLen` fecha a volta; `voltas` encerra a corrida. */
  update(dt: number, trackLen: number, voltas: number) {
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
      // converge pro ritmo com aceleração plausível
      const alvo = this.perfil.ritmo + Math.sin(performance.now() / 2600 + r.d * 1e-5) * 9
      r.v += Math.max(-140 * dt, Math.min(52 * dt, alvo - r.v))
    }

    // troca de faixa de vez em quando
    this.trocaT -= dt
    if (this.trocaT <= 0) {
      this.trocaT = 2.5 + Math.random() * 5 * (1 - this.perfil.agressao)
      this.alvoX = [-0.75, -0.25, 0.25, 0.75][Math.floor(Math.random() * 4)]
    }
    const passo = 0.9 * dt
    r.x += Math.max(-passo, Math.min(passo, this.alvoX - r.x))

    // avança e fecha volta
    const avanco = r.v * KMH2UPS * dt
    r.d += avanco
    r.z += avanco
    if (r.z >= trackLen) { r.z -= trackLen; r.lap++ }
    if (r.lap >= voltas) { r.finished = true; r.v = 0 }
  }
}
