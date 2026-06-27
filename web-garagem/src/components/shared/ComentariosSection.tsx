import { useState, useEffect, useRef } from "react"
import { MessageCircle, Send, Trash2 } from "lucide-react"
import { api } from "@/lib/api/client"
import { useAuth } from "@/context/AuthContext"

interface Comentario {
  id: string
  texto: string
  criado_em: string
  autor_nome: string
  autor_avatar: string | null
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "agora"
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export function ComentariosSection({ veiculoId }: { veiculoId: string }) {
  const { user } = useAuth()
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [loading, setLoading] = useState(true)
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    api.get<Comentario[]>(`/api/comentarios/${veiculoId}`)
      .then(setComentarios)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [veiculoId])

  async function enviar() {
    const t = texto.trim()
    if (!t || enviando) return
    setEnviando(true)
    try {
      const novo = await api.post<Comentario>(`/api/comentarios/${veiculoId}`, { texto: t })
      setComentarios(prev => [...prev, novo])
      setTexto("")
      textareaRef.current?.focus()
    } catch {
      alert("Erro ao comentar. Tente novamente.")
    } finally {
      setEnviando(false)
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir comentário?")) return
    try {
      await api.delete(`/api/comentarios/${id}`)
      setComentarios(prev => prev.filter(c => c.id !== id))
    } catch {
      alert("Erro ao excluir.")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="size-4 text-muted-foreground" />
        <h2 className="text-[13px] font-semibold text-foreground">
          Comentários {comentarios.length > 0 && `(${comentarios.length})`}
        </h2>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2].map(i => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : comentarios.length === 0 ? (
        <p className="text-[12px] text-faint-foreground">
          {user ? "Seja o primeiro a comentar." : "Nenhum comentário ainda."}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {comentarios.map(c => (
            <div key={c.id} className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-purple-bg text-[10px] font-bold text-purple">
                {c.autor_avatar
                  ? <img src={c.autor_avatar} className="size-full rounded-full object-cover" alt="" />
                  : c.autor_nome[0].toUpperCase()
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-foreground">{c.autor_nome}</span>
                  <span className="text-[10px] text-faint-foreground">{timeAgo(c.criado_em)}</span>
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground break-words">{c.texto}</p>
              </div>
              {user?.nome === c.autor_nome && (
                <button
                  onClick={() => excluir(c.id)}
                  className="shrink-0 text-faint-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-red"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      {user ? (
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar() } }}
            placeholder="Escreva um comentário..."
            maxLength={500}
            rows={2}
            className="flex-1 resize-none rounded-xl border border-border bg-surface px-3 py-2.5 text-[13px] text-foreground placeholder-faint-foreground outline-none transition-colors focus:border-purple"
          />
          <button
            onClick={enviar}
            disabled={enviando || !texto.trim()}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple text-white transition-opacity disabled:opacity-40 hover:opacity-90"
          >
            <Send className="size-4" />
          </button>
        </div>
      ) : (
        <p className="text-[12px] text-faint-foreground">
          <a href="/login" className="text-purple hover:underline">Faça login</a> para comentar.
        </p>
      )}
    </div>
  )
}
