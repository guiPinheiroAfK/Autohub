import { CANVAS_W, CANVAS_H, CAM_HEIGHT, CAM_DEPTH, type GameConfig, loadConfig, type ScoreEntry, cachedScores, RPM_IDLE, type BodyKind, CARS, KMH2UPS, RPM_LIMITER, GEAR_RATIOS, SEG_LEN, RPM_PER_KMH, DRAW_DIST, submitScore, fetchLeaderboard, saveConfig } from "./data"
import { type DuelTelemetry, postState } from "./net"
import { AudioBus } from "./audio"
import { type Traffic } from "./traffic/types"
import { RaceSession } from "./race/session"
import { noCallout, buildTouchControls, onTouchStart, onTouchMove } from "./input/touch"
import { buildTrack, segAt } from "./world/track"
import { seedTraffic, updateTraffic, wrapDz } from "./traffic/spawner"
import { clamp, mix } from "./math"
import { updateEventSpawner } from "./world/events"
import { duelNet, myTelemetry, duelFinish, duelCreate, duelJoin, duelRematch, startDuelLobby } from "./modes/duel"
import { startRace } from "./modes/race"
import { updateFx, emitSmoke, emitFlame, burst, initRain } from "./fx/particles"
import { rpmFor, powerCurve } from "./physics/rpm"
import { shiftUp, shiftDown } from "./physics/gearbox"
import { updateZones } from "./world/zones"
import { updateObstacles } from "./world/obstacles"
import { skyNow, renderBackdrop } from "./render/backdrop"
import { renderRoad } from "./render/road"
import { renderPlayer, renderRearThreat } from "./render/player"
import { renderParticles } from "./render/particles"
import { renderMenu, renderGarage, renderPause, renderGameOver, renderNameEntry, dim } from "./render/menus/main"
import { renderHud, renderSemaphore } from "./render/hud"
import { renderTrackPreview, renderRaceLobby, renderRaceCode, renderRaceWait, renderRaceResult } from "./render/menus/race"
import { glass, pill } from "./ui/widgets"
import { onKeyDown, onKeyUp } from "./input/keyboard"
import { onMouseDown, onMouseUp, onMouseMove, onWheel, onCtx } from "./input/pointer"

// AutoDash — engine pseudo-3D (estilo NFS de PSP) em Canvas 2D puro.
// Estrada por segmentos projetados, tráfego, clima, câmbio com RPM e ranking local.

export const W = CANVAS_W, H = CANVAS_H
export const PLAYER_Z = CAM_HEIGHT * CAM_DEPTH
export const RUMBLE = 3
// Veículo mais perto que isso não tem nem o topo do sprite dentro da tela
// (a base projeta muito abaixo da borda) — não vale emitir.
export const NEAR_SPRITE_MIN = 300
// Fade curtíssimo logo acima do mínimo, só pra tirar o degrau do primeiro pixel.
// A entrada de verdade é geométrica: o carro SOBE pela borda de baixo conforme
// se aproxima, então não precisa (nem deve) ficar translúcido em cena.
export const FADE_IN_START = NEAR_SPRITE_MIN
export const FADE_IN_LEN = 90

type GameState =
    | "menu" | "garage" | "countdown" | "racing" | "paused" | "gameover" | "nameentry"
    | "duellobby" | "duelcode" | "duelwaiting" | "duelspectate" | "duelresult"
    | "racelobby" | "racecode" | "racewait" | "raceresult"

export interface DuelSession {
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


export interface Seg { curve: number; y1: number; y2: number; sign?: number }

// Tipos e IAs do tráfego migraram pra ./traffic/ (types.ts + driver.ts).
// O engine só cuida da colisão/pontuação/render/reciclagem.

// Obstáculo físico na pista (cones, barreiras). Cone é perdoável (tranco);
// barreira é parede. Base do futuro modo corrida.
export interface Obstacle { z: number; offset: number; kind: "cone" | "barrier"; w: number; len: number; prevD?: number; dead?: boolean }
// Zona de evento no traçado:
//  bridge    — ponte suspensa (estilo Golden Gate): você dirige EM CIMA, com
//              guarda-corpo, torres e água dos dois lados
//  viaduct   — viaduto cruzando por cima; carros saem dele e fazem merge
//  wrongway  — mão dupla: as 2 faixas da esquerda viram contramão; o trânsito
//              do seu sentido se adapta pras 2 da direita
//  blitz     — bloqueio policial: TODO MUNDO desce pra ~60; furar = perseguição
//  speedtrap — radar (placa 90): trânsito reduz, polícia observando; passar
//              rápido demais = perseguição (o evento da conversa original)
interface Zone { type: "bridge" | "viaduct" | "wrongway" | "blitz" | "speedtrap"; z: number; end: number; spawnT: number; checked?: boolean }
export interface RoadSign { z: number; type: "limit90" | "limit60" | "wrongway" | "bridgewarn" | "works" | "merge"; label?: string }

export const PU_NITRO = 0, PU_SHIELD = 1, PU_X2 = 2
export interface Pickup { z: number; offset: number; type: number; pulse: number; taken?: boolean }

interface Particle { x: number; y: number; vx: number; vy: number; size: number; life: number; maxLife: number; color: string }
interface Floater { text: string; color: string; y: number; life: number; big: boolean }
interface Drop { x: number; y: number; len: number; spd: number }

// paletas de céu por hora do dia (t = fração do ciclo)
export const SKY_KEYS = [
  { t: 0.125, top: "#2b8fd6", bot: "#bfe6f7", amb: 1.0 },
  { t: 0.375, top: "#3b2a63", bot: "#fb923c", amb: 0.8 },
  { t: 0.625, top: "#050816", bot: "#16233f", amb: 0.42 },
  { t: 0.875, top: "#33507c", bot: "#fcd9a0", amb: 0.78 },
]


export class AutoDashEngine {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  audio = new AudioBus()
  cfg: GameConfig = loadConfig()
  scores: ScoreEntry[] = cachedScores()

  state: GameState = "menu"
  raf = 0
  lastT = 0
  destroyed = false

  // pista
  segments: Seg[] = []
  trackLen = 0

  // jogador
  position = 0
  speed = 0            // km/h
  playerX = 0          // -1..1 (fração da meia-pista)
  gear = 1             // 0 = neutro
  rpm = RPM_IDLE
  shiftT = 0
  wheelspinT = 0
  bogT = 0
  nitroMeter = 0
  nitroOn = false
  offroadT = 0
  steerVel = 0
  shield = false
  mult2T = 0
  level = 0
  levelUpT = 0

  // corrida
  score = 0
  km = 0
  combo = 0
  comboT = 0
  countT = 0
  greenAt = 0
  greenFired = false
  goFlashT = 0
  shakeT = 0
  crashed = false
  crashByPolice = false // a batida foi contra uma viatura? (muda o texto do game over)

  // mundo
  traffic: Traffic[] = []
  obstacles: Obstacle[] = []
  zones: Zone[] = []
  roadSigns: RoadSign[] = []
  powerups: Pickup[] = []
  puTimer = 6
  eventTimer = 12 // s até o próximo evento de mapa sorteado
  bgShift = 0
  curveWarn = 0
  curveWarnDist = 0
  curveBeepT = 0
  collWarn: Traffic | null = null
  collBeepT = 0
  immuneT = 0 // invulnerabilidade pós-escudo — vale contra TUDO
  policeHitT = 0 // cooldown pós-encostão — vale SÓ contra viatura
  policeEscapeT = 0 // tempo mantendo distância da polícia (protótipo do "despiste")
  policeChaseT = 0 // duração da perseguição atual — despiste só vale após o aquecimento
  particles: Particle[] = []
  floaters: Floater[] = []
  drops: Drop[] = []
  clouds = Array.from({ length: 6 }, (_, i) => ({
    x: (i * 173) % W, y: 26 + (i * 61) % 130, s: 34 + (i * 37) % 44,
  }))
  // vinheta cacheada (gradiente por frame é caro; drawImage é barato)
  vignetteSprite: HTMLCanvasElement | null = null

  vignetteTex(): HTMLCanvasElement {
    if (this.vignetteSprite) return this.vignetteSprite
    const cv = document.createElement("canvas")
    cv.width = W; cv.height = H
    const c = cv.getContext("2d")!
    const vg = c.createRadialGradient(W / 2, H * 0.55, H * 0.38, W / 2, H * 0.55, H * 0.95)
    vg.addColorStop(0, "rgba(0,0,0,0)")
    vg.addColorStop(1, "rgba(0,0,0,0.38)")
    c.fillStyle = vg
    c.fillRect(0, 0, W, H)
    this.vignetteSprite = cv
    return cv
  }
  // halo warm das luminárias da ponte, cacheado pelo mesmo motivo da vinheta
  // brilho neon por cor, pré-renderizado UMA vez. createRadialGradient por
  // desenho era o gargalo do modo corrida: ~1600 gradientes/frame com as
  // fachadas de Tokyo. drawImage de um sprite pronto é ordens de grandeza
  // mais barato.
  glowCache = new Map<string, HTMLCanvasElement>()
  neonGlow(cor: string): HTMLCanvasElement {
    const hit = this.glowCache.get(cor)
    if (hit) return hit
    const cv = document.createElement("canvas")
    cv.width = 64; cv.height = 64
    const c = cv.getContext("2d")!
    const g = c.createRadialGradient(32, 32, 1, 32, 32, 32)
    g.addColorStop(0, cor + "cc")
    g.addColorStop(0.45, cor + "55")
    g.addColorStop(1, cor + "00")
    c.fillStyle = g
    c.fillRect(0, 0, 64, 64)
    this.glowCache.set(cor, cv)
    return cv
  }
  glowSprite: HTMLCanvasElement | null = null
  glowTex(): HTMLCanvasElement {
    if (this.glowSprite) return this.glowSprite
    const cv = document.createElement("canvas")
    cv.width = 64; cv.height = 64
    const c = cv.getContext("2d")!
    const g = c.createRadialGradient(32, 32, 2, 32, 32, 32)
    g.addColorStop(0, "rgba(255,233,168,0.4)")
    g.addColorStop(1, "rgba(255,233,168,0)")
    c.fillStyle = g
    c.fillRect(0, 0, 64, 64)
    this.glowSprite = cv
    return cv
  }
  raining = false
  rainT = 0
  rainRollT = 0
  demoT = 0

  // input
  keys = new Set<string>()
  mouseGas = false
  mouseBrake = false
  mouseXn = 0.5
  mousePx = { x: -1, y: -1 }
  uiRegions: { x: number; y: number; w: number; h: number; act: () => void }[] = []
  nameBuf = ""
  afterName: "garage" | "duellobby" = "garage"
  mode: "solo" | "duel" | "race" = "solo"
  race: RaceSession | null = null
  raceVoltas = 3
  raceBots = 3
  raceFinished = false // já cruzei a linha (coast + espectador)
  raceSpectT = 0       // tempo assistindo os rivais terminarem
  raceErro: string | null = null
  duel: DuelSession | null = null
  codeBuf = ""
  prevState: GameState = "menu"
  fadeT = 0
  newRecord = false
  beamT = 0
  beamCdT = 0
  pitchY = 0

  // touch (celular) — nil na maioria dos campos até buildTouchControls() rodar
  isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0
  touchThrottle = false
  touchBrake = false
  touchSteerLeft = false
  touchSteerRight = false
  touchControlsEl: HTMLDivElement | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("canvas 2d indisponível")
    this.ctx = ctx
    // sem isso, arrastar o dedo pra dirigir também rola/zoom a página por
    // baixo do jogo
    this.canvas.style.touchAction = "none"
    // toque longo no celular abria o menu "Salvar/Copiar imagem" por cima do
    // jogo — é o callout de imagem. Desliga seleção, callout e realce de toque.
    noCallout(this, this.canvas)
    buildTrack(this)
    seedTraffic(this, 14)
    this.bind()
    if (this.isTouch) buildTouchControls(this)
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
    this.touchControlsEl?.remove()
  }

  // ---------- pista ----------
  /**
   * `corrida` gera um traçado de CIRCUITO: mais curto (pra fechar voltas em
   * tempo razoável), com curvas bem mais bravas e retas de respiro entre elas.
   * No modo corrida o desafio tem que vir do traçado, não de desviar de carro —
   * por isso lá o trânsito também é bem mais leve.
   */


  // ---------- tráfego ----------
  laneCenters = [-0.75, -0.25, 0.25, 0.75]



  /**
   * Materializa um evento de mapa à frente do jogador. Chamado pelo sorteio
   * natural (updateEventSpawner) e pelas teclas de debug do playtest
   * (B ponte · V viaduto · J obstáculos · K mão dupla · I blitz · U radar).
   */




  /**
   * Sorteia os eventos de mapa ao longo da corrida — é o que faz ponte, viaduto,
   * obstáculos, mão dupla, blitz e radar aparecerem SOZINHOS, sem tecla de debug.
   * Também poda o que já ficou pra trás: zonas/placas se acumulavam pra sempre.
   */

  /**
   * Zonas de evento: mão dupla spawnando contramão (e espremendo o trânsito na
   * direita), blitz/radar reduzindo o trânsito e checando a sua velocidade.
   */







  /** Caráter sonoro por carroceria: [pitch, brilho]. Grave/encorpado (V grande)
   *  → agudo/metálico (rotativo, boxer, 4-cil de giro alto). */
  static readonly ENGINE_VOICE: Record<BodyKind, [number, number]> = {
    muscle: [0.80, 0.82], apex: [0.84, 0.86],                 // V grande, grave
    gt: [1.0, 1.0], ghost: [0.98, 1.05], zcoupe: [1.0, 1.0],  // 6-cil equilibrado
    kaiju: [0.95, 1.1], alta: [1.0, 0.98],
    ninja: [1.15, 1.12], sylva: [1.16, 1.1],                  // 4-cil ágil
    roadster: [1.22, 1.05],
    rotor: [1.30, 1.4],                                       // rotativo estridente
    flat6: [1.08, 1.3],                                       // boxer metálico
  }

  update(dt: number) {
    const spec = CARS[this.cfg.carIdx]
    const voice = AutoDashEngine.ENGINE_VOICE[spec.body] ?? [1, 1]
    this.audio.setEngine(voice[0], voice[1])

    duelNet(this, dt)

    // sala de espera: consulta quem entrou e detecta a largada dada pelo dono
    if (this.state === "racewait" && this.race) {
      this.race.update(dt, 0, 0, 0, false, this.trackLen)
      if (this.race.phase === "countdown") { startRace(this, this.race.cfg.seed) }
    }

    if (["menu", "garage", "duellobby", "duelcode", "duelwaiting", "duelresult",
      "racelobby", "racecode", "racewait", "raceresult"].includes(this.state)) {
      // demo: câmera passeia pela pista
      this.demoT += dt
      this.speed = 95
      this.position = (this.position + this.speed * KMH2UPS * dt) % this.trackLen
      this.playerX = Math.sin(this.demoT * 0.3) * 0.2
      this.bgShift += segAt(this, this.position + PLAYER_Z).curve * this.speed * dt * 0.6
      updateTraffic(this, dt, this.position + PLAYER_Z, true)
      updateFx(this, dt) // floaters/partículas sobrando da corrida ainda precisam morrer
      this.audio.engine(0, 0, false, false)
      return
    }
    if (this.state === "paused" || this.state === "gameover" || this.state === "nameentry" || this.state === "duelspectate") {
      updateFx(this, dt)
      this.audio.engine(0, 0, false, false)
      this.audio.skid(0)
      return
    }

    let throttle = this.mouseGas || this.touchThrottle || this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0
    const braking = this.mouseBrake || this.touchBrake || this.keys.has("s") || this.keys.has("arrowdown")
    // corrida terminada: neutro, gás cortado — o carro faz a volta de
    // desaceleração e não pode mais acelerar (bug: a física acelerava antes de
    // o bloco de chegada zerar a marcha)
    if (this.raceFinished) throttle = 0

    if (this.state === "countdown") {
      this.countT += dt
      // rev livre no grid
      const targetRpm = RPM_IDLE + throttle * (7500 - RPM_IDLE)
      this.rpm += (targetRpm - this.rpm) * Math.min(1, dt * 5)
      if (this.rpm > RPM_LIMITER) this.rpm = RPM_LIMITER - Math.random() * 300
      // burnout no grid: acelerando no ponto morto, pneu fuma (só na corrida)
      if (this.mode === "race" && throttle > 0.5 && this.rpm > 4500 && Math.random() < 0.6) {
        emitSmoke(this, 2, "#d8dbe2")
      }
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
      updateFx(this, dt)
      return
    }

    // ---------- racing ----------
    const grip = spec.grip * (this.raining ? 0.62 : 1)
    const playerZ = this.position + PLAYER_Z
    const seg = segAt(this, playerZ)

    // direção — input suavizado, mais firme em alta velocidade
    let steerInput = 0
    if (this.cfg.steering === "mouse") {
      steerInput = clamp(((this.mouseXn * 2 - 1) * 1.25 - this.playerX) * 2.2, -1, 1)
    } else {
      if (this.keys.has("a") || this.keys.has("arrowleft") || this.touchSteerLeft) steerInput -= 1
      if (this.keys.has("d") || this.keys.has("arrowright") || this.touchSteerRight) steerInput += 1
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
    if (slip > 0.45 && Math.abs(this.steerVel) > 0.3 && Math.random() < 0.5) emitSmoke(this, 1, "#6b7280")
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
      emitSmoke(this, 3, "#a3a3a3")
    } else this.offroadT = 0
    this.playerX = clamp(this.playerX, -1.6, 1.6)

    // ---------- motor ----------
    if (this.shiftT > 0) this.shiftT -= dt
    if (this.wheelspinT > 0) this.wheelspinT -= dt
    if (this.bogT > 0) this.bogT -= dt

    if (this.gear >= 1) this.rpm = rpmFor(this, this.speed, this.gear)
    else {
      const targetRpm = RPM_IDLE + throttle * (7500 - RPM_IDLE)
      this.rpm += (targetRpm - this.rpm) * Math.min(1, dt * 5)
    }

    // câmbio automático
    if (this.cfg.transmission === "auto" && this.gear >= 1 && this.shiftT <= 0) {
      if (throttle && this.rpm > 6900 && this.gear < 6) shiftUp(this)
      else if (this.rpm < 2000 && this.gear > 1) shiftDown(this)
    }

    let accel = 0
    if (this.gear >= 1 && throttle && this.shiftT <= 0) {
      const gearF = Math.pow(GEAR_RATIOS[this.gear - 1] / GEAR_RATIOS[0], 0.9)
      accel = spec.power * powerCurve(this, this.rpm) * gearF
      if (this.rpm >= RPM_LIMITER - 50) { accel = 0; if (Math.random() < 0.4) this.audio.limiter() }
      if (this.wheelspinT > 0) { accel *= 0.35; emitSmoke(this, 2, "#e2e8f0") }
      if (this.bogT > 0) accel *= 0.5
    }
    if (this.nitroOn && this.nitroMeter > 1 && this.gear >= 1) {
      accel += 42
      this.nitroMeter = Math.max(0, this.nitroMeter - 38 * dt)
      emitFlame(this)
    }
    const nitroActive = this.nitroOn && this.nitroMeter > 1

    this.speed += accel * dt
    if (braking) this.speed -= (this.raining ? 78 : 105) * dt
    this.speed -= (5 + this.speed * 0.028) * dt // arrasto

    // FÍSICA DE LADEIRA: descida empurra o carro (dá pra passar do top speed —
    // segura no freio), subida cobra potência. O limite por marcha logo abaixo
    // age como freio motor: descer em marcha baixa segura o carro sozinho.
    const grade = (seg.y2 - seg.y1) / SEG_LEN // ~±0.13 nas ladeiras fortes
    if (grade < 0) this.speed += -grade * 210 * dt
    else this.speed -= grade * 120 * dt

    const maxSpd = spec.topSpeed * (nitroActive ? 1.12 : 1) + (grade < 0 ? -grade * 420 : 0)
    this.speed = clamp(this.speed, 0, maxSpd)
    // limite por marcha (estourou o giro = não anda mais) — e freio motor na descida
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
    if (newLevel > this.level && this.mode != "race") {
      this.level = newLevel
      this.levelUpT = 1.5
      this.audio.levelUp()
      this.floaters.push({ text: `NÍVEL ${newLevel + 1} — TRÂNSITO MAIS BRAVO!`, color: "#fb923c", y: H * 0.32, life: 2.2, big: true })
    }
    if (this.levelUpT > 0) {
      this.levelUpT -= dt
      if (Math.random() < 0.6) emitSmoke(this, 2, "#e2e8f0")
    }

    // modo corrida: adianta bots/rede, conta voltas e aplica o empurrão entre
    // carros (autoridade local — eu me afasto, o cliente dele faz o mesmo)
    if (this.race && this.mode === "race") {
      const r = this.race
      const voltaAntes = r.lap
      // os bots enxergam o MESMO trânsito que você: sem isso eles atravessavam
      // os carros e nunca eram segurados, então sumiam na frente
      r.update(dt, playerZ, this.speed, this.playerX, this.crashed, this.trackLen, {
        aFrente: (z, x, alcance) => {
          let melhor: { dz: number; v: number } | null = null
          for (const t of this.traffic) {
            if (t.role === "oncoming") continue
            const dz = wrapDz(this, t.z, z)
            if (dz <= 0 || dz > alcance) continue
            if (Math.abs(t.offset - x) > 0.32) continue
            if (!melhor || dz < melhor.dz) melhor = { dz, v: t.speed }
          }
          return melhor
        },
        faixaLivre: (z, x, alcance) => {
          for (const t of this.traffic) {
            if (Math.abs(wrapDz(this, t.z, z)) > alcance) continue
            if (Math.abs(t.offset - x) < 0.3 || Math.abs(t.targetOffset - x) < 0.3) return false
          }
          return true
        },
      })
      // cruzou a linha: anúncio grande, som e tremida — o jogador tem que
      // SENTIR que fechou uma volta, não descobrir olhando o placar
      // não anuncia na chegada: ali o lap vira voltas+1 e sairia "VOLTA 4/3"
      if (r.lap > voltaAntes && !r.finished) {
        const ultima = r.lap === r.cfg.voltas - 1
        this.floaters.push({
          text: ultima ? "ÚLTIMA VOLTA!" : `VOLTA ${r.lap + 1}/${r.cfg.voltas}`,
          color: ultima ? "#ef4444" : "#fde047", y: H * 0.3, life: 2.2, big: true,
        })
        this.floaters.push({
          text: `${r.minhaPosicao()}º lugar`,
          color: "#f8fafc", y: H * 0.38, life: 2, big: false,
        })
        this.audio.levelUp()
        this.shakeT = Math.max(this.shakeT, 0.18)
      }
      if (!this.crashed && this.immuneT <= 0) {
        const spec0 = CARS[this.cfg.carIdx]
        const shove = r.empurrao(playerZ, this.playerX, (0.28 + spec0.width) / 2, this.trackLen)
        if (shove !== 0) {
          this.playerX += shove
          this.steerVel += shove * 8
          this.speed *= 0.94
          this.shakeT = Math.max(this.shakeT, 0.3)
          this.immuneT = 0.5
          this.audio.crash()
          burst(this, W / 2 + Math.sign(shove) * 60, H - 110, 12, ["#fde047", "#e2e8f0"])
        }
      }
      // Cruzou a linha: ponto morto, coast até parar, e vira ESPECTADOR dos
      // rivais até a corrida acabar de verdade. NÃO retorna — o mundo continua
      // rodando (rivais correndo, seu carro desacelerando).
      if (r.finished) {
        if (!this.raceFinished) {
          this.raceFinished = true
          this.raceSpectT = 0
          this.gear = 0
          this.nitroOn = false
          this.floaters.push({ text: "🏁 CHEGOU!", color: "#fde047", y: H * 0.3, life: 2.4, big: true })
          this.floaters.push({ text: `${r.minhaPosicao()}º lugar`, color: "#f8fafc", y: H * 0.38, life: 2.4, big: false })
        }
        this.raceSpectT += dt
        // vai pro pódio quando TODOS os rivais terminam (ou um teto de 22 s pra
        // não travar se alguém ficar pra trás)
        const todosAcabaram = r.rivais.length > 0 && r.rivais.every((rv) => rv.finished)
        if (todosAcabaram || this.raceSpectT > 22) { this.state = "raceresult"; this.fadeT = 0.22 }
      }
    }

    updateEventSpawner(this, dt, playerZ)

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
      const d = wrapDz(this, p.z, playerZ)
      if (!p.taken && Math.abs(d) < 160 && Math.abs(p.offset - this.playerX) < 0.30) {
        p.taken = true
        this.audio.pickup()
        if (p.type === PU_NITRO) { this.nitroMeter = Math.min(100, this.nitroMeter + 40); this.floaters.push({ text: "+NOS", color: "#38bdf8", y: H * 0.45, life: 1, big: false }) }
        if (p.type === PU_SHIELD) { this.shield = true; this.floaters.push({ text: "ESCUDO!", color: "#60a5fa", y: H * 0.45, life: 1, big: false }) }
        if (p.type === PU_X2) { this.mult2T = 8; this.floaters.push({ text: "PONTOS EM DOBRO!", color: "#fde047", y: H * 0.45, life: 1.2, big: false }) }
      }
    }
    this.powerups = this.powerups.filter(p => !p.taken && wrapDz(this, p.z, this.position) > -20 * SEG_LEN)

    // fumaça de escape / arrancada
    if (throttle && this.speed < 40 && this.gear >= 1) emitSmoke(this, 2, "#cbd5e1")
    else if (throttle && Math.random() < 0.3) emitSmoke(this, 1, "#64748b")

    // clima
    this.rainRollT += dt
    if (this.rainRollT > 18) {
      this.rainRollT = 0
      if (!this.raining && Math.random() < 0.18) { this.raining = true; this.rainT = 22 + Math.random() * 20; initRain(this); this.audio.rain(true) }
    }
    if (this.raining) {
      this.rainT -= dt
      if (this.rainT <= 0) { this.raining = false; this.audio.rain(false) }
    }

    updateTraffic(this, dt, playerZ, false)
    updateZones(this, dt, playerZ)
    updateObstacles(this, playerZ)

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
      const d = wrapDz(this, t.z, playerZ)
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

    updateFx(this, dt)
    this.audio.engine(this.rpm, throttle, nitroActive, true)
  }

  launch() {
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


  crash(byPolice = false) {
    // NA CORRIDA NÃO SE MORRE: bater custa quase toda a velocidade e o tempo
    // de retomar — que numa disputa por voltas já é punição suficiente. Encerrar
    // a prova por uma batida tirava o jogador da corrida inteira.
    if (this.mode === "race" && this.race && !this.race.finished) {
      this.speed *= 0.1
      this.steerVel = 0
      this.wheelspinT = 0.5
      this.combo = 0
      this.shakeT = 0.55
      this.immuneT = Math.max(this.immuneT, 1.3) // respiro pra não bater em cadeia
      this.audio.crash()
      burst(this, W / 2, H - 110, 30, ["#fb923c", "#ef4444"])
      this.floaters.push({ text: "RODOU!", color: "#fb923c", y: H * 0.4, life: 1.3, big: true })
      return
    }
    this.crashed = true
    this.crashByPolice = byPolice
    this.audio.crash()
    this.shakeT = 0.6
    burst(this, W / 2, H - 110, 40, ["#fb923c", "#ef4444"])
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
      void postState(d.code, d.role, myTelemetry(this, true))
          .then((r) => { if (r.opp) { d.opp = r.opp; d.oppD = r.opp.d; d.lastSeen = performance.now() } })
          .catch(() => { /* spectate segue tentando */ })
      if (d.opp?.c) duelFinish(this, this.km > d.oppD)
      else this.state = "duelspectate"
      return
    }

    this.state = "gameover"
  }

  async refreshScores() {
    const scores = await fetchLeaderboard()
    if (!this.destroyed && scores.length) this.scores = scores
  }












  // ---------- render ----------
  render() {
    const ctx = this.ctx
    this.uiRegions = []
    if (this.state !== this.prevState) {
      this.prevState = this.state
      this.fadeT = 0.22
    }
    this.audio.music(this.state === "racing" || this.state === "countdown")
    const sky = skyNow(this)
    const amb = sky.amb

    ctx.save()
    if (this.shakeT > 0) ctx.translate((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10)
    // trepidação de motor no grid da corrida: quanto mais giro, mais treme —
    // o carro "pedindo pra sair"
    if (this.mode === "race" && this.state === "countdown") {
      const rev = clamp((this.rpm - 3000) / 5000, 0, 1)
      ctx.translate((Math.random() - 0.5) * 3 * rev, (Math.random() - 0.5) * 2.4 * rev)
    }
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
    renderBackdrop(this, amb)

    renderRoad(this, amb, sky.bot)
    renderPlayer(this, amb)
    renderRearThreat(this)
    renderParticles(this)

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

    // vinheta — dá peso à imagem (sprite cacheado)
    ctx.drawImage(this.vignetteTex(), 0, 0)

    switch (this.state) {
      case "menu": renderMenu(this); break
      case "garage": renderGarage(this); break
      case "countdown":
        renderHud(this)
        // na corrida, a contagem serve pra estudar o traçado antes de largar
        if (this.mode === "race") renderTrackPreview(this)
        renderSemaphore(this)
        break
      case "racing": renderHud(this); if (this.mode === "race") this.renderRaceHud(); break
      case "paused": renderHud(this); renderPause(this); break
      case "gameover": renderGameOver(this); break
      case "nameentry": renderNameEntry(this); break
      case "duellobby": this.renderDuelLobby(); break
      case "duelcode": this.renderDuelCode(); break
      case "duelwaiting": this.renderDuelWaiting(); break
      case "duelspectate": this.renderDuelSpectate(); break
      case "duelresult": this.renderDuelResult(); break
      case "racelobby": renderRaceLobby(this); break
      case "racecode": renderRaceCode(this); break
      case "racewait": renderRaceWait(this); break
      case "raceresult": renderRaceResult(this); break
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



  /**
   * Metrópole de racha noturno: uma leva EXTRA de arranha-céus (mais altos e
   * densos) atrás do skyline base, com janelas em cores de neon e letreiros
   * piscando. Só na corrida — é o cenário que vende o clima.
   */
  /*private renderNeonCity(hz: number) {
    const ctx = this.ctx
    const wrap = W + 90
    // torres altas ao fundo (parallax mais lento = mais distantes)
    const NEON = ["#ff2d95", "#22d3ee", "#a855f7", "#facc15", "#38bdf8"]
    for (let i = 0; i < 40; i++) {
      const bw = 16 + ((i * 41) % 34)
      const bh = 40 + ((i * 71) % 120) // bem mais altos
      const bx = (((i * 53 - this.bgShift * 0.5) % wrap) + wrap) % wrap - 45
      const top = hz - bh + 4
      // silhueta escura com uma leve tinta roxa no topo
      ctx.fillStyle = i % 2 === 0 ? "#0f1424" : "#141026"
      ctx.fillRect(bx, top, bw, bh)
      // janelas acesas em cores variadas de neon
      const cor = NEON[(i * 3) % NEON.length]
      for (let wy = top + 8; wy < hz - 4; wy += 8) {
        for (let wx = bx + 3; wx < bx + bw - 3; wx += 7) {
          if (((i + wx + wy) * 2654435761) % 5 === 0) {
            ctx.fillStyle = (wx + wy) % 3 === 0 ? cor + "aa" : "rgba(253,224,71,0.5)"
            ctx.fillRect(wx, wy, 3, 4)
          }
        }
      }
      // letreiro de neon no topo de algumas torres, piscando devagar
      if (i % 5 === 2 && bw > 26) {
        const on = Math.floor(performance.now() / 700 + i) % 3 !== 0
        if (on) {
          ctx.fillStyle = cor
          ctx.fillRect(bx + 3, top - 6, bw - 6, 4)
          const g = ctx.createRadialGradient(bx + bw / 2, top - 4, 1, bx + bw / 2, top - 4, bw * 0.9)
          g.addColorStop(0, cor + "55"); g.addColorStop(1, cor + "00")
          ctx.fillStyle = g
          ctx.beginPath(); ctx.ellipse(bx + bw / 2, top - 4, bw * 0.9, 12, 0, 0, Math.PI * 2); ctx.fill()
        }
      }
    }
  }*/






  /**
   * Viaduto cruzando por cima — largo, com o vão central LIVRE (nenhum pilar
   * sobre a pista) e uma alça de descida à direita: é DALI que os carros saem
   * e fazem merge na sua via. Contexto > enfeite.
   */




  /**
   * Retrovisor: projeta a pista e o trânsito ATRÁS do jogador. A projeção
   * principal é forward-only (segmento mais perto que ~PLAYER_Z já cai no teste
   * sy2 >= maxY), então sem isso quem vem atrás é invisível.
   *
   * Só existe quando há viatura na pista — renderizar o mundo de trás todo frame
   * custaria caro pra informação que, sem perseguição, ninguém usa.
   *
   * Perspectiva simplificada de propósito (painel de 288x86): o que importa é
   * ler QUAL faixa e QUÃO PERTO, não fidelidade de traçado.
   */

  /**
   * Aviso de ameaça vindo de trás. A projeção só desenha o que está À FRENTE,
   * então uma viatura te alcançando por trás é invisível até ultrapassar — do
   * nada ela "aparece" colada. Isso desenha setas na base da tela na posição
   * lateral dela, crescendo e pulsando mais rápido conforme encosta, pra dar
   * leitura de onde ela vem antes de sentir o encostão.
   */
















  /** Sala online: cria e cai no lobby de espera com o código na tela. */
  async criarSalaOnline() {
    this.audio.ui()
    this.raceErro = null
    try {
      const spec = CARS[this.cfg.carIdx]
      this.race = await RaceSession.hospedar(
          this.cfg.pilotName || "PILOTO", this.raceVoltas, this.cfg.carIdx, this.cfg.customs[this.cfg.carIdx].paint,
      )
      void spec
      this.mode = "race"
      this.state = "racewait"
      this.fadeT = 0.22
    } catch (e) { this.raceErro = (e as Error)?.message ?? "não consegui criar a sala" }
  }


  async entrarSalaOnline() {
    if (this.codeBuf.length < 4) return
    this.raceErro = null
    try {
      this.race = await RaceSession.entrar(
          this.codeBuf, this.cfg.pilotName || "PILOTO", this.cfg.carIdx, this.cfg.customs[this.cfg.carIdx].paint,
      )
      this.mode = "race"
      this.state = "racewait"
      this.fadeT = 0.22
    } catch (e) { this.raceErro = (e as Error)?.message ?? "não consegui entrar"; this.state = "racecode" }
  }




  /**
   * Traçado do circuito INTEIRO, visto de cima. Percorre todos os segmentos
   * acumulando a curvatura, normaliza pra caber na caixa e devolve os pontos.
   * É o que deixa o jogador ler as curvas antes de largar.
   */


  /** Placar ao vivo no canto da tela durante a corrida. */
  renderRaceHud() {
    const r = this.race
    if (!r) return
    const ctx = this.ctx
    // já terminei: faixa "ASSISTINDO" no topo enquanto os rivais fecham a prova
    if (this.raceFinished) {
      ctx.textAlign = "center"
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 400)
      ctx.fillStyle = `rgba(56,189,248,${pulse})`
      ctx.font = "bold 20px 'Space Grotesk', 'Segoe UI', sans-serif"
      ctx.fillText("🏁 VOCÊ CHEGOU — assistindo os rivais…", W / 2, 40)
      ctx.textAlign = "left"
    }
    const grid = r.grid()
    const bw = 208, bh = 56 + grid.length * 22
    const bx = 14, by = 88
    glass(this, bx, by, bw, bh, 10)

    // VOLTA e POSIÇÃO em tamanho grande: são as duas informações que o piloto
    // consulta de relance, não dá pra deixar como linha miúda de cabeçalho
    const ultima = r.lap === r.cfg.voltas - 1
    ctx.fillStyle = "rgba(248,250,252,0.5)"
    ctx.font = "bold 10px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText("VOLTA", bx + 12, by + 18)
    ctx.fillStyle = ultima ? "#ef4444" : "#f8fafc"
    ctx.font = "bold 26px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText(`${Math.min(r.lap + 1, r.cfg.voltas)}`, bx + 12, by + 42)
    ctx.fillStyle = "rgba(248,250,252,0.55)"
    ctx.font = "bold 15px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText(`/${r.cfg.voltas}`, bx + 34, by + 42)
    ctx.textAlign = "right"
    ctx.fillStyle = "rgba(248,250,252,0.5)"
    ctx.font = "bold 10px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText("POSIÇÃO", bx + bw - 12, by + 18)
    ctx.fillStyle = "#fde047"
    ctx.font = "bold 26px 'Space Grotesk', 'Segoe UI', sans-serif"
    ctx.fillText(`${r.minhaPosicao()}º`, bx + bw - 12, by + 42)
    ctx.textAlign = "left"
    let y = by + 68
    for (let i = 0; i < grid.length; i++) {
      const g = grid[i]
      // bolinha na cor do rival: mesma do mapa e da faixa no teto dele
      if (!g.eu && g.cor) {
        ctx.fillStyle = g.cor
        ctx.beginPath(); ctx.arc(bx + 17, y - 4, 3.2, 0, Math.PI * 2); ctx.fill()
      }
      ctx.fillStyle = g.eu ? "#fde047" : g.crashed ? "rgba(248,113,113,0.85)" : "rgba(248,250,252,0.75)"
      ctx.font = `${g.eu ? "bold " : ""}13px 'Space Grotesk', 'Segoe UI', sans-serif`
      ctx.fillText(`${i + 1}. ${g.nome}${g.finished ? " ✓" : ""}`, bx + (g.eu ? 12 : 25), y)
      ctx.textAlign = "right"
      ctx.fillText(`v${g.lap + 1}`, bx + bw - 12, y)
      ctx.textAlign = "left"
      y += 22
    }
  }





  // ---------- telas do duelo ----------
  toMenu() {
    this.mode = "solo"
    this.duel = null
    this.floaters = []
    this.state = "menu"
  }

  renderDuelLobby() {
    const ctx = this.ctx
    dim(this, 0.62)
    ctx.textAlign = "center"
    ctx.fillStyle = "#38bdf8"
    ctx.font = "900 44px 'Space Grotesk', sans-serif"
    ctx.fillText("DUELO ONLINE", W / 2, 150)
    ctx.fillStyle = "rgba(248,250,252,0.75)"
    ctx.font = "15px 'Space Grotesk', sans-serif"
    ctx.fillText("dois pilotos, mesma pista, largada junta.", W / 2, 186)
    ctx.fillText("quem for mais longe sem bater, leva.", W / 2, 208)
    ctx.textAlign = "left"
    pill(this, "CRIAR SALA", W / 2 - 150, 260, 300, () => duelCreate(this), { primary: true, h: 44, font: 17 })
    pill(this, "TENHO UM CÓDIGO", W / 2 - 150, 316, 300, () => { this.codeBuf = ""; this.state = "duelcode"; this.audio.ui() }, { h: 38, font: 15 })
    pill(this, "← voltar  [ESC]", W / 2 - 150, 368, 300, () => this.toMenu(), { h: 30 })
  }

  renderDuelCode() {
    const ctx = this.ctx
    dim(this, 0.7)
    glass(this, W / 2 - 210, 150, 420, 250, 20)
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
    pill(this, "ENTRAR  [ENTER]", W / 2 - 110, 330, 220, () => duelJoin(this), { primary: true, h: 34, font: 14 })
    pill(this, "← voltar", W / 2 - 110, 372, 220, () => { this.state = "duellobby" }, { h: 26 })
  }

  renderDuelWaiting() {
    const ctx = this.ctx
    const d = this.duel
    dim(this, 0.66)
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
      pill(this, "cancelar  [ESC]", W / 2 - 100, 370, 200, () => this.toMenu(), { h: 28 })
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

  renderDuelSpectate() {
    const ctx = this.ctx
    const d = this.duel
    dim(this, 0.55)
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

  renderDuelResult() {
    const ctx = this.ctx
    const d = this.duel
    dim(this, 0.66)
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
    pill(this, "⚔ REVANCHE  [ENTER]", W / 2 - 240, 340, 240, () => duelRematch(this), { primary: true, h: 40, font: 15 })
    pill(this, "MENU", W / 2 + 20, 340, 220, () => this.toMenu(), { h: 40, font: 15 })
  }

  // ---------- input ----------
  audioInit = false
  ensureAudio() {
    this.audio.ensure()
    if (!this.audioInit) {
      this.audioInit = true
      this.audio.setMuted(!this.cfg.sound)
    }
  }

  onKeyDown = (e: KeyboardEvent) => onKeyDown(this, e)


  enterFromMenu(dest: "garage" | "duellobby" = "garage") {
    this.audio.ui()
    if (!this.cfg.pilotName) {
      this.nameBuf = ""
      this.afterName = dest
      this.state = "nameentry"
    } else if (dest === "duellobby") {
      startDuelLobby(this)
    } else {
      // garage é a porta do SOLO — reseta o modo, senão uma corrida anterior
      // deixava mode="race" e o "bora correr" virava circuito
      this.mode = "solo"
      this.race = null
      this.state = "garage"
    }
  }

  confirmName() {
    this.cfg.pilotName = (this.nameBuf.trim() || "PILOTO").slice(0, 12)
    saveConfig(this.cfg)
    this.audio.ui()
    if (this.afterName === "duellobby") startDuelLobby(this)
    else { this.mode = "solo"; this.race = null; this.state = "garage" }
    this.afterName = "garage"
  }

  /** Farol alto: pisca e pede passagem pra quem está na sua faixa. */
  flashBeam() {
    if (this.state !== "racing" || this.beamCdT > 0) return
    this.beamCdT = 2.2
    this.beamT = 0.55
    this.audio.flash()
    const playerZ = this.position + PLAYER_Z
    for (const t of this.traffic) {
      const d = wrapDz(this, t.z, playerZ)
      if (d > 200 && d < 7000 && Math.abs(t.offset - this.playerX) < 0.35) t.yieldT = 1.4
    }
  }



  onKeyUp = (e: KeyboardEvent) => onKeyUp(this, e)

  onMouseDown = (e: MouseEvent) => onMouseDown(this, e)
  onMouseUp = (e: MouseEvent) => onMouseUp(this, e)
  onMouseMove = (e: MouseEvent) => onMouseMove(this, e)

  onWheel = (e: WheelEvent) => onWheel(this, e)
  onCtx = (e: Event) => onCtx(this, e)
  onBlur = () => { if (this.state === "racing" && this.mode !== "duel") this.state = "paused" }

  // toque no canvas: espelha o mousedown/mousemove pra navegação de menu (tap
  // num botão do garagem/pause/resultado) — duplicado em vez de refatorado
  // pra não arriscar quebrar o caminho de mouse, que já funciona.
  onTouchStart = (e: TouchEvent) => onTouchStart(this, e)
  onTouchEnd = () => { this.mouseGas = false }
  onTouchMove = (e: TouchEvent) => onTouchMove(this, e)

  /**
   * Botões de toque pro celular (acelerador/freio/direção/marcha/nitro).
   * DOM de verdade por cima do canvas — não desenhado nele — porque cada
   * botão precisa responder a um dedo independente (segurar gás E virar ao
   * mesmo tempo), e elementos HTML resolvem multi-touch de graça; um único
   * canvas com touches[] manual seria bem mais frágil pra isso.
   *
   * O wrapper usa a MESMA fórmula de tamanho do canvas (width: min(100vw,
   * 177.8vh), aspect-ratio 16/9) só que via position:fixed — fica alinhado
   * pixel a pixel com o jogo sem precisar recalcular nada em resize/rotação,
   * e os botões são posicionados em % desse retângulo (não em px fixos).
   */
  /** Mata seleção/callout/realce de toque — no celular o toque longo abria o
   *  menu "Salvar imagem" por cima do jogo. Vale pro canvas e pra cada botão. */


  bind() {
    window.addEventListener("keydown", this.onKeyDown)
    window.addEventListener("keyup", this.onKeyUp)
    window.addEventListener("blur", this.onBlur)
    this.canvas.addEventListener("mousedown", this.onMouseDown)
    window.addEventListener("mouseup", this.onMouseUp)
    this.canvas.addEventListener("touchstart", this.onTouchStart, { passive: false })
    this.canvas.addEventListener("touchmove", this.onTouchMove, { passive: false })
    this.canvas.addEventListener("touchend", this.onTouchEnd)
    this.canvas.addEventListener("touchcancel", this.onTouchEnd)
    this.canvas.addEventListener("mousemove", this.onMouseMove)
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false })
    this.canvas.addEventListener("contextmenu", this.onCtx)
  }
  unbind() {
    window.removeEventListener("keydown", this.onKeyDown)
    window.removeEventListener("keyup", this.onKeyUp)
    window.removeEventListener("blur", this.onBlur)
    this.canvas.removeEventListener("mousedown", this.onMouseDown)
    window.removeEventListener("mouseup", this.onMouseUp)
    this.canvas.removeEventListener("mousemove", this.onMouseMove)
    this.canvas.removeEventListener("wheel", this.onWheel)
    this.canvas.removeEventListener("contextmenu", this.onCtx)
    this.canvas.removeEventListener("touchstart", this.onTouchStart)
    this.canvas.removeEventListener("touchmove", this.onTouchMove)
    this.canvas.removeEventListener("touchend", this.onTouchEnd)
    this.canvas.removeEventListener("touchcancel", this.onTouchEnd)
  }
}


