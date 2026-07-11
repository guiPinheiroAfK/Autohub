// AutoDash — constantes, specs dos carros e persistência local.

export const CANVAS_W = 960
export const CANVAS_H = 540

// Pseudo-3D
export const SEG_LEN = 200            // comprimento de um segmento de pista (unidades de mundo)
export const ROAD_WIDTH = 2200        // meia-largura da pista
export const LANES = 4
export const CAM_HEIGHT = 1000
export const FOV = 100
export const CAM_DEPTH = 1 / Math.tan(((FOV / 2) * Math.PI) / 180)
export const DRAW_DIST = 300          // segmentos desenhados à frente
export const KMH2UPS = 132            // 1 km/h → unidades de mundo por segundo

// Motor / câmbio
export const RPM_IDLE = 900
export const RPM_REDLINE = 7600
export const RPM_LIMITER = 7900
export const GEAR_RATIOS = [3.4, 2.35, 1.75, 1.38, 1.12, 0.93]
export const RPM_PER_KMH = 30         // rpm = idle + kmh * ratio * RPM_PER_KMH

export type BodyKind = "gt" | "muscle" | "ninja" | "ghost"

export interface CarSpec {
  id: string
  name: string
  desc: string
  body: BodyKind
  power: number      // aceleração base em 1ª (km/h por segundo)
  grip: number       // 0..1 — aderência nas curvas
  topSpeed: number   // km/h
  width: number      // meia-largura normalizada (fração da meia-pista) — carro largo sofre no tráfego
  shiftMs: number    // tempo de troca de marcha
}

export const CARS: CarSpec[] = [
  {
    id: "gt", name: "AUTOHUB GT", body: "gt",
    power: 46, grip: 0.72, topSpeed: 232, width: 0.26, shiftMs: 220,
    desc: "Equilibrado. O clássico da casa.",
  },
  {
    id: "muscle", name: "MUSCLE 71", body: "muscle",
    power: 58, grip: 0.55, topSpeed: 248, width: 0.31, shiftMs: 300,
    desc: "Torque bruto e traseira solta. Largo demais pro corredor.",
  },
  {
    id: "ninja", name: "NINJA RS", body: "ninja",
    power: 40, grip: 0.90, topSpeed: 216, width: 0.20, shiftMs: 180,
    desc: "Estreito e grudado no chão. Costura qualquer comboio.",
  },
  {
    id: "ghost", name: "FANTASMA X", body: "ghost",
    power: 50, grip: 0.78, topSpeed: 244, width: 0.25, shiftMs: 240,
    desc: "Final de reta assustador. Exige mão calma.",
  },
]

export const PAINTS = [
  "#e0342f", "#f59e0b", "#22d3ee", "#8b5cf6", "#4ade80",
  "#f472b6", "#f8fafc", "#334155", "#facc15", "#1d4ed8",
]

export const STRIPES = ["sem faixa", "central", "dupla", "lateral"] as const

export const NEONS = ["#00000000", "#38bdf8", "#a78bfa", "#4ade80", "#fb7185", "#fde047"]
export const NEON_NAMES = ["desligado", "azul", "roxo", "verde", "rosa", "amarelo"]

export interface CarCustom {
  paint: number
  stripe: number
  neon: number
}

export interface GameConfig {
  carIdx: number
  customs: CarCustom[]
  transmission: "auto" | "manual"
  steering: "keyboard" | "mouse"
  sound: boolean
  pilotName: string
}

export interface ScoreEntry {
  name: string
  score: number
  km: number
}

const CFG_KEY = "autodash.config.v1"
const SCORES_KEY = "autodash.scores.v1"

export function defaultConfig(): GameConfig {
  return {
    carIdx: 0,
    customs: CARS.map((_, i) => ({ paint: i % PAINTS.length, stripe: 1, neon: 0 })),
    transmission: "auto",
    steering: "keyboard",
    sound: true,
    pilotName: "",
  }
}

export function loadConfig(): GameConfig {
  try {
    const raw = localStorage.getItem(CFG_KEY)
    if (!raw) return defaultConfig()
    const cfg = { ...defaultConfig(), ...JSON.parse(raw) } as GameConfig
    while (cfg.customs.length < CARS.length) cfg.customs.push({ paint: 0, stripe: 0, neon: 0 })
    return cfg
  } catch {
    return defaultConfig()
  }
}

export function saveConfig(cfg: GameConfig) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)) } catch { /* storage cheio/bloqueado */ }
}

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(SCORES_KEY)
    return raw ? (JSON.parse(raw) as ScoreEntry[]) : []
  } catch {
    return []
  }
}

export function saveScore(entry: ScoreEntry): ScoreEntry[] {
  const scores = [...loadScores(), entry].sort((a, b) => b.score - a.score).slice(0, 5)
  try { localStorage.setItem(SCORES_KEY, JSON.stringify(scores)) } catch { /* ignora */ }
  return scores
}

export function isTop5(score: number): boolean {
  const scores = loadScores()
  return scores.length < 5 || score > scores[scores.length - 1].score
}
