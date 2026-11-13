import { useEffect, useState } from "react"
import { api } from "@/lib/api/client"
import type { VeiculoComMetricas } from "@/types"

// Veículos da garagem do usuário logado
export function useVeiculosGaragem() {
  const [veiculos, setVeiculos] = useState<VeiculoComMetricas[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<VeiculoComMetricas[]>("/api/veiculos")
      .then(setVeiculos)
      .catch((e) => setErro(e.message))
      .finally(() => setLoading(false))
  }, [])

  return { veiculos, loading, erro }
}
