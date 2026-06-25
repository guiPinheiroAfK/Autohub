import { useState, useEffect, useRef, useCallback } from "react"
import { Camera, X, ChevronLeft, ChevronRight, Trash2, Upload } from "lucide-react"
import { addFoto, getFotos, deleteFoto } from "@/lib/fotos"
import { cn } from "@/lib/utils"

interface FotoUI {
  id: number
  nome: string
  url: string
}

export function FotoGaleria({ veiculoId }: { veiculoId: string }) {
  const [fotos, setFotos] = useState<FotoUI[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<number | null>(null)
  const urlsRef = useRef<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const carregar = useCallback(async () => {
    try {
      const entries = await getFotos(veiculoId)
      urlsRef.current.forEach(u => URL.revokeObjectURL(u))
      urlsRef.current = []
      const novas = entries.map(e => {
        const url = URL.createObjectURL(e.blob)
        urlsRef.current.push(url)
        return { id: e.id, nome: e.nome, url }
      })
      setFotos(novas)
    } catch {
      // IndexedDB pode não estar disponível em modo privado extremo
    } finally {
      setLoading(false)
    }
  }, [veiculoId])

  useEffect(() => {
    carregar()
    return () => { urlsRef.current.forEach(u => URL.revokeObjectURL(u)) }
  }, [carregar])

  // Navegação por teclado no lightbox
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
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue
        await addFoto(veiculoId, file)
      }
      await carregar()
    } catch {
      alert("Erro ao salvar foto. Verifique o espaço disponível no navegador.")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function handleDelete(id: number, idx: number) {
    if (!confirm("Excluir essa foto? Não tem como desfazer.")) return
    try {
      await deleteFoto(id)
      URL.revokeObjectURL(fotos[idx].url)
      const novas = fotos.filter((_, i) => i !== idx)
      setFotos(novas)
      if (lightbox !== null) {
        if (novas.length === 0) setLightbox(null)
        else setLightbox(Math.min(lightbox, novas.length - 1))
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
      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      {lightbox !== null && fotos[lightbox] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/92"
          onClick={() => setLightbox(null)}
        >
          {/* Fechar */}
          <button
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X className="size-5" />
          </button>

          {/* Anterior */}
          {fotos.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); setLightbox(i => i !== null ? (i - 1 + fotos.length) % fotos.length : null) }}
              className="absolute left-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <ChevronLeft className="size-6" />
            </button>
          )}

          {/* Imagem */}
          <img
            src={fotos[lightbox].url}
            alt={fotos[lightbox].nome}
            onClick={e => e.stopPropagation()}
            className="max-h-[88vh] max-w-[88vw] rounded-xl object-contain shadow-2xl"
          />

          {/* Rodapé: contador + excluir */}
          <div
            className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full bg-black/60 px-4 py-2 backdrop-blur-sm"
            onClick={e => e.stopPropagation()}
          >
            <span className="text-[12px] text-white/60">
              {lightbox + 1} / {fotos.length}
            </span>
            <span className="text-white/20">·</span>
            <button
              onClick={() => handleDelete(fotos[lightbox].id, lightbox)}
              className="flex items-center gap-1.5 text-[12px] text-red-400 transition-colors hover:text-red-300"
            >
              <Trash2 className="size-3.5" /> Excluir
            </button>
          </div>

          {/* Próxima */}
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

      {/* ── Grid de fotos ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {fotos.map((foto, idx) => (
          <button
            key={foto.id}
            onClick={() => setLightbox(idx)}
            className="group relative aspect-square w-[88px] overflow-hidden rounded-lg border border-border bg-surface sm:w-[104px]"
          >
            <img
              src={foto.url}
              alt={foto.nome}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/15" />
          </button>
        ))}

        {/* Botão de upload */}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "flex aspect-square w-[88px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-faint-foreground transition-colors hover:border-border-strong hover:text-muted-foreground sm:w-[104px]",
            uploading && "cursor-not-allowed opacity-50"
          )}
        >
          {uploading
            ? <Upload className="size-4 animate-bounce" />
            : <Camera className="size-4" />
          }
          <span className="text-[10px]">{uploading ? "Salvando..." : "Adicionar"}</span>
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
          Fotos ficam salvas só no seu navegador — sem servidor, sem custo.
        </p>
      )}
    </>
  )
}
