// AutoDash — world/avisos.ts. Cartão de aviso dos eventos de mapa.
//
// Antes cada evento era anunciado por um texto pequeno no meio da tela que
// durava 1,6 s e sumia antes de o perigo aparecer. Agora o evento registra um
// aviso que fica no HUD até você chegar nele: ícone, nome, a dica de como
// passar e quanto falta (em segundos, na sua velocidade). Zona longa (ponte,
// mão dupla, obra) continua no cartão enquanto você está dentro dela.
// Desenho em render/avisos.ts.
import { type AutoDashEngine, PLAYER_Z } from "../engine"
import type { Traffic } from "../traffic/types"
import { KMH2UPS } from "../data"
import { wrapDz } from "../traffic/spawner"

/** perigo = âmbar (paleta de perigo), policia = vermelho e azul, info = verde. */
export type NivelAviso = "perigo" | "policia" | "info"

export interface Aviso {
  icone: string
  titulo: string
  dica: string
  nivel: NivelAviso
  z: number           // onde o evento começa (coordenada de mundo)
  fim?: number        // fim do trecho, nas zonas longas
  ref?: Traffic       // evento que anda (comboio): a posição segue este carro
  vivo?: () => boolean // evento que acaba sozinho (comboio desfeito): false tira o cartão
  trecho0?: number    // tamanho do trecho ao entrar nele (a barra esvazia daqui)
  dist0: number       // distância no momento do aviso (a barra parte daqui)
  t: number           // s desde que apareceu (animação de entrada)
  saindo: number      // s desde que começou a sair; -1 = ainda ativo
}

export const AVISO = {
  maxNaTela: 2,    // cartões ao mesmo tempo (o mais antigo sai antes)
  entradaS: 0.3,   // desliza da esquerda
  saidaS: 0.45,    // some depois de passar
  agoraS: 1.2,     // abaixo disto de chegada o cartão pisca "AGORA" (janela de leitura, pesquisa 4.1)
  depois: 1500,    // passou do começo (sem fim de trecho): some depois desta folga (unidades)
}

export type NovoAviso = Pick<Aviso, "icone" | "titulo" | "dica" | "nivel" | "z"> & Partial<Pick<Aviso, "fim" | "ref" | "vivo">>

/** Registra um aviso de evento e toca o sinal curto do aviso. */
export function avisar(eng: AutoDashEngine, novo: NovoAviso) {
  const dist0 = Math.max(1, wrapDz(eng, novo.ref?.z ?? novo.z, eng.position + PLAYER_Z))
  eng.avisos.push({ ...novo, dist0, t: 0, saindo: -1 })
  // passou do limite: o mais antigo ainda ativo começa a sair
  const ativos = eng.avisos.filter(a => a.saindo < 0)
  if (ativos.length > AVISO.maxNaTela) ativos[0].saindo = 0
  eng.audio.aviso(novo.nivel)
}

/** Distância até o começo (>0 à frente) e até o fim do trecho, em unidades de mundo. */
export function distancias(eng: AutoDashEngine, a: Aviso, playerZ: number): { ate: number; fim: number | null } {
  const ate = wrapDz(eng, a.ref ? a.ref.z : a.z, playerZ)
  const fim = a.fim !== undefined ? wrapDz(eng, a.fim, playerZ) : null
  return { ate, fim }
}

/** Segundos até percorrer `d` na velocidade atual (piso de 40 km/h para não explodir parado). */
export function segundosAte(eng: AutoDashEngine, d: number): number {
  return d / (Math.max(40, eng.speed) * KMH2UPS)
}

/** Um quadro: anima, decide quando cada aviso acabou e tira os que já saíram. */
export function atualizarAvisos(eng: AutoDashEngine, dt: number, playerZ: number) {
  for (const a of eng.avisos) {
    a.t += dt
    if (a.saindo >= 0) { a.saindo += dt; continue }
    const { ate, fim } = distancias(eng, a, playerZ)
    if (fim !== null && ate <= 0 && a.trecho0 === undefined) a.trecho0 = Math.max(1, fim)
    const acabou = (a.vivo && !a.vivo()) || a.ref?.dead || (fim !== null ? fim < 0 : ate < -AVISO.depois)
    if (acabou) a.saindo = 0
  }
  if (eng.avisos.some(a => a.saindo > AVISO.saidaS)) eng.avisos = eng.avisos.filter(a => a.saindo <= AVISO.saidaS)
}
