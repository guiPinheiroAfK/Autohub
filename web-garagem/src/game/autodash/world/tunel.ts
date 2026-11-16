// AutoDash — world/tunel.ts. Túnel raro (Fase 8.7), como a ponte: uma zona longa
// que aparece de vez em quando no sorteio dos eventos. Por dentro: escuro, luzes
// em fila no teto, faróis acesos, eco do motor, sem chuva, e o helicóptero da
// polícia perde você. Na saída, o clarão. Desenho em render/tunel.ts.
import { type AutoDashEngine } from "../engine"
import { DRAW_DIST, SEG_LEN } from "../data"
import { wrapDz } from "../traffic/spawner"
import { avisar } from "./avisos"

export const TUNEL = {
  comprimento: 56000, // u (280 segmentos, menos que a distância de desenho: a saída aparece lá no fundo)
  chance: 0.3,        // chance de o túnel entrar no sorteio de cada evento (raro)
  altura: 3000,       // u do asfalto ao teto
  parede: 1.18,       // meias-pistas: as paredes logo depois da zebra
  curva: 0.45,        // a curva do traçado dentro dele é suavizada a isto
  claraoS: 0.7,       // s do clarão na saída
}

/** Abre um túnel além do horizonte: zona, relevo plano, placas e cartão. */
export function spawnTunel(eng: AutoDashEngine) {
  const VIEW = DRAW_DIST * SEG_LEN
  abrirTunel(eng, ((eng.position + VIEW * 1.7) % eng.trackLen + eng.trackLen) % eng.trackLen)
}

/**
 * Abre o túnel com a boca em `z` (precisa estar além do horizonte: as placas
 * ficam até 0,95 × a distância de desenho antes). Usado pelo túnel raro do
 * sorteio e pelo túnel que atravessa a montanha na subida da serra.
 */
export function abrirTunel(eng: AutoDashEngine, z0: number) {
  const VIEW = DRAW_DIST * SEG_LEN
  const at = (d: number) => ((z0 + d) % eng.trackLen + eng.trackLen) % eng.trackLen
  const START = 0
  const z = at(START), end = at(START + TUNEL.comprimento)
  eng.zones.push({ type: "tunnel", z, end, spawnT: 0 })
  // dentro da montanha a pista é plana (rampa linear da entrada à saída) e as
  // curvas ficam mais suaves: o teto e as paredes acompanham o traçado
  const N = eng.segments.length
  const a = Math.floor(z / SEG_LEN), n = Math.floor(TUNEL.comprimento / SEG_LEN)
  const y0 = eng.segments[a % N].y1, y1 = eng.segments[(a + n) % N].y1
  for (let i = 0; i < n; i++) {
    const s = eng.segments[(a + i) % N]
    s.y1 = y0 + (y1 - y0) * (i / n)
    s.y2 = y0 + (y1 - y0) * ((i + 1) / n)
    s.curve *= TUNEL.curva
    s.sign = undefined
  }
  eng.roadSigns.push(
    { z: at(START - VIEW * 0.95), type: "tunel", label: "TÚNEL 2 km" },
    { z: at(START - VIEW * 0.6), type: "tunel", label: "TÚNEL 1 km" },
    { z: at(START - VIEW * 0.28), type: "tunel", label: "ACENDA OS FARÓIS" },
  )
  avisar(eng, { icone: "🚇", titulo: "TÚNEL", dica: "escuro e eco; o helicóptero te perde", nivel: "info", z, fim: end })
}

/** Um quadro: o jogador está dentro do túnel? Saindo dele, acende o clarão. */
export function atualizarTunel(eng: AutoDashEngine, dt: number, playerZ: number) {
  const dentro = eng.zones.some(zn => zn.type === "tunnel" && wrapDz(eng, zn.z, playerZ) < 0 && wrapDz(eng, zn.end, playerZ) > 0)
  if (eng.dentroTunel && !dentro) eng.claraoT = TUNEL.claraoS
  if (dentro !== eng.dentroTunel) eng.audio.ventilacao(dentro)
  eng.dentroTunel = dentro
  if (eng.claraoT > 0) eng.claraoT = Math.max(0, eng.claraoT - dt)
}
