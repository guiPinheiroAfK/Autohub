// AutoDash — world/bordas.ts. Colisão com o guard-rail e com o paredão de pedra.
//
// 17/11 ("cadê a colisão? guard-rails não fazem nada", "tem como entrar dentro da
// montanha?"): o guard-rail e o paredão eram só desenho e o carro atravessava os
// dois. Agora a borda segura o carro: ele raspa (perde velocidade, solta faísca e
// treme) e volta para dentro da pista. Vale para tudo que tem guard-rail desenhado
// (mata, serra, viaduto da serra) e para as paredes do túnel.
import { type AutoDashEngine, H } from "../engine"
import { emitSmoke } from "../fx/particles"
import { perderDrift } from "./drift"
import { tipoNoSeg, GUARD_RAIL, COM_GUARD_RAIL, COM_PAREDAO } from "./cenario"
import { ladoParedao, noViadutoDaSerra } from "./montanha"
import { PAREDAO } from "../render/cenario"

export const BORDA = {
  folga: 0.13,       // o carro (meia-largura) encosta antes da linha desenhada; nunca passa de 1,04 (a partir de 1,05 é fora da pista)
  raspaKmhS: 95,     // km/h por s perdidos raspando
  batida: 0.86,      // fração da velocidade que sobra na primeira batida
  quica: 0.9,        // empurrão para dentro (velocidade lateral) ao bater
  tunel: 1.0,        // |x| máximo dentro do túnel (as paredes)
}

/** Limites laterais [esq, dir] (|x| máximo de cada lado) neste segmento, ou null se não há borda. */
export function limitesLaterais(eng: AutoDashEngine, idx: number): { esq: number; dir: number } | null {
  if (eng.mode === "race") return null
  if (eng.dentroTunel) return { esq: BORDA.tunel, dir: BORDA.tunel }
  const viad = noViadutoDaSerra(eng, idx)
  const tipo = tipoNoSeg(eng.cenario, idx)
  if (!viad && !COM_GUARD_RAIL.has(tipo)) return null
  const rail = Math.min(1.04, GUARD_RAIL.dist - BORDA.folga)
  const paredao = COM_PAREDAO.has(tipo) && !viad ? ladoParedao(eng) : 0
  const parede = Math.min(1.04, PAREDAO.dist - BORDA.folga)
  return { esq: paredao < 0 ? parede : rail, dir: paredao > 0 ? parede : rail }
}

/** Um quadro: se o carro passou da borda, volta para dentro raspando. Devolve true se encostou. */
export function colidirComBordas(eng: AutoDashEngine, dt: number, idx: number, emRamal: boolean): boolean {
  if (emRamal) return false
  const lim = limitesLaterais(eng, idx)
  if (!lim) { eng.naBorda = false; return false }
  const x = eng.playerX
  const lado = x > lim.dir ? 1 : x < -lim.esq ? -1 : 0
  if (lado === 0) { eng.naBorda = false; return false }
  eng.playerX = lado > 0 ? lim.dir : -lim.esq
  eng.steerVel = -lado * BORDA.quica
  eng.speed = Math.max(0, eng.speed - BORDA.raspaKmhS * dt)
  eng.shakeT = Math.max(eng.shakeT, 0.14)
  if (Math.random() < 0.6) emitSmoke(eng, 2, "#fde047") // faíscas
  if (!eng.naBorda) { // primeira batida: tranco, combo e drift perdidos
    eng.naBorda = true
    eng.speed *= BORDA.batida
    eng.combo = 0
    perderDrift(eng)
    eng.audio.crash()
    eng.floaters.push({ text: eng.dentroTunel ? "PAREDE DO TÚNEL!" : "RAÇOU NA BORDA!", color: "#fb923c", y: H * 0.42, life: 0.9, big: false })
  }
  return true
}
