import { useCallback, useEffect, useState } from "react"
import { api } from "@/lib/api/client"
import type { Anuncio } from "./types"
import { POR_PAGINA } from "./constants"

// Lista pública de anúncios: busca, filtros por categoria/condição e paginação
export function useAnuncios() {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(0)
  const [loading, setLoading] = useState(true)

  const [busca, setBusca] = useState("")
  const [categFiltro, setCategFiltro] = useState("")
  const [condicaoFiltro, setCondicaoFiltro] = useState("")

  const carregar = useCallback((pg = 0, q = busca, cat = categFiltro, cond = condicaoFiltro) => {
    setLoading(true)
    const params = new URLSearchParams({
      limit: String(POR_PAGINA),
      offset: String(pg * POR_PAGINA),
      ...(q && { q }),
      ...(cat && { categoria: cat }),
      ...(cond && { condicao: cond }),
    })
    api.get<{ anuncios: Anuncio[]; total: number }>(`/api/marketplace?${params}`)
      .then(r => { setAnuncios(r.anuncios ?? []); setTotal(r.total ?? 0) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [busca, categFiltro, condicaoFiltro])

  useEffect(() => { carregar(0) }, [])

  function handleBusca(e: React.FormEvent) {
    e.preventDefault()
    setPagina(0)
    carregar(0)
  }

  function handleFiltro(cat: string, cond: string) {
    setCategFiltro(cat)
    setCondicaoFiltro(cond)
    setPagina(0)
    carregar(0, busca, cat, cond)
  }

  return { anuncios, setAnuncios, total, pagina, setPagina, loading, busca, setBusca, categFiltro, condicaoFiltro, carregar, handleBusca, handleFiltro }
}
