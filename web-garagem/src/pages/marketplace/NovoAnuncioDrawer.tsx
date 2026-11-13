import { useState } from "react"
import { X } from "lucide-react"
import { api } from "@/lib/api/client"
import type { Moeda } from "./types"
import { CATEGORIAS_ARRAY, MOEDAS } from "./constants"

export function NovoAnuncioDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [titulo, setTitulo] = useState("")
  const [descricao, setDescricao] = useState("")
  const [preco, setPreco] = useState("")
  const [moeda, setMoeda] = useState<Moeda>("BRL")
  const [categoria, setCategoria] = useState("outro")
  const [condicao, setCondicao] = useState("usado")
  const [localizacao, setLocalizacao] = useState("")
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (titulo.trim().length < 3) { setErro("Título muito curto."); return }
    setSaving(true); setErro("")
    try {
      await api.post("/api/marketplace", {
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        preco: preco ? Number(preco) : undefined,
        moeda,
        categoria,
        condicao,
        localizacao: localizacao.trim() || undefined,
      })
      onCreated()
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao criar anúncio")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col gap-0 rounded-t-2xl border-t border-border bg-surface shadow-xl sm:bottom-auto sm:left-auto sm:right-8 sm:top-20 sm:w-[460px] sm:rounded-2xl sm:border">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-base font-semibold text-foreground">Novo anúncio</h2>
          <button onClick={onClose} className="text-faint-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto p-5" style={{ maxHeight: "80vh" }}>
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Título *</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Kit turbo GT2860RS completo"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Descrição</label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Descreva o estado, características, o que está incluído..."
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Preço</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={preco}
                onChange={e => setPreco(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Moeda</label>
              <select
                value={moeda}
                onChange={e => setMoeda(e.target.value as Moeda)}
                className="rounded-lg border border-border bg-background px-2 py-2 text-[13px] text-foreground focus:border-purple/50 focus:outline-none"
              >
                {MOEDAS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Categoria *</label>
              <select
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:border-purple/50 focus:outline-none"
              >
                {CATEGORIAS_ARRAY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-[12px] font-medium text-foreground">Condição *</label>
              <select
                value={condicao}
                onChange={e => setCondicao(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:border-purple/50 focus:outline-none"
              >
                <option value="novo">Novo</option>
                <option value="usado">Usado</option>
                <option value="recondicionado">Recondicionado</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-medium text-foreground">Localização</label>
            <input
              value={localizacao}
              onChange={e => setLocalizacao(e.target.value)}
              placeholder="Ex: São Paulo - SP"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-faint-foreground focus:border-purple/50 focus:outline-none"
            />
          </div>

          {erro && <p className="rounded-lg bg-red-bg px-3 py-2 text-[12px] text-red">{erro}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border py-2.5 text-[13px] text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-purple py-2.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Publicando..." : "Publicar anúncio"}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
