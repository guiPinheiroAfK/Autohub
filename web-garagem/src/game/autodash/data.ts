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
export const GEAR_RATIOS = [3.4, 2.35, 1.75, 1.38, 1.12, 0.88] // 6ª mais longa: cap ~265 km/h
export const RPM_PER_KMH = 30         // rpm = idle + kmh * ratio * RPM_PER_KMH

export type BodyKind =
  | "gt" | "muscle" | "ninja" | "ghost"
  // roster JDM — nomes próprios de propósito (as silhuetas são inspiradas,
  // não cópias, e os nomes não remetem a marca nenhuma)
  | "zcoupe" | "rotor" | "apex" | "kaiju" | "sylva" | "roadster" | "alta"

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
    power: 46, grip: 0.72, topSpeed: 244, width: 0.26, shiftMs: 220,
    desc: "Equilibrado. O clássico da casa.",
  },
  {
    id: "muscle", name: "MUSCLE 71", body: "muscle",
    power: 58, grip: 0.55, topSpeed: 260, width: 0.31, shiftMs: 300,
    desc: "Torque bruto e traseira solta. Largo demais pro corredor.",
  },
  {
    id: "ninja", name: "NINJA RS", body: "ninja",
    power: 40, grip: 0.90, topSpeed: 228, width: 0.20, shiftMs: 180,
    desc: "Estreito e grudado no chão. Costura qualquer comboio.",
  },
  {
    id: "ghost", name: "FANTASMA X", body: "ghost",
    power: 50, grip: 0.78, topSpeed: 256, width: 0.25, shiftMs: 240,
    desc: "Final de reta assustador. Exige mão calma.",
  },

  // ── roster JDM ────────────────────────────────────────────────────────────
  // Balanceado por TRADE-OFF, não por "tier": cada um ganha em algo e paga em
  // outro, então a escolha depende do circuito e do teu jeito de pilotar.
  {
    id: "zcoupe", name: "NOTURNO Z", body: "zcoupe",
    power: 50, grip: 0.76, topSpeed: 248, width: 0.26, shiftMs: 220,
    desc: "O meio-termo honesto. Bom em tudo, imbatível em nada.",
  },
  {
    id: "rotor", name: "ROTOR FD", body: "rotor",
    power: 47, grip: 0.88, topSpeed: 244, width: 0.24, shiftMs: 170,
    desc: "Leve e de giro solto. Troca marcha antes de todo mundo.",
  },
  {
    id: "apex", name: "ÁPEX A80", body: "apex",
    power: 57, grip: 0.70, topSpeed: 262, width: 0.29, shiftMs: 250,
    desc: "Dono das retas. Pesado nas curvas, largo no trânsito.",
  },
  {
    id: "kaiju", name: "KAIJU R32", body: "kaiju",
    power: 52, grip: 0.92, topSpeed: 240, width: 0.28, shiftMs: 200,
    desc: "Grudado no chão. Perde na reta, devolve na curva.",
  },
  {
    id: "sylva", name: "SYLVA S15", body: "sylva",
    power: 45, grip: 0.80, topSpeed: 238, width: 0.23, shiftMs: 185,
    desc: "Estreito e ágil. Costura onde os outros não cabem.",
  },
  {
    id: "roadster", name: "ROADSTER MK1", body: "roadster",
    power: 38, grip: 0.95, topSpeed: 220, width: 0.19, shiftMs: 160,
    desc: "O menor e mais leve. Carrega velocidade em curva como ninguém.",
  },
  {
    id: "alta", name: "ALTA IS", body: "alta",
    power: 48, grip: 0.82, topSpeed: 242, width: 0.27, shiftMs: 210,
    desc: "Sedã de faróis retráteis. Equilibrado e previsível.",
  },
]

export const PAINTS = [
  "#e0342f", "#f59e0b", "#22d3ee", "#8b5cf6", "#4ade80",
  "#f472b6", "#f8fafc", "#334155", "#facc15", "#1d4ed8",
]

export const STRIPES = ["sem faixa", "central", "dupla", "lateral"] as const

export const NEONS = ["#00000000", "#38bdf8", "#a78bfa", "#4ade80", "#fb7185", "#fde047"]
export const NEON_NAMES = ["desligado", "azul", "roxo", "verde", "rosa", "amarelo"]

export const WHEELS = ["#1f2937", "#cbd5e1", "#eab308", "#f8fafc"]
export const WHEEL_NAMES = ["preta", "prata", "dourada", "branca"]

export const WINGS = ["sem aerofólio", "ducktail", "asa GT"]

export interface CarCustom {
  paint: number
  stripe: number
  neon: number
  wheel: number
  wing: number
}

function defaultCustom(i: number): CarCustom {
  const body = CARS[i]?.body
  return {
    paint: i % PAINTS.length,
    stripe: 1,
    neon: 0,
    wheel: 0,
    wing: body === "muscle" || body === "ninja" ? 1 : 2,
  }
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
    customs: CARS.map((_, i) => defaultCustom(i)),
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
    // preenche campos novos em configs salvas por versões antigas
    cfg.customs = CARS.map((_, i) => ({ ...defaultCustom(i), ...(cfg.customs[i] ?? {}) }))
    return cfg
  } catch {
    return defaultConfig()
  }
}

export function saveConfig(cfg: GameConfig) {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)) } catch { /* storage cheio/bloqueado */ }
}

// ── Leaderboard global (API do Autohub) com cache local de fallback ──────────

const SCORES_CACHE_KEY = "autodash.scores.cache.v2"

function readCache(): ScoreEntry[] {
  try {
    localStorage.removeItem(SCORES_KEY) // placar local antigo, aposentado
    const raw = localStorage.getItem(SCORES_CACHE_KEY)
    return raw ? (JSON.parse(raw) as ScoreEntry[]) : []
  } catch {
    return []
  }
}

function writeCache(scores: ScoreEntry[]) {
  try { localStorage.setItem(SCORES_CACHE_KEY, JSON.stringify(scores)) } catch { /* ignora */ }
}

function localMerge(entry: ScoreEntry): ScoreEntry[] {
  // espelha a regra do servidor: uma entrada por piloto, só a melhor
  const best = new Map<string, ScoreEntry>()
  for (const s of [...readCache(), entry]) {
    const cur = best.get(s.name)
    if (!cur || s.score > cur.score) best.set(s.name, s)
  }
  const scores = [...best.values()].sort((a, b) => b.score - a.score).slice(0, 10)
  writeCache(scores)
  return scores
}

interface ApiRow { nome: string; pontos: number; km: number }

function mapRows(data: unknown): ScoreEntry[] {
  const rows = (data as { scores?: ApiRow[] } | null)?.scores
  if (!Array.isArray(rows)) return []
  return rows.map((r) => ({ name: String(r.nome), score: Number(r.pontos), km: Number(r.km) }))
}

/** Último leaderboard conhecido (sincrono, para o primeiro frame). */
export function cachedScores(): ScoreEntry[] {
  return readCache()
}

export async function fetchLeaderboard(): Promise<ScoreEntry[]> {
  try {
    const res = await fetch("/api/autodash/leaderboard")
    if (!res.ok) throw new Error(String(res.status))
    const scores = mapRows(await res.json())
    if (scores.length) writeCache(scores)
    return scores.length ? scores : readCache()
  } catch {
    return readCache()
  }
}

export async function submitScore(entry: ScoreEntry): Promise<ScoreEntry[]> {
  try {
    const res = await fetch("/api/autodash/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: entry.name, pontos: entry.score, km: entry.km }),
    })
    if (!res.ok) throw new Error(String(res.status))
    const scores = mapRows(await res.json())
    if (scores.length) writeCache(scores)
    return scores.length ? scores : localMerge(entry)
  } catch {
    return localMerge(entry)
  }
}
