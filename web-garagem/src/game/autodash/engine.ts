// AutoDash — engine pseudo-3D (estilo NFS de PSP) em Canvas 2D puro.
// Estrada por segmentos projetados, tráfego, clima, câmbio com RPM e ranking local.

import {
  CANVAS_W, CANVAS_H, SEG_LEN, ROAD_WIDTH, CAM_HEIGHT, CAM_DEPTH, DRAW_DIST,
  KMH2UPS, RPM_IDLE, RPM_REDLINE, RPM_LIMITER, GEAR_RATIOS, RPM_PER_KMH,
  CARS, PAINTS, STRIPES, NEONS, NEON_NAMES,
  loadConfig, saveConfig, loadScores, saveScore, isTop5,
  type CarSpec, type GameConfig, type ScoreEntry,
} from "./data"
import { AudioBus } from "./audio"

const W = CANVAS_W, H = CANVAS_H
const PLAYER_Z = CAM_HEIGHT * CAM_DEPTH
const RUMBLE = 3

type GameState = "menu" | "garage" | "countdown" | "racing" | "paused" | "gameover" | "nameentry"

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
  private scores: ScoreEntry[] = loadScores()

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
  private raining = false
  private rainT = 0
  private rainRollT = 0
  private demoT = 0

  // input
  private keys = new Set<string>()
  private mouseGas = false
  private mouseBrake = false
  private mouseXn = 0.5
  private nameBuf = ""
  private pendingScore: ScoreEntry | null = null

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
    this.unbind()
  }

  // ---------- pista ----------
  private buildTrack() {
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
    const r = (lo: number, hi: number) => lo + Math.random() * (hi - lo)
    const ri = (lo: number, hi: number) => Math.floor(r(lo, hi + 1))

    addRoad(30, 80, 30, 0, 0) // reta de largada
    while (this.segments.length < 4000) {
      const roll = Math.random()
      const hill = r(-1, 1) * r(600, 2600)
      if (roll < 0.28) addRoad(ri(20, 40), ri(30, 70), ri(20, 40), 0, hill)
      else if (roll < 0.62) {
        const c = (Math.random() < 0.5 ? -1 : 1) * r(2, 5)
        addRoad(ri(25, 45), ri(30, 70), ri(25, 45), c, hill * 0.6)
      } else if (roll < 0.85) {
        const c = (Math.random() < 0.5 ? -1 : 1) * r(2.5, 4.5)
        addRoad(25, 40, 25, c, hill * 0.4)
        addRoad(25, 40, 25, -c, -hill * 0.4)
      } else addRoad(ri(15, 25), ri(20, 40), ri(15, 25), (Math.random() < 0.5 ? -1 : 1) * r(4.5, 6), 0)
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
      return
    }
    if (this.gear >= 6) return
    this.gear++
    this.shiftT = CARS[this.cfg.carIdx].shiftMs / 1000
    if (this.rpmFor(this.speed, this.gear) < 1500) this.audio.bog()
    else this.audio.shift()
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

    if (this.state === "menu" || this.state === "garage") {
      // demo: câmera passeia pela pista
      this.demoT += dt
      this.speed = 95
      this.position = (this.position + this.speed * KMH2UPS * dt) % this.trackLen
      this.playerX = Math.sin(this.demoT * 0.3) * 0.2
      this.bgShift += this.segAt(this.position + PLAYER_Z).curve * this.speed * dt * 0.6
      this.updateTraffic(dt, this.position + PLAYER_Z, true)
      this.audio.engine(0, 0, false, false)
      return
    }
    if (this.state === "paused" || this.state === "gameover" || this.state === "nameentry") {
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
    this.bgShift += seg.curve * this.speed * dt * 0.6

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
    const entry: ScoreEntry = { name: "", score: Math.floor(this.score), km: Math.round(this.km * 10) / 10 }
    if (isTop5(entry.score) && entry.score > 500) {
      this.pendingScore = entry
      this.nameBuf = ""
      this.state = "nameentry"
    } else {
      this.state = "gameover"
    }
  }

  private startRace() {
    this.buildTrack()
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
    this.shiftT = 0; this.wheelspinT = 0; this.bogT = 0
    this.crashed = false
    this.raining = false; this.rainRollT = 0
    this.audio.rain(false)
    this.particles = []; this.floaters = []
    this.countT = 0
    this.greenAt = 2.4 + 0.7 + Math.random() * 0.9
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
    const sky = this.skyNow()
    const amb = sky.amb

    ctx.save()
    if (this.shakeT > 0) ctx.translate((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10)

    // céu
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.55)
    g.addColorStop(0, sky.top)
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
    }

    // floaters por cima de tudo
    const ctx2 = this.ctx
    for (const f of this.floaters) {
      ctx2.globalAlpha = clamp(f.life / 0.4, 0, 1)
      ctx2.font = `bold ${f.big ? 34 : 20}px 'Segoe UI', sans-serif`
      ctx2.fillStyle = f.color
      ctx2.textAlign = "center"
      ctx2.fillText(f.text, W / 2, f.y)
      ctx2.globalAlpha = 1
    }
    ctx2.textAlign = "left"
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

    // chão base (abaixo do horizonte)
    ctx.fillStyle = shade("#0d7a43", amb)
    ctx.fillRect(-10, H * 0.5, W + 20, H * 0.5 + 10)

    const grassL = shade("#0f8a4c", amb), grassD = shade("#0c7440", amb)
    const roadL = shade("#6b6b72", amb), roadD = shade("#646469", amb)
    const rumbA = shade("#e0342f", amb), rumbB = shade("#f1f5f9", amb)
    const laneC = shade("#f8fafc", amb)

    let x = 0
    let dx = -(this.segments[baseIdx].curve * basePct)
    let maxY = H + 10

    interface SpriteDraw { kind: "car" | "pu" | "deco"; t?: Traffic; p?: Pickup; deco?: number; dir?: number; x: number; y: number; w: number }
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
      const fog = Math.pow(n / DRAW_DIST, 2.2) * 0.75

      // grama
      ctx.fillStyle = fog > 0.02 ? mixRgb(alt ? grassL : grassD, fogColor, fog) : (alt ? grassL : grassD)
      ctx.fillRect(-10, sy2, W + 20, sy1 - sy2 + 1)
      // zebra
      ctx.fillStyle = fog > 0.02 ? mixRgb(alt ? rumbA : rumbB, fogColor, fog) : (alt ? rumbA : rumbB)
      poly(ctx, sx1 - sw1 * 1.13, sy1, sx1 + sw1 * 1.13, sy1, sx2 + sw2 * 1.13, sy2, sx2 - sw2 * 1.13, sy2)
      // asfalto
      ctx.fillStyle = fog > 0.02 ? mixRgb(alt ? roadL : roadD, fogColor, fog) : (alt ? roadL : roadD)
      poly(ctx, sx1 - sw1, sy1, sx1 + sw1, sy1, sx2 + sw2, sy2, sx2 - sw2, sy2)
      // linhas de faixa
      if (alt) {
        ctx.fillStyle = fog > 0.02 ? mixRgb(laneC, fogColor, fog) : laneC
        for (let l = 1; l < 4; l++) {
          const lx = -1 + (2 * l) / 4
          poly(ctx,
            sx1 + sw1 * lx - sw1 * 0.012, sy1, sx1 + sw1 * lx + sw1 * 0.012, sy1,
            sx2 + sw2 * lx + sw2 * 0.012, sy2, sx2 + sw2 * lx - sw2 * 0.012, sy2)
        }
      }
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
      else this.drawDeco(s.deco!, s.dir ?? 0, s.x, s.y, s.w, amb)
    }
  }

  private renderBackdrop(amb: number) {
    const ctx = this.ctx
    const hz = H * 0.5
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
      ctx.font = `bold ${Math.max(8, r * 0.9)}px 'Segoe UI', sans-serif`
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
        ctx.font = `900 ${h * 0.42}px 'Segoe UI', sans-serif`
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
      ctx.font = `bold ${s * 1.1}px 'Segoe UI', sans-serif`
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
    const bounce = Math.sin(this.position * 0.03) * Math.min(3, this.speed / 60)
    if (this.shield) {
      const pw = spec.width * 640
      ctx.fillStyle = "rgba(96,165,250,0.14)"
      ctx.strokeStyle = "rgba(96,165,250,0.65)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(W / 2, H - 68 + bounce, pw * 0.75, 62, 0, 0, Math.PI * 2)
      ctx.fill(); ctx.stroke()
    }
    drawPlayerCar(ctx, W / 2, H - 34 + bounce, spec, custom.paint, custom.stripe, custom.neon, steer, braking, amb, this.nitroOn && this.nitroMeter > 1)
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
  private renderHud() {
    const ctx = this.ctx
    // placar
    ctx.fillStyle = "rgba(2,6,23,0.55)"
    rr(ctx, 14, 12, 210, 62, 12)
    ctx.fillStyle = "#f8fafc"
    ctx.font = "bold 24px 'Segoe UI', sans-serif"
    ctx.fillText(`${Math.floor(this.score).toLocaleString("pt-BR")}`, 28, 40)
    ctx.font = "13px 'Segoe UI', sans-serif"
    ctx.fillStyle = "rgba(248,250,252,0.65)"
    const best = this.scores[0]
    ctx.fillText(`recorde ${best ? best.score.toLocaleString("pt-BR") : 0}  ·  ${this.km.toFixed(1)} km`, 28, 62)

    // combo
    if (this.combo > 0) {
      ctx.fillStyle = "#fde047"
      ctx.font = "bold 26px 'Segoe UI', sans-serif"
      ctx.fillText(`x${1 + this.combo}`, 240, 42)
      ctx.fillStyle = "rgba(253,224,71,0.35)"
      ctx.fillRect(240, 50, 52, 5)
      ctx.fillStyle = "#fde047"
      ctx.fillRect(240, 50, 52 * clamp(this.comboT / 4, 0, 1), 5)
    }

    // clima/hora + badges
    const sky = this.skyNow()
    ctx.textAlign = "right"
    ctx.font = "20px 'Segoe UI', sans-serif"
    ctx.fillText(this.raining ? "🌧" : sky.amb < 0.6 ? "🌙" : "☀️", W - 20, 34)
    ctx.font = "bold 13px 'Segoe UI', sans-serif"
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
        ctx.font = "bold 24px 'Segoe UI', sans-serif"
        const arrows = this.curveWarn > 0 ? "▶▶" : "◀◀"
        ctx.fillText(`${arrows}  CURVA ${this.curveWarn > 0 ? "À DIREITA" : "À ESQUERDA"}  ${arrows}`, W / 2, 92)
        ctx.textAlign = "left"
      }
    }

    this.renderTacho()

    // nitro
    const nx = 22, ny = H - 160, nh = 120
    ctx.fillStyle = "rgba(2,6,23,0.55)"
    rr(ctx, nx - 6, ny - 8, 34, nh + 34, 10)
    ctx.fillStyle = "rgba(148,163,184,0.3)"
    rr(ctx, nx, ny, 22, nh, 8)
    const nfill = nh * this.nitroMeter / 100
    ctx.fillStyle = this.nitroOn && this.nitroMeter > 1 ? "#fb923c" : "#38bdf8"
    if (nfill > 2) rr(ctx, nx, ny + nh - nfill, 22, nfill, 8)
    ctx.fillStyle = "#f8fafc"
    ctx.font = "bold 11px 'Segoe UI', sans-serif"
    ctx.fillText("NOS", nx + 1, ny + nh + 18)
  }

  private renderTacho() {
    const ctx = this.ctx
    const cx = W - 108, cy = H - 92, r = 74
    ctx.fillStyle = "rgba(2,6,23,0.6)"
    ctx.beginPath(); ctx.arc(cx, cy, r + 14, 0, Math.PI * 2); ctx.fill()

    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25
    // zona vermelha
    const redStart = a0 + (a1 - a0) * (RPM_REDLINE / 8000)
    ctx.strokeStyle = "rgba(148,163,184,0.5)"
    ctx.lineWidth = 7
    ctx.beginPath(); ctx.arc(cx, cy, r, a0, redStart); ctx.stroke()
    ctx.strokeStyle = "#ef4444"
    ctx.beginPath(); ctx.arc(cx, cy, r, redStart, a1); ctx.stroke()
    // ticks
    ctx.fillStyle = "rgba(248,250,252,0.7)"
    ctx.font = "10px 'Segoe UI', sans-serif"
    for (let i = 0; i <= 8; i++) {
      const a = a0 + (a1 - a0) * (i / 8)
      const tx = cx + Math.cos(a) * (r - 16), ty = cy + Math.sin(a) * (r - 16)
      ctx.textAlign = "center"
      ctx.fillText(String(i), tx, ty + 3)
    }
    // agulha
    const frac = clamp(this.rpm / 8000, 0, 1)
    const na = a0 + (a1 - a0) * frac
    ctx.strokeStyle = frac > RPM_REDLINE / 8000 ? "#ef4444" : "#f8fafc"
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(cx - Math.cos(na) * 10, cy - Math.sin(na) * 10)
    ctx.lineTo(cx + Math.cos(na) * (r - 8), cy + Math.sin(na) * (r - 8))
    ctx.stroke()
    ctx.fillStyle = "#0f172a"
    ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill()
    // marcha
    ctx.fillStyle = this.shiftT > 0 ? "#fde047" : "#f8fafc"
    ctx.font = "bold 28px 'Segoe UI', sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(this.gear === 0 ? "N" : String(this.gear), cx, cy + 10)
    // velocidade
    ctx.fillStyle = "#f8fafc"
    ctx.font = "bold 22px 'Segoe UI', sans-serif"
    ctx.fillText(String(Math.round(this.speed)), cx, cy + r - 8)
    ctx.font = "10px 'Segoe UI', sans-serif"
    ctx.fillStyle = "rgba(248,250,252,0.6)"
    ctx.fillText("km/h", cx, cy + r + 6)
    ctx.textAlign = "left"
    // modo de câmbio
    ctx.fillStyle = "rgba(248,250,252,0.5)"
    ctx.font = "bold 10px 'Segoe UI', sans-serif"
    ctx.fillText(this.cfg.transmission === "auto" ? "AUTO" : "SEQ", cx - 16, cy - r - 20)

    if (this.goFlashT > 0) {
      ctx.globalAlpha = clamp(this.goFlashT, 0, 1)
      ctx.fillStyle = "#4ade80"
      ctx.font = "900 54px 'Segoe UI', sans-serif"
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
      ctx.font = "bold 30px 'Segoe UI', sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("GO!", cx, top + 100)
      ctx.textAlign = "left"
    } else if (this.countT > 0.5) {
      ctx.fillStyle = "rgba(248,250,252,0.85)"
      ctx.font = "bold 15px 'Segoe UI', sans-serif"
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
    ctx.fillStyle = "#e0342f"
    ctx.font = "900 76px 'Segoe UI', sans-serif"
    ctx.fillText("AUTODASH", W / 2, 180)
    ctx.fillStyle = "rgba(248,250,252,0.85)"
    ctx.font = "18px 'Segoe UI', sans-serif"
    ctx.fillText("costure o trânsito · respeite o câmbio · sobreviva", W / 2, 214)
    if (Math.floor(this.demoT * 1.6) % 2 === 0) {
      ctx.fillStyle = "#fde047"
      ctx.font = "bold 24px 'Segoe UI', sans-serif"
      ctx.fillText("clique ou ENTER para entrar na garagem", W / 2, 320)
    }
    ctx.fillStyle = "rgba(248,250,252,0.6)"
    ctx.font = "14px 'Segoe UI', sans-serif"
    ctx.fillText("🖱 esq acelera · dir freia · scroll troca marcha · botão do meio = neutro", W / 2, 440)
    ctx.fillText("⌨ A/D ou ←→ dirigem · W/S gás/freio · Q/E marchas · ESPAÇO nitro · ESC pausa", W / 2, 464)
    const best = this.scores[0]
    if (best) {
      ctx.fillStyle = "rgba(253,224,71,0.9)"
      ctx.fillText(`recorde: ${best.score.toLocaleString("pt-BR")} — ${best.name}`, W / 2, 500)
    }
    ctx.textAlign = "left"
  }

  private renderGarage() {
    const ctx = this.ctx
    this.dim(0.72)
    const spec = CARS[this.cfg.carIdx]
    const custom = this.cfg.customs[this.cfg.carIdx]

    ctx.textAlign = "center"
    ctx.fillStyle = "#f8fafc"
    ctx.font = "bold 30px 'Segoe UI', sans-serif"
    ctx.fillText("GARAGEM", W / 2, 46)
    ctx.fillStyle = "rgba(248,250,252,0.55)"
    ctx.font = "15px 'Segoe UI', sans-serif"
    ctx.fillText(`◀  ${this.cfg.carIdx + 1}/${CARS.length}  ▶`, W / 2, 72)

    // plataforma + carro
    const px = 240, py = 330
    const pg = ctx.createRadialGradient(px, py, 10, px, py, 150)
    const neon = NEONS[custom.neon]
    pg.addColorStop(0, custom.neon > 0 ? neon + "55" : "rgba(148,163,184,0.25)")
    pg.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = pg
    ctx.beginPath(); ctx.ellipse(px, py, 160, 46, 0, 0, Math.PI * 2); ctx.fill()
    drawPlayerCar(ctx, px, py + 10, spec, custom.paint, custom.stripe, custom.neon, 0, false, 0.9, false, 1.5)

    ctx.fillStyle = PAINTS[custom.paint]
    ctx.font = "bold 26px 'Segoe UI', sans-serif"
    ctx.fillText(spec.name, px, 408)
    ctx.fillStyle = "rgba(248,250,252,0.7)"
    ctx.font = "italic 13px 'Segoe UI', sans-serif"
    ctx.fillText(spec.desc, px, 430)
    ctx.textAlign = "left"

    // stats
    const sx = 520, sw = 240
    const stat = (label: string, frac: number, y: number, invert = false) => {
      ctx.fillStyle = "rgba(248,250,252,0.75)"
      ctx.font = "12px 'Segoe UI', sans-serif"
      ctx.fillText(label, sx, y - 4)
      ctx.fillStyle = "rgba(148,163,184,0.25)"
      rr(ctx, sx, y, sw, 10, 5)
      ctx.fillStyle = invert ? "#fb923c" : "#4ade80"
      rr(ctx, sx, y, sw * clamp(frac, 0.05, 1), 10, 5)
    }
    stat("POTÊNCIA", spec.power / 58, 120)
    stat("ADERÊNCIA (curvas)", spec.grip / 0.9, 156)
    stat("VELOCIDADE FINAL", spec.topSpeed / 248, 192)
    stat("LARGURA (atrapalha no corredor)", spec.width / 0.31, 228, true)

    // opções
    ctx.fillStyle = "rgba(248,250,252,0.85)"
    ctx.font = "bold 14px 'Segoe UI', sans-serif"
    ctx.fillText(`[C] pintura`, sx, 280)
    for (let i = 0; i < PAINTS.length; i++) {
      ctx.fillStyle = PAINTS[i]
      ctx.beginPath(); ctx.arc(sx + 8 + i * 24, 300, 8, 0, Math.PI * 2); ctx.fill()
      if (i === custom.paint) {
        ctx.strokeStyle = "#f8fafc"; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(sx + 8 + i * 24, 300, 11, 0, Math.PI * 2); ctx.stroke()
      }
    }
    ctx.fillStyle = "rgba(248,250,252,0.85)"
    ctx.fillText(`[V] faixa: ${STRIPES[custom.stripe]}`, sx, 336)
    ctx.fillText(`[B] neon: ${NEON_NAMES[custom.neon]}`, sx, 362)
    if (custom.neon > 0) { ctx.fillStyle = NEONS[custom.neon]; ctx.beginPath(); ctx.arc(sx + 118, 357, 6, 0, Math.PI * 2); ctx.fill() }
    ctx.fillStyle = "rgba(248,250,252,0.85)"
    ctx.fillText(`[T] câmbio: ${this.cfg.transmission === "auto" ? "AUTOMÁTICO" : "SEQUENCIAL (scroll)"}`, sx, 396)
    ctx.fillText(`[Y] direção: ${this.cfg.steering === "mouse" ? "MOUSE (volante)" : "TECLADO"}`, sx, 422)

    // ranking
    ctx.fillStyle = "rgba(253,224,71,0.9)"
    ctx.font = "bold 13px 'Segoe UI', sans-serif"
    ctx.fillText("TOP 5", sx, 462)
    ctx.font = "12px 'Segoe UI', sans-serif"
    ctx.fillStyle = "rgba(248,250,252,0.7)"
    if (this.scores.length === 0) ctx.fillText("— ainda sem recordes —", sx, 482)
    this.scores.forEach((s, i) => {
      ctx.fillText(`${i + 1}. ${s.name || "???"} — ${s.score.toLocaleString("pt-BR")} (${s.km} km)`, sx, 482 + i * 18)
    })

    ctx.textAlign = "center"
    ctx.fillStyle = "#fde047"
    ctx.font = "bold 22px 'Segoe UI', sans-serif"
    ctx.fillText("[ENTER] pro grid de largada", 240, 490)
    ctx.fillStyle = "rgba(248,250,252,0.5)"
    ctx.font = "13px 'Segoe UI', sans-serif"
    ctx.fillText("[ESC] menu", 240, 514)
    ctx.textAlign = "left"
  }

  private renderPause() {
    const ctx = this.ctx
    this.dim()
    ctx.textAlign = "center"
    ctx.fillStyle = "#f8fafc"
    ctx.font = "bold 46px 'Segoe UI', sans-serif"
    ctx.fillText("PAUSADO", W / 2, H / 2 - 20)
    ctx.font = "16px 'Segoe UI', sans-serif"
    ctx.fillStyle = "rgba(248,250,252,0.75)"
    ctx.fillText("[ESC] continuar   ·   [R] recomeçar   ·   [M] menu", W / 2, H / 2 + 24)
    ctx.textAlign = "left"
  }

  private renderGameOver() {
    const ctx = this.ctx
    this.dim(0.6)
    ctx.textAlign = "center"
    ctx.fillStyle = "#ef4444"
    ctx.font = "900 56px 'Segoe UI', sans-serif"
    ctx.fillText("BATEU!", W / 2, 150)
    ctx.fillStyle = "#f8fafc"
    ctx.font = "bold 30px 'Segoe UI', sans-serif"
    ctx.fillText(`${Math.floor(this.score).toLocaleString("pt-BR")} pontos`, W / 2, 210)
    ctx.font = "16px 'Segoe UI', sans-serif"
    ctx.fillStyle = "rgba(248,250,252,0.7)"
    ctx.fillText(`${this.km.toFixed(1)} km percorridos`, W / 2, 240)

    ctx.fillStyle = "rgba(253,224,71,0.9)"
    ctx.font = "bold 15px 'Segoe UI', sans-serif"
    ctx.fillText("— TOP 5 —", W / 2, 300)
    ctx.font = "14px 'Segoe UI', sans-serif"
    this.scores.forEach((s, i) => {
      ctx.fillStyle = "rgba(248,250,252,0.8)"
      ctx.fillText(`${i + 1}. ${s.name || "???"} — ${s.score.toLocaleString("pt-BR")} (${s.km} km)`, W / 2, 326 + i * 22)
    })

    ctx.fillStyle = "#fde047"
    ctx.font = "bold 19px 'Segoe UI', sans-serif"
    ctx.fillText("[ENTER/CLIQUE] correr de novo   ·   [G] garagem   ·   [M] menu", W / 2, 480)
    ctx.textAlign = "left"
  }

  private renderNameEntry() {
    const ctx = this.ctx
    this.dim(0.7)
    ctx.textAlign = "center"
    ctx.fillStyle = "#fde047"
    ctx.font = "900 44px 'Segoe UI', sans-serif"
    ctx.fillText("★ NOVO RECORDE! ★", W / 2, 170)
    ctx.fillStyle = "#f8fafc"
    ctx.font = "bold 28px 'Segoe UI', sans-serif"
    ctx.fillText(`${this.pendingScore ? this.pendingScore.score.toLocaleString("pt-BR") : 0} pontos`, W / 2, 220)
    ctx.font = "16px 'Segoe UI', sans-serif"
    ctx.fillStyle = "rgba(248,250,252,0.75)"
    ctx.fillText("digite seu nome:", W / 2, 280)
    const cursor = Math.floor(performance.now() / 400) % 2 === 0 ? "▌" : " "
    ctx.fillStyle = "#f8fafc"
    ctx.font = "bold 34px 'Consolas', monospace"
    ctx.fillText(this.nameBuf + cursor, W / 2, 330)
    ctx.fillStyle = "rgba(248,250,252,0.5)"
    ctx.font = "14px 'Segoe UI', sans-serif"
    ctx.fillText("[ENTER] salvar", W / 2, 380)
    ctx.textAlign = "left"
  }

  // ---------- input ----------
  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault()
    this.audio.ensure()

    if (this.state === "nameentry") {
      if (k === "enter") {
        if (this.pendingScore) {
          this.pendingScore.name = this.nameBuf.trim() || "PILOTO"
          this.scores = saveScore(this.pendingScore)
          this.pendingScore = null
        }
        this.state = "gameover"
      } else if (k === "backspace") this.nameBuf = this.nameBuf.slice(0, -1)
      else if (/^[a-z0-9 _-]$/i.test(e.key) && this.nameBuf.length < 12) this.nameBuf += e.key.toUpperCase()
      return
    }

    this.keys.add(k)
    if (k === " ") this.nitroOn = true
    if (k === "m" && (this.state === "racing" || this.state === "countdown")) return // M = menu só em telas paradas

    switch (this.state) {
      case "menu":
        if (k === "enter") { this.state = "garage"; this.audio.ui() }
        break
      case "garage": {
        const custom = this.cfg.customs[this.cfg.carIdx]
        if (k === "arrowleft") { this.cfg.carIdx = (this.cfg.carIdx + CARS.length - 1) % CARS.length; this.audio.ui() }
        if (k === "arrowright") { this.cfg.carIdx = (this.cfg.carIdx + 1) % CARS.length; this.audio.ui() }
        if (k === "c") { custom.paint = (custom.paint + 1) % PAINTS.length; this.audio.ui() }
        if (k === "v") { custom.stripe = (custom.stripe + 1) % STRIPES.length; this.audio.ui() }
        if (k === "b") { custom.neon = (custom.neon + 1) % NEONS.length; this.audio.ui() }
        if (k === "t") { this.cfg.transmission = this.cfg.transmission === "auto" ? "manual" : "auto"; this.audio.ui() }
        if (k === "y") { this.cfg.steering = this.cfg.steering === "mouse" ? "keyboard" : "mouse"; this.audio.ui() }
        if (["c", "v", "b", "t", "y"].includes(k) || k.startsWith("arrow")) saveConfig(this.cfg)
        if (k === "enter") startAndSave(this)
        if (k === "escape") this.state = "menu"
        break
      }
      case "racing":
      case "countdown":
        if (k === "escape" || k === "p") { this.state = "paused"; this.audio.uiLow() }
        if (k === "q") this.tryShift(-1)
        if (k === "e") this.tryShift(1)
        if (k === "n") this.toNeutral()
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
    this.audio.ensure()
    if (e.button === 0) {
      if (this.state === "racing" || this.state === "countdown") this.mouseGas = true
      else if (this.state === "menu") { this.state = "garage"; this.audio.ui() }
      else if (this.state === "gameover") this.startRace()
      else if (this.state === "garage") { saveConfig(this.cfg); this.startRace() }
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
  }
  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    if (this.state !== "racing" && this.state !== "countdown") return
    this.tryShift(e.deltaY < 0 ? 1 : -1)
  }
  private onCtx = (e: Event) => e.preventDefault()
  private onBlur = () => { if (this.state === "racing") this.state = "paused" }

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

function mixRgb(rgbStr: string, hexFog: string, p: number): string {
  // rgbStr no formato rgb(r,g,b)
  const m = rgbStr.match(/\d+/g)
  if (!m) return rgbStr
  const f = hexToRgb(hexFog)
  return `rgb(${Math.round(+m[0] + (f[0] - +m[0]) * p)},${Math.round(+m[1] + (f[1] - +m[1]) * p)},${Math.round(+m[2] + (f[2] - +m[2]) * p)})`
}

/** Carro do jogador visto de trás, com pintura/faixa/neon e inclinação ao esterçar. */
function drawPlayerCar(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, spec: CarSpec,
  paintIdx: number, stripeIdx: number, neonIdx: number,
  steer: number, braking: boolean, amb: number, nitro: boolean, scale = 1,
) {
  const w = spec.width * 640 * scale
  const h = w * 0.62
  const paint = PAINTS[paintIdx]
  const body = shade(paint, Math.max(0.5, amb))
  const dark = shade(paint, Math.max(0.3, amb * 0.55))

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(steer * 0.05)

  // neon
  if (neonIdx > 0) {
    const neon = NEONS[neonIdx]
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
  // pneus
  ctx.fillStyle = "#0a0a0c"
  rr(ctx, bx - w * 0.045, -h * 0.34, w * 0.09, h * 0.34, w * 0.02)
  rr(ctx, bx + w - w * 0.045, -h * 0.34, w * 0.09, h * 0.34, w * 0.02)

  // carroceria
  ctx.fillStyle = body
  if (spec.body === "muscle") {
    rr(ctx, bx, by, w, h * 0.98, w * 0.10)
    ctx.fillStyle = dark // para-lamas largos
    rr(ctx, bx - w * 0.02, by + h * 0.55, w * 0.12, h * 0.4, w * 0.04)
    rr(ctx, bx + w * 0.90, by + h * 0.55, w * 0.12, h * 0.4, w * 0.04)
  } else if (spec.body === "ghost") {
    ctx.beginPath()
    ctx.moveTo(0, by)
    ctx.lineTo(bx + w, by + h * 0.22)
    ctx.lineTo(bx + w, by + h * 0.9)
    ctx.lineTo(bx + w * 0.88, -0.5)
    ctx.lineTo(bx + w * 0.12, -0.5)
    ctx.lineTo(bx, by + h * 0.9)
    ctx.lineTo(bx, by + h * 0.22)
    ctx.closePath()
    ctx.fill()
  } else {
    rr(ctx, bx, by, w, h * 0.98, spec.body === "ninja" ? w * 0.16 : w * 0.10)
  }

  // faixas
  ctx.fillStyle = "rgba(255,255,255,0.35)"
  if (stripeIdx === 1) ctx.fillRect(-w * 0.05, by + 2, w * 0.10, h * 0.9)
  if (stripeIdx === 2) { ctx.fillRect(-w * 0.11, by + 2, w * 0.07, h * 0.9); ctx.fillRect(w * 0.04, by + 2, w * 0.07, h * 0.9) }
  if (stripeIdx === 3) { ctx.fillRect(bx + w * 0.04, by + 2, w * 0.06, h * 0.9); ctx.fillRect(bx + w * 0.90, by + 2, w * 0.06, h * 0.9) }

  // vidro traseiro
  ctx.fillStyle = shade("#0f172a", Math.max(0.6, amb))
  rr(ctx, bx + w * 0.15, by + h * 0.10, w * 0.70, h * 0.26, w * 0.06)

  // aerofólio
  if (spec.body === "gt" || spec.body === "ghost") {
    ctx.fillStyle = dark
    rr(ctx, bx - w * 0.03, by - h * 0.08, w * 1.06, h * 0.075, w * 0.03)
    ctx.fillRect(bx + w * 0.12, by - h * 0.02, w * 0.05, h * 0.10)
    ctx.fillRect(bx + w * 0.83, by - h * 0.02, w * 0.05, h * 0.10)
  }
  if (spec.body === "muscle") { // entrada de ar
    ctx.fillStyle = dark
    rr(ctx, -w * 0.14, by + h * 0.42, w * 0.28, h * 0.12, w * 0.03)
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
  ctx.font = `bold ${Math.max(6, h * 0.06)}px 'Segoe UI', sans-serif`
  ctx.textAlign = "center"
  ctx.fillText("AUTOHUB", 0, -h * 0.093)
  ctx.textAlign = "left"

  ctx.restore()
}
