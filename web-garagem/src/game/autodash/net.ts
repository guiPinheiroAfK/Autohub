// AutoDash — cliente de rede do duelo online (salas por código + polling).

export interface DuelTelemetry {
  d: number  // km percorridos
  s: number  // pontos
  v: number  // km/h
  x: number  // posição lateral (-1..1)
  c: boolean // bateu?
  t?: number // carimbo do servidor
}

export interface RoomCreated { code: string; seed: number; role: "host" }
export interface RoomJoined { seed: number; role: "guest"; oppName: string; startInMs: number }
export interface RoomStatus { oppName: string | null; startInMs: number | null }
export interface StateResponse { opp: DuelTelemetry | null; oppName: string | null; startInMs: number | null }

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

export function createRoom(nome: string): Promise<RoomCreated> {
  return req("/api/autodash/room", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome }),
  })
}

export function joinRoom(code: string, nome: string): Promise<RoomJoined> {
  return req(`/api/autodash/room/${encodeURIComponent(code)}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nome }),
  })
}

export function pollRoom(code: string): Promise<RoomStatus> {
  return req(`/api/autodash/room/${encodeURIComponent(code)}`)
}

export function postState(code: string, role: "host" | "guest", st: DuelTelemetry): Promise<StateResponse> {
  return req(`/api/autodash/room/${encodeURIComponent(code)}/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, st }),
  })
}
