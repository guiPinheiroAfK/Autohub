// AutoDash — world/oleo.ts. E15: óleo na pista depois de um acidente (Fase 5).
//
// Um carro batido no acostamento, com pisca-alerta, e manchas de óleo na faixa
// ao lado. Leitura: o pisca-alerta âmbar aparece de longe e a placa ACIDENTE
// vem antes. Contra-jogada: desviar. Em cima da mancha a aderência cai por um
// instante (escorrega), sem batida e sem perder velocidade.
import { type AutoDashEngine, type Obstacle, H, PLAYER_Z } from "../engine"
import { DRAW_DIST, SEG_LEN } from "../data"
import { TRAFFIC_COLORS } from "../traffic/types"
import { wrapDz } from "../traffic/spawner"
import { avisar } from "./avisos"

export const OLEO = {
  aderencia: 0.35, // multiplicador de aderência em cima do óleo
  duracaoS: 0.7,   // quanto dura o escorregão depois de pisar
  rabeada: 1.1,    // força do balanço lateral enquanto escorrega
}

/** Carro batido e manchas além do horizonte. `lado`: 1 direita, -1 esquerda. */
export function spawnOleo(eng: AutoDashEngine, lado: 1 | -1, cor: number) {
  const VIEW = DRAW_DIST * SEG_LEN
  const base = VIEW * 1.25 // dentro do alcance em que estacionados não somem
  const at = (d: number) => ((eng.position + d) % eng.trackLen + eng.trackLen) % eng.trackLen
  const z = at(base)
  eng.traffic.push({
    z, offset: lado * 1.2, targetOffset: lado * 1.2, speed: 0,
    kind: "car", role: "civilian", parked: true, alerta: true,
    color: TRAFFIC_COLORS[Math.floor(cor * TRAFFIC_COLORS.length) % TRAFFIC_COLORS.length],
    blinkT: 0, prevD: wrapDz(eng, z, eng.position + PLAYER_Z),
  })
  // mancha grande na faixa de fora e um rastro menor puxando pra dentro
  eng.obstacles.push({ z: at(base - 300), offset: lado * 0.72, kind: "oleo", w: 0.34, len: 700, lado })
  eng.obstacles.push({ z: at(base - 1300), offset: lado * 0.38, kind: "oleo", w: 0.24, len: 500, lado })
  eng.roadSigns.push({ z: at(base - VIEW * 0.6), type: "acidente", label: "ACIDENTE" })
  avisar(eng, { icone: "⚠️", titulo: "ACIDENTE", dica: `óleo à ${lado > 0 ? "direita" : "esquerda"}: desvie`, nivel: "perigo", z: at(base - 1300) })
}

/** Pisou na mancha: escorrega por um instante. Chamado pela colisão de obstáculos. */
export function pisarNoOleo(eng: AutoDashEngine, o: Obstacle) {
  if (!o.pisado) {
    o.pisado = true
    eng.floaters.push({ text: "ÓLEO! 🛢️", color: "#FF9F1C", y: H * 0.44, life: 0.9, big: false })
  }
  eng.oleoT = OLEO.duracaoS
}

/** Multiplicador de aderência pelo óleo (1 fora dele). */
export function aderenciaOleo(eng: AutoDashEngine): number {
  return eng.oleoT > 0 ? OLEO.aderencia : 1
}

/** Um quadro do escorregão: consome o tempo e balança a traseira. */
export function passoOleo(eng: AutoDashEngine, dt: number) {
  if (eng.oleoT <= 0) return
  eng.oleoT = Math.max(0, eng.oleoT - dt)
  // rabeada determinística (relógio do som): o carro "dança" sem sair sozinho da pista
  eng.steerVel += Math.sin(eng.somT * 9) * OLEO.rabeada * dt
}
