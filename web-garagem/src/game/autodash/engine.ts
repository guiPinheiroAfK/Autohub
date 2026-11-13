import { CANVAS_W, CANVAS_H, CAM_HEIGHT, CAM_DEPTH, type GameConfig, loadConfig, type ScoreEntry, cachedScores, RPM_IDLE, type BodyKind, fetchLeaderboard, CARS } from "./data"
import { type DuelTelemetry } from "./net"
import { AudioBus } from "./audio"
import { type Traffic } from "./traffic/types"
import { RaceSession } from "./race/session"
import { noCallout, buildTouchControls, onTouchStart, onTouchMove } from "./input/touch"
import { buildTrack } from "./world/track"
import { seedTraffic } from "./traffic/spawner"
import { clamp, mix } from "./math"
import { update } from "./sim/update"
import { skyNow, renderBackdrop } from "./render/backdrop"
import { renderRoad } from "./render/road"
import { renderPlayer, renderRearThreat } from "./render/player"
import { renderParticles } from "./render/particles"
import { vignetteTex } from "./render/textures"
import { renderMenu, renderGarage, renderPause, renderGameOver, renderNameEntry } from "./render/menus/main"
import { renderHud, renderSemaphore } from "./render/hud"
import { renderTrackPreview, renderRaceLobby, renderRaceCode, renderRaceWait, renderRaceResult } from "./render/menus/race"
import { renderRaceHud } from "./render/race-hud"
import { renderDuelLobby, renderDuelCode, renderDuelWaiting, renderDuelSpectate, renderDuelResult } from "./render/menus/duel"
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

  // halo warm das luminárias da ponte, cacheado pelo mesmo motivo da vinheta
  // brilho neon por cor, pré-renderizado UMA vez. createRadialGradient por
  // desenho era o gargalo do modo corrida: ~1600 gradientes/frame com as
  // fachadas de Tokyo. drawImage de um sprite pronto é ordens de grandeza
  // mais barato.
  glowCache = new Map<string, HTMLCanvasElement>()
  glowSprite: HTMLCanvasElement | null = null
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
      update(this, dt)
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
    ctx.drawImage(vignetteTex(this), 0, 0)

    switch (this.state) {
      case "menu": renderMenu(this); break
      case "garage": renderGarage(this); break
      case "countdown":
        renderHud(this)
        // na corrida, a contagem serve pra estudar o traçado antes de largar
        if (this.mode === "race") renderTrackPreview(this)
        renderSemaphore(this)
        break
      case "racing": renderHud(this); if (this.mode === "race") renderRaceHud(this); break
      case "paused": renderHud(this); renderPause(this); break
      case "gameover": renderGameOver(this); break
      case "nameentry": renderNameEntry(this); break
      case "duellobby": renderDuelLobby(this); break
      case "duelcode": renderDuelCode(this); break
      case "duelwaiting": renderDuelWaiting(this); break
      case "duelspectate": renderDuelSpectate(this); break
      case "duelresult": renderDuelResult(this); break
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













  // ---------- input ----------
  audioInit = false

  onKeyDown = (e: KeyboardEvent) => onKeyDown(this, e)







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


