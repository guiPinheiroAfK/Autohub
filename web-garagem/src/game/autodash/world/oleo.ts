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
import { emitSmoke } from "../fx/particles"

// Playtest 16/11: "passar em cima do óleo não faz nada". Antes era só aderência
// menor por 0,7 s e um balanço de 1,1: em reta, sem mexer no volante, não se
// sentia. Agora tem tranco ao pisar, rabeada forte, roda patinando e fumaça.
export const OLEO = {
  aderencia: 0.35, // multiplicador de aderência em cima do óleo
  duracaoS: 1.2,   // quanto dura o escorregão depois de pisar
  rabeada: 3.4,    // força do balanço lateral enquanto escorrega (era 1,1)
  tranco: 0.9,     // empurrão lateral ao pisar (direção da mancha para fora)
  perdaVel: 0.06,  // fração da velocidade perdida ao pisar
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
  // Fase 8.3: o outro carro da batida, o guincho com giroflex chegando, o
  // triângulo antes e os cacos no asfalto
  const z2 = at(base + 500)
  eng.traffic.push({
    z: z2, offset: lado * 1.06, targetOffset: lado * 1.06, speed: 0,
    kind: "car", role: "civilian", parked: true, alerta: true,
    color: TRAFFIC_COLORS[(Math.floor(cor * TRAFFIC_COLORS.length) + 3) % TRAFFIC_COLORS.length],
    blinkT: 0, prevD: wrapDz(eng, z2, eng.position + PLAYER_Z),
  })
  const z3 = at(base + 1500)
  eng.traffic.push({
    z: z3, offset: lado * 1.25, targetOffset: lado * 1.25, speed: 0,
    kind: "truck", role: "civilian", parked: true, giroflexAmbar: true, color: "#facc15",
    blinkT: 0, prevD: wrapDz(eng, z3, eng.position + PLAYER_Z),
  })
  eng.obstacles.push({ z: at(base - 2600), offset: lado * 0.97, kind: "cena", visual: "triangulo", w: 0.1, len: 40, lado })
  eng.obstacles.push({ z: at(base - 150), offset: lado * 0.55, kind: "cena", visual: "detritos", w: 0.3, len: 60, lado })
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
    // o tranco: a traseira escapa para o lado de fora da mancha, perde um
    // pouco de velocidade, as rodas patinam e a câmera sacode
    eng.steerVel += (o.lado ?? 1) * OLEO.tranco
    eng.speed *= 1 - OLEO.perdaVel
    eng.wheelspinT = Math.max(eng.wheelspinT, OLEO.duracaoS * 0.6)
    eng.shakeT = Math.max(eng.shakeT, 0.25)
    eng.trauma = Math.min(1, Math.max(eng.trauma, 0.35))
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
  // rabeada determinística (relógio do som): o carro "dança" e você tem de
  // segurar no volante; vai diminuindo até o pneu limpar
  const resto = eng.oleoT / OLEO.duracaoS
  eng.steerVel += Math.sin(eng.somT * 7) * OLEO.rabeada * resto * dt
  if (Math.floor(eng.somT * 20) !== Math.floor((eng.somT - dt) * 20)) emitSmoke(eng, 2, "#94a3b8")
}
