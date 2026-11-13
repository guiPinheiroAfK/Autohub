import { useState } from "react"
import { X } from "lucide-react"
import { api } from "@/lib/api/client"

export function ModalCriarEvento({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [titulo, setTitulo] = useState("")
  const [descricao, setDescricao] = useState("")
  const [dataInicio, setDataInicio] = useState("")
  const [dataFim, setDataFim] = useState("")
  const [local, setLocal] = useState("")
  const [url, setUrl] = useState("")
  const [tipo, setTipo] = useState("encontro")
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState("")

  const TIPOS_DB = ["encontro","corrida","rally","drift","exposicao","show"]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim() || !dataInicio) { setErro("Preencha título e data."); return }
    setSaving(true); setErro("")
    try {
      await api.post("/api/eventos-calendario", {
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        dataInicio,
        dataFim: dataFim || undefined,
        local: local.trim() || undefined,
        url: url.trim() || undefined,
        tipo,
      })
      onCreated()
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao criar evento")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-base font-semibold text-foreground">Adicionar evento público</h2>
          <button onClick={onClose} className="text-faint-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5 max-h-[80vh] overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Título *</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Encontro de Japoneses SP"
              maxLength={150}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
              required
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Data início *</label>
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:border-purple/50 focus:outline-none"
                required
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Data fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                min={dataInicio}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:border-purple/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Tipo</label>
              <select
                value={tipo}
                onChange={e => setTipo(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:border-purple/50 focus:outline-none"
              >
                {TIPOS_DB.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Local</label>
              <input
                value={local}
                onChange={e => setLocal(e.target.value)}
                placeholder="Ex: Autódromo de Interlagos, SP"
                maxLength={150}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Descrição</label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Detalhes sobre o evento..."
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Link / site oficial</label>
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
            />
          </div>

          {erro && <p className="rounded-lg bg-red-bg px-3 py-2 text-[12px] text-red">{erro}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-border py-2.5 text-[13px] text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-purple py-2.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {saving ? "Publicando..." : "Publicar evento"}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
