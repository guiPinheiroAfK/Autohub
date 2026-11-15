// AutoDash — render/camera.ts. Sensação de câmera (R2 de docs/pesquisa/fisica-carro.md):
// zoom por velocidade, rampa do zoom do nitro, tremor por "trauma" com ruído
// suave (no lugar do Math.random) e um ronco contínuo de alta velocidade.
//
// Só desenho, depois da projeção: nada aqui toca CAM_DEPTH nem PLAYER_Z (que
// definem a posição de colisão). Tudo sutil de propósito: zoom ≤ 1,055 e ronco
// < 1 px.
import type { AutoDashEngine } from "../engine"
import { W, H } from "../engine"
import { CARS } from "../data"
import { clamp } from "../math"
import { passoFov } from "./fov"
import { tremidaDaPartida } from "../sim/partida"

// ---------- ruído ----------
// Inteiro → [-1, 1], determinístico (hash de inteiro, sem estado).
function hash1(n: number): number {
  let x = Math.imul(n | 0, 0x27d4eb2d) ^ 0x165667b1
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b)
  x ^= x >>> 13
  return ((x >>> 0) / 4294967295) * 2 - 1
}

/** Ruído de valor suavizado em [-1, 1]: contínuo, barato e sem Math.random. */
export function ruido(t: number): number {
  const i = Math.floor(t), f = t - i
  const u = f * f * (3 - 2 * f)
  const a = hash1(i), b = hash1(i + 1)
  return a + (b - a) * u
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

// ---------- estado ----------
export const TRAUMA_DECAI = 1.5    // por segundo
export const NITRO_SOBE_S = 0.25   // rampa do zoom do nitro
export const NITRO_DESCE_S = 0.4
export const ZOOM_VEL = 0.03       // zoom extra no topo de velocidade
export const ZOOM_NITRO = 0.025    // zoom extra do nitro (o mesmo de antes, agora com rampa)

/**
 * Trauma mínimo de um evento antigo de tremor. Os módulos ainda marcam
 * `shakeT` (duração em s: raspão 0,08, fora da pista 0,1, volta 0,18, batida
 * 0,55–0,6); aqui ele vira intensidade. O tremor visto é trauma², então
 * raspão quase não aparece e batida aparece bem.
 */
export function traumaDeShake(shakeT: number): number {
  return shakeT > 0 ? Math.min(1, 0.3 + shakeT) : 0
}

/** Avança o estado da câmera (todo quadro da simulação, em qualquer tela). */
export function passoCamera(eng: AutoDashEngine, dt: number) {
  eng.camT += dt
  eng.trauma = Math.max(traumaDeShake(eng.shakeT), eng.trauma - TRAUMA_DECAI * dt)
  const nitro = eng.nitroOn && eng.nitroMeter > 1 && eng.state === "racing"
  eng.nitroZoom = nitro
    ? Math.min(1, eng.nitroZoom + dt / NITRO_SOBE_S)
    : Math.max(0, eng.nitroZoom - dt / NITRO_DESCE_S)
  passoFov(eng, dt) // FOV dinâmico da Fase 7 (render/fov.ts)
}

/** Zoom da câmera neste quadro (1 = sem zoom). */
export function zoomCamera(eng: AutoDashEngine): number {
  if (eng.state !== "racing") return 1
  const top = CARS[eng.cfg.carIdx].topSpeed
  return 1 + ZOOM_VEL * smoothstep(150, top, eng.speed) + ZOOM_NITRO * eng.nitroZoom
}

/** Aplica tremor e zoom no contexto (dentro do save/restore do mundo). */
export function aplicarCamera(eng: AutoDashEngine, ctx: CanvasRenderingContext2D) {
  const t = eng.camT
  // tremor por trauma
  const s = eng.trauma * eng.trauma
  let dx = 14 * s * ruido(t * 25), dy = 10 * s * ruido(t * 25 + 100)
  // ronco na pele: micro-tremor que cresce com o cubo da velocidade (< 1 px)
  if (eng.state === "racing") {
    const r = 0.8 * Math.pow(clamp(eng.speed / CARS[eng.cfg.carIdx].topSpeed, 0, 1), 3)
    dx += r * ruido(t * 7 + 200)
    dy += r * ruido(t * 7 + 300)
  }
  // trepidação de motor no grid da corrida: quanto mais giro, mais treme —
  // o carro "pedindo pra sair"
  // partida: tranco do motor pegando (sim/partida.ts)
  if (eng.state === "countdown" && eng.partidaT > 0) {
    const tr = tremidaDaPartida(eng.partidaT)
    dx += 3 * tr * ruido(t * 40 + 600)
    dy += 2.4 * tr * ruido(t * 40 + 700)
  }
  if (eng.mode === "race" && eng.state === "countdown") {
    const rev = clamp((eng.rpm - 3000) / 5000, 0, 1)
    dx += 1.5 * rev * ruido(t * 30 + 400)
    dy += 1.2 * rev * ruido(t * 30 + 500)
  }
  if (dx !== 0 || dy !== 0) ctx.translate(dx, dy)
  // zoom por velocidade e nitro, em volta do horizonte
  const z = zoomCamera(eng)
  if (z > 1.0001) {
    ctx.translate(W / 2, H * 0.55)
    ctx.scale(z, z)
    ctx.translate(-W / 2, -H * 0.55)
  }
}
