import { useState } from "react"
import { api } from "@/lib/api/client"
import type { VeiculoDetalheAPI } from "@/types"
import type { VeiculoDataSetter } from "./types"

interface Params {
    id: string | undefined
    data: VeiculoDetalheAPI | null
    setData: VeiculoDataSetter
    setCapaUrl: (url: string) => void
    youtubeUrl: string
}

// Capa do build (upload no Cloudinary) e link do vídeo do YouTube
export function useMidiaVeiculo({ id, data, setData, setCapaUrl, youtubeUrl }: Params) {
    const [uploadingCapa, setUploadingCapa] = useState(false)
    const [savingYoutube, setSavingYoutube] = useState(false)

    async function handleUploadCapa(file: File) {
        if (!id || !data) return
        if (file.size > 2 * 1024 * 1024) {
            alert("A imagem não pode ultrapassar 2 MB.")
            return
        }
        setUploadingCapa(true)
        try {
            const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
            const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
            const form = new FormData()
            form.append("file", file)
            form.append("upload_preset", preset)
            form.append("folder", "autohub/capas")
            const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
                method: "POST",
                body: form,
            })
            if (!res.ok) throw new Error("Falha no upload")
            const json = await res.json() as { secure_url: string }
            const url = json.secure_url
            await api.patch(`/api/veiculos/${id}`, { capaUrl: url })
            setCapaUrl(url)
            setData({ ...data, capa_url: url })
        } catch {
            alert("Erro ao enviar imagem")
        } finally {
            setUploadingCapa(false)
        }
    }

    async function handleSaveYoutube() {
        if (!id) return
        setSavingYoutube(true)
        try {
            await api.patch(`/api/veiculos/${id}`, { youtubeUrl: youtubeUrl.trim() || null })
        } catch (e) {
            alert(e instanceof Error ? e.message : "Erro ao salvar URL do YouTube")
        } finally {
            setSavingYoutube(false)
        }
    }

    return { uploadingCapa, handleUploadCapa, savingYoutube, handleSaveYoutube }
}
