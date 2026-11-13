// Chamada HTTP comum aos clientes de rede do AutoDash (duelo e corrida).
// Timeout de 5 s; erro vem do campo `error` da resposta, se existir.

export async function req<T>(path: string, init?: RequestInit): Promise<T> {
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
