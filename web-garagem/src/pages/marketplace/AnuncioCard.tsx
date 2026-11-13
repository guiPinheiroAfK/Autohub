import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { MapPin, Clock, Check, ChevronDown, Heart, Sparkles } from "lucide-react"
import { api } from "@/lib/api/client"
import { cn } from "@/lib/utils"
import type { Anuncio } from "./types"
import { CATEGORIAS, CONDICAO_LABEL, CONDICAO_COLOR } from "./constants"
import { formatPreco, timeAgo } from "./format"
import { ModalInteressados } from "./ModalInteressados"

// ── Card de anúncio ──────────────────────────────────────────────────────────

export function AnuncioCard({
  a, user,
  onStatusChange, onInteresse,
}: {
  a: Anuncio
  user: { garagem: { id: string } } | null
  onStatusChange?: (id: string, status: string) => void
  onInteresse?: (anuncio: Anuncio) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [interessadosOpen, setInteressadosOpen] = useState(false)
  const [jaInteressado, setJaInteressado] = useState(false)
  const isDono = user?.garagem?.id === a.garagem_id

  // Verifica se já demonstrou interesse (só para não-donos logados)
  useEffect(() => {
    if (!user || isDono) return
    api.get<{ interesse: boolean }>(`/api/marketplace/${a.id}/meu-interesse`)
      .then(r => setJaInteressado(r.interesse))
      .catch(() => {})
  }, [a.id, user, isDono])

  return (
    <div className={cn("group relative flex flex-col gap-3 rounded-xl border bg-surface p-4 transition-colors hover:border-border-strong", a.patrocinado ? "border-amber/30" : "border-border")}>
      {a.patrocinado && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-amber/30 bg-amber-bg px-2 py-0.5 text-[10px] font-semibold text-amber">
          <Sparkles className="size-3" />
          Patrocinado
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className={cn("flex-1 min-w-0", a.patrocinado && "pr-20")}>
          <h3 className="truncate text-[14px] font-semibold text-foreground">{a.titulo}</h3>
          {a.descricao && (
            <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{a.descricao}</p>
          )}
        </div>
        {onStatusChange && isDono && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-faint-foreground hover:bg-surface-2"
            >
              ⋯ <ChevronDown className="size-3" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border border-border bg-surface p-1 shadow-lg">
                  {["ativo", "pausado", "vendido"].map(s => (
                    <button
                      key={s}
                      onClick={() => { onStatusChange(a.id, s); setMenuOpen(false) }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors hover:bg-surface-2",
                        a.status === s ? "font-semibold text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {a.status === s && <Check className="size-3" />}
                      {s === "ativo" ? "Ativo" : s === "pausado" ? "Pausado" : "Vendido"}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", CONDICAO_COLOR[a.condicao])}>
          {CONDICAO_LABEL[a.condicao]}
        </span>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
          {CATEGORIAS[a.categoria] ?? a.categoria}
        </span>
        {a.status !== "ativo" && (
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            a.status === "vendido" ? "bg-green-bg text-green" : "bg-surface-2 text-faint-foreground"
          )}>
            {a.status === "vendido" ? "Vendido" : "Pausado"}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="font-data text-[17px] font-bold text-foreground">
          {formatPreco(a.preco, a.moeda)}
        </span>
        {a.localizacao && (
          <div className="flex items-center gap-1 text-[11px] text-faint-foreground">
            <MapPin className="size-3" />
            {a.localizacao}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border/50 pt-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            to={`/g/${a.garagem_slug}`}
            className="text-[11px] text-purple hover:underline truncate"
          >
            {a.garagem_nome}
          </Link>
          <Link
            to={`/loja/${a.garagem_slug}`}
            className="shrink-0 text-[11px] text-purple hover:underline"
          >
            · Ver loja
          </Link>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {a.total_interesses > 0 && (
            <button
              onClick={() => isDono && setInteressadosOpen(true)}
              className={cn(
                "flex items-center gap-1 text-[10px]",
                isDono ? "cursor-pointer text-purple hover:underline" : "text-faint-foreground cursor-default"
              )}
            >
              <Heart className="size-3" />
              {a.total_interesses}
            </button>
          )}
          <span className="flex items-center gap-1 text-[10px] text-faint-foreground">
            <Clock className="size-3" />
            {timeAgo(a.criado_em)}
          </span>
        </div>
      </div>

      {/* Botão de interesse (só para não-donos logados, anúncio ativo) */}
      {user && !isDono && a.status === "ativo" && (
        <button
          disabled={jaInteressado}
          onClick={() => !jaInteressado && onInteresse?.(a)}
          className={cn(
            "mt-0.5 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-[12px] font-medium transition-colors",
            jaInteressado
              ? "bg-green-bg text-green cursor-default"
              : "border border-purple/30 text-purple hover:bg-purple-bg"
          )}
        >
          <Heart className={cn("size-3.5", jaInteressado && "fill-green")} />
          {jaInteressado ? "Interesse demonstrado" : "Tenho interesse"}
        </button>
      )}

      {interessadosOpen && (
        <ModalInteressados anuncioId={a.id} titulo={a.titulo} onClose={() => setInteressadosOpen(false)} />
      )}
    </div>
  )
}
