// AutoDash — engine pseudo-3D (estilo NFS de PSP) em Canvas 2D puro.
// Estrada por segmentos projetados, tráfego, clima, câmbio com RPM e ranking local.

import {
  CANVAS_W, CANVAS_H, SEG_LEN, ROAD_WIDTH, CAM_HEIGHT, CAM_DEPTH, DRAW_DIST,
  KMH2UPS, RPM_IDLE, RPM_REDLINE, RPM_LIMITER, GEAR_RATIOS, RPM_PER_KMH,
  CARS, PAINTS, STRIPES, NEONS, NEON_NAMES, WHEELS, WINGS,
  loadConfig, saveConfig, cachedScores, fetchLeaderboard, submitScore,
  type CarSpec, type CarCustom, type GameConfig, type ScoreEntry,
} from "./data"
import { AudioBus } from "./audio"
import { createRoom, joinRoom, pollRoom, postState, rematchRoom, type DuelTelemetry } from "./net"

const W = CANVAS_W, H = CANVAS_H
const PLAYER_Z = CAM_HEIGHT * CAM_DEPTH
const RUMBLE = 3

type GameState =
  | "menu" | "garage" | "countdown" | "racing" | "paused" | "gameover" | "nameentry"
  | "duellobby" | "duelcode" | "duelwaiting" | "duelspectate" | "duelresult"

interface DuelSession {
  code: string
  seed: number
  role: "host" | "guest"
  oppName: string
  startAtLocal: number | null // performance.now() do sinal verde
  opp: DuelTelemetry | null
  oppD: number                // km do rival, extrapolado entre polls
  postT: number
  busy: boolean
  lastSeen: number
  iCrashed: boolean
  scoreSent: boolean
  result: "win" | "lose" | null
  rematch: boolean
  msg: string
}

// RNG determinístico — no duelo os dois recebem a mesma pista via seed
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Seg { curve: number; y1: number; y2: number; sign?: number }

type TrafficKind = "car" | "moto" | "truck" | "bus"
const KINDS: Record<TrafficKind, { w: number; len: number; h: number; spd: [number, number] }> = {
  car:   { w: 0.28, len: 260, h: 0.80, spd: [85, 125] },
  moto:  { w: 0.12, len: 190, h: 1.25, spd: [115, 150] },
  truck: { w: 0.34, len: 540, h: 1.55, spd: [66, 88] },
  bus:   { w: 0.33, len: 470, h: 1.45, spd: [76, 95] },
}
const TRAFFIC_COLORS = ["#64748b", "#0ea5e9", "#84cc16", "#ec4899", "#eab308", "#e2e8f0", "#7c3aed", "#b45309"]

interface Traffic {
  z: number
  offset: number
  targetOffset: number
  speed: number
  kind: TrafficKind
  color: string
  blinkT: number      // >0: seta ligada antes/durante a troca de faixa
  prevD: number
  dead?: boolean
  yieldT?: number     // >0: levou farol alto, tenta abrir caminho
}

const PU_NITRO = 0, PU_SHIELD = 1, PU_X2 = 2
interface Pickup { z: number; offset: number; type: number; pulse: number; taken?: boolean }

interface Particle { x: number; y: number; vx: number; vy: number; size: number; life: number; maxLife: number; color: string }
interface Floater { text: string; color: string; y: number; life: number; big: boolean }
interface Drop { x: number; y: number; len: number; spd: number }

// paletas de céu por hora do dia (t = fração do ciclo)
const SKY_KEYS = [
  { t: 0.125, top: "#2b8fd6", bot: "#bfe6f7", amb: 1.0 },
  { t: 0.375, top: "#3b2a63", bot: "#fb923c", amb: 0.8 },
  { t: 0.625, top: "#050816", bot: "#16233f", amb: 0.42 },
  { t: 0.875, top: "#33507c", bot: "#fcd9a0", amb: 0.78 },
]

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mix(a: string, b: string, p: number): string {
  const ca = hexToRgb(a), cb = hexToRgb(b)
  return `rgb(${Math.round(ca[0] + (cb[0] - ca[0]) * p)},${Math.round(ca[1] + (cb[1] - ca[1]) * p)},${Math.round(ca[2] + (cb[2] - ca[2]) * p)})`
}
function shade(hex: string, f: number): string {
  const c = hexToRgb(hex)
  return `rgb(${Math.round(c[0] * f)},${Math.round(c[1] * f)},${Math.round(c[2] * f)})`
}
function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v }

export class AutoDashEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private audio = new AudioBus()
  private cfg: GameConfig = loadConfig()
  private scores: ScoreEntry[] = cachedScores()

  private state: GameState = "menu"
  private raf = 0
  private lastT = 0
  private destroyed = false

  // pista
  private segments: Seg[] = []
  private trackLen = 0

  // jogador
  private position = 0
  private speed = 0            // km/h
  private playerX = 0          // -1..1 (fração da meia-pista)
  private gear = 1             // 0 = neutro
  private rpm = RPM_IDLE
  private shiftT = 0
  private wheelspinT = 0
  private bogT = 0
  private nitroMeter = 0
  private nitroOn = false
  private offroadT = 0
  private steerVel = 0
  private shield = false
  private mult2T = 0
  private level = 0
  private levelUpT = 0

  // corrida
  private score = 0
  private km = 0
  private combo = 0
  private comboT = 0
  private countT = 0
  private greenAt = 0
  private greenFired = false
  private goFlashT = 0
  private shakeT = 0
  private crashed = false

  // mundo
  private traffic: Traffic[] = []
  private powerups: Pickup[] = []
  private puTimer = 6
  private bgShift = 0
  private curveWarn = 0
  private curveWarnDist = 0
  private curveBeepT = 0
  private collWarn: Traffic | null = null
  private collBeepT = 0
  private particles: Particle[] = []
  private floaters: Floater[] = []
  private drops: Drop[] = []
  private clouds = Array.from({ length: 6 }, (_, i) => ({
    x: (i * 173) % W, y: 26 + (i * 61) % 130, s: 34 + (i * 37) % 44,
  }))
  private raining = false
  private rainT = 0
  private rainRollT = 0
  private demoT = 0

  // input
  private keys = new Set<string>()
  private mouseGas = false
  private mouseBrake = false
  private mouseXn = 0.5
  private mousePx = { x: -1, y: -1 }
  private uiRegions: { x: number; y: number; w: number; h: number; act: () => void }[] = []
  private nameBuf = ""
  private afterName: "garage" | "duellobby" = "garage"
  private mode: "solo" | "duel" = "solo"
  private duel: DuelSession | null = null
  private codeBuf = ""
  private prevState: GameState = "menu"
  private fadeT = 0
  private newRecord = false
  private beamT = 0
  private beamCdT = 0
  private pitchY = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("canvas 2d indisponível")
    this.ctx = ctx
    this.buildTrack()
    this.seedTraffic(14)
    this.bind()
    void this.refreshScores()
    this.lastT = performance.now()
    const loop = (t: number) => {
      if (this.destroyed) return
      const dt = clamp((t - this.lastT) / 1000, 0, 0.05)
      this.lastT = t
      this.update(dt)
      this.render()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    this.audio.dispose()
    this.unbind()
  }

  // ---------- pista ----------
  private buildTrack(seed = Math.floor(Math.random() * 2 ** 31)) {
    const rnd = mulberry32(seed)
    this.segments = []
    let lastY = 0
    const seg = (curve: number, y: number) => { this.segments.push({ curve, y1: lastY, y2: y }); lastY = y }
    const easeIO = (a: number, b: number, p: number) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5)
    const addRoad = (enter: number, hold: number, leave: number, curve: number, dy: number) => {
      const y0 = lastY, total = enter + hold + leave
      let i = 0
      for (let n = 0; n < enter; n++, i++) seg(curve * (n / enter), easeIO(y0, y0 + dy, i / total))
      for (let n = 0; n < hold; n++, i++) seg(curve, easeIO(y0, y0 + dy, i / total))
      for (let n = 0; n < leave; n++, i++) seg(curve * (1 - n / leave), easeIO(y0, y0 + dy, i / total))
    }
    const r = (lo: number, hi: number) => lo + rnd() * (hi - lo)
    const ri = (lo: number, hi: number) => Math.floor(r(lo, hi + 1))

    addRoad(30, 80, 30, 0, 0) // reta de largada
    while (this.segments.length < 4000) {
      const roll = rnd()
      const hill = r(-1, 1) * r(600, 2600)
      if (roll < 0.10) addRoad(30, ri(110, 220), 30, 0, r(-1, 1) * r(400, 1600)) // retão pra esticar as marchas
      else if (roll < 0.30) addRoad(ri(20, 40), ri(30, 70), ri(20, 40), 0, hill)
      else if (roll < 0.62) {
        const c = (rnd() < 0.5 ? -1 : 1) * r(2, 5)
        addRoad(ri(25, 45), ri(30, 70), ri(25, 45), c, hill * 0.6)
      } else if (roll < 0.86) {
        const c = (rnd() < 0.5 ? -1 : 1) * r(2.5, 4.5)
        addRoad(25, 40, 25, c, hill * 0.4)
        addRoad(25, 40, 25, -c, -hill * 0.4)
      } else addRoad(ri(15, 25), ri(20, 40), ri(15, 25), (rnd() < 0.5 ? -1 : 1) * r(4.5, 6), 0)
    }
    addRoad(40, 40, 40, 0, -lastY) // fecha o loop plano
    this.trackLen = this.segments.length * SEG_LEN

    // placas de chevron antes de curvas fechadas
    for (let i = 46; i < this.segments.length; i++) {
      const c = this.segments[i].curve
      if (Math.abs(c) >= 4 && Math.abs(this.segments[i - 1].curve) < 4) {
        for (let k = 22; k <= 46; k += 8) {
          this.segments[i - k].sign = c > 0 ? 1 : -1
        }
      }
    }
  }

  private segAt(z: number): Seg {
    const n = this.segments.length
    return this.segments[Math.floor(((z % this.trackLen) + this.trackLen) % this.trackLen / SEG_LEN) % n]
  }

  // ---------- tráfego ----------
  private laneCenters = [-0.75, -0.25, 0.25, 0.75]

  private seedTraffic(count: number) {
    this.traffic = []
    for (let i = 0; i < count; i++) this.spawnTraffic((i + 1) * (DRAW_DIST * SEG_LEN / count) + 6000)
  }

  private spawnTraffic(relAhead: number) {
    const roll = Math.random()
    const kind: TrafficKind = roll < 0.52 ? "car" : roll < 0.68 ? "moto" : roll < 0.87 ? "truck" : "bus"
    const k = KINDS[kind]
    const lane = this.laneCenters[Math.floor(Math.random() * 4)]
    const z = ((this.position + relAhead) % this.trackLen + this.trackLen) % this.trackLen
    // não nasce em cima de outro
    for (const t of this.traffic) {
      if (Math.abs(t.offset - lane) < 0.3 && Math.abs(this.wrapDz(t.z, z)) < k.len + KINDS[t.kind].len) return
    }
    this.traffic.push({
      z, offset: lane, targetOffset: lane,
      speed: k.spd[0] + Math.random() * (k.spd[1] - k.spd[0]),
      kind, color: TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)],
      blinkT: 0, prevD: 1,
    })
  }

  private wrapDz(a: number, b: number): number {
    let d = a - b
    if (d > this.trackLen / 2) d -= this.trackLen
    if (d < -this.trackLen / 2) d += this.trackLen
    return d
  }

  private updateTraffic(dt: number, playerZ: number, demo: boolean) {
    const target = 14 + Math.min(14, Math.floor(this.km * 1.3)) + this.level * 3
    if (this.traffic.length < target) this.spawnTraffic(DRAW_DIST * SEG_LEN * (0.6 + Math.random() * 0.4))

    const spec = CARS[this.cfg.carIdx]
    for (const t of this.traffic) {
      const k = KINDS[t.kind]
      // levou farol alto: caminhão/ônibus nem sempre colaboram
      if (t.yieldT && t.yieldT > 0) {
        t.yieldT -= dt
        if (t.targetOffset === t.offset) {
          const comply = t.kind === "car" || t.kind === "moto" || Math.random() < 0.02
          if (comply) {
            for (const side of this.playerX > t.offset ? [-0.5, 0.5] : [0.5, -0.5]) {
              const lane = t.offset + side
              if (lane < -0.9 || lane > 0.9) continue
              let clear = true
              for (const o of this.traffic) {
                if (o !== t && Math.abs(o.targetOffset - lane) < 0.3 && Math.abs(this.wrapDz(o.z, t.z)) < 1100) { clear = false; break }
              }
              if (clear) { t.targetOffset = lane; t.blinkT = 0.6; t.yieldT = 0; break }
            }
          }
        }
      }
      // IA: não bater no da frente; tentar ultrapassar
      let ahead: Traffic | null = null
      for (const o of this.traffic) {
        if (o === t) continue
        const d = this.wrapDz(o.z, t.z)
        if (d > 0 && d < 1500 && Math.abs(o.offset - t.offset) < 0.32) {
          if (!ahead || d < this.wrapDz(ahead.z, t.z)) ahead = o
        }
      }
      let spd = t.speed
      if (ahead && ahead.speed < t.speed) {
        spd = Math.max(ahead.speed, t.speed - 40)
        if (t.blinkT <= 0 && t.targetOffset === t.offset && (t.kind === "car" || t.kind === "moto") && Math.random() < 0.02) {
          for (const side of Math.random() < 0.5 ? [-0.5, 0.5] : [0.5, -0.5]) {
            const lane = t.offset + side
            if (lane < -0.9 || lane > 0.9) continue
            let clear = true
            for (const o of this.traffic) {
              if (o !== t && Math.abs(o.targetOffset - lane) < 0.3 && Math.abs(this.wrapDz(o.z, t.z)) < 1100) { clear = false; break }
            }
            if (clear) { t.targetOffset = lane; t.blinkT = 0.8; break }
          }
        }
      }
      if (t.blinkT > 0) t.blinkT -= dt
      if (t.targetOffset !== t.offset && t.blinkT <= 0.3) {
        const step = 0.45 * dt * Math.sign(t.targetOffset - t.offset)
        if (Math.abs(t.targetOffset - t.offset) <= Math.abs(step)) { t.offset = t.targetOffset }
        else t.offset += step
      }
      t.z = ((t.z + spd * KMH2UPS * dt) % this.trackLen + this.trackLen) % this.trackLen

      const d = this.wrapDz(t.z, playerZ)
      if (!demo) {
        const halfSum = (k.w + spec.width) / 2 + 0.02
        // colisão
        if (Math.abs(d) < k.len / 2 + 120 && Math.abs(t.offset - this.playerX) < halfSum && !this.crashed) {
          if (this.shield) {
            this.shield = false
            t.dead = true
            this.audio.shieldBreak()
            this.burst(W / 2, H - 110, 20, ["#60a5fa", "#bfdbfe"])
            this.floaters.push({ text: "ESCUDO QUEBROU!", color: "#60a5fa", y: H * 0.4, life: 1.3, big: false })
          } else {
            this.crash()
          }
        }
        // near miss: acabou de passar por ele
        if (t.prevD > 0 && d <= 0 && !this.crashed) {
          const gap = Math.abs(t.offset - this.playerX)
          if (gap < halfSum + 0.20 && this.speed > spd + 15) {
            this.combo = Math.min(7, this.combo + 1)
            this.comboT = 4
            const mult = (1 + this.combo) * (this.mult2T > 0 ? 2 : 1)
            const pts = 200 * mult
            this.score += pts
            this.nitroMeter = Math.min(100, this.nitroMeter + 14)
            this.floaters.push({ text: `QUASE! +${pts}  x${mult}`, color: "#fde047", y: H * 0.42, life: 1.2, big: false })
            this.burst(W / 2 + (t.offset > this.playerX ? 72 : -72), H - 100, 9, ["#fde047", "#fff7c0"])
            this.shakeT = Math.max(this.shakeT, 0.08)
            this.audio.nearMiss()
            if (Math.random() < 0.3) this.audio.horn()
          }
        }
      }
      t.prevD = d

      // recicla quem ficou muito longe
      const rel = this.wrapDz(t.z, this.position)
      if (rel < -40 * SEG_LEN || rel > (DRAW_DIST + 80) * SEG_LEN) {
        t.z = ((this.position + (DRAW_DIST * 0.55 + Math.random() * DRAW_DIST * 0.4) * SEG_LEN) % this.trackLen + this.trackLen) % this.trackLen
        const lane = this.laneCenters[Math.floor(Math.random() * 4)]
        t.offset = lane; t.targetOffset = lane
        const kk = KINDS[t.kind]
        t.speed = kk.spd[0] + Math.random() * (kk.spd[1] - kk.spd[0])
        t.prevD = 1
      }
    }
    if (this.traffic.some(t => t.dead)) this.traffic = this.traffic.filter(t => !t.dead)
  }

  // ---------- física ----------
  private powerCurve(rpm: number): number {
    if (rpm >= RPM_LIMITER) return 0
    if (rpm < 1400) return 0.25
    if (rpm < 4500) return 0.5 + 0.5 * ((rpm - 1400) / 3100)
    if (rpm < 7000) return 1.0
    return 1.0 - 0.45 * ((rpm - 7000) / (RPM_LIMITER - 7000))
  }

  private rpmFor(speed: number, gear: number): number {
    if (gear <= 0) return this.rpm
    return RPM_IDLE + speed * GEAR_RATIOS[gear - 1] * RPM_PER_KMH
  }

  private shiftUp() {
    if (this.gear === 0) {
      let best = 1
      for (let g = 6; g >= 1; g--) {
        const r = this.rpmFor(this.speed, g)
        if (r >= 1800 && r <= 6500) { best = g; break }
        if (r < 1800) best = Math.max(1, g - 0)
      }
      this.gear = Math.max(1, Math.min(6, best))
      this.shiftT = CARS[this.cfg.carIdx].shiftMs / 1000
      this.audio.shift()
      this.popExhaust()
      return
    }
    if (this.gear >= 6) return
    this.gear++
    this.shiftT = CARS[this.cfg.carIdx].shiftMs / 1000
    if (this.rpmFor(this.speed, this.gear) < 1500) this.audio.bog()
    else { this.audio.shift(); this.popExhaust() }
  }

  /** Estouro no escape ao engatar — puro juice. */
  private popExhaust() {
    if (this.state !== "racing" || this.speed < 30) return
    for (const sx of [-22, 22]) {
      for (let i = 0; i < 3; i++) {
        this.particles.push({
          x: W / 2 + sx + (Math.random() - 0.5) * 6, y: H - 56,
          vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 60,
          size: 3 + Math.random() * 4, life: 0.18, maxLife: 0.18,
          color: Math.random() < 0.5 ? "#fb923c" : "#fde047",
        })
      }
    }
  }

  private shiftDown() {
    if (this.gear <= 0) return
    if (this.gear === 1) { this.gear = 0; this.audio.shift(); return }
    const next = this.gear - 1
    if (this.rpmFor(this.speed, next) > RPM_LIMITER + 400) { this.audio.limiter(); return } // protege o motor
    this.gear = next
    this.shiftT = CARS[this.cfg.carIdx].shiftMs / 1000
    this.audio.shift()
  }

  private update(dt: number) {
    const spec = CARS[this.cfg.carIdx]

    this.duelNet(dt)

    if (["menu", "garage", "duellobby", "duelcode", "duelwaiting", "duelresult"].includes(this.state)) {
      // demo: câmera passeia pela pista
      this.demoT += dt
      this.speed = 95
      this.position = (this.position + this.speed * KMH2UPS * dt) % this.trackLen
      this.playerX = Math.sin(this.demoT * 0.3) * 0.2
      this.bgShift += this.segAt(this.position + PLAYER_Z).curve * this.speed * dt * 0.6
      this.updateTraffic(dt, this.position + PLAYER_Z, true)
      this.updateFx(dt) // floaters/partículas sobrando da corrida ainda precisam morrer
      this.audio.engine(0, 0, false, false)
      return
    }
    if (this.state === "paused" || this.state === "gameover" || this.state === "nameentry" || this.state === "duelspectate") {
      this.updateFx(dt)
      this.audio.engine(0, 0, false, false)
      this.audio.skid(0)
      return
    }

    const throttle = this.mouseGas || this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0
    const braking = this.mouseBrake || this.keys.has("s") || this.keys.has("arrowdown")

    if (this.state === "countdown") {
      this.countT += dt
      // rev livre no grid
      const targetRpm = RPM_IDLE + throttle * (7500 - RPM_IDLE)
      this.rpm += (targetRpm - this.rpm) * Math.min(1, dt * 5)
      if (this.rpm > RPM_LIMITER) this.rpm = RPM_LIMITER - Math.random() * 300
      if (this.countT >= this.greenAt) {
        this.greenFired = true
        this.audio.semaphoreGreen()
        this.launch()
        this.goFlashT = 1.2
        this.state = "racing"
      } else {
        for (const tl of [0.8, 1.6, 2.4]) {
          if (this.countT >= tl && this.countT - dt < tl) this.audio.semaphoreRed()
        }
      }
      this.audio.engine(this.rpm, throttle, false, true)
      this.updateFx(dt)
      return
    }

    // ---------- racing ----------
    const grip = spec.grip * (this.raining ? 0.62 : 1)
    const playerZ = this.position + PLAYER_Z
    const seg = this.segAt(playerZ)

    // direção — input suavizado, mais firme em alta velocidade
    let steerInput = 0
    if (this.cfg.steering === "mouse") {
      steerInput = clamp(((this.mouseXn * 2 - 1) * 1.25 - this.playerX) * 2.2, -1, 1)
    } else {
      if (this.keys.has("a") || this.keys.has("arrowleft")) steerInput -= 1
      if (this.keys.has("d") || this.keys.has("arrowright")) steerInput += 1
    }
    const speedF = Math.min(1, this.speed / 240)
    const maxSteer = (0.95 + grip * 0.85) * (1 - 0.38 * speedF) * (0.35 + 0.65 * Math.min(1, this.speed / 55))
    this.steerVel += (steerInput * maxSteer - this.steerVel) * Math.min(1, dt * 9)
    if (this.levelUpT > 0) this.steerVel += Math.sin(this.levelUpT * 22) * 0.9 * dt // rabeio da virada de nível
    this.playerX += this.steerVel * dt

    // força centrífuga — curva média se segura no volante; fechada em vmax pede freio
    const centrif = seg.curve * Math.pow(this.speed / 240, 2.2) * (0.42 - grip * 0.22)
    this.playerX -= centrif * dt
    const slip = Math.abs(centrif) * speedF
    this.audio.skid(slip > 0.3 ? slip : 0)
    if (slip > 0.45 && Math.abs(this.steerVel) > 0.3 && Math.random() < 0.5) this.emitSmoke(1, "#6b7280")
    this.bgShift += seg.curve * this.speed * dt * 0.6

    // transferência de peso: sobe o bico na freada, agacha no gás
    const pitchTarget = braking && this.speed > 20 ? -4 : throttle ? 1.5 : 0
    this.pitchY += (pitchTarget - this.pitchY) * Math.min(1, dt * 8)

    // fora da pista
    if (Math.abs(this.playerX) > 1.05) {
      this.offroadT += dt
      this.speed = Math.max(Math.min(this.speed, 60), this.speed - 160 * dt)
      this.shakeT = 0.1
      this.combo = 0
      if (Math.random() < 0.3) this.audio.offroad()
      this.emitSmoke(3, "#a3a3a3")
    } else this.offroadT = 0
    this.playerX = clamp(this.playerX, -1.6, 1.6)

    // ---------- motor ----------
    if (this.shiftT > 0) this.shiftT -= dt
    if (this.wheelspinT > 0) this.wheelspinT -= dt
    if (this.bogT > 0) this.bogT -= dt

    if (this.gear >= 1) this.rpm = this.rpmFor(this.speed, this.gear)
    else {
      const targetRpm = RPM_IDLE + throttle * (7500 - RPM_IDLE)
      this.rpm += (targetRpm - this.rpm) * Math.min(1, dt * 5)
    }

    // câmbio automático
    if (this.cfg.transmission === "auto" && this.gear >= 1 && this.shiftT <= 0) {
      if (throttle && this.rpm > 6900 && this.gear < 6) this.shiftUp()
      else if (this.rpm < 2000 && this.gear > 1) this.shiftDown()
    }

    let accel = 0
    if (this.gear >= 1 && throttle && this.shiftT <= 0) {
      const gearF = Math.pow(GEAR_RATIOS[this.gear - 1] / GEAR_RATIOS[0], 0.9)
      accel = spec.power * this.powerCurve(this.rpm) * gearF
      if (this.rpm >= RPM_LIMITER - 50) { accel = 0; if (Math.random() < 0.4) this.audio.limiter() }
      if (this.wheelspinT > 0) { accel *= 0.35; this.emitSmoke(2, "#e2e8f0") }
      if (this.bogT > 0) accel *= 0.5
    }
    if (this.nitroOn && this.nitroMeter > 1 && this.gear >= 1) {
      accel += 42
      this.nitroMeter = Math.max(0, this.nitroMeter - 38 * dt)
      this.emitFlame()
    }
    const nitroActive = this.nitroOn && this.nitroMeter > 1

    this.speed += accel * dt
    if (braking) this.speed -= (this.raining ? 78 : 105) * dt
    this.speed -= (5 + this.speed * 0.028) * dt // arrasto
    const maxSpd = spec.topSpeed * (nitroActive ? 1.12 : 1)
    this.speed = clamp(this.speed, 0, maxSpd)
    // limite por marcha (estourou o giro = não anda mais)
    if (this.gear >= 1) {
      const gearTop = (RPM_LIMITER - RPM_IDLE) / (GEAR_RATIOS[this.gear - 1] * RPM_PER_KMH)
      this.speed = Math.min(this.speed, gearTop)
    }

    this.position = ((this.position + this.speed * KMH2UPS * dt) % this.trackLen + this.trackLen) % this.trackLen
    this.km += this.speed * dt / 3600

    if (this.goFlashT > 0) this.goFlashT -= dt
    if (this.mult2T > 0) this.mult2T -= dt
    if (this.beamT > 0) this.beamT -= dt
    if (this.beamCdT > 0) this.beamCdT -= dt

    // pontuação e combo
    const mult = (1 + this.combo) * (this.mult2T > 0 ? 2 : 1)
    this.score += this.speed * dt * 0.35 * mult
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0 }

    // a cada 10k pontos o jogo sobe de nível: rabeio comemorativo e trânsito mais bravo
    const newLevel = Math.floor(this.score / 10000)
    if (newLevel > this.level) {
      this.level = newLevel
      this.levelUpT = 1.5
      this.audio.levelUp()
      this.floaters.push({ text: `NÍVEL ${newLevel + 1} — TRÂNSITO MAIS BRAVO!`, color: "#fb923c", y: H * 0.32, life: 2.2, big: true })
    }
    if (this.levelUpT > 0) {
      this.levelUpT -= dt
      if (Math.random() < 0.6) this.emitSmoke(2, "#e2e8f0")
    }

    // powerups na pista
    this.puTimer -= dt
    if (this.puTimer <= 0) {
      this.puTimer = 7 + Math.random() * 6
      this.powerups.push({
        z: ((this.position + DRAW_DIST * (0.55 + Math.random() * 0.3) * SEG_LEN) % this.trackLen + this.trackLen) % this.trackLen,
        offset: this.laneCenters[Math.floor(Math.random() * 4)],
        type: Math.floor(Math.random() * 3),
        pulse: 0,
      })
    }
    for (const p of this.powerups) {
      p.pulse += dt * 6
      const d = this.wrapDz(p.z, playerZ)
      if (!p.taken && Math.abs(d) < 160 && Math.abs(p.offset - this.playerX) < 0.30) {
        p.taken = true
        this.audio.pickup()
        if (p.type === PU_NITRO) { this.nitroMeter = Math.min(100, this.nitroMeter + 40); this.floaters.push({ text: "+NOS", color: "#38bdf8", y: H * 0.45, life: 1, big: false }) }
        if (p.type === PU_SHIELD) { this.shield = true; this.floaters.push({ text: "ESCUDO!", color: "#60a5fa", y: H * 0.45, life: 1, big: false }) }
        if (p.type === PU_X2) { this.mult2T = 8; this.floaters.push({ text: "PONTOS EM DOBRO!", color: "#fde047", y: H * 0.45, life: 1.2, big: false }) }
      }
    }
    this.powerups = this.powerups.filter(p => !p.taken && this.wrapDz(p.z, this.position) > -20 * SEG_LEN)

    // fumaça de escape / arrancada
    if (throttle && this.speed < 40 && this.gear >= 1) this.emitSmoke(2, "#cbd5e1")
    else if (throttle && Math.random() < 0.3) this.emitSmoke(1, "#64748b")

    // clima
    this.rainRollT += dt
    if (this.rainRollT > 18) {
      this.rainRollT = 0
      if (!this.raining && Math.random() < 0.18) { this.raining = true; this.rainT = 22 + Math.random() * 20; this.initRain(); this.audio.rain(true) }
    }
    if (this.raining) {
      this.rainT -= dt
      if (this.rainT <= 0) { this.raining = false; this.audio.rain(false) }
    }

    this.updateTraffic(dt, playerZ, false)

    // aviso de curva fechada à frente
    this.curveWarn = 0
    const lookStart = Math.floor(playerZ / SEG_LEN)
    for (let n = 25; n < 95; n++) {
      const s = this.segments[(lookStart + n) % this.segments.length]
      if (Math.abs(s.curve) >= 4) { this.curveWarn = Math.sign(s.curve); this.curveWarnDist = n; break }
    }
    this.curveBeepT -= dt
    if (this.curveWarn !== 0 && this.curveWarnDist < 70 && this.speed > 170 && this.curveBeepT <= 0) {
      this.curveBeepT = 1.1
      this.audio.warn()
    }

    // aviso de colisão: veículo lento na sua faixa
    this.collWarn = null
    let bestD = Infinity
    for (const t of this.traffic) {
      const d = this.wrapDz(t.z, playerZ)
      if (d > 200 && d < 3600 && Math.abs(t.offset - this.playerX) < 0.30 && this.speed > t.speed + 45 && d < bestD) {
        bestD = d
        this.collWarn = t
      }
    }
    this.collBeepT -= dt
    if (this.collWarn && bestD < 2400 && this.collBeepT <= 0) {
      this.collBeepT = 0.65
      this.audio.warn()
    }

    this.updateFx(dt)
    this.audio.engine(this.rpm, throttle, nitroActive, true)
  }

  private launch() {
    // qualidade da largada pela zona de RPM segurada no verde
    this.gear = 1
    if (this.rpm >= 3600 && this.rpm <= 6300) {
      this.speed = 52
      this.nitroMeter = Math.min(100, this.nitroMeter + 30)
      this.floaters.push({ text: "LARGADA PERFEITA!", color: "#fde047", y: H * 0.35, life: 1.6, big: true })
      this.audio.perfectLaunch()
    } else if (this.rpm > 6800) {
      this.speed = 18
      this.wheelspinT = 1.3
      this.floaters.push({ text: "PATINOU!", color: "#fb923c", y: H * 0.35, life: 1.4, big: true })
    } else if (this.rpm < 2200) {
      this.speed = 10
      this.bogT = 1.1
      this.floaters.push({ text: "ENGASGOU...", color: "#94a3b8", y: H * 0.35, life: 1.4, big: true })
      this.audio.bog()
    } else {
      this.speed = 32
    }
  }

  private burst(x: number, y: number, n: number, colors: string[]) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 260
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
        size: 4 + Math.random() * 9, life: 0.9, maxLife: 0.9,
        color: colors[Math.floor(Math.random() * colors.length)],
      })
    }
  }

  private crash() {
    this.crashed = true
    this.audio.crash()
    this.shakeT = 0.6
    this.burst(W / 2, H - 110, 40, ["#fb923c", "#ef4444"])
    const entry: ScoreEntry = {
      name: (this.cfg.pilotName || "PILOTO").trim(),
      score: Math.floor(this.score),
      km: Math.round(this.km * 10) / 10,
    }
    this.newRecord = entry.score > 300 && (this.scores.length === 0 || entry.score > this.scores[0].score)
    if (entry.score > 300) {
      if (this.duel) this.duel.scoreSent = true
      void submitScore(entry).then((scores) => {
        if (!this.destroyed && scores.length) this.scores = scores
      })
    }

    if (this.mode === "duel" && this.duel) {
      const d = this.duel
      d.iCrashed = true
      void postState(d.code, d.role, this.myTelemetry(true))
        .then((r) => { if (r.opp) { d.opp = r.opp; d.oppD = r.opp.d; d.lastSeen = performance.now() } })
        .catch(() => { /* spectate segue tentando */ })
      if (d.opp?.c) this.duelFinish(this.km > d.oppD)
      else this.state = "duelspectate"
      return
    }

    this.state = "gameover"
  }

  private async refreshScores() {
    const scores = await fetchLeaderboard()
    if (!this.destroyed && scores.length) this.scores = scores
  }

  // ---------- duelo online ----------
  private duelNet(dt: number) {
    const d = this.duel
    if (!d || this.mode !== "duel") return
    d.postT -= dt
    // extrapola a distância do rival entre polls
    if (d.opp && !d.opp.c && !d.result) d.oppD += (d.opp.v / 3600) * dt

    if (this.state === "duelwaiting") {
      if (d.startAtLocal === null && d.postT <= 0 && !d.busy) {
        d.postT = 1.5
        d.busy = true
        if (d.rematch) {
          // revanche: mesma sala; quando o rival topar, vem seed nova + largada
          rematchRoom(d.code, d.role).then((r) => {
            if (r.startInMs !== null && r.startInMs > 300) {
              d.seed = r.seed
              d.startAtLocal = performance.now() + r.startInMs
              d.opp = null; d.oppD = 0
              d.result = null; d.iCrashed = false; d.scoreSent = false
            }
          }).catch(() => { /* tenta de novo no próximo tick */ }).finally(() => { d.busy = false })
        } else {
          pollRoom(d.code).then((r) => {
            if (r.oppName && r.startInMs !== null) {
              d.oppName = r.oppName
              d.startAtLocal = performance.now() + r.startInMs
            }
          }).catch(() => { /* tenta de novo no próximo tick */ }).finally(() => { d.busy = false })
        }
      }
      if (d.startAtLocal !== null && performance.now() >= d.startAtLocal - 3300) {
        d.rematch = false
        this.startRace(d.seed)
        // compensa a latência do poll: o verde acende no instante combinado,
        // mesmo que este cliente tenha descoberto a largada atrasado
        const remaining = (d.startAtLocal - performance.now()) / 1000
        this.countT = clamp(3.3 - remaining, 0, 3.2)
      }
      return
    }

    if (this.state === "racing" || this.state === "countdown") {
      if (d.postT <= 0 && !d.busy) {
        d.postT = 1.1
        d.busy = true
        postState(d.code, d.role, this.myTelemetry(false))
          .then((r) => {
            if (r.opp) { d.opp = r.opp; d.oppD = r.opp.d; d.lastSeen = performance.now() }
          })
          .catch(() => { /* rede piscou */ })
          .finally(() => { d.busy = false })
      }
      // rival bateu e você já passou a marca dele: vitória na hora
      if (this.state === "racing" && d.opp?.c && this.km > d.oppD + 0.005) {
        this.duelFinish(true, "seu rival bateu antes da sua marca")
      }
      // rival sumiu da corrida
      if (d.opp && performance.now() - d.lastSeen > 20000) {
        this.duelFinish(true, "seu rival caiu da conexão")
      }
      return
    }

    if (this.state === "duelspectate") {
      if (d.postT <= 0 && !d.busy) {
        d.postT = 1.3
        d.busy = true
        postState(d.code, d.role, this.myTelemetry(true))
          .then((r) => {
            if (r.opp) { d.opp = r.opp; d.oppD = r.opp.d; d.lastSeen = performance.now() }
          })
          .catch(() => { /* segue tentando */ })
          .finally(() => { d.busy = false })
      }
      if (d.opp?.c) this.duelFinish(this.km > d.oppD)
      else if (performance.now() - d.lastSeen > 20000) this.duelFinish(true, "seu rival caiu da conexão")
    }
  }

  private duelFinish(win: boolean, msg = "") {
    const d = this.duel
    if (!d || d.result) return
    d.result = win ? "win" : "lose"
    d.msg = msg
    this.floaters = []
    this.combo = 0
    // aviso final pro rival: minha corrida acabou (senão ele espera à toa)
    void postState(d.code, d.role, this.myTelemetry(true))
      .catch(() => { /* melhor esforço */ })
    if (!d.scoreSent && this.score > 300) {
      d.scoreSent = true
      void submitScore({
        name: (this.cfg.pilotName || "PILOTO").trim(),
        score: Math.floor(this.score),
        km: Math.round(this.km * 10) / 10,
      }).then((scores) => { if (!this.destroyed && scores.length) this.scores = scores })
    }
    this.state = "duelresult"
    if (win) this.audio.levelUp(); else this.audio.bog()
  }

  private startDuelLobby() {
    this.mode = "duel"
    this.duel = null
    this.codeBuf = ""
    this.state = "duellobby"
    this.audio.ui()
  }

  private newDuelSession(code: string, seed: number, role: "host" | "guest", oppName = "", startInMs: number | null = null): DuelSession {
    return {
      code, seed, role, oppName,
      startAtLocal: startInMs === null ? null : performance.now() + startInMs,
      opp: null, oppD: 0, postT: 0, busy: false,
      lastSeen: performance.now(), iCrashed: false, scoreSent: false,
      result: null, rematch: false, msg: "",
    }
  }

  /** Minha telemetria atual (inclui o carro, pro fantasma do rival ser fiel). */
  private myTelemetry(crashed: boolean): DuelTelemetry {
    return {
      d: this.km,
      s: Math.floor(this.score),
      v: crashed ? 0 : this.speed,
      x: this.playerX,
      c: crashed,
      car: this.cfg.carIdx,
      paint: this.cfg.customs[this.cfg.carIdx].paint,
    }
  }

  /** Revanche: mesma sala, pista nova — espera o rival topar. */
  private duelRematch() {
    const d = this.duel
    if (!d) { this.startDuelLobby(); return }
    d.rematch = true
    d.startAtLocal = null
    d.postT = 0
    this.state = "duelwaiting"
    this.audio.ui()
  }

  private duelCreate() {
    const nome = this.cfg.pilotName || "PILOTO"
    this.state = "duelwaiting"
    this.duel = this.newDuelSession("....", 0, "host")
    createRoom(nome).then((r) => {
      if (this.destroyed || this.state !== "duelwaiting") return
      this.duel = this.newDuelSession(r.code, r.seed, "host")
    }).catch((e: Error) => {
      this.state = "duellobby"
      this.duel = null
      this.floaters.push({ text: e.message || "erro ao criar sala", color: "#ef4444", y: H * 0.6, life: 2, big: false })
    })
  }

  private duelJoin() {
    const code = this.codeBuf.trim().toUpperCase()
    if (code.length !== 4) {
      this.floaters.push({ text: "código tem 4 letras", color: "#ef4444", y: H * 0.68, life: 1.5, big: false })
      return
    }
    const nome = this.cfg.pilotName || "PILOTO"
    joinRoom(code, nome).then((r) => {
      if (this.destroyed) return
      this.duel = this.newDuelSession(code, r.seed, "guest", r.oppName, r.startInMs)
      this.state = "duelwaiting"
      this.audio.ui()
    }).catch((e: Error) => {
      this.floaters.push({ text: e.message || "não rolou entrar", color: "#ef4444", y: H * 0.68, life: 2, big: false })
    })
  }

  private startRace(seed?: number) {
    this.buildTrack(seed)
    this.seedTraffic(14)
    this.position = 0
    this.speed = 0
    this.playerX = 0
    this.steerVel = 0
    this.gear = 0
    this.rpm = RPM_IDLE
    this.score = 0; this.km = 0; this.combo = 0; this.comboT = 0
    this.nitroMeter = 0; this.nitroOn = false
    this.shield = false; this.mult2T = 0
    this.level = 0; this.levelUpT = 0
    this.powerups = []; this.puTimer = 6
    this.curveWarn = 0; this.collWarn = null
    this.newRecord = false; this.beamT = 0; this.beamCdT = 0; this.pitchY = 0
    this.shiftT = 0; this.wheelspinT = 0; this.bogT = 0
    this.crashed = false
    this.raining = false; this.rainRollT = 0
    this.audio.rain(false)
    this.particles = []; this.floaters = []
    this.countT = 0
    // no duelo o verde é fixo pra manter os dois relógios alinhados
    this.greenAt = this.mode === "duel" ? 3.3 : 2.4 + 0.7 + Math.random() * 0.9
    this.greenFired = false
    this.state = "countdown"
  }

  // ---------- efeitos ----------
  private emitSmoke(n: number, color: string) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: W / 2 + (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 25),
        y: H - 62 + Math.random() * 8,
        vx: (Math.random() - 0.5) * 60, vy: 30 + Math.random() * 60,
        size: 6 + Math.random() * 10, life: 0.7, maxLife: 0.7, color,
      })
    }
  }
  private emitFlame() {
    for (let i = 0; i < 2; i++) {
      this.particles.push({
        x: W / 2 + (i === 0 ? -22 : 22) + (Math.random() - 0.5) * 8,
        y: H - 58,
        vx: (Math.random() - 0.5) * 30, vy: 90 + Math.random() * 80,
        size: 5 + Math.random() * 7, life: 0.35, maxLife: 0.35,
        color: Math.random() < 0.5 ? "#fb923c" : "#fde047",
      })
    }
  }
  private initRain() {
    this.drops = []
    for (let i = 0; i < 90; i++) {
      this.drops.push({ x: Math.random() * W, y: Math.random() * H, len: 10 + Math.random() * 18, spd: 500 + Math.random() * 400 })
    }
  }
  private updateFx(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.x += p.vx * dt; p.y += p.vy * dt; p.size += 14 * dt
      p.life -= dt
      if (p.life <= 0) this.particles.splice(i, 1)
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]
      f.y -= 24 * dt; f.life -= dt
      if (f.life <= 0) this.floaters.splice(i, 1)
    }
    if (this.raining) {
      for (const d of this.drops) {
        d.y += d.spd * dt; d.x -= 60 * dt
        if (d.y > H) { d.y = -20; d.x = Math.random() * (W + 100) }
      }
    }
    if (this.shakeT > 0) this.shakeT -= dt
  }

  // ---------- clima / céu ----------
  private skyNow(): { top: string; bot: string; amb: number } {
    const t = (this.km % 10) / 10
    const keys = SKY_KEYS
    let a = keys[keys.length - 1], b = keys[0], p = 0
    for (let i = 0; i < keys.length; i++) {
      const k1 = keys[i], k2 = keys[(i + 1) % keys.length]
      const t2 = k2.t > k1.t ? k2.t : k2.t + 1
      const tt = t >= k1.t ? t : t + 1
      if (tt >= k1.t && tt <= t2) { a = k1; b = k2; p = (tt - k1.t) / (t2 - k1.t); break }
    }
    const amb = a.amb + (b.amb - a.amb) * p
    return { top: mix(a.top, b.top, p), bot: mix(a.bot, b.bot, p), amb: this.raining ? amb * 0.8 : amb }
  }

  // ---------- render ----------
  private render() {
    const ctx = this.ctx
    this.uiRegions = []
    if (this.state !== this.prevState) {
      this.prevState = this.state
      this.fadeT = 0.22
    }
    this.audio.music(this.state === "racing" || this.state === "countdown")
    const sky = this.skyNow()
    const amb = sky.amb

    ctx.save()
    if (this.shakeT > 0) ctx.translate((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10)
    // "FOV pump" no nitro — a câmera aperta levemente
    if (this.nitroOn && this.nitroMeter > 1 && this.state === "racing") {
      ctx.translate(W / 2, H / 2)
      ctx.scale(1.025, 1.025)
      ctx.translate(-W / 2, -H / 2)
    }
    // a câmera deita junto com o volante
    if (this.state === "racing" && Math.abs(this.steerVel) > 0.04) {
      ctx.translate(W / 2, H)
      ctx.rotate(-this.steerVel * 0.011)
      ctx.translate(-W / 2, -H)
    }

    // céu em três tons
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.55)
    g.addColorStop(0, sky.top)
    g.addColorStop(0.55, mix(sky.top, sky.bot, 0.55))
    g.addColorStop(1, sky.bot)
    ctx.fillStyle = g
    ctx.fillRect(-10, -10, W + 20, H * 0.6 + 10)
    if (amb < 0.6) { // estrelas
      ctx.fillStyle = `rgba(255,255,255,${(0.6 - amb) * 1.4})`
      for (let i = 0; i < 40; i++) {
        const sx = (i * 137.5) % W, sy = (i * 71.3) % (H * 0.35)
        ctx.fillRect(sx, sy, 2, 2)
      }
    }
    this.renderBackdrop(amb)

    this.renderRoad(amb, sky.bot)
    this.renderPlayer(amb)
    this.renderParticles()

    if (this.raining) {
      ctx.strokeStyle = "rgba(190,215,240,0.35)"
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (const d of this.drops) {
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(d.x - 3, d.y + d.len)
      }
      ctx.stroke()
    }
    ctx.restore()

    // vinheta — dá peso à imagem
    const vg = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.38, W / 2, H * 0.55, H * 0.95)
    vg.addColorStop(0, "rgba(0,0,0,0)")
    vg.addColorStop(1, "rgba(0,0,0,0.38)")
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, W, H)

    switch (this.state) {
      case "menu": this.renderMenu(); break
      case "garage": this.renderGarage(); break
      case "countdown": this.renderHud(); this.renderSemaphore(); break
      case "racing": this.renderHud(); break
      case "paused": this.renderHud(); this.renderPause(); break
      case "gameover": this.renderGameOver(); break
      case "nameentry": this.renderNameEntry(); break
      case "duellobby": this.renderDuelLobby(); break
      case "duelcode": this.renderDuelCode(); break
      case "duelwaiting": this.renderDuelWaiting(); break
      case "duelspectate": this.renderDuelSpectate(); break
      case "duelresult": this.renderDuelResult(); break
    }

    // floaters por cima de tudo
    const ctx2 = this.ctx
    for (const f of this.floaters) {
      ctx2.globalAlpha = clamp(f.life / 0.4, 0, 1)
      ctx2.font = `bold ${f.big ? 34 : 20}px 'Space Grotesk', 'Segoe UI', sans-serif`
      ctx2.fillStyle = f.color
      ctx2.textAlign = "center"
      ctx2.fillText(f.text, W / 2, f.y)
      ctx2.globalAlpha = 1
    }
    ctx2.textAlign = "left"

    // fade suave na troca de tela
    if (this.fadeT > 0) {
      this.fadeT -= 1 / 60
      ctx2.fillStyle = `rgba(2,6,23,${clamp(this.fadeT / 0.22, 0, 1) * 0.65})`
      ctx2.fillRect(0, 0, W, H)
    }
  }

  private renderRoad(amb: number, fogColor: string) {
    const ctx = this.ctx
    const N = this.segments.length
    const baseIdx = Math.floor(this.position / SEG_LEN) % N
    const basePct = (this.position % SEG_LEN) / SEG_LEN
    const playerZ = this.position + PLAYER_Z
    const pSeg = this.segAt(playerZ)
    const pPct = (playerZ % SEG_LEN) / SEG_LEN
    const playerY = pSeg.y1 + (pSeg.y2 - pSeg.y1) * pPct
    const camY = playerY + CAM_HEIGHT
    const camX = this.playerX * ROAD_WIDTH

    // chão base com profundidade (abaixo do horizonte)
    const gg = ctx.createLinearGradient(0, H * 0.5, 0, H)
    gg.addColorStop(0, shade("#0c6b3c", amb * 0.85))
    gg.addColorStop(1, shade("#0f8a4c", amb))
    ctx.fillStyle = gg
    ctx.fillRect(-10, H * 0.5, W + 20, H * 0.5 + 10)

    const roadL = shade("#66666d", amb), roadD = shade("#616167", amb)
    const rumbA = shade("#e0342f", amb), rumbB = shade("#f1f5f9", amb)
    const laneC = shade("#f8fafc", amb)

    let x = 0
    let dx = -(this.segments[baseIdx].curve * basePct)
    let maxY = H + 10

    interface SpriteDraw { kind: "car" | "pu" | "deco" | "ghost"; t?: Traffic; p?: Pickup; deco?: number; dir?: number; x: number; y: number; w: number }
    const sprites: SpriteDraw[] = []
    // buckets de tráfego e powerups por segmento
    const bySeg = new Map<number, Traffic[]>()
    for (const t of this.traffic) {
      const si = Math.floor(t.z / SEG_LEN) % N
      const arr = bySeg.get(si)
      if (arr) arr.push(t); else bySeg.set(si, [t])
    }
    const puBySeg = new Map<number, Pickup[]>()
    for (const p of this.powerups) {
      const si = Math.floor(p.z / SEG_LEN) % N
      const arr = puBySeg.get(si)
      if (arr) arr.push(p); else puBySeg.set(si, [p])
    }
    // bordas da pista acumuladas para o passe de brilho do asfalto
    const edgeL: number[] = []
    const edgeR: number[] = []

    // fantasma do rival no duelo (mesma pista via seed)
    let ghostIdx = -1, ghostZ = 0, ghostX = 0
    const d = this.duel
    if (this.mode === "duel" && d?.opp && (this.state === "racing" || this.state === "countdown" || this.state === "duelspectate" || this.state === "paused")) {
      ghostZ = ((d.oppD * KMH2UPS * 3600) % this.trackLen + this.trackLen) % this.trackLen
      ghostIdx = Math.floor(ghostZ / SEG_LEN) % N
      ghostX = clamp(d.opp.x, -1.2, 1.2)
    }

    for (let n = 0; n < DRAW_DIST; n++) {
      const idx = (baseIdx + n) % N
      const seg = this.segments[idx]
      const looped = idx < baseIdx
      const camZ = this.position - (looped ? this.trackLen : 0)
      const z1 = idx * SEG_LEN, z2 = z1 + SEG_LEN

      const dz1 = z1 - camZ, dz2 = z2 - camZ
      const x1 = x, x2 = x + dx
      x += dx; dx += seg.curve
      if (dz1 <= CAM_DEPTH * 10) continue

      const s1 = CAM_DEPTH / dz1 * (H / 2)
      const s2 = CAM_DEPTH / dz2 * (H / 2)
      const sx1 = W / 2 + (x1 - camX) * s1 * (W / H)
      const sy1 = H / 2 - (seg.y1 - camY) * s1 / (H / 2) * (H / 2)
      const sw1 = ROAD_WIDTH * s1 * (W / H)
      const sx2 = W / 2 + (x2 - camX) * s2 * (W / H)
      const sy2 = H / 2 - (seg.y2 - camY) * s2 / (H / 2) * (H / 2)
      const sw2 = ROAD_WIDTH * s2 * (W / H)

      if (sy2 >= maxY) {
        // segmento escondido pelo morro, mas sprites dele ainda podem aparecer? não — pula
        continue
      }

      const alt = Math.floor(idx / RUMBLE) % 2 === 0

      // grama: listras sutis por cima do gradiente de base
      ctx.fillStyle = alt ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.05)"
      ctx.fillRect(-10, sy2, W + 20, sy1 - sy2 + 1)
      // zebra
      ctx.fillStyle = alt ? rumbA : rumbB
      poly(ctx, sx1 - sw1 * 1.11, sy1, sx1 + sw1 * 1.11, sy1, sx2 + sw2 * 1.11, sy2, sx2 - sw2 * 1.11, sy2)
      // asfalto
      ctx.fillStyle = alt ? roadL : roadD
      poly(ctx, sx1 - sw1, sy1, sx1 + sw1, sy1, sx2 + sw2, sy2, sx2 - sw2, sy2)
      // linhas de faixa
      if (alt) {
        ctx.fillStyle = laneC
        for (let l = 1; l < 4; l++) {
          const lx = -1 + (2 * l) / 4
          poly(ctx,
            sx1 + sw1 * lx - sw1 * 0.012, sy1, sx1 + sw1 * lx + sw1 * 0.012, sy1,
            sx2 + sw2 * lx + sw2 * 0.012, sy2, sx2 + sw2 * lx - sw2 * 0.012, sy2)
        }
      }
      edgeL.push(sx1 - sw1 * 1.11, sy1, sx2 - sw2 * 1.11, sy2)
      edgeR.push(sx1 + sw1 * 1.11, sy1, sx2 + sw2 * 1.11, sy2)
      maxY = sy2

      // sprites deste segmento
      const carsHere = bySeg.get(idx)
      if (carsHere) {
        for (const t of carsHere) {
          const pct = (t.z - z1) / SEG_LEN
          const sx = sx1 + (sx2 - sx1) * pct
          const sy = sy1 + (sy2 - sy1) * pct
          const sw = sw1 + (sw2 - sw1) * pct
          sprites.push({ kind: "car", t, x: sx + sw * t.offset, y: sy, w: sw * KINDS[t.kind].w })
        }
      }
      if (idx === ghostIdx) {
        const pct = (ghostZ - z1) / SEG_LEN
        const sx = sx1 + (sx2 - sx1) * pct
        const sy = sy1 + (sy2 - sy1) * pct
        const sw = sw1 + (sw2 - sw1) * pct
        sprites.push({ kind: "ghost", x: sx + sw * ghostX, y: sy, w: sw })
      }
      const pusHere = puBySeg.get(idx)
      if (pusHere) {
        for (const p of pusHere) {
          const pct = (p.z - z1) / SEG_LEN
          const sx = sx1 + (sx2 - sx1) * pct
          const sy = sy1 + (sy2 - sy1) * pct
          const sw = sw1 + (sw2 - sw1) * pct
          sprites.push({ kind: "pu", p, x: sx + sw * p.offset, y: sy, w: sw * 0.10 })
        }
      }
      // decoração de beira de estrada e placas
      if (seg.sign) {
        sprites.push({ kind: "deco", deco: 3, dir: seg.sign, x: sx1 - sw1 * 1.35 * seg.sign, y: sy1, w: sw1 * 0.16 })
      } else if (idx % 4 === 0) {
        const side = idx % 8 === 0 ? -1 : 1
        sprites.push({ kind: "deco", deco: 0, x: sx1 + sw1 * side * (1.55 + ((idx * 7) % 5) * 0.14), y: sy1, w: sw1 * 0.22 })
      } else if (idx % 10 === 5) {
        sprites.push({ kind: "deco", deco: 1, x: sx1 - sw1 * 1.28, y: sy1, w: sw1 * 0.05 })
      } else if (idx % 51 === 17) {
        sprites.push({ kind: "deco", deco: 2, x: sx1 + sw1 * 1.75, y: sy1, w: sw1 * 0.55 })
      }
    }

    // farol alto: clarão pedindo passagem
    if (this.beamT > 0) {
      const a = Math.min(1, this.beamT / 0.55)
      const beam = ctx.createRadialGradient(W / 2, H * 0.62, 30, W / 2, H * 0.62, 420)
      beam.addColorStop(0, `rgba(255,250,215,${0.38 * a})`)
      beam.addColorStop(1, "rgba(255,250,215,0)")
      ctx.fillStyle = beam
      ctx.beginPath(); ctx.ellipse(W / 2, H * 0.60, 400, 215, 0, 0, Math.PI * 2); ctx.fill()
    }

    // passe de material do asfalto: sheen + espelho molhado na chuva
    if (edgeL.length >= 4) {
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(edgeL[0], edgeL[1])
      for (let i = 0; i < edgeL.length; i += 2) ctx.lineTo(edgeL[i], edgeL[i + 1])
      for (let i = edgeR.length - 2; i >= 0; i -= 2) ctx.lineTo(edgeR[i], edgeR[i + 1])
      ctx.closePath()
      ctx.clip()
      const sheen = ctx.createLinearGradient(0, H * 0.45, 0, H)
      sheen.addColorStop(0, "rgba(255,255,255,0)")
      sheen.addColorStop(1, `rgba(255,255,255,${0.05 + 0.03 * amb})`)
      ctx.fillStyle = sheen
      ctx.fillRect(0, 0, W, H)
      if (this.raining) {
        const wet = ctx.createLinearGradient(0, H * 0.45, 0, H)
        wet.addColorStop(0, "rgba(170,205,255,0.10)")
        wet.addColorStop(0.5, "rgba(170,205,255,0.03)")
        wet.addColorStop(1, "rgba(205,228,255,0.15)")
        ctx.fillStyle = wet
        ctx.fillRect(0, 0, W, H)
      }
      ctx.restore()
    }

    // farol à noite
    if (amb < 0.62 && (this.state === "racing" || this.state === "countdown" || this.state === "paused")) {
      const lg = ctx.createRadialGradient(W / 2, H * 0.72, 20, W / 2, H * 0.72, 330)
      lg.addColorStop(0, `rgba(255,240,180,${(0.62 - amb) * 0.5})`)
      lg.addColorStop(1, "rgba(255,240,180,0)")
      ctx.fillStyle = lg
      ctx.beginPath()
      ctx.ellipse(W / 2, H * 0.70, 330, 150, 0, 0, Math.PI * 2)
      ctx.fill()
    }

    // desenha do fundo pro primeiro plano
    for (let i = sprites.length - 1; i >= 0; i--) {
      const s = sprites[i]
      if (s.kind === "car") this.drawTraffic(s.t!, s.x, s.y, s.w, amb)
      else if (s.kind === "pu") this.drawPickup(s.p!, s.x, s.y, s.w, amb)
      else if (s.kind === "ghost") this.drawGhost(s.x, s.y, s.w, amb)
      else this.drawDeco(s.deco!, s.dir ?? 0, s.x, s.y, s.w, amb)
    }

    // névoa suave no horizonte — esfuma a pista e os sprites distantes
    const fr = hexToRgb(fogColor)
    const fogG = ctx.createLinearGradient(0, maxY - 34, 0, maxY + 120)
    fogG.addColorStop(0, `rgba(${fr[0]},${fr[1]},${fr[2]},0)`)
    fogG.addColorStop(0.25, `rgba(${fr[0]},${fr[1]},${fr[2]},${0.5 + 0.25 * amb})`)
    fogG.addColorStop(1, `rgba(${fr[0]},${fr[1]},${fr[2]},0)`)
    ctx.fillStyle = fogG
    ctx.fillRect(0, maxY - 34, W, 154)
  }

  private renderBackdrop(amb: number) {
    const ctx = this.ctx
    const hz = H * 0.5
    // nuvens macias em parallax
    const ca = Math.max(0.05, amb * 0.35)
    const wrapC = W + 220
    for (const cl of this.clouds) {
      const x = (((cl.x - this.bgShift * 0.05 - this.km * 160) % wrapC) + wrapC) % wrapC - 110
      const cg = ctx.createRadialGradient(x, cl.y, 4, x, cl.y, cl.s)
      cg.addColorStop(0, `rgba(255,255,255,${ca})`)
      cg.addColorStop(1, "rgba(255,255,255,0)")
      ctx.fillStyle = cg
      ctx.beginPath(); ctx.ellipse(x, cl.y, cl.s * 1.7, cl.s * 0.55, 0, 0, Math.PI * 2); ctx.fill()
    }
    // sol / lua
    if (amb > 0.62) {
      const sg = ctx.createRadialGradient(W * 0.78, hz - 105, 8, W * 0.78, hz - 105, 70)
      sg.addColorStop(0, "rgba(255,240,190,0.9)")
      sg.addColorStop(0.4, "rgba(255,220,130,0.35)")
      sg.addColorStop(1, "rgba(255,220,130,0)")
      ctx.fillStyle = sg
      ctx.beginPath(); ctx.arc(W * 0.78, hz - 105, 70, 0, Math.PI * 2); ctx.fill()
    } else {
      ctx.fillStyle = "rgba(226,232,240,0.85)"
      ctx.beginPath(); ctx.arc(W * 0.24, hz - 120, 22, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = "rgba(148,163,184,0.5)"
      ctx.beginPath(); ctx.arc(W * 0.24 - 7, hz - 126, 5, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(W * 0.24 + 6, hz - 114, 3.5, 0, Math.PI * 2); ctx.fill()
    }
    // montanhas em parallax (2 camadas)
    const ridge = (col: string, amp: number, base: number, shift: number, step: number) => {
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.moveTo(-20, base + 4)
      for (let x = -20; x <= W + 20; x += step) {
        const k = x + shift
        const yy = base - Math.abs(Math.sin(k * 0.012) * 0.6 + Math.sin(k * 0.031) * 0.4) * amp
        ctx.lineTo(x, yy)
      }
      ctx.lineTo(W + 20, base + 4)
      ctx.closePath()
      ctx.fill()
    }
    ridge(shade("#2b3c56", amb), 72, hz + 2, this.bgShift * 0.18, 16)
    ridge(shade("#1e2c40", amb), 46, hz + 3, this.bgShift * 0.42, 12)
    // skyline com janelas acesas à noite
    const wrap = W + 90
    for (let i = 0; i < 24; i++) {
      const bw = 20 + ((i * 37) % 28)
      const bh = 22 + ((i * 53) % 48)
      let bx = (((i * 67 - this.bgShift * 0.7) % wrap) + wrap) % wrap - 45
      ctx.fillStyle = shade("#131b2a", Math.max(0.35, amb))
      ctx.fillRect(bx, hz - bh + 4, bw, bh)
      if (amb < 0.6) {
        ctx.fillStyle = "rgba(253,224,71,0.45)"
        for (let wy = hz - bh + 9; wy < hz - 3; wy += 9) {
          ctx.fillRect(bx + 3 + ((i + wy) % 3) * 5, wy, 3, 4)
        }
      }
    }
  }

  private drawPickup(p: Pickup, x: number, y: number, w: number, amb: number) {
    if (w < 2.5) return
    const ctx = this.ctx
    const r = w * (1 + Math.sin(p.pulse) * 0.12)
    const c = p.type === PU_NITRO ? "#38bdf8" : p.type === PU_SHIELD ? "#60a5fa" : "#fde047"
    const cy = y - r * 1.4
    const halo = ctx.createRadialGradient(x, cy, 2, x, cy, r * 2.4)
    halo.addColorStop(0, c + "66")
    halo.addColorStop(1, c + "00")
    ctx.fillStyle = halo
    ctx.beginPath(); ctx.arc(x, cy, r * 2.4, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = shade("#0f172a", Math.max(0.6, amb))
    ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = c
    ctx.lineWidth = Math.max(1.5, r * 0.14)
    ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.stroke()
    ctx.fillStyle = c
    if (p.type === PU_NITRO) {
      ctx.beginPath()
      ctx.moveTo(x + r * 0.18, cy - r * 0.55)
      ctx.lineTo(x - r * 0.42, cy + r * 0.12)
      ctx.lineTo(x - r * 0.05, cy + r * 0.12)
      ctx.lineTo(x - r * 0.18, cy + r * 0.55)
      ctx.lineTo(x + r * 0.42, cy - r * 0.12)
      ctx.lineTo(x + r * 0.05, cy - r * 0.12)
      ctx.closePath(); ctx.fill()
    } else if (p.type === PU_SHIELD) {
      ctx.beginPath()
      ctx.moveTo(x, cy - r * 0.5)
      ctx.lineTo(x + r * 0.45, cy - r * 0.25)
      ctx.lineTo(x + r * 0.45, cy + r * 0.1)
      ctx.lineTo(x, cy + r * 0.55)
      ctx.lineTo(x - r * 0.45, cy + r * 0.1)
      ctx.lineTo(x - r * 0.45, cy - r * 0.25)
      ctx.closePath(); ctx.fill()
    } else {
      ctx.font = `bold ${Math.max(8, r * 0.9)}px 'Space Grotesk', 'Segoe UI', sans-serif`
      ctx.textAlign = "center"
      ctx.fillText("2X", x, cy + r * 0.32)
      ctx.textAlign = "left"
    }
  }

  private drawDeco(kind: number, dir: number, x: number, y: number, w: number, amb: number) {
    if (w < 1.5) return
    const ctx = this.ctx
    if (kind === 0) { // árvore
      const h = w * 2.4
      ctx.fillStyle = shade("#4a3524", amb)
      ctx.fillRect(x - w * 0.07, y - h * 0.32, w * 0.14, h * 0.32)
      ctx.fillStyle = shade("#14532d", amb)
      ctx.beginPath()
      ctx.moveTo(x, y - h); ctx.lineTo(x + w * 0.5, y - h * 0.28); ctx.lineTo(x - w * 0.5, y - h * 0.28)
      ctx.closePath(); ctx.fill()
      ctx.fillStyle = shade("#166534", amb)
      ctx.beginPath()
      ctx.moveTo(x, y - h * 0.78); ctx.lineTo(x + w * 0.38, y - h * 0.22); ctx.lineTo(x - w * 0.38, y - h * 0.22)
      ctx.closePath(); ctx.fill()
    } else if (kind === 1) { // poste
      const h = w * 11
      ctx.fillStyle = shade("#475569", amb)
      ctx.fillRect(x - w * 0.4, y - h, w * 0.8, h)
      ctx.fillRect(x - w * 0.4, y - h, w * 3.4, w * 0.8)
      if (amb < 0.62) {
        const lg = ctx.createRadialGradient(x + w * 3, y - h + w, 1, x + w * 3, y - h + w, w * 5)
        lg.addColorStop(0, "rgba(255,235,160,0.8)")
        lg.addColorStop(1, "rgba(255,235,160,0)")
        ctx.fillStyle = lg
        ctx.beginPath(); ctx.arc(x + w * 3, y - h + w, w * 5, 0, Math.PI * 2); ctx.fill()
      }
    } else if (kind === 2) { // outdoor
      const h = w * 0.55
      ctx.fillStyle = shade("#334155", amb)
      ctx.fillRect(x - w * 0.32, y - h * 1.2, w * 0.08, h * 1.2)
      ctx.fillRect(x + w * 0.24, y - h * 1.2, w * 0.08, h * 1.2)
      ctx.fillStyle = shade("#0f172a", Math.max(0.5, amb))
      ctx.fillRect(x - w / 2, y - h * 2.1, w, h)
      ctx.strokeStyle = shade("#e0342f", amb + 0.2)
      ctx.lineWidth = Math.max(1, w * 0.02)
      ctx.strokeRect(x - w / 2, y - h * 2.1, w, h)
      if (w > 34) {
        ctx.fillStyle = shade("#e0342f", amb + 0.25)
        ctx.font = `900 ${h * 0.42}px 'Space Grotesk', 'Segoe UI', sans-serif`
        ctx.textAlign = "center"
        ctx.fillText("AUTOHUB", x, y - h * 1.55)
        ctx.textAlign = "left"
      }
    } else { // chevron de curva
      const h = w * 1.1
      ctx.fillStyle = shade("#64748b", amb)
      ctx.fillRect(x - w * 0.05, y - h * 1.7, w * 0.1, h * 0.75)
      ctx.fillStyle = shade("#facc15", Math.min(1, amb + 0.3))
      rr(ctx, x - w / 2, y - h * 2.4, w, h * 0.75, w * 0.08)
      ctx.strokeStyle = shade("#0f172a", 1)
      ctx.lineWidth = Math.max(1.5, w * 0.09)
      const cy = y - h * 2.02
      for (const off of [-w * 0.22, w * 0.08]) {
        ctx.beginPath()
        ctx.moveTo(x + off - dir * w * 0.1, cy - h * 0.2)
        ctx.lineTo(x + off + dir * w * 0.12, cy)
        ctx.lineTo(x + off - dir * w * 0.1, cy + h * 0.2)
        ctx.stroke()
      }
    }
  }

  /** Carro fantasma do rival: o carro REAL dele (carroceria+pintura), translúcido. */
  private drawGhost(x: number, y: number, w: number, amb: number) {
    if (w < 24) return
    const ctx = this.ctx
    const d = this.duel
    const opp = d?.opp
    const spec = CARS[clamp(Math.floor(opp?.car ?? 0), 0, CARS.length - 1)]
    const custom: CarCustom = {
      paint: clamp(Math.floor(opp?.paint ?? 0), 0, PAINTS.length - 1),
      stripe: 0, neon: 0, wheel: 0,
      wing: spec.body === "muscle" || spec.body === "ninja" ? 1 : 2,
    }
    ctx.save()
    ctx.globalAlpha = 0.55
    drawPlayerCar(ctx, x, y, spec, custom, 0, false, amb, false, w / 640)
    ctx.restore()
    const carW = spec.width * w
    if (carW > 34 && d) {
      ctx.fillStyle = "rgba(56,189,248,0.95)"
      ctx.font = `bold ${Math.max(9, carW * 0.14)}px 'Space Grotesk', sans-serif`
      ctx.textAlign = "center"
      ctx.fillText(d.oppName || "RIVAL", x, y - carW * 0.72)
      ctx.textAlign = "left"
    }
  }

  private drawTraffic(t: Traffic, x: number, y: number, w: number, amb: number) {
    if (w < 2) return
    const ctx = this.ctx
    const k = KINDS[t.kind]
    const h = w * k.h
    const body = shade(t.color, amb * 0.95)
    const dark = shade(t.color, amb * 0.55)

    ctx.fillStyle = "rgba(0,0,0,0.35)"
    ctx.beginPath(); ctx.ellipse(x, y, w * 0.62, w * 0.10, 0, 0, Math.PI * 2); ctx.fill()

    const bx = x - w / 2, by = y - h
    ctx.fillStyle = body
    rr(ctx, bx, by, w, h * 0.96, w * 0.14)
    if (w > 9) { // verniz só em quem está perto o bastante pra valer
      const gl = ctx.createLinearGradient(0, by, 0, by + h)
      gl.addColorStop(0, "rgba(255,255,255,0.22)")
      gl.addColorStop(0.4, "rgba(255,255,255,0.03)")
      gl.addColorStop(1, "rgba(0,0,0,0.18)")
      ctx.fillStyle = gl
      rr(ctx, bx, by, w, h * 0.96, w * 0.14)
    }
    ctx.fillStyle = dark
    // vidro traseiro
    rr(ctx, bx + w * 0.14, by + h * 0.10, w * 0.72, h * 0.30, w * 0.08)
    if (t.kind === "bus") {
      ctx.fillStyle = shade("#0f172a", Math.max(0.6, amb))
      rr(ctx, bx + w * 0.10, by + h * 0.08, w * 0.80, h * 0.22, w * 0.05)
    }
    if (t.kind === "truck") {
      ctx.strokeStyle = dark
      ctx.lineWidth = Math.max(1, w * 0.02)
      ctx.strokeRect(bx + w * 0.08, by + h * 0.12, w * 0.84, h * 0.62)
      ctx.beginPath(); ctx.moveTo(x, by + h * 0.12); ctx.lineTo(x, by + h * 0.74); ctx.stroke()
    }
    if (t.kind === "moto") {
      ctx.fillStyle = shade("#111827", Math.max(0.5, amb))
      ctx.beginPath(); ctx.arc(x, by + h * 0.28, w * 0.34, 0, Math.PI * 2); ctx.fill() // capacete
    }
    // lanternas
    const tail = amb < 0.62 ? "#ff3b30" : shade("#c81e1e", amb + 0.25)
    ctx.fillStyle = tail
    const th = Math.max(2, h * 0.07)
    rr(ctx, bx + w * 0.06, y - th * 2.2, w * 0.22, th, th / 2)
    rr(ctx, bx + w * 0.72, y - th * 2.2, w * 0.22, th, th / 2)
    if (amb < 0.62) {
      ctx.fillStyle = "rgba(255,60,48,0.25)"
      ctx.beginPath(); ctx.ellipse(x, y - th * 1.6, w * 0.55, th * 2, 0, 0, Math.PI * 2); ctx.fill()
      // light trails: lanternas riscando a noite quando você fecha rápido
      const rel = Math.max(0, this.speed - t.speed)
      const len = Math.min(w * 1.6, rel * w * 0.012)
      if (len > 3 && w > 6) {
        const trail = ctx.createLinearGradient(0, y - th * 2.2, 0, y - th * 2.2 + len)
        trail.addColorStop(0, "rgba(255,60,48,0.32)")
        trail.addColorStop(1, "rgba(255,60,48,0)")
        ctx.fillStyle = trail
        ctx.fillRect(bx + w * 0.06, y - th * 2.2, w * 0.22, len)
        ctx.fillRect(bx + w * 0.72, y - th * 2.2, w * 0.22, len)
      }
    }
    // seta
    if (t.blinkT > 0 && Math.floor(t.blinkT * 6) % 2 === 0) {
      ctx.fillStyle = "#fb923c"
      const side = t.targetOffset > t.offset ? 1 : -1
      ctx.beginPath(); ctx.arc(x + side * w * 0.52, y - h * 0.28, Math.max(2, w * 0.06), 0, Math.PI * 2); ctx.fill()
    }
    // alerta de colisão: triângulo vermelho piscando em cima do veículo
    if (t === this.collWarn && Math.floor(performance.now() / 170) % 2 === 0) {
      const ty = y - h - Math.max(10, w * 0.4)
      const s = Math.max(7, w * 0.22)
      ctx.fillStyle = "#ef4444"
      ctx.beginPath()
      ctx.moveTo(x, ty - s); ctx.lineTo(x + s * 0.9, ty + s * 0.6); ctx.lineTo(x - s * 0.9, ty + s * 0.6)
      ctx.closePath(); ctx.fill()
      ctx.fillStyle = "#fff"
      ctx.font = `bold ${s * 1.1}px 'Space Grotesk', 'Segoe UI', sans-serif`
      ctx.textAlign = "center"
      ctx.fillText("!", x, ty + s * 0.45)
      ctx.textAlign = "left"
    }
  }

  private renderPlayer(amb: number) {
    if (this.state === "menu" || this.state === "garage") return
    const ctx = this.ctx
    const spec = CARS[this.cfg.carIdx]
    const custom = this.cfg.customs[this.cfg.carIdx]
    const steer = clamp(this.steerVel * 1.1, -1, 1)
    const braking = this.mouseBrake || this.keys.has("s") || this.keys.has("arrowdown")
    const bounce = Math.sin(this.position * 0.03) * Math.min(3, this.speed / 60) + this.pitchY
    if (this.shield) {
      const pw = spec.width * 640
      ctx.fillStyle = "rgba(96,165,250,0.14)"
      ctx.strokeStyle = "rgba(96,165,250,0.65)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(W / 2, H - 68 + bounce, pw * 0.75, 62, 0, 0, Math.PI * 2)
      ctx.fill(); ctx.stroke()
    }
    drawPlayerCar(ctx, W / 2, H - 34 + bounce, spec, custom, steer, braking, amb, this.nitroOn && this.nitroMeter > 1)

    // sensação de velocidade: streaks translúcidos varrendo as bordas
    if (this.speed > 165 && this.state === "racing") {
      const inten = Math.min(1, (this.speed - 165) / 90)
      ctx.strokeStyle = `rgba(220,235,255,${0.08 + inten * 0.16})`
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i < 9; i++) {
        const side = i % 2 === 0 ? 1 : -1
        const x = W / 2 + side * (W * 0.30 + Math.random() * W * 0.18)
        const y = Math.random() * H
        const len = 40 + Math.random() * 100 * inten
        ctx.moveTo(x, y)
        ctx.lineTo(x + side * 6, y + len)
      }
      ctx.stroke()
    }
  }

  private renderParticles() {
    const ctx = this.ctx
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1) * 0.8
      ctx.fillStyle = p.color
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // ---------- HUD ----------
  private glass(x: number, y: number, w: number, h: number, r = 14) {
    const ctx = this.ctx
    ctx.fillStyle = "rgba(8,13,26,0.55)"
    rr(ctx, x, y, w, h, r)
    const hl = ctx.createLinearGradient(0, y, 0, y + h * 0.55)
    hl.addColorStop(0, "rgba(255,255,255,0.10)")
    hl.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = hl
    rr(ctx, x, y, w, h * 0.55, r)
    ctx.strokeStyle = "rgba(255,255,255,0.14)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, r)
    ctx.stroke()
  }

  private isHover(x: number, y: number, w: number, h: number) {
    return this.mousePx.x >= x && this.mousePx.x <= x + w && this.mousePx.y >= y && this.mousePx.y <= y + h
  }

  /** Botão pill clicável (mouse) com hover; o atalho de teclado continua valendo. */
  private pill(label: string, x: number, y: number, w: number, act: () => void, opts: { primary?: boolean; h?: number; font?: number } = {}) {
    const ctx = this.ctx
    const h = opts.h ?? 28
    const hov = this.isHover(x, y, w, h)
    ctx.fillStyle = opts.primary
      ? (hov ? "#fde047" : "#facc15")
      : (hov ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.10)")
    rr(ctx, x, y, w, h, h / 2)
    ctx.strokeStyle = hov ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.18)"
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, h / 2); ctx.stroke()
    ctx.fillStyle = opts.primary ? "#1c1917" : "#f8fafc"
    ctx.font = `bold ${opts.font ?? 13}px 'Space Grotesk', 'Segoe UI', sans-serif`
    ctx.textAlign = "center"
    ctx.fillText(label, x + w / 2, y + h / 2 + (opts.font ?? 13) * 0.36)
    ctx.textAlign = "left"
    this.uiRegions.push({ x, y, w, h, act })
  }

  /** Seta clicável de navegação (◀ / ▶). */
  private arrowBtn(x: number, y: number, dir: -1 | 1, act: () => void) {
    const ctx = this.ctx
    const s = 46
    const hov = this.isHover(x, y, s, s)
    ctx.fillStyle = hov ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.10)"
    rr(ctx, x, y, s, s, 12)
    ctx.fillStyle = "#f8fafc"
    ctx.font = "bold 22px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(dir < 0 ? "◀" : "▶", x + s / 2, y + s / 2 + 8)
    ctx.textAlign = "left"
    this.uiRegions.push({ x, y, w: s, h: s, act })
  }

  private renderHud() {
    const ctx = this.ctx
    // placar
    this.glass(14, 12, 210, 62)
    ctx.fillStyle = "#f8fafc"
    ctx.font = "bold 24px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText(`${Math.floor(this.score).toLocaleString("pt-BR")}`, 28, 40)
    ctx.font = "13px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillStyle = "rgba(248,250,252,0.65)"
    const best = this.scores[0]
    ctx.fillText(`recorde ${best ? best.score.toLocaleString("pt-BR") : 0}  ·  ${this.km.toFixed(1)} km`, 28, 62)

    // combo
    if (this.combo > 0) {
      ctx.fillStyle = "#fde047"
      ctx.font = "bold 26px 'Space Grotesk', 'Segoe UI', sans-serif"
      ctx.fillText(`x${1 + this.combo}`, 240, 42)
      ctx.fillStyle = "rgba(253,224,71,0.35)"
      ctx.fillRect(240, 50, 52, 5)
      ctx.fillStyle = "#fde047"
      ctx.fillRect(240, 50, 52 * clamp(this.comboT / 4, 0, 1), 5)
    }

    // clima/hora + badges
    const sky = this.skyNow()
    ctx.textAlign = "right"
    ctx.font = "20px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText(this.raining ? "🌧" : sky.amb < 0.6 ? "🌙" : "☀️", W - 20, 34)
    ctx.font = "bold 13px 'Space Grotesk', 'Segoe UI', sans-serif"
    let by = 58
    ctx.fillStyle = "rgba(248,250,252,0.6)"
    ctx.fillText(`NÍVEL ${this.level + 1}`, W - 20, by); by += 20
    if (this.shield) { ctx.fillStyle = "#60a5fa"; ctx.fillText("● ESCUDO", W - 20, by); by += 20 }
    if (this.mult2T > 0) { ctx.fillStyle = "#fde047"; ctx.fillText(`● 2X ${Math.ceil(this.mult2T)}s`, W - 20, by); by += 20 }
    ctx.textAlign = "left"

    // aviso de curva fechada
    if (this.curveWarn !== 0 && this.speed > 120 && this.state !== "paused") {
      const urgent = this.curveWarnDist < 55
      if (!urgent || Math.floor(performance.now() / 180) % 2 === 0) {
        ctx.textAlign = "center"
        ctx.fillStyle = urgent ? "#ef4444" : "#facc15"
        ctx.font = "bold 24px 'Space Grotesk', 'Segoe UI', sans-serif"
        const arrows = this.curveWarn > 0 ? "▶▶" : "◀◀"
        ctx.fillText(`${arrows}  CURVA ${this.curveWarn > 0 ? "À DIREITA" : "À ESQUERDA"}  ${arrows}`, W / 2, 92)
        ctx.textAlign = "left"
      }
    }

    this.renderTacho()

    // nitro
    const nx = 22, ny = H - 160, nh = 120
    this.glass(nx - 6, ny - 8, 34, nh + 34, 10)
    ctx.fillStyle = "rgba(148,163,184,0.3)"
    rr(ctx, nx, ny, 22, nh, 8)
    const nfill = nh * this.nitroMeter / 100
    ctx.fillStyle = this.nitroOn && this.nitroMeter > 1 ? "#fb923c" : "#38bdf8"
    if (nfill > 2) rr(ctx, nx, ny + nh - nfill, 22, nfill, 8)
    ctx.fillStyle = "#f8fafc"
    ctx.font = "bold 11px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText("NOS", nx + 1, ny + nh + 18)

    if (this.mode === "duel" && this.duel) this.renderDuelBar()
    this.renderMinimap()
  }

  /** Minimapa estilo GPS: você fixo embaixo, o traçado à frente sobe reto — sem girar. */
  private renderMinimap() {
    const ctx = this.ctx
    const bx = W - 122, byy = H - 296, bw = 104, bh = 88
    this.glass(bx, byy, bw, bh, 10)
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(bx + 3, byy + 3, bw - 6, bh - 6, 8)
    ctx.clip()

    const N = this.segments.length
    const start = Math.floor((this.position + PLAYER_Z) / SEG_LEN)
    const ox = bx + bw / 2, oy = byy + bh - 14
    let hx = 0, hy = 0, heading = 0
    ctx.strokeStyle = "rgba(248,250,252,0.75)"
    ctx.lineWidth = 4
    ctx.lineJoin = "round"
    ctx.lineCap = "round"
    ctx.beginPath()
    ctx.moveTo(ox, oy)
    for (let n = 0; n < 160; n += 2) {
      const s = this.segments[(start + n) % N]
      heading += s.curve * 0.03 * 2
      hx += Math.sin(heading) * 1.0
      hy -= Math.cos(heading) * 1.0
      ctx.lineTo(ox + hx, oy + hy)
    }
    ctx.stroke()
    ctx.lineWidth = 1
    // você (seta fixa apontando pra frente)
    ctx.fillStyle = "#38bdf8"
    ctx.beginPath()
    ctx.moveTo(ox, oy - 7)
    ctx.lineTo(ox + 5, oy + 4)
    ctx.lineTo(ox - 5, oy + 4)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  /** Barra do duelo: você × rival, com delta em metros ao vivo. */
  private renderDuelBar() {
    const ctx = this.ctx
    const d = this.duel!
    const bw = 380, bx = W / 2 - bw / 2, byy = this.state === "countdown" ? 128 : 10
    this.glass(bx, byy, bw, 46, 12)
    const myName = (this.cfg.pilotName || "VOCÊ").slice(0, 10)
    const oppName = (d.oppName || "RIVAL").slice(0, 10)
    const deltaM = Math.round((this.km - d.oppD) * 1000)
    ctx.font = "bold 13px 'Space Grotesk', sans-serif"
    ctx.fillStyle = "#38bdf8"
    ctx.fillText(myName, bx + 14, byy + 19)
    ctx.font = "11px 'Space Grotesk', sans-serif"
    ctx.fillStyle = "rgba(248,250,252,0.8)"
    ctx.fillText(`${this.km.toFixed(2)} km`, bx + 14, byy + 36)
    ctx.textAlign = "right"
    ctx.font = "bold 13px 'Space Grotesk', sans-serif"
    ctx.fillStyle = d.opp?.c ? "rgba(239,68,68,0.9)" : "#f472b6"
    ctx.fillText(d.opp?.c ? `${oppName} 💥` : oppName, bx + bw - 14, byy + 19)
    ctx.font = "11px 'Space Grotesk', sans-serif"
    ctx.fillStyle = "rgba(248,250,252,0.8)"
    ctx.fillText(d.opp ? `${d.oppD.toFixed(2)} km` : "conectando...", bx + bw - 14, byy + 36)
    ctx.textAlign = "center"
    ctx.font = "bold 15px 'Space Grotesk', sans-serif"
    ctx.fillStyle = deltaM >= 0 ? "#4ade80" : "#ef4444"
    ctx.fillText(deltaM >= 0 ? `+${deltaM}m` : `${deltaM}m`, bx + bw / 2, byy + 29)
    ctx.textAlign = "left"
  }

  private renderTacho() {
    const ctx = this.ctx
    const cx = W - 108, cy = H - 92, r = 74
    const bg = ctx.createRadialGradient(cx, cy - 26, 8, cx, cy, r + 16)
    bg.addColorStop(0, "rgba(38,50,72,0.9)")
    bg.addColorStop(1, "rgba(4,8,20,0.9)")
    ctx.fillStyle = bg
    ctx.beginPath(); ctx.arc(cx, cy, r + 14, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = "rgba(255,255,255,0.16)"
    ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.arc(cx, cy, r + 13.5, 0, Math.PI * 2); ctx.stroke()

    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25
    // arco de giro preenchido até o RPM atual
    const redStart = a0 + (a1 - a0) * (RPM_REDLINE / 8000)
    ctx.strokeStyle = "rgba(148,163,184,0.35)"
    ctx.lineWidth = 7
    ctx.beginPath(); ctx.arc(cx, cy, r, a0, redStart); ctx.stroke()
    ctx.strokeStyle = "rgba(239,68,68,0.6)"
    ctx.beginPath(); ctx.arc(cx, cy, r, redStart, a1); ctx.stroke()
    const jitter = this.rpm >= RPM_REDLINE - 150 ? (Math.random() - 0.5) * 0.03 : 0
    const rpmA = a0 + (a1 - a0) * clamp(this.rpm / 8000 + jitter, 0, 1)
    ctx.strokeStyle = this.rpm > RPM_REDLINE ? "#ef4444" : this.rpm > 6200 ? "#fb923c" : "#38bdf8"
    ctx.shadowColor = ctx.strokeStyle as string
    ctx.shadowBlur = 10
    ctx.beginPath(); ctx.arc(cx, cy, r, a0, rpmA); ctx.stroke()
    ctx.shadowBlur = 0
    // ticks
    ctx.fillStyle = "rgba(248,250,252,0.7)"
    ctx.font = "10px 'Space Grotesk', 'Segoe UI', sans-serif"
    for (let i = 0; i <= 8; i++) {
      const a = a0 + (a1 - a0) * (i / 8)
      const tx = cx + Math.cos(a) * (r - 16), ty = cy + Math.sin(a) * (r - 16)
      ctx.textAlign = "center"
      ctx.fillText(String(i), tx, ty + 3)
    }
    // agulha (com tremida na limitadora)
    const na = rpmA
    ctx.strokeStyle = this.rpm > RPM_REDLINE ? "#ef4444" : "#f8fafc"
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(cx - Math.cos(na) * 10, cy - Math.sin(na) * 10)
    ctx.lineTo(cx + Math.cos(na) * (r - 8), cy + Math.sin(na) * (r - 8))
    ctx.stroke()
    ctx.fillStyle = "#0f172a"
    ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill()
    // marcha
    ctx.fillStyle = this.shiftT > 0 ? "#fde047" : "#f8fafc"
    ctx.font = "bold 28px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(this.gear === 0 ? "N" : String(this.gear), cx, cy + 10)
    // velocidade
    ctx.fillStyle = "#f8fafc"
    ctx.font = "italic 900 23px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText(String(Math.round(this.speed)), cx, cy + r - 8)
    ctx.font = "10px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillStyle = "rgba(248,250,252,0.6)"
    ctx.fillText("km/h", cx, cy + r + 6)
    ctx.textAlign = "left"
    // modo de câmbio
    ctx.fillStyle = "rgba(248,250,252,0.5)"
    ctx.font = "bold 10px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText(this.cfg.transmission === "auto" ? "AUTO" : "SEQ", cx - 16, cy - r - 20)

    if (this.goFlashT > 0) {
      ctx.globalAlpha = clamp(this.goFlashT, 0, 1)
      ctx.fillStyle = "#4ade80"
      ctx.font = "900 54px 'Space Grotesk', 'Segoe UI', sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("GO!", W / 2, H * 0.3)
      ctx.textAlign = "left"
      ctx.globalAlpha = 1
    }
  }

  private renderSemaphore() {
    const ctx = this.ctx
    const cx = W / 2, top = 46
    ctx.strokeStyle = "#1e293b"
    ctx.lineWidth = 6
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, top); ctx.stroke()
    ctx.fillStyle = "#0f172a"
    rr(ctx, cx - 78, top, 156, 54, 12)
    const lit = this.greenFired ? 4 : this.countT >= 2.4 ? 3 : this.countT >= 1.6 ? 2 : this.countT >= 0.8 ? 1 : 0
    for (let i = 0; i < 3; i++) {
      const on = !this.greenFired && lit > i
      ctx.fillStyle = on ? "#ef4444" : "rgba(120,40,40,0.4)"
      ctx.beginPath(); ctx.arc(cx - 44 + i * 44, top + 27, 16, 0, Math.PI * 2); ctx.fill()
      if (on) { ctx.fillStyle = "rgba(239,68,68,0.3)"; ctx.beginPath(); ctx.arc(cx - 44 + i * 44, top + 27, 24, 0, Math.PI * 2); ctx.fill() }
    }
    if (this.greenFired) {
      ctx.fillStyle = "#4ade80"
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx - 44 + i * 44, top + 27, 16, 0, Math.PI * 2); ctx.fill() }
      ctx.font = "bold 30px 'Space Grotesk', 'Segoe UI', sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("GO!", cx, top + 100)
      ctx.textAlign = "left"
    } else if (this.countT > 0.5) {
      ctx.fillStyle = "rgba(248,250,252,0.85)"
      ctx.font = "bold 15px 'Space Grotesk', 'Segoe UI', sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("segura o giro na faixa verde e solta no verde!", cx, top + 82)
      const zx = cx - 90
      ctx.fillStyle = "rgba(148,163,184,0.3)"; rr(ctx, zx, top + 94, 180, 10, 5)
      ctx.fillStyle = "rgba(74,222,128,0.55)"
      rr(ctx, zx + 180 * (3600 / 8000), top + 94, 180 * ((6300 - 3600) / 8000), 10, 5)
      ctx.fillStyle = "#f8fafc"
      const rx = zx + 180 * clamp(this.rpm / 8000, 0, 1)
      ctx.fillRect(rx - 2, top + 90, 4, 18)
      ctx.textAlign = "left"
    }
  }

  // ---------- telas ----------
  private dim(alpha = 0.55) {
    this.ctx.fillStyle = `rgba(2,6,23,${alpha})`
    this.ctx.fillRect(0, 0, W, H)
  }

  private renderMenu() {
    const ctx = this.ctx
    this.dim(0.45)
    ctx.textAlign = "center"
    const tg = ctx.createLinearGradient(0, 118, 0, 185)
    tg.addColorStop(0, "#ff7a45")
    tg.addColorStop(0.55, "#e0342f")
    tg.addColorStop(1, "#9f1d1a")
    ctx.shadowColor = "rgba(224,52,47,0.6)"
    ctx.shadowBlur = 34
    ctx.fillStyle = tg
    ctx.font = "italic 900 78px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText("AUTODASH", W / 2, 180)
    ctx.shadowBlur = 0
    ctx.fillStyle = "rgba(255,255,255,0.25)"
    ctx.font = "italic 900 78px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.save()
    ctx.scale(1, -0.28)
    ctx.globalAlpha = 0.18
    ctx.fillText("AUTODASH", W / 2, -680) // reflexo espelhado sob o título
    ctx.restore()
    ctx.globalAlpha = 1
    ctx.fillStyle = "rgba(248,250,252,0.85)"
    ctx.font = "18px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText("costure o trânsito · respeite o câmbio · sobreviva", W / 2, 214)
    ctx.textAlign = "left"
    this.pill("BORA CORRER  [ENTER]", W / 2 - 150, 286, 300, () => this.enterFromMenu("garage"), { primary: true, h: 46, font: 18 })
    this.pill("⚔ DUELO ONLINE  [D]", W / 2 - 150, 342, 300, () => this.enterFromMenu("duellobby"), { h: 38, font: 15 })
    ctx.textAlign = "center"
    ctx.fillStyle = "rgba(248,250,252,0.6)"
    ctx.font = "14px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText("🖱 esq acelera · dir freia · scroll troca marcha · botão do meio = neutro", W / 2, 440)
    ctx.fillText("⌨ A/D ou ←→ dirigem · W/S gás/freio · Q/E marchas · ESPAÇO nitro · F farol alto", W / 2, 464)
    if (this.cfg.pilotName) {
      ctx.fillStyle = "rgba(148,197,255,0.85)"
      ctx.fillText(`fala, ${this.cfg.pilotName}! bora?`, W / 2, 496)
    }
    const best = this.scores[0]
    if (best) {
      ctx.fillStyle = "rgba(253,224,71,0.9)"
      ctx.fillText(`recorde: ${best.score.toLocaleString("pt-BR")} — ${best.name}`, W / 2, this.cfg.pilotName ? 520 : 500)
    }
    ctx.textAlign = "left"
  }

  private renderGarage() {
    const ctx = this.ctx
    this.dim(0.72)
    const spec = CARS[this.cfg.carIdx]
    const custom = this.cfg.customs[this.cfg.carIdx]
    const save = () => saveConfig(this.cfg)

    ctx.textAlign = "center"
    ctx.fillStyle = "#f8fafc"
    ctx.font = "bold 30px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText("GARAGEM", W / 2, 44)
    ctx.fillStyle = "rgba(248,250,252,0.55)"
    ctx.font = "14px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText(`${this.cfg.carIdx + 1} / ${CARS.length}`, 240, 78)
    ctx.textAlign = "left"

    this.pill("← menu", 16, 16, 92, () => { this.state = "menu" }, { h: 26, font: 12 })
    this.arrowBtn(38, 206, -1, () => { this.cfg.carIdx = (this.cfg.carIdx + CARS.length - 1) % CARS.length; save(); this.audio.ui() })
    this.arrowBtn(396, 206, 1, () => { this.cfg.carIdx = (this.cfg.carIdx + 1) % CARS.length; save(); this.audio.ui() })

    // plataforma + carro
    const px = 240, py = 316
    const pg = ctx.createRadialGradient(px, py, 10, px, py, 150)
    const neon = NEONS[custom.neon]
    pg.addColorStop(0, custom.neon > 0 ? neon + "55" : "rgba(148,163,184,0.25)")
    pg.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = pg
    ctx.beginPath(); ctx.ellipse(px, py, 160, 46, 0, 0, Math.PI * 2); ctx.fill()
    drawPlayerCar(ctx, px, py + 10, spec, custom, 0, false, 0.9, false, 1.5)

    ctx.textAlign = "center"
    ctx.fillStyle = PAINTS[custom.paint]
    ctx.font = "bold 25px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText(spec.name, px, 392)
    ctx.fillStyle = "rgba(248,250,252,0.7)"
    ctx.font = "italic 13px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText(spec.desc, px, 414)
    ctx.textAlign = "left"

    this.pill(`piloto: ${this.cfg.pilotName || "?"} · trocar [N]`, 120, 430, 240, () => {
      this.nameBuf = this.cfg.pilotName
      this.afterName = "garage"
      this.state = "nameentry"
      this.audio.ui()
    })
    this.pill("ACELERAR!  [ENTER]", 120, 470, 240, () => { save(); this.startRace() }, { primary: true, h: 42, font: 17 })

    // painel de specs e customização
    this.glass(486, 66, 456, 460, 18)
    const sx = 510
    const stat = (label: string, frac: number, x: number, y: number, invert = false) => {
      ctx.fillStyle = "rgba(248,250,252,0.75)"
      ctx.font = "11px 'Space Grotesk', 'Segoe UI', sans-serif"
      ctx.fillText(label, x, y - 4)
      ctx.fillStyle = "rgba(148,163,184,0.25)"
      rr(ctx, x, y, 190, 9, 5)
      ctx.fillStyle = invert ? "#fb923c" : "#4ade80"
      rr(ctx, x, y, 190 * clamp(frac, 0.05, 1), 9, 5)
    }
    stat("POTÊNCIA", spec.power / 58, sx, 102)
    stat("ADERÊNCIA (curvas)", spec.grip / 0.9, sx + 226, 102)
    stat("VELOCIDADE FINAL", spec.topSpeed / 248, sx, 140)
    stat("LARGURA (atrapalha no corredor)", spec.width / 0.31, sx + 226, 140, true)

    // pintura e rodas — chips clicáveis
    ctx.fillStyle = "rgba(248,250,252,0.75)"
    ctx.font = "bold 11px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText("PINTURA [C]", sx, 176)
    for (let i = 0; i < PAINTS.length; i++) {
      const cxp = sx + 10 + i * 26, cyp = 196
      ctx.fillStyle = PAINTS[i]
      ctx.beginPath(); ctx.arc(cxp, cyp, 9, 0, Math.PI * 2); ctx.fill()
      if (i === custom.paint) {
        ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(cxp, cyp, 12, 0, Math.PI * 2); ctx.stroke()
      }
      this.uiRegions.push({ x: cxp - 12, y: cyp - 12, w: 24, h: 24, act: () => { custom.paint = i; save(); this.audio.ui() } })
    }
    ctx.fillStyle = "rgba(248,250,252,0.75)"
    ctx.fillText("RODAS [R]", sx + 300, 176)
    for (let i = 0; i < WHEELS.length; i++) {
      const cxp = sx + 310 + i * 26, cyp = 196
      ctx.fillStyle = "#0a0a0c"
      ctx.beginPath(); ctx.arc(cxp, cyp, 9, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = WHEELS[i]
      ctx.beginPath(); ctx.arc(cxp, cyp, 5, 0, Math.PI * 2); ctx.fill()
      if (i === custom.wheel) {
        ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(cxp, cyp, 12, 0, Math.PI * 2); ctx.stroke()
      }
      this.uiRegions.push({ x: cxp - 12, y: cyp - 12, w: 24, h: 24, act: () => { custom.wheel = i; save(); this.audio.ui() } })
    }

    // pills de opções
    this.pill(`faixa: ${STRIPES[custom.stripe]} [V]`, sx, 222, 200, () => { custom.stripe = (custom.stripe + 1) % STRIPES.length; save(); this.audio.ui() })
    this.pill(`aerofólio: ${WINGS[custom.wing]} [G]`, sx + 216, 222, 200, () => { custom.wing = (custom.wing + 1) % WINGS.length; save(); this.audio.ui() })
    this.pill(`neon: ${NEON_NAMES[custom.neon]} [B]`, sx, 258, 200, () => { custom.neon = (custom.neon + 1) % NEONS.length; save(); this.audio.ui() })
    this.pill(`direção: ${this.cfg.steering === "mouse" ? "mouse" : "teclado"} [Y]`, sx + 216, 258, 200, () => { this.cfg.steering = this.cfg.steering === "mouse" ? "keyboard" : "mouse"; save(); this.audio.ui() })
    this.pill(`câmbio: ${this.cfg.transmission === "auto" ? "automático" : "sequencial (scroll)"} [T]`, sx, 294, 416, () => { this.cfg.transmission = this.cfg.transmission === "auto" ? "manual" : "auto"; save(); this.audio.ui() })

    // leaderboard global
    ctx.fillStyle = "rgba(253,224,71,0.9)"
    ctx.font = "bold 12px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText("🌐 TOP 10 GLOBAL", sx, 348)
    ctx.font = "11px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillStyle = "rgba(248,250,252,0.7)"
    if (this.scores.length === 0) ctx.fillText("— ainda sem recordes, seja o primeiro —", sx, 368)
    this.scores.slice(0, 10).forEach((s, i) => {
      ctx.fillStyle = s.name === this.cfg.pilotName ? "rgba(253,224,71,0.95)" : "rgba(248,250,252,0.7)"
      ctx.fillText(`${i + 1}. ${s.name || "???"} — ${s.score.toLocaleString("pt-BR")} (${s.km} km)`, sx, 368 + i * 15)
    })
  }

  private renderPause() {
    const ctx = this.ctx
    this.dim()
    ctx.textAlign = "center"
    ctx.fillStyle = "#f8fafc"
    ctx.font = "bold 46px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText("PAUSADO", W / 2, H / 2 - 60)
    ctx.textAlign = "left"
    this.pill("CONTINUAR  [ESC]", W / 2 - 115, H / 2 - 20, 230, () => { this.state = "racing" }, { primary: true, h: 38, font: 15 })
    this.pill("RECOMEÇAR  [R]", W / 2 - 115, H / 2 + 28, 230, () => this.startRace(), { h: 32 })
    this.pill("MENU  [M]", W / 2 - 115, H / 2 + 68, 230, () => { this.state = "menu" }, { h: 32 })
  }

  private renderGameOver() {
    const ctx = this.ctx
    this.dim(0.6)
    ctx.textAlign = "center"
    ctx.fillStyle = "#ef4444"
    ctx.font = "900 56px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText("BATEU!", W / 2, 150)
    ctx.fillStyle = "#f8fafc"
    ctx.font = "bold 30px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText(`${Math.floor(this.score).toLocaleString("pt-BR")} pontos`, W / 2, 210)
    ctx.font = "16px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillStyle = "rgba(248,250,252,0.7)"
    ctx.fillText(`${this.km.toFixed(1)} km percorridos, ${this.cfg.pilotName || "PILOTO"}`, W / 2, 240)
    if (this.newRecord) {
      ctx.fillStyle = "#fde047"
      ctx.font = "900 24px 'Space Grotesk', 'Segoe UI', sans-serif"
      ctx.fillText("★ NOVO RECORDE! ★", W / 2, 272)
    }

    ctx.fillStyle = "rgba(253,224,71,0.9)"
    ctx.font = "bold 15px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText("— 🌐 TOP 10 GLOBAL —", W / 2, 300)
    ctx.font = "13px 'Space Grotesk', 'Segoe UI', sans-serif"
    this.scores.slice(0, 10).forEach((s, i) => {
      ctx.fillStyle = s.name === this.cfg.pilotName ? "rgba(253,224,71,0.95)" : "rgba(248,250,252,0.8)"
      ctx.fillText(`${i + 1}. ${s.name || "???"} — ${s.score.toLocaleString("pt-BR")} (${s.km} km)`, W / 2, 322 + i * 16)
    })
    ctx.textAlign = "left"

    this.pill("CORRER DE NOVO  [ENTER]", W / 2 - 250, 490, 250, () => this.startRace(), { primary: true, h: 36, font: 14 })
    this.pill("GARAGEM  [G]", W / 2 + 16, 490, 130, () => { this.state = "garage" }, { h: 36 })
    this.pill("MENU  [M]", W / 2 + 160, 490, 100, () => { this.state = "menu" }, { h: 36 })
  }

  private renderNameEntry() {
    const ctx = this.ctx
    this.dim(0.7)
    this.glass(W / 2 - 230, 140, 460, 270, 20)
    ctx.textAlign = "center"
    ctx.fillStyle = "#fde047"
    ctx.font = "900 38px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText("QUEM TÁ PILOTANDO?", W / 2, 200)
    ctx.font = "14px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillStyle = "rgba(248,250,252,0.7)"
    ctx.fillText("seu nome fica salvo neste navegador e assina seus recordes", W / 2, 232)
    const cursor = Math.floor(performance.now() / 400) % 2 === 0 ? "▌" : " "
    ctx.fillStyle = "#f8fafc"
    ctx.font = "bold 36px 'Consolas', monospace"
    ctx.fillText((this.nameBuf || "") + cursor, W / 2, 305)
    ctx.fillStyle = "rgba(255,255,255,0.25)"
    ctx.fillRect(W / 2 - 150, 320, 300, 2)
    ctx.textAlign = "left"
    this.pill("CONFIRMAR  [ENTER]", W / 2 - 115, 352, 230, () => this.confirmName(), { primary: true, h: 36, font: 14 })
  }

  // ---------- telas do duelo ----------
  private toMenu() {
    this.mode = "solo"
    this.duel = null
    this.floaters = []
    this.state = "menu"
  }

  private renderDuelLobby() {
    const ctx = this.ctx
    this.dim(0.62)
    ctx.textAlign = "center"
    ctx.fillStyle = "#38bdf8"
    ctx.font = "900 44px 'Space Grotesk', sans-serif"
    ctx.fillText("DUELO ONLINE", W / 2, 150)
    ctx.fillStyle = "rgba(248,250,252,0.75)"
    ctx.font = "15px 'Space Grotesk', sans-serif"
    ctx.fillText("dois pilotos, mesma pista, largada junta.", W / 2, 186)
    ctx.fillText("quem for mais longe sem bater, leva.", W / 2, 208)
    ctx.textAlign = "left"
    this.pill("CRIAR SALA", W / 2 - 150, 260, 300, () => this.duelCreate(), { primary: true, h: 44, font: 17 })
    this.pill("TENHO UM CÓDIGO", W / 2 - 150, 316, 300, () => { this.codeBuf = ""; this.state = "duelcode"; this.audio.ui() }, { h: 38, font: 15 })
    this.pill("← voltar  [ESC]", W / 2 - 150, 368, 300, () => this.toMenu(), { h: 30 })
  }

  private renderDuelCode() {
    const ctx = this.ctx
    this.dim(0.7)
    this.glass(W / 2 - 210, 150, 420, 250, 20)
    ctx.textAlign = "center"
    ctx.fillStyle = "#38bdf8"
    ctx.font = "900 30px 'Space Grotesk', sans-serif"
    ctx.fillText("CÓDIGO DA SALA", W / 2, 204)
    const cursor = Math.floor(performance.now() / 400) % 2 === 0 ? "▌" : " "
    ctx.fillStyle = "#f8fafc"
    ctx.font = "bold 44px 'Consolas', monospace"
    ctx.fillText(this.codeBuf + cursor, W / 2, 282)
    ctx.fillStyle = "rgba(255,255,255,0.25)"
    ctx.fillRect(W / 2 - 90, 296, 180, 2)
    ctx.textAlign = "left"
    this.pill("ENTRAR  [ENTER]", W / 2 - 110, 330, 220, () => this.duelJoin(), { primary: true, h: 34, font: 14 })
    this.pill("← voltar", W / 2 - 110, 372, 220, () => { this.state = "duellobby" }, { h: 26 })
  }

  private renderDuelWaiting() {
    const ctx = this.ctx
    const d = this.duel
    this.dim(0.66)
    ctx.textAlign = "center"
    if (!d) { this.state = "duellobby"; return }
    if (d.startAtLocal === null) {
      const dots = ".".repeat(1 + (Math.floor(performance.now() / 400) % 3))
      if (d.rematch) {
        ctx.fillStyle = "#fde047"
        ctx.font = "900 40px 'Space Grotesk', sans-serif"
        ctx.fillText("⚔ REVANCHE!", W / 2, 220)
        ctx.fillStyle = "rgba(248,250,252,0.75)"
        ctx.font = "16px 'Space Grotesk', sans-serif"
        ctx.fillText(`esperando ${d.oppName || "o rival"} topar${dots}`, W / 2, 268)
      } else {
        ctx.fillStyle = "rgba(248,250,252,0.8)"
        ctx.font = "16px 'Space Grotesk', sans-serif"
        ctx.fillText(d.code === "...." ? "criando sala..." : "manda esse código pro seu rival:", W / 2, 170)
        ctx.fillStyle = "#fde047"
        ctx.font = "900 84px 'Consolas', monospace"
        if (d.code !== "....") ctx.fillText(d.code, W / 2, 268)
        ctx.fillStyle = "rgba(248,250,252,0.6)"
        ctx.font = "16px 'Space Grotesk', sans-serif"
        ctx.fillText(`esperando oponente${dots}`, W / 2, 330)
      }
      ctx.textAlign = "left"
      this.pill("cancelar  [ESC]", W / 2 - 100, 370, 200, () => this.toMenu(), { h: 28 })
    } else {
      const secs = Math.max(0, (d.startAtLocal - performance.now()) / 1000)
      ctx.fillStyle = "#4ade80"
      ctx.font = "900 40px 'Space Grotesk', sans-serif"
      ctx.fillText(`${d.oppName} ENTROU!`, W / 2, 220)
      ctx.fillStyle = "#f8fafc"
      ctx.font = "bold 64px 'Space Grotesk', sans-serif"
      ctx.fillText(secs.toFixed(1), W / 2, 300)
      ctx.fillStyle = "rgba(248,250,252,0.7)"
      ctx.font = "15px 'Space Grotesk', sans-serif"
      ctx.fillText("prepara o dedo no acelerador...", W / 2, 340)
      ctx.textAlign = "left"
    }
  }

  private renderDuelSpectate() {
    const ctx = this.ctx
    const d = this.duel
    this.dim(0.55)
    ctx.textAlign = "center"
    ctx.fillStyle = "#ef4444"
    ctx.font = "900 44px 'Space Grotesk', sans-serif"
    ctx.fillText("VOCÊ BATEU!", W / 2, 170)
    ctx.fillStyle = "#f8fafc"
    ctx.font = "bold 22px 'Space Grotesk', sans-serif"
    ctx.fillText(`sua marca: ${this.km.toFixed(2)} km · ${Math.floor(this.score).toLocaleString("pt-BR")} pts`, W / 2, 220)
    if (d) {
      const dots = ".".repeat(1 + (Math.floor(performance.now() / 400) % 3))
      ctx.fillStyle = "#f472b6"
      ctx.font = "bold 26px 'Space Grotesk', sans-serif"
      ctx.fillText(`${d.oppName || "RIVAL"} ainda está correndo${dots}`, W / 2, 290)
      ctx.fillStyle = "rgba(248,250,252,0.85)"
      ctx.font = "bold 34px 'Space Grotesk', sans-serif"
      ctx.fillText(`${d.oppD.toFixed(2)} km`, W / 2, 336)
      const lead = this.km - d.oppD
      ctx.font = "15px 'Space Grotesk', sans-serif"
      ctx.fillStyle = lead > 0 ? "#4ade80" : "#ef4444"
      ctx.fillText(lead > 0 ? `ele ainda precisa de ${Math.round(lead * 1000)}m pra te passar` : "ele já passou a sua marca...", W / 2, 372)
    }
    ctx.textAlign = "left"
  }

  private renderDuelResult() {
    const ctx = this.ctx
    const d = this.duel
    this.dim(0.66)
    ctx.textAlign = "center"
    const win = d?.result === "win"
    ctx.fillStyle = win ? "#4ade80" : "#ef4444"
    ctx.font = "900 72px 'Space Grotesk', sans-serif"
    ctx.fillText(win ? "VITÓRIA!" : "DERROTA", W / 2, 190)
    if (d) {
      ctx.fillStyle = "#f8fafc"
      ctx.font = "bold 22px 'Space Grotesk', sans-serif"
      ctx.fillText(`você: ${this.km.toFixed(2)} km   ·   ${d.oppName || "rival"}: ${d.oppD.toFixed(2)} km`, W / 2, 250)
      if (d.msg) {
        ctx.fillStyle = "rgba(248,250,252,0.6)"
        ctx.font = "14px 'Space Grotesk', sans-serif"
        ctx.fillText(d.msg, W / 2, 284)
      }
    }
    ctx.textAlign = "left"
    this.pill("⚔ REVANCHE  [ENTER]", W / 2 - 240, 340, 240, () => this.duelRematch(), { primary: true, h: 40, font: 15 })
    this.pill("MENU", W / 2 + 20, 340, 220, () => this.toMenu(), { h: 40, font: 15 })
  }

  // ---------- input ----------
  private audioInit = false
  private ensureAudio() {
    this.audio.ensure()
    if (!this.audioInit) {
      this.audioInit = true
      this.audio.setMuted(!this.cfg.sound)
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault()
    this.ensureAudio()

    if (this.state === "nameentry") {
      if (k === "enter") {
        this.confirmName()
      } else if (k === "backspace") this.nameBuf = this.nameBuf.slice(0, -1)
      else if (/^[a-z0-9 _-]$/i.test(e.key) && this.nameBuf.length < 12) this.nameBuf += e.key.toUpperCase()
      return
    }
    if (this.state === "duelcode") {
      if (k === "enter") this.duelJoin()
      else if (k === "escape") this.state = "duellobby"
      else if (k === "backspace") this.codeBuf = this.codeBuf.slice(0, -1)
      else if (/^[a-z0-9]$/i.test(e.key) && this.codeBuf.length < 4) this.codeBuf += e.key.toUpperCase()
      return
    }

    this.keys.add(k)
    if (k === " ") this.nitroOn = true
    // [M] alterna o som (menos em pause/game over, onde M = menu)
    if (k === "m" && ["racing", "countdown", "menu", "garage", "duellobby"].includes(this.state)) {
      this.toggleMute()
      return
    }

    switch (this.state) {
      case "menu":
        if (k === "enter") this.enterFromMenu("garage")
        if (k === "d") this.enterFromMenu("duellobby")
        break
      case "duellobby":
        if (k === "escape") this.toMenu()
        break
      case "duelwaiting":
        if (k === "escape") this.toMenu()
        break
      case "duelresult":
        if (k === "enter") this.duelRematch()
        if (k === "m" || k === "escape") this.toMenu()
        break
      case "garage": {
        const custom = this.cfg.customs[this.cfg.carIdx]
        if (k === "arrowleft") { this.cfg.carIdx = (this.cfg.carIdx + CARS.length - 1) % CARS.length; this.audio.ui() }
        if (k === "arrowright") { this.cfg.carIdx = (this.cfg.carIdx + 1) % CARS.length; this.audio.ui() }
        if (k === "c") { custom.paint = (custom.paint + 1) % PAINTS.length; this.audio.ui() }
        if (k === "v") { custom.stripe = (custom.stripe + 1) % STRIPES.length; this.audio.ui() }
        if (k === "b") { custom.neon = (custom.neon + 1) % NEONS.length; this.audio.ui() }
        if (k === "r") { custom.wheel = (custom.wheel + 1) % WHEELS.length; this.audio.ui() }
        if (k === "g") { custom.wing = (custom.wing + 1) % WINGS.length; this.audio.ui() }
        if (k === "t") { this.cfg.transmission = this.cfg.transmission === "auto" ? "manual" : "auto"; this.audio.ui() }
        if (k === "y") { this.cfg.steering = this.cfg.steering === "mouse" ? "keyboard" : "mouse"; this.audio.ui() }
        if (k === "n") { this.nameBuf = this.cfg.pilotName; this.afterName = "garage"; this.state = "nameentry"; this.audio.ui() }
        if (["c", "v", "b", "r", "g", "t", "y"].includes(k) || k.startsWith("arrow")) saveConfig(this.cfg)
        if (k === "enter") startAndSave(this)
        if (k === "escape") this.state = "menu"
        break
      }
      case "racing":
      case "countdown":
        if (k === "escape" || k === "p") {
          if (this.mode === "duel") {
            this.floaters.push({ text: "sem pause no duelo! 😅", color: "#f472b6", y: H * 0.4, life: 1.2, big: false })
          } else {
            this.state = "paused"
            this.audio.uiLow()
          }
        }
        if (k === "q") this.tryShift(-1)
        if (k === "e") this.tryShift(1)
        if (k === "n") this.toNeutral()
        if (k === "f") this.flashBeam()
        break
      case "paused":
        if (k === "escape" || k === "p" || k === "enter") this.state = "racing"
        if (k === "r") this.startRace()
        if (k === "m") this.state = "menu"
        break
      case "gameover":
        if (k === "enter") this.startRace()
        if (k === "g") this.state = "garage"
        if (k === "m") this.state = "menu"
        break
    }

    function startAndSave(self: AutoDashEngine) {
      saveConfig(self.cfg)
      self.startRace()
    }
  }

  private toggleMute() {
    this.cfg.sound = !this.cfg.sound
    saveConfig(this.cfg)
    this.audio.setMuted(!this.cfg.sound)
    this.floaters.push({
      text: this.cfg.sound ? "🔊 som ligado" : "🔇 som desligado",
      color: "#94a3b8", y: H * 0.52, life: 1, big: false,
    })
  }

  private enterFromMenu(dest: "garage" | "duellobby" = "garage") {
    this.audio.ui()
    if (!this.cfg.pilotName) {
      this.nameBuf = ""
      this.afterName = dest
      this.state = "nameentry"
    } else if (dest === "duellobby") {
      this.startDuelLobby()
    } else {
      this.state = "garage"
    }
  }

  private confirmName() {
    this.cfg.pilotName = (this.nameBuf.trim() || "PILOTO").slice(0, 12)
    saveConfig(this.cfg)
    this.audio.ui()
    if (this.afterName === "duellobby") this.startDuelLobby()
    else this.state = "garage"
    this.afterName = "garage"
  }

  /** Farol alto: pisca e pede passagem pra quem está na sua faixa. */
  private flashBeam() {
    if (this.state !== "racing" || this.beamCdT > 0) return
    this.beamCdT = 2.2
    this.beamT = 0.55
    this.audio.flash()
    const playerZ = this.position + PLAYER_Z
    for (const t of this.traffic) {
      const d = this.wrapDz(t.z, playerZ)
      if (d > 200 && d < 7000 && Math.abs(t.offset - this.playerX) < 0.35) t.yieldT = 1.4
    }
  }

  private tryShift(dir: 1 | -1) {
    if (this.cfg.transmission !== "manual" && this.gear !== 0) return
    if (this.state !== "racing" && this.state !== "countdown") return
    if (dir === 1) this.shiftUp(); else this.shiftDown()
  }

  private toNeutral() {
    if (this.state !== "racing") return
    this.gear = 0
    this.audio.shift()
  }

  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    this.keys.delete(k)
    if (k === " ") this.nitroOn = false
  }

  private onMouseDown = (e: MouseEvent) => {
    this.ensureAudio()
    if (e.button === 0) {
      if (this.state === "racing" || this.state === "countdown") {
        this.mouseGas = true
      } else {
        const hit = this.regionAt(this.mousePx.x, this.mousePx.y)
        if (hit) hit.act()
        else if (this.state === "menu") this.enterFromMenu()
      }
    }
    if (e.button === 2 && (this.state === "racing" || this.state === "countdown")) this.mouseBrake = true
    if (e.button === 1) { e.preventDefault(); this.toNeutral() }
    if (e.button === 3 || e.button === 4) { e.preventDefault(); this.nitroOn = true }
  }
  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseGas = false
    if (e.button === 2) this.mouseBrake = false
    if (e.button === 3 || e.button === 4) this.nitroOn = false
  }
  private onMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect()
    this.mouseXn = clamp((e.clientX - rect.left) / rect.width, 0, 1)
    this.mousePx.x = ((e.clientX - rect.left) / rect.width) * W
    this.mousePx.y = ((e.clientY - rect.top) / rect.height) * H
    const uiState = ["menu", "garage", "paused", "gameover", "nameentry"].includes(this.state)
    this.canvas.style.cursor = uiState && this.regionAt(this.mousePx.x, this.mousePx.y) ? "pointer" : "default"
  }

  private regionAt(x: number, y: number) {
    for (const r of this.uiRegions) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r
    }
    return null
  }
  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    if (this.state !== "racing" && this.state !== "countdown") return
    this.tryShift(e.deltaY < 0 ? 1 : -1)
  }
  private onCtx = (e: Event) => e.preventDefault()
  private onBlur = () => { if (this.state === "racing" && this.mode !== "duel") this.state = "paused" }

  private bind() {
    window.addEventListener("keydown", this.onKeyDown)
    window.addEventListener("keyup", this.onKeyUp)
    window.addEventListener("blur", this.onBlur)
    this.canvas.addEventListener("mousedown", this.onMouseDown)
    window.addEventListener("mouseup", this.onMouseUp)
    this.canvas.addEventListener("mousemove", this.onMouseMove)
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false })
    this.canvas.addEventListener("contextmenu", this.onCtx)
  }
  private unbind() {
    window.removeEventListener("keydown", this.onKeyDown)
    window.removeEventListener("keyup", this.onKeyUp)
    window.removeEventListener("blur", this.onBlur)
    this.canvas.removeEventListener("mousedown", this.onMouseDown)
    window.removeEventListener("mouseup", this.onMouseUp)
    this.canvas.removeEventListener("mousemove", this.onMouseMove)
    this.canvas.removeEventListener("wheel", this.onWheel)
    this.canvas.removeEventListener("contextmenu", this.onCtx)
  }
}

// ---------- helpers de desenho ----------
function poly(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) {
  ctx.beginPath()
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4)
  ctx.closePath()
  ctx.fill()
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, Math.max(h, 1), Math.min(r, h / 2, w / 2))
  ctx.fill()
}

/** Carro do jogador visto de trás — silhueta própria por carroceria + customização completa. */
function drawPlayerCar(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, spec: CarSpec,
  custom: CarCustom, steer: number, braking: boolean, amb: number, nitro: boolean, scale = 1,
) {
  const w = spec.width * 640 * scale
  const h = w * 0.62
  const paint = PAINTS[custom.paint]
  const body = shade(paint, Math.max(0.5, amb))
  const dark = shade(paint, Math.max(0.3, amb * 0.55))
  const rim = WHEELS[custom.wheel]

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(steer * 0.05)

  // neon
  if (custom.neon > 0) {
    const neon = NEONS[custom.neon]
    const strength = amb < 0.7 ? 0.75 : 0.35
    const ng = ctx.createRadialGradient(0, 6, 4, 0, 6, w * 0.85)
    ng.addColorStop(0, neon + Math.round(strength * 255).toString(16).padStart(2, "0"))
    ng.addColorStop(1, neon + "00")
    ctx.fillStyle = ng
    ctx.beginPath(); ctx.ellipse(0, 6, w * 0.85, w * 0.22, 0, 0, Math.PI * 2); ctx.fill()
  }
  // sombra
  ctx.fillStyle = "rgba(0,0,0,0.4)"
  ctx.beginPath(); ctx.ellipse(0, 2, w * 0.62, w * 0.10, 0, 0, Math.PI * 2); ctx.fill()

  const bx = -w / 2, by = -h
  // pneus + rodas coloridas
  ctx.fillStyle = "#0a0a0c"
  rr(ctx, bx - w * 0.05, -h * 0.36, w * 0.10, h * 0.36, w * 0.025)
  rr(ctx, bx + w - w * 0.05, -h * 0.36, w * 0.10, h * 0.36, w * 0.025)
  ctx.fillStyle = rim
  rr(ctx, bx - w * 0.038, -h * 0.26, w * 0.024, h * 0.16, w * 0.012)
  rr(ctx, bx + w + w * 0.014, -h * 0.26, w * 0.024, h * 0.16, w * 0.012)

  // ---- silhueta por carroceria (curvas, não caixas) ----
  ctx.fillStyle = body
  const roofY = by
  if (spec.body === "gt") {
    // cupê: traseira larga, cabine afunilada com teto em arco
    ctx.beginPath()
    ctx.moveTo(bx + w * 0.02, 0)
    ctx.quadraticCurveTo(bx - w * 0.03, by + h * 0.52, bx + w * 0.07, by + h * 0.40)
    ctx.quadraticCurveTo(bx + w * 0.13, by + h * 0.06, bx + w * 0.32, roofY + h * 0.02)
    ctx.quadraticCurveTo(0, roofY - h * 0.04, bx + w * 0.68, roofY + h * 0.02)
    ctx.quadraticCurveTo(bx + w * 0.87, by + h * 0.06, bx + w * 0.93, by + h * 0.40)
    ctx.quadraticCurveTo(bx + w * 1.03, by + h * 0.52, bx + w * 0.98, 0)
    ctx.closePath()
    ctx.fill()
    // ombros dos para-lamas
    ctx.fillStyle = dark
    ctx.beginPath(); ctx.ellipse(bx + w * 0.075, -h * 0.26, w * 0.055, h * 0.20, 0.2, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(bx + w * 0.925, -h * 0.26, w * 0.055, h * 0.20, -0.2, 0, Math.PI * 2); ctx.fill()
  } else if (spec.body === "muscle") {
    // muscle: quadris largos, cabine achatada, capô com scoop
    ctx.beginPath()
    ctx.moveTo(bx - w * 0.02, 0)
    ctx.quadraticCurveTo(bx - w * 0.06, by + h * 0.62, bx + w * 0.04, by + h * 0.44)
    ctx.quadraticCurveTo(bx + w * 0.16, by + h * 0.10, bx + w * 0.30, by + h * 0.06)
    ctx.lineTo(bx + w * 0.70, by + h * 0.06)
    ctx.quadraticCurveTo(bx + w * 0.84, by + h * 0.10, bx + w * 0.96, by + h * 0.44)
    ctx.quadraticCurveTo(bx + w * 1.06, by + h * 0.62, bx + w * 1.02, 0)
    ctx.closePath()
    ctx.fill()
    // quadris musculosos
    ctx.fillStyle = dark
    ctx.beginPath(); ctx.ellipse(bx + w * 0.05, -h * 0.28, w * 0.075, h * 0.26, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(bx + w * 0.95, -h * 0.28, w * 0.075, h * 0.26, 0, 0, Math.PI * 2); ctx.fill()
    // scoop no capô espiando por cima
    rr(ctx, -w * 0.11, by, w * 0.22, h * 0.10, w * 0.03)
  } else if (spec.body === "ninja") {
    // gota aerodinâmica: um arco só, sem vinco
    ctx.beginPath()
    ctx.moveTo(bx + w * 0.03, 0)
    ctx.quadraticCurveTo(bx - w * 0.02, by + h * 0.45, bx + w * 0.16, by + h * 0.14)
    ctx.quadraticCurveTo(0, roofY - h * 0.10, bx + w * 0.84, by + h * 0.14)
    ctx.quadraticCurveTo(bx + w * 1.02, by + h * 0.45, bx + w * 0.97, 0)
    ctx.closePath()
    ctx.fill()
  } else {
    // ghost: cunha facetada, ângulos duros
    ctx.beginPath()
    ctx.moveTo(0, roofY - h * 0.02)
    ctx.lineTo(bx + w * 0.72, by + h * 0.10)
    ctx.lineTo(bx + w * 0.98, by + h * 0.36)
    ctx.lineTo(bx + w * 1.02, by + h * 0.78)
    ctx.lineTo(bx + w * 0.90, 0)
    ctx.lineTo(bx + w * 0.10, 0)
    ctx.lineTo(bx - w * 0.02, by + h * 0.78)
    ctx.lineTo(bx + w * 0.02, by + h * 0.36)
    ctx.lineTo(bx + w * 0.28, by + h * 0.10)
    ctx.closePath()
    ctx.fill()
    // vinco central afiado
    ctx.strokeStyle = dark
    ctx.lineWidth = Math.max(1, w * 0.012)
    ctx.beginPath(); ctx.moveTo(0, roofY); ctx.lineTo(0, -h * 0.36); ctx.stroke()
  }

  // faixas
  ctx.fillStyle = "rgba(255,255,255,0.35)"
  if (custom.stripe === 1) ctx.fillRect(-w * 0.05, by + h * 0.06, w * 0.10, h * 0.86)
  if (custom.stripe === 2) { ctx.fillRect(-w * 0.11, by + h * 0.06, w * 0.07, h * 0.86); ctx.fillRect(w * 0.04, by + h * 0.06, w * 0.07, h * 0.86) }
  if (custom.stripe === 3) { ctx.fillRect(bx + w * 0.06, by + h * 0.30, w * 0.05, h * 0.62); ctx.fillRect(bx + w * 0.89, by + h * 0.30, w * 0.05, h * 0.62) }

  // verniz: brilho no teto, sombra na base
  const gloss = ctx.createLinearGradient(0, by, 0, by + h)
  gloss.addColorStop(0, "rgba(255,255,255,0.30)")
  gloss.addColorStop(0.32, "rgba(255,255,255,0.06)")
  gloss.addColorStop(0.6, "rgba(0,0,0,0)")
  gloss.addColorStop(1, "rgba(0,0,0,0.22)")
  ctx.fillStyle = gloss
  rr(ctx, bx + w * 0.02, by + h * 0.04, w * 0.96, h * 0.9, w * 0.14)

  // vidro traseiro acompanhando a cabine
  ctx.fillStyle = shade("#0f172a", Math.max(0.6, amb))
  if (spec.body === "ghost") {
    ctx.beginPath()
    ctx.moveTo(0, by + h * 0.06)
    ctx.lineTo(bx + w * 0.68, by + h * 0.18)
    ctx.lineTo(bx + w * 0.62, by + h * 0.36)
    ctx.lineTo(bx + w * 0.38, by + h * 0.36)
    ctx.lineTo(bx + w * 0.32, by + h * 0.18)
    ctx.closePath()
    ctx.fill()
  } else {
    const vw = spec.body === "ninja" ? 0.56 : spec.body === "muscle" ? 0.44 : 0.52
    ctx.beginPath()
    ctx.moveTo(-w * vw / 2, by + h * 0.36)
    ctx.quadraticCurveTo(-w * vw * 0.42, by + h * 0.10, -w * vw * 0.30, by + h * 0.10)
    ctx.lineTo(w * vw * 0.30, by + h * 0.10)
    ctx.quadraticCurveTo(w * vw * 0.42, by + h * 0.10, w * vw / 2, by + h * 0.36)
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillStyle = "rgba(190,215,245,0.18)"
  ctx.beginPath()
  ctx.moveTo(bx + w * 0.36, by + h * 0.12)
  ctx.lineTo(bx + w * 0.46, by + h * 0.12)
  ctx.lineTo(bx + w * 0.38, by + h * 0.33)
  ctx.lineTo(bx + w * 0.30, by + h * 0.33)
  ctx.closePath()
  ctx.fill()

  // aerofólio customizável
  ctx.fillStyle = dark
  if (custom.wing === 1) { // ducktail
    rr(ctx, bx + w * 0.10, by + h * 0.34, w * 0.80, h * 0.055, w * 0.02)
  } else if (custom.wing === 2) { // asa GT
    rr(ctx, bx - w * 0.03, by - h * 0.10, w * 1.06, h * 0.075, w * 0.03)
    ctx.fillRect(bx + w * 0.14, by - h * 0.04, w * 0.05, h * 0.14)
    ctx.fillRect(bx + w * 0.81, by - h * 0.04, w * 0.05, h * 0.14)
  }

  // lanternas
  const glow = braking ? 1 : amb < 0.62 ? 0.8 : 0.45
  ctx.fillStyle = `rgba(255,45,40,${glow})`
  const th = h * 0.09
  if (spec.body === "ninja") {
    rr(ctx, bx + w * 0.08, -th * 2.4, w * 0.30, th, th / 2)
    rr(ctx, bx + w * 0.62, -th * 2.4, w * 0.30, th, th / 2)
  } else if (spec.body === "ghost") {
    rr(ctx, bx + w * 0.10, -th * 2.6, w * 0.80, th * 0.7, th / 3) // barra única
  } else {
    rr(ctx, bx + w * 0.07, -th * 2.4, w * 0.24, th, th / 2)
    rr(ctx, bx + w * 0.69, -th * 2.4, w * 0.24, th, th / 2)
  }
  if (braking || amb < 0.62) {
    ctx.fillStyle = `rgba(255,45,40,${braking ? 0.35 : 0.18})`
    ctx.beginPath(); ctx.ellipse(0, -th * 1.8, w * 0.58, th * 2.4, 0, 0, Math.PI * 2); ctx.fill()
  }

  // escapamentos
  ctx.fillStyle = "#18181b"
  ctx.beginPath(); ctx.arc(bx + w * 0.20, -h * 0.03, w * 0.035, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(bx + w * 0.80, -h * 0.03, w * 0.035, 0, Math.PI * 2); ctx.fill()
  if (nitro) {
    ctx.fillStyle = "#fde047"
    ctx.beginPath(); ctx.arc(bx + w * 0.20, -h * 0.03, w * 0.05, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(bx + w * 0.80, -h * 0.03, w * 0.05, 0, Math.PI * 2); ctx.fill()
  }

  // placa
  ctx.fillStyle = shade("#e2e8f0", Math.max(0.55, amb))
  rr(ctx, -w * 0.14, -h * 0.16, w * 0.28, h * 0.09, 2)
  ctx.fillStyle = "#0f172a"
  ctx.font = `bold ${Math.max(6, h * 0.06)}px 'Space Grotesk', 'Segoe UI', sans-serif`
  ctx.textAlign = "center"
  ctx.fillText("AUTOHUB", 0, -h * 0.093)
  ctx.textAlign = "left"

  ctx.restore()
}
