import { useEffect, useState } from "react"
import { api } from "@/lib/api/client"
import { useAuth } from "@/context/AuthContext"
import type { Anuncio } from "./types"

// Anúncios do usuário logado (aba "Meus anúncios"): status e patrocínio
export function useMeusAnuncios() {
  const { user } = useAuth()
  const [meusAnuncios, setMeusAnuncios] = useState<Anuncio[]>([])

  function carregarMeus() {
    api.get<{ anuncios: Anuncio[] }>("/api/marketplace/meus")
      .then(r => setMeusAnuncios(r.anuncios ?? []))
      .catch(() => {})
  }

  useEffect(() => { if (user) carregarMeus() }, [user])

  async function handleStatusChange(id: string, status: string) {
    await api.patch(`/api/marketplace/${id}/status`, { status })
    setMeusAnuncios(prev => prev.map(a => a.id === id ? { ...a, status: status as Anuncio["status"] } : a))
  }

  async function handlePatrocinar(id: string) {
    try {
      await api.post(`/api/marketplace/${id}/patrocinar`, {})
      setMeusAnuncios(prev => prev.map(a => a.id === id ? { ...a, patrocinado: true } : a))
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao patrocinar")
    }
  }


  return { meusAnuncios, carregarMeus, handleStatusChange, handlePatrocinar }
}
