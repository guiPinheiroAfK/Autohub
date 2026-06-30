import { useState, useEffect, useRef, useCallback } from "react"
import { Camera, X, ChevronLeft, ChevronRight, Trash2, Upload } from "lucide-react"
import { api } from "@/lib/api/client"
import { cn } from "@/lib/utils"

interface Foto {
  id: string
  url: string
  legenda: string | null
}

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string

async function uploadCloudinary(veiculoId: string, file: File): Promise<string> {
  const form = new FormData()
  form.append("file", file)
  form.append("upload_preset", UPLOAD_PRESET)
  form.append("folder", `autohub/fotos/${veiculoId}`)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: form,
  })
  if (!res.ok) throw new Error("Erro no upload Cloudinary")
  const data = await res.json()
  return data.secure_url as string
}

export function FotoGaleria({ veiculoId }: { veiculoId: string }) {
  const [fotos, setFotos] = useState<Foto[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const carregar = useCallback(async () => {
    try {
      const data = await api.get<Foto[]>(`/api/veiculos/${veiculoId}/fotos`)
      setFotos(data)
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [veiculoId])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    if (lightbox === null) return
    const total = fotos.length
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft")  setLightbox(i => i !== null ? (i - 1 + total) % total : null)
      if (e.key === "ArrowRight") setLightbox(i => i !== null ? (i + 1) % total : null)
      if (e.key === "Escape")     setLightbox(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [lightbox, fotos.length])

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      alert("Configure VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET no .env")
      return
    }
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue
        if (file.size > 2 * 1024 * 1024) {
          alert(`"${file.name}" excede 2 MB e foi ignorada.`)
          continue
        }
        const url = await uploadCloudinary(veiculoId, file)
        await api.post(`/api/veiculos/${veiculoId}/fotos`, { url })
      }
      await carregar()
    } catch {
      alert("Erro ao salvar foto.")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function handleDelete(foto: Foto, idx: number) {
    if (!confirm("Excluir essa foto?")) return
    try {
      await api.delete(`/api/veiculos/${veiculoId}/fotos/${foto.id}`)
      setFotos(prev => prev.filter((_, i) => i !== idx))
      if (lightbox !== null) {
        const newLen = fotos.length - 1
        if (newLen === 0) setLightbox(null)
        else setLightbox(Math.min(lightbox, newLen - 1))
      }
    } catch {
      alert("Erro ao excluir foto.")
    }
  }

  if (loading) {
    return (
      <div className="flex gap-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="aspect-square w-[88px] animate-pulse rounded-lg bg-surface-2" />
        ))}
      </div>
    )
  }

  return (
    <>
      {lightbox !== null && fotos[lightbox] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/92"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="size-5" />
          </button>

          {fotos.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); setLightbox(i => i !== null ? (i - 1 + fotos.length) % fotos.length : null) }}
              className="absolute left-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <ChevronLeft className="size-6" />
            </button>
          )}

          <img
            src={fotos[lightbox].url}
            alt={fotos[lightbox].legenda ?? "Foto do build"}
            onClick={e => e.stopPropagation()}
            className="max-h-[88vh] max-w-[88vw] rounded-xl object-contain shadow-2xl"
          />

          <div
            className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full bg-black/60 px-4 py-2 backdrop-blur-sm"
            onClick={e => e.stopPropagation()}
          >
            <span className="text-[12px] text-white/60">{lightbox + 1} / {fotos.length}</span>
            <span className="text-white/20">·</span>
            <button
              onClick={() => handleDelete(fotos[lightbox], lightbox)}
              className="flex items-center gap-1.5 text-[12px] text-red-400 transition-colors hover:text-red-300"
            >
              <Trash2 className="size-3.5" /> Excluir
            </button>
          </div>

          {fotos.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); setLightbox(i => i !== null ? (i + 1) % fotos.length : null) }}
              className="absolute right-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <ChevronRight className="size-6" />
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {fotos.map((foto, idx) => (
          <button
            key={foto.id}
            onClick={() => setLightbox(idx)}
            className="group relative aspect-square w-[88px] overflow-hidden rounded-lg border border-border bg-surface sm:w-[104px]"
          >
            <img
              src={foto.url}
              alt={foto.legenda ?? "Foto"}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/15" />
          </button>
        ))}

        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "flex aspect-square w-[88px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-faint-foreground transition-colors hover:border-border-strong hover:text-muted-foreground sm:w-[104px]",
            uploading && "cursor-not-allowed opacity-50"
          )}
        >
          {uploading ? <Upload className="size-4 animate-bounce" /> : <Camera className="size-4" />}
          <span className="text-[10px]">{uploading ? "Enviando..." : "Adicionar"}</span>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => handleUpload(e.target.files)}
        />
      </div>

      {fotos.length === 0 && !uploading && (
        <p className="mt-1.5 text-[11px] text-faint-foreground">
          Fotos salvas na nuvem — aparecem em qualquer dispositivo.
        </p>
      )}
    </>
  )
}
