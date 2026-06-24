const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

function getToken(): string | null {
  return localStorage.getItem("autohub_token")
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (res.status === 401) {
    localStorage.removeItem("autohub_token")
    window.location.href = "/login"
    throw new Error("Não autorizado")
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data?.error ?? `Erro ${res.status}`)
  }

  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
}
