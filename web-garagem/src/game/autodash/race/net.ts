// AutoDash — cliente de rede do MODO CORRIDA (salas de até 4, polling).
//
// Netlify Functions não segura WebSocket, então é polling. O problema disso é
// que a posição do rival chega defasada; a solução aqui tem duas partes:
//
//  1. DEAD RECKONING — entre um poll e outro o rival continua andando pela
//     última velocidade conhecida. Carro em pista anda quase sempre reto, então
//     a previsão erra pouco.
//  2. CONVERGÊNCIA SUAVE — quando o dado novo chega, não damos snap na posição
//     (que teleportaria o carro na tela); puxamos aos poucos até o alvo.
//
// É isso que torna viável desenhar os rivais SÓLIDOS e deixar que se empurrem.

import { KMH2UPS } from "../data"
import type { Rival, RaceTelemetry } from "./types"

const TICK = 0.3 // s entre envios de telemetria (o duelo usa 1s)
const SUMIR_APOS = 6 // s sem notícia = tira da pista

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5000)
  try {
    const res = await fetch(path, { ...init, signal: ctrl.signal })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? `HTTP ${res.status}`)
    return data as T
  } finally {
    clearTimeout(timer)
  }
}
const post = <T>(p: string, body: unknown) =>
  req<T>(p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })

/** Id estável do dispositivo — permite reentrar na sala se a conexão cair. */
export function meuPlayerId(): string {
  const K = "autodash.playerId"
  let id = localStorage.getItem(K)
  if (!id) {
    id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
    localStorage.setItem(K, id)
  }
  return id
}

interface PilotoApi {
  player_id: string; nome: string; car: number; paint: number
  estado: RaceTelemetry | null; ha_segundos: string | number
}

export interface LobbyInfo {
  seed: number; voltas: number; ownerId: string
  startInMs: number | null; pilotos: PilotoApi[]
}

export const criarSala = (nome: string, playerId: string, voltas: number, car: number, paint: number) =>
  post<{ code: string; seed: number; voltas: number; owner: boolean }>(
    "/api/autodash/race", { nome, playerId, voltas, car, paint })

export const entrarSala = (code: string, nome: string, playerId: string, car: number, paint: number) =>
  post<{ seed: number; voltas: number; owner: boolean }>(
    `/api/autodash/race/${encodeURIComponent(code)}/join`, { nome, playerId, car, paint })

export const verLobby = (code: string) =>
  req<LobbyInfo>(`/api/autodash/race/${encodeURIComponent(code)}`)

export const darLargada = (code: string, playerId: string) =>
  post<{ startInMs: number }>(`/api/autodash/race/${encodeURIComponent(code)}/start`, { playerId })

/**
 * Mantém a lista de rivais viva: envia a sua telemetria no ritmo do TICK e
 * aplica dead reckoning nos outros a cada frame.
 */
export class RaceNet {
  readonly rivais = new Map<string, Rival>()
  startInMs: number | null = null
  private t = 0
  private enviando = false
  private erro: string | null = null

  constructor(private code: string, private meuId: string) {}

  get ultimoErro() { return this.erro }

  /** Chamar todo frame. `telemetria()` só é consultada quando vai enviar. */
  update(dt: number, trackLen: number, telemetria: () => RaceTelemetry) {
    // 1) extrapola os rivais (dead reckoning) e conta o tempo sem notícia
    for (const r of this.rivais.values()) {
      r.staleFor += dt
      if (r.finished || r.crashed) { r.v = Math.max(0, r.v - 200 * dt); continue }
      const avanco = r.v * KMH2UPS * dt
      r.d += avanco
      r.z += avanco
      if (r.z >= trackLen) { r.z -= trackLen; r.lap++ }
      // 2) converge suave pro último alvo da rede em vez de dar snap
      if (r.netD !== undefined) {
        const erroD = r.netD - r.d
        // se a defasagem for absurda (aba dormiu, lag alto), aí sim corrige seco
        if (Math.abs(erroD) > trackLen * 0.25) { r.d = r.netD; r.z = r.netZ ?? r.z }
        else {
          // A correção é LIMITADA a uma fração do avanço normal: sem esse teto,
          // recuperar uma defasagem grande dá um pulo de 3-4x num frame só, que
          // o olho lê como engasgo. Assim ela chega mais devagar, porém lisa.
          const k = Math.min(1, dt * 3)
          const teto = Math.abs(avanco) * 0.5 + 25
          r.d += Math.max(-teto, Math.min(teto, erroD * k))
          if (r.netZ !== undefined) {
            const erroZ = r.netZ - r.z
            r.z += Math.max(-teto, Math.min(teto, erroZ * k))
          }
        }
      }
      if (r.netX !== undefined) r.x += (r.netX - r.x) * Math.min(1, dt * 6)
    }
    // some quem sumiu
    for (const [id, r] of this.rivais) if (r.staleFor > SUMIR_APOS) this.rivais.delete(id)

    // 3) envia a própria telemetria no ritmo do TICK
    this.t -= dt
    if (this.t > 0 || this.enviando) return
    this.t = TICK
    this.enviando = true
    post<{ voltas: number; startInMs: number | null; rivais: PilotoApi[] }>(
      `/api/autodash/race/${encodeURIComponent(this.code)}/state`,
      { playerId: this.meuId, st: telemetria() },
    ).then(r => {
      this.erro = null
      this.startInMs = r.startInMs
      for (const p of r.rivais) this.aplicar(p)
    }).catch(e => { this.erro = e?.message ?? "sem conexão" })
      .finally(() => { this.enviando = false })
  }

  private aplicar(p: PilotoApi) {
    const st = p.estado
    let r = this.rivais.get(p.player_id)
    if (!r) {
      r = {
        id: p.player_id, nome: p.nome, car: p.car, paint: p.paint, bot: false,
        z: st?.z ?? 0, lap: st?.lap ?? 0, d: st?.d ?? 0, v: st?.v ?? 0, x: st?.x ?? 0,
        crashed: !!st?.c, finished: !!st?.fin, staleFor: 0,
      }
      this.rivais.set(p.player_id, r)
    }
    if (!st) return
    // guarda como ALVO — quem move o carro é o dead reckoning acima
    r.netD = st.d; r.netZ = st.z; r.netX = st.x
    r.v = st.v; r.lap = st.lap
    r.crashed = !!st.c
    // carimba a chegada na primeira vez que a rede reporta — é o que ordena o pódio
    if (st.fin && !r.finished) r.finishT = performance.now()
    r.finished = !!st.fin
    r.staleFor = Math.max(0, Number(p.ha_segundos) || 0)
  }
}
