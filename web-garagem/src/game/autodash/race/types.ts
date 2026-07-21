// AutoDash — domínio do MODO CORRIDA (até 4 pilotos, por voltas).
//
// A ideia central: o engine não sabe (nem precisa saber) se um rival é um
// jogador remoto ou um bot. Os dois viram `Rival`, com a mesma forma. Quem
// preenche é o RaceNet (rede, com dead reckoning) ou o BotRacer (simulação
// local). Isso é o que permite testar a corrida inteira sozinho.

/** Fase da sala, do lobby ao pódio. */
export type RacePhase = "lobby" | "countdown" | "racing" | "finished"

/** Um adversário na pista — jogador remoto OU bot, indistinguível pro engine. */
export interface Rival {
  id: string
  nome: string
  car: number      // índice em CARS
  paint: number    // índice em PAINTS
  bot: boolean

  // estado corrente já interpolado/extrapolado, pronto pra desenhar
  z: number        // posição dentro da volta (unidades de mundo)
  lap: number      // volta atual (0 = primeira)
  d: number        // distância TOTAL acumulada — é o que ordena o grid
  v: number        // km/h
  x: number        // faixa (-1..1)
  crashed: boolean
  finished: boolean
  /** Instante da chegada (performance.now()). Quem termina fica com a MESMA
   *  distância dos outros, então sem isso o pódio sairia em ordem arbitrária. */
  finishT?: number

  /** Alvo mais recente vindo da rede; o cliente converge suave até ele. */
  netD?: number
  netZ?: number
  netX?: number
  /** Quando não chega telemetria há muito tempo, some da pista. */
  staleFor: number
}

export interface RaceConfig {
  code: string
  seed: number
  voltas: number
  souDono: boolean
  meuId: string
}

/** Telemetria que sai daqui pra rede a cada tick. */
export interface RaceTelemetry {
  d: number
  lap: number
  z: number
  v: number
  x: number
  c: boolean
  fin: boolean
}

/** Linha do placar, já ordenada. */
export interface GridRow {
  id: string
  nome: string
  lap: number
  d: number
  eu: boolean
  bot: boolean
  crashed: boolean
  finished: boolean
  finishT?: number
}

/**
 * Ordena o grid: quem já terminou vem primeiro, e entre eles vale a ORDEM DE
 * CHEGADA — não a distância, porque todos que completam a prova terminam com
 * exatamente a mesma distância e o pódio sairia arbitrário. Quem ainda corre
 * é ordenado por distância percorrida.
 */
export function ordenarGrid(rows: GridRow[]): GridRow[] {
  return [...rows].sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1
    if (a.finished && b.finished) return (a.finishT ?? 0) - (b.finishT ?? 0)
    return b.d - a.d
  })
}
