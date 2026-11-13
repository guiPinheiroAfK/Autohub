import { req } from "./net-http"
// AutoDash — cliente de rede do duelo online (salas por código + polling).

export interface DuelTelemetry {
  d: number  // km percorridos
  s: number  // pontos
  v: number  // km/h
  x: number  // posição lateral (-1..1)
  c: boolean // bateu?
  car?: number   // índice da carroceria (pro fantasma fiel)
  paint?: number // pintura
  t?: number // carimbo do servidor
}

export interface RematchStatus { seed: number; startInMs: number | null }

export interface RoomCreated { code: string; seed: number; role: "host" }
export interface RoomJoined { seed: number; role: "guest"; oppName: string; startInMs: number }
export interface RoomStatus { oppName: string | null; startInMs: number | null }
export interface StateResponse { opp: DuelTelemetry | null; oppName: string | null; startInMs: number | null }


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

export function rematchRoom(code: string, role: "host" | "guest"): Promise<RematchStatus> {
  return req(`/api/autodash/room/${encodeURIComponent(code)}/rematch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  })
}
