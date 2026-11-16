// AutoDash — render/fov.ts. Campo de visão dinâmico (Fase 7; visual-e-desafio.md
// §2.2): com a velocidade o FOV abre de 100° até 104°, e a câmera anda junto
// para a frente ("dolly zoom"), de modo que o chão sob o carro do jogador fica
// no mesmo ponto da tela e com a mesma escala. O resultado: o carro e o trânsito
// colado nele não mudam; o que está longe encolhe e a pista parece "esticar".
//
// Só desenho. `CAM_DEPTH` e `PLAYER_Z` (posição de colisão) não mudam: o render
// lê a profundidade e o avanço daqui. Contra enjoo: abertura pequena (+4°),
// suavizada (τ ≈ 0,6 s, então batida não dá tranco na lente) e desligável na
// garagem ("câmera: fixa").
import type { AutoDashEngine } from "../engine"
import { CAM_DEPTH, CAM_HEIGHT, CARS, FOV } from "../data"
import { smoothstep } from "./camera"

export const FOV_VEL = 3      // graus a mais no topo de velocidade
export const FOV_NITRO = 1    // graus a mais com o nitro aceso (sobre a rampa do zoom)
export const FOV_TAU = 0.6    // segundos: constante de tempo da lente
export const FOV_INICIO = 150 // km/h em que a lente começa a abrir

/** Abertura alvo, 0..1 (fração de FOV_VEL + FOV_NITRO). */
export function alvoFov(eng: AutoDashEngine): number {
  if (eng.state !== "racing" || eng.cfg.camera === "fixa") return 0
  const top = CARS[eng.cfg.carIdx].topSpeed
  const v = smoothstep(FOV_INICIO, top, eng.speed)
  return (FOV_VEL * v + FOV_NITRO * eng.nitroZoom) / (FOV_VEL + FOV_NITRO)
}

/** Avança a lente (chamado junto com o passo da câmera, todo quadro). */
export function passoFov(eng: AutoDashEngine, dt: number) {
  const alvo = alvoFov(eng)
  const atual = Number.isFinite(eng.fovF) ? eng.fovF : 0
  eng.fovF = atual + (alvo - atual) * (1 - Math.exp(-dt / FOV_TAU))
  if (eng.fovF < 1e-4) eng.fovF = 0
}

export interface Lente { depth: number; avanco: number }
const LENTE_FIXA: Lente = { depth: CAM_DEPTH, avanco: 0 }

/** Lente para um FOV em graus: profundidade e avanço da câmera que mantêm o carro no lugar. */
export function lenteDoFov(fovGraus: number): Lente {
  const depth = 1 / Math.tan(((fovGraus / 2) * Math.PI) / 180)
  // o chão do jogador está a PLAYER_Z = CAM_HEIGHT·CAM_DEPTH da câmera; com a
  // lente nova ele precisa ficar a CAM_HEIGHT·depth para cair no mesmo ponto
  return { depth, avanco: CAM_HEIGHT * (CAM_DEPTH - depth) }
}

/** Lente deste quadro. Sem abertura devolve exatamente CAM_DEPTH e avanço 0. */
export function lenteAtual(eng: AutoDashEngine): Lente {
  if (eng.fovF <= 0) return LENTE_FIXA
  return lenteDoFov(FOV + (FOV_VEL + FOV_NITRO) * eng.fovF)
}
