import { useEffect, useState } from "react"
import { api } from "@/lib/api/client"
import type { Follow } from "./types"

// Seguidores e seguindo do usuário logado
export function useSocial() {
  const [seguidores, setSeguidores] = useState<Follow[]>([])
  const [seguindo, setSeguindo] = useState<Follow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get<{ seguidores: Follow[] }>("/api/social/seguidores"),
      api.get<{ follows: Follow[] }>("/api/social/follows"),
    ])
      .then(([s, f]) => {
        setSeguidores(s.seguidores ?? [])
        setSeguindo(f.follows ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { seguidores, seguindo, loading }
}
