import { useState } from "react"
import { X } from "lucide-react"
import { api } from "@/lib/api/client"

// ── Modal de interesse (visão do comprador) ────────────────────────────────────

export function ModalInteresse({ anuncioId, titulo, onClose, onSuccess }: {
  anuncioId: string; titulo: string; onClose: () => void; onSuccess: () => void
}) {
  const [mensagem, setMensagem] = useState("")
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErro("")
    try {
      await api.post(`/api/marketplace/${anuncioId}/interesse`, { mensagem: mensagem.trim() || undefined })
      onSuccess()
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao enviar interesse")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">Demonstrar interesse</h2>
            <p className="text-[11px] text-faint-foreground truncate max-w-[220px]">{titulo}</p>
          </div>
          <button onClick={onClose} className="text-faint-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          <p className="text-[12px] text-muted-foreground">
            O vendedor receberá uma notificação com seu nome e e-mail de contato. Você pode deixar uma mensagem opcional.
          </p>
          <textarea
            value={mensagem}
            onChange={e => setMensagem(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Ex: Ainda disponível? Posso retirar em SP."
            className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
          />
          {erro && <p className="text-[12px] text-red">{erro}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border py-2.5 text-[13px] text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-purple py-2.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {loading ? "Enviando..." : "Confirmar interesse"}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
