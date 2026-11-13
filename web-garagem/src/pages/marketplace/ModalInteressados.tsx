import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { X, Users2, MessageSquare } from "lucide-react"
import { api } from "@/lib/api/client"
import type { Interessado } from "./types"
import { timeAgo } from "./format"

// ── Modal de interessados (visão do vendedor) ─────────────────────────────────

export function ModalInteressados({ anuncioId, titulo, onClose }: { anuncioId: string; titulo: string; onClose: () => void }) {
  const [interesses, setInteresses] = useState<Interessado[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<{ interesses: Interessado[] }>(`/api/marketplace/${anuncioId}/interesses`)
      .then(r => setInteresses(r.interesses ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [anuncioId])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">Interessados</h2>
            <p className="text-[11px] text-faint-foreground truncate max-w-[240px]">{titulo}</p>
          </div>
          <button onClick={onClose} className="text-faint-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-2" />)}
            </div>
          ) : interesses.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Users2 className="size-8 text-faint-foreground" />
              <p className="text-[12px] text-muted-foreground">Nenhum interessado ainda.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {interesses.map(i => (
                <div key={i.id} className="rounded-xl border border-border bg-surface-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-purple-bg text-[12px] font-bold text-purple">
                        {(i.nome?.[0] ?? "?").toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-foreground">{i.nome}</p>
                        <p className="text-[11px] text-faint-foreground">{i.email}</p>
                      </div>
                    </div>
                    {i.garagem_slug && (
                      <Link
                        to={`/g/${i.garagem_slug}`}
                        onClick={onClose}
                        className="shrink-0 text-[11px] text-purple hover:underline"
                      >
                        ver garagem
                      </Link>
                    )}
                  </div>
                  {i.mensagem && (
                    <div className="mt-2.5 flex gap-1.5 rounded-lg bg-surface px-3 py-2">
                      <MessageSquare className="mt-0.5 size-3 shrink-0 text-faint-foreground" />
                      <p className="text-[12px] text-muted-foreground italic">{i.mensagem}</p>
                    </div>
                  )}
                  <p className="mt-1.5 text-[10px] text-faint-foreground">{timeAgo(i.criado_em)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
