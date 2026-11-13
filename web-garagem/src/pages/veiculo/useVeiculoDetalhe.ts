import { useEffect, useState } from "react"
import { api } from "@/lib/api/client"
import type { VeiculoDetalheAPI } from "@/types"

// Carrega o veículo e mantém os campos de mídia (capa / YouTube) sincronizados com a resposta
export function useVeiculoDetalhe(id: string | undefined) {
    const [data, setData] = useState<VeiculoDetalheAPI | null>(null)
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState<string | null>(null)
    const [capaUrl, setCapaUrl] = useState("")
    const [youtubeUrl, setYoutubeUrl] = useState("")

    async function carregar() {
        if (!id) return
        try {
            const res = await api.get<VeiculoDetalheAPI>(`/api/veiculos/${id}`)
            setData(res)
            setCapaUrl(res.capa_url ?? "")
            setYoutubeUrl(res.youtube_url ?? "")
            setErro(null)
        } catch (e) {
            setErro(e instanceof Error ? e.message : "Erro ao carregar veículo")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setLoading(true)
        carregar()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    return { data, setData, loading, erro, capaUrl, setCapaUrl, youtubeUrl, setYoutubeUrl, carregar }
}
