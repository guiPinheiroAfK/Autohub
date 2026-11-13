import { useEffect, useState } from "react"
import { api } from "@/lib/api/client"
import type { Cotacao } from "./types"

// Cotações do dia (USD / PYG), carregamento silencioso
export function useCotacoes() {
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<{ cotacoes: Cotacao[] }>("/api/cotacoes")
      .then(r => setCotacoes(r.cotacoes))
      .catch(() => {}) // silencioso — cotações são extras, não crítico
      .finally(() => setLoading(false))
  }, [])

  return { cotacoes, loading }
}
