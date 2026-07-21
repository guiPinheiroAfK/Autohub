// AutoDash — sessão do MODO CORRIDA.
//
// Orquestra tudo que é "corrida" num lugar só: config da sala, rivais (de rede
// OU bots), contagem de voltas do jogador e placar. O engine só chama
// `update()` e lê `rivais`/`grid()` — assim o modo corrida não derrama mais
// centenas de linhas dentro de engine.ts, que já é grande demais.

import { KMH2UPS } from "../data"
import { BotRacer, type PistaInfo } from "./bots"
import { RaceNet, criarSala, entrarSala, darLargada, meuPlayerId, verLobby } from "./net"
import { ordenarGrid, type GridRow, type RaceConfig, type RacePhase, type Rival, type RaceTelemetry } from "./types"

export class RaceSession {
  phase: RacePhase = "lobby"
  cfg: RaceConfig
  erro: string | null = null
  /** ms até o verde; null enquanto o dono não largou. */
  startInMs: number | null = null

  private net: RaceNet | null = null
  private bots: BotRacer[] = []
  /** Só-bots: corrida local, sem rede (é o modo de teste sozinho). */
  readonly offline: boolean

  // estado do jogador nesta corrida
  lap = 0
  dist = 0
  finished = false
  finishT: number | undefined
  private zAnterior = 0
  private meuNome: string

  constructor(cfg: RaceConfig, meuNome: string, offline: boolean) {
    this.cfg = cfg
    this.meuNome = meuNome
    this.offline = offline
    if (!offline) this.net = new RaceNet(cfg.code, cfg.meuId)
  }

  // ── criação ────────────────────────────────────────────────────────────────

  /** Corrida local contra bots — não toca na rede. */
  static soloComBots(nome: string, voltas: number, qtdBots: number, dificuldade = 0.6): RaceSession {
    const seed = Math.floor(Math.random() * 2 ** 31)
    const s = new RaceSession(
      { code: "BOTS", seed, voltas, souDono: true, meuId: meuPlayerId() }, nome, true,
    )
    s.bots = BotRacer.gerar(qtdBots, dificuldade, [nome.toUpperCase()])
    s.startInMs = 3000
    s.phase = "countdown"
    return s
  }

  static async hospedar(nome: string, voltas: number, car: number, paint: number): Promise<RaceSession> {
    const id = meuPlayerId()
    const r = await criarSala(nome, id, voltas, car, paint)
    return new RaceSession({ code: r.code, seed: r.seed, voltas: r.voltas, souDono: true, meuId: id }, nome, false)
  }

  static async entrar(code: string, nome: string, car: number, paint: number): Promise<RaceSession> {
    const id = meuPlayerId()
    const r = await entrarSala(code, nome, id, car, paint)
    return new RaceSession({ code: code.toUpperCase(), seed: r.seed, voltas: r.voltas, souDono: r.owner, meuId: id }, nome, false)
  }

  /** Só o dono; em sala offline larga na hora. */
  async largar() {
    if (!this.cfg.souDono) return
    if (this.offline) { this.startInMs = 3000; this.phase = "countdown"; return }
    try {
      const r = await darLargada(this.cfg.code, this.cfg.meuId)
      this.startInMs = r.startInMs
      this.phase = "countdown"
    } catch (e) { this.erro = (e as Error)?.message ?? "não consegui dar a largada" }
  }

  /** Completa a sala com bots (só faz sentido pro dono, antes de largar). */
  preencherComBots(ate: number, dificuldade = 0.6) {
    const faltam = ate - (1 + this.rivais.length)
    if (faltam > 0) this.bots.push(...BotRacer.gerar(faltam, dificuldade, [this.meuNome.toUpperCase()]))
  }

  // ── lobby ──────────────────────────────────────────────────────────────────

  private lobbyT = 0
  /** Enquanto no lobby, busca a lista de pilotos periodicamente. */
  private async puxarLobby() {
    try {
      const l = await verLobby(this.cfg.code)
      this.lobbyNomes = l.pilotos.map(p => p.nome)
      if (l.startInMs !== null) { this.startInMs = l.startInMs; this.phase = "countdown" }
      this.erro = null
    } catch (e) { this.erro = (e as Error)?.message ?? "sem conexão" }
  }
  lobbyNomes: string[] = []

  // ── loop ───────────────────────────────────────────────────────────────────

  /** Lista unificada: rivais de rede + bots, sem o engine saber a diferença. */
  get rivais(): Rival[] {
    const netos = this.net ? [...this.net.rivais.values()] : []
    return [...netos, ...this.bots.map(b => b.rival)]
  }

  /**
   * Um tick da sessão.
   * `meuZ` é a posição do jogador na volta e `meuV` a velocidade em km/h.
   */
  update(dt: number, meuZ: number, meuV: number, meuX: number, bateu: boolean, trackLen: number, pista?: PistaInfo) {
    if (this.phase === "lobby") {
      this.lobbyT -= dt
      if (this.lobbyT <= 0 && !this.offline) { this.lobbyT = 1.2; void this.puxarLobby() }
      return
    }

    if (this.phase === "countdown") {
      if (this.startInMs !== null) {
        this.startInMs -= dt * 1000
        if (this.startInMs <= 0) { this.startInMs = 0; this.phase = "racing"; this.zAnterior = meuZ }
      }
    }

    // volta fecha quando o z do jogador dá a volta no traçado
    if (this.phase === "racing" && !this.finished) {
      let avanco = meuZ - this.zAnterior
      if (avanco < -trackLen / 2) { avanco += trackLen; this.lap++ } // cruzou a linha
      else if (avanco < 0) avanco = 0
      this.dist += avanco
      this.zAnterior = meuZ
      if (this.lap >= this.cfg.voltas) { this.finished = true; this.finishT = performance.now(); this.phase = "finished" }
    }

    // Bots só andam DEPOIS do verde. Antes eles eram atualizados no countdown
    // também: ganhavam ~3 s de vantagem (~59.000 unidades a 150 km/h), o que é
    // mais que a distância de render — o jogador via pista vazia, se achava em
    // primeiro, e o placar mostrava 4º. Não era bug do placar, era largada
    // queimada.
    if (this.phase === "racing" || this.phase === "finished") {
      for (const b of this.bots) b.update(dt, trackLen, this.cfg.voltas, pista)
    }

    if (this.net) {
      this.net.update(dt, trackLen, (): RaceTelemetry => ({
        d: this.dist, lap: this.lap, z: meuZ, v: meuV, x: meuX,
        c: bateu, fin: this.finished,
      }))
      if (this.net.startInMs !== null && this.phase === "countdown") this.startInMs = this.net.startInMs
    }

    // todo mundo terminou? encerra
    if (this.phase === "racing" && this.rivais.length > 0 &&
        this.finished && this.rivais.every(r => r.finished)) this.phase = "finished"
  }

  /** Placar ao vivo, já ordenado. */
  grid(): GridRow[] {
    const rows: GridRow[] = [{
      id: this.cfg.meuId, nome: this.meuNome || "VOCÊ", lap: this.lap, d: this.dist,
      eu: true, bot: false, crashed: false, finished: this.finished, finishT: this.finishT,
    }]
    for (const r of this.rivais) {
      rows.push({
        id: r.id, nome: r.nome, lap: r.lap, d: r.d, eu: false, bot: r.bot,
        crashed: r.crashed, finished: r.finished, finishT: r.finishT, cor: r.cor,
      })
    }
    return ordenarGrid(rows)
  }

  /** Sua colocação (1 = liderando). */
  minhaPosicao(): number {
    return this.grid().findIndex(r => r.eu) + 1
  }

  /**
   * Empurrão entre carros: cada cliente manda no PRÓPRIO carro. Se um rival
   * está em cima de você, VOCÊ se afasta — o cliente dele faz o mesmo. Sem
   * arbitragem, e tolerante à defasagem do polling justamente por não ser
   * batida letal. Devolve o empurrão lateral a aplicar (0 = ninguém encostou).
   */
  empurrao(meuZ: number, meuX: number, larguraSoma: number, trackLen: number): number {
    for (const r of this.rivais) {
      if (r.finished) continue
      let dz = r.z - meuZ
      if (dz > trackLen / 2) dz -= trackLen
      if (dz < -trackLen / 2) dz += trackLen
      if (Math.abs(dz) > 170) continue
      const dx = meuX - r.x
      if (Math.abs(dx) > larguraSoma) continue
      return (dx === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dx)) * 0.14
    }
    return 0
  }
}

/** Converte km/h em unidades por segundo (o resto do jogo usa isso o tempo todo). */
export const kmhToUps = (v: number) => v * KMH2UPS
