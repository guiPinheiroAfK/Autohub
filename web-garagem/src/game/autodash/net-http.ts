// Chamada HTTP comum aos clientes de rede do AutoDash (duelo e corrida).
// Timeout de 5 s; erro vem do campo `error` da resposta, se existir.

const TIMEOUT_MS = 5000

export async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(path, { ...init, signal: ctrl.signal })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? `HTTP ${res.status}`)
    return data as T
  } finally {
    clearTimeout(timer)
  }
}

/** POST com corpo JSON (o único formato que a API de duelo e de corrida usa). */
export function postJson<T>(path: string, body: unknown): Promise<T> {
  return req<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
}
