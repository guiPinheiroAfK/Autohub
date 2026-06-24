import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import { api } from "@/lib/api/client"

interface AuthUser {
  id: string
  nome: string
  email: string
  avatarUrl?: string
  garagem: {
    id: string
    slug: string
    nome: string
  }
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (nome: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Restaura sessão ao montar
  useEffect(() => {
    const token = localStorage.getItem("autohub_token")
    if (!token) {
      setLoading(false)
      return
    }
    api
      .get<AuthUser>("/api/auth/me")
      .then(setUser)
      .catch(() => localStorage.removeItem("autohub_token"))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; usuario: AuthUser }>(
      "/auth/login",
      { email, password }
    )
    localStorage.setItem("autohub_token", res.token)
    setUser(res.usuario as unknown as AuthUser)
  }, [])

  const register = useCallback(
    async (nome: string, email: string, password: string) => {
      const res = await api.post<{ token: string; usuario: AuthUser }>(
        "/auth/register",
        { nome, email, password }
      )
      localStorage.setItem("autohub_token", res.token)
      setUser(res.usuario as unknown as AuthUser)
    },
    []
  )

  const logout = useCallback(() => {
    localStorage.removeItem("autohub_token")
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be inside AuthProvider")
  return ctx
}
