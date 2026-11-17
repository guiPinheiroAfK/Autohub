// AutoDash — world/altitude.ts. Quanto você já subiu na serra (playtest 16/11:
// "a serra precisava subir mais, ter mais emoção"). Serve ao altímetro do HUD e
// ao fundo que afunda conforme você sobe (render/backdrop.ts): os morros de
// longe vão ficando para baixo, como na estrada de verdade.
import { type AutoDashEngine, PLAYER_Z } from "../engine"
import { SEG_LEN } from "../data"
import type { Montanha } from "./montanha"

export const ALTITUDE = {
  baseM: 40,     // metros no pé da serra (o altímetro é de mentira: a escala do jogo não é métrica)
  topoM: 1100,   // metros no alto (a Serra do Mar passa de mil)
  afunda: 0.14,  // fração da altura da tela que o fundo desce no alto (17/11: faltava a sensação de subir; era 0,09)
}

// altura máxima de cada viagem (calculada uma vez por montanha)
const topoDa = new WeakMap<Montanha, number>()

/** 0 no começo da viagem da serra, 1 no alto; null fora dela. */
export function subidaNaSerra(eng: AutoDashEngine): number | null {
  const m = eng.montanha
  if (!m) return null
  const N = eng.segments.length
  const idx = Math.floor((eng.position + PLAYER_Z) / SEG_LEN) % N
  const d = idx - m.a
  if (d < 0 || d >= m.total) return null
  const y0 = eng.segments[m.a].y1
  let topo = topoDa.get(m)
  if (topo === undefined) {
    topo = y0
    for (let k = 0; k < m.total; k++) topo = Math.max(topo, eng.segments[(m.a + k) % N].y1)
    topoDa.set(m, topo)
  }
  if (topo <= y0) return 0
  return Math.max(0, Math.min(1, (eng.segments[idx].y1 - y0) / (topo - y0)))
}

/** Altitude em "metros" para o altímetro (null fora da serra). */
export function altitudeM(eng: AutoDashEngine): number | null {
  const k = subidaNaSerra(eng)
  return k === null ? null : Math.round(ALTITUDE.baseM + k * (ALTITUDE.topoM - ALTITUDE.baseM))
}
